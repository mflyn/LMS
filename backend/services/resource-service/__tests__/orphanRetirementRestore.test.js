const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('../../../../node_modules/mongodb-memory-server');
const Asset = require('../models/MediaAsset');
const Reference = require('../models/MediaReference');
const Operation = require('../models/MediaReferenceOperation');
const Retirement = require('../models/MediaOrphanRetirement');
const Guard = require('../models/CompletionUploadGuard');
const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');
const Family = require('../../../common/models/Family');
const User = require('../models/FamilyUser');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const { createPrivateMediaStore } = require('../services/privateMediaStore');
const { createMediaReferenceOperationService } = require('../services/mediaReferenceOperationService');
const { createOrphanRetirementJournal } = require('../services/orphanRetirementJournal');
const { createOrphanRetirementService } = require('../services/orphanRetirementService');
const { createCompletionUploadService } = require('../services/completionUploadService');
const { createMediaService } = require('../services/mediaService');
const { createMediaCapabilityService } = require('../services/mediaCapability');
const { canonicalMetadata, hash } = require('../services/completionUploadRecord');

jest.setTimeout(30000);
const id = () => new mongoose.Types.ObjectId();
const START = Date.parse('2026-10-23T00:00:00Z'), DAY = 86400000;
const models = [Asset, Reference, Operation, Retirement, Guard, Tombstone, Receipt];
let mongo, runner, root, store, journal, client, now, familyId, childId, actor, operations;
const snapshot = () => Promise.all(models.map(m => m.collection.find().sort({ _id: 1 }).toArray()));
const make = (options = {}) => {
  const { createOrphanRetirementRestore } = require('../services/orphanRetirementRestore');
  return createOrphanRetirementRestore({ transactionRunner: runner, journal, retirementClient: client,
    mediaStore: store, now: () => now, ...options });
};
const restore = (mediaId, helper = make(), options = {}) => helper.restore({
  mediaId: String(mediaId), writesPaused: true, execute: true, ...options
});
const newAsset = async () => {
  const { storageKey } = await store.writeCanonical(Buffer.from('synthetic'));
  return Asset.create({ familyId, childId, uploadedBy: actor.id, purpose: 'task_completion',
    mimeType: 'image/jpeg', sizeBytes: 9, storageKey, retentionPolicyVersion: 1,
    createdAt: new Date(START), orphanEligibleAt: new Date(START + DAY) });
};
const command = assets => ({ familyId: String(familyId), childId: String(childId), resourceType: 'growth_task',
  resourceId: String(id()), operationId: randomUUID(), commandHash: 'a'.repeat(64),
  references: assets.map(a => ({ mediaId: String(a._id), field: 'completionMediaIds' })) });

// Generate the journal using the actual online protocol, then rewind only this isolated RS.
const fixture = async (siblingGeneration = 'A') => {
  const target = await newAsset(), sibling = await newAsset(), a = command([target, sibling]);
  await operations.prepare(a);
  const backup = await snapshot();
  now += 1000; await operations.abort(a);
  const b = { ...a, operationId: randomUUID(), commandHash: 'b'.repeat(64) };
  await operations.prepare(b); now += 1000; await operations.abort(b);
  let c;
  if (siblingGeneration === 'C') {
    c = { ...a, references: [{ mediaId: String(sibling._id), field: 'completionMediaIds' }],
      operationId: randomUUID(), commandHash: 'c'.repeat(64) };
    await operations.prepare(c); await operations.commit(c);
  }
  const currentSibling = await Reference.findOne({ mediaId: sibling._id }).lean();
  const currentC = c && await Operation.findOne({ operationId: c.operationId }).lean();
  now = START + DAY;
  const gc = createOrphanRetirementService({ transactionRunner: runner, mediaStore: store,
    retirementClient: client, now: () => now, journal: { persist: async proof => {
      await journal.persist(proof); throw Error('synthetic stop after durable journal, before unlink');
    } } });
  await expect(gc.retire({ mediaId: String(target._id) })).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
  const evidence = await journal.read(String(target._id));
  for (let i = 0; i < models.length; i += 1) {
    await models[i].collection.deleteMany({});
    if (backup[i].length) await models[i].collection.insertMany(backup[i]);
  }
  if (siblingGeneration !== 'A') {
    await Reference.collection.replaceOne({ _id: currentSibling._id }, currentSibling);
    if (currentC) await Operation.collection.insertOne(currentC);
  }
  client.retire.mockClear();
  return { target, sibling, a, b, c, evidence, currentSibling };
};

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri());
  for (const model of Object.values(mongoose.models)) await model.init();
  runner = createMongoTransactionRunner(mongoose.connection);
});
beforeEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'lms-t2-g-restore-')));
  store = createPrivateMediaStore({ root: path.join(root, 'media') });
  journal = createOrphanRetirementJournal({ root: path.join(root, 'journal') });
  familyId = id(); childId = id(); actor = { id: String(id()), role: 'parent' }; now = START;
  await Family.create({ _id: familyId, familyName: 'Synthetic', ownerParentId: actor.id,
    memberParentIds: [actor.id], childIds: [childId] });
  await User.create([{ _id: actor.id, role: 'parent' }, { _id: childId, familyId, role: 'student' }]);
  client = { retire: jest.fn(async body => ({ ...body, state: 'granted' })) };
  operations = createMediaReferenceOperationService({ transactionRunner: runner, now: () => now });
});
afterEach(async () => { jest.restoreAllMocks(); if (root) await fs.rm(root, { recursive: true, force: true }); });
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test('exports an explicit unmounted restoration factory', () => {
  expect(() => make()).not.toThrow();
  expect(make().restore).toEqual(expect.any(Function));
});

test.each(['A', 'B', 'C'])('T2-G-007 restores A PREPARED and B ABSENT, preserves sibling generation %s', async generation => {
  const f = await fixture(generation);
  const siblingBefore = await Asset.findById(f.sibling._id).lean();
  const preparedBefore = await Operation.findOne({ operationId: f.a.operationId }).lean();
  const journalBefore = await fs.readFile(path.join(root, 'journal', String(f.target._id) + '.json'));
  const result = await restore(f.target._id);
  expect(result).toMatchObject({ state: 'RESOURCE_RESTORED_HOMEWORK_RETIRED', ready: false });
  for (const proof of f.evidence.operations) {
    const op = await Operation.findById(proof._id).lean();
    expect(op).toMatchObject({ state: 'ABORTED', operationId: proof.operationId, commandHash: proof.commandHash,
      referenceSetHash: proof.referenceSetHash, version: proof.version, failureCode: proof.failureCode,
      leaseExpiresAt: null, terminalAt: new Date(proof.terminalAt) });
    expect(op.references.map(r => String(r.mediaId)).sort()).toEqual([String(f.target._id), String(f.sibling._id)].sort());
  }
  expect((await Operation.findById(preparedBefore._id)).createdAt).toEqual(preparedBefore.createdAt);
  const siblingRef = await Reference.findOne({ mediaId: f.sibling._id }).lean();
  if (generation === 'A') expect(siblingRef).toMatchObject({ operationId: f.a.operationId,
    state: 'released', releaseOperationId: f.a.operationId, leaseExpiresAt: null,
    releasedAt: new Date(f.evidence.operations.find(o => o.operationId === f.a.operationId).terminalAt) });
  else expect(siblingRef).toEqual(f.currentSibling);
  expect(await Asset.findById(f.sibling._id).lean()).toEqual(siblingBefore);
  expect(await store.read(f.sibling.storageKey)).toEqual(Buffer.from('synthetic'));
  expect(await store.read(f.target.storageKey)).toEqual(Buffer.from('synthetic'));
  expect(await Asset.findById(f.target._id).lean()).toMatchObject({ status: 'deleted',
    orphanRetirementId: f.evidence.retirement.retirementId, deletedAt: new Date(f.evidence.retirement.deletedAt),
    privacyDeletionRecorded: false });
  expect(await Retirement.findOne().lean()).toMatchObject({ state: 'DELETED', evidence: f.evidence, purgedAt: null });
  expect(await Guard.findOne().lean()).toMatchObject({ state: 'RETIRED', metadataHash: f.evidence.retirement.uploadMetadataHash });
  expect(await Tombstone.countDocuments()).toBe(0); expect(await Receipt.countDocuments()).toBe(0);
  expect(await fs.readFile(path.join(root, 'journal', String(f.target._id) + '.json'))).toEqual(journalBefore);
  expect(client.retire).toHaveBeenCalledWith({ familyId: String(familyId), childId: String(childId),
    mediaId: String(f.target._id), retirementId: f.evidence.retirement.retirementId });
  expect((await operations.prepare(f.a)).operation.state).toBe('ABORTED');
  const late = { ...f.a, operationId: randomUUID() };
  expect((await operations.prepare(late)).operation).toMatchObject({ state: 'ABORTED', failureCode: 'RESOURCE_NOT_FOUND' });
  const before = await snapshot();
  await restore(f.target._id, make()); expect(await snapshot()).toEqual(before);
});

test('phased in_use restores resource first without claiming homework convergence or deleting bytes', async () => {
  const f = await fixture();
  client.retire.mockImplementationOnce(async body => {
    expect((await Operation.findOne({ operationId: f.a.operationId })).state).toBe('ABORTED');
    expect((await Guard.findOne()).state).toBe('RETIRED');
    return { ...body, state: 'in_use' };
  });
  expect(await restore(f.target._id)).toMatchObject({ state: 'RESOURCE_RESTORED_PENDING_HOMEWORK',
    nextAction: 'RECOVER_HOMEWORK_ORIGINAL_ACTOR', ready: false });
  const before = await snapshot();
  expect(await store.read(f.target.storageKey)).toHaveLength(9);
  // Only the dedicated remote boundary is simulated; no homework DB/model is imported.
  expect(await restore(f.target._id, make())).toMatchObject({ state: 'RESOURCE_RESTORED_HOMEWORK_RETIRED', ready: false });
  expect(await snapshot()).toEqual(before);
  expect(client.retire.mock.calls[1][0]).toEqual(client.retire.mock.calls[0][0]);
});

test('P3 a late CAS miss rolls back already-written references, operations and upload guard', async () => {
  const f = await fixture(), before = await snapshot();
  const journalBefore = await journal.read(String(f.target._id));
  let witnessedWrites = false;
  const cas = jest.spyOn(Asset, 'updateOne').mockImplementationOnce(async (_filter, _update, options) => {
    expect(options.session.inTransaction()).toBe(true);
    const refs = await Reference.find().session(options.session).lean();
    expect(refs).toHaveLength(2);
    expect(refs.every(ref => ref.state === 'released')).toBe(true);
    const ops = await Operation.find().session(options.session).lean();
    expect(ops).toHaveLength(2);
    expect(ops.every(op => op.state === 'ABORTED')).toBe(true);
    expect(await Guard.findOne().session(options.session).lean()).toMatchObject({ state: 'RETIRED' });
    witnessedWrites = true;
    return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
  });
  await expect(restore(f.target._id)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_INCONSISTENT' });
  expect(witnessedWrites).toBe(true);
  expect(cas).toHaveBeenCalledTimes(1);
  expect(await snapshot()).toEqual(before);
  expect(client.retire).not.toHaveBeenCalled();
  expect(await journal.read(String(f.target._id))).toEqual(journalBefore);
  expect(await store.read(f.target.storageKey)).toEqual(Buffer.from('synthetic'));
  expect(await store.read(f.sibling.storageKey)).toEqual(Buffer.from('synthetic'));
  cas.mockRestore();
  expect(await restore(f.target._id, make())).toMatchObject({ state: 'RESOURCE_RESTORED_HOMEWORK_RETIRED' });
});

test.each([{ writesPaused: false }, { execute: false }, { writesPaused: undefined }, { execute: undefined }])
('requires explicit paused writes and execute before any effect: %j', async options => {
  const f = await fixture(), before = await snapshot();
  await expect(restore(f.target._id, make(), options)).rejects.toMatchObject({ code: 'MEDIA_RESTORE_CONFIRMATION_REQUIRED' });
  expect(await snapshot()).toEqual(before); expect(client.retire).not.toHaveBeenCalled();
});

test.each(['hash', 'scope', 'set', 'date', 'reference generation', 'duplicate operation', 'omitted history', 'path',
  'missing reference projection', 'stale reference projection', 'oversized history', 'reference family', 'reference child'])
('invalid immutable journal %s rejects without any DB changes', async kind => {
  const f = await fixture(), proof = JSON.parse(JSON.stringify(f.evidence));
  if (kind === 'hash') proof.operations[0].referenceSetHash = 'f'.repeat(64);
  if (kind === 'scope') proof.operations[0].childId = String(id());
  if (kind === 'set') proof.operations[0].references.pop();
  if (kind === 'date') proof.operations[0].terminalAt = new Date(now + 1).toISOString();
  if (kind === 'reference generation') proof.references[0].releaseOperationId = randomUUID();
  if (kind === 'duplicate operation') proof.operations.push(proof.operations[0]);
  if (kind === 'omitted history') proof.operations = proof.operations.filter(o => o.operationId !== f.a.operationId);
  if (kind === 'path') proof.retirement.storageKey = '../synthetic';
  if (kind === 'reference family') proof.references[0].familyId = String(id());
  if (kind === 'reference child') proof.references[0].childId = String(id());
  if (kind === 'missing reference projection') proof.references = [];
  if (kind === 'stale reference projection') {
    const original = proof.operations.find(o => o.operationId === f.a.operationId);
    Object.assign(proof.references[0], { operationId: original.operationId,
      releaseOperationId: original.operationId, releasedAt: original.terminalAt });
  }
  if (kind === 'oversized history') {
    for (let i = proof.operations.length; i <= 100; i += 1) proof.operations.push({ ...proof.operations[0],
      _id: String(id()), operationId: randomUUID(), version: 0 });
    proof.operations.sort((a, b) => a._id.localeCompare(b._id));
  }
  const before = await snapshot();
  await expect(restore(f.target._id, make({ journal: { read: async () => proof } })))
    .rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_INCONSISTENT' });
  expect(await snapshot()).toEqual(before); expect(client.retire).not.toHaveBeenCalled();
  expect(await store.read(f.target.storageKey)).toHaveLength(9);
});

test.each(['COMMITTED', 'command hash', 'version', 'extra reference', 'foreign sibling', 'unknown target generation',
  'guard hash', 'retirement identity', 'asset hash', 'missing asset', 'privacy audit', 'missing prepared member',
  'missing sibling asset', 'different operation id', 'different reference id', 'invalid lease', 'early eligibility'])
('backup conflict %s fails closed before writes', async kind => {
  const f = await fixture();
  if (kind === 'COMMITTED') await operations.commit(f.a);
  if (kind === 'command hash') await Operation.collection.updateOne({ operationId: f.a.operationId }, { $set: { commandHash: 'f'.repeat(64) } });
  if (kind === 'version') await Operation.updateOne({ operationId: f.a.operationId }, { $set: { version: 10 } });
  if (kind === 'extra reference') {
    const ref = await Reference.findOne().lean();
    await Reference.collection.insertOne({ ...ref, _id: id(), mediaId: id() });
  }
  if (kind === 'foreign sibling') await Reference.updateOne({ mediaId: f.sibling._id }, { $set: { childId: id() } });
  if (kind === 'unknown target generation') await Reference.updateOne({ mediaId: f.target._id }, { $set: { operationId: randomUUID() } });
  if (kind === 'guard hash') await Guard.create({ mediaId: f.target._id, familyId, childId,
    storageKey: f.target.storageKey, metadataHash: 'f'.repeat(64), state: 'REGISTERED', revision: 1 });
  if (kind === 'retirement identity') await Retirement.create({ ...f.evidence.retirement, retirementId: randomUUID(),
    state: 'CANDIDATE', revision: 1, deletedAt: null });
  if (kind === 'asset hash') await Asset.updateOne({ _id: f.target._id }, { $set: { sizeBytes: 8 } });
  if (kind === 'missing asset') await Asset.deleteOne({ _id: f.target._id });
  if (kind === 'privacy audit') await Asset.updateOne({ _id: f.target._id }, { $set: { privacyDeletionRecorded: true } });
  if (kind === 'missing prepared member') await Reference.deleteOne({ mediaId: f.sibling._id });
  if (kind === 'missing sibling asset') await Asset.deleteOne({ _id: f.sibling._id });
  if (kind === 'different operation id') {
    const op = await Operation.findOne().lean();
    await Operation.deleteOne({ _id: op._id }); await Operation.collection.insertOne({ ...op, _id: id() });
  }
  if (kind === 'different reference id') {
    const ref = await Reference.findOne({ mediaId: f.target._id }).lean();
    await Reference.deleteOne({ _id: ref._id }); await Reference.collection.insertOne({ ...ref, _id: id() });
  }
  if (kind === 'invalid lease') await Reference.updateOne({ mediaId: f.sibling._id }, { $set: { leaseExpiresAt: new Date(now) } });
  if (kind === 'early eligibility') await Asset.collection.updateOne({ _id: f.target._id }, { $set: { createdAt: new Date(now) } });
  const before = await snapshot();
  await expect(restore(f.target._id)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_INCONSISTENT' });
  expect(await snapshot()).toEqual(before); expect(client.retire).not.toHaveBeenCalled();
  expect(await store.read(f.target.storageKey)).toHaveLength(9);
});

test.each(['rollback', 'lost commit'])('atomic %s is restartable with original ids and audit', async mode => {
  const f = await fixture(), before = await snapshot(); let failed = false;
  const faulty = async work => {
    const result = await runner(async session => {
      const value = await work(session);
      if (!failed && mode === 'rollback') { failed = true; throw Error('synthetic rollback'); }
      return value;
    });
    if (!failed) { failed = true; throw Error('synthetic lost commit acknowledgement'); }
    return result;
  };
  await expect(restore(f.target._id, make({ transactionRunner: faulty }))).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
  expect(client.retire).not.toHaveBeenCalled();
  if (mode === 'rollback') expect(await snapshot()).toEqual(before);
  else expect((await Retirement.findOne()).state).toBe('DELETED');
  expect((await restore(f.target._id, make())).state).toBe('RESOURCE_RESTORED_HOMEWORK_RETIRED');
  expect((await Retirement.findOne()).evidence).toEqual(f.evidence);
});

test.each(['unavailable', 'wrong id', 'extra keys'])('remote %s never claims retirement granted', async kind => {
  const f = await fixture();
  client.retire.mockImplementationOnce(async body => {
    if (kind === 'unavailable') throw Error('synthetic timeout');
    return { ...body, state: 'granted', ...(kind === 'wrong id' ? { retirementId: randomUUID() } : { force: true }) };
  });
  expect(await restore(f.target._id)).toMatchObject({ state: 'RESOURCE_RESTORED_PENDING_HOMEWORK',
    nextAction: 'RETRY_RETIREMENT', ready: false });
  expect((await Retirement.findOne()).state).toBe('DELETED');
  expect(await store.read(f.target.storageKey)).toHaveLength(9);
  expect((await restore(f.target._id)).state).toBe('RESOURCE_RESTORED_HOMEWORK_RETIRED');
});

test('restored UploadGuard denies late upload even when target metadata is gone', async () => {
  const f = await fixture(); await restore(f.target._id);
  const record = { version: 1, mediaId: String(f.target._id), identity: actor,
    metadata: canonicalMetadata(f.target), metadataHash: hash(canonicalMetadata(f.target)) };
  await Asset.deleteOne({ _id: f.target._id });
  const before = await snapshot();
  const upload = createCompletionUploadService({ transactionRunner: runner, mediaStore: store,
    journal: { persist: async () => { throw Error('not uploading'); } }, now: () => now });
  await expect(upload.resume(record)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  expect(await snapshot()).toEqual(before); expect(await store.read(f.target.storageKey)).toHaveLength(9);
});

test('P2#3 a rebuilt upload guard passes real readiness with reconstruction timestamps, not deletion audit times', async () => {
  const f = await fixture();
  expect(await Guard.findOne({ mediaId: f.target._id })).toBeNull();
  now += DAY;
  const reconstructionTime = new Date(now);
  await restore(f.target._id);
  const { assertCompletionRetentionReadiness } = require('../services/completionRetentionReadiness');
  client.status = jest.fn(async body => ({ ...body, state: 'retired' }));
  const before = await snapshot();
  await expect(assertCompletionRetentionReadiness({ connection: mongoose.connection,
    writesPaused: true, journal, retirementClient: client })).resolves.toMatchObject({ ready: true });
  expect(await snapshot()).toEqual(before);
  const guard = await Guard.findOne({ mediaId: f.target._id }).lean();
  expect(guard).toMatchObject({ state: 'RETIRED', createdAt: reconstructionTime, updatedAt: reconstructionTime });
  expect(guard.createdAt).not.toEqual(new Date(f.evidence.retirement.createdAt));
  expect(await Retirement.findOne().lean()).toMatchObject({ createdAt: new Date(f.evidence.retirement.createdAt),
    deletedAt: new Date(f.evidence.retirement.deletedAt), evidence: f.evidence });
  now += DAY; await restore(f.target._id, make());
  expect(await Guard.findOne({ mediaId: f.target._id }).lean()).toEqual(guard);
});

test('granted restoration can hand physical cleanup to the existing orphan service', async () => {
  const f = await fixture('C'); await restore(f.target._id);
  const gc = createOrphanRetirementService({ transactionRunner: runner, mediaStore: store,
    retirementClient: client, journal, now: () => now });
  expect(await gc.retire({ mediaId: String(f.target._id) })).toEqual({ state: 'PURGED' });
  expect(await store.read(f.sibling.storageKey)).toHaveLength(9);
  expect(await Reference.findOne({ mediaId: f.sibling._id }).lean()).toEqual(f.currentSibling);
  const before = await snapshot();
  expect((await restore(f.target._id)).state).toBe('RESOURCE_RESTORED_HOMEWORK_RETIRED');
  expect(await snapshot()).toEqual(before);
});

test('ABSENT ledgers and references replay original identities without synthesizing sibling rows', async () => {
  const f = await fixture();
  await Operation.deleteMany({}); await Reference.deleteMany({});
  const siblingBefore = await Asset.findById(f.sibling._id).lean();
  await restore(f.target._id);
  expect(await Operation.countDocuments({ state: 'ABORTED' })).toBe(2);
  expect(await Reference.countDocuments({ mediaId: f.sibling._id })).toBe(0);
  expect(String((await Reference.findOne())._id)).toBe(f.evidence.references[0]._id);
  expect(await Asset.findById(f.sibling._id).lean()).toEqual(siblingBefore);
});

test.each(['prepared', 'bound'])('a valid newer sibling generation %s is preserved byte-for-byte', async state => {
  const f = await fixture('C');
  if (state === 'prepared') {
    await Operation.updateOne({ operationId: f.c.operationId }, { $set: {
      state: 'PREPARED', terminalAt: null, version: 0, leaseExpiresAt: new Date(now + DAY) } });
    await Reference.updateOne({ mediaId: f.sibling._id }, { $set: { state: 'prepared', leaseExpiresAt: new Date(now + DAY) } });
  }
  const row = await Reference.findOne({ mediaId: f.sibling._id }).lean();
  const op = await Operation.findOne({ operationId: f.c.operationId }).lean();
  await restore(f.target._id);
  expect(await Reference.findById(row._id).lean()).toEqual(row);
  expect(await Operation.findById(op._id).lean()).toEqual(op);
});

test('an unknown sibling generation with no complete ledger cannot be preserved as if valid', async () => {
  const f = await fixture('C');
  await Operation.deleteOne({ operationId: f.c.operationId });
  const before = await snapshot();
  await expect(restore(f.target._id)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_INCONSISTENT' });
  expect(await snapshot()).toEqual(before); expect(client.retire).not.toHaveBeenCalled();
});

test.each(['missing', 'unreadable', 'no transaction'])('missing recovery prerequisite %s never writes or calls remote', async mode => {
  const f = await fixture(), before = await snapshot();
  const options = mode === 'no transaction' ? { transactionRunner: work => work(null) }
    : { journal: { read: async () => { if (mode === 'unreadable') throw Error('synthetic I/O failure'); return null; } } };
  await expect(restore(f.target._id, make(options))).rejects.toMatchObject({
    code: mode === 'missing' ? 'MEDIA_RETIREMENT_INCONSISTENT' : 'MEDIA_RETIREMENT_PENDING' });
  expect(await snapshot()).toEqual(before); expect(client.retire).not.toHaveBeenCalled();
});

test('restoring an existing candidate and registered guard preserves their first identities', async () => {
  const f = await fixture();
  const r = await Retirement.create({ ...f.evidence.retirement, state: 'CANDIDATE', deletedAt: null, revision: 1 });
  const g = await Guard.create({ mediaId: f.target._id, familyId, childId, storageKey: f.target.storageKey,
    metadataHash: f.evidence.retirement.uploadMetadataHash, state: 'REGISTERED', revision: 1 });
  await restore(f.target._id);
  expect(await Retirement.findById(r._id).lean()).toMatchObject({ state: 'DELETED', revision: 2, createdAt: r.createdAt });
  expect(await Guard.findById(g._id).lean()).toMatchObject({ state: 'RETIRED', revision: 2,
    createdAt: g.createdAt, updatedAt: g.updatedAt });
});

test.each(['RESOURCE_NOT_FOUND', 'MEDIA_OPERATION_ABORTED'])('late never-prepared %s remains outside frozen history', async failureCode => {
  const f = await fixture(); await restore(f.target._id); now += 1;
  const late = { ...f.a, operationId: randomUUID() };
  await operations[failureCode === 'RESOURCE_NOT_FOUND' ? 'prepare' : 'abort'](late);
  const before = await snapshot();
  await restore(f.target._id);
  expect(await snapshot()).toEqual(before);
  expect((await Retirement.findOne()).evidence).toEqual(f.evidence);
});

test.each(['version', 'failure code', 'predeletion time', 'any group reference'])
('late operation with invalid %s cannot replace journal proof', async kind => {
  const f = await fixture(); await restore(f.target._id); now += 1;
  const late = { ...f.a, operationId: randomUUID() }; await operations.prepare(late);
  if (kind === 'version') await Operation.updateOne({ operationId: late.operationId }, { $set: { version: 1 } });
  if (kind === 'failure code') await Operation.updateOne({ operationId: late.operationId }, { $set: { failureCode: 'RESOURCE_CONFLICT' } });
  if (kind === 'predeletion time') await Operation.updateOne({ operationId: late.operationId }, { $set: { terminalAt: new Date(START) } });
  if (kind === 'any group reference') await Reference.create({ familyId, childId, resourceId: late.resourceId,
    resourceType: 'growth_task', field: 'completionMediaIds', mediaId: id(), operationId: late.operationId,
    state: 'released', releaseOperationId: late.operationId, releasedAt: new Date(now), leaseExpiresAt: null });
  const before = await snapshot(); client.retire.mockClear();
  await expect(restore(f.target._id)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_INCONSISTENT' });
  expect(await snapshot()).toEqual(before); expect(client.retire).not.toHaveBeenCalled();
});

test('previously valid signed URL and access issuance fail after restoration while sibling bytes survive', async () => {
  const f = await fixture();
  const capability = createMediaCapabilityService({ secret: 'synthetic-test-only-signing-key-32-chars', now: () => now });
  const media = createMediaService({ MediaReferenceModel: Reference, FamilyModel: Family, UserModel: User,
    capabilityService: capability, mediaStore: store, transactionRunner: runner, now: () => now });
  const access = await media.issueAccess({ identity: actor, mediaId: String(f.target._id) });
  const url = new URL(access.access.url, 'https://synthetic.invalid');
  const request = { mediaId: String(f.target._id), path: url.pathname, ...Object.fromEntries(url.searchParams) };
  expect((await media.readContent(request)).bytes).toEqual(Buffer.from('synthetic'));
  client.retire.mockImplementationOnce(async body => ({ ...body, state: 'in_use' }));
  await restore(f.target._id);
  await expect(media.readContent(request)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  await expect(media.issueAccess({ identity: actor, mediaId: String(f.target._id) })).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  expect(await store.read(f.target.storageKey)).toHaveLength(9);
  expect(await store.read(f.sibling.storageKey)).toHaveLength(9);
});

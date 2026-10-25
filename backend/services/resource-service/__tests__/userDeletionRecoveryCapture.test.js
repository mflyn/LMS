const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('../../../../node_modules/mongodb-memory-server');
const Asset = require('../models/MediaAsset');
const Reference = require('../models/MediaReference');
const Operation = require('../models/MediaReferenceOperation');
const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');
const Guard = require('../models/CompletionUploadGuard');
const Recovery = require('../models/MediaUserDeletionRecovery');
const Family = require('../../../common/models/Family');
const User = require('../models/FamilyUser');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const { createMediaReferenceOperationService } = require('../services/mediaReferenceOperationService');
const { createCompletionMediaPrivacyService } = require('../services/completionMediaPrivacyService');
const { createCompletionMediaCleanupService } = require('../services/completionMediaCleanupService');
const { validateEvidence, serializeEvidence } = require('../services/userDeletionRecoveryEvidence');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

jest.setTimeout(30000);
const id = () => new mongoose.Types.ObjectId();
const DAY = 86400000;
const models = [Asset, Reference, Operation, Tombstone, Receipt, Guard, Recovery, Family, User];
let mongo, runner, time, parent, second, child, family, operations, journal, recoveryJournal, privacy, logs, proofs;
const snapshot = async () => Object.fromEntries(await Promise.all(models.map(async model =>
  [model.modelName, await model.collection.find({}).sort({ _id: 1 }).toArray()])));
const makePrivacy = (options = {}) => createCompletionMediaPrivacyService({ transactionRunner: runner,
  now: () => time, journal, recoveryJournal, ...options });
const fixture = async (count = 2) => {
  const assets = await Asset.create(Array.from({ length: count }, () => ({ familyId: family._id,
    childId: child._id, uploadedBy: child._id, purpose: 'task_completion', mimeType: 'image/jpeg',
    sizeBytes: 16, storageKey: randomUUID() })));
  const command = { familyId: String(family._id), childId: String(child._id), resourceType: 'growth_task',
    resourceId: String(id()), operationId: randomUUID(), commandHash: 'a'.repeat(64),
    references: assets.map(asset => ({ mediaId: String(asset._id), field: 'completionMediaIds' })) };
  return { assets, command };
};
const del = (asset, identity = parent, service = privacy) => service.deleteMedia({ mediaId: String(asset._id), identity });
const proofFor = async asset => (await Recovery.findOne({ mediaId: asset._id }).lean())?.evidence;
const ledger = command => Operation.findOne({ operationId: command.operationId }).lean();
const mediaStoreFor = remove => ({ remove, syncDirectory: jest.fn(async () => {}) });

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri());
  for (const model of models) await model.init();
  runner = createMongoTransactionRunner(mongoose.connection);
});
beforeEach(async () => {
  for (const model of models) await model.collection.deleteMany({});
  time = Date.parse('2026-10-23T01:00:00.000Z');
  jest.spyOn(mongoose, 'now').mockImplementation(() => new Date(time));
  parent = { id: String(id()), role: 'parent' }; second = { id: String(id()), role: 'parent' };
  const childId = id();
  family = await Family.create({ familyName: 'Synthetic', ownerParentId: parent.id,
    memberParentIds: [parent.id, second.id], childIds: [childId] });
  await User.create([{ _id: parent.id, role: 'parent' }, { _id: second.id, role: 'parent' }]);
  child = await User.create({ _id: childId, role: 'student', familyId: family._id, childProfile: { tokenVersion: 0 } });
  logs = new Map(); proofs = new Map();
  journal = { persist: jest.fn(async evidence => { logs.set(evidence.tombstone.mediaId, JSON.stringify(evidence)); }) };
  recoveryJournal = { persist: jest.fn(async evidence => {
    const bytes = serializeEvidence(evidence), key = evidence.tombstone.mediaId;
    if (proofs.has(key) && proofs.get(key) !== bytes) throw Error('conflicting immutable proof');
    proofs.set(key, bytes);
  }), read: jest.fn(async mediaId => proofs.has(mediaId) ? JSON.parse(proofs.get(mediaId)) : null) };
  operations = createMediaReferenceOperationService({ transactionRunner: runner, now: () => time });
  privacy = makePrivacy();
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test.each(['empty', 'prepared', 'committed'])('UDR-001 freezes %s proof in the same deletion transaction', async kind => {
  const { assets, command } = await fixture();
  if (kind !== 'empty') await operations.prepare(command);
  if (kind === 'committed') { time += 10; await operations.commit(command); }
  const before = await ledger(command); time += 10;
  await del(assets[0]);
  const proof = await proofFor(assets[0]);
  expect(proof).toBeDefined(); expect(validateEvidence(proof)).toEqual(proof);
  expect(proof.tombstone).toMatchObject({ actorId: parent.id, deletedAt: new Date(time).toISOString() });
  expect((await Guard.findOne({ mediaId: assets[0]._id }).lean()).state).toBe('RETIRED');
  expect(await Asset.findById(assets[1]._id).lean()).toMatchObject({ status: 'active' });
  expect(proofs.get(String(assets[0]._id))).toBe(serializeEvidence(proof));
  if (kind === 'empty') expect([proof.operations, proof.referenceEffects, proof.receipts]).toEqual([[], [], []]);
  else {
    expect(proof.operations).toHaveLength(1);
    expect(proof.operations[0].before._id).toBe(String(before._id));
    expect(proof.operations[0].after.version).toBe(before.version + 1);
    expect(proof.referenceEffects).toHaveLength(kind === 'prepared' ? 2 : 1);
    expect(proof.receipts).toHaveLength(kind === 'prepared' ? 0 : 1);
  }
});

test('UDR-001 preserves overwritten ABORTED and ordinary-unbound COMMITTED history without fake receipts', async () => {
  const { assets, command } = await fixture(); await operations.prepare(command);
  time += 10; await operations.abort(command);
  const aborted = await ledger(command);
  const next = { ...command, operationId: randomUUID() }; time += 10;
  await operations.prepare(next); time += 10; await operations.commit(next);
  time += 10;
  await operations.unbind({ familyId: next.familyId, childId: next.childId, resourceType: next.resourceType,
    resourceId: next.resourceId, operationId: randomUUID(), references: next.references.map(ref =>
      ({ ...ref, bindingOperationId: next.operationId })) });
  const committed = await ledger(next); time += 10; await del(assets[0]);
  const proof = await proofFor(assets[0]); expect(proof).toBeDefined();
  expect(proof.operations.map(pair => pair.before)).toEqual([null, null]);
  expect(proof.operations.map(pair => pair.after._id)).toEqual([aborted, committed].map(row => String(row._id)).sort());
  expect(proof.referenceEffects).toEqual([]); expect(proof.receipts).toEqual([]);
});

test('UDR-009 external v2 with a pre-deletion database refuses a replacement first audit', async () => {
  const { assets, command } = await fixture(); await operations.prepare(command);
  time += 10; await operations.commit(command);
  const backup = await snapshot(); time += 10; await del(assets[0]);
  const originalLogs = [...logs], originalProofs = [...proofs];
  for (const model of models) {
    await model.collection.deleteMany({});
    if (backup[model.modelName].length) await model.collection.insertMany(backup[model.modelName]);
  }
  journal.persist.mockClear(); recoveryJournal.persist.mockClear();
  const before = await snapshot(); time += 10;
  await expect(del(assets[0], second)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect(await snapshot()).toEqual(before);
  expect(journal.persist).not.toHaveBeenCalled(); expect(recoveryJournal.persist).not.toHaveBeenCalled();
  expect([...logs]).toEqual(originalLogs); expect([...proofs]).toEqual(originalProofs);
});

test.each(['bound aborted', 'out of set', 'wrong release'])
('UDR-007 unchanged historical sibling %s rejects before sealing the evidence', async kind => {
  const { assets, command } = await fixture(); await operations.prepare(command);
  time += 10; await operations.abort(command);
  const next = { ...command, operationId: randomUUID(), references: [command.references[0]] };
  time += 10; await operations.prepare(next); time += 10; await operations.commit(next);
  const patch = kind === 'bound aborted' ? { state: 'bound', leaseExpiresAt: null, releasedAt: null, releaseOperationId: null }
    : kind === 'out of set' ? { mediaId: id() } : { releaseOperationId: randomUUID() };
  await Reference.collection.updateOne({ mediaId: assets[1]._id }, { $set: patch });
  const before = await snapshot(); time += 10;
  await expect(del(assets[0])).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect(await snapshot()).toEqual(before);
  expect(journal.persist).not.toHaveBeenCalled(); expect(recoveryJournal.persist).not.toHaveBeenCalled();
});

test.each(['authorized', 'unauthorized'])('UDR-009 external journal failure preserves %s priority and zero writes', async kind => {
  const { assets } = await fixture(1);
  if (kind === 'unauthorized') await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: second.id, memberParentIds: [second.id] } });
  recoveryJournal.read.mockRejectedValue(Error('synthetic reader failure'));
  const before = await snapshot();
  await expect(del(assets[0])).rejects.toMatchObject({ code: kind === 'authorized' ? 'MEDIA_REFERENCE_PENDING' : 'CHILD_ACCESS_DENIED' });
  expect(await snapshot()).toEqual(before);
  expect(journal.persist).not.toHaveBeenCalled(); expect(recoveryJournal.persist).not.toHaveBeenCalled();
});

test('UDR-009 external proof mismatch cannot repair a rolled-back guard or refresh an audit', async () => {
  const { assets } = await fixture(1); await del(assets[0]);
  await Guard.collection.updateOne({ mediaId: assets[0]._id }, { $set: { state: 'REGISTERED' } });
  const before = await snapshot(); journal.persist.mockClear(); recoveryJournal.persist.mockClear();
  await expect(del(assets[0], second)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect(await snapshot()).toEqual(before);
  expect(journal.persist).not.toHaveBeenCalled(); expect(recoveryJournal.persist).not.toHaveBeenCalled();
});

test.each(['family', 'child'])('UDR-007 denied foreign %s commands cannot poison or enter owner deletion history', async kind => {
  const { assets, command } = await fixture(1);
  const foreign = { ...command, operationId: randomUUID(), childId: String(id()),
    ...(kind === 'family' ? { familyId: String(id()) } : {}) };
  const denied = await operations.prepare(foreign);
  expect(denied.operation).toMatchObject({ state: 'ABORTED', failureCode: 'CHILD_ACCESS_DENIED' });
  const foreignBefore = await ledger(foreign);
  time += 10; await operations.prepare(command); time += 10; await del(assets[0]);
  const proof = await proofFor(assets[0]); expect(proof).toBeDefined();
  expect(proof.operations).toHaveLength(1); expect(proof.operations[0].after.operationId).toBe(command.operationId);
  expect(await ledger(foreign)).toEqual(foreignBefore);
  expect(serializeEvidence(proof)).not.toContain(foreign.operationId);
});

test('UDR-007 an actual cross-scope reference still blocks deletion with full rollback', async () => {
  const { assets, command } = await fixture(1);
  await Reference.create({ mediaId: assets[0]._id, familyId: id(), childId: id(), resourceId: command.resourceId,
    resourceType: 'growth_task', field: 'completionMediaIds', operationId: randomUUID(), state: 'released', releasedAt: new Date(time) });
  const before = await snapshot(); time += 10;
  await expect(del(assets[0])).rejects.toMatchObject({ code: 'MEDIA_OPERATION_INCONSISTENT' });
  expect(await snapshot()).toEqual(before); expect(recoveryJournal.persist).not.toHaveBeenCalled();
});

test.each(['PREPARED', 'COMMITTED', 'ABORTED'])('UDR-007 anomalous foreign %s history cannot be silently excluded', async state => {
  const { assets, command } = await fixture(1);
  const foreign = { ...command, familyId: String(id()), childId: String(id()), operationId: randomUUID() };
  await operations.prepare(foreign);
  await Operation.collection.updateOne({ operationId: foreign.operationId }, { $set: { state, version: 1 } });
  time += 10; const before = await snapshot();
  await expect(del(assets[0])).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect(await snapshot()).toEqual(before); expect(recoveryJournal.persist).not.toHaveBeenCalled();
});

test('UDR-007 unrelated denied attempts do not consume the owner history capacity', async () => {
  const { assets, command } = await fixture(1);
  const foreign = { ...command, familyId: String(id()), childId: String(id()), operationId: randomUUID() };
  await operations.prepare(foreign); const original = await ledger(foreign);
  await Operation.collection.insertMany(Array.from({ length: 101 }, () => ({ ...original, _id: id(), operationId: randomUUID() })));
  const rows = await Operation.collection.find({ familyId: original.familyId }).sort({ _id: 1 }).toArray();
  time += 10; await del(assets[0]); expect((await proofFor(assets[0])).operations).toEqual([]);
  expect(await Operation.collection.find({ familyId: original.familyId }).sort({ _id: 1 }).toArray()).toEqual(rows);
});

test.each(['commit', 'abort', 'other deletion'])('UDR-002 overlapping %s rebases the entire frozen snapshot after a real transaction conflict', async action => {
  const { assets, command } = await fixture(); await operations.prepare(command);
  if (action === 'other deletion') { time += 10; await operations.commit(command); }
  time += 10;
  let entered, release, blocked = false, attempts = 0;
  const reached = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const update = Asset.updateOne.bind(Asset);
  const spy = jest.spyOn(Asset, 'updateOne').mockImplementation(async (...args) => {
    if (String(args[0]._id) === String(assets[0]._id)) {
      attempts += 1;
      if (!blocked) { blocked = true; entered(); await gate; }
    }
    return update(...args);
  });
  const pending = del(assets[0]);
  try {
    await Promise.race([reached, pending.then(() => { throw Error('deletion escaped overlap barrier'); })]);
    if (action === 'other deletion') await del(assets[1], second);
    else await operations[action](command);
    release(); await pending;
  } finally { release(); await pending.catch(() => {}); spy.mockRestore(); }
  expect(attempts).toBeGreaterThanOrEqual(2);
  const proof = await proofFor(assets[0]); expect(validateEvidence(proof)).toEqual(proof);
  if (action === 'abort') {
    expect(proof.operations[0].before).toBeNull(); expect(proof.operations[0].after.state).toBe('ABORTED');
    expect(proof.referenceEffects).toEqual([]); expect(proof.receipts).toEqual([]);
  } else {
    expect(proof.operations[0].before).toMatchObject({ state: 'COMMITTED', version: action === 'commit' ? 1 : 2 });
    expect(proof.referenceEffects).toHaveLength(1); expect(proof.receipts).toHaveLength(1);
    if (action === 'other deletion') {
      const prior = await proofFor(assets[1]);
      expect(prior.operations[0].after.version).toBe(2);
      expect(proof.operations[0].after.version).toBe(3);
      expect(prior.tombstone.actorId).toBe(second.id); expect(proof.tombstone.actorId).toBe(parent.id);
    }
  }
});

test('UDR-001 deleting at the lease deadline freezes the expired terminal and every group effect', async () => {
  const { assets, command } = await fixture(); await operations.prepare(command);
  const before = await ledger(command); time = before.leaseExpiresAt.getTime();
  await del(assets[0]); const proof = await proofFor(assets[0]);
  expect(proof.operations[0].after).toMatchObject({ state: 'ABORTED', failureCode: 'MEDIA_OPERATION_EXPIRED',
    terminalAt: new Date(time).toISOString(), version: before.version + 1 });
  expect(proof.referenceEffects).toHaveLength(2); expect(proof.receipts).toEqual([]);
  expect(proof.referenceEffects.every(pair => pair.after.releasedAt === new Date(time).toISOString()
    && pair.after.releaseOperationId === command.operationId)).toBe(true);
});

test('UDR-002 overlapping parents deleting one media preserve the winning UUID and first audit', async () => {
  const { assets, command } = await fixture(1); await operations.prepare(command); time += 10; await operations.commit(command);
  time += 10;
  let reached, release, block = true;
  const entered = new Promise(resolve => { reached = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const capture = require('../services/userDeletionRecoveryCapture');
  const read = capture.readUserDeletionSnapshot;
  const spy = jest.spyOn(capture, 'readUserDeletionSnapshot').mockImplementation(async (...args) => {
    const snapshot = await read(...args);
    // Pause after the snapshot but before the first Guard write; otherwise the fixture
    // holds the very lock needed by the second transaction while waiting for it to finish.
    if (block) { block = false; reached(); await gate; }
    return snapshot;
  });
  const first = del(assets[0], parent);
  let winner;
  try {
    await Promise.race([entered, first.then(() => { throw Error('missed overlap'); })]);
    await del(assets[0], second); winner = await Recovery.findOne().lean();
    release(); await first;
  } finally { release(); await first.catch(() => {}); spy.mockRestore(); }
  expect(await Recovery.countDocuments()).toBe(1); expect(await Recovery.findOne().lean()).toEqual(winner);
  expect(winner.evidence.tombstone.actorId).toBe(second.id);
  expect(await Receipt.countDocuments()).toBe(1);
  expect(recoveryJournal.persist.mock.calls.map(([proof]) => proof.evidenceId)).toEqual([winner._id, winner._id]);
});

test('UDR-007 101 complete historical groups reject before any deletion or partial outbox', async () => {
  const { assets, command } = await fixture(1);
  const referenceSetHash = require('crypto').createHash('sha256').update(JSON.stringify(command.references)).digest('hex');
  await Operation.insertMany(Array.from({ length: 101 }, () => ({ ...command, resourceId: id(),
    field: 'completionMediaIds', operationId: randomUUID(), referenceSetHash, state: 'ABORTED', version: 0,
    terminalAt: new Date(time), leaseExpiresAt: null, failureCode: 'MEDIA_OPERATION_ABORTED' })));
  time += 10; const before = await snapshot();
  await expect(del(assets[0])).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect(await snapshot()).toEqual(before); expect(journal.persist).not.toHaveBeenCalled();
  expect(recoveryJournal.persist).not.toHaveBeenCalled();
});

test.each(['abort', 'prepare failure'])('UDR-001 preserves version-zero %s sampled before database creation', async action => {
  const { assets, command } = await fixture(1);
  jest.spyOn(mongoose, 'now').mockImplementation(() => new Date(time + 5));
  if (action === 'abort') await operations.abort(command);
  else await operations.prepare({ ...command, references: [...command.references,
    { mediaId: String(id()), field: 'completionMediaIds' }] });
  const before = await ledger(command); expect(before.terminalAt < before.createdAt).toBe(true);
  time += 100; await del(assets[0]);
  const proof = await proofFor(assets[0]); expect(proof).toBeDefined();
  expect(proof.operations[0]).toMatchObject({ before: null, after: { version: 0,
    terminalAt: before.terminalAt.toISOString(), createdAt: before.createdAt.toISOString() } });
});

test.each(['delete', 'cleanup'])('UDR-009 legacy %s cannot downgrade an existing v2 outbox', async action => {
  const { assets } = await fixture(1); time += 10; await del(assets[0]);
  const before = await snapshot(), remove = jest.fn(); time += 31 * DAY;
  if (action === 'delete') await expect(del(assets[0], second, makePrivacy({ recoveryJournal: undefined })))
    .rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  else await expect(createCompletionMediaCleanupService({ transactionRunner: runner, journal,
    mediaStore: { remove }, now: () => time }).cleanupDeletedMedia()).rejects.toThrow('recovery protocol');
  expect(remove).not.toHaveBeenCalled(); expect(await snapshot()).toEqual(before);
});

test.each(['guard', 'asset', 'tombstone', 'operation', 'receipt', 'reference', 'outbox'])
('UDR-002 failure after %s write rolls back every persisted fact and performs no journal IO', async stage => {
  const { assets, command } = await fixture(1); await operations.prepare(command); time += 10; await operations.commit(command);
  time += 10; const before = await snapshot();
  const target = { guard: [Guard, 'findOneAndUpdate'], asset: [Asset, 'updateOne'], tombstone: [Tombstone, 'create'],
    operation: [Operation, 'updateOne'], receipt: [Receipt, 'create'], reference: [Reference, 'updateOne'], outbox: [Recovery, 'create'] }[stage];
  const original = target[0][target[1]].bind(target[0]);
  const spy = jest.spyOn(target[0], target[1]).mockImplementation(async (...args) => {
    await original(...args); throw Error('Synthetic failed write acknowledgement');
  });
  try { await expect(del(assets[0])).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' }); }
  finally { spy.mockRestore(); }
  expect(await snapshot()).toEqual(before);
  expect(journal.persist).not.toHaveBeenCalled(); expect(recoveryJournal.persist).not.toHaveBeenCalled();
});

test('UDR-002 unknown commit and another actor retry reuse the original frozen UUID and first audit', async () => {
  const { assets, command } = await fixture(1); await operations.prepare(command); time += 10; await operations.commit(command);
  time += 10;
  const unknown = makePrivacy({ transactionRunner: async work => { await runner(work); throw Error('lost commit response'); } });
  await expect(del(assets[0], parent, unknown)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  const before = await Recovery.findOne().lean(); expect(before).not.toBeNull();
  expect(recoveryJournal.persist).not.toHaveBeenCalled(); time += 100;
  await del(assets[0], second);
  expect(await Recovery.findOne().lean()).toEqual(before);
  expect((await proofFor(assets[0])).tombstone.actorId).toBe(parent.id);
  expect(proofs.get(String(assets[0]._id))).toBe(serializeEvidence(before.evidence));
});

test.each(['v1', 'v2'])('UDR-003 %s journal failure rejects acknowledgement and retries the same proof', async phase => {
  const { assets } = await fixture(1);
  const bad = { persist: async () => { throw Error('journal not durable'); } };
  const broken = makePrivacy(phase === 'v1' ? { journal: bad } : { recoveryJournal: { ...recoveryJournal, ...bad } });
  await expect(del(assets[0], parent, broken)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  const before = await Recovery.findOne().lean(); expect(before).not.toBeNull();
  time += 10; await del(assets[0], second);
  expect(await Recovery.findOne().lean()).toEqual(before);
  expect(proofs.get(String(assets[0]._id))).toBe(serializeEvidence(before.evidence));
});

test('UDR-007 live authorization failure leaves outbox and all media facts unchanged', async () => {
  const { assets } = await fixture(1);
  await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: second.id } });
  const before = await snapshot();
  await expect(del(assets[0], second)).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED' });
  expect(await snapshot()).toEqual(before); expect(recoveryJournal.persist).not.toHaveBeenCalled();
});

test('UDR-009 old v1 deletion is not silently promoted to a fabricated v2 proof', async () => {
  const { assets } = await fixture(1);
  await del(assets[0], parent, makePrivacy({ recoveryJournal: undefined }));
  const before = await snapshot(); time += 10; await del(assets[0], second);
  expect(await snapshot()).toEqual(before); expect(await Recovery.countDocuments()).toBe(0);
  expect(recoveryJournal.persist).not.toHaveBeenCalled();
});

test('UDR-003 cleanup requires v2 acknowledgement before physical deletion and retains frozen proof', async () => {
  const { assets, command } = await fixture(1); await operations.prepare(command); time += 10; await operations.commit(command);
  time += 10; await del(assets[0]); const evidence = await proofFor(assets[0]);
  time += 31 * DAY; const before = await snapshot(); const remove = jest.fn(async () => {});
  const cleanup = createCompletionMediaCleanupService({ transactionRunner: runner, journal, now: () => time,
    mediaStore: mediaStoreFor(remove), recoveryJournal: { ...recoveryJournal, persist: async () => { throw Error('v2 fsync failed'); } } });
  await expect(cleanup.cleanupDeletedMedia()).rejects.toThrow('v2 fsync failed');
  expect(remove).not.toHaveBeenCalled(); expect(await snapshot()).toEqual(before);
  const good = createCompletionMediaCleanupService({ transactionRunner: runner, journal, recoveryJournal,
    mediaStore: mediaStoreFor(remove), now: () => time });
  expect(await good.cleanupDeletedMedia()).toEqual({ cleaned: 1, mediaIds: [String(assets[0]._id)] });
  expect(await proofFor(assets[0])).toEqual(evidence);
  expect(await Guard.countDocuments({ state: 'RETIRED' })).toBe(1);
  expect(await Operation.countDocuments()).toBe(1); expect(await Receipt.countDocuments()).toBe(1);
  await del(assets[0], second); expect(await proofFor(assets[0])).toEqual(evidence);
});

test.each(['delete', 'cleanup'])('UDR-009 %s cannot treat external v2 with a missing outbox as legacy', async action => {
  const { assets } = await fixture(1); time += 10; await del(assets[0]);
  await Recovery.collection.deleteMany({});
  const before = await snapshot(), remove = jest.fn(); time += 31 * DAY;
  journal.persist.mockClear(); recoveryJournal.persist.mockClear();
  if (action === 'delete') await expect(del(assets[0], second)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  else await expect(createCompletionMediaCleanupService({ transactionRunner: runner, journal, recoveryJournal,
    mediaStore: mediaStoreFor(remove), now: () => time }).cleanupDeletedMedia()).rejects.toThrow('recovery evidence');
  expect(remove).not.toHaveBeenCalled(); expect(await snapshot()).toEqual(before);
  expect(journal.persist).not.toHaveBeenCalled(); expect(recoveryJournal.persist).not.toHaveBeenCalled();
});

test.each(['delete', 'cleanup'])('UDR-003 %s waits for v2 durability before acknowledgement or removal', async action => {
  const { assets } = await fixture(1);
  if (action === 'cleanup') { time += 10; await del(assets[0]); time += 31 * DAY; }
  let reached, release, done = false, completed = false, journalWork;
  const entered = new Promise(resolve => { reached = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const early = [], remove = jest.fn(async () => { if (!done) early.push('remove'); });
  const delayed = { ...recoveryJournal, persist: evidence => {
    journalWork = (async () => { await recoveryJournal.persist(evidence); reached(); await gate; done = true; })();
    return journalWork;
  } };
  const work = action === 'delete' ? del(assets[0], parent, makePrivacy({ recoveryJournal: delayed }))
    : createCompletionMediaCleanupService({ transactionRunner: runner, journal, recoveryJournal: delayed,
      mediaStore: mediaStoreFor(remove), now: () => time }).cleanupDeletedMedia();
  const pending = work.then(() => { completed = true; if (!done) early.push('ack'); });
  try {
    await Promise.race([entered, pending]); await new Promise(resolve => setImmediate(resolve));
    expect(completed).toBe(false); expect(remove).not.toHaveBeenCalled();
    expect(await Asset.findById(assets[0]._id)).not.toBeNull();
  } finally { release(); await Promise.all([pending, journalWork]); }
  expect(early).toEqual([]); expect(done).toBe(true); expect(completed).toBe(true);
});

test.each([null, {}, { persist: () => {} }, { read: () => {} }])('UDR-010 incomplete explicitly supplied recovery dependency fails closed', supplied => {
  expect(() => makePrivacy({ recoveryJournal: supplied })).toThrow('Recovery journal');
  expect(() => createCompletionMediaCleanupService({ transactionRunner: runner, journal, recoveryJournal: supplied,
    mediaStore: { remove: async () => {} } })).toThrow('Recovery journal');
});

test('UDR-003 v2 cleanup requires a directory durability capability', () => {
  expect(() => createCompletionMediaCleanupService({ transactionRunner: runner, journal, recoveryJournal,
    mediaStore: { remove: async () => {} } })).toThrow('directory durability');
});

test.each(['failure', 'wait'])('UDR-003 media directory sync %s protects the metadata commit', async kind => {
  const { assets } = await fixture(1); time += 10; await del(assets[0]); time += 31 * DAY;
  const before = await snapshot(), remove = jest.fn(async () => false);
  let release, reached, done = false, calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { reached = resolve; });
  const syncDirectory = jest.fn(async () => {
    calls += 1; reached();
    if (kind === 'failure') throw Error('media directory sync failed');
    await gate; done = true;
  });
  const service = createCompletionMediaCleanupService({ transactionRunner: runner, journal, recoveryJournal,
    mediaStore: { remove, syncDirectory }, now: () => time });
  if (kind === 'failure') {
    await expect(service.cleanupDeletedMedia()).rejects.toThrow('media directory sync failed');
    expect(await snapshot()).toEqual(before); expect(calls).toBe(1);
  } else {
    let completed = false;
    const pending = service.cleanupDeletedMedia().then(() => { completed = true; expect(done).toBe(true); });
    try {
      await Promise.race([entered, pending]); await new Promise(resolve => setImmediate(resolve));
      expect(completed).toBe(false); expect(await snapshot()).toEqual(before);
    } finally { release(); await pending; }
    expect(calls).toBe(1);
  }
  expect(remove).toHaveBeenCalledTimes(1);
});

test.each(['none', 'call', 'await'])('UDR-003 isolated cleanup mutation %s demonstrates the directory durability guard', async mutation => {
  const file = require.resolve('../services/completionMediaCleanupService');
  let source = await fs.readFile(file, 'utf8');
  const target = 'if (recovery) await mediaStore.syncDirectory();';
  expect(source.split(target)).toHaveLength(2);
  if (mutation === 'call') source = source.replace(target, '');
  if (mutation === 'await') source = source.replace(target, 'if (recovery) mediaStore.syncDirectory();');
  const isolated = { exports: {} };
  require('vm').runInNewContext(source, { module: isolated, require: require('module').createRequire(file) }, { filename: file });
  const { assets } = await fixture(1); time += 10; await del(assets[0]); time += 31 * DAY;
  let release, reached, calls = 0, completed = false;
  const gate = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { reached = resolve; });
  const syncDirectory = async () => { calls += 1; reached(); await gate; };
  const pending = isolated.exports.createCompletionMediaCleanupService({ transactionRunner: runner, journal, recoveryJournal,
    mediaStore: { remove: async () => false, syncDirectory }, now: () => time }).cleanupDeletedMedia().then(() => { completed = true; });
  try {
    await Promise.race([entered, pending]);
    if (mutation === 'none') {
      await new Promise(resolve => setImmediate(resolve));
      expect(completed).toBe(false); expect(await Asset.findById(assets[0]._id)).not.toBeNull();
    } else {
      await pending; expect(completed).toBe(true); expect(await Asset.findById(assets[0]._id)).toBeNull();
    }
    expect(calls).toBe(mutation === 'call' ? 0 : 1);
  } finally { release(); await pending; }
});

test.each(['hash', 'first actor', 'guard'])('UDR-007 corrupted %s refuses retry without rewriting immutable facts or journals', async kind => {
  const { assets } = await fixture(1); time += 10; await del(assets[0]);
  const record = await Recovery.findOne().lean();
  if (kind === 'hash') await Recovery.collection.updateOne({ _id: record._id }, { $set: { evidenceHash: 'f'.repeat(64) } });
  if (kind === 'first actor') {
    const { evidenceHash: _hash, ...unsigned } = record.evidence; unsigned.tombstone.actorId = second.id;
    const evidence = require('../services/userDeletionRecoveryEvidence').sealEvidence(unsigned);
    await Recovery.collection.updateOne({ _id: record._id }, { $set: { evidence, evidenceHash: evidence.evidenceHash } });
  }
  if (kind === 'guard') await Guard.collection.updateOne({ mediaId: assets[0]._id }, { $set: { storageKey: randomUUID() } });
  const before = await snapshot(), bytes = proofs.get(String(assets[0]._id));
  journal.persist.mockClear(); recoveryJournal.persist.mockClear();
  await expect(del(assets[0], second)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect(await snapshot()).toEqual(before); expect(proofs.get(String(assets[0]._id))).toBe(bytes);
  expect(journal.persist).not.toHaveBeenCalled(); expect(recoveryJournal.persist).not.toHaveBeenCalled();
});

test.each(['rollback', 'unknown commit'])('UDR-008 real journals and body deletion survive cleanup metadata %s', async failure => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'udr-b-real-')));
  try {
    const { assets, command } = await fixture(1);
    const store = require('../services/privateMediaStore').createPrivateMediaStore({ root: path.join(root, 'media'),
      randomUUID: () => assets[0].storageKey });
    await store.writeCanonical(Buffer.from('synthetic-image'));
    const legacy = require('../services/mediaDeletionJournal').createMediaDeletionJournal({ root: path.join(root, 'v1') });
    const v2 = require('../services/userDeletionRecoveryJournal').createUserDeletionRecoveryJournal({ root: path.join(root, 'user-deletions-v2') });
    await operations.prepare(command); time += 10; await operations.commit(command); time += 10;
    await del(assets[0], parent, makePrivacy({ journal: legacy, recoveryJournal: v2 }));
    const frozen = await Recovery.findOne().lean(), original = await v2.read(String(assets[0]._id));
    expect(original).toEqual(frozen.evidence);
    const file1 = path.join(root, 'v1', `${assets[0]._id}.json`), file2 = path.join(root, 'user-deletions-v2', `${assets[0]._id}.json`);
    const bytes1 = await fs.readFile(file1), bytes2 = await fs.readFile(file2);
    time += 31 * DAY;
    const before = await snapshot(); let calls = 0;
    const uncertainRunner = async work => {
      const current = ++calls;
      const result = await runner(async session => {
        const value = await work(session);
        if (current === 2 && failure === 'rollback') throw Error('metadata rolled back');
        return value;
      });
      if (current === 2) throw Error('metadata acknowledgement lost');
      return result;
    };
    const cleanup = createCompletionMediaCleanupService({ transactionRunner: uncertainRunner, journal: legacy,
      recoveryJournal: v2, mediaStore: store, now: () => time });
    await expect(cleanup.cleanupDeletedMedia()).rejects.toThrow(failure === 'rollback' ? 'metadata rolled back' : 'metadata acknowledgement lost');
    await expect(store.read(assets[0].storageKey)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    if (failure === 'rollback') expect(await snapshot()).toEqual(before);
    else expect(await Asset.findById(assets[0]._id)).toBeNull();
    expect(await Recovery.findOne().lean()).toEqual(frozen);
    const retry = createCompletionMediaCleanupService({ transactionRunner: runner, journal: legacy, recoveryJournal: v2,
      mediaStore: store, now: () => time });
    expect((await retry.cleanupDeletedMedia()).cleaned).toBe(failure === 'rollback' ? 1 : 0);
    await del(assets[0], second, makePrivacy({ journal: legacy, recoveryJournal: v2 }));
    expect(await Recovery.findOne().lean()).toEqual(frozen);
    expect(await v2.read(String(assets[0]._id))).toEqual(original);
    expect(await fs.readFile(file1)).toEqual(bytes1); expect(await fs.readFile(file2)).toEqual(bytes2);
    expect(await Reference.countDocuments()).toBe(0);
    expect(await Operation.countDocuments()).toBe(1); expect(await Receipt.countDocuments()).toBe(1);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('UDR-010 legacy factories do not cold-load the v2 model or journal', () => {
  const privacyPath = require.resolve('../services/completionMediaPrivacyService');
  const cleanupPath = require.resolve('../services/completionMediaCleanupService');
  const script = `const assert=require('assert'); const p=require(${JSON.stringify(privacyPath)}),c=require(${JSON.stringify(cleanupPath)});
    const deps={transactionRunner:async()=>{},journal:{persist:async()=>{}},mediaStore:{remove:async()=>{}}};
    p.createCompletionMediaPrivacyService(deps);c.createCompletionMediaCleanupService(deps);
    assert(!Object.keys(require.cache).some(name=>/userDeletionRecoveryCapture|MediaUserDeletionRecovery|userDeletionRecoveryJournal/.test(name)));`;
  require('child_process').execFileSync(process.execPath, ['-e', script]);
});

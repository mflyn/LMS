const fs = require('fs/promises');
const path = require('path');
const os = require('os');
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
const Retirement = require('../models/MediaOrphanRetirement');
const Family = require('../../../common/models/Family');
const User = require('../models/FamilyUser');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const { createMediaReferenceOperationService } = require('../services/mediaReferenceOperationService');
const { createCompletionMediaPrivacyService } = require('../services/completionMediaPrivacyService');
const { createUserDeletionRecoveryJournal } = require('../services/userDeletionRecoveryJournal');
const { createMediaDeletionJournal } = require('../services/mediaDeletionJournal');
const { createPrivateMediaStore } = require('../services/privateMediaStore');
const { validateEvidence, sealEvidence, serializeEvidence } = require('../services/userDeletionRecoveryEvidence');

jest.setTimeout(30000);
const id = () => new mongoose.Types.ObjectId();
const models = [Asset, Reference, Operation, Tombstone, Receipt, Guard, Recovery, Retirement];
let mongo, runner, root, store, journal, legacy, now, parent, familyId, childId, operations, privacy;
const snapshot = () => Promise.all(models.map(model => model.collection.find({}).sort({ _id: 1 }).toArray()));
const rewind = async backup => {
  for (let i = 0; i < models.length; i += 1) {
    await models[i].collection.deleteMany({});
    if (backup[i].length) await models[i].collection.insertMany(backup[i]);
  }
};
const make = (options = {}) => require('../services/userDeletionRestore').createUserDeletionRestore({
  transactionRunner: runner, journal, mediaStore: store, now: () => now, ...options
});
const restore = (mediaId, helper = make(), options = {}) => helper.restore({
  mediaId: String(mediaId), execute: true, writesPaused: true, ...options
});
const fixture = async (kind = 'committed') => {
  const assets = [];
  for (let i = 0; i < 2; i += 1) {
    const { storageKey } = await store.writeCanonical(Buffer.from('synthetic-image'));
    assets.push(await Asset.create({ familyId, childId, uploadedBy: childId, purpose: 'task_completion',
      mimeType: 'image/jpeg', sizeBytes: 15, storageKey }));
  }
  const command = { familyId: String(familyId), childId: String(childId), resourceType: 'growth_task',
    resourceId: String(id()), operationId: randomUUID(), commandHash: 'a'.repeat(64),
    references: assets.map(asset => ({ mediaId: String(asset._id), field: 'completionMediaIds' })) };
  if (kind !== 'empty') await operations.prepare(command);
  if (kind === 'committed') { now += 10; await operations.commit(command); }
  const backup = await snapshot(); now += 10;
  await privacy.deleteMedia({ mediaId: String(assets[0]._id), identity: parent });
  const proof = await journal.read(String(assets[0]._id));
  const original = await snapshot(); await rewind(backup); now += 100;
  return { assets, command, backup, original, proof };
};

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri());
  for (const model of Object.values(mongoose.models)) await model.init();
  runner = createMongoTransactionRunner(mongoose.connection);
});
beforeEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  now = Date.parse('2026-10-23T01:00:00.000Z');
  jest.spyOn(mongoose, 'now').mockImplementation(() => new Date(now));
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'lms-t2-udr-c-')));
  store = createPrivateMediaStore({ root: path.join(root, 'media') });
  journal = createUserDeletionRecoveryJournal({ root: path.join(root, 'v2') });
  legacy = createMediaDeletionJournal({ root: path.join(root, 'v1') });
  parent = { id: String(id()), role: 'parent' }; familyId = id(); childId = id();
  await Family.create({ _id: familyId, familyName: 'Synthetic', ownerParentId: parent.id,
    memberParentIds: [parent.id], childIds: [childId] });
  await User.create([{ _id: parent.id, role: 'parent' }, { _id: childId, familyId, role: 'student' }]);
  operations = createMediaReferenceOperationService({ transactionRunner: runner, now: () => now });
  privacy = createCompletionMediaPrivacyService({ transactionRunner: runner, journal: legacy, recoveryJournal: journal, now: () => now });
});
afterEach(async () => { jest.restoreAllMocks(); if (root) await fs.rm(root, { recursive: true, force: true }); });
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test.each(['empty', 'prepared', 'committed'])('UDR-004 restores pre-deletion BSON %s with exact original audit and no file writes', async kind => {
  const f = await fixture(kind), mediaId = String(f.assets[0]._id);
  const bytes1 = await fs.readFile(path.join(root, 'v1', mediaId + '.json'));
  const bytes2 = await fs.readFile(path.join(root, 'v2', mediaId + '.json'));
  const remove = jest.spyOn(store, 'remove'), write = jest.spyOn(store, 'writeCanonical'), persist = jest.spyOn(journal, 'persist');
  expect(await restore(mediaId)).toEqual({ ready: false, state: 'USER_DELETION_RESTORED' });
  const row = await Recovery.findOne().lean();
  expect(row).toMatchObject({ _id: f.proof.evidenceId, evidenceHash: f.proof.evidenceHash,
    evidence: f.proof, createdAt: new Date(f.proof.evidenceCreatedAt), restoredAt: new Date(now) });
  expect(await Tombstone.findOne().lean()).toEqual(f.original[3][0]);
  expect(await Receipt.find().sort({ _id: 1 }).lean()).toEqual(f.original[4]);
  expect(await Operation.find().sort({ _id: 1 }).lean()).toEqual(f.original[2]);
  expect(await Reference.find().sort({ _id: 1 }).lean()).toEqual(f.original[1]);
  expect((await Guard.findOne().lean()).state).toBe('RETIRED');
  expect(await Asset.findById(f.assets[0]._id).lean()).toMatchObject({ status: 'deleted', privacyDeletionRecorded: true,
    deletedAt: new Date(f.proof.tombstone.deletedAt) });
  expect(await Asset.findById(f.assets[1]._id).lean()).toEqual(f.backup[0].find(a => String(a._id) === String(f.assets[1]._id)));
  const restored = await snapshot(); now += 100;
  expect(await restore(mediaId, make())).toEqual({ ready: false, state: 'USER_DELETION_RESTORED' });
  expect(await snapshot()).toEqual(restored);
  expect(await fs.readFile(path.join(root, 'v1', mediaId + '.json'))).toEqual(bytes1);
  expect(await fs.readFile(path.join(root, 'v2', mediaId + '.json'))).toEqual(bytes2);
  expect(remove).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled(); expect(persist).not.toHaveBeenCalled();
});

test.each(['execute', 'writesPaused'])('UDR-010 requires explicit %s before reading or writing', async key => {
  const read = jest.spyOn(journal, 'read'), before = await snapshot();
  await expect(restore(String(id()), make(), { [key]: false })).rejects.toMatchObject({ code: 'MEDIA_RESTORE_CONFIRMATION_REQUIRED' });
  expect(read).not.toHaveBeenCalled(); expect(await snapshot()).toEqual(before);
});

test('UDR-009 v1-only cannot be treated as a recovery proof', async () => {
  const f = await fixture('empty'); await fs.unlink(path.join(root, 'v2', f.assets[0]._id + '.json'));
  const before = await snapshot();
  await expect(restore(f.assets[0]._id)).rejects.toMatchObject({ code: 'USER_DELETION_DEPENDENCY_PENDING' });
  expect(await snapshot()).toEqual(before);
});

test('UDR-005 absent metadata restores evidence without recreating asset or target reference', async () => {
  const f = await fixture();
  await Asset.collection.deleteOne({ _id: f.assets[0]._id });
  await Reference.collection.deleteMany({ mediaId: f.assets[0]._id });
  expect(await restore(f.assets[0]._id)).toEqual({ ready: false, state: 'USER_DELETION_RESTORED' });
  expect(await Asset.findById(f.assets[0]._id)).toBeNull();
  expect(await Reference.countDocuments({ mediaId: f.assets[0]._id })).toBe(0);
  expect(await Receipt.find().lean()).toEqual(f.original[4]);
  expect((await Recovery.findOne().lean()).evidence).toEqual(f.proof);
});

test.each(['identity', 'first audit', 'reference set'])('UDR-007 conflicting %s rejects with the whole database unchanged', async kind => {
  const f = await fixture();
  if (kind === 'identity') await Asset.collection.updateOne({ _id: f.assets[0]._id }, { $set: { storageKey: randomUUID() } });
  if (kind === 'first audit') await Tombstone.collection.insertOne({ ...f.original[3][0], actorId: id() });
  if (kind === 'reference set') await Operation.collection.updateOne({ operationId: f.command.operationId }, { $set: { commandHash: 'b'.repeat(64) } });
  const before = await snapshot();
  await expect(restore(f.assets[0]._id)).rejects.toMatchObject({ code: 'USER_DELETION_EVIDENCE_INVALID' });
  expect(await snapshot()).toEqual(before);
});

test.each(['original', 'different', 'comparison removed'])('UDR-007 P3 valid external proof comparison: %s', async kind => {
  const f = await fixture(); await rewind(f.original);
  const { evidenceHash: _hash, ...unsigned } = structuredClone(f.proof);
  if (kind !== 'original') for (const pair of unsigned.operations) {
    pair.before.commandHash = 'b'.repeat(64); pair.after.commandHash = 'b'.repeat(64);
  }
  const external = sealEvidence(unsigned); expect(validateEvidence(external)).toEqual(external);
  expect(serializeEvidence(external) === serializeEvidence(f.proof)).toBe(kind === 'original');
  const other = createUserDeletionRecoveryJournal({ root: path.join(root, 'external') }); await other.persist(external);
  const before = await snapshot();
  const persist = jest.fn(), oldPersist = jest.fn();
  let factory = createCompletionMediaPrivacyService;
  if (kind === 'comparison removed') {
    const file = require.resolve('../services/completionMediaPrivacyService');
    const source = await fs.readFile(file, 'utf8'), needle = 'if (external) recovery.validateExternalUserDeletionRecovery(external, frozen);';
    expect(source.split(needle)).toHaveLength(2);
    const isolated = { exports: {} };
    require('vm').runInNewContext(source.replace(needle, ''), { module: isolated, require: require('module').createRequire(file) }, { filename: file });
    factory = isolated.exports.createCompletionMediaPrivacyService;
  }
  const service = factory({ transactionRunner: runner, journal: { persist: oldPersist },
    recoveryJournal: { read: other.read, persist }, now: () => now });
  const result = service.deleteMedia({ mediaId: String(f.assets[0]._id), identity: parent });
  if (kind === 'different') {
    await expect(result).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
    expect(persist).not.toHaveBeenCalled(); expect(oldPersist).not.toHaveBeenCalled();
  } else { await expect(result).resolves.toBeUndefined(); expect(persist).toHaveBeenCalledTimes(1); }
  expect(await snapshot()).toEqual(before);
  expect(await journal.read(String(f.assets[0]._id))).toEqual(f.proof);
});

test.each(['asset family', 'asset uploader', 'operation id', 'reference child'])
('UDR-007 raw BSON type corruption %s is not repaired by Mongoose casting', async kind => {
  const f = await fixture();
  if (kind === 'asset family' || kind === 'asset uploader') {
    const field = kind === 'asset family' ? 'familyId' : 'uploadedBy';
    await Asset.collection.updateOne({ _id: f.assets[0]._id }, { $set: { [field]: String(f.assets[0][field]) } });
  } else if (kind === 'operation id') {
    const row = await Operation.findOne().lean(); await Operation.collection.deleteMany({});
    await Operation.collection.insertOne({ ...row, _id: String(row._id) });
  } else await Reference.collection.updateOne({ mediaId: f.assets[0]._id }, { $set: { childId: String(childId) } });
  const before = await snapshot();
  await expect(restore(f.assets[0]._id)).rejects.toMatchObject({ code: 'USER_DELETION_EVIDENCE_INVALID' });
  expect(await snapshot()).toEqual(before);
});

test.each(['asset', 'guard', 'operation', 'reference', 'tombstone', 'receipt', 'outbox'])
('UDR-008 failure after %s write rolls back the entire recovery', async stage => {
  const f = await fixture(), before = await snapshot();
  const choices = { asset: [Asset, 'updateOne'], guard: [Guard.prototype, 'save'], operation: [Operation, 'updateOne'],
    reference: [Reference, 'updateOne'], tombstone: [Tombstone.prototype, 'save'],
    receipt: [Receipt.prototype, 'save'], outbox: [Recovery.prototype, 'save'] };
  const [object, method] = choices[stage], original = object[method];
  const spy = jest.spyOn(object, method).mockImplementation(async function (...args) {
    await original.apply(this, args); throw Error('synthetic post-write failure');
  });
  try { await expect(restore(f.assets[0]._id)).rejects.toMatchObject({ code: 'USER_DELETION_DEPENDENCY_PENDING' }); }
  finally { spy.mockRestore(); }
  expect(await snapshot()).toEqual(before);
  expect(await journal.read(String(f.assets[0]._id))).toEqual(f.proof);
});

test('UDR-008 final reference CAS miss rolls back preceding writes', async () => {
  const f = await fixture(), before = await snapshot();
  const spy = jest.spyOn(Reference, 'updateOne').mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });
  try { await expect(restore(f.assets[0]._id)).rejects.toMatchObject({ code: 'USER_DELETION_DEPENDENCY_PENDING' }); }
  finally { spy.mockRestore(); }
  expect(await snapshot()).toEqual(before);
});

test('UDR-008 committed transaction with lost acknowledgement is confirmed by a read-only retry', async () => {
  const f = await fixture(); let calls = 0;
  const uncertain = async work => {
    const result = await runner(work); calls += 1;
    if (calls === 1) throw Error('synthetic commit acknowledgement loss');
    return result;
  };
  expect(await restore(f.assets[0]._id, make({ transactionRunner: uncertain })))
    .toEqual({ ready: false, state: 'USER_DELETION_RESTORED' });
  expect(calls).toBe(2); const before = await snapshot(); now += 100;
  await restore(f.assets[0]._id, make()); expect(await snapshot()).toEqual(before);
  expect((await Recovery.findOne().lean())._id).toBe(f.proof.evidenceId);
});

test('UDR-004 an existing matching REGISTERED guard keeps its original timestamps', async () => {
  const f = await fixture('empty'), prior = { ...f.original[5][0], state: 'REGISTERED' };
  await Guard.collection.insertOne(prior); await restore(f.assets[0]._id);
  expect(await Guard.findOne().lean()).toEqual({ ...prior, state: 'RETIRED', revision: prior.revision + 1 });
});

test.each(['CANDIDATE', 'FENCED', 'SUPERSEDED', 'DELETED', 'PURGED'])
('UDR-009 system retirement %s is preserved or refused without manufacturing a system deletion', async state => {
  const f = await fixture('empty');
  await Retirement.create({ ...Object.fromEntries(['mediaId', 'familyId', 'childId', 'storageKey'].map(k => [k, f.proof.uploadIdentity[k]])),
    retirementId: randomUUID(), uploadMetadataHash: f.proof.uploadIdentity.metadataHash, retentionPolicyVersion: 1,
    orphanEligibleAt: new Date(now - 100), createdAt: new Date(now - 50), actorType: 'system', state, revision: 1,
    ...(['DELETED', 'PURGED'].includes(state) ? { evidence: { synthetic: true }, deletedAt: new Date(now - 20) } : {}),
    ...(state === 'PURGED' ? { purgedAt: new Date(now - 10) } : {}) });
  const before = await snapshot(), retirement = await Retirement.findOne().lean();
  if (['DELETED', 'PURGED'].includes(state)) {
    await expect(restore(f.assets[0]._id)).rejects.toMatchObject({ code: 'USER_DELETION_EVIDENCE_INVALID' });
    expect(await snapshot()).toEqual(before);
  } else { await restore(f.assets[0]._id); expect(await Retirement.findOne().lean()).toEqual(retirement); }
});

test.each(['CANDIDATE', 'FENCED', 'SUPERSEDED'])
('UDR-009 restored user deletion lets the original %s retirement converge without remote or file effects', async state => {
  const { storageKey } = await store.writeCanonical(Buffer.from('synthetic-image'));
  const asset = await Asset.create({ familyId, childId, uploadedBy: childId, purpose: 'task_completion',
    mimeType: 'image/jpeg', sizeBytes: 15, storageKey, retentionPolicyVersion: 1,
    orphanEligibleAt: new Date(now - 1000) });
  const { canonicalMetadata, hash } = require('../services/completionUploadRecord');
  const record = await Retirement.create({ mediaId: asset._id, familyId, childId, storageKey,
    retirementId: randomUUID(), uploadMetadataHash: hash(canonicalMetadata(asset.toObject())),
    retentionPolicyVersion: 1, orphanEligibleAt: asset.orphanEligibleAt,
    createdAt: new Date(now - 50), actorType: 'system', state, revision: 1 });
  const backup = await snapshot();
  await privacy.deleteMedia({ mediaId: String(asset._id), identity: parent });
  await rewind(backup);
  await restore(asset._id);
  const restored = await snapshot();
  const retirementClient = { retire: jest.fn() }, systemJournal = { persist: jest.fn() };
  const mediaStore = { remove: jest.fn(), syncDirectory: jest.fn() };
  const service = require('../services/orphanRetirementService').createOrphanRetirementService({
    transactionRunner: runner, retirementClient, journal: systemJournal, mediaStore, now: () => now
  });
  expect(await service.retire({ mediaId: String(asset._id) })).toEqual({ state: 'SUPERSEDED' });
  const converged = await snapshot();
  expect(converged.slice(0, 7)).toEqual(restored.slice(0, 7));
  expect(converged[7]).toEqual([{ ...restored[7][0], state: 'SUPERSEDED',
    revision: record.revision + (state === 'SUPERSEDED' ? 0 : 1) }]);
  expect(await service.retire({ mediaId: String(asset._id) })).toEqual({ state: 'SUPERSEDED' });
  expect(await snapshot()).toEqual(converged);
  expect(retirementClient.retire).not.toHaveBeenCalled();
  expect(systemJournal.persist).not.toHaveBeenCalled();
  expect(mediaStore.remove).not.toHaveBeenCalled();
  expect(mediaStore.syncDirectory).not.toHaveBeenCalled();
});

test('UDR-006 X then Y recovers exact versions; Y first is zero-write pending and replay X never downgrades', async () => {
  const f = await fixture(); await rewind(f.original); now += 10;
  await privacy.deleteMedia({ mediaId: String(f.assets[1]._id), identity: parent });
  const y = await journal.read(String(f.assets[1]._id));
  expect(y.operations[0].before.version).toBe(2); expect(y.operations[0].after.version).toBe(3);
  await rewind(f.backup); now += 100; const before = await snapshot();
  await expect(restore(f.assets[1]._id)).rejects.toMatchObject({ code: 'USER_DELETION_DEPENDENCY_PENDING' });
  expect(await snapshot()).toEqual(before);
  await restore(f.assets[0]._id); await restore(f.assets[1]._id);
  const after = await snapshot(); expect((await Operation.findOne().lean()).version).toBe(3);
  await restore(f.assets[0]._id, make()); expect(await snapshot()).toEqual(after);
  expect((await Recovery.findOne({ mediaId: f.assets[0]._id }).lean()).evidence).toEqual(f.proof);
  expect((await Recovery.findOne({ mediaId: f.assets[1]._id }).lean()).evidence).toEqual(y);
});

test('UDR-006 missing ledger cannot skip X but can be reconstructed for Y after X facts are restored', async () => {
  const f = await fixture(); await rewind(f.original); now += 10;
  await privacy.deleteMedia({ mediaId: String(f.assets[1]._id), identity: parent });
  await rewind(f.backup); now += 100;
  await Operation.collection.deleteMany({}); const before = await snapshot();
  await expect(restore(f.assets[1]._id)).rejects.toMatchObject({ code: 'USER_DELETION_DEPENDENCY_PENDING' });
  expect(await snapshot()).toEqual(before);
  await restore(f.assets[0]._id); await Operation.collection.deleteMany({});
  await restore(f.assets[1]._id); expect((await Operation.findOne().lean()).version).toBe(3);
});

test('UDR-007 a higher version with no complete deletion chain remains isolated', async () => {
  const f = await fixture(); await restore(f.assets[0]._id);
  await Operation.collection.updateOne({ operationId: f.command.operationId }, { $inc: { version: 1 } });
  const before = await snapshot();
  await expect(restore(f.assets[0]._id)).rejects.toMatchObject({ code: 'USER_DELETION_DEPENDENCY_PENDING' });
  expect(await snapshot()).toEqual(before);
});

test.each(['prepared', 'committed'])('UDR-006 historical A PREPARED backup with later B %s deletion', async phase => {
  const f = await fixture('prepared');
  now += 10; await operations.abort(f.command);
  const b = { ...f.command, operationId: randomUUID(), commandHash: 'b'.repeat(64) };
  now += 10; await operations.prepare(b);
  if (phase === 'committed') { now += 10; await operations.commit(b); }
  const historyJournal = createUserDeletionRecoveryJournal({ root: path.join(root, 'history-v2') });
  const historyLegacy = createMediaDeletionJournal({ root: path.join(root, 'history-v1') });
  const deleter = createCompletionMediaPrivacyService({ transactionRunner: runner, journal: historyLegacy,
    recoveryJournal: historyJournal, now: () => now });
  now += 10; await deleter.deleteMedia({ mediaId: String(f.assets[0]._id), identity: parent });
  const proof = await historyJournal.read(String(f.assets[0]._id));
  const original = await snapshot(); await rewind(f.backup);
  const before = await snapshot(), helper = make({ journal: historyJournal });
  if (phase === 'committed') {
    await expect(restore(f.assets[0]._id, helper)).rejects.toBeDefined();
    expect(await snapshot()).toEqual(before);
    return;
  }
  expect(await restore(f.assets[0]._id, helper)).toEqual({ ready: false, state: 'USER_DELETION_RESTORED' });
  const a = proof.operations.find(pair => pair.after.operationId === f.command.operationId);
  expect(a.before).toBeNull();
  expect(await Operation.find().sort({ _id: 1 }).lean()).toEqual(original[2]);
  for (const ref of await Reference.find().lean()) expect(ref).toMatchObject({ operationId: f.command.operationId,
    state: 'released', releaseOperationId: f.command.operationId, releasedAt: new Date(a.after.terminalAt), leaseExpiresAt: null });
  expect(await Receipt.countDocuments()).toBe(0);
  const restored = await snapshot();
  await restore(f.assets[0]._id, make({ journal: historyJournal }));
  expect(await snapshot()).toEqual(restored);
});

test.each(['valid', 'missing member', 'prepared'])('UDR-006 later C generation %s is preserved or refused', async phase => {
  const f = await fixture('prepared'); await rewind(f.original);
  const c = { ...f.command, operationId: randomUUID(), commandHash: 'c'.repeat(64), references: [f.command.references[1]] };
  now += 10; await operations.prepare(c);
  if (phase !== 'prepared') { now += 10; await operations.commit(c); }
  if (phase === 'missing member') await Asset.collection.deleteOne({ _id: f.assets[1]._id });
  const before = await snapshot();
  if (phase === 'valid') expect(await restore(f.assets[0]._id)).toEqual({ ready: false, state: 'USER_DELETION_RESTORED' });
  else await expect(restore(f.assets[0]._id)).rejects.toBeDefined();
  expect(await snapshot()).toEqual(before);
});

test.each(['valid', 'early terminal', 'wrong reason', 'owns a reference'])('UDR-007 late version-zero denial %s', async kind => {
  const f = await fixture(); await rewind(f.original);
  const late = { ...f.command, operationId: randomUUID(), commandHash: 'd'.repeat(64) };
  now += 20; await operations.abort(late);
  if (kind === 'early terminal') await Operation.collection.updateOne({ operationId: late.operationId },
    { $set: { terminalAt: new Date(new Date(f.proof.tombstone.deletedAt).getTime() - 1) } });
  if (kind === 'wrong reason') await Operation.collection.updateOne({ operationId: late.operationId }, { $set: { failureCode: 'MEDIA_OPERATION_EXPIRED' } });
  if (kind === 'owns a reference') await Reference.collection.updateOne({ mediaId: f.assets[1]._id }, { $set: { operationId: late.operationId } });
  const before = await snapshot();
  if (kind === 'valid') expect(await restore(f.assets[0]._id)).toEqual({ ready: false, state: 'USER_DELETION_RESTORED' });
  else await expect(restore(f.assets[0]._id)).rejects.toBeDefined();
  expect(await snapshot()).toEqual(before);
});

test('UDR-005 both deleted members can be physically cleaned before old X and Y proofs are replayed', async () => {
  const f = await fixture(); await rewind(f.original); now += 10;
  await privacy.deleteMedia({ mediaId: String(f.assets[1]._id), identity: parent });
  now += 31 * 86400000;
  const cleanup = require('../services/completionMediaCleanupService').createCompletionMediaCleanupService({
    transactionRunner: runner, journal: legacy, recoveryJournal: journal, mediaStore: store, now: () => now });
  expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(2);
  const before = await snapshot();
  await restore(f.assets[0]._id); await restore(f.assets[1]._id);
  expect(await snapshot()).toEqual(before);
  for (const asset of f.assets) await expect(fs.stat(store.resolveStoragePath(asset.storageKey))).rejects.toMatchObject({ code: 'ENOENT' });
});

test.each(['guard', 'receipt', 'external proof'])('UDR-007 later version dependency with missing or conflicting %s cannot justify X replay', async kind => {
  const f = await fixture(); await rewind(f.original); now += 10;
  await privacy.deleteMedia({ mediaId: String(f.assets[1]._id), identity: parent });
  if (kind === 'guard') await Guard.collection.deleteOne({ mediaId: f.assets[1]._id });
  if (kind === 'receipt') await Receipt.collection.deleteMany({ mediaId: f.assets[1]._id });
  let helper = make();
  if (kind === 'external proof') {
    const original = await journal.read(String(f.assets[1]._id));
    const { evidenceHash: _hash, ...changed } = structuredClone(original); changed.evidenceId = randomUUID();
    helper = make({ journal: { read: media => media === String(f.assets[1]._id) ? sealEvidence(changed) : journal.read(media) } });
  }
  const before = await snapshot(); await expect(restore(f.assets[0]._id, helper)).rejects.toBeDefined();
  expect(await snapshot()).toEqual(before);
});

test('UDR-009 dependency file reads occur outside retryable transaction callbacks', async () => {
  const f = await fixture(); await rewind(f.original); now += 10;
  await privacy.deleteMedia({ mediaId: String(f.assets[1]._id), identity: parent });
  let active = false;
  const read = jest.fn(async media => { expect(active).toBe(false); return journal.read(media); });
  const transactionRunner = work => runner(async session => {
    active = true; try { return await work(session); } finally { active = false; }
  });
  const before = await snapshot(); await restore(f.assets[0]._id, make({ journal: { read }, transactionRunner }));
  expect(read.mock.calls.map(call => call[0]).sort()).toEqual(f.assets.map(a => String(a._id)).sort());
  expect(await snapshot()).toEqual(before);
});

test.each(['exact before', 'pre-unbind backup', 'missing ledger'])('UDR-007 ordinary unbind %s is never guessed from releaseOperationId', async phase => {
  const f = await fixture(), unbindId = randomUUID();
  now += 10;
  await operations.unbind({ familyId: f.command.familyId, childId: f.command.childId,
    resourceType: f.command.resourceType, resourceId: f.command.resourceId, operationId: unbindId,
    references: [{ ...f.command.references[1], bindingOperationId: f.command.operationId }] });
  const backup = await snapshot();
  const nextJournal = createUserDeletionRecoveryJournal({ root: path.join(root, 'unbind-v2') });
  const nextLegacy = createMediaDeletionJournal({ root: path.join(root, 'unbind-v1') });
  const service = createCompletionMediaPrivacyService({ transactionRunner: runner, journal: nextLegacy,
    recoveryJournal: nextJournal, now: () => now });
  now += 10; await service.deleteMedia({ mediaId: String(f.assets[0]._id), identity: parent });
  await rewind(phase === 'pre-unbind backup' ? f.backup : backup);
  if (phase === 'missing ledger') await Operation.collection.deleteMany({});
  const before = await snapshot(), helper = make({ journal: nextJournal });
  if (phase === 'exact before') {
    await restore(f.assets[0]._id, helper);
    expect((await Reference.findOne({ mediaId: f.assets[1]._id }).lean()).releaseOperationId).toBe(unbindId);
    expect(await Receipt.countDocuments({ mediaId: f.assets[1]._id })).toBe(0);
  } else {
    await expect(restore(f.assets[0]._id, helper)).rejects.toMatchObject({ code: 'USER_DELETION_DEPENDENCY_PENDING' });
    expect(await snapshot()).toEqual(before);
  }
});

test.each(['denied', 'prepared', 'committed', 'positive-version aborted'])('UDR-007 foreign %s history is never restored into the owner family', async phase => {
  const f = await fixture();
  const foreign = { ...f.backup[2][0], _id: id(), familyId: id(), childId: id(), operationId: randomUUID() };
  if (phase === 'prepared') Object.assign(foreign, { state: 'PREPARED', leaseExpiresAt: new Date(now + 1000), terminalAt: null, failureCode: null, version: 0 });
  if (phase === 'denied' || phase === 'positive-version aborted') Object.assign(foreign,
    { state: 'ABORTED', version: phase === 'denied' ? 0 : 1, failureCode: 'RESOURCE_NOT_FOUND', terminalAt: new Date(now), leaseExpiresAt: null });
  await Operation.collection.insertOne(foreign); const before = await snapshot();
  if (phase === 'denied') {
    await restore(f.assets[0]._id); expect(await Operation.collection.findOne({ _id: foreign._id })).toEqual(foreign);
    expect((await Recovery.findOne().lean()).evidence.operations).toEqual(f.proof.operations);
  } else {
    await expect(restore(f.assets[0]._id)).rejects.toMatchObject({ code: 'USER_DELETION_EVIDENCE_INVALID' });
    expect(await snapshot()).toEqual(before);
  }
});

test.each(['revision', 'date'])('UDR-007 raw guard %s is not silently normalized', async kind => {
  const f = await fixture('empty');
  await Guard.collection.insertOne({ ...f.original[5][0], state: 'REGISTERED',
    ...(kind === 'revision' ? { revision: '1' } : { createdAt: f.original[5][0].createdAt.toISOString() }) });
  const before = await snapshot();
  await expect(restore(f.assets[0]._id)).rejects.toMatchObject({ code: 'USER_DELETION_EVIDENCE_INVALID' });
  expect(await snapshot()).toEqual(before);
});

test.each(['guard revision', 'asset version'])('UDR-007 exhausted %s cannot overflow during recovery', async kind => {
  const f = await fixture('empty');
  if (kind === 'guard revision') await Guard.collection.insertOne({ ...f.original[5][0], state: 'REGISTERED', revision: Number.MAX_SAFE_INTEGER });
  else await Asset.collection.updateOne({ _id: f.assets[0]._id }, { $set: { __v: Number.MAX_SAFE_INTEGER } });
  const before = await snapshot();
  await expect(restore(f.assets[0]._id)).rejects.toMatchObject({ code: 'USER_DELETION_EVIDENCE_INVALID' });
  expect(await snapshot()).toEqual(before);
});

const mutant = async (needle, replacement = '', options = {}) => {
  const file = require.resolve('../services/userDeletionRestore'), source = await fs.readFile(file, 'utf8');
  expect(source.split(needle)).toHaveLength(2);
  const isolated = { exports: {} };
  const localRequire = request => require(request.startsWith('.') ? path.resolve(path.dirname(file), request) : request);
  require('vm').runInNewContext(source.replace(needle, replacement), { module: isolated, require: localRequire, Date }, { filename: file });
  return isolated.exports.createUserDeletionRestore({ transactionRunner: runner, journal, mediaStore: store, now: () => now, ...options });
};

test('UDR-008 CAS oracle rejects production and detects removal of the final matched-count check', async () => {
  const f = await fixture(), before = await snapshot();
  const removed = await mutant('if (result.matchedCount !== 1) throw pending();');
  const spy = jest.spyOn(Reference, 'updateOne').mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });
  try {
    await expect(restore(f.assets[0]._id)).rejects.toMatchObject({ code: 'USER_DELETION_DEPENDENCY_PENDING' });
    expect(await snapshot()).toEqual(before);
    await expect(restore(f.assets[0]._id, removed)).resolves.toMatchObject({ state: 'USER_DELETION_RESTORED' });
    expect((await Reference.findOne({ mediaId: f.assets[0]._id }).lean()).state).toBe('bound');
    expect((await Asset.findById(f.assets[0]._id).lean()).status).toBe('deleted');
  } finally { spy.mockRestore(); }
});

test('UDR-007 dependency oracle detects removal of applied deletion fact verification', async () => {
  const f = await fixture(); await rewind(f.original); now += 10;
  await privacy.deleteMedia({ mediaId: String(f.assets[1]._id), identity: parent });
  await Guard.collection.deleteOne({ mediaId: f.assets[1]._id });
  const before = await snapshot();
  await expect(restore(f.assets[0]._id)).rejects.toMatchObject({ code: 'USER_DELETION_DEPENDENCY_PENDING' });
  expect(await snapshot()).toEqual(before);
  const removed = await mutant('const assertApplied = async (dependency, proofs) => {',
    'const assertApplied = async (dependency, proofs) => { return;');
  await expect(restore(f.assets[0]._id, removed)).resolves.toMatchObject({ state: 'USER_DELETION_RESTORED' });
  expect(await snapshot()).toEqual(before);
});

const qa23Files = async () => {
  const files = [];
  const walk = async directory => {
    for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else files.push({ path: path.relative(root, file), bytes: await fs.readFile(file) });
    }
  };
  await walk(root); return files;
};
const qa23MissingTarget = async f => {
  expect((await Asset.findById(f.assets[0]._id).lean()).status).toBe('active');
  expect((await Reference.findOne({ mediaId: f.assets[0]._id }).lean()).state).toBe('prepared');
  for (const Model of [Guard, Tombstone, Receipt, Recovery]) {
    expect(await Model.countDocuments({ mediaId: f.assets[0]._id })).toBe(0);
  }
};
const qa23Audit = async (f, proof) => {
  expect(await Tombstone.findOne({ mediaId: f.assets[0]._id }).lean()).toEqual(f.original[3][0]);
  expect(await Receipt.find().sort({ _id: 1 }).lean()).toEqual(f.original[4]);
  expect(await Recovery.findOne({ mediaId: f.assets[0]._id }).lean()).toMatchObject({
    _id: proof.evidenceId, mediaId: f.assets[0]._id, familyId, childId, version: 2,
    evidence: proof, evidenceHash: proof.evidenceHash, createdAt: new Date(proof.evidenceCreatedAt), restoredAt: new Date(now)
  });
  expect(await Guard.findOne({ mediaId: f.assets[0]._id }).lean()).toMatchObject({
    mediaId: f.assets[0]._id, familyId, childId, storageKey: proof.uploadIdentity.storageKey,
    metadataHash: proof.uploadIdentity.metadataHash, state: 'RETIRED', revision: 1,
    createdAt: new Date(now), updatedAt: new Date(now)
  });
  expect(await Asset.findById(f.assets[0]._id).lean()).toMatchObject({
    status: 'deleted', privacyDeletionRecorded: true, deletedAt: new Date(proof.tombstone.deletedAt)
  });
};

const qa02History = async offset => {
  const f = await fixture('prepared'), prior = f.backup[2][0];
  now = prior.leaseExpiresAt.getTime() + offset;
  await operations.abort(f.command);
  const terminal = await Operation.findOne({ operationId: f.command.operationId }).lean();
  expect(terminal).toMatchObject({ state: 'ABORTED', version: prior.version + 1,
    terminalAt: new Date(now), leaseExpiresAt: null,
    failureCode: offset < 0 ? 'MEDIA_OPERATION_ABORTED' : 'MEDIA_OPERATION_EXPIRED' });
  const b = { ...f.command, operationId: randomUUID(), commandHash: 'b'.repeat(64) };
  now += 10; await operations.prepare(b);
  const historyJournal = createUserDeletionRecoveryJournal({ root: path.join(root, 'qa02-v2') });
  const historyLegacy = createMediaDeletionJournal({ root: path.join(root, 'qa02-v1') });
  const deleter = createCompletionMediaPrivacyService({ transactionRunner: runner, journal: historyLegacy,
    recoveryJournal: historyJournal, now: () => now });
  now += 10; await deleter.deleteMedia({ mediaId: String(f.assets[0]._id), identity: parent });
  const proof = await historyJournal.read(String(f.assets[0]._id));
  const historical = proof.operations.find(pair => pair.after.operationId === f.command.operationId);
  expect(historical.before).toBeNull();
  expect(proof.referenceEffects.filter(pair => pair.after.operationId === f.command.operationId)).toEqual([]);
  expect(proof.operations).toHaveLength(2); expect(proof.receipts).toEqual([]);
  const original = await snapshot(); await rewind(f.backup); now += 100;
  await qa23MissingTarget(f);
  expect(await Reference.countDocuments()).toBe(2);
  return { ...f, original, proof, terminal, prior, historyJournal };
};

test.each([[-1, 'ordinary abort before lease'], [0, 'expired exactly at lease'], [1, 'expired after lease']])
('C-QA-02 historical A boundary %i: %s restores complete reference rows and first audits', async offset => {
  const f = await qa02History(offset), files = await qa23Files();
  const expectedRefs = f.backup[1].map(ref => ({ ...ref, state: 'released', leaseExpiresAt: null,
    releasedAt: f.terminal.terminalAt, releaseOperationId: f.command.operationId, updatedAt: f.terminal.terminalAt }));
  expect(expectedRefs).toHaveLength(2);
  expect(await restore(f.assets[0]._id, make({ journal: f.historyJournal })))
    .toEqual({ ready: false, state: 'USER_DELETION_RESTORED' });
  const references = await Reference.find().sort({ _id: 1 }).lean();
  expect(references).toHaveLength(2); expect(references).toEqual(expectedRefs);
  expect(await Operation.find().sort({ _id: 1 }).lean()).toEqual(f.original[2]);
  expect(await Asset.findById(f.assets[1]._id).lean()).toEqual(f.backup[0][1]);
  await qa23Audit(f, f.proof); expect(await qa23Files()).toEqual(files);
  const settled = await snapshot(); now += 100;
  await restore(f.assets[0]._id, make({ journal: f.historyJournal }));
  expect(await snapshot()).toEqual(settled); expect(await qa23Files()).toEqual(files);
});

test.each([
  ['wrong reference lease', -1, 'USER_DELETION_EVIDENCE_INVALID'],
  ['wrong prior version', -1, 'USER_DELETION_EVIDENCE_INVALID'],
  ['ordinary abort at lease', -1, 'USER_DELETION_EVIDENCE_INVALID'],
  ['expired before lease', 0, 'USER_DELETION_EVIDENCE_INVALID'],
  ['missing member asset', -1, 'USER_DELETION_DEPENDENCY_PENDING'],
  ['missing member slot', -1, 'USER_DELETION_DEPENDENCY_PENDING'],
  ['foreign member child', -1, 'USER_DELETION_EVIDENCE_INVALID']
])('C-QA-02 historical A rejects %s without writing inferred history', async (kind, offset, code) => {
  const f = await qa02History(offset);
  if (kind === 'wrong reference lease') await Reference.collection.updateOne({ mediaId: f.assets[1]._id },
    { $set: { leaseExpiresAt: new Date(f.prior.leaseExpiresAt.getTime() + 1) } });
  if (kind === 'wrong prior version') await Operation.collection.updateOne({ _id: f.prior._id }, { $inc: { version: 1 } });
  if (kind === 'ordinary abort at lease' || kind === 'expired before lease') {
    const lease = new Date(f.terminal.terminalAt.getTime() + (kind === 'expired before lease' ? 1 : 0));
    await Operation.collection.updateOne({ _id: f.prior._id }, { $set: { leaseExpiresAt: lease } });
    await Reference.collection.updateMany({ operationId: f.command.operationId }, { $set: { leaseExpiresAt: lease } });
  }
  if (kind === 'missing member asset') await Asset.collection.deleteOne({ _id: f.assets[1]._id });
  if (kind === 'missing member slot') await Reference.collection.deleteOne({ mediaId: f.assets[1]._id });
  if (kind === 'foreign member child') await Asset.collection.updateOne({ _id: f.assets[1]._id }, { $set: { childId: id() } });
  const before = await snapshot(), files = await qa23Files();
  await expect(restore(f.assets[0]._id, make({ journal: f.historyJournal }))).rejects.toMatchObject({ code });
  expect(await snapshot()).toEqual(before); expect(await qa23Files()).toEqual(files);
});

const qa03LaterGroup = async (phase = 'committed') => {
  const f = await fixture('prepared'); await rewind(f.original);
  const { storageKey } = await store.writeCanonical(Buffer.from('synthetic-later-z'));
  const z = await Asset.create({ familyId, childId, uploadedBy: childId, purpose: 'task_completion',
    mimeType: 'image/jpeg', sizeBytes: 17, storageKey });
  const c = { ...f.command, operationId: randomUUID(), commandHash: 'c'.repeat(64),
    references: [f.command.references[1], { mediaId: String(z._id), field: 'completionMediaIds' }] };
  now += 10; await operations.prepare(c); now += 10;
  if (phase === 'committed') await operations.commit(c); else await operations.abort(c);
  const expected = await snapshot();
  expect(expected[1]).toHaveLength(3);
  expect(expected[1].filter(ref => ref.operationId === c.operationId)).toHaveLength(2);
  // A partial backup retains independently proven C, but loses X's deletion and A's terminal state.
  await Asset.collection.replaceOne({ _id: f.assets[0]._id }, f.backup[0][0]);
  await Reference.collection.replaceOne({ mediaId: f.assets[0]._id }, f.backup[1][0]);
  await Operation.collection.replaceOne({ operationId: f.command.operationId }, f.backup[2][0]);
  for (const Model of [Guard, Tombstone, Receipt, Recovery]) await Model.collection.deleteMany({ mediaId: f.assets[0]._id });
  await qa23MissingTarget(f); now += 100;
  return { ...f, c, z, expected };
};

test('C-QA-03 restores missing X facts while preserving complete later C over Y and independent Z', async () => {
  const f = await qa03LaterGroup(), files = await qa23Files();
  expect(await restore(f.assets[0]._id)).toEqual({ ready: false, state: 'USER_DELETION_RESTORED' });
  const references = await Reference.find().sort({ _id: 1 }).lean();
  expect(references).toHaveLength(3); expect(references).toEqual(f.expected[1]);
  expect(references.filter(ref => ref.operationId === f.c.operationId)).toHaveLength(2);
  expect(await Operation.find().sort({ _id: 1 }).lean()).toEqual(f.expected[2]);
  for (const mediaId of [f.assets[1]._id, f.z._id]) {
    expect(await Asset.findById(mediaId).lean()).toEqual(f.expected[0].find(row => String(row._id) === String(mediaId)));
  }
  await qa23Audit(f, f.proof); expect(await qa23Files()).toEqual(files);
  const settled = await snapshot(); now += 100;
  await restore(f.assets[0]._id, make());
  expect(await snapshot()).toEqual(settled); expect(await qa23Files()).toEqual(files);
});

test.each([
  ['foreign Z asset', 'USER_DELETION_EVIDENCE_INVALID'],
  ['foreign Z reference', 'USER_DELETION_EVIDENCE_INVALID'],
  ['missing Z asset', 'USER_DELETION_DEPENDENCY_PENDING'],
  ['missing Z reference', 'USER_DELETION_EVIDENCE_INVALID'],
  ['unknown Z generation', 'USER_DELETION_EVIDENCE_INVALID'],
  ['early Z update', 'USER_DELETION_EVIDENCE_INVALID'],
  ['late Z creation', 'USER_DELETION_EVIDENCE_INVALID'],
  ['out-of-order C', 'USER_DELETION_EVIDENCE_INVALID']
])('C-QA-03 rejects %s outside the old group without partially restoring X', async (kind, code) => {
  const f = await qa03LaterGroup();
  if (kind === 'foreign Z asset') await Asset.collection.updateOne({ _id: f.z._id }, { $set: { familyId: id() } });
  if (kind === 'foreign Z reference') await Reference.collection.updateOne({ mediaId: f.z._id }, { $set: { childId: id() } });
  if (kind === 'missing Z asset') await Asset.collection.deleteOne({ _id: f.z._id });
  if (kind === 'missing Z reference') await Reference.collection.deleteOne({ mediaId: f.z._id });
  if (kind === 'unknown Z generation') await Reference.collection.updateOne({ mediaId: f.z._id }, { $set: { operationId: randomUUID() } });
  if (kind === 'early Z update' || kind === 'late Z creation') {
    const c = await Operation.findOne({ operationId: f.c.operationId }).lean();
    await Reference.collection.updateOne({ mediaId: f.z._id }, { $set: kind === 'early Z update'
      ? { updatedAt: new Date(c.terminalAt.getTime() - 1) } : { createdAt: new Date(c.terminalAt.getTime() + 1) } });
  }
  if (kind === 'out-of-order C') await Operation.collection.updateOne({ operationId: f.c.operationId },
    { $set: { createdAt: new Date(new Date(f.proof.operations[0].after.terminalAt).getTime() - 1) } });
  const before = await snapshot(), files = await qa23Files();
  await expect(restore(f.assets[0]._id)).rejects.toMatchObject({ code });
  expect(await snapshot()).toEqual(before); await qa23MissingTarget(f);
  expect(await qa23Files()).toEqual(files);
});

test.each(['guard', 'receipt', 'asset', 'reference'])('C-QA-01 missing ledger refuses unapplied predecessor %s', async kind => {
  const f = await fixture(); await rewind(f.original); now += 10;
  await privacy.deleteMedia({ mediaId: String(f.assets[1]._id), identity: parent });
  const expectedY = await journal.read(String(f.assets[1]._id));
  await rewind(f.backup); await restore(f.assets[0]._id);
  await Operation.collection.deleteMany({});
  if (kind === 'guard') await Guard.collection.deleteOne({ mediaId: f.assets[0]._id });
  if (kind === 'receipt') await Receipt.collection.deleteMany({ mediaId: f.assets[0]._id });
  if (kind === 'asset') await Asset.collection.replaceOne({ _id: f.assets[0]._id }, f.backup[0].find(row => String(row._id) === String(f.assets[0]._id)));
  if (kind === 'reference') await Reference.collection.replaceOne({ mediaId: f.assets[0]._id }, f.backup[1].find(row => String(row.mediaId) === String(f.assets[0]._id)));
  const before = await snapshot(), bytes = await fs.readFile(path.join(root, 'v2', f.assets[0]._id + '.json'));
  const persist = jest.spyOn(journal, 'persist'), remove = jest.spyOn(store, 'remove');
  await expect(restore(f.assets[1]._id)).rejects.toMatchObject({ code: expect.stringMatching(/^USER_DELETION_(DEPENDENCY_PENDING|EVIDENCE_INVALID)$/) });
  expect(await snapshot()).toEqual(before);
  expect(await fs.readFile(path.join(root, 'v2', f.assets[0]._id + '.json'))).toEqual(bytes);
  expect(persist).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
  await rewind(f.backup); await restore(f.assets[0]._id); await Operation.collection.deleteMany({});
  await restore(f.assets[1]._id);
  expect((await Recovery.findOne({ mediaId: f.assets[1]._id }).lean()).evidence).toEqual(expectedY);
  const ledger = await Operation.findOne().lean();
  expect(JSON.parse(JSON.stringify(ledger))).toMatchObject(expectedY.operations[0].after);
});

test('C-QA-04 all real update predicates retain exact original BSON identity state version and audit', async () => {
  const f = await fixture();
  await Guard.collection.insertOne({ ...f.original[5][0], state: 'REGISTERED' });
  const before = await snapshot(), captures = [];
  const spies = [Asset, Guard, Operation, Reference].map(Model => {
    const original = Model.updateOne;
    return jest.spyOn(Model, 'updateOne').mockImplementation(function (filter, change, options) {
      const expected = before[models.indexOf(Model)].find(row => String(row._id) === String(filter._id));
      expect(filter).toEqual(expected); expect(options.session.inTransaction()).toBe(true);
      captures.push(Model.modelName); return original.call(this, filter, change, options);
    });
  });
  try { await restore(f.assets[0]._id); } finally { spies.forEach(spy => spy.mockRestore()); }
  expect(captures.sort()).toEqual([Asset, Guard, Operation, Reference].map(Model => Model.modelName).sort());
});

test.each(['asset', 'guard', 'operation', 'reference'])('C-QA-04 real stale %s CAS rolls back every prior write', async kind => {
  const f = await fixture(); await Guard.collection.insertOne({ ...f.original[5][0], state: 'REGISTERED' });
  const before = await snapshot(), Model = { asset: Asset, guard: Guard, operation: Operation, reference: Reference }[kind];
  const original = Model.updateOne; let reached = 0;
  const spy = jest.spyOn(Model, 'updateOne').mockImplementation(async function (filter, change, options) {
    expect(options.session.inTransaction()).toBe(true); reached += 1;
    expect(filter).toEqual(before[models.indexOf(Model)].find(row => String(row._id) === String(filter._id)));
    const result = await original.call(this, { ...filter, updatedAt: new Date(0) }, change, options);
    expect(result.matchedCount).toBe(0); return result;
  });
  try { await expect(restore(f.assets[0]._id)).rejects.toMatchObject({ code: 'USER_DELETION_DEPENDENCY_PENDING' }); }
  finally { spy.mockRestore(); }
  expect(reached).toBe(1); expect(await snapshot()).toEqual(before);
});

test.each(['operation insert', 'registered guard update', 'second prepared reference'])('C-QA-04 post-write failure in %s is atomic', async kind => {
  const f = await fixture(kind === 'second prepared reference' ? 'prepared' : 'committed');
  if (kind === 'operation insert') await Operation.collection.deleteMany({});
  if (kind === 'registered guard update') await Guard.collection.insertOne({ ...f.original[5][0], state: 'REGISTERED' });
  const before = await snapshot();
  const [object, method] = kind === 'operation insert' ? [Operation.prototype, 'save']
    : kind === 'registered guard update' ? [Guard, 'updateOne'] : [Reference, 'updateOne'];
  const original = object[method]; let reached = 0;
  const spy = jest.spyOn(object, method).mockImplementation(async function (...args) {
    const options = args[method === 'save' ? 0 : 2]; expect(options.session.inTransaction()).toBe(true);
    const value = await original.apply(this, args); reached += 1;
    if (kind !== 'second prepared reference' || reached === 2) throw Error('Synthetic variant post-write failure');
    return value;
  });
  try { await expect(restore(f.assets[0]._id)).rejects.toMatchObject({ code: 'USER_DELETION_DEPENDENCY_PENDING' }); }
  finally { spy.mockRestore(); }
  expect(reached).toBe(kind === 'second prepared reference' ? 2 : 1);
  expect(await snapshot()).toEqual(before);
});

test.each(['guard', 'reference', 'operation', 'terminal conflict', 'unreadable'])('C-QA-05 unknown commit with %s confirmation stays pending and read-only', async kind => {
  const f = await fixture(); let calls = 0, damaged, committed, writeCounts;
  const spies = models.flatMap(Model => [jest.spyOn(Model, 'updateOne'), jest.spyOn(Model.prototype, 'save'),
    jest.spyOn(Model, 'deleteOne'), jest.spyOn(Model, 'deleteMany')]);
  const persist = jest.spyOn(journal, 'persist'), remove = jest.spyOn(store, 'remove');
  const bytes = await fs.readFile(path.join(root, 'v2', f.assets[0]._id + '.json'));
  const uncertain = async work => {
    calls += 1;
    if (calls === 2 && kind === 'unreadable') throw Error('Synthetic unavailable confirmation');
    const result = await runner(work);
    if (calls === 1) {
      committed = await snapshot();
      if (kind === 'guard') await Guard.collection.deleteOne({ mediaId: f.assets[0]._id });
      if (kind === 'reference') await Reference.collection.deleteOne({ mediaId: f.assets[0]._id });
      if (kind === 'operation') await Operation.collection.deleteMany({});
      if (kind === 'terminal conflict') await Operation.collection.updateOne({ operationId: f.command.operationId }, { $set: { terminalAt: new Date(now + 1) } });
      damaged = await snapshot(); writeCounts = spies.map(spy => spy.mock.calls.length);
      throw Error('Synthetic acknowledgement lost');
    }
    return result;
  };
  await expect(restore(f.assets[0]._id, make({ transactionRunner: uncertain }))).rejects.toMatchObject({ code: 'USER_DELETION_DEPENDENCY_PENDING' });
  expect(calls).toBe(2); expect(await snapshot()).toEqual(damaged);
  expect(spies.map(spy => spy.mock.calls.length)).toEqual(writeCounts);
  expect(persist).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
  expect(await fs.readFile(path.join(root, 'v2', f.assets[0]._id + '.json'))).toEqual(bytes);
  spies.forEach(spy => spy.mockRestore());
  await rewind(committed); await restore(f.assets[0]._id, make());
  expect(await snapshot()).toEqual(committed);
});


test.each(['early release', 'early bound update'])('C-P2-1 unchanged committed sibling %s rejects before any restore write', async kind => {
  const f = await fixture(), ledger = f.backup[2][0];
  const original = f.backup[1].find(ref => String(ref.mediaId) === String(f.assets[1]._id));
  const beforeCommit = new Date(ledger.terminalAt.getTime() - 1);
  if (kind === 'early release') await Reference.collection.updateOne({ _id: original._id }, { $set: {
    state: 'released', releaseOperationId: randomUUID(), releasedAt: beforeCommit, updatedAt: ledger.terminalAt } });
  else await Reference.collection.updateOne({ _id: original._id }, { $set: { updatedAt: beforeCommit } });
  const before = await snapshot(), persist = jest.spyOn(journal, 'persist');
  await expect(restore(f.assets[0]._id)).rejects.toMatchObject({ code: 'USER_DELETION_EVIDENCE_INVALID' });
  expect(await snapshot()).toEqual(before); expect(persist).not.toHaveBeenCalled();
});

test.each(['X cleaned Y before', 'both cleaned restore X', 'both cleaned restore Y'])('C-P2-2 missing ledger and %s converge at the fully proved version', async phase => {
  const f = await fixture(); await rewind(f.original);
  now += 31 * 86400000;
  const cleanup = require('../services/completionMediaCleanupService').createCompletionMediaCleanupService({
    transactionRunner: runner, journal: legacy, recoveryJournal: journal, mediaStore: store, now: () => now });
  expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(1);
  const onlyX = await snapshot(); now += 10;
  await privacy.deleteMedia({ mediaId: String(f.assets[1]._id), identity: parent });
  const y = await journal.read(String(f.assets[1]._id));
  const expectedLedger = await Operation.findOne().lean();
  if (phase === 'X cleaned Y before') await rewind(onlyX);
  else {
    now += 31 * 86400000; expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(1);
  }
  await Operation.collection.deleteMany({});
  const before = await snapshot();
  const target = phase === 'both cleaned restore X' ? f.assets[0] : f.assets[1];
  await restore(target._id);
  expect(await Operation.findOne().lean()).toEqual(expectedLedger);
  expect(await Asset.findById(f.assets[0]._id)).toBeNull();
  expect(await Reference.countDocuments({ mediaId: f.assets[0]._id })).toBe(0);
  const after = await snapshot(); await restore(target._id, make()); expect(await snapshot()).toEqual(after);
  expect((await Recovery.findOne({ mediaId: f.assets[0]._id }).lean()).evidence).toEqual(f.proof);
  if (phase !== 'X cleaned Y before') {
    expect(after.map((rows, index) => index === 2 ? [] : rows)).toEqual(before.map((rows, index) => index === 2 ? [] : rows));
    expect(await Asset.findById(f.assets[1]._id)).toBeNull();
    expect((await Recovery.findOne({ mediaId: f.assets[1]._id }).lean()).evidence).toEqual(y);
  }
});

test('C-QA-02 lease oracle detects omission of the historical same-generation lease check', async () => {
  const f = await qa02History(-1);
  await Reference.collection.updateOne({ mediaId: f.assets[1]._id }, { $set: { leaseExpiresAt: new Date(f.prior.leaseExpiresAt.getTime() + 1) } });
  const before = await snapshot();
  await expect(restore(f.assets[0]._id, make({ journal: f.historyJournal }))).rejects.toMatchObject({ code: 'USER_DELETION_EVIDENCE_INVALID' });
  expect(await snapshot()).toEqual(before);
  const removed = await mutant('ref.leaseExpiresAt === historical.get(key(ref)).leaseExpiresAt && ', '', { journal: f.historyJournal });
  await expect(restore(f.assets[0]._id, removed)).resolves.toMatchObject({ state: 'USER_DELETION_RESTORED' });
});

test('C-QA-03 complete-group oracle detects checking only the overlapping later C member', async () => {
  const f = await qa03LaterGroup(); await Asset.collection.deleteOne({ _id: f.z._id });
  const before = await snapshot();
  await expect(restore(f.assets[0]._id)).rejects.toMatchObject({ code: 'USER_DELETION_DEPENDENCY_PENDING' });
  expect(await snapshot()).toEqual(before);
  const removed = await mutant('for (const item of group.references) {',
    'for (const item of group.references.filter(item => item.mediaId === ref.mediaId)) {');
  await expect(restore(f.assets[0]._id, removed)).resolves.toMatchObject({ state: 'USER_DELETION_RESTORED' });
  expect(await Asset.findById(f.z._id)).toBeNull();
});

test('C-QA-05 full-fact oracle detects outbox-only unknown-commit confirmation', async () => {
  const f = await fixture();
  const uncertain = () => {
    let calls = 0;
    return async work => {
      const result = await runner(work); calls += 1;
      if (calls === 1) { await Guard.collection.deleteOne({ mediaId: f.assets[0]._id }); throw Error('Synthetic lost acknowledgement'); }
      return result;
    };
  };
  await expect(restore(f.assets[0]._id, make({ transactionRunner: uncertain() }))).rejects.toMatchObject({ code: 'USER_DELETION_DEPENDENCY_PENDING' });
  expect(await Recovery.countDocuments()).toBe(1); expect(await Guard.countDocuments()).toBe(0);
  await rewind(f.backup);
  const removed = await mutant('await transactionRunner(async session => { if ((await plan(proof, session, time, cache)).length) throw pending(); });',
    'await transactionRunner(async session => { if (!await Recovery.findOne({ mediaId }).session(session)) throw pending(); });',
    { transactionRunner: uncertain() });
  await expect(restore(f.assets[0]._id, removed)).resolves.toMatchObject({ state: 'USER_DELETION_RESTORED' });
  expect(await Recovery.countDocuments()).toBe(1); expect(await Guard.countDocuments()).toBe(0);
});

test.each(['valid', 'early update'])('C-P2-3 later ABORTED C has %s chronology for independent Z', async kind => {
  const f = await qa03LaterGroup('aborted');
  if (kind === 'early update') {
    const c = await Operation.findOne({ operationId: f.c.operationId }).lean();
    await Reference.collection.updateOne({ mediaId: f.z._id }, { $set: { updatedAt: new Date(c.terminalAt.getTime() - 1) } });
  }
  const before = await snapshot(), files = await qa23Files();
  if (kind === 'valid') {
    await restore(f.assets[0]._id);
    expect(await Reference.find().sort({ _id: 1 }).lean()).toEqual(f.expected[1]);
    expect(await Operation.find().sort({ _id: 1 }).lean()).toEqual(f.expected[2]);
    await qa23Audit(f, f.proof);
  } else {
    await expect(restore(f.assets[0]._id)).rejects.toMatchObject({ code: 'USER_DELETION_EVIDENCE_INVALID' });
    expect(await snapshot()).toEqual(before); await qa23MissingTarget(f);
  }
  expect(await qa23Files()).toEqual(files);
});

const compositeReader = async () => {
  const targetRoot = path.join(root, 'v1');
  const nested = createUserDeletionRecoveryJournal({ root: path.join(targetRoot, 'user-deletions-v2') });
  for (const name of await fs.readdir(path.join(root, 'v2'))) {
    if (/^[0-9a-f]{24}\.json$/.test(name)) await nested.persist(await journal.read(name.slice(0, -5)));
  }
  return require('../services/userDeletionRecoveryReader').createUserDeletionRecoveryReader({ root: targetRoot });
};

test.each(['paired', 'v2 only'])('C-READER matching %s restores and preserves every log byte', async kind => {
  const f = await fixture(), reader = await compositeReader();
  if (kind === 'v2 only') await fs.unlink(path.join(root, 'v1', f.assets[0]._id + '.json'));
  const files = await qa23Files();
  await expect(restore(f.assets[0]._id, make({ journal: reader }))).resolves.toEqual({ ready: false, state: 'USER_DELETION_RESTORED' });
  expect(await qa23Files()).toEqual(files); await qa23Audit(f, f.proof);
  const before = await snapshot(); await restore(f.assets[0]._id, make({ journal: reader }));
  expect(await snapshot()).toEqual(before); expect(await qa23Files()).toEqual(files);
});

test.each(['pre-deletion', 'already restored'])('C-READER target v1 conflict in %s database rejects before opening a transaction', async state => {
  const f = await fixture(), reader = await compositeReader();
  if (state === 'already restored') await rewind(f.original);
  const file = path.join(root, 'v1', f.assets[0]._id + '.json');
  const content = JSON.parse(await fs.readFile(file, 'utf8')); content.tombstone.actorId = String(id());
  await fs.writeFile(file, JSON.stringify(content) + '\n');
  const before = await snapshot(), files = await qa23Files(), transactionRunner = jest.fn(runner);
  await expect(restore(f.assets[0]._id, make({ journal: reader, transactionRunner })))
    .rejects.toMatchObject({ code: 'USER_DELETION_EVIDENCE_INVALID' });
  expect(transactionRunner).not.toHaveBeenCalled();
  expect(await snapshot()).toEqual(before); expect(await qa23Files()).toEqual(files);
});

test.each(['conflict', 'unreadable'])('C-READER a %s dependency cannot be accepted by unknown-commit confirmation', async kind => {
  const f = await fixture(); await rewind(f.original); now += 10;
  await privacy.deleteMedia({ mediaId: String(f.assets[1]._id), identity: parent });
  const reader = await compositeReader(), file = path.join(root, 'v1', f.assets[1]._id + '.json');
  if (kind === 'conflict') {
    const content = JSON.parse(await fs.readFile(file, 'utf8')); content.tombstone.actorId = String(id());
    await fs.writeFile(file, JSON.stringify(content) + '\n');
  }
  const before = await snapshot(), files = await qa23Files();
  const writes = models.flatMap(Model => [jest.spyOn(Model, 'updateOne'), jest.spyOn(Model.prototype, 'save')]);
  const originalOpen = fs.open;
  const open = kind === 'unreadable' ? jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    if (args[0] === file) throw Object.assign(Error('Synthetic private legacy I/O failure'), { code: 'EACCES' });
    return originalOpen(...args);
  }) : null;
  try {
    await expect(restore(f.assets[0]._id, make({ journal: reader })))
      .rejects.toMatchObject({ code: kind === 'conflict' ? 'USER_DELETION_EVIDENCE_INVALID' : 'USER_DELETION_DEPENDENCY_PENDING' });
  } finally { open?.mockRestore(); }
  for (const spy of writes) expect(spy).not.toHaveBeenCalled();
  expect(await snapshot()).toEqual(before); expect(await qa23Files()).toEqual(files);
});

test('C-READER one helper shares a session through dependency discovery and creates a fresh session for each restore', async () => {
  const f = await fixture(); await rewind(f.original); now += 10;
  await privacy.deleteMedia({ mediaId: String(f.assets[1]._id), identity: parent });
  const reader = await compositeReader(), session = jest.spyOn(reader, 'createReadSession');
  const unscoped = jest.spyOn(reader, 'read');
  const transactionRunner = jest.fn(runner), helper = make({ journal: reader, transactionRunner });
  const before = await snapshot(), files = await qa23Files();
  const originalOpen = fs.open, opened = [];
  const spy = jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    if (typeof args[0] === 'string' && args[0].endsWith('.json')) opened.push(args[0]);
    return originalOpen(...args);
  });
  try {
    await restore(f.assets[0]._id, helper);
    expect(session).toHaveBeenCalledTimes(1); expect(unscoped).not.toHaveBeenCalled();
    expect(transactionRunner).toHaveBeenCalledTimes(2);
    expect(opened).toHaveLength(4); expect(new Set(opened).size).toBe(4);
    await restore(f.assets[0]._id, helper);
    expect(session).toHaveBeenCalledTimes(2); expect(transactionRunner).toHaveBeenCalledTimes(4);
    expect(opened).toHaveLength(8); expect(new Set(opened).size).toBe(4);
  } finally { spy.mockRestore(); }
  expect(await snapshot()).toEqual(before); expect(await qa23Files()).toEqual(files);
});

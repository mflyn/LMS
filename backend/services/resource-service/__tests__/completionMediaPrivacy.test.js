const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('../../../../node_modules/mongodb-memory-server');
const Asset = require('../models/MediaAsset');
const Reference = require('../models/MediaReference');
const Operation = require('../models/MediaReferenceOperation');
const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');
const Family = require('../../../common/models/Family');
const User = require('../models/FamilyUser');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const { createMediaReferenceOperationService } = require('../services/mediaReferenceOperationService');
const { createCompletionMediaPrivacyService } = require('../services/completionMediaPrivacyService');
const { createCompletionMediaCleanupService } = require('../services/completionMediaCleanupService');
const { createMediaDeletionJournal } = require('../services/mediaDeletionJournal');
const { createPrivateMediaStore } = require('../services/privateMediaStore');
const { createMediaCleanupService } = require('../services/mediaCleanupService');
const { createMediaService } = require('../services/mediaService');
const { createMediaCapabilityService } = require('../services/mediaCapability');

jest.setTimeout(30000);
const id = () => new mongoose.Types.ObjectId();
const START = Date.parse('2026-10-22T00:00:00Z');
const DAY = 86400000;
let mongo, root, runner, time, family, child, parent, second, journal, store, operations, privacy, cleanup;
const makePrivacy = (options = {}) => createCompletionMediaPrivacyService({ transactionRunner: runner,
  journal, now: () => time, ...options });
const fixture = async (count = 2) => {
  const assets = [];
  for (let i = 0; i < count; i += 1) {
    const stored = await store.writeCanonical(Buffer.from('synthetic-image'));
    assets.push(await Asset.create({ familyId: family._id, childId: child._id, uploadedBy: child._id,
      purpose: 'task_completion', mimeType: 'image/jpeg', sizeBytes: 15, storageKey: stored.storageKey }));
  }
  return { assets, command: { familyId: String(family._id), childId: String(child._id), resourceType: 'growth_task',
    resourceId: String(id()), operationId: randomUUID(), commandHash: 'a'.repeat(64),
    references: assets.map(a => ({ mediaId: String(a._id), field: 'completionMediaIds' })) } };
};
const del = (asset, identity = parent, service = privacy) => service.deleteMedia({ mediaId: String(asset._id), identity });
const op = command => Operation.findOne({ operationId: command.operationId }).lean();
const refs = command => Reference.find({ resourceId: command.resourceId }).sort({ mediaId: 1 }).lean();
const status = command => operations.status({ ...command, mode: 'operation' });

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri());
  for (const model of [Asset, Reference, Operation, Tombstone, Receipt, Family, User]) await model.init();
  runner = createMongoTransactionRunner(mongoose.connection);
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'completion-privacy-'));
});
beforeEach(async () => {
  for (const model of [Asset, Reference, Operation, Tombstone, Receipt, Family, User]) await model.deleteMany({});
  await fs.rm(root, { recursive: true, force: true }); await fs.mkdir(root);
  time = START;
  parent = { id: String(id()), role: 'parent' }; second = { id: String(id()), role: 'parent' };
  const childId = id();
  family = await Family.create({ familyName: 'Synthetic', ownerParentId: parent.id,
    memberParentIds: [parent.id, second.id], childIds: [childId] });
  await User.create([{ _id: parent.id, role: 'parent' }, { _id: second.id, role: 'parent' }]);
  child = await User.create({ _id: childId, familyId: family._id, role: 'student', childProfile: { tokenVersion: 0 } });
  journal = createMediaDeletionJournal({ root: path.join(root, 'journal') });
  store = createPrivateMediaStore({ root: path.join(root, 'media') });
  operations = createMediaReferenceOperationService({ transactionRunner: runner, now: () => time });
  privacy = makePrivacy();
  cleanup = createCompletionMediaCleanupService({ transactionRunner: runner, journal, mediaStore: store, now: () => time });
});
afterAll(async () => {
  await mongoose.disconnect(); if (mongo) await mongo.stop(); if (root) await fs.rm(root, { recursive: true, force: true });
});

test('deleting one PREPARED image aborts the entire group atomically but deletes only that asset', async () => {
  const { assets, command } = await fixture(); await operations.prepare(command);
  await del(assets[0]);
  expect(await op(command)).toMatchObject({ state: 'ABORTED', failureCode: 'RESOURCE_NOT_FOUND', version: 1 });
  expect((await refs(command)).every(r => r.state === 'released')).toBe(true);
  expect(await Asset.findById(assets[0]._id)).toMatchObject({ status: 'deleted', deletedAt: new Date(START) });
  expect(await Asset.findById(assets[1]._id)).toMatchObject({ status: 'active' });
  expect(await Tombstone.countDocuments()).toBe(1); expect(await Receipt.countDocuments()).toBe(0);
  expect((await operations.commit(command)).operation.state).toBe('ABORTED');
});

test('COMMITTED deletion preserves terminal, releases exact bindings across tasks, and returns durable proofs', async () => {
  const { assets, command } = await fixture();
  const other = { ...command, resourceId: String(id()), operationId: randomUUID() };
  for (const c of [command, other]) { await operations.prepare(c); await operations.commit(c); }
  const before = await op(command); await del(assets[0]);
  expect(await op(command)).toMatchObject({ state: 'COMMITTED', terminalAt: before.terminalAt, version: before.version + 1 });
  expect(await Receipt.countDocuments()).toBe(2);
  for (const c of [command, other]) {
    const response = await status(c);
    const target = response.references.find(r => r.mediaId === String(assets[0]._id));
    expect(target).toMatchObject({ state: 'released', privacyDeletion: { mediaId: String(assets[0]._id),
      resourceType: 'growth_task', resourceId: c.resourceId, field: 'completionMediaIds', bindingOperationId: c.operationId,
      deletedAt: new Date(START).toISOString(), releasedAt: new Date(START).toISOString() } });
    expect(response.references.find(r => r.mediaId === String(assets[1]._id)).state).toBe('bound');
    expect((await operations.abort(c)).operation.state).toBe('COMMITTED');
  }
});

test('repeat deletion by a different authorized actor preserves first audit and durable journal', async () => {
  const { assets } = await fixture(1); await del(assets[0]);
  const first = await Tombstone.findOne().lean();
  const files = await fs.readdir(path.join(root, 'journal'));
  const body = await fs.readFile(path.join(root, 'journal', files[0]), 'utf8');
  time += 1000; await del(assets[0], second);
  expect(await Tombstone.findOne().lean()).toEqual(first);
  expect(String(first.actorId)).toBe(parent.id);
  expect(await fs.readFile(path.join(root, 'journal', files[0]), 'utf8')).toBe(body);
  expect(body).not.toContain(assets[0].storageKey); expect(body).not.toContain('displayName');
});

test.each(['prepare', 'commit', 'abort'])('deletion racing %s converges without partial groups or live deleted bindings', async action => {
  const { assets, command } = await fixture();
  if (action !== 'prepare') await operations.prepare(command);
  await Promise.all([del(assets[0]), operations[action](command)]);
  const record = await op(command), rows = await refs(command);
  expect(['COMMITTED', 'ABORTED']).toContain(record.state);
  expect(rows.filter(r => String(r.mediaId) === String(assets[0]._id)).every(r => r.state === 'released')).toBe(true);
  if (record.state === 'ABORTED') expect(rows.every(r => r.state === 'released')).toBe(true);
  else expect(await Receipt.countDocuments({ bindingOperationId: command.operationId })).toBe(1);
  expect(await Asset.findById(assets[0]._id)).toMatchObject({ status: 'deleted' });
});

test('transaction failure rolls back asset, whole group, tombstone and receipts', async () => {
  const { assets, command } = await fixture(); await operations.prepare(command);
  const broken = makePrivacy({ transactionRunner: work => runner(async session => { await work(session); throw new Error('before commit'); }) });
  await expect(del(assets[0], parent, broken)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect((await op(command)).state).toBe('PREPARED');
  expect((await refs(command)).every(r => r.state === 'prepared')).toBe(true);
  expect((await Asset.findById(assets[0]._id)).status).toBe('active');
  expect(await Tombstone.countDocuments()).toBe(0); expect(await Receipt.countDocuments()).toBe(0);
});

test('lost commit response and failed journal can retry without rewriting deletion facts', async () => {
  const { assets, command } = await fixture(); await operations.prepare(command); await operations.commit(command);
  const uncertain = makePrivacy({ transactionRunner: async work => { await runner(work); throw new Error('response lost'); } });
  await expect(del(assets[0], parent, uncertain)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  const first = await Tombstone.findOne().lean();
  const failing = makePrivacy({ journal: { persist: async () => { throw new Error('disk unavailable'); } } });
  await expect(del(assets[0], second, failing)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  time += 1000; await del(assets[0], second);
  expect(await Tombstone.findOne().lean()).toEqual(first); expect(await Receipt.countDocuments()).toBe(1);
});

test.each(['sibling', 'former parent', 'foreign parent', 'stale child'])('rejects %s using live scope without changing media', async kind => {
  const { assets } = await fixture(1);
  let identity = second;
  if (kind === 'former parent') await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: second.id } });
  if (kind === 'foreign parent') identity = { id: String(id()), role: 'parent' };
  if (kind === 'sibling') identity = { id: String(id()), childId: String(id()), role: 'student', familyId: String(family._id), tokenVersion: 0 };
  if (kind === 'stale child') identity = { id: String(child._id), childId: String(child._id), familyId: String(family._id), role: 'student', tokenVersion: 1 };
  await expect(del(assets[0], identity)).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED' });
  expect((await Asset.findById(assets[0]._id)).status).toBe('active'); expect(await Tombstone.countDocuments()).toBe(0);
});

test('child may delete own media and new prepares cannot bind deleted media', async () => {
  const { assets, command } = await fixture(1);
  await del(assets[0], { id: String(child._id), childId: String(child._id), role: 'student', familyId: String(family._id), tokenVersion: 0 });
  expect((await operations.prepare(command)).operation).toMatchObject({ state: 'ABORTED', failureCode: 'RESOURCE_NOT_FOUND' });
});

test.each(['field', 'scope', 'missing group'])('inconsistent %s blocks deletion and rolls back every write', async kind => {
  const { assets, command } = await fixture(); await operations.prepare(command);
  if (kind === 'missing group') await Reference.deleteOne({ mediaId: assets[1]._id });
  else await Reference.updateOne({ mediaId: assets[0]._id }, { $set: kind === 'field' ? { field: 'attachmentMediaIds' } : { childId: id() } });
  await expect(del(assets[0])).rejects.toMatchObject({ code: 'MEDIA_OPERATION_INCONSISTENT' });
  expect((await Asset.findById(assets[0]._id)).status).toBe('active'); expect(await Tombstone.countDocuments()).toBe(0);
  expect((await op(command)).state).toBe('PREPARED');
});

test('retention cleanup waits 30 days, removes bytes and rows, but preserves exact terminal proof and retry authorization', async () => {
  const { assets, command } = await fixture(1); await operations.prepare(command); await operations.commit(command);
  await del(assets[0]);
  const terminal = await op(command), proof = (await status(command)).references[0].privacyDeletion;
  time += 30 * DAY - 1; expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(0);
  time += 1; expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(1);
  await expect(store.read(assets[0].storageKey)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  expect(await Asset.findById(assets[0]._id)).toBeNull(); expect(await Reference.countDocuments()).toBe(0);
  expect(await op(command)).toEqual(terminal); expect(await Tombstone.countDocuments()).toBe(1);
  expect((await status(command)).references[0]).toMatchObject({ state: 'absent', privacyDeletion: proof });
  const { operationId: _operationId, commandHash: _commandHash, ...referenceScope } = command;
  expect((await operations.status({ ...referenceScope, mode: 'references' })).references[0].privacyDeletion).toEqual(proof);
  await del(assets[0], second);
  await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: second.id } });
  await expect(del(assets[0], second)).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED' });
  expect((await operations.prepare(command)).operation.state).toBe('COMMITTED');
});

test('cleanup checks last release and active references, and never treats ordinary release as privacy proof', async () => {
  const { assets, command } = await fixture(1); await operations.prepare(command); await operations.abort(command); await del(assets[0]);
  expect((await status(command)).references[0].privacyDeletion).toBeNull();
  await Reference.updateOne({ mediaId: assets[0]._id }, { $set: { releasedAt: new Date(START + DAY) } });
  time += 30 * DAY; expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(0);
  await Reference.updateOne({ mediaId: assets[0]._id }, { $set: { state: 'bound', releasedAt: null } });
  time += DAY; expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(0);
});

test('cleanup failure is retryable and the legacy cleanup cannot bypass the new deletion log', async () => {
  const { assets } = await fixture(1); await del(assets[0]); time += 31 * DAY;
  const legacy = createMediaCleanupService({ mediaStore: store, now: () => time });
  expect((await legacy.cleanupDeletedMedia()).cleaned).toBe(0);
  const broken = createCompletionMediaCleanupService({ transactionRunner: runner, journal, now: () => time,
    mediaStore: { remove: async () => { throw new Error('disk failure'); } } });
  await expect(broken.cleanupDeletedMedia()).rejects.toThrow('disk failure');
  expect((await Asset.findById(assets[0]._id)).status).toBe('deleted');
  expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(1);
});

test('proofs do not leak across resource, generation, family or child scopes', async () => {
  const { assets, command } = await fixture(1); await operations.prepare(command); await operations.commit(command); await del(assets[0]);
  for (const patch of [{ resourceId: String(id()) }, { operationId: randomUUID() }, { familyId: String(id()) }, { childId: String(id()) }]) {
    const result = await status({ ...command, ...patch });
    expect(result.references[0].privacyDeletion).toBeNull();
  }
});

test('deletion blocks authorized reads and previously issued signatures while retained bytes still exist', async () => {
  const { assets } = await fixture(1), mediaId = String(assets[0]._id);
  const capability = createMediaCapabilityService({ secret: 'synthetic-private-media-secret-32-characters', now: () => time });
  const reader = createMediaService({ MediaReferenceModel: Reference, FamilyModel: Family, UserModel: User,
    capabilityService: capability, mediaStore: store, transactionRunner: runner, now: () => time });
  const access = await reader.issueAccess({ identity: parent, mediaId });
  const signed = new URL(access.access.url, 'http://synthetic.local');
  const input = { mediaId, path: signed.pathname, ...Object.fromEntries(signed.searchParams) };
  expect((await reader.readContent(input)).bytes.length).toBeGreaterThan(0);
  await del(assets[0]);
  await expect(reader.issueAccess({ identity: parent, mediaId })).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  await expect(reader.readContent(input)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  expect((await store.read(assets[0].storageKey)).length).toBeGreaterThan(0);
});

test('cleanup refuses missing evidence and failed durable logging before touching retained bytes', async () => {
  const { assets } = await fixture(1); await del(assets[0]); time += 31 * DAY;
  const broken = createCompletionMediaCleanupService({ transactionRunner: runner, mediaStore: store, now: () => time,
    journal: { persist: async () => { throw new Error('journal unavailable'); } } });
  await expect(broken.cleanupDeletedMedia()).rejects.toThrow('journal unavailable');
  expect((await store.read(assets[0].storageKey)).length).toBeGreaterThan(0);
  await Tombstone.deleteMany({});
  await expect(cleanup.cleanupDeletedMedia()).rejects.toMatchObject({ code: 'MEDIA_OPERATION_INCONSISTENT' });
  expect((await store.read(assets[0].storageKey)).length).toBeGreaterThan(0);
});

test('cleanup DB failure after physical removal keeps retry metadata and all terminal proofs', async () => {
  const { assets, command } = await fixture(1); await operations.prepare(command); await operations.commit(command);
  await del(assets[0]); time += 31 * DAY;
  const proof = (await status(command)).references[0].privacyDeletion;
  let calls = 0;
  const broken = createCompletionMediaCleanupService({ journal, mediaStore: store, now: () => time,
    transactionRunner: work => runner(async session => {
      const result = await work(session);
      if (++calls === 2) throw new Error('cleanup commit failed');
      return result;
    }) });
  await expect(broken.cleanupDeletedMedia()).rejects.toThrow('cleanup commit failed');
  expect((await Asset.findById(assets[0]._id)).status).toBe('deleted');
  expect(await Reference.countDocuments()).toBe(1);
  expect((await status(command)).references[0].privacyDeletion).toEqual(proof);
  expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(1);
  expect((await status(command)).references[0]).toMatchObject({ state: 'absent', privacyDeletion: proof });
});

test('concurrent deletes preserve one first-actor tombstone and one exact receipt', async () => {
  const { assets, command } = await fixture(1); await operations.prepare(command); await operations.commit(command);
  await Promise.all([del(assets[0]), del(assets[0], second)]);
  expect(await Tombstone.countDocuments()).toBe(1); expect(await Receipt.countDocuments()).toBe(1);
  const first = await Tombstone.findOne().lean();
  expect([parent.id, second.id]).toContain(String(first.actorId));
  expect((await fs.readdir(path.join(root, 'journal'))).filter(n => n.endsWith('.json'))).toHaveLength(1);
});

test('journal refuses conflicting evidence, preserves first bytes and uses private permissions', async () => {
  const { assets } = await fixture(1); await del(assets[0]);
  const filename = path.join(root, 'journal', `${assets[0]._id}.json`);
  const original = await fs.readFile(filename, 'utf8'), evidence = JSON.parse(original);
  evidence.tombstone.actorId = second.id;
  await expect(journal.persist(evidence)).rejects.toThrow('evidence conflict');
  expect(await fs.readFile(filename, 'utf8')).toBe(original);
  expect((await fs.stat(filename)).mode & 0o777).toBe(0o600);
  expect((await fs.stat(path.join(root, 'journal'))).mode & 0o777).toBe(0o700);
});

test('tombstone and receipts reject content fields, duplicate identity and audit rewrites, with no TTL indexes', async () => {
  const { assets, command } = await fixture(1); await operations.prepare(command); await operations.commit(command); await del(assets[0]);
  const tombstone = await Tombstone.findOne().lean(), receipt = await Receipt.findOne().lean();
  expect(() => new Tombstone({ ...tombstone, storageKey: 'forbidden' })).toThrow();
  expect(() => new Receipt({ ...receipt, fileName: 'forbidden' })).toThrow();
  const { _id, ...copy } = tombstone;
  await expect(Tombstone.create(copy)).rejects.toMatchObject({ code: 11000 });
  const { _id: receiptId, ...receiptCopy } = receipt;
  await expect(Receipt.create(receiptCopy)).rejects.toMatchObject({ code: 11000 });
  await Tombstone.updateOne({ _id }, { $set: { actorId: second.id, deletedAt: new Date(time + DAY) } });
  await Receipt.updateOne({ _id: receiptId }, { $set: { bindingOperationId: randomUUID() } });
  expect(await Tombstone.findOne().lean()).toEqual(tombstone); expect(await Receipt.findOne().lean()).toEqual(receipt);
  for (const model of [Tombstone, Receipt, Operation]) {
    expect((await model.collection.indexes()).some(index => index.expireAfterSeconds !== undefined)).toBe(false);
  }
});

test('status does not trust caller-supplied proofs and refuses orphan persisted receipts', async () => {
  const { assets, command } = await fixture(1); await operations.prepare(command); await operations.commit(command); await del(assets[0]);
  await expect(status({ ...command, references: command.references.map(r => ({ ...r, privacyDeletion: {} })) }))
    .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  await Tombstone.deleteMany({});
  await expect(status(command)).rejects.toMatchObject({ code: 'MEDIA_OPERATION_INCONSISTENT' });
});

test('failure to sync the journal parent directory cannot acknowledge deletion success', async () => {
  const { assets } = await fixture(1);
  const original = fs.open.bind(fs);
  const failing = jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await original(...args);
    if (args[0] === root) handle.sync = async () => { throw new Error('parent fsync failed'); };
    return handle;
  });
  await expect(del(assets[0])).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  failing.mockRestore();
  const first = await Tombstone.findOne().lean();
  await del(assets[0], second);
  expect(await Tombstone.findOne().lean()).toEqual(first);
});

test('legacy cleanup still handles old completion deletions without the new protocol marker', async () => {
  const { assets } = await fixture(1);
  await Asset.updateOne({ _id: assets[0]._id }, { $set: { status: 'deleted', deletedAt: new Date(START) } });
  time += 31 * DAY;
  const legacy = createMediaCleanupService({ mediaStore: store, now: () => time });
  expect((await legacy.cleanupDeletedMedia()).cleaned).toBe(1);
  expect(await Tombstone.countDocuments()).toBe(0);
});

test.each(['file', 'directory'])('real journal %s sync failure blocks deletion acknowledgement and retained-media cleanup', async phase => {
  const { assets, command } = await fixture(1);
  await operations.prepare(command); await operations.commit(command);
  const open = fs.open.bind(fs); let fail = true, hits = 0;
  const spy = jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await open(...args), sync = handle.sync.bind(handle);
    const selected = phase === 'directory' ? args[0] === path.join(root, 'journal')
      : path.dirname(args[0]) === path.join(root, 'journal') && args[0].endsWith('.tmp');
    if (selected) handle.sync = async () => {
      if (fail) { hits += 1; throw new Error('Synthetic journal sync failure'); }
      await sync();
    };
    return handle;
  });
  try {
    await expect(del(assets[0])).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING', statusCode: 503 });
    expect(hits).toBe(1);
    const first = await Tombstone.findOne().lean(), receipt = await Receipt.findOne().lean();
    const proof = (await status(command)).references[0].privacyDeletion;
    expect(first.actorId.toString()).toBe(parent.id);
    expect((await Asset.findById(assets[0]._id)).status).toBe('deleted');
    expect((await refs(command))[0].state).toBe('released');
    expect((await store.read(assets[0].storageKey)).length).toBeGreaterThan(0);
    fail = false; time += 1000;
    const restartedJournal = createMediaDeletionJournal({ root: path.join(root, 'journal') });
    await del(assets[0], second, makePrivacy({ journal: restartedJournal }));
    expect(await Tombstone.findOne().lean()).toEqual(first);
    expect(await Receipt.findOne().lean()).toEqual(receipt);
    const journalPath = path.join(root, 'journal', `${assets[0]._id}.json`);
    const original = await fs.readFile(journalPath, 'utf8');
    expect(JSON.parse(original).tombstone.actorId).toBe(parent.id);
    time += 31 * DAY; fail = true;
    const retainedAsset = await Asset.findById(assets[0]._id).lean(), retainedRefs = await refs(command);
    const remove = jest.spyOn(store, 'remove');
    await expect(cleanup.cleanupDeletedMedia()).rejects.toThrow('Synthetic journal sync failure');
    expect(hits).toBe(2); expect(remove).not.toHaveBeenCalled();
    expect(await Asset.findById(assets[0]._id).lean()).toEqual(retainedAsset);
    expect(await refs(command)).toEqual(retainedRefs);
    expect(await fs.readFile(journalPath, 'utf8')).toBe(original);
    expect((await store.read(assets[0].storageKey)).length).toBeGreaterThan(0);
    fail = false;
    const restartedCleanup = createCompletionMediaCleanupService({ transactionRunner: runner,
      journal: restartedJournal, mediaStore: store, now: () => time });
    expect(await restartedCleanup.cleanupDeletedMedia()).toEqual({ cleaned: 1, mediaIds: [String(assets[0]._id)] });
    expect(await Asset.findById(assets[0]._id)).toBeNull(); expect(await refs(command)).toEqual([]);
    expect((await status(command)).references[0]).toMatchObject({ state: 'absent', privacyDeletion: proof });
    await del(assets[0], second, makePrivacy({ journal: restartedJournal }));
    expect(await Tombstone.findOne().lean()).toEqual(first); expect(await Receipt.findOne().lean()).toEqual(receipt);
    expect(await fs.readFile(journalPath, 'utf8')).toBe(original);
  } finally { spy.mockRestore(); }
});

test('conflicting durable first audit blocks cleanup without overwriting bytes or deleting media', async () => {
  const { assets } = await fixture(1); await del(assets[0]); time += 31 * DAY;
  const filename = path.join(root, 'journal', `${assets[0]._id}.json`);
  const altered = JSON.parse(await fs.readFile(filename, 'utf8'));
  altered.tombstone.actorId = second.id;
  const conflicting = `${JSON.stringify(altered)}\n`; await fs.writeFile(filename, conflicting);
  const before = await Asset.findById(assets[0]._id).lean(), first = await Tombstone.findOne().lean();
  const remove = jest.spyOn(store, 'remove');
  await expect(cleanup.cleanupDeletedMedia()).rejects.toThrow('evidence conflict');
  expect(remove).not.toHaveBeenCalled(); expect(await Asset.findById(assets[0]._id).lean()).toEqual(before);
  expect(await Tombstone.findOne().lean()).toEqual(first); expect(await fs.readFile(filename, 'utf8')).toBe(conflicting);
  expect((await store.read(assets[0].storageKey)).length).toBeGreaterThan(0);
});

test.each(['delete', 'cleanup'])('%s must await journal acknowledgement before success or physical removal', async action => {
  const { assets, command } = await fixture(1); await operations.prepare(command); await operations.commit(command);
  if (action === 'cleanup') { await del(assets[0]); time += 31 * DAY; }
  let release, entered, journalWork, journalFinished = false, completed = false;
  const blocked = new Promise(resolve => { release = resolve; });
  const reached = new Promise(resolve => { entered = resolve; });
  const early = [];
  const gated = { persist: value => {
    journalWork = (async () => { await journal.persist(value); entered(); await blocked; journalFinished = true; })();
    return journalWork;
  } };
  const remove = store.remove.bind(store);
  const spy = jest.spyOn(store, 'remove').mockImplementation(async key => {
    if (!journalFinished) early.push('remove');
    return remove(key);
  });
  const work = action === 'delete' ? () => del(assets[0], parent, makePrivacy({ journal: gated }))
    : () => createCompletionMediaCleanupService({ transactionRunner: runner, journal: gated,
      mediaStore: store, now: () => time }).cleanupDeletedMedia();
  const pending = work().then(() => { completed = true; if (!journalFinished) early.push('acknowledgement'); });
  try {
    await Promise.race([reached, pending]);
    expect(completed).toBe(false);
    expect(await Asset.findById(assets[0]._id)).not.toBeNull();
    expect((await store.read(assets[0].storageKey)).length).toBeGreaterThan(0);
    expect(spy).not.toHaveBeenCalled();
  } finally { release(); await Promise.all([pending, journalWork]); spy.mockRestore(); }
  expect(journalFinished).toBe(true); expect(completed).toBe(true); expect(early).toEqual([]);
  if (action === 'cleanup') expect(await Asset.findById(assets[0]._id)).toBeNull();
});

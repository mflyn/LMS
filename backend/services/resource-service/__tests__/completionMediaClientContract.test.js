const mongoose = require('mongoose');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const { MongoMemoryReplSet } = require('../../../../node_modules/mongodb-memory-server');
const { createCompletionMediaReferenceClient } = require('../../../common/services/mediaReferenceClient');
const { createMediaReferenceOperationService } = require('../services/mediaReferenceOperationService');
const { createCompletionMediaPrivacyService } = require('../services/completionMediaPrivacyService');
const { createCompletionMediaCleanupService } = require('../services/completionMediaCleanupService');
const { createMediaDeletionJournal } = require('../services/mediaDeletionJournal');
const { createPrivateMediaStore } = require('../services/privateMediaStore');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const Asset = require('../models/MediaAsset');
const Reference = require('../models/MediaReference');
const Operation = require('../models/MediaReferenceOperation');
const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');
const Family = require('../../../common/models/Family');
const User = require('../models/FamilyUser');

jest.setTimeout(30000);
const id = () => new mongoose.Types.ObjectId();
const TOKEN = 'synthetic-contract-token-32-characters';
let mongo, root, runner, now, service, client, transport, family, child, parent, privacy, cleanup, store;
const fixture = async () => {
  const assets = [];
  for (let i = 0; i < 2; i += 1) {
    const stored = await store.writeCanonical(Buffer.from('synthetic-image'));
    assets.push(await Asset.create({ familyId: family._id, childId: child, uploadedBy: child,
      purpose: 'task_completion', mimeType: 'image/jpeg', sizeBytes: 15, storageKey: stored.storageKey }));
  }
  return { familyId: String(family._id), childId: String(child), resourceType: 'growth_task', resourceId: String(id()),
    remoteOperationId: randomUUID(), commandHash: 'a'.repeat(64), references: assets.map(a => ({ mediaId: String(a._id), field: 'completionMediaIds' })) };
};
const status = c => client.status({ ...c, mode: 'operation' });
const refStatus = c => {
  const { remoteOperationId, commandHash, ...scope } = c;
  return client.status({ ...scope, mode: 'references' });
};
const removal = c => {
  const { commandHash, remoteOperationId, ...scope } = c;
  return { ...scope, remoteOperationId: randomUUID(),
    references: c.references.map(ref => ({ ...ref, bindingOperationId: remoteOperationId })) };
};

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri());
  for (const model of [Asset, Reference, Operation, Tombstone, Receipt, Family, User]) await model.init();
  runner = createMongoTransactionRunner(mongoose.connection);
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'completion-client-contract-'));
});
beforeEach(async () => {
  for (const model of [Asset, Reference, Operation, Tombstone, Receipt, Family, User]) await model.deleteMany({});
  await fs.rm(root, { recursive: true, force: true }); await fs.mkdir(root);
  now = Date.parse('2026-10-22T00:00:00Z');
  child = id(); parent = { id: String(id()), role: 'parent' };
  family = await Family.create({ familyName: 'Synthetic', ownerParentId: parent.id, memberParentIds: [parent.id], childIds: [child] });
  await User.create({ _id: parent.id, role: 'parent' });
  const journal = createMediaDeletionJournal({ root: path.join(root, 'journal') });
  store = createPrivateMediaStore({ root: path.join(root, 'media') });
  const options = { transactionRunner: runner, now: () => now, journal, mediaStore: store };
  service = createMediaReferenceOperationService(options);
  privacy = createCompletionMediaPrivacyService(options); cleanup = createCompletionMediaCleanupService(options);
  // Contract adapter exercises the real provider and JSON wire shape, not a registered production route.
  transport = { post: jest.fn(async (url, wire, config) => {
    expect(config.headers['x-service-token']).toBe(TOKEN);
    const action = url.split('/').pop();
    const data = await service[action](JSON.parse(JSON.stringify(wire)));
    return { status: 200, data: { success: true, data: JSON.parse(JSON.stringify(data)) } };
  }) };
  client = createCompletionMediaReferenceClient({ axiosInstance: transport, resourceServiceUrl: 'http://synthetic-resource', serviceToken: TOKEN });
});
afterAll(async () => {
  await mongoose.disconnect(); if (mongo) await mongo.stop(); if (root) await fs.rm(root, { recursive: true, force: true });
});

test('real ABSENT -> PREPARED -> COMMITTED and late abort retain exact remote identity', async () => {
  const c = await fixture();
  expect((await status(c)).operation.state).toBe('ABSENT');
  expect((await client.prepare(c)).operation.state).toBe('PREPARED');
  expect((await client.commit(c)).operation.state).toBe('COMMITTED');
  expect((await client.abort(c)).operation.state).toBe('COMMITTED');
  expect((await refStatus(c)).references.every(r => r.state === 'bound' && r.bindingOperationId === c.remoteOperationId)).toBe(true);
  expect(await Operation.countDocuments()).toBe(1);
});

test('provider media refusal and expired lease return persisted ABORTED evidence, not bare errors', async () => {
  const c = await fixture(); await Asset.deleteOne({ _id: c.references[0].mediaId });
  expect((await client.prepare(c)).operation).toMatchObject({ state: 'ABORTED', failureCode: 'RESOURCE_NOT_FOUND' });
  const other = await fixture(); await client.prepare(other); now += 900000;
  expect((await status(other)).operation).toMatchObject({ state: 'PREPARED', leaseExpired: true });
  expect((await client.abort(other)).operation).toMatchObject({ state: 'ABORTED', failureCode: 'MEDIA_OPERATION_EXPIRED' });
  expect((await client.commit(other)).operation.failureCode).toBe('MEDIA_OPERATION_EXPIRED');
});

test('lost commit response recovers original operation without generating another identity', async () => {
  const c = await fixture(); await client.prepare(c);
  const post = transport.post.getMockImplementation();
  transport.post.mockImplementationOnce(async (...args) => { await post(...args); throw new Error('response lost'); });
  await expect(client.commit(c)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect((await status(c)).operation).toMatchObject({ state: 'COMMITTED', operationId: c.remoteOperationId });
  expect((await client.commit(c)).operation.state).toBe('COMMITTED');
  expect(await Operation.countDocuments()).toBe(1);
});

test('provider hash conflict cannot become local terminal evidence', async () => {
  const c = await fixture(); await client.prepare(c);
  await expect(client.abort({ ...c, commandHash: 'b'.repeat(64) })).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect((await status(c)).operation.state).toBe('PREPARED');
});

test('deletion proof remains exact through cleanup and late terminal replay', async () => {
  const c = await fixture(); await client.prepare(c); await client.commit(c);
  await privacy.deleteMedia({ identity: parent, mediaId: c.references[0].mediaId });
  const before = await status(c), proof = before.references.find(r => r.mediaId === c.references[0].mediaId).privacyDeletion;
  expect(proof).toMatchObject({ resourceId: c.resourceId, bindingOperationId: c.remoteOperationId });
  now += 31 * 86400000; expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(1);
  for (const response of [await status(c), await refStatus(c), await client.commit(c)]) {
    expect(response.references.find(r => r.mediaId === c.references[0].mediaId)).toMatchObject({ state: 'absent', privacyDeletion: proof });
  }
});

test('privacy deletion of PREPARED group yields ABORTED and no forged bound receipts', async () => {
  const c = await fixture(); await client.prepare(c);
  await privacy.deleteMedia({ identity: parent, mediaId: c.references[0].mediaId });
  const response = await client.commit(c);
  expect(response.operation).toMatchObject({ state: 'ABORTED', failureCode: 'RESOURCE_NOT_FOUND' });
  expect(response.references.every(r => r.state === 'released' && r.privacyDeletion === null)).toBe(true);
});

test('another generation stays visible when replaying a historical ABORTED command', async () => {
  const c = await fixture(); await client.prepare(c); await client.abort(c);
  const next = { ...c, remoteOperationId: randomUUID(), commandHash: 'b'.repeat(64) };
  await client.prepare(next); await client.commit(next);
  const historical = await status(c);
  expect(historical.operation.state).toBe('ABORTED');
  expect(historical.references.every(r => r.bindingOperationId === next.remoteOperationId && r.state === 'bound')).toBe(true);
});

test('lost unbind response recovers identical release facts without a new remote operation', async () => {
  const c = await fixture(); await client.prepare(c); await client.commit(c);
  const input = removal(c), post = transport.post.getMockImplementation();
  transport.post.mockImplementationOnce(async (...args) => { await post(...args); throw new Error('lost release response'); });
  await expect(client.unbind(input)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  const before = await Reference.find().sort({ mediaId: 1 }).lean(); now += 1000;
  const result = await client.unbind(input);
  expect(result.operation).toBeNull(); expect(result.references.every(r => r.state === 'released')).toBe(true);
  expect(await Reference.find().sort({ mediaId: 1 }).lean()).toEqual(before);
  expect(await Operation.countDocuments()).toBe(1);
  expect(await Operation.exists({ operationId: input.remoteOperationId })).toBeNull();
  expect(await Receipt.countDocuments()).toBe(0); expect(await Tombstone.countDocuments()).toBe(0);
});

test('unbind after privacy deletion and retention selects the old binding proof, never the release audit id', async () => {
  const c = await fixture(); await client.prepare(c); await client.commit(c);
  const input = removal(c), target = c.references[0].mediaId;
  await privacy.deleteMedia({ identity: parent, mediaId: target });
  const released = await Reference.findOne({ mediaId: target }).lean();
  const first = await client.unbind(input);
  const proof = first.references.find(r => r.mediaId === target).privacyDeletion;
  expect(proof.bindingOperationId).toBe(c.remoteOperationId);
  expect(await Reference.findOne({ mediaId: target }).lean()).toEqual(released);
  now += 31 * 86400000; expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(1);
  const replay = await client.unbind(input);
  expect(replay.references.find(r => r.mediaId === target)).toEqual({ ...c.references[0], state: 'absent', privacyDeletion: proof });
  const wrongOld = { ...input, references: [{ ...input.references[0], bindingOperationId: randomUUID() }] };
  expect((await client.unbind(wrongOld)).references[0]).toEqual({ ...c.references[0], state: 'absent', privacyDeletion: null });
});

test('ordinary unbind followed by privacy deletion never creates a bound-at-deletion receipt', async () => {
  const c = await fixture(); await client.prepare(c); await client.commit(c);
  const input = removal(c); await client.unbind(input);
  await privacy.deleteMedia({ identity: parent, mediaId: c.references[0].mediaId });
  expect(await Receipt.countDocuments()).toBe(0);
  now += 31 * 86400000; await cleanup.cleanupDeletedMedia();
  const result = await client.unbind(input);
  expect(result.references.find(r => r.mediaId === c.references[0].mediaId)).toEqual({ ...c.references[0], state: 'absent', privacyDeletion: null });
  expect((await client.commit(c)).operation.state).toBe('COMMITTED');
});

test('privacy deletion competing with unbind serializes old terminal and exact receipt facts', async () => {
  const c = await fixture(); await client.prepare(c); await client.commit(c);
  const input = removal(c), target = c.references[0].mediaId;
  await Promise.all([client.unbind(input), privacy.deleteMedia({ identity: parent, mediaId: target })]);
  const terminal = await status(c), result = await client.unbind(input);
  expect(terminal.operation.state).toBe('COMMITTED');
  expect(result.references.every(r => r.state === 'released')).toBe(true);
  const ref = await Reference.findOne({ mediaId: target }).lean();
  const receipt = await Receipt.findOne({ mediaId: target }).lean();
  if (ref.releaseOperationId === null) {
    expect(receipt.bindingOperationId).toBe(c.remoteOperationId);
    expect(result.references.find(r => r.mediaId === target).privacyDeletion.bindingOperationId).toBe(c.remoteOperationId);
  } else {
    expect(ref.releaseOperationId).toBe(input.remoteOperationId); expect(receipt).toBeNull();
  }
  expect(await Tombstone.countDocuments()).toBe(1);
});

test('old unbind arriving after rebind remains pending and cannot alter newer generation', async () => {
  const c = await fixture(); await client.prepare(c); await client.commit(c);
  const input = removal(c); await client.unbind(input);
  const next = { ...c, remoteOperationId: randomUUID() }; await client.prepare(next); await client.commit(next);
  const before = await Reference.find().sort({ mediaId: 1 }).lean();
  await expect(client.unbind(input)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect(await Reference.find().sort({ mediaId: 1 }).lean()).toEqual(before);
  expect((await client.commit(c)).references.every(r => r.bindingOperationId === next.remoteOperationId)).toBe(true);
});

test('commit competing with unbind never leaves a partly bound group or changes terminal outcome', async () => {
  const c = await fixture(); await client.prepare(c);
  const input = removal(c);
  const results = await Promise.allSettled([client.commit(c), client.unbind(input)]);
  expect(results[0].status).toBe('fulfilled');
  if (results[1].status === 'rejected') expect(results[1].reason.code).toBe('MEDIA_REFERENCE_PENDING');
  expect((await status(c)).operation.state).toBe('COMMITTED');
  const rows = await Reference.find().lean();
  expect(new Set(rows.map(r => r.state)).size).toBe(1);
  expect((await client.unbind(input)).references.every(r => r.state === 'released')).toBe(true);
});

test('client accepts a mixed removal set from different old operations and honest absent rows', async () => {
  const c = await fixture();
  const first = { ...c, references: [c.references[0]] };
  const second = { ...c, remoteOperationId: randomUUID(), references: [c.references[1]] };
  for (const command of [first, second]) { await client.prepare(command); await client.commit(command); }
  const input = { ...removal(first), references: [...removal(first).references, ...removal(second).references,
    { mediaId: String(id()), field: 'completionMediaIds', bindingOperationId: randomUUID() }] };
  const result = await client.unbind(input);
  expect(result.references.filter(r => r.state === 'released')).toHaveLength(2);
  expect(result.references.filter(r => r.state === 'absent')).toHaveLength(1);
  expect(await Operation.countDocuments()).toBe(2);
});

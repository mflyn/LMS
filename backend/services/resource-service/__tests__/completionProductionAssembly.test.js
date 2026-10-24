process.env.GATEWAY_IDENTITY_SECRET = 'synthetic-r3-resource-gateway-secret-32';
process.env.JWT_SECRET = 'synthetic-r3-resource-jwt-secret-32chars';
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/synthetic-unused';
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createHttpTestHarness } = require('../../../common/test/httpTestHarness');
const { createIdentityHeaders } = require('../../../common/middleware/gatewayIdentity');
const { createProductionApp, startServer } = require('../server');
const Asset = require('../models/MediaAsset');
const Reference = require('../models/MediaReference');
const Operation = require('../models/MediaReferenceOperation');
const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');
const UploadGuard = require('../models/CompletionUploadGuard');
const Retirement = require('../models/MediaOrphanRetirement');
const Family = require('../../../common/models/Family');
const User = require('../models/FamilyUser');
const { createPrivateMediaStore } = require('../services/privateMediaStore');
const { createMediaDeletionJournal } = require('../services/mediaDeletionJournal');
const { createCompletionMediaCleanupService } = require('../services/completionMediaCleanupService');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const { createRetentionDependencies } = require('../services/orphanRetentionRuntime');
const { createOrphanRetirementService } = require('../services/orphanRetirementService');
const { createCompletionUploadService } = require('../services/completionUploadService');
const { request, close } = createHttpTestHarness();
const TOKEN = 'synthetic-r3-resource-service-token-32';
const models = [Asset, Reference, Operation, Tombstone, Receipt, Family, User, UploadGuard, Retirement];
const id = () => new mongoose.Types.ObjectId();
let mongo, root, env, family, parent, second, child, foreign, store;
jest.setTimeout(30000);
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  for (const model of models) await model.init();
});
beforeEach(async () => {
  for (const model of models) await model.deleteMany({});
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'r3-resource-')));
  await fs.chmod(root, 0o700);
  env = { NODE_ENV: 'test', COMPLETION_PROTOCOL_MODE: 'enabled', COMPLETION_WRITES_PAUSED: 'true',
    COMPLETION_RETIREMENT_SERVICE_TOKEN: 'synthetic-retirement-dedicated-resource-32',
    MONGO_URI: mongo.getUri(), MEDIA_SECURITY_PROFILE: 'trusted-local', MEDIA_REFERENCE_SERVICE_TOKEN: TOKEN,
    MEDIA_SIGNING_SECRET: TOKEN, PRIVATE_MEDIA_ROOT: path.join(root, 'media'),
    COMPLETION_DELETION_JOURNAL_ROOT: path.join(root, 'journal'), COMPLETION_STORAGE_CONFIRMED: 'true' };
  await fs.mkdir(env.PRIVATE_MEDIA_ROOT, { mode: 0o700 });
  await fs.mkdir(env.COMPLETION_DELETION_JOURNAL_ROOT, { mode: 0o700 });
  parent = { id: String(id()), role: 'parent' }; second = { id: String(id()), role: 'parent' };
  foreign = { id: String(id()), role: 'parent' };
  child = { id: String(id()), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic', ownerParentId: parent.id,
    memberParentIds: [parent.id, second.id], childIds: [child.id] });
  child.familyId = String(family._id); child.childId = child.id;
  await User.create([{ _id: parent.id, role: 'parent' }, { _id: second.id, role: 'parent' },
    { _id: foreign.id, role: 'parent' }, { _id: child.id, role: 'student', familyId: family._id, childProfile: { tokenVersion: 0 } }]);
  await Family.create({ familyName: 'Other synthetic', ownerParentId: foreign.id, memberParentIds: [foreign.id], childIds: [] });
  store = createPrivateMediaStore({ root: env.PRIVATE_MEDIA_ROOT });
});
test.each([undefined, 'false'])('T2-G-010 formal enabled upload journals fixed identity and retention even while cleanup is off (%s)', async cleanupFlag => {
  if (cleanupFlag !== undefined) env.COMPLETION_ORPHAN_CLEANUP_ENABLED = cleanupFlag;
  const remote = jest.spyOn(globalThis, 'fetch').mockRejectedValue(Error('Unexpected remote request during upload'));
  const bytes = await require('sharp')({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).jpeg().toBuffer();
  const result = await (await request(app())).post('/api/media')
    .set(createIdentityHeaders({ method: 'POST', originalUrl: '/api/media', user: parent, secret: process.env.GATEWAY_IDENTITY_SECRET }))
    .field('purpose', 'task_completion').field('childId', child.id).attach('file', bytes, 'synthetic.jpg');
  expect(result.status).toBe(201);
  const asset = await Asset.findById(result.body.data.media.mediaId).lean();
  expect(asset.retentionPolicyVersion).toBe(1); expect(asset.orphanEligibleAt.getTime() - asset.createdAt.getTime()).toBe(86400000);
  expect((await UploadGuard.findOne({ mediaId: asset._id })).state).toBe('REGISTERED');
  const record = JSON.parse(await fs.readFile(path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, 'uploads-v1', asset._id + '.json'), 'utf8'));
  expect(record.mediaId).toBe(String(asset._id)); expect(JSON.stringify(record)).not.toContain('synthetic.jpg');
  expect((await UploadGuard.findOne({ mediaId: asset._id })).metadataHash).toBe(record.metadataHash);
  expect(await Retirement.countDocuments()).toBe(0); expect(remote).not.toHaveBeenCalled();
});
afterEach(async () => { await close(); jest.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
const app = () => createProductionApp({ env });
const call = async (application, method, url, identity = parent, body) => {
  let req = (await request(application))[method.toLowerCase()](url);
  if (identity) req = req.set(createIdentityHeaders({ method, originalUrl: url, user: identity,
    secret: process.env.GATEWAY_IDENTITY_SECRET }));
  if (body !== undefined) req = req.send(body);
  return req;
};
const internal = async (application, action, command, token = TOKEN) => {
  const req = (await request(application)).post('/api/internal/media/references/' + action).send(command);
  return token ? req.set('x-service-token', token) : req;
};
const asset = async (purpose = 'task_completion') => {
  const stored = await store.writeCanonical(Buffer.from('synthetic-image'));
  return Asset.create({ familyId: family._id, childId: child.id, uploadedBy: child.id,
    purpose, mimeType: 'image/jpeg', sizeBytes: 15, storageKey: stored.storageKey });
};
const group = async application => {
  const assets = [await asset(), await asset()];
  const command = { familyId: String(family._id), childId: child.id, resourceType: 'growth_task', resourceId: String(id()),
    operationId: randomUUID(), commandHash: 'a'.repeat(64), references: assets.map(a => ({ mediaId: String(a._id), field: 'completionMediaIds' })) };
  expect((await internal(application, 'prepare', command)).status).toBe(200);
  return { assets, command };
};

const completionUpload = async application => {
  const bytes = await require('sharp')({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).jpeg().toBuffer();
  return (await request(application)).post('/api/media')
    .set(createIdentityHeaders({ method: 'POST', originalUrl: '/api/media', user: parent,
      secret: process.env.GATEWAY_IDENTITY_SECRET }))
    .field('purpose', 'task_completion').field('childId', child.id).attach('file', bytes, 'synthetic.jpg');
};

test('T2-G-010 formal upload journal failure stops metadata writes and redacts internal details', async () => {
  const link = fs.link.bind(fs);
  jest.spyOn(fs, 'link').mockImplementation((source, destination) => {
    if (path.dirname(destination) === path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, 'uploads-v1')) {
      throw Error('synthetic-private-upload-journal-failure');
    }
    return link(source, destination);
  });
  const response = await completionUpload(app());
  expect(response.status).toBe(503); expect(response.body.error.code).toBe('MEDIA_UPLOAD_PENDING');
  expect(JSON.stringify(response.body)).not.toContain('synthetic-private-upload-journal-failure');
  expect(await Asset.countDocuments()).toBe(0); expect(await UploadGuard.countDocuments()).toBe(0);
  expect(await fs.readdir(env.PRIVATE_MEDIA_ROOT)).toEqual(['.incoming']);
});

test('T2-G-010 formal upload lost commit acknowledgement preserves bytes and resumes the fixed journal identity', async () => {
  const commit = mongoose.mongo.ClientSession.prototype.commitTransaction;
  let dropped = false;
  jest.spyOn(mongoose.mongo.ClientSession.prototype, 'commitTransaction').mockImplementation(async function (...args) {
    const result = await commit.apply(this, args);
    if (!dropped) { dropped = true; throw Error('synthetic lost upload commit acknowledgement'); }
    return result;
  });
  const response = await completionUpload(app());
  expect(response.status).toBe(503); expect(response.body.error.code).toBe('MEDIA_UPLOAD_PENDING');
  expect(dropped).toBe(true);
  const stored = await Asset.findOne().lean();
  expect(stored.status).toBe('active'); expect((await store.read(stored.storageKey)).length).toBe(stored.sizeBytes);
  const record = JSON.parse(await fs.readFile(path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, 'uploads-v1', stored._id + '.json')));
  expect(record.mediaId).toBe(String(stored._id));
  const dependencies = createRetentionDependencies(env);
  const resumed = await createCompletionUploadService({ transactionRunner: createMongoTransactionRunner(mongoose.connection),
    mediaStore: store, journal: dependencies.uploadJournal }).resume(record);
  expect(String(resumed._id)).toBe(String(stored._id)); expect(await Asset.countDocuments()).toBe(1);
  expect((await UploadGuard.findOne()).state).toBe('REGISTERED');
});

test.each(['DELETED', 'PURGED'])('formal DELETE replays system %s evidence without creating user deletion audit', async state => {
  const time = Date.now(), { storageKey } = await store.writeCanonical(Buffer.from('synthetic-image'));
  const stored = await Asset.create({ familyId: family._id, childId: child.id, uploadedBy: parent.id,
    purpose: 'task_completion', mimeType: 'image/jpeg', sizeBytes: 15, storageKey, retentionPolicyVersion: 1,
    createdAt: new Date(time - 86400000), orphanEligibleAt: new Date(time) });
  const { journal } = createRetentionDependencies(env);
  // Seed an already granted system retirement using the actual local protocol; no homework DB is written.
  const gc = createOrphanRetirementService({ transactionRunner: createMongoTransactionRunner(mongoose.connection),
    mediaStore: store, now: () => stored.orphanEligibleAt.getTime(),
    retirementClient: { retire: async body => ({ ...body, state: 'granted' }) },
    journal: state === 'PURGED' ? journal : { persist: async evidence => {
      await journal.persist(evidence); throw Error('synthetic pause before physical cleanup');
    } } });
  if (state === 'PURGED') expect((await gc.retire({ mediaId: String(stored._id) })).state).toBe('PURGED');
  else await expect(gc.retire({ mediaId: String(stored._id) })).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
  expect((await Retirement.findOne()).state).toBe(state);
  const evidence = await journal.read(String(stored._id));
  const foreignResponse = await call(app(), 'DELETE', '/api/media/' + stored._id, foreign);
  const missingResponse = await call(app(), 'DELETE', '/api/media/' + id(), foreign);
  expect(foreignResponse.status).toBe(404); expect(foreignResponse.body.error).toEqual(missingResponse.body.error);
  expect((await Retirement.findOne()).state).toBe(state);
  expect((await call(app(), 'DELETE', '/api/media/' + stored._id, second)).status).toBe(204);
  expect((await Retirement.findOne()).state).toBe('PURGED');
  expect(await journal.read(String(stored._id))).toEqual(evidence);
  expect(await Asset.findById(stored._id)).toBeNull();
  await expect(store.read(stored.storageKey)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  expect(await Tombstone.countDocuments()).toBe(0); expect(await Receipt.countDocuments()).toBe(0);
  expect((await UploadGuard.findOne()).state).toBe('RETIRED');
  expect((await call(app(), 'DELETE', '/api/media/' + stored._id)).status).toBe(204);
  expect(await journal.read(String(stored._id))).toEqual(evidence);
});

test.each(['legacy', 'maintenance'])('%s formal composition requires no retirement token or journal configuration', async mode => {
  env.COMPLETION_PROTOCOL_MODE = mode;
  delete env.COMPLETION_RETIREMENT_SERVICE_TOKEN; delete env.COMPLETION_DELETION_JOURNAL_ROOT;
  const application = app();
  const response = await completionUpload(application);
  expect(response.status).toBe(mode === 'legacy' ? 201 : 503);
  if (mode === 'legacy') {
    expect((await Asset.findOne()).retentionPolicyVersion).toBeUndefined();
    expect(await fs.readdir(path.join(root, 'journal'))).toEqual([]);
  }
  expect(await UploadGuard.countDocuments()).toBe(0); expect(await Retirement.countDocuments()).toBe(0);
});

test.each(['missing', 'shared'])('enabled formal composition rejects %s retirement credential even with cleanup disabled', kind => {
  env.COMPLETION_ORPHAN_CLEANUP_ENABLED = 'false';
  if (kind === 'missing') delete env.COMPLETION_RETIREMENT_SERVICE_TOKEN;
  else env.COMPLETION_RETIREMENT_SERVICE_TOKEN = TOKEN;
  expect(() => app()).toThrow('COMPLETION_RETIREMENT_CREDENTIAL_INVALID');
});

test('enabled formal startup prechecks and listens on loopback with complete resource composition', async () => {
  const server = await startServer({ env, port: 0, host: '127.0.0.1', appLogger: { info: jest.fn() } });
  try {
    expect(server.listening).toBe(true);
    const result = await require('supertest')(server).post('/api/internal/media/references/status').set('x-service-token', TOKEN)
      .send({ references: [] });
    expect(result.status).toBe(400); expect(result.body.error.code).toBe('VALIDATION_ERROR');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('formal operation commit/status/unbind preserves full set and exact generation', async () => {
  const application = app(), { assets, command } = await group(application);
  expect((await internal(application, 'commit', command)).body.data.operation.state).toBe('COMMITTED');
  const before = await Operation.findOne().lean();
  expect((await internal(application, 'status', { ...command, mode: 'operation' })).body.data.references).toHaveLength(2);
  expect(await Operation.findOne().lean()).toEqual(before);
  const { commandHash, ...scope } = command;
  const unbind = { ...scope, references: command.references.map(ref => ({ ...ref, bindingOperationId: command.operationId })) };
  expect((await internal(application, 'unbind', { ...unbind,
    references: unbind.references.map(ref => ({ ...ref, bindingOperationId: randomUUID() })) })).status).toBe(409);
  expect(await Reference.countDocuments({ state: 'bound' })).toBe(2);
  expect((await internal(application, 'unbind', unbind)).status).toBe(200);
  expect(await Reference.countDocuments({ state: 'released', mediaId: { $in: assets.map(a => a._id) } })).toBe(2);
});
test.each(['PREPARED', 'COMMITTED'])('%s deletion uses group transaction and durable exact evidence', async state => {
  const application = app(), { assets, command } = await group(application);
  if (state === 'COMMITTED') expect((await internal(application, 'commit', command)).status).toBe(200);
  expect((await call(application, 'DELETE', '/api/media/' + assets[0]._id, child)).status).toBe(204);
  const tombstone = await Tombstone.findOne().lean();
  expect(String(tombstone.actorId)).toBe(child.id);
  expect((await Asset.findById(assets[0]._id)).privacyDeletionRecorded).toBe(true);
  expect((await Asset.findById(assets[1]._id)).status).toBe('active');
  expect((await Operation.findOne()).state).toBe(state === 'PREPARED' ? 'ABORTED' : 'COMMITTED');
  expect(await Receipt.countDocuments()).toBe(state === 'PREPARED' ? 0 : 1);
  const evidence = JSON.parse(await fs.readFile(path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, assets[0]._id + '.json')));
  expect(evidence.tombstone.mediaId).toBe(String(assets[0]._id));
  if (state === 'COMMITTED') expect(evidence.receipts[0].bindingOperationId).toBe(command.operationId);
  expect((await call(app(), 'DELETE', '/api/media/' + assets[0]._id, second)).status).toBe(204);
  expect(await Tombstone.findOne().lean()).toEqual(tombstone);
});
test.each(['task_attachment', 'mistake_question', 'mistake_answer', 'avatar'])('legacy %s still deletes without completion evidence', async purpose => {
  const application = app(), media = await asset(purpose);
  expect((await call(application, 'DELETE', '/api/media/' + media._id)).status).toBe(204);
  expect((await Asset.findById(media._id)).status).toBe('deleted');
  expect(await Tombstone.countDocuments()).toBe(0); expect(await Operation.countDocuments()).toBe(0);
});
test('legacy material prepare/commit retains old contract in enabled composition', async () => {
  const application = app(), media = await asset('task_attachment');
  const command = { familyId: String(family._id), childId: child.id, resourceType: 'growth_task', resourceId: String(id()),
    operationId: randomUUID(), references: [{ mediaId: String(media._id), field: 'attachmentMediaIds' }] };
  for (const action of ['prepare', 'commit']) expect((await internal(application, action, command)).status).toBe(200);
  expect(await Reference.countDocuments({ state: 'bound' })).toBe(1); expect(await Operation.countDocuments()).toBe(0);
});
test('mixed protocol, missing digest and service credential cannot reach writers', async () => {
  const application = app(), media = await asset();
  const command = { familyId: String(family._id), childId: child.id, resourceType: 'growth_task', resourceId: String(id()),
    operationId: randomUUID(), references: [{ mediaId: String(media._id), field: 'completionMediaIds' }] };
  expect((await internal(application, 'prepare', command, null)).status).toBe(401);
  expect((await internal(application, 'prepare', command)).status).toBe(400);
  expect((await internal(application, 'prepare', { ...command, commandHash: 'a'.repeat(64),
    references: [...command.references, { mediaId: String(id()), field: 'attachmentMediaIds' }] })).status).toBe(400);
  expect(await Reference.countDocuments()).toBe(0); expect(await Operation.countDocuments()).toBe(0);
});
test('foreign and missing objects have the same scoped deletion response; unauthenticated is rejected', async () => {
  const application = app(), media = await asset();
  expect((await call(application, 'DELETE', '/api/media/' + media._id, null)).status).toBe(401);
  const foreignResult = await call(application, 'DELETE', '/api/media/' + media._id, foreign);
  const missing = await call(application, 'DELETE', '/api/media/' + id(), foreign);
  expect(foreignResult.status).toBe(404); expect(foreignResult.body.error).toEqual(missing.body.error);
  expect(await Tombstone.countDocuments()).toBe(0); expect((await Asset.findById(media._id)).status).toBe('active');
});
test('nonempty DELETE body cannot select a different purpose or old deletion handler', async () => {
  const application = app(), media = await asset();
  const result = await call(application, 'DELETE', '/api/media/' + media._id, parent, { purpose: 'task_attachment' });
  expect(result.status).toBe(400); expect(result.body.error.code).toBe('VALIDATION_ERROR');
  expect((await Asset.findById(media._id)).status).toBe('active'); expect(await Tombstone.countDocuments()).toBe(0);
});
test('journal failure is 503, never falls back; retry preserves first deletion audit', async () => {
  const application = app(), { assets, command } = await group(application);
  expect((await internal(application, 'commit', command)).status).toBe(200);
  const link = jest.spyOn(fs, 'link').mockRejectedValueOnce(Error('synthetic-private-path'));
  const result = await call(application, 'DELETE', '/api/media/' + assets[0]._id);
  expect(result.status).toBe(503); expect(result.body.error.code).toBe('MEDIA_REFERENCE_PENDING');
  expect(JSON.stringify(result.body)).not.toContain('synthetic-private-path');
  const tombstone = await Tombstone.findOne().lean(), receipt = await Receipt.findOne().lean();
  link.mockRestore();
  expect((await call(app(), 'DELETE', '/api/media/' + assets[0]._id, second)).status).toBe(204);
  expect(await Tombstone.findOne().lean()).toEqual(tombstone); expect(await Receipt.findOne().lean()).toEqual(receipt);
});
test('after real retention cleanup tombstone-only deletion still uses privacy replay', async () => {
  const application = app(), { assets, command } = await group(application);
  expect((await internal(application, 'commit', command)).status).toBe(200);
  expect((await call(application, 'DELETE', '/api/media/' + assets[0]._id)).status).toBe(204);
  const tombstone = await Tombstone.findOne().lean(), receipt = await Receipt.findOne().lean();
  const cleanup = createCompletionMediaCleanupService({ transactionRunner: createMongoTransactionRunner(mongoose.connection),
    journal: createMediaDeletionJournal({ root: env.COMPLETION_DELETION_JOURNAL_ROOT }), mediaStore: store,
    now: () => Date.now() + 31 * 86400000 });
  expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(1);
  expect(await Asset.findById(assets[0]._id)).toBeNull();
  const foreignResult = await call(app(), 'DELETE', '/api/media/' + assets[0]._id, foreign);
  const absentResult = await call(app(), 'DELETE', '/api/media/' + id(), foreign);
  expect(foreignResult.status).toBe(404); expect(foreignResult.body.error).toEqual(absentResult.body.error);
  expect((await call(app(), 'DELETE', '/api/media/' + assets[0]._id, second)).status).toBe(204);
  expect(await Tombstone.findOne().lean()).toEqual(tombstone); expect(await Receipt.findOne().lean()).toEqual(receipt);
});

test('enabled startup rejects a custom factory instead of serving an unassembled app', async () => {
  const factory = jest.fn(() => require('express')());
  let listener;
  try {
    const pending = startServer({ env, createRuntimeApp: factory, port: 0, host: '127.0.0.1', appLogger: { info: jest.fn() } })
      .then(value => { listener = value; return value; });
    await expect(pending).rejects.toMatchObject({ code: 'COMPLETION_ASSEMBLY_NOT_READY' });
    expect(factory).not.toHaveBeenCalled(); expect(mongoose.connection.readyState).toBe(1);
  } finally { if (listener) await new Promise(resolve => listener.close(resolve)); }
});
test('formal enabled startup refuses bad storage without listening or repairing permissions', async () => {
  await fs.chmod(env.COMPLETION_DELETION_JOURNAL_ROOT, 0o755);
  const listen = jest.spyOn(require('express').application, 'listen');
  await expect(startServer({ env, port: 0, host: '127.0.0.1' })).rejects.toMatchObject({ code: 'COMPLETION_STORAGE_NOT_READY' });
  expect(listen).not.toHaveBeenCalled(); expect(mongoose.connection.readyState).toBe(1);
  expect((await fs.stat(env.COMPLETION_DELETION_JOURNAL_ROOT)).mode & 0o777).toBe(0o755);
});
test('sibling, stale child token and removed co-parent cannot delete completion media', async () => {
  const application = app(), media = await asset();
  const sibling = { ...child, id: String(id()) }; sibling.childId = sibling.id;
  await User.create({ _id: sibling.id, role: 'student', familyId: family._id, childProfile: { tokenVersion: 0 } });
  await Family.updateOne({ _id: family._id }, { $addToSet: { childIds: sibling.id } });
  expect((await call(application, 'DELETE', '/api/media/' + media._id, sibling)).status).toBe(404);
  await User.updateOne({ _id: child.id }, { $set: { 'childProfile.tokenVersion': 1 } });
  const stale = await call(application, 'DELETE', '/api/media/' + media._id, child);
  expect(stale.status).toBe(401); expect(stale.body.error.code).toBe('STALE_CHILD_TOKEN');
  await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: second.id } });
  expect((await call(application, 'DELETE', '/api/media/' + media._id, second)).status).toBe(403);
  expect((await Asset.findById(media._id)).status).toBe('active'); expect(await Tombstone.countDocuments()).toBe(0);
});
test('tombstone wins over conflicting surviving asset purpose and never falls back', async () => {
  const application = app(), media = await asset();
  expect((await call(application, 'DELETE', '/api/media/' + media._id)).status).toBe(204);
  const tombstone = await Tombstone.findOne().lean();
  await Asset.updateOne({ _id: media._id }, { $set: { purpose: 'task_attachment' } });
  const legacyRelease = jest.spyOn(Reference, 'updateMany');
  const response = await call(application, 'DELETE', '/api/media/' + media._id);
  expect(response.status).toBe(409); expect(response.body.error.code).toBe('MEDIA_OPERATION_INCONSISTENT');
  expect(legacyRelease).not.toHaveBeenCalled(); expect(await Tombstone.findOne().lean()).toEqual(tombstone);
});
test('classification database failure is redacted and never falls back to legacy deletion', async () => {
  const application = app(), media = await asset('task_attachment');
  jest.spyOn(Tombstone, 'findOne').mockImplementationOnce(() => { throw Error('synthetic-secret-db-address'); });
  const response = await call(application, 'DELETE', '/api/media/' + media._id);
  expect(response.status).toBe(503); expect(response.body.error.code).toBe('MEDIA_REFERENCE_PENDING');
  expect(JSON.stringify(response.body)).not.toContain('synthetic-secret-db-address');
  expect((await Asset.findById(media._id)).status).toBe('active');
});
test('removed child assets and tombstone-only records are indistinguishable from missing media', async () => {
  const application = app(), retained = await asset(), deleted = await asset();
  expect((await call(application, 'DELETE', '/api/media/' + deleted._id)).status).toBe(204);
  const cleanup = createCompletionMediaCleanupService({ transactionRunner: createMongoTransactionRunner(mongoose.connection),
    journal: createMediaDeletionJournal({ root: env.COMPLETION_DELETION_JOURNAL_ROOT }), mediaStore: store,
    now: () => Date.now() + 31 * 86400000 });
  expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(1);
  await Family.updateOne({ _id: family._id }, { $pull: { childIds: child.id } });
  const responses = [];
  for (const mediaId of [retained._id, deleted._id, id()]) responses.push(await call(application, 'DELETE', '/api/media/' + mediaId));
  expect(responses.map(r => r.status)).toEqual([404, 404, 404]);
  expect(responses[0].body.error).toEqual(responses[2].body.error);
  expect(responses[1].body.error).toEqual(responses[2].body.error);
  expect((await Asset.findById(retained._id)).status).toBe('active'); expect(await Tombstone.countDocuments()).toBe(1);
});
test('parent avatar without a child remains deletable in enabled mode', async () => {
  const application = app(), media = await asset('avatar');
  await Asset.updateOne({ _id: media._id }, { $set: { childId: null } });
  expect((await call(application, 'DELETE', '/api/media/' + media._id)).status).toBe(204);
  expect(await Tombstone.countDocuments()).toBe(0);
});
test('real public deletion response loss replays through reconstructed formal app without changing audit', async () => {
  const application = app(), { assets, command } = await group(application);
  expect((await internal(application, 'commit', command)).status).toBe(200);
  const dropping = require('express')();
  let dropped = false;
  dropping.use((req, res, next) => {
    const end = res.end;
    res.end = function (...args) {
      if (req.method === 'DELETE' && res.statusCode === 204 && !dropped) {
        dropped = true; req.socket.destroy(); return this;
      }
      return end.apply(this, args);
    };
    next();
  });
  dropping.use(application);
  await expect(call(dropping, 'DELETE', '/api/media/' + assets[0]._id)).rejects.toThrow(/socket hang up|ECONNRESET/);
  expect(dropped).toBe(true);
  const tombstone = await Tombstone.findOne().lean(), receipt = await Receipt.findOne().lean();
  const logPath = path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, assets[0]._id + '.json');
  const journalBefore = await fs.readFile(logPath, 'utf8');
  expect((await call(app(), 'DELETE', '/api/media/' + assets[0]._id, second)).status).toBe(204);
  expect(await Tombstone.findOne().lean()).toEqual(tombstone); expect(await Receipt.findOne().lean()).toEqual(receipt);
  expect(await fs.readFile(logPath, 'utf8')).toBe(journalBefore);
});

const createScannerRequestReader = (response, pingResponse, requests) => {
  let buffer = Buffer.alloc(0), command, replied = false;
  return data => {
    if (replied) return null;
    buffer = Buffer.concat([buffer, data]);
    if (!command) {
      const end = buffer.indexOf(0);
      if (end < 0) return null;
      command = buffer.subarray(0, end).toString(); buffer = buffer.subarray(end + 1);
      if (!['zPING', 'zINSTREAM'].includes(command)) throw new Error('Unexpected scanner command');
      if (command === 'zPING') {
        replied = true; requests.push(command); return pingResponse + '\0';
      }
    }
    while (buffer.length >= 4) {
      const length = buffer.readUInt32BE(0);
      if (buffer.length < 4 + length) return null;
      buffer = buffer.subarray(4 + length);
      if (length === 0) { replied = true; requests.push(command); return response + '\0'; }
    }
    return null;
  };
};
test.each(['zPING', 'zINSTREAM'])('scanner fixture waits for every fragmented %s frame and replies once', command => {
  const requests = [], read = createScannerRequestReader('stream: OK', 'PONG', requests);
  const payload = command === 'zPING' ? Buffer.from(command + '\0')
    : Buffer.concat([Buffer.from(command + '\0'), Buffer.from([0, 0, 0, 3]), Buffer.from('abc'), Buffer.alloc(4)]);
  for (let index = 0; index < payload.length - 1; index += 1) {
    expect(read(payload.subarray(index, index + 1))).toBeNull(); expect(requests).toEqual([]);
  }
  expect(read(payload.subarray(-1))).toBe((command === 'zPING' ? 'PONG' : 'stream: OK') + '\0');
  expect(read(Buffer.alloc(4))).toBeNull(); expect(requests).toEqual([command]);
  expect(read(payload)).toBeNull(); expect(requests).toEqual([command]);
});
const startScanner = async (response, pingResponse = 'PONG') => {
  const sockets = new Set();
  const requests = [];
  const server = require('net').createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => socket.destroy());
    const read = createScannerRequestReader(response, pingResponse, requests);
    socket.on('data', data => {
      try { const reply = read(data); if (reply !== null) socket.end(reply); }
      catch { socket.destroy(); }
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { requests, env: { ...env, MEDIA_SECURITY_PROFILE: 'secure-production', CLAMAV_HOST: '127.0.0.1', CLAMAV_PORT: String(server.address().port) },
    close: async () => { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); } };
};
test.each(['trusted-local', 'secure-production'])('%s formal uploads retain security audit and private image access', async profile => {
  const scanner = profile === 'secure-production' ? await startScanner('stream: OK') : null;
  let listener;
  try {
    if (scanner) listener = await startServer({ env: scanner.env, port: 0, host: '127.0.0.1', appLogger: { info: jest.fn() } });
    const client = listener ? require('supertest')(listener) : await request(app());
    const bytes = await require('sharp')({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const headers = createIdentityHeaders({ method: 'POST', originalUrl: '/api/media', user: child, secret: process.env.GATEWAY_IDENTITY_SECRET });
    const result = await client.post('/api/media').set(headers).field('purpose', 'task_completion')
      .attach('file', bytes, 'synthetic.png');
    expect(result.status).toBe(201);
    const stored = await Asset.findById(result.body.data.media.mediaId).lean();
    expect(stored.malwareScanStatus).toBe(scanner ? 'clean' : 'skipped_trusted_local');
    if (scanner) expect(scanner.requests).toEqual(['zPING', 'zINSTREAM']);
    expect((await client.get('/uploads/' + stored.storageKey)).status).toBe(404);
    const health = await client.get('/health');
    expect(health.status).toBe(200); expect(health.body.mediaSecurity.profile).toBe(profile);
  } finally {
    if (listener) await new Promise(resolve => listener.close(resolve));
    if (scanner) await scanner.close();
  }
});
test.each([['stream: Synthetic FOUND', 422, 'MALWARE_DETECTED'], ['synthetic-unavailable', 503, 'MALWARE_SCANNER_UNAVAILABLE']])(
  'secure-production scan response %s rejects without creating an asset', async (reply, status, code) => {
  const scanner = await startScanner(reply);
  try {
    const application = createProductionApp({ env: scanner.env });
    const bytes = await require('sharp')({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const headers = createIdentityHeaders({ method: 'POST', originalUrl: '/api/media', user: child, secret: process.env.GATEWAY_IDENTITY_SECRET });
    const result = await (await request(application)).post('/api/media').set(headers).field('purpose', 'task_completion')
      .attach('file', bytes, 'synthetic.png');
    expect(result.status).toBe(status); expect(result.body.error.code).toBe(code);
    expect(scanner.requests).toEqual(['zINSTREAM']);
    expect(await Asset.countDocuments()).toBe(0); expect(await fs.readdir(path.join(env.PRIVATE_MEDIA_ROOT, '.incoming'))).toEqual([]);
    expect(await fs.readdir(env.PRIVATE_MEDIA_ROOT)).toEqual(['.incoming']);
  } finally { await scanner.close(); }
});
test('secure-production ping failure refuses listener and closes owned database connection', async () => {
  const scanner = await startScanner('stream: OK', 'INVALID');
  await mongoose.connection.close();
  const listen = jest.spyOn(require('express').application, 'listen');
  try {
    await expect(startServer({ env: scanner.env, port: 0, host: '127.0.0.1' }))
      .rejects.toMatchObject({ code: 'COMPLETION_STARTUP_FAILED', message: 'COMPLETION_STARTUP_FAILED' });
    expect(listen).not.toHaveBeenCalled(); expect(mongoose.connection.readyState).toBe(0);
    expect(scanner.requests).toEqual(['zPING']);
  } finally {
    await scanner.close(); await mongoose.connect(mongo.getUri(), { autoIndex: false, autoCreate: false });
  }
});
test('formal enabled PDF upload keeps attachment purpose restriction and download headers', async () => {
  const application = app(), pdf = await require('pdf-lib').PDFDocument.create(); pdf.addPage();
  const bytes = Buffer.from(await pdf.save({ addDefaultPage: false, useObjectStreams: false }));
  const upload = async purpose => {
    const headers = createIdentityHeaders({ method: 'POST', originalUrl: '/api/media', user: parent, secret: process.env.GATEWAY_IDENTITY_SECRET });
    return (await request(application)).post('/api/media').set(headers).field('purpose', purpose).field('childId', child.id)
      .attach('file', bytes, 'synthetic.pdf');
  };
  const result = await upload('task_attachment'); expect(result.status).toBe(201);
  expect((await upload('task_completion')).status).toBe(400);
  const access = await call(application, 'GET', '/api/media/' + result.body.data.media.mediaId + '/access');
  const download = await (await request(application)).get(access.body.data.access.url);
  expect(download.status).toBe(200); expect(download.headers['content-type']).toContain('application/pdf');
  expect(download.headers['content-disposition']).toMatch(/^attachment;/);
});
test('enabled keeps access/content signed and private while maintenance blocks bytes', async () => {
  const application = app(), media = await asset('task_attachment');
  const access = await call(application, 'GET', '/api/media/' + media._id + '/access');
  expect(access.status).toBe(200);
  const url = access.body.data.access.url;
  const content = await (await request(application)).get(url);
  expect(content.status).toBe(200); expect(content.headers['cache-control']).toBe('private, no-store');
  const maintenance = createProductionApp({ env: { ...env, COMPLETION_PROTOCOL_MODE: 'maintenance' } });
  expect((await (await request(maintenance)).get(url)).status).toBe(503);
  expect((await (await request(application)).get('/api/media/' + media._id + '/content')).status).toBe(400);
});

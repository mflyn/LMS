process.env.GATEWAY_IDENTITY_SECRET = 'synthetic-gateway-secret-at-least-32-characters';
process.env.JWT_SECRET = 'synthetic-jwt-secret-at-least-32-characters';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/synthetic-unused';
jest.mock('../../../common/config/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }));
const { randomUUID } = require('crypto');
const express = require('express');
const http = require('http');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const sharp = require('sharp');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createHttpTestHarness } = require('../../../common/test/httpTestHarness');
const { authenticateGateway } = require('../../../common/middleware/auth');
const { createIdentityHeaders, resetIdentityNonceStore } = require('../../../common/middleware/gatewayIdentity');
const Family = require('../../../common/models/Family');
const User = require('../models/FamilyUser');
const Asset = require('../models/MediaAsset');
const Reference = require('../models/MediaReference');
const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');
const Guard = require('../models/CompletionUploadGuard');
const Operation = require('../models/MediaReferenceOperation');
const { createMediaService } = require('../services/mediaService');
const { createMediaRouter } = require('../routes/media');
const { createAi3MediaInspectRouter } = require('../routes/ai3MediaInspect');
const { createMediaReferenceProtocolRouter } = require('../routes/mediaReferenceProtocolRouter');
const { createMediaReferenceCredential } = require('../middleware/mediaReferenceCredential');
const { createPrivateMediaUpload } = require('../middleware/privateMediaUpload');
const { createPrivateMediaStore } = require('../services/privateMediaStore');
const { createMediaCapabilityService } = require('../services/mediaCapability');
const { createCompletionUploadService } = require('../services/completionUploadService');
const { createCompletionUploadJournal } = require('../services/completionUploadJournal');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const { createAi3MediaAccessClient } = require('../services/ai3MediaAccessClient');
const { createCompletionMediaReferenceClient } = require('../../../common/services/completionMediaReferenceClient');
const { createCompletionMediaPrivacyService } = require('../services/completionMediaPrivacyService');
const { createCompletionMediaCleanupService } = require('../services/completionMediaCleanupService');
const { createMediaDeletionJournal } = require('../services/mediaDeletionJournal');
const { createMediaDeletionDispatcher } = require('../services/mediaDeletionDispatcher');
const { createMediaReferenceOperationService } = require('../services/mediaReferenceOperationService');

jest.setTimeout(60000);
const { request, close } = createHttpTestHarness();
const id = () => new mongoose.Types.ObjectId();
const token = 'synthetic-media-reference-token-at-least-32-characters';
const continuous = () => {};
let mongo, root, store, runner, remoteServer, resourceServer, accessClient, completionClient, capabilities;
let app, service, operations, privacy, cleanup, child, sibling, parent, family, mode, now, png, allowed, received;
const errors = (error, req, res, next) => { // eslint-disable-line no-unused-vars
  res.status(error.statusCode || error.status || 500).json({ code: error.code || 'INTERNAL_ERROR' });
};
const build = (options = {}, continuity = continuous) => {
  service = createMediaService({ MediaAssetModel: Asset, MediaReferenceModel: Reference, FamilyModel: Family,
    UserModel: User, mediaStore: store, transactionRunner: runner, capabilityService: capabilities,
    completionUploadService: createCompletionUploadService({ transactionRunner: runner, mediaStore: store,
      ai3Mode: () => mode, journal: createCompletionUploadJournal({ root: path.join(root, 'uploads') }) }),
    getAi3Mode: () => mode, ai3MediaAccessClient: accessClient, assertAi3Continuous: continuity, ...options });
  app = express(); app.locals.userModel = User;
  const deleteMedia = createMediaDeletionDispatcher({ mediaService: service, privacyService: privacy,
    assertAi3Continuous: continuity });
  app.use('/api/media', createMediaRouter({ authenticate: authenticateGateway, mediaService: { ...service, deleteMedia },
    upload: createPrivateMediaUpload({ privateRoot: path.join(root, 'media') }) }));
  app.use('/api/internal/media/ai3', createAi3MediaInspectRouter({ serviceToken: token, mediaService: service,
    assertAi3Continuous: continuity }));
  app.use(express.json());
  const legacy = { prepare: async () => { throw Error('legacy must not handle AI3'); },
    commit: async () => { throw Error('legacy must not handle AI3'); }, unbind: async () => { throw Error('legacy must not handle AI3'); } };
  app.use('/api/internal/media/references', createMediaReferenceProtocolRouter({ credential: createMediaReferenceCredential(token),
    referenceService: legacy, operationService: Object.fromEntries(['prepare', 'commit', 'status', 'abort', 'unbind']
      .map(action => [action, input => operations[action](input)])), assertAi3Continuous: continuity }));
  app.use(errors);
};
const identityHeaders = (method, url, identity) => createIdentityHeaders({ method, originalUrl: url,
  user: identity, secret: process.env.GATEWAY_IDENTITY_SECRET });
const get = async (url, identity) => {
  const pending = (await request(app)).get(url);
  return identity ? pending.set(identityHeaders('GET', url, identity)) : pending;
};
const upload = async (identity = child, bytes = png, mime = 'image/png', purpose = 'ai3_practice', childId) => {
  let pending = (await request(app)).post('/api/media').set(identityHeaders('POST', '/api/media', identity)).field('purpose', purpose);
  if (childId) pending = pending.field('childId', childId);
  return pending.attach('file', bytes, { filename: 'synthetic-image', contentType: mime });
};
const uploaded = async () => {
  const response = await upload(); expect(response.status).toBe(201);
  return Asset.findById(response.body.data.media.mediaId).lean();
};
const command = media => ({ familyId: String(family), childId: child.id, resourceType: 'ai3_attempt', resourceId: String(id()),
  remoteOperationId: randomUUID(), commandHash: 'a'.repeat(64), references: [{ mediaId: String(media._id), field: 'practiceMediaIds' }] });
const bind = async media => {
  const c = command(media); await completionClient.prepare(c); await completionClient.commit(c); return c;
};
const inspection = (media, c) => ({ familyId: String(family), childId: child.id, identity: parent,
  mediaIds: [String(media._id)], bindings: [{ ...c.references[0], resourceType: c.resourceType,
    resourceId: c.resourceId, bindingOperationId: c.remoteOperationId }] });
const status = c => completionClient.status({ ...c, mode: 'operation' });
const unbind = c => {
  const { commandHash, remoteOperationId, ...rest } = c; // eslint-disable-line no-unused-vars
  return completionClient.unbind({ ...rest, remoteOperationId: randomUUID(),
    references: c.references.map(ref => ({ ...ref, bindingOperationId: remoteOperationId })) });
};
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri()); runner = createMongoTransactionRunner(mongoose.connection);
  for (const model of [Asset, Reference, Tombstone, Receipt, Guard, Operation, Family, User]) await model.init();
  png = await sharp({ create: { width: 6, height: 6, channels: 3, background: '#338855' } }).png().toBuffer();
  const remote = express(); remote.use(express.json());
  remote.post('/api/internal/ai3/media-access-check', (req, res) => {
    received.push(req.body);
    if (req.headers['x-service-token'] !== token) return res.sendStatus(401);
    res.json({ success: true, data: { allowed } });
  });
  remoteServer = http.createServer(remote);
  await new Promise(resolve => remoteServer.listen(0, '127.0.0.1', resolve));
  accessClient = createAi3MediaAccessClient({ homeworkServiceUrl: `http://127.0.0.1:${remoteServer.address().port}`, serviceToken: token });
  resourceServer = http.createServer((req, res) => app(req, res));
  await new Promise(resolve => resourceServer.listen(0, '127.0.0.1', resolve));
  completionClient = createCompletionMediaReferenceClient({ resourceServiceUrl: `http://127.0.0.1:${resourceServer.address().port}`, serviceToken: token });
  capabilities = createMediaCapabilityService({ secret: 'synthetic-media-signing-key-at-least-32-characters' });
});
beforeEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'ai3-media-http-')));
  store = createPrivateMediaStore({ root: path.join(root, 'media') });
  family = id(); const childId = id(), parentId = id(), siblingId = id();
  child = { id: String(childId), childId: String(childId), familyId: String(family), role: 'student', tokenVersion: 0 };
  sibling = { ...child, id: String(siblingId), childId: String(siblingId) }; parent = { id: String(parentId), role: 'parent' };
  await Family.create({ _id: family, familyName: 'Synthetic', ownerParentId: parentId, memberParentIds: [parentId], childIds: [childId, siblingId] });
  await User.create([{ _id: parentId, role: 'parent' }, { _id: childId, familyId: family, role: 'student', childProfile: { tokenVersion: 0 } },
    { _id: siblingId, familyId: family, role: 'student', childProfile: { tokenVersion: 0 } }]
    .map(user => ({ ...user, username: `synthetic-${user._id}`, email: `${user._id}@example.invalid` })));
  mode = 'enabled'; now = Date.now(); received = []; allowed = true; resetIdentityNonceStore();
  operations = createMediaReferenceOperationService({ transactionRunner: runner, ai3Mode: () => mode });
  const journal = createMediaDeletionJournal({ root: path.join(root, 'deletions') });
  privacy = createCompletionMediaPrivacyService({ transactionRunner: runner, journal, now: () => now, assertAi3Continuous: continuous });
  cleanup = createCompletionMediaCleanupService({ transactionRunner: runner, journal, mediaStore: store, now: () => now,
    assertAi3Continuous: continuous });
  build();
});
afterEach(async () => { await close(); if (root) await fs.rm(root, { recursive: true, force: true }); });
afterAll(async () => {
  for (const server of [remoteServer, resourceServer]) if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect(); if (mongo) await mongo.stop();
});

test.each(['jpeg', 'png', 'webp'])('AI3 child %s upload registers real guard and canonical bytes', async format => {
  const response = await upload(child, await sharp(png).toFormat(format).toBuffer(), `image/${format}`);
  expect(response.status).toBe(201); const media = await Asset.findById(response.body.data.media.mediaId).lean();
  expect(media.purpose).toBe('ai3_practice'); expect(String(media.uploadedBy)).toBe(child.id);
  expect(await Guard.exists({ mediaId: media._id, state: 'REGISTERED' })).toBeTruthy();
  expect((await sharp(await store.read(media.storageKey)).metadata()).format).toBe(format);
  expect(media.retentionPolicyVersion).toBeUndefined();
});
test('default factories refuse retained AI3 without continuity; off with explicit continuity retains history', async () => {
  const media = await uploaded(), c = await bind(media), url = `/api/media/${media._id}/access`;
  build({ assertAi3Continuous: undefined });
  expect((await get(url, child)).body.code).toBe('AI3_NOT_READY');
  expect((await upload()).body.code).toBe('AI3_NOT_READY');
  const rejected = createMediaDeletionDispatcher({ mediaService: service, privacyService: privacy });
  await expect(rejected({ identity: child, mediaId: String(media._id) })).rejects.toMatchObject({ code: 'AI3_NOT_READY' });
  const isolated = express(); isolated.use(express.json());
  isolated.use(createMediaReferenceProtocolRouter({ credential: createMediaReferenceCredential(token), operationService: operations,
    referenceService: { prepare() {}, commit() {}, unbind() {} } })); isolated.use(errors);
  const { remoteOperationId, ...wire } = c;
  for (const action of ['prepare', 'commit', 'status', 'abort', 'unbind']) {
    const response = await (await request(isolated)).post(`/${action}`).set('x-service-token', token)
      .send({ ...wire, operationId: remoteOperationId, ...(action === 'status' ? { mode: 'operation' } : {}) });
    expect(response.body.code).toBe('AI3_NOT_READY');
  }
  build(); mode = 'off'; expect((await get(url, child)).status).toBe(200);
  expect((await status(c)).operation.state).toBe('COMMITTED');
  expect((await upload()).body.code).toBe('AI3_DISABLED');
});
test('AI2 enabled cannot enable default AI3 writes', async () => {
  const media = await uploaded(), c = command(media);
  operations = createMediaReferenceOperationService({ transactionRunner: runner, ai2Mode: () => 'enabled' });
  await expect(completionClient.prepare(c)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect(await Operation.countDocuments()).toBe(0);
  build({ getAi3Mode: undefined, getAi2Mode: () => 'enabled' });
  expect((await upload()).body.code).toBe('AI3_DISABLED');
  build({ completionUploadService: undefined }); expect((await upload()).body.code).toBe('MEDIA_SERVICE_UNAVAILABLE');
});
test('parent proxy, cross child, PDF, HEIC, malformed and oversized bytes have no persistence', async () => {
  expect((await upload(parent, png, 'image/png', 'ai3_practice', child.id)).status).toBe(403);
  expect((await upload(child, png, 'image/png', 'ai3_practice', sibling.id)).status).toBe(403);
  for (const bytes of [Buffer.from('%PDF-synthetic'), Buffer.from('not-image'), Buffer.from('0000ftypheic')]) {
    expect((await upload(child, bytes)).status).toBe(400);
  }
  expect((await upload(child, png, 'image/jpeg')).status).toBe(400);
  expect((await upload(child, Buffer.alloc(10 * 1024 * 1024 + 1))).status).toBe(413);
  expect(await Asset.countDocuments()).toBe(0); expect(await Guard.countDocuments()).toBe(0);
  expect(await fs.readdir(path.join(root, 'media', '.incoming'))).toEqual([]);
});
test('10MiB boundary and secure profile are enforced; mode change during scan blocks persistence', async () => {
  const bytes = Buffer.alloc(10 * 1024 * 1024); png.copy(bytes);
  expect((await upload(child, bytes)).status).toBe(201);
  build({ securityProfile: 'secure-production', scanner: { scan: async () => { mode = 'off'; } } });
  expect((await upload()).body.code).toBe('AI3_DISABLED'); expect(await Asset.countDocuments()).toBe(1);
});
test('own draft only, signed session plus capability, then live homework visibility for both roles', async () => {
  const media = await uploaded(), url = `/api/media/${media._id}/access`;
  const access = (await get(url, child)).body.data.access;
  expect(access.requiresAuthorization).toBe(true); expect((await get(access.url)).status).toBe(401);
  expect((await get(access.url, child)).status).toBe(200); expect(received).toEqual([]);
  expect((await get(url, parent)).status).toBe(404); expect((await get(url, sibling)).status).toBe(403);
  expect((await get(capabilities.issue(String(media._id)).url)).status).toBe(404);
  const c = await bind(media); expect((await get(access.url, child)).status).toBe(200);
  expect(received[0]).toEqual({ familyId: String(family), childId: child.id, actorId: child.id, role: 'student',
    mediaId: String(media._id), bindings: [{ attemptId: c.resourceId, bindingOperationId: c.remoteOperationId }] });
  expect((await get(url, parent)).status).toBe(200); allowed = false;
  expect((await get(access.url, child)).status).toBe(404); expect((await get(url, parent)).status).toBe(404);
  allowed = 'true'; expect((await get(url, child)).status).toBe(503);
});
test.each(['prepared', 'released'])('%s history never becomes a draft preview', async state => {
  const media = await uploaded(), c = command(media); await completionClient.prepare(c);
  if (state === 'released') await completionClient.abort(c);
  expect((await get(`/api/media/${media._id}/access`, child)).status).toBe(404); expect(received).toEqual([]);
});
test.each(['PIN reset', 'withdraw', 'delete'])('AI3 rechecks %s after asynchronous byte read', async change => {
  const media = await uploaded(); await bind(media);
  const access = (await get(`/api/media/${media._id}/access`, child)).body.data.access;
  let entered, release;
  const reading = new Promise(resolve => { entered = resolve; });
  const paused = new Promise(resolve => { release = resolve; });
  const read = store.read.bind(store);
  build({ mediaStore: { ...store, read: async key => { const bytes = await read(key); entered(); await paused; return bytes; } } });
  const pending = get(access.url, child); await reading;
  try {
    if (change === 'PIN reset') await User.updateOne({ _id: child.id }, { $inc: { 'childProfile.tokenVersion': 1 } });
    if (change === 'withdraw') allowed = false;
    if (change === 'delete') await privacy.deleteMedia({ identity: child, mediaId: String(media._id) });
  } finally { release(); }
  const response = await pending; expect(response.status).toBe(change === 'PIN reset' ? 403 : 404);
  expect(response.body).not.toEqual(png);
});
test.each(['PIN reset', 'delete', 'unbind'])('final homework check cannot conceal local %s', async change => {
  const media = await uploaded(), c = await bind(media);
  const access = (await get(`/api/media/${media._id}/access`, child)).body.data.access;
  let enter, release, checks = 0;
  const entered = new Promise(resolve => { enter = resolve; });
  const paused = new Promise(resolve => { release = resolve; });
  build({ ai3MediaAccessClient: { check: async () => {
    if (++checks === 2) { enter(); await paused; }
    return true;
  } } });
  const pending = get(access.url, child); await entered;
  try {
    if (change === 'PIN reset') await User.updateOne({ _id: child.id }, { $inc: { 'childProfile.tokenVersion': 1 } });
    if (change === 'delete') await privacy.deleteMedia({ identity: child, mediaId: String(media._id) });
    if (change === 'unbind') await unbind(c);
  } finally { release(); }
  expect((await pending).status).toBe(change === 'PIN reset' ? 403 : 404);
  expect(checks).toBe(2);
});

test.each(['single PIN reset', 'single delete', 'single unbind', 'batch PIN reset', 'batch delete', 'batch unbind'])(
  'inspection final snapshot rejects %s while the last byte read is pending', async change => {
    const first = await uploaded(), firstCommand = await bind(first);
    const input = { ...inspection(first, firstCommand), identity: child };
    let last = first;
    if (change.startsWith('batch')) {
      last = await uploaded(); const next = inspection(last, await bind(last));
      input.mediaIds.push(...next.mediaIds); input.bindings.push(...next.bindings);
    }
    let enter, release, reads = 0;
    const entered = new Promise(resolve => { enter = resolve; });
    const paused = new Promise(resolve => { release = resolve; });
    const read = store.read.bind(store);
    build({ mediaStore: { ...store, read: async key => {
      reads++; const bytes = await read(key);
      if (key === last.storageKey) { enter(); await paused; }
      return bytes;
    } } });
    const pending = service.inspectAi3(input);
    const result = expect(pending).rejects.toMatchObject({ statusCode: change.endsWith('PIN reset') ? 403 : 404 });
    await entered;
    try {
      if (change.endsWith('PIN reset')) await User.updateOne({ _id: child.id }, { $inc: { 'childProfile.tokenVersion': 1 } });
      if (change.endsWith('delete')) await privacy.deleteMedia({ identity: child, mediaId: String(first._id) });
      if (change.endsWith('unbind')) await unbind(firstCommand);
    } finally { release(); }
    await result;
    expect(reads).toBe(input.mediaIds.length); expect(received).toEqual([]);
  });
test('multiple exact attempts, stale unbind, privacy receipts, real cleanup and inspect preserve immutable metadata', async () => {
  const media = await uploaded(), first = await bind(media), second = await bind(media);
  expect((await status(first)).operation.state).toBe('COMMITTED');
  await unbind(first);
  const next = { ...first, remoteOperationId: randomUUID() };
  await completionClient.prepare(next); await completionClient.commit(next);
  await expect(unbind(first)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  const input = inspection(media, next);
  expect((await service.inspectAi3(input))[0].status).toBe('available');
  await expect(service.inspect(input)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  const route = '/api/internal/media/ai3/inspect';
  expect((await (await request(app)).post(route).send(input)).status).toBe(401);
  expect((await (await request(app)).post(route).set('x-service-token', token).send(input)).body.data.items[0].status).toBe('available');
  await privacy.deleteMedia({ identity: child, mediaId: String(media._id) });
  expect(await Receipt.countDocuments({ mediaId: media._id })).toBe(2);
  expect(await Receipt.exists({ mediaId: media._id, bindingOperationId: first.remoteOperationId })).toBeNull();
  mode = 'off'; now += 30 * 86400000;
  expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(1);
  expect(await Asset.findById(media._id)).toBeNull(); expect(await Reference.countDocuments()).toBe(0);
  const item = { mediaId: String(media._id), mimeType: media.mimeType, sizeBytes: media.sizeBytes, status: 'deleted' };
  expect(await service.inspectAi3(input)).toEqual([item]);
  expect(await service.inspectAi3(inspection(media, second))).toEqual([item]);
  await expect(service.inspectAi3(inspection(media, first))).rejects.toMatchObject({ statusCode: 404 });
  const evidence = JSON.parse(await fs.readFile(path.join(root, 'deletions', `${media._id}.json`), 'utf8'));
  expect(evidence.tombstone).toMatchObject({ purpose: 'ai3_practice', mimeType: media.mimeType, sizeBytes: media.sizeBytes });
  expect((await status(next)).references[0]).toMatchObject({ state: 'absent', privacyDeletion: { bindingOperationId: next.remoteOperationId } });
  await Receipt.deleteMany({ mediaId: media._id });
  await expect(service.inspectAi3(input)).rejects.toMatchObject({ statusCode: 404 });
});
test('cross-triple purpose and wrong uploader never commit; off permits safe abort only', async () => {
  const media = await uploaded(), c = command(media);
  await Asset.updateOne({ _id: media._id }, { $set: { purpose: 'ai2_correction' } });
  expect((await completionClient.prepare(c)).operation.failureCode).toBe('MEDIA_PURPOSE_MISMATCH');
  await Asset.updateOne({ _id: media._id }, { $set: { purpose: 'ai3_practice', uploadedBy: parent.id } });
  expect((await completionClient.prepare({ ...c, remoteOperationId: randomUUID() })).operation.failureCode).toBe('MEDIA_PURPOSE_MISMATCH');
  await Asset.updateOne({ _id: media._id }, { $set: { uploadedBy: child.id } });
  const fresh = { ...c, remoteOperationId: randomUUID() }; await completionClient.prepare(fresh); mode = 'off';
  await expect(completionClient.commit(fresh)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect((await completionClient.abort(fresh)).operation.state).toBe('ABORTED');
  expect((await unbind(fresh)).references[0].state).toBe('released');
});

test('ten unique images commit as one group; invalid group shapes are rejected over HTTP', async () => {
  const media = await uploaded(), c = command(media);
  for (let i = 1; i < 10; i++) c.references.push({ mediaId: String((await uploaded())._id), field: 'practiceMediaIds' });
  const { remoteOperationId, ...rest } = c;
  for (const references of [[], Array(11).fill(c.references[0]), [null], [c.references[0], c.references[0]],
    [{ ...c.references[0], field: 'correctionMediaIds' }]]) {
    const response = await (await request(app)).post('/api/internal/media/references/prepare').set('x-service-token', token)
      .send({ ...rest, operationId: remoteOperationId, references });
    expect(response.status).toBe(400);
  }
  expect(await Operation.countDocuments()).toBe(0);
  await completionClient.prepare(c); expect((await completionClient.commit(c)).references).toHaveLength(10);
  expect(await Reference.countDocuments({ state: 'bound' })).toBe(10);
});

test('default deletion and cleanup refuse AI3; explicit synthetic continuity never enables advanced restore', async () => {
  const media = await uploaded(); await bind(media);
  const journal = createMediaDeletionJournal({ root: path.join(root, 'deletions') });
  const options = { transactionRunner: runner, journal, now: () => now, mediaStore: store };
  const plain = createCompletionMediaPrivacyService(options);
  await expect(plain.deleteMedia({ identity: child, mediaId: String(media._id) })).rejects.toMatchObject({ statusCode: 503 });
  expect(await Tombstone.countDocuments()).toBe(0);
  const persist = jest.fn(), recoveryJournal = { read: async () => null, persist };
  const advanced = createCompletionMediaPrivacyService({ ...options, assertAi3Continuous: continuous, recoveryJournal });
  await expect(advanced.deleteMedia({ identity: child, mediaId: String(media._id) })).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect(persist).not.toHaveBeenCalled(); expect(await Tombstone.countDocuments()).toBe(0);
  await expect(privacy.deleteMedia({ identity: sibling, mediaId: String(media._id) })).rejects.toMatchObject({ statusCode: 403 });
  await privacy.deleteMedia({ identity: child, mediaId: String(media._id) }); now += 31 * 86400000;
  await expect(createCompletionMediaCleanupService(options).cleanupDeletedMedia()).rejects.toMatchObject({ code: 'AI3_NOT_READY' });
  const advancedCleanup = createCompletionMediaCleanupService({ ...options, assertAi3Continuous: continuous,
    mediaStore: { ...store, syncDirectory: async () => {} }, recoveryJournal });
  await expect(advancedCleanup.cleanupDeletedMedia()).rejects.toMatchObject({ code: 'MEDIA_OPERATION_INCONSISTENT' });
  expect(await Asset.findById(media._id)).not.toBeNull(); expect(await store.read(media.storageKey)).toBeTruthy();
});

test('legacy cleanup does not purge AI3 even with missing privacy flags', async () => {
  const media = await uploaded(); now += 31 * 86400000;
  await Asset.updateOne({ _id: media._id }, { $set: { status: 'deleted', deletedAt: new Date(now - 31 * 86400000) } });
  const { createMediaCleanupService } = require('../services/mediaCleanupService');
  expect((await createMediaCleanupService({ mediaStore: store, now: () => now }).cleanupDeletedMedia()).cleaned).toBe(0);
  expect(await Asset.findById(media._id)).not.toBeNull(); expect(await store.read(media.storageKey)).toBeTruthy();
});

test('AI3 readiness validates guards and exact receipts without enabling orphan retention', async () => {
  const { assertCompletionReferenceReadiness } = require('../services/completionReferenceReadiness');
  const { assertCompletionRetentionReadiness } = require('../services/completionRetentionReadiness');
  const { assertCompletionPrivacyReadiness } = require('../services/completionPrivacyReadiness');
  const Retirement = require('../models/MediaOrphanRetirement'); await Retirement.init();
  const options = { connection: mongoose.connection, writesPaused: true };
  const media = await uploaded(); await bind(media);
  expect((await assertCompletionReferenceReadiness(options)).ready).toBe(true);
  expect((await assertCompletionRetentionReadiness(options)).ready).toBe(true);
  await Asset.updateOne({ _id: media._id }, { $set: { retentionPolicyVersion: 1, orphanEligibleAt: new Date() } });
  await expect(assertCompletionRetentionReadiness(options)).rejects.toMatchObject({ code: 'COMPLETION_RETENTION_NOT_READY' });
  await Asset.updateOne({ _id: media._id }, { $unset: { retentionPolicyVersion: '', orphanEligibleAt: '' } });
  await privacy.deleteMedia({ identity: child, mediaId: String(media._id) });
  expect((await assertCompletionReferenceReadiness(options)).ready).toBe(true);
  expect((await assertCompletionPrivacyReadiness(options)).ready).toBe(true);
  await Tombstone.collection.updateOne({ mediaId: media._id }, { $unset: { mimeType: '' } });
  await expect(assertCompletionPrivacyReadiness(options)).rejects.toMatchObject({ code: 'COMPLETION_PRIVACY_NOT_READY' });
});

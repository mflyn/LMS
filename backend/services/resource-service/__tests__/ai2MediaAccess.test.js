process.env.GATEWAY_IDENTITY_SECRET = 'synthetic-gateway-secret-at-least-32-characters';
process.env.JWT_SECRET = 'synthetic-jwt-secret-at-least-32-characters';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/synthetic-unused';
jest.mock('../../../common/config/logger', () => ({ createLogger: () => ({
  debug() {}, info() {}, warn() {}, error() {}
}) }));

const crypto = require('crypto');
const express = require('express');
const fs = require('fs/promises');
const http = require('http');
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
const Ai2 = require('../../homework-service/models/Ai2');
const { hash, normalize, requestHash } = require('../../homework-service/services/ai2Contract');
const { createAi2MediaAccessRouter, checkAi2MediaAccess } = require('../../homework-service/routes/ai2MediaAccess');
const { createMediaService } = require('../services/mediaService');
const { createMediaRouter } = require('../routes/media');
const { createPrivateMediaUpload } = require('../middleware/privateMediaUpload');
const { createPrivateMediaStore } = require('../services/privateMediaStore');
const { createMediaCapabilityService } = require('../services/mediaCapability');
const { createCompletionUploadService } = require('../services/completionUploadService');
const { createCompletionUploadJournal } = require('../services/completionUploadJournal');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const { createAi2MediaAccessClient } = require('../services/ai2MediaAccessClient');
const { createCompletionMediaPrivacyService } = require('../services/completionMediaPrivacyService');
const { createCompletionMediaCleanupService } = require('../services/completionMediaCleanupService');
const { createMediaDeletionJournal } = require('../services/mediaDeletionJournal');
const { createMediaReferenceOperationService } = require('../services/mediaReferenceOperationService');

jest.setTimeout(60000);
const { request, close } = createHttpTestHarness();
const id = () => new mongoose.Types.ObjectId();
const token = 'synthetic-media-reference-token-at-least-32-characters';
let mongo, root, store, runner, server, client, capabilities, app, service, child, sibling, parent, family;
let mode, remoteCheck, received, png;
const errors = (error, req, res, next) => { // eslint-disable-line no-unused-vars
  res.status(error.statusCode || error.status || 500).json({ code: error.code || 'INTERNAL_ERROR' });
};
const build = (options = {}) => {
  service = createMediaService({ MediaAssetModel: Asset, MediaReferenceModel: Reference, FamilyModel: Family,
    UserModel: User, mediaStore: store, transactionRunner: runner, capabilityService: capabilities,
    completionUploadService: createCompletionUploadService({ transactionRunner: runner, mediaStore: store, ai2Mode: () => mode,
      journal: createCompletionUploadJournal({ root: path.join(root, 'journal') }) }),
    getAi2Mode: () => mode, ai2MediaAccessClient: client, ...options });
  app = express();
  app.locals.userModel = User;
  app.use('/api/media', createMediaRouter({ authenticate: authenticateGateway, mediaService: service,
    upload: createPrivateMediaUpload({ privateRoot: path.join(root, 'media') }) }));
  app.use(errors);
};
const get = async (url, identity) => {
  const pending = (await request(app)).get(url);
  return identity ? pending.set(createIdentityHeaders({ method: 'GET', originalUrl: url,
    user: identity, secret: process.env.GATEWAY_IDENTITY_SECRET })) : pending;
};
const upload = async (identity = child, bytes = png, mime = 'image/png', purpose = 'ai2_correction', suppliedChildId) => {
  let pending = (await request(app)).post('/api/media').set(createIdentityHeaders({ method: 'POST', originalUrl: '/api/media',
    user: identity, secret: process.env.GATEWAY_IDENTITY_SECRET })).field('purpose', purpose);
  if (suppliedChildId) pending = pending.field('childId', suppliedChildId);
  return pending.attach('file', bytes, { filename: 'synthetic-image', contentType: mime });
};
const asset = async (overrides = {}) => {
  const stored = await store.writeCanonical(png);
  return Asset.create({ familyId: family, childId: child.id, uploadedBy: child.id, purpose: 'ai2_correction',
    mimeType: 'image/png', sizeBytes: png.length, storageKey: stored.storageKey, displayName: 'synthetic',
    malwareScanStatus: 'skipped_trusted_local', status: 'active', ...overrides });
};
const reference = async (media, state = 'bound') => Reference.create({ familyId: family, childId: child.id,
  mediaId: media._id, resourceType: 'ai2_attempt', resourceId: id(), field: 'correctionMediaIds',
  operationId: crypto.randomUUID(), state, leaseExpiresAt: state === 'prepared' ? new Date(Date.now() + 60000) : null,
  releasedAt: state === 'released' ? new Date() : null });
const published = async (media, visibility = 'published', existingReference) => {
  const ref = existingReference || await reference(media);
  const packageId = id();
  await Ai2.Package.collection.insertOne({ _id: packageId, familyId: family, childId: new mongoose.Types.ObjectId(child.id),
    ai1CycleId: id(), visibility });
  const binding = { mediaId: String(media._id), resourceType: 'ai2_attempt', resourceId: String(ref.resourceId),
    field: 'correctionMediaIds', bindingOperationId: ref.operationId };
  const payload = { note: '', mediaIds: [String(media._id)], bindings: [binding], submittedBy: child.id, attemptVersion: 1 };
  await Ai2.Attempt.collection.insertOne({ _id: ref.resourceId, familyId: family, childId: new mongoose.Types.ObjectId(child.id),
    packageId, submitCommandId: id(), note: '', mediaIds: [media._id], mediaBindings: [binding],
    submittedBy: new mongoose.Types.ObjectId(child.id), attemptVersion: 1, payloadHash: hash(payload) });
  return { ref, packageId, binding };
};
const unpublished = async (media, packageId) => {
  const ref = await reference(media, 'bound');
  const payload = normalize('submit', { schemaVersion: 'ai2-min-v1', operationId: crypto.randomUUID(),
    expectedPackageVersion: 1, note: '', mediaIds: [String(media._id)] });
  const references = [{ mediaId: String(media._id), resourceType: 'ai2_attempt', resourceId: String(ref.resourceId),
    field: 'correctionMediaIds', bindingOperationId: ref.operationId }];
  const command = await Ai2.Command.create({ familyId: family, childId: child.id, actorId: child.id, packageId,
    endpointOperation: 'ai2.submit', operationId: payload.operationId, payload,
    requestHash: requestHash('submit', `/api/ai2/learning-packages/${packageId}/attempts`, payload),
    expectedPackageVersion: 1, reservedPackageVersion: 2, attemptId: ref.resourceId, attemptVersion: 2,
    remoteOperationId: ref.operationId, references, referencesHash: hash({ familyId: String(family), childId: child.id,
      resourceType: 'ai2_attempt', resourceId: String(ref.resourceId), references }), phase: 'MEDIA_COMMITTED' });
  return command;
};
const deletedAndCleaned = async () => {
  const result = await upload();
  expect(result.status).toBe(201);
  const media = await Asset.findById(result.body.data.media.mediaId).lean();
  const operations = createMediaReferenceOperationService({ transactionRunner: runner, ai2Mode: () => mode });
  const command = { familyId: String(family), childId: child.id, resourceType: 'ai2_attempt', resourceId: String(id()),
    operationId: crypto.randomUUID(), commandHash: hash({ mediaId: String(media._id) }),
    references: [{ mediaId: String(media._id), field: 'correctionMediaIds' }] };
  await operations.prepare(command); await operations.commit(command);
  const bound = await Reference.findOne({ mediaId: media._id, state: 'bound' }).lean();
  const { binding } = await published(media, 'published', bound);
  const input = { familyId: String(family), childId: child.id, identity: parent,
    mediaIds: [String(media._id)], bindings: [binding] };
  let time = Date.now();
  const journal = createMediaDeletionJournal({ root: path.join(root, 'deletions') });
  const privacy = createCompletionMediaPrivacyService({ transactionRunner: runner, journal, now: () => time });
  const cleanup = createCompletionMediaCleanupService({ transactionRunner: runner, journal, mediaStore: store, now: () => time });
  await privacy.deleteMedia({ identity: child, mediaId: String(media._id) });
  time += 30 * 86400000 - 1;
  expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(0);
  time += 1;
  expect(await cleanup.cleanupDeletedMedia()).toEqual({ cleaned: 1, mediaIds: [String(media._id)] });
  expect(await Asset.findById(media._id)).toBeNull();
  expect(await Reference.countDocuments({ mediaId: media._id })).toBe(0);
  await expect(store.read(media.storageKey)).rejects.toThrow();
  return { media, input };
};

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri());
  runner = createMongoTransactionRunner(mongoose.connection);
  for (const model of [Asset, Reference, Tombstone, Receipt, Guard, Operation, Family, User]) await model.init();
  png = await sharp({ create: { width: 6, height: 6, channels: 3, background: '#338855' } }).png().toBuffer();
  const homework = express();
  homework.use(express.json());
  homework.use('/api/internal/ai2', createAi2MediaAccessRouter({ serviceToken: token, check: body => {
    received.push(body); return remoteCheck(body);
  } }));
  server = http.createServer(homework);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  client = createAi2MediaAccessClient({ homeworkServiceUrl: `http://127.0.0.1:${server.address().port}`, serviceToken: token });
  capabilities = createMediaCapabilityService({ secret: 'synthetic-media-signing-key-at-least-32-characters' });
});
beforeEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'ai2-media-http-')));
  store = createPrivateMediaStore({ root: path.join(root, 'media') });
  family = id(); const childId = id(), parentId = id(), siblingId = id();
  child = { id: String(childId), childId: String(childId), familyId: String(family), role: 'student', tokenVersion: 0 };
  sibling = { ...child, id: String(siblingId), childId: String(siblingId) };
  parent = { id: String(parentId), role: 'parent', familyId: String(id()) };
  await Family.create({ _id: family, familyName: 'Synthetic', ownerParentId: parentId,
    memberParentIds: [parentId], childIds: [childId, siblingId] });
  await User.create([{ _id: parentId, role: 'parent' }, { _id: childId, familyId: family, role: 'student', childProfile: { tokenVersion: 0 } },
    { _id: siblingId, familyId: family, role: 'student', childProfile: { tokenVersion: 0 } }]
    .map(user => ({ ...user, username: `synthetic-${user._id}`, email: `${user._id}@example.invalid` })));
  mode = 'enabled'; remoteCheck = checkAi2MediaAccess; received = []; resetIdentityNonceStore(); build();
});
afterEach(async () => { await close(); await fs.rm(root, { recursive: true, force: true }); });
afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect(); if (mongo) await mongo.stop();
});

test.each(['jpeg', 'png', 'webp'])('child uploads canonical %s through real durable guard', async format => {
  const bytes = await sharp(png).toFormat(format).toBuffer();
  const result = await upload(child, bytes, `image/${format}`);
  expect(result.status).toBe(201);
  const stored = await Asset.findById(result.body.data.media.mediaId).lean();
  expect(stored.purpose).toBe('ai2_correction'); expect(String(stored.uploadedBy)).toBe(child.id);
  expect(await Guard.exists({ mediaId: stored._id, state: 'REGISTERED' })).toBeTruthy();
  expect((await sharp(await store.read(stored.storageKey)).metadata()).format).toBe(format);
});
test('default off and absent guard fail closed; old purpose still uploads', async () => {
  delete process.env.AI2_MODE; build({ getAi2Mode: undefined });
  expect((await upload()).body.code).toBe('AI2_DISABLED');
  build({ completionUploadService: undefined });
  expect((await upload()).body.code).toBe('MEDIA_SERVICE_UNAVAILABLE');
  expect((await upload(child, png, 'image/png', 'growth_evidence')).status).toBe(201);
});
test('environment enabled cannot activate AI2 without an explicitly injected validated mode', async () => {
  const previous = process.env.AI2_MODE;
  try {
    process.env.AI2_MODE = 'enabled';
    build({ getAi2Mode: undefined });
    expect((await upload()).body.code).toBe('AI2_DISABLED');
    expect(await Asset.countDocuments()).toBe(0);
    expect(await Guard.countDocuments()).toBe(0);
  } finally {
    if (previous === undefined) delete process.env.AI2_MODE;
    else process.env.AI2_MODE = previous;
  }
});
test('parent proxy and cross-child uploads denied before persistence', async () => {
  expect((await upload(parent, png, 'image/png', 'ai2_correction', child.id)).status).toBe(403);
  expect((await upload(child, png, 'image/png', 'ai2_correction', sibling.id)).status).toBe(403);
  expect(await Asset.countDocuments()).toBe(0);
});
test.each([[Buffer.from('%PDF-synthetic'), 'image/png'], [Buffer.from('not-an-image'), 'image/png'],
  [Buffer.from('0000ftypheic'), 'image/heic']])('nonimage bytes rejected despite MIME', async (bytes, mime) => {
  expect((await upload(child, bytes, mime)).status).toBe(400); expect(await Asset.countDocuments()).toBe(0);
});
test('MIME mismatch and 10MiB plus one are rejected and temporary files removed', async () => {
  expect((await upload(child, png, 'image/jpeg')).status).toBe(400);
  expect((await upload(child, Buffer.alloc(10 * 1024 * 1024 + 1), 'image/png')).status).toBe(413);
  expect(await fs.readdir(path.join(root, 'media', '.incoming'))).toEqual([]);
  expect(await Asset.countDocuments()).toBe(0);
});
test('exactly 10MiB is accepted and reencoded to canonical image', async () => {
  const padded = Buffer.alloc(10 * 1024 * 1024); png.copy(padded);
  const result = await upload(child, padded);
  expect(result.status).toBe(201);
  expect(result.body.data.media.sizeBytes).toBeLessThan(padded.length);
});
test('secure profile scans reencoded image and rejects scanner failure', async () => {
  const scan = jest.fn(async () => { throw new Error('synthetic scan failed'); });
  build({ securityProfile: 'secure-production', scanner: { scan } });
  expect((await upload()).status).toBeGreaterThanOrEqual(500);
  expect(scan).toHaveBeenCalledTimes(1); expect(await Asset.countDocuments()).toBe(0);
});
test('never-bound self preview needs signed identity and preserves old anonymous purpose behavior', async () => {
  const media = await asset(), url = `/api/media/${media._id}/access`;
  const access = (await get(url, child)).body.data.access;
  expect(access.requiresAuthorization).toBe(true); expect(access.url).toContain('/authenticated-content?');
  expect((await get(access.url)).status).toBe(401);
  const content = await get(access.url, child);
  expect(content.status).toBe(200); expect(content.headers['cache-control']).toContain('no-store');
  expect(content.body).toEqual(png); expect(received).toEqual([]);
  expect((await get(capabilities.issue(String(media._id)).url)).status).toBe(404);
  const legacy = await asset({ purpose: 'growth_evidence' });
  expect((await get(capabilities.issue(String(legacy._id)).url)).status).toBe(200);
});
test('cross-child, spoofed id/childId and wrong uploader never get preview', async () => {
  const media = await asset();
  expect((await get(`/api/media/${media._id}/access`, sibling)).status).toBe(403);
  expect((await get(`/api/media/${media._id}/access`, { ...child, id: sibling.id })).status).toBe(403);
  await Asset.updateOne({ _id: media._id }, { $set: { uploadedBy: parent.id } });
  expect((await get(`/api/media/${media._id}/access`, child)).status).toBe(404);
});
test.each(['prepared', 'released'])('%s history is never unbound preview', async state => {
  const media = await asset(); await reference(media, state);
  expect((await get(`/api/media/${media._id}/access`, child)).status).toBe(404); expect(received).toEqual([]);
});
test('published exact binding uses service HTTP contract and rechecks withdrawal on content', async () => {
  const media = await asset(), history = await published(media);
  const access = (await get(`/api/media/${media._id}/access`, child)).body.data.access;
  expect(received[0]).toEqual({ familyId: String(family), childId: child.id, actorId: child.id, role: 'student',
    mediaId: String(media._id), bindings: [{ attemptId: String(history.ref.resourceId), bindingOperationId: history.ref.operationId }] });
  expect((await get(access.url, child)).status).toBe(200); expect(received).toHaveLength(2);
  await Ai2.Package.updateOne({ _id: history.packageId }, { $set: { visibility: 'withdrawn' } });
  expect((await get(access.url, child)).status).toBe(404);
  expect((await get(`/api/media/${media._id}/access`, parent)).status).toBe(200);
});
test('prepared/released history does not poison another valid published reference', async () => {
  const media = await asset(); await published(media); await reference(media, 'prepared'); await reference(media, 'released');
  expect((await get(`/api/media/${media._id}/access`, child)).status).toBe(200);
  expect(received[0].bindings).toHaveLength(1);
});
test('an unpublished committed reference cannot hide another published exact Attempt', async () => {
  const media = await asset(), { packageId } = await published(media);
  const command = await unpublished(media, packageId);
  const access = await get(`/api/media/${media._id}/access`, child);
  expect(access.status).toBe(200);
  expect(received[0].bindings).toHaveLength(2);
  expect((await get(access.body.data.access.url, child)).status).toBe(200);
  await Ai2.Command.updateOne({ _id: command._id }, { $set: { referencesHash: '0'.repeat(64) } });
  expect((await get(`/api/media/${media._id}/access`, child)).status).toBe(404);
});
test('an arbitrary unknown bound reference still denies even alongside a published Attempt', async () => {
  const media = await asset(); await published(media); await reference(media, 'bound');
  expect((await get(`/api/media/${media._id}/access`, child)).status).toBe(404);
  expect(received[0].bindings).toHaveLength(2);
});
test('missing Attempt, unavailable dependency and malformed response do not grant access', async () => {
  const media = await asset(); await reference(media);
  expect((await get(`/api/media/${media._id}/access`, child)).status).toBe(404);
  remoteCheck = async () => { throw new Error('synthetic network dependency failure'); };
  expect((await get(`/api/media/${media._id}/access`, child)).status).toBe(503);
  remoteCheck = async () => ({ allowed: 'true' });
  expect((await get(`/api/media/${media._id}/access`, child)).status).toBe(503);
});
test('wrong generation and withdrawn-only bindings deny; another published exact binding grants', async () => {
  const media = await asset(), history = await published(media, 'withdrawn');
  expect((await get(`/api/media/${media._id}/access`, child)).status).toBe(404);
  const second = await published(media);
  expect((await get(`/api/media/${media._id}/access`, child)).status).toBe(200);
  await Reference.updateOne({ _id: second.ref._id }, { $set: { operationId: crypto.randomUUID() } });
  expect((await get(`/api/media/${media._id}/access`, child)).status).toBe(404);
  expect(await Ai2.Package.exists({ _id: history.packageId })).toBeTruthy();
});
test('database dependency error never falls back to unbound preview or emits bytes', async () => {
  const media = await asset();
  const access = (await get(`/api/media/${media._id}/access`, child)).body.data.access;
  jest.spyOn(Reference, 'find').mockImplementation(() => { throw Error('synthetic database unavailable'); });
  expect((await get(`/api/media/${media._id}/access`, child)).status).toBe(503);
  expect((await get(access.url, child)).status).toBe(503);
});
test('mode change during scanner blocks upload before canonical storage write', async () => {
  build({ securityProfile: 'secure-production', scanner: { scan: async () => { mode = 'off'; } } });
  expect((await upload()).body.code).toBe('AI2_DISABLED');
  expect(await Asset.countDocuments()).toBe(0);
  expect((await fs.readdir(path.join(root, 'media'))).filter(name => name !== '.incoming')).toEqual([]);
});
test('current tokenVersion and family membership invalidate already issued capability', async () => {
  const media = await asset(); await published(media);
  const access = (await get(`/api/media/${media._id}/access`, child)).body.data.access;
  await User.updateOne({ _id: child.id }, { $inc: { 'childProfile.tokenVersion': 1 } });
  expect((await get(access.url, child)).status).toBe(401);
  await expect(service.issueAccess({ identity: child, mediaId: String(media._id) })).rejects.toMatchObject({ statusCode: 403 });
  expect(received).toHaveLength(1);
  await Family.updateOne({ _id: family }, { $pull: { childIds: child.id } });
  expect((await get(access.url, { ...child, tokenVersion: 1 })).status).toBe(403);
});
test('parent live membership overrides stale claim, revocation rejects old capability', async () => {
  const media = await asset(), coParent = { id: String(id()), role: 'parent' };
  await User.create({ _id: coParent.id, role: 'parent', username: `synthetic-${coParent.id}`, email: `${coParent.id}@example.invalid` });
  await Family.updateOne({ _id: family }, { $push: { memberParentIds: coParent.id } });
  const access = (await get(`/api/media/${media._id}/access`, coParent)).body.data.access;
  expect((await get(access.url, parent)).status).toBe(200);
  await Family.updateOne({ _id: family }, { $pull: { memberParentIds: coParent.id } });
  expect((await get(access.url, coParent)).status).toBe(403);
});
test('off preserves historical reads, but tombstone vetoes old capability even for active metadata', async () => {
  const media = await asset(); await published(media); mode = 'off';
  const access = (await get(`/api/media/${media._id}/access`, child)).body.data.access;
  await Tombstone.create({ mediaId: media._id, familyId: family, childId: child.id, actorId: child.id,
    role: 'student', purpose: 'ai2_correction', mimeType: media.mimeType, sizeBytes: media.sizeBytes,
    reason: 'user_requested', deletedAt: new Date() });
  expect((await get(access.url, child)).status).toBe(404);
  expect((await get(`/api/media/${media._id}/access`, parent)).status).toBe(404);
});
test('more than 100 references is refused, never truncated into authorization', async () => {
  const media = await asset(); await published(media);
  await Reference.insertMany(Array.from({ length: 100 }, () => ({ familyId: family, childId: child.id,
    mediaId: media._id, resourceType: 'ai2_attempt', resourceId: id(), field: 'correctionMediaIds',
    operationId: crypto.randomUUID(), state: 'released', releasedAt: new Date() })));
  expect((await get(`/api/media/${media._id}/access`, child)).status).toBe(404); expect(received).toEqual([]);
});
test('inspection hook returns only metadata and requires exact binding/deletion receipt', async () => {
  const media = await asset(), { binding } = await published(media);
  const input = { familyId: String(family), childId: child.id, identity: parent, mediaIds: [String(media._id)], bindings: [binding] };
  expect(await service.inspect(input)).toEqual([{ mediaId: String(media._id), mimeType: 'image/png', sizeBytes: png.length, status: 'available' }]);
  await expect(service.inspect({ ...input, bindings: [{ ...binding, bindingOperationId: crypto.randomUUID() }] })).rejects.toMatchObject({ statusCode: 404 });
  const deletedAt = new Date();
  await Asset.updateOne({ _id: media._id }, { $set: { status: 'deleted', deletedAt, privacyDeletionRecorded: true } });
  await Tombstone.create({ mediaId: media._id, familyId: family, childId: child.id, actorId: child.id,
    role: 'student', purpose: 'ai2_correction', mimeType: media.mimeType, sizeBytes: media.sizeBytes,
    reason: 'user_requested', deletedAt });
  await expect(service.inspect(input)).rejects.toMatchObject({ statusCode: 404 });
  await Receipt.create({ ...binding, familyId: family, childId: child.id, releasedAt: deletedAt });
  expect((await service.inspect(input))[0].status).toBe('deleted'); expect(received).toEqual([]);
});
test('actual privacy deletion and 30-day cleanup retain exact deleted metadata and live identity checks', async () => {
  const { media, input } = await deletedAndCleaned();
  const expected = [{ mediaId: String(media._id), mimeType: media.mimeType, sizeBytes: media.sizeBytes, status: 'deleted' }];
  expect(await service.inspect(input)).toEqual(expected);
  expect(await service.inspect({ ...input, identity: child })).toEqual(expected);
  const evidence = JSON.parse(await fs.readFile(path.join(root, 'deletions', `${media._id}.json`), 'utf8'));
  expect(evidence.tombstone).toMatchObject({ mimeType: media.mimeType, sizeBytes: media.sizeBytes });
  expect((await get(`/api/media/${media._id}/access`, child)).status).toBe(404);
  await User.updateOne({ _id: child.id }, { $inc: { 'childProfile.tokenVersion': 1 } });
  await expect(service.inspect({ ...input, identity: child })).rejects.toMatchObject({ statusCode: 403 });
});
test.each(['missing receipt', 'wrong generation', 'wrong child', 'missing metadata', 'invalid metadata'])(
  'purged inspection rejects %s without inventing deleted metadata', async kind => {
    const { media, input } = await deletedAndCleaned();
    if (kind === 'missing receipt') await Receipt.deleteMany({ mediaId: media._id });
    if (kind === 'wrong generation') input.bindings[0].bindingOperationId = crypto.randomUUID();
    if (kind === 'wrong child') await Tombstone.collection.updateOne({ mediaId: media._id }, { $set: { childId: new mongoose.Types.ObjectId(sibling.id) } });
    if (kind === 'missing metadata') await Tombstone.collection.updateOne({ mediaId: media._id }, { $unset: { mimeType: '', sizeBytes: '' } });
    if (kind === 'invalid metadata') await Tombstone.collection.updateOne({ mediaId: media._id }, { $set: { mimeType: 'application/pdf' } });
    await expect(service.inspect(input)).rejects.toMatchObject({ statusCode: kind.includes('metadata') ? 503 : 404 });
  });

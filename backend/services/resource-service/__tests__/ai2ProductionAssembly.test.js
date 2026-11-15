process.env.JWT_SECRET = 'synthetic-ai25-jwt-secret-at-least-32-chars';
process.env.GATEWAY_IDENTITY_SECRET = 'synthetic-ai25-gateway-secret-at-least-32';
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/synthetic-unused';
jest.mock('../../../common/config/logger', () => ({ createLogger: () => ({
  debug() {}, info() {}, warn() {}, error() {}
}) }));

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createHttpTestHarness } = require('../../../common/test/httpTestHarness');
const { createIdentityHeaders } = require('../../../common/middleware/gatewayIdentity');
const { createProductionApp, createTask6MediaDependencies, startServer } = require('../server');
const Asset = require('../models/MediaAsset');
const Reference = require('../models/MediaReference');
const Operation = require('../models/MediaReferenceOperation');
const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');
const Guard = require('../models/CompletionUploadGuard');
const Retirement = require('../models/MediaOrphanRetirement');
const Family = require('../../../common/models/Family');
const User = require('../models/FamilyUser');
const { createPrivateMediaStore } = require('../services/privateMediaStore');
const { request, close } = createHttpTestHarness();
const token = 'synthetic-ai25-media-service-token-32chars';
const config = () => ({ NODE_ENV: 'test', MEDIA_SECURITY_PROFILE: 'trusted-local',
  MEDIA_REFERENCE_SERVICE_TOKEN: token, MEDIA_SIGNING_SECRET: token,
  PRIVATE_MEDIA_ROOT: '/private/tmp/ai25-unused-media' });

describe('AI2 resource configuration', () => {
  test('default off assembles without a homework URL', () => {
    expect(() => createProductionApp({ env: config() })).not.toThrow();
  });
  test.each(['', 'true', 'ENABLED'])('invalid AI2 mode %s cannot be silently ignored', AI2_MODE => {
    expect(() => createProductionApp({ env: { ...config(), AI2_MODE } })).toThrow();
  });
  test.each([
    { AI2_MODE: 'enabled' },
    { AI2_MODE: 'enabled', AI2_STORE_CONTINUOUS: 'true' },
    { AI2_MODE: 'off', AI2_STORE_CONTINUOUS: 'true' },
    { AI2_STORE_CONTINUOUS: 'yes' }
  ])('invalid dependency prerequisites reject before assembly: %j', flags => {
    expect(() => createProductionApp({ env: { ...config(), ...flags } })).toThrow();
  });
  test('direct dependency factory cannot enable AI2 without completion assembly', () => {
    expect(() => createTask6MediaDependencies({ env: { ...config(), AI2_MODE: 'enabled',
      AI2_STORE_CONTINUOUS: 'true', COMPLETION_PROTOCOL_MODE: 'enabled',
      HOMEWORK_SERVICE_URL: 'http://127.0.0.1:1' } })).toThrow();
  });
});

describe('AI2 formal resource assembly with local synthetic replica set', () => {
  jest.setTimeout(60000);
  const models = [Asset, Reference, Operation, Tombstone, Receipt, Guard, Retirement, Family, User];
  const id = () => new mongoose.Types.ObjectId();
  let mongo, root, env, child, parent, family, png, callbackApp, callbackBodies, allowed, servers;
  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await mongoose.connect(mongo.getUri());
    for (const model of models) await model.init();
    png = await require('sharp')({ create: { width: 3, height: 3, channels: 3, background: '#338855' } }).png().toBuffer();
  });
  beforeEach(async () => {
    servers = [];
    for (const model of models) await model.deleteMany({});
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'ai25-resource-')));
    await fs.chmod(root, 0o700);
    env = { ...config(), AI2_MODE: 'enabled', AI2_STORE_CONTINUOUS: 'true',
      COMPLETION_PROTOCOL_MODE: 'enabled', COMPLETION_WRITES_PAUSED: 'true',
      MONGO_URI: mongo.getUri(), COMPLETION_STORAGE_CONFIRMED: 'true',
      COMPLETION_RETIREMENT_SERVICE_TOKEN: 'synthetic-ai25-retirement-distinct-token-32',
      PRIVATE_MEDIA_ROOT: path.join(root, 'media'), COMPLETION_DELETION_JOURNAL_ROOT: path.join(root, 'journal') };
    await fs.mkdir(env.PRIVATE_MEDIA_ROOT, { mode: 0o700 });
    await fs.mkdir(env.COMPLETION_DELETION_JOURNAL_ROOT, { mode: 0o700 });
    callbackBodies = []; allowed = true;
    callbackApp = require('express')(); callbackApp.use(require('express').json());
    callbackApp.post('/api/internal/ai2/media-access-check', (req, res) => {
      callbackBodies.push({ token: req.get('x-service-token'), body: req.body });
      res.json({ success: true, data: { allowed } });
    });
    const probe = (await request(callbackApp)).get('/');
    env.HOMEWORK_SERVICE_URL = new URL(probe.url).origin;
    parent = { id: String(id()), role: 'parent' };
    child = { id: String(id()), role: 'student', tokenVersion: 0 };
    family = await Family.create({ familyName: 'Synthetic', ownerParentId: parent.id,
      memberParentIds: [parent.id], childIds: [child.id] });
    child.childId = child.id; child.familyId = String(family._id);
    await User.create([{ _id: parent.id, role: 'parent' },
      { _id: child.id, familyId: family._id, role: 'student', childProfile: { tokenVersion: 0 } }]);
  });
  afterEach(async () => {
    for (const server of servers) await new Promise(resolve => server.close(resolve));
    await close(); if (root) await fs.rm(root, { recursive: true, force: true });
  });
  afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
  const client = app => typeof app === 'function' ? request(app) : require('supertest')(app);
  const formal = async () => {
    const server = await startServer({ env, port: 0, host: '127.0.0.1', appLogger: { info() {} } });
    servers.push(server); return server;
  };
  const upload = async (app, purpose = 'ai2_correction') => (await client(app)).post('/api/media')
    .set(createIdentityHeaders({ method: 'POST', originalUrl: '/api/media', user: child,
      secret: process.env.GATEWAY_IDENTITY_SECRET })).field('purpose', purpose).attach('file', png, 'synthetic.png');
  const signedGet = async (app, url, identity = child) => (await client(app)).get(url)
    .set(createIdentityHeaders({ method: 'GET', originalUrl: url, user: identity,
      secret: process.env.GATEWAY_IDENTITY_SECRET }));
  const internal = async (app, action, body) => (await client(app))
    .post('/api/internal/media/references/' + action).set('x-service-token', token).send(body);
  const bind = async (app, mediaId) => {
    const command = { familyId: String(family._id), childId: child.id, resourceType: 'ai2_attempt',
      resourceId: String(id()), operationId: randomUUID(), commandHash: 'a'.repeat(64),
      references: [{ mediaId, field: 'correctionMediaIds' }] };
    expect((await internal(app, 'prepare', command)).status).toBe(200);
    expect((await internal(app, 'commit', command)).status).toBe(200);
    return command;
  };

  test.each(['enabled', 'off'])('%s with continuous history requires a valid homework callback URL', mode => {
    env.AI2_MODE = mode; delete env.HOMEWORK_SERVICE_URL;
    expect(() => createProductionApp({ env })).toThrow();
  });
  test('enabled factory rejects scanner, dependency and connection replacement', () => {
    expect(() => createProductionApp({ env, createMediaDependencies: () => ({}) })).toThrow();
    expect(() => createProductionApp({ env, connection: {} })).toThrow();
    expect(() => createTask6MediaDependencies({ env, completionProtocol: true, createScanner: () => null })).toThrow();
  });
  test.each(['app', 'connect', 'validateEnvironment', 'createRuntimeApp'])('enabled startup rejects %s substitution before calling it', async key => {
    const replacement = jest.fn();
    await expect(startServer({ env, [key]: key === 'app' ? { listen: replacement } : replacement,
      port: 0, host: '127.0.0.1' })).rejects.toThrow();
    expect(replacement).not.toHaveBeenCalled();
  });
  test('startup precheck failure never listens or creates upload state', async () => {
    env.COMPLETION_STORAGE_CONFIRMED = 'false';
    const listen = jest.spyOn(require('express').application, 'listen');
    await expect(startServer({ env, port: 0, host: '127.0.0.1' })).rejects.toThrow();
    expect(listen).not.toHaveBeenCalled(); expect(await Asset.countDocuments()).toBe(0);
  });
  test('formal startup uses completion precheck and durable upload guard/journal', async () => {
    const precheck = jest.spyOn(require('../services/completionOperations'), 'checkCompletionOperations');
    const server = await startServer({ env, port: 0, host: '127.0.0.1', appLogger: { info() {} } });
    try {
      expect(precheck).toHaveBeenCalledWith(expect.objectContaining({ connection: mongoose.connection, writesPaused: true, env }));
      const result = await require('supertest')(server).post('/api/media')
        .set(createIdentityHeaders({ method: 'POST', originalUrl: '/api/media', user: child,
          secret: process.env.GATEWAY_IDENTITY_SECRET })).field('purpose', 'ai2_correction').attach('file', png, 'synthetic.png');
      expect(result.status).toBe(201);
      const asset = await Asset.findById(result.body.data.media.mediaId).lean();
      expect((await Guard.findOne({ mediaId: asset._id })).state).toBe('REGISTERED');
      expect(asset.retentionPolicyVersion).toBeUndefined();
      const record = JSON.parse(await fs.readFile(path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, 'uploads-v1', asset._id + '.json')));
      expect(record.mediaId).toBe(String(asset._id)); expect(record.metadata.purpose).toBe('ai2_correction');
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
  test('mode is dynamic for uploads and prepare/commit; off retains callback-authorized authenticated history', async () => {
    const app = await formal();
    const uploaded = await upload(app); expect(uploaded.status).toBe(201);
    const mediaId = uploaded.body.data.media.mediaId;
    const command = await bind(app, mediaId);
    env.AI2_MODE = 'off';
    expect((await upload(app)).status).toBe(503);
    expect((await internal(app, 'prepare', { ...command, operationId: randomUUID() })).status).toBe(503);
    const access = await signedGet(app, '/api/media/' + mediaId + '/access');
    expect(access.status).toBe(200); expect(access.body.data.access.requiresAuthorization).toBe(true);
    expect(callbackBodies[0]).toEqual({ token, body: { familyId: String(family._id), childId: child.id,
      actorId: child.id, role: 'student', mediaId,
      bindings: [{ attemptId: command.resourceId, bindingOperationId: command.operationId }] } });
    expect((await signedGet(app, access.body.data.access.url)).status).toBe(200);
    allowed = false;
    expect((await signedGet(app, access.body.data.access.url)).status).toBe(404);
    expect((await internal(app, 'status', { ...command, mode: 'operation' })).status).toBe(200);
    env.AI2_MODE = 'enabled'; expect((await upload(app)).status).toBe(201);
  });
  test('cold off cannot hot-enable a runtime lacking continuous-store dependencies', async () => {
    env.AI2_MODE = 'off'; env.AI2_STORE_CONTINUOUS = 'false'; delete env.HOMEWORK_SERVICE_URL;
    const app = createProductionApp({ env });
    env.AI2_MODE = 'enabled'; env.AI2_STORE_CONTINUOUS = 'true'; env.HOMEWORK_SERVICE_URL = 'http://127.0.0.1:1';
    expect((await upload(app)).status).toBe(503); expect(await Guard.countDocuments()).toBe(0);
    expect((await upload(app, 'growth_evidence')).status).toBe(201);
  });
  test('off continuous runtime keeps real callback dependency and inspect requires real exact binding', async () => {
    const app = await formal();
    const uploaded = await upload(app); expect(uploaded.status).toBe(201);
    const mediaId = uploaded.body.data.media.mediaId, command = await bind(app, mediaId);
    env.AI2_MODE = 'off'; const historical = await formal();
    expect((await signedGet(historical, '/api/media/' + mediaId + '/access')).status).toBe(200);
    const body = { familyId: String(family._id), childId: child.id, identity: child, mediaIds: [mediaId],
      bindings: [{ mediaId, resourceType: 'ai2_attempt', resourceId: command.resourceId,
        field: 'correctionMediaIds', bindingOperationId: command.operationId }] };
    const inspect = async input => (await client(historical)).post('/api/internal/media/ai2/inspect')
      .set('x-service-token', token).send(input);
    expect((await inspect(body)).body).toEqual({ success: true, data: { items: [
      { mediaId, mimeType: 'image/png', sizeBytes: uploaded.body.data.media.sizeBytes, status: 'available' }
    ] } });
    body.bindings[0].bindingOperationId = randomUUID(); expect((await inspect(body)).status).toBe(404);
    body.bindings[0].bindingOperationId = command.operationId;
    await User.updateOne({ _id: child.id }, { $inc: { 'childProfile.tokenVersion': 1 } });
    expect((await inspect(body)).status).toBe(403);
    const asset = await Asset.findById(mediaId);
    await createPrivateMediaStore({ root: env.PRIVATE_MEDIA_ROOT }).remove(asset.storageKey);
    expect((await inspect({ ...body, identity: parent })).status).toBe(503);
  });
  test.each(['factory', 'discontinuous'])('%s blocks parent, unbound child, content and inspect without callback', async state => {
    const ready = await formal();
    const stored = await createPrivateMediaStore({ root: env.PRIVATE_MEDIA_ROOT }).writeCanonical(png);
    const asset = await Asset.create({ familyId: family._id, childId: child.id, uploadedBy: child.id,
      purpose: 'ai2_correction', mimeType: 'image/png', sizeBytes: png.length, storageKey: stored.storageKey });
    const mediaId = String(asset._id);
    const access = await signedGet(ready, '/api/media/' + mediaId + '/access');
    expect(access.status).toBe(200);
    const app = state === 'factory' ? createProductionApp({ env }) : ready;
    if (state === 'discontinuous') { env.AI2_MODE = 'off'; env.AI2_STORE_CONTINUOUS = 'false'; }
    for (const identity of [child, parent]) {
      expect((await signedGet(app, '/api/media/' + mediaId + '/access', identity)).status).toBe(503);
      expect((await signedGet(app, access.body.data.access.url, identity)).status).toBe(503);
      const result = await (await client(app)).post('/api/internal/media/ai2/inspect').set('x-service-token', token)
        .send({ familyId: String(family._id), childId: child.id, identity, mediaIds: [mediaId], bindings: [
          { mediaId, resourceType: 'ai2_attempt', resourceId: String(id()), field: 'correctionMediaIds', bindingOperationId: randomUUID() }
        ] });
      expect(result.status).toBe(503);
    }
    expect(callbackBodies).toEqual([]);
    expect((await upload(app)).status).toBe(503);
  });
  test.each(['factory', 'discontinuous'])('%s refuses all AI2 recovery actions without operation writes', async state => {
    const ready = await formal();
    const app = state === 'factory' ? createProductionApp({ env }) : ready;
    if (state === 'discontinuous') { env.AI2_MODE = 'off'; env.AI2_STORE_CONTINUOUS = 'false'; }
    const command = { familyId: String(family._id), childId: child.id, resourceType: 'ai2_attempt', resourceId: String(id()),
      operationId: randomUUID(), commandHash: 'a'.repeat(64), references: [{ mediaId: String(id()), field: 'correctionMediaIds' }] };
    for (const action of ['status', 'abort', 'unbind']) {
      const { commandHash, ...scope } = command;
      const body = action === 'status' ? { ...command, mode: 'operation' }
        : action === 'unbind' ? { ...scope, references: scope.references.map(ref => ({ ...ref, bindingOperationId: command.operationId })) }
          : command;
      expect((await internal(app, action, body)).status).toBe(503);
    }
    expect(await Operation.countDocuments()).toBe(0); expect(await Reference.countDocuments()).toBe(0);
  });
  test.each(['factory-asset', 'discontinuous-asset', 'factory-tombstone', 'discontinuous-tombstone'])(
    '%s refuses AI2 privacy deletion before any journal or deletion mutation', async kind => {
      const ready = await formal();
      const uploaded = await upload(ready); expect(uploaded.status).toBe(201);
      const mediaId = uploaded.body.data.media.mediaId;
      if (kind.endsWith('tombstone')) {
        await Tombstone.create({ mediaId, familyId: family._id, childId: child.id, actorId: child.id, role: 'student',
          purpose: 'ai2_correction', mimeType: 'image/png', sizeBytes: uploaded.body.data.media.sizeBytes,
          reason: 'user_requested', deletedAt: new Date() });
        await Asset.deleteOne({ _id: mediaId });
      }
      const beforeAssets = await Asset.find().lean(), beforeTombstones = await Tombstone.find().lean();
      const beforeJournal = await fs.readdir(env.COMPLETION_DELETION_JOURNAL_ROOT);
      const app = kind.startsWith('factory') ? createProductionApp({ env }) : ready;
      if (kind.startsWith('discontinuous')) { env.AI2_MODE = 'off'; env.AI2_STORE_CONTINUOUS = 'false'; }
      const result = await (await client(app)).delete('/api/media/' + mediaId)
        .set(createIdentityHeaders({ method: 'DELETE', originalUrl: '/api/media/' + mediaId, user: child,
          secret: process.env.GATEWAY_IDENTITY_SECRET }));
      expect(result.status).toBe(503);
      expect(await Asset.find().lean()).toEqual(beforeAssets); expect(await Tombstone.find().lean()).toEqual(beforeTombstones);
      expect(await Receipt.countDocuments()).toBe(0);
      expect(await fs.readdir(env.COMPLETION_DELETION_JOURNAL_ROOT)).toEqual(beforeJournal);
    });
  test('off continuous startup retains abort/unbind and privacy deletion with real durable evidence', async () => {
    const app = await formal();
    const uploaded = await upload(app); expect(uploaded.status).toBe(201);
    const mediaId = uploaded.body.data.media.mediaId, command = await bind(app, mediaId);
    const second = await upload(app); expect(second.status).toBe(201);
    const prepared = { ...command, operationId: randomUUID(), resourceId: String(id()),
      references: [{ mediaId: second.body.data.media.mediaId, field: 'correctionMediaIds' }] };
    expect((await internal(app, 'prepare', prepared)).status).toBe(200);
    env.AI2_MODE = 'off';
    expect((await internal(app, 'abort', prepared)).status).toBe(200);
    const { commandHash, ...scope } = command;
    expect((await internal(app, 'unbind', { ...scope, references: scope.references.map(ref => ({
      ...ref, bindingOperationId: command.operationId
    })) })).status).toBe(200);
    const result = await (await client(app)).delete('/api/media/' + mediaId)
      .set(createIdentityHeaders({ method: 'DELETE', originalUrl: '/api/media/' + mediaId, user: child,
        secret: process.env.GATEWAY_IDENTITY_SECRET }));
    expect(result.status).toBe(204);
    expect((await Tombstone.findOne({ mediaId })).purpose).toBe('ai2_correction');
    const record = JSON.parse(await fs.readFile(path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, mediaId + '.json')));
    expect(record.tombstone.purpose).toBe('ai2_correction');
  });
});

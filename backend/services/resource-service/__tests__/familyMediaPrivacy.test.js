process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET
  || 'test-gateway-identity-secret-32-bytes-long';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

const fs = require('fs/promises');
const mongoose = require('mongoose');
const os = require('os');
const path = require('path');
const request = require('supertest');
const sharp = require('sharp');
const { MongoMemoryReplSet } = require('../../../../node_modules/mongodb-memory-server');

const { createIdentityHeaders, resetIdentityNonceStore } = require('../../../common/middleware/gatewayIdentity');
const { authenticateGateway } = require('../../../common/middleware/auth');
const Family = require('../../../common/models/Family');
const FamilyUser = require('../models/FamilyUser');
const MediaAsset = require('../models/MediaAsset');
const MediaReference = require('../models/MediaReference');
const { createApp } = require('../app');
const { createMediaReferenceCredential } = require('../middleware/mediaReferenceCredential');
const { createPrivateMediaUpload } = require('../middleware/privateMediaUpload');
const { createInternalMediaReferencesRouter } = require('../routes/internalMediaReferences');
const { createMediaRouter } = require('../routes/media');
const { createMediaCapabilityService } = require('../services/mediaCapability');
const { createMediaReferenceService } = require('../services/mediaReferenceService');
const { createMediaService } = require('../services/mediaService');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const { createPrivateMediaStore } = require('../services/privateMediaStore');

jest.setTimeout(30000);

const FAMILY_ID = new mongoose.Types.ObjectId('6656875da7f86a0012c2a101');
const PARENT_ID = new mongoose.Types.ObjectId('6656875da7f86a0012c2a201');
const CHILD_ID = new mongoose.Types.ObjectId('6656875da7f86a0012c2a301');
const RESOURCE_ID = new mongoose.Types.ObjectId('6656875da7f86a0012c2a501');
const OPERATION_ID = '5dc38fc9-ee29-4dba-9181-df49f66b9050';
const SERVICE_TOKEN = 'privacy-media-reference-token-at-least-32-characters';
const SIGNING_SECRET = 'privacy-media-signing-secret-at-least-32-characters';
const CAPABILITY_NONCE = 'ddda6183-e6e1-47d8-a81d-2f9d834320d4';
const ORIGINAL_FILENAME = 'secret-child-location-and-device.jpg';
const NOW = Date.parse('2026-06-21T00:00:00.000Z');

const parent = {
  id: PARENT_ID.toString(),
  role: 'parent',
  familyId: FAMILY_ID.toString()
};
const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
let app;
let mediaStore;
let mongoServer;
let privateRoot;

const signedHeaders = (method, originalUrl) => createIdentityHeaders({
  method,
  originalUrl,
  user: parent,
  secret: process.env.GATEWAY_IDENTITY_SECRET
});

const fixture = () => sharp({
  create: {
    width: 8,
    height: 8,
    channels: 3,
    background: { r: 80, g: 100, b: 120 }
  }
}).withMetadata({ orientation: 6 }).jpeg().toBuffer();

const buildApp = () => {
  const transactionRunner = createMongoTransactionRunner(mongoose.connection);
  mediaStore = createPrivateMediaStore({ root: privateRoot });
  const capabilityService = createMediaCapabilityService({
    secret: SIGNING_SECRET,
    now: () => NOW,
    randomUUID: () => CAPABILITY_NONCE
  });
  const referenceService = createMediaReferenceService({
    MediaAssetModel: MediaAsset,
    MediaReferenceModel: MediaReference,
    now: () => NOW,
    transactionRunner
  });
  const mediaService = createMediaService({
    MediaAssetModel: MediaAsset,
    MediaReferenceModel: MediaReference,
    UserModel: FamilyUser,
    FamilyModel: Family,
    capabilityService,
    mediaStore,
    now: () => NOW,
    transactionRunner
  });
  const upload = createPrivateMediaUpload({ privateRoot });
  const mediaRouter = createMediaRouter({
    authenticate: authenticateGateway,
    fsPromises: fs,
    mediaService,
    upload
  });
  const credential = createMediaReferenceCredential(SERVICE_TOKEN);
  const internalMediaRouter = createInternalMediaReferencesRouter({ credential, referenceService });
  return createApp({ logger, mediaRouter, internalMediaRouter });
};

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
  await mongoose.connect(mongoServer.getUri());
  privateRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'family-media-privacy-'));
  app = buildApp();
});

beforeEach(async () => {
  resetIdentityNonceStore();
  logger.error.mockClear();
  logger.info.mockClear();
  logger.warn.mockClear();
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
  await fs.rm(privateRoot, { recursive: true, force: true });
  await fs.mkdir(privateRoot, { recursive: true, mode: 0o700 });
  await Family.collection.insertOne({
    _id: FAMILY_ID,
    familyName: 'Privacy Family',
    ownerParentId: PARENT_ID,
    memberParentIds: [PARENT_ID],
    childIds: [CHILD_ID]
  });
  await FamilyUser.collection.insertMany([
    {
      _id: PARENT_ID,
      role: 'parent',
      familyId: FAMILY_ID,
      username: 'privacy-parent',
      name: 'Privacy Parent',
      password: 'unused',
      email: 'privacy-parent@example.com'
    },
    {
      _id: CHILD_ID,
      role: 'student',
      familyId: FAMILY_ID,
      childProfile: { tokenVersion: 0 },
      username: 'privacy-child',
      name: 'Privacy Child',
      password: 'unused',
      email: 'privacy-child@example.com'
    }
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  if (privateRoot) await fs.rm(privateRoot, { recursive: true, force: true });
});

test('TC-T6-MEDIA-015 complete media flow logs approved identifiers only', async () => {
  const uploadPath = '/api/media';
  const uploadResponse = await request(app)
    .post(uploadPath)
    .set(signedHeaders('POST', uploadPath))
    .field('purpose', 'mistake_question')
    .field('childId', CHILD_ID.toString())
    .attach('file', await fixture(), { filename: ORIGINAL_FILENAME, contentType: 'image/jpeg' });
  expect(uploadResponse.status).toBe(201);
  const mediaId = uploadResponse.body.data.media.mediaId;
  const asset = await MediaAsset.findById(mediaId).lean();

  resetIdentityNonceStore();
  const accessPath = `/api/media/${mediaId}/access`;
  const accessResponse = await request(app)
    .get(accessPath)
    .set(signedHeaders('GET', accessPath));
  expect(accessResponse.status).toBe(200);
  const signedUrl = accessResponse.body.data.access.url;
  expect((await request(app).get(signedUrl)).status).toBe(200);

  const command = {
    familyId: FAMILY_ID.toString(),
    childId: CHILD_ID.toString(),
    resourceType: 'family_mistake',
    resourceId: RESOURCE_ID.toString(),
    operationId: OPERATION_ID,
    references: [{ mediaId, field: 'questionMediaId' }]
  };
  for (const action of ['prepare', 'commit', 'unbind']) {
    const payload = action === 'unbind'
      ? {
        ...command,
        references: command.references.map((reference) => ({
          ...reference,
          bindingOperationId: OPERATION_ID
        }))
      }
      : command;
    const response = await request(app)
      .post(`/api/internal/media/references/${action}`)
      .set('x-service-token', SERVICE_TOKEN)
      .send(payload);
    expect(response.status).toBe(200);
  }

  resetIdentityNonceStore();
  const deletePath = `/api/media/${mediaId}`;
  expect((await request(app)
    .delete(deletePath)
    .set(signedHeaders('DELETE', deletePath))).status).toBe(204);

  const serializedLogs = JSON.stringify([
    logger.info.mock.calls,
    logger.warn.mock.calls,
    logger.error.mock.calls
  ]);
  const capability = new URL(signedUrl, 'http://local.test');
  expect(serializedLogs).toContain(mediaId);
  expect(serializedLogs).toContain(FAMILY_ID.toString());
  expect(serializedLogs).not.toContain(ORIGINAL_FILENAME);
  expect(serializedLogs).not.toContain(SERVICE_TOKEN);
  expect(serializedLogs).not.toContain(SIGNING_SECRET);
  expect(serializedLogs).not.toContain(asset.storageKey);
  expect(serializedLogs).not.toContain(privateRoot);
  expect(serializedLogs).not.toContain(CAPABILITY_NONCE);
  expect(serializedLogs).not.toContain(capability.searchParams.get('signature'));
  expect(serializedLogs).not.toMatch(/signature=|nonce=|Exif|base64|\.incoming/);
});

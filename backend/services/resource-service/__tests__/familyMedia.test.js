process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET
  || 'test-gateway-identity-secret-32-bytes-long';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

const express = require('express');
const fs = require('fs/promises');
const mongoose = require('mongoose');
const os = require('os');
const path = require('path');
const request = require('supertest');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const { MongoMemoryReplSet } = require('../../../../node_modules/mongodb-memory-server');

const { createIdentityHeaders, resetIdentityNonceStore } = require('../../../common/middleware/gatewayIdentity');
const { authenticateGateway } = require('../../../common/middleware/auth');
const { errorHandler, requestTracker } = require('../../../common/middleware/errorHandler');
const { AppError } = require('../../../common/middleware/errorTypes');
const FamilyUser = require('../models/FamilyUser');
const MediaAsset = require('../models/MediaAsset');
const MediaReference = require('../models/MediaReference');
const { normalizeUploadFilename } = require('../middleware/privateMediaUpload');
const { createMediaCapabilityService } = require('../services/mediaCapability');
const { createMediaReferenceService } = require('../services/mediaReferenceService');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const { createPrivateMediaStore, MAX_MEDIA_BYTES } = require('../services/privateMediaStore');

jest.setTimeout(30000);

const objectId = (hex) => new mongoose.Types.ObjectId(hex);
const FAMILY_A_ID = objectId('6656875da7f86a0012c2a101');
const FAMILY_B_ID = objectId('6656875da7f86a0012c2a102');
const PARENT_A_ID = objectId('6656875da7f86a0012c2a201');
const PARENT_B_ID = objectId('6656875da7f86a0012c2a202');
const CHILD_A1_ID = objectId('6656875da7f86a0012c2a301');
const CHILD_A2_ID = objectId('6656875da7f86a0012c2a302');
const CHILD_B1_ID = objectId('6656875da7f86a0012c2a303');

const parentA = {
  id: PARENT_A_ID.toString(),
  role: 'parent',
  familyId: FAMILY_A_ID.toString()
};
const childA1 = {
  id: CHILD_A1_ID.toString(),
  childId: CHILD_A1_ID.toString(),
  role: 'student',
  familyId: FAMILY_A_ID.toString(),
  tokenVersion: 0
};
const childA2 = {
  id: CHILD_A2_ID.toString(),
  childId: CHILD_A2_ID.toString(),
  role: 'student',
  familyId: FAMILY_A_ID.toString(),
  tokenVersion: 0
};
const parentB = {
  id: PARENT_B_ID.toString(),
  role: 'parent',
  familyId: FAMILY_B_ID.toString()
};
const FIXED_NOW = Date.parse('2026-06-21T00:00:00.000Z');
const FIXED_EXPIRY = '2026-06-21T00:05:00.000Z';
const CAPABILITY_NONCE = 'ddda6183-e6e1-47d8-a81d-2f9d834320d4';

const logger = { debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() };
let app;
let mediaStore;
let mongoServer;
let privateRoot;
let nowMs = FIXED_NOW;
let referenceService;

const image = async (format, withMetadata = false) => {
  let pipeline = sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 20, g: 100, b: 180 }
    }
  });
  if (withMetadata) pipeline = pipeline.withMetadata({ orientation: 6 });
  return pipeline.toFormat(format).toBuffer();
};

const pdf = async (pages = 1) => {
  const document = await PDFDocument.create();
  for (let index = 0; index < pages; index += 1) document.addPage([200, 200]);
  return Buffer.from(await document.save({ addDefaultPage: false, useObjectStreams: false }));
};

const signedHeaders = (identity, method, originalUrl) => createIdentityHeaders({
  method,
  originalUrl,
  user: identity,
  secret: process.env.GATEWAY_IDENTITY_SECRET
});

const signedUpload = ({
  identity = parentA,
  purpose,
  childId,
  bytes,
  filename = 'untrusted-name.bin',
  contentType = 'application/octet-stream',
  targetApp = app
}) => {
  const requestPath = '/api/media';
  let operation = request(targetApp)
    .post(requestPath)
    .set(signedHeaders(identity, 'POST', requestPath))
    .field('purpose', purpose);
  if (childId !== undefined && childId !== null) operation = operation.field('childId', String(childId));
  if (bytes !== undefined && bytes !== null) {
    operation = operation.attach('file', bytes, { filename, contentType });
  }
  return operation;
};

const signedGet = (identity, requestPath, targetApp = app) => request(targetApp)
  .get(requestPath)
  .set(signedHeaders(identity, 'GET', requestPath));

const signedDelete = (identity, requestPath, targetApp = app) => request(targetApp)
  .delete(requestPath)
  .set(signedHeaders(identity, 'DELETE', requestPath));

const privateObjectNames = async () => {
  const entries = await fs.readdir(privateRoot, { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
};

const incomingNames = async () => fs.readdir(path.join(privateRoot, '.incoming')).catch(() => []);

const insertIdentityFixtures = async () => {
  await FamilyUser.collection.insertMany([
    {
      _id: PARENT_A_ID,
      username: 'parent-a',
      password: 'unused-hash',
      email: 'parent-a@example.com',
      name: 'Parent A',
      role: 'parent',
      familyId: FAMILY_A_ID
    },
    {
      _id: CHILD_A1_ID,
      username: 'child-a1',
      password: 'unused-hash',
      email: 'child-a1@example.com',
      name: 'Child A1',
      role: 'student',
      familyId: FAMILY_A_ID,
      childProfile: { tokenVersion: 0 }
    },
    {
      _id: CHILD_A2_ID,
      username: 'child-a2',
      password: 'unused-hash',
      email: 'child-a2@example.com',
      name: 'Child A2',
      role: 'student',
      familyId: FAMILY_A_ID,
      childProfile: { tokenVersion: 0 }
    },
    {
      _id: CHILD_B1_ID,
      username: 'child-b1',
      password: 'unused-hash',
      email: 'child-b1@example.com',
      name: 'Child B1',
      role: 'student',
      familyId: FAMILY_B_ID,
      childProfile: { tokenVersion: 0 }
    }
  ]);
};

const buildApp = ({
  MediaAssetModel = MediaAsset,
  mediaStoreOverride = mediaStore,
  scanner = null,
  securityProfile = 'trusted-local'
} = {}) => {
  const { createPrivateMediaUpload } = require('../middleware/privateMediaUpload');
  const { createMediaService } = require('../services/mediaService');
  const { createMediaRouter } = require('../routes/media');
  const localUpload = createPrivateMediaUpload({ privateRoot });
  const capabilityService = createMediaCapabilityService({
    secret: 'test-media-signing-secret-at-least-32-characters',
    maxAgeSeconds: 300,
    now: () => nowMs,
    randomUUID: () => CAPABILITY_NONCE
  });
  const transactionRunner = createMongoTransactionRunner(mongoose.connection);
  const localReferenceService = createMediaReferenceService({
    MediaAssetModel,
    MediaReferenceModel: MediaReference,
    leaseSeconds: 900,
    now: () => nowMs,
    transactionRunner
  });
  const mediaService = createMediaService({
    capabilityService,
    MediaAssetModel,
    MediaReferenceModel: MediaReference,
    UserModel: FamilyUser,
    mediaStore: mediaStoreOverride,
    now: () => nowMs,
    scanner,
    securityProfile,
    transactionRunner
  });
  const router = createMediaRouter({
    authenticate: authenticateGateway,
    fsPromises: fs,
    mediaService,
    upload: localUpload
  });
  const testApp = express();
  testApp.locals.logger = logger;
  testApp.locals.serviceName = 'resource-service-test';
  testApp.locals.userModel = FamilyUser;
  testApp.use(requestTracker);
  testApp.use('/api/media', router);
  testApp.use(errorHandler);
  return { app: testApp, referenceService: localReferenceService, upload: localUpload };
};

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
  await mongoose.connect(mongoServer.getUri());
  privateRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'family-media-api-'));
  mediaStore = createPrivateMediaStore({ root: privateRoot });
  ({ app, referenceService } = buildApp());
});

beforeEach(async () => {
  nowMs = FIXED_NOW;
  resetIdentityNonceStore();
  logger.debug.mockClear();
  logger.error.mockClear();
  logger.info.mockClear();
  logger.warn.mockClear();
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
  await fs.rm(privateRoot, { recursive: true, force: true });
  await fs.mkdir(privateRoot, { recursive: true, mode: 0o700 });
  await insertIdentityFixtures();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  if (privateRoot) await fs.rm(privateRoot, { recursive: true, force: true });
});

describe('Task 6 private media upload API', () => {
  test('TC-MPA-MEDIA-010 restores UTF-8 multipart filenames without corrupting ambiguous Latin-1', async () => {
    const utf8Name = '训练计划.pdf';
    const multerMojibake = Buffer.from(utf8Name, 'utf8').toString('latin1');

    expect(normalizeUploadFilename(multerMojibake)).toBe(utf8Name);
    expect(normalizeUploadFilename('plain-name.pdf')).toBe('plain-name.pdf');
    expect(normalizeUploadFilename('café.pdf')).toBe('café.pdf');

    const response = await signedUpload({
      purpose: 'task_attachment',
      childId: CHILD_A1_ID,
      bytes: await pdf(),
      filename: utf8Name,
      contentType: 'application/pdf'
    });

    expect(response.status).toBe(201);
    expect(response.body.data.media.displayName).toBe(utf8Name);
  });

  test('resolves current family for a parent token issued before family creation', async () => {
    const response = await signedUpload({
      identity: { id: PARENT_A_ID.toString(), role: 'parent' },
      purpose: 'task_attachment',
      childId: CHILD_A1_ID,
      bytes: await image('jpeg')
    });

    expect(response.status).toBe(201);
    expect(response.body.data.media).toEqual(expect.objectContaining({
      mediaId: expect.any(String),
      purpose: 'task_attachment'
    }));
  });

  test.each([
    ['avatar', null],
    ['avatar', CHILD_A1_ID],
    ['task_attachment', CHILD_A1_ID],
    ['task_completion', CHILD_A1_ID],
    ['mistake_question', CHILD_A1_ID],
    ['mistake_answer', CHILD_A1_ID],
    ['growth_evidence', CHILD_A1_ID]
  ])('TC-T6-MEDIA-001 parent uploads %s for child scope %s', async (purpose, childId) => {
    const response = await signedUpload({
      purpose,
      childId,
      bytes: await image('jpeg')
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: {
        media: {
          mediaId: expect.any(String),
          purpose,
          displayName: 'untrusted-name.bin',
          mimeType: 'image/jpeg',
          sizeBytes: expect.any(Number)
        }
      }
    });
    expect(JSON.stringify(response.body)).not.toMatch(/storageKey|original|filename|url/i);

    const persisted = await MediaAsset.findById(response.body.data.media.mediaId).lean();
    expect(persisted.familyId).toEqual(FAMILY_A_ID);
    expect(persisted.childId).toEqual(childId);
    expect(persisted.uploadedBy).toEqual(PARENT_A_ID);
    expect(persisted.status).toBe('active');
    expect(await mediaStore.read(persisted.storageKey)).toEqual(expect.any(Buffer));
    expect(await incomingNames()).toEqual([]);
  });

  test.each([
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp']
  ])('TC-T6-MEDIA-001 detects %s from bytes rather than extension or client MIME', async (format, mimeType) => {
    const response = await signedUpload({
      purpose: 'growth_evidence',
      childId: CHILD_A1_ID,
      bytes: await image(format),
      filename: 'spoofed.txt',
      contentType: 'text/plain'
    });

    expect(response.status).toBe(201);
    expect(response.body.data.media.mimeType).toBe(mimeType);
  });

  test('TC-MPA-MEDIA-001 persists canonical PDF metadata and rejects an image-only purpose', async () => {
    const response = await signedUpload({
      purpose: 'mistake_question',
      childId: CHILD_A1_ID,
      bytes: await pdf(2),
      filename: 'question.bin',
      contentType: 'application/octet-stream'
    });

    expect(response.status).toBe(201);
    expect(response.body.data.media).toEqual(expect.objectContaining({
      mimeType: 'application/pdf',
      displayName: 'question.bin',
      pageCount: 2
    }));
    const asset = await MediaAsset.findById(response.body.data.media.mediaId).lean();
    expect(asset).toEqual(expect.objectContaining({ mimeType: 'application/pdf', pageCount: 2 }));
    expect((await mediaStore.read(asset.storageKey)).subarray(0, 5).toString('ascii')).toBe('%PDF-');

    const rejected = await signedUpload({
      purpose: 'growth_evidence',
      childId: CHILD_A1_ID,
      bytes: await pdf(),
      filename: 'evidence.pdf',
      contentType: 'application/pdf'
    });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe('MEDIA_TYPE_NOT_ALLOWED');
    expect(await privateObjectNames()).toHaveLength(1);
  });

  test('TC-MPA-SCAN-002 trusted-local records an explicit skip without contacting a scanner', async () => {
    const scanner = { scan: jest.fn(() => { throw new Error('scanner must not be called'); }) };
    const trustedApp = buildApp({ scanner, securityProfile: 'trusted-local' }).app;

    const response = await signedUpload({
      targetApp: trustedApp,
      purpose: 'mistake_question',
      childId: CHILD_A1_ID,
      bytes: await pdf(),
      filename: 'question.pdf'
    });

    expect(response.status).toBe(201);
    expect(scanner.scan).not.toHaveBeenCalled();
    const asset = await MediaAsset.findById(response.body.data.media.mediaId).lean();
    expect(asset.malwareScanStatus).toBe('skipped_trusted_local');
    expect(asset.malwareScannedAt).toBeNull();
  });

  test('TC-MPA-SCAN-003 secure-production scans exact canonical bytes before persistence', async () => {
    const scanner = { scan: jest.fn().mockResolvedValue(undefined) };
    const secureApp = buildApp({ scanner, securityProfile: 'secure-production' }).app;
    const original = await image('jpeg', true);

    const response = await signedUpload({
      targetApp: secureApp,
      purpose: 'mistake_question',
      childId: CHILD_A1_ID,
      bytes: original,
      filename: 'question.jpg'
    });

    expect(response.status).toBe(201);
    const asset = await MediaAsset.findById(response.body.data.media.mediaId).lean();
    const stored = await mediaStore.read(asset.storageKey);
    expect(scanner.scan).toHaveBeenCalledTimes(1);
    expect(scanner.scan).toHaveBeenCalledWith(stored);
    expect(scanner.scan.mock.calls[0][0]).not.toEqual(original);
    expect(asset.malwareScanStatus).toBe('clean');
    expect(asset.malwareScannedAt).toEqual(new Date(FIXED_NOW));
  });

  test('TC-MPA-SCAN-004 secure-production scan rejection leaves no media or stored object', async () => {
    const scanner = {
      scan: jest.fn().mockRejectedValue(new AppError(
        'Malware detected',
        422,
        'MALWARE_DETECTED',
        true,
        []
      ))
    };
    const secureApp = buildApp({ scanner, securityProfile: 'secure-production' }).app;

    const response = await signedUpload({
      targetApp: secureApp,
      purpose: 'mistake_question',
      childId: CHILD_A1_ID,
      bytes: await image('png')
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('MALWARE_DETECTED');
    expect(await MediaAsset.countDocuments()).toBe(0);
    expect(await privateObjectNames()).toEqual([]);
    expect(await incomingNames()).toEqual([]);
  });

  test('TC-MPA-SCAN-005 secure-production scanner failure returns 503 and fails before storage', async () => {
    const scanner = {
      scan: jest.fn().mockRejectedValue(new AppError(
        'Malware scanner unavailable',
        503,
        'MALWARE_SCANNER_UNAVAILABLE',
        true,
        []
      ))
    };
    const secureApp = buildApp({ scanner, securityProfile: 'secure-production' }).app;

    const response = await signedUpload({
      targetApp: secureApp,
      purpose: 'mistake_answer',
      childId: CHILD_A1_ID,
      bytes: await image('webp')
    });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'MALWARE_SCANNER_UNAVAILABLE',
        message: 'Malware scanner unavailable',
        details: []
      },
      requestId: expect.any(String)
    });
    expect(await MediaAsset.countDocuments()).toBe(0);
    expect(await privateObjectNames()).toEqual([]);
  });

  test('TC-T6-MEDIA-002 rejects invalid images and cleans all files and metadata', async () => {
    const inputs = [
      { bytes: null, filename: 'missing.jpg', contentType: 'image/jpeg', status: 400, code: 'VALIDATION_ERROR' },
      {
        bytes: Buffer.from('not-an-image'),
        filename: 'corrupt.jpg',
        contentType: 'image/jpeg',
        status: 400,
        code: 'MEDIA_TYPE_NOT_ALLOWED'
      },
      {
        bytes: await image('gif'),
        filename: 'unsupported.gif',
        contentType: 'image/gif',
        status: 400,
        code: 'MEDIA_TYPE_NOT_ALLOWED'
      },
      {
        bytes: Buffer.alloc(MAX_MEDIA_BYTES + 1),
        filename: 'oversized.jpg',
        contentType: 'image/jpeg',
        status: 413,
        code: 'MEDIA_TOO_LARGE'
      }
    ];

    for (const input of inputs) {
      resetIdentityNonceStore();
      const { status, code, ...uploadInput } = input;
      const response = await signedUpload({
        purpose: 'growth_evidence',
        childId: CHILD_A1_ID,
        ...uploadInput
      });
      expect(response.status).toBe(status);
      expect(response.body.error.code).toBe(code);
      expect(await MediaAsset.countDocuments()).toBe(0);
      expect(await privateObjectNames()).toEqual([]);
      expect(await incomingNames()).toEqual([]);
    }
  });

  test.each(['jpeg', 'webp'])('TC-T6-MEDIA-003 strips EXIF from persisted %s bytes', async (format) => {
    const original = await image(format, true);
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const response = await signedUpload({
      purpose: 'growth_evidence',
      childId: CHILD_A1_ID,
      bytes: original
    });

    expect(response.status).toBe(201);
    const persisted = await MediaAsset.findById(response.body.data.media.mediaId).lean();
    const metadata = await sharp(await mediaStore.read(persisted.storageKey)).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });

  test('TC-T6-MEDIA-004 rejects child sibling targets and parent-only purposes', async () => {
    for (const childId of [CHILD_A2_ID, CHILD_B1_ID]) {
      resetIdentityNonceStore();
      const response = await signedUpload({
        identity: childA1,
        purpose: 'growth_evidence',
        childId,
        bytes: await image('jpeg')
      });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CHILD_ACCESS_DENIED');
    }

    for (const purpose of ['avatar', 'task_attachment']) {
      resetIdentityNonceStore();
      const response = await signedUpload({
        identity: childA1,
        purpose,
        childId: CHILD_A1_ID,
        bytes: await image('jpeg')
      });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CHILD_ACCESS_DENIED');
    }

    expect(await MediaAsset.countDocuments()).toBe(0);
    expect(await privateObjectNames()).toEqual([]);
  });

  test('TC-T6-MEDIA-004 rejects a parent targeting another family child', async () => {
    const response = await signedUpload({
      purpose: 'growth_evidence',
      childId: CHILD_B1_ID,
      bytes: await image('jpeg')
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CHILD_ACCESS_DENIED');
    expect(await MediaAsset.countDocuments()).toBe(0);
    expect(await privateObjectNames()).toEqual([]);
  });

  test.each(['task_completion', 'mistake_question', 'mistake_answer', 'growth_evidence'])(
    'TC-T6-MEDIA-005 child omission resolves to self for %s',
    async (purpose) => {
      const response = await signedUpload({
        identity: childA1,
        purpose,
        bytes: await image('png')
      });

      expect(response.status).toBe(201);
      const persisted = await MediaAsset.findById(response.body.data.media.mediaId).lean();
      expect(persisted.childId).toEqual(CHILD_A1_ID);
      expect(persisted.uploadedBy).toEqual(CHILD_A1_ID);
    }
  );

  test('removes the private object when MediaAsset persistence fails', async () => {
    const failingModel = {
      create: jest.fn().mockRejectedValue(new Error('simulated metadata failure'))
    };
    const failingApp = buildApp({ MediaAssetModel: failingModel }).app;

    const response = await signedUpload({
      purpose: 'growth_evidence',
      childId: CHILD_A1_ID,
      bytes: await image('jpeg'),
      targetApp: failingApp
    });

    expect(response.status).toBe(500);
    expect(failingModel.create).toHaveBeenCalledTimes(1);
    expect(await privateObjectNames()).toEqual([]);
    expect(await incomingNames()).toEqual([]);
  });

  test('TC-MPA-MEDIA-007 retries transient private-object cleanup failures', async () => {
    const failingModel = {
      create: jest.fn().mockRejectedValue(new Error('simulated metadata failure'))
    };
    let removeAttempts = 0;
    const retryingStore = {
      ...mediaStore,
      writeCanonical: mediaStore.writeCanonical,
      read: mediaStore.read,
      remove: jest.fn(async (storageKey) => {
        removeAttempts += 1;
        if (removeAttempts < 3) throw new Error('simulated transient storage failure');
        return mediaStore.remove(storageKey);
      })
    };
    const failingApp = buildApp({
      MediaAssetModel: failingModel,
      mediaStoreOverride: retryingStore
    }).app;

    const response = await signedUpload({
      purpose: 'growth_evidence',
      childId: CHILD_A1_ID,
      bytes: await image('jpeg'),
      targetApp: failingApp
    });

    expect(response.status).toBe(500);
    expect(retryingStore.remove).toHaveBeenCalledTimes(3);
    expect(await privateObjectNames()).toEqual([]);
  });
});

describe('Task 6 private media access API', () => {
  const uploadMedia = async ({
    identity = parentA,
    purpose = 'growth_evidence',
    childId = CHILD_A1_ID,
    format = 'jpeg'
  } = {}) => {
    const response = await signedUpload({
      identity,
      purpose,
      childId,
      bytes: await image(format)
    });
    expect(response.status).toBe(201);
    return MediaAsset.findById(response.body.data.media.mediaId).lean();
  };

  test('TC-T6-MEDIA-006 returns a no-store capability without storage metadata', async () => {
    const asset = await uploadMedia();
    resetIdentityNonceStore();
    const accessPath = `/api/media/${asset._id}/access`;

    const response = await signedGet(parentA, accessPath);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      success: true,
      data: {
        access: {
          url: expect.stringMatching(new RegExp(`^/api/media/${asset._id}/content\\?`)),
          expiresAt: FIXED_EXPIRY
        },
        media: {
          mediaId: asset._id.toString(),
          mimeType: asset.mimeType,
          displayName: asset.displayName,
          sizeBytes: asset.sizeBytes
        }
      }
    });
    expect(JSON.stringify(response.body)).not.toMatch(/storageKey/);
  });

  test('TC-MPA-MEDIA-009 returns a safe public descriptor without storage metadata', async () => {
    const upload = await signedUpload({
      purpose: 'mistake_question',
      childId: CHILD_A1_ID,
      bytes: await image('png'),
      filename: 'question.png',
      contentType: 'image/png'
    });

    expect(upload.status).toBe(201);
    expect(upload.body.data.media).toEqual(expect.objectContaining({
      mediaId: expect.any(String),
      purpose: 'mistake_question',
      displayName: 'question.png',
      mimeType: 'image/png',
      sizeBytes: expect.any(Number)
    }));
    expect(upload.body.data.media).not.toHaveProperty('storageKey');

    resetIdentityNonceStore();
    const access = await signedGet(parentA, `/api/media/${upload.body.data.media.mediaId}/access`);

    expect(access.status).toBe(200);
    expect(access.body.data.media).toEqual({
      mediaId: upload.body.data.media.mediaId,
      displayName: 'question.png',
      mimeType: 'image/png',
      sizeBytes: upload.body.data.media.sizeBytes
    });
    expect(JSON.stringify(access.body.data.media)).not.toMatch(/storageKey|uploadedBy|familyId|childId/i);
  });

  test('TC-T6-MEDIA-007 streams exact sanitized bytes with private response headers', async () => {
    const asset = await uploadMedia({ format: 'webp' });
    const expectedBytes = await mediaStore.read(asset.storageKey);
    resetIdentityNonceStore();
    const access = await signedGet(parentA, `/api/media/${asset._id}/access`);

    const response = await request(app).get(access.body.data.access.url);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expectedBytes);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['content-disposition']).toBe('inline');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-type']).toMatch(/^image\/webp/);
  });

  test('TC-MPA-SCAN-009 normalizes a raw legacy asset during access', async () => {
    const legacyId = new mongoose.Types.ObjectId();
    await MediaAsset.collection.insertOne({
      _id: legacyId,
      familyId: FAMILY_A_ID,
      childId: CHILD_A1_ID,
      uploadedBy: PARENT_A_ID,
      purpose: 'mistake_question',
      mimeType: 'image/png',
      sizeBytes: 128,
      storageKey: '26d9a5ee-e3f8-4d46-847d-b30dd22f88bc',
      status: 'active'
    });
    const normalize = jest.spyOn(MediaAsset, 'normalizeAuditFields');
    resetIdentityNonceStore();

    const response = await signedGet(parentA, `/api/media/${legacyId}/access`);

    expect(response.status).toBe(200);
    expect(normalize).toHaveBeenCalledWith(expect.not.objectContaining({ malwareScanStatus: expect.anything() }));
    expect(normalize.mock.results[0].value).toEqual(expect.objectContaining({
      malwareScanStatus: 'legacy_unscanned',
      malwareScannedAt: null
    }));
  });

  test('TC-MPA-MEDIA-009 keeps image content inline and prepares PDF attachment disposition', async () => {
    const { createMediaRouter } = require('../routes/media');
    const contentService = {
      upload: jest.fn(),
      deleteMedia: jest.fn(),
      issueAccess: jest.fn(),
      readContent: jest.fn().mockResolvedValue({
        bytes: Buffer.from('%PDF-1.7'),
        mimeType: 'application/pdf',
        displayName: '期中\u0085\u202e试卷第3题.pdf'
      })
    };
    const contentApp = express();
    contentApp.use('/api/media', createMediaRouter({
      authenticate: (_req, _res, next) => next(),
      mediaService: contentService,
      upload: { singleImage: (_req, _res, next) => next(), removeTemporary: jest.fn() }
    }));

    const response = await request(contentApp).get('/api/media/6656875da7f86a0012c2a301/content');

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toBe("attachment; filename*=UTF-8''%E6%9C%9F%E4%B8%AD%E8%AF%95%E5%8D%B7%E7%AC%AC3%E9%A2%98.pdf");
    expect(contentService.readContent).toHaveBeenCalledWith(expect.objectContaining({
      mediaId: '6656875da7f86a0012c2a301'
    }));
  });

  test('TC-T6-MEDIA-007 rejects every tampered or expired capability component', async () => {
    const asset = await uploadMedia();
    resetIdentityNonceStore();
    const access = await signedGet(parentA, `/api/media/${asset._id}/access`);
    const original = new URL(access.body.data.access.url, 'http://local.test');
    const alternateId = '6656875da7f86a0012c2afff';
    const cases = [];

    const trailingSlash = new URL(original);
    trailingSlash.pathname += '/';
    cases.push(trailingSlash);

    const mediaId = new URL(original);
    mediaId.pathname = mediaId.pathname.replace(asset._id.toString(), alternateId);
    cases.push(mediaId);

    const expires = new URL(original);
    expires.searchParams.set('expires', String(Number(expires.searchParams.get('expires')) + 1));
    cases.push(expires);

    const nonce = new URL(original);
    nonce.searchParams.set('nonce', 'aada6183-e6e1-47d8-a81d-2f9d834320d4');
    cases.push(nonce);

    const signature = new URL(original);
    signature.searchParams.set('signature', '0'.repeat(64));
    cases.push(signature);

    for (const tampered of cases) {
      const response = await request(app).get(`${tampered.pathname}${tampered.search}`);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.data).toBeUndefined();
    }

    nowMs = FIXED_NOW + 301_000;
    const expired = await request(app).get(`${original.pathname}${original.search}`);
    expect(expired.status).toBe(400);
    expect(expired.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('TC-T6-MEDIA-008 rejects cross-family and sibling access', async () => {
    const asset = await uploadMedia();
    const accessPath = `/api/media/${asset._id}/access`;

    for (const identity of [parentB, childA2]) {
      resetIdentityNonceStore();
      const response = await signedGet(identity, accessPath);
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CHILD_ACCESS_DENIED');
      expect(response.body.data).toBeUndefined();
    }
  });

  test('TC-T6-MEDIA-008 rejects child access to a family-scoped avatar', async () => {
    const asset = await uploadMedia({ purpose: 'avatar', childId: null });
    resetIdentityNonceStore();

    const response = await signedGet(childA1, `/api/media/${asset._id}/access`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CHILD_ACCESS_DENIED');
    expect(response.body.data).toBeUndefined();
  });

  test('TC-T6-MEDIA-006 returns not found for a missing media ID', async () => {
    const missingId = '6656875da7f86a0012c2afff';
    const response = await signedGet(parentA, `/api/media/${missingId}/access`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  test('production error envelope is returned by the shared handler', async () => {
    const response = await signedGet(parentA, '/api/media/not-an-object-id/access');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid mediaId',
        details: []
      },
      requestId: expect.any(String)
    });
  });
});

describe('Task 6 private media delete API', () => {
  const uploadMedia = async ({ purpose = 'growth_evidence', childId = CHILD_A1_ID } = {}) => {
    const response = await signedUpload({
      purpose,
      childId,
      bytes: await image('jpeg')
    });
    expect(response.status).toBe(201);
    return MediaAsset.findById(response.body.data.media.mediaId).lean();
  };

  test('TC-T6-MEDIA-009 soft delete is idempotent and immediately denies access and content', async () => {
    const asset = await uploadMedia();
    const preparedOperation = '9bf7c3f3-cc6d-41fe-95b5-b2832aafd394';
    const boundOperation = 'acf8d404-dd7e-42af-a6c6-c3943bb0e405';
    const originalBytes = await mediaStore.read(asset.storageKey);
    await MediaReference.create([
      {
        familyId: FAMILY_A_ID,
        childId: CHILD_A1_ID,
        mediaId: asset._id,
        resourceType: 'family_mistake',
        resourceId: new mongoose.Types.ObjectId(),
        field: 'questionMediaId',
        operationId: preparedOperation,
        state: 'prepared',
        leaseExpiresAt: new Date(FIXED_NOW + 900_000)
      },
      {
        familyId: FAMILY_A_ID,
        childId: CHILD_A1_ID,
        mediaId: asset._id,
        resourceType: 'family_mistake',
        resourceId: new mongoose.Types.ObjectId(),
        field: 'childAnswerMediaId',
        operationId: boundOperation,
        state: 'bound',
        leaseExpiresAt: null
      }
    ]);
    resetIdentityNonceStore();
    const access = await signedGet(parentA, `/api/media/${asset._id}/access`);
    const contentUrl = access.body.data.access.url;
    const deletePath = `/api/media/${asset._id}`;
    resetIdentityNonceStore();

    const firstDelete = await signedDelete(parentA, deletePath);

    expect(firstDelete.status).toBe(204);
    expect(firstDelete.text).toBe('');
    const deleted = await MediaAsset.findById(asset._id).lean();
    expect(deleted.status).toBe('deleted');
    expect(deleted.deletedAt).toEqual(new Date(FIXED_NOW));
    expect(await mediaStore.read(asset.storageKey)).toEqual(originalBytes);
    const prepared = await MediaReference.findOne({ operationId: preparedOperation }).lean();
    const bound = await MediaReference.findOne({ operationId: boundOperation }).lean();
    expect(prepared.state).toBe('released');
    expect(prepared.releasedAt).toEqual(new Date(FIXED_NOW));
    expect(bound.state).toBe('bound');
    await expect(referenceService.prepare({
      familyId: FAMILY_A_ID.toString(),
      childId: CHILD_A1_ID.toString(),
      resourceType: 'family_mistake',
      resourceId: prepared.resourceId.toString(),
      operationId: preparedOperation,
      references: [{ mediaId: asset._id.toString(), field: 'questionMediaId' }]
    })).rejects.toMatchObject({ statusCode: 404, code: 'RESOURCE_NOT_FOUND' });

    nowMs += 60_000;
    resetIdentityNonceStore();
    const secondDelete = await signedDelete(parentA, deletePath);
    expect(secondDelete.status).toBe(204);
    expect((await MediaAsset.findById(asset._id).lean()).deletedAt).toEqual(new Date(FIXED_NOW));
    expect((await MediaReference.findOne({ operationId: preparedOperation }).lean()).releasedAt)
      .toEqual(new Date(FIXED_NOW));

    resetIdentityNonceStore();
    const deniedAccess = await signedGet(parentA, `/api/media/${asset._id}/access`);
    expect(deniedAccess.status).toBe(404);
    expect(deniedAccess.body.error.code).toBe('RESOURCE_NOT_FOUND');

    const deniedContent = await request(app).get(contentUrl);
    expect(deniedContent.status).toBe(404);
    expect(deniedContent.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  test('TC-T6-MEDIA-009 rejects cross-family and sibling deletion', async () => {
    const asset = await uploadMedia();
    const deletePath = `/api/media/${asset._id}`;

    for (const identity of [parentB, childA2]) {
      resetIdentityNonceStore();
      const response = await signedDelete(identity, deletePath);
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CHILD_ACCESS_DENIED');
    }
    expect((await MediaAsset.findById(asset._id).lean()).status).toBe('active');
  });

  test('TC-T6-MEDIA-009 rejects child deletion of a family-scoped avatar', async () => {
    const asset = await uploadMedia({ purpose: 'avatar', childId: null });
    resetIdentityNonceStore();

    const response = await signedDelete(childA1, `/api/media/${asset._id}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CHILD_ACCESS_DENIED');
    expect((await MediaAsset.findById(asset._id).lean()).status).toBe('active');
  });
});

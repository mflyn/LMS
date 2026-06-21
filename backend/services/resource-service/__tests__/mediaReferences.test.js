process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('../../../../node_modules/mongodb-memory-server');

const { errorHandler } = require('../../../common/middleware/errorHandler');
const MediaAsset = require('../models/MediaAsset');
const MediaReference = require('../models/MediaReference');
const { createMediaReferenceCredential, digest } = require('../middleware/mediaReferenceCredential');
const { createInternalMediaReferencesRouter } = require('../routes/internalMediaReferences');
const { createMediaReferenceService } = require('../services/mediaReferenceService');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');

jest.setTimeout(30000);

const SERVICE_TOKEN = 'test-media-reference-service-token-32-characters';
const FAMILY_ID = new mongoose.Types.ObjectId('6656875da7f86a0012c2a101');
const OTHER_FAMILY_ID = new mongoose.Types.ObjectId('6656875da7f86a0012c2a102');
const CHILD_ID = new mongoose.Types.ObjectId('6656875da7f86a0012c2a301');
const OTHER_CHILD_ID = new mongoose.Types.ObjectId('6656875da7f86a0012c2a302');
const RESOURCE_ID = new mongoose.Types.ObjectId('6656875da7f86a0012c2a501');
const OPERATION_1 = '5dc38fc9-ee29-4dba-9181-df49f66b9050';
const OPERATION_2 = '6ec49fd0-ff3a-4ecb-a292-ef50f77ca061';
const FIXED_NOW = Date.parse('2026-06-21T00:00:00.000Z');
const LEASE_EXPIRES_AT = new Date(FIXED_NOW + 900_000).toISOString();

let app;
let mongoServer;
let nowMs = FIXED_NOW;
let referenceService;

const createAsset = (purpose, overrides = {}) => MediaAsset.create({
  familyId: FAMILY_ID,
  childId: CHILD_ID,
  uploadedBy: new mongoose.Types.ObjectId(),
  purpose,
  mimeType: 'image/jpeg',
  sizeBytes: 100,
  storageKey: require('crypto').randomUUID(),
  status: 'active',
  ...overrides
});

const commandFor = (asset, overrides = {}) => ({
  familyId: FAMILY_ID.toString(),
  childId: CHILD_ID.toString(),
  resourceType: 'family_mistake',
  resourceId: RESOURCE_ID.toString(),
  operationId: OPERATION_1,
  references: [{ mediaId: asset._id.toString(), field: 'questionMediaId' }],
  ...overrides
});

const postCommand = (action, command, token = SERVICE_TOKEN) => {
  let operation = request(app).post(`/api/internal/media/references/${action}`);
  if (token !== null) operation = operation.set('x-service-token', token);
  return operation.send(command);
};

const buildApp = () => {
  const transactionRunner = createMongoTransactionRunner(mongoose.connection);
  referenceService = createMediaReferenceService({
    MediaAssetModel: MediaAsset,
    MediaReferenceModel: MediaReference,
    leaseSeconds: 900,
    now: () => nowMs,
    transactionRunner
  });
  const credential = createMediaReferenceCredential(SERVICE_TOKEN);
  const router = createInternalMediaReferencesRouter({ credential, referenceService });
  const testApp = express();
  testApp.locals.logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
  testApp.locals.serviceName = 'resource-service-test';
  testApp.use(express.json());
  testApp.use('/api/internal/media/references', router);
  testApp.use(errorHandler);
  return testApp;
};

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
  await mongoose.connect(mongoServer.getUri());
  app = buildApp();
});

beforeEach(async () => {
  nowMs = FIXED_NOW;
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe('Task 6 media reference credential', () => {
  test('TC-T6-MEDIA-011 rejects configured service credentials shorter than 32 characters', () => {
    expect(() => createMediaReferenceCredential('short')).toThrow('MEDIA_REFERENCE_SERVICE_TOKEN');
  });

  test('TC-T6-MEDIA-011 credential digests have constant length', () => {
    expect(digest('x')).toHaveLength(32);
    expect(digest(SERVICE_TOKEN)).toHaveLength(32);
  });

  test.each(['prepare', 'commit', 'unbind'])(
    'TC-T6-MEDIA-011 rejects absent, short, and invalid credentials for %s',
    async (action) => {
      const asset = await createAsset('mistake_question');
      for (const token of [null, 'short', 'incorrect-media-reference-token-32-chars']) {
        const response = await postCommand(action, commandFor(asset), token);
        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('INVALID_SERVICE_CREDENTIAL');
      }
      expect(await MediaReference.countDocuments()).toBe(0);
    }
  );

  test('TC-T6-MEDIA-011 valid credential reaches prepare', async () => {
    const asset = await createAsset('mistake_question');
    const response = await postCommand('prepare', commandFor(asset));

    expect(response.status).toBe(200);
    expect(response.body.data.references).toEqual([
      expect.objectContaining({
        mediaId: asset._id.toString(),
        field: 'questionMediaId',
        state: 'prepared',
        leaseExpiresAt: LEASE_EXPIRES_AT
      })
    ]);
  });
});

describe('Task 6 media reference state machine', () => {
  test('TC-T6-MEDIA-012 prepare, commit, and unbind replays converge on one row', async () => {
    const asset = await createAsset('mistake_question');
    const command = commandFor(asset);

    const prepared = await postCommand('prepare', command);
    const preparedReplay = await postCommand('prepare', command);
    expect(prepared.status).toBe(200);
    expect(preparedReplay.status).toBe(200);
    expect(preparedReplay.body.data.references[0]).toEqual(prepared.body.data.references[0]);
    expect(await MediaReference.countDocuments()).toBe(1);

    const committed = await postCommand('commit', command);
    const committedReplay = await postCommand('commit', command);
    expect(committed.status).toBe(200);
    expect(committed.body.data.references[0]).toEqual(expect.objectContaining({ state: 'bound' }));
    expect(committedReplay.body.data.references[0]).toEqual(committed.body.data.references[0]);

    const unbound = await postCommand('unbind', command);
    const releasedAt = unbound.body.data.references[0].releasedAt;
    nowMs += 60_000;
    const unboundReplay = await postCommand('unbind', command);
    expect(unbound.status).toBe(200);
    expect(unbound.body.data.references[0]).toEqual(expect.objectContaining({ state: 'released' }));
    expect(unboundReplay.body.data.references[0].releasedAt).toBe(releasedAt);
    expect(await MediaReference.countDocuments()).toBe(1);
  });

  test('TC-T6-MEDIA-012 duplicate request references normalize to one row', async () => {
    const asset = await createAsset('mistake_question');
    const reference = { mediaId: asset._id.toString(), field: 'questionMediaId' };
    const response = await postCommand('prepare', commandFor(asset, {
      references: [reference, reference, { ...reference }]
    }));

    expect(response.status).toBe(200);
    expect(response.body.data.references).toHaveLength(1);
    expect(await MediaReference.countDocuments()).toBe(1);
  });

  test('TC-T6-MEDIA-012 commits a multi-field batch atomically', async () => {
    const question = await createAsset('mistake_question');
    const answer = await createAsset('mistake_answer');
    const command = commandFor(question, {
      references: [
        { mediaId: question._id.toString(), field: 'questionMediaId' },
        { mediaId: answer._id.toString(), field: 'childAnswerMediaId' }
      ]
    });

    expect((await postCommand('prepare', command)).status).toBe(200);
    const response = await postCommand('commit', command);

    expect(response.status).toBe(200);
    expect(response.body.data.references).toHaveLength(2);
    expect(response.body.data.references.every((item) => item.state === 'bound')).toBe(true);
    expect(await MediaReference.countDocuments({ state: 'bound' })).toBe(2);
  });

  test('a different live prepared operation conflicts', async () => {
    const asset = await createAsset('mistake_question');
    expect((await postCommand('prepare', commandFor(asset))).status).toBe(200);

    const response = await postCommand('prepare', commandFor(asset, { operationId: OPERATION_2 }));

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('RESOURCE_CONFLICT');
    expect((await MediaReference.findOne().lean()).operationId).toBe(OPERATION_1);
  });

  test('a released operation cannot resurrect but a new operation can prepare', async () => {
    const asset = await createAsset('mistake_question');
    const first = commandFor(asset);
    await postCommand('prepare', first);
    await postCommand('unbind', first);

    const replay = await postCommand('prepare', first);
    expect(replay.status).toBe(200);
    expect(replay.body.data.references[0].state).toBe('released');

    const second = await postCommand('prepare', commandFor(asset, { operationId: OPERATION_2 }));
    expect(second.status).toBe(200);
    expect(second.body.data.references[0].state).toBe('prepared');
    expect(await MediaReference.countDocuments()).toBe(1);
  });
});

describe('Task 6 media reference validation and lease recovery', () => {
  test('TC-T6-MEDIA-013 rejects missing and deleted media without rows', async () => {
    const missing = { _id: new mongoose.Types.ObjectId() };
    const missingResponse = await postCommand('prepare', commandFor(missing));
    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body.error.code).toBe('RESOURCE_NOT_FOUND');

    const deleted = await createAsset('mistake_question', {
      status: 'deleted',
      deletedAt: new Date(FIXED_NOW)
    });
    const deletedResponse = await postCommand('prepare', commandFor(deleted));
    expect(deletedResponse.status).toBe(404);
    expect(deletedResponse.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(await MediaReference.countDocuments()).toBe(0);
  });

  test('TC-T6-MEDIA-013 rejects wrong family and child without rows', async () => {
    const wrongFamily = await createAsset('mistake_question', { familyId: OTHER_FAMILY_ID });
    const familyResponse = await postCommand('prepare', commandFor(wrongFamily));
    expect(familyResponse.status).toBe(403);
    expect(familyResponse.body.error.code).toBe('CHILD_ACCESS_DENIED');

    const wrongChild = await createAsset('mistake_question', { childId: OTHER_CHILD_ID });
    const childResponse = await postCommand('prepare', commandFor(wrongChild));
    expect(childResponse.status).toBe(403);
    expect(childResponse.body.error.code).toBe('CHILD_ACCESS_DENIED');
    expect(await MediaReference.countDocuments()).toBe(0);
  });

  test('TC-T6-MEDIA-013 rejects wrong purpose and rolls back the whole batch', async () => {
    const valid = await createAsset('mistake_question');
    const wrongPurpose = await createAsset('growth_evidence');
    const response = await postCommand('prepare', commandFor(valid, {
      references: [
        { mediaId: valid._id.toString(), field: 'questionMediaId' },
        { mediaId: wrongPurpose._id.toString(), field: 'childAnswerMediaId' }
      ]
    }));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('MEDIA_PURPOSE_MISMATCH');
    expect(await MediaReference.countDocuments()).toBe(0);
  });

  test('TC-T6-MEDIA-014 reclaims only expired prepared references', async () => {
    const assets = await Promise.all([
      createAsset('mistake_question'),
      createAsset('mistake_question'),
      createAsset('mistake_question'),
      createAsset('mistake_question')
    ]);
    const base = (asset, field, operationId) => ({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      mediaId: asset._id,
      resourceType: 'family_mistake',
      resourceId: new mongoose.Types.ObjectId(),
      field,
      operationId
    });
    await MediaReference.create([
      {
        ...base(assets[0], 'questionMediaId', OPERATION_1),
        state: 'prepared',
        leaseExpiresAt: new Date(FIXED_NOW - 1)
      },
      {
        ...base(assets[1], 'questionMediaId', OPERATION_2),
        state: 'prepared',
        leaseExpiresAt: new Date(FIXED_NOW + 1)
      },
      {
        ...base(assets[2], 'questionMediaId', '7fd5a1e1-aa4b-4fdc-b393-f061088db172'),
        state: 'bound',
        leaseExpiresAt: null
      },
      {
        ...base(assets[3], 'questionMediaId', '8ae6b2f2-bb5c-40ed-84a4-a172199ec283'),
        state: 'released',
        leaseExpiresAt: null,
        releasedAt: new Date(FIXED_NOW - 1000)
      }
    ]);

    const first = await referenceService.reclaimExpiredPrepared({ limit: 10 });
    const replay = await referenceService.reclaimExpiredPrepared({ limit: 10 });

    expect(first).toEqual({ reclaimed: 1 });
    expect(replay).toEqual({ reclaimed: 0 });
    expect(await MediaReference.countDocuments({ state: 'prepared' })).toBe(1);
    expect(await MediaReference.countDocuments({ state: 'bound' })).toBe(1);
    expect(await MediaReference.countDocuments({ state: 'released' })).toBe(1);
  });
});

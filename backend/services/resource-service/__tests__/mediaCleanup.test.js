const fs = require('fs/promises');
const mongoose = require('mongoose');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { MongoMemoryServer } = require('../../../../node_modules/mongodb-memory-server');

const MediaAsset = require('../models/MediaAsset');
const MediaReference = require('../models/MediaReference');
const { createMediaCleanupService } = require('../services/mediaCleanupService');
const { createPrivateMediaStore } = require('../services/privateMediaStore');

jest.setTimeout(30000);

const NOW = Date.parse('2026-06-21T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const FAMILY_ID = new mongoose.Types.ObjectId('6656875da7f86a0012c2a101');
const CHILD_ID = new mongoose.Types.ObjectId('6656875da7f86a0012c2a301');

let cleanupService;
let mediaStore;
let mongoServer;
let privateRoot;

const image = () => sharp({
  create: {
    width: 4,
    height: 4,
    channels: 3,
    background: { r: 20, g: 40, b: 60 }
  }
}).jpeg().toBuffer();

const createDeletedAsset = async ({
  deletedDays,
  releaseDays,
  bound = false,
  missingBytes = false
}) => {
  const bytes = await image();
  const stored = await mediaStore.writeCanonical(bytes);
  const asset = await MediaAsset.create({
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    uploadedBy: new mongoose.Types.ObjectId(),
    purpose: 'mistake_question',
    mimeType: 'image/jpeg',
    sizeBytes: bytes.length,
    storageKey: stored.storageKey,
    status: 'deleted',
    deletedAt: new Date(NOW - deletedDays * DAY_MS)
  });
  if (missingBytes) await mediaStore.remove(stored.storageKey);

  if (bound) {
    await MediaReference.create({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      mediaId: asset._id,
      resourceType: 'family_mistake',
      resourceId: new mongoose.Types.ObjectId(),
      field: 'questionMediaId',
      operationId: require('crypto').randomUUID(),
      state: 'bound',
      leaseExpiresAt: null
    });
  }
  if (releaseDays !== undefined) {
    await MediaReference.create({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      mediaId: asset._id,
      resourceType: 'family_mistake',
      resourceId: new mongoose.Types.ObjectId(),
      field: 'questionMediaId',
      operationId: require('crypto').randomUUID(),
      state: 'released',
      leaseExpiresAt: null,
      releasedAt: new Date(NOW - releaseDays * DAY_MS)
    });
  }
  return asset;
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  privateRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'family-media-cleanup-'));
  mediaStore = createPrivateMediaStore({ root: privateRoot });
  cleanupService = createMediaCleanupService({
    MediaAssetModel: MediaAsset,
    MediaReferenceModel: MediaReference,
    mediaStore,
    now: () => NOW,
    retentionDays: 30
  });
});

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
  await fs.rm(privateRoot, { recursive: true, force: true });
  await fs.mkdir(privateRoot, { recursive: true, mode: 0o700 });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  if (privateRoot) await fs.rm(privateRoot, { recursive: true, force: true });
});

describe('Task 6 deleted media cleanup', () => {
  test('TC-T6-MEDIA-010 enforces deletion, bound-reference, and last-release boundaries', async () => {
    const deleted29 = await createDeletedAsset({ deletedDays: 29 });
    const deleted30 = await createDeletedAsset({ deletedDays: 30 });
    const stillBound = await createDeletedAsset({ deletedDays: 40, bound: true });
    const released29 = await createDeletedAsset({ deletedDays: 40, releaseDays: 29 });
    const released30 = await createDeletedAsset({ deletedDays: 40, releaseDays: 30 });
    const missingBytes = await createDeletedAsset({ deletedDays: 40, missingBytes: true });

    const result = await cleanupService.cleanupDeletedMedia({ limit: 100 });

    expect(result).toEqual({
      cleaned: 3,
      mediaIds: expect.arrayContaining([
        deleted30._id.toString(),
        released30._id.toString(),
        missingBytes._id.toString()
      ])
    });
    expect(result.mediaIds).toHaveLength(3);
    expect(await MediaAsset.exists({ _id: deleted29._id })).not.toBeNull();
    expect(await MediaAsset.exists({ _id: stillBound._id })).not.toBeNull();
    expect(await MediaAsset.exists({ _id: released29._id })).not.toBeNull();
    expect(await MediaAsset.exists({ _id: deleted30._id })).toBeNull();
    expect(await MediaAsset.exists({ _id: released30._id })).toBeNull();
    expect(await MediaAsset.exists({ _id: missingBytes._id })).toBeNull();
    expect(await MediaReference.countDocuments({ mediaId: released30._id })).toBe(0);
    expect(await MediaReference.countDocuments({ mediaId: stillBound._id, state: 'bound' })).toBe(1);
  });

  test('TC-T6-MEDIA-010 cleanup is idempotent when bytes are already absent', async () => {
    const asset = await createDeletedAsset({ deletedDays: 31, missingBytes: true });

    const first = await cleanupService.cleanupDeletedMedia();
    const replay = await cleanupService.cleanupDeletedMedia();

    expect(first).toEqual({ cleaned: 1, mediaIds: [asset._id.toString()] });
    expect(replay).toEqual({ cleaned: 0, mediaIds: [] });
  });

  test('rejects invalid cleanup limits', async () => {
    await expect(cleanupService.cleanupDeletedMedia({ limit: 0 }))
      .rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });
});

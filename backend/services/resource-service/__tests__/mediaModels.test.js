const mongoose = require('mongoose');
const { publicMediaDescriptor } = require('../services/mediaService');
let MediaAsset;
let MediaReference;

const loadModels = () => {
  MediaAsset = MediaAsset || require('../models/MediaAsset');
  MediaReference = MediaReference || require('../models/MediaReference');
};

const ids = {
  familyId: new mongoose.Types.ObjectId(),
  childId: new mongoose.Types.ObjectId(),
  uploadedBy: new mongoose.Types.ObjectId(),
  mediaId: new mongoose.Types.ObjectId(),
  resourceId: new mongoose.Types.ObjectId()
};

const validAsset = (overrides = {}) => ({
  familyId: ids.familyId,
  childId: ids.childId,
  uploadedBy: ids.uploadedBy,
  purpose: 'growth_evidence',
  mimeType: 'image/jpeg',
  sizeBytes: 1024,
  storageKey: '96f0a561-b3a5-43c7-9d30-f9da3548fd27',
  ...overrides
});

const findIndex = (schema, fields) => schema.indexes()
  .find(([actual]) => JSON.stringify(actual) === JSON.stringify(fields));

describe('Task 6 media models', () => {
  test('TC-T6-MEDIA-001 accepts all purposes and only avatar may omit childId', async () => {
    loadModels();
    const { MEDIA_PURPOSES } = MediaAsset;
    expect(MEDIA_PURPOSES).toEqual([
      'avatar',
      'task_attachment',
      'task_completion',
      'mistake_question',
      'mistake_answer',
      'growth_evidence'
    ]);

    for (const purpose of MEDIA_PURPOSES) {
      await expect(new MediaAsset(validAsset({ purpose })).validate()).resolves.toBeUndefined();
    }
    await expect(new MediaAsset(validAsset({ purpose: 'avatar', childId: null })).validate())
      .resolves.toBeUndefined();
    await expect(new MediaAsset(validAsset({ purpose: 'growth_evidence', childId: null })).validate())
      .rejects.toThrow('childId is required');
  });

  test('TC-T6-MEDIA-001 validates MIME, size, storage key, and deletion state', async () => {
    loadModels();
    const { MEDIA_MIME_TYPES, MAX_MEDIA_BYTES } = MediaAsset;
    expect(MEDIA_MIME_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
    expect(MAX_MEDIA_BYTES).toBe(10 * 1024 * 1024);

    await expect(new MediaAsset(validAsset({ mimeType: 'image/gif' })).validate()).rejects.toThrow();
    await expect(new MediaAsset(validAsset({ sizeBytes: 0 })).validate()).rejects.toThrow();
    await expect(new MediaAsset(validAsset({ sizeBytes: MAX_MEDIA_BYTES + 1 })).validate()).rejects.toThrow();
    await expect(new MediaAsset(validAsset({ storageKey: '../public/file.jpg' })).validate()).rejects.toThrow();
    await expect(new MediaAsset(validAsset({ status: 'deleted' })).validate())
      .rejects.toThrow('deletedAt is required');
    await expect(new MediaAsset(validAsset({ status: 'active', deletedAt: new Date() })).validate())
      .rejects.toThrow('deletedAt is only valid');
  });

  test('TC-MPA-MEDIA-006 sanitizes bounded display names and validates PDF metadata', async () => {
    loadModels();
    const originalName = '../untrusted\\question\u0000\u0085\u202e.png';
    const displayName = MediaAsset.sanitizeDisplayName(originalName);
    const longDisplayName = MediaAsset.sanitizeDisplayName(`${'测'.repeat(100)}.pdf`);

    expect(displayName).toBe('question.png');
    expect(displayName).not.toMatch(/[\\/\p{Cc}\p{Cf}]/u);
    expect(Buffer.byteLength(longDisplayName, 'utf8')).toBeLessThanOrEqual(255);
    expect(publicMediaDescriptor({
      _id: ids.mediaId,
      mimeType: 'image/png',
      displayName: originalName,
      sizeBytes: 1024
    })).toEqual({
      mediaId: ids.mediaId.toString(),
      mimeType: 'image/png',
      displayName: 'question.png',
      sizeBytes: 1024
    });
    await expect(new MediaAsset(validAsset({
      purpose: 'mistake_question',
      mimeType: 'application/pdf',
      displayName,
      pageCount: 2
    })).validate()).resolves.toBeUndefined();
    await expect(new MediaAsset(validAsset({
      purpose: 'growth_evidence',
      mimeType: 'application/pdf',
      displayName,
      pageCount: 2
    })).validate()).rejects.toThrow();
    await expect(new MediaAsset(validAsset({
      mimeType: 'image/png',
      displayName: 'question.png',
      pageCount: 1
    })).validate()).rejects.toThrow();
  });

  test('TC-MPA-SCAN-009 defaults legacy records to audit-only scan status', async () => {
    loadModels();
    const legacy = new MediaAsset(validAsset());

    await expect(legacy.validate()).resolves.toBeUndefined();
    expect(legacy.malwareScanStatus).toBe('legacy_unscanned');
    expect(legacy.malwareScannedAt).toBeNull();
    await expect(new MediaAsset(validAsset({
      malwareScanStatus: 'clean',
      malwareScannedAt: null
    })).validate()).rejects.toThrow('malwareScannedAt is required');
    await expect(new MediaAsset(validAsset({
      malwareScanStatus: 'skipped_trusted_local',
      malwareScannedAt: new Date()
    })).validate()).rejects.toThrow('malwareScannedAt is only valid');
  });

  test('TC-MPA-SCAN-009 normalizes audit fields on raw legacy records', () => {
    loadModels();
    const rawLegacyRecord = validAsset({ _id: ids.mediaId });

    expect(rawLegacyRecord.malwareScanStatus).toBeUndefined();
    expect(MediaAsset.normalizeAuditFields(rawLegacyRecord)).toEqual(expect.objectContaining({
      malwareScanStatus: 'legacy_unscanned',
      malwareScannedAt: null
    }));
  });

  test('TC-T6-MEDIA-001 uses approved family-first asset indexes', () => {
    loadModels();
    expect(findIndex(MediaAsset.schema, { familyId: 1, childId: 1, status: 1, createdAt: -1 })).toBeDefined();
    expect(findIndex(MediaAsset.schema, { familyId: 1, storageKey: 1 })[1]).toEqual(
      expect.objectContaining({ unique: true })
    );
    expect(findIndex(MediaAsset.schema, { status: 1, deletedAt: 1 })).toBeDefined();
  });

  test('TC-T6-MEDIA-012 validates reference lifecycle and family-first identity', async () => {
    loadModels();
    const prepared = new MediaReference({
      familyId: ids.familyId,
      childId: ids.childId,
      mediaId: ids.mediaId,
      resourceType: 'family_mistake',
      resourceId: ids.resourceId,
      field: 'questionMediaId',
      operationId: '5dc38fc9-ee29-4dba-9181-df49f66b9050',
      state: 'prepared',
      leaseExpiresAt: new Date(Date.now() + 60_000)
    });
    await expect(prepared.validate()).resolves.toBeUndefined();
    await expect(new MediaReference({ ...prepared.toObject(), leaseExpiresAt: null }).validate())
      .rejects.toThrow('leaseExpiresAt is required');
    await expect(new MediaReference({ ...prepared.toObject(), state: 'released', releasedAt: null }).validate())
      .rejects.toThrow('releasedAt is required');

    expect(findIndex(MediaReference.schema, {
      familyId: 1,
      mediaId: 1,
      resourceType: 1,
      resourceId: 1,
      field: 1
    })[1]).toEqual(expect.objectContaining({ unique: true }));
  });

  test('TC-T6-MEDIA-012A stores release operation independently and constrains its state', async () => {
    loadModels();
    const bindOperationId = '5dc38fc9-ee29-4dba-9181-df49f66b9050';
    const releaseOperationId = '8a9dc72a-558b-4818-b388-677862431377';
    const releasedAt = new Date('2026-06-21T00:00:00.000Z');
    const released = new MediaReference({
      familyId: ids.familyId,
      childId: ids.childId,
      mediaId: ids.mediaId,
      resourceType: 'child',
      resourceId: ids.childId,
      field: 'avatarMediaId',
      operationId: bindOperationId,
      releaseOperationId,
      state: 'released',
      releasedAt
    });

    await expect(released.validate()).resolves.toBeUndefined();
    expect(released.operationId).toBe(bindOperationId);
    expect(released.releaseOperationId).toBe(releaseOperationId);

    await expect(new MediaReference({
      ...released.toObject(),
      releaseOperationId: 'not-a-uuid'
    }).validate()).rejects.toThrow('releaseOperationId must be a UUID');

    await expect(new MediaReference({
      ...released.toObject(),
      state: 'bound',
      releasedAt: null
    }).validate()).rejects.toThrow('releaseOperationId is only valid for released references');
  });
});

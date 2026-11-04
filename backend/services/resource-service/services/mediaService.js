const mongoose = require('mongoose');

const { AppError } = require('../../../common/middleware/errorTypes');
const MediaAsset = require('../models/MediaAsset');
const { createPrivateMediaProcessor } = require('./privateMediaProcessor');

const CHILD_UPLOAD_PURPOSES = new Set([
  'task_completion',
  'mistake_question',
  'mistake_answer',
  'growth_evidence',
  'ai2_correction'
]);
const MEDIA_PURPOSES = new Set(MediaAsset.MEDIA_PURPOSES);
const MEDIA_SECURITY_PROFILES = new Set(['trusted-local', 'secure-production']);
const STORAGE_CLEANUP_ATTEMPTS = 3;
const normalizeAsset = (asset) => MediaAsset.normalizeAuditFields(asset);

const publicMediaDescriptor = (asset, { includePurpose = false } = {}) => {
  const descriptor = {
    mediaId: asset._id.toString(),
    mimeType: asset.mimeType,
    displayName: MediaAsset.sanitizeDisplayName(asset.displayName),
    sizeBytes: asset.sizeBytes
  };
  if (includePurpose) descriptor.purpose = asset.purpose;
  if (asset.mimeType === 'application/pdf') descriptor.pageCount = asset.pageCount;
  return descriptor;
};

const operationalError = (message, statusCode, code) => new AppError(
  message,
  statusCode,
  code,
  true,
  []
);
const validationError = (message) => operationalError(message, 400, 'VALIDATION_ERROR');
const accessDenied = () => operationalError('Cannot access this child', 403, 'CHILD_ACCESS_DENIED');
const notFound = () => operationalError('Media not found', 404, 'RESOURCE_NOT_FOUND');
const unavailable = () => operationalError('Media dependency unavailable', 503, 'MEDIA_SERVICE_UNAVAILABLE');
const AI2_IMAGES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const bindingId = value => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const dependency = async work => {
  try { return await work(); } catch (error) {
    if (error instanceof AppError) throw error;
    throw unavailable();
  }
};

const validObjectId = (value) => typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);

const createMediaService = ({
  MediaAssetModel = MediaAsset,
  MediaReferenceModel,
  FamilyModel,
  UserModel,
  capabilityService,
  mediaStore,
  now = Date.now,
  processor = createPrivateMediaProcessor(),
  scanner = null,
  securityProfile = 'trusted-local',
  transactionRunner,
  completionUploadService,
  ai2MediaAccessClient,
  getAi2Mode = () => 'off',
  assertAi2Continuous = () => {},
  MediaDeletionTombstoneModel,
  MediaDeletionReceiptModel
} = {}) => {
  if (!MediaAssetModel || typeof MediaAssetModel.create !== 'function') {
    throw new Error('MediaAssetModel is required');
  }
  if (!UserModel || typeof UserModel.exists !== 'function') {
    throw new Error('UserModel is required');
  }
  if (!FamilyModel || typeof FamilyModel.findOne !== 'function') {
    throw new Error('FamilyModel is required');
  }
  if (!mediaStore || typeof mediaStore.writeCanonical !== 'function' || typeof mediaStore.remove !== 'function') {
    throw new Error('mediaStore is required');
  }
  if (!processor || typeof processor.prepare !== 'function') throw new Error('media processor is required');
  if (!MEDIA_SECURITY_PROFILES.has(securityProfile)) throw new Error('valid media security profile is required');
  if (securityProfile === 'secure-production' && (!scanner || typeof scanner.scan !== 'function')) {
    throw new Error('media scanner is required for secure-production');
  }
  if (!capabilityService || typeof capabilityService.issue !== 'function'
    || typeof capabilityService.verify !== 'function') {
    throw new Error('capabilityService is required');
  }
  if (!MediaReferenceModel || typeof MediaReferenceModel.updateMany !== 'function') {
    throw new Error('MediaReferenceModel is required');
  }
  if (typeof transactionRunner !== 'function') throw new Error('transactionRunner is required');
  if (completionUploadService && typeof completionUploadService.upload !== 'function') throw new Error('Invalid completion upload service');
  if (typeof getAi2Mode !== 'function') throw new Error('AI2 mode reader is required');
  if (typeof assertAi2Continuous !== 'function') throw new Error('AI2 continuity assertion is required');
  if (ai2MediaAccessClient && typeof ai2MediaAccessClient.check !== 'function') throw new Error('Invalid AI2 media access client');
  const tombstones = () => MediaDeletionTombstoneModel || require('../models/MediaDeletionTombstone');
  const receipts = () => MediaDeletionReceiptModel || require('../models/MediaDeletionReceipt');

  const assertIdentity = (identity) => {
    if (!identity || !validObjectId(String(identity.id || ''))
      || !['parent', 'student'].includes(identity.role)) {
      throw accessDenied();
    }
  };

  const resolveIdentityScope = async (identity) => {
    assertIdentity(identity);
    if (identity.role === 'student' && validObjectId(String(identity.familyId || ''))) {
      return {
        actorId: String(identity.id),
        familyId: String(identity.familyId),
        role: identity.role,
        childId: identity.role === 'student' ? String(identity.childId || identity.id) : null
      };
    }
    if (identity.role !== 'parent') throw accessDenied();
    const query = FamilyModel.findOne({
      $or: [
        { ownerParentId: identity.id },
        { memberParentIds: identity.id }
      ]
    }).select('_id');
    const family = typeof query.lean === 'function' ? await query.lean() : await query;
    if (!family || !validObjectId(String(family._id || ''))) throw accessDenied();
    return {
      actorId: String(identity.id),
      familyId: String(family._id),
      role: 'parent',
      childId: null
    };
  };

  const assertMediaId = (mediaId) => {
    if (!validObjectId(String(mediaId || ''))) throw validationError('Invalid mediaId');
  };

  const authorizeAssetForScope = (scope, asset) => {
    if (asset.familyId.toString() !== scope.familyId) throw accessDenied();
    if (scope.role === 'student') {
      if (!asset.childId || asset.childId.toString() !== scope.childId) throw accessDenied();
    }
  };

  const authorizeAi2Scope = (identity, asset) => dependency(async () => {
    await assertAi2Continuous();
    assertIdentity(identity);
    const actorId = String(identity.id).toLowerCase();
    const familyId = String(asset.familyId), childId = String(asset.childId);
    const actor = await UserModel.findOne({ _id: actorId, role: identity.role }).lean();
    if (!actor) throw accessDenied();
    const familyQuery = { _id: familyId, childIds: childId };
    if (identity.role === 'student') {
      if (actorId !== childId || String(identity.childId).toLowerCase() !== childId
        || String(identity.familyId).toLowerCase() !== familyId || String(actor.familyId) !== familyId
        || !Number.isSafeInteger(identity.tokenVersion) || identity.tokenVersion < 0
        || actor.childProfile?.tokenVersion !== identity.tokenVersion) throw accessDenied();
    } else {
      familyQuery.$or = [{ ownerParentId: actorId }, { memberParentIds: actorId }];
    }
    if (!await FamilyModel.findOne(familyQuery).select('_id').lean()
      || !await UserModel.exists({ _id: childId, familyId, role: 'student' })) throw accessDenied();
    return { actorId, familyId, childId, role: identity.role };
  });

  const authorizeAi2Read = (identity, asset) => dependency(async () => {
    const scope = await authorizeAi2Scope(identity, asset);
    if (asset.status !== 'active' || await tombstones().exists({ mediaId: asset._id })) throw notFound();
    if (scope.role === 'parent') return;
    // Do not filter away prepared or released records: either rules out draft preview.
    const references = await MediaReferenceModel.find({ mediaId: asset._id }).limit(101).lean();
    if (!references.length) {
      if (String(asset.uploadedBy) !== scope.actorId) throw notFound();
      return;
    }
    if (references.length > 100 || references.some(ref => String(ref.familyId) !== scope.familyId
      || String(ref.childId) !== scope.childId || ref.resourceType !== 'ai2_attempt'
      || ref.field !== 'correctionMediaIds' || !['prepared', 'bound', 'released'].includes(ref.state)
      || !validObjectId(String(ref.resourceId)) || !bindingId(ref.operationId))) throw notFound();
    const bindings = references.filter(ref => ref.state === 'bound').map(ref => ({
      attemptId: String(ref.resourceId), bindingOperationId: ref.operationId
    }));
    if (!bindings.length) throw notFound();
    if (typeof ai2MediaAccessClient?.check !== 'function') throw unavailable();
    const allowed = await ai2MediaAccessClient.check({ ...scope, mediaId: String(asset._id), bindings });
    if (allowed !== true) throw notFound();
  });

  const resolveUploadScope = async ({ identity, suppliedChildId, purpose }) => {
    const identityScope = await resolveIdentityScope(identity);
    if (typeof purpose !== 'string' || !MEDIA_PURPOSES.has(purpose)) {
      throw validationError('Invalid media purpose');
    }

    if (purpose === 'ai2_correction') {
      if (identity.role !== 'student') throw accessDenied();
      await authorizeAi2Scope(identity, { familyId: identityScope.familyId, childId: identityScope.childId });
      if (getAi2Mode() !== 'enabled') throw operationalError('AI2 uploads are disabled', 503, 'AI2_DISABLED');
      if (!completionUploadService) throw unavailable();
    }

    const actorId = identityScope.actorId;
    const familyId = identityScope.familyId;
    let childId = suppliedChildId ? String(suppliedChildId) : null;

    if (identityScope.role === 'student') {
      const ownChildId = identityScope.childId;
      if (!validObjectId(ownChildId) || (childId && childId !== ownChildId)) throw accessDenied();
      if (!CHILD_UPLOAD_PURPOSES.has(purpose)) throw accessDenied();
      childId = ownChildId;
    } else if (!childId && purpose !== 'avatar') {
      throw validationError('childId is required for this media purpose');
    }

    if (childId) {
      if (!validObjectId(childId)) throw validationError('Invalid childId');
      const childExists = await UserModel.exists({
        _id: childId,
        familyId,
        role: 'student'
      });
      if (!childExists) throw accessDenied();
    }

    return { actorId, childId, familyId };
  };

  const upload = async ({ identity, suppliedChildId, purpose, bytes, originalName, declaredMimeType } = {}) => {
    const scope = await resolveUploadScope({ identity, suppliedChildId, purpose });
    const prepared = await processor.prepare({ bytes, purpose, originalName });
    if (purpose === 'ai2_correction' && (!AI2_IMAGES.has(prepared.mimeType)
      || declaredMimeType !== undefined && declaredMimeType !== prepared.mimeType)) {
      throw operationalError('Detected media type does not match upload', 400, 'MEDIA_TYPE_NOT_ALLOWED');
    }
    let malwareScanStatus = 'skipped_trusted_local';
    let malwareScannedAt = null;
    if (securityProfile === 'secure-production') {
      await scanner.scan(prepared.buffer);
      malwareScanStatus = 'clean';
      malwareScannedAt = new Date(Number(now()));
    }
    if (purpose === 'ai2_correction' && getAi2Mode() !== 'enabled') {
      throw operationalError('AI2 uploads are disabled', 503, 'AI2_DISABLED');
    }
    const stored = await mediaStore.writeCanonical(prepared.buffer);
    if (['task_completion', 'ai2_correction'].includes(purpose) && completionUploadService) {
      // The durable completion uploader owns pre-write compensation and unknown-result recovery.
      // Never pass its errors through the legacy create-and-delete catch below.
      const asset = await completionUploadService.upload({ identity, metadata: {
        familyId: scope.familyId, childId: scope.childId, uploadedBy: scope.actorId, purpose,
        mimeType: prepared.mimeType, displayName: prepared.displayName, sizeBytes: prepared.sizeBytes,
        pageCount: prepared.pageCount, storageKey: stored.storageKey, malwareScanStatus, malwareScannedAt
      } });
      return publicMediaDescriptor(asset, { includePurpose: true });
    }
    let asset;
    try {
      asset = await MediaAssetModel.create({
        familyId: scope.familyId,
        childId: scope.childId,
        uploadedBy: scope.actorId,
        purpose,
        mimeType: prepared.mimeType,
        displayName: prepared.displayName,
        sizeBytes: prepared.sizeBytes,
        pageCount: prepared.pageCount,
        storageKey: stored.storageKey,
        malwareScanStatus,
        malwareScannedAt,
        status: 'active'
      });
    } catch (error) {
      let cleanupError;
      for (let attempt = 0; attempt < STORAGE_CLEANUP_ATTEMPTS; attempt += 1) {
        try {
          await mediaStore.remove(stored.storageKey);
          cleanupError = null;
          break;
        } catch (currentCleanupError) {
          cleanupError = currentCleanupError;
        }
      }
      if (cleanupError) {
        throw new AggregateError([error, cleanupError], 'Media persistence and cleanup failed');
      }
      throw error;
    }

    return publicMediaDescriptor(asset, { includePurpose: true });
  };

  const issueAccess = async ({ identity, mediaId } = {}) => {
    assertMediaId(mediaId);
    const asset = normalizeAsset(await dependency(() => MediaAssetModel.findById(mediaId).lean()));
    if (!asset) throw notFound();
    if (asset.purpose === 'ai2_correction') {
      await authorizeAi2Read(identity, asset);
      assertAi2Continuous();
      return { access: capabilityService.issue(String(mediaId), { requiresAuthorization: true }),
        media: publicMediaDescriptor(asset) };
    }
    const identityScope = await resolveIdentityScope(identity);
    authorizeAssetForScope(identityScope, asset);
    if (asset.status !== 'active') throw notFound();
    return {
      access: capabilityService.issue(String(mediaId)),
      media: publicMediaDescriptor(asset)
    };
  };

  const readContent = async ({ mediaId, path, expires, nonce, signature } = {}) => {
    assertMediaId(mediaId);
    capabilityService.verify({
      path,
      mediaId: String(mediaId),
      expires,
      nonce,
      signature
    });
    const asset = normalizeAsset(await MediaAssetModel.findOne({ _id: mediaId, status: 'active' }).lean());
    if (!asset || asset.purpose === 'ai2_correction') throw notFound();
    const bytes = await mediaStore.read(asset.storageKey);
    return {
      bytes,
      mimeType: asset.mimeType,
      displayName: MediaAsset.sanitizeDisplayName(asset.displayName)
    };
  };

  const readAuthenticatedContent = input => dependency(async () => {
    const { identity, mediaId, path, expires, nonce, signature } = input || {};
    assertMediaId(mediaId);
    capabilityService.verify({ path, mediaId: String(mediaId), expires, nonce, signature, requiresAuthorization: true });
    const asset = normalizeAsset(await MediaAssetModel.findById(mediaId).lean());
    if (!asset || asset.purpose !== 'ai2_correction') throw notFound();
    await authorizeAi2Read(identity, asset);
    const bytes = await mediaStore.read(asset.storageKey);
    assertAi2Continuous();
    return { bytes, mimeType: asset.mimeType, displayName: MediaAsset.sanitizeDisplayName(asset.displayName) };
  });

  // Internal-service hook only. The caller authorizes the package; this checks live
  // identity and exact bindings without recursively asking homework for visibility.
  const inspect = input => dependency(async () => {
    const { familyId, childId, identity, mediaIds, bindings } = input || {};
    if (!validObjectId(familyId) || !validObjectId(childId) || !Array.isArray(mediaIds)
      || mediaIds.length < 1 || mediaIds.length > 10 || new Set(mediaIds).size !== mediaIds.length
      || !Array.isArray(bindings) || bindings.length !== mediaIds.length) throw validationError('Invalid media inspection');
    const items = [];
    for (let index = 0; index < mediaIds.length; index += 1) {
      const mediaId = mediaIds[index], ref = bindings[index];
      if (!validObjectId(mediaId) || !ref || ref.mediaId !== mediaId || ref.resourceType !== 'ai2_attempt'
        || !validObjectId(ref.resourceId) || ref.field !== 'correctionMediaIds'
        || !bindingId(ref.bindingOperationId)) throw validationError('Invalid media binding');
      const asset = normalizeAsset(await MediaAssetModel.findById(mediaId).lean());
      if (asset && (String(asset.familyId) !== familyId || String(asset.childId) !== childId
        || asset.purpose !== 'ai2_correction')) throw notFound();
      const referenceQuery = { mediaId, familyId, childId, resourceType: 'ai2_attempt',
        resourceId: ref.resourceId, field: 'correctionMediaIds' };
      const tombstone = await tombstones().findOne({ mediaId }).lean();
      let status, metadata;
      if (tombstone) {
        if (String(tombstone.familyId) !== familyId || String(tombstone.childId) !== childId
          || tombstone.purpose !== 'ai2_correction' || !(tombstone.deletedAt instanceof Date)
          || !Number.isFinite(tombstone.deletedAt.getTime())) throw notFound();
        await authorizeAi2Scope(identity, tombstone);
        if (asset && (asset.status !== 'deleted' || asset.privacyDeletionRecorded !== true
          || !(asset.deletedAt instanceof Date) || asset.deletedAt.getTime() !== tombstone.deletedAt.getTime()
          || asset.mimeType !== tombstone.mimeType || asset.sizeBytes !== tombstone.sizeBytes)) throw notFound();
        if (!await receipts().exists({
            ...referenceQuery, bindingOperationId: ref.bindingOperationId
          })) throw notFound();
        status = 'deleted';
        // Cleanup removes Asset/Reference rows, not this immutable descriptor or exact receipt.
        metadata = tombstone;
      } else {
        if (!asset) throw notFound();
        await authorizeAi2Scope(identity, asset);
        if (asset.status !== 'active' || !await MediaReferenceModel.exists({ ...referenceQuery,
          operationId: ref.bindingOperationId, state: 'bound' })) throw notFound();
        const bytes = await mediaStore.read(asset.storageKey);
        if (bytes.length !== asset.sizeBytes) throw unavailable();
        status = 'available';
        metadata = asset;
      }
      if (!AI2_IMAGES.has(metadata.mimeType) || !Number.isSafeInteger(metadata.sizeBytes)
        || metadata.sizeBytes < 1 || metadata.sizeBytes > MediaAsset.MAX_MEDIA_BYTES) throw unavailable();
      items.push({ mediaId, mimeType: metadata.mimeType, sizeBytes: metadata.sizeBytes, status });
    }
    assertAi2Continuous();
    return items;
  });

  const deleteMedia = async ({ identity, mediaId } = {}) => {
    assertMediaId(mediaId);
    const identityScope = await resolveIdentityScope(identity);
    return transactionRunner(async (session) => {
      const assetQuery = MediaAssetModel.findById(mediaId);
      const asset = normalizeAsset(await (session ? assetQuery.session(session) : assetQuery).lean());
      if (!asset) throw notFound();
      // AI2 deletion must be dispatched to the durable privacy service, never the legacy fallback.
      if (asset.purpose === 'ai2_correction') throw unavailable();
      authorizeAssetForScope(identityScope, asset);
      if (asset.status === 'deleted') return;

      const deletedAt = new Date(Number(now()));
      const updateQuery = MediaAssetModel.findOneAndUpdate(
        { _id: mediaId, status: 'active' },
        { $set: { status: 'deleted', deletedAt } },
        { new: true }
      );
      const deleted = await (session ? updateQuery.session(session) : updateQuery);
      if (!deleted) return;

      const referenceQuery = MediaReferenceModel.updateMany(
        { mediaId, state: 'prepared' },
        { $set: { state: 'released', leaseExpiresAt: null, releasedAt: deletedAt } }
      );
      await (session ? referenceQuery.session(session) : referenceQuery);
    });
  };

  return { deleteMedia, inspect, issueAccess, readContent, readAuthenticatedContent, upload };
};

module.exports = {
  CHILD_UPLOAD_PURPOSES,
  createMediaService,
  publicMediaDescriptor
};

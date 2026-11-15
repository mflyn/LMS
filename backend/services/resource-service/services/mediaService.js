const mongoose = require('mongoose');

const { AppError } = require('../../../common/middleware/errorTypes');
const MediaAsset = require('../models/MediaAsset');
const { createPrivateMediaProcessor } = require('./privateMediaProcessor');
const { isAttemptPurpose, purposeFor, fieldFor } = require('../../../common/services/completionMediaProtocol');

const CHILD_UPLOAD_PURPOSES = new Set([
  'task_completion',
  'mistake_question',
  'mistake_answer',
  'growth_evidence',
  'ai2_correction',
  'ai3_practice'
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
  ai3MediaAccessClient,
  getAi3Mode = () => 'off',
  assertAi3Continuous = () => { throw operationalError('AI3 media is not configured', 503, 'AI3_NOT_READY'); },
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
  if (typeof getAi3Mode !== 'function' || typeof assertAi3Continuous !== 'function') throw new Error('AI3 mode and continuity required');
  if (ai3MediaAccessClient && typeof ai3MediaAccessClient.check !== 'function') throw new Error('Invalid AI3 media access client');
  const assertContinuous = asset => asset.purpose === 'ai3_practice' ? assertAi3Continuous() : assertAi2Continuous();
  const assertUploadEnabled = purpose => {
    if (purpose === 'ai2_correction' && getAi2Mode() !== 'enabled') throw operationalError('AI2 uploads are disabled', 503, 'AI2_DISABLED');
    if (purpose === 'ai3_practice' && getAi3Mode() !== 'enabled') throw operationalError('AI3 uploads are disabled', 503, 'AI3_DISABLED');
  };
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

  const inSession = (query, session) => session ? query.session(session) : query;
  const referenceSnapshot = references => JSON.stringify(references.map(ref => [
    String(ref.mediaId), String(ref.familyId), String(ref.childId), ref.resourceType,
    String(ref.resourceId), ref.field, ref.operationId, ref.state
  ]).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))));

  const authorizeAttemptScope = (identity, asset, session) => dependency(async () => {
    await assertContinuous(asset);
    assertIdentity(identity);
    const actorId = String(identity.id).toLowerCase();
    const familyId = String(asset.familyId), childId = String(asset.childId);
    const actor = await inSession(UserModel.findOne({ _id: actorId, role: identity.role }), session).lean();
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
    if (!await inSession(FamilyModel.findOne(familyQuery).select('_id'), session).lean()
      || !await inSession(UserModel.exists({ _id: childId, familyId, role: 'student' }), session)) throw accessDenied();
    return { actorId, familyId, childId, role: identity.role };
  });

  const authorizeAttemptRead = (identity, asset) => dependency(async () => {
    const scope = await authorizeAttemptScope(identity, asset);
    const ai3 = asset.purpose === 'ai3_practice';
    const resourceType = ai3 ? 'ai3_attempt' : 'ai2_attempt';
    if (asset.status !== 'active' || await tombstones().exists({ mediaId: asset._id })) throw notFound();
    if (scope.role === 'parent' && !ai3) return;
    // Do not filter away prepared or released records: either rules out draft preview.
    const references = await MediaReferenceModel.find({ mediaId: asset._id }).limit(101).lean();
    if (!references.length) {
      if (scope.role !== 'student' || String(asset.uploadedBy) !== scope.actorId) throw notFound();
      return referenceSnapshot(references);
    }
    if (references.length > 100 || references.some(ref => String(ref.familyId) !== scope.familyId
      || String(ref.childId) !== scope.childId || ref.resourceType !== resourceType
      || ref.field !== fieldFor(resourceType) || !['prepared', 'bound', 'released'].includes(ref.state)
      || !validObjectId(String(ref.resourceId)) || !bindingId(ref.operationId))) throw notFound();
    const bindings = references.filter(ref => ref.state === 'bound').map(ref => ({
      attemptId: String(ref.resourceId), bindingOperationId: ref.operationId
    }));
    if (!bindings.length) throw notFound();
    const client = ai3 ? ai3MediaAccessClient : ai2MediaAccessClient;
    if (typeof client?.check !== 'function') throw unavailable();
    const snapshot = referenceSnapshot(references);
    const allowed = await client.check({ ...scope, mediaId: String(asset._id), bindings });
    if (allowed !== true) throw notFound();
    return snapshot;
  });

  const revalidateAi3Content = (identity, asset, authorizedReferences) => transactionRunner(async session => {
    if (!session?.inTransaction()) throw unavailable();
    const current = normalizeAsset(await MediaAssetModel.findById(asset._id).session(session).lean());
    if (!current || current.status !== 'active'
      || ['purpose', 'storageKey', 'mimeType', 'sizeBytes'].some(key => current[key] !== asset[key])
      || ['familyId', 'childId', 'uploadedBy'].some(key => String(current[key]) !== String(asset[key]))) throw notFound();
    await authorizeAttemptScope(identity, current, session);
    if (await tombstones().exists({ mediaId: asset._id }).session(session)) throw notFound();
    const references = await MediaReferenceModel.find({ mediaId: asset._id }).limit(101).session(session).lean();
    if (references.length > 100 || referenceSnapshot(references) !== authorizedReferences) throw notFound();
  });

  const resolveUploadScope = async ({ identity, suppliedChildId, purpose }) => {
    const identityScope = await resolveIdentityScope(identity);
    if (typeof purpose !== 'string' || !MEDIA_PURPOSES.has(purpose)) {
      throw validationError('Invalid media purpose');
    }

    if (isAttemptPurpose(purpose)) {
      if (identity.role !== 'student') throw accessDenied();
      await authorizeAttemptScope(identity, { familyId: identityScope.familyId, childId: identityScope.childId, purpose });
      assertUploadEnabled(purpose);
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
    if (isAttemptPurpose(purpose) && (!AI2_IMAGES.has(prepared.mimeType)
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
    assertUploadEnabled(purpose);
    const stored = await mediaStore.writeCanonical(prepared.buffer);
    if ((purpose === 'task_completion' || isAttemptPurpose(purpose)) && completionUploadService) {
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
    if (isAttemptPurpose(asset.purpose)) {
      await authorizeAttemptRead(identity, asset);
      await assertContinuous(asset);
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
    if (!asset || isAttemptPurpose(asset.purpose)) throw notFound();
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
    if (!asset || !isAttemptPurpose(asset.purpose)) throw notFound();
    await authorizeAttemptRead(identity, asset);
    const bytes = await mediaStore.read(asset.storageKey);
    if (asset.purpose === 'ai3_practice') {
      const current = normalizeAsset(await MediaAssetModel.findById(mediaId).lean());
      if (!current || current.purpose !== asset.purpose || current.storageKey !== asset.storageKey
        || current.mimeType !== asset.mimeType || current.sizeBytes !== asset.sizeBytes) throw notFound();
      // File reads yield: do not return bytes authorized before a withdrawal, PIN reset or deletion.
      const authorizedReferences = await authorizeAttemptRead(identity, current);
      // Close the last remote-await window with one local snapshot, without another HTTP check.
      await revalidateAi3Content(identity, current, authorizedReferences);
    }
    await assertContinuous(asset);
    return { bytes, mimeType: asset.mimeType, displayName: MediaAsset.sanitizeDisplayName(asset.displayName) };
  });

  // Internal-service hook only. The caller authorizes the package; this checks live
  // identity and exact bindings without recursively asking homework for visibility.
  const inspectAttempt = (input, resourceType) => dependency(async () => {
    const purpose = purposeFor(resourceType), field = fieldFor(resourceType);
    const { familyId, childId, identity, mediaIds, bindings } = input || {};
    if (!validObjectId(familyId) || !validObjectId(childId) || !Array.isArray(mediaIds)
      || mediaIds.length < 1 || mediaIds.length > 10 || new Set(mediaIds).size !== mediaIds.length
      || !Array.isArray(bindings) || bindings.length !== mediaIds.length) throw validationError('Invalid media inspection');
    const readItems = async (session, readBytes) => {
      const items = [], storageKeys = [];
      for (let index = 0; index < mediaIds.length; index += 1) {
        const mediaId = mediaIds[index], ref = bindings[index];
        if (!validObjectId(mediaId) || !ref || ref.mediaId !== mediaId || ref.resourceType !== resourceType
          || !validObjectId(ref.resourceId) || ref.field !== field
          || !bindingId(ref.bindingOperationId)) throw validationError('Invalid media binding');
        const asset = normalizeAsset(await inSession(MediaAssetModel.findById(mediaId), session).lean());
        if (asset && (String(asset.familyId) !== familyId || String(asset.childId) !== childId
          || asset.purpose !== purpose)) throw notFound();
        const referenceQuery = { mediaId, familyId, childId, resourceType,
          resourceId: ref.resourceId, field };
        const tombstone = await inSession(tombstones().findOne({ mediaId }), session).lean();
        let status, metadata;
        if (tombstone) {
          if (String(tombstone.familyId) !== familyId || String(tombstone.childId) !== childId
            || tombstone.purpose !== purpose || !(tombstone.deletedAt instanceof Date)
            || !Number.isFinite(tombstone.deletedAt.getTime())) throw notFound();
          await authorizeAttemptScope(identity, tombstone, session);
          if (asset && (asset.status !== 'deleted' || asset.privacyDeletionRecorded !== true
            || !(asset.deletedAt instanceof Date) || asset.deletedAt.getTime() !== tombstone.deletedAt.getTime()
            || asset.mimeType !== tombstone.mimeType || asset.sizeBytes !== tombstone.sizeBytes)) throw notFound();
          if (!await inSession(receipts().exists({
              ...referenceQuery, bindingOperationId: ref.bindingOperationId
            }), session)) throw notFound();
          status = 'deleted';
          // Cleanup removes Asset/Reference rows, not this immutable descriptor or exact receipt.
          metadata = tombstone;
        } else {
          if (!asset) throw notFound();
          await authorizeAttemptScope(identity, asset, session);
          if (asset.status !== 'active' || !await inSession(MediaReferenceModel.exists({ ...referenceQuery,
            operationId: ref.bindingOperationId, state: 'bound' }), session)) throw notFound();
          if (readBytes) {
            const bytes = await mediaStore.read(asset.storageKey);
            if (bytes.length !== asset.sizeBytes) throw unavailable();
          }
          status = 'available';
          metadata = asset;
        }
        if (!AI2_IMAGES.has(metadata.mimeType) || !Number.isSafeInteger(metadata.sizeBytes)
          || metadata.sizeBytes < 1 || metadata.sizeBytes > MediaAsset.MAX_MEDIA_BYTES) throw unavailable();
        items.push({ mediaId, mimeType: metadata.mimeType, sizeBytes: metadata.sizeBytes, status });
        storageKeys.push(status === 'available' ? asset.storageKey : null);
      }
      return { items, storageKeys };
    };
    const observed = await readItems(null, true);
    await assertContinuous({ purpose });
    if (resourceType === 'ai3_attempt') {
      // Every item shares the same final snapshot; no byte read or remote call can stale an earlier item.
      await transactionRunner(async session => {
        if (!session?.inTransaction()) throw unavailable();
        const current = await readItems(session, false);
        if (JSON.stringify(current) !== JSON.stringify(observed)) throw notFound();
      });
    }
    return observed.items;
  });

  const deleteMedia = async ({ identity, mediaId } = {}) => {
    assertMediaId(mediaId);
    const identityScope = await resolveIdentityScope(identity);
    return transactionRunner(async (session) => {
      const assetQuery = MediaAssetModel.findById(mediaId);
      const asset = normalizeAsset(await (session ? assetQuery.session(session) : assetQuery).lean());
      if (!asset) throw notFound();
      // AI2 deletion must be dispatched to the durable privacy service, never the legacy fallback.
      if (isAttemptPurpose(asset.purpose)) throw unavailable();
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

  return { deleteMedia, inspect: input => inspectAttempt(input, 'ai2_attempt'),
    inspectAi3: input => inspectAttempt(input, 'ai3_attempt'), issueAccess, readContent, readAuthenticatedContent, upload };
};

module.exports = {
  CHILD_UPLOAD_PURPOSES,
  createMediaService,
  publicMediaDescriptor
};

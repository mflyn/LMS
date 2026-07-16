const mongoose = require('mongoose');

const { AppError } = require('../../../common/middleware/errorTypes');
const MediaAsset = require('../models/MediaAsset');
const { createPrivateMediaProcessor } = require('./privateMediaProcessor');

const CHILD_UPLOAD_PURPOSES = new Set([
  'task_completion',
  'mistake_question',
  'mistake_answer',
  'growth_evidence'
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
  transactionRunner
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

  const resolveUploadScope = async ({ identity, suppliedChildId, purpose }) => {
    const identityScope = await resolveIdentityScope(identity);
    if (typeof purpose !== 'string' || !MEDIA_PURPOSES.has(purpose)) {
      throw validationError('Invalid media purpose');
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

  const upload = async ({ identity, suppliedChildId, purpose, bytes, originalName } = {}) => {
    const scope = await resolveUploadScope({ identity, suppliedChildId, purpose });
    const prepared = await processor.prepare({ bytes, purpose, originalName });
    let malwareScanStatus = 'skipped_trusted_local';
    let malwareScannedAt = null;
    if (securityProfile === 'secure-production') {
      await scanner.scan(prepared.buffer);
      malwareScanStatus = 'clean';
      malwareScannedAt = new Date(Number(now()));
    }
    const stored = await mediaStore.writeCanonical(prepared.buffer);
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
    const asset = normalizeAsset(await MediaAssetModel.findById(mediaId).lean());
    if (!asset) throw notFound();
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
    if (!asset) throw notFound();
    const bytes = await mediaStore.read(asset.storageKey);
    return {
      bytes,
      mimeType: asset.mimeType,
      displayName: MediaAsset.sanitizeDisplayName(asset.displayName)
    };
  };

  const deleteMedia = async ({ identity, mediaId } = {}) => {
    assertMediaId(mediaId);
    const identityScope = await resolveIdentityScope(identity);
    return transactionRunner(async (session) => {
      const assetQuery = MediaAssetModel.findById(mediaId);
      const asset = normalizeAsset(await (session ? assetQuery.session(session) : assetQuery).lean());
      if (!asset) throw notFound();
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

  return { deleteMedia, issueAccess, readContent, upload };
};

module.exports = {
  CHILD_UPLOAD_PURPOSES,
  createMediaService,
  publicMediaDescriptor
};

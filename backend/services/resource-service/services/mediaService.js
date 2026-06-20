const mongoose = require('mongoose');

const { AppError } = require('../../../common/middleware/errorTypes');
const MediaAsset = require('../models/MediaAsset');

const CHILD_UPLOAD_PURPOSES = new Set([
  'task_completion',
  'mistake_question',
  'mistake_answer',
  'growth_evidence'
]);
const MEDIA_PURPOSES = new Set(MediaAsset.MEDIA_PURPOSES);

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
  UserModel,
  capabilityService,
  mediaStore,
  now = Date.now
} = {}) => {
  if (!MediaAssetModel || typeof MediaAssetModel.create !== 'function') {
    throw new Error('MediaAssetModel is required');
  }
  if (!UserModel || typeof UserModel.exists !== 'function') {
    throw new Error('UserModel is required');
  }
  if (!mediaStore || typeof mediaStore.write !== 'function' || typeof mediaStore.remove !== 'function') {
    throw new Error('mediaStore is required');
  }
  if (!capabilityService || typeof capabilityService.issue !== 'function'
    || typeof capabilityService.verify !== 'function') {
    throw new Error('capabilityService is required');
  }

  const assertIdentity = (identity) => {
    if (!identity || !validObjectId(String(identity.id || ''))
      || !validObjectId(String(identity.familyId || ''))
      || !['parent', 'student'].includes(identity.role)) {
      throw accessDenied();
    }
  };

  const assertMediaId = (mediaId) => {
    if (!validObjectId(String(mediaId || ''))) throw validationError('Invalid mediaId');
  };

  const authorizeAsset = (identity, asset) => {
    assertIdentity(identity);
    if (asset.familyId.toString() !== String(identity.familyId)) throw accessDenied();
    if (identity.role === 'student') {
      const ownChildId = String(identity.childId || identity.id);
      if (!asset.childId || asset.childId.toString() !== ownChildId) throw accessDenied();
    }
  };

  const resolveUploadScope = async ({ identity, suppliedChildId, purpose }) => {
    assertIdentity(identity);
    if (typeof purpose !== 'string' || !MEDIA_PURPOSES.has(purpose)) {
      throw validationError('Invalid media purpose');
    }

    const actorId = String(identity.id);
    const familyId = String(identity.familyId);
    let childId = suppliedChildId ? String(suppliedChildId) : null;

    if (identity.role === 'student') {
      const ownChildId = String(identity.childId || identity.id);
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

  const upload = async ({ identity, suppliedChildId, purpose, bytes } = {}) => {
    const scope = await resolveUploadScope({ identity, suppliedChildId, purpose });
    const stored = await mediaStore.write(bytes);
    let asset;
    try {
      asset = await MediaAssetModel.create({
        familyId: scope.familyId,
        childId: scope.childId,
        uploadedBy: scope.actorId,
        purpose,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        storageKey: stored.storageKey,
        status: 'active'
      });
    } catch (error) {
      await mediaStore.remove(stored.storageKey).catch(() => undefined);
      throw error;
    }

    return {
      mediaId: asset._id.toString(),
      purpose: asset.purpose,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes
    };
  };

  const issueAccess = async ({ identity, mediaId } = {}) => {
    assertMediaId(mediaId);
    const asset = await MediaAssetModel.findById(mediaId).lean();
    if (!asset) throw notFound();
    authorizeAsset(identity, asset);
    if (asset.status !== 'active') throw notFound();
    return capabilityService.issue(String(mediaId));
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
    const asset = await MediaAssetModel.findOne({ _id: mediaId, status: 'active' }).lean();
    if (!asset) throw notFound();
    const bytes = await mediaStore.read(asset.storageKey);
    return { bytes, mimeType: asset.mimeType };
  };

  const deleteMedia = async ({ identity, mediaId } = {}) => {
    assertMediaId(mediaId);
    const asset = await MediaAssetModel.findById(mediaId).lean();
    if (!asset) throw notFound();
    authorizeAsset(identity, asset);
    if (asset.status === 'deleted') return;

    await MediaAssetModel.findOneAndUpdate(
      { _id: mediaId, status: 'active' },
      { $set: { status: 'deleted', deletedAt: new Date(Number(now())) } }
    );
  };

  return { deleteMedia, issueAccess, readContent, upload };
};

module.exports = {
  CHILD_UPLOAD_PURPOSES,
  createMediaService
};

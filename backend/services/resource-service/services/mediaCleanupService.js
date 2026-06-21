const { AppError } = require('../../../common/middleware/errorTypes');
const MediaAsset = require('../models/MediaAsset');
const MediaReference = require('../models/MediaReference');

const DAY_MS = 24 * 60 * 60 * 1000;

const validationError = (message) => new AppError(
  message,
  400,
  'VALIDATION_ERROR',
  true,
  []
);

const createMediaCleanupService = ({
  MediaAssetModel = MediaAsset,
  MediaReferenceModel = MediaReference,
  mediaStore,
  now = Date.now,
  retentionDays = 30
} = {}) => {
  if (!Number.isInteger(retentionDays) || retentionDays < 1) {
    throw new Error('Media retention days must be a positive integer');
  }
  if (!mediaStore || typeof mediaStore.remove !== 'function') {
    throw new Error('mediaStore is required');
  }

  const cleanupDeletedMedia = async ({ limit = 100 } = {}) => {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw validationError('limit must be between 1 and 1000');
    }
    const cutoff = new Date(Number(now()) - retentionDays * DAY_MS);
    const candidates = await MediaAssetModel.find({
      status: 'deleted',
      deletedAt: { $lte: cutoff }
    }).sort({ deletedAt: 1, _id: 1 }).limit(limit).lean();
    const mediaIds = [];

    for (const asset of candidates) {
      const activeReferences = await MediaReferenceModel.countDocuments({
        mediaId: asset._id,
        state: { $in: ['prepared', 'bound'] }
      });
      if (activeReferences > 0) continue;

      const latestRelease = await MediaReferenceModel.findOne({
        mediaId: asset._id,
        state: 'released'
      }).sort({ releasedAt: -1 }).select('releasedAt').lean();
      if (latestRelease && latestRelease.releasedAt > cutoff) continue;

      await mediaStore.remove(asset.storageKey);
      const removed = await MediaAssetModel.deleteOne({
        _id: asset._id,
        status: 'deleted',
        deletedAt: { $lte: cutoff }
      });
      if (removed.deletedCount !== 1) continue;

      await MediaReferenceModel.deleteMany({
        mediaId: asset._id,
        state: 'released'
      });
      mediaIds.push(asset._id.toString());
    }

    return { cleaned: mediaIds.length, mediaIds };
  };

  return { cleanupDeletedMedia };
};

module.exports = {
  DAY_MS,
  createMediaCleanupService
};

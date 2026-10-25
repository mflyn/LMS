const { AppError } = require('../../../common/middleware/errorTypes');
const Asset = require('../models/MediaAsset');
const Tombstone = require('../models/MediaDeletionTombstone');
const Retirement = require('../models/MediaOrphanRetirement');
const Family = require('../../../common/models/Family');
const User = require('../models/FamilyUser');

const error = (status, code) => new AppError(code, status, code, true, []);
const objectId = value => typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value);

// Classify only inside the caller's live scope; the selected writer authorizes again.
const createMediaDeletionDispatcher = ({ mediaService, privacyService, retirementService } = {}) => {
  if (typeof mediaService?.deleteMedia !== 'function' || typeof privacyService?.deleteMedia !== 'function') {
    throw new TypeError('Both media deletion services are required');
  }
  const dispatch = async ({ identity, mediaId } = {}, reclassified = false) => {
    try {
      if (!identity || !objectId(identity.id) || !['parent', 'student'].includes(identity.role)) {
        throw error(403, 'CHILD_ACCESS_DENIED');
      }
      if (!objectId(mediaId)) throw error(400, 'VALIDATION_ERROR');
      const user = await User.findOne({ _id: identity.id, role: identity.role }).lean();
      if (!user) throw error(403, 'CHILD_ACCESS_DENIED');
      let family;
      const scope = {};
      if (identity.role === 'parent') {
        family = await Family.findOne({ $or: [{ ownerParentId: identity.id }, { memberParentIds: identity.id }] }).select('_id childIds').lean();
        if (family) scope.$or = [{ childId: { $in: family.childIds } }, { childId: null, purpose: 'avatar' }];
      } else {
        if (!objectId(identity.familyId) || String(identity.childId || identity.id).toLowerCase() !== identity.id.toLowerCase()
          || String(user.familyId) !== identity.familyId.toLowerCase() || !Number.isInteger(identity.tokenVersion)
          || user.childProfile?.tokenVersion !== identity.tokenVersion) throw error(403, 'CHILD_ACCESS_DENIED');
        family = await Family.findOne({ _id: identity.familyId, childIds: identity.id }).select('_id').lean();
        scope.childId = identity.id;
      }
      if (!family) throw error(403, 'CHILD_ACCESS_DENIED');
      scope.familyId = family._id;
      const asset = await Asset.findOne({ _id: mediaId, ...scope }).select('purpose').lean();
      const tombstone = await Tombstone.findOne({ mediaId, ...scope }).select('_id').lean();
      const retirement = await Retirement.findOne({ mediaId, ...scope }).select('state').lean();
      if (retirement?.state === 'INCONSISTENT'
        || tombstone && retirement && ['DELETED', 'PURGED'].includes(retirement.state)) throw error(409, 'MEDIA_RETIREMENT_INCONSISTENT');
      if (retirement && ['DELETED', 'PURGED'].includes(retirement.state)) {
        if (typeof retirementService?.deleteMedia !== 'function') throw error(503, 'MEDIA_RETIREMENT_PENDING');
        return await retirementService.deleteMedia({ identity, mediaId });
      }
      if (!asset && !tombstone) throw error(404, 'RESOURCE_NOT_FOUND');
      // Tombstones win even after cleanup or when surviving metadata is inconsistent.
      if (tombstone || asset.purpose === 'task_completion') {
        try { return await privacyService.deleteMedia({ identity, mediaId }); }
        catch (cause) {
          if (!reclassified && cause?.code === 'MEDIA_OPERATION_INCONSISTENT') {
            const current = await Retirement.findOne({ mediaId, ...scope, state: { $in: ['DELETED', 'PURGED'] } }).lean();
            const userDeletion = await Tombstone.exists({ mediaId });
            if (current && !userDeletion) return await dispatch({ identity, mediaId }, true);
          }
          throw cause;
        }
      }
      return await mediaService.deleteMedia({ identity, mediaId });
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      throw error(503, 'MEDIA_REFERENCE_PENDING');
    }
  };
  return input => dispatch(input);
};

module.exports = { createMediaDeletionDispatcher };

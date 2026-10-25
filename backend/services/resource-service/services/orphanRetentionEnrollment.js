const Asset = require('../models/MediaAsset');
const Family = require('../../../common/models/Family');
const User = require('../models/FamilyUser');
const Retirement = require('../models/MediaOrphanRetirement');
const Tombstone = require('../models/MediaDeletionTombstone');
const { inspectOrphanReferences } = require('./orphanRetirementEvidence');
const fail = () => Object.assign(new Error('COMPLETION_RETENTION_ENROLLMENT_REJECTED'), {
  code: 'COMPLETION_RETENTION_ENROLLMENT_REJECTED'
});

// Explicit operator helper, deliberately not mounted or invoked by startup/cleanup.
const createOrphanRetentionEnrollment = ({ transactionRunner, now = Date.now } = {}) => {
  const enroll = async ({ familyId, childId, mediaId, writesPaused, execute } = {}) => {
    if (writesPaused !== true || execute !== true || ![familyId, childId, mediaId]
      .every(value => typeof value === 'string' && /^[0-9a-f]{24}$/.test(value))) throw fail();
    return transactionRunner(async session => {
      if (!session?.inTransaction()) throw fail();
      const asset = await Asset.findOne({ _id: mediaId, familyId, childId, purpose: 'task_completion', status: 'active' }).session(session).lean();
      if (!asset || asset.orphanRetirementId || asset.deletedAt || asset.privacyDeletionRecorded
        || !await Family.exists({ _id: familyId, childIds: childId }).session(session)
        || !await User.exists({ _id: childId, familyId, role: 'student' }).session(session)
        || await Retirement.exists({ mediaId }).session(session) || await Tombstone.exists({ mediaId }).session(session)) throw fail();
      await Asset.hydrate(asset).validate();
      if (!await inspectOrphanReferences(asset, session)) throw fail();
      if (asset.retentionPolicyVersion === 1 && asset.orphanEligibleAt instanceof Date
        && Number.isFinite(asset.orphanEligibleAt.getTime())) return { enrolled: false, mediaId };
      if (asset.retentionPolicyVersion != null || asset.orphanEligibleAt != null) throw fail();
      const eligibleAt = new Date(Number(now()) + 86400000);
      if (!Number.isFinite(eligibleAt.getTime())) throw fail();
      const result = await Asset.updateOne({ _id: mediaId, familyId, childId, status: 'active',
        __v: asset.__v == null ? { $exists: false } : asset.__v,
        retentionPolicyVersion: null, orphanEligibleAt: null, orphanRetirementId: null },
      { $set: { retentionPolicyVersion: 1, orphanEligibleAt: eligibleAt }, $inc: { __v: 1 } }, { session, runValidators: true });
      if (result.modifiedCount !== 1) throw fail();
      return { enrolled: true, mediaId };
    });
  };
  return { enroll };
};
module.exports = { createOrphanRetentionEnrollment };

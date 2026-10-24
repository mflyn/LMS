const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');

const assertRecoveryProtocolAvailable = async (mediaId, session, enabled) => {
  if (enabled) return;
  // Native read only: legacy startup must not load the v2 writer or create its collection.
  const found = await Tombstone.db.db.collection('mediauserdeletionrecoveries').findOne({
    mediaId: new Tombstone.base.Types.ObjectId(String(mediaId))
  }, { session, projection: { _id: 1 } });
  if (found) throw Error('User deletion recovery protocol required');
};

const loadDeletionEvidence = async (mediaId, session) => {
  const tombstone = await Tombstone.findOne({ mediaId }).session(session || null).lean();
  if (!tombstone) return null;
  const receipts = await Receipt.find({ mediaId, familyId: tombstone.familyId, childId: tombstone.childId })
    .session(session || null).sort({ resourceType: 1, resourceId: 1, field: 1, bindingOperationId: 1 }).lean();
  return {
    tombstone: {
      mediaId: String(tombstone.mediaId), familyId: String(tombstone.familyId), childId: String(tombstone.childId),
      actorId: String(tombstone.actorId), role: tombstone.role, purpose: tombstone.purpose,
      reason: tombstone.reason, deletedAt: tombstone.deletedAt.toISOString()
    },
    receipts: receipts.map(r => ({ mediaId: String(r.mediaId), familyId: String(r.familyId), childId: String(r.childId),
      resourceType: r.resourceType, resourceId: String(r.resourceId), field: r.field,
      bindingOperationId: r.bindingOperationId, releasedAt: r.releasedAt.toISOString() }))
  };
};
module.exports = { loadDeletionEvidence, assertRecoveryProtocolAvailable };

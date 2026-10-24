const { createHash } = require('crypto');
const { AppError } = require('../../../common/middleware/errorTypes');
const Reference = require('../models/MediaReference');
const Operation = require('../models/MediaReferenceOperation');
const Receipt = require('../models/MediaDeletionReceipt');
const inconsistent = () => new AppError('MEDIA_RETIREMENT_INCONSISTENT', 409, 'MEDIA_RETIREMENT_INCONSISTENT', true, []);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const scopeMatches = (a, b) => String(a.familyId) === String(b.familyId) && String(a.childId) === String(b.childId);
const operationSnapshot = o => ({
  _id: String(o._id), familyId: String(o.familyId), childId: String(o.childId), resourceId: String(o.resourceId),
  resourceType: o.resourceType, field: o.field, operationId: o.operationId,
  commandHash: o.commandHash, referenceSetHash: o.referenceSetHash,
  references: o.references.map(r => ({ mediaId: String(r.mediaId), field: r.field })),
  state: o.state, version: o.version, leaseExpiresAt: o.leaseExpiresAt, terminalAt: o.terminalAt.toISOString(), failureCode: o.failureCode
});
const referenceSnapshot = r => ({
  _id: String(r._id), familyId: String(r.familyId), childId: String(r.childId), mediaId: String(r.mediaId),
  resourceType: r.resourceType, resourceId: String(r.resourceId), field: r.field, operationId: r.operationId,
  releaseOperationId: r.releaseOperationId, state: r.state, leaseExpiresAt: r.leaseExpiresAt, releasedAt: r.releasedAt.toISOString()
});
// Query every generation by membership, never only the currently visible reference row.
const inspectOrphanReferences = async (asset, session) => {
  const mediaId = asset.mediaId || asset._id;
  const operations = await Operation.find({ 'references.mediaId': mediaId }).sort({ _id: 1 }).session(session).lean();
  const rows = await Reference.find({ mediaId }).sort({ _id: 1 }).session(session).lean();
  if (await Receipt.exists({ mediaId }).session(session)) return null;
  for (const op of operations) {
    await Operation.hydrate(op).validate().catch(() => { throw inconsistent(); });
    if (!scopeMatches(asset, op)) throw inconsistent();
    const refs = op.references.map(r => ({ mediaId: String(r.mediaId), field: r.field }));
    if (!same(refs, [...refs].sort((a, b) => a.mediaId.localeCompare(b.mediaId)))
      || createHash('sha256').update(JSON.stringify(refs)).digest('hex') !== op.referenceSetHash) throw inconsistent();
    if (op.state !== 'ABORTED') return null;
  }
  for (const row of rows) {
    await Reference.hydrate(row).validate().catch(() => { throw inconsistent(); });
    if (!scopeMatches(asset, row) || row.resourceType !== 'growth_task' || row.field !== 'completionMediaIds') throw inconsistent();
    if (row.state !== 'released') return null;
    const op = operations.find(o => o.operationId === row.operationId && String(o.resourceId) === String(row.resourceId));
    if (!op || row.leaseExpiresAt != null || row.releaseOperationId !== op.operationId
      || row.releasedAt?.getTime() !== op.terminalAt.getTime()) throw inconsistent();
  }
  return { operations: operations.map(operationSnapshot), references: rows.map(referenceSnapshot) };
};
const retirementSnapshot = r => ({ mediaId: String(r.mediaId), familyId: String(r.familyId), childId: String(r.childId),
  retirementId: r.retirementId, storageKey: r.storageKey, retentionPolicyVersion: r.retentionPolicyVersion,
  uploadMetadataHash: r.uploadMetadataHash,
  orphanEligibleAt: r.orphanEligibleAt.toISOString(), actorType: r.actorType,
  createdAt: r.createdAt.toISOString(), deletedAt: r.deletedAt.toISOString() });
module.exports = { inspectOrphanReferences, retirementSnapshot, operationSnapshot, referenceSnapshot, same, scopeMatches, inconsistent };

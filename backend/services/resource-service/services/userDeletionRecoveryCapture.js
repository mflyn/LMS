const { canonicalize } = require('json-canonicalize');
const Operation = require('../models/MediaReferenceOperation');
const Reference = require('../models/MediaReference');
const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');
const Guard = require('../models/CompletionUploadGuard');
const Recovery = require('../models/MediaUserDeletionRecovery');
const { identityFor, matchesGuard } = require('./completionUploadGuardService');
const { sealEvidence, validateEvidence, LIMITS } = require('./userDeletionRecoveryEvidence');

const invalid = () => { throw Object.assign(Error('Invalid user deletion recovery state'), {
  code: 'USER_DELETION_EVIDENCE_INVALID'
}); };
const assert = condition => { if (!condition) invalid(); };
const transaction = session => assert(session?.inTransaction());
const equal = (a, b) => canonicalize(a) === canonicalize(b);
const identifier = value => {
  assert(value?._bsontype === 'ObjectId' && typeof value.toHexString === 'function');
  const result = value.toHexString(); assert(/^[0-9a-f]{24}$/.test(result)); return result;
};
const date = value => {
  assert(value instanceof Date && Number.isFinite(value.getTime())); return value.toISOString();
};
const nullableDate = value => value === null ? null : date(value);
const scope = row => ({ familyId: identifier(row.familyId), childId: identifier(row.childId),
  resourceType: row.resourceType, resourceId: identifier(row.resourceId), field: row.field });
const operationSnapshot = row => ({ _id: identifier(row._id), ...scope(row), operationId: row.operationId,
  commandHash: row.commandHash, referenceSetHash: row.referenceSetHash,
  references: row.references.map(ref => ({ mediaId: identifier(ref.mediaId), field: ref.field })),
  state: row.state, version: row.version, leaseExpiresAt: nullableDate(row.leaseExpiresAt),
  terminalAt: nullableDate(row.terminalAt), failureCode: row.failureCode,
  createdAt: date(row.createdAt), updatedAt: date(row.updatedAt) });
const referenceSnapshot = row => ({ _id: identifier(row._id), ...scope(row), mediaId: identifier(row.mediaId),
  operationId: row.operationId, state: row.state, leaseExpiresAt: nullableDate(row.leaseExpiresAt),
  releasedAt: nullableDate(row.releasedAt), releaseOperationId: row.releaseOperationId ?? null,
  createdAt: date(row.createdAt), updatedAt: date(row.updatedAt) });
const tombstoneSnapshot = row => ({ _id: identifier(row._id), mediaId: identifier(row.mediaId),
  familyId: identifier(row.familyId), childId: identifier(row.childId), actorId: identifier(row.actorId),
  role: row.role, purpose: row.purpose, reason: row.reason, deletedAt: date(row.deletedAt) });
const receiptSnapshot = row => ({ _id: identifier(row._id), ...scope(row), mediaId: identifier(row.mediaId),
  bindingOperationId: row.bindingOperationId, releasedAt: date(row.releasedAt) });
const bounded = async (query, max, session) => {
  const rows = await query.session(session).sort({ _id: 1 }).limit(max + 1).lean();
  assert(rows.length <= max); return rows;
};
const groupFilter = row => ({ familyId: row.familyId, childId: row.childId, resourceType: row.resourceType,
  resourceId: row.resourceId, field: row.field, operationId: row.operationId });
const groupKey = row => canonicalize(groupFilter(row));
const validateSnapshotReferences = (operations, references) => {
  const groups = new Map(operations.map(row => [groupKey(row), { row, seen: new Set() }]));
  for (const reference of references) {
    const group = groups.get(groupKey(reference));
    assert(group && !group.seen.has(reference.mediaId)
      && group.row.references.some(item => item.mediaId === reference.mediaId && item.field === reference.field));
    group.seen.add(reference.mediaId);
    const operation = group.row;
    if (operation.state === 'PREPARED') {
      assert(reference.state === 'prepared' && reference.leaseExpiresAt === operation.leaseExpiresAt
        && reference.releasedAt === null && reference.releaseOperationId === null);
    } else if (operation.state === 'ABORTED') {
      assert(operation.version > 0 && reference.state === 'released' && reference.leaseExpiresAt === null
        && reference.releasedAt === operation.terminalAt && reference.releaseOperationId === operation.operationId);
    } else {
      assert(operation.state === 'COMMITTED' && reference.leaseExpiresAt === null);
      if (reference.state === 'bound') assert(reference.releasedAt === null && reference.releaseOperationId === null);
      else assert(reference.state === 'released' && reference.releasedAt !== null
        && reference.releasedAt >= operation.terminalAt);
    }
  }
  for (const { row, seen } of groups.values()) {
    if (row.state === 'PREPARED') assert(seen.size === row.references.length);
  }
};

const readUserDeletionSnapshot = async ({ asset, session }) => {
  transaction(session);
  // Denied foreign requests never owned this media. Do not export their audits or count them
  // against the owner's history budget; an actual foreign binding remains an inconsistency.
  const anomalous = await Operation.exists({ 'references.mediaId': asset._id,
    $or: [{ familyId: { $ne: asset.familyId } }, { childId: { $ne: asset.childId } }],
    $nor: [{ state: 'ABORTED', version: 0, leaseExpiresAt: null, terminalAt: { $type: 'date' },
      failureCode: { $in: ['CHILD_ACCESS_DENIED', 'RESOURCE_NOT_FOUND', 'MEDIA_OPERATION_ABORTED',
        'MEDIA_PURPOSE_MISMATCH', 'RESOURCE_CONFLICT'] } }] }).session(session);
  assert(!anomalous);
  const operations = await bounded(Operation.find({ familyId: asset.familyId, childId: asset.childId,
    'references.mediaId': asset._id }), LIMITS.MAX_OPERATIONS, session);
  const references = await bounded(Reference.find({ $or: [{ mediaId: asset._id }, ...operations.map(groupFilter)] }),
    LIMITS.MAX_EFFECTS, session);
  return { beforeOperations: operations.map(operationSnapshot), beforeReferences: references.map(referenceSnapshot) };
};
const readDeletionFacts = async (mediaId, session) => {
  const tombstone = await Tombstone.findOne({ mediaId }).session(session).lean();
  assert(tombstone);
  const receipts = await bounded(Receipt.find({ mediaId }), LIMITS.MAX_OPERATIONS, session);
  return { tombstone: tombstoneSnapshot(tombstone), receipts: receipts.map(receiptSnapshot) };
};
const checkGuard = async (proof, session) => {
  const guard = await Guard.findOne({ mediaId: proof.tombstone.mediaId }).session(session).lean();
  assert(guard && guard.state === 'RETIRED' && matchesGuard(guard, proof.uploadIdentity));
};

const captureUserDeletionEvidence = async ({ asset, beforeOperations, beforeReferences, session,
  evidenceId, evidenceCreatedAt }) => {
  transaction(session);
  const current = await readUserDeletionSnapshot({ asset, session });
  assert(equal(beforeOperations.map(row => row._id), current.beforeOperations.map(row => row._id)));
  assert(equal(beforeReferences.map(row => row._id), current.beforeReferences.map(row => row._id)));
  // Unchanged historical rows must be consistent too, before reducing to effects.
  validateSnapshotReferences(beforeOperations, beforeReferences);
  validateSnapshotReferences(current.beforeOperations, current.beforeReferences);
  const priorOperations = new Map(beforeOperations.map(row => [row._id, row]));
  const priorReferences = new Map(beforeReferences.map(row => [row._id, row]));
  const operations = current.beforeOperations.map(after => {
    const before = priorOperations.get(after._id);
    return { before: equal(before, after) ? null : before, after };
  });
  const referenceEffects = current.beforeReferences.filter(after => !equal(priorReferences.get(after._id), after))
    .map(after => ({ before: priorReferences.get(after._id), after }));
  const facts = await readDeletionFacts(asset._id, session);
  const identity = identityFor(asset);
  const proof = sealEvidence({ version: 2, evidenceId, evidenceCreatedAt: date(evidenceCreatedAt), ...facts,
    uploadIdentity: { mediaId: identifier(identity.mediaId), familyId: identifier(identity.familyId),
      childId: identifier(identity.childId), storageKey: identity.storageKey, metadataHash: identity.metadataHash },
    operations, referenceEffects });
  await checkGuard(proof, session);
  await Recovery.create([{ _id: evidenceId, mediaId: asset._id, familyId: asset.familyId, childId: asset.childId,
    version: 2, evidence: proof, evidenceHash: proof.evidenceHash, createdAt: evidenceCreatedAt }], { session });
  return proof;
};

const loadUserDeletionRecovery = async ({ mediaId, asset, session }) => {
  transaction(session);
  const stored = await Recovery.findOne({ mediaId }).session(session).lean();
  if (!stored) return null;
  const proof = validateEvidence(stored.evidence);
  assert(stored._id === proof.evidenceId && stored.version === 2 && stored.evidenceHash === proof.evidenceHash
    && date(stored.createdAt) === proof.evidenceCreatedAt
    && ['mediaId', 'familyId', 'childId'].every(key => identifier(stored[key]) === proof.tombstone[key]));
  const facts = await readDeletionFacts(mediaId, session);
  assert(equal(facts, { tombstone: proof.tombstone, receipts: proof.receipts }));
  if (asset) assert(matchesGuard(proof.uploadIdentity, identityFor(asset)));
  await checkGuard(proof, session);
  return proof;
};

const validateExternalUserDeletionRecovery = (external, frozen) => {
  assert(frozen && equal(validateEvidence(external), frozen));
};

module.exports = { readUserDeletionSnapshot, captureUserDeletionEvidence, loadUserDeletionRecovery,
  validateExternalUserDeletionRecovery };

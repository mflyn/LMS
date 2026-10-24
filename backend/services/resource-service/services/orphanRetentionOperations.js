const { createHash } = require('crypto');
const fail = code => Object.assign(new Error(code), { code });
const READ = { readPreference: 'primary', maxTimeMS: 5000 };
const oid = value => value?._bsontype === 'ObjectId';
const sameScope = (a, b) => String(a.familyId) === String(b.familyId) && String(a.childId) === String(b.childId);

// Inventory is a resource-side candidate report, never a grant to delete. In particular,
// only the subsequent homework transaction can adjudicate unpublished local intents.
const orphanInventory = async ({ connection, writesPaused, now = Date.now } = {}) => {
  if (writesPaused !== true) throw fail('INVALID_OPERATIONS_ARGUMENTS');
  const result = { eligible: 0, missing_policy: 0, retained: 0, in_use: 0, inconsistent: 0 };
  let cursor;
  try {
    const date = new Date(Number(now())); if (!Number.isFinite(date.getTime())) throw fail('INVALID_OPERATIONS_ARGUMENTS');
    const db = connection.db;
    cursor = db.collection('mediaassets').find({ purpose: 'task_completion', status: 'active' }, { ...READ, batchSize: 100,
      projection: { _id: 1, familyId: 1, childId: 1, retentionPolicyVersion: 1, orphanEligibleAt: 1, orphanRetirementId: 1 } });
    for await (const a of cursor) {
      if (![a._id, a.familyId, a.childId].every(oid) || a.orphanRetirementId) { result.inconsistent += 1; continue; }
      if (a.retentionPolicyVersion == null && a.orphanEligibleAt == null) { result.missing_policy += 1; continue; }
      if (a.retentionPolicyVersion !== 1 || !(a.orphanEligibleAt instanceof Date)
        || !Number.isFinite(a.orphanEligibleAt.getTime())) { result.inconsistent += 1; continue; }
      if (a.orphanEligibleAt > date) { result.retained += 1; continue; }
      const refs = await db.collection('mediareferences').find({ mediaId: a._id }, READ).toArray();
      const ops = await db.collection('mediareferenceoperations').find({ 'references.mediaId': a._id }, READ).toArray();
      if (refs.some(r => !sameScope(a, r)) || ops.some(o => !sameScope(a, o))) { result.inconsistent += 1; continue; }
      if (refs.some(r => ['prepared', 'bound'].includes(r.state)) || ops.some(o => ['PREPARED', 'COMMITTED'].includes(o.state))
        || await db.collection('mediadeletionreceipts').findOne({ mediaId: a._id }, READ)) { result.in_use += 1; continue; }
      const malformed = ops.some(o => o.state !== 'ABORTED' || !Array.isArray(o.references)
        || createHash('sha256').update(JSON.stringify(o.references.map(r => ({ mediaId: String(r.mediaId), field: r.field })))).digest('hex') !== o.referenceSetHash)
        || refs.some(r => r.state !== 'released' || !ops.some(o => o.operationId === r.operationId
          && String(o.resourceId) === String(r.resourceId) && r.releaseOperationId === o.operationId
          && r.releasedAt?.getTime() === o.terminalAt?.getTime()));
      result[malformed ? 'inconsistent' : 'eligible'] += 1;
    }
    return result;
  } catch (_cause) { throw fail('COMPLETION_RETENTION_NOT_READY'); }
  finally {
    try { if (cursor) await cursor.close(); }
    catch (_cause) { throw fail('COMPLETION_RETENTION_NOT_READY'); }
  }
};

const runOrphanCleanup = async ({ connection, writesPaused, env = process.env, execute, limit = 50 } = {}) => {
  if (env.COMPLETION_PROTOCOL_MODE !== 'enabled' || env.COMPLETION_ORPHAN_CLEANUP_ENABLED !== 'true') throw fail('COMPLETION_RETENTION_DISABLED');
  if (execute !== true || writesPaused !== true || !Number.isInteger(limit) || limit < 1 || limit > 100) throw fail('INVALID_OPERATIONS_ARGUMENTS');
  const { checkCompletionRecovery } = require('./completionOperations');
  await checkCompletionRecovery({ connection, writesPaused, env });
  const mongoose = require('mongoose');
  if (connection !== mongoose.connection) throw fail('COMPLETION_CONNECTION_MISMATCH');
  const { createRetentionDependencies } = require('./orphanRetentionRuntime');
  const { createPrivateMediaStore } = require('./privateMediaStore');
  const { createMongoTransactionRunner } = require('./mongoTransaction');
  const { createOrphanRetirementService } = require('./orphanRetirementService');
  const service = createOrphanRetirementService({ ...createRetentionDependencies(env),
    mediaStore: createPrivateMediaStore({ root: env.PRIVATE_MEDIA_ROOT }), transactionRunner: createMongoTransactionRunner(connection) });
  const result = { inspected: 0, purged: 0, skipped: 0, failed: 0 };
  try {
    const assets = connection.db.collection('mediaassets');
    // Both sources share one persisted order. A pending in-use prefix must not
    // outrank unchecked assets; absent metadata still permits retirement recovery.
    const cursor = assets.aggregate([
      { $match: { purpose: 'task_completion', status: 'active', retentionPolicyVersion: 1,
        orphanEligibleAt: { $lte: new Date() } } },
      { $project: { _id: 1, familyId: 1, childId: 1, orphanLastCheckedAt: { $ifNull: ['$orphanLastCheckedAt', null] } } },
      { $unionWith: { coll: 'mediaorphanretirements', pipeline: [
        { $match: { state: { $in: ['CANDIDATE', 'FENCED', 'DELETED', 'INCONSISTENT'] } } },
        { $lookup: { from: 'mediaassets', localField: 'mediaId', foreignField: '_id', as: 'asset' } },
        { $project: { _id: '$mediaId', familyId: 1, childId: 1,
          orphanLastCheckedAt: { $ifNull: [{ $arrayElemAt: ['$asset.orphanLastCheckedAt', 0] }, null] } } }
      ] } },
      { $facet: {
        clock: [{ $group: { _id: null,
          invalid: { $sum: { $cond: [{ $in: [{ $type: '$orphanLastCheckedAt' }, ['date', 'null']] }, 0, 1] } },
          minimum: { $min: { $cond: [{ $eq: [{ $type: '$orphanLastCheckedAt' }, 'date'] }, '$orphanLastCheckedAt', null] } },
          maximum: { $max: { $cond: [{ $eq: [{ $type: '$orphanLastCheckedAt' }, 'date'] }, '$orphanLastCheckedAt', null] } }
        } }],
        selected: [
          // Each identity occurs at most once per source. Keep a bounded prefix
          // large enough to fill the unique batch even when both sources match.
          { $sort: { orphanLastCheckedAt: 1, _id: 1 } }, { $limit: limit * 2 },
          { $group: { _id: '$_id', familyId: { $first: '$familyId' }, childId: { $first: '$childId' },
            orphanLastCheckedAt: { $max: '$orphanLastCheckedAt' } } },
          { $sort: { orphanLastCheckedAt: 1, _id: 1 } }, { $limit: limit }
        ]
      } }
    ], { ...READ, batchSize: limit });
    let batch;
    try { [batch] = await cursor.toArray(); } finally { await cursor.close(); }
    const { selected, clock } = batch;
    if (!selected.length) return result;
    // Advance beyond ALL candidates, not just the selected prefix: wall-clock
    // rollback must not strand a later, previously checked candidate in the future.
    const maxDate = 8640000000000000, now = Date.now(), bounds = clock[0];
    const validDate = value => value instanceof Date && Number.isFinite(value.getTime());
    if (!bounds || bounds.invalid || !Number.isSafeInteger(now) || Math.abs(now) > maxDate
      || [bounds.minimum, bounds.maximum].some(value => value !== null && !validDate(value))
      || bounds.maximum?.getTime() === maxDate) throw fail('COMPLETION_ORPHAN_CLEANUP_FAILED');
    const checkedAt = new Date(Math.max(now, bounds.maximum === null ? -maxDate : bounds.maximum.getTime() + 1));
    if (!validDate(checkedAt)) throw fail('COMPLETION_ORPHAN_CLEANUP_FAILED');
    for (const row of selected) {
      result.inspected += 1;
      try {
        // Record the attempt before remote I/O so failures/crashes also rotate.
        // Native update deliberately bypasses timestamps and __v, never upserts,
        // and cannot roll a concurrent scheduler's clock backward.
        await assets.updateOne({ _id: row._id, familyId: row.familyId, childId: row.childId },
          { $max: { orphanLastCheckedAt: checkedAt } }, { writeConcern: { w: 'majority', j: true } });
        const outcome = await service.retire({ mediaId: String(row._id) });
        result[outcome.state === 'PURGED' ? 'purged' : 'skipped'] += 1;
      }
      catch (_cause) { result.failed += 1; }
    }
  } catch (_cause) { result.failed += 1; }
  if (result.failed) throw Object.assign(fail('COMPLETION_ORPHAN_CLEANUP_FAILED'), { counts: result });
  return result;
};
module.exports = { orphanInventory, runOrphanCleanup };

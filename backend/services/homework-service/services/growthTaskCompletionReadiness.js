const { assertTransactionCapability } = require('../../../common/services/mongoTransaction');

// Native collection access avoids model import/autoIndex side effects during a read-only preflight.
const COLLECTION = 'growthtaskcompletionoperations';
const SCOPE = { familyId: 1, childId: 1, taskId: 1, actorId: 1, action: 1, operationId: 1 };
const REMOTE = { remoteOperationId: 1 };
// MongoDB's regex end anchor accepts a final newline; require the absolute end instead.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?![\s\S])/;
const MAX_TIME_MS = 5000;
const fail = issues => {
  const error = new Error('Task completion readiness check failed');
  error.code = 'COMPLETION_PROTOCOL_NOT_READY'; error.issues = [...new Set(issues)];
  throw error;
};
const sameKey = (left, right) => left && Object.keys(left).length === Object.keys(right).length
  && Object.keys(right).every(key => left[key] === right[key]);
const fullUnique = index => index.unique === true && !index.sparse
  && index.partialFilterExpression === undefined
  && (!index.collation || index.collation.locale === 'simple');
const validIndex = (index, key) => sameKey(index.key, key) && fullUnique(index);

const assertGrowthTaskCompletionReadiness = async ({ connection, writesPaused } = {}) => {
  if (writesPaused !== true) fail(['WRITES_NOT_PAUSED']);
  try {
    // Keep the shared capability rules while bounding this explicit preflight's hello command.
    await assertTransactionCapability({ db: { admin: () => ({
      command: command => connection.db.admin().command(command, { maxTimeMS: MAX_TIME_MS, readPreference: 'primary' })
    }) } }, 'homework-service');
  } catch (_cause) { fail(['TRANSACTIONS_UNAVAILABLE']); }

  let collection, indexes;
  try {
    collection = connection.db.collection(COLLECTION);
    // The driver's listIndexes helper drops includeBuildUUIDs; use the raw cursor command.
    const cursor = connection.db.runCursorCommand({ listIndexes: COLLECTION, includeBuildUUIDs: true,
      cursor: { batchSize: 100 }, maxTimeMS: MAX_TIME_MS }, { readPreference: 'primary' });
    try { indexes = await cursor.toArray(); } finally { await cursor.close(); }
  } catch (cause) {
    fail([cause?.code === 26 ? 'OPERATION_COLLECTION_MISSING' : 'READINESS_QUERY_FAILED']);
  }
  const issues = [];
  if (indexes.some(index => index.buildUUID !== undefined || index.spec !== undefined
    || index.indexBuildInfo !== undefined)) issues.push('INDEX_BUILD_IN_PROGRESS');
  if (!indexes.some(index => validIndex(index, SCOPE))) issues.push('COMMAND_SCOPE_INDEX_INVALID');
  if (!indexes.some(index => validIndex(index, REMOTE))) issues.push('REMOTE_MAPPING_INDEX_INVALID');
  if (indexes.some(index => index.expireAfterSeconds !== undefined)) issues.push('OPERATION_TTL_FORBIDDEN');
  if (indexes.some(index => (index.unique === true || index.prepareUnique === true) && !sameKey(index.key, { _id: 1 })
    && !validIndex(index, SCOPE) && !validIndex(index, REMOTE))) issues.push('UNEXPECTED_UNIQUE_INDEX');
  try {
    const invalid = await collection.findOne({ $or: [
      { $expr: { $ne: [{ $type: '$remoteOperationId' }, 'string'] } },
      { remoteOperationId: { $not: UUID } }
    ] }, { projection: { _id: 1 }, maxTimeMS: MAX_TIME_MS, readPreference: 'primary' });
    if (invalid) issues.push('REMOTE_MAPPING_INVALID');
    // Run both checks even when indexes are missing; report conflicts, never their identities.
    for (const [group, code] of [
      [Object.fromEntries(Object.keys(SCOPE).map(key => [key, '$' + key])), 'COMMAND_SCOPE_DUPLICATE'],
      ['$remoteOperationId', 'REMOTE_MAPPING_DUPLICATE']
    ]) {
      const duplicate = await collection.aggregate([
        { $group: { _id: group, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }, { $limit: 1 }, { $project: { _id: 0, count: 1 } }
      ], { maxTimeMS: MAX_TIME_MS, allowDiskUse: false, readPreference: 'primary' }).toArray();
      if (duplicate.length) issues.push(code);
    }
  } catch (_cause) { issues.push('READINESS_QUERY_FAILED'); }
  if (issues.length) fail(issues);
  return { ready: true, service: 'homework-service', protocol: 'task-completion-v1' };
};

module.exports = { assertGrowthTaskCompletionReadiness };

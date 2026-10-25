const { createHash } = require('crypto');
const { assertTransactionCapability } = require('../../../common/services/mongoTransaction');

// Do not import models: an explicit read-only preflight must never trigger autoIndex.
const COLLECTION = 'mediareferenceoperations';
const SCOPE = { familyId: 1, childId: 1, resourceType: 1, resourceId: 1, field: 1, operationId: 1 };
const FIELD = 'completionMediaIds';
const MAX_TIME_MS = 5000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?![\s\S])/;
const HASH = /^[0-9a-f]{64}(?![\s\S])/;
const CODE = /^[A-Z][A-Z0-9_]{0,79}(?![\s\S])/;
const matches = (value, pattern) => typeof value === 'string' && pattern.test(value);
const objectId = value => value?._bsontype === 'ObjectId' && typeof value.toHexString === 'function'
  && /^[0-9a-f]{24}(?![\s\S])/.test(value.toHexString());
const date = value => value instanceof Date && Number.isFinite(value.getTime());
const sameKey = (left, right) => left && Object.keys(left).length === Object.keys(right).length
  && Object.keys(right).every(key => left[key] === right[key]);
const validScopeIndex = index => sameKey(index.key, SCOPE) && index.unique === true && !index.sparse
  && index.partialFilterExpression === undefined && (!index.collation || index.collation.locale === 'simple');
const fail = issues => {
  const error = new Error('Media operation readiness check failed');
  error.code = 'MEDIA_OPERATION_PROTOCOL_NOT_READY'; error.issues = [...new Set(issues)];
  throw error;
};

const inspectOperation = (row, issues) => {
  if (![row._id, row.familyId, row.childId, row.resourceId].every(objectId) || row.resourceType !== 'growth_task'
    || row.field !== FIELD || !matches(row.operationId, UUID) || !matches(row.commandHash, HASH)) {
    issues.add('OPERATION_IDENTITY_INVALID');
  }
  const refs = row.references;
  const validRefs = Array.isArray(refs) && refs.length >= 1 && refs.length <= 10
    && Array.from(refs).every(ref => ref && Object.keys(ref).length === 2 && objectId(ref.mediaId) && ref.field === FIELD);
  if (!validRefs || !matches(row.referenceSetHash, HASH)) {
    issues.add('OPERATION_REFERENCES_INVALID');
  } else {
    const normalized = refs.map(ref => ({ mediaId: ref.mediaId.toHexString(), field: FIELD }));
    const canonical = [...normalized].sort((a, b) => a.mediaId.localeCompare(b.mediaId));
    if (new Set(normalized.map(ref => ref.mediaId)).size !== refs.length
      || JSON.stringify(normalized) !== JSON.stringify(canonical)
      || createHash('sha256').update(JSON.stringify(canonical)).digest('hex') !== row.referenceSetHash) {
      issues.add('OPERATION_REFERENCES_INVALID');
    }
  }
  const prepared = row.state === 'PREPARED';
  if (!['PREPARED', 'COMMITTED', 'ABORTED'].includes(row.state)
    || !Number.isSafeInteger(row.version) || row.version < 0
    || (prepared ? !date(row.leaseExpiresAt) || row.terminalAt != null
      : row.leaseExpiresAt != null || !date(row.terminalAt))
    || (row.state === 'ABORTED' ? !matches(row.failureCode, CODE) : row.failureCode != null)) {
    issues.add('OPERATION_STATE_INVALID');
  }
};

const assertMediaReferenceOperationReadiness = async ({ connection, writesPaused } = {}) => {
  if (writesPaused !== true) fail(['WRITES_NOT_PAUSED']);
  try {
    await assertTransactionCapability({ db: { admin: () => ({
      command: command => connection.db.admin().command(command, { maxTimeMS: MAX_TIME_MS, readPreference: 'primary' })
    }) } }, 'resource-service');
  } catch (_cause) { fail(['TRANSACTIONS_UNAVAILABLE']); }

  // Runtime operation lookups inherit the collection collation, not the index collation.
  let definition;
  try {
    const cursor = connection.db.listCollections({ name: COLLECTION }, {
      nameOnly: false, maxTimeMS: MAX_TIME_MS, readPreference: 'primary'
    });
    try { definition = await cursor.next(); } finally { await cursor.close(); }
  } catch (_cause) { fail(['READINESS_QUERY_FAILED']); }
  if (!definition) fail(['OPERATION_COLLECTION_MISSING']);
  if (definition.options?.collation && definition.options.collation.locale !== 'simple') {
    fail(['OPERATION_COLLECTION_COLLATION_INVALID']);
  }

  let collection, indexes;
  try {
    collection = connection.db.collection(COLLECTION);
    const cursor = connection.db.runCursorCommand({ listIndexes: COLLECTION, includeBuildUUIDs: true,
      cursor: { batchSize: 100 }, maxTimeMS: MAX_TIME_MS }, { readPreference: 'primary' });
    try { indexes = await cursor.toArray(); } finally { await cursor.close(); }
  } catch (cause) {
    fail([cause?.code === 26 ? 'OPERATION_COLLECTION_MISSING' : 'READINESS_QUERY_FAILED']);
  }
  const issues = new Set();
  if (indexes.some(index => index.buildUUID !== undefined || index.spec !== undefined
    || index.indexBuildInfo !== undefined)) issues.add('INDEX_BUILD_IN_PROGRESS');
  if (!indexes.some(validScopeIndex)) issues.add('COMMAND_SCOPE_INDEX_INVALID');
  if (indexes.some(index => index.expireAfterSeconds !== undefined)) issues.add('OPERATION_TTL_FORBIDDEN');
  if (indexes.some(index => (index.unique === true || index.prepareUnique === true)
    && !sameKey(index.key, { _id: 1 }) && !validScopeIndex(index))) issues.add('UNEXPECTED_UNIQUE_INDEX');
  try {
    // Stream only recovery evidence, not private payloads or an unbounded array of ledger rows.
    const cursor = collection.find({}, { projection: { _id: 1, ...SCOPE, commandHash: 1, referenceSetHash: 1,
      references: 1, state: 1, version: 1, leaseExpiresAt: 1, terminalAt: 1, failureCode: 1 },
    batchSize: 100, maxTimeMS: MAX_TIME_MS, readPreference: 'primary' });
    try { for await (const row of cursor) inspectOperation(row, issues); } finally { await cursor.close(); }
    const duplicate = await collection.aggregate([
      { $group: { _id: Object.fromEntries(Object.keys(SCOPE).map(key => [key, '$' + key])), count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }, { $limit: 1 }, { $project: { _id: 0, count: 1 } }
    ], { maxTimeMS: MAX_TIME_MS, allowDiskUse: false, readPreference: 'primary' }).toArray();
    if (duplicate.length) issues.add('COMMAND_SCOPE_DUPLICATE');
  } catch (_cause) { issues.add('READINESS_QUERY_FAILED'); }
  if (issues.size) fail(issues);
  return { ready: true, service: 'resource-service', protocol: 'task-completion-v1', scope: 'operation-ledger' };
};

module.exports = { assertMediaReferenceOperationReadiness };

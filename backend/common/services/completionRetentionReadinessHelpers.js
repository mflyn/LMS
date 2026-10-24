const { assertTransactionCapability } = require('./mongoTransaction');

// No model imports: preflight must not create collections or indexes as a side effect.
const READ = Object.freeze({ maxTimeMS: 5000, readPreference: 'primary' });
const matches = pattern => value => typeof value === 'string' && pattern.test(value);
const uuid = matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?![\s\S])/);
const storageKey = value => typeof value === 'string' && uuid(value.toLowerCase());
const hash = matches(/^[0-9a-f]{64}(?![\s\S])/);
const oid = value => value?._bsontype === 'ObjectId' && typeof value.toHexString === 'function'
  && /^[0-9a-f]{24}(?![\s\S])/.test(value.toHexString());
const date = value => value instanceof Date && Number.isFinite(value.getTime());
const sameId = (a, b) => oid(a) && oid(b) && a.toHexString() === b.toHexString();
const sameDate = (a, b) => date(a) && date(b) && a.getTime() === b.getTime();
const revision = value => Number.isSafeInteger(value) && value >= 1;
const sameScope = (a, b) => a && b && sameId(a.familyId, b.familyId) && sameId(a.childId, b.childId);
const fail = issues => {
  const error = new Error('Completion retention readiness check failed');
  error.code = 'COMPLETION_RETENTION_NOT_READY'; error.issues = [...new Set(issues)].sort(); throw error;
};
const consume = async (cursor, visitor) => {
  try { for await (const row of cursor) await visitor(row); } finally { await cursor.close(); }
};
const scan = (db, name, filter, projection, visitor) => consume(db.collection(name).find(filter,
  { ...READ, projection, batchSize: 100 }), visitor);
const one = (db, name, filter, projection) => db.collection(name).findOne(filter, { ...READ, projection });
const sameKey = (a, b) => a && Object.keys(a).length === Object.keys(b).length
  && Object.keys(b).every((key, i) => Object.keys(a)[i] === key && a[key] === b[key]);
const finalized = index => index.buildUUID === undefined && index.spec === undefined
  && index.indexBuildInfo === undefined && index.prepareUnique !== true;
const completeIndex = index => finalized(index) && !index.sparse && index.partialFilterExpression === undefined
  && index.expireAfterSeconds === undefined
  && (!index.collation || index.collation.locale === 'simple');
const assertCollections = async (db, specs) => {
  const issues = new Set();
  for (const [name, { unique = [], indexes = [] }] of Object.entries(specs)) {
    const cursor = db.listCollections({ name }, { ...READ, nameOnly: false });
    let definition;
    try { definition = await cursor.next(); } finally { await cursor.close(); }
    if (!definition) { issues.add('COLLECTION_MISSING'); continue; }
    if (definition.type !== 'collection' || definition.options?.collation && definition.options.collation.locale !== 'simple') {
      issues.add('COLLECTION_COLLATION_INVALID');
    }
    const indexCursor = db.runCursorCommand({ listIndexes: name, includeBuildUUIDs: true,
      cursor: { batchSize: 100 }, maxTimeMS: READ.maxTimeMS }, { readPreference: 'primary' });
    let list;
    try { list = await indexCursor.toArray(); } finally { await indexCursor.close(); }
    if (list.some(index => index.buildUUID !== undefined || index.spec !== undefined || index.indexBuildInfo !== undefined)) issues.add('INDEX_BUILD_IN_PROGRESS');
    if (list.some(index => index.prepareUnique === true)) issues.add('INDEX_PREPARE_UNIQUE_FORBIDDEN');
    if (list.some(index => index.expireAfterSeconds !== undefined)) issues.add('TTL_FORBIDDEN');
    const valid = (index, key, isUnique) => sameKey(index.key, key) && completeIndex(index)
      && (isUnique ? index.unique === true : index.unique !== true && index.hidden !== true);
    for (const key of unique) if (!list.some(index => valid(index, key, true))) issues.add('INDEX_INVALID');
    for (const key of indexes) if (!list.some(index => valid(index, key, false))) issues.add('INDEX_INVALID');
    if (list.some(index => (index.unique === true || index.prepareUnique === true)
      && !sameKey(index.key, { _id: 1 }) && !unique.some(key => valid(index, key, true)))) issues.add('UNEXPECTED_UNIQUE_INDEX');
  }
  if (issues.size) fail(issues);
};
const assertPrerequisites = async ({ connection, writesPaused }, specs) => {
  if (writesPaused !== true) fail(['WRITES_NOT_PAUSED']);
  try {
    await assertTransactionCapability({ db: { admin: () => ({
      command: command => connection.db.admin().command(command, READ)
    }) } });
  } catch (_cause) { fail(['TRANSACTIONS_UNAVAILABLE']); }
  try { await assertCollections(connection.db, specs); }
  catch (cause) {
    if (cause?.code === 'COMPLETION_RETENTION_NOT_READY') throw cause;
    fail(['READINESS_QUERY_FAILED']);
  }
};

module.exports = { READ, oid, uuid, storageKey, hash, date, sameId, sameDate, revision, sameScope,
  fail, consume, scan, one, assertPrerequisites };

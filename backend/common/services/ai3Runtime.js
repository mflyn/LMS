const mongoose = require('mongoose');
const { canonicalize } = require('json-canonicalize');
const { validateAi3Environment } = require('./ai3Activation');
const { assertTransactionCapability } = require('./mongoTransaction');
const { error } = require('./ai3ReviewEvidence');
const unavailable = () => error(503, 'AI3_NOT_READY');

// Read-only preflight. Never create collections/indexes or repair an inconsistent store.
async function assertAi3Indexes(connection, models) {
  await assertTransactionCapability({ db: { admin: () => ({ command: query => connection.db.admin()
    .command(query, { maxTimeMS: 5000, readPreference: 'primary' }) }) } }, 'AI3');
  for (const model of models) {
    const expected = model.schema.indexes().filter(([, options]) => options.unique);
    if (!expected.length) continue;
    const cursor = connection.db.runCursorCommand({ listIndexes: model.collection.collectionName,
      includeBuildUUIDs: true, cursor: { batchSize: 100 }, maxTimeMS: 5000 }, { readPreference: 'primary' });
    try {
      const actual = await cursor.toArray();
      for (const [key, options] of expected) {
        if (!actual.some(index => index.unique === true && Boolean(index.sparse) === Boolean(options.sparse) && !index.prepareUnique && !index.buildUUID
          && !index.spec && !index.indexBuildInfo && !index.buildInfo && (!index.collation || index.collation.locale === 'simple')
          && JSON.stringify(index.key) === JSON.stringify(key)
          && canonicalize(index.partialFilterExpression || null) === canonicalize(options.partialFilterExpression || null))) throw unavailable();
      }
    } finally { await cursor.close(); }
  }
}
function createAi3StoreRuntime({ env = process.env, connection = mongoose.connection, models, checkReady } = {}) {
  const initial = validateAi3Environment(env), token = env.AI3_EVIDENCE_TOKEN;
  const assertConnection = () => {
    if (connection !== mongoose.connection || !Array.isArray(models) || !models.length
      || models.some(model => model.db !== connection)) throw unavailable();
  };
  assertConnection();
  let ready = false;
  const getRuntime = () => {
    let current;
    try { current = validateAi3Environment(env); } catch (_) { throw unavailable(); }
    if (!current.continuousStore) return { enabled: false, continuousStore: false };
    assertConnection();
    if (!initial.continuousStore || token !== env.AI3_EVIDENCE_TOKEN || !ready || connection.readyState !== 1) throw unavailable();
    return { enabled: current.mode === 'enabled', continuousStore: true };
  };
  const assertContinuous = () => { if (!getRuntime().continuousStore) throw unavailable(); };
  const assertReady = async () => {
    ready = false;
    try {
      if (!validateAi3Environment(env).continuousStore) return;
      if (!initial.continuousStore || token !== env.AI3_EVIDENCE_TOKEN) throw unavailable();
      assertConnection();
      await assertAi3Indexes(connection, models);
      if (checkReady) await checkReady();
      assertConnection();
      ready = true; assertContinuous();
    } catch (_) { ready = false; throw unavailable(); }
  };
  const transactionRunner = async work => {
    assertContinuous();
    return require('./mongoTransaction').runMongoTransaction({ mongooseInstance: connection, work: async session => {
      assertContinuous(); const result = await work(session); assertContinuous(); return result;
    } });
  };
  return { assertReady, assertContinuous, transactionRunner, dependencies: { getRuntime } };
}
module.exports = { createAi3StoreRuntime, assertAi3Indexes };

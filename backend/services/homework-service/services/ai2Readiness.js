const M = require('../models/Ai2');
const { error, hash } = require('./ai2Contract');
const { assertTransactionCapability } = require('../../../common/services/mongoTransaction');
async function assertAi2Ready() {
  await assertTransactionCapability(M.Package.db, 'AI2');
  for (const model of Object.values(M)) {
    const cursor = model.db.db.runCursorCommand({ listIndexes: model.collection.collectionName,
      includeBuildUUIDs: true, cursor: { batchSize: 100 }, maxTimeMS: 5000 }, { readPreference: 'primary' });
    try {
      const indexes = await cursor.toArray();
      for (const [key, options] of model.schema.indexes().filter(([, o]) => o.unique)) {
        if (!indexes.some(i => i.unique === true && !i.sparse && !i.prepareUnique && !i.buildUUID && !i.spec
          && !i.indexBuildInfo && !i.buildInfo && (!i.collation || i.collation.locale === 'simple')
          && JSON.stringify(i.key) === JSON.stringify(key)
          && hash(i.partialFilterExpression || null) === hash(options.partialFilterExpression || null))) {
          throw error(503, 'AI2_NOT_READY');
        }
      }
    } finally { await cursor.close(); }
  }
}
module.exports = { assertAi2Ready };

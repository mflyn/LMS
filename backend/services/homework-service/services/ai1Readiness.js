const M = require('../models/Ai1');
const { error, hash } = require('./ai1Contract');

async function assertAi1Indexes() {
  for (const model of Object.values(M)) {
    const required = model.schema.indexes().filter(([, options]) => options.unique);
    if (!required.length) continue;
    const cursor = model.db.db.runCursorCommand({ listIndexes: model.collection.collectionName,
      includeBuildUUIDs: true, cursor: { batchSize: 100 }, maxTimeMS: 5000 }, { readPreference: 'primary' });
    try {
      const indexes = await cursor.toArray();
      if (!required.every(([key, options]) => indexes.some(i => i.unique === true && !i.sparse
        && !i.prepareUnique && !i.buildUUID && !i.spec && !i.indexBuildInfo && !i.buildInfo
        && (!i.collation || i.collation.locale === 'simple') && JSON.stringify(i.key) === JSON.stringify(key)
        && hash(i.partialFilterExpression || null) === hash(options.partialFilterExpression || null)))) {
        throw error(503, 'AI_PROFILE_UNAVAILABLE');
      }
    } finally { await cursor.close(); }
  }
}
module.exports = { assertAi1Indexes };

const mongoose = require('mongoose');
const Plan = require('../models/RecurringTaskPlan');
const Command = require('../models/RecurringTaskPlanCommand');
const Task = require('../models/GrowthTask');
const Cursor = require('../models/RecurringTaskScanState');
const { assertTransactionCapability, runMongoTransaction } = require('../../../common/services/mongoTransaction');
const { error } = require('./growthTaskCompletionCommand');
const { createRecurringTaskPlanService } = require('./recurringTaskPlanService');
const { createRecurringTaskPlanScanner } = require('./recurringTaskPlanScanner');
const { canonicalize } = require('json-canonicalize');
const unavailable = () => error(503, 'RECURRING_TASKS_NOT_READY');
const recurringEnabled = env => {
  if (![undefined, 'false', 'true'].includes(env.RECURRING_TASKS_ENABLED)) throw unavailable();
  return env.RECURRING_TASKS_ENABLED === 'true';
};
const assertRecurringReady = async ({ connection = mongoose.connection } = {}) => {
  try {
    if ([Plan, Command, Task, Cursor].some(model => model.db !== connection)) throw unavailable();
    await assertTransactionCapability({ db: { admin: () => ({ command: command => connection.db.admin()
      .command(command, { maxTimeMS: 5000, readPreference: 'primary' }) }) } }, 'recurring');
    for (const Model of [Plan, Command, Task, Cursor]) {
      const collections = connection.db.listCollections({ name: Model.collection.collectionName },
        { nameOnly: false, maxTimeMS: 5000, readPreference: 'primary' });
      try {
        const info = await collections.toArray();
        if (info.length !== 1 || info[0].type !== 'collection' || info[0].options?.collation
          && info[0].options.collation.locale !== 'simple') throw unavailable();
      } finally { await collections.close(); }
      const cursor = connection.db.runCursorCommand({ listIndexes: Model.collection.collectionName,
        includeBuildUUIDs: true, cursor: { batchSize: 100 }, maxTimeMS: 5000 }, { readPreference: 'primary' });
      try {
        const indexes = await cursor.toArray();
        const requirements = Model === Task ? Model.schema.indexes().filter(([, o]) => o.name === 'recurring_occurrence_identity')
          : Model.schema.indexes();
        requirements.push([{ _id: 1 }, {}]);
        for (const [key, options] of requirements) {
          if (!indexes.some(index => JSON.stringify(index.key) === JSON.stringify(key)
            && (!options.unique || index.unique === true) && !index.sparse && !index.hidden && !index.prepareUnique
            && index.buildUUID === undefined && index.spec === undefined && index.indexBuildInfo === undefined && index.buildInfo === undefined
            && index.expireAfterSeconds === undefined && (!index.collation || index.collation.locale === 'simple')
            && canonicalize(index.partialFilterExpression || null) === canonicalize(options.partialFilterExpression || null))) throw unavailable();
        }
        if (Model === Command && indexes.some(index => index.expireAfterSeconds !== undefined)) throw unavailable();
      } finally { await cursor.close(); }
    }
  } catch { throw unavailable(); }
};
const createRecurringTaskPlanRuntime = ({ env = process.env, connection = mongoose.connection, now = Date.now, logger } = {}) => {
  const configured = recurringEnabled(env);
  if (configured && env.COMPLETION_PROTOCOL_MODE !== 'enabled') throw unavailable();
  let ready = false;
  const enabled = () => configured && ready && env.RECURRING_TASKS_ENABLED === 'true' && env.COMPLETION_PROTOCOL_MODE === 'enabled';
  const service = createRecurringTaskPlanService({ transactionRunner: work => runMongoTransaction({ mongooseInstance: connection, work }), now, enabled });
  const scanner = createRecurringTaskPlanScanner({ service, enabled, logger });
  return { service, scanner, assertReady: async () => {
    ready = false;
    if (configured) { await assertRecurringReady({ connection }); ready = true; }
  } };
};
module.exports = { createRecurringTaskPlanRuntime, assertRecurringReady, recurringEnabled };

const mongoose = require('mongoose');
const { createAi3StoreRuntime } = require('../../../common/services/ai3Runtime');
const { createOperationClient } = require('./ai3Operation');
const { assertAiBudgetOwners } = require('./aiGenerationBudget');
const models = [...Object.values(require('../models/Ai3')), ...Object.values(require('../models/Ai2')),
  ...Object.values(require('../models/Ai1')), require('../../../common/models/Family'),
  require('../../../common/models/User'), require('../models/GrowthTask')];
function createAi3Runtime({ env = process.env, connection = mongoose.connection, ai1Runtime } = {}) {
  const runtime = createAi3StoreRuntime({ env, connection, models, checkReady: assertAiBudgetOwners });
  let operationClient;
  // Use the shared profile and ledger, but never the AI1 explanation operation client.
  if (env.AI3_STORE_CONTINUOUS === 'true' && ['enabled', 'query-only'].includes(ai1Runtime?.mode)) {
    const client = createOperationClient({ baseUrl: env.AI1_OPERATION_URL, token: env.AI1_OPERATION_TOKEN,
      allowLoopback: env.NODE_ENV === 'test' && env.AI1_ALLOW_LOOPBACK === 'true' });
    operationClient = ai1Runtime.mode === 'query-only' ? Object.freeze({ get: client.get }) : Object.freeze(client);
  }
  return { ...runtime, dependencies: { ...runtime.dependencies, transactionRunner: runtime.transactionRunner,
    getProfile: ai1Runtime?.dependencies.getProfile || (() => null),
    getLimits: ai1Runtime?.dependencies.getLimits || (() => null), operationClient } };
}
module.exports = { createAi3Runtime };

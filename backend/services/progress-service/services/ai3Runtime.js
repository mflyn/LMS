const mongoose = require('mongoose');
const { createAi3StoreRuntime } = require('../../../common/services/ai3Runtime');
const { createAi3EvidenceClient } = require('../../../common/services/ai3EvidenceClient');
const { createAi3EvidenceRouter } = require('../../../common/routes/ai3EvidenceRouter');
const { createAi3MasteryEffectService } = require('./ai3MasteryEffectService');
function createAi3Runtime({ env = process.env, connection = mongoose.connection } = {}) {
  const runtime = createAi3StoreRuntime({ env, connection, models: [require('../models/KnowledgePoint'),
    require('../models/KnowledgePointMasteryEvent'), require('../models/Ai3MasteryEffectReceipt'),
    require('../../../common/models/Family'), require('../../../common/models/User')] });
  let router;
  if (env.AI3_STORE_CONTINUOUS === 'true') {
    const proofClient = createAi3EvidenceClient({ kind: 'proof', baseUrl: env.HOMEWORK_SERVICE_URL, serviceToken: env.AI3_EVIDENCE_TOKEN });
    const service = createAi3MasteryEffectService({ proofClient, transactionRunner: runtime.transactionRunner });
    router = createAi3EvidenceRouter({ kind: 'mastery', serviceToken: env.AI3_EVIDENCE_TOKEN, service,
      assertContinuous: runtime.assertContinuous });
  }
  return { ...runtime, router };
}
module.exports = { createAi3Runtime };

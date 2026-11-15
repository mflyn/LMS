const { validateAi3Environment } = require('../../../common/services/ai3Activation');
const { createAi3MediaAccessClient } = require('./ai3MediaAccessClient');
const { AppError } = require('../../../common/middleware/errorTypes');
const unavailable = () => new AppError('AI3_NOT_READY', 503, 'AI3_NOT_READY', true, []);
function createAi3Runtime({ env = process.env, completionProtocol = false, isReady = () => false } = {}) {
  const initial = validateAi3Environment(env), token = env.AI3_EVIDENCE_TOKEN;
  if (initial.continuousStore && !completionProtocol) throw unavailable();
  const ai3MediaAccessClient = initial.continuousStore ? createAi3MediaAccessClient({
    homeworkServiceUrl: env.HOMEWORK_SERVICE_URL, serviceToken: env.MEDIA_REFERENCE_SERVICE_TOKEN }) : undefined;
  const assertAi3Continuous = () => {
    try {
      if (!initial.continuousStore || !validateAi3Environment(env).continuousStore || token !== env.AI3_EVIDENCE_TOKEN
        || !completionProtocol || !ai3MediaAccessClient || isReady() !== true) throw unavailable();
    } catch (_) { throw unavailable(); }
  };
  const getAi3Mode = () => {
    try { if (validateAi3Environment(env).mode !== 'enabled') return 'off'; assertAi3Continuous(); return 'enabled'; }
    catch (_) { return 'off'; }
  };
  return Object.freeze({ ai3MediaAccessClient, assertAi3Continuous, getAi3Mode });
}
module.exports = { createAi3Runtime };

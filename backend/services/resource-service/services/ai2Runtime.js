const { validateAi2Environment, resolveAi2Mode } = require('../../../common/services/ai2Activation');
const { AppError } = require('../../../common/middleware/errorTypes');
const { createAi2MediaAccessClient } = require('./ai2MediaAccessClient');

const unavailable = () => new AppError('AI2_NOT_READY', 503, 'AI2_NOT_READY', true, []);
const configurationError = () => Object.assign(new Error('AI2_CONFIGURATION_REQUIRED'), { code: 'AI2_CONFIGURATION_REQUIRED' });

const createAi2Runtime = ({ env = process.env, completionProtocol = false, isReady = () => false } = {}) => {
  const initial = validateAi2Environment(env);
  if (initial.continuousStore && !completionProtocol) throw configurationError();
  let ai2MediaAccessClient;
  if (initial.continuousStore) {
    try {
      ai2MediaAccessClient = createAi2MediaAccessClient({ homeworkServiceUrl: env.HOMEWORK_SERVICE_URL,
        serviceToken: env.MEDIA_REFERENCE_SERVICE_TOKEN });
    } catch (_) { throw configurationError(); }
  }
  // A later env flip cannot manufacture a startup grant or dependencies absent at assembly.
  const assertAi2Continuous = () => {
    try {
      const current = validateAi2Environment(env);
      if (!initial.continuousStore || !current.continuousStore || !completionProtocol
        || !ai2MediaAccessClient || isReady() !== true) throw unavailable();
    } catch (_) { throw unavailable(); }
  };
  const getAi2Mode = () => {
    try {
      if (resolveAi2Mode(env) !== 'enabled') return 'off';
      assertAi2Continuous();
      return 'enabled';
    } catch (_) { return 'off'; }
  };
  return Object.freeze({ ai2MediaAccessClient, assertAi2Continuous, getAi2Mode });
};

module.exports = { createAi2Runtime };

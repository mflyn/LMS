const { validateAi2Environment } = require('./ai2Activation');
const invalid = () => Object.assign(new Error('AI3_CONFIGURATION_REQUIRED'), { code: 'AI3_CONFIGURATION_REQUIRED' });
function validateAi3Environment(env = process.env) {
  const mode = env.AI3_MODE === undefined ? 'off' : env.AI3_MODE;
  if (!['off', 'enabled'].includes(mode) || env.AI3_STORE_CONTINUOUS !== undefined
    && !['true', 'false'].includes(env.AI3_STORE_CONTINUOUS)) throw invalid();
  const continuousStore = env.AI3_STORE_CONTINUOUS === 'true';
  if (mode === 'enabled' && !continuousStore) throw invalid();
  if (continuousStore) {
    try {
      if (!validateAi2Environment(env).continuousStore || env.COMPLETION_PROTOCOL_MODE !== 'enabled') throw invalid();
    } catch (_) { throw invalid(); }
    const token = env.AI3_EVIDENCE_TOKEN;
    if (typeof token !== 'string' || token.length < 32 || /[^\x21-\x7e]/.test(token)
      || ['JWT_SECRET', 'GATEWAY_IDENTITY_SECRET', 'INTERNAL_SERVICE_TOKEN', 'MEDIA_REFERENCE_SERVICE_TOKEN',
        'MEDIA_SIGNING_SECRET', 'COMPLETION_RETIREMENT_SERVICE_TOKEN', 'AI1_OPERATION_TOKEN', 'AI3_OPERATION_TOKEN']
        .some(key => env[key] === token)) throw invalid();
  }
  return { mode, continuousStore };
}
module.exports = { validateAi3Environment };

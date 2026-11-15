const invalid = () => Object.assign(new Error('AI2_CONFIGURATION_REQUIRED'), { code: 'AI2_CONFIGURATION_REQUIRED' });

function resolveAi2Mode(env = process.env) {
  const mode = env.AI2_MODE === undefined ? 'off' : env.AI2_MODE;
  if (mode !== 'off' && mode !== 'enabled') throw invalid();
  return mode;
}

function validateAi2Environment(env = process.env) {
  const mode = resolveAi2Mode(env);
  const value = env.AI2_STORE_CONTINUOUS;
  if (value !== undefined && value !== 'false' && value !== 'true') throw invalid();
  const continuousStore = value === 'true';
  if ((mode === 'enabled' && !continuousStore)
    || (continuousStore && env.COMPLETION_PROTOCOL_MODE !== 'enabled')) throw invalid();
  return { mode, continuousStore };
}

module.exports = { resolveAi2Mode, validateAi2Environment };

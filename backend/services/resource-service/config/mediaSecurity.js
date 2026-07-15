const SECURITY_PROFILES = Object.freeze(['trusted-local', 'secure-production']);

const configurationError = (name, requirement) => new Error(
  `${name} ${requirement}`
);

const positiveInteger = (env, name, fallback, { max = Number.MAX_SAFE_INTEGER } = {}) => {
  const rawValue = env[name] === undefined || env[name] === '' ? String(fallback) : String(env[name]);
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw configurationError(name, `must be an integer between 1 and ${max}`);
  }
  return value;
};

const resolveMediaSecurity = (env = process.env) => {
  const nodeEnv = String(env.NODE_ENV || 'development').trim().toLowerCase();
  const suppliedProfile = String(env.MEDIA_SECURITY_PROFILE || '').trim();
  const profile = suppliedProfile || (nodeEnv === 'production' ? '' : 'trusted-local');

  if (!SECURITY_PROFILES.includes(profile)) {
    throw configurationError(
      'MEDIA_SECURITY_PROFILE',
      'must be explicitly set to trusted-local or secure-production'
    );
  }

  if (profile === 'trusted-local') return Object.freeze({ profile });

  const host = String(env.CLAMAV_HOST === undefined ? 'clamav' : env.CLAMAV_HOST).trim();
  if (!host) throw configurationError('CLAMAV_HOST', 'must be a non-empty host');

  const scannerConfig = Object.freeze({
    host,
    port: positiveInteger(env, 'CLAMAV_PORT', 3310, { max: 65535 }),
    connectTimeoutMs: positiveInteger(env, 'CLAMAV_CONNECT_TIMEOUT_MS', 2000),
    scanTimeoutMs: positiveInteger(env, 'CLAMAV_SCAN_TIMEOUT_MS', 30000)
  });

  return Object.freeze({ profile, scannerConfig });
};

module.exports = {
  SECURITY_PROFILES,
  resolveMediaSecurity
};

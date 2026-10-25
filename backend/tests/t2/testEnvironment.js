// Dedicated process-local synthetic credentials; never use an operator's environment.
const values = {
  NODE_ENV: 'test', LOG_LEVEL: 'error', ENABLE_RABBITMQ: 'false',
  JWT_SECRET: 't2-synthetic-jwt-secret-at-least-32-characters',
  GATEWAY_IDENTITY_SECRET: 't2-synthetic-gateway-secret-at-least-32-characters',
  INTERNAL_SERVICE_TOKEN: 't2-synthetic-stars-token-at-least-32-characters',
  MEDIA_REFERENCE_SERVICE_TOKEN: 't2-synthetic-reference-token-at-least-32-characters',
  MEDIA_SIGNING_SECRET: 't2-synthetic-signing-secret-at-least-32-characters',
  COMPLETION_RETIREMENT_SERVICE_TOKEN: 't2-synthetic-retirement-token-at-least-32-characters',
  COMPLETION_PROTOCOL_MODE: 'enabled', COMPLETION_WRITES_PAUSED: 'true',
  COMPLETION_ORPHAN_CLEANUP_ENABLED: 'false', COMPLETION_STORAGE_CONFIRMED: 'true',
  MEDIA_SECURITY_PROFILE: 'trusted-local', REQUEST_TIMEOUT_MS: '10000',
  STAR_AWARD_TIMEOUT_MS: '2000', STAR_AWARD_RETRY_ATTEMPTS: '0',
  MEDIA_REFERENCE_TIMEOUT_MS: '2000', NOTIFICATION_SOURCE_MAX_TIME_MS: '2000'
};
const configureEnvironment = additions => {
  const next = { ...values, ...additions };
  const previous = Object.fromEntries(Object.keys(next).map(key => [key, process.env[key]]));
  Object.assign(process.env, next);
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  };
};
const quietLogger = Object.fromEntries(['error', 'warn', 'info', 'debug', 'http', 'log'].map(key => [key, () => {}]));
const safeError = error => {
  const code = /^[A-Z][A-Z0-9_]{1,80}$/.test(error?.code || '') ? error.code : 'T2_RUNTIME_FAILED';
  return Object.assign(new Error(code), { code });
};
module.exports = { configureEnvironment, quietLogger, safeError };

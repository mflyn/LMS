process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'task11-jwt-secret-at-least-32-characters';
process.env.GATEWAY_IDENTITY_SECRET = 'task11-gateway-identity-secret-at-least-32-characters';
process.env.INTERNAL_SERVICE_TOKEN = 'task11-internal-service-token-at-least-32-characters';
process.env.MEDIA_REFERENCE_SERVICE_TOKEN = 'task11-media-reference-token-at-least-32-characters';
process.env.MEDIA_SIGNING_SECRET = 'task11-media-signing-secret-at-least-32-characters';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/task11-bootstrap';
process.env.USER_SERVICE_MONGO_URI = process.env.MONGO_URI;
process.env.REQUEST_TIMEOUT_MS = '10000';
process.env.STAR_AWARD_TIMEOUT_MS = '2000';
process.env.STAR_AWARD_RETRY_ATTEMPTS = '0';
process.env.MEDIA_REFERENCE_TIMEOUT_MS = '2000';
process.env.NOTIFICATION_SOURCE_MAX_TIME_MS = '2000';
process.env.LOG_LEVEL = 'error';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const redactRuntimeError = (error, { privateRoot } = {}) => {
  let message = error && error.message ? String(error.message) : 'Task 11 runtime failed';
  const secrets = [
    process.env.JWT_SECRET,
    process.env.GATEWAY_IDENTITY_SECRET,
    process.env.INTERNAL_SERVICE_TOKEN,
    process.env.MEDIA_REFERENCE_SERVICE_TOKEN,
    process.env.MEDIA_SIGNING_SECRET,
    privateRoot
  ].filter(Boolean);

  secrets.forEach((secret) => {
    message = message.replace(new RegExp(escapeRegExp(secret), 'g'), '[REDACTED]');
  });
  message = message
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/(pin\s*[:=]\s*)[^\s&,]+/gi, '$1[REDACTED]')
    .replace(/((?:signature|nonce|expires)=)[^&\s]+/gi, '$1[REDACTED]');

  const redacted = new Error(message);
  redacted.name = error?.name || 'Error';
  return redacted;
};

module.exports = { redactRuntimeError };

const crypto = require('crypto');
const { AppError } = require('./errorTypes');

const sharedKeys = ['MEDIA_REFERENCE_SERVICE_TOKEN', 'INTERNAL_SERVICE_TOKEN', 'STAR_SERVICE_TOKEN',
  'GATEWAY_IDENTITY_SECRET', 'JWT_SECRET', 'MEDIA_SIGNING_SECRET'];
const digest = value => crypto.createHash('sha256').update(value || '').digest();

const createCompletionRetirementCredential = (env = {}) => {
  const token = env.COMPLETION_RETIREMENT_SERVICE_TOKEN;
  if (typeof token !== 'string' || token.length < 32 || token.trim() !== token
    || sharedKeys.some(key => env[key] && env[key] === token)) {
    throw Object.assign(new Error('COMPLETION_RETIREMENT_CREDENTIAL_INVALID'), { code: 'COMPLETION_RETIREMENT_CREDENTIAL_INVALID' });
  }
  const expected = digest(token);
  return (req, _res, next) => {
    const supplied = req.get('x-service-token');
    if (!supplied || !crypto.timingSafeEqual(digest(supplied), expected)) {
      return next(new AppError('Invalid service credential', 401, 'INVALID_SERVICE_CREDENTIAL', true, []));
    }
    return next();
  };
};

module.exports = { createCompletionRetirementCredential };

const crypto = require('crypto');
const config = require('../config');
const { sendFamilyError } = require('../../../common/utils/familyResponse');

const digest = (value) => crypto.createHash('sha256').update(String(value || '')).digest();

const createServiceCredentialMiddleware = (expectedToken = config.internalServiceToken) => (
  (req, res, next) => {
    const suppliedToken = req.get('x-service-token');
    if (!suppliedToken || !crypto.timingSafeEqual(digest(suppliedToken), digest(expectedToken))) {
      return sendFamilyError(res, 401, 'INVALID_SERVICE_CREDENTIAL', 'Invalid service credential');
    }
    return next();
  }
);

module.exports = { createServiceCredentialMiddleware, digest };

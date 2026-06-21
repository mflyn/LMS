const crypto = require('crypto');

const { AppError } = require('../../../common/middleware/errorTypes');

const digest = (value) => crypto.createHash('sha256').update(String(value || '')).digest();

const createMediaReferenceCredential = (expectedToken) => {
  if (typeof expectedToken !== 'string' || expectedToken.length < 32) {
    throw new Error('MEDIA_REFERENCE_SERVICE_TOKEN must contain at least 32 characters');
  }
  const expectedDigest = digest(expectedToken);

  return (req, res, next) => {
    const supplied = req.get('x-service-token');
    const suppliedDigest = digest(supplied);
    if (!supplied || !crypto.timingSafeEqual(suppliedDigest, expectedDigest)) {
      return next(new AppError(
        'Invalid service credential',
        401,
        'INVALID_SERVICE_CREDENTIAL',
        true,
        []
      ));
    }
    return next();
  };
};

module.exports = {
  createMediaReferenceCredential,
  digest
};

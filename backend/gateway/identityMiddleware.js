const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../common/middleware/errorTypes');
const {
  assertIdentitySecret,
  createIdentityHeaders,
  stripClientIdentityHeaders
} = require('../common/middleware/gatewayIdentity');

const stripClientIdentity = (req, res, next) => {
  stripClientIdentityHeaders(req.headers);
  delete req.headers['x-service-token'];
  next();
};

const createAuthenticateToken = ({
  jwtSecret,
  identitySecret,
  now = Date.now,
  nonceFactory = crypto.randomUUID,
  jwtImpl = jwt
}) => {
  assertIdentitySecret(identitySecret);

  return (req, res, next) => {
    stripClientIdentityHeaders(req.headers);
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return next(new UnauthorizedError('No token provided'));
    }

    let user;
    try {
      user = jwtImpl.verify(token, jwtSecret);
    } catch (_error) {
      return next(new UnauthorizedError('Invalid or expired token'));
    }
    try {
      req.user = user;
      Object.assign(req.headers, createIdentityHeaders({
        method: req.method,
        originalUrl: req.originalUrl,
        user,
        secret: identitySecret,
        now: now(),
        nonce: nonceFactory()
      }));
      return next();
    } catch (error) {
      return next(error);
    }
  };
};

module.exports = {
  createAuthenticateToken,
  stripClientIdentity
};

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { UnauthorizedError, ForbiddenError } = require('../common/middleware/errorTypes');
const {
  assertIdentitySecret,
  createIdentityHeaders,
  stripClientIdentityHeaders
} = require('../common/middleware/gatewayIdentity');

const stripClientIdentity = (req, res, next) => {
  stripClientIdentityHeaders(req.headers);
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

    try {
      const user = jwtImpl.verify(token, jwtSecret);
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
      return next(new ForbiddenError('Invalid or expired token'));
    }
  };
};

module.exports = {
  createAuthenticateToken,
  stripClientIdentity
};

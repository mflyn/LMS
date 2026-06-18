const jwt = require('jsonwebtoken');
const { verifyIdentityEnvelope, resetIdentityNonceStore } = require('../../common/middleware/gatewayIdentity');
const { createAuthenticateToken, stripClientIdentity } = require('../identityMiddleware');

const JWT_SECRET = 'gateway-jwt-secret';
const IDENTITY_SECRET = 'test-gateway-identity-secret-32-bytes-long';

describe('gateway identity middleware', () => {
  beforeEach(() => resetIdentityNonceStore());

  test('strips client identity headers before authentication', () => {
    const req = {
      headers: {
        'x-user-id': 'forged-user',
        'x-user-role': 'admin',
        'x-gateway-signature': 'forged-signature'
      }
    };
    const next = jest.fn();

    stripClientIdentity(req, {}, next);

    expect(req.headers['x-user-id']).toBeUndefined();
    expect(req.headers['x-user-role']).toBeUndefined();
    expect(req.headers['x-gateway-signature']).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('replaces forged identity with a signed JWT-derived envelope', () => {
    const token = jwt.sign({ id: 'parent-1', role: 'parent', username: 'parent' }, JWT_SECRET);
    const req = {
      method: 'GET',
      originalUrl: '/api/families/me',
      headers: {
        authorization: `Bearer ${token}`,
        'x-user-id': 'forged-user',
        'x-user-role': 'admin'
      }
    };
    const next = jest.fn();
    const middleware = createAuthenticateToken({
      jwtSecret: JWT_SECRET,
      identitySecret: IDENTITY_SECRET,
      now: () => 1_750_000_000_000,
      nonceFactory: () => 'gateway-nonce-1'
    });

    middleware(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.headers['x-user-id']).toBe('parent-1');
    expect(req.headers['x-user-role']).toBe('parent');
    expect(verifyIdentityEnvelope({
      method: req.method,
      originalUrl: req.originalUrl,
      headers: req.headers,
      secret: IDENTITY_SECRET,
      now: 1_750_000_000_000
    })).toEqual(expect.objectContaining({ id: 'parent-1', role: 'parent' }));
  });
});

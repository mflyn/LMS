const {
  IDENTITY_HEADERS,
  createIdentityHeaders,
  verifyIdentityEnvelope,
  resetIdentityNonceStore
} = require('../gatewayIdentity');

const SECRET = 'test-gateway-identity-secret-32-bytes-long';
const NOW = 1_750_000_000_000;

describe('gateway identity envelope', () => {
  beforeEach(() => resetIdentityNonceStore());

  const request = {
    method: 'GET',
    originalUrl: '/api/children?z=2&a=1',
    user: {
      id: 'parent-1',
      role: 'parent',
      username: 'parent',
      familyId: 'family-1'
    }
  };

  test('creates and verifies a canonical signed identity envelope', () => {
    const headers = createIdentityHeaders({
      ...request,
      secret: SECRET,
      now: NOW,
      nonce: 'nonce-1'
    });

    expect(verifyIdentityEnvelope({
      method: request.method,
      originalUrl: '/api/children?a=1&z=2',
      headers,
      secret: SECRET,
      now: NOW
    })).toEqual(expect.objectContaining({
      id: 'parent-1',
      role: 'parent',
      familyId: 'family-1'
    }));
  });

  test('rejects signature tampering', () => {
    const headers = createIdentityHeaders({ ...request, secret: SECRET, now: NOW, nonce: 'nonce-2' });
    headers['x-user-role'] = 'admin';

    expect(() => verifyIdentityEnvelope({
      method: request.method,
      originalUrl: request.originalUrl,
      headers,
      secret: SECRET,
      now: NOW
    })).toThrow('INVALID_IDENTITY_ENVELOPE');
  });

  test('rejects expired envelopes', () => {
    const headers = createIdentityHeaders({ ...request, secret: SECRET, now: NOW, nonce: 'nonce-3' });

    expect(() => verifyIdentityEnvelope({
      method: request.method,
      originalUrl: request.originalUrl,
      headers,
      secret: SECRET,
      now: NOW + 301_000
    })).toThrow('IDENTITY_ENVELOPE_EXPIRED');
  });

  test('rejects nonce replay', () => {
    const headers = createIdentityHeaders({ ...request, secret: SECRET, now: NOW, nonce: 'nonce-4' });
    const verify = () => verifyIdentityEnvelope({
      method: request.method,
      originalUrl: request.originalUrl,
      headers,
      secret: SECRET,
      now: NOW
    });

    expect(verify()).toEqual(expect.objectContaining({ id: 'parent-1' }));
    expect(verify).toThrow('IDENTITY_ENVELOPE_REPLAYED');
  });

  test('declares every identity header that must be stripped', () => {
    expect(IDENTITY_HEADERS).toEqual(expect.arrayContaining([
      'x-user-id',
      'x-user-role',
      'x-user-name',
      'x-user-family-id',
      'x-user-child-id',
      'x-user-token-version',
      'x-gateway-timestamp',
      'x-gateway-nonce',
      'x-gateway-signature'
    ]));
  });
});

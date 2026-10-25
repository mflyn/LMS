const express = require('express');
const { createHttpTestHarness } = require('../../common/test/httpTestHarness');
const { request, close: closeHttp } = createHttpTestHarness();
afterEach(closeHttp);

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/error-contract-test';
process.env.GATEWAY_IDENTITY_SECRET = 'test-gateway-identity-secret-32-bytes-long';

const { authenticateGateway } = require('../../common/middleware/auth');
const { errorHandler, requestTracker } = require('../../common/middleware/errorHandler');
const { createAuthenticateToken } = require('../identityMiddleware');
const jwt = require('jsonwebtoken');

describe('production error contract', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test.each(['expired', 'invalid'])('%s real JWT is an authentication failure, not a permission denial', async kind => {
    const app = express(), nextHandler = jest.fn((req, res) => res.json({ success: true }));
    app.use(requestTracker);
    app.get('/protected', createAuthenticateToken({ jwtSecret: process.env.JWT_SECRET,
      identitySecret: process.env.GATEWAY_IDENTITY_SECRET }), nextHandler);
    app.use(errorHandler);
    const token = kind === 'expired' ? jwt.sign({ id: 'a'.repeat(24), role: 'student' },
      process.env.JWT_SECRET, { expiresIn: -1 }) : 'invalid.synthetic.credential';
    const response = await (await request(app)).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: { code: 'UNAUTHENTICATED', details: [] } });
    expect(nextHandler).not.toHaveBeenCalled();
    expect(JSON.stringify(response.body)).not.toContain(token);
  });

  test('identity envelope construction failure is not reported as an expired credential', async () => {
    const app = express();
    app.use(requestTracker);
    app.get('/protected', createAuthenticateToken({ jwtSecret: process.env.JWT_SECRET,
      identitySecret: process.env.GATEWAY_IDENTITY_SECRET, nonceFactory: () => { throw Error('synthetic internal failure'); } }),
    (_req, res) => res.json({ success: true }));
    app.use(errorHandler);
    const token = jwt.sign({ id: 'a'.repeat(24), role: 'parent' }, process.env.JWT_SECRET, { expiresIn: 60 });
    const response = await (await request(app)).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ success: false, error: { code: 'INTERNAL_ERROR' } });
    expect(JSON.stringify(response.body)).not.toContain('synthetic internal failure');
  });

  test('preserves the stable identity-envelope error from the real middleware chain', async () => {
    const app = express();
    app.use(requestTracker);
    app.get('/protected', authenticateGateway, (req, res) => res.json({ success: true }));
    app.use(errorHandler);

    const response = await (await request(app))
      .get('/protected')
      .set('x-user-id', 'forged-parent')
      .set('x-user-role', 'parent');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INVALID_IDENTITY_ENVELOPE',
        message: 'Invalid gateway identity envelope',
        details: []
      },
      requestId: expect.any(String)
    });
  });
});

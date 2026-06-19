const express = require('express');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/error-contract-test';
process.env.GATEWAY_IDENTITY_SECRET = 'test-gateway-identity-secret-32-bytes-long';

const { authenticateGateway } = require('../../common/middleware/auth');
const { errorHandler, requestTracker } = require('../../common/middleware/errorHandler');

describe('production error contract', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('preserves the stable identity-envelope error from the real middleware chain', async () => {
    const app = express();
    app.use(requestTracker);
    app.get('/protected', authenticateGateway, (req, res) => res.json({ success: true }));
    app.use(errorHandler);

    const response = await request(app)
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
      }
    });
  });
});

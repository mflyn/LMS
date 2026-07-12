process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'proxy-identity-jwt-secret-at-least-32-characters';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/proxy-identity-test';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET
  || 'proxy-identity-envelope-secret-at-least-32-characters';

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { authenticateGateway } = require('../../common/middleware/auth');
const { resetIdentityNonceStore } = require('../../common/middleware/gatewayIdentity');
const { createApp } = require('../server');

describe('gateway proxy identity envelope', () => {
  let upstream;
  let upstreamUrl;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/families', authenticateGateway, (req, res) => {
      res.json({ success: true, data: { user: req.user, originalUrl: req.originalUrl } });
    });
    upstream = await new Promise((resolve) => {
      const server = app.listen(0, '127.0.0.1', () => resolve(server));
    });
    upstreamUrl = `http://127.0.0.1:${upstream.address().port}`;
  });

  beforeEach(() => resetIdentityNonceStore());

  afterAll(async () => {
    if (upstream?.listening) {
      await new Promise((resolve) => upstream.close(resolve));
    }
  });

  test('preserves the signed request target for an exact mounted path', async () => {
    const gateway = createApp({
      serviceHosts: { user: upstreamUrl, data: upstreamUrl },
      jwtSecret: process.env.JWT_SECRET,
      identitySecret: process.env.GATEWAY_IDENTITY_SECRET
    });
    const token = jwt.sign({
      id: '6656875da7f86a0012c2a201',
      role: 'parent',
      username: 'task11-parent'
    }, process.env.JWT_SECRET);

    const response = await request(gateway)
      .post('/api/families')
      .set('Authorization', `Bearer ${token}`)
      .send({ familyName: 'Task 11 Family' });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toEqual(expect.objectContaining({
      id: '6656875da7f86a0012c2a201',
      role: 'parent'
    }));
    expect(response.body.data.originalUrl).toBe('/api/families');
  });
});

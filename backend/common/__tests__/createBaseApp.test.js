const request = require('supertest');

describe('createBaseApp security middleware', () => {
  const originalSensitiveLimit = process.env.SENSITIVE_RATE_LIMIT_MAX_REQUESTS;

  afterEach(() => {
    if (originalSensitiveLimit === undefined) {
      delete process.env.SENSITIVE_RATE_LIMIT_MAX_REQUESTS;
    } else {
      process.env.SENSITIVE_RATE_LIMIT_MAX_REQUESTS = originalSensitiveLimit;
    }
  });

  test('exposes a stricter sensitive limiter for authentication endpoints', async () => {
    process.env.SENSITIVE_RATE_LIMIT_MAX_REQUESTS = '2';
    const createBaseApp = require('../createBaseApp');
    const app = createBaseApp({
      serviceName: 'rate-limit-test',
      rateLimitOptions: { windowMs: 60 * 1000, max: 1000 },
      sensitiveRateLimitOptions: { windowMs: 60 * 1000 }
    });

    const sensitiveLimiter = app.get('sensitiveLimiter');
    expect(sensitiveLimiter).toEqual(expect.any(Function));
    app.post('/api/auth/child-pin-login', sensitiveLimiter, (req, res) => {
      res.json({ success: true });
    });

    await request(app).post('/api/auth/child-pin-login').send({ pin: '0000' }).expect(200);
    await request(app).post('/api/auth/child-pin-login').send({ pin: '0000' }).expect(200);
    const limited = await request(app).post('/api/auth/child-pin-login').send({ pin: '0000' });

    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: '请求过于频繁，请稍后再试'
      }
    });
  });
});

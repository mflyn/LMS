process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-user-service-route-tests';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/user-service-test';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../server');

const app = createApp({
  appLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
});

const tokenFor = (role) => jwt.sign(
  { id: `${role}-user`, role, username: `${role}-user` },
  process.env.JWT_SECRET,
  { expiresIn: '5m' }
);

describe('POST /api/auth/logout', () => {
  test.each(['parent', 'student'])('returns 204 with no body for an authenticated %s', async (role) => {
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${tokenFor(role)}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
  });

  test('is idempotent for repeated requests with the same token', async () => {
    const authorization = `Bearer ${tokenFor('parent')}`;

    await request(app).post('/api/auth/logout').set('Authorization', authorization).expect(204);
    await request(app).post('/api/auth/logout').set('Authorization', authorization).expect(204);
  });

  test('rejects a request without an access token', async () => {
    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(401);
    expect(response.body).toEqual(expect.objectContaining({
      success: false,
      error: expect.objectContaining({ code: 'UNAUTHENTICATED' })
    }));
  });

  test('rejects roles outside the family parent and child scopes', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${tokenFor('teacher')}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual(expect.objectContaining({
      success: false,
      error: expect.objectContaining({ code: 'ACCESS_DENIED' })
    }));
  });
});

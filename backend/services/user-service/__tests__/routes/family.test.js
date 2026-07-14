const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../../../../common/models/User');
const Family = require('../../../../common/models/Family');
const routes = require('../../routes');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');

process.env.GATEWAY_IDENTITY_SECRET = 'test-gateway-identity-secret-32-bytes-long';

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  return app;
};

const unique = (prefix) => `${prefix}${Math.random().toString(36).slice(2, 10)}`;

const createParent = (overrides = {}) => User.create({
  username: overrides.username || unique('p'),
  password: overrides.password || 'parent123',
  email: overrides.email || `${unique('p')}@example.com`,
  name: overrides.name || '测试家长',
  role: 'parent',
  ...overrides
});

const parentHeaders = (parent, method, originalUrl) => createIdentityHeaders({
  method,
  originalUrl,
  user: { id: parent._id.toString(), role: 'parent' },
  secret: process.env.GATEWAY_IDENTITY_SECRET
});

describe('family routes', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  test('parent creates one family and reads it back', async () => {
    const parent = await createParent();

    const createResponse = await request(app)
      .post('/api/families')
      .set(parentHeaders(parent, 'POST', '/api/families'))
      .send({ familyName: '小明的家', timezone: 'America/New_York' });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.family).toEqual(expect.objectContaining({
      familyName: '小明的家',
      timezone: 'America/New_York',
      ownerParentId: parent._id.toString()
    }));

    const readResponse = await request(app)
      .get('/api/families/me')
      .set(parentHeaders(parent, 'GET', '/api/families/me'));

    expect(readResponse.status).toBe(200);
    expect(readResponse.body.data.family.familyName).toBe('小明的家');
    expect(readResponse.body.data.family.timezone).toBe('America/New_York');
    expect(readResponse.body.data.children).toEqual([]);
  });

  test('family defaults timezone and rejects invalid IANA timezone', async () => {
    const defaultParent = await createParent();
    const defaultResponse = await request(app)
      .post('/api/families')
      .set(parentHeaders(defaultParent, 'POST', '/api/families'))
      .send({ familyName: '默认时区家庭' });

    expect(defaultResponse.status).toBe(201);
    expect(defaultResponse.body.data.family.timezone).toBe('Asia/Shanghai');

    const invalidParent = await createParent();
    const invalidResponse = await request(app)
      .post('/api/families')
      .set(parentHeaders(invalidParent, 'POST', '/api/families'))
      .send({ familyName: '错误时区家庭', timezone: 'Mars/Olympus' });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('parent cannot create a second family', async () => {
    const parent = await createParent();

    await request(app)
      .post('/api/families')
      .set(parentHeaders(parent, 'POST', '/api/families'))
      .send({ familyName: '第一个家' })
      .expect(201);

    const secondResponse = await request(app)
      .post('/api/families')
      .set(parentHeaders(parent, 'POST', '/api/families'))
      .send({ familyName: '第二个家' });

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.success).toBe(false);
  });

  test('database enforces one owned family per parent', async () => {
    const parent = await createParent();
    await Family.create({ familyName: '第一个家', ownerParentId: parent._id });

    await expect(Family.create({ familyName: '第二个家', ownerParentId: parent._id }))
      .rejects.toMatchObject({ code: 11000 });
  });

  test('family creation rolls back when linking the parent fails', async () => {
    const parent = await createParent();
    const update = jest.spyOn(User, 'findByIdAndUpdate')
      .mockRejectedValueOnce(new Error('parent link failed'));

    const response = await request(app)
      .post('/api/families')
      .set(parentHeaders(parent, 'POST', '/api/families'))
      .send({ familyName: '不应残留的家庭' });

    update.mockRestore();
    expect(response.status).toBe(500);
    expect(await Family.findOne({ ownerParentId: parent._id })).toBeNull();
    expect((await User.findById(parent._id)).familyId).toBeUndefined();
  });
});

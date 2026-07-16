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

  test('updates canonical familyName and timezone while rejecting aliases and ownership fields', async () => {
    const parent = await createParent();
    const family = (await request(app)
      .post('/api/families')
      .set(parentHeaders(parent, 'POST', '/api/families'))
      .send({ familyName: '旧家庭名' })).body.data.family;
    const endpoint = `/api/families/${family.familyId}`;

    const updated = await request(app)
      .patch(endpoint)
      .set(parentHeaders(parent, 'PATCH', endpoint))
      .send({ familyName: '新家庭名', timezone: 'Europe/London' });

    expect(updated.status).toBe(200);
    expect(updated.body.data.family).toEqual(expect.objectContaining({
      familyName: '新家庭名',
      timezone: 'Europe/London'
    }));

    for (const body of [
      { name: '错误别名' },
      { ownerParentId: new mongoose.Types.ObjectId().toString() },
      { familyName: '   ' },
      { familyName: 'x'.repeat(51) },
      { timezone: 'Mars/Olympus' }
    ]) {
      const response = await request(app)
        .patch(endpoint)
        .set(parentHeaders(parent, 'PATCH', endpoint))
        .send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('distinguishes missing families from another family', async () => {
    const parentA = await createParent();
    const parentB = await createParent();
    const familyB = (await request(app)
      .post('/api/families')
      .set(parentHeaders(parentB, 'POST', '/api/families'))
      .send({ familyName: 'B 家庭' })).body.data.family;

    const missingId = new mongoose.Types.ObjectId().toString();
    const missingPath = `/api/families/${missingId}`;
    const missing = await request(app)
      .patch(missingPath)
      .set(parentHeaders(parentA, 'PATCH', missingPath))
      .send({ familyName: '不存在' });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');

    const otherPath = `/api/families/${familyB.familyId}`;
    const other = await request(app)
      .patch(otherPath)
      .set(parentHeaders(parentA, 'PATCH', otherPath))
      .send({ familyName: '越权' });
    expect(other.status).toBe(403);
    expect(other.body.error.code).toBe('CHILD_ACCESS_DENIED');
  });

  test('rejects out-of-contract family creation fields and overlong names', async () => {
    const restrictedParent = await createParent();
    const restricted = await request(app)
      .post('/api/families')
      .set(parentHeaders(restrictedParent, 'POST', '/api/families'))
      .send({
        familyName: '受限字段家庭',
        ownerParentId: new mongoose.Types.ObjectId().toString()
      });
    expect(restricted.status).toBe(400);
    expect(restricted.body.error.code).toBe('VALIDATION_ERROR');

    const longNameParent = await createParent();
    const longName = await request(app)
      .post('/api/families')
      .set(parentHeaders(longNameParent, 'POST', '/api/families'))
      .send({ familyName: 'x'.repeat(51) });
    expect(longName.status).toBe(400);
    expect(longName.body.error.code).toBe('VALIDATION_ERROR');
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
    await Family.create({
      familyName: '第一个家',
      ownerParentId: parent._id,
      memberParentIds: [parent._id]
    });

    await expect(Family.create({
      familyName: '第二个家',
      ownerParentId: parent._id,
      memberParentIds: [parent._id]
    }))
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

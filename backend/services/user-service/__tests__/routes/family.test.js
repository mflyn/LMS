const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../../../../common/models/User');
const routes = require('../../routes');

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

const parentHeaders = (parent) => ({
  'x-user-id': parent._id.toString(),
  'x-user-role': 'parent'
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
      .set(parentHeaders(parent))
      .send({ familyName: '小明的家' });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.family).toEqual(expect.objectContaining({
      familyName: '小明的家',
      ownerParentId: parent._id.toString()
    }));

    const readResponse = await request(app)
      .get('/api/families/me')
      .set(parentHeaders(parent));

    expect(readResponse.status).toBe(200);
    expect(readResponse.body.data.family.familyName).toBe('小明的家');
    expect(readResponse.body.data.children).toEqual([]);
  });

  test('parent cannot create a second family', async () => {
    const parent = await createParent();

    await request(app)
      .post('/api/families')
      .set(parentHeaders(parent))
      .send({ familyName: '第一个家' })
      .expect(201);

    const secondResponse = await request(app)
      .post('/api/families')
      .set(parentHeaders(parent))
      .send({ familyName: '第二个家' });

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.success).toBe(false);
  });
});

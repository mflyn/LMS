const express = require('express');
const request = require('supertest');
const User = require('../../../../common/models/User');
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

const createParent = (name = '测试家长') => User.create({
  username: unique('p'),
  password: 'parent123',
  email: `${unique('p')}@example.com`,
  name,
  role: 'parent'
});

const signedHeaders = (user, method, originalUrl) => createIdentityHeaders({
  method,
  originalUrl,
  user,
  secret: process.env.GATEWAY_IDENTITY_SECRET
});

const parentHeaders = (parent, method, originalUrl) => signedHeaders({
  id: parent._id.toString(),
  role: 'parent'
}, method, originalUrl);

const childHeaders = (child, method, originalUrl) => signedHeaders({
  id: child._id.toString(),
  childId: child._id.toString(),
  role: 'student'
}, method, originalUrl);

const createFamily = async (app, parent, familyName = '测试家庭') => {
  const response = await request(app)
    .post('/api/families')
    .set(parentHeaders(parent, 'POST', '/api/families'))
    .send({ familyName });

  expect(response.status).toBe(201);
  return response.body.data.family;
};

const createChild = async (app, parent, childName = '小明') => {
  const response = await request(app)
    .post('/api/children')
    .set(parentHeaders(parent, 'POST', '/api/children'))
    .send({
      name: childName,
      grade: 3,
      school: '示例小学',
      textbookVersion: '人教版',
      interests: ['科学实验'],
      weakSubjects: ['数学'],
      sportsPreferences: ['跳绳'],
      artInterests: ['钢琴'],
      laborHabits: ['整理房间'],
      moralGoals: ['按时睡觉']
    });

  expect(response.status).toBe(201);
  return response.body.data.child;
};

describe('children routes', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  test('parent adds multiple children to own family', async () => {
    const parent = await createParent();
    await createFamily(app, parent, '小明的家');

    const firstChild = await createChild(app, parent, '小明');
    const secondChild = await createChild(app, parent, '小红');

    expect(firstChild).toEqual(expect.objectContaining({
      name: '小明',
      grade: 3,
      sportsPreferences: ['跳绳']
    }));
    expect(secondChild.name).toBe('小红');

    const listResponse = await request(app)
      .get('/api/children')
      .set(parentHeaders(parent, 'GET', '/api/children'));

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.items.map((child) => child.name)).toEqual(['小明', '小红']);
  });

  test('parent cannot read or edit another family child', async () => {
    const parentA = await createParent('家长 A');
    const parentB = await createParent('家长 B');
    await createFamily(app, parentA, 'A 家');
    await createFamily(app, parentB, 'B 家');
    const childB = await createChild(app, parentB, '别人家的孩子');

    const readResponse = await request(app)
      .get(`/api/children/${childB.childId}`)
      .set(parentHeaders(parentA, 'GET', `/api/children/${childB.childId}`));

    expect(readResponse.status).toBe(403);

    const editResponse = await request(app)
      .patch(`/api/children/${childB.childId}`)
      .set(parentHeaders(parentA, 'PATCH', `/api/children/${childB.childId}`))
      .send({ name: '不应修改' });

    expect(editResponse.status).toBe(403);
  });

  test('child pin login returns child-scoped token and child cannot list siblings', async () => {
    const parent = await createParent();
    const family = await createFamily(app, parent, '小明的家');
    const firstChild = await createChild(app, parent, '小明');
    await createChild(app, parent, '小红');

    await request(app)
      .post(`/api/children/${firstChild.childId}/pin`)
      .set(parentHeaders(parent, 'POST', `/api/children/${firstChild.childId}/pin`))
      .send({ pin: '1234' })
      .expect(200);

    const loginResponse = await request(app)
      .post('/api/auth/child-pin-login')
      .send({
        familyId: family.familyId,
        childId: firstChild.childId,
        pin: '1234'
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.token).toEqual(expect.any(String));
    expect(loginResponse.body.data.child.childId).toBe(firstChild.childId);

    const siblingsResponse = await request(app)
      .get('/api/children')
      .set(childHeaders({ _id: firstChild.childId }, 'GET', '/api/children'));

    expect(siblingsResponse.status).toBe(403);
  });
});

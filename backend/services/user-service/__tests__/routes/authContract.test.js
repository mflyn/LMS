const request = require('supertest');
const Role = require('../../../../common/models/Role');
const User = require('../../../../common/models/User');
const { createApp } = require('../../server');

const quietLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

const parentRegistration = (overrides = {}) => ({
  username: 'contract_parent',
  password: 'FamilyPass123!',
  name: 'Contract Parent',
  email: 'contract-parent@example.com',
  role: 'parent',
  ...overrides
});

const expectSuccessEnvelope = (response, status) => {
  expect(response.status).toBe(status);
  expect(Object.keys(response.body).sort()).toEqual(['data', 'success']);
  expect(response.body.success).toBe(true);
};

const expectErrorEnvelope = (response, status, code) => {
  expect(response.status).toBe(status);
  expect(Object.keys(response.body).sort()).toEqual(['error', 'success']);
  expect(response.body).toEqual({
    success: false,
    error: {
      code,
      message: expect.any(String),
      details: expect.any(Array)
    }
  });
};

describe('family auth response contract', () => {
  let app;

  beforeEach(async () => {
    app = createApp({ appLogger: quietLogger });
    await Role.create({ name: 'parent', description: 'Family parent' });
  });

  test('register returns the family success envelope', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(parentRegistration());

    expectSuccessEnvelope(response, 201);
    expect(response.body.data).toEqual({
      user: expect.objectContaining({
        username: 'contract_parent',
        name: 'Contract Parent',
        role: 'parent'
      }),
      token: expect.any(String)
    });
  });

  test('login returns the family success envelope', async () => {
    await User.create(parentRegistration());

    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'contract_parent', password: 'FamilyPass123!' });

    expectSuccessEnvelope(response, 200);
    expect(response.body.data).toEqual({
      user: expect.objectContaining({ username: 'contract_parent', role: 'parent' }),
      token: expect.any(String)
    });
  });

  test('change password returns the family success envelope', async () => {
    await User.create(parentRegistration());
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'contract_parent', password: 'FamilyPass123!' });

    const response = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .send({
        oldPassword: 'FamilyPass123!',
        newPassword: 'ChangedPass456!',
        confirmPassword: 'ChangedPass456!'
      });

    expectSuccessEnvelope(response, 200);
    expect(response.body.data).toEqual({});
  });

  test('invalid credentials return UNAUTHENTICATED', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'missing_parent', password: 'FamilyPass123!' });

    expectErrorEnvelope(response, 401, 'UNAUTHENTICATED');
  });

  test('incorrect old password returns UNAUTHENTICATED', async () => {
    await User.create(parentRegistration());
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'contract_parent', password: 'FamilyPass123!' });

    const response = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .send({
        oldPassword: 'IncorrectPass123!',
        newPassword: 'ChangedPass456!',
        confirmPassword: 'ChangedPass456!'
      });

    expectErrorEnvelope(response, 401, 'UNAUTHENTICATED');
  });

  test('duplicate registration returns RESOURCE_CONFLICT', async () => {
    await request(app).post('/api/auth/register').send(parentRegistration());

    const response = await request(app)
      .post('/api/auth/register')
      .send(parentRegistration({ email: 'another-parent@example.com' }));

    expectErrorEnvelope(response, 409, 'RESOURCE_CONFLICT');
  });

  test('invalid registration returns the validation error envelope', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(parentRegistration({ username: '' }));

    expectErrorEnvelope(response, 400, 'VALIDATION_ERROR');
  });
});

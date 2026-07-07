process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-notification-task7';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/notification-task7-test';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET
  || 'test-gateway-identity-secret-32-bytes-long';

const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../../common/models/User');
const Family = require('../../../common/models/Family');
const {
  createIdentityHeaders,
  resetIdentityNonceStore
} = require('../../../common/middleware/gatewayIdentity');

let mongoServer;

const silentLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

const unique = (prefix) => `${prefix}${Math.random().toString(36).slice(2, 10)}`;

const signedHeaders = (user, method, originalUrl) => createIdentityHeaders({
  method,
  originalUrl,
  user: {
    id: user._id ? user._id.toString() : user.id,
    role: user.role,
    familyId: user.familyId ? user.familyId.toString() : undefined,
    childId: user.role === 'student' ? (user._id ? user._id.toString() : user.id) : undefined,
    tokenVersion: user.role === 'student' ? user.childProfile.tokenVersion || 0 : undefined
  },
  secret: process.env.GATEWAY_IDENTITY_SECRET
});

const createFamilyFixture = async (label) => {
  const fixtureId = unique('f').slice(0, 9);
  const parent = await User.create({
    username: `p${fixtureId}`,
    password: 'parent123',
    email: `p${fixtureId}@example.com`,
    name: `${label}家长`,
    role: 'parent'
  });

  const family = await Family.create({
    familyName: `${label}家庭`,
    ownerParentId: parent._id,
    memberParentIds: [parent._id],
    childIds: []
  });

  const childSeed = `c${fixtureId}`;
  const child = await User.create({
    username: childSeed,
    password: 'child123',
    email: `${childSeed}@child.local`,
    name: `${label}孩子`,
    role: 'student',
    familyId: family._id,
    childProfile: {
      nickname: `${label}孩子`,
      grade: 3,
      tokenVersion: 0
    }
  });

  parent.familyId = family._id;
  parent.children = [child._id];
  family.childIds.push(child._id);
  await Promise.all([parent.save(), family.save()]);

  return { parent, family, child };
};

const buildFamilyNotificationApp = (routerOptions = {}) => {
  const { createFamilyNotificationsRouter } = require('../routes/familyNotifications');
  const app = express();
  app.locals.logger = silentLogger;
  app.use(express.json());
  app.use('/api/notifications', createFamilyNotificationsRouter(routerOptions));
  return app;
};

describe('Task 7 family notifications', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    resetIdentityNonceStore();
    if (mongoose.connection.readyState === 1) {
      await Promise.all(
        Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({}))
      );
    }
  });

  test('TC-T7-REG-001 createApp mounts injected routes without opening external resources', async () => {
    const { createApp } = require('../app');
    const familyNotificationsRouter = express.Router();
    familyNotificationsRouter.get('/probe', (req, res) => res.json({ ok: true }));

    const app = createApp({ familyNotificationsRouter, logger: silentLogger });

    await request(app)
      .get('/api/notifications/family/probe')
      .expect(200, { ok: true });
  });

  test('TC-T7-REG-001 importing server does not connect or listen before startServer', () => {
    jest.isolateModules(() => {
      const connect = jest.fn(() => Promise.resolve());
      const listen = jest.fn();
      const createServer = jest.fn(() => ({ listen }));
      const socketServer = jest.fn(() => ({ on: jest.fn() }));
      const amqpConnect = jest.fn(() => Promise.resolve());

      jest.doMock('mongoose', () => ({
        connect
      }));
      jest.doMock('http', () => ({
        createServer
      }));
      jest.doMock('socket.io', () => socketServer, { virtual: true });
      jest.doMock('amqplib', () => ({
        connect: amqpConnect
      }));
      jest.doMock('../routes', () => express.Router());

      const serverModule = require('../server');

      expect(serverModule.startServer).toEqual(expect.any(Function));
      expect(connect).not.toHaveBeenCalled();
      expect(amqpConnect).not.toHaveBeenCalled();
      expect(listen).not.toHaveBeenCalled();

      jest.dontMock('mongoose');
      jest.dontMock('http');
      jest.dontMock('socket.io');
      jest.dontMock('amqplib');
      jest.dontMock('../routes');
    });
  });

  test('TC-T7-SETTINGS-001 creates default reminder settings for the parent family on first read', async () => {
    const { parent, family } = await createFamilyFixture('settingsDefault');
    const app = buildFamilyNotificationApp();

    const response = await request(app)
      .get('/api/notifications/settings')
      .set(signedHeaders(parent, 'GET', '/api/notifications/settings'));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        settings: expect.objectContaining({
          familyId: family._id.toString(),
          taskReminderEnabled: true,
          overdueReminderEnabled: true,
          mistakeReviewReminderEnabled: true,
          dimensionReminderEnabled: true,
          weeklyReportReminderEnabled: true,
          weeklyReportDay: 7,
          quietHours: { start: '21:00', end: '07:00' }
        })
      }
    });
  });

  test('TC-T7-SETTINGS-001 service app exposes settings through the standard notification prefix', async () => {
    const { parent, family } = await createFamilyFixture('settingsApp');
    const { createApp } = require('../app');

    const response = await request(createApp({ logger: silentLogger }))
      .get('/api/notifications/settings')
      .set(signedHeaders(parent, 'GET', '/api/notifications/settings'));

    expect(response.status).toBe(200);
    expect(response.body.data.settings.familyId).toBe(family._id.toString());
  });

  test('TC-T7-SETTINGS-002 parent can patch allowed fields but cannot override ownership fields', async () => {
    const { parent, family } = await createFamilyFixture('settingsPatch');
    const app = buildFamilyNotificationApp();

    const response = await request(app)
      .patch('/api/notifications/settings')
      .set(signedHeaders(parent, 'PATCH', '/api/notifications/settings'))
      .send({
        taskReminderEnabled: false,
        weeklyReportDay: 3,
        quietHours: { start: '20:30', end: '06:15' }
      });

    expect(response.status).toBe(200);
    expect(response.body.data.settings).toEqual(expect.objectContaining({
      familyId: family._id.toString(),
      taskReminderEnabled: false,
      weeklyReportDay: 3,
      quietHours: { start: '20:30', end: '06:15' },
      updatedByParentId: parent._id.toString()
    }));

    const rejected = await request(app)
      .patch('/api/notifications/settings')
      .set(signedHeaders(parent, 'PATCH', '/api/notifications/settings'))
      .send({ familyId: new mongoose.Types.ObjectId().toString() });

    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('TC-T7-SETTINGS-003 rejects invalid weekday, quiet hours and non-boolean switches', async () => {
    const { parent } = await createFamilyFixture('settingsInvalid');
    const app = buildFamilyNotificationApp();

    const response = await request(app)
      .patch('/api/notifications/settings')
      .set(signedHeaders(parent, 'PATCH', '/api/notifications/settings'))
      .send({
        taskReminderEnabled: 'yes',
        weeklyReportDay: 8,
        quietHours: { start: '25:00', end: '07:00' }
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        details: expect.any(Array)
      }
    });
  });

  test('TC-T7-SETTINGS-004 child can read settings but cannot patch or read another family settings', async () => {
    const familyA = await createFamilyFixture('settingsChildA');
    const familyB = await createFamilyFixture('settingsChildB');
    const app = buildFamilyNotificationApp();

    const readOwn = await request(app)
      .get('/api/notifications/settings')
      .set(signedHeaders(familyA.child, 'GET', '/api/notifications/settings'));
    expect(readOwn.status).toBe(200);
    expect(readOwn.body.data.settings.familyId).toBe(familyA.family._id.toString());

    const patchOwn = await request(app)
      .patch('/api/notifications/settings')
      .set(signedHeaders(familyA.child, 'PATCH', '/api/notifications/settings'))
      .send({ taskReminderEnabled: false });
    expect(patchOwn.status).toBe(403);
    expect(patchOwn.body.error.code).toBe('CHILD_ACCESS_DENIED');

    const readOther = await request(app)
      .get(`/api/notifications/settings?familyId=${familyB.family._id}`)
      .set(signedHeaders(familyA.child, 'GET', `/api/notifications/settings?familyId=${familyB.family._id}`));
    expect(readOther.status).toBe(403);
    expect(readOther.body.error.code).toBe('CHILD_ACCESS_DENIED');
  });
});

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

const User = require('../../../../common/models/User');
const Family = require('../../../../common/models/Family');
const { errorHandler } = require('../../../../common/middleware/errorHandler');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');
const { createRoutes } = require('../../routes');

process.env.GATEWAY_IDENTITY_SECRET = 'test-gateway-identity-secret-32-bytes-long';

const MEDIA_A = '0123456789abcdef01234567';
let sequence = 0;

const headers = (user, method, path) => createIdentityHeaders({
  method,
  originalUrl: path,
  user,
  secret: process.env.GATEWAY_IDENTITY_SECRET
});

const fixture = async () => {
  sequence += 1;
  const parent = await User.create({
    username: `routeparent${sequence}`,
    password: 'parent123',
    email: `routeparent${sequence}@example.com`,
    name: '家长',
    role: 'parent'
  });
  const familyId = new mongoose.Types.ObjectId();
  const child = await User.create({
    username: `routechild${sequence}`,
    password: 'child123',
    email: `routechild${sequence}@example.com`,
    name: '孩子',
    role: 'student',
    familyId,
    childProfile: { nickname: '孩子', school: '原学校', grade: 3 }
  });
  await Family.create({
    _id: familyId,
    familyName: '测试家庭',
    ownerParentId: parent._id,
    memberParentIds: [parent._id],
    childIds: [child._id]
  });
  return { parent, child, familyId };
};

const appFor = (childAvatarMediaService, logger = null) => {
  const app = express();
  if (logger) app.locals.logger = logger;
  app.use(express.json());
  app.use('/api', createRoutes({ childAvatarMediaService }));
  app.use(errorHandler);
  return app;
};

const parentIdentity = (parent) => ({ id: parent._id.toString(), role: 'parent' });
const childIdentity = (child) => ({
  id: child._id.toString(),
  childId: child._id.toString(),
  familyId: child.familyId.toString(),
  role: 'student',
  tokenVersion: 0
});

describe('Child avatar media HTTP contract', () => {
  test('TC-T6-MEDIA-016E injected service sets public avatarMediaId without legacy avatar', async () => {
    const { parent, child } = await fixture();
    const service = {
      mutate: jest.fn(async ({ child: ownedChild, requestedAvatarMediaId, profilePatch }) => {
        ownedChild.childProfile.avatarMediaId = requestedAvatarMediaId;
        profilePatch.forEach(({ path, value }) => ownedChild.set(path, value));
        return ownedChild;
      }),
      resume: jest.fn(async (ownedChild) => ownedChild),
      publicAvatarMediaId: jest.fn((ownedChild) => (
        ownedChild.childProfile.avatarMediaId
          ? ownedChild.childProfile.avatarMediaId.toString()
          : null
      ))
    };
    const path = `/api/children/${child._id}`;
    const response = await request(appFor(service))
      .patch(path)
      .set(headers(parentIdentity(parent), 'PATCH', path))
      .send({ avatarMediaId: MEDIA_A, school: '新学校' });

    expect(response.status).toBe(200);
    expect(response.body.data.child).toEqual(expect.objectContaining({
      avatarMediaId: MEDIA_A,
      school: '新学校'
    }));
    expect(response.body.data.child.avatar).toBeUndefined();
    expect(service.mutate).toHaveBeenCalledWith(expect.objectContaining({
      familyId: child.familyId.toString(),
      requestedAvatarMediaId: MEDIA_A
    }));
  });

  test('TC-T6-MEDIA-016F disabled and unsafe avatar writes are rejected', async () => {
    const { parent, child } = await fixture();
    const path = `/api/children/${child._id}`;
    const app = appFor(null);
    const disabled = await request(app)
      .patch(path)
      .set(headers(parentIdentity(parent), 'PATCH', path))
      .send({ avatarMediaId: MEDIA_A });
    expect(disabled.status).toBe(400);
    expect(disabled.body.error.code).toBe('MEDIA_NOT_ENABLED');

    const unsafe = await request(app)
      .patch(path)
      .set(headers(parentIdentity(parent), 'PATCH', path))
      .send({ avatar: 'https://example.com/a.png' });
    expect(unsafe.status).toBe(400);
    expect(unsafe.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('TC-T6-MEDIA-016G maps pending service errors to the approved envelope', async () => {
    const { parent, child } = await fixture();
    const pending = Object.assign(new Error('Media reference operation is pending'), {
      status: 503,
      code: 'MEDIA_REFERENCE_PENDING',
      details: { resourceId: child._id.toString() }
    });
    const service = {
      mutate: jest.fn(async () => { throw pending; }),
      resume: jest.fn(),
      publicAvatarMediaId: jest.fn(() => null)
    };
    const path = `/api/children/${child._id}`;
    const response = await request(appFor(service))
      .patch(path)
      .set(headers(parentIdentity(parent), 'PATCH', path))
      .send({ avatarMediaId: MEDIA_A });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'MEDIA_REFERENCE_PENDING',
        message: 'Media reference operation is pending',
        details: { resourceId: child._id.toString() }
      }
    });
  });

  test('TC-T6-MEDIA-016L detail resumes while list never calls the media service', async () => {
    const { parent, child } = await fixture();
    const service = {
      mutate: jest.fn(),
      resume: jest.fn(async (ownedChild) => ownedChild),
      publicAvatarMediaId: jest.fn(() => null)
    };
    const app = appFor(service);
    const detailPath = `/api/children/${child._id}`;
    await request(app)
      .get(detailPath)
      .set(headers(parentIdentity(parent), 'GET', detailPath))
      .expect(200);
    expect(service.resume).toHaveBeenCalledTimes(1);

    await request(app)
      .get('/api/children')
      .set(headers(parentIdentity(parent), 'GET', '/api/children'))
      .expect(200);
    expect(service.resume).toHaveBeenCalledTimes(1);
  });

  test('TC-T6-MEDIA-018A child identities cannot mutate avatars', async () => {
    const { child } = await fixture();
    const service = { mutate: jest.fn(), resume: jest.fn(), publicAvatarMediaId: jest.fn(() => null) };
    const path = `/api/children/${child._id}`;
    const response = await request(appFor(service))
      .patch(path)
      .set(headers(childIdentity(child), 'PATCH', path))
      .send({ avatarMediaId: MEDIA_A });
    expect(response.status).toBe(403);
    expect(service.mutate).not.toHaveBeenCalled();
  });

  test.each([
    ['pending', Object.assign(new Error('Media reference operation is pending'), {
      status: 503,
      code: 'MEDIA_REFERENCE_PENDING',
      details: { resourceId: 'approved-resource-id' },
      credential: 'secret-token-sentinel',
      profilePatch: 'private-profile-sentinel'
    })],
    ['database', new Error('private-database-sentinel')]
  ])('TC-T6-MEDIA-018B %s errors redact private response and audit data', async (label, failure) => {
    const { parent, child } = await fixture();
    if (failure.details) failure.details.resourceId = child._id.toString();
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const service = {
      mutate: jest.fn(async () => { throw failure; }),
      resume: jest.fn(),
      publicAvatarMediaId: jest.fn(() => null)
    };
    const path = `/api/children/${child._id}`;
    const response = await request(appFor(service, logger))
      .patch(path)
      .set(headers(parentIdentity(parent), 'PATCH', path))
      .send({ avatarMediaId: MEDIA_A, school: 'private-profile-sentinel' });

    const serialized = JSON.stringify({ response: response.body, logs: logger.info.mock.calls });
    expect(serialized).not.toContain('secret-token-sentinel');
    expect(serialized).not.toContain('private-profile-sentinel');
    expect(serialized).not.toContain('private-database-sentinel');
    expect(logger.info).toHaveBeenCalledWith('Family operation', expect.objectContaining({
      operation: 'child.avatar.update',
      familyId: child.familyId.toString(),
      childId: child._id.toString(),
      mediaIds: [MEDIA_A]
    }));
    expect(response.body.error.code).toBe(label === 'pending'
      ? 'MEDIA_REFERENCE_PENDING'
      : 'INTERNAL_ERROR');
  });

  test('TC-T6-MEDIA-016M legacy avatar is omitted and route import has no connection side effect', async () => {
    const { parent, child } = await fixture();
    await User.findByIdAndUpdate(child._id, {
      $set: { avatar: 'https://legacy.example/root.png', 'childProfile.avatar': 'https://legacy.example/profile.png' }
    });
    const connect = jest.spyOn(mongoose, 'connect');
    jest.isolateModules(() => require('../../routes'));
    expect(connect).not.toHaveBeenCalled();
    connect.mockRestore();

    const response = await request(appFor(null))
      .get('/api/children')
      .set(headers(parentIdentity(parent), 'GET', '/api/children'));
    expect(response.status).toBe(200);
    expect(response.body.data.items[0].avatar).toBeUndefined();
    expect(response.body.data.items[0].avatarMediaId).toBeNull();
  });
});

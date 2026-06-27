process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-growth-task-media-route-tests';
process.env.GATEWAY_IDENTITY_SECRET = 'test-gateway-identity-secret-32-bytes-long';

jest.mock('../services/starAwardClient', () => ({
  awardTaskStar: jest.fn().mockResolvedValue({ awarded: true, ledgerEntryId: 'ledger-default', starBalance: 1 }),
  validateClientConfig: jest.fn()
}));

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { createGrowthTaskRouter } = require('../routes/growthTasks');
const GrowthTask = require('../models/GrowthTask');
const User = require('../../../common/models/User');
const Family = require('../../../common/models/Family');
const { createIdentityHeaders } = require('../../../common/middleware/gatewayIdentity');
const { errorHandler } = require('../../../common/middleware/errorHandler');

const FAMILY_ID = '111111111111111111111111';
const MEDIA_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OPERATION_A = '11111111-1111-4111-8111-111111111111';

const unique = (prefix) => `${prefix}${Math.random().toString(36).slice(2, 10)}`;

const userHeaders = (user, method, originalUrl) => createIdentityHeaders({
  method,
  originalUrl,
  user: {
    id: user._id.toString(),
    childId: user.role === 'student' ? user._id.toString() : undefined,
    familyId: user.familyId ? user.familyId.toString() : undefined,
    tokenVersion: user.role === 'student' ? user.childProfile.tokenVersion || 0 : undefined,
    role: user.role
  },
  secret: process.env.GATEWAY_IDENTITY_SECRET
});

const createFamilyFixture = async (label) => {
  const parent = await User.create({
    username: unique('p'),
    password: 'parent123',
    email: `${unique('p')}@example.com`,
    name: `${label}家长`,
    role: 'parent'
  });
  const family = await Family.create({
    _id: new mongoose.Types.ObjectId(FAMILY_ID),
    familyName: `${label}家庭`,
    ownerParentId: parent._id,
    memberParentIds: [parent._id],
    childIds: []
  });
  const child = await User.create({
    username: unique('c'),
    password: 'child123',
    email: `${unique('c')}@child.local`,
    name: `${label}孩子`,
    role: 'student',
    familyId: family._id,
    childProfile: { nickname: `${label}孩子`, grade: 3 }
  });
  family.childIds.push(child._id);
  await family.save();
  parent.familyId = family._id;
  parent.children = [child._id];
  await parent.save();
  return { parent, family, child };
};

const taskInput = (parent, child, overrides = {}) => ({
  childId: child._id,
  familyId: child.familyId,
  createdByParentId: parent._id,
  dimension: 'academic',
  title: '媒体恢复任务',
  taskType: 'practice',
  dueDate: '2030-01-02',
  attachmentMediaIds: [],
  attachmentMediaBindings: [],
  mediaReferenceState: 'pending',
  mediaBindingOperationId: OPERATION_A,
  attachmentMediaPendingIds: [MEDIA_A],
  attachmentMediaPreviousBindings: [],
  mediaBindingPhase: 'binding',
  mediaPendingTaskPatch: [],
  mediaMutationKind: 'create',
  mediaRemoteOutcomeUncertain: true,
  ...overrides
});

const pendingMediaError = () => Object.assign(
  new Error('Media reference operation is pending'),
  { status: 503, code: 'MEDIA_REFERENCE_PENDING', details: [] }
);

const routeApp = (attachmentMediaService, awardTaskStar = jest.fn().mockResolvedValue({
  awarded: true,
  ledgerEntryId: 'ledger-1',
  starBalance: 1
})) => {
  const app = express();
  app.use(express.json());
  app.use('/api/growth-tasks', createGrowthTaskRouter({ attachmentMediaService, awardTaskStar }));
  app.use(errorHandler);
  return app;
};

const bindPendingTask = async (taskId) => GrowthTask.findOneAndUpdate(
  { _id: taskId },
  {
    $set: {
      attachmentMediaIds: [MEDIA_A],
      attachmentMediaBindings: [{ mediaId: MEDIA_A, bindingOperationId: OPERATION_A }],
      mediaReferenceState: 'bound'
    },
    $unset: {
      mediaBindingOperationId: '',
      attachmentMediaPendingIds: '',
      attachmentMediaPreviousBindings: '',
      mediaBindingPhase: '',
      mediaPendingTaskPatch: '',
      mediaMutationKind: '',
      mediaRemoteOutcomeUncertain: ''
    },
    $inc: { __v: 1 }
  },
  { new: true, runValidators: true }
).select('+attachmentMediaBindings');

describe('TC-T6-MEDIA-017K GrowthTask route lifecycle media recovery', () => {
  test('complete resumes pending media before mutating task status', async () => {
    const { parent, child } = await createFamilyFixture('完成恢复');
    const task = await GrowthTask.create(taskInput(parent, child));
    const observedStatuses = [];
    const attachmentMediaService = {
      resume: jest.fn(async (taskId) => {
        observedStatuses.push((await GrowthTask.findById(taskId)).status);
        return bindPendingTask(taskId);
      })
    };
    const endpoint = `/api/growth-tasks/${task._id}/complete`;

    const response = await request(routeApp(attachmentMediaService))
      .patch(endpoint)
      .set(userHeaders(child, 'PATCH', endpoint))
      .send({ actualMinutes: 12, difficulty: 'normal' });

    expect(response.status).toBe(200);
    expect(attachmentMediaService.resume).toHaveBeenCalledWith(task._id.toString());
    expect(observedStatuses).toEqual(['pending']);
    const stored = await GrowthTask.findById(task._id);
    expect(stored.status).toBe('completed');
    expect(stored.mediaReferenceState).toBe('bound');
  });

  test.each([
    ['complete', 'PATCH', (task) => `/api/growth-tasks/${task._id}/complete`, { actualMinutes: 12 }, { status: 'pending' }],
    ['confirm', 'PATCH', (task) => `/api/growth-tasks/${task._id}/confirm`, { parentFeedback: '稍后确认' }, { status: 'completed' }],
    ['delete', 'DELETE', (task) => `/api/growth-tasks/${task._id}`, undefined, { status: 'pending' }]
  ])('%s returns pending without lifecycle mutation when media recovery cannot converge',
    async (name, method, endpointFor, body, overrides) => {
      const { parent, child } = await createFamilyFixture(`未收敛${name}`);
      const task = await GrowthTask.create(taskInput(parent, child, overrides));
      const attachmentMediaService = { resume: jest.fn().mockRejectedValue(pendingMediaError()) };
      const endpoint = endpointFor(task);
      const actor = name === 'complete' ? child : parent;
      let operation = request(routeApp(attachmentMediaService))[method.toLowerCase()](endpoint)
        .set(userHeaders(actor, method, endpoint));
      if (body) operation = operation.send(body);

      const response = await operation;

      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe('MEDIA_REFERENCE_PENDING');
      expect(attachmentMediaService.resume).toHaveBeenCalledWith(task._id.toString());
      const stored = await GrowthTask.findById(task._id);
      expect(stored.status).toBe(overrides.status);
      expect(stored.mediaReferenceState).toBe('pending');
      expect(stored.completedAt).toBeUndefined();
      expect(stored.confirmedAt).toBeUndefined();
      expect(stored.cancelledAt).toBeUndefined();
    });
});

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-growth-task-media-route-tests';
process.env.GATEWAY_IDENTITY_SECRET = 'test-gateway-identity-secret-32-bytes-long';

jest.mock('../services/starAwardClient', () => ({
  awardTaskStar: jest.fn().mockResolvedValue({ awarded: true, ledgerEntryId: 'ledger-default', starBalance: 1 }),
  validateClientConfig: jest.fn()
}));
jest.mock('../../../common/utils/familyAudit', () => ({
  logFamilyOperation: jest.fn()
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
const { logFamilyOperation } = require('../../../common/utils/familyAudit');

const MEDIA_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const MEDIA_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const MEDIA_C = 'cccccccccccccccccccccccc';
const OPERATION_A = '11111111-1111-4111-8111-111111111111';
const OPERATION_B = '22222222-2222-4222-8222-222222222222';

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

const stableMediaError = () => Object.assign(
  new Error('Media reference rejected'),
  { status: 403, code: 'MEDIA_REFERENCE_REJECTED', details: [{ field: 'attachmentMediaIds' }] }
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

const stableTaskPayload = (child, overrides = {}) => ({
  childId: child._id.toString(),
  dimension: 'academic',
  subject: '数学',
  area: '分数计算',
  title: '媒体任务',
  taskType: 'practice',
  description: 'private route sentinel',
  dueDate: '2030-01-02',
  estimatedMinutes: 30,
  targetAmount: 20,
  unit: 'questions',
  priority: 'medium',
  ...overrides
});

const createStableTask = async (parent, child, overrides = {}) => GrowthTask.create({
  childId: child._id,
  familyId: child.familyId,
  createdByParentId: parent._id,
  dimension: 'academic',
  title: '已有任务',
  taskType: 'practice',
  dueDate: '2030-01-02',
  attachmentMediaIds: [],
  attachmentMediaBindings: [],
  mediaReferenceState: 'none',
  ...overrides
});

const createBoundTask = async (parent, child, ids = [MEDIA_A], overrides = {}) => GrowthTask.create({
  childId: child._id,
  familyId: child.familyId,
  createdByParentId: parent._id,
  dimension: 'academic',
  title: '已绑定任务',
  taskType: 'practice',
  dueDate: '2030-01-02',
  attachmentMediaIds: ids,
  attachmentMediaBindings: ids.map((mediaId, index) => ({
    mediaId,
    bindingOperationId: index === 0 ? OPERATION_A : OPERATION_B
  })),
  mediaReferenceState: 'bound',
  ...overrides
});

const hiddenResponseFields = [
  'attachments',
  'attachmentMediaBindings',
  'mediaBindingOperationId',
  'attachmentMediaPendingIds',
  'attachmentMediaPreviousBindings',
  'mediaBindingPhase',
  'mediaPendingTaskPatch',
  'mediaMutationKind',
  'mediaRemoteOutcomeUncertain'
];

describe('TC-T6-MEDIA-017K GrowthTask route lifecycle media recovery', () => {
  test('complete preserves stable attachment bindings while mutating task status', async () => {
    const { parent, child } = await createFamilyFixture('完成已绑定任务');
    const task = await createBoundTask(parent, child);
    const attachmentMediaService = {
      resume: jest.fn((taskId) => GrowthTask.findById(taskId).select('+attachmentMediaBindings'))
    };
    const endpoint = `/api/growth-tasks/${task._id}/complete`;

    const response = await request(routeApp(attachmentMediaService))
      .patch(endpoint)
      .set(userHeaders(child, 'PATCH', endpoint))
      .send({ actualMinutes: 12, difficulty: 'normal' });

    expect(response.status).toBe(200);
    expect(attachmentMediaService.resume).toHaveBeenCalledWith(task._id.toString());
    const stored = await GrowthTask.findById(task._id).select('+attachmentMediaBindings');
    expect(stored.status).toBe('completed');
    expect(stored.attachmentMediaIds.map(String)).toEqual([MEDIA_A]);
    expect(stored.attachmentMediaBindings.map(({ mediaId }) => String(mediaId))).toEqual([MEDIA_A]);
  });

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

describe('Task6 public GrowthTask attachment route contract', () => {
  beforeEach(() => {
    logFamilyOperation.mockClear();
  });

  test('TC-T6-MEDIA-017B creates a task with normalized attachment media through the route', async () => {
    const { parent, child, family } = await createFamilyFixture('路由创建');
    const attachmentMediaService = {
      create: jest.fn(async ({ taskInput, attachmentMediaIds }) => GrowthTask.create({
        ...taskInput,
        attachmentMediaIds,
        attachmentMediaBindings: attachmentMediaIds.map((mediaId) => ({ mediaId, bindingOperationId: OPERATION_A })),
        mediaReferenceState: 'bound'
      }))
    };

    const response = await request(routeApp(attachmentMediaService))
      .post('/api/growth-tasks')
      .set(userHeaders(parent, 'POST', '/api/growth-tasks'))
      .send(stableTaskPayload(child, { attachmentMediaIds: [MEDIA_A, MEDIA_B, MEDIA_A] }));

    expect(response.status).toBe(201);
    expect(attachmentMediaService.create).toHaveBeenCalledTimes(1);
    expect(attachmentMediaService.create).toHaveBeenCalledWith({
      taskInput: expect.objectContaining({
        childId: child._id.toString(),
        familyId: family._id,
        createdByParentId: parent._id.toString(),
        title: '媒体任务'
      }),
      attachmentMediaIds: [MEDIA_A, MEDIA_B]
    });
    expect(response.body.data.task.attachmentMediaIds).toEqual([MEDIA_A, MEDIA_B]);
    for (const field of hiddenResponseFields) {
      expect(response.body.data.task).not.toHaveProperty(field);
    }
  });

  test('TC-T6-MEDIA-017C rejects attachment writes before authorization and when media is disabled', async () => {
    const first = await createFamilyFixture('授权A');
    const second = await createFamilyFixture('授权B');
    const service = { create: jest.fn(), mutate: jest.fn() };

    const crossFamilyCreate = await request(routeApp(service))
      .post('/api/growth-tasks')
      .set(userHeaders(first.parent, 'POST', '/api/growth-tasks'))
      .send(stableTaskPayload(second.child, { attachmentMediaIds: [MEDIA_A] }));
    expect(crossFamilyCreate.status).toBe(403);
    expect(service.create).not.toHaveBeenCalled();

    const disabledMedia = await request(routeApp(null))
      .post('/api/growth-tasks')
      .set(userHeaders(first.parent, 'POST', '/api/growth-tasks'))
      .send(stableTaskPayload(first.child, { attachmentMediaIds: [MEDIA_A] }));
    expect(disabledMedia.status).toBe(400);
    expect(disabledMedia.body.error.code).toBe('MEDIA_NOT_ENABLED');

    const legacyAttachments = await request(routeApp(null))
      .post('/api/growth-tasks')
      .set(userHeaders(first.parent, 'POST', '/api/growth-tasks'))
      .send(stableTaskPayload(first.child, {
        attachments: [{ url: 'https://private.example/raw.jpg', name: 'raw' }]
      }));
    expect(legacyAttachments.status).toBe(400);
    expect(legacyAttachments.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('TC-T6-MEDIA-017D returns sanitized stable media rejection without leaking request values', async () => {
    const { parent, child } = await createFamilyFixture('稳定拒绝');
    const attachmentMediaService = { create: jest.fn().mockRejectedValue(stableMediaError()) };

    const response = await request(routeApp(attachmentMediaService))
      .post('/api/growth-tasks')
      .set(userHeaders(parent, 'POST', '/api/growth-tasks'))
      .send(stableTaskPayload(child, {
        title: 'raw private title sentinel',
        description: 'raw private description sentinel',
        attachmentMediaIds: [MEDIA_A]
      }));

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      code: 'MEDIA_REFERENCE_REJECTED',
      message: 'Media reference rejected',
      details: [{ field: 'attachmentMediaIds' }]
    });
    expect(logFamilyOperation).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      operation: 'task.attachments.create',
      result: 'rejected',
      familyId: child.familyId.toString(),
      childId: child._id.toString(),
      mediaIds: [MEDIA_A]
    }));
    expect(JSON.stringify(response.body)).not.toContain('raw private');
    expect(await GrowthTask.countDocuments({ title: 'raw private title sentinel' })).toBe(0);
  });

  test('TC-T6-MEDIA-017E returns pending envelope and lets detail resume a pending create', async () => {
    const { parent, child } = await createFamilyFixture('创建恢复');
    const pendingTask = await GrowthTask.create(taskInput(parent, child, { title: '待恢复创建' }));
    const attachmentMediaService = {
      create: jest.fn().mockRejectedValue(Object.assign(pendingMediaError(), {
        details: { resourceId: pendingTask._id.toString() }
      })),
      resume: jest.fn((taskId) => bindPendingTask(taskId))
    };

    const createResponse = await request(routeApp(attachmentMediaService))
      .post('/api/growth-tasks')
      .set(userHeaders(parent, 'POST', '/api/growth-tasks'))
      .send(stableTaskPayload(child, { attachmentMediaIds: [MEDIA_A] }));
    expect(createResponse.status).toBe(503);
    expect(createResponse.body.error).toMatchObject({
      code: 'MEDIA_REFERENCE_PENDING',
      details: { resourceId: pendingTask._id.toString() }
    });

    const endpoint = `/api/growth-tasks/${pendingTask._id}`;
    const detail = await request(routeApp(attachmentMediaService))
      .get(endpoint)
      .set(userHeaders(parent, 'GET', endpoint));
    expect(detail.status).toBe(200);
    expect(attachmentMediaService.resume).toHaveBeenCalledWith(pendingTask._id.toString());
    expect(detail.body.data.task.attachmentMediaIds).toEqual([MEDIA_A]);
    for (const field of hiddenResponseFields) {
      expect(detail.body.data.task).not.toHaveProperty(field);
    }
  });

  test('TC-T6-MEDIA-017G/017H patches remove and reorder attachment media through the route', async () => {
    const { parent, child } = await createFamilyFixture('路由修改');
    const task = await createBoundTask(parent, child, [MEDIA_A, MEDIA_B, MEDIA_C]);
    const attachmentMediaService = {
      mutate: jest.fn(async ({ task: loadedTask, taskPatch, attachmentMediaIds }) => {
        expect(String(loadedTask._id)).toBe(String(task._id));
        const patch = Object.fromEntries(taskPatch.map((entry) => [entry.path, entry.value]));
        return GrowthTask.findOneAndUpdate(
          { _id: task._id },
          {
            $set: {
              title: patch.title || task.title,
              attachmentMediaIds,
              attachmentMediaBindings: attachmentMediaIds.map((mediaId) => ({
                mediaId,
                bindingOperationId: OPERATION_A
              })),
              mediaReferenceState: attachmentMediaIds.length ? 'bound' : 'none'
            }
          },
          { new: true, runValidators: true }
        ).select('+attachmentMediaBindings');
      })
    };
    const endpoint = `/api/growth-tasks/${task._id}`;

    const reorder = await request(routeApp(attachmentMediaService))
      .patch(endpoint)
      .set(userHeaders(parent, 'PATCH', endpoint))
      .send({ title: '重排后', attachmentMediaIds: [MEDIA_C, MEDIA_A, MEDIA_C, MEDIA_B] });
    expect(reorder.status).toBe(200);
    expect(attachmentMediaService.mutate).toHaveBeenLastCalledWith({
      task: expect.objectContaining({ _id: task._id }),
      taskPatch: [{ path: 'title', value: '重排后' }],
      attachmentMediaIds: [MEDIA_C, MEDIA_A, MEDIA_B]
    });
    expect(reorder.body.data.task.attachmentMediaIds).toEqual([MEDIA_C, MEDIA_A, MEDIA_B]);
    expect(reorder.body.data.task.title).toBe('重排后');

    const remove = await request(routeApp(attachmentMediaService))
      .patch(endpoint)
      .set(userHeaders(parent, 'PATCH', endpoint))
      .send({ attachmentMediaIds: [] });
    expect(remove.status).toBe(200);
    expect(attachmentMediaService.mutate).toHaveBeenLastCalledWith({
      task: expect.objectContaining({ _id: task._id }),
      taskPatch: [],
      attachmentMediaIds: []
    });
    expect(remove.body.data.task.attachmentMediaIds).toEqual([]);
  });

  test('TC-T6-MEDIA-017I applies attachment and canonical task fields atomically', async () => {
    const { parent, child } = await createFamilyFixture('原子修改');
    const task = await createStableTask(parent, child);
    const attachmentMediaService = {
      mutate: jest.fn(async ({ taskPatch, attachmentMediaIds }) => GrowthTask.findOneAndUpdate(
        { _id: task._id },
        {
          $set: {
            title: taskPatch.find((entry) => entry.path === 'title').value,
            priority: taskPatch.find((entry) => entry.path === 'priority').value,
            attachmentMediaIds,
            attachmentMediaBindings: attachmentMediaIds.map((mediaId) => ({ mediaId, bindingOperationId: OPERATION_A })),
            mediaReferenceState: 'bound'
          }
        },
        { new: true, runValidators: true }
      ).select('+attachmentMediaBindings'))
    };
    const endpoint = `/api/growth-tasks/${task._id}`;

    const response = await request(routeApp(attachmentMediaService))
      .patch(endpoint)
      .set(userHeaders(parent, 'PATCH', endpoint))
      .send({ title: '原子标题', priority: 'high', attachmentMediaIds: [MEDIA_A] });

    expect(response.status).toBe(200);
    expect(response.body.data.task).toEqual(expect.objectContaining({
      title: '原子标题',
      priority: 'high',
      attachmentMediaIds: [MEDIA_A]
    }));
  });

  test('TC-T6-MEDIA-017J list does not resume media and detail resumes one pending task', async () => {
    const { parent, child } = await createFamilyFixture('读恢复');
    const task = await GrowthTask.create(taskInput(parent, child, { title: '读恢复任务' }));
    const attachmentMediaService = { resume: jest.fn((taskId) => bindPendingTask(taskId)) };

    const listEndpoint = `/api/growth-tasks?childId=${child._id}`;
    const list = await request(routeApp(attachmentMediaService))
      .get('/api/growth-tasks')
      .query({ childId: child._id.toString() })
      .set(userHeaders(parent, 'GET', listEndpoint));
    expect(list.status).toBe(200);
    expect(list.body.data.items[0].attachmentMediaIds).toEqual([]);
    expect(attachmentMediaService.resume).not.toHaveBeenCalled();

    const detailEndpoint = `/api/growth-tasks/${task._id}`;
    const detail = await request(routeApp(attachmentMediaService))
      .get(detailEndpoint)
      .set(userHeaders(parent, 'GET', detailEndpoint));
    expect(detail.status).toBe(200);
    expect(attachmentMediaService.resume).toHaveBeenCalledWith(task._id.toString());
    expect(detail.body.data.task.attachmentMediaIds).toEqual([MEDIA_A]);
    for (const field of hiddenResponseFields) {
      expect(detail.body.data.task).not.toHaveProperty(field);
    }
  });

  test('TC-T6-MEDIA-017M preserves non-media behavior and omits legacy attachments', async () => {
    const { parent, child } = await createFamilyFixture('兼容');
    const response = await request(routeApp(null))
      .post('/api/growth-tasks')
      .set(userHeaders(parent, 'POST', '/api/growth-tasks'))
      .send(stableTaskPayload(child));

    expect(response.status).toBe(201);
    expect(response.body.data.task.attachmentMediaIds).toEqual([]);
    expect(response.body.data.task).not.toHaveProperty('attachments');

    await GrowthTask.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(response.body.data.task.taskId) },
      { $set: { attachments: [{ url: 'https://private.example/legacy.jpg', name: 'legacy' }] } }
    );
    const task = await GrowthTask.findById(response.body.data.task.taskId);
    const endpoint = `/api/growth-tasks/${task._id}`;
    const detail = await request(routeApp(null))
      .get(endpoint)
      .set(userHeaders(parent, 'GET', endpoint));
    expect(detail.status).toBe(200);
    expect(detail.body.data.task).not.toHaveProperty('attachments');
    expect(JSON.stringify(detail.body)).not.toContain('legacy.jpg');
  });

  test('TC-T6-MEDIA-018C rejects legacy, unknown, nested, dotted, and internal media fields', async () => {
    const { parent, child } = await createFamilyFixture('严格契约');
    const createBadBodies = [
      { attachments: [{ url: 'https://private.example/raw.jpg' }] },
      { task: stableTaskPayload(child, { attachmentMediaIds: [MEDIA_A] }) },
      { 'attachmentMediaIds.0': MEDIA_A },
      { mediaBindingOperationId: OPERATION_A },
      { attachmentMediaIds: [{ mediaId: MEDIA_A }] },
      { attachmentMediaIds: null }
    ];
    for (const body of createBadBodies) {
      const response = await request(routeApp({ create: jest.fn() }))
        .post('/api/growth-tasks')
        .set(userHeaders(parent, 'POST', '/api/growth-tasks'))
        .send({ ...stableTaskPayload(child), ...body });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }

    const task = await createStableTask(parent, child);
    const patchBadBodies = [
      { attachments: [{ url: 'https://private.example/raw.jpg' }] },
      { growthTask: { title: 'nested' } },
      { 'attachmentMediaIds.0': MEDIA_A },
      { attachmentMediaPreviousBindings: [] },
      { attachmentMediaIds: 'not-array' }
    ];
    for (const body of patchBadBodies) {
      const endpoint = `/api/growth-tasks/${task._id}`;
      const response = await request(routeApp({ mutate: jest.fn() }))
        .patch(endpoint)
        .set(userHeaders(parent, 'PATCH', endpoint))
        .send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('TC-T6-MEDIA-018D redacts privacy-sensitive values from responses and audit logs', async () => {
    const { parent, child } = await createFamilyFixture('隐私');
    const attachmentMediaService = {
      create: jest.fn().mockRejectedValue(Object.assign(pendingMediaError(), {
        details: { resourceId: '6a3f11111111111111111111' },
        config: { headers: { authorization: 'Bearer raw-secret-token' } },
        operationId: OPERATION_A
      }))
    };

    const response = await request(routeApp(attachmentMediaService))
      .post('/api/growth-tasks')
      .set(userHeaders(parent, 'POST', '/api/growth-tasks'))
      .send(stableTaskPayload(child, {
        title: 'private title sentinel',
        description: 'https://private.example/raw-child-photo.jpg',
        attachmentMediaIds: [MEDIA_A]
      }));

    const serializedResponse = JSON.stringify(response.body);
    expect(response.status).toBe(503);
    expect(serializedResponse).toContain('MEDIA_REFERENCE_PENDING');
    expect(serializedResponse).not.toContain('private title sentinel');
    expect(serializedResponse).not.toContain('raw-child-photo');
    expect(serializedResponse).not.toContain('raw-secret-token');
    expect(serializedResponse).not.toContain(OPERATION_A);
    expect(logFamilyOperation).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      operation: 'task.attachments.create',
      result: 'pending',
      familyId: child.familyId.toString(),
      childId: child._id.toString(),
      taskId: '6a3f11111111111111111111',
      mediaIds: [MEDIA_A]
    }));
    for (const [, event] of logFamilyOperation.mock.calls) {
      expect(JSON.stringify(event)).not.toContain('private title sentinel');
      expect(JSON.stringify(event)).not.toContain('raw-child-photo');
      expect(JSON.stringify(event)).not.toContain('raw-secret-token');
      expect(JSON.stringify(event)).not.toContain(OPERATION_A);
    }
  });
});

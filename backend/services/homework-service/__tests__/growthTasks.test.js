process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-growth-task-tests';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/growth-task-test';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../../../common/models/User');
const Family = require('../../../common/models/Family');
const { createIdentityHeaders } = require('../../../common/middleware/gatewayIdentity');
const { addLocalDateDays, formatLocalDate, getWeekRange } = require('../../../common/utils/familyDate');

process.env.GATEWAY_IDENTITY_SECRET = 'test-gateway-identity-secret-32-bytes-long';

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

  const childSeed = unique('c');
  const child = await User.create({
    username: childSeed,
    password: 'child123',
    email: `${childSeed}@child.local`,
    name: `${label}孩子`,
    role: 'student',
    familyId: family._id,
    childProfile: {
      nickname: `${label}孩子`,
      grade: 3
    }
  });

  family.childIds.push(child._id);
  await family.save();
  parent.familyId = family._id;
  parent.children = [child._id];
  await parent.save();

  return { parent, family, child };
};

const currentLocalDate = () => formatLocalDate(new Date(), 'Asia/Shanghai');

const taskPayload = (child, overrides = {}) => ({
  childId: child._id.toString(),
  dimension: 'academic',
  subject: '数学',
  area: '分数计算',
  title: '完成分数计算练习',
  taskType: 'practice',
  description: '完成 20 道分数计算题',
  dueDate: addLocalDateDays(currentLocalDate(), 1),
  estimatedMinutes: 30,
  targetAmount: 20,
  unit: 'questions',
  priority: 'medium',
  ...overrides
});

const createTask = async (parent, child, overrides = {}) => {
  const response = await request(app)
    .post('/api/growth-tasks')
    .set(userHeaders(parent, 'POST', '/api/growth-tasks'))
    .send(taskPayload(child, overrides));

  expect(response.status).toBe(201);
  return response.body.data.task;
};

describe('growth task routes', () => {
  test.each([
    ['academic', { subject: '数学', area: '分数计算', title: '完成分数练习' }],
    ['physical', { area: '跳绳', title: '跳绳 500 个', taskType: 'exercise', targetAmount: 500, unit: 'count' }],
    ['artistic', { area: '钢琴', title: '钢琴练习', taskType: 'practice', estimatedMinutes: 30, unit: 'minutes' }],
    ['labor', { area: '家务', title: '整理房间', taskType: 'practice', targetAmount: 1, unit: 'task' }],
    ['moral', { area: '作息习惯', title: '按时睡觉', taskType: 'habit', targetAmount: 1, unit: 'check' }]
  ])('parent creates a %s growth task for own child', async (dimension, overrides) => {
    const { parent, family, child } = await createFamilyFixture(dimension);

    const response = await request(app)
      .post('/api/growth-tasks')
      .set(userHeaders(parent, 'POST', '/api/growth-tasks'))
      .send(taskPayload(child, { dimension, ...overrides }));

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.task).toEqual(expect.objectContaining({
      familyId: family._id.toString(),
      childId: child._id.toString(),
      dimension,
      title: overrides.title,
      status: 'pending'
    }));
  });

  test('parent cannot create a task for another family child', async () => {
    const familyA = await createFamilyFixture('A');
    const familyB = await createFamilyFixture('B');

    const response = await request(app)
      .post('/api/growth-tasks')
      .set(userHeaders(familyA.parent, 'POST', '/api/growth-tasks'))
      .send(taskPayload(familyB.child));

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  test('scope=today returns only tasks due today', async () => {
    const { parent, child } = await createFamilyFixture('今日');
    const today = currentLocalDate();
    await createTask(parent, child, {
      title: '今天任务',
      dueDate: today
    });
    await createTask(parent, child, {
      title: '明天任务',
      dueDate: addLocalDateDays(today, 1)
    });

    const response = await request(app)
      .get('/api/growth-tasks')
      .set(userHeaders(parent, 'GET', `/api/growth-tasks?childId=${child._id}&scope=today`))
      .query({ childId: child._id.toString(), scope: 'today' });

    expect(response.status).toBe(200);
    expect(response.body.data.items.map((task) => task.title)).toEqual(['今天任务']);
  });

  test('scope=week returns only tasks due in the current week', async () => {
    const { parent, child } = await createFamilyFixture('本周');
    const { start: weekStart } = getWeekRange(currentLocalDate());
    await createTask(parent, child, {
      title: '本周任务',
      dueDate: addLocalDateDays(weekStart, 2)
    });
    await createTask(parent, child, {
      title: '下周任务',
      dueDate: addLocalDateDays(weekStart, 7)
    });

    const response = await request(app)
      .get('/api/growth-tasks')
      .set(userHeaders(parent, 'GET', `/api/growth-tasks?childId=${child._id}&scope=week`))
      .query({ childId: child._id.toString(), scope: 'week' });

    expect(response.status).toBe(200);
    expect(response.body.data.items.map((task) => task.title)).toEqual(['本周任务']);
  });

  test('dimension=physical returns only physical tasks', async () => {
    const { parent, child } = await createFamilyFixture('筛选');
    await createTask(parent, child, {
      dimension: 'academic',
      title: '数学练习'
    });
    await createTask(parent, child, {
      dimension: 'physical',
      area: '跳绳',
      title: '跳绳训练',
      taskType: 'exercise',
      targetAmount: 500,
      unit: 'count'
    });

    const response = await request(app)
      .get('/api/growth-tasks')
      .set(userHeaders(parent, 'GET', `/api/growth-tasks?childId=${child._id}&dimension=physical`))
      .query({ childId: child._id.toString(), dimension: 'physical' });

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toEqual(expect.objectContaining({
      dimension: 'physical',
      title: '跳绳训练'
    }));
  });

  test('child marks own task completed with actual results', async () => {
    const { parent, child } = await createFamilyFixture('完成');
    const task = await createTask(parent, child, {
      dimension: 'physical',
      area: '跳绳',
      title: '跳绳 500 个',
      taskType: 'exercise',
      targetAmount: 500,
      unit: 'count'
    });

    const response = await request(app)
      .patch(`/api/growth-tasks/${task.taskId}/complete`)
      .set(userHeaders(child, 'PATCH', `/api/growth-tasks/${task.taskId}/complete`))
      .send({
        actualMinutes: 18,
        actualAmount: 520,
        difficulty: 'normal',
        needsHelp: false,
        childNote: '最后一组有点累'
      });

    expect(response.status).toBe(200);
    expect(response.body.data.task).toEqual(expect.objectContaining({
      status: 'completed',
      actualMinutes: 18,
      actualAmount: 520,
      difficulty: 'normal',
      needsHelp: false,
      childNote: '最后一组有点累'
    }));
    expect(response.body.data.task.completedAt).toEqual(expect.any(String));
  });

  test('parent confirms a completed task with feedback', async () => {
    const { parent, child } = await createFamilyFixture('确认');
    const task = await createTask(parent, child);

    await request(app)
      .patch(`/api/growth-tasks/${task.taskId}/complete`)
      .set(userHeaders(child, 'PATCH', `/api/growth-tasks/${task.taskId}/complete`))
      .send({ actualMinutes: 25, difficulty: 'normal' })
      .expect(200);

    const response = await request(app)
      .patch(`/api/growth-tasks/${task.taskId}/confirm`)
      .set(userHeaders(parent, 'PATCH', `/api/growth-tasks/${task.taskId}/confirm`))
      .send({ parentFeedback: '完成得很认真' });

    expect(response.status).toBe(200);
    expect(response.body.data.task).toEqual(expect.objectContaining({
      status: 'confirmed',
      parentConfirmed: true,
      parentFeedback: '完成得很认真'
    }));
    expect(response.body.data.task.confirmedAt).toEqual(expect.any(String));
  });

  test('child cannot confirm a task as parent', async () => {
    const { parent, child } = await createFamilyFixture('权限');
    const task = await createTask(parent, child);

    await request(app)
      .patch(`/api/growth-tasks/${task.taskId}/complete`)
      .set(userHeaders(child, 'PATCH', `/api/growth-tasks/${task.taskId}/complete`))
      .send({ actualMinutes: 20, difficulty: 'normal' })
      .expect(200);

    const response = await request(app)
      .patch(`/api/growth-tasks/${task.taskId}/confirm`)
      .set(userHeaders(child, 'PATCH', `/api/growth-tasks/${task.taskId}/confirm`))
      .send({ parentFeedback: '孩子不能确认' });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  test('stores dueDate as LocalDate and uses family timezone for today', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2030-01-01T16:30:00.000Z').getTime());
    try {
      const { parent, child } = await createFamilyFixture('时区');
      const todayTask = await createTask(parent, child, { title: '上海今天', dueDate: '2030-01-02' });
      await createTask(parent, child, { title: '上海昨天', dueDate: '2030-01-01' });
      expect(todayTask.dueDate).toBe('2030-01-02');

      const endpoint = `/api/growth-tasks?childId=${child._id}&scope=today`;
      const response = await request(app)
        .get('/api/growth-tasks')
        .set(userHeaders(parent, 'GET', endpoint))
        .query({ childId: child._id.toString(), scope: 'today' });

      expect(response.status).toBe(200);
      expect(response.body.data.items.map((task) => task.title)).toEqual(['上海今天']);
    } finally {
      nowSpy.mockRestore();
    }
  });

  test('rejects repeatRule on create and edit', async () => {
    const { parent, child } = await createFamilyFixture('重复');
    const createResponse = await request(app)
      .post('/api/growth-tasks')
      .set(userHeaders(parent, 'POST', '/api/growth-tasks'))
      .send(taskPayload(child, { repeatRule: 'daily' }));
    expect(createResponse.status).toBe(400);
    expect(createResponse.body.error.code).toBe('REPEAT_RULE_NOT_SUPPORTED');

    const task = await createTask(parent, child);
    const endpoint = `/api/growth-tasks/${task.taskId}`;
    const editResponse = await request(app)
      .patch(endpoint)
      .set(userHeaders(parent, 'PATCH', endpoint))
      .send({ repeatRule: 'weekly' });
    expect(editResponse.status).toBe(400);
    expect(editResponse.body.error.code).toBe('REPEAT_RULE_NOT_SUPPORTED');
  });

  test('validates status and paginates task lists', async () => {
    const { parent, child } = await createFamilyFixture('分页');
    await createTask(parent, child, { title: '任务一' });
    await createTask(parent, child, { title: '任务二' });

    const invalidEndpoint = `/api/growth-tasks?childId=${child._id}&status=unknown`;
    const invalid = await request(app)
      .get('/api/growth-tasks')
      .set(userHeaders(parent, 'GET', invalidEndpoint))
      .query({ childId: child._id.toString(), status: 'unknown' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const pageEndpoint = `/api/growth-tasks?childId=${child._id}&page=1&pageSize=1`;
    const page = await request(app)
      .get('/api/growth-tasks')
      .set(userHeaders(parent, 'GET', pageEndpoint))
      .query({ childId: child._id.toString(), page: 1, pageSize: 1 });
    expect(page.status).toBe(200);
    expect(page.body.data.items).toHaveLength(1);
    expect(page.body.data).toEqual(expect.objectContaining({ page: 1, pageSize: 1, total: 2 }));
  });

  test('denies another family across every task operation with stable errors', async () => {
    const familyA = await createFamilyFixture('越权A');
    const familyB = await createFamilyFixture('越权B');
    const task = await createTask(familyB.parent, familyB.child);
    const cases = [
      ['get', `/api/growth-tasks?childId=${familyB.child._id}`, `/api/growth-tasks?childId=${familyB.child._id}`, null],
      ['get', `/api/growth-tasks/${task.taskId}`, `/api/growth-tasks/${task.taskId}`, null],
      ['patch', `/api/growth-tasks/${task.taskId}`, `/api/growth-tasks/${task.taskId}`, { title: '越权修改' }],
      ['patch', `/api/growth-tasks/${task.taskId}/complete`, `/api/growth-tasks/${task.taskId}/complete`, { actualMinutes: 1 }],
      ['patch', `/api/growth-tasks/${task.taskId}/confirm`, `/api/growth-tasks/${task.taskId}/confirm`, {}],
      ['delete', `/api/growth-tasks/${task.taskId}`, `/api/growth-tasks/${task.taskId}`, null]
    ];

    for (const [method, signedUrl, requestUrl, body] of cases) {
      let operation = request(app)[method](requestUrl)
        .set(userHeaders(familyA.parent, method.toUpperCase(), signedUrl));
      if (body) operation = operation.send(body);
      const response = await operation;
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CHILD_ACCESS_DENIED');
    }
  });

  test('deletes pending tasks and archives completed tasks', async () => {
    const { parent, child } = await createFamilyFixture('归档');
    const pending = await createTask(parent, child, { title: '待删除' });
    const pendingEndpoint = `/api/growth-tasks/${pending.taskId}`;
    const deleted = await request(app)
      .delete(pendingEndpoint)
      .set(userHeaders(parent, 'DELETE', pendingEndpoint));
    expect(deleted.body.data.deleted).toBe(true);

    const completed = await createTask(parent, child, { title: '待归档' });
    const completeEndpoint = `/api/growth-tasks/${completed.taskId}/complete`;
    await request(app)
      .patch(completeEndpoint)
      .set(userHeaders(parent, 'PATCH', completeEndpoint))
      .send({ actualMinutes: 5 })
      .expect(200);
    const completedEndpoint = `/api/growth-tasks/${completed.taskId}`;
    const archived = await request(app)
      .delete(completedEndpoint)
      .set(userHeaders(parent, 'DELETE', completedEndpoint));
    expect(archived.body.data.task.status).toBe('archived');
  });
});

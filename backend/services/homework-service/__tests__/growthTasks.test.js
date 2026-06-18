process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-growth-task-tests';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/growth-task-test';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../../../common/models/User');
const Family = require('../../../common/models/Family');
const { createIdentityHeaders } = require('../../../common/middleware/gatewayIdentity');

process.env.GATEWAY_IDENTITY_SECRET = 'test-gateway-identity-secret-32-bytes-long';

const unique = (prefix) => `${prefix}${Math.random().toString(36).slice(2, 10)}`;

const userHeaders = (user, method, originalUrl) => createIdentityHeaders({
  method,
  originalUrl,
  user: {
    id: user._id.toString(),
    childId: user.role === 'student' ? user._id.toString() : undefined,
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

const startOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const addDays = (date, days) => {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
};

const startOfWeek = (date = new Date()) => {
  const value = startOfDay(date);
  const mondayOffset = value.getDay() === 0 ? -6 : 1 - value.getDay();
  return addDays(value, mondayOffset);
};

const taskPayload = (child, overrides = {}) => ({
  childId: child._id.toString(),
  dimension: 'academic',
  subject: '数学',
  area: '分数计算',
  title: '完成分数计算练习',
  taskType: 'practice',
  description: '完成 20 道分数计算题',
  dueDate: addDays(startOfDay(), 1).toISOString(),
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
    await createTask(parent, child, {
      title: '今天任务',
      dueDate: addDays(startOfDay(), 0).toISOString()
    });
    await createTask(parent, child, {
      title: '明天任务',
      dueDate: addDays(startOfDay(), 1).toISOString()
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
    const weekStart = startOfWeek();
    await createTask(parent, child, {
      title: '本周任务',
      dueDate: addDays(weekStart, 2).toISOString()
    });
    await createTask(parent, child, {
      title: '下周任务',
      dueDate: addDays(weekStart, 7).toISOString()
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
});

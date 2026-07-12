const { createTask11ApiClient } = require('./apiClient');
const { createFamilyRuntime } = require('./serviceRuntime');

const expectStatus = (response, status) => {
  if (response.status !== status) {
    throw new Error(`Expected HTTP ${status}, received ${response.status}: ${JSON.stringify(response.data)}`);
  }
  return response.data.data;
};

describe('Task 11 family growth demo flow', () => {
  let runtime;
  let api;

  beforeAll(async () => {
    runtime = await createFamilyRuntime();
    api = createTask11ApiClient({ baseURL: runtime.gatewayUrl });
  });

  afterAll(async () => {
    if (runtime) await runtime.stop();
  });

  test('creates a family, two children, five-dimension tasks, and completes as the child', async () => {
    const registration = expectStatus(await api.registerParent({
      username: 'task11_parent',
      name: 'Task 11 Parent',
      email: 'task11-parent@example.com',
      password: 'FamilyPass123',
      role: 'parent'
    }), 201);
    const parent = api.asParent(registration.token);

    const family = expectStatus(await parent.post('/api/families', {
      familyName: 'Task 11 Growth Family',
      timezone: 'Asia/Shanghai'
    }), 201).family;
    const childA = expectStatus(await parent.post('/api/children', {
      name: '小明', grade: 3, school: '向阳小学'
    }), 201).child;
    const childB = expectStatus(await parent.post('/api/children', {
      name: '小红', grade: 2
    }), 201).child;

    expectStatus(await parent.post(`/api/children/${childA.childId}/pin`, { pin: '2468' }), 200);
    expectStatus(await parent.post(`/api/children/${childB.childId}/pin`, { pin: '1357' }), 200);

    const definitions = [
      ['moral', '帮助同学', 'kindness'],
      ['academic', '完成数学练习', 'practice'],
      ['physical', '跳绳 500 个', 'exercise'],
      ['artistic', '练习钢琴', 'practice'],
      ['labor', '整理房间', 'chores']
    ];
    const tasks = [];
    for (const [dimension, title, taskType] of definitions) {
      const result = expectStatus(await parent.post('/api/growth-tasks', {
        childId: childA.childId,
        dimension,
        title,
        taskType,
        dueDate: '2026-07-12',
        estimatedMinutes: 20,
        ...(dimension === 'physical' ? { targetAmount: 500, unit: '个' } : {})
      }), 201);
      tasks.push(result.task);
    }

    expect(new Set(tasks.map((task) => task.dimension))).toEqual(
      new Set(['moral', 'academic', 'physical', 'artistic', 'labor'])
    );
    const childBTasks = expectStatus(await parent.get(`/api/growth-tasks?childId=${childB.childId}`), 200);
    expect(childBTasks.items).toEqual([]);

    const childLogin = expectStatus(await api.loginChild({
      familyId: family.familyId,
      childId: childA.childId,
      pin: '2468'
    }), 200);
    const child = api.asChild(childLogin.token);
    const physicalTask = tasks.find((task) => task.dimension === 'physical');
    const completion = expectStatus(await child.patch(
      `/api/growth-tasks/${physicalTask.taskId}/complete`,
      {
        actualMinutes: 18,
        actualAmount: 500,
        difficulty: 'normal',
        needsHelp: false,
        childNote: '我按计划完成了。',
        parentFeedback: '不能由孩子填写'
      }
    ), 200).task;

    expect(completion).toEqual(expect.objectContaining({
      status: 'completed',
      actualMinutes: 18,
      actualAmount: 500,
      childNote: '我按计划完成了。',
      parentFeedback: ''
    }));
    const siblingProfile = await child.get(`/api/children/${childB.childId}`);
    expect(siblingProfile.status).toBe(403);
    expect(JSON.stringify(siblingProfile.data)).not.toContain('小红');
  });
});

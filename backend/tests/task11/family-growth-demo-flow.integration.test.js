const axios = require('axios');
const sharp = require('sharp');
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

  test('completes the parent-child growth, evidence, report, and reward acceptance flow', async () => {
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

    const lateCompletedTask = expectStatus(await parent.post('/api/growth-tasks', {
      childId: childA.childId,
      dimension: 'academic',
      title: '截止后补录的历史任务',
      taskType: 'practice',
      dueDate: '2026-07-01',
      estimatedMinutes: 10
    }), 201).task;
    const lateCancelledTask = expectStatus(await parent.post('/api/growth-tasks', {
      childId: childA.childId,
      dimension: 'labor',
      title: '截止后取消的历史任务',
      taskType: 'chores',
      dueDate: '2026-07-02',
      estimatedMinutes: 10
    }), 201).task;
    const historicalReportPath = `/api/reports/weekly?childId=${childA.childId}&weekStart=2026-06-29`;
    const historicalReport = expectStatus(await parent.get(historicalReportPath), 200).report;
    expect(historicalReport).toEqual(expect.objectContaining({ frozen: true }));
    expect(historicalReport.statistics).toEqual(expect.objectContaining({
      plannedTaskCount: 0,
      completedTaskCount: 0
    }));
    expectStatus(await child.patch(`/api/growth-tasks/${lateCompletedTask.taskId}/complete`, {
      actualMinutes: 10,
      difficulty: 'normal',
      needsHelp: false
    }), 200);
    expectStatus(await parent.delete(`/api/growth-tasks/${lateCancelledTask.taskId}`), 200);
    const frozenReplay = expectStatus(await parent.get(historicalReportPath), 200).report;
    expect(frozenReplay.statistics).toEqual(historicalReport.statistics);

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

    const firstConfirmation = expectStatus(await parent.patch(
      `/api/growth-tasks/${physicalTask.taskId}/confirm`,
      { parentFeedback: '完成得很认真。' }
    ), 200);
    const replayedConfirmation = expectStatus(await parent.patch(
      `/api/growth-tasks/${physicalTask.taskId}/confirm`,
      { parentFeedback: '重复确认不应重复加星。' }
    ), 200);
    expect(firstConfirmation.task).toEqual(expect.objectContaining({
      status: 'confirmed',
      starAwardState: 'awarded'
    }));
    expect(replayedConfirmation.task).toEqual(expect.objectContaining({
      status: 'confirmed',
      starAwardState: 'awarded'
    }));

    const rewards = expectStatus(await parent.get(
      `/api/rewards?childId=${childA.childId}&ledgerPageSize=100&rewardPageSize=100`
    ), 200);
    const taskAwards = rewards.ledger.items.filter((entry) => (
      entry.sourceType === 'task_confirmation' && entry.sourceId === physicalTask.taskId
    ));
    expect(rewards.starBalance).toBe(1);
    expect(taskAwards).toHaveLength(1);
    expect(taskAwards[0]).toEqual(expect.objectContaining({ type: 'earn', amount: 1 }));

    const logDefinitions = [
      ['academic', '数学练习完成'],
      ['physical', '跳绳训练完成'],
      ['artistic', '钢琴练习完成'],
      ['labor', '房间整理完成']
    ];
    for (const [dimension, content] of logDefinitions) {
      expectStatus(await parent.post('/api/growth-logs', {
        childId: childA.childId,
        date: '2026-07-12',
        dimension,
        content,
        durationMinutes: 20,
        ...(dimension === 'academic' ? { subject: '数学' } : {})
      }), 201);
    }
    const childALogs = expectStatus(await parent.get(
      `/api/growth-logs?childId=${childA.childId}&pageSize=100`
    ), 200);
    const childBLogs = expectStatus(await parent.get(
      `/api/growth-logs?childId=${childB.childId}&pageSize=100`
    ), 200);
    expect(new Set(childALogs.items.map((log) => log.dimension))).toEqual(
      new Set(['academic', 'physical', 'artistic', 'labor'])
    );
    expect(childBLogs.items).toEqual([]);

    const mistake = expectStatus(await parent.post('/api/mistakes', {
      childId: childA.childId,
      subject: '数学',
      knowledgePointName: '两位数乘法',
      reason: 'calculation',
      correctAnswer: '84',
      parentNote: '复习进位步骤',
      reviewReminderDate: '2026-07-13'
    }), 201).mistake;
    expect(mistake).toEqual(expect.objectContaining({
      childId: childA.childId,
      dimension: 'academic',
      subject: '数学',
      mastered: false
    }));
    const childBMistakes = expectStatus(await parent.get(
      `/api/mistakes?childId=${childB.childId}&pageSize=100`
    ), 200);
    expect(childBMistakes.items).toEqual([]);

    const imageBytes = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 40, g: 120, b: 180 }
      }
    }).jpeg().toBuffer();
    const uploadForm = new FormData();
    uploadForm.append('file', new Blob([imageBytes], { type: 'image/jpeg' }), 'growth-evidence.jpg');
    uploadForm.append('purpose', 'task_attachment');
    uploadForm.append('childId', childA.childId);
    const media = expectStatus(await parent.post('/api/media', uploadForm), 201).media;

    const attachedTask = expectStatus(await parent.post('/api/growth-tasks', {
      childId: childA.childId,
      dimension: 'academic',
      title: '带成长证据的数学练习',
      taskType: 'practice',
      dueDate: '2026-07-12',
      attachmentMediaIds: [media.mediaId]
    }), 201).task;
    expect(attachedTask.attachmentMediaIds).toEqual([media.mediaId]);

    const access = expectStatus(await parent.get(`/api/media/${media.mediaId}/access`), 200).access;
    const mediaContent = await axios.get(`${runtime.gatewayUrl}${access.url}`, {
      responseType: 'arraybuffer'
    });
    expect(mediaContent.status).toBe(200);
    expect(mediaContent.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.from(mediaContent.data).length).toBeGreaterThan(0);

    const childBLogin = expectStatus(await api.loginChild({
      familyId: family.familyId,
      childId: childB.childId,
      pin: '1357'
    }), 200);
    const childBMediaAccess = await api.asChild(childBLogin.token)
      .get(`/api/media/${media.mediaId}/access`);
    expect(childBMediaAccess.status).toBe(403);

    const otherRegistration = expectStatus(await api.registerParent({
      username: 'task11_other_parent',
      name: 'Task 11 Other Parent',
      email: 'task11-other-parent@example.com',
      password: 'OtherFamilyPass123',
      role: 'parent'
    }), 201);
    const otherParent = api.asParent(otherRegistration.token);
    expectStatus(await otherParent.post('/api/families', {
      familyName: 'Task 11 Other Family',
      timezone: 'Asia/Shanghai'
    }), 201);
    const crossFamilyMediaAccess = await otherParent.get(`/api/media/${media.mediaId}/access`);
    expect(crossFamilyMediaAccess.status).toBe(403);

    const deletion = await parent.delete(`/api/media/${media.mediaId}`);
    expect(deletion.status).toBe(204);
    expect((await parent.get(`/api/media/${media.mediaId}/access`)).status).toBe(404);
    await expect(axios.get(`${runtime.gatewayUrl}${access.url}`)).rejects.toMatchObject({
      response: { status: 404 }
    });

    expectStatus(await parent.patch('/api/notifications/settings', {
      taskReminderEnabled: false,
      overdueReminderEnabled: false,
      mistakeReviewReminderEnabled: false,
      dimensionReminderEnabled: false,
      weeklyReportReminderEnabled: true,
      weeklyReportDay: 7,
      quietHours: { start: '21:00', end: '07:00' }
    }), 200);
    const reminderPath = `/api/notifications/family?childId=${childA.childId}&date=2026-07-12`;
    const firstReminders = expectStatus(await parent.get(reminderPath), 200);
    const replayedReminders = expectStatus(await parent.get(reminderPath), 200);
    const weeklyReminders = firstReminders.items.filter((item) => item.type === 'weekly_report');
    expect(weeklyReminders).toHaveLength(1);
    expect(replayedReminders.items.filter((item) => item.type === 'weekly_report'))
      .toEqual(weeklyReminders);
    expect(new Set(firstReminders.items.map((item) => item.reminderId)).size)
      .toBe(firstReminders.items.length);

    const reportPath = `/api/reports/weekly?childId=${childA.childId}&weekStart=2026-07-06`;
    const firstReport = expectStatus(await parent.get(reportPath), 200).report;
    const replayedReport = expectStatus(await parent.get(reportPath), 200).report;
    expect(firstReport.statistics).toEqual(expect.objectContaining({
      weekStart: '2026-07-06',
      weekEnd: '2026-07-12',
      recordDays: 1,
      totalDurationMinutes: 80,
      plannedTaskCount: 6,
      completedTaskCount: 1,
      mistakeCount: 1
    }));
    expect(replayedReport.statistics).toEqual(firstReport.statistics);
    const remindersAfterReport = expectStatus(await parent.get(reminderPath), 200);
    expect(remindersAfterReport.items.filter((item) => item.type === 'weekly_report')).toEqual([]);

    const reward = expectStatus(await parent.post('/api/rewards', {
      childId: childA.childId,
      title: '选择周末家庭活动',
      requiredStars: 1
    }), 201).reward;
    const idempotencyKey = 'task11-reward-0001';
    const redemption = expectStatus(await parent.patch(
      `/api/rewards/${reward.rewardId}/redeem`,
      {},
      { headers: { 'Idempotency-Key': idempotencyKey } }
    ), 200);
    const replayedRedemption = expectStatus(await parent.patch(
      `/api/rewards/${reward.rewardId}/redeem`,
      {},
      { headers: { 'Idempotency-Key': idempotencyKey } }
    ), 200);
    expect(replayedRedemption).toEqual(redemption);
    expect(redemption.starBalance).toBe(0);

    const unaffordableReward = expectStatus(await parent.post('/api/rewards', {
      childId: childA.childId,
      title: '额外奖励',
      requiredStars: 1
    }), 201).reward;
    const insufficient = await parent.patch(
      `/api/rewards/${unaffordableReward.rewardId}/redeem`,
      {},
      { headers: { 'Idempotency-Key': 'task11-reward-0002' } }
    );
    expect(insufficient.status).toBe(409);
    const finalRewards = expectStatus(await parent.get(
      `/api/rewards?childId=${childA.childId}&ledgerPageSize=100&rewardPageSize=100`
    ), 200);
    expect(finalRewards.starBalance).toBe(0);
    expect(finalRewards.ledger.items.filter((entry) => entry.type === 'spend')).toHaveLength(1);

    expectStatus(await parent.post(`/api/children/${childA.childId}/pin`, { pin: '8642' }), 200);
    const staleChildResponse = await child.get(`/api/children/${childA.childId}`);
    expect(staleChildResponse.status).toBe(401);
    expect(staleChildResponse.data.error.code).toBe('STALE_CHILD_TOKEN');
    const oldPinLogin = await api.loginChild({
      familyId: family.familyId,
      childId: childA.childId,
      pin: '2468'
    });
    expect(oldPinLogin.status).toBe(401);
    expect(oldPinLogin.data.error.code).toBe('INVALID_CHILD_CREDENTIALS');
    expectStatus(await api.loginChild({
      familyId: family.familyId,
      childId: childA.childId,
      pin: '8642'
    }), 200);
  });
});

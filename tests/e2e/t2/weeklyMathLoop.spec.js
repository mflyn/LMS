const { test, expect } = require('@playwright/test');
const { createT2WebRuntime } = require('./webRuntime');
const { openParentTasks } = require('./parentNavigation');
const { expectData } = require('../../../backend/tests/t2/syntheticSeed');
const { formatLocalDate } = require('../../../backend/common/utils/familyDate');
let runtime, fixture, parent;
test.beforeEach(async () => {
  runtime = await createT2WebRuntime(); fixture = runtime.fixture; parent = await runtime.login('parent');
  for (const name of ['child', 'sibling']) expectData(await parent.patch(`/api/children/${fixture.actors[name].childId}`, { grade: 1 }));
  const third = expectData(await parent.post('/api/children', { name: 'Synthetic grade four', grade: 4 }), 201).child;
  expectData(await parent.post(`/api/children/${third.childId}/pin`, { pin: '9753' }));
  fixture.actors.third = { userId: third.childId, childId: third.childId, familyId: fixture.familyId, pin: '9753' };
});
test.afterEach(async () => { await runtime?.stop(); });
async function login(page, name) {
  const actor = fixture.actors[name];
  await page.goto(runtime.webUrl + (actor.pin ? '/child/login' : '/login'));
  if (actor.pin) {
    await page.getByLabel('家庭 ID').fill(actor.familyId); await page.getByLabel('孩子 ID').fill(actor.childId);
    await page.getByLabel('PIN').fill(actor.pin); await page.getByRole('button', { name: '进入我的成长空间' }).click();
    await expect(page).toHaveURL(/\/child\/today$/);
  } else {
    await page.getByLabel('用户名').fill(actor.username); await page.getByLabel('密码', { exact: true }).fill(actor.password);
    await page.getByRole('button', { name: '登录', exact: true }).click(); await expect(page).toHaveURL(/\/app\/today$/);
  }
}
for (const name of ['child', 'sibling', 'third']) test(`${name}: complete real-page math learning and weekly reflection chain`, async ({ page, browser }, info) => {
  const childId = fixture.actors[name].childId, today = formatLocalDate(new Date(), 'Asia/Shanghai');
  const week = new Date(`${today}T00:00:00Z`);
  week.setUTCDate(week.getUTCDate() - (week.getUTCDay() + 6) % 7);
  const reportPath = `/api/reports/weekly?childId=${childId}&weekStart=${week.toISOString().slice(0, 10)}`;
  const baseline = expectData(await parent.get(reportPath)).report;
  const create = title => parent.post('/api/growth-tasks', { childId, title, dimension: 'academic', subject: '数学',
    taskType: 'practice', dueDate: today, checklistSnapshot: [{ itemId: 'read', label: '读清题目', required: true }] });
  const task = expectData(await create(`Synthetic ${name} mathematics`), 201).task;
  const second = expectData(await create(`Synthetic ${name} next practice`), 201).task;
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true });
  const child = await context.newPage(), errors = [];
  for (const target of [page, child]) {
    target.on('pageerror', error => errors.push(error.message));
    target.on('console', message => { if (['warning', 'error'].includes(message.type())) errors.push(message.type()); });
  }
  try {
    await login(child, name);
    const plan = child.getByRole('region', { name: '今日计划', exact: true });
    await plan.getByRole('button', { name: `加入今日计划 ${task.title}`, exact: true }).click();
    await plan.getByRole('button', { name: `加入今日计划 ${second.title}`, exact: true }).click();
    await plan.getByLabel(`${task.title} 估计分钟`).fill('15');
    await plan.getByRole('button', { name: `下移 ${task.title}`, exact: true }).click();
    await plan.getByRole('button', { name: '保存今日计划', exact: true }).click();
    await expect(plan.getByText('今日计划已保存。')).toBeVisible();
    const savedPlan = expectData(await parent.get(`/api/children/${childId}/daily-learning-plans/${today}`)).plan;
    expect(savedPlan.items.map(item => item.taskId)).toEqual([second.taskId, task.taskId]);
    expect(savedPlan.items[1].estimateRecordedBy).toEqual({ actorId: childId, role: 'student' });
    await plan.getByRole('link', { name: task.title, exact: true }).click();
    await child.getByRole('button', { name: '我需要帮助', exact: true }).click();
    await child.getByRole('button', { name: '发送求助', exact: true }).click();
    await expect(child.getByText('求助已发送。')).toBeVisible();
    await login(page, 'coparent');
    await page.getByLabel('当前孩子').selectOption(childId);
    await page.getByRole('link', { name: '待处理求助', exact: true }).click();
    await page.getByRole('button', { name: `求助 ${task.title}`, exact: true }).click();
    await page.getByLabel('给孩子的回应（可不填）').fill('Synthetic read carefully');
    await page.getByRole('button', { name: '标记已处理', exact: true }).click();
    await expect(page.getByText('Synthetic read carefully', { exact: true })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
    await child.getByRole('button', { name: '刷新详情', exact: true }).click();
    await expect(child.getByText('Synthetic read carefully', { exact: true })).toBeVisible();
    await child.getByRole('checkbox', { name: '读清题目（重点项）', exact: true }).check();
    await child.getByLabel('添加完成图片').setInputFiles({ name: fixture.image.name, mimeType: fixture.image.mimeType, buffer: fixture.image.bytes });
    await expect(child.getByText('已添加 1/10')).toBeVisible();
    await child.getByRole('button', { name: '提交完成情况', exact: true }).click();
    await expect(child.getByText('作品版本 1', { exact: true })).toBeVisible();
    await openParentTasks(page, runtime.webUrl);
    await page.getByRole('combobox', { name: '求助状态', exact: true }).selectOption('');
    await page.getByRole('button', { name: `查看 ${task.title}`, exact: true }).click();
    await page.getByRole('button', { name: '查看完成图片 1', exact: true }).click();
    const image = page.getByRole('img', { name: '完成图片 1', exact: true });
    await expect.poll(() => image.evaluate(node => node.naturalWidth)).toBeGreaterThan(0);
    await page.getByRole('textbox', { name: '家长反馈', exact: true }).fill('Synthetic seen-version feedback');
    await page.getByRole('button', { name: '确认并发放星星', exact: true }).click();
    await expect(page.getByText('星星已到账', { exact: true })).toBeVisible();
    await child.reload(); await expect(child.getByText('Synthetic seen-version feedback', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: '记录错题', exact: true }).click();
    const mistakeForm = page.getByRole('dialog', { name: '记录错题', exact: true });
    await mistakeForm.getByLabel('知识点', { exact: true }).fill(`Synthetic ${name} arithmetic`);
    await mistakeForm.getByLabel('提醒复习日期').fill(today);
    const savedMistake = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/mistakes');
    await mistakeForm.getByRole('button', { name: '保存错题', exact: true }).click();
    const mistake = (await (await savedMistake).json()).data.mistake;
    expect(mistake.sourceTaskId).toBe(task.taskId);
    await page.getByRole('button', { name: `复盘 Synthetic ${name} arithmetic`, exact: true }).click();
    await page.getByRole('button', { name: '创建订正任务', exact: true }).click();
    const taskForm = page.getByRole('dialog', { name: '新建任务', exact: true });
    await taskForm.getByLabel('任务标题').fill(`Synthetic ${name} correction`);
    await taskForm.getByLabel('截止日期', { exact: true }).fill(today);
    const savedCorrection = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/growth-tasks');
    await taskForm.getByRole('button', { name: '保存任务', exact: true }).click();
    const correction = (await (await savedCorrection).json()).data.task;
    expect(correction.sourceMistakeId).toBe(mistake.mistakeId);
    await child.goto(runtime.webUrl + `/child/tasks/${correction.taskId}`);
    await expect(child.getByRole('link', { name: /查看来源错题/ })).toBeVisible();
    await child.getByRole('button', { name: '提交完成情况', exact: true }).click();
    await expect(child.getByText('作品版本 1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '查看已保存任务', exact: true }).click();
    await page.getByRole('button', { name: '确认并发放星星', exact: true }).click();
    await expect(page.getByText('星星已到账', { exact: true })).toBeVisible();
    await page.getByRole('dialog', { name: '作品查看与审核', exact: true }).getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('navigation', { name: '家长导航', exact: true }).getByRole('link', { name: '提醒', exact: true }).click();
    await page.getByRole('link', { name: '复习此错题', exact: true }).click();
    const review = page.getByRole('dialog', { name: '错题复盘', exact: true });
    await review.getByRole('checkbox', { name: '已复习', exact: true }).check();
    await review.getByRole('button', { name: '保存复盘', exact: true }).click();
    await expect(page.getByText('复盘已保存。', { exact: true })).toBeVisible();
    await child.getByRole('link', { name: '今天', exact: true }).click();
    await child.getByRole('link', { name: '本周反思', exact: true }).click();
    await child.getByRole('button', { name: '新增反思' }).click();
    await child.getByLabel('记录内容', { exact: true }).fill(`Synthetic ${name} full loop reflection`);
    await child.getByLabel('我的反思', { exact: true }).fill('Synthetic ask, check and review');
    await child.getByRole('button', { name: '保存反思', exact: true }).click();
    await expect(child.getByText('反思已保存。', { exact: true })).toBeVisible();
    await page.getByRole('navigation', { name: '家长导航', exact: true }).getByRole('link', { name: '周报', exact: true }).click();
    await expect(page.getByText('Synthetic ask, check and review', { exact: true })).toBeVisible();
    const report = expectData(await parent.get(reportPath)).report;
    expect(report.statistics).toMatchObject({ recordDays: 1, totalDurationMinutes: 0, completedTaskCount: 2,
      plannedTaskCount: baseline.statistics.plannedTaskCount + 3, mistakeCount: 1 });
    const rate = Math.round(20000 / report.statistics.plannedTaskCount) / 100;
    expect(report.statistics.taskCompletionRate).toBe(rate);
    await expect(page.getByText(`${rate}%`, { exact: true })).toBeVisible();
    await expect(page.getByText(`2/${report.statistics.plannedTaskCount} 个任务`, { exact: false })).toBeVisible();
    await expect(page.getByText('记录天数', { exact: true }).locator('..').locator('strong')).toHaveText('1');
    await expect(page.getByText('新增错题', { exact: true }).locator('..').locator('strong')).toHaveText('1');
    await page.getByLabel('家长寄语').fill('Synthetic complete learning review');
    await page.getByRole('button', { name: '保存周报反馈', exact: true }).click();
    await expect(page.getByText('周报反馈已保存。', { exact: true })).toBeVisible();
    const snapshot = await runtime.inspect();
    expect(snapshot.database.Ledger.filter(row => [task.taskId, correction.taskId].includes(row.sourceId))).toHaveLength(2);
    expect(snapshot.database.Mistake.find(row => row._id === mistake.mistakeId)).toMatchObject({ reviewed: true, mastered: false });
    expect(snapshot.database.Task.find(row => row._id === task.taskId)).toMatchObject({ confirmedByParentId: fixture.actors.coparent.userId });
    for (const [label, target] of [['child', child], ['parent', page]]) {
      expect(await target.locator('html').evaluate(node => node.scrollWidth <= node.ownerDocument.defaultView.innerWidth)).toBe(true);
      await target.screenshot({ path: info.outputPath(`${name}-${label}-full-loop.png`), fullPage: true });
    }
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

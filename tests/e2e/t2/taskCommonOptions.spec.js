const { test, expect } = require('@playwright/test');
const { createT2WebRuntime } = require('./webRuntime');
const { openParentTasks } = require('./parentNavigation');
let runtime, prior;
test.beforeAll(async () => {
  prior = process.env.RECURRING_TASKS_ENABLED;
  runtime = await createT2WebRuntime({ beforeStart: async () => { process.env.RECURRING_TASKS_ENABLED = 'true'; } });
});
test.afterAll(async () => {
  try { await runtime?.stop(); }
  finally { if (prior === undefined) delete process.env.RECURRING_TASKS_ENABLED; else process.env.RECURRING_TASKS_ENABLED = prior; }
});
const login = async page => {
  await page.goto(runtime.webUrl + '/login');
  await page.getByLabel('用户名').fill(runtime.fixture.actors.parent.username);
  await page.getByLabel('密码', { exact: true }).fill(runtime.fixture.actors.parent.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/today$/);
  await page.getByLabel('当前孩子').selectOption(runtime.fixture.actors.child.childId);
  await openParentTasks(page, runtime.webUrl);
};
const custom = async (page, label, value) => {
  await page.getByLabel(label, { exact: true }).selectOption({ label: '其他（手工输入）' });
  await page.getByLabel('其他' + label, { exact: true }).fill(value);
};
const post = (page, path, method = 'POST') => page.waitForResponse(r => new URL(r.url()).pathname === path && r.request().method() === method);

test('formal task HTTP preserves custom values, hides subject without sending it, and remains usable at touch widths', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await login(page);
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.getByLabel('任务标题').fill('合成下拉任务');
  await page.getByLabel('截止日期').fill('2026-11-20');
  await custom(page, '任务类型', 'preset:0'); await custom(page, '具体项目', '社区观察');
  await page.getByLabel('任务类型', { exact: true }).focus(); await page.keyboard.press('Tab');
  await expect(page.getByLabel('其他任务类型')).toBeFocused();
  await custom(page, '学科', '');
  await page.getByLabel('成长维度').selectOption('physical');
  await expect(page.getByLabel('其他学科')).toHaveCount(0);
  for (const [width, height] of [[360, 800], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const label of ['任务类型', '具体项目', '其他任务类型', '其他具体项目']) {
      const box = await page.getByLabel(label, { exact: true }).boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThan(100);
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    await page.screenshot({ path: info.outputPath(`options-${width}.png`), fullPage: true });
  }
  const saved = post(page, '/api/growth-tasks'); await page.getByRole('button', { name: '保存任务' }).click();
  const response = await saved; expect(response.status()).toBe(201);
  expect(response.request().postDataJSON()).not.toHaveProperty('subject');
  const task = (await response.json()).data.task;
  expect(task).toMatchObject({ taskType: 'preset:0', area: '社区观察', dimension: 'physical' });
  await page.reload(); await page.getByRole('button', { name: '编辑 合成下拉任务', exact: true }).click();
  await expect(page.getByLabel('其他任务类型')).toHaveValue('preset:0');
  await expect(page.getByLabel('其他具体项目')).toHaveValue('社区观察');
  await page.getByLabel('成长维度').selectOption('academic'); await custom(page, '学科', 'Math');
  const updated = post(page, '/api/growth-tasks/' + task.taskId, 'PATCH');
  await page.getByRole('button', { name: '保存任务' }).click(); expect((await updated).status()).toBe(200);
  await page.reload(); await page.getByRole('button', { name: '编辑 合成下拉任务', exact: true }).click();
  await expect(page.getByLabel('其他学科')).toHaveValue('Math');
  expect(errors).toEqual([]);
});

test('formal recurring commit loss and relogin recover the original custom command without a second POST', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await login(page);
  await page.getByRole('link', { name: '重复计划', exact: true }).click();
  await page.getByRole('button', { name: '新建重复计划' }).click();
  await page.getByLabel('计划名称').fill('合成自定义重复计划');
  await page.getByLabel('重复方式').selectOption('daily');
  for (const [label, value] of [['任务类型', '亲子活动'], ['具体项目', 'custom'], ['学科', 'math']]) await custom(page, label, value);
  for (const [width, height] of [[360, 800], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const label of ['任务类型', '具体项目', '学科', '其他任务类型', '其他具体项目', '其他学科']) {
      const box = await page.getByLabel(label, { exact: true }).boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThan(100);
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    await page.screenshot({ path: info.outputPath(`recurring-options-${width}.png`), fullPage: true });
  }
  const writes = [];
  page.on('request', req => { if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/recurring-task-plans') writes.push(req.postDataJSON()); });
  runtime.dropNextResponse({ method: 'POST', path: '/api/recurring-task-plans' });
  await page.getByRole('button', { name: '保存计划' }).click();
  await expect(page.getByRole('button', { name: '核对原命令' })).toBeEnabled();
  expect(writes).toHaveLength(1); expect(writes[0].template).toMatchObject({ taskType: '亲子活动', area: 'custom', subject: 'math' });
  expect(writes[0].template).not.toHaveProperty('optionModes'); expect(writes[0].template).not.toHaveProperty('optionErrors');
  await page.getByRole('button', { name: /退出/ }).click(); await login(page);
  await page.getByRole('link', { name: '重复计划', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试原命令' })).toHaveCount(0);
  await page.getByRole('button', { name: '核对原命令' }).click();
  await expect(page.getByRole('heading', { name: '合成自定义重复计划' })).toBeVisible();
  expect(writes).toHaveLength(1);
  const client = await runtime.login('parent');
  const receipt = await client.get('/api/recurring-task-plan-commands/' + writes[0].operationId, { params: { childId: writes[0].childId } });
  expect(receipt.data.data).toMatchObject({ state: 'succeeded', identity: { operationId: writes[0].operationId } });
  const tasks = (await runtime.snapshot()).database.Task.filter(t => t.title === '合成自定义重复计划');
  expect(tasks).toHaveLength(1); expect(tasks[0]).toMatchObject({ taskType: '亲子活动', area: 'custom', subject: 'math' });
  await page.getByRole('button', { name: '修改计划' }).click();
  await expect(page.getByLabel('其他学科')).toHaveValue('math');
  await expect(page.getByLabel('其他任务类型')).toHaveValue('亲子活动');
  expect(errors).toEqual([]);
});

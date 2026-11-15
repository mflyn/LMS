const { test, expect } = require('@playwright/test');
const { createT2WebRuntime } = require('./webRuntime');
const { expectData } = require('../../../backend/tests/t2/syntheticSeed');
const { openParentTasks } = require('./parentNavigation');
const { withRecurringBarrier } = require('../../../backend/tests/t2/recurringBarrier');
let runtime, prior;
test.beforeEach(async () => {
  prior = process.env.RECURRING_TASKS_ENABLED;
  runtime = await createT2WebRuntime({ beforeStart: async () => { process.env.RECURRING_TASKS_ENABLED = 'true'; } });
});
test.afterEach(async () => {
  try { await runtime?.stop(); }
  finally { if (prior === undefined) delete process.env.RECURRING_TASKS_ENABLED; else process.env.RECURRING_TASKS_ENABLED = prior; }
});
const login = async (page, role = 'parent') => {
  const actor = runtime.fixture.actors[role];
  if (role === 'child') {
    await page.goto(runtime.webUrl + '/child/login');
    await page.getByRole('button', { name: '手工填写标识', exact: true }).click();
    await page.getByLabel('家庭 ID').fill(actor.familyId); await page.getByLabel('孩子 ID').fill(actor.childId);
    await page.getByLabel('PIN').fill(actor.pin);
    await page.getByRole('button', { name: '进入我的成长空间' }).click();
    await expect(page).toHaveURL(/\/child\/today$/); return;
  }
  await page.goto(runtime.webUrl + '/login'); await page.getByLabel('用户名').fill(actor.username);
  await page.getByLabel('密码', { exact: true }).fill(actor.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/today$/);
  await page.getByLabel('当前孩子').selectOption(runtime.fixture.actors.child.childId);
  await page.goto(runtime.webUrl + '/app/recurring-plans');
};
const create = async page => {
  await page.getByRole('button', { name: '新建重复计划' }).click();
  await page.getByLabel('计划名称').fill('Synthetic recurring browser');
  await page.getByLabel('重复方式').selectOption('daily');
  await page.getByRole('button', { name: '保存计划' }).click();
};
const markers = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('family-growth.recurring-marker.v1:')));
const imageVisible = async page => {
  await page.getByRole('button', { name: '查看完成图片 1', exact: true }).click();
  const image = page.getByRole('img', { name: '完成图片 1', exact: true });
  await expect(image).toBeVisible(); await expect.poll(() => image.evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
};

for (const action of ['patch', 'stop']) test(`${action} committed response lost: relogin resolves original UUID with GET only`, async ({ page }) => {
  await login(page); await create(page); await expect.poll(() => markers(page)).toHaveLength(0);
  await expect(page.getByRole('heading', { name: 'Synthetic recurring browser', exact: true })).toBeVisible();
  const client = await runtime.login('parent'), childId = runtime.fixture.actors.child.childId;
  const plan = expectData(await client.get('/api/recurring-task-plans', { params: { childId } })).items[0];
  const originalTasks = (await runtime.snapshot()).database.Task;
  const path = `/api/recurring-task-plans/${plan.id}${action === 'stop' ? '/stop' : ''}`;
  const method = action === 'stop' ? 'POST' : 'PATCH', writes = [];
  page.on('request', req => { if (req.method() === method && new URL(req.url()).pathname === path) writes.push(req.postDataJSON()); });
  runtime.dropNextResponse({ method, path });
  await page.getByRole('button', { name: action === 'patch' ? '修改计划' : '停止计划' }).click();
  if (action === 'patch') { await page.getByLabel('计划名称').fill('Synthetic tomorrow rule'); await page.getByRole('button', { name: '保存计划' }).click(); }
  else {
    await page.getByRole('button', { name: '确认停止' }).click();
    await expect(page.getByRole('button', { name: '确认停止' })).toBeEnabled();
    await page.getByRole('button', { name: '返回', exact: true }).click();
  }
  await expect(page.getByRole('button', { name: '核对原命令' })).toBeEnabled();
  const keys = await markers(page); expect(keys).toHaveLength(1); expect(writes).toHaveLength(1);
  await page.getByRole('button', { name: /退出/ }).click(); await login(page);
  expect(await markers(page)).toEqual(keys);
  await expect(page.getByRole('button', { name: '重试原命令' })).toHaveCount(0);
  await page.getByRole('button', { name: '核对原命令' }).click();
  await expect.poll(() => markers(page)).toHaveLength(0);
  const current = expectData(await client.get('/api/recurring-task-plans/' + plan.id));
  expect(current.version).toBe(2);
  if (action === 'stop') expect(current.status).toBe('stopped');
  else expect(current.pendingRevision.template.title).toBe('Synthetic tomorrow rule');
  const receipt = expectData(await client.get('/api/recurring-task-plan-commands/' + writes[0].operationId, { params: { childId } }));
  expect(receipt).toMatchObject({ state: 'succeeded', identity: { action, operationId: writes[0].operationId, actorId: runtime.fixture.actors.parent.userId } });
  expect(receipt.command).toEqual(writes[0]); expect(writes).toHaveLength(1);
  expect((await runtime.snapshot()).database.Task).toEqual(originalTasks);
  expect((await runtime.snapshot()).database.Ledger).toEqual([]);
  expect(runtime.droppedResponses).toEqual([expect.objectContaining({ method, path, status: 200 })]);
});

test('abort response loss retains original marker across relogin; confirmed tombstone rejects a late original POST', async ({ page }) => {
  await login(page); let original;
  const handler = route => {
    if (route.request().method() !== 'POST') return route.continue();
    original = route.request().postDataJSON(); return route.abort('failed');
  };
  await page.route('**/api/recurring-task-plans', handler);
  try { await create(page); await expect(page.getByRole('button', { name: '核对原命令' })).toBeEnabled(); }
  finally { await page.unroute('**/api/recurring-task-plans', handler); }
  const keys = await markers(page); expect(keys).toHaveLength(1);
  const path = `/api/recurring-task-plan-commands/${original.operationId}/abort`, aborts = [];
  page.on('request', req => { if (new URL(req.url()).pathname === path) aborts.push(req.postDataJSON()); });
  runtime.dropNextResponse({ method: 'POST', path });
  await page.getByRole('button', { name: '终止未确定命令' }).click();
  await page.getByRole('button', { name: '确认终止' }).click();
  await expect(page.getByRole('button', { name: '确认终止' })).toBeEnabled();
  expect(await markers(page)).toEqual(keys); expect(aborts).toHaveLength(1);
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('button', { name: /退出/ }).click(); await login(page);
  await page.getByRole('button', { name: '核对原命令' }).click();
  await expect.poll(() => markers(page)).toHaveLength(0); expect(aborts).toHaveLength(1);
  const client = await runtime.login('parent');
  const receipt = expectData(await client.get('/api/recurring-task-plan-commands/' + original.operationId, { params: { childId: original.childId } }));
  expect(receipt.state).toBe('aborted'); const before = await runtime.snapshot();
  expect((await client.post('/api/recurring-task-plans', original)).status).toBe(409);
  expect(await runtime.snapshot()).toEqual(before);
  expect(before.database.Task.filter(row => row.title === original.template.title)).toEqual([]);
  expect(runtime.droppedResponses).toEqual([expect.objectContaining({ path, status: 200 })]);
});

test('transaction is still in flight during logout: not_found cannot unlock, late commit is recovered without a second POST', async ({ page }) => {
  const Command = require('../../../backend/services/homework-service/models/RecurringTaskPlanCommand');
  const server = runtime.servers.find(row => row.name === 'homework-service').server;
  const app = server.listeners('request').find(listener => listener.locals?.recurringTasks);
  expect(app).toBeTruthy();
  await withRecurringBarrier({ service: app.locals.recurringTasks.service, Command }, async state => {
    await login(page); const writes = [];
    page.on('request', req => { if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/recurring-task-plans') writes.push(req.postDataJSON()); });
    runtime.dropNextResponse({ method: 'POST', path: '/api/recurring-task-plans' });
    await create(page); await expect.poll(() => state.entered).toBe(true);
    const keys = await markers(page); expect(keys).toHaveLength(1);
    await page.getByRole('button', { name: /退出/ }).click(); await login(page);
    await page.getByRole('button', { name: '核对原命令' }).click();
    await expect(page.getByText('暂未查到终态，原命令仍受保护。')).toBeVisible();
    await expect(page.getByRole('button', { name: '新建重复计划' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '重试原命令' })).toHaveCount(0);
    expect(await markers(page)).toEqual(keys); expect(writes).toHaveLength(1);
    state.release();
    const client = await runtime.login('parent');
    await expect.poll(async () => expectData(await client.get('/api/recurring-task-plan-commands/' + state.commandId,
      { params: { childId: runtime.fixture.actors.child.childId } })).state).toBe('succeeded');
    // The old document is gone: this proves persisted recovery after a late commit and lost response.
    expect(await markers(page)).toEqual(keys);
    await page.getByRole('button', { name: '核对原命令' }).click(); await expect.poll(() => markers(page)).toHaveLength(0);
    expect(writes).toHaveLength(1); expect(writes[0].operationId).toBe(state.commandId);
    expect((await runtime.snapshot()).database.Task.filter(row => row.title === writes[0].template.title)).toHaveLength(1);
    expect((await runtime.snapshot()).database.Ledger).toEqual([]);
    await expect.poll(() => runtime.droppedResponses).toEqual([
      expect.objectContaining({ service: 'api-gateway', path: '/api/recurring-task-plans', status: 201 })
    ]);
    await page.reload(); await expect(page.getByRole('heading', { name: 'Synthetic recurring browser', exact: true })).toBeVisible();
  });
});

test('recurring work real pages: child uploads, coparent views and confirms, child reloads readonly picture and feedback', async ({ page, browser }, info) => {
  await login(page); await create(page); await expect.poll(() => markers(page)).toHaveLength(0);
  await expect(page.getByRole('heading', { name: 'Synthetic recurring browser', exact: true })).toBeVisible();
  const task = (await runtime.snapshot()).database.Task.find(row => row.title === 'Synthetic recurring browser');
  expect(task.recurringPlanId).toBeTruthy();
  const context = await browser.newContext();
  try {
    const kid = await context.newPage(); await login(kid, 'child');
    await kid.getByRole('region', { name: '今天的任务', exact: true }).getByRole('link', { name: /Synthetic recurring browser/ }).click();
    await kid.getByLabel('添加完成图片').setInputFiles({ name: runtime.fixture.image.name,
      mimeType: runtime.fixture.image.mimeType, buffer: runtime.fixture.image.bytes });
    await expect(kid.getByText('已添加 1/10')).toBeVisible();
    await kid.getByLabel('我的一句话').fill('Synthetic recurring reflection');
    await kid.getByRole('button', { name: '提交完成情况' }).click();
    await expect(kid.getByText('作品版本 1')).toBeVisible(); await kid.reload(); await imageVisible(kid);
    await page.getByRole('button', { name: /退出/ }).click(); await login(page, 'coparent');
    await openParentTasks(page, runtime.webUrl);
    await page.getByRole('button', { name: '查看 Synthetic recurring browser', exact: true }).click(); await imageVisible(page);
    await page.getByRole('textbox', { name: '家长反馈' }).fill('Synthetic recurring feedback');
    await page.getByRole('button', { name: '确认并发放星星' }).click(); await expect(page.getByText('星星已到账')).toBeVisible();
    await kid.reload(); await imageVisible(kid);
    await expect(kid.getByText('Synthetic recurring feedback')).toBeVisible();
    await expect(kid.getByRole('button', { name: '修改本次完成' })).toHaveCount(0);
    const stable = await runtime.snapshot();
    expect(stable.database.Task.find(row => row._id === task._id)).toMatchObject({ status: 'confirmed',
      completionVersion: 1, confirmedByParentId: runtime.fixture.actors.coparent.userId });
    expect(stable.database.Ledger.filter(row => row.sourceId === task._id)).toHaveLength(1);
    await kid.setViewportSize({ width: 768, height: 1024 });
    await kid.screenshot({ path: info.outputPath('recurring-child-readback.png'), fullPage: true });
    expect(await kid.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});

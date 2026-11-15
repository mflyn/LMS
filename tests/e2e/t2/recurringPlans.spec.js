const { test, expect } = require('@playwright/test');
const { createT2WebRuntime } = require('./webRuntime');
let runtime, prior;
test.beforeAll(async () => {
  prior = process.env.RECURRING_TASKS_ENABLED;
  runtime = await createT2WebRuntime({ beforeStart: async () => { process.env.RECURRING_TASKS_ENABLED = 'true'; } });
});
test.afterAll(async () => {
  try { await runtime?.stop(); }
  finally { if (prior === undefined) delete process.env.RECURRING_TASKS_ENABLED; else process.env.RECURRING_TASKS_ENABLED = prior; }
});
const login = async (page, recovering = false) => {
  await page.goto(runtime.webUrl + '/login');
  await page.getByLabel('用户名').fill(runtime.fixture.actors.parent.username);
  await page.getByLabel('密码', { exact: true }).fill(runtime.fixture.actors.parent.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/today$/);
  await page.getByLabel('当前孩子').selectOption(runtime.fixture.actors.child.childId);
  await page.goto(runtime.webUrl + '/app/tasks');
  await page.getByRole('link', { name: '重复计划', exact: true }).click();
  if (recovering) await expect(page.getByRole('button', { name: '新建重复计划' })).toBeDisabled();
  else await expect(page.getByRole('button', { name: '新建重复计划' })).toBeEnabled();
};
const create = async (page, title) => {
  await page.getByRole('button', { name: '新建重复计划' }).click();
  await page.getByLabel('计划名称', { exact: true }).fill(title);
  await page.getByLabel('重复方式').selectOption('daily');
  await page.getByRole('button', { name: '保存计划' }).click();
};
const markers = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('family-growth.recurring-marker.v1:')));

test('formal HTTP: create, refresh, edit tomorrow and stop retain the one daily task', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await login(page); await create(page, '合成每日跳绳');
  await expect(page.getByRole('heading', { name: '合成每日跳绳' })).toBeVisible();
  await expect.poll(() => markers(page)).toHaveLength(0);
  await page.reload(); await expect(page.getByRole('heading', { name: '合成每日跳绳' })).toBeVisible();
  const client = await runtime.login('parent'), childId = runtime.fixture.actors.child.childId;
  let response = await client.get('/api/recurring-task-plans', { params: { childId } });
  expect(response.status).toBe(200); const plan = response.data.data.items.find(p => p.currentRevision.template.title === '合成每日跳绳');
  expect(plan.version).toBe(1);
  const tasks = (await runtime.snapshot()).database.Task.filter(t => String(t.recurringPlanId) === plan.id);
  expect(tasks).toHaveLength(1);
  await page.getByRole('button', { name: '修改计划' }).click();
  await page.getByLabel('计划名称').fill('合成明日起跳绳');
  await page.getByRole('button', { name: '保存计划' }).click();
  await expect(page.getByText(/新规则于 .*合成明日起跳绳/)).toBeVisible();
  await page.getByRole('button', { name: '停止计划' }).click();
  await page.getByRole('button', { name: '确认停止' }).click();
  await expect(page.getByRole('button', { name: '修改计划' })).toBeDisabled();
  await expect.poll(() => markers(page)).toHaveLength(0);
  response = await client.get('/api/recurring-task-plans/' + plan.id);
  expect(response.data.data).toMatchObject({ status: 'stopped', version: 3 });
  expect((await runtime.snapshot()).database.Task.filter(t => String(t.recurringPlanId) === plan.id)).toEqual(tasks);
  for (const [width, height] of [[1280, 900], [768, 1024], [360, 800]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const box = await page.getByRole('button', { name: '新建重复计划' }).boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: info.outputPath(`recurring-${width}.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('formal commit then lost response: logout/relogin discovers original UUID and only GET recovers it', async ({ page }) => {
  await login(page); const writes = [];
  page.on('request', req => { if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/recurring-task-plans') writes.push(req.postDataJSON()); });
  runtime.dropNextResponse({ method: 'POST', path: '/api/recurring-task-plans' });
  await create(page, '合成丢响应计划');
  await expect(page.getByText('有一项计划操作待核对')).toBeVisible();
  await expect(page.getByRole('button', { name: '核对原命令' })).toBeEnabled();
  expect(writes).toHaveLength(1); const keys = await markers(page); expect(keys).toHaveLength(1);
  await page.getByRole('button', { name: /退出/ }).click();
  await login(page, true);
  await expect(page.getByText('有一项计划操作待核对')).toBeVisible();
  await expect(page.getByRole('button', { name: '重试原命令' })).toHaveCount(0);
  expect(await markers(page)).toEqual(keys);
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.includes('recurring-body')))).toEqual([]);
  await page.getByRole('button', { name: '核对原命令' }).click();
  await expect(page.getByText('有一项计划操作待核对')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '合成丢响应计划' })).toBeVisible();
  expect(writes).toHaveLength(1);
  const client = await runtime.login('parent');
  const receipt = await client.get('/api/recurring-task-plan-commands/' + writes[0].operationId, { params: { childId: runtime.fixture.actors.child.childId } });
  expect(receipt.data.data).toMatchObject({ state: 'succeeded', identity: { operationId: writes[0].operationId } });
  const snapshot = await runtime.snapshot();
  expect(snapshot.database.Task.filter(t => t.title === '合成丢响应计划')).toHaveLength(1);
  expect(snapshot.database.Ledger).toHaveLength(0);
  expect(runtime.droppedResponses.filter(r => r.path === '/api/recurring-task-plans')).toHaveLength(1);
});

test('request never arrives: relogin keeps not_found locked, explicit real abort prevents a late original POST', async ({ page }) => {
  await login(page); let original;
  await page.route('**/api/recurring-task-plans', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    original = route.request().postDataJSON(); return route.abort('failed');
  });
  await create(page, '合成未到达计划');
  await expect(page.getByRole('button', { name: '核对原命令' })).toBeEnabled();
  expect(original.operationId).toBeTruthy();
  await page.unroute('**/api/recurring-task-plans');
  await page.getByRole('button', { name: /退出/ }).click(); await login(page, true);
  await page.getByRole('button', { name: '核对原命令' }).click();
  await expect(page.getByText('暂未查到终态，原命令仍受保护。')).toBeVisible();
  await expect(page.getByRole('button', { name: '新建重复计划' })).toBeDisabled();
  await page.getByRole('button', { name: '终止未确定命令' }).click();
  await page.getByRole('button', { name: '确认终止' }).click();
  await expect.poll(() => markers(page)).toHaveLength(0);
  await expect(page.getByRole('button', { name: '新建重复计划' })).toBeEnabled();
  const client = await runtime.login('parent');
  const terminal = await client.get('/api/recurring-task-plan-commands/' + original.operationId, { params: { childId: original.childId } });
  expect(terminal.data.data.state).toBe('aborted');
  const late = await client.post('/api/recurring-task-plans', original);
  expect(late.status).toBe(409);
  expect((await runtime.snapshot()).database.Task.filter(t => t.title === original.template.title)).toEqual([]);
});

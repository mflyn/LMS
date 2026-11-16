const { test, expect } = require('@playwright/test');
const { createT2WebRuntime } = require('./webRuntime');
let runtime, environment, prior;
test.beforeAll(async () => {
  prior = process.env.RECURRING_TASKS_ENABLED;
  let homework, original;
  try {
    runtime = await createT2WebRuntime({ beforeStart: async () => {
      process.env.RECURRING_TASKS_ENABLED = 'true';
      homework = require('../../../backend/services/homework-service/server');
      original = homework.startServer;
      // Capture only the synthetic runtime's configuration; all production handlers stay real.
      homework.startServer = options => { environment = options.env; return original(options); };
    } });
  } finally { if (original) homework.startServer = original; }
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
  const navigation = page.getByRole('navigation', { name: '家长导航' });
  if (!(await navigation.isVisible())) await page.getByRole('button', { name: '打开导航' }).click();
  await navigation.getByRole('link', { name: '任务', exact: true }).click();
  await page.getByRole('link', { name: '重复计划', exact: true }).click();
};
const markers = page => page.evaluate(() => Object.fromEntries(Object.entries(localStorage)
  .filter(([key]) => key.startsWith('family-growth.recurring-marker.v1:'))));
const watch = page => {
  const failures = [], consoleMessages = [], posts = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', entry => { if (['warning', 'error'].includes(entry.type())) consoleMessages.push({ type: entry.type(), text: entry.text(), url: entry.location().url }); });
  page.on('request', req => { if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/recurring-task-plans') posts.push(req.postDataJSON()); });
  return { failures, consoleMessages, posts };
};

test('disabled real service: create remains blocked and the reason is visible after reload at narrow and tablet sizes', async ({ page }, info) => {
  environment.RECURRING_TASKS_ENABLED = 'false'; const observed = watch(page);
  await login(page);
  for (const [width, height] of [[360, 800], [768, 1024]]) {
    await page.setViewportSize({ width, height }); await page.reload();
    await expect(page.getByRole('alert')).toContainText('暂未启用');
    await expect(page.getByRole('alert')).toBeInViewport();
    await expect(page.getByRole('button', { name: '新建重复计划' })).toBeDisabled();
    expect(await markers(page)).toEqual({});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`disabled-${width}.png`), fullPage: true });
  }
  expect(observed.posts).toEqual([]); expect(observed.failures).toEqual([]); expect(observed.consoleMessages).toEqual([]);
});

test('real 503 after opening: focused feedback, relogin/not_found lock, verified abort and late original rejection', async ({ page }, info) => {
  environment.RECURRING_TASKS_ENABLED = 'true'; const observed = watch(page);
  await page.setViewportSize({ width: 768, height: 1024 }); await login(page);
  await page.getByRole('button', { name: '新建重复计划' }).click();
  await page.getByLabel('计划名称', { exact: true }).fill('合成关闭时序计划');
  environment.RECURRING_TASKS_ENABLED = 'false';
  const rejected = page.waitForResponse(res => res.request().method() === 'POST'
    && new URL(res.url()).pathname === '/api/recurring-task-plans');
  await page.getByRole('button', { name: '保存计划' }).click();
  const response = await rejected;
  expect(response.status()).toBe(503); expect((await response.json()).error.code).toBe('RECURRING_TASKS_DISABLED');
  await expect(page.getByRole('alert')).toBeFocused(); await expect(page.getByRole('alert')).toBeInViewport();
  await expect(page.getByRole('alert')).toContainText('暂未启用');
  await expect(page.getByRole('button', { name: '重试原命令' })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('disabled-pending-768.png'), fullPage: true });
  const saved = await markers(page); expect(Object.keys(saved)).toHaveLength(1); expect(observed.posts).toHaveLength(1);
  await page.reload(); await expect(page.getByText(/为避免重复创建/)).toBeVisible();
  expect(await markers(page)).toEqual(saved);
  await page.getByRole('button', { name: /退出/ }).click(); await login(page);
  await expect(page.getByRole('alert')).toContainText('暂未启用');
  expect(await markers(page)).toEqual(saved);
  await expect(page.getByRole('button', { name: '重试原命令' })).toHaveCount(0);
  await page.getByRole('button', { name: '核对原命令' }).click();
  await expect(page.getByText('暂未查到终态，原命令仍受保护。')).toBeVisible();
  expect(await markers(page)).toEqual(saved);
  const before = await runtime.snapshot();
  await page.getByRole('button', { name: '终止未确定命令' }).click();
  await page.getByRole('button', { name: '确认终止' }).click();
  await expect.poll(() => markers(page)).toEqual({});
  await expect(page.getByRole('button', { name: '新建重复计划' })).toBeDisabled();
  environment.RECURRING_TASKS_ENABLED = 'true';
  const client = await runtime.login('parent');
  const late = await client.post('/api/recurring-task-plans', observed.posts[0]);
  expect(late.status).toBe(409); expect(late.data.error.code).toBe('RECURRING_PLAN_COMMAND_ABORTED');
  const after = await runtime.snapshot();
  expect(after.database.Task).toEqual(before.database.Task); expect(after.database.Ledger).toEqual(before.database.Ledger);
  expect(observed.posts).toHaveLength(1);
  // Assert the intentional real 503 diagnostic, including its endpoint, without filtering any event.
  expect(observed.failures).toEqual([]);
  expect(observed.consoleMessages).toEqual([{ type: 'error',
    text: 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
    url: runtime.webUrl + '/api/recurring-task-plans' }]);
});

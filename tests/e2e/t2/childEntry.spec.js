const { test, expect } = require('@playwright/test');
const { createT2WebRuntime } = require('./webRuntime');
let runtime;
test.beforeEach(async () => { runtime = await createT2WebRuntime(); });
test.afterEach(async () => { await runtime?.stop(); });
const entry = (name = 'child') => {
  const actor = runtime.fixture.actors[name];
  return `${runtime.webUrl}/child/login#familyId=${actor.familyId}&childId=${actor.childId}`;
};
async function login(page, name = 'child', pin) {
  await page.goto(entry(name));
  await expect(page.getByLabel('家庭 ID')).toHaveCount(0);
  await page.getByLabel('PIN').fill(pin || runtime.fixture.actors[name].pin);
  await page.getByRole('button', { name: '进入我的成长空间', exact: true }).click();
  await expect(page).toHaveURL(/\/child\/today$/);
}
const childSession = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('family-growth.child-session.v1')));
async function todayReady(page) {
  await expect(page.getByRole('button', { name: '读取最新计划', exact: true })).toBeEnabled();
  await expect(page.getByText('正在读取待办…', { exact: true })).toHaveCount(0);
}

test('parent-generated entries open sibling tabs independently; copy fallback and explicit switch', async ({ page, context }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const parent = runtime.fixture.actors.parent;
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
  await page.goto(runtime.webUrl + '/login');
  await page.getByLabel('用户名').fill(parent.username);
  await page.getByLabel('密码', { exact: true }).fill(parent.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/today$/);
  await page.goto(runtime.webUrl + '/app/children');
  const row = page.getByTestId('child-row-' + runtime.fixture.actors.child.childId);
  await row.getByRole('button', { name: '复制Synthetic child入口', exact: true }).click();
  await expect(row.getByLabel('Synthetic child的专属入口')).toHaveValue(entry());
  const popup = page.waitForEvent('popup');
  await row.getByRole('button', { name: '打开Synthetic child入口', exact: true }).click();
  const childA = await popup, childB = await context.newPage();
  try {
    for (const tab of [childA, childB]) {
      tab.on('pageerror', error => errors.push(error.message));
      tab.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
    }
    await expect(childA.getByLabel('PIN')).toBeVisible();
    expect(await childA.evaluate(() => window.opener === null)).toBe(true);
    expect(await childSession(childA)).toBeNull();
    for (const width of [360, 768, 1280]) {
      await childA.setViewportSize({ width, height: 900 });
      expect(await childA.title()).toBeTruthy();
      await expect(childA.locator('iframe#webpack-dev-server-client-overlay')).toHaveCount(0);
      expect(await childA.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await childA.screenshot({ path: info.outputPath(`entry-${width}.png`) });
    }
    await childA.getByLabel('PIN').fill(runtime.fixture.actors.child.pin);
    await childA.getByRole('button', { name: '进入我的成长空间' }).click();
    await expect(childA).toHaveURL(/\/child\/today$/);
    await todayReady(childA);
    await login(childB, 'sibling');
    await todayReady(childB);
    for (const [tab, name] of [[childA, 'child'], [childB, 'sibling']]) {
      await tab.reload();
      await todayReady(tab);
      await expect(tab.getByRole('banner').getByText(`Synthetic ${name}`, { exact: true })).toBeVisible();
      expect((await childSession(tab)).child.childId).toBe(runtime.fixture.actors[name].childId);
    }
    const before = await childSession(childA);
    await childA.goto(entry('sibling'));
    childA.once('dialog', dialog => dialog.dismiss());
    await childA.getByRole('button', { name: '切换到此入口' }).click();
    expect(await childSession(childA)).toEqual(before);
    childA.once('dialog', dialog => dialog.accept());
    await childA.getByRole('button', { name: '切换到此入口' }).click();
    await expect(childA.getByLabel('PIN')).toHaveValue('');
    expect(await childSession(childA)).toBeNull();
    expect((await childSession(childB)).child.childId).toBe(runtime.fixture.actors.sibling.childId);
    await page.reload(); await expect(page.getByRole('navigation', { name: '家长导航' })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { try { await childA.close(); } finally { await childB.close(); } }
});

test('hash change clears unsubmitted PIN and rejects a held real success without erasing fresh input', async ({ page }) => {
  await page.addInitScript(() => {
    window.pinResponsesSettled = 0;
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...args) {
      if (new URL(url, location.href).pathname === '/api/auth/child-pin-login') {
        this.addEventListener('loadend', () => {
          // Axios and login/finally finish their microtask chain before this next task.
          const channel = new MessageChannel();
          channel.port1.onmessage = () => {
            window.pinResponsesSettled++;
            channel.port1.close(); channel.port2.close();
          };
          channel.port2.postMessage(null);
        }, { once: true });
      }
      return open.call(this, method, url, ...args);
    };
  });
  let requests = 0;
  page.on('request', request => { if (request.url().endsWith('/api/auth/child-pin-login')) requests++; });
  await page.goto(entry()); await page.getByLabel('PIN').fill(runtime.fixture.actors.child.pin);
  await page.evaluate(url => { location.hash = new URL(url).hash; }, entry('sibling'));
  await expect(page.getByLabel('PIN')).toHaveValue('');
  await page.getByRole('button', { name: '进入我的成长空间' }).click();
  expect(requests).toBe(0);
  await page.goto(entry());
  let release, ready, finished, failure;
  const held = new Promise(resolve => { release = resolve; });
  const issued = new Promise(resolve => { ready = resolve; });
  const done = new Promise(resolve => { finished = resolve; });
  await page.route('**/api/auth/child-pin-login', async route => {
    let response;
    try {
      response = await route.fetch({ maxRetries: 0 });
      expect(response.status()).toBe(200); ready(); await held;
      await route.fulfill({ response });
    } catch (error) { failure = error; ready(); }
    finally { try { await response?.dispose(); } finally { finished(); } }
  });
  try {
    await page.getByLabel('PIN').fill(runtime.fixture.actors.child.pin);
    await page.getByRole('button', { name: '进入我的成长空间' }).click();
    await issued; if (failure) throw failure;
    await page.evaluate(url => { location.hash = new URL(url).hash; }, entry('sibling'));
    await expect(page.getByLabel('PIN')).toHaveValue('');
    await page.getByLabel('PIN').fill(runtime.fixture.actors.sibling.pin);
    release(); await done; if (failure) throw failure;
    await page.unrouteAll({ behavior: 'wait' });
    await expect.poll(() => page.evaluate(() => window.pinResponsesSettled)).toBe(1);
    expect(await childSession(page)).toBeNull();
    await expect(page).toHaveURL(entry('sibling'));
    await expect(page.getByLabel('PIN')).toHaveValue(runtime.fixture.actors.sibling.pin);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: '进入我的成长空间' }).click();
    await expect(page).toHaveURL(/\/child\/today$/);
    expect((await childSession(page)).child.childId).toBe(runtime.fixture.actors.sibling.childId);
  } finally { release(); await page.unrouteAll({ behavior: 'wait' }); }
  if (failure) throw failure;
});

test('bookmark relogin explicitly recovers the original durable completion after lost remote response', async ({ page }) => {
  const fixture = runtime.fixture, task = fixture.tasks.child;
  await login(page); await page.goto(runtime.webUrl + `/child/tasks/${task.taskId}`);
  await page.getByLabel('添加完成图片').setInputFiles({ name: fixture.image.name, mimeType: fixture.image.mimeType, buffer: fixture.image.bytes });
  await expect(page.getByText('已添加 1/10')).toBeVisible();
  runtime.dropNextResponse({ service: 'resource-service', method: 'POST', path: '/api/internal/media/references/commit' });
  await page.getByRole('button', { name: '提交完成情况' }).click();
  await expect(page.getByRole('button', { name: '重试本次提交' })).toBeVisible();
  const before = await runtime.inspect(), original = before.database.Operation.find(row => row.taskId === task.taskId);
  expect(original).toBeTruthy();
  await page.goto(runtime.webUrl + '/child/me');
  await page.getByRole('button', { name: '退出孩子端' }).click();
  await login(page, 'sibling');
  await page.goto(runtime.webUrl + `/child/tasks/${task.taskId}`);
  await expect(page.getByRole('alert').filter({ hasText: '当前身份无法访问此任务' })).toBeVisible();
  await page.goto(runtime.webUrl + '/child/me');
  await page.getByRole('button', { name: '退出孩子端' }).click();
  await login(page);
  await page.getByRole('button', { name: '检查待恢复提交' }).click();
  await page.getByRole('link', { name: `查看待恢复提交 ${task.taskId}`, exact: true }).click();
  await expect(page.getByRole('button', { name: '继续上次提交' })).toBeVisible();
  expect(await runtime.inspect()).toEqual(before);
  await page.getByRole('button', { name: '继续上次提交' }).click();
  await expect(page.getByText('作品版本 1')).toBeVisible();
  await page.reload(); await expect(page.getByText('作品版本 1')).toBeVisible();
  const after = await runtime.inspect(), operations = after.database.Operation.filter(row => row.taskId === task.taskId);
  expect(operations).toHaveLength(1);
  expect(operations[0]).toMatchObject({ operationId: original.operationId, remoteOperationId: original.remoteOperationId, phase: 'SUCCEEDED' });
  expect(after.database.Ledger.filter(row => row.sourceId === task.taskId)).toHaveLength(0);
});

test('PIN reset rejects old credentials while the same bookmark accepts the new PIN', async ({ page }) => {
  await login(page);
  const parent = await runtime.login('parent'), actor = runtime.fixture.actors.child;
  expect((await parent.post(`/api/children/${actor.childId}/pin`, { pin: '9753' })).status).toBe(200);
  await page.reload(); await expect(page).toHaveURL(/\/child\/login$/);
  await expect(page.getByRole('alert')).toContainText('会话已过期');
  await page.goto(entry()); await page.getByLabel('PIN').fill(actor.pin);
  await page.getByRole('button', { name: '进入我的成长空间' }).click();
  await expect(page.getByRole('alert')).toContainText('家庭、孩子或 PIN 不正确');
  expect(await childSession(page)).toBeNull();
  await page.getByLabel('PIN').fill('9753');
  await page.getByRole('button', { name: '进入我的成长空间' }).click();
  await expect(page).toHaveURL(/\/child\/today$/);
});

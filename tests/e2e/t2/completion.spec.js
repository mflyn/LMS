const { test, expect } = require('@playwright/test');
const { randomUUID } = require('crypto');
const { createT2WebRuntime } = require('./webRuntime');
const { openParentTasks } = require('./parentNavigation');
const { expectData } = require('../../../backend/tests/t2/syntheticSeed');

let runtime, fixture, fixtureParent;
const taskPath = task => `/child/tasks/${task.taskId}`;
const rows = (snapshot, model, key, value) => snapshot.database[model].filter(row => row[key] === value);
test.beforeEach(async () => {
  runtime = await createT2WebRuntime(); fixture = runtime.fixture;
  fixtureParent = await runtime.login('parent');
});
test.afterEach(async () => { await runtime?.stop(); });

async function childLogin(page, name = 'child') {
  const actor = fixture.actors[name];
  await page.goto(runtime.webUrl + '/child/login');
  await page.getByLabel('家庭 ID').fill(actor.familyId);
  await page.getByLabel('孩子 ID').fill(actor.childId);
  await page.getByLabel('PIN').fill(actor.pin);
  await page.getByRole('button', { name: '进入我的成长空间' }).click();
  await expect(page).toHaveURL(/\/child\/today$/);
}
async function parentLogin(page, name = 'parent') {
  const actor = fixture.actors[name];
  await page.goto(runtime.webUrl + '/login');
  await page.getByLabel('用户名').fill(actor.username);
  await page.getByLabel('密码', { exact: true }).fill(actor.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/today$/);
}
async function upload(page) {
  await page.getByLabel('添加完成图片').setInputFiles({ name: fixture.image.name,
    mimeType: fixture.image.mimeType, buffer: fixture.image.bytes });
  await expect(page.getByText('已添加 1/10')).toBeVisible();
}
async function newTask(title) {
  return expectData(await fixtureParent.post('/api/growth-tasks', { childId: fixture.actors.child.childId,
    title, dimension: 'physical', taskType: 'exercise', estimatedMinutes: 10,
    dueDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date()) }), 201).task;
}
async function openReview(page, task) {
  await openParentTasks(page, runtime.webUrl);
  await page.getByRole('button', { name: `查看 ${task.title}`, exact: true }).click();
  await expect(page.getByRole('dialog', { name: '作品查看与审核' })).toBeVisible();
}
function monitor(page) {
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => { if (message.type() === 'error') failures.push(message.text().replace(/https?:\/\/\S+/g, '[url]')); });
  return failures;
}
async function imageVisible(page) {
  await page.getByRole('button', { name: '查看完成图片 1', exact: true }).click();
  const image = page.getByRole('img', { name: '完成图片 1', exact: true });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  return image;
}

test('real pages: upload, refresh, parent review, child feedback; four viewports and privacy deletion', async ({ page, browser }, testInfo) => {
  const childErrors = monitor(page), parentContext = await browser.newContext();
  const parentPage = await parentContext.newPage(), parentErrors = monitor(parentPage);
  try {
    const task = await newTask('Synthetic browser work');
    await childLogin(page);
    const taskLink = page.getByRole('region', { name: '今天的任务', exact: true })
      .getByRole('link', { name: new RegExp(task.title) });
    const planLink = page.getByRole('region', { name: '今日计划', exact: true })
      .getByRole('link', { name: task.title, exact: true });
    await expect(taskLink).toHaveCount(1);
    await expect(planLink).toHaveCount(1);
    await expect(taskLink).toHaveAttribute('href', taskPath(task));
    await expect(planLink).toHaveAttribute('href', taskPath(task));
    await taskLink.click();
    await upload(page);
    await page.getByLabel('我的一句话').fill('Synthetic reflection');
    await page.getByRole('button', { name: '提交完成情况' }).click();
    await expect(page.getByText('作品版本 1')).toBeVisible();
    await page.reload();
    await imageVisible(page);
    await parentLogin(parentPage); await openReview(parentPage, task);
    await imageVisible(parentPage);
    await parentPage.getByRole('textbox', { name: '家长反馈' }).fill('Synthetic first feedback');
    await parentPage.getByRole('button', { name: '确认并发放星星' }).click();
    await expect(parentPage.getByText('星星已到账')).toBeVisible();
    // No extra click after the focused confirmation form is removed.
    const reviewDialog = parentPage.getByRole('dialog', { name: '作品查看与审核' });
    await expect.poll(() => reviewDialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
    await parentPage.keyboard.press('Tab');
    expect(await reviewDialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
    await parentPage.keyboard.press('Shift+Tab');
    expect(await reviewDialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
    await parentPage.keyboard.press('Escape');
    await expect(reviewDialog).toHaveCount(0);
    await expect(parentPage.getByRole('button', { name: `查看 ${task.title}`, exact: true })).toBeFocused();
    await parentPage.getByRole('button', { name: `查看 ${task.title}`, exact: true }).click();
    await expect(reviewDialog).toBeVisible();
    await parentPage.getByRole('button', { name: '隐私删除完成图片 1', exact: true }).click();
    await expect(parentPage.getByRole('button', { name: '取消', exact: true })).toBeFocused();
    await parentPage.keyboard.press('Escape');
    await expect(parentPage.getByRole('button', { name: '确认隐私删除' })).toHaveCount(0);
    await expect(reviewDialog).toBeVisible();
    await expect(parentPage.getByRole('button', { name: '隐私删除完成图片 1', exact: true })).toBeFocused();
    await page.reload();
    await expect(page.getByText('Synthetic first feedback')).toBeVisible();
    await expect(page.getByRole('button', { name: '修改本次完成' })).toHaveCount(0);
    const stable = await runtime.inspect();
    expect(rows(stable, 'Ledger', 'sourceId', task.taskId)).toHaveLength(1);
    expect(rows(stable, 'Task', '_id', task.taskId)[0]).toMatchObject({ status: 'confirmed', completionVersion: 1,
      confirmedByParentId: fixture.actors.parent.userId });
    for (const [width, height] of [[768,1024], [1024,768], [1280,800], [390,844]]) {
      await page.setViewportSize({ width, height });
      await imageVisible(page);
      expect(await page.title()).toBeTruthy();
      expect(await page.locator('body').innerText()).toContain('Synthetic first feedback');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('iframe#webpack-dev-server-client-overlay')).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`child-${width}x${height}.png`), fullPage: true });
      await parentPage.setViewportSize({ width, height });
      await imageVisible(parentPage);
      await parentPage.getByText('Synthetic first feedback', { exact: true }).scrollIntoViewIfNeeded();
      await expect(parentPage.getByText('Synthetic first feedback', { exact: true })).toBeInViewport();
      await parentPage.keyboard.press('Tab');
      expect(await parentPage.evaluate(() => Boolean(document.activeElement.closest('[role="dialog"]')))).toBe(true);
      expect(await parentPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await parentPage.screenshot({ path: testInfo.outputPath(`parent-${width}x${height}.png`), fullPage: true });
    }
    expect(childErrors).toEqual([]); expect(parentErrors).toEqual([]);
    const image = page.getByRole('img', { name: '完成图片 1', exact: true });
    const oldUrl = await image.getAttribute('src');
    await page.getByRole('button', { name: '隐私删除完成图片 1', exact: true }).click();
    await page.getByRole('button', { name: '确认隐私删除' }).click();
    await expect(page.getByText('图片已隐私删除')).toBeVisible();
    await expect(image).toHaveCount(0);
    const deleted = await runtime.inspect();
    expect(rows(deleted, 'Task', '_id', task.taskId)).toEqual(rows(stable, 'Task', '_id', task.taskId));
    expect(deleted.database.Ledger).toEqual(stable.database.Ledger);
    expect((await page.request.get(new URL(oldUrl, runtime.webUrl).href)).status()).toBe(404);
    await page.reload();
    await page.getByRole('button', { name: '查看完成图片 1', exact: true }).click();
    await expect(page.getByText('图片不可访问，请确认当前账号权限。')).toBeVisible();
    await expect(page.getByText('Synthetic first feedback')).toBeVisible();
  } finally { await parentContext.close(); }
});

test('one browser keeps parent and sibling tabs independent through refresh and explicit switching', async ({ page, context }, testInfo) => {
  // The shared seed uses UTC dates; this UI contract explicitly checks Shanghai's today.
  const dueDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
  for (const task of [fixture.tasks.child, fixture.tasks.sibling]) {
    expectData(await fixtureParent.patch(`/api/growth-tasks/${task.taskId}`, { dueDate }));
  }
  const childA = await context.newPage(), childB = await context.newPage();
  const errors = [page, childA, childB].map(monitor);
  try {
    await parentLogin(page);
    const parentBefore = await page.evaluate(() => localStorage.getItem('family-growth.parent-session.v1'));
    await childLogin(childA);
    const popupReady = childA.waitForEvent('popup');
    await childA.evaluate(() => window.open('/child/login', '_blank'));
    const copied = await popupReady;
    try {
      await expect(copied.getByRole('heading', { name: '孩子登录', exact: true })).toBeVisible();
      await expect(copied.getByRole('button', { name: '继续使用Synthetic child', exact: true })).toBeVisible();
      await expect(copied.getByRole('button', { name: '切换孩子', exact: true })).toBeVisible();
      await expect(copied.getByRole('navigation', { name: '孩子导航', exact: true })).toHaveCount(0);
    } finally { await copied.close(); }
    await childB.goto(runtime.webUrl + '/child/login');
    await expect(childB.getByLabel('PIN')).toBeVisible();
    expect(await childB.evaluate(() => sessionStorage.getItem('family-growth.child-session.v1'))).toBeNull();
    await childLogin(childB, 'sibling');
    await expect(childA.getByRole('region', { name: '今天的任务', exact: true }).getByText(fixture.tasks.child.title, { exact: true })).toBeVisible();
    await expect(childB.getByRole('region', { name: '今天的任务', exact: true }).getByText(fixture.tasks.sibling.title, { exact: true })).toBeVisible();
    await expect(childB.getByText(fixture.tasks.child.title, { exact: true })).toHaveCount(0);
    for (const [tab, name] of [[childA, 'Synthetic child'], [childB, 'Synthetic sibling']]) {
      await tab.reload();
      await expect(tab.getByRole('banner').getByText(name, { exact: true })).toBeVisible();
      expect(await tab.evaluate(() => localStorage.getItem('family-growth.child-session.v1'))).toBeNull();
      await tab.goto(runtime.webUrl + '/child/login');
      await expect(tab.getByRole('heading', { name: '孩子登录', exact: true })).toBeVisible();
      await tab.getByRole('button', { name: `继续使用${name}`, exact: true }).click();
      await expect(tab).toHaveURL(/\/child\/today$/);
    }
    const siblingBefore = await childB.evaluate(() => sessionStorage.getItem('family-growth.child-session.v1'));
    for (const width of [1280, 768, 360]) {
      await childA.setViewportSize({ width, height: 900 });
      await expect(childA.getByRole('button', { name: '切换孩子', exact: true })).toBeVisible();
      expect(await childA.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await childA.screenshot({ path: testInfo.outputPath(`child-switch-${width}.png`) });
    }
    childA.once('dialog', dialog => dialog.dismiss());
    await childA.getByRole('button', { name: '切换孩子', exact: true }).click();
    await expect(childA.getByRole('banner').getByText('Synthetic child', { exact: true })).toBeVisible();
    childA.once('dialog', dialog => dialog.accept());
    await childA.getByRole('button', { name: '切换孩子', exact: true }).click();
    await expect(childA.getByLabel('PIN')).toHaveValue('');
    expect(await childA.evaluate(() => sessionStorage.getItem('family-growth.child-session.v1'))).toBeNull();
    await childB.reload();
    expect(await childB.evaluate(() => sessionStorage.getItem('family-growth.child-session.v1'))).toBe(siblingBefore);
    await expect(childB.getByRole('banner').getByText('Synthetic sibling', { exact: true })).toBeVisible();
    await page.reload();
    expect(await page.evaluate(() => localStorage.getItem('family-growth.parent-session.v1'))).toBe(parentBefore);
    await expect(page.getByRole('navigation', { name: '家长导航', exact: true })).toBeVisible();
    expect(errors.flat()).toEqual([]);
  } finally { try { await childA.close(); } finally { await childB.close(); } }
});

test('another child tab login and exit preserve the original unknown completion command', async ({ page, context }) => {
  const task = await newTask('Synthetic independent tab recovery');
  await childLogin(page); await page.goto(runtime.webUrl + taskPath(task));
  const sent = [];
  page.on('request', request => { if (request.url().endsWith(`/${task.taskId}/complete`)) sent.push(request.postDataJSON()); });
  const commands = () => page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)
    .filter(([key]) => key.startsWith('family-growth.completion-command.v1:'))));
  runtime.dropNextResponse({ method: 'PATCH', path: `/api/growth-tasks/${task.taskId}/complete` });
  await page.getByRole('button', { name: '提交完成情况' }).click();
  await expect(page.getByRole('button', { name: '重试本次提交' })).toBeVisible();
  const saved = await commands(), before = await runtime.inspect();
  expect(Object.keys(saved)).toHaveLength(1);
  const sibling = await context.newPage();
  try {
    await childLogin(sibling, 'sibling');
    await expect(page.getByRole('button', { name: '重试本次提交' })).toBeVisible();
    expect(await commands()).toEqual(saved);
    await sibling.goto(runtime.webUrl + '/child/me');
    await sibling.getByRole('button', { name: '退出孩子端', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: '重试本次提交' })).toBeVisible();
    expect(await commands()).toEqual(saved); expect(sent).toHaveLength(1);
    const retried = page.waitForResponse(response => response.url().endsWith(`/${task.taskId}/complete`)
      && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: '重试本次提交' }).click();
    const response = await retried;
    expect(response.status()).toBe(200); expect(await response.finished()).toBeNull();
    expect((await response.json()).data.task.completionVersion).toBe(1);
    await expect.poll(commands).toEqual({});
    await expect(page.getByRole('button', { name: '重试本次提交' })).toHaveCount(0);
    await expect(page.getByText('作品版本 1')).toBeVisible();
    expect(sent).toHaveLength(2); expect(sent[1]).toEqual(sent[0]);
    expect(await commands()).toEqual({}); expect(await runtime.inspect()).toEqual(before);
  } finally { await sibling.close(); }
});

test('same-child logout in a second tab clears private work and rejects late media before sibling login', async ({ page, context }) => {
  const task = await newTask('Synthetic cross-tab work');
  await childLogin(page); await page.goto(runtime.webUrl + taskPath(task)); await upload(page);
  await page.getByRole('button', { name: '提交完成情况' }).click();
  await expect(page.getByText('作品版本 1')).toBeVisible();
  let release, captured;
  const ready = new Promise(resolve => { captured = resolve; });
  const hold = new Promise(resolve => { release = resolve; });
  await page.route('**/api/media/*/access', async route => {
    const response = await route.fetch();
    captured(); await hold;
    try { await route.fulfill({ response }); } catch { /* The old document may already be gone. */ }
  });
  await page.getByRole('button', { name: '查看完成图片 1', exact: true }).click();
  await ready;
  const other = await context.newPage();
  try {
    await childLogin(other);
    await other.goto(runtime.webUrl + '/child/me');
    await other.getByRole('button', { name: '退出孩子端' }).click();
    await childLogin(other, 'sibling');
    await expect(page.getByRole('heading', { name: task.title })).toHaveCount(0);
    release();
    await expect(page.getByRole('img', { name: '完成图片 1', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '提交完成情况' })).toHaveCount(0);
    const state = await runtime.inspect();
    expect(rows(state, 'Operation', 'taskId', task.taskId)).toHaveLength(1);
    await other.goto(runtime.webUrl + taskPath(task));
    await expect(other.getByRole('heading', { name: task.title })).toHaveCount(0);
    await expect(other.getByRole('alert').filter({ hasText: '当前身份无法访问此任务' })).toBeVisible();
    await expect(other.getByRole('region', { name: '任务求助' })).toHaveCount(0);
    await expect(other.getByRole('button', { name: '刷新详情', exact: true })).toBeDisabled();
  } finally { release(); await other.close(); }
});

for (const reason of ['revoked-session', 'expired-JWT']) test(`a late real ${reason} 401 cannot expire the newly logged-in sibling`, async ({ page, context }) => {
  const task = await newTask('Synthetic late authorization');
  await childLogin(page); await page.goto(runtime.webUrl + taskPath(task));
  await expect(page.getByRole('heading', { name: task.title })).toBeVisible();
  if (reason === 'revoked-session') {
    expectData(await fixtureParent.post(`/api/children/${fixture.actors.child.childId}/pin`, { pin: fixture.actors.child.pin }));
  }
  const expired = require('jsonwebtoken').sign({ id: fixture.actors.child.userId, role: 'student', tokenVersion: 0 },
    process.env.JWT_SECRET, { expiresIn: -1 });
  let release, captured;
  const hold = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { captured = resolve; });
  await page.route(`**/api/growth-tasks/${task.taskId}`, async route => {
    const response = await route.fetch(reason === 'expired-JWT'
      ? { headers: { ...route.request().headers(), authorization: `Bearer ${expired}` } } : undefined);
    expect(response.status()).toBe(401);
    expect((await response.json()).error.code).toBe(reason === 'expired-JWT' ? 'UNAUTHENTICATED' : 'STALE_CHILD_TOKEN');
    captured(); await hold;
    try { await route.fulfill({ response }); } catch { /* Old document was invalidated. */ }
  });
  await page.getByRole('button', { name: '刷新详情' }).click(); await ready;
  const other = await context.newPage();
  try {
    if (reason === 'expired-JWT') {
      // Only the intercepted request used an expired JWT; explicitly authenticate this independent tab.
      await childLogin(other);
      await other.goto(runtime.webUrl + '/child/me');
      await other.getByRole('button', { name: '退出孩子端' }).click();
    }
    await childLogin(other, 'sibling'); release();
    await page.unrouteAll({ behavior: 'wait' });
    await other.reload();
    await expect(other).toHaveURL(/\/child\/today$/);
    await expect(other.getByRole('banner').getByText('Synthetic sibling', { exact: true })).toBeVisible();
    expect(await other.evaluate(() => JSON.parse(sessionStorage.getItem('family-growth.child-session.v1')).child.childId))
      .toBe(fixture.actors.sibling.childId);
  } finally { release(); await other.close(); }
});

test('lost public response refreshes and retries the exact persisted command without republishing', async ({ page }) => {
  const task = await newTask('Synthetic lost acknowledgement');
  await childLogin(page); await page.goto(runtime.webUrl + taskPath(task)); await upload(page);
  const requests = [];
  page.on('request', request => { if (request.url().endsWith(`/${task.taskId}/complete`)) requests.push(request.postDataJSON()); });
  runtime.dropNextResponse({ method: 'PATCH', path: `/api/growth-tasks/${task.taskId}/complete` });
  await page.getByRole('button', { name: '提交完成情况' }).click();
  await expect(page.getByRole('button', { name: '重试本次提交' })).toBeVisible();
  const committed = await runtime.inspect();
  await page.reload();
  await page.getByRole('button', { name: '重试本次提交' }).click();
  await expect(page.getByRole('button', { name: '重试本次提交' })).toHaveCount(0);
  await expect(page.getByText('作品版本 1')).toBeVisible();
  expect(requests).toHaveLength(2); expect(requests[1]).toEqual(requests[0]);
  expect(await runtime.inspect()).toEqual(committed);
});

for (const damaged of [false, true]) test(`remote committed response loss survives explicit logout${damaged ? ' with a damaged local command' : ''}; only original actor resumes the durable operation`, async ({ page }) => {
  const task = await newTask('Synthetic relogin recovery');
  expectData(await fixtureParent.patch(`/api/growth-tasks/${task.taskId}`, { dueDate: '2020-01-01' }));
  await childLogin(page); await page.goto(runtime.webUrl + taskPath(task)); await upload(page);
  runtime.dropNextResponse({ service: 'resource-service', method: 'POST', path: '/api/internal/media/references/commit' });
  await page.getByRole('button', { name: '提交完成情况' }).click();
  await expect(page.getByRole('button', { name: '重试本次提交' })).toBeVisible();
  const before = await runtime.inspect(), original = rows(before, 'Operation', 'taskId', task.taskId)[0];
  if (damaged) {
    await page.evaluate(() => {
      const key = Object.keys(sessionStorage).find(key => key.startsWith('family-growth.completion-command.v1:'));
      if (!key) throw Error('Expected original command');
      sessionStorage.setItem(key, '{broken');
    });
    await page.reload();
    await expect(page.getByText('本地提交记录无法校验，请重新登录后使用原提交恢复。')).toBeVisible();
  }
  await page.goto(runtime.webUrl + '/child/me');
  await page.getByRole('button', { name: '退出孩子端' }).click();
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('family-growth.completion-command.')))).toEqual([]);
  await childLogin(page);
  await page.getByRole('button', { name: '检查待恢复提交' }).click();
  await page.getByRole('link', { name: `查看待恢复提交 ${task.taskId}`, exact: true }).click();
  await expect(page.getByRole('button', { name: '继续上次提交' })).toBeVisible();
  expect(await runtime.inspect()).toEqual(before);
  await page.getByRole('button', { name: '继续上次提交' }).click();
  await expect(page.getByText('作品版本 1')).toBeVisible();
  const after = await runtime.inspect();
  expect(rows(after, 'Operation', 'taskId', task.taskId)).toHaveLength(1);
  expect(rows(after, 'Operation', 'taskId', task.taskId)[0]).toMatchObject({ operationId: original.operationId,
    remoteOperationId: original.remoteOperationId, phase: 'SUCCEEDED' });
  await imageVisible(page);
});

for (const role of ['child', 'parent']) test(`real expired JWT: ${role} relogs and retries the original durable completion`, async ({ page }) => {
  const task = await newTask('Synthetic expiry recovery');
  if (role === 'child') { await childLogin(page); await page.goto(runtime.webUrl + taskPath(task)); }
  else { await parentLogin(page); await openReview(page, task); await page.getByRole('button', { name: '代录完成情况' }).click(); }
  await upload(page);
  const commands = [];
  page.on('request', request => { if (request.url().endsWith(`/${task.taskId}/complete`)) commands.push(request.postDataJSON()); });
  runtime.dropNextResponse({ service: 'resource-service', method: 'POST', path: '/api/internal/media/references/commit' });
  await page.getByRole('button', { name: '提交完成情况' }).click();
  await expect(page.getByRole('button', { name: '重试本次提交' })).toBeVisible();
  const before = await runtime.inspect(), original = rows(before, 'Operation', 'taskId', task.taskId)[0];
  const storageKey = `family-growth.${role}-session.v1`;
  const rawCommands = () => page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)
    .filter(([key]) => key.startsWith('family-growth.completion-command.v1:'))));
  const saved = await rawCommands(); expect(Object.keys(saved)).toHaveLength(1);
  const expired = require('jsonwebtoken').sign({ id: fixture.actors[role].userId,
    role: role === 'child' ? 'student' : 'parent', tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: -1 });
  await page.evaluate(({ key, token, role }) => {
    const store = role === 'child' ? sessionStorage : localStorage;
    const session = JSON.parse(store.getItem(key));
    if (!session?.token) throw new Error('Expected an authenticated expiry fixture');
    store.setItem(key, JSON.stringify({ ...session, token }));
  }, { key: storageKey, token: expired, role });
  const denial = page.waitForResponse(response => response.url().includes('/api/') && response.status() === 401);
  await page.reload();
  expect((await (await denial).json()).error.code).toBe('UNAUTHENTICATED');
  await expect(page).toHaveURL(role === 'child' ? /\/child\/login/ : /\/login/);
  expect(await page.evaluate(({ key, role }) => (role === 'child' ? sessionStorage : localStorage).getItem(key),
    { key: storageKey, role })).toBeNull();
  expect(await rawCommands()).toEqual(saved);
  expect(await runtime.inspect()).toEqual(before);
  if (role === 'child') { await childLogin(page); await page.goto(runtime.webUrl + taskPath(task)); }
  else { await parentLogin(page); await openReview(page, task); }
  await expect(page.getByRole('button', { name: '重试本次提交' })).toBeVisible();
  await page.getByRole('button', { name: '重试本次提交' }).click();
  await expect(page.getByText('作品版本 1')).toBeVisible();
  expect(commands).toHaveLength(2); expect(commands[1]).toEqual(commands[0]);
  const after = await runtime.inspect();
  expect(rows(after, 'Operation', 'taskId', task.taskId)).toHaveLength(1);
  expect(rows(after, 'Operation', 'taskId', task.taskId)[0]).toMatchObject({ operationId: original.operationId,
    remoteOperationId: original.remoteOperationId, phase: 'SUCCEEDED' });
  expect(rows(after, 'Ledger', 'sourceId', task.taskId)).toHaveLength(0);
  await imageVisible(page);
});

test('clearing completion numbers replaces both evidence and compatibility fields through refresh and review', async ({ page }) => {
  const task = await newTask('Synthetic cleared optional fields');
  await childLogin(page); await page.goto(runtime.webUrl + taskPath(task));
  await page.getByLabel('实际用时（分钟）').fill('12');
  await page.getByLabel('实际完成数量', { exact: true }).fill('5');
  await page.getByRole('button', { name: '提交完成情况' }).click();
  await expect(page.getByText('作品版本 1')).toBeVisible();
  await page.getByRole('button', { name: '修改本次完成' }).click();
  await page.getByLabel('实际用时（分钟）').fill('');
  await page.getByLabel('实际完成数量', { exact: true }).fill('');
  await page.getByRole('button', { name: '提交修改' }).click();
  await expect(page.getByText('作品版本 2')).toBeVisible();
  await page.reload();
  await expect(page.getByText('作品版本 2')).toBeVisible();
  for (const label of ['实际用时', '实际完成数量']) {
    await expect(page.locator('.task-completion-facts div').filter({ has: page.getByText(label, { exact: true }) })).toContainText('未填写');
  }
  const stored = rows(await runtime.inspect(), 'Task', '_id', task.taskId)[0];
  for (const key of ['actualMinutes', 'actualAmount']) {
    expect(stored).not.toHaveProperty(key); expect(stored.completionEvidence).not.toHaveProperty(key);
  }
  await parentLogin(page); await openReview(page, task);
  await expect(page.getByText('作品版本 2')).toBeVisible();
  await page.getByRole('button', { name: '确认并发放星星' }).click();
  await expect(page.getByText('星星已到账')).toBeVisible();
  await page.goto(runtime.webUrl + taskPath(task));
  await expect(page.getByText('作品版本 2')).toBeVisible();
  await expect(page.getByRole('button', { name: '修改本次完成' })).toHaveCount(0);
});

test('current recovery 403 after membership revocation clears private review without changing the durable operation', async ({ page }) => {
  const task = await newTask('Synthetic revoked parent private work');
  await parentLogin(page, 'coparent'); await openReview(page, task);
  await page.getByRole('button', { name: '代录完成情况' }).click(); await upload(page);
  runtime.dropNextResponse({ service: 'resource-service', method: 'POST', path: '/api/internal/media/references/commit' });
  await page.getByRole('button', { name: '提交完成情况' }).click();
  await expect(page.getByRole('button', { name: '重试本次提交' })).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '退出登录' }).click();
  await parentLogin(page, 'coparent'); await openReview(page, task);
  const dialog = page.getByRole('dialog', { name: '作品查看与审核' });
  await expect(dialog.getByText(task.title, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '继续上次提交' })).toBeVisible();
  expect((await fixtureParent.delete(`/api/families/${fixture.familyId}/members/${fixture.actors.coparent.userId}`)).status).toBe(204);
  const before = await runtime.inspect(), original = rows(before, 'Operation', 'taskId', task.taskId)[0];
  const response = page.waitForResponse(value => value.url().endsWith(`/completion-operations/${original.operationId}/recover`));
  await page.getByRole('button', { name: '继续上次提交' }).click();
  expect((await response).status()).toBe(403);
  await expect(dialog.getByText('当前身份无法访问此任务，请重新登录后恢复原请求。')).toBeVisible();
  await expect(dialog.getByText(task.title, { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('heading', { name: '完成情况' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '继续上次提交' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '刷新详情' })).toBeDisabled();
  expect(await runtime.inspect()).toEqual(before);
});

test('parent viewing version one cannot confirm a concurrent unseen version two', async ({ page }) => {
  const task = await newTask('Synthetic version conflict'), child = await runtime.login('child');
  const body = { operationId: randomUUID(), expectedCompletionVersion: 0, expectedChecklistVersion: 0,
    checkedItemIds: [], completionMediaIds: [] };
  expectData(await child.patch(`/api/growth-tasks/${task.taskId}/complete`, body));
  await parentLogin(page); await openReview(page, task);
  await expect(page.getByText('作品版本 1')).toBeVisible();
  expectData(await child.patch(`/api/growth-tasks/${task.taskId}/complete`, { ...body,
    operationId: randomUUID(), expectedCompletionVersion: 1, childNote: 'New unseen evidence' }));
  await page.getByRole('button', { name: '确认并发放星星' }).click();
  await expect(page.getByText('作品版本 2')).toBeVisible();
  expect(rows(await runtime.inspect(), 'Ledger', 'sourceId', task.taskId)).toEqual([]);
  await expect(page.getByText('New unseen evidence')).toBeVisible();
  await page.getByRole('button', { name: '确认并发放星星' }).click();
  await expect(page.getByText('星星已到账')).toBeVisible();
  expect(rows(await runtime.inspect(), 'Ledger', 'sourceId', task.taskId)).toHaveLength(1);
});

test('partial upload preserves successful images, then submits ten images and removes references without deleting assets', async ({ page }) => {
  const task = await newTask('Synthetic ten images');
  await childLogin(page); await page.goto(runtime.webUrl + taskPath(task));
  // Drop the committed response without replaying browser-specific multipart bodies.
  runtime.dropNextResponse({ service: 'resource-service', method: 'POST', path: '/api/media' });
  await page.getByLabel('添加完成图片').setInputFiles(Array.from({ length: 10 }, (_, index) => ({
    name: `synthetic-${index}.png`, mimeType: fixture.image.mimeType, buffer: fixture.image.bytes
  })));
  await expect(page.getByText('已添加 9/10')).toBeVisible();
  expect(runtime.droppedResponses).toEqual([{ service: 'resource-service', method: 'POST', path: '/api/media', status: 201 }]);
  const partial = await runtime.inspect();
  const uploaded = partial.database.Asset.filter(row => row.purpose === 'task_completion');
  expect(uploaded).toHaveLength(10);
  expect(uploaded.every(row => row.status === 'active')).toBe(true);
  expect(partial.files.filter(row => row.path.startsWith('media/'))).toHaveLength(10);
  await expect(page.getByRole('alert')).toContainText('已成功的图片会保留');
  await page.getByLabel('添加完成图片').setInputFiles({ name: 'replacement.png', mimeType: fixture.image.mimeType, buffer: fixture.image.bytes });
  await expect(page.getByText('已添加 10/10')).toBeVisible();
  await expect(page.getByLabel('添加完成图片')).toBeDisabled();
  await page.getByRole('button', { name: '提交完成情况' }).click();
  await expect(page.getByText('作品版本 1')).toBeVisible();
  const first = await runtime.inspect();
  const taskRow = rows(first, 'Task', '_id', task.taskId)[0];
  const firstIds = taskRow.completionEvidence.completionMediaIds;
  expect(firstIds).toHaveLength(10);
  expect(first.database.Reference.filter(row => firstIds.includes(row.mediaId) && row.state === 'bound')).toHaveLength(10);
  await page.getByRole('button', { name: '修改本次完成' }).click();
  await page.getByRole('button', { name: '移除完成图片 1', exact: true }).click();
  expect((await runtime.inspect()).database.Asset).toEqual(first.database.Asset);
  await page.getByRole('button', { name: '提交修改' }).click();
  await expect(page.getByText('作品版本 2')).toBeVisible();
  const second = await runtime.inspect();
  expect(rows(second, 'Task', '_id', task.taskId)[0].completionEvidence.completionMediaIds).toEqual(firstIds.slice(1));
  const liveReferences = second.database.Reference.filter(row => row.resourceId === task.taskId
    && row.field === 'completionMediaIds' && row.state === 'bound');
  expect(liveReferences.map(row => row.mediaId).sort()).toEqual(firstIds.slice(1).sort());
  const removedBefore = first.database.Reference.find(row => row.resourceId === task.taskId
    && row.field === 'completionMediaIds' && row.mediaId === firstIds[0]);
  expect(second.database.Reference.find(row => row._id === removedBefore._id))
    .toMatchObject({ state: 'released', operationId: removedBefore.operationId });
  const mediaFiles = snapshot => snapshot.files.filter(row => row.path.startsWith('media/'));
  expect(mediaFiles(first).length).toBeGreaterThanOrEqual(10);
  expect(mediaFiles(second)).toEqual(mediaFiles(first));
  expect(second.database.Asset).toEqual(first.database.Asset);
  expect(second.database.Tombstone).toEqual([]);
});

test('parent records work, coparent retries a lost confirmation response without replacing the first audit', async ({ page, browser }) => {
  const task = await newTask('Synthetic shared parent review');
  expectData(await fixtureParent.patch(`/api/growth-tasks/${task.taskId}`, { expectedChecklistVersion: 0,
    checklistSnapshot: [{ itemId: 'read', label: 'Synthetic selfcheck', required: true }] }));
  await parentLogin(page); await openReview(page, task);
  await page.getByRole('button', { name: '代录完成情况' }).click();
  await upload(page);
  await page.getByLabel('我的一句话').fill('Synthetic parent record');
  await page.getByRole('button', { name: '提交完成情况' }).click();
  await expect(page.getByText('作品版本 1')).toBeVisible();
  const recorded = rows(await runtime.inspect(), 'Task', '_id', task.taskId)[0];
  expect(recorded.completionEvidence.submittedByActor).toEqual({ id: fixture.actors.parent.userId, role: 'parent' });
  expect(recorded.completionEvidence.checkedItemIds).toEqual([]);
  await expect(page.getByText('家长代录', { exact: true })).toBeVisible();
  await expect(page.getByText('Synthetic selfcheck：未勾选', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '退出登录' }).click();
  await parentLogin(page, 'coparent'); await openReview(page, task);
  await imageVisible(page);
  await page.getByRole('textbox', { name: '家长反馈' }).fill('Synthetic coparent first feedback');
  const commands = [];
  page.on('request', request => { if (request.url().endsWith(`/${task.taskId}/confirm`)) commands.push(request.postDataJSON()); });
  runtime.dropNextResponse({ method: 'PATCH', path: `/api/growth-tasks/${task.taskId}/confirm` });
  await page.getByRole('button', { name: '确认并发放星星' }).click();
  await expect(page.getByRole('button', { name: '重试本次审核' })).toBeVisible();
  const confirmed = await runtime.inspect();
  await page.getByRole('button', { name: '重试本次审核' }).click();
  await expect(page.getByText('星星已到账')).toBeVisible();
  expect(commands).toHaveLength(2); expect(commands[1]).toEqual(commands[0]);
  expect(await runtime.inspect()).toEqual(confirmed);
  expect(rows(confirmed, 'Task', '_id', task.taskId)[0]).toMatchObject({
    confirmedByParentId: fixture.actors.coparent.userId, parentFeedback: 'Synthetic coparent first feedback'
  });
  expect(rows(confirmed, 'Task', '_id', task.taskId)[0].completionEvidence.submittedByActor)
    .toEqual(recorded.completionEvidence.submittedByActor);
  expect(rows(confirmed, 'Ledger', 'sourceId', task.taskId)).toHaveLength(1);
  const childContext = await browser.newContext();
  try {
    const childPage = await childContext.newPage(); await childLogin(childPage);
    await childPage.goto(runtime.webUrl + taskPath(task));
    await expect(childPage.getByText('家长代录', { exact: true })).toBeVisible();
    await expect(childPage.getByText('Synthetic selfcheck：未勾选', { exact: true })).toBeVisible();
    await expect(childPage.getByText('Synthetic coparent first feedback', { exact: true })).toBeVisible();
    await expect(childPage.getByRole('button', { name: '修改本次完成' })).toHaveCount(0);
  } finally { await childContext.close(); }
});

const { test, expect } = require('@playwright/test');
const { createT2WebRuntime } = require('./webRuntime');
const { expectData } = require('../../../backend/tests/t2/syntheticSeed');
let runtime, fixture, parent, child;
test.beforeEach(async () => {
  runtime = await createT2WebRuntime(); fixture = runtime.fixture;
  parent = await runtime.login('parent'); child = await runtime.login('child');
});
test.afterEach(async () => { await runtime?.stop(); });
const newTask = async () => expectData(await parent.post('/api/growth-tasks', {
  childId: fixture.actors.child.childId, title: 'Synthetic independent help', dimension: 'academic', taskType: 'practice', dueDate: '2026-01-01'
}), 201).task;
const path = task => `/api/growth-tasks/${task.taskId}`;
async function login(page, role = 'child') {
  const actor = fixture.actors[role];
  await page.goto(runtime.webUrl + (['child', 'sibling'].includes(role) ? '/child/login' : '/login'));
  if (['child', 'sibling'].includes(role)) {
    await page.getByLabel('家庭 ID').fill(actor.familyId); await page.getByLabel('孩子 ID').fill(actor.childId);
    await page.getByLabel('PIN').fill(actor.pin); await page.getByRole('button', { name: '进入我的成长空间' }).click();
    await expect(page).toHaveURL(/\/child\/today$/);
  } else {
    await page.getByLabel('用户名').fill(actor.username); await page.getByLabel('密码', { exact: true }).fill(actor.password);
    await page.getByRole('button', { name: '登录', exact: true }).click(); await expect(page).toHaveURL(/\/app\/today$/);
  }
}
async function openHelp(page, task) {
  await page.goto(runtime.webUrl + '/app/tasks?helpStatus=pending');
  await page.getByRole('button', { name: `求助 ${task.title}`, exact: true }).click();
  await expect(page.getByRole('button', { name: '标记已处理' })).toBeVisible();
}
const request = version => ({ action: 'request', expectedHelpVersion: version, helpType: 'stuck_midway', note: 'Synthetic fresh question' });

test('parent list denial after membership removal clears the open help dialog', async ({ page }, info) => {
  const task = await newTask(); expectData(await child.patch(path(task) + '/help', request(0)));
  await login(page, 'coparent'); await openHelp(page, task);
  let release, entered;
  const reached = new Promise(resolve => { entered = resolve; }), held = new Promise(resolve => { release = resolve; });
  await page.route(`**${path(task)}/help`, async route => {
    const response = await route.fetch({ maxRetries: 0 }); expect(response.status()).toBe(200);
    entered(); await held; await route.fulfill({ response });
  });
  try {
    await page.getByLabel('给孩子的回应（可不填）').fill('Synthetic private parent reply');
    await page.getByRole('button', { name: '标记已处理' }).click(); await reached;
    expect((await parent.delete(`/api/families/${fixture.familyId}/members/${fixture.actors.coparent.userId}`)).status).toBe(204);
    const denied = page.waitForResponse(response => response.request().method() === 'GET'
      && new URL(response.url()).pathname === '/api/growth-tasks' && response.status() === 403);
    const before = await runtime.inspect(); release();
    expect((await (await denied).json()).error.code).toBe('CHILD_ACCESS_DENIED');
    await expect(page.getByRole('region', { name: '任务求助' })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Synthetic fresh question', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Synthetic private parent reply', { exact: true })).toHaveCount(0);
    expect(await runtime.inspect()).toEqual(before);
    await page.screenshot({ path: info.outputPath('parent-list-denied.png'), fullPage: true });
  } finally { release(); }
});

for (const kind of ['read', 'write']) test(`parent list denial isolates a held successful help ${kind}`, async ({ page }, info) => {
  const task = await newTask(); expectData(await child.patch(path(task) + '/help', request(0)));
  await login(page, 'coparent'); await openHelp(page, task);
  let releaseList, listEntered, releaseHelp, helpEntered, delivered;
  const listReached = new Promise(resolve => { listEntered = resolve; });
  const listHeld = new Promise(resolve => { releaseList = resolve; });
  const helpReached = new Promise(resolve => { helpEntered = resolve; });
  const helpHeld = new Promise(resolve => { releaseHelp = resolve; });
  const helpDelivered = new Promise(resolve => { delivered = resolve; });
  await page.route('**/api/growth-tasks?*', async route => {
    listEntered(); await listHeld; await route.continue();
  });
  try {
    await page.getByLabel('给孩子的回应（可不填）').fill('Synthetic original parent reply');
    await page.getByRole('button', { name: '标记已处理' }).click(); await listReached;
    await expect(page.getByText('Synthetic original parent reply')).toBeVisible();
    // The list reload is outstanding while the still-authorized parent starts the next help command.
    await page.route(`**${path(task)}/help`, async route => {
      const response = await route.fetch({ maxRetries: 0 }); expect(response.status()).toBe(200);
      if (kind === 'read') return route.abort('failed');
      helpEntered(); await helpHeld;
      try { await route.fulfill({ response }); } catch { /* The revoked view cancels its request. */ }
      finally { delivered(); }
    });
    if (kind === 'read') await page.route(`**${path(task)}`, async route => {
      const response = await route.fetch({ maxRetries: 0 }); expect(response.status()).toBe(200);
      helpEntered(); await helpHeld;
      try { await route.fulfill({ response }); } catch { /* The revoked view cancels its request. */ }
      finally { delivered(); }
    });
    await page.getByRole('button', { name: '代孩子求助' }).click();
    await page.getByLabel('补充说明（可不填）').fill('Synthetic late parent help');
    await page.getByRole('button', { name: '发送求助' }).click();
    if (kind === 'read') {
      await expect(page.getByRole('button', { name: '读取最新求助' })).toBeEnabled();
      await page.getByRole('button', { name: '读取最新求助' }).click();
    }
    await helpReached;
    expect((await parent.delete(`/api/families/${fixture.familyId}/members/${fixture.actors.coparent.userId}`)).status).toBe(204);
    const denied = page.waitForResponse(response => new URL(response.url()).pathname === '/api/growth-tasks' && response.status() === 403);
    const before = await runtime.inspect(); releaseList();
    expect((await (await denied).json()).error.code).toBe('CHILD_ACCESS_DENIED');
    await expect(page.getByRole('region', { name: '任务求助' })).toHaveCount(0);
    releaseHelp(); await helpDelivered;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.getByText('Synthetic late parent help', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Synthetic original parent reply', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await runtime.inspect()).toEqual(before);
    await page.screenshot({ path: info.outputPath(`parent-denied-late-${kind}.png`), fullPage: true });
  } finally { releaseList(); releaseHelp(); }
});

test('a write superseding the slow initial help read can retry its committed lost response exactly', async ({ page }, info) => {
  const task = await newTask(); await login(page);
  let releaseRead, entered, delivered, captured = false;
  const reached = new Promise(resolve => { entered = resolve; }), held = new Promise(resolve => { releaseRead = resolve; });
  const readDelivered = new Promise(resolve => { delivered = resolve; });
  await page.route(`**${path(task)}`, async route => {
    if (captured) return route.continue(); captured = true;
    const response = await route.fetch({ maxRetries: 0 }); expect(response.status()).toBe(200);
    entered(); await held;
    try { await route.fulfill({ response }); } catch { /* Write ownership cancels the old read. */ }
    finally { delivered(); }
  });
  try {
    await page.goto(runtime.webUrl + `/child/tasks/${task.taskId}`); await reached;
    await expect(page.getByRole('heading', { name: task.title, exact: true })).toBeVisible();
    await page.getByRole('button', { name: '我需要帮助', exact: true }).click();
    await page.getByLabel('补充说明（可不填）').fill('Synthetic exact original help');
    const bodies = [];
    await page.route(`**${path(task)}/help`, async route => {
      bodies.push(route.request().postDataJSON());
      const response = await route.fetch({ maxRetries: 0 }); expect(response.status()).toBe(200);
      expect((await response.json()).data.task.helpVersion).toBe(1);
      if (bodies.length === 1) await route.abort('failed');
      else await route.fulfill({ response });
    });
    const baseline = await runtime.inspect();
    await page.getByRole('button', { name: '发送求助' }).click();
    await expect(page.getByText(/结果尚未确认/)).toBeVisible();
    const committed = await runtime.inspect(), stored = committed.database.Task.find(row => row._id === task.taskId);
    expect(stored.helpVersion).toBe(1); expect(stored.status).toBe('pending');
    const withoutHelp = snapshot => ({ ...snapshot, database: { ...snapshot.database, Task: snapshot.database.Task.map(row => {
      const { helpVersion, helpRequest, updatedAt, __v, ...rest } = row; return rest;
    }) } });
    expect(withoutHelp(committed)).toEqual(withoutHelp(baseline));
    await expect(page.getByRole('button', { name: '重试原求助操作' })).toBeEnabled();
    await expect(page.getByRole('button', { name: '读取最新求助' })).toBeEnabled();
    releaseRead(); await readDelivered;
    await page.getByRole('button', { name: '重试原求助操作' }).click();
    await expect(page.getByText('求助已发送。')).toBeVisible();
    expect(bodies).toEqual([bodies[0], bodies[0]]);
    expect(bodies[0]).toEqual({ action: 'request', expectedHelpVersion: 0, helpType: 'instruction_unclear', note: 'Synthetic exact original help' });
    expect(await runtime.inspect()).toEqual(committed);
    await expect(page.getByText('正在读取求助…')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('slow-read-original-retry.png'), fullPage: true });
  } finally { releaseRead(); }
});

for (const kind of ['read', 'write']) test(`detail refresh denied after authorization loss ignores a held successful help ${kind}`, async ({ page }, info) => {
  const task = await newTask(); expectData(await child.patch(path(task) + '/help', request(0)));
  await login(page); await page.goto(runtime.webUrl + `/child/tasks/${task.taskId}`);
  await expect(page.getByText('Synthetic fresh question')).toBeVisible();
  let release, entered, finished, captured = false;
  const reached = new Promise(resolve => { entered = resolve; }), held = new Promise(resolve => { release = resolve; });
  const delivered = new Promise(resolve => { finished = resolve; });
  const target = path(task) + (kind === 'write' ? '/help' : '');
  await page.route(`**${target}`, async route => {
    if (captured) return route.continue();
    captured = true;
    const response = await route.fetch(); expect(response.status()).toBe(200);
    entered(); await held;
    try { await route.fulfill({ response }); } catch { /* Revocation aborts the previous help request. */ }
    finally { finished(); }
  });
  try {
    if (kind === 'read') runtime.dropNextResponse({ method: 'PATCH', path: path(task) + '/help' });
    await page.getByRole('button', { name: '更新求助', exact: true }).click();
    await page.getByLabel('补充说明（可不填）').fill('Synthetic private late help');
    await page.getByRole('button', { name: '发送求助' }).click();
    if (kind === 'read') {
      await expect(page.getByRole('button', { name: '读取最新求助' })).toBeEnabled();
      await page.getByRole('button', { name: '读取最新求助' }).click();
    }
    await reached;
    const Family = require('../../../backend/common/models/Family');
    expect(Family.db.name).toBe('t2_synthetic');
    await Family.updateOne({ _id: fixture.familyId }, { $pull: { childIds: fixture.actors.child.childId } });
    const denied = page.waitForResponse(response => response.request().method() === 'GET'
      && response.url().endsWith(path(task)) && response.status() === 403);
    await page.getByRole('button', { name: '刷新详情', exact: true }).click();
    expect((await (await denied).json()).error.code).toBe('CHILD_ACCESS_DENIED');
    await expect(page.getByRole('region', { name: '任务求助' })).toHaveCount(0);
    const afterDenial = await runtime.inspect();
    release();
    await delivered;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.getByText('Synthetic fresh question', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Synthetic private late help', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '重试原求助操作' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '刷新详情', exact: true })).toBeDisabled();
    expect(await runtime.inspect()).toEqual(afterDenial);
    await page.screenshot({ path: info.outputPath(`help-denied-late-${kind}.png`), fullPage: true });
  } finally { release(); }
});

test('real child request, parent discovery/response and child reread/re-request; responsive layouts', async ({ page, browser }, info) => {
  const task = await newTask(), before = await runtime.inspect(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Finish Today initialization before the harness unloads its document.
  const todayReady = Promise.all([
    '/api/growth-tasks?scope=today&pageSize=100',
    `/api/notifications/family?childId=${fixture.actors.child.childId}`
  ].map(endpoint => page.waitForResponse(response =>
    response.url() === runtime.webUrl + endpoint && response.request().method() === 'GET'
  ).then(async response => {
    expect(response.status()).toBe(200);
    expect(await response.finished()).toBeNull();
  })));
  await Promise.all([login(page), todayReady]);
  await page.goto(runtime.webUrl + `/child/tasks/${task.taskId}`);
  await page.getByRole('button', { name: '我需要帮助', exact: true }).click();
  await page.getByLabel('哪里需要帮助').selectOption('cannot_start');
  await page.getByLabel('补充说明（可不填）').fill('不知道先做什么');
  await page.getByRole('button', { name: '发送求助' }).click(); await expect(page.getByText('等待家长帮助')).toBeVisible();
  await page.reload(); await expect(page.getByText('不知道先做什么')).toBeVisible();
  const parentContext = await browser.newContext(), parentPage = await parentContext.newPage();
  try {
    await login(parentPage, 'parent'); await parentPage.getByRole('link', { name: '待处理求助', exact: true }).click();
    await parentPage.getByRole('button', { name: `求助 ${task.title}`, exact: true }).click();
    await expect(parentPage.getByText('不知道先做什么')).toBeVisible();
    await parentPage.getByLabel('给孩子的回应（可不填）').fill('先看题目第一句话');
    await parentPage.getByRole('button', { name: '标记已处理' }).click(); await expect(parentPage.getByText('先看题目第一句话')).toBeVisible();
    await page.getByRole('button', { name: '刷新详情', exact: true }).click();
    await expect(page.getByText('先看题目第一句话')).toBeVisible();
    await page.reload(); await expect(page.getByText('先看题目第一句话')).toBeVisible();
    for (const [width, height] of [[768, 1024], [1024, 768], [390, 844], [1280, 800]]) {
      for (const [name, target] of [['child', page], ['parent', parentPage]]) {
        await target.setViewportSize({ width, height });
        await target.getByText('先看题目第一句话', { exact: true }).scrollIntoViewIfNeeded();
        await expect(target.getByText('先看题目第一句话', { exact: true })).toBeInViewport();
        expect(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await target.screenshot({ path: info.outputPath(`${name}-help-${width}x${height}.png`), fullPage: true });
      }
    }
    const after = await runtime.inspect(), stored = after.database.Task.find(row => row._id === task.taskId);
    expect(stored).toMatchObject({ status: 'pending', helpVersion: 2, helpRequest: { status: 'resolved',
      requestedByActor: { id: fixture.actors.child.userId, role: 'student' }, resolvedByActor: { id: fixture.actors.parent.userId, role: 'parent' } } });
    expect(after.database.Ledger).toEqual(before.database.Ledger); expect(after.database.Operation).toEqual(before.database.Operation);
    expect(after.database.Reference).toEqual(before.database.Reference); expect(after.files).toEqual(before.files);
    await page.getByRole('button', { name: '再次求助' }).click(); await page.getByRole('button', { name: '发送求助' }).click();
    await expect(page.getByText('等待家长帮助')).toBeVisible(); expect(errors).toEqual([]);
  } finally { await parentContext.close(); }
});

test('lost request response preserves command, and stale parent resolve reads new help without auto-processing', async ({ page, browser }) => {
  const task = await newTask(); await login(page); await page.goto(runtime.webUrl + `/child/tasks/${task.taskId}`);
  await page.getByRole('button', { name: '我需要帮助', exact: true }).click();
  const sent = []; page.on('request', req => { if (req.method() === 'PATCH' && req.url().endsWith('/help')) sent.push(req.postDataJSON()); });
  runtime.dropNextResponse({ method: 'PATCH', path: path(task) + '/help' });
  await page.getByRole('button', { name: '发送求助' }).click();
  await expect(page.getByRole('button', { name: '重试原求助操作' })).toBeVisible();
  await expect(page.getByRole('button', { name: '重试原求助操作' })).toBeEnabled();
  expect(runtime.droppedResponses).toEqual([{ service: 'api-gateway', method: 'PATCH', path: path(task) + '/help', status: 200 }]);
  const committed = await runtime.inspect();
  expect(committed.database.Task.find(row => row._id === task.taskId).helpVersion).toBe(1);
  await page.getByRole('button', { name: '重试原求助操作' }).click();
  await expect(page.getByText('等待家长帮助')).toBeVisible(); expect(sent).toHaveLength(2); expect(sent[1]).toEqual(sent[0]);
  expect(await runtime.inspect()).toEqual(committed);
  await login(page, 'parent'); await openHelp(page, task);
  await page.getByLabel('给孩子的回应（可不填）').fill('旧回应');
  const childContext = await browser.newContext();
  try {
    const childPage = await childContext.newPage(); await login(childPage);
    await childPage.goto(runtime.webUrl + `/child/tasks/${task.taskId}`);
    await childPage.getByRole('button', { name: '更新求助', exact: true }).click();
    await childPage.getByLabel('哪里需要帮助').selectOption('stuck_midway');
    await childPage.getByLabel('补充说明（可不填）').fill('Synthetic fresh question');
    await childPage.getByRole('button', { name: '发送求助' }).click();
    await expect(childPage.getByText('Synthetic fresh question')).toBeVisible();
    await expect(childPage.getByRole('button', { name: '重试原求助操作' })).toHaveCount(0);
  } finally { await childContext.close(); }
  await page.getByRole('button', { name: '标记已处理' }).click();
  await expect(page.getByText('Synthetic fresh question')).toBeVisible(); await expect(page.getByText(/状态已变化/)).toBeVisible();
  await expect(page.getByLabel('给孩子的回应（可不填）')).toHaveValue('');
  const stored = (await runtime.inspect()).database.Task.find(row => row._id === task.taskId);
  expect(stored.helpVersion).toBe(2); expect(stored.helpRequest.status).toBe('pending');
  expect(sent.filter(command => command.action === 'resolve')).toHaveLength(1);
});

test('cross-tab sibling login hides old help and a delayed read cannot refill it', async ({ page, context }) => {
  const task = await newTask(); expectData(await child.patch(path(task) + '/help', request(0)));
  await login(page); await page.goto(runtime.webUrl + `/child/tasks/${task.taskId}`);
  await expect(page.getByText('Synthetic fresh question')).toBeVisible();
  let release, entered; const reached = new Promise(resolve => { entered = resolve; }), held = new Promise(resolve => { release = resolve; });
  await page.route(`**${path(task)}`, async route => { const response = await route.fetch(); entered(); await held;
    try { await route.fulfill({ response }); } catch { /* Old document was removed on logout. */ } });
  const reload = page.reload(); await reached;
  const other = await context.newPage();
  try {
    await other.goto(runtime.webUrl + '/child/me'); await other.getByRole('button', { name: '退出孩子端' }).click();
    await login(other, 'sibling'); release(); await reload;
    await expect(page.getByText('Synthetic fresh question')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '发送求助' })).toHaveCount(0);
  } finally { release(); await other.close(); }
});

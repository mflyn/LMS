const { test, expect } = require('@playwright/test');
const { randomUUID } = require('crypto');
const { createT2WebRuntime } = require('./webRuntime');
const { openParentTasks, finishParentNavigationTest } = require('./parentNavigation');
const { openParentChildren, openChildTask } = require('./businessNavigation');

async function login(page, runtime, role) {
  const actor = runtime.fixture.actors[role];
  await page.goto(runtime.webUrl + (role === 'parent' ? '/login' :
    `/child/login#familyId=${actor.familyId}&childId=${actor.childId}`));
  if (role === 'parent') {
    await page.getByLabel('用户名').fill(actor.username);
    await page.getByLabel('密码', { exact: true }).fill(actor.password);
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/today$/);
  } else {
    await page.getByLabel('PIN', { exact: true }).fill(actor.pin);
    await page.getByRole('button', { name: '进入我的成长空间', exact: true }).click();
    await expect(page).toHaveURL(/\/child\/today$/);
  }
}
function observe(page) {
  const errors = [], events = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) errors.push(message.text());
  });
  page.on('request', request => events.push({ event: 'request', path: new URL(request.url()).pathname,
    document: request.isNavigationRequest() }));
  page.on('requestfailed', request => events.push({ event: 'failed', path: new URL(request.url()).pathname,
    error: request.failure()?.errorText }));
  page.on('response', response => events.push({ event: 'response', path: new URL(response.url()).pathname,
    status: response.status() }));
  return { errors, events };
}

for (const method of ['Escape', 'close']) test(`help update and ${method} returns focus after real list replacement`, async ({ page }, info) => {
  const runtime = await createT2WebRuntime(), evidence = observe(page);
  const task = runtime.fixture.tasks.child;
  try {
    const child = await runtime.login('child');
    expect((await child.patch(`/api/growth-tasks/${task.taskId}/help`, {
      action: 'request', expectedHelpVersion: 0, helpType: 'cannot_start', note: 'Synthetic focus request'
    })).status).toBe(200);
    await login(page, runtime, 'parent'); await openParentTasks(page, runtime.webUrl);
    const trigger = page.getByRole('button', { name: `求助 ${task.title}`, exact: true });
    await trigger.click();
    await expect(page.getByText('Synthetic focus request', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    const original = await trigger.elementHandle();
    await trigger.click();
    const update = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().endsWith('/help'));
    const reread = page.waitForResponse(r => r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/growth-tasks');
    await page.getByLabel('给孩子的回应（可不填）').fill('Synthetic focus response');
    await page.getByRole('button', { name: '标记已处理', exact: true }).click();
    expect((await update).status()).toBe(200); expect((await reread).status()).toBe(200);
    await expect(page.getByText('Synthetic focus response', { exact: true })).toBeVisible();
    await expect.poll(() => original.evaluate(node => node.isConnected)).toBe(false);
    if (method === 'Escape') await page.keyboard.press('Escape');
    else await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
    await expect(trigger).toBeFocused();
    expect(evidence.errors).toEqual([]);
    await page.screenshot({ path: info.outputPath(`help-focus-${method}.png`) });
  } finally { await finishParentNavigationTest({ page, info, runtime, evidence }); }
});

test('child mistake native select and every form control meet the original 44px touch target', async ({ page }, info) => {
  const runtime = await createT2WebRuntime(), evidence = observe(page);
  try {
    await page.setViewportSize({ width: 360, height: 800 });
    await login(page, runtime, 'child');
    await page.getByRole('navigation', { name: '孩子导航' }).getByRole('link', { name: '错题', exact: true }).click();
    await page.getByRole('button', { name: '记录新错题', exact: true }).click();
    const select = page.getByRole('combobox', { name: /错因/ });
    await select.selectOption('calculation');
    await expect(select).toHaveValue('calculation');
    const controls = await page.locator('.child-form input, .child-form select, .child-form textarea, .child-form button')
      .evaluateAll(nodes => nodes.map(node => ({ tag: node.tagName, height: node.getBoundingClientRect().height,
        minHeight: getComputedStyle(node).minHeight })));
    evidence.controls = controls;
    expect(controls.some(c => c.tag === 'SELECT')).toBe(true);
    for (const control of controls) expect(control.height, JSON.stringify(control)).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(evidence.errors).toEqual([]);
    await page.screenshot({ path: info.outputPath('mistake-touch.png') });
  } finally { await finishParentNavigationTest({ page, info, runtime, evidence }); }
});

for (const role of ['parent', 'child']) for (const phase of ['pending', 'completed']) {
  test(`${role} business navigation preserves document with ${phase} real plan response`, async ({ page }, info) => {
    const runtime = await createT2WebRuntime(), evidence = observe(page);
    let release, ready, failure;
    const held = new Promise(resolve => { release = resolve; });
    const entered = new Promise(resolve => { ready = resolve; });
    try {
      await login(page, runtime, role);
      const refresh = page.getByRole('button', { name: '读取最新计划', exact: true });
      await expect(refresh).toBeEnabled();
      const before = await runtime.inspect(), identity = randomUUID();
      await page.evaluate(value => { window.functionalDocumentIdentity = value; }, identity);
      await page.route('**/api/children/*/daily-learning-plans/*', async route => {
        let response;
        try {
          response = await route.fetch({ maxRetries: 0 });
          expect(response.status()).toBe(200);
          expect((await response.json()).data.plan.childId).toBe(runtime.fixture.actors.child.childId);
          evidence.events.push({ event: 'held-real-response', status: response.status() });
          ready(); await held; await route.fulfill({ response });
        } catch (error) { failure = error; ready(); }
        finally { await response?.dispose(); }
      });
      await refresh.click(); await entered; if (failure) throw failure;
      if (phase === 'completed') {
        release(); await expect(page.getByText('已读取服务器计划，采用后将替换当前草稿。')).toBeVisible();
      } else await expect(page.getByText('正在读取计划…', { exact: true })).toBeVisible();
      const documents = evidence.events.filter(e => e.document).length;
      evidence.events.push({ event: 'navigation-start', role, phase });
      if (role === 'parent') await openParentChildren(page, runtime.webUrl);
      else await openChildTask(page, runtime.webUrl, runtime.fixture.tasks.child.taskId);
      expect(await page.evaluate(() => window.functionalDocumentIdentity)).toBe(identity);
      expect(evidence.events.filter(e => e.document)).toHaveLength(documents);
      release(); await page.unrouteAll({ behavior: 'wait' }); if (failure) throw failure;
      await expect(page.getByRole('region', { name: '今日计划', exact: true })).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole('heading', { name: role === 'parent' ? '孩子档案' : runtime.fixture.tasks.child.title, exact: true })).toBeVisible();
      expect(await page.evaluate(() => window.functionalDocumentIdentity)).toBeUndefined();
      expect(await runtime.inspect()).toEqual(before);
      expect(evidence.errors).toEqual([]);
    } finally {
      release();
      await finishParentNavigationTest({ page, info, runtime, evidence });
    }
  });
}

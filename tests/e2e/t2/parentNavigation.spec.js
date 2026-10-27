const { test, expect } = require('@playwright/test');
const { randomUUID } = require('crypto');
const { createT2WebRuntime } = require('./webRuntime');
const { openParentTasks, finishParentNavigationTest } = require('./parentNavigation');

for (const phase of ['pending', 'completed']) {
  test(`parent task navigation with a real ${phase} plan response preserves the SPA and supports reload`, async ({ page }, info) => {
    const runtime = await createT2WebRuntime();
    const errors = [], events = [];
    let release;
    const held = new Promise(resolve => { release = resolve; });
    page.on('pageerror', error => errors.push({ type: 'pageerror', message: error.message }));
    page.on('console', message => {
      if (['warning', 'error'].includes(message.type())) errors.push({ type: message.type(), message: message.text() });
    });
    page.on('request', request => {
      if (request.isNavigationRequest() || request.url().includes('/daily-learning-plans/')) {
        events.push({ type: 'request', path: new URL(request.url()).pathname, document: request.isNavigationRequest() });
      }
    });
    page.on('requestfailed', request => events.push({ type: 'failed', path: new URL(request.url()).pathname,
      error: request.failure()?.errorText }));
    try {
      const actor = runtime.fixture.actors.parent;
      await page.goto(runtime.webUrl + '/login');
      await page.getByLabel('用户名').fill(actor.username);
      await page.getByLabel('密码', { exact: true }).fill(actor.password);
      await page.getByRole('button', { name: '登录', exact: true }).click();
      const refresh = page.getByRole('button', { name: '读取最新计划', exact: true });
      await expect(refresh).toBeEnabled();
      const before = await runtime.inspect(), identity = randomUUID();
      await page.evaluate(value => { window.t5NavigationIdentity = value; }, identity);
      let ready;
      const responseReady = new Promise(resolve => { ready = resolve; });
      const pattern = '**/api/children/*/daily-learning-plans/*';
      await page.route(pattern, async route => {
        const response = await route.fetch({ maxRetries: 0 });
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.data.plan.childId).toBe(runtime.fixture.actors.child.childId);
        events.push({ type: 'real-plan-response', status: response.status(), phase });
        ready();
        await held;
        await route.fulfill({ response });
      });
      await refresh.click();
      await responseReady;
      if (phase === 'completed') {
        release();
        await expect(page.getByText('已读取服务器计划，采用后将替换当前草稿。')).toBeVisible();
      } else await expect(page.getByText('正在读取计划…', { exact: true })).toBeVisible();
      const documentRequests = events.filter(event => event.document).length;
      await openParentTasks(page, runtime.webUrl);
      await expect(page.getByRole('button', { name: '新建任务', exact: true })).toBeVisible();
      expect(await page.evaluate(() => window.t5NavigationIdentity)).toBe(identity);
      expect(events.filter(event => event.document)).toHaveLength(documentRequests);
      release();
      await page.unrouteAll({ behavior: 'wait' });
      await expect(page.getByRole('region', { name: '今日计划', exact: true })).toHaveCount(0);
      await page.getByRole('navigation', { name: '家长导航' }).getByRole('link', { name: '今日', exact: true }).click();
      await expect(refresh).toBeEnabled();
      await expect(page.getByText('今日计划暂无任务。', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => window.t5NavigationIdentity)).toBe(identity);
      await page.reload();
      await expect(refresh).toBeEnabled();
      await expect(page.getByText('今日计划暂无任务。', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => window.t5NavigationIdentity)).toBeUndefined();
      expect(await runtime.inspect()).toEqual(before);
      expect(errors).toEqual([]);
    } finally {
      release();
      await finishParentNavigationTest({ page, info, runtime, evidence: { phase, events, errors } });
    }
  });
}

for (const failures of [['unroute'], ['attach'], ['unroute', 'attach', 'stop']]) {
  test(`navigation cleanup attempts every step and preserves ${failures.join('+')} failures`, async () => {
    const calls = [], reasons = failures.map(name => new Error(`Synthetic ${name} failure`));
    const step = name => async () => {
      calls.push(name);
      if (failures.includes(name)) throw reasons[failures.indexOf(name)];
    };
    const result = await finishParentNavigationTest({
      page: { unrouteAll: step('unroute') }, info: { attach: step('attach') },
      runtime: { stop: step('stop') }, evidence: {}
    }).then(() => null, error => error);
    expect(calls).toEqual(['unroute', 'attach', 'stop']);
    expect(result).toBeInstanceOf(AggregateError);
    expect(result.errors).toEqual(reasons);
  });
}

test('navigation cleanup awaits runtime shutdown before reporting success', async () => {
  let release, entered, settled = false;
  const held = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const cleanup = finishParentNavigationTest({ page: { unrouteAll: async () => {} },
    info: { attach: async () => {} }, evidence: {},
    runtime: { stop: async () => { entered(); await held; } }
  }).then(() => { settled = true; });
  try {
    await started;
    await Promise.resolve();
    expect(settled).toBe(false);
  } finally { release(); await cleanup; }
  expect(settled).toBe(true);
});

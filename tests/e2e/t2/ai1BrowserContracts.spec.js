const { test, expect } = require('@playwright/test');
const { createT2WebRuntime } = require('./webRuntime');
const { finishParentNavigationTest } = require('./parentNavigation');
const { openTutorSource, assertFailureRecord, assertRequestFailure, assertFaultConsole } = require('./ai1BrowserContracts');

for (const browserName of ['chromium', 'webkit']) {
  test(`AI1 ${browserName} precise failure contracts reject wrong identity and non-cancellation`, () => {
    const url = 'http://127.0.0.1:12345/api/tutor-cycles/111111111111111111111111';
    const options = { browserName, kind: 'cancelled', method: 'GET', url };
    const record = { url, method: 'GET', response: null, errorText: browserName === 'webkit' ? 'cancelled' : 'net::ERR_ABORTED' };
    expect(() => assertFailureRecord(record, options)).not.toThrow();
    for (const override of [{ url: url + '?other=1' }, { method: 'POST' }, { response: { status: 200 } },
      { errorText: browserName === 'webkit' ? 'Blocked by Web Inspector' : 'net::ERR_FAILED' },
      { errorText: 'unexpected cancellation or permission failure' }, { errorText: null }]) {
      expect(() => assertFailureRecord({ ...record, ...override }, options)).toThrow();
    }
    expect(() => assertFailureRecord(record, { ...options, browserName: 'unknown' })).toThrow();
    expect(() => assertFailureRecord(record, { ...options, kind: 'unknown' })).toThrow();
  });

  test(`AI1 ${browserName} injected and dropped contracts reject unrelated console messages`, () => {
    const url = 'http://127.0.0.1:12345/api/tutor-cycles/111111111111111111111111';
    const cases = browserName === 'webkit' ? [
      { kind: 'injected', text: 'Blocked by Web Inspector', event: { level: 'info', text: `Web Inspector blocked ${url} from loading`, url: '' } },
      { kind: 'dropped', text: 'The network connection was lost.', event: { level: 'error', text: 'Failed to load resource: The network connection was lost.', url } }
    ] : [
      { kind: 'injected', text: 'net::ERR_FAILED', event: { level: 'error', text: 'Failed to load resource: net::ERR_FAILED', url } },
      ...['ERR_EMPTY_RESPONSE', 'ERR_CONNECTION_RESET'].map(code => ({ kind: 'dropped', text: `net::${code}`,
        event: { level: 'error', text: `Failed to load resource: net::${code}`, url } }))
    ];
    for (const { kind, text, event } of cases) {
      const options = { browserName, kind, url, method: 'POST' };
      expect(() => assertFailureRecord({ url, method: 'POST', response: null, errorText: text }, options)).not.toThrow();
      expect(() => assertFailureRecord({ url, method: 'POST', response: null, errorText: 'Permission denied' }, options)).toThrow();
      expect(() => assertFaultConsole([event], options)).not.toThrow();
      for (const invalid of [[], [event, event], [{ ...event, level: 'warning' }], [{ ...event, url: url + '/other' }],
        [{ ...event, text: event.text + ' unexpected' }], [{ ...event, text: 'Access control checks' }]]) {
        expect(() => assertFaultConsole(invalid, options)).toThrow();
      }
    }
  });
}

for (const entry of ['tasks', 'mistakes']) for (const phase of ['pending', 'completed']) {
  test(`AI1 ${entry} entry during ${phase} real plan read keeps document and data`, async ({ page, browserName }, info) => {
    const runtime = await createT2WebRuntime(), errors = [], events = [], handlers = [], faults = [], heldRows = [];
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const failures = [];
    try {
      page.on('pageerror', e => errors.push({ type: 'pageerror', text: e.message }));
      page.on('console', m => { if (['warning', 'error'].includes(m.type())) errors.push({ type: m.type(), text: m.text() }); });
      page.on('request', r => events.push({ type: 'request', path: new URL(r.url()).pathname, document: r.isNavigationRequest() }));
      page.on('requestfailed', r => events.push({ type: 'failed', path: new URL(r.url()).pathname, text: r.failure()?.errorText }));
      for (const { name, server } of runtime.servers) server.prependListener('request', req => {
        if (req.url.includes('/daily-learning-plans/')) events.push({ type: 'ingress', name, path: req.url });
      });
      await page.route('**/*', route => {
        if (new URL(route.request().url()).origin === runtime.webUrl) return route.continue();
        faults.push(new Error('Non-local request')); return route.abort();
      });
      await page.goto(runtime.webUrl + '/login');
      await page.getByLabel('用户名').fill(runtime.fixture.actors.parent.username);
      await page.getByLabel('密码', { exact: true }).fill(runtime.fixture.actors.parent.password);
      await page.getByRole('button', { name: '登录', exact: true }).click();
      const refresh = page.getByRole('button', { name: '读取最新计划', exact: true });
      await expect(refresh).toBeEnabled();
      const before = await runtime.snapshot();
      await page.evaluate(() => { window.ai1PendingMarker = 'same-document'; });
      await page.route('**/api/children/*/daily-learning-plans/*', route => {
        const handler = (async () => {
          const response = await route.fetch({ maxRetries: 0 });
          expect(response.status()).toBe(200);
          expect((await response.json()).data.plan.childId).toBe(runtime.fixture.actors.child.childId);
          heldRows.push({ request: route.request(), response });
          events.push({ type: 'real200-held', path: new URL(route.request().url()).pathname });
          await held; await route.fulfill({ response });
        })().catch(error => { faults.push(error); });
        handlers.push(handler); return handler;
      });
      await refresh.click(); await expect.poll(() => heldRows.length).toBe(1);
      if (phase === 'completed') {
        release(); await Promise.all(handlers);
        await expect(page.getByText('已读取服务器计划，采用后将替换当前草稿。')).toBeVisible();
        expect(heldRows[0].request.failure()).toBeNull();
        expect((await heldRows[0].request.response()).status()).toBe(200);
      } else await expect(page.getByText('正在读取计划…', { exact: true })).toBeVisible();
      const documents = events.filter(e => e.document).length;
      await openTutorSource(page, runtime.webUrl, entry);
      if (phase === 'pending') {
        await expect.poll(() => heldRows[0].request.failure()).not.toBeNull();
        await assertRequestFailure(heldRows[0].request, { browserName, kind: 'cancelled',
          url: heldRows[0].request.url(), method: 'GET' });
      }
      expect(await page.evaluate(() => window.ai1PendingMarker)).toBe('same-document');
      expect(events.filter(e => e.document)).toHaveLength(documents);
      release(); await Promise.all(handlers); await page.unrouteAll({ behavior: 'wait' });
      await expect(page.getByRole('region', { name: '今日计划', exact: true })).toHaveCount(0);
      expect(events.some(e => e.type === 'ingress' && e.name === 'homework-service')).toBe(true);
      await page.getByRole('navigation', { name: '家长导航', exact: true }).getByRole('link', { name: '今日', exact: true }).click();
      await expect(refresh).toBeEnabled();
      await expect(page.getByText('今日计划暂无任务。', { exact: true })).toBeVisible();
      expect(await runtime.snapshot()).toEqual(before); expect(errors).toEqual([]); expect(faults).toEqual([]);
    } catch (error) {
      failures.push(error);
    } finally {
      release();
      try { await Promise.all(handlers); } catch (error) { failures.push(error); }
      try {
        await finishParentNavigationTest({ page, info, runtime, evidence: { entry, phase, events, errors, faults: faults.map(String) } });
      } catch (error) { failures.push(error); }
      try { expect(faults).toEqual([]); } catch (error) { failures.push(error); }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, 'AI1 navigation and cleanup failed');
  });
}

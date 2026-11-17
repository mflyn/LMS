const { test, expect } = require('@playwright/test');
const { createT2WebRuntime } = require('./webRuntime');

let runtime;
test.beforeEach(async () => { runtime = await createT2WebRuntime(); });
test.afterEach(async () => { await runtime?.stop(); });

test('parent login classifies legacy and current errors without retry; explicit real login still works', async ({ page }, info) => {
  const errors = [], consoleErrors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) consoleErrors.push(message.text());
  });
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/auth/login') requests.push(request.method());
  });
  const cases = [
    { status: 429, contentType: 'text/html', body: '请求过于频繁，请稍后再试', message: '请求过于频繁，请稍后再试' },
    { status: 429, contentType: 'application/json', body: JSON.stringify({ success: false,
      error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' } }), message: '请求过于频繁，请稍后再试' },
    { status: 429, contentType: 'text/plain', body: '', message: '请求过于频繁，请稍后再试' },
    { status: 401, contentType: 'application/json', body: '{}', message: '登录失败，请检查账号和密码' },
    { status: 503, contentType: 'text/html', body: '<html>synthetic unavailable</html>', message: '登录服务暂时不可用，请稍后再试' }
  ];
  let index = 0;
  await page.route('**/api/auth/login', async route => {
    if (index >= cases.length) return route.continue();
    const { status, contentType, body } = cases[index++];
    await route.fulfill({ status, contentType, body });
  });
  const actor = runtime.fixture.actors.parent;
  await page.goto(runtime.webUrl + '/login');
  await page.evaluate(() => localStorage.setItem('synthetic-original-command', 'unchanged'));
  await page.getByLabel('用户名').fill(actor.username);
  await page.getByLabel('密码', { exact: true }).fill(actor.password);
  for (let i = 0; i < cases.length; i++) {
    const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/login');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    expect((await response).status()).toBe(cases[i].status);
    await expect(page.getByRole('alert')).toHaveText(cases[i].message);
    await expect(page.getByRole('button', { name: '登录', exact: true })).toBeEnabled();
    expect(requests).toHaveLength(i + 1);
    expect(await page.evaluate(() => localStorage.getItem('family-growth.parent-session.v1'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('synthetic-original-command'))).toBe('unchanged');
  }
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/today$/);
  await expect(page.getByRole('navigation', { name: '家长导航' })).toBeVisible();
  expect(requests).toEqual(Array(6).fill('POST'));
  expect(errors).toEqual([]);
  // One native console failure per deliberately rejected HTTP response, no other warning/error.
  expect(consoleErrors).toHaveLength(cases.length);
  for (let i = 0; i < cases.length; i++) expect(consoleErrors[i]).toContain(String(cases[i].status));
  await info.attach('login-error-contract', { body: JSON.stringify({
    injectedStatuses: cases.map(row => row.status), realLoginSucceeded: true,
    postCount: requests.length, errors, consoleErrors
  }), contentType: 'application/json' });
});

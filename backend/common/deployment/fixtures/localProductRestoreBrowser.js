// Opt-in browser acceptance against an already restored synthetic database.
const fs = require('fs');
const path = require('path');
const { chromium, webkit, expect: baseExpect } = require('@playwright/test');
const { openParentTasks } = require('../../../../tests/e2e/t2/parentNavigation');
const expect = baseExpect.configure({ timeout: 10000 });

async function runRestoredBrowser({ onBrowser, webUrl, actors, password, pin, taskId, title, operationId, imageDigest, outputRoot, snapshot, check }) {
  const engineName = process.env.T8_BROWSER_ENGINE || 'chromium';
  const engine = { chromium, webkit }[engineName];
  if (!engine || !fs.existsSync(engine.executablePath())) throw Error('Existing supported browser required; no downloads');
  const observations = { engine: engineName, deviceVerified: false, stages: [], pageErrors: [], requestFailures: [], console: [], failedHttp: [], screenshots: [] };
  const allowedErrors = new Set([`409 /api/growth-tasks/${taskId}/confirm`, `403 /api/growth-tasks/${taskId}`,
    `403 /api/growth-tasks/${taskId}/completion-recovery`]);
  const monitored = [], contexts = [];
  let browser, release, heldPage;
  const pathname = url => { try { return new URL(url).pathname; } catch { return ''; } };
  const observe = page => {
    monitored.push(page);
    page.on('pageerror', error => observations.pageErrors.push({ message: error.message, page: pathname(page.url()), stages: [...observations.stages] }));
    page.on('requestfailed', request => observations.requestFailures.push({ path: pathname(request.url()), error: request.failure()?.errorText, page: pathname(page.url()), stages: [...observations.stages] }));
    page.on('console', message => {
      if (['warning', 'error'].includes(message.type())) observations.console.push({ type: message.type(),
        text: message.text().replace(/https?:\/\/\S+/g, '[url]'), path: pathname(message.location().url) });
    });
    page.on('response', response => {
      if (response.status() >= 400) observations.failedHttp.push(`${response.status()} ${pathname(response.url())}`);
    });
  };
  const newPage = async () => {
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, timezoneId: 'Asia/Shanghai' });
    contexts.push(context); const page = await context.newPage(); observe(page);
    page.setDefaultTimeout(15000); return page;
  };
  const loginChild = async (page, actor = actors.child) => {
    await page.goto(webUrl + '/child/login');
    await page.getByLabel('家庭 ID').fill(actor.familyId);
    await page.getByLabel('孩子 ID').fill(actor.id);
    await page.getByLabel('PIN').fill(pin);
    const initialReads = Promise.all([`/api/children/${actor.id}`, '/api/growth-tasks', '/api/notifications/family']
      .map(endpoint => page.waitForResponse(response => pathname(response.url()) === endpoint && response.request().method() === 'GET')
        .then(async response => { expect([200, 304]).toContain(response.status()); expect(await response.finished()).toBeNull(); })))
      .then(() => null, error => error);
    await page.getByRole('button', { name: '进入我的成长空间', exact: true }).click();
    await expect(page).toHaveURL(webUrl + '/child/today');
    const initialError = await initialReads; if (initialError) throw initialError;
  };
  const loginParent = async page => {
    await page.goto(webUrl + '/login');
    await page.getByLabel('用户名').fill(actors.coparent.username);
    await page.getByLabel('密码', { exact: true }).fill(password);
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page).toHaveURL(webUrl + '/app/today');
  };
  const imageVisible = async page => {
    await page.getByRole('button', { name: '查看完成图片 1', exact: true }).click();
    const image = page.getByRole('img', { name: '完成图片 1', exact: true });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate(node => node.naturalWidth)).toBeGreaterThan(0);
    expect(await image.evaluate(async node => {
      const bytes = await (await fetch(node.src, { signal: AbortSignal.timeout(5000) })).arrayBuffer();
      return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
        .map(value => value.toString(16).padStart(2, '0')).join('');
    })).toBe(imageDigest);
  };
  const screenshot = async (page, name) => {
    await expect(page).toHaveTitle(/\S/);
    await expect(page.locator('body')).not.toHaveText('');
    await expect(page.locator('iframe#webpack-dev-server-client-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const file = path.join(outputRoot, name + '.png');
    await page.screenshot({ path: file, fullPage: true }); fs.chmodSync(file, 0o600);
    observations.screenshots.push(name + '.png');
  };
  try {
    browser = await engine.launch({ headless: true, timeout: 10000 }); await onBrowser(browser);
    const child = await newPage(), parent = await newPage();
    await loginChild(child);
    await child.goto(webUrl + '/child/me');
    await child.getByRole('button', { name: '退出孩子端', exact: true }).click();
    await expect(child).toHaveURL(/\/child\/login/);
    await loginChild(child);
    await child.getByRole('button', { name: '检查待恢复提交', exact: true }).click();
    await child.getByRole('link', { name: `查看待恢复提交 ${taskId}`, exact: true }).click();
    await expect(child.getByRole('button', { name: '继续上次提交', exact: true })).toBeVisible();
    await check('before-recovery');
    const recoveries = [];
    child.on('request', request => {
      if (request.method() === 'POST' && pathname(request.url()).includes('/completion-operations/')) {
        recoveries.push(pathname(request.url()));
      }
    });
    await child.getByRole('button', { name: '继续上次提交', exact: true }).click();
    await expect(child.getByText('作品版本 1', { exact: true })).toBeVisible();
    expect(recoveries).toEqual([`/api/growth-tasks/${taskId}/completion-operations/${operationId}/recover`]);
    await check('recovered'); observations.stages.push('original-command-recovered');
    await child.reload(); await imageVisible(child);

    await loginParent(parent); await openParentTasks(parent, webUrl);
    await parent.getByRole('button', { name: `查看 ${title}`, exact: true }).click();
    await expect(parent.getByRole('dialog', { name: '作品查看与审核', exact: true })).toBeVisible();
    await expect(parent.getByText('作品版本 1', { exact: true })).toBeVisible();
    await imageVisible(parent);
    await child.getByRole('button', { name: '修改本次完成', exact: true }).click();
    await child.getByLabel('我的一句话').fill('Restored browser revision');
    await child.getByRole('button', { name: '提交修改', exact: true }).click();
    await expect(child.getByText('作品版本 2', { exact: true })).toBeVisible();
    const confirmRequests = [];
    parent.on('request', request => {
      if (request.method() === 'PATCH' && pathname(request.url()) === `/api/growth-tasks/${taskId}/confirm`) {
        confirmRequests.push(request.postDataJSON().expectedCompletionVersion);
      }
    });
    const conflict = parent.waitForResponse(response => pathname(response.url()) === `/api/growth-tasks/${taskId}/confirm`);
    await parent.getByRole('button', { name: '确认并发放星星', exact: true }).click();
    expect((await conflict).status()).toBe(409);
    await expect(parent.getByText('作品版本 2', { exact: true })).toBeVisible();
    await expect(parent.getByText('Restored browser revision', { exact: true })).toBeVisible();
    await check('conflict'); observations.stages.push('unseen-version-refused');
    await parent.getByRole('textbox', { name: '家长反馈', exact: true }).fill('Restored browser feedback');
    await parent.getByRole('button', { name: '确认并发放星星', exact: true }).click();
    await expect(parent.getByText('星星已到账', { exact: true })).toBeVisible();
    expect(confirmRequests).toEqual([1, 2]); await check('confirmed');
    await screenshot(parent, 'parent-reviewed-1024');
    await child.reload();
    await expect(child.getByText('Restored browser feedback', { exact: true })).toBeVisible();
    await expect(child.getByRole('button', { name: '修改本次完成', exact: true })).toHaveCount(0);
    await expect(child.getByRole('button', { name: '提交完成情况', exact: true })).toHaveCount(0);
    await imageVisible(child); await screenshot(child, 'child-readback-1024');
    await child.setViewportSize({ width: 768, height: 1024 }); await screenshot(child, 'child-readback-768');
    observations.stages.push('review-readback-readonly');

    const stable = await snapshot();
    await child.reload();
    let captured = false, routeError, heldRequest;
    const late = { upstreamStatus: null, fulfillment: null, browserOutcome: null };
    child.on('requestfailed', request => {
      if (request === heldRequest) late.browserOutcome = { kind: 'cancelled', error: request.failure()?.errorText };
    });
    child.on('requestfinished', request => {
      if (request === heldRequest) late.browserOutcome = { kind: 'finished' };
    });
    const hold = new Promise(resolve => { release = resolve; }); heldPage = child;
    await child.route('**/api/media/*/access', async route => {
      try {
        heldRequest = route.request();
        const response = await route.fetch({ timeout: 10000 }); expect(response.status()).toBe(200);
        late.upstreamStatus = response.status();
        captured = true; await hold;
        try { await route.fulfill({ response }); late.fulfillment = 'resolved'; }
        catch (error) {
          if (!/Target.*closed|has been closed|Request.*intercept|Invalid InterceptionId/i.test(error.message)) throw error;
          late.fulfillment = 'cancelled';
        }
      } catch (error) { routeError = error; captured = true; }
    });
    await child.getByRole('button', { name: '查看完成图片 1', exact: true }).click();
    await expect.poll(() => captured).toBe(true); if (routeError) throw routeError;
    const sibling = await child.context().newPage(); observe(sibling);
    await sibling.goto(webUrl + '/child/me');
    await sibling.getByRole('button', { name: '退出孩子端', exact: true }).click();
    await loginChild(sibling, actors.sibling);
    await expect(child.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
    release(); await child.unrouteAll({ behavior: 'wait' }); heldPage = null;
    if (routeError) throw routeError;
    await expect.poll(() => late.browserOutcome).not.toBeNull();
    if (late.browserOutcome.kind === 'cancelled') expect(late.browserOutcome.error).toMatch(/cancel|abort|interrupted/i);
    observations.lateMediaResponse = late;
    await expect(child.getByRole('img', { name: '完成图片 1', exact: true })).toHaveCount(0);
    await sibling.goto(webUrl + `/child/tasks/${taskId}`);
    await expect(sibling.getByRole('alert').filter({ hasText: '当前身份无法访问此任务' })).toBeVisible();
    await expect(sibling.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
    await expect(sibling.getByRole('button', { name: '刷新详情', exact: true })).toBeDisabled();
    await screenshot(sibling, 'sibling-denied');
    expect(await snapshot()).toEqual(stable);
    observations.stages.push(late.browserOutcome.kind === 'finished' ? 'cross-tab-response-finished-private-view-absent' : 'cross-tab-request-cancelled-private-view-absent');

    expect(observations.pageErrors).toEqual([]);
    expect(observations.failedHttp.filter(row => !allowedErrors.has(row))).toEqual([]);
    const unexpectedConsole = observations.console.filter(row => {
      const match = row.text.match(/^Failed to load resource: the server responded with a status of (\d+)/);
      return !match || !allowedErrors.has(`${match[1]} ${row.path}`);
    });
    expect(unexpectedConsole).toEqual([]);
    observations.status = 'PASS';
    return observations;
  } catch (error) {
    observations.status = 'FAIL';
    observations.failure = String(error.message).replace(/https?:\/\/\S+/g, '[url]');
    for (const [index, page] of monitored.entries()) {
      if (page.isClosed()) continue;
      try {
        const name = `failure-${index}.png`, file = path.join(outputRoot, name);
        await page.screenshot({ path: file, timeout: 3000 }); fs.chmodSync(file, 0o600);
        observations.screenshots.push(name);
      } catch { /* Preserve the original failure if the page can no longer render. */ }
    }
    throw error;
  } finally {
    release?.();
    try {
      try { if (heldPage) await heldPage.unrouteAll({ behavior: 'wait' }); }
      finally { for (const context of contexts) await context.close(); }
    } finally {
      try { await browser?.close(); observations.browserClosed = true; }
      finally { fs.writeFileSync(path.join(outputRoot, 'browser-result.json'), JSON.stringify(observations, null, 2), { flag: 'wx', mode: 0o600 }); }
    }
  }
}
module.exports = { runRestoredBrowser };

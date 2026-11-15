const { expect } = require('@playwright/test');
const { login, pathname } = require('./ai2Fixture');

async function submitWithLostResult({ page, runtime, path, roundId, M }) {
  const prefix = 'family-growth.ai3-command.v1:';
  const attemptPath = `${path}/attempts`;
  const url = runtime.webUrl + attemptPath;
  const writes = [], recoveries = [];
  const observe = request => {
    if (request.method() === 'POST' && pathname(request.url()) === attemptPath) writes.push(request.postDataJSON());
    if (request.method() === 'POST' && /^\/api\/ai3\/commands\/[^/]+\/recover$/.test(pathname(request.url()))) {
      recoveries.push({ path: pathname(request.url()), body: request.postDataJSON() });
    }
  };
  let committed, submitted;
  const handler = async route => {
    if (route.request().method() !== 'POST') return route.continue();
    submitted = route.request().postDataJSON();
    const response = await route.fetch({ maxRetries: 0 });
    expect(response.status()).toBe(201);
    committed = await response.json();
    expect(committed.success).toBe(true);
    expect(committed.data.command.phase).toBe('SUCCEEDED');
    // The real server commits; only its command result is lost at the browser boundary.
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
  };
  page.on('request', observe);
  await page.route(url, handler);
  try {
    await page.getByRole('button', { name: '提交作答', exact: true }).click();
    await expect(page.getByRole('region', { name: '未确认原命令', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toBeEnabled();
    expect(committed).toBeTruthy();
    expect(writes).toEqual([submitted]);
    expect(recoveries).toEqual([]);
    await page.unroute(url, handler);
    const before = JSON.parse(JSON.stringify(await M.Attempt.find({ roundId }).lean()));
    expect(before).toHaveLength(1);
    const saved = await page.evaluate(prefix => Object.keys(sessionStorage).filter(k => k.startsWith(prefix))
      .map(k => JSON.parse(sessionStorage.getItem(k))), prefix);
    expect(saved).toHaveLength(1); expect(saved[0].body).toEqual(submitted);
    await page.reload();
    await expect(page.getByRole('region', { name: '未确认原命令', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '等待家长审核', exact: true })).toBeVisible();
    expect(writes).toEqual([submitted]);
    expect(recoveries).toEqual([]);
    await page.getByRole('navigation', { name: '孩子导航', exact: true }).getByRole('link', { name: '我的', exact: true }).click();
    await expect(page).toHaveURL(/\/child\/me$/);
    await page.getByRole('button', { name: '退出孩子端', exact: true }).click();
    await expect(page).toHaveURL(/\/child\/login$/);
    expect(await page.evaluate(prefix => Object.keys(sessionStorage).filter(k => k.startsWith(prefix)), prefix)).toEqual([]);
    await expect(page.locator('img[alt^="练习图片"]')).toHaveCount(0);
    await login(page, runtime, 'child');
    await page.goto(runtime.webUrl + `/child/practice?childId=${runtime.fixture.actors.child.childId}&roundId=${roundId}`);
    const operations = page.getByRole('region', { name: '本人操作记录', exact: true });
    await expect(operations.getByRole('button', { name: '恢复原操作', exact: true })).toHaveCount(1);
    expect(writes).toEqual([submitted]);
    expect(recoveries).toEqual([]);
    const recoveryPath = `/api/ai3/commands/${committed.data.command.id}/recover`;
    const response = page.waitForResponse(r => r.request().method() === 'POST' && pathname(r.url()) === recoveryPath);
    await operations.getByRole('button', { name: '恢复原操作', exact: true }).click();
    const restored = await response;
    expect(restored.status()).toBe(200);
    expect(restored.request().postDataJSON()).toEqual({ schemaVersion: 'ai3-min-v1', operationId: submitted.operationId });
    expect((await restored.json()).data.command.id).toBe(committed.data.command.id);
    await expect(page.getByRole('region', { name: '未确认原命令', exact: true })).toHaveCount(0);
    expect(JSON.parse(JSON.stringify(await M.Attempt.find({ roundId }).lean()))).toEqual(before);
    expect(writes).toEqual([submitted]);
    expect(recoveries).toEqual([{ path: recoveryPath, body: { schemaVersion: 'ai3-min-v1', operationId: submitted.operationId } }]);
    return { body: submitted, data: committed.data };
  } finally {
    page.off('request', observe);
    await page.unroute(url, handler);
  }
}

module.exports = { submitWithLostResult };

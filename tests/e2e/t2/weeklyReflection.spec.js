const { test, expect } = require('@playwright/test');
const { createT2WebRuntime } = require('./webRuntime');
const { expectData } = require('../../../backend/tests/t2/syntheticSeed');
let runtime, fixture, parent;
test.beforeEach(async () => {
  runtime = await createT2WebRuntime(); fixture = runtime.fixture; parent = await runtime.login('parent');
});
test.afterEach(async () => { await runtime?.stop(); });
async function login(page, name) {
  const actor = fixture.actors[name], child = Boolean(actor.pin);
  await page.goto(runtime.webUrl + (child ? '/child/login' : '/login'));
  if (child) {
    await page.getByLabel('家庭 ID').fill(actor.familyId);
    await page.getByLabel('孩子 ID').fill(actor.childId);
    await page.getByLabel('PIN').fill(actor.pin);
    await page.getByRole('button', { name: '进入我的成长空间' }).click();
    await expect(page).toHaveURL(/\/child\/today$/);
  } else {
    await page.getByLabel('用户名').fill(actor.username);
    await page.getByLabel('密码', { exact: true }).fill(actor.password);
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/today$/);
  }
}
const monitor = page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) errors.push(message.type()); });
  return errors;
};
async function capture(page, info, name) {
  expect(await page.title()).toBeTruthy();
  await expect(page.locator('iframe#webpack-dev-server-client-overlay')).toHaveCount(0);
  expect(await page.locator('html').evaluate(node => node.scrollWidth <= node.ownerDocument.defaultView.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(name), fullPage: true });
}
for (const grade of [1, 4]) test(`grade ${grade}: child reflection, real coparent proxy and weekly feedback survive reload`, async ({ page, browser }, info) => {
  const childId = fixture.actors.child.childId;
  expectData(await parent.patch(`/api/children/${childId}`, { grade }));
  const childContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const childPage = await childContext.newPage(), childErrors = monitor(childPage), parentErrors = monitor(page);
  try {
    await login(childPage, 'child');
    await childPage.getByRole('link', { name: '本周反思', exact: true }).click();
    await expect(childPage).toHaveURL(/\/child\/reflection$/);
    const weekStart = await childPage.getByLabel('反思所在周').inputValue();
    await childPage.getByRole('button', { name: '新增反思' }).click();
    await childPage.getByLabel('记录内容', { exact: true }).fill('Synthetic arithmetic reflection');
    await childPage.getByLabel('我的反思', { exact: true }).fill('Synthetic read twice before calculating');
    const saved = childPage.waitForResponse(response => response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/growth-logs');
    await childPage.getByRole('button', { name: '保存反思' }).click();
    expect((await saved).status()).toBe(201);
    await expect(childPage.getByText('反思已保存。')).toBeVisible();
    await childPage.reload();
    await expect(childPage.getByText('Synthetic read twice before calculating', { exact: true })).toBeVisible();
    await capture(childPage, info, 'child-reflection.png');
    await childPage.setViewportSize({ width: 390, height: 844 });
    await capture(childPage, info, 'child-reflection-mobile.png');
    await childPage.setViewportSize({ width: 1024, height: 768 });
    await capture(childPage, info, 'child-reflection-landscape.png');
    await login(page, 'coparent');
    await page.getByRole('link', { name: '周报', exact: true }).click();
    await page.getByLabel('当前孩子').selectOption(childId);
    await page.getByLabel('周一开始').fill(weekStart);
    await expect(page.getByText('Synthetic read twice before calculating', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '修改反思：Synthetic arithmetic reflection', exact: true }).click();
    await expect(page.getByText('本次由家长代录。')).toBeVisible();
    await page.getByLabel('孩子反思', { exact: true }).fill('Synthetic parent-assisted reflection');
    await page.getByRole('button', { name: '保存反思' }).click();
    await expect(page.getByText('反思已保存。')).toBeVisible();
    const reportUrl = `/api/reports/weekly?childId=${childId}&weekStart=${weekStart}`;
    const before = expectData(await parent.get(reportUrl)).report;
    await page.getByLabel('家长寄语').fill('Synthetic family feedback');
    await page.getByLabel('下周建议').fill('Synthetic one careful check');
    await page.getByRole('button', { name: '保存周报反馈' }).click();
    await expect(page.getByText('周报反馈已保存。')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('家长寄语')).toHaveValue('Synthetic family feedback');
    await expect(page.getByLabel('下周建议')).toHaveValue('Synthetic one careful check');
    await capture(page, info, 'parent-weekly-feedback.png');
    await childPage.reload();
    await expect(childPage.getByText('Synthetic parent-assisted reflection', { exact: true })).toBeVisible();
    const logs = expectData(await parent.get(`/api/growth-logs?childId=${childId}`));
    expect(logs.total).toBe(1);
    expect(logs.items[0]).toMatchObject({ createdBy: childId, updatedBy: fixture.actors.coparent.userId,
      childReflection: 'Synthetic parent-assisted reflection' });
    const after = expectData(await parent.get(reportUrl)).report;
    expect(after.statistics).toEqual(before.statistics);
    expect(after.feedbackUpdatedBy).toBe(fixture.actors.coparent.userId);
    expect((await runtime.inspect()).database.Ledger).toEqual([]);
    expect(childErrors).toEqual([]); expect(parentErrors).toEqual([]);
  } finally { await childContext.close(); }
});

test('committed reflection with lost response stays protected across failed reread, logout and sibling switch without repost', async ({ page }) => {
  let creates = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/growth-logs') creates += 1;
  });
  await login(page, 'child');
  await page.getByRole('link', { name: '本周反思', exact: true }).click();
  await page.getByRole('button', { name: '新增反思', exact: true }).click();
  await page.getByLabel('记录内容', { exact: true }).fill('Synthetic uncertain reflection');
  await page.getByLabel('我的反思', { exact: true }).fill('Synthetic private input');
  runtime.dropNextResponse({ method: 'POST', path: '/api/growth-logs' });
  await page.getByRole('button', { name: '保存反思', exact: true }).click();
  await expect(page.getByText(/保存结果尚未确定/)).toBeVisible();
  await expect(page.getByLabel('我的反思', { exact: true })).toHaveValue('Synthetic private input');
  await expect(page.getByRole('button', { name: '保存反思', exact: true })).toBeDisabled();
  const before = expectData(await parent.get(`/api/growth-logs?childId=${fixture.actors.child.childId}`));
  expect(before.total).toBe(1);
  expect(before.items[0]).toMatchObject({ content: 'Synthetic uncertain reflection', createdBy: fixture.actors.child.childId });
  await page.route('**/api/growth-logs?**', route => route.abort('failed'), { times: 1 });
  await page.getByRole('button', { name: '重读全部记录并核对', exact: true }).click();
  await expect(page.getByText('读取失败，请重试。', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '已核对，结束上次编辑', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '保存反思', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '关闭反思编辑', exact: true }).click();
  await expect(page.getByRole('button', { name: '新增反思', exact: true })).toBeDisabled();
  const logout = async () => {
    await page.getByRole('link', { name: '我的', exact: true }).click();
    await page.getByRole('button', { name: '退出孩子端', exact: true }).click();
    await expect(page).toHaveURL(/\/child\/login/);
  };
  await logout(); await login(page, 'sibling');
  await page.getByRole('link', { name: '本周反思', exact: true }).click();
  await expect(page.getByRole('button', { name: '新增反思', exact: true })).toBeEnabled();
  await expect(page.getByText(/Synthetic (uncertain reflection|private input)/)).toHaveCount(0);
  await expect(page.getByText(/保存结果尚未确定/)).toHaveCount(0);
  await logout(); await login(page, 'child');
  await page.getByRole('link', { name: '本周反思', exact: true }).click();
  await expect(page.getByText(/保存结果尚未确定/)).toBeVisible();
  await expect(page.getByRole('button', { name: '新增反思', exact: true })).toBeDisabled();
  await expect(page.getByLabel('我的反思', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '重读全部记录并核对', exact: true }).click();
  await expect(page.getByText('Synthetic private input', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '已核对，结束上次编辑', exact: true }).click();
  await expect(page.getByRole('button', { name: '修改反思：Synthetic uncertain reflection', exact: true })).toBeEnabled();
  expect(creates).toBe(1);
  expect(expectData(await parent.get(`/api/growth-logs?childId=${fixture.actors.child.childId}`))).toEqual(before);
  expect((await runtime.inspect()).database.Ledger).toEqual([]);
});

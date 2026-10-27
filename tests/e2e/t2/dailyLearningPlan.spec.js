const { test, expect } = require('@playwright/test');
const { createT2WebRuntime } = require('./webRuntime');
const { expectData } = require('../../../backend/tests/t2/syntheticSeed');
const { formatLocalDate } = require('../../../backend/common/utils/familyDate');
const { randomUUID } = require('crypto');
let runtime, fixture, parent;
test.beforeEach(async () => { runtime = await createT2WebRuntime(); fixture = runtime.fixture; parent = await runtime.login('parent'); });
test.afterEach(async () => { await runtime?.stop(); });
const planPath = () => `/api/children/${fixture.actors.child.childId}/daily-learning-plans/${formatLocalDate(new Date(), 'Asia/Shanghai')}`;
async function login(page, role) {
  const actor = fixture.actors[role];
  await page.goto(runtime.webUrl + (role === 'child' ? '/child/login' : '/login'));
  if (role === 'child') {
    await page.getByLabel('家庭 ID').fill(actor.familyId); await page.getByLabel('孩子 ID').fill(actor.childId);
    await page.getByLabel('PIN').fill(actor.pin); await page.getByRole('button', { name: '进入我的成长空间' }).click();
    await expect(page).toHaveURL(/\/child\/today$/);
  } else {
    await page.getByLabel('用户名').fill(actor.username); await page.getByLabel('密码', { exact: true }).fill(actor.password);
    await page.getByRole('button', { name: '登录', exact: true }).click(); await expect(page).toHaveURL(/\/app\/today$/);
  }
}
const panel = page => page.getByRole('region', { name: '今日计划', exact: true });
async function capture(page, info, name) {
  expect(await page.title()).toBeTruthy(); await expect(panel(page)).toBeVisible();
  await expect(page.locator('iframe#webpack-dev-server-client-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(name), fullPage: true });
}
for (const role of ['child', 'parent']) test(`${role}: native incomplete estimates cannot clear saved values, correction and deliberate clearing remain possible`, async ({ page }, info) => {
  const second = expectData(await parent.post('/api/growth-tasks', { childId: fixture.actors.child.childId,
    title: 'Synthetic separate estimate', dueDate: '2026-01-01', dimension: 'physical', taskType: 'exercise' }), 201).task;
  const child = await runtime.login('child'), first = fixture.tasks.child;
  expectData(await child.put(planPath(), { expectedVersion: 0, items: [
    { taskId: first.taskId, childEstimatedMinutes: 15 }, { taskId: second.taskId, childEstimatedMinutes: 20 }
  ] }));
  await page.setViewportSize({ width: role === 'child' ? 390 : 768, height: 1024 });
  const errors = [], sent = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) errors.push(message.text()); });
  await login(page, role);
  const current = panel(page), input = current.getByLabel(`${first.title} 估计分钟`), save = current.getByRole('button', { name: '保存今日计划', exact: true });
  await expect(input).toHaveValue('15'); const before = await runtime.inspect();
  page.on('request', request => { if (request.method() === 'PUT' && new URL(request.url()).pathname === planPath()) sent.push(request.postDataJSON()); });
  for (const text of ['1e', '-', '1e+']) {
    await input.focus(); await input.press('ControlOrMeta+A'); await input.pressSequentially(text);
    const native = await input.evaluate(node => ({ value: node.value, badInput: node.validity.badInput }));
    expect(native).toEqual({ value: '', badInput: true });
    if (await save.isEnabled()) {
      const response = page.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname === planPath());
      await save.click(); await response;
    }
    const after = await runtime.inspect();
    await info.attach(`${role}-${text.replace(/[^a-z0-9]/gi, '_')}-observation.json`, {
      body: Buffer.from(JSON.stringify({ native, sent, before, after }, null, 2)), contentType: 'application/json'
    });
    expect(sent).toEqual([]); expect(after).toEqual(before);
    await expect(save).toBeDisabled(); await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(current.getByText('估时输入未完成，请填写整数或清空。')).toBeVisible();
  }
  await current.getByLabel(`${second.title} 估计分钟`).fill('45');
  await current.getByRole('button', { name: `下移 ${first.title}`, exact: true }).click();
  await expect(save).toBeDisabled(); expect(sent).toEqual([]); expect(await runtime.inspect()).toEqual(before);
  await capture(page, info, `${role}-invalid-estimate.png`);
  await input.fill('30'); await expect(input).toHaveAttribute('aria-invalid', 'false');
  let response = page.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname === planPath());
  await save.click(); expect((await response).status()).toBe(200);
  await expect(current.getByText('今日计划已保存。')).toBeVisible();
  const recorded = expectData(await parent.get(planPath())).plan;
  expect(recorded.version).toBe(2); expect(recorded.items.map(item => item.taskId)).toEqual([second.taskId, first.taskId]);
  expect(recorded.items.map(item => item.childEstimatedMinutes)).toEqual([45, 30]);
  expect(recorded.items[1].estimateRecordedBy).toEqual({ actorId: fixture.actors[role].userId, role: role === 'child' ? 'student' : 'parent' });
  await input.focus(); await input.press('ControlOrMeta+A'); await input.pressSequentially('1e');
  await expect(save).toBeDisabled();
  await input.fill(''); expect(await input.evaluate(node => node.validity.badInput)).toBe(false);
  await expect(input).toHaveAttribute('aria-invalid', 'false'); await expect(save).toBeEnabled();
  response = page.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname === planPath());
  await save.click(); expect((await response).status()).toBe(200);
  await expect(current.getByText('今日计划已保存。')).toBeVisible();
  const cleared = expectData(await parent.get(planPath())).plan;
  expect(cleared.version).toBe(3); expect(cleared.items[1]).toMatchObject({ childEstimatedMinutes: null, estimateRecordedBy: null });
  expect(cleared.items[0]).toEqual(recorded.items[0]); expect(sent).toHaveLength(2);
  expect(sent[1]).toEqual({ expectedVersion: 2, items: [
    { taskId: second.taskId, childEstimatedMinutes: 45 }, { taskId: first.taskId, childEstimatedMinutes: null }
  ] });
  const after = await runtime.inspect();
  for (const key of Object.keys(before.database).filter(key => key !== 'DailyPlan')) expect(after.database[key]).toEqual(before.database[key]);
  expect(after.files).toEqual(before.files); expect(errors).toEqual([]);
  await capture(page, info, `${role}-intentional-clear.png`);
});
for (const role of ['child', 'parent']) test(`${role}: estimate integer boundaries reject without PUT and legal values persist`, async ({ page }) => {
  const child = await runtime.login('child'), task = fixture.tasks.child;
  expectData(await child.put(planPath(), { expectedVersion: 0, items: [{ taskId: task.taskId, childEstimatedMinutes: 15 }] }));
  await login(page, role);
  const current = panel(page), input = current.getByLabel(`${task.title} 估计分钟`), save = current.getByRole('button', { name: '保存今日计划', exact: true });
  await expect(input).toHaveValue('15'); const before = await runtime.inspect(), sent = [];
  page.on('request', request => { if (request.method() === 'PUT' && new URL(request.url()).pathname === planPath()) sent.push(request.postDataJSON()); });
  for (const value of ['0', '241', '1.5']) {
    await input.fill(value); await save.click();
    await expect(current.getByText('估时请留空或填写 1 至 240 的整数。')).toBeVisible();
    expect(sent).toEqual([]); expect(await runtime.inspect()).toEqual(before);
  }
  let version = 1;
  for (const value of ['1', '240', '30']) {
    await input.fill(value);
    const response = page.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname === planPath());
    await save.click(); expect((await response).status()).toBe(200);
    const plan = expectData(await parent.get(planPath())).plan;
    expect(plan.version).toBe(++version);
    expect(plan.items[0]).toMatchObject({ childEstimatedMinutes: Number(value),
      estimateRecordedBy: { actorId: fixture.actors[role].userId, role: role === 'child' ? 'student' : 'parent' } });
  }
  expect(sent).toHaveLength(3);
});
for (const grade of [1, 4]) test(`grade ${grade}: child plans, parent reorders and estimates, child rereads with real actor audit`, async ({ page, browser }, info) => {
  expectData(await parent.patch(`/api/children/${fixture.actors.child.childId}`, { grade }));
  const second = expectData(await parent.post('/api/growth-tasks', { childId: fixture.actors.child.childId,
    title: 'Synthetic older pending exercise', dueDate: '2026-01-01', dimension: 'physical', taskType: 'exercise' }), 201).task;
  const childContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const childPage = await childContext.newPage(), errors = [];
  for (const target of [page, childPage]) {
    target.on('pageerror', error => errors.push(error.message));
    target.on('console', message => { if (['warning', 'error'].includes(message.type())) errors.push(message.text()); });
  }
  try {
    await login(childPage, 'child'); const childPanel = panel(childPage);
    for (const task of [fixture.tasks.child, second]) await childPanel.getByRole('button', { name: `加入今日计划 ${task.title}`, exact: true }).click();
    if (grade === 1) await childPanel.getByRole('group', { name: `计划项 ${fixture.tasks.child.title}` }).getByRole('button', { name: '中 15分钟' }).click();
    else await childPanel.getByLabel(`${fixture.tasks.child.title} 估计分钟`).fill('20');
    await childPanel.getByRole('button', { name: `上移 ${second.title}`, exact: true }).click();
    await childPanel.getByRole('button', { name: '保存今日计划', exact: true }).click();
    await expect(childPanel.getByText('今日计划已保存。')).toBeVisible();
    const first = expectData(await parent.get(planPath())).plan;
    expect(first.items.map(item => item.taskId)).toEqual([second.taskId, fixture.tasks.child.taskId]);
    expect(first.items[1].estimateRecordedBy).toEqual({ actorId: fixture.actors.child.userId, role: 'student' });
    await childPage.reload(); await expect(childPanel.getByLabel(`${fixture.tasks.child.title} 估计分钟`)).toHaveValue(grade === 1 ? '15' : '20');
    await login(page, 'parent'); const parentPanel = panel(page);
    await expect(parentPanel.getByText('孩子输入', { exact: true })).toBeVisible();
    await parentPanel.getByRole('button', { name: `上移 ${fixture.tasks.child.title}`, exact: true }).click();
    await parentPanel.getByRole('button', { name: '保存今日计划', exact: true }).click();
    await expect(parentPanel.getByText('今日计划已保存。')).toBeVisible();
    const reordered = expectData(await parent.get(planPath())).plan;
    expect(reordered.items[0].estimateRecordedBy).toEqual(first.items[1].estimateRecordedBy);
    expect(reordered.updatedByActor).toEqual({ actorId: fixture.actors.parent.userId, role: 'parent' });
    await parentPanel.getByLabel(`${second.title} 估计分钟`).fill('30');
    await parentPanel.getByRole('button', { name: '保存今日计划', exact: true }).click();
    await expect(parentPanel.getByText('家长输入', { exact: true })).toBeVisible();
    await childPage.reload(); await expect(childPanel.getByText('家长输入', { exact: true })).toBeVisible();
    expect(expectData(await parent.get(planPath())).plan.items[1].estimateRecordedBy).toEqual({ actorId: fixture.actors.parent.userId, role: 'parent' });
    for (const [width, height] of [[390, 844], [768, 1024], [1280, 800]]) {
      await childPage.setViewportSize({ width, height }); await capture(childPage, info, `child-grade-${grade}-${width}.png`);
      await page.setViewportSize({ width, height }); await capture(page, info, `parent-grade-${grade}-${width}.png`);
    }
    await parentPanel.getByRole('link', { name: second.title, exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText(second.title, { exact: true })).toBeVisible();
    await childPanel.getByRole('link', { name: second.title, exact: true }).click();
    await expect(childPage).toHaveURL(new RegExp(`/child/tasks/${second.taskId}$`));
    await expect(childPage.getByRole('heading', { name: second.title, exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await childContext.close(); }
});
test('lost committed response keeps the original PUT, conflict requires explicit adoption, logout/relogin reads persisted plan', async ({ page }) => {
  await login(page, 'child'); const currentPanel = panel(page), sent = [];
  page.on('request', request => { if (request.method() === 'PUT' && new URL(request.url()).pathname === planPath()) sent.push(request.postDataJSON()); });
  await currentPanel.getByRole('button', { name: `加入今日计划 ${fixture.tasks.child.title}`, exact: true }).click();
  runtime.dropNextResponse({ method: 'PUT', path: planPath() });
  await currentPanel.getByRole('button', { name: '保存今日计划', exact: true }).click();
  await expect(currentPanel.getByText('保存结果尚未确认。可以重试原保存，或读取服务器计划核对。')).toBeVisible();
  await expect(currentPanel.getByRole('button', { name: '重试原保存' })).toBeEnabled();
  expect(runtime.droppedResponses).toEqual([{ service: 'api-gateway', method: 'PUT', path: planPath(), status: 200 }]);
  const committed = await runtime.inspect(); expect(committed.database.DailyPlan[0].version).toBe(1);
  await currentPanel.getByRole('button', { name: '重试原保存' }).click();
  await expect(currentPanel.getByRole('button', { name: '采用最新计划' })).toBeVisible();
  await expect(currentPanel.getByText('服务器已有与原保存相同的顺序和估时，请核对后采用，无需再次保存。')).toBeVisible();
  expect(sent).toHaveLength(2); expect(sent[1]).toEqual(sent[0]);
  expect(await runtime.inspect()).toEqual(committed);
  await expect(currentPanel.getByRole('button', { name: '保存今日计划' })).toBeDisabled();
  await currentPanel.getByRole('button', { name: '采用最新计划' }).click();
  await expect(currentPanel.getByRole('button', { name: '保存今日计划' })).toBeDisabled();
  await page.getByRole('link', { name: '我的', exact: true }).click();
  await page.getByRole('button', { name: '退出孩子端', exact: true }).click();
  await expect(page.getByText(fixture.tasks.child.title, { exact: true })).toHaveCount(0);
  await login(page, 'child'); await expect(panel(page).getByRole('group', { name: `计划项 ${fixture.tasks.child.title}` })).toBeVisible();
  expect(sent).toHaveLength(2); expect(await runtime.inspect()).toEqual(committed);
});
test('a real coparent update cannot be overwritten by the child viewed version', async ({ page }) => {
  await login(page, 'child'); const currentPanel = panel(page), sent = [];
  await currentPanel.getByRole('button', { name: `加入今日计划 ${fixture.tasks.child.title}`, exact: true }).click();
  await currentPanel.getByLabel(`${fixture.tasks.child.title} 估计分钟`).fill('5');
  const coparent = await runtime.login('coparent');
  const server = expectData(await coparent.put(planPath(), { expectedVersion: 0,
    items: [{ taskId: fixture.tasks.child.taskId, childEstimatedMinutes: 30 }] })).plan;
  page.on('request', request => { if (request.method() === 'PUT' && new URL(request.url()).pathname === planPath()) sent.push(request.postDataJSON()); });
  const before = await runtime.inspect();
  await currentPanel.getByRole('button', { name: '保存今日计划', exact: true }).click();
  await expect(currentPanel.getByRole('button', { name: '采用最新计划' })).toBeVisible();
  await expect(currentPanel.getByLabel(`${fixture.tasks.child.title} 估计分钟`)).toHaveValue('5');
  await expect(currentPanel.getByRole('button', { name: '保存今日计划' })).toBeDisabled();
  expect(sent).toHaveLength(1); expect(sent[0].expectedVersion).toBe(0);
  expect(expectData(await parent.get(planPath())).plan).toEqual(server); expect(await runtime.inspect()).toEqual(before);
  await currentPanel.getByRole('button', { name: '采用最新计划' }).click();
  await expect(currentPanel.getByLabel(`${fixture.tasks.child.title} 估计分钟`)).toHaveValue('30');
  await expect(currentPanel.getByText('家长输入', { exact: true })).toBeVisible();
  expect(sent).toHaveLength(1);
});
test('plan links reuse actual review version protection and confirmed child readback without extra rewards', async ({ page, browser }) => {
  const task = fixture.tasks.child, taskPath = `/api/growth-tasks/${task.taskId}`, child = await runtime.login('child');
  expectData(await child.put(planPath(), { expectedVersion: 0, items: [{ taskId: task.taskId, childEstimatedMinutes: 15 }] }));
  const body = { operationId: randomUUID(), expectedCompletionVersion: 0, expectedChecklistVersion: 0,
    checkedItemIds: [], completionMediaIds: [] };
  expectData(await child.patch(taskPath + '/complete', body));
  await login(page, 'parent'); await panel(page).getByRole('link', { name: task.title, exact: true }).click();
  await expect(page.getByRole('dialog').getByText('作品版本 1')).toBeVisible();
  expectData(await child.patch(taskPath + '/complete', { ...body, operationId: randomUUID(),
    expectedCompletionVersion: 1, childNote: 'Synthetic later T5 evidence' }));
  await page.getByRole('button', { name: '确认并发放星星' }).click();
  await expect(page.getByRole('dialog').getByText('作品版本 2')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Synthetic later T5 evidence')).toBeVisible();
  expect((await runtime.inspect()).database.Ledger.filter(row => row.sourceId === task.taskId)).toEqual([]);
  await page.getByRole('textbox', { name: '家长反馈', exact: true }).fill('Synthetic reviewed T5 feedback');
  await page.getByRole('button', { name: '确认并发放星星' }).click(); await expect(page.getByText('星星已到账')).toBeVisible();
  const stable = await runtime.inspect(), childContext = await browser.newContext();
  try {
    const childPage = await childContext.newPage(); await login(childPage, 'child');
    await expect(panel(childPage).getByText('已确认', { exact: true })).toBeVisible();
    await panel(childPage).getByRole('link', { name: task.title, exact: true }).click();
    await expect(childPage.getByText('Synthetic reviewed T5 feedback')).toBeVisible();
    await expect(childPage.getByRole('button', { name: '修改本次完成' })).toHaveCount(0);
    await page.goto(runtime.webUrl + '/app/today'); await panel(page).getByRole('link', { name: task.title, exact: true }).click();
    await expect(page.getByRole('dialog').getByText('作品版本 2')).toBeVisible();
    await expect(page.getByRole('button', { name: '确认并发放星星' })).toHaveCount(0);
    expect(await runtime.inspect()).toEqual(stable);
    expect(stable.database.Ledger.filter(row => row.sourceId === task.taskId)).toHaveLength(1);
  } finally { await childContext.close(); }
});

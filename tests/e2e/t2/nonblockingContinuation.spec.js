const { test, expect } = require('@playwright/test');
const { createT2WebRuntime } = require('./webRuntime');
const { expectData } = require('../../../backend/tests/t2/syntheticSeed');
const { formatLocalDate } = require('../../../backend/common/utils/familyDate');
let runtime, parent;
test.beforeEach(async () => { runtime = await createT2WebRuntime(); parent = await runtime.login('parent'); });
test.afterEach(async () => { await runtime?.stop(); });
const panel = page => page.getByRole('region', { name: '今日计划', exact: true });
const planPath = () => `/api/children/${runtime.fixture.actors.child.childId}/daily-learning-plans/${formatLocalDate(new Date(), 'Asia/Shanghai')}`;
async function login(page, role) {
  const actor = runtime.fixture.actors[role];
  await page.goto(runtime.webUrl + (role === 'parent' ? '/login' : `/child/login#familyId=${actor.familyId}&childId=${actor.childId}`));
  if (role === 'parent') {
    await page.getByLabel('用户名').fill(actor.username); await page.getByLabel('密码', { exact: true }).fill(actor.password);
    await page.getByRole('button', { name: '登录', exact: true }).click(); await expect(page).toHaveURL(/\/app\/today$/);
  } else {
    await page.getByLabel('PIN', { exact: true }).fill(actor.pin);
    await page.getByRole('button', { name: '进入我的成长空间', exact: true }).click(); await expect(page).toHaveURL(/\/child\/today$/);
  }
}
function observe(page) {
  const errors = [], writes = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (['warning', 'error'].includes(m.type())) errors.push(m.text()); });
  page.on('request', r => { if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method()) && new URL(r.url()).pathname.startsWith('/api/'))
    writes.push({ method: r.method(), path: new URL(r.url()).pathname, body: r.postDataJSON() }); });
  return { errors, writes };
}
async function capture(page, info, name, data) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(name + '.png'), fullPage: true });
  await info.attach(name, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
}
function unchangedExcept(before, after, allowed) {
  for (const key of Object.keys(before.database).filter(k => !allowed.includes(k))) expect(after.database[key], key).toEqual(before.database[key]);
  expect(after.files).toEqual(before.files);
}
function knowledgeQueryMatches(url, query) {
  return url.pathname === '/api/knowledge-points'
    && url.searchParams.get('pageSize') === '100'
    && ['childId', 'dimension', 'subject', 'area', 'masteryLevel']
      .every(key => (url.searchParams.get(key) || '') === (query[key] || ''));
}
async function readKnowledge(page, query, expectedIds, action) {
  const responsePromise = page.waitForResponse(response => response.request().method() === 'GET'
    && knowledgeQueryMatches(new URL(response.url()), query));
  // Observe failures immediately even if the UI action itself fails first.
  responsePromise.catch(() => {});
  await action();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.success).toBe(true);
  expect(body.data.items.map(point => point.knowledgePointId)).toEqual(expectedIds);
  for (const point of body.data.items) expect(point.childId).toBe(query.childId);
  await expect(page.locator('.family-data-state.is-loading')).toHaveCount(0);
  await expect(page.locator('.family-data-state.is-error, .family-data-state.is-retryable_error')).toHaveCount(0);
  await expect(page.locator('[data-testid^="point-row-"]')).toHaveCount(expectedIds.length);
  if (expectedIds.length === 0) {
    await expect(page.getByText('暂无符合条件的知识或能力点。', { exact: true })).toBeVisible();
  }
  for (const id of expectedIds) await expect(page.getByTestId('point-row-' + id)).toBeVisible();
}
async function delayedEmptyKnowledge(page, info, query, row, action) {
  let release, entered;
  const barrier = new Promise(resolve => { release = resolve; });
  const requestEntered = new Promise(resolve => { entered = resolve; });
  const matches = url => knowledgeQueryMatches(url, query);
  const handler = async route => {
    entered();
    await barrier;
    await route.continue();
  };
  await page.route(matches, handler);
  const check = readKnowledge(page, query, [], action);
  check.catch(() => {});
  try {
    // Bound the request barrier using the existing expect budget, not an unbounded wait.
    let requested = false;
    requestEntered.then(() => { requested = true; });
    await expect.poll(() => requested).toBe(true);
    await expect(page.locator('.family-data-state.is-loading')).toBeVisible();
    await expect(row).toHaveCount(0);
    await expect(page.getByText('暂无符合条件的知识或能力点。', { exact: true })).toHaveCount(0);
    await info.attach('held-knowledge-query', { body: JSON.stringify({ query, responseDelivered: false, loadingVisible: true }), contentType: 'application/json' });
  } finally {
    release();
    try { await check; } finally { await page.unroute(matches, handler); }
  }
}
for (const role of ['child', 'parent']) test(`[T5-NB-001] ${role}: native invalid estimate recovers via each 5/15/30 shortcut and persists exact audit`, async ({ page }, info) => {
  const { child } = runtime.fixture.actors, task = runtime.fixture.tasks.child;
  expectData(await parent.patch(`/api/children/${child.childId}`, { grade: 1 }));
  const childApi = await runtime.login('child');
  expectData(await childApi.put(planPath(), { expectedVersion: 0, items: [{ taskId: task.taskId, childEstimatedMinutes: 20 }] }));
  const observations = observe(page); await login(page, role);
  const current = panel(page), input = current.getByLabel(`${task.title} 估计分钟`), save = current.getByRole('button', { name: '保存今日计划', exact: true });
  await expect(input).toHaveValue('20'); const before = await runtime.inspect();
  const originalActor = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  let version = 1;
  for (const [label, minutes] of [['短', 5], ['中', 15], ['长', 30]]) {
    await input.focus(); await input.press('ControlOrMeta+A'); await input.pressSequentially('1e');
    expect(await input.evaluate(n => ({ value: n.value, badInput: n.validity.badInput }))).toEqual({ value: '', badInput: true });
    await expect(save).toBeDisabled(); await expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(observations.writes.filter(r => r.method === 'PUT')).toHaveLength(version - 1);
    const old = expectData(await parent.get(planPath())).plan; expect(old.version).toBe(version);
    await current.getByRole('group', { name: `计划项 ${task.title}` }).getByRole('button', { name: `${label} ${minutes}分钟`, exact: true }).click();
    await expect(input).toHaveValue(String(minutes)); await expect(input).toHaveAttribute('aria-invalid', 'false');
    await expect(current.getByText('估时输入未完成，请填写整数或清空。')).toHaveCount(0); await expect(save).toBeEnabled();
    const response = page.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname === planPath());
    await save.click(); expect((await response).status()).toBe(200); await expect(current.getByText('今日计划已保存。')).toBeVisible();
    const actual = expectData(await parent.get(planPath())).plan;
    expect(actual.version).toBe(++version); expect(actual.items[0]).toMatchObject({ taskId: task.taskId, childEstimatedMinutes: minutes,
      estimateRecordedBy: { actorId: runtime.fixture.actors[role].userId, role: role === 'child' ? 'student' : 'parent' } });
    const sent = observations.writes.filter(r => r.method === 'PUT'); expect(sent).toHaveLength(version - 1);
    expect(sent.at(-1).body).toEqual({ expectedVersion: version - 1, items: [{ taskId: task.taskId, childEstimatedMinutes: minutes }] });
  }
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(originalActor);
  await page.reload(); await expect(input).toHaveValue('30');
  unchangedExcept(before, await runtime.inspect(), ['DailyPlan']); expect(observations.errors).toEqual([]);
  await capture(page, info, role + '-shortcuts', observations);
});

test('today-plan page continuation: child plans, parent changes order/estimate, child task visit and refresh retain real plan', async ({ page, browser }, info) => {
  const childContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const childPage = await childContext.newPage(), childEvents = observe(childPage), parentEvents = observe(page);
  try {
    const { child } = runtime.fixture.actors, first = runtime.fixture.tasks.child;
    const second = expectData(await parent.post('/api/growth-tasks', { childId: child.childId, title: 'Synthetic continuation backlog', dueDate: '2026-01-01', dimension: 'physical', taskType: 'exercise' }), 201).task;
    const before = await runtime.inspect(); await login(childPage, 'child'); const cp = panel(childPage);
    for (const t of [first, second]) await cp.getByRole('button', { name: `加入今日计划 ${t.title}`, exact: true }).click();
    await cp.getByLabel(`${first.title} 估计分钟`).fill('25');
    await cp.getByRole('button', { name: `上移 ${second.title}`, exact: true }).click();
    await cp.getByRole('button', { name: '保存今日计划', exact: true }).click(); await expect(cp.getByText('今日计划已保存。')).toBeVisible();
    const firstSave = expectData(await parent.get(planPath())).plan; expect(firstSave.version).toBe(1);
    expect(firstSave.items.map(i => i.taskId)).toEqual([second.taskId, first.taskId]);
    await cp.getByRole('group', { name: `计划项 ${first.title}`, exact: true }).getByRole('link', { name: first.title, exact: true }).click();
    await expect(childPage).toHaveURL(runtime.webUrl + '/child/tasks/' + first.taskId);
    await expect(childPage.getByRole('heading', { name: first.title, exact: true })).toBeVisible();
    await childPage.getByRole('navigation', { name: '孩子导航' }).getByRole('link', { name: '今天', exact: true }).click();
    await expect(cp.getByLabel(`${first.title} 估计分钟`)).toHaveValue('25');
    await login(page, 'parent'); const pp = panel(page);
    await expect(pp.getByText('孩子输入', { exact: true })).toBeVisible();
    await pp.getByRole('button', { name: `上移 ${first.title}`, exact: true }).click();
    await pp.getByRole('button', { name: '保存今日计划', exact: true }).click(); await expect(pp.getByText('今日计划已保存。')).toBeVisible();
    const reordered = expectData(await parent.get(planPath())).plan;
    expect(reordered.items[0].estimateRecordedBy).toEqual(firstSave.items[1].estimateRecordedBy);
    await pp.getByLabel(`${second.title} 估计分钟`).fill('30');
    await pp.getByRole('button', { name: '保存今日计划', exact: true }).click(); await expect(pp.getByText('今日计划已保存。')).toBeVisible();
    const final = expectData(await parent.get(planPath())).plan; expect(final.version).toBe(3);
    expect(final.items[0]).toMatchObject({ taskId: first.taskId, childEstimatedMinutes: 25, estimateRecordedBy: { actorId: child.userId, role: 'student' } });
    expect(final.items[1]).toMatchObject({ taskId: second.taskId, childEstimatedMinutes: 30, estimateRecordedBy: { actorId: runtime.fixture.actors.parent.userId, role: 'parent' } });
    await childPage.reload(); await expect(cp.getByLabel(`${second.title} 估计分钟`)).toHaveValue('30');
    expect(await cp.getByRole('group', { name: /计划项/ }).allTextContents()).toHaveLength(2);
    const after = await runtime.inspect();
    // First inclusion deliberately increments only these task __v values as a transactional
    // pending-state fence (dailyLearningPlanService). Assert the exact +1, not a blanket ignore.
    const included = new Set([first.taskId, second.taskId]);
    expect(after.database.Task).toEqual(before.database.Task.map(t => included.has(t._id) ? { ...t, __v: t.__v + 1 } : t));
    unchangedExcept(before, after, ['DailyPlan', 'Task']); expect(childEvents.errors).toEqual([]); expect(parentEvents.errors).toEqual([]);
    await capture(page, info, 'parent-plan', parentEvents); await capture(childPage, info, 'child-plan', childEvents);
  } finally { await childContext.close(); }
});

test('knowledge-point page continuation: create/cancel, edit, filters, sibling switch and refresh preserve exact synthetic record', async ({ page }, info) => {
  // Keep routing active for this case so WebKit cannot replace a real body with cached 304.
  // Requests still reach the formal service unchanged; no synthetic response is supplied.
  await page.route('**/api/knowledge-points?**', route => route.continue());
  const events = observe(page); await login(page, 'parent');
  const before = await runtime.inspect();
  await page.getByRole('navigation', { name: '家长导航', exact: true }).getByRole('link', { name: /知识/ }).click();
  await expect(page.getByRole('heading', { name: '知识与能力点', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '新增知识或能力点', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: '新增知识或能力点', exact: true });
  await dialog.getByLabel('学科', { exact: true }).fill('数学'); await dialog.getByLabel('名称', { exact: true }).fill('Synthetic continuation knowledge');
  await dialog.getByRole('combobox', { name: /^掌握程度/ }).selectOption('learning');
  const createdResponse = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/knowledge-points');
  await dialog.getByRole('button', { name: '保存知识或能力点', exact: true }).click(); const created = await createdResponse;
  expect(created.status()).toBe(201); const point = (await created.json()).data.knowledgePoint;
  expect(point.childId).toBe(runtime.fixture.actors.child.childId);
  const row = page.getByTestId('point-row-' + point.knowledgePointId); await expect(row).toContainText('学习中');
  const writeCount = events.writes.length;
  await page.getByRole('button', { name: '新增知识或能力点', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '新增知识或能力点', exact: true });
  await dialog.getByLabel('名称', { exact: true }).fill('Synthetic cancelled knowledge');
  await dialog.getByRole('button', { name: '关闭', exact: true }).click(); expect(events.writes).toHaveLength(writeCount);
  await row.getByRole('button', { name: '更新Synthetic continuation knowledge', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '更新知识或能力点', exact: true });
  await dialog.getByRole('combobox', { name: /^掌握程度/ }).selectOption('skilled');
  await dialog.getByLabel('练习次数', { exact: true }).fill('-1');
  await dialog.getByRole('button', { name: '保存更新', exact: true }).click();
  expect(events.writes).toHaveLength(writeCount); await expect(dialog).toBeVisible();
  await dialog.getByLabel('练习次数', { exact: true }).fill('3'); await dialog.getByLabel('错误次数', { exact: true }).fill('1');
  const updateResponse = page.waitForResponse(r => r.request().method() === 'PATCH' && new URL(r.url()).pathname === '/api/knowledge-points/' + point.knowledgePointId);
  await dialog.getByRole('button', { name: '保存更新', exact: true }).click(); expect((await updateResponse).status()).toBe(200);
  await expect(row).toContainText('熟练'); await expect(row).toContainText('练习 3 次 · 错误 1 次');
  const query = { childId: runtime.fixture.actors.child.childId, masteryLevel: 'needs_review' };
  const readOnlyWrites = events.writes.length;
  await delayedEmptyKnowledge(page, info, query, row, () => page.getByLabel('掌握程度筛选').selectOption('needs_review')); await expect(row).toHaveCount(0);
  query.masteryLevel = 'skilled';
  await readKnowledge(page, query, [point.knowledgePointId], () => page.getByLabel('掌握程度筛选').selectOption('skilled')); await expect(row).toBeVisible();
  query.subject = '语文';
  await delayedEmptyKnowledge(page, info, query, row, () => page.getByLabel('学科筛选').fill('语文')); await expect(row).toHaveCount(0);
  query.subject = '数学';
  await readKnowledge(page, query, [point.knowledgePointId], () => page.getByLabel('学科筛选').fill('数学')); await expect(row).toBeVisible();
  query.dimension = 'physical';
  await delayedEmptyKnowledge(page, info, query, row, () => page.getByLabel('维度筛选').selectOption('physical')); await expect(row).toHaveCount(0);
  query.dimension = 'academic';
  await readKnowledge(page, query, [point.knowledgePointId], () => page.getByLabel('维度筛选').selectOption('academic')); await expect(row).toBeVisible();
  query.childId = runtime.fixture.actors.sibling.childId;
  await delayedEmptyKnowledge(page, info, query, row, () => page.getByLabel('当前孩子', { exact: true }).selectOption(runtime.fixture.actors.sibling.childId)); await expect(row).toHaveCount(0);
  query.childId = runtime.fixture.actors.child.childId;
  await readKnowledge(page, query, [point.knowledgePointId], () => page.getByLabel('当前孩子', { exact: true }).selectOption(runtime.fixture.actors.child.childId)); await expect(row).toBeVisible();
  expect(events.writes).toHaveLength(readOnlyWrites);
  await page.reload(); await expect(row).toContainText('练习 3 次 · 错误 1 次');
  const points = expectData(await parent.get('/api/knowledge-points', { params: { childId: runtime.fixture.actors.child.childId } })).items;
  expect(points).toHaveLength(1); expect(points[0]).toMatchObject({ knowledgePointId: point.knowledgePointId, masteryLevel: 'skilled', practiceCount: 3, mistakeCount: 1 });
  unchangedExcept(before, await runtime.inspect(), ['KnowledgePoint', 'KnowledgePointMasteryEvent']); expect(events.errors).toEqual([]);
  await capture(page, info, 'knowledge-final', events);
});

test('knowledge read guard rejects a wrong response delivered after loading-only absence', async ({ page }) => {
  const { child, sibling } = runtime.fixture.actors;
  const point = expectData(await parent.post('/api/knowledge-points', {
    childId: child.childId, dimension: 'academic', subject: '数学', name: 'Synthetic delayed wrong collection'
  }), 201).knowledgePoint;
  await page.route('**/api/knowledge-points?**', route => route.continue());
  await login(page, 'parent');
  await page.getByRole('navigation', { name: '家长导航', exact: true }).getByRole('link', { name: /知识/ }).click();
  const row = page.getByTestId('point-row-' + point.knowledgePointId);
  await expect(row).toBeVisible();
  const before = await runtime.inspect(), events = observe(page);
  const query = { childId: sibling.childId };
  let release, requested = false;
  const barrier = new Promise(resolve => { release = resolve; });
  const matches = url => knowledgeQueryMatches(url, query);
  const handler = async route => {
    requested = true;
    await barrier;
    // Deliberate response fault only: unlike the main continuation case, this is not
    // service-isolation evidence. The read assertion must reject the injected collection.
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { items: [point] } }) });
  };
  await page.route(matches, handler);
  const check = readKnowledge(page, query, [], () => page.getByLabel('当前孩子', { exact: true }).selectOption(sibling.childId));
  check.catch(() => {});
  try {
    await expect.poll(() => requested).toBe(true);
    await expect(page.locator('.family-data-state.is-loading')).toBeVisible();
    await expect(row).toHaveCount(0);
  } finally {
    release();
    try {
      // A loading-only implementation resolves or fails a UI assertion, neither of which
      // is this exact response-collection rejection. No scheduling-based pending probe.
      await expect(check).rejects.toThrow(/toEqual/);
    } finally { await page.unroute(matches, handler); }
  }
  expect(events.writes).toEqual([]);
  unchangedExcept(before, await runtime.inspect(), []);
});

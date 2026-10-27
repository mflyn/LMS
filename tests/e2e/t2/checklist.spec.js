const { test, expect } = require('@playwright/test');
const { randomUUID } = require('crypto');
const { createT2WebRuntime } = require('./webRuntime');
const { openParentTasks } = require('./parentNavigation');
const { expectData } = require('../../../backend/tests/t2/syntheticSeed');

let runtime, fixture, parent;
test.beforeEach(async () => {
  runtime = await createT2WebRuntime(); fixture = runtime.fixture; parent = await runtime.login('parent');
});
test.afterEach(async () => { await runtime?.stop(); });
const path = task => `/api/growth-tasks/${task.taskId}`;
const row = (snapshot, task) => snapshot.database.Task.find(value => value._id === task.taskId);
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
function monitor(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) errors.push(message.type()); });
  return errors;
}
async function openChildTask(page, task) {
  const link = page.getByRole('region', { name: '今日计划', exact: true })
    .getByRole('link', { name: task.title, exact: true });
  const target = `/child/tasks/${task.taskId}`, identity = randomUUID();
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute('href', target);
  await page.evaluate(value => { window.t5ChecklistDocument = value; }, identity);
  await link.click();
  await expect(page).toHaveURL(runtime.webUrl + target);
  expect(await page.evaluate(() => window.t5ChecklistDocument)).toBe(identity);
}
async function createViaPage(page, title) {
  await openParentTasks(page, runtime.webUrl);
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.getByLabel('任务标题', { exact: true }).fill(title);
  await page.getByLabel('学科', { exact: true }).fill('数学');
  await page.getByLabel('活动领域', { exact: true }).fill('数学练习');
  await page.getByLabel('截止日期', { exact: true }).fill('2026-10-26');
  for (const [index, label] of ['再读题目', '检查答案'].entries()) {
    await page.getByRole('button', { name: '添加检查项' }).click();
    await page.getByLabel(`检查项 ${index + 1}`, { exact: true }).fill(label);
  }
  await page.getByLabel('重点项 1', { exact: true }).check();
  const created = page.waitForResponse(response => response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/growth-tasks');
  await page.getByRole('button', { name: '保存任务' }).click();
  const response = await created; expect(response.status()).toBe(201);
  const task = (await response.json()).data.task;
  expect(task.checklistVersion).toBe(1); expect(task.checklistSnapshot).toHaveLength(2);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  return task;
}
async function screenshot(page, info, name) {
  expect(await page.title()).toBeTruthy();
  await expect(page.locator('iframe#webpack-dev-server-client-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(name), fullPage: true });
}

for (const grade of [1, 4]) test(`grade ${grade}: real checklist creation, independent help, partial submission, review and reread`, async ({ page, browser }, info) => {
  expectData(await parent.patch(`/api/children/${fixture.actors.child.childId}`, { grade }));
  const childContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const childPage = await childContext.newPage(), errors = monitor(page), childErrors = monitor(childPage);
  try {
    await login(page, 'parent'); const task = await createViaPage(page, `Synthetic grade ${grade} checklist`);
    await page.getByRole('button', { name: `编辑 ${task.title}`, exact: true }).click();
    await page.getByRole('button', { name: '下移检查项 1' }).click();
    await page.getByRole('button', { name: '保存任务' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const updated = expectData(await parent.get(path(task))).task;
    expect(updated.checklistVersion).toBe(2);
    expect(updated.checklistSnapshot.map(item => item.itemId)).toEqual(task.checklistSnapshot.map(item => item.itemId).reverse());
    await login(childPage, 'child'); await openChildTask(childPage, task);
    await expect(childPage.getByRole('group', { name: '完成清单' })).toBeVisible();
    if (grade === 1) {
      await expect(childPage.getByText('补充记录（选填）', { exact: true })).toBeVisible();
      await expect(childPage.getByLabel('我的一句话')).toBeHidden();
    } else {
      await expect(childPage.getByText('提交前，再看看题目、答案和作品是否一致。')).toBeVisible();
      await expect(childPage.getByLabel('我的一句话')).toBeVisible();
    }
    await childPage.getByRole('checkbox', { name: '检查答案', exact: true }).check();
    await expect(childPage.getByText('还有重点项未勾选，可以如实提交。', { exact: false })).toBeVisible();
    const beforeHelp = await runtime.inspect();
    await childPage.getByRole('link', { name: '需要帮助', exact: true }).click();
    await childPage.getByRole('button', { name: '我需要帮助', exact: true }).click();
    await childPage.getByRole('button', { name: '发送求助', exact: true }).click();
    await expect(childPage.getByText('求助已发送。')).toBeVisible();
    const helped = await runtime.inspect();
    expect(row(helped, task)).toMatchObject({ status: 'pending', checklistVersion: 2, helpVersion: 1 });
    const withoutHelp = value => {
      const { helpVersion, helpRequest, updatedAt, __v, ...rest } = value; return rest;
    };
    expect(withoutHelp(row(helped, task))).toEqual(withoutHelp(row(beforeHelp, task)));
    expect(expectData(await parent.get(path(task))).task.completionVersion).toBe(0);
    expect(helped.database.Ledger).toEqual(beforeHelp.database.Ledger);
    expect(helped.database.Operation).toEqual(beforeHelp.database.Operation);
    await childPage.getByLabel('添加完成图片').setInputFiles({ name: fixture.image.name,
      mimeType: fixture.image.mimeType, buffer: fixture.image.bytes });
    await expect(childPage.getByText('已添加 1/10')).toBeVisible();
    await screenshot(childPage, info, `grade-${grade}-partial-form.png`);
    await childPage.getByRole('button', { name: '提交完成情况', exact: true }).click();
    await expect(childPage.getByText('作品版本 1')).toBeVisible();
    await childPage.reload();
    await expect(childPage.getByText('检查答案：已完成', { exact: true })).toBeVisible();
    await expect(childPage.getByText('再读题目：未勾选', { exact: true })).toBeVisible();
    await expect(childPage.getByText('孩子本人提交', { exact: true })).toBeVisible();
    await page.reload(); await page.getByRole('button', { name: `查看 ${task.title}`, exact: true }).click();
    await expect(page.getByText('再读题目：未勾选', { exact: true })).toBeVisible();
    await expect(page.getByText('孩子本人提交', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '查看完成图片 1', exact: true }).click();
    const image = page.getByRole('img', { name: '完成图片 1', exact: true });
    await expect.poll(() => image.evaluate(node => node.naturalWidth)).toBeGreaterThan(0);
    await page.getByRole('textbox', { name: '家长反馈' }).fill('Synthetic honest checklist feedback');
    await page.getByRole('button', { name: '确认并发放星星' }).click();
    await expect(page.getByText('星星已到账')).toBeVisible();
    await childPage.reload(); await expect(childPage.getByText('Synthetic honest checklist feedback')).toBeVisible();
    await expect(childPage.getByRole('button', { name: '修改本次完成' })).toHaveCount(0);
    const stable = await runtime.inspect();
    expect(row(stable, task)).toMatchObject({ status: 'confirmed', checklistVersion: 2, completionVersion: 1,
      completionEvidence: { checkedItemIds: [task.checklistSnapshot[1].itemId],
        submittedByActor: { role: 'student', id: fixture.actors.child.userId } } });
    expect(stable.database.Ledger.filter(value => value.sourceId === task.taskId)).toHaveLength(1);
    for (const [width, height] of [[390, 844], [768, 1024], [1280, 800]]) {
      await childPage.setViewportSize({ width, height }); await screenshot(childPage, info, `grade-${grade}-read-${width}.png`);
      await page.setViewportSize({ width, height }); await screenshot(page, info, `grade-${grade}-review-${width}.png`);
    }
    expect(errors).toEqual([]); expect(childErrors).toEqual([]);
  } finally { await childContext.close(); }
});

test('parent edit uses the re-viewed checklist version and lost PATCH response is read, not replayed', async ({ page }) => {
  await login(page, 'parent'); const task = await createViaPage(page, 'Synthetic conflict checklist');
  await page.getByRole('button', { name: `编辑 ${task.title}`, exact: true }).click();
  await page.getByLabel('检查项 1', { exact: true }).fill('旧编辑');
  const coparent = await runtime.login('coparent');
  expectData(await coparent.patch(path(task), { expectedChecklistVersion: 1,
    checklistSnapshot: [{ ...task.checklistSnapshot[0], label: '共管新清单' }] }));
  await page.getByRole('button', { name: '保存任务' }).click();
  await expect(page.getByText('任务已被修改，请重新读取后再编辑。')).toBeVisible();
  await expect(page.getByLabel('检查项 1', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '重新读取任务', exact: true }).click();
  await expect(page.getByLabel('检查项 1', { exact: true })).toHaveValue('共管新清单');
  await page.getByLabel('检查项 1', { exact: true }).fill('已重读的修改');
  const bodies = [];
  page.on('request', request => {
    if (request.method() === 'PATCH' && new URL(request.url()).pathname === path(task)) bodies.push(request.postDataJSON());
  });
  runtime.dropNextResponse({ method: 'PATCH', path: path(task) });
  await page.getByRole('button', { name: '保存任务' }).click();
  await expect(page.getByText('保存结果尚未确认，已保留本次修改。请先重新读取任务。')).toBeVisible();
  expect(bodies).toHaveLength(1); expect(bodies[0].expectedChecklistVersion).toBe(2);
  const committed = await runtime.inspect(); expect(row(committed, task).checklistVersion).toBe(3);
  await page.getByRole('button', { name: '重新读取任务', exact: true }).click();
  await expect(page.getByLabel('检查项 1', { exact: true })).toHaveValue('已重读的修改');
  await expect(page.getByRole('button', { name: '保存任务' })).toBeEnabled();
  expect(bodies).toHaveLength(1); expect(await runtime.inspect()).toEqual(committed);
});

test('mixed material request survives both a lost remote commit reply and a lost public error without rebasing', async ({ page }) => {
  await login(page, 'parent'); const task = await createViaPage(page, 'Synthetic mixed original');
  await page.getByRole('button', { name: `编辑 ${task.title}`, exact: true }).click();
  await page.getByLabel('检查项 1', { exact: true }).fill('原混合清单');
  await page.getByLabel('任务标题', { exact: true }).fill('Synthetic mixed target');
  await page.getByLabel('任务附件', { exact: true }).setInputFiles({ name: fixture.image.name,
    mimeType: fixture.image.mimeType, buffer: fixture.image.bytes });
  await expect(page.getByText('已添加 1/100')).toBeVisible();
  const originalTask = row(await runtime.inspect(), task), bodies = [];
  runtime.dropNextResponse({ service: 'resource-service', method: 'POST', path: '/api/internal/media/references/commit' });
  await page.route(`**${path(task)}`, async route => {
    if (route.request().method() !== 'PATCH') return route.continue();
    bodies.push(route.request().postDataJSON());
    const response = await route.fetch({ maxRetries: 0 });
    if (bodies.length === 1) {
      expect(response.status()).toBe(503);
      expect((await response.json()).error.code).toBe('MEDIA_REFERENCE_PENDING');
      return route.abort('failed');
    }
    expect(response.status()).toBe(200); return route.fulfill({ response });
  });
  await page.getByRole('button', { name: '保存任务' }).click();
  await expect(page.getByRole('button', { name: '继续原修改' })).toBeVisible();
  const pending = await runtime.inspect();
  expect(row(pending, task).mediaReferenceState).toBe('pending');
  for (const key of ['title', 'checklistVersion', 'checklistSnapshot', 'attachmentMediaIds']) {
    expect(row(pending, task)[key]).toEqual(originalTask[key]);
  }
  await page.getByRole('button', { name: '重新读取任务', exact: true }).click();
  await expect(page.getByLabel('检查项 1', { exact: true })).toHaveValue('原混合清单');
  await expect(page.getByLabel('检查项 1', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '保存任务' })).toBeDisabled();
  expect(await runtime.inspect()).toEqual(pending);
  await page.getByRole('button', { name: '继续原修改' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(bodies).toHaveLength(2); expect(bodies[1]).toEqual(bodies[0]);
  const restored = await runtime.inspect(), recovered = row(restored, task);
  expect(recovered).toMatchObject({ title: 'Synthetic mixed target', checklistVersion: 2, mediaReferenceState: 'bound',
    checklistSnapshot: bodies[0].checklistSnapshot, attachmentMediaIds: bodies[0].attachmentMediaIds });
  expect(recovered.attachmentMediaBindings.map(binding => binding.mediaId)).toEqual(bodies[0].attachmentMediaIds);
  expect(recovered.attachmentMediaBindings.map(binding => binding.bindingOperationId))
    .toEqual(bodies[0].attachmentMediaIds.map(() => row(pending, task).mediaBindingOperationId));
  expect(restored.database.Reference.filter(reference => reference.resourceId === task.taskId).map(reference => ({
    mediaId: reference.mediaId, operationId: reference.operationId, state: reference.state
  }))).toEqual(recovered.attachmentMediaBindings.map(binding => ({ mediaId: binding.mediaId,
    operationId: binding.bindingOperationId, state: 'bound' })));
});

test('a stale coparent editor changing only checklist cannot overwrite newer materials', async ({ page }) => {
  await login(page, 'parent'); const task = await createViaPage(page, 'Synthetic stale materials');
  await page.getByRole('button', { name: `编辑 ${task.title}`, exact: true }).click();
  const coparent = await runtime.login('coparent'), form = new FormData();
  form.append('purpose', 'task_attachment'); form.append('childId', fixture.actors.child.childId);
  form.append('file', new Blob([fixture.image.bytes], { type: fixture.image.mimeType }), fixture.image.name);
  const media = expectData(await coparent.post('/api/media', form), 201).media;
  expectData(await coparent.patch(path(task), { attachmentMediaIds: [media.mediaId] }));
  const before = await runtime.inspect();
  await page.getByLabel('检查项 1', { exact: true }).fill('只修改清单');
  const sent = page.waitForRequest(request => request.method() === 'PATCH' && new URL(request.url()).pathname === path(task));
  await page.getByRole('button', { name: '保存任务' }).click();
  expect((await sent).postDataJSON()).not.toHaveProperty('attachmentMediaIds');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const after = await runtime.inspect();
  expect(row(after, task).checklistVersion).toBe(2);
  expect(row(after, task).attachmentMediaIds).toEqual([media.mediaId]);
  expect(row(after, task).attachmentMediaBindings).toEqual(row(before, task).attachmentMediaBindings);
  expect(after.database.Reference).toEqual(before.database.Reference);
  expect(after.files).toEqual(before.files);
});

test('child help remains visible after checklist-only save and can be resolved without refreshing the list', async ({ page, browser }) => {
  await login(page, 'parent'); const task = await createViaPage(page, 'Synthetic help projection');
  const childContext = await browser.newContext();
  const childPage = await childContext.newPage(), errors = monitor(page), childErrors = monitor(childPage);
  try {
    await login(childPage, 'child'); await openChildTask(childPage, task);
    await childPage.getByRole('button', { name: '我需要帮助', exact: true }).click();
    await childPage.getByRole('button', { name: '发送求助', exact: true }).click();
    await expect(childPage.getByText('求助已发送。')).toBeVisible();
    await page.reload();
    const card = page.locator('article').filter({ has: page.getByRole('heading', { name: task.title, exact: true }) });
    await expect(card.getByText(/待处理求助/)).toBeVisible();
    const before = await runtime.inspect();
    await page.getByRole('button', { name: `编辑 ${task.title}`, exact: true }).click();
    await page.getByLabel('检查项 1', { exact: true }).fill('仍需家长帮助');
    const requests = [];
    page.on('request', request => requests.push({ method: request.method(), pathname: new URL(request.url()).pathname }));
    const saved = page.waitForResponse(response => response.request().method() === 'PATCH'
      && new URL(response.url()).pathname === path(task));
    await page.getByRole('button', { name: '保存任务' }).click();
    const response = await saved;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).not.toHaveProperty('attachmentMediaIds');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(card.getByText(/待处理求助/)).toBeVisible();
    const returned = (await response.json()).data.task;
    expect(returned).toMatchObject({ helpVersion: 1, helpRequest: { status: 'pending' }, checklistVersion: 2 });
    expect(requests.filter(request => request.method === 'GET'
      && [path(task), '/api/growth-tasks'].includes(request.pathname))).toEqual([]);
    const after = await runtime.inspect();
    for (const field of ['helpVersion', 'helpRequest', 'completionVersion', 'completionEvidence', 'starAwardState']) {
      expect(row(after, task)[field]).toEqual(row(before, task)[field]);
    }
    expect(after.database.Ledger).toEqual(before.database.Ledger);
    expect(after.database.Operation).toEqual(before.database.Operation);
    await page.getByRole('button', { name: `求助 ${task.title}`, exact: true }).click();
    await page.getByLabel('给孩子的回应（可不填）').fill('Synthetic help after checklist edit');
    await page.getByRole('button', { name: '标记已处理', exact: true }).click();
    await expect(page.getByText('求助已处理。')).toBeVisible();
    await childPage.reload();
    await expect(childPage.getByText('Synthetic help after checklist edit', { exact: true })).toBeVisible();
    expect(errors).toEqual([]); expect(childErrors).toEqual([]);
  } finally { await childContext.close(); }
});

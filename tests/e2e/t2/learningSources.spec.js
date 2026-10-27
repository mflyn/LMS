const { test, expect } = require('@playwright/test');
const { createT2WebRuntime } = require('./webRuntime');
const { openParentTasks } = require('./parentNavigation');
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
    await page.getByLabel('家庭 ID').fill(actor.familyId); await page.getByLabel('孩子 ID').fill(actor.childId);
    await page.getByLabel('PIN').fill(actor.pin); await page.getByRole('button', { name: '进入我的成长空间' }).click();
    await expect(page).toHaveURL(/\/child\/today$/);
  } else {
    await page.getByLabel('用户名').fill(actor.username); await page.getByLabel('密码', { exact: true }).fill(actor.password);
    await page.getByRole('button', { name: '登录', exact: true }).click(); await expect(page).toHaveURL(/\/app\/today$/);
  }
}

test('child lost create keeps its lock across close, failed list read, reload and account return without repost', async ({ page }, info) => {
  await login(page, 'child');
  await page.goto(runtime.webUrl + '/child/mistakes');
  await page.getByRole('button', { name: '记录新错题', exact: true }).click();
  await page.getByLabel('科目', { exact: true }).fill('Synthetic unknown child record');
  await page.getByRole('combobox', { name: /错因/ }).selectOption('concept');
  await page.getByLabel('题目附件', { exact: true }).setInputFiles({ name: fixture.image.name,
    mimeType: fixture.image.mimeType, buffer: fixture.image.bytes });
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  let posts = 0;
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/mistakes') posts += 1; });
  runtime.dropNextResponse({ method: 'POST', path: '/api/mistakes' });
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('保存结果尚未确认');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('button', { name: '记录新错题', exact: true })).toBeDisabled();
  const before = await runtime.inspect();
  const saved = before.database.Mistake.filter(row => row.subject === 'Synthetic unknown child record');
  expect(saved).toHaveLength(1); expect(saved[0].questionMediaIds).toHaveLength(1);
  const interruptList = async route => {
    if (route.request().method() === 'GET') await route.abort('connectionfailed');
    else await route.continue();
  };
  await page.route('**/api/mistakes?*', interruptList);
  await page.getByRole('button', { name: '重新读取错题列表', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('保存结果仍未知');
  await expect(page.getByRole('button', { name: '记录新错题', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '已核对列表，结束本次记录', exact: true })).toHaveCount(0);
  await page.unroute('**/api/mistakes?*', interruptList);
  await page.reload();
  await expect(page.getByRole('button', { name: '记录新错题', exact: true })).toBeDisabled();
  await page.goto(runtime.webUrl + '/child/me');
  await page.getByRole('button', { name: '退出孩子端', exact: true }).click();
  await login(page, 'sibling'); await page.goto(runtime.webUrl + '/child/mistakes');
  await expect(page.getByRole('button', { name: '记录新错题', exact: true })).toBeEnabled();
  await expect(page.getByText('Synthetic unknown child record', { exact: true })).toHaveCount(0);
  await page.goto(runtime.webUrl + '/child/me');
  await page.getByRole('button', { name: '退出孩子端', exact: true }).click();
  await login(page, 'child'); await page.goto(runtime.webUrl + '/child/mistakes');
  await expect(page.getByRole('button', { name: '记录新错题', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '重新读取错题列表', exact: true }).click();
  await expect(page.getByRole('button', { name: '已核对列表，结束本次记录', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Synthetic unknown child record', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('child-unknown-create-list.png'), fullPage: true });
  await page.getByRole('button', { name: '已核对列表，结束本次记录', exact: true }).click();
  await expect(page.getByRole('button', { name: '记录新错题', exact: true })).toBeEnabled();
  expect(posts).toBe(1);
  const after = await runtime.inspect();
  for (const collection of ['Mistake', 'Reference', 'Asset', 'Ledger']) expect(after.database[collection]).toEqual(before.database[collection]);
  expect((await parent.get(`/api/media/${saved[0].questionMediaIds[0]}/access`)).status).toBe(200);
});

test('real pages connect source work, manual mistake image, correction review and child source revisit', async ({ page, browser }, info) => {
  const childContext = await browser.newContext({ viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true });
  const childPage = await childContext.newPage(), errors = [];
  for (const target of [page, childPage]) target.on('pageerror', error => errors.push(error.message));
  try {
    await login(childPage, 'child');
    await childPage.goto(runtime.webUrl + `/child/tasks/${fixture.tasks.child.taskId}`);
    await childPage.getByLabel('添加完成图片').setInputFiles({ name: fixture.image.name,
      mimeType: fixture.image.mimeType, buffer: fixture.image.bytes });
    await expect(childPage.getByText('已添加 1/10')).toBeVisible();
    await childPage.getByRole('button', { name: '提交完成情况', exact: true }).click();
    await expect(childPage.getByText('作品版本 1', { exact: true })).toBeVisible();
    await login(page, 'parent'); await openParentTasks(page, runtime.webUrl);
    await page.getByRole('button', { name: `查看 ${fixture.tasks.child.title}`, exact: true }).click();
    await page.getByRole('button', { name: '查看完成图片 1', exact: true }).click();
    await expect(page.getByRole('img', { name: '完成图片 1', exact: true })).toBeVisible();
    await page.getByRole('link', { name: '记录错题', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/mistakes/);
    const dialog = page.getByRole('dialog', { name: '记录错题', exact: true });
    await expect(dialog.getByText(`来源任务：${fixture.tasks.child.title}`)).toBeVisible();
    await dialog.getByLabel('学科', { exact: true }).fill('Math');
    await dialog.getByLabel('知识点', { exact: true }).fill('Synthetic source arithmetic');
    await dialog.getByLabel('提醒复习日期').fill('2026-10-27');
    await dialog.getByLabel('题目附件', { exact: true }).setInputFiles({ name: fixture.image.name,
      mimeType: fixture.image.mimeType, buffer: fixture.image.bytes });
    await expect(dialog.getByRole('button', { name: '保存错题', exact: true })).toBeEnabled();
    const saved = page.waitForResponse(response => response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/mistakes');
    await dialog.getByRole('button', { name: '保存错题', exact: true }).click();
    const savedResponse = await saved; expect(savedResponse.status()).toBe(201);
    const mistake = (await savedResponse.json()).data.mistake;
    expect(mistake.sourceTaskId).toBe(fixture.tasks.child.taskId);
    expect(mistake.questionMediaIds).toHaveLength(1);
    await page.getByRole('button', { name: '复盘 Synthetic source arithmetic', exact: true }).click();
    await expect(page.getByRole('link', { name: /查看来源任务/ })).toHaveAttribute('href', `/app/tasks?taskId=${fixture.tasks.child.taskId}`);
    await page.getByRole('button', { name: '创建订正任务', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/tasks/);
    const taskDialog = page.getByRole('dialog', { name: '新建任务', exact: true });
    await expect(taskDialog.getByLabel('学科', { exact: true })).toHaveValue('Math');
    await taskDialog.getByLabel('任务标题').fill('Synthetic browser correction');
    await taskDialog.getByLabel('截止日期', { exact: true }).fill('2026-10-27');
    const created = page.waitForResponse(response => response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/growth-tasks');
    await taskDialog.getByRole('button', { name: '保存任务', exact: true }).click();
    const createdResponse = await created; expect(createdResponse.status()).toBe(201);
    const task = (await createdResponse.json()).data.task;
    expect(task.sourceMistakeId).toBe(mistake.mistakeId);
    await childPage.goto(runtime.webUrl + `/child/tasks/${task.taskId}`);
    await expect(childPage.getByRole('link', { name: /查看来源错题/ })).toHaveAttribute('href', `/child/mistakes?mistakeId=${mistake.mistakeId}`);
    await childPage.getByLabel('我的一句话').fill('Synthetic correction reflection');
    await childPage.getByRole('button', { name: '提交完成情况', exact: true }).click();
    await expect(childPage.getByText('作品版本 1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '查看已保存任务', exact: true }).click();
    await page.getByRole('textbox', { name: '家长反馈', exact: true }).fill('Synthetic correction feedback');
    await page.getByRole('button', { name: '确认并发放星星', exact: true }).click();
    await expect(page.getByText('星星已到账', { exact: true })).toBeVisible();
    await childPage.reload();
    await expect(childPage.getByText('Synthetic correction feedback', { exact: true })).toBeVisible();
    await expect(childPage.getByRole('button', { name: '提交完成情况', exact: true })).toHaveCount(0);
    await childPage.getByRole('link', { name: /查看来源错题/ }).click();
    await expect(childPage).toHaveURL(/\/child\/mistakes/);
    await expect(childPage.getByRole('link', { name: /查看来源任务/ })).toBeVisible();
    await childPage.screenshot({ path: info.outputPath('child-source-review-ipad-layout.png'), fullPage: true });
    expect(await childPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await childPage.setViewportSize({ width: 390, height: 844 });
    await expect(childPage.getByRole('link', { name: /查看来源任务/ })).toBeVisible();
    expect(await childPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await childPage.screenshot({ path: info.outputPath('child-source-review-mobile-layout.png'), fullPage: true });
    expect(expectData(await parent.get(`/api/mistakes/${mistake.mistakeId}`)).mistake).toMatchObject({ mastered: false, reviewed: false, corrected: false });
    const snapshot = await runtime.inspect();
    expect(snapshot.database.Ledger.filter(row => row.sourceId === task.taskId)).toHaveLength(1);
    expect(snapshot.database.Task.find(row => row._id === fixture.tasks.child.taskId).status).toBe('completed');
    await page.getByRole('dialog', { name: '作品查看与审核', exact: true })
      .getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('navigation', { name: '家长导航', exact: true })
      .getByRole('link', { name: '提醒', exact: true }).click();
    await page.getByRole('link', { name: '复习此错题', exact: true }).click();
    const review = page.getByRole('dialog', { name: '错题复盘', exact: true });
    await expect(review.getByLabel('知识点', { exact: true })).toHaveValue('Synthetic source arithmetic');
    await expect(review.getByRole('checkbox', { name: '已复习', exact: true })).not.toBeChecked();
    await review.getByRole('checkbox', { name: '已复习', exact: true }).check();
    await review.getByRole('button', { name: '保存复盘', exact: true }).click();
    await expect(page.getByText('复盘已保存。', { exact: true })).toBeVisible();
    expect(expectData(await parent.get(`/api/mistakes/${mistake.mistakeId}`)).mistake)
      .toMatchObject({ reviewed: true, corrected: false, mastered: false });
    expect(errors).toEqual([]);
  } finally { await childContext.close(); }
});

test('a foreign source query cannot change selected child or prefill private source content', async ({ page }) => {
  await login(page, 'parent');
  await page.goto(runtime.webUrl + `/app/mistakes?sourceTaskId=${fixture.tasks.foreign.taskId}`);
  await expect(page.getByRole('alert')).toContainText('当前身份无法读取此记录');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(fixture.tasks.foreign.title, { exact: false })).toHaveCount(0);
  const before = await runtime.inspect();
  await page.reload();
  // The one-shot prefill query is consumed; reload must not restore the rejected source.
  await expect(page.getByRole('heading', { name: '错题', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(fixture.tasks.foreign.title, { exact: false })).toHaveCount(0);
  expect(await runtime.inspect()).toEqual(before);
});

test('non-default child source navigation preserves scope; lost create response retains bound media without reposting', async ({ page }) => {
  await login(page, 'parent');
  await page.getByLabel('当前孩子', { exact: true }).selectOption(fixture.actors.sibling.childId);
  await openParentTasks(page, runtime.webUrl);
  await page.getByRole('button', { name: `查看 ${fixture.tasks.sibling.title}`, exact: true }).click();
  await page.getByRole('link', { name: '记录错题', exact: true }).click();
  await expect(page.getByLabel('当前孩子', { exact: true })).toHaveValue(fixture.actors.sibling.childId);
  const dialog = page.getByRole('dialog', { name: '记录错题', exact: true });
  await expect(dialog.getByText(`来源任务：${fixture.tasks.sibling.title}`)).toBeVisible();
  await dialog.getByLabel('学科', { exact: true }).fill('Math');
  await dialog.getByLabel('知识点', { exact: true }).fill('Synthetic uncertain sibling mistake');
  await dialog.getByLabel('题目附件', { exact: true }).setInputFiles({ name: fixture.image.name,
    mimeType: fixture.image.mimeType, buffer: fixture.image.bytes });
  await expect(dialog.getByRole('button', { name: '保存错题', exact: true })).toBeEnabled();
  let creates = 0;
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/mistakes') creates += 1; });
  runtime.dropNextResponse({ method: 'POST', path: '/api/mistakes' });
  await dialog.getByRole('button', { name: '保存错题', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '核对错题列表', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '保存错题', exact: true })).toBeDisabled();
  const before = await runtime.inspect();
  const mistakes = before.database.Mistake.filter(row => row.knowledgePointName === 'Synthetic uncertain sibling mistake');
  expect(mistakes).toHaveLength(1);
  expect(mistakes[0].childId).toBe(fixture.actors.sibling.childId);
  const mistake = expectData(await parent.get(`/api/mistakes/${mistakes[0]._id}`)).mistake;
  expect(mistake.questionMediaIds).toHaveLength(1);
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByLabel('当前孩子', { exact: true }).selectOption(fixture.actors.child.childId);
  await expect(page.getByText('Synthetic uncertain sibling mistake', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: '错题', exact: true })).toBeVisible();
  await expect(page.getByText('Synthetic uncertain sibling mistake', { exact: true })).toHaveCount(0);
  expect(creates).toBe(1);
  const after = await runtime.inspect();
  expect(after.database.Mistake).toEqual(before.database.Mistake);
  expect(after.database.Reference).toEqual(before.database.Reference);
  expect(after.database.Asset).toEqual(before.database.Asset);
  expect((await parent.get(`/api/media/${mistake.questionMediaIds[0]}/access`)).status).toBe(200);
});

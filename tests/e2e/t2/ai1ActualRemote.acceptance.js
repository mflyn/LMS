const { test, expect } = require('@playwright/test');
const fs = require('fs/promises');
const { createT2WebRuntime } = require('./webRuntime');
const { expectData } = require('../../../backend/tests/t2/syntheticSeed');
const { openParentTasks } = require('./parentNavigation');

// Explicit cross-checkout acceptance: actual DeepTutor operation/store/SDK, synthetic Provider transport.
let runtime, previous;
test.afterEach(async () => {
  try { await runtime?.stop(); } finally {
    for (const [key, value] of Object.entries(previous || {})) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    runtime = null; previous = null;
  }
});
test('actual remote parent page: preview, recovery, revision, co-parent approval and relogin', async ({ page }, info) => {
  const origin = new URL(process.env.AI1_ACTUAL_REMOTE_ORIGIN);
  expect(origin.protocol).toBe('http:'); expect(origin.hostname).toBe('127.0.0.1');
  const source = process.env.AI1_ACTUAL_SOURCE, fault = process.env.AI1_ACTUAL_REMOTE_FAULT;
  expect(['task', 'mistake']).toContain(source); expect(['none', 'drop-response']).toContain(fault);
  const config = { AI1_MODE: 'enabled', AI1_ALLOW_LOOPBACK: 'true', AI1_LOCAL_STORE_CONTINUOUS: 'true',
    AI1_REMOTE_STORE_CONTINUOUS: 'true', AI1_PROVIDER_PROFILE_CONFIRMED: 'true', AI1_OPERATION_URL: origin.origin,
    AI1_OPERATION_TOKEN: 'synthetic-service-credential-00000001', AI1_MODEL_PROFILE: process.env.AI1_ACTUAL_REMOTE_PROFILE,
    AI1_BUDGET_LIMITS: JSON.stringify({ singleMicros: 16384, dayMicros: 163840, monthMicros: 163840, experimentMicros: 163840 }) };
  previous = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
  runtime = await createT2WebRuntime({ beforeStart: () => Object.assign(process.env, config) });
  const fixture = runtime.fixture, parent = await runtime.login('parent');
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin !== runtime.webUrl) { external.push('non-local request'); return route.abort(); }
    return route.continue();
  });
  const login = async actorName => {
    const actor = fixture.actors[actorName];
    await page.goto(runtime.webUrl + '/login');
    await page.getByLabel('用户名').fill(actor.username);
    await page.getByLabel('密码', { exact: true }).fill(actor.password);
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/today$/);
  };
  const logout = async () => {
    await page.getByRole('button', { name: '退出登录', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('6180', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.includes('ai1')))).toEqual([]);
  };
  const sourcePage = async () => {
    if (source === 'task') await openParentTasks(page, runtime.webUrl);
    else {
      await page.getByRole('navigation', { name: '家长导航', exact: true }).getByRole('link', { name: '错题', exact: true }).click();
      await expect(page).toHaveURL(runtime.webUrl + '/app/mistakes');
    }
    await page.getByLabel('当前孩子').selectOption(fixture.actors.child.childId);
  };
  const openExisting = async () => {
    await sourcePage();
    await page.getByRole('link', { name: '讲解记录', exact: true }).click();
    await page.getByRole('region', { name: '讲解记录', exact: true }).getByRole('button', { name: '查看讲解', exact: true }).click();
  };
  expectData(await parent.patch(`/api/growth-tasks/${fixture.tasks.child.taskId}`, { subject: 'math' }));
  let expectedSource = { type: 'task', id: fixture.tasks.child.taskId };
  if (source === 'mistake') {
    const form = new FormData(); form.append('purpose', 'mistake_question'); form.append('childId', fixture.actors.child.childId);
    form.append('file', new Blob([fixture.image.bytes], { type: fixture.image.mimeType }), fixture.image.name);
    const mediaId = expectData(await parent.post('/api/media', form), 201).media.mediaId;
    const createdMistake = expectData(await parent.post('/api/mistakes', { childId: fixture.actors.child.childId, subject: 'Math',
      reason: 'calculation', knowledgePointName: 'Synthetic math', questionMediaIds: [mediaId] }), 201).mistake;
    expectedSource = { type: 'mistake', id: createdMistake.mistakeId };
  }
  const before = await runtime.snapshot();
  await login('parent'); await sourcePage();
  await page.getByRole('link', { name: '准备讲解', exact: true }).click();
  await expect(page.getByLabel('题目文字', { exact: true })).toHaveValue('');
  await page.getByLabel('题目文字', { exact: true }).fill('Explain 206 * 30.');
  await page.getByLabel('已核对文字，不含个人信息或链接').check();
  const createdResponse = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/tutor-cycles');
  await page.getByRole('button', { name: '创建外发预览' }).click();
  const response = await createdResponse; expect(response.status()).toBe(201);
  const created = (await response.json()).data;
  expect(response.request().postDataJSON()).toMatchObject({ source: expectedSource, childId: fixture.actors.child.childId });
  expect(created.cycle).toMatchObject({ source: expectedSource, childId: fixture.actors.child.childId });
  await expect(page.getByRole('heading', { name: '完整外发预览', exact: true })).toBeVisible();
  expect(await page.getByRole('region', { name: '完整外发预览' }).locator('pre').allTextContents()).toEqual(created.preview.messages.map(m => m.content));
  await expect(page.getByRole('region', { name: '完整外发预览' }).getByText(/^费用上界 /)).toContainText('0.016384 元');
  await page.getByLabel('确认以上完整文字及费用上界，发送生成').check();
  await page.getByRole('button', { name: '生成候选讲解' }).click();
  const path = `/api/tutor-cycles/${created.cycle.id}`;
  if (fault === 'drop-response') {
    await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toBeEnabled();
    const unknown = expectData(await parent.get(path)); expect(unknown.job.status).toBe('unknown');
    await logout(); await login('coparent'); await openExisting();
    await expect(page.getByText('暂无待处理任务', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '恢复原任务', exact: true })).toHaveCount(0);
    await logout(); await login('parent'); await openExisting();
    await page.getByRole('button', { name: '恢复原任务', exact: true }).click();
    await expect(page.getByText('6180', { exact: true })).toBeVisible();
    const recovered = expectData(await parent.get(path));
    expect(recovered.job.id).toBe(unknown.job.id); expect(recovered.job.operationId).toBe(unknown.job.operationId);
  }
  await expect(page.getByText('6180', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText('6180', { exact: true })).toBeVisible();
  const revised = '206 * 3 = 618; 30 is 3 tens, so 206 * 30 = 6180.';
  await page.getByLabel('修订文字', { exact: true }).fill(revised);
  await page.getByLabel('修订原因', { exact: true }).fill('Clarify counting units.');
  await page.getByRole('button', { name: '保存修订版本' }).click();
  await expect(page.getByText(revised, { exact: true })).toBeVisible();
  await logout(); await login('coparent'); await openExisting();
  await expect(page.getByText(revised, { exact: true })).toBeVisible();
  for (const label of ['数学正确', '适合年级', '符合章节', '表述已核对']) await page.getByLabel(label, { exact: true }).check();
  await page.getByRole('button', { name: '批准所见版本' }).click();
  await expect(page.getByRole('heading', { name: '已批准', exact: true })).toBeVisible();
  await logout(); await login('parent'); await openExisting();
  await expect(page.getByRole('heading', { name: '已批准', exact: true })).toBeVisible();
  await expect(page.getByLabel('修订文字', { exact: true })).toHaveCount(0);
  expect(await page.locator('html').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('approved.png'), fullPage: true });
  const detail = expectData(await parent.get(path));
  expect(page.url()).toContain(`cycleId=${created.cycle.id}`);
  expect(detail.cycle).toMatchObject({ id: created.cycle.id, source: expectedSource, childId: fixture.actors.child.childId });
  expect(detail.artifacts).toHaveLength(2); expect(detail.artifacts[1].review.reviewerId).toBe(fixture.actors.coparent.userId);
  expect(detail.artifacts[1].derivedFromArtifactId).toBe(detail.artifacts[0].id);
  expect(detail.job.budget.settledMicros).toBe(200);
  expect(await runtime.snapshot()).toEqual(before); expect(errors).toEqual([]); expect(external).toEqual([]);
  const job = await require('../../../backend/services/homework-service/models/Ai1').Job.findOne().lean();
  const requests = (await fs.readFile(process.env.AI1_ACTUAL_REQUESTS, 'utf8')).trim().split('\n').map(JSON.parse);
  expect(requests).toEqual((fault === 'drop-response' ? ['PUT', 'GET'] : ['PUT']).map(method => ({ method, id: job.remoteOperationId })));
  await fs.writeFile(process.env.AI1_ACTUAL_RESULT, JSON.stringify({ remoteOperationId: job.remoteOperationId,
    requestHash: job.remoteRequestHash, previewMessages: created.preview.messages, previewOptions: created.preview.requestOptions }));
});

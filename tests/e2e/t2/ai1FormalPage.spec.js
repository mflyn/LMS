const { test, expect } = require('@playwright/test');
const express = require('express');
const { createHash } = require('crypto');
const { createT2WebRuntime } = require('./webRuntime');
const { expectData } = require('../../../backend/tests/t2/syntheticSeed');

// Real LMS services and login; only the external operation protocol is a double. No Provider exists here.
const generated = '206 * 30 = 6180. Synthetic explanation <script>window.ai1Executed=true</script>';
const revised = '206 * 3 = 618; 30 is 3 tens, so 206 * 30 = 6180.';
const sha = text => createHash('sha256').update(text).digest('hex');
let runtime, remoteServer, originalEnv, remote, fixture, parent, mistake, privateClients;
test.beforeEach(async () => {
  privateClients = {};
  remote = { puts: [], gets: [], records: new Map(), drop: false };
  const app = express(); app.use(express.json({ limit: '32kb' }));
  app.use((req, res, next) => req.get('x-ai1-service-token') === 'synthetic-ai1-browser-dedicated-32'
    ? next() : res.status(401).end());
  app.put('/internal/deeptutor/operations/:id', (req, res) => {
    remote.puts.push({ id: req.params.id, body: req.body });
    const b = req.body, operation = { remoteOperationId: req.params.id, requestHash: b.requestHash,
      modelProfileVersion: b.modelProfileVersion, pricingProfileVersion: b.pricingProfileVersion, sendNotAfter: b.sendNotAfter,
      status: 'succeeded', result: { text: generated, contentHash: sha(generated) }, error: null,
      usage: { inputTokens: 100, outputTokens: 50 }, sendClaimed: true, updatedAt: new Date().toISOString() };
    remote.records.set(req.params.id, operation);
    if (remote.drop) return req.socket.destroy();
    return res.json({ success: true, data: { operation } });
  });
  app.get('/internal/deeptutor/operations/:id', (req, res) => {
    remote.gets.push(req.params.id);
    const operation = remote.records.get(req.params.id);
    return operation ? res.json({ success: true, data: { operation } }) : res.status(404).json({ success: false });
  });
  remoteServer = await new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server)); server.once('error', reject);
  });
  const config = { AI1_MODE: 'enabled', AI1_ALLOW_LOOPBACK: 'true', AI1_LOCAL_STORE_CONTINUOUS: 'true',
    AI1_REMOTE_STORE_CONTINUOUS: 'true', AI1_PROVIDER_PROFILE_CONFIRMED: 'true',
    AI1_OPERATION_URL: `http://127.0.0.1:${remoteServer.address().port}`, AI1_OPERATION_TOKEN: 'synthetic-ai1-browser-dedicated-32',
    AI1_MODEL_PROFILE: JSON.stringify({ model: 'synthetic-no-provider', modelProfileVersion: 'synthetic-model-v1',
      pricingProfileVersion: 'synthetic-price-v1', checkedAt: new Date(Date.now() - 60000).toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(), callWindowMs: 60000, clockMarginMs: 5000,
      inputPriceMicrosPerMillion: 9000000, outputPriceMicrosPerMillion: 27000000 }),
    AI1_BUDGET_LIMITS: JSON.stringify({ singleMicros: 184320, dayMicros: 1843200, monthMicros: 1843200, experimentMicros: 1843200 }) };
  originalEnv = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
  let configured = false;
  runtime = await createT2WebRuntime({ beforeStart: () => { Object.assign(process.env, config); configured = true; } });
  expect(configured).toBe(true);
  fixture = runtime.fixture; parent = await runtime.login('parent');
  expectData(await parent.patch(`/api/growth-tasks/${fixture.tasks.child.taskId}`, { subject: ' \u6570\u5b66 ' }));
  const form = new FormData(); form.append('purpose', 'mistake_question'); form.append('childId', fixture.actors.child.childId);
  form.append('file', new Blob([fixture.image.bytes], { type: fixture.image.mimeType }), fixture.image.name);
  const mediaId = expectData(await parent.post('/api/media', form), 201).media.mediaId;
  mistake = expectData(await parent.post('/api/mistakes', { childId: fixture.actors.child.childId,
    subject: 'Math', reason: 'calculation', knowledgePointName: 'Synthetic math source', questionMediaIds: [mediaId] }), 201).mistake;
});
async function stopFixture() {
  try { await runtime?.stop(); } finally {
    try {
      if (remoteServer) await new Promise((resolve, reject) => {
        remoteServer.close(error => error ? reject(error) : resolve()); remoteServer.closeAllConnections?.();
      });
    } finally {
      for (const [key, value] of Object.entries(originalEnv || {})) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
      runtime = null; remoteServer = null; originalEnv = null;
    }
  }
}
test.afterEach(stopFixture);

async function login(page, name = 'parent') {
  const actor = fixture.actors[name];
  await page.goto(runtime.webUrl + '/login');
  await page.getByLabel('用户名').fill(actor.username);
  await page.getByLabel('密码', { exact: true }).fill(actor.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/today$/);
}
async function observe(page) {
  const observed = { errors: [], console: [], writes: [], external: [], media: [] };
  page.on('pageerror', error => observed.errors.push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) observed.console.push(message.text()); });
  page.on('request', request => {
    const url = new URL(request.url());
    if (request.method() === 'POST' && url.pathname.startsWith('/api/tutor-')) observed.writes.push({ path: url.pathname, body: request.postDataJSON() });
    if (url.pathname.startsWith('/api/media')) observed.media.push(url.pathname);
  });
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin !== runtime.webUrl) {
      observed.external.push('unexpected non-local request'); return route.abort();
    }
    return route.continue();
  });
  return observed;
}
async function preview(page, entry = 'tasks') {
  await login(page);
  await page.goto(runtime.webUrl + `/app/${entry}`);
  await page.getByLabel('当前孩子').selectOption(fixture.actors.child.childId);
  await page.getByRole('link', { name: '准备讲解', exact: true }).click();
  await expect(page.getByLabel('题目文字', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: '创建外发预览' })).toBeDisabled();
  await page.getByLabel('题目文字', { exact: true }).fill('Explain 206 * 30.');
  await page.getByLabel('已核对文字，不含个人信息或链接').check();
  const response = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/tutor-cycles');
  await page.getByRole('button', { name: '创建外发预览' }).click();
  const created = await response; expect(created.status()).toBe(201);
  const data = (await created.json()).data;
  const source = entry === 'tasks' ? { type: 'task', id: fixture.tasks.child.taskId } : { type: 'mistake', id: mistake.mistakeId };
  expect(created.request().postDataJSON()).toMatchObject({ source, childId: fixture.actors.child.childId });
  expect(data.cycle).toMatchObject({ source, childId: fixture.actors.child.childId });
  await expect(page.getByRole('heading', { name: '完整外发预览', exact: true })).toBeVisible();
  const displayed = await page.getByRole('region', { name: '完整外发预览' }).locator('pre').allTextContents();
  expect(displayed).toEqual(data.preview.messages.map(m => m.content));
  await expect(page.getByRole('region', { name: '完整外发预览' }).getByText(/^费用上界 /)).toContainText('0.184320 元');
  expect(remote.puts).toHaveLength(0);
  return data;
}
async function generate(page) {
  await page.getByLabel('确认以上完整文字及费用上界，发送生成').check();
  await page.getByRole('button', { name: '生成候选讲解' }).click();
}
async function checks(page) {
  for (const label of ['数学正确', '适合年级', '符合章节', '表述已核对']) await page.getByLabel(label, { exact: true }).check();
}
async function capture(page, info, name) {
  expect(await page.title()).toBeTruthy();
  await expect(page.locator('iframe#webpack-dev-server-client-overlay')).toHaveCount(0);
  expect(await page.locator('html').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(name), fullPage: true });
}

async function assertPrivateVersions(cycleId) {
  const detail = expectData(await parent.get(`/api/tutor-cycles/${cycleId}`));
  const paths = [`/api/tutor-cycles/${cycleId}`, `/api/tutor-jobs/${detail.job.id}`,
    ...detail.artifacts.map(item => `/api/tutor-artifacts/${item.id}`)];
  for (const actor of ['child', 'sibling', 'foreignChild', 'outsider']) {
    const client = privateClients[actor] || (privateClients[actor] = await runtime.login(actor));
    for (const path of paths) {
      const denied = await client.get(path);
      expect(denied.status, `${actor} ${path}`).toBe(actor === 'outsider' ? 404 : 403);
      expect(denied.data.success).toBe(false);
      for (const artifact of detail.artifacts) expect(JSON.stringify(denied.data)).not.toContain(artifact.text);
    }
  }
  for (const client of [parent, privateClients.child]) {
    for (const path of [`/api/growth-tasks/${fixture.tasks.child.taskId}`, `/api/mistakes/${mistake.mistakeId}`,
      `/api/growth-tasks?childId=${fixture.actors.child.childId}`, `/api/mistakes?childId=${fixture.actors.child.childId}`]) {
      const result = expectData(await client.get(path));
      for (const artifact of detail.artifacts) expect(JSON.stringify(result)).not.toContain(artifact.text);
      expect(JSON.stringify(result)).not.toMatch(/currentArtifactId|approvedArtifactId|generationInputHash/);
    }
  }
}

for (const entry of ['tasks', 'mistakes']) test(`AI1 formal ${entry}: preview, generate, co-parent review and relogin`, async ({ page, browser }, info) => {
  const seen = await observe(page), before = await runtime.snapshot();
  const created = await preview(page, entry); await generate(page);
  await expect(page.getByText(generated, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.ai1Executed)).toBeUndefined();
  await assertPrivateVersions(created.cycle.id);
  const detailUrl = page.url(); await page.reload();
  await expect(page.getByText(generated, { exact: true })).toBeVisible();
  await page.getByLabel('修订文字', { exact: true }).fill(revised);
  await page.getByLabel('修订原因', { exact: true }).fill('Clarify counting units.');
  await page.getByRole('button', { name: '保存修订版本' }).click();
  await expect(page.getByText(revised, { exact: true })).toBeVisible();
  await assertPrivateVersions(created.cycle.id);
  const context = await browser.newContext(), other = await context.newPage();
  const otherSeen = await observe(other);
  try {
    await login(other, 'coparent'); await other.goto(detailUrl);
    await other.getByLabel('当前孩子').selectOption(fixture.actors.child.childId);
    await expect(other.getByText(revised, { exact: true })).toBeVisible(); await checks(other);
    await other.getByRole('button', { name: '批准所见版本' }).click();
    await expect(other.getByRole('heading', { name: '已批准', exact: true })).toBeVisible();
  } finally { await context.close(); }
  await page.reload(); await expect(page.getByRole('heading', { name: '已批准', exact: true })).toBeVisible();
  await expect(page.getByLabel('修订文字', { exact: true })).toHaveCount(0);
  const detail = expectData(await parent.get(`/api/tutor-cycles/${created.cycle.id}`));
  expect(detail.cycle).toMatchObject({ source: created.cycle.source, childId: fixture.actors.child.childId });
  expect(detail.cycle.status).toBe('approved'); expect(detail.artifacts).toHaveLength(2);
  expect(detail.artifacts[0]).toMatchObject({ text: generated, contentHash: sha(generated), status: 'superseded' });
  expect(detail.artifacts[1]).toMatchObject({ text: revised, status: 'parent_approved', derivedFromArtifactId: detail.artifacts[0].id,
    review: { reviewerId: fixture.actors.coparent.userId, decision: 'approve' } });
  expect(detail.cycle.approvedArtifactId).toBe(detail.artifacts[1].id);
  await assertPrivateVersions(created.cycle.id);
  const clean = await browser.newContext(), returned = await clean.newPage();
  try {
    const returnedSeen = await observe(returned); await login(returned); await returned.goto(detailUrl);
    await returned.getByLabel('当前孩子').selectOption(fixture.actors.child.childId);
    await expect(returned.getByRole('heading', { name: '已批准', exact: true })).toBeVisible();
    await expect(returned.getByText(revised, { exact: true })).toBeVisible();
    expect(returnedSeen.errors).toEqual([]); expect(returnedSeen.console).toEqual([]); expect(returnedSeen.external).toEqual([]);
    expect(returnedSeen.media).toEqual([]); expect(returnedSeen.writes).toEqual([]);
  } finally { await clean.close(); }
  for (const width of [1280, 768, 390]) { await page.setViewportSize({ width, height: 1000 }); await capture(page, info, `${entry}-${width}.png`); }
  expect(remote.puts).toHaveLength(1); expect(remote.gets).toEqual([]);
  expect(remote.puts[0].body.messages).toEqual(created.preview.messages);
  for (const privateValue of [fixture.actors.child.childId, fixture.tasks.child.title, mistake.mistakeId]) {
    expect(JSON.stringify(remote.puts[0].body)).not.toContain(privateValue);
  }
  expect(seen.writes.map(w => w.path.split('/').at(-1))).toEqual(['tutor-cycles', 'explanation-jobs', 'explanation-revisions']);
  expect(otherSeen.writes).toHaveLength(1); expect(otherSeen.writes[0].body.artifactVersion).toBe(2);
  expect(seen.errors).toEqual([]); expect(seen.console).toEqual([]); expect(seen.external).toEqual([]);
  expect(otherSeen.errors).toEqual([]); expect(otherSeen.console).toEqual([]); expect(otherSeen.external).toEqual([]);
  expect(seen.media).toEqual([]); expect(otherSeen.media).toEqual([]);
  const after = await runtime.snapshot();
  expect(after.database).toEqual(before.database); expect(after.files).toEqual(before.files);
});

test('AI1 formal fixture restores all AI settings even when remote close reports failure', async () => {
  const expected = { ...originalEnv }, servers = runtime.servers.map(row => row.server), savedRemote = remoteServer;
  const close = savedRemote.close.bind(savedRemote);
  savedRemote.close = callback => close(() => callback(Object.assign(new Error('synthetic close failure'), { code: 'SYNTHETIC_CLOSE_FAILED' })));
  await expect(stopFixture()).rejects.toMatchObject({ code: 'SYNTHETIC_CLOSE_FAILED' });
  for (const [key, value] of Object.entries(expected)) expect(process.env[key]).toBe(value);
  expect(runtime).toBeNull(); expect(remoteServer).toBeNull(); expect(originalEnv).toBeNull();
  expect(servers.every(server => !server.listening)).toBe(true); expect(savedRemote.listening).toBe(false);
});

test('AI1 formal public response loss reloads and retries only the original generation', async ({ page }) => {
  const seen = await observe(page), created = await preview(page);
  runtime.dropNextResponse({ method: 'POST', path: `/api/tutor-cycles/${created.cycle.id}/explanation-jobs` });
  await generate(page);
  await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toBeEnabled();
  expect(seen.writes).toHaveLength(2); const original = seen.writes[1];
  const detailBefore = expectData(await parent.get(`/api/tutor-cycles/${created.cycle.id}`));
  expect(detailBefore.job.status).toBe('succeeded'); expect(detailBefore.artifacts).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toBeVisible();
  expect(seen.writes).toHaveLength(2); expect(remote.puts).toHaveLength(1);
  await page.getByRole('button', { name: '重试原命令', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toHaveCount(0);
  await expect(page.getByText(generated, { exact: true })).toBeVisible();
  expect(seen.writes).toHaveLength(3); expect(seen.writes[2]).toEqual(original);
  expect(remote.puts).toHaveLength(1); expect(remote.gets).toEqual([]);
  expect(expectData(await parent.get(`/api/tutor-cycles/${created.cycle.id}`))).toEqual(detailBefore);
  expect(runtime.droppedResponses).toHaveLength(1); expect(seen.errors).toEqual([]); expect(seen.external).toEqual([]);
  expect(seen.console).toHaveLength(1); expect(seen.console[0]).toMatch(/ERR_EMPTY_RESPONSE|ERR_CONNECTION_RESET/);
});

test('AI1 formal remote loss survives logout and only original actor explicitly recovers persisted mapping', async ({ page }) => {
  const seen = await observe(page), created = await preview(page); remote.drop = true;
  await generate(page);
  await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toBeEnabled();
  const detailUrl = page.url(), detail = expectData(await parent.get(`/api/tutor-cycles/${created.cycle.id}`));
  expect(detail.job.status).toBe('unknown'); expect(detail.artifacts).toEqual([]);
  expect(detail.job.budget.settledMicros).toBeNull(); expect(remote.puts).toHaveLength(1); expect(remote.gets).toEqual([]);
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Explain 206 * 30.', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.includes('ai1')))).toEqual([]);
  await login(page, 'coparent'); await page.goto(detailUrl);
  await page.getByLabel('当前孩子').selectOption(fixture.actors.child.childId);
  await expect(page.getByText('暂无待处理任务', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '恢复原任务', exact: true })).toHaveCount(0);
  expect(remote.puts).toHaveLength(1); expect(remote.gets).toEqual([]);
  const coparent = await runtime.login('coparent');
  expect((await coparent.post(`/api/tutor-jobs/${detail.job.id}/recover`, {
    schemaVersion: 'ai1-min-v1', operationId: require('crypto').randomUUID()
  })).status).toBe(403);
  await page.getByRole('button', { name: '退出登录', exact: true }).click(); await expect(page).toHaveURL(/\/login$/);
  await login(page); await page.goto(detailUrl);
  await page.getByLabel('当前孩子').selectOption(fixture.actors.child.childId);
  await expect(page.getByRole('button', { name: '恢复原任务', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '关闭讲解周期', exact: true })).toHaveCount(0);
  expect(seen.writes).toHaveLength(2); expect(remote.gets).toEqual([]);
  await page.getByRole('button', { name: '恢复原任务', exact: true }).click();
  await expect(page.getByText(generated, { exact: true })).toBeVisible();
  expect(seen.writes).toHaveLength(3); expect(seen.writes[2].path).toBe(`/api/tutor-jobs/${detail.job.id}/recover`);
  expect(remote.puts).toHaveLength(1); expect(remote.gets).toEqual([remote.puts[0].id]);
  const restored = expectData(await parent.get(`/api/tutor-cycles/${created.cycle.id}`));
  expect(restored.job.id).toBe(detail.job.id); expect(restored.job.operationId).toBe(detail.job.operationId);
  expect(restored.job.budget.settledMicros).toBe(2250); expect(restored.artifacts).toHaveLength(1);
  expect(restored.artifacts[0].createdBy).toBe(fixture.actors.parent.userId);
  expect(seen.errors).toEqual([]); expect(seen.external).toEqual([]);
  expect(seen.console).toHaveLength(1); expect(seen.console[0]).toContain('503');
});

test('AI1 formal co-parent stale approval requires reread and a new explicit decision', async ({ page, browser }) => {
  const seen = await observe(page), created = await preview(page); await generate(page);
  await expect(page.getByText(generated, { exact: true })).toBeVisible();
  const detailUrl = page.url(), original = expectData(await parent.get(`/api/tutor-cycles/${created.cycle.id}`));
  const context = await browser.newContext(), other = await context.newPage(), otherSeen = await observe(other);
  try {
    await login(other, 'coparent'); await other.goto(detailUrl);
    await other.getByLabel('当前孩子').selectOption(fixture.actors.child.childId);
    await expect(other.getByText(generated, { exact: true })).toBeVisible(); await checks(other);
    await page.getByLabel('修订文字', { exact: true }).fill(revised);
    await page.getByLabel('修订原因', { exact: true }).fill('Clarify counting units.');
    await page.getByRole('button', { name: '保存修订版本' }).click();
    await expect(page.getByText(revised, { exact: true })).toBeVisible();
    const conflict = other.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/explanation-review'));
    await other.getByRole('button', { name: '批准所见版本' }).click();
    expect((await conflict).status()).toBe(409);
    await expect(other.getByRole('alert')).toHaveText('候选已变化，请重新查看详情后决定。');
    await expect(other.getByRole('button', { name: '批准所见版本' })).toHaveCount(0);
    await expect(other.getByText(revised, { exact: true })).toHaveCount(0);
    const pending = expectData(await parent.get(`/api/tutor-cycles/${created.cycle.id}`));
    expect(pending.cycle.status).toBe('candidate'); expect(pending.cycle.approvedArtifactId).toBeNull();
    expect(pending.artifacts[1].status).toBe('candidate'); expect(pending.artifacts[1].review).toBeNull();
    expect(otherSeen.writes).toHaveLength(1);
    expect(otherSeen.writes[0].body).toMatchObject({ artifactId: original.artifacts[0].id,
      artifactVersion: 1, artifactContentHash: original.artifacts[0].contentHash,
      expectedCycleStateVersion: original.cycle.stateVersion });
    await other.getByRole('button', { name: '刷新详情', exact: true }).click();
    await expect(other.getByText(revised, { exact: true })).toBeVisible();
    await expect(other.getByRole('button', { name: '批准所见版本' })).toBeDisabled();
    await checks(other); await other.getByRole('button', { name: '批准所见版本' }).click();
    await expect(other.getByRole('heading', { name: '已批准', exact: true })).toBeVisible();
    expect(otherSeen.writes).toHaveLength(2);
    expect(otherSeen.writes[1].body).toMatchObject({ artifactId: pending.artifacts[1].id, artifactVersion: 2,
      artifactContentHash: pending.artifacts[1].contentHash, expectedCycleStateVersion: pending.cycle.stateVersion });
    const approved = expectData(await parent.get(`/api/tutor-cycles/${created.cycle.id}`));
    expect(approved.cycle).toMatchObject({ status: 'approved', approvedArtifactId: pending.artifacts[1].id });
    expect(approved.artifacts[1].review).toMatchObject({ reviewerId: fixture.actors.coparent.userId, decision: 'approve' });
    expect(remote.puts).toHaveLength(1); expect(remote.gets).toEqual([]);
    expect(seen.console).toEqual([]); expect(otherSeen.console).toHaveLength(1); expect(otherSeen.console[0]).toContain('409');
    expect(seen.errors).toEqual([]); expect(otherSeen.errors).toEqual([]); expect(otherSeen.external).toEqual([]);
  } finally { await context.close(); }
});

for (const decision of ['reject', 'approve']) test(`AI1 formal ${decision} response loss preserves original review and closing preserves audit`, async ({ page }) => {
  const seen = await observe(page), before = await runtime.snapshot(), created = await preview(page);
  await generate(page); await expect(page.getByText(generated, { exact: true })).toBeVisible();
  const label = decision === 'reject' ? '拒绝所见版本' : '批准所见版本';
  const status = decision === 'reject' ? 'rejected' : 'approved';
  const comment = decision === 'reject' ? 'Needs clearer counting units.' : 'Parent checked the synthetic explanation.';
  await expect(page.getByRole('button', { name: label, exact: true })).toBeDisabled();
  await page.getByLabel('审核意见', { exact: true }).fill(comment);
  if (decision === 'approve') await checks(page);
  runtime.dropNextResponse({ method: 'POST', path: `/api/tutor-cycles/${created.cycle.id}/explanation-review` });
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toBeEnabled();
  const rejected = expectData(await parent.get(`/api/tutor-cycles/${created.cycle.id}`));
  expect(rejected.cycle.status).toBe(status);
  expect(rejected.artifacts[0].review).toMatchObject({ decision, reviewerId: fixture.actors.parent.userId, comment });
  if (decision === 'approve') {
    expect(rejected.cycle.approvedArtifactId).toBe(rejected.artifacts[0].id);
    expect(rejected.artifacts[0].status).toBe('parent_approved');
  }
  await assertPrivateVersions(created.cycle.id);
  expect(seen.writes).toHaveLength(3); const original = seen.writes[2];
  await page.reload();
  await expect(page.getByRole('heading', { name: decision === 'reject' ? '已拒绝' : '已批准', exact: true })).toBeVisible();
  await expect(page.getByLabel('修订文字', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toBeEnabled();
  expect(seen.writes).toHaveLength(3);
  await page.getByRole('button', { name: '重试原命令', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toHaveCount(0);
  expect(seen.writes).toHaveLength(4); expect(seen.writes[3]).toEqual(original);
  expect(expectData(await parent.get(`/api/tutor-cycles/${created.cycle.id}`))).toEqual(rejected);
  await page.getByLabel('关闭原因', { exact: true }).fill('Keep reviewed version for parent audit.');
  await page.getByRole('button', { name: '关闭讲解周期', exact: true }).click();
  await expect(page.getByRole('heading', { name: '已关闭', exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText(generated, { exact: true })).toBeVisible();
  await expect(page.getByLabel('修订文字', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '关闭讲解周期', exact: true })).toHaveCount(0);
  const closed = expectData(await parent.get(`/api/tutor-cycles/${created.cycle.id}`));
  expect(closed.cycle.status).toBe('closed'); expect(closed.artifacts).toEqual(rejected.artifacts);
  await assertPrivateVersions(created.cycle.id);
  expect(closed.job).toEqual(rejected.job); expect(remote.puts).toHaveLength(1); expect(remote.gets).toEqual([]);
  expect(seen.writes).toHaveLength(5); expect(runtime.droppedResponses).toHaveLength(1);
  expect(seen.errors).toEqual([]); expect(seen.external).toEqual([]);
  expect(seen.console).toHaveLength(1); expect(seen.console[0]).toMatch(/ERR_EMPTY_RESPONSE|ERR_CONNECTION_RESET/);
  const after = await runtime.snapshot(); expect(after.database).toEqual(before.database); expect(after.files).toEqual(before.files);
});

test('AI1 formal revoked membership clears private reads and cancels earlier successful detail', async ({ page, browser }) => {
  await observe(page); const created = await preview(page); await generate(page);
  await expect(page.getByText(generated, { exact: true })).toBeVisible();
  const context = await browser.newContext(), other = await context.newPage(), seen = await observe(other);
  let release, reached, finished;
  const held = new Promise(resolve => { release = resolve; });
  const fetched = new Promise(resolve => { reached = resolve; });
  const terminal = new Promise(resolve => { finished = resolve; });
  try {
    await login(other, 'coparent'); await other.goto(page.url());
    await other.getByLabel('当前孩子').selectOption(fixture.actors.child.childId);
    await expect(other.getByText(generated, { exact: true })).toBeVisible();
    await other.getByLabel('修订文字', { exact: true }).fill('Private unfinished revision.');
    await other.route(`**/api/tutor-cycles/${created.cycle.id}`, async route => {
      try {
        const response = await route.fetch();
        reached({ status: response.status(), body: await response.json() });
        await held; await route.fulfill({ response });
      } finally { finished(); }
    });
    const cancelled = other.waitForEvent('requestfailed', { predicate: request => new URL(request.url()).pathname === `/api/tutor-cycles/${created.cycle.id}` });
    await other.getByRole('button', { name: '刷新详情', exact: true }).click();
    const earlier = await fetched; expect(earlier.status).toBe(200);
    expect(earlier.body.data.artifacts[0].text).toBe(generated);
    expect((await parent.delete(`/api/families/${fixture.familyId}/members/${fixture.actors.coparent.userId}`)).status).toBe(204);
    const denied = other.waitForResponse(r => new URL(r.url()).pathname === '/api/tutor-cycles' && r.status() === 403);
    await other.getByRole('button', { name: '刷新记录', exact: true }).click(); await denied;
    await expect(other.getByRole('alert')).toHaveText('当前身份无法继续查看这些私有讲解。');
    await expect(other.getByRole('region', { name: '讲解详情', exact: true })).toHaveCount(0);
    await expect(other.getByLabel('修订文字', { exact: true })).toHaveCount(0);
    expect((await cancelled).failure().errorText).toBe('net::ERR_ABORTED');
    release(); await terminal;
    await expect(other.getByText(generated, { exact: true })).toHaveCount(0);
    await expect(other.getByRole('region', { name: '讲解记录', exact: true })).toHaveCount(0);
    expect(seen.writes).toEqual([]); expect(seen.errors).toEqual([]); expect(seen.external).toEqual([]);
    expect(seen.console.every(line => line.includes('403'))).toBe(true);
    expect(remote.puts).toHaveLength(1); expect(remote.gets).toEqual([]);
    expect(expectData(await parent.get(`/api/tutor-cycles/${created.cycle.id}`)).artifacts[0].text).toBe(generated);
  } finally { release(); await context.close(); }
});

test('AI1 formal expired JWT preserves original generation through real login', async ({ page }) => {
  const seen = await observe(page), created = await preview(page); remote.drop = true;
  await generate(page); await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toBeEnabled();
  const detailUrl = page.url(), original = seen.writes[1];
  const sessionKey = 'family-growth.parent-session.v1';
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), sessionKey);
  const jwt = require('jsonwebtoken'), claims = jwt.decode(stored.token);
  const expired = jwt.sign({ ...claims, exp: Math.floor(Date.now() / 1000) - 1 }, process.env.JWT_SECRET);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: sessionKey, value: { ...stored, token: expired }
  });
  const expiredResponse = page.waitForResponse(r => r.url().includes('/api/') && r.status() === 401);
  await page.reload(); await expiredResponse; await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(generated, { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('family-growth.ai1-command.v1:')).length)).toBe(1);
  expect(seen.writes).toHaveLength(2); expect(remote.puts).toHaveLength(1); expect(remote.gets).toEqual([]);
  await login(page); await page.goto(detailUrl);
  await page.getByLabel('当前孩子').selectOption(fixture.actors.child.childId);
  await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toBeEnabled();
  expect(seen.writes).toHaveLength(2);
  await page.getByRole('button', { name: '重试原命令', exact: true }).click();
  await expect(page.getByText(generated, { exact: true })).toBeVisible();
  expect(seen.writes).toHaveLength(3); expect(seen.writes[2]).toEqual(original);
  expect(remote.puts).toHaveLength(1); expect(remote.gets).toEqual([remote.puts[0].id]);
  const detail = expectData(await parent.get(`/api/tutor-cycles/${created.cycle.id}`));
  expect(detail.job.status).toBe('succeeded'); expect(detail.job.budget.settledMicros).toBe(2250);
  expect(detail.artifacts).toHaveLength(1); expect(seen.errors).toEqual([]); expect(seen.external).toEqual([]);
  expect(seen.console.some(line => line.includes('401'))).toBe(true);
  expect(seen.console.every(line => /401|503/.test(line))).toBe(true);
});

test('AI1 formal cross-tab logout clears private draft and isolates a held successful response', async ({ page, context }) => {
  const seen = await observe(page), created = await preview(page); await generate(page);
  await expect(page.getByText(generated, { exact: true })).toBeVisible();
  await page.evaluate(() => { window.ai1DocumentMarker = 'same-document'; });
  const detailUrl = page.url(), tab = await context.newPage(); await observe(tab); await tab.goto(detailUrl);
  await expect(tab.getByText(generated, { exact: true })).toBeVisible();
  await page.getByLabel('修订文字', { exact: true }).fill('Private cross-tab draft.');
  let release, reached, finished;
  const held = new Promise(resolve => { release = resolve; });
  const fetched = new Promise(resolve => { reached = resolve; });
  const terminal = new Promise(resolve => { finished = resolve; });
  try {
    await page.route(`**/api/tutor-cycles/${created.cycle.id}`, async route => {
      try {
        const response = await route.fetch(); reached(response.status());
        await held; await route.fulfill({ response });
      } finally { finished(); }
    });
    const cancelled = page.waitForEvent('requestfailed', { predicate: request => new URL(request.url()).pathname === `/api/tutor-cycles/${created.cycle.id}` });
    await page.getByRole('button', { name: '刷新详情', exact: true }).click(); expect(await fetched).toBe(200);
    await tab.getByRole('button', { name: '退出登录', exact: true }).click();
    await expect(tab).toHaveURL(/\/login/); await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(generated, { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('修订文字', { exact: true })).toHaveCount(0);
    expect((await cancelled).failure().errorText).toBe('net::ERR_ABORTED');
    await login(tab, 'outsider');
    await expect(page.getByRole('heading', { name: '家长登录', exact: true })).toBeVisible();
    release(); await terminal;
    await expect(page.getByText(generated, { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('family-growth.parent-session.v1')).user.id)).toBe(fixture.actors.outsider.userId);
    expect(await page.evaluate(() => window.ai1DocumentMarker)).toBe('same-document');
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('family-growth.ai1-command.v1:')))).toEqual([]);
    expect(seen.writes).toHaveLength(2); expect(seen.errors).toEqual([]); expect(seen.external).toEqual([]);
    expect(remote.puts).toHaveLength(1); expect(remote.gets).toEqual([]);
  } finally { release(); await tab.close(); }
});

test('AI1 formal network refresh failure retains unknown command until explicit retry', async ({ page }) => {
  const seen = await observe(page), created = await preview(page); remote.drop = true;
  await generate(page); await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toBeEnabled();
  const original = seen.writes[1], detailPath = `/api/tutor-cycles/${created.cycle.id}`;
  const commands = () => page.evaluate(() => Object.fromEntries(Object.keys(sessionStorage)
    .filter(key => key.startsWith('family-growth.ai1-command.v1:')).map(key => [key, sessionStorage.getItem(key)])));
  const saved = await commands(); expect(Object.keys(saved)).toHaveLength(1);
  const before = expectData(await parent.get(detailPath)); expect(before.job.status).toBe('unknown');
  const failRead = route => route.abort('failed');
  await page.route(`**${detailPath}`, failRead);
  const failed = page.waitForEvent('requestfailed', { predicate: request => new URL(request.url()).pathname === detailPath });
  await page.getByRole('button', { name: '刷新详情', exact: true }).click();
  expect((await failed).failure().errorText).toBe('net::ERR_FAILED');
  await expect(page.getByRole('alert')).toHaveText('本次结果暂未确认，请保留原命令并显式核对。');
  await expect(page.getByRole('region', { name: '讲解详情', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toBeEnabled();
  expect(await commands()).toEqual(saved); expect(seen.writes).toHaveLength(2);
  expect(remote.puts).toHaveLength(1); expect(remote.gets).toEqual([]);
  expect(expectData(await parent.get(detailPath))).toEqual(before);
  await page.unroute(`**${detailPath}`, failRead);
  const read = page.waitForResponse(r => new URL(r.url()).pathname === detailPath && r.status() === 200);
  await page.getByRole('button', { name: '刷新详情', exact: true }).click(); await read;
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await commands()).toEqual(saved); expect(seen.writes).toHaveLength(2); expect(remote.gets).toEqual([]);
  await page.getByRole('button', { name: '重试原命令', exact: true }).click();
  await expect(page.getByText(generated, { exact: true })).toBeVisible();
  expect(seen.writes).toHaveLength(3); expect(seen.writes[2]).toEqual(original);
  expect(remote.puts).toHaveLength(1); expect(remote.gets).toEqual([remote.puts[0].id]);
  expect(await commands()).toEqual({}); expect(seen.errors).toEqual([]); expect(seen.external).toEqual([]);
  expect(seen.console).toHaveLength(2); expect(seen.console.some(line => line.includes('ERR_FAILED'))).toBe(true);
  expect(seen.console.some(line => line.includes('503'))).toBe(true);
});

test('AI1 formal child switch clears unknown local command but preserves server discovery', async ({ page }) => {
  const seen = await observe(page), created = await preview(page); remote.drop = true;
  await generate(page); await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toBeEnabled();
  const detailPath = `/api/tutor-cycles/${created.cycle.id}`, before = expectData(await parent.get(detailPath));
  expect(before.job.status).toBe('unknown');
  let release, reached, finished;
  const held = new Promise(resolve => { release = resolve; });
  const fetched = new Promise(resolve => { reached = resolve; });
  const terminal = new Promise(resolve => { finished = resolve; });
  const holdRead = async route => {
    try { const response = await route.fetch(); reached(response.status()); await held; await route.fulfill({ response }); }
    finally { finished(); }
  };
  await page.route(`**${detailPath}`, holdRead);
  try {
    const cancelled = page.waitForEvent('requestfailed', { predicate: request => new URL(request.url()).pathname === detailPath });
    await page.getByRole('button', { name: '刷新详情', exact: true }).click(); expect(await fetched).toBe(200);
    await page.getByLabel('当前孩子').selectOption(fixture.actors.sibling.childId);
    await expect(page.getByRole('alert')).toHaveText('该入口不属于当前选择的孩子。');
    expect((await cancelled).failure().errorText).toBe('net::ERR_ABORTED');
    await expect(page.getByRole('region', { name: '讲解详情', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('family-growth.ai1-command.v1:')))).toEqual([]);
    release(); await terminal; await page.unroute(`**${detailPath}`, holdRead);
    await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toHaveCount(0);
    expect(seen.writes).toHaveLength(2); expect(remote.gets).toEqual([]);
    expect(expectData(await parent.get(detailPath))).toEqual(before);
    await page.getByLabel('当前孩子').selectOption(fixture.actors.child.childId);
    await expect(page.getByRole('button', { name: '恢复原任务', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '关闭讲解周期', exact: true })).toHaveCount(0);
    expect(seen.writes).toHaveLength(2); expect(remote.gets).toEqual([]);
    await page.getByRole('button', { name: '恢复原任务', exact: true }).click();
    await expect(page.getByText(generated, { exact: true })).toBeVisible();
    expect(seen.writes).toHaveLength(3); expect(seen.writes[2].path).toBe(`/api/tutor-jobs/${before.job.id}/recover`);
    expect(remote.puts).toHaveLength(1); expect(remote.gets).toEqual([remote.puts[0].id]);
    const after = expectData(await parent.get(detailPath)); expect(after.job.id).toBe(before.job.id);
    expect(after.artifacts).toHaveLength(1); expect(after.job.budget.settledMicros).toBe(2250);
    expect(seen.errors).toEqual([]); expect(seen.external).toEqual([]);
    expect(seen.console).toHaveLength(1); expect(seen.console[0]).toContain('503');
  } finally { release(); }
});

test('AI1 formal late expired JWT response cannot expire the new actor', async ({ page, context }) => {
  const seen = await observe(page), created = await preview(page); await generate(page);
  await expect(page.getByText(generated, { exact: true })).toBeVisible();
  const sessionKey = 'family-growth.parent-session.v1', jwt = require('jsonwebtoken');
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), sessionKey);
  const expiresAt = Math.floor(Date.now() / 1000) + 10;
  const token = jwt.sign({ ...jwt.decode(stored.token), exp: expiresAt }, process.env.JWT_SECRET);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: sessionKey, value: { ...stored, token } });
  await page.reload(); await expect(page.getByText(generated, { exact: true })).toBeVisible();
  await page.evaluate(() => { window.ai1DocumentMarker = 'same-document'; });
  const tab = await context.newPage(), tabSeen = await observe(tab);
  let release, reached, finished;
  const held = new Promise(resolve => { release = resolve; });
  const fetched = new Promise(resolve => { reached = resolve; });
  const terminal = new Promise(resolve => { finished = resolve; });
  const detailPath = `/api/tutor-cycles/${created.cycle.id}`;
  try {
    await page.route(`**${detailPath}`, async route => {
      try {
        // Let the actual signed credential expire on the real Gateway clock, not a synthetic 401 body.
        await new Promise(resolve => setTimeout(resolve, Math.max(0, expiresAt * 1000 + 50 - Date.now())));
        const response = await route.fetch(); reached({ status: response.status(), body: await response.json() });
        await held; await route.fulfill({ response });
      } finally { finished(); }
    });
    const cancelled = page.waitForEvent('requestfailed', { predicate: request => new URL(request.url()).pathname === detailPath });
    await page.getByRole('button', { name: '刷新详情', exact: true }).click();
    const rejected = await fetched; expect(rejected.status).toBe(401); expect(rejected.body.success).toBe(false);
    expect(JSON.stringify(rejected.body)).not.toContain(generated);
    await login(tab, 'outsider');
    await expect(page.getByText(generated, { exact: true })).toHaveCount(0);
    expect((await cancelled).failure().errorText).toBe('net::ERR_ABORTED');
    const fresh = await tab.evaluate(key => JSON.parse(localStorage.getItem(key)), sessionKey);
    expect(fresh.user.id).toBe(fixture.actors.outsider.userId); expect(fresh.token).not.toBe(token);
    release(); await terminal;
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), sessionKey)).toEqual(fresh);
    expect(await page.evaluate(() => window.ai1DocumentMarker)).toBe('same-document');
    await expect(page.getByText('会话已过期，请重新登录。', { exact: true })).toHaveCount(0);
    await expect(tab.getByRole('heading', { name: '今日成长', exact: true })).toBeVisible();
    expect(expectData(await runtime.api.asParent(fresh.token).get('/api/families/me')).family.familyId).toBe(fixture.foreignFamilyId);
    expect(seen.writes).toHaveLength(2); expect(tabSeen.writes).toEqual([]);
    expect(remote.puts).toHaveLength(1); expect(remote.gets).toEqual([]);
    expect(seen.errors).toEqual([]); expect(tabSeen.errors).toEqual([]); expect(seen.external).toEqual([]);
  } finally { release(); await tab.close(); }
});

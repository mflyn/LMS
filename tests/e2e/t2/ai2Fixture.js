const http = require('http');
const { createHash } = require('crypto');
const { expect } = require('@playwright/test');
const { createT2WebRuntime } = require('./webRuntime');
const { expectData } = require('../../../backend/tests/t2/syntheticSeed');

const explanation = '124 x 23: first multiply by 3 ones, then by 2 tens; align the counting units.';
const question = '124 x 23';
const pathname = url => new URL(url).pathname;
const flags = ['AI1_MODE', 'AI1_LOCAL_STORE_CONTINUOUS', 'AI1_REMOTE_STORE_CONTINUOUS',
  'AI1_OPERATION_URL', 'AI1_OPERATION_TOKEN', 'AI1_ALLOW_LOOPBACK', 'AI2_MODE', 'AI2_STORE_CONTINUOUS'];

async function createAi2Fixture() {
  const prior = Object.fromEntries(flags.map(key => [key, process.env[key]]));
  let runtime, sentinel, calls = 0;
  const stop = async () => {
    try { await runtime?.stop(); }
    finally {
      try {
        if (sentinel?.listening) await new Promise((resolve, reject) => {
          sentinel.close(error => error ? reject(error) : resolve()); sentinel.closeAllConnections();
        });
      } finally {
        for (const [key, value] of Object.entries(prior)) {
          if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
      }
    }
  };
  try {
    // A rejecting local sentinel proves that the read-only AI1 input never invokes an operation provider.
    sentinel = await new Promise((resolve, reject) => {
      const server = http.createServer((_req, res) => { calls++; res.writeHead(503); res.end(); });
      server.listen(0, '127.0.0.1', () => resolve(server)); server.once('error', reject);
    });
    runtime = await createT2WebRuntime({ beforeStart: async () => {
      Object.assign(process.env, { AI1_MODE: 'query-only', AI1_LOCAL_STORE_CONTINUOUS: 'true',
        AI1_REMOTE_STORE_CONTINUOUS: 'true', AI1_ALLOW_LOOPBACK: 'true',
        AI1_OPERATION_URL: `http://127.0.0.1:${sentinel.address().port}`,
        AI1_OPERATION_TOKEN: 'synthetic-ai25-readonly-operation-token-32',
        AI2_MODE: 'enabled', AI2_STORE_CONTINUOUS: 'true' });
    } });
    const A = require('../../../backend/services/homework-service/models/Ai1');
    const M = require('../../../backend/services/homework-service/models/Ai2');
    const Task = require('../../../backend/services/homework-service/models/GrowthTask');
    const { fixture } = runtime, taskId = fixture.tasks.child.taskId;
    await Task.updateOne({ _id: taskId }, { $set: { subject: 'math' } });
    const id = () => new Task.db.base.Types.ObjectId();
    const cycleId = id(), artifactId = id();
    // Only an already human-approved AI1 artifact is seeded; every AI2 transition uses formal HTTP.
    await A.Cycle.create({ _id: cycleId, familyId: fixture.familyId, childId: fixture.actors.child.childId,
      createdBy: fixture.actors.parent.userId, sourceType: 'task', sourceId: taskId, sourceSubject: 'math',
      subjectAliasVersion: 'math-v1', input: { questionText: question, answerText: 'PRIVATE_AI2_ANSWER', parentContext: 'PRIVATE_AI2_CONTEXT' },
      chapter: { provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper',
        textbookLabel: 'Synthetic textbook', chapterLabel: 'Multiplication' }, inputHash: '1'.repeat(64), preview: {},
      status: 'approved', active: true, stateVersion: 4, currentArtifactId: artifactId, approvedArtifactId: artifactId });
    await A.Artifact.create({ _id: artifactId, familyId: fixture.familyId, childId: fixture.actors.child.childId,
      cycleId, version: 1, text: explanation, contentHash: createHash('sha256').update(explanation).digest('hex'),
      createdBy: fixture.actors.parent.userId, origin: 'parent_revision', generation: {}, status: 'parent_approved', reviewVersion: 2 });
    const parent = await runtime.login('parent');
    const baseline = await runtime.snapshot();
    const ai1Snapshot = async () => Object.fromEntries(await Promise.all(Object.entries(A).map(async ([name, model]) =>
      [name, JSON.parse(JSON.stringify(await model.collection.find({}).sort({ _id: 1 }).toArray()))])));
    const ai1Before = await ai1Snapshot();
    const unchanged = async () => {
      expect(calls).toBe(0);
      const ai1After = await ai1Snapshot();
      // Publishing locks the approved source through one version CAS, but cannot change its content or budget.
      expect(ai1After.Cycle).toHaveLength(1);
      expect(ai1After.Cycle[0].stateVersion).toBe(ai1Before.Cycle[0].stateVersion + 1);
      expect(new Date(ai1After.Cycle[0].updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(ai1Before.Cycle[0].updatedAt).getTime());
      expect(ai1After).toEqual({ ...ai1Before, Cycle: [{ ...ai1Before.Cycle[0],
        stateVersion: ai1Before.Cycle[0].stateVersion + 1, updatedAt: ai1After.Cycle[0].updatedAt }] });
      const after = await runtime.snapshot();
      for (const name of ['Task', 'Ledger', 'Mistake', 'MistakeStateEvent', 'DailyPlan']) {
        expect(after.database[name]).toEqual(baseline.database[name]);
      }
    };
    return { ...runtime, stop, parent, M, cycleId: String(cycleId), explanation, question, unchanged,
      publicationUrl: runtime.webUrl + `/app/learning?childId=${fixture.actors.child.childId}&cycleId=${cycleId}` };
  } catch (error) { await stop(); throw error; }
}

async function login(page, runtime, name = 'parent') {
  const actor = runtime.fixture.actors[name];
  const todayReady = () => {
    const childId = actor.pin ? actor.childId : runtime.fixture.actors.child.childId;
    const checks = [
      url => url.pathname === '/api/growth-tasks' && url.searchParams.get('scope') === 'today',
      url => url.pathname === '/api/growth-tasks' && url.searchParams.get('status') === 'pending',
      url => url.pathname === '/api/notifications/family',
      url => url.pathname.startsWith(`/api/children/${childId}/daily-learning-plans/`)
    ];
    if (!actor.pin) checks.push(url => url.pathname === '/api/reports/weekly', url => url.pathname === '/api/mistakes');
    // Do not hard-navigate away while Today is still initializing; WebKit reports interrupted requests as page errors.
    return Promise.all(checks.map(matches => page.waitForResponse(response => response.request().method() === 'GET'
      && new URL(response.url()).origin === runtime.webUrl && matches(new URL(response.url()))).then(async response => {
      expect(response.status()).toBe(200); expect(await response.finished()).toBeNull();
    })));
  };
  if (actor.pin) {
    await page.goto(runtime.webUrl + '/child/login');
    await page.getByLabel('家庭 ID').fill(actor.familyId);
    await page.getByLabel('孩子 ID').fill(actor.childId);
    await page.getByLabel('PIN', { exact: true }).fill(actor.pin);
    await Promise.all([todayReady(), page.getByRole('button', { name: '进入我的成长空间', exact: true }).click()]);
    await expect(page).toHaveURL(/\/child\/today$/);
  } else {
    await page.goto(runtime.webUrl + '/login');
    await page.getByLabel('用户名').fill(actor.username);
    await page.getByLabel('密码', { exact: true }).fill(actor.password);
    await Promise.all([todayReady(), page.getByRole('button', { name: '登录', exact: true }).click()]);
    await expect(page).toHaveURL(/\/app\/today$/);
  }
}

async function publish(page, runtime) {
  await login(page, runtime);
  await page.goto(runtime.publicationUrl);
  await page.getByLabel('当前孩子').selectOption(runtime.fixture.actors.child.childId);
  const preview = page.getByRole('region', { name: '孩子可见预览', exact: true });
  await expect(preview.getByText(explanation, { exact: true })).toBeVisible();
  await page.getByLabel('确认以上孩子可见内容').check();
  const result = page.waitForResponse(r => pathname(r.url()) === '/api/ai2/learning-packages' && r.request().method() === 'POST');
  await page.getByRole('button', { name: '发布给孩子', exact: true }).click();
  const response = await result; expect(response.status()).toBe(201);
  const body = await response.json(); expect(body.success).toBe(true);
  await expect(page.getByRole('link', { name: '查看学习包', exact: true })).toBeVisible();
  return body.data.package.id;
}

async function openPackage(page, runtime, packageId, role = 'parent') {
  await page.goto(runtime.webUrl + `/${role === 'parent' ? 'app' : 'child'}/learning?childId=${runtime.fixture.actors.child.childId}&packageId=${packageId}`);
  if (role === 'parent') await page.getByLabel('当前孩子').selectOption(runtime.fixture.actors.child.childId);
  await expect(page.getByRole('region', { name: '学习包详情', exact: true })).toBeVisible();
}
async function upload(page, runtime, name = 'synthetic-correction.png') {
  await page.getByLabel('添加订正图片', { exact: true }).setInputFiles({ name, mimeType: 'image/png', buffer: runtime.fixture.image.bytes });
  await expect(page.getByRole('button', { name: '提交订正', exact: true })).toBeEnabled();
}
async function submit(page, note = 'Synthetic child correction') {
  await page.getByRole('textbox', { name: '订正说明', exact: true }).fill(note);
  const response = page.waitForResponse(r => /\/api\/ai2\/learning-packages\/[^/]+\/attempts$/.test(pathname(r.url()))
    && r.request().method() === 'POST');
  await page.getByRole('button', { name: '提交订正', exact: true }).click();
  expect((await response).status()).toBe(201);
  await expect(page.getByRole('region', { name: '学习包详情', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '查看学习包', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '查看学习包', exact: true }).click();
  await expect(page.getByRole('heading', { name: '等待家长审核', exact: true })).toBeVisible();
}
async function viewImage(page) {
  const current = page.getByRole('article').filter({ has: page.getByRole('heading', { name: /当前订正/ }) });
  await current.getByRole('button', { name: '查看订正图片 1', exact: true }).click();
  const image = current.getByRole('img', { name: '订正图片 1', exact: true });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(node => node.naturalWidth)).toBeGreaterThan(0);
}
async function observe(page, runtime) {
  const seen = { errors: [], console: [], external: [], writes: [], failed: [] };
  page.on('pageerror', e => seen.errors.push(e.message));
  page.on('console', m => { if (['warning', 'error'].includes(m.type())) seen.console.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) seen.failed.push({ status: r.status(), path: pathname(r.url()) }); });
  page.on('request', r => {
    if (r.method() === 'POST' && pathname(r.url()).startsWith('/api/ai2/')) seen.writes.push({ path: pathname(r.url()), body: r.postDataJSON() });
  });
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin !== runtime.webUrl) {
      seen.external.push('non-local request'); return route.abort();
    }
    return route.continue();
  });
  return seen;
}
async function capture(page, info, name) {
  await expect(page).toHaveTitle(/\S/);
  await expect(page.locator('body')).not.toHaveText('');
  await expect(page.locator('iframe#webpack-dev-server-client-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(name), fullPage: true });
}
module.exports = { createAi2Fixture, login, publish, openPackage, upload, submit, viewImage, observe, capture, expectData, pathname };

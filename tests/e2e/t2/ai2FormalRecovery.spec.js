const { test, expect } = require('@playwright/test');
const { createAi2Fixture, login, publish, openPackage, upload, submit, viewImage, observe, capture,
  expectData, pathname } = require('./ai2Fixture');

let runtime;
test.beforeEach(async () => { runtime = await createAi2Fixture(); });
test.afterEach(async ({ context }) => {
  try { for (const page of context.pages()) await page.unrouteAll({ behavior: 'wait' }); }
  finally { try { await runtime?.stop(); } finally { runtime = null; } }
});

const packagePath = id => `/api/ai2/learning-packages/${id}`;
const submitPath = id => packagePath(id) + '/attempts';
const json = value => JSON.parse(JSON.stringify(value));
const writesTo = (seen, target) => seen.writes.filter(write => write.path === target);
const localCommands = page => page.evaluate(() => Object.fromEntries(Object.keys(sessionStorage)
  .filter(key => key.startsWith('family-growth.ai2-command.v1:'))
  .map(key => [key, sessionStorage.getItem(key)])));
const ai2Snapshot = async () => Object.fromEntries(await Promise.all(Object.entries(runtime.M)
  .map(async ([name, model]) => [name, json(await model.collection.find({}).sort({ _id: 1 }).toArray())])));
const retainedMedia = async () => {
  const snapshot = await runtime.snapshot();
  return { files: snapshot.files, database: Object.fromEntries([
    'Asset', 'Reference', 'RemoteOperation', 'UploadGuard', 'Retirement', 'Tombstone', 'Receipt'
  ].map(name => [name, snapshot.database[name]])) };
};
const submission = packageId => runtime.M.Command.findOne({ packageId, endpointOperation: 'ai2.submit' }).lean();
const mapping = command => json(Object.fromEntries(['_id', 'operationId', 'remoteOperationId', 'packageId', 'attemptId',
  'attemptVersion', 'actorId', 'familyId', 'childId', 'payload', 'requestHash', 'references', 'referencesHash']
  .map(key => [key, command[key]])));
async function logout(page) {
  await page.goto(runtime.webUrl + '/child/me');
  await page.getByRole('button', { name: '退出孩子端', exact: true }).click();
  await expect(page).toHaveURL(/\/child\/login$/);
}
async function childPackage(page, packageId) {
  await login(page, runtime, 'child');
  await openPackage(page, runtime, packageId, 'child');
}
async function followResult(page) {
  const link = page.getByRole('link', { name: '查看学习包', exact: true });
  await expect(link).toBeVisible();
  await link.click();
  // This must work even when the link targets the current URL, without reload/goto.
  await expect(page.getByRole('heading', { name: '等待家长审核', exact: true })).toBeVisible();
}

// Hold actual upstream responses, never synthesize a successful body. All held jobs are drained on exit.
async function holdResponses(page, matches) {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const state = { first: null, jobs: new Set(), fetchErrors: [], fulfillErrors: [], released: false };
  const pattern = url => matches(url.pathname);
  const handler = route => {
    const job = (async () => {
      if (route.request().method() !== 'GET') return route.continue();
      let response;
      try {
        response = await route.fetch({ maxRetries: 0, timeout: 10000 });
        if (!state.first) state.first = { status: response.status(), headers: response.headers(),
          body: response.headers()['content-type']?.includes('application/json') ? await response.json() : null };
        await held;
        try { await route.fulfill({ response }); }
        catch (error) { state.fulfillErrors.push(error.message); }
      } catch (error) {
        state.fetchErrors.push(error.message);
        try { await route.abort(); } catch { /* The request can already be cancelled by session teardown. */ }
      } finally { await response?.dispose(); }
    })();
    state.jobs.add(job);
    void job.finally(() => state.jobs.delete(job)).catch(() => {});
    return job;
  };
  await page.route(pattern, handler);
  return { state, release: () => { state.released = true; release(); }, dispose: async () => {
    state.released = true; release();
    await page.unroute(pattern, handler);
    await Promise.allSettled([...state.jobs]);
  } };
}

test('AI2 committed public response loss retries the exact original body and UUID without a second Attempt', async ({ page }, info) => {
  const seen = await observe(page, runtime), packageId = await publish(page, runtime);
  await childPackage(page, packageId); await upload(page, runtime);
  await page.getByLabel('订正说明', { exact: true }).fill('Synthetic exact replay correction.');
  runtime.dropNextResponse({ method: 'POST', path: submitPath(packageId) });
  await page.getByRole('button', { name: '提交订正', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toBeEnabled();
  await expect.poll(async () => (await submission(packageId))?.phase).toBe('SUCCEEDED');
  expect(runtime.droppedResponses).toEqual([expect.objectContaining({ service: 'api-gateway', method: 'POST', path: submitPath(packageId) })]);
  const original = writesTo(seen, submitPath(packageId));
  expect(original).toHaveLength(1);
  const saved = await localCommands(page);
  expect(Object.values(saved).map(value => JSON.parse(value).body)).toEqual([original[0].body]);
  const before = await ai2Snapshot(), mediaBefore = await retainedMedia();
  expect(before.Attempt).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toBeEnabled();
  expect(writesTo(seen, submitPath(packageId))).toEqual(original);
  expect(await localCommands(page)).toEqual(saved);
  await page.getByRole('button', { name: '重试原命令', exact: true }).click();
  await followResult(page);
  expect(writesTo(seen, submitPath(packageId))).toEqual([original[0], original[0]]);
  expect(await ai2Snapshot()).toEqual(before);
  expect(await retainedMedia()).toEqual(mediaBefore);
  expect(await localCommands(page)).toEqual({});
  const detail = expectData(await runtime.parent.get(packagePath(packageId))).package;
  expect(detail.currentAttemptId).toBe(String(before.Attempt[0]._id));
  await viewImage(page); await capture(page, info, 'ai2-exact-submit-replay.png');
  expect(seen.errors).toEqual([]); expect(seen.external).toEqual([]);
  await runtime.unchanged();
});

test('AI2 remote commit loss survives real PIN relogin and only explicit original-command recovery publishes', async ({ page }, info) => {
  const seen = await observe(page, runtime), packageId = await publish(page, runtime);
  await childPackage(page, packageId); await upload(page, runtime);
  await page.getByLabel('订正说明', { exact: true }).fill('Synthetic durable pending correction.');
  runtime.dropNextResponse({ service: 'resource-service', method: 'POST', path: '/api/internal/media/references/commit' });
  const pendingResponse = page.waitForResponse(response => pathname(response.url()) === submitPath(packageId)
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: '提交订正', exact: true }).click();
  const pending = await pendingResponse;
  expect(pending.status()).toBe(202); expect((await pending.json()).data.pending).toBe(true);
  await expect(page.getByText('提交仍在处理中，请查询并恢复原提交。', { exact: true })).toBeVisible();
  const original = await submission(packageId), before = await ai2Snapshot(), mediaBefore = await retainedMedia();
  expect(original.phase).toBe('MEDIA_PREPARED');
  expect(before.Attempt).toEqual([]);
  expect(mediaBefore.database.RemoteOperation.filter(row => row.operationId === original.remoteOperationId))
    .toEqual([expect.objectContaining({ state: 'COMMITTED' })]);
  expect(runtime.droppedResponses).toEqual([expect.objectContaining({ service: 'resource-service', method: 'POST',
    path: '/api/internal/media/references/commit' })]);
  expect(writesTo(seen, submitPath(packageId))).toHaveLength(1);
  expect(writesTo(seen, submitPath(packageId))[0].body.operationId).toBe(original.operationId);
  expect(original.remoteOperationId).not.toBe(original.operationId);
  const writesBefore = json(seen.writes);
  await logout(page); expect(await localCommands(page)).toEqual({});
  await childPackage(page, packageId);
  const recover = page.getByRole('button', { name: '恢复原提交', exact: true });
  await expect(recover).toBeEnabled();
  const reads = page.waitForResponse(response => pathname(response.url()) === '/api/ai2/commands'
    && response.request().method() === 'GET');
  await page.getByRole('button', { name: '刷新学习包记录', exact: true }).click();
  expect((await reads).status()).toBe(200);
  // Wait out the real persisted owner lease; discovery/relogin must not mutate it or auto-recover.
  expect(Number.isFinite(new Date(original.leaseExpiresAt).getTime())).toBe(true);
  await expect.poll(() => Date.now(), { timeout: 35000, intervals: [250, 500, 1000] })
    .toBeGreaterThan(new Date(original.leaseExpiresAt).getTime());
  expect(await ai2Snapshot()).toEqual(before);
  expect(await retainedMedia()).toEqual(mediaBefore);
  expect(seen.writes).toEqual(writesBefore);
  const target = `/api/ai2/commands/${original._id}/recover`;
  const recoveredResponse = page.waitForResponse(response => pathname(response.url()) === target && response.request().method() === 'POST');
  await recover.click();
  expect((await recoveredResponse).status()).toBe(200);
  await followResult(page);
  const after = await ai2Snapshot(), completed = await submission(packageId);
  expect(completed.phase).toBe('SUCCEEDED'); expect(mapping(completed)).toEqual(mapping(original));
  expect(after.Attempt).toHaveLength(1);
  expect(after.Attempt[0]).toMatchObject({ _id: String(original.attemptId), submitCommandId: String(original._id), mediaBindings: json(original.references) });
  expect(after.Command.filter(row => row.endpointOperation === 'ai2.submit')).toHaveLength(1);
  expect(writesTo(seen, submitPath(packageId))).toHaveLength(1);
  expect(writesTo(seen, target)).toEqual([{ path: target, body: { schemaVersion: 'ai2-min-v1', operationId: original.operationId } }]);
  expect(seen.writes).toEqual([...writesBefore, { path: target,
    body: { schemaVersion: 'ai2-min-v1', operationId: original.operationId } }]);
  expect(await retainedMedia()).toEqual(mediaBefore);
  expect(await localCommands(page)).toEqual({});
  await viewImage(page); await capture(page, info, 'ai2-explicit-original-recovery.png');
  expect(seen.errors).toEqual([]); expect(seen.external).toEqual([]);
  await runtime.unchanged();
});

for (const kind of ['detail GET', 'authenticated media']) {
  test(`AI2 same-context logout and sibling login reject a held successful ${kind} response`, async ({ page, context }, info) => {
    const seen = await observe(page, runtime), packageId = await publish(page, runtime);
    await childPackage(page, packageId); await upload(page, runtime);
    await submit(page, 'Synthetic private cross-tab correction.');
    const tab = await context.newPage();
    let hold;
    try {
      const otherSeen = await observe(tab, runtime);
      await tab.goto(runtime.webUrl + '/child/me');
      await page.bringToFront();
      await viewImage(page);
      const image = page.getByRole('img', { name: '订正图片 1', exact: true });
      const oldBlob = await image.getAttribute('src'); expect(oldBlob).toMatch(/^blob:/);
      await page.evaluate(() => { window.ai2RecoveryDocument = 'same-document'; });
      const before = await ai2Snapshot(), mediaBefore = await retainedMedia(), writesBefore = json(seen.writes);
      const matches = target => kind === 'detail GET' ? target === packagePath(packageId)
        : /^\/api\/media\/[^/]+\/authenticated-content$/.test(target);
      hold = await holdResponses(page, matches);
      if (kind === 'detail GET') await page.getByRole('button', { name: '刷新学习包详情', exact: true }).click();
      else await page.getByRole('button', { name: '查看订正图片 1', exact: true }).click();
      await expect.poll(() => hold.state.first?.status).toBe(200);
      if (kind === 'detail GET') expect(hold.state.first.body.data.package.id).toBe(packageId);
      else expect(hold.state.first.headers['content-type']).toMatch(/^image\/png/);
      await tab.getByRole('button', { name: '退出孩子端', exact: true }).click();
      await expect(tab).toHaveURL(/\/child\/login$/);
      await expect(page.getByRole('region', { name: '学习包详情', exact: true })).toHaveCount(0);
      await expect(page.getByLabel('订正说明', { exact: true })).toHaveCount(0);
      expect(await localCommands(page)).toEqual({});
      await login(tab, runtime, 'sibling');
      const siblingSession = await tab.evaluate(() => localStorage.getItem('family-growth.child-session.v1'));
      expect(JSON.parse(siblingSession).child.childId).toBe(runtime.fixture.actors.sibling.childId);
      hold.release(); await hold.dispose();
      expect(hold.state.fetchErrors).toEqual([]);
      // Fulfillment can be cancelled by the old document's AbortController; no other error is ignored.
      expect(hold.state.fulfillErrors.every(message => /already handled|closed|cancel|abort|Invalid InterceptionId/i.test(message))).toBe(true);
      await expect(page.getByRole('img', { name: '订正图片 1', exact: true })).toHaveCount(0);
      await expect(page.getByText('Synthetic private cross-tab correction.', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('region', { name: '学习包详情', exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => window.ai2RecoveryDocument)).toBe('same-document');
      expect(await page.evaluate(() => localStorage.getItem('family-growth.child-session.v1'))).toBe(siblingSession);
      expect(await localCommands(page)).toEqual({});
      expect(await page.evaluate(async url => { try { await fetch(url); return true; } catch { return false; } }, oldBlob)).toBe(false);
      await tab.reload(); await expect(tab).toHaveURL(/\/child\/today$/);
      await expect(tab.getByRole('banner').getByText('Synthetic sibling', { exact: true })).toBeVisible();
      expect(await ai2Snapshot()).toEqual(before); expect(await retainedMedia()).toEqual(mediaBefore);
      expect(seen.writes).toEqual(writesBefore); expect(otherSeen.writes).toEqual([]);
      expect(seen.errors).toEqual([]); expect(otherSeen.errors).toEqual([]);
      expect(seen.external).toEqual([]); expect(otherSeen.external).toEqual([]);
      await capture(tab, info, `ai2-late-${kind === 'detail GET' ? 'detail' : 'media'}-sibling.png`);
      await runtime.unchanged();
    } finally {
      try { await hold?.dispose(); } finally { await tab.close(); }
    }
  });
}

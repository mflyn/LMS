const { test, expect } = require('@playwright/test');
const { createAi2Fixture, login, publish, openPackage, upload, submit, viewImage,
  observe, capture, expectData, pathname } = require('./ai2Fixture');

let runtime;
test.beforeEach(async () => { runtime = await createAi2Fixture(); });
test.afterEach(async () => { await runtime?.stop(); runtime = null; });

function healthy(seen, allowedFailures = [], transportAbort = false) {
  expect(seen.errors).toEqual([]);
  expect(seen.external).toEqual([]);
  for (const failure of seen.failed) expect(allowedFailures).toContainEqual(failure);
  for (const line of seen.console) {
    const status = /^Failed to load resource: the server responded with a status of (\d+) \([^)]*\)$/.exec(line);
    expect(Boolean(status && allowedFailures.some(failure => failure.status === Number(status[1])))
      || (transportAbort && line === 'Failed to load resource: net::ERR_FAILED')).toBe(true);
  }
}

test('AI2 co-parent review conflict clears stale detail and preserves the first audit until explicit re-view', async ({ page, browser }, info) => {
  const seen = await observe(page, runtime), contexts = [];
  let release, heldHandler, reviewPath;
  try {
    const packageId = await publish(page, runtime);
    const childContext = await browser.newContext(); contexts.push(childContext);
    const child = await childContext.newPage(), childSeen = await observe(child, runtime);
    await login(child, runtime, 'child'); await openPackage(child, runtime, packageId, 'student');
    await upload(child, runtime); await submit(child);
    const coContext = await browser.newContext(); contexts.push(coContext);
    const coparent = await coContext.newPage(), coSeen = await observe(coparent, runtime);
    await login(coparent, runtime, 'coparent'); await openPackage(coparent, runtime, packageId);
    await openPackage(page, runtime, packageId); await viewImage(page);
    const before = expectData(await runtime.parent.get(`/api/ai2/learning-packages/${packageId}`)).package;
    const attemptId = before.currentAttemptId;
    reviewPath = `/api/ai2/learning-packages/${packageId}/attempts/${attemptId}/review`;
    const gate = new Promise(resolve => { release = resolve; });
    let held = false;
    heldHandler = async route => {
      held = true; await gate; await route.continue();
    };
    await page.route(runtime.webUrl + reviewPath, heldHandler);
    await page.getByLabel('审核反馈', { exact: true }).fill('Stale parent approval must not win.');
    await page.getByRole('button', { name: '通过所见订正', exact: true }).click();
    await expect.poll(() => held).toBe(true);

    await coparent.getByLabel('审核反馈', { exact: true }).fill('First audit: please align the tens row.');
    const firstResponse = coparent.waitForResponse(r => pathname(r.url()) === reviewPath && r.request().method() === 'POST');
    await coparent.getByRole('button', { name: '退回再订正', exact: true }).click();
    expect((await firstResponse).status()).toBe(200);
    await expect(coparent.getByRole('link', { name: '查看学习包', exact: true })).toBeVisible();
    const first = expectData(await runtime.parent.get(`/api/ai2/learning-packages/${packageId}`)).package;
    const firstAudit = first.attempts.find(a => a.id === attemptId).review;
    expect(firstAudit).toMatchObject({ reviewerId: runtime.fixture.actors.coparent.userId,
      decision: 'revise', comment: 'First audit: please align the tens row.' });

    const conflictResponse = page.waitForResponse(r => pathname(r.url()) === reviewPath && r.request().method() === 'POST');
    release();
    const conflict = await conflictResponse;
    expect(conflict.status()).toBe(409);
    expect((await conflict.json()).error.code).toBe('AI2_REVIEW_CONFLICT');
    await expect(page.getByText('订正或审核已变化，请重新查看详情后决定。', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: '学习包详情', exact: true })).toHaveCount(0);
    await expect(page.getByRole('img', { name: '订正图片 1', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '重试原命令', exact: true })).toHaveCount(0);
    const ownReviews = () => seen.writes.filter(write => write.path === reviewPath);
    expect(ownReviews()).toHaveLength(1);
    expect(ownReviews()[0].body.expectedPackageVersion).toBe(before.stateVersion);
    expect(coSeen.writes.filter(write => write.path === reviewPath)).toHaveLength(1);
    await page.getByRole('button', { name: '刷新学习包详情', exact: true }).click();
    await expect(page.getByRole('heading', { name: '请再订正', exact: true })).toBeVisible();
    await expect(page.getByText(/家长反馈：请再订正 First audit:/)).toBeVisible();
    await expect(page.getByRole('button', { name: '通过所见订正', exact: true })).toHaveCount(0);
    await expect(page.getByRole('img', { name: '订正图片 1', exact: true })).toHaveCount(0);
    await viewImage(page);
    const after = expectData(await runtime.parent.get(`/api/ai2/learning-packages/${packageId}`)).package;
    expect(after.stateVersion).toBe(first.stateVersion);
    expect(after.attempts.find(a => a.id === attemptId).review).toEqual(firstAudit);
    expect(ownReviews()).toHaveLength(1);
    await capture(page, info, 'ai2-first-audit-preserved.png');
    healthy(seen, [{ path: reviewPath, status: 409 }]); healthy(childSeen); healthy(coSeen);
    await runtime.unchanged();
  } finally {
    release?.();
    try { if (heldHandler) await page.unrouteAll({ behavior: 'wait' }); }
    finally { await Promise.all(contexts.map(context => context.close())); }
  }
});

test('AI2 parent child switch clears private views and sibling PIN cannot read details or media', async ({ page, browser }, info) => {
  const seen = await observe(page, runtime), contexts = [];
  try {
    const packageId = await publish(page, runtime), detailPath = `/api/ai2/learning-packages/${packageId}`;
    const childContext = await browser.newContext(); contexts.push(childContext);
    const child = await childContext.newPage(), childSeen = await observe(child, runtime);
    await login(child, runtime, 'child'); await openPackage(child, runtime, packageId, 'student');
    await upload(child, runtime); await submit(child);
    await openPackage(page, runtime, packageId);
    const accessResponse = page.waitForResponse(r => /^\/api\/media\/[^/]+\/access$/.test(pathname(r.url())));
    await viewImage(page);
    const access = (await (await accessResponse).json()).data;
    const mediaId = access.media.mediaId, accessPath = `/api/media/${mediaId}/access`;
    const contentUrl = new URL(access.access.url, runtime.webUrl);
    const contentPath = contentUrl.pathname + contentUrl.search;
    const detail = expectData(await runtime.parent.get(detailPath)).package;
    const attemptPath = `${detailPath}/attempts/${detail.currentAttemptId}`;
    const readsAfterSwitch = [];
    page.on('request', request => {
      if (request.method() === 'GET') readsAfterSwitch.push(pathname(request.url()));
    });
    await page.getByLabel('当前孩子').selectOption(runtime.fixture.actors.sibling.childId);
    await expect(page.getByText('该入口不属于当前孩子。', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: '学习包详情', exact: true })).toHaveCount(0);
    await expect(page.getByRole('img', { name: '订正图片 1', exact: true })).toHaveCount(0);
    await expect(page.getByText(runtime.explanation, { exact: true })).toHaveCount(0);
    // Matching the selected child in the URL must still fail package-list ownership verification.
    await page.goto(runtime.webUrl + `/app/learning?childId=${runtime.fixture.actors.sibling.childId}&packageId=${packageId}`);
    await page.getByLabel('当前孩子').selectOption(runtime.fixture.actors.sibling.childId);
    await expect(page.getByText('当前身份无法查看这些私有学习内容。', { exact: true })).toBeVisible();
    expect(readsAfterSwitch).not.toContain(detailPath);
    expect(readsAfterSwitch.some(path => path.startsWith(`/api/media/${mediaId}/`))).toBe(false);
    await capture(page, info, 'ai2-parent-child-scope-denied.png');

    const siblingContext = await browser.newContext(); contexts.push(siblingContext);
    const sibling = await siblingContext.newPage(), siblingSeen = await observe(sibling, runtime);
    await login(sibling, runtime, 'sibling');
    let authorization;
    sibling.on('request', request => {
      if (pathname(request.url()).startsWith('/api/ai2/')) authorization = request.headers().authorization || authorization;
    });
    const siblingUrl = runtime.webUrl + `/child/learning?childId=${runtime.fixture.actors.sibling.childId}&packageId=${packageId}`;
    const deniedResponse = sibling.waitForResponse(r => pathname(r.url()) === detailPath);
    await sibling.goto(siblingUrl);
    expect((await deniedResponse).status()).toBe(404);
    await expect(sibling.getByText('当前身份无法查看这些私有学习内容。', { exact: true })).toBeVisible();
    await expect(sibling.getByRole('region', { name: '学习包详情', exact: true })).toHaveCount(0);
    await expect(sibling.getByRole('img', { name: '订正图片 1', exact: true })).toHaveCount(0);
    expect(typeof authorization).toBe('string');
    // Reuse only this browser's actual sibling login credential, never the owner's credential.
    const denied = await sibling.evaluate(async ({ paths, authorization }) => {
      const results = [];
      for (const path of paths) {
        const response = await fetch(path, { headers: { Authorization: authorization }, cache: 'no-store' });
        results.push({ status: response.status, type: response.headers.get('content-type'), body: await response.json() });
      }
      return results;
    }, { paths: [attemptPath, accessPath, contentPath], authorization });
    expect(denied.map(result => result.status)).toEqual([404, 403, 403]);
    expect(denied.map(result => result.body.error.code)).toEqual(['RESOURCE_NOT_FOUND', 'CHILD_ACCESS_DENIED', 'CHILD_ACCESS_DENIED']);
    for (const result of denied) {
      expect(result.type).toContain('application/json'); expect(result.body.success).toBe(false);
      expect(result.body.data).toBeUndefined(); expect(JSON.stringify(result.body)).not.toContain(runtime.explanation);
    }
    expect(siblingSeen.writes).toEqual([]);
    await capture(sibling, info, 'ai2-sibling-private-content-denied.png');
    healthy(seen); healthy(childSeen);
    healthy(siblingSeen, [{ path: detailPath, status: 404 }, { path: attemptPath, status: 404 },
      { path: accessPath, status: 403 }, { path: contentUrl.pathname, status: 403 }]);
    await runtime.unchanged();
  } finally { await Promise.all(contexts.map(context => context.close())); }
});

test('AI2 partial upload failure survives manual and focus refresh, and ordinary removal never deletes media', async ({ page, browser }, info) => {
  const seen = await observe(page, runtime);
  let context, child, uploadHandler;
  try {
    const packageId = await publish(page, runtime), detailPath = `/api/ai2/learning-packages/${packageId}`;
    context = await browser.newContext(); child = await context.newPage();
    const childSeen = await observe(child, runtime), deletes = [], successfulUploads = [];
    child.on('request', request => { if (request.method() === 'DELETE') deletes.push(pathname(request.url())); });
    child.on('response', response => {
      if (pathname(response.url()) === '/api/media' && response.request().method() === 'POST') successfulUploads.push(response);
    });
    await login(child, runtime, 'child'); await openPackage(child, runtime, packageId, 'student');
    let uploads = 0, aborted = 0;
    uploadHandler = async route => {
      if (route.request().method() !== 'POST') return route.continue();
      uploads++;
      if (uploads === 2) { aborted++; return route.abort('failed'); }
      return route.continue();
    };
    await child.route(runtime.webUrl + '/api/media', uploadHandler);
    await child.getByLabel('添加订正图片', { exact: true }).setInputFiles(
      ['retained.png', 'transport-failure.png', 'removable.png'].map(name => ({ name, mimeType: 'image/png', buffer: runtime.fixture.image.bytes })));
    const failed = child.getByRole('button', { name: '忽略失败 transport-failure.png', exact: true });
    const submitButton = child.getByRole('button', { name: '提交订正', exact: true });
    await expect(failed).toBeEnabled();
    await expect(child.getByText('已添加 2/10', { exact: true })).toBeVisible();
    await expect(submitButton).toBeDisabled();
    expect(uploads).toBe(3); expect(aborted).toBe(1); expect(successfulUploads).toHaveLength(2);
    const uploaded = await Promise.all(successfulUploads.map(async response => {
      expect(response.status()).toBe(201); return (await response.json()).data.media.mediaId;
    }));
    const note = child.getByRole('textbox', { name: '订正说明', exact: true });
    await note.fill('Keep successful uploads across read-only refreshes.');
    for (const refresh of ['manual', 'focus']) {
      const refreshed = child.waitForResponse(r => pathname(r.url()) === detailPath && r.request().method() === 'GET');
      if (refresh === 'manual') await child.getByRole('button', { name: '刷新学习包详情', exact: true }).click();
      else await child.evaluate(() => window.dispatchEvent(new Event('focus')));
      const response = await refreshed;
      expect(response.status()).toBe(200); await response.finished();
      // Let the response-driven React commit run before asserting draft state survived it.
      await child.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await expect(failed).toBeEnabled();
      await expect(child.getByText('已添加 2/10', { exact: true })).toBeVisible();
      await expect(submitButton).toBeDisabled();
      await expect(note).toHaveValue('Keep successful uploads across read-only refreshes.');
      expect(childSeen.writes).toEqual([]); expect(uploads).toBe(3);
    }
    await capture(child, info, 'ai2-partial-upload-refresh-blocked.png');
    await child.getByRole('button', { name: '移除订正图片 2', exact: true }).click();
    await expect(child.getByText('已添加 1/10', { exact: true })).toBeVisible();
    await expect(submitButton).toBeDisabled(); expect(deletes).toEqual([]);
    await failed.click(); await expect(failed).toHaveCount(0); await expect(submitButton).toBeEnabled();
    await submit(child, 'Only the retained successful image is submitted.');
    await viewImage(child);
    const detail = expectData(await runtime.parent.get(detailPath)).package;
    const attempt = detail.attempts.find(value => value.id === detail.currentAttemptId);
    expect(attempt.media.map(media => media.mediaId)).toEqual([uploaded[0]]);
    expect(childSeen.writes).toHaveLength(1);
    expect(childSeen.writes[0]).toMatchObject({ path: `${detailPath}/attempts`, body: { mediaIds: [uploaded[0]] } });
    const owner = await runtime.login('child');
    expectData(await owner.get(`/api/media/${uploaded[1]}/access`));
    expect(deletes).toEqual([]); expect(aborted).toBe(1); expect(uploads).toBe(3);
    healthy(seen); healthy(childSeen, [], true); await runtime.unchanged();
  } finally {
    try { if (child && uploadHandler) await child.unroute(runtime.webUrl + '/api/media', uploadHandler); }
    finally { await context?.close(); }
  }
});

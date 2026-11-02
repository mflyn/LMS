const { test, expect } = require('@playwright/test');
const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const { createHash } = require('crypto');

// C-batch UI validation only: every API response is synthetic. D must exercise real services.
const actor = 'a'.repeat(24), familyId = 'b'.repeat(24), childId = 'c'.repeat(24);
const cycleId = 'd'.repeat(24), sourceId = 'e'.repeat(24);
const sha = text => createHash('sha256').update(text).digest('hex');
let server, base;
test.beforeAll(async () => {
  const build = process.env.T2_WEB_BUILD;
  if (!build || !path.isAbsolute(build)) throw new Error('T2_WEB_BUILD must be an absolute frontend build');
  await fs.access(path.join(build, 'index.html'));
  const app = express(); app.use(express.static(build));
  app.get('*', (_req, res) => res.sendFile(path.join(build, 'index.html')));
  server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); listener.once('error', reject);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  if (server) await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve()); server.closeAllConnections?.();
  });
});

async function fixture(page, { loseGenerationResponse = false } = {}) {
  let cycle, job, preview, artifacts = [], generations = 0, lost = false;
  const writes = [], replies = new Map(), unexpected = [], consoleErrors = [];
  page.on('pageerror', error => unexpected.push(error.message));
  page.on('console', msg => { if (['error', 'warning'].includes(msg.type())) consoleErrors.push(msg.text()); });
  await page.addInitScript(({ actor }) => {
    if (!localStorage.getItem('family-growth.parent-session.v1')) localStorage.setItem('family-growth.parent-session.v1',
      JSON.stringify({ token: 'synthetic-no-server', user: { id: actor, role: 'parent', name: 'Synthetic parent' } }));
  }, { actor });
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== base) { unexpected.push('Unexpected external request'); return route.abort(); }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    let data = { items: [] };
    if (req.method() === 'POST') {
      const body = req.postDataJSON(), key = `${url.pathname}:${body.operationId}`;
      writes.push({ path: url.pathname, body });
      if (replies.has(key)) {
        expect(body).toEqual(replies.get(key).body); data = replies.get(key).data;
      } else if (url.pathname === '/api/tutor-cycles') {
        expect(body.source.id).toBe(sourceId); expect(body.input.questionText).toBe('Explain 206 * 30.');
        expect(JSON.stringify(body)).not.toContain('Synthetic child');
        cycle = { id: cycleId, childId, source: body.source, status: 'ready', stateVersion: 1, currentArtifactId: null, createdBy: actor };
        preview = { generationInputHash: sha(body.input.questionText), modelProfileVersion: 'synthetic-model-1', pricingProfileVersion: 'synthetic-price-1',
          messages: [{ role: 'system', content: 'Synthetic system: one short explanation.' }, { role: 'user', content: body.input.questionText }],
          requestOptions: { model: 'synthetic-only', maxInputTokens: 8192, maxOutputTokens: 4096 }, reservedCeilingMicros: 184320,
          pricing: { currency: 'CNY' }, sendNotAfter: '2099-01-01T00:00:00.000Z' };
        data = { cycle, preview };
      } else if (url.pathname.endsWith('/explanation-jobs')) {
        expect(body.generationInputHash).toBe(preview.generationInputHash); generations++;
        artifacts = [{ id: '1'.repeat(24), cycleId, text: '206 * 30 = 6180. Synthetic original explanation.',
          contentHash: sha('206 * 30 = 6180. Synthetic original explanation.'), version: 1, reviewVersion: 1,
          origin: 'ai_generation', status: 'candidate', createdBy: actor, revisionReason: null }];
        cycle = { ...cycle, status: 'candidate', stateVersion: 2, currentArtifactId: artifacts[0].id };
        job = { id: '2'.repeat(24), cycleId, operationId: body.operationId, status: 'succeeded', createdBy: actor, canRecover: false,
          budget: { reservedMicros: 184320, settledMicros: 100, state: 'settled' } }; data = { job };
      } else if (url.pathname.endsWith('/explanation-revisions')) {
        expect(body.artifactContentHash).toBe(artifacts[0].contentHash);
        artifacts[0].status = 'superseded'; artifacts[0].reviewVersion++;
        artifacts.push({ ...artifacts[0], id: '3'.repeat(24), text: body.revisedText, contentHash: sha(body.revisedText),
          version: 2, reviewVersion: 1, origin: 'parent_revision', derivedFromArtifactId: artifacts[0].id,
          revisionReason: body.revisionReason, status: 'candidate' });
        cycle = { ...cycle, stateVersion: 3, currentArtifactId: artifacts[1].id }; data = { artifact: artifacts[1], cycleStateVersion: 3 };
      } else if (url.pathname.endsWith('/explanation-review')) {
        expect(body.artifactVersion).toBe(2); expect(body.artifactContentHash).toBe(artifacts[1].contentHash);
        expect(body.expectedCycleStateVersion).toBe(3); expect(body.expectedArtifactReviewVersion).toBe(1);
        artifacts[1].status = 'parent_approved'; artifacts[1].reviewVersion++;
        artifacts[1].review = { reviewerId: actor, time: '2026-11-01T01:00:00Z', decision: 'approve', comment: body.comment };
        cycle = { ...cycle, status: 'approved', stateVersion: 4, approvedArtifactId: artifacts[1].id };
        data = { artifact: artifacts[1], cycleStateVersion: 4 };
      } else { unexpected.push('Unexpected write'); return route.abort(); }
      replies.set(key, JSON.parse(JSON.stringify({ body, data })));
      if (loseGenerationResponse && !lost && url.pathname.endsWith('/explanation-jobs')) {
        lost = true;
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'SERVICE_UNAVAILABLE' } }) });
      }
    } else if (url.pathname === '/api/families/me') data = { family: { familyId, familyName: 'Synthetic family' },
      children: [{ childId, name: 'Synthetic child', grade: 4 }], defaultChildId: childId };
    else if (url.pathname === '/api/growth-tasks') data = { items: [{ taskId: sourceId, familyId, childId, title: 'Synthetic math task',
      dimension: 'academic', subject: '数学', status: 'pending', area: 'Synthetic', dueDate: '2026-11-01' }], total: 1 };
    else if (url.pathname === '/api/mistakes') data = { items: [{ mistakeId: sourceId, childId, subject: 'Math',
      knowledgePoint: 'Synthetic multiplication', masteryLevel: 'learning', correctionText: '', reviewCount: 0 }], total: 1 };
    else if (url.pathname === '/api/tutor-cycles') data = { items: cycle ? [cycle] : [] };
    else if (url.pathname === `/api/tutor-cycles/${cycleId}`) data = { cycle, preview, job, artifacts };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });
  return { writes, unexpected, consoleErrors, generations: () => generations };
}

async function enter(page, entry) {
  await page.goto(`${base}/app/${entry}`);
  await page.getByRole('link', { name: '准备讲解', exact: true }).click();
  await page.getByLabel('题目文字', { exact: true }).fill('Explain 206 * 30.');
  await page.getByLabel('已核对文字，不含个人信息或链接').check();
  await page.getByRole('button', { name: '创建外发预览' }).click();
  await expect(page.getByText('Synthetic system: one short explanation.', { exact: true })).toBeVisible();
  await page.getByLabel('确认以上完整文字及费用上界，发送生成').check();
  await page.getByRole('button', { name: '生成候选讲解' }).click();
}

for (const entry of ['tasks', 'mistakes']) test(`AI1 C synthetic API: ${entry} entry, revise, approve and reread`, async ({ page }, testInfo) => {
  const state = await fixture(page); await enter(page, entry);
  await expect(page.getByText('206 * 30 = 6180. Synthetic original explanation.', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByLabel('修订文字', { exact: true }).fill('206 * 3 = 618; 30 is 3 tens, so 206 * 30 = 6180.');
  await page.getByLabel('修订原因', { exact: true }).fill('Clarify counting units.');
  await page.getByRole('button', { name: '保存修订版本' }).click();
  await expect(page.getByText('修订原因：Clarify counting units.', { exact: true })).toBeVisible();
  for (const label of ['数学正确', '适合年级', '符合章节', '表述已核对']) await page.getByLabel(label, { exact: true }).check();
  await page.getByRole('button', { name: '批准所见版本' }).click();
  await expect(page.getByRole('heading', { name: '已批准', exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', { name: '已批准', exact: true })).toBeVisible();
  await expect(page.getByLabel('修订文字', { exact: true })).toHaveCount(0);
  for (const [name, width, height] of [['desktop', 1280, 900], ['ipad-layout', 768, 1024], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    expect(await page.locator('html').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
  }
  expect(state.writes).toHaveLength(4); expect(state.generations()).toBe(1);
  expect(state.unexpected).toEqual([]); expect(state.consoleErrors).toEqual([]);
});

test('AI1 C synthetic API: committed generation with lost response survives real reload and only retries original command', async ({ page }) => {
  const state = await fixture(page, { loseGenerationResponse: true }); await enter(page, 'tasks');
  await expect(page.getByRole('button', { name: '重试原命令' })).toBeVisible();
  const original = state.writes[1]; await page.reload();
  await expect(page.getByRole('button', { name: '重试原命令' })).toBeVisible();
  expect(state.writes).toHaveLength(2);
  await page.getByRole('button', { name: '重试原命令' }).click();
  await expect(page.getByRole('button', { name: '重试原命令' })).toHaveCount(0);
  expect(state.writes).toHaveLength(3); expect(state.writes[2]).toEqual(original);
  expect(state.generations()).toBe(1); expect(state.unexpected).toEqual([]);
  expect(state.consoleErrors).toHaveLength(1); expect(state.consoleErrors[0]).toContain('503');
});

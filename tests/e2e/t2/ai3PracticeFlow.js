const { expect } = require('@playwright/test');
const fs = require('fs/promises');
const { login, capture, expectData, pathname, observe } = require('./ai2Fixture');
const { submitWithLostResult } = require('./ai3BrowserRecovery');
const { assertAi3AppliedEffects } = require('./ai3EffectAssertions');

async function runAi3Flow({ page, browser, browserName, info, runtime, parent, packageId, source }) {
  const { fixture } = runtime, childId = fixture.actors.child.childId;
  const M = require('../../../backend/services/homework-service/models/Ai3');
  const json = value => JSON.parse(JSON.stringify(value));
  const initial = await runtime.snapshot();
  const childApi = await runtime.login('child'), other = await runtime.login('outsider');
  let knowledgePointId = null;
  if (source === 'task') {
    const kp = expectData(await parent.post('/api/knowledge-points', { childId, dimension: 'academic',
      subject: '数学', name: 'Synthetic multiplication', masteryLevel: 'learning' }), 201).knowledgePoint;
    knowledgePointId = kp.knowledgePointId;
  }
  const posted = async (actorPage, path, action, status) => {
    const waiting = actorPage.waitForResponse(r => r.request().method() === 'POST' && pathname(r.url()) === path);
    await action(); const response = await waiting;
    expect(response.status()).toBe(status);
    const body = await response.json(); expect(body.success).toBe(true);
    return { data: body.data, body: response.request().postDataJSON() };
  };
  const current = p => p.getByRole('article').filter({ has: p.getByRole('heading', { name: /当前作答/ }) });
  const view = async p => {
    await current(p).getByRole('button', { name: '查看练习图片 1', exact: true }).click();
    const image = current(p).getByRole('img', { name: '练习图片 1', exact: true });
    await expect(image).toBeVisible(); await expect.poll(() => image.evaluate(n => n.naturalWidth)).toBeGreaterThan(0);
  };
  const reopen = async (p, state) => {
    await p.getByRole('link', { name: '查看练习', exact: true }).click();
    await expect(p.getByRole('region', { name: '练习详情', exact: true }).getByRole('heading', { name: state, exact: true })).toBeVisible();
  };
  const childContext = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true });
  let remoteOperationId;
  try {
    const child = await childContext.newPage(), childSeen = await observe(child, runtime);
    await login(child, runtime, 'child');
    for (const count of [2, 3]) {
      await page.goto(runtime.webUrl + `/app/learning?childId=${childId}&packageId=${packageId}`);
      await page.getByRole('link', { name: '准备变式练习', exact: true }).click();
      await expect(page.getByRole('button', { name: '创建练习轮次', exact: true })).toBeEnabled();
      await page.getByRole('combobox', { name: '题量', exact: true }).selectOption(String(count));
      if (knowledgePointId) await page.getByRole('combobox', { name: '关联知识点', exact: true }).selectOption(knowledgePointId);
      const created = await posted(page, '/api/ai3/practice-rounds',
        () => page.getByRole('button', { name: '创建练习轮次', exact: true }).click(), 201);
      const roundId = created.data.command.roundId, path = `/api/ai3/practice-rounds/${roundId}`;
      await reopen(page, '准备中');
      expect((await other.get(path)).status).toBe(404);
      expect((await childApi.get(path)).status).toBe(404);
      if (count === 3) {
        await page.getByRole('button', { name: '查看完整生成请求', exact: true }).click();
        await expect(page.getByRole('region', { name: '完整生成预览', exact: true })).toBeVisible();
        await page.getByLabel('已核对完整请求、脱敏内容与本次费用上限', { exact: true }).check();
        const generated = await posted(page, `${path}/generate`,
          () => page.getByRole('button', { name: '生成候选题组', exact: true }).click(), 202);
        expect(generated.data.command.phase).toBe('SUCCEEDED');
        const command = await M.Command.findById(generated.data.command.id).lean();
        remoteOperationId = command.generation.remoteOperationId;
        await reopen(page, '准备中');
      }
      await page.getByRole('button', { name: '手工录题或修订', exact: true }).click();
      await page.getByRole('textbox', { name: '作答要求', exact: true }).fill('Write the partial products for every question.');
      const questions = [['124 * 23', '2852'], ['132 * 24', '3168'], ['203 * 31', '6293']];
      for (let i = 0; i < count; i++) {
        await page.getByRole('textbox', { name: `第 ${i + 1} 题题干`, exact: true }).fill(questions[i][0]);
        await page.getByRole('textbox', { name: `第 ${i + 1} 题家长答案`, exact: true }).fill(questions[i][1]);
        await page.getByRole('textbox', { name: `第 ${i + 1} 题判定要点`, exact: true }).fill('PRIVATE_RUBRIC: verify the tens row.');
      }
      await page.getByRole('textbox', { name: '修订原因', exact: true }).fill('Parent checked every product.');
      await posted(page, `${path}/content-revisions`, () => page.getByRole('button', { name: '保存题组版本', exact: true }).click(), 201);
      await reopen(page, '准备中');
      const historyBefore = await runtime.snapshot();
      const versions = expectData(await parent.get(`${path}/contents?page=1&pageSize=20`)).items;
      expect(versions.map(c => c.version)).toEqual(count === 3 ? [2, 1] : [1]);
      const oldest = versions[versions.length - 1];
      const savedContent = expectData(await parent.get(`${path}/contents/${oldest.id}`)).content;
      expect((await childApi.get(`${path}/contents`)).status).toBe(403);
      expect((await other.get(`${path}/contents/${oldest.id}`)).status).toBe(404);
      await page.getByRole('button', { name: '查看题组历史', exact: true }).click();
      await page.getByRole('button', { name: '查看第 1 版题组', exact: true }).click();
      const historical = page.getByRole('region', { name: '历史题组详情', exact: true });
      await expect(historical).toBeVisible();
      await expect(historical.getByRole('textbox')).toHaveCount(0);
      for (const exercise of savedContent.content.exercises) {
        await expect(historical.getByText(exercise.questionText, { exact: true })).toBeVisible();
        await expect(historical.getByText(exercise.answerForParent, { exact: true })).toBeVisible();
      }
      const historyAfter = await runtime.snapshot();
      for (const key of ['Ai3Round', 'Ai3Content', 'Ai3Command', 'Ai3Attempt']) {
        expect(historyAfter.database[key]).toEqual(historyBefore.database[key]);
      }
      await page.getByRole('button', { name: '刷新练习详情', exact: true }).click();
      await expect(historical).toHaveCount(0);
      await expect(page.getByText('来源可用', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: '查看发布预览', exact: true }).click();
      await page.getByLabel('已核算全部答案和判定要点，并确认孩子可见内容', { exact: true }).check();
      await posted(page, `${path}/publish`, () => page.getByRole('button', { name: '批准并发布', exact: true }).click(), 201);
      await reopen(page, '待作答');
      const published = expectData(await childApi.get(path)).round;
      expect(published.sourceAvailability).toBe('available');
      expect(published.exerciseCount).toBe(count);
      expect(published.childSnapshot.exercises).toHaveLength(count);
      for (const q of published.childSnapshot.exercises) expect(Object.keys(q).sort()).toEqual(['exerciseId', 'questionText']);
      for (const field of ['answerForParent', 'rubricForParent', 'contentHash', 'generation', 'budget', 'mediaBindings']) {
        expect(JSON.stringify(published)).not.toContain('"' + field + '"');
      }
      if (count === 2) {
        await child.getByRole('link', { name: '我的学习包', exact: true }).click();
        await child.getByRole('link', { name: '查看变式练习', exact: true }).click();
      } else await child.getByRole('button', { name: '刷新练习记录', exact: true }).click();
      await child.getByRole('region', { name: '练习列表', exact: true })
        .locator(`a[href="/child/practice?childId=${childId}&roundId=${roundId}"]`).click();
      const submit = async (note, imageCount) => {
        const files = Array.from({ length: imageCount }, (_, i) => ({ name: `synthetic-${count}-${note}-${i}.png`, mimeType: 'image/png', buffer: fixture.image.bytes }));
        await child.getByLabel('添加练习图片', { exact: true }).setInputFiles(files);
        await expect(child.getByRole('button', { name: '提交作答', exact: true })).toBeEnabled();
        await child.getByRole('textbox', { name: '作答说明', exact: true }).fill(note);
        const result = count === 2 && note === 'First attempt'
          ? await submitWithLostResult({ page: child, runtime, path, roundId, M })
          : await posted(child, `${path}/attempts`, () => child.getByRole('button', { name: '提交作答', exact: true }).click(), 201);
        expect(result.body).not.toHaveProperty('contentHash');
        await reopen(child, '等待家长审核'); return result;
      };
      await submit('First attempt', 1);
      await child.reload(); await view(child);
      await page.getByRole('button', { name: '刷新练习详情', exact: true }).click(); await view(page);
      let detail = expectData(await parent.get(path)).round;
      const firstId = detail.currentAttemptId;
      await page.getByRole('textbox', { name: '审核反馈', exact: true }).fill('Please align the tens row.');
      await posted(page, `${path}/attempts/${firstId}/review`, () => page.getByRole('button', { name: '退回再练', exact: true }).click(), 200);
      const first = json(await M.Attempt.findById(firstId).lean());
      expect(first.review.decision).toBe('revise');
      await child.reload(); await expect(child.getByRole('heading', { name: '请再练一次', exact: true })).toBeVisible();
      await submit('Aligned partial products', count === 3 ? 10 : 1);
      await reopen(page, '等待家长审核');
      const currentMedia = current(page);
      const n = count === 3 ? 10 : 1;
      for (let i = 1; i <= n; i++) {
        await currentMedia.getByRole('button', { name: `查看练习图片 ${i}`, exact: true }).click();
        const image = currentMedia.getByRole('img', { name: `练习图片 ${i}`, exact: true });
        await expect.poll(() => image.evaluate(node => node.naturalWidth)).toBeGreaterThan(0);
      }
      await page.getByRole('button', { name: '读取审核依据', exact: true }).click();
      await page.getByRole('textbox', { name: '整组核对说明', exact: true }).fill('All questions independently checked and correct.');
      await page.getByRole('textbox', { name: '审核反馈', exact: true }).fill('Every partial product is correct.');
      await page.getByLabel('复习日期', { exact: true }).fill('2026-11-08');
      if (knowledgePointId) await page.getByLabel('确认已掌握关联知识点', { exact: true }).check();
      else await expect(page.getByLabel('确认已掌握关联知识点', { exact: true })).toBeDisabled();
      detail = expectData(await parent.get(path)).round;
      const approved = await posted(page, `${path}/attempts/${detail.currentAttemptId}/review`,
        () => page.getByRole('button', { name: '通过所见练习', exact: true }).click(), 200);
      expect(approved.data.command.phase).toBe('SUCCEEDED');
      await reopen(page, '已通过');
      const final = expectData(await parent.get(path)).round;
      expect(final.effects).toEqual({ mistake: source === 'mistake' ? 'applied' : 'not_requested', mastery: knowledgePointId ? 'applied' : 'not_requested' });
      const review = await M.Command.findById(approved.data.command.id).lean();
      expect(String(review.finalReview.reviewedByParentId)).toBe(fixture.actors.parent.userId);
      expect((await M.Round.findById(roundId).lean()).active).toBe(false);
      expect(json(await M.Attempt.findById(firstId).lean())).toEqual(first);
      const effectsBeforeReplay = await runtime.snapshot();
      assertAi3AppliedEffects(effectsBeforeReplay, review, fixture.actors.parent.userId);
      const replay = await parent.post(`${path}/attempts/${detail.currentAttemptId}/review`, approved.body);
      expectData(replay); expect(replay.data.data.command.id).toBe(approved.data.command.id);
      const effectsAfterReplay = await runtime.snapshot();
      for (const key of ['Ai3MistakeReceipt', 'Ai3MasteryReceipt', 'MistakeStateEvent', 'KnowledgePointMasteryEvent', 'Mistake', 'KnowledgePoint']) {
        expect(effectsAfterReplay.database[key]).toEqual(effectsBeforeReplay.database[key]);
      }
      await child.reload(); await view(child);
      await expect(child.getByText(/Every partial product is correct/)).toBeVisible();
      await expect(child.getByRole('button', { name: '提交作答', exact: true })).toHaveCount(0);
      await expect(child.getByText('复习日期：2026-11-08', { exact: true })).toBeVisible();
      expect(await child.locator('body').innerText()).not.toContain('PRIVATE_RUBRIC');
      for (const actorPage of [page, child]) {
        const questions = actorPage.getByRole('region', { name: '练习详情', exact: true }).locator('.ai2-snapshot > article');
        await expect(questions).toHaveCount(count);
        for (let i = 0; i < count; i++) await expect(questions.nth(i)).toHaveCSS('display', 'block');
        await expect(actorPage.getByRole('button', { name: '刷新练习记录', exact: true })).toHaveCSS('min-height', '44px');
      }
      await capture(page, info, `ai3-parent-${count}.png`); await capture(child, info, `ai3-child-${count}.png`);
      if (count === 3) {
        for (const actorPage of [page, child]) {
          const previous = actorPage.viewportSize();
          try {
            await actorPage.setViewportSize({ width: 375, height: 812 });
            const records = actorPage.getByRole('region', { name: '本人操作记录', exact: true }).locator('article');
            for (const record of await records.all()) {
              const bounds = await record.boundingBox();
              expect(bounds).not.toBeNull();
              expect(bounds.height).toBeLessThanOrEqual(240);
            }
            await capture(actorPage, info, `ai3-${actorPage === page ? 'parent' : 'child'}-mobile.png`);
          } finally { await actorPage.setViewportSize(previous); }
        }
      }
    }
    expect(childSeen.errors).toEqual([]); expect(childSeen.console).toEqual([]); expect(childSeen.external).toEqual([]);
    expect(childSeen.failed).toEqual([]);
    const after = await runtime.snapshot();
    for (const key of ['Task', 'Ledger', 'DailyPlan']) expect(after.database[key]).toEqual(initial.database[key]);
    expect(await M.Round.countDocuments({ learningState: 'passed', active: false })).toBe(2);
    expect(await M.Attempt.countDocuments()).toBe(4);
    await fs.writeFile(process.env.AI3_ACTUAL_RESULT, JSON.stringify({ engine: browserName, source, counts: [2, 3],
      closedLoops: 2, remoteOperationId, syntheticProvider: true, realGatewayAndConsumers: true }));
  } finally { await childContext.close(); }
}
module.exports = { runAi3Flow };

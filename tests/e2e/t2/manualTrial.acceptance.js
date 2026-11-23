const { test, expect } = require('@playwright/test');
const { randomUUID } = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const net = require('net');
const { createT2WebRuntime } = require('./webRuntime');
const { login, expectData, observe, capture } = require('./ai2Fixture');
const { openParentTasks } = require('./parentNavigation');
const { assertRequestFailure } = require('./ai1BrowserContracts');
let runtime, previous, restore;
test.afterEach(async () => {
  try { await runtime?.stop(); } finally {
    restore?.(); restore = null;
    for (const [key, value] of Object.entries(previous || {})) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    runtime = null; previous = null;
  }
});

test('formal v2 preview, original replay, AI3 unknown fee and shared stop preserve manual review', async ({ page, browserName }, info) => {
  const originalConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    const v = Array.isArray(args[0]) ? args[0] : args;
    const o = typeof v[0] === 'object' ? v[0] : { port: v[0], host: typeof v[1] === 'string' ? v[1] : undefined };
    if (!o || ![undefined, '127.0.0.1', '::1'].includes(o.host)) throw new Error('NON_LOCAL_TCP_DENIED');
    return originalConnect.apply(this, args);
  };
  restore = () => { net.Socket.prototype.connect = originalConnect; };
  const origin = new URL(process.env.AI1_ACTUAL_REMOTE_ORIGIN);
  expect(origin.hostname).toBe('127.0.0.1'); expect(origin.protocol).toBe('http:');
  const config = { AI1_MODE: 'enabled', AI1_ALLOW_LOOPBACK: 'true', AI1_LOCAL_STORE_CONTINUOUS: 'true',
    AI1_REMOTE_STORE_CONTINUOUS: 'true', AI1_PROVIDER_PROFILE_CONFIRMED: 'false', AI1_OPERATION_URL: origin.origin,
    AI1_OPERATION_TOKEN: 'synthetic-service-credential-00000001', AI1_MODEL_PROFILE: process.env.AI1_ACTUAL_REMOTE_PROFILE,
    AI1_TRIAL_AUTHORIZATION: JSON.stringify({ confirmed: true, authorizationVersion: 'synthetic-trial-only', maxSubmissions: 3 }),
    AI1_BUDGET_LIMITS: JSON.stringify({ singleMicros: 16384, dayMicros: 163840, monthMicros: 163840, experimentMicros: 163840 }),
    AI2_MODE: 'enabled', AI2_STORE_CONTINUOUS: 'true', AI3_MODE: 'enabled', AI3_STORE_CONTINUOUS: 'true' };
  previous = Object.fromEntries(Object.keys(config).map(k => [k, process.env[k]]));
  runtime = await createT2WebRuntime({ beforeStart: () => Object.assign(process.env, config) });
  const { fixture } = runtime, childId = fixture.actors.child.childId, parent = await runtime.login('parent');
  const outsider = await runtime.login('outsider');
  expectData(await parent.patch(`/api/growth-tasks/${fixture.tasks.child.taskId}`, { subject: 'math' }));
  const seen = await observe(page, runtime);
  await login(page, runtime, 'parent'); await openParentTasks(page, runtime.webUrl);
  await page.getByLabel('当前孩子').selectOption(childId);
  await page.getByRole('link', { name: '准备讲解', exact: true }).click();
  await page.getByLabel('题目文字', { exact: true }).fill('Explain 206 * 30.');
  await page.getByLabel('已核对文字，不含个人信息或链接').check();
  await page.getByLabel('小规模人工试用（费用估算，非硬上限）').check();
  const createdWait = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/tutor-cycles');
  await page.getByRole('button', { name: '创建外发预览' }).click();
  const createdResponse = await createdWait; expect(createdResponse.status()).toBe(201);
  const created = (await createdResponse.json()).data, cyclePath = `/api/tutor-cycles/${created.cycle.id}`;
  expect(createdResponse.request().postDataJSON().schemaVersion).toBe('ai1-min-v2');
  const region = page.getByRole('region', { name: '完整外发预览', exact: true });
  await expect(region).toBeVisible();
  expect(await region.locator('pre').allTextContents()).toEqual(created.preview.messages.map(m => m.content));
  await expect(region.getByText(/不是单次或整轮费用硬上限/)).toBeVisible();
  await expect(page.getByRole('button', { name: '生成候选讲解' })).toBeDisabled();
  await capture(page, info, 'manual-trial-preview.png');
  await page.getByLabel('已核对完整文字并接受估算可能超出、费用未知时停发，本次发送').check();
  const url = runtime.webUrl + cyclePath + '/explanation-jobs';
  runtime.dropNextResponse({ method: 'POST', path: cyclePath + '/explanation-jobs' });
  const lostWait = page.waitForEvent('requestfailed', { predicate: r => r.url() === url && r.method() === 'POST' });
  await page.getByRole('button', { name: '生成候选讲解' }).click();
  const lost = await lostWait;
  await assertRequestFailure(lost, { browserName, kind: 'dropped', url, method: 'POST' });
  const originalBody = lost.postDataJSON();
  await expect(page.getByRole('button', { name: '重试原命令' })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('button', { name: '重试原命令' })).toBeEnabled();
  const generationWait = page.waitForResponse(r => r.request().method() === 'POST' && r.url() === url);
  await page.getByRole('button', { name: '重试原命令' }).click();
  const generated = await generationWait; expect(generated.status()).toBe(202);
  const body = generated.request().postDataJSON();
  expect(body).toEqual(originalBody); expect(runtime.droppedResponses).toHaveLength(1);
  expect(body).toMatchObject({ schemaVersion: 'ai1-min-v2', estimateAcknowledged: true });
  expect(body).not.toHaveProperty('maxAuthorizedCostMicros');
  await expect(page.getByText('6180', { exact: true })).toBeVisible();
  await expect(page.getByText(/按用量计价 0.000200 元/)).toBeVisible();
  const first = expectData(await parent.get(cyclePath));
  expect(first.job.budget).toMatchObject({ chargeStatus: 'usage_priced', usagePricedMicros: 200, feeMode: 'estimate_only' });
  expectData(await parent.post(cyclePath + '/explanation-jobs', body), 202);
  expect((await outsider.get(cyclePath)).status).toBe(404);
  const Budget = require('../../../backend/services/homework-service/models/Ai1');
  expect((await Budget.Account.findById('experiment').lean()).trialUsedSubmissions).toBe(1);

  // Existing reviewed source is synthetic fixture data, not a claim of re-testing AI2's teaching loop.
  const A = require('../../../backend/services/homework-service/models/Ai2');
  const C = require('../../../backend/services/homework-service/services/ai3Contract');
  const mongoose = require('mongoose'), oid = () => String(new mongoose.Types.ObjectId());
  const snapshot = { questionText: '124 * 23', explanationText: 'Parent checked synthetic explanation.', chapter: createdResponse.request().postDataJSON().chapter };
  const pkg = await A.Package.create({ familyId: fixture.familyId, childId, ai1CycleId: created.cycle.id,
    source: { type: 'task', id: fixture.tasks.child.taskId, subject: 'math' },
    artifact: { id: first.artifacts[0].id, version: 1, contentHash: first.artifacts[0].contentHash },
    childSnapshot: snapshot, childSnapshotHash: C.hash(snapshot), publishedBy: fixture.actors.parent.userId, publishedAt: new Date(),
    visibility: 'published', learningState: 'approved', stateVersion: 3 });
  const attempt = await A.Attempt.create({ familyId: fixture.familyId, childId, packageId: pkg._id, attemptVersion: 1,
    submitCommandId: oid(), submittedBy: childId, submittedAt: new Date(), note: '', mediaIds: [oid()], mediaBindings: [],
    payloadHash: 'b'.repeat(64), review: { decision: 'approve', reviewerId: fixture.actors.parent.userId, reviewedAt: new Date().toISOString() } });
  await A.Package.updateOne({ _id: pkg._id }, { $set: { currentAttemptId: attempt._id, currentAttemptVersion: 1 } });
  const r = expectData(await parent.post('/api/ai3/practice-rounds', { schemaVersion: 'ai3-min-v1', operationId: randomUUID(),
    sourcePackageId: String(pkg._id), expectedSourcePackageVersion: 3, sourceAttemptId: String(attempt._id), expectedSourceAttemptVersion: 1,
    sourceAttemptPayloadHash: attempt.payloadHash, sourceReviewHash: C.hash(attempt.review), exerciseCount: 2, knowledgePointId: null }), 201).round;
  const roundPath = `/api/ai3/practice-rounds/${r.id}`;
  await page.goto(`${runtime.webUrl}/app/practice?childId=${childId}&roundId=${r.id}`);
  await page.getByRole('button', { name: '查看完整生成请求' }).click();
  await expect(page.getByText(/不是单次或整轮费用硬上限/)).toBeVisible();
  await page.getByLabel('已核对完整请求、脱敏内容并接受估算可能超出、费用未知时停发').check();
  const nextWait = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === roundPath + '/generate');
  await page.getByRole('button', { name: '生成候选题组' }).click();
  const next = await nextWait; expect(next.status()).toBe(202);
  const command = (await next.json()).data.command;
  expect(command.phase).toBe('SUCCEEDED');
  expect(command.budget).toMatchObject({ chargeStatus: 'unknown', state: 'reserved_unknown', usagePricedMicros: null });
  expect(command.sendBlocked).toBe(true);
  await expect(page.getByText(/费用未知，保留原预留与原命令/)).toBeVisible();
  await expect(page.getByRole('button', { name: '恢复原操作' })).toBeVisible();
  await page.getByRole('button', { name: '恢复原操作' }).click();
  expectData(await parent.post(`/api/ai3/commands/${command.id}/recover`, { schemaVersion: 'ai3-min-v2', operationId: command.operationId }));
  expect((await Budget.Account.findById('experiment').lean()).trialUsedSubmissions).toBe(2);
  expect((await Budget.Account.findById('experiment').lean()).halted).toBe(true);
  const task2 = expectData(await parent.post('/api/growth-tasks', { childId, title: 'Synthetic second math', dimension: 'academic',
    taskType: 'practice', subject: 'math', dueDate: fixture.tasks.child.dueDate, estimatedMinutes: 15 }), 201).task;
  const newPreview = expectData(await parent.post('/api/tutor-cycles', { ...createdResponse.request().postDataJSON(),
    operationId: randomUUID(), source: { type: 'task', id: task2.taskId } }), 201);
  const blocked = await parent.post(`/api/tutor-cycles/${newPreview.cycle.id}/explanation-jobs`, { ...body, operationId: randomUUID(),
    generationInputHash: newPreview.preview.generationInputHash, expectedCycleStateVersion: newPreview.cycle.stateVersion });
  expect(blocked.status).toBe(409); expect(blocked.data.error.code).toBe('AI_COST_REVIEW_REQUIRED');
  expect((await Budget.Account.findById('experiment').lean()).trialUsedSubmissions).toBe(2);
  expectData(await parent.post(cyclePath + '/explanation-jobs', body), 202);
  await page.getByRole('link', { name: '查看练习', exact: true }).click();
  await expect(page.getByRole('button', { name: '手工录题或修订' })).toBeEnabled();
  await page.getByRole('button', { name: '查看完整生成请求' }).click();
  await expect(page.getByRole('button', { name: '生成候选题组' })).toBeDisabled();
  await capture(page, info, 'manual-trial-unknown.png');
  expect(seen.errors).toEqual([]); expect(seen.external).toEqual([]);
  await fs.writeFile(path.join(process.env.TRIAL_EVIDENCE_ROOT, 'browser-result.json'), JSON.stringify({
    ai1: first.job, ai3: command, attempts: 2, realModelCalls: 0, engine: info.project.use.browserName
  }, null, 2));
});

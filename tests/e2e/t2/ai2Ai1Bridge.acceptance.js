const { test, expect } = require('@playwright/test');
const fs = require('fs/promises');
const net = require('net');
const { createHash, randomUUID } = require('crypto');
const { canonicalize } = require('json-canonicalize');
const { createT2WebRuntime } = require('./webRuntime');
const { openParentTasks } = require('./parentNavigation');
const { login, openPackage, upload, submit, viewImage, observe, capture, expectData, pathname } = require('./ai2Fixture');

const question = 'Explain 206 * 30.';
const privateAnswer = 'PRIVATE_BRIDGE_ANSWER: synthetic unverified working.';
const privateContext = 'PRIVATE_BRIDGE_CONTEXT: synthetic parent-only preparation.';
const revised = '206 * 3 = 618; 30 is 3 tens, so 206 * 30 = 6180.';
const sha = text => createHash('sha256').update(text, 'utf8').digest('hex');
const hash = value => sha(canonicalize(value));
const json = value => JSON.parse(JSON.stringify(value));
const keys = (value, expected) => expect(Object.keys(value).sort()).toEqual([...expected].sort());
const snapshot = async models => Object.fromEntries(await Promise.all(Object.entries(models).map(async ([name, model]) =>
  [name, json(await model.collection.find({}).sort({ _id: 1 }).toArray())])));
let runtime, previous, restoreNetwork;

// Test-only TCP boundary; never substitute a successful application response.
function restrictTcp() {
  const original = net.Socket.prototype.connect, denied = [];
  net.Socket.prototype.connect = function (...args) {
    const values = Array.isArray(args[0]) ? args[0] : args;
    const options = typeof values[0] === 'object' ? values[0]
      : typeof values[0] === 'string' && !/^\d+$/.test(values[0]) ? { path: values[0] }
        : { port: values[0], host: typeof values[1] === 'string' ? values[1] : undefined };
    const local = options && (typeof options.path === 'string' ? options.path.startsWith('/')
      : options.port !== undefined && [undefined, '127.0.0.1', '::1'].includes(options.host));
    if (!local) {
      denied.push('non-loopback TCP denied');
      throw Object.assign(new Error('BRIDGE_EXTERNAL_TCP_DENIED'), { code: 'BRIDGE_EXTERNAL_TCP_DENIED' });
    }
    return original.apply(this, args);
  };
  restoreNetwork = () => { net.Socket.prototype.connect = original; };
  return denied;
}

function observeBusinessWrites(servers) {
  const calls = [];
  for (const { name, server } of servers) server.prependListener('request', req => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    const business = ['progress-service', 'analytics-service'].includes(name)
      || (name === 'homework-service' && !path.startsWith('/api/ai2/') && path !== '/api/internal/ai2/media-access-check')
      || /^\/api\/(growth-tasks|homework|knowledge-points|internal\/stars|rewards|mistakes|progress|growth-logs)(\/|$)/.test(path);
    if (business) calls.push({ service: name, method: req.method, path });
  });
  return calls;
}

test.afterEach(async () => {
  try { await runtime?.stop(); } finally {
    restoreNetwork?.(); restoreNetwork = null;
    for (const [key, value] of Object.entries(previous || {})) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    runtime = null; previous = null;
  }
});

test('PUB01/FLOW01 actual AI1 revision and approval bridge into the child AI2 correction loop', async ({ page, browser, browserName }, info) => {
  const deniedTcp = restrictTcp();
  for (const args of [[443, 'unapproved.invalid'], [{ host: 'unapproved.invalid', port: 443 }],
    [[{ host: 'unapproved.invalid', port: 443 }, undefined]]]) {
    const socket = new net.Socket();
    try { expect(() => socket.connect(...args)).toThrow('BRIDGE_EXTERNAL_TCP_DENIED'); }
    finally { socket.destroy(); }
  }
  expect(deniedTcp).toHaveLength(3);
  const origin = new URL(process.env.AI1_ACTUAL_REMOTE_ORIGIN), source = process.env.AI1_ACTUAL_SOURCE;
  expect(origin.protocol).toBe('http:'); expect(origin.hostname).toBe('127.0.0.1');
  expect(['task', 'mistake']).toContain(source); expect(['chromium', 'webkit']).toContain(browserName);
  expect(process.env.AI1_ACTUAL_REMOTE_FAULT).toBe('none');
  const config = { AI1_MODE: 'enabled', AI1_ALLOW_LOOPBACK: 'true', AI1_LOCAL_STORE_CONTINUOUS: 'true',
    AI1_REMOTE_STORE_CONTINUOUS: 'true', AI1_PROVIDER_PROFILE_CONFIRMED: 'true', AI1_OPERATION_URL: origin.origin,
    AI1_OPERATION_TOKEN: 'synthetic-service-credential-00000001', AI1_MODEL_PROFILE: process.env.AI1_ACTUAL_REMOTE_PROFILE,
    AI1_BUDGET_LIMITS: JSON.stringify({ singleMicros: 16384, dayMicros: 163840, monthMicros: 163840, experimentMicros: 163840 }),
    AI2_MODE: 'enabled', AI2_STORE_CONTINUOUS: 'true',
    ...(process.env.AI3_BRIDGE === 'true' ? { AI3_MODE: 'enabled', AI3_STORE_CONTINUOUS: 'true' } : {}) };
  previous = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
  runtime = await createT2WebRuntime({ beforeStart: () => Object.assign(process.env, config) });
  expect(runtime.mode).toBe('enabled'); expect(runtime.modelConnectionsMatch).toBe(true);
  expect(runtime.mongoHello.setName).toBeTruthy();
  expect(runtime.prechecks).toEqual(expect.arrayContaining(['resource', 'homework']));
  const { fixture } = runtime, parent = await runtime.login('parent');
  const businessCalls = observeBusinessWrites(runtime.servers);
  const beforeProbe = await runtime.snapshot();
  const deniedAward = await fetch(runtime.urls['progress-service'] + '/api/internal/stars/award', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  expect(deniedAward.status).toBe(401); await deniedAward.arrayBuffer();
  expect(businessCalls).toEqual([{ service: 'progress-service', method: 'POST', path: '/api/internal/stars/award' }]);
  expect(await runtime.snapshot()).toEqual(beforeProbe);
  const A = require('../../../backend/services/homework-service/models/Ai1');
  const M = require('../../../backend/services/homework-service/models/Ai2');
  const seen = await observe(page, runtime);
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
  const logout = async () => {
    await page.getByRole('button', { name: '退出登录', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.includes('ai1') || key.includes('ai2')))).toEqual([]);
  };
  const posted = async (path, click, status) => {
    const waiting = page.waitForResponse(r => r.request().method() === 'POST' && pathname(r.url()) === path);
    await click(); const response = await waiting;
    expect(response.status()).toBe(status);
    const body = await response.json(); expect(body.success).toBe(true);
    return { data: body.data, request: response.request().postDataJSON() };
  };
  expectData(await parent.patch(`/api/growth-tasks/${fixture.tasks.child.taskId}`, { subject: 'math' }));
  let expectedSource = { type: 'task', id: fixture.tasks.child.taskId };
  if (source === 'mistake') {
    const form = new FormData(); form.append('purpose', 'mistake_question'); form.append('childId', fixture.actors.child.childId);
    form.append('file', new Blob([fixture.image.bytes], { type: fixture.image.mimeType }), fixture.image.name);
    const mediaId = expectData(await parent.post('/api/media', form), 201).media.mediaId;
    const mistake = expectData(await parent.post('/api/mistakes', { childId: fixture.actors.child.childId, subject: 'Math',
      reason: 'calculation', knowledgePointName: 'Synthetic math', questionMediaIds: [mediaId] }), 201).mistake;
    expectedSource = { type: 'mistake', id: mistake.mistakeId };
  }
  const businessBefore = await runtime.snapshot();
  await login(page, runtime, 'parent'); await sourcePage();
  await page.getByRole('link', { name: '准备讲解', exact: true }).click();
  await page.getByLabel('题目文字', { exact: true }).fill(question);
  await page.getByLabel('可选作答文字', { exact: true }).fill(privateAnswer);
  await page.getByLabel('家长补充', { exact: true }).fill(privateContext);
  await page.getByLabel('已核对文字，不含个人信息或链接').check();
  const created = await posted('/api/tutor-cycles', () => page.getByRole('button', { name: '创建外发预览', exact: true }).click(), 201);
  const cycleId = created.data.cycle.id, cyclePath = `/api/tutor-cycles/${cycleId}`;
  expect(created.request).toMatchObject({ childId: fixture.actors.child.childId, source: expectedSource,
    input: { questionText: question, answerText: privateAnswer, parentContext: privateContext } });
  expect(created.data.cycle).toMatchObject({ source: expectedSource, childId: fixture.actors.child.childId,
    createdBy: fixture.actors.parent.userId });
  const outbound = page.getByRole('region', { name: '完整外发预览', exact: true });
  await expect(outbound).toBeVisible();
  expect(await outbound.locator('pre').allTextContents()).toEqual(created.data.preview.messages.map(m => m.content));
  await expect(outbound.getByText(/^费用上界 /)).toContainText('0.016384 元');
  await page.getByLabel('确认以上完整文字及费用上界，发送生成').check();
  await page.getByRole('button', { name: '生成候选讲解', exact: true }).click();
  await expect(page.getByText('6180', { exact: true })).toBeVisible();
  const candidate = expectData(await parent.get(cyclePath));
  expect(candidate.cycle.status).toBe('candidate'); expect(candidate.artifacts).toHaveLength(1);
  const original = candidate.artifacts[0];
  expect(original).toMatchObject({ origin: 'ai_generation', status: 'candidate', version: 1,
    createdBy: fixture.actors.parent.userId, text: '6180', contentHash: sha('6180') });

  const childSnapshot = artifact => ({ questionText: question, explanationText: artifact.text,
    chapter: created.request.chapter, source: expectedSource });
  const publishBody = (detail, artifact) => ({ schemaVersion: 'ai2-min-v1', operationId: randomUUID(), cycleId,
    expectedCycleStateVersion: detail.cycle.stateVersion, artifactId: artifact.id, artifactVersion: artifact.version,
    artifactContentHash: artifact.contentHash, expectedArtifactReviewVersion: artifact.reviewVersion,
    childSnapshotHash: hash(childSnapshot(artifact)), childContentConfirmed: true });
  const emptyAi2 = async () => {
    for (const model of Object.values(M)) expect(await model.countDocuments()).toBe(0);
  };
  const rejectUnapproved = async detail => {
    const before = await snapshot(A);
    await emptyAi2();
    await expect(page.getByRole('link', { name: '预览孩子可见内容', exact: true })).toHaveCount(0);
    const preview = await parent.get(`/api/ai2/publication-preview?cycleId=${cycleId}`);
    expect(preview.status).toBe(409); expect(preview.data.error.code).toBe('AI2_PUBLICATION_STALE');
    const artifact = detail.artifacts.find(a => a.id === detail.cycle.currentArtifactId);
    const publish = await parent.post('/api/ai2/learning-packages', publishBody(detail, artifact));
    expect(publish.status).toBe(409); expect(publish.data.error.code).toBe('AI2_PUBLICATION_STALE');
    await emptyAi2(); expect(await snapshot(A)).toEqual(before);
  };
  await rejectUnapproved(candidate);
  await page.getByLabel('修订文字', { exact: true }).fill(revised);
  await page.getByLabel('修订原因', { exact: true }).fill('Clarify counting units.');
  await posted(`${cyclePath}/explanation-revisions`,
    () => page.getByRole('button', { name: '保存修订版本', exact: true }).click(), 201);
  await expect(page.locator('article pre').filter({ hasText: revised })).toHaveText(revised);
  const revision = expectData(await parent.get(cyclePath));
  expect(revision.artifacts).toHaveLength(2);
  expect(revision.artifacts[1]).toMatchObject({ version: 2, reviewVersion: 1, origin: 'parent_revision',
    status: 'candidate', derivedFromArtifactId: original.id, createdBy: fixture.actors.parent.userId,
    text: revised, contentHash: sha(revised) });
  await rejectUnapproved(revision);
  await logout(); await login(page, runtime, 'coparent'); await openExisting();
  await expect(page.getByText(revised, { exact: true })).toBeVisible();
  for (const label of ['数学正确', '适合年级', '符合章节', '表述已核对']) await page.getByLabel(label, { exact: true }).check();
  await page.getByRole('button', { name: '批准所见版本', exact: true }).click();
  await expect(page.getByRole('heading', { name: '已批准', exact: true })).toBeVisible();
  const approved = expectData(await parent.get(cyclePath)), approvedArtifact = approved.artifacts[1];
  expect(approved.cycle).toMatchObject({ status: 'approved', currentArtifactId: approvedArtifact.id, approvedArtifactId: approvedArtifact.id });
  expect(approvedArtifact).toMatchObject({ id: revision.artifacts[1].id, version: 2, reviewVersion: 2,
    contentHash: sha(revised), status: 'parent_approved', review: { reviewerId: fixture.actors.coparent.userId,
      decision: 'approve', checks: { mathCorrect: true, gradeAppropriate: true, chapterAppropriate: true, wordingReviewed: true } } });
  expect(approved.job).toMatchObject({ status: 'succeeded', budget: { settledMicros: 200 } });
  await emptyAi2();
  const ai1Before = await snapshot(A);
  const businessCallsBefore = [...businessCalls];
  expect(ai1Before.Cycle).toHaveLength(1);
  expect(ai1Before.Cycle[0].input).toEqual({ questionText: question, answerText: privateAnswer, parentContext: privateContext });
  expect(await runtime.snapshot()).toEqual(businessBefore);
  // The complete old tuple and each individual old component must fail even with the current Cycle version.
  for (const replacement of [
    { artifactId: original.id, artifactVersion: original.version, artifactContentHash: original.contentHash,
      expectedArtifactReviewVersion: original.reviewVersion, childSnapshotHash: hash(childSnapshot(original)) },
    { artifactId: original.id }, { artifactVersion: original.version }, { artifactContentHash: original.contentHash }
  ]) {
    const rejected = await parent.post('/api/ai2/learning-packages', { ...publishBody(approved, approvedArtifact), ...replacement });
    expect(rejected.status).toBe(409); expect(rejected.data.error.code).toBe('AI2_PUBLICATION_STALE');
    await emptyAi2(); expect(await snapshot(A)).toEqual(ai1Before);
  }
  await logout(); await login(page, runtime, 'parent'); await openExisting();
  await expect(page.getByRole('heading', { name: '已批准', exact: true })).toBeVisible();
  await capture(page, info, 'bridge-ai1-approved.png');
  const previewResponse = page.waitForResponse(r => pathname(r.url()) === '/api/ai2/publication-preview' && r.request().method() === 'GET');
  await page.getByRole('link', { name: '预览孩子可见内容', exact: true }).click();
  const previewHttp = await previewResponse; expect(previewHttp.status()).toBe(200);
  const preview = (await previewHttp.json()).data.preview;
  const expectedSnapshot = childSnapshot(approvedArtifact), expectedSnapshotHash = hash(expectedSnapshot);
  expect(preview).toEqual({ cycleId, expectedCycleStateVersion: approved.cycle.stateVersion,
    artifactId: approvedArtifact.id, artifactVersion: 2, artifactContentHash: sha(revised),
    expectedArtifactReviewVersion: 2, childSnapshot: expectedSnapshot, childSnapshotHash: expectedSnapshotHash });
  await expect(page.getByRole('region', { name: '孩子可见预览', exact: true }).getByText(revised, { exact: true })).toBeVisible();
  for (const secret of [privateAnswer, privateContext]) {
    expect(JSON.stringify(preview)).not.toContain(secret); await expect(page.getByText(secret, { exact: true })).toHaveCount(0);
  }
  await emptyAi2(); await capture(page, info, 'bridge-child-preview.png');
  await page.getByLabel('确认以上孩子可见内容').check();
  const published = await posted('/api/ai2/learning-packages', () => page.getByRole('button', { name: '发布给孩子', exact: true }).click(), 201);
  expect(published.request).toEqual({ ...publishBody(approved, approvedArtifact), operationId: published.request.operationId });
  const packageId = published.data.package.id, packagePath = `/api/ai2/learning-packages/${packageId}`;
  expect(published.data.package).toMatchObject({ stateVersion: 1, learningState: 'open', publishedBy: fixture.actors.parent.userId,
    childSnapshot: expectedSnapshot, childSnapshotHash: expectedSnapshotHash });
  const rawPackage = await M.Package.findById(packageId).lean();
  expect(json(rawPackage)).toMatchObject({ familyId: fixture.familyId, childId: fixture.actors.child.childId, ai1CycleId: cycleId,
    publishedBy: fixture.actors.parent.userId, stateVersion: 1, activeCommandId: null,
    artifact: { id: approvedArtifact.id, version: 2, contentHash: sha(revised), reviewVersion: 2 } });
  expect(rawPackage.childSnapshot).toEqual(expectedSnapshot); expect(rawPackage.childSnapshotHash).toBe(expectedSnapshotHash);
  expect(json(rawPackage.source)).toEqual({ ...expectedSource, subject: 'math' });
  const childContext = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true });
  try {
    const child = await childContext.newPage(), childSeen = await observe(child, runtime);
    await login(child, runtime, 'child');
    const childApi = await runtime.login('child');
    const noPrivate = async () => {
      const p = expectData(await childApi.get(packagePath)).package;
      keys(p, ['id', 'source', 'childSnapshot', 'childSnapshotHash', 'artifact', 'visibility', 'learningState', 'stateVersion',
        'currentAttemptId', 'currentAttemptVersion', 'publishedAt', 'pending', 'attempts', 'sourceAvailability']);
      expect(p.childSnapshot).toEqual(expectedSnapshot); expect(p.childSnapshotHash).toBe(expectedSnapshotHash);
      expect(p.source).toEqual({ ...expectedSource, subject: 'math' });
      expect(p.artifact).toEqual({ id: approvedArtifact.id, version: 2, contentHash: sha(revised) });
      for (const a of p.attempts) {
        keys(a, ['id', 'attemptVersion', 'note', 'submittedAt', 'review', 'media']);
        if (a.review) keys(a.review, ['decision', 'comment', 'reviewedAt']);
        for (const media of a.media) keys(media, ['mediaId', 'mimeType', 'sizeBytes', 'status']);
      }
      for (const secret of [privateAnswer, privateContext]) {
        expect(JSON.stringify(p)).not.toContain(secret); await expect(child.getByText(secret, { exact: true })).toHaveCount(0);
      }
      return p;
    };
    for (const path of [cyclePath, `/api/tutor-artifacts/${original.id}`, `/api/tutor-artifacts/${approvedArtifact.id}`]) {
      const denied = await childApi.get(path); expect(denied.status).toBe(403);
      expect(denied.data.success).toBe(false); expect(denied.data.data).toBeUndefined();
    }
    await child.getByRole('link', { name: '我的学习包', exact: true }).click();
    await child.getByRole('link', { name: '查看学习包内容', exact: true }).click();
    await expect(child.getByRole('region', { name: '学习包详情', exact: true })).toBeVisible();
    expect((await noPrivate()).stateVersion).toBe(1);
    await upload(child, runtime); await submit(child, 'Synthetic first correction'); await viewImage(child);
    expect((await noPrivate()).stateVersion).toBe(3);
    await openPackage(page, runtime, packageId); await viewImage(page);
    const first = expectData(await parent.get(packagePath)).package.attempts[0];
    await page.getByLabel('审核反馈', { exact: true }).fill('Please align the tens row.');
    const returned = await posted(`${packagePath}/attempts/${first.id}/review`,
      () => page.getByRole('button', { name: '退回再订正', exact: true }).click(), 200);
    expect(returned.request).toMatchObject({ expectedPackageVersion: 3, expectedAttemptVersion: 1,
      attemptPayloadHash: first.attemptPayloadHash, decision: 'revise' });
    const firstReviewed = json(await M.Attempt.findById(first.id).lean());
    expect(firstReviewed.review).toMatchObject({ reviewerId: fixture.actors.parent.userId, decision: 'revise',
      reviewOperationId: returned.request.operationId, mediaEvidence: null });
    await child.reload(); await expect(child.getByRole('heading', { name: '请再订正', exact: true })).toBeVisible();
    expect((await noPrivate()).stateVersion).toBe(4);
    await upload(child, runtime, 'synthetic-second.png'); await submit(child, 'Aligned tens row.');
    expect((await noPrivate()).stateVersion).toBe(6);
    await openPackage(page, runtime, packageId); await viewImage(page);
    const second = expectData(await parent.get(packagePath)).package.attempts[0];
    expect(second.id).not.toBe(first.id); expect(second.attemptVersion).toBe(2);
    await page.getByLabel('审核反馈', { exact: true }).fill('The counting units now align.');
    const accepted = await posted(`${packagePath}/attempts/${second.id}/review`,
      () => page.getByRole('button', { name: '通过所见订正', exact: true }).click(), 200);
    expect(accepted.request).toMatchObject({ expectedPackageVersion: 6, expectedAttemptVersion: 2,
      attemptPayloadHash: second.attemptPayloadHash, decision: 'approve' });
    await openPackage(page, runtime, packageId);
    await expect(page.getByRole('heading', { name: '已通过', exact: true })).toBeVisible();
    await child.reload(); await viewImage(child);
    await expect(child.getByRole('heading', { name: '已通过', exact: true })).toBeVisible();
    await expect(child.getByText(/家长反馈：通过 The counting units/)).toBeVisible();
    await expect(child.getByRole('button', { name: '提交订正', exact: true })).toBeDisabled();
    expect(await noPrivate()).toMatchObject({ stateVersion: 7, learningState: 'approved', pending: false,
      currentAttemptId: second.id, currentAttemptVersion: 2 });
    await capture(child, info, 'bridge-child-approved.png'); await capture(page, info, 'bridge-parent-approved.png');
    expect(json(await M.Attempt.findById(first.id).lean())).toEqual(firstReviewed);
    const attempts = json(await M.Attempt.find({ packageId }).sort({ attemptVersion: 1 }).lean());
    expect(attempts).toHaveLength(2);
    for (const [index, a] of attempts.entries()) {
      expect(a.submittedBy).toBe(fixture.actors.child.userId); expect(a.attemptVersion).toBe(index + 1);
      expect(a.payloadHash).toBe(hash({ note: a.note, mediaIds: a.mediaIds, bindings: a.mediaBindings,
        submittedBy: a.submittedBy, attemptVersion: a.attemptVersion }));
      expect(a.review.reviewerId).toBe(fixture.actors.parent.userId);
    }
    expect(attempts[1].review).toMatchObject({ decision: 'approve', reviewOperationId: accepted.request.operationId,
      mediaEvidence: { bindingsHash: hash(attempts[1].mediaBindings) } });
    const commands = json(await M.Command.find({}).lean()), writes = [...seen.writes, ...childSeen.writes];
    expect(commands).toHaveLength(5); expect(writes).toHaveLength(5);
    expect(commands.map(c => c.endpointOperation).sort()).toEqual(['ai2.publish', 'ai2.review', 'ai2.review', 'ai2.submit', 'ai2.submit']);
    for (const c of commands) {
      const write = writes.find(w => w.body.operationId === c.operationId);
      expect(write).toBeDefined(); expect(c.phase).toBe('SUCCEEDED'); expect(c.payload).toEqual(write.body);
      expect(c).toMatchObject({ packageId, familyId: fixture.familyId, childId: fixture.actors.child.childId,
        resultReference: { packageId } });
      expect(c.actorId).toBe(c.endpointOperation === 'ai2.submit' ? fixture.actors.child.userId : fixture.actors.parent.userId);
      expect(c.requestHash).toBe(hash({ method: 'POST', path: write.path, endpointOperation: c.endpointOperation, body: write.body }));
    }
    for (const observed of [seen, childSeen]) {
      expect(observed.errors).toEqual([]); expect(observed.console).toEqual([]);
      expect(observed.external).toEqual([]); expect(observed.failed).toEqual([]);
    }
  } finally { await childContext.close(); }
  const ai1After = await snapshot(A), afterCycle = ai1After.Cycle[0], beforeCycle = ai1Before.Cycle[0];
  expect(ai1After.Cycle).toHaveLength(1);
  expect(afterCycle.stateVersion).toBe(beforeCycle.stateVersion + 1);
  expect(new Date(afterCycle.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(beforeCycle.updatedAt).getTime());
  expect(ai1After).toEqual({ ...ai1Before, Cycle: [{ ...beforeCycle, stateVersion: beforeCycle.stateVersion + 1,
    updatedAt: afterCycle.updatedAt }] });
  const businessAfter = await runtime.snapshot();
  for (const name of ['Task', 'Ledger', 'Mistake', 'MistakeStateEvent', 'DailyPlan']) {
    expect(businessAfter.database[name]).toEqual(businessBefore.database[name]);
  }
  expect(businessCalls).toEqual(businessCallsBefore);
  expect(deniedTcp).toEqual(Array(3).fill('non-loopback TCP denied'));
  const job = await A.Job.findOne().lean();
  const requests = (await fs.readFile(process.env.AI1_ACTUAL_REQUESTS, 'utf8')).trim().split('\n').map(JSON.parse);
  expect(requests).toEqual([{ method: 'PUT', id: job.remoteOperationId }]);
  await fs.writeFile(process.env.AI1_ACTUAL_RESULT, JSON.stringify({ remoteOperationId: job.remoteOperationId,
    requestHash: job.remoteRequestHash, previewMessages: created.data.preview.messages, previewOptions: created.data.preview.requestOptions,
    source, engine: browserName, cycleId, packageId, approvedArtifactId: approvedArtifact.id,
    childSnapshotHash: expectedSnapshotHash, packageVersions: [1, 3, 4, 6, 7], attempts: 2,
    ai1UnchangedExceptPublicationCas: true, businessUnchanged: true, businessWriteCallsDuringAi2: 0,
    rejectedWriteProbeCount: 1, deniedTcpProbeCount: 3, unexpectedTcpCount: 0 }));
  if (process.env.AI3_BRIDGE === 'true') {
    await require('./ai3PracticeFlow').runAi3Flow({ page, browser, browserName, info, runtime, parent, packageId, source });
    expect(seen.errors).toEqual([]); expect(seen.console).toEqual([]); expect(seen.external).toEqual([]);
    expect(seen.failed).toEqual([]);
    expect(deniedTcp).toEqual(Array(3).fill('non-loopback TCP denied'));
  }
});

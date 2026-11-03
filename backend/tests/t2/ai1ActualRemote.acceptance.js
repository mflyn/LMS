// Explicit cross-checkout Jest acceptance; the Python driver owns the actual DeepTutor process.
const fs = require('fs/promises');
const { randomUUID } = require('crypto');
const { createT2Runtime } = require('./serviceRuntime');
const { expectData } = require('./syntheticSeed');
const command = () => ({ schemaVersion: 'ai1-min-v1', operationId: randomUUID() });
let runtime, previous;

afterEach(async () => {
  try { await runtime?.stop(); } finally {
    for (const [key, value] of Object.entries(previous || {})) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    runtime = null; previous = null;
  }
});

test('actual remote: original actor recovery, one settlement, private version chain and co-parent review', async () => {
  const origin = new URL(process.env.AI1_ACTUAL_REMOTE_ORIGIN);
  expect(origin.protocol).toBe('http:'); expect(origin.hostname).toBe('127.0.0.1');
  expect(['task', 'mistake']).toContain(process.env.AI1_ACTUAL_SOURCE);
  expect(['none', 'drop-response']).toContain(process.env.AI1_ACTUAL_REMOTE_FAULT);
  const profile = JSON.parse(process.env.AI1_ACTUAL_REMOTE_PROFILE);
  const settings = { AI1_MODE: 'enabled', AI1_ALLOW_LOOPBACK: 'true', AI1_LOCAL_STORE_CONTINUOUS: 'true',
    AI1_REMOTE_STORE_CONTINUOUS: 'true', AI1_PROVIDER_PROFILE_CONFIRMED: 'true',
    AI1_OPERATION_URL: origin.origin, AI1_OPERATION_TOKEN: 'synthetic-service-credential-00000001',
    AI1_MODEL_PROFILE: JSON.stringify(profile),
    AI1_BUDGET_LIMITS: JSON.stringify({ singleMicros: 16384, dayMicros: 163840, monthMicros: 163840, experimentMicros: 163840 }) };
  previous = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  runtime = await createT2Runtime({ beforeStart: () => Object.assign(process.env, settings) });
  const fixture = await runtime.seed(), parent = await runtime.login('parent'), coparent = await runtime.login('coparent');
  const child = await runtime.login('child'), sibling = await runtime.login('sibling'), outsider = await runtime.login('outsider');
  const M = require('../../services/homework-service/models/Ai1');
  const aiSnapshot = async () => JSON.stringify(await Promise.all(Object.values(M).map(model => model.find().sort({ _id: 1 }).lean())));
  const remoteRequests = async () => (await fs.readFile(process.env.AI1_ACTUAL_REQUESTS, 'utf8')).trim().split('\n').map(JSON.parse);
  const accounting = async (state, settledMicros, outstandingMicros) => {
    const job = await M.Job.findOne().lean();
    const reservation = await M.Reservation.findById(job.reservationId).lean();
    expect(String(reservation.jobId)).toBe(String(job._id));
    expect(reservation).toMatchObject({ state, settledMicros, reservedMicros: 16384 });
    const accounts = await M.Account.find().lean();
    expect(accounts.map(value => value._id).sort()).toEqual(['experiment', String(job.familyId)].sort());
    for (const account of accounts) expect(account).toMatchObject({ settledMicros: settledMicros ?? 0, outstandingMicros });
  };
  expectData(await parent.patch(`/api/growth-tasks/${fixture.tasks.child.taskId}`, { subject: 'math' }));
  let source = { type: 'task', id: fixture.tasks.child.taskId };
  if (process.env.AI1_ACTUAL_SOURCE === 'mistake') {
    const form = new FormData(); form.append('purpose', 'mistake_question'); form.append('childId', fixture.actors.child.childId);
    form.append('file', new Blob([fixture.image.bytes], { type: fixture.image.mimeType }), fixture.image.name);
    const mediaId = expectData(await parent.post('/api/media', form), 201).media.mediaId;
    const { mistake } = expectData(await parent.post('/api/mistakes', { childId: fixture.actors.child.childId,
      subject: 'Math', reason: 'calculation', knowledgePointName: 'Synthetic multiplication',
      questionMediaIds: [mediaId] }), 201);
    source = { type: 'mistake', id: mistake.mistakeId };
  }
  const before = await runtime.snapshot();
  const original = { ...command(), childId: fixture.actors.child.childId, source,
    input: { questionText: '206 * 30', answerText: '618', parentContext: 'Explain counting units.' },
    chapter: { provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper',
      textbookLabel: 'Synthetic', chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' }, deidentifiedConfirmed: true };
  const created = expectData(await parent.post('/api/tutor-cycles', original), 201), path = `/api/tutor-cycles/${created.cycle.id}`;
  const generation = { ...command(), expectedCycleStateVersion: created.cycle.stateVersion,
    generationInputHash: created.preview.generationInputHash, modelProfileVersion: created.preview.modelProfileVersion,
    pricingProfileVersion: created.preview.pricingProfileVersion,
    maxAuthorizedCostMicros: created.preview.reservedCeilingMicros, externalSendConfirmed: true };
  const sent = await parent.post(path + '/explanation-jobs', generation);
  if (process.env.AI1_ACTUAL_REMOTE_FAULT === 'drop-response') {
    expect(sent.status).toBe(503); expect(sent.data.error.code).toBe('AI_REMOTE_UNAVAILABLE');
    const unknown = await M.Job.findOne().lean(), reservation = await M.Reservation.findById(unknown.reservationId).lean();
    expect(unknown.status).toBe('unknown'); expect(reservation.settledMicros).toBeNull();
    expect((await M.Account.findById('experiment')).outstandingMicros).toBe(16384);
    await accounting('reserved_unknown', null, 16384);
    expect(await remoteRequests()).toEqual([{ method: 'PUT', id: unknown.remoteOperationId }]);
    expect(await M.Artifact.countDocuments()).toBe(0);
    const discovered = expectData(await parent.get(`/api/tutor-jobs?childId=${fixture.actors.child.childId}&scope=mine-unfinished`));
    expect(discovered.items.map(job => job.id)).toEqual([String(unknown._id)]);
    const recover = command();
    expect((await coparent.post(`/api/tutor-jobs/${unknown._id}/recover`, recover)).status).toBe(403);
    expect((await M.Reservation.findById(unknown.reservationId)).settledMicros).toBeNull();
    expect(await remoteRequests()).toEqual([{ method: 'PUT', id: unknown.remoteOperationId }]);
    const returned = await runtime.login('parent');
    const recovered = expectData(await returned.post(`/api/tutor-jobs/${unknown._id}/recover`, recover));
    expect(recovered.job.status).toBe('succeeded');
    await accounting('settled', 200, 0);
    const expectedRequests = [{ method: 'PUT', id: unknown.remoteOperationId }, { method: 'GET', id: unknown.remoteOperationId }];
    expect(await remoteRequests()).toEqual(expectedRequests);
    expectData(await returned.post(`/api/tutor-jobs/${unknown._id}/recover`, recover));
    await accounting('settled', 200, 0);
    expect(await remoteRequests()).toEqual(expectedRequests);
    expect((await M.Job.findById(unknown._id)).remoteOperationId).toBe(unknown.remoteOperationId);
  } else {
    expectData(sent, 202);
  }
  expectData(await parent.post(path + '/explanation-jobs', generation), 202);
  await accounting('settled', 200, 0);
  const generatedState = await aiSnapshot(), generatedRequests = await remoteRequests();
  const reusedGeneration = await parent.post(path + '/explanation-jobs', { ...generation,
    maxAuthorizedCostMicros: generation.maxAuthorizedCostMicros + 1 });
  expect(reusedGeneration.status).toBe(409); expect(reusedGeneration.data.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  expect(await aiSnapshot()).toBe(generatedState); expect(await remoteRequests()).toEqual(generatedRequests);
  let detail = expectData(await parent.get(path));
  expect(detail.job.status).toBe('succeeded'); expect(detail.artifacts).toHaveLength(1);
  expect(detail.artifacts[0].text).toBe('6180');
  expect(await M.Job.countDocuments()).toBe(1); expect(await M.Reservation.countDocuments()).toBe(1);
  let account = await M.Account.findById('experiment').lean();
  expect(account.settledMicros).toBe(200); expect(account.outstandingMicros).toBe(0);
  const seen = value => ({ artifactId: value.artifacts.at(-1).id, artifactVersion: value.artifacts.at(-1).version,
    artifactContentHash: value.artifacts.at(-1).contentHash, expectedArtifactReviewVersion: value.artifacts.at(-1).reviewVersion,
    expectedCycleStateVersion: value.cycle.stateVersion });
  const old = seen(detail);
  expectData(await parent.post(path + '/explanation-revisions', { ...command(), ...old,
    revisedText: '206 * 3 = 618; 30 is 3 tens, so 206 * 30 = 6180.', revisionReason: 'Clarify counting units.' }), 201);
  const review = { decision: 'approve', comment: '', checks: { mathCorrect: true, gradeAppropriate: true,
    chapterAppropriate: true, wordingReviewed: true } };
  const stale = await coparent.post(path + '/explanation-review', { ...command(), ...old, ...review });
  expect(stale.status).toBe(409);
  detail = expectData(await coparent.get(path));
  for (const change of [
    { expectedCycleStateVersion: detail.cycle.stateVersion + 1 },
    { artifactId: detail.artifacts[0].id },
    { artifactVersion: detail.artifacts.at(-1).version + 1 },
    { artifactContentHash: '0'.repeat(64) },
    { expectedArtifactReviewVersion: detail.artifacts.at(-1).reviewVersion + 1 }
  ]) {
    const baseline = await aiSnapshot();
    const invalid = await coparent.post(path + '/explanation-review', { ...command(), ...seen(detail), ...review, ...change });
    expect(invalid.status).toBe(409); expect(invalid.data.error.code).toBe('AI_VERSION_CONFLICT');
    expect(await aiSnapshot()).toBe(baseline);
  }
  const approval = { ...command(), ...seen(detail), ...review };
  const rival = { ...approval, operationId: randomUUID(), comment: 'Independent concurrent approval.' };
  const outcomes = await Promise.all([coparent.post(path + '/explanation-review', approval), coparent.post(path + '/explanation-review', rival)]);
  expect(outcomes.map(value => value.status).sort()).toEqual([200, 409]);
  expect(outcomes.find(value => value.status === 409).data.error.code).toBe('AI_VERSION_CONFLICT');
  const winner = outcomes[0].status === 200 ? approval : rival;
  const firstApproval = expectData(await parent.get(path));
  expect(firstApproval.cycle.stateVersion).toBe(detail.cycle.stateVersion + 1);
  expect(firstApproval.artifacts.at(-1).reviewVersion).toBe(detail.artifacts.at(-1).reviewVersion + 1);
  expectData(await coparent.post(path + '/explanation-review', winner));
  const approvedState = await aiSnapshot();
  const reusedApproval = await coparent.post(path + '/explanation-review', { ...winner, comment: 'Changed original command.' });
  expect(reusedApproval.status).toBe(409); expect(reusedApproval.data.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  expect(await aiSnapshot()).toBe(approvedState); expect(await remoteRequests()).toEqual(generatedRequests);
  detail = expectData(await parent.get(path));
  expect(detail).toEqual(firstApproval);
  expect(detail.cycle.status).toBe('approved'); expect(detail.artifacts).toHaveLength(2);
  expect(detail.artifacts[1].derivedFromArtifactId).toBe(detail.artifacts[0].id);
  expect(detail.artifacts[1].review.reviewerId).toBe(fixture.actors.coparent.userId);
  const unchanged = JSON.stringify(await Promise.all(Object.values(M).map(model => model.find().sort({ _id: 1 }).lean())));
  for (const [denied, status] of [[child, 403], [sibling, 403], [outsider, 404]]) {
    const deniedRead = await denied.get(path);
    expect(deniedRead.status).toBe(status); expect(JSON.stringify(deniedRead.data)).not.toContain('6180');
    expect((await denied.post(path + '/explanation-review', approval)).status).toBe(status);
  }
  const wrongChild = await parent.post('/api/tutor-cycles', { ...original, operationId: randomUUID(), childId: fixture.actors.sibling.childId });
  expect(wrongChild.status).toBe(404);
  expect(JSON.stringify(await Promise.all(Object.values(M).map(model => model.find().sort({ _id: 1 }).lean())))).toBe(unchanged);
  expect(await runtime.snapshot()).toEqual(before);
  account = await M.Account.findById('experiment').lean();
  const job = await M.Job.findOne().lean();
  await fs.writeFile(process.env.AI1_ACTUAL_RESULT, JSON.stringify({ remoteOperationId: job.remoteOperationId,
    remoteRequestHash: job.remoteRequestHash, settledMicros: account.settledMicros, outstandingMicros: account.outstandingMicros,
    artifactCount: detail.artifacts.length, reviewedBy: detail.artifacts[1].review.reviewerId, coparentId: fixture.actors.coparent.userId,
    previewMessages: created.preview.messages, previewOptions: created.preview.requestOptions,
    privateValues: [fixture.actors.child.childId, fixture.tasks.child.title, source.id] }));
});

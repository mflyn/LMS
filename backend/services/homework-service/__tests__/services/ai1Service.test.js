const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const M = require('../../models/Ai1');
const { createAi1Service } = require('../../services/ai1Service');
const { sha } = require('../../services/ai1Contract');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const id = () => String(new mongoose.Types.ObjectId());
const command = () => ({ schemaVersion: 'ai1-min-v1', operationId: randomUUID() });
let parent, coparent, child, otherChild, outsider, family, source, clock, profile, limits, service, reader, config;
const body = (sourceId = source) => ({ ...command(), childId: child, source: { type: 'task', id: sourceId },
  input: { questionText: '124 * 23', answerText: null, parentContext: '' },
  chapter: { provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper',
    textbookLabel: 'Synthetic', chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' }, deidentifiedConfirmed: true });
const create = async (actor = parent, request = body(), api = service) => api.create({ identity: actor, body: request });
const genBody = c => ({ ...command(), expectedCycleStateVersion: c.cycle.stateVersion,
  generationInputHash: c.preview.generationInputHash, modelProfileVersion: c.preview.modelProfileVersion,
  pricingProfileVersion: c.preview.pricingProfileVersion, maxAuthorizedCostMicros: c.preview.reservedCeilingMicros, externalSendConfirmed: true });
const generate = (c, actor = parent, b = genBody(c)) => service.generate({ identity: actor, cycleId: c.cycle.id, body: b });
const seen = c => ({ ...command(), artifactId: c.artifact.id, artifactVersion: c.artifact.version,
  artifactContentHash: c.artifact.contentHash, expectedArtifactReviewVersion: c.artifact.reviewVersion,
  expectedCycleStateVersion: c.cycleStateVersion });
const reviewBody = c => ({ ...seen(c), decision: 'approve', comment: '', checks: {
  mathCorrect: true, gradeAppropriate: true, chapterAppropriate: true, wordingReviewed: true } });
const outcome = job => ({ remoteOperationId: job.remoteOperationId, generationInputHash: job.preview.generationInputHash,
  modelProfileVersion: job.preview.modelProfileVersion, pricingProfileVersion: job.preview.pricingProfileVersion,
  sendNotAfter: job.sendNotAfter.toISOString(), status: 'succeeded', text: 'Synthetic draft: 124 * 23 = 2852.',
  usage: { inputTokens: 100, outputTokens: 50 } });
const candidate = async () => {
  const c = await create(), g = await generate(c);
  await service.claim({ identity: parent, jobId: g.job.id });
  const job = await M.Job.findById(g.job.id).lean();
  return { c, g, result: await service.applyOutcome({ jobId: g.job.id, evidence: outcome(job) }) };
};
beforeAll(async () => { for (const model of [...Object.values(M), Family, User]) await model.init(); });
beforeEach(async () => {
  clock = Date.parse('2026-11-01T01:00:00.000Z');
  profile = { model: 'synthetic-no-provider', modelProfileVersion: 'synthetic-model-1', pricingProfileVersion: 'synthetic-price-1',
    inputPriceMicrosPerMillion: 9000000, outputPriceMicrosPerMillion: 27000000,
    checkedAt: '2026-11-01T00:00:00.000Z', expiresAt: '2026-12-02T00:00:00.000Z', callWindowMs: 60000, clockMarginMs: 5000 };
  limits = { singleMicros: 184320, dayMicros: 1843200, monthMicros: 1843200, experimentMicros: 1843200 };
  config = { enabled: true, continuousStore: true };
  parent = { id: id(), role: 'parent' }; coparent = { id: id(), role: 'parent' }; outsider = { id: id(), role: 'parent' };
  child = id(); otherChild = id(); source = id();
  family = await Family.create({ familyName: 'Synthetic AI family', ownerParentId: parent.id,
    memberParentIds: [parent.id, coparent.id], childIds: [child, otherChild], timezone: 'UTC' });
  await User.collection.insertMany([parent, coparent, outsider].map(p => ({ _id: new mongoose.Types.ObjectId(p.id), role: p.role, username: p.id, email: `${p.id}@example.test` })));
  await User.collection.insertMany([child, otherChild].map(c => ({ _id: new mongoose.Types.ObjectId(c), role: 'student', familyId: family._id, username: c, email: `${c}@example.test` })));
  reader = jest.fn(async request => ({ id: request.sourceTaskId || request.sourceMistakeId,
    familyId: String(family._id), childId: child, subject: '\u6570\u5b66', title: 'DO NOT SEND SOURCE TITLE' }));
  service = createAi1Service({ now: () => clock, getProfile: () => profile, getLimits: () => limits,
    getRuntime: () => config, sourceReader: { require: reader } });
});
test('AI1-B detail preserves three-version lineage, first review and authorized read-only access', async () => {
  const { c, g, result } = await candidate();
  const second = await service.revise({ identity: coparent, cycleId: c.cycle.id,
    body: { ...seen(result), revisedText: 'Second synthetic version.', revisionReason: 'Place value' } });
  const third = await service.revise({ identity: parent, cycleId: c.cycle.id,
    body: { ...seen(second), revisedText: 'Third synthetic version.', revisionReason: 'Clarify units' } });
  const approved = await service.review({ identity: coparent, cycleId: c.cycle.id, body: reviewBody(third) });
  const snapshot = async () => JSON.stringify(await Promise.all(Object.values(M)
    .map(model => model.find().sort({ _id: 1 }).lean())));
  const before = await snapshot();
  const detail = await service.getCycle({ identity: parent, cycleId: c.cycle.id });
  expect(detail.artifacts.map(a => a.id)).toEqual([result.artifact.id, second.artifact.id, third.artifact.id]);
  expect(detail.artifacts.map(a => a.version)).toEqual([1, 2, 3]);
  expect(detail.artifacts.map(a => a.status)).toEqual(['superseded', 'superseded', 'parent_approved']);
  expect(detail.artifacts[0].text).toBe(result.artifact.text);
  expect(detail.artifacts[0].contentHash).toBe(result.artifact.contentHash);
  expect(detail.artifacts.map(a => a.derivedFromArtifactId)).toEqual([null, result.artifact.id, second.artifact.id]);
  expect(detail.artifacts.map(a => a.revisionReason)).toEqual([null, 'Place value', 'Clarify units']);
  expect(detail.artifacts[2].review).toEqual(approved.artifact.review);
  expect(detail.artifacts[2].createdBy).toBe(parent.id);
  expect(detail.artifacts[2].review.reviewerId).toBe(coparent.id);
  expect(detail.cycle.currentArtifactId).toBe(third.artifact.id);
  expect(detail.cycle.approvedArtifactId).toBe(third.artifact.id);
  expect(detail.job.id).toBe(g.job.id);
  expect(await snapshot()).toBe(before);
  await expect(service.getCycle({ identity: outsider, cycleId: c.cycle.id })).rejects.toMatchObject({ statusCode: 403 });
  await Family.updateOne({ _id: family._id }, { $set: { memberParentIds: [parent.id] } });
  await expect(service.getCycle({ identity: coparent, cycleId: c.cycle.id })).rejects.toMatchObject({ statusCode: 403 });
  expect(await snapshot()).toBe(before);
});
test('AI1-SCOPE-01 preview creates no job/fee and never imports source title; task and mistake', async () => {
  const a = await create(), b = body(id()); b.source.type = 'mistake'; await create(parent, b);
  expect(JSON.stringify(a.preview)).not.toContain('DO NOT SEND');
  expect(a.cycle).toMatchObject({ status: 'ready', stateVersion: 1 });
  expect(await M.Cycle.countDocuments()).toBe(2); expect(await M.Job.countDocuments()).toBe(0);
  expect(await M.Account.countDocuments()).toBe(0);
});
test('AI1-IDEM-01 same key replays, different text conflicts; access checked before private replay', async () => {
  const b = body(), c = await create(parent, b); expect(await create(parent, b)).toEqual(c);
  await expect(create(parent, { ...b, input: { ...b.input, parentContext: 'changed' } })).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  await Family.updateOne({ _id: family._id }, { $set: { memberParentIds: [coparent.id], ownerParentId: coparent.id } });
  await expect(create(parent, b)).rejects.toMatchObject({ statusCode: 403 });
  expect(await M.Cycle.countDocuments()).toBe(1);
});
test('AI1-AUTH-01 unauthenticated, child, outsider and wrong-child source rejected with no writes', async () => {
  for (const actor of [null, { id: child, role: 'student' }, outsider]) await expect(create(actor)).rejects.toMatchObject({ statusCode: actor ? 403 : 401 });
  await expect(create(parent, { ...body(), childId: otherChild })).rejects.toMatchObject({ statusCode: 404 });
  expect(await M.Cycle.countDocuments()).toBe(0);
});
test('AI1-AUTH-02 source dependency failure remains 503; unsupported subject has no effects', async () => {
  reader.mockRejectedValueOnce(Object.assign(new Error('unavailable'), { statusCode: 503, code: 'SOURCE_SERVICE_UNAVAILABLE' }));
  await expect(create()).rejects.toMatchObject({ code: 'SOURCE_SERVICE_UNAVAILABLE' });
  reader.mockImplementation(async q => ({ id: q.sourceTaskId, familyId: String(family._id), childId: child, subject: 'mathematics' }));
  await expect(create()).rejects.toMatchObject({ code: 'AI_SOURCE_SUBJECT_UNSUPPORTED' });
  expect(await M.Cycle.countDocuments()).toBe(0);
});
test('AI1-IDEM-02 same source concurrent cycle creation has one winner', async () => {
  const results = await Promise.allSettled([create(), create(coparent)]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.find(r => r.status === 'rejected').reason.code).toBe('AI_SOURCE_CYCLE_ACTIVE');
  expect(await M.Cycle.countDocuments()).toBe(1);
});
test('AI1-BUDGET-02 last shared allowance concurrent reservation has exactly one winner', async () => {
  limits.dayMicros = 184320;
  const a = await create(), b = await create(coparent, body(id()));
  const results = await Promise.allSettled([generate(a), generate(b, coparent)]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.find(r => r.status === 'rejected').reason.code).toBe('AI_BUDGET_EXCEEDED');
  expect(await M.Job.countDocuments()).toBe(1); expect(await M.Reservation.countDocuments()).toBe(1);
  expect((await M.Account.findById(String(family._id))).outstandingMicros).toBe(184320);
});
test('AI1-IDEM-01 same UUID different actors maps independently but shares budget; original retry once', async () => {
  const a = await create(), b = await create(coparent, body(id())), ba = genBody(a), bb = { ...genBody(b), operationId: ba.operationId };
  const x = await generate(a, parent, ba), y = await generate(b, coparent, bb);
  expect((await generate(a, parent, ba)).job.id).toBe(x.job.id);
  const jobs = await M.Job.find().lean(); expect(jobs).toHaveLength(2);
  expect(jobs[0].remoteOperationId).not.toBe(jobs[1].remoteOperationId);
  expect(jobs.map(j => j.operationId)).toEqual([ba.operationId, ba.operationId]);
  expect(x.job.id).not.toBe(y.job.id);
  expect((await M.Account.findById(String(family._id))).outstandingMicros).toBe(368640);
});
test('AI1-BUDGET-02 injected transaction failure rolls back cycle/job/reservation/counters/command', async () => {
  const c = await create();
  const failing = createAi1Service({ now: () => clock, getProfile: () => profile, getLimits: () => limits, getRuntime: () => config,
    sourceReader: { require: reader }, transactionRunner: work => runMongoTransaction({ mongooseInstance: mongoose,
      work: async s => { await work(s); throw new Error('synthetic rollback'); } }) });
  await expect(failing.generate({ identity: parent, cycleId: c.cycle.id, body: genBody(c) })).rejects.toThrow();
  for (const model of [M.Job, M.Reservation, M.Account]) expect(await model.countDocuments()).toBe(0);
  expect(await M.Command.countDocuments()).toBe(1);
  expect((await M.Cycle.findById(c.cycle.id)).status).toBe('ready');
});
test('AI1-BUDGET-06 quote mutation/expired and default-off refuse before reservation', async () => {
  const c = await create(); profile.pricingProfileVersion = 'changed';
  await expect(generate(c)).rejects.toMatchObject({ code: 'AI_PREVIEW_STALE' });
  profile.pricingProfileVersion = 'synthetic-price-1'; clock = Date.parse(c.preview.sendNotAfter);
  await expect(generate(c)).rejects.toMatchObject({ code: 'AI_PREVIEW_STALE' });
  const off = createAi1Service(); await expect(create(parent, body(id()), off)).rejects.toMatchObject({ code: 'AI_DISABLED' });
  expect(await M.Job.countDocuments()).toBe(0);
});
test('AI1-BUDGET-03 outstanding survives rollover, timezone change and lowered limits', async () => {
  const c = await create(), g = await generate(c); await service.claim({ identity: parent, jobId: g.job.id });
  await service.markUnknown({ jobId: g.job.id });
  clock = Date.parse('2026-12-01T01:00:00Z'); limits.dayMicros = 184320;
  await Family.updateOne({ _id: family._id }, { $set: { timezone: 'Pacific/Honolulu' } });
  const other = await create(parent, body(id()));
  await expect(generate(other)).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
  expect((await M.Reservation.findOne({ jobId: g.job.id })).state).toBe('reserved_unknown');
});
test('AI1-REV-01/04 simulated candidate, immutable revision, co-parent review and exact replay', async () => {
  const { c, g, result } = await candidate(), original = await M.Artifact.findById(result.artifact.id).lean();
  const revised = await service.revise({ identity: coparent, cycleId: c.cycle.id,
    body: { ...seen(result), revisedText: 'Verified synthetic explanation.', revisionReason: 'Clarify place values' } });
  expect(revised.artifact).toMatchObject({ version: 2, origin: 'parent_revision', createdBy: coparent.id, reviewVersion: 1 });
  const retained = await M.Artifact.findById(result.artifact.id).lean();
  expect(retained.text).toBe(original.text); expect(retained.contentHash).toBe(original.contentHash);
  expect(retained.status).toBe('superseded');
  const rb = reviewBody(revised), approved = await service.review({ identity: parent, cycleId: c.cycle.id, body: rb });
  expect(await service.review({ identity: parent, cycleId: c.cycle.id, body: rb })).toEqual(approved);
  expect(approved.artifact.review.reviewerId).toBe(parent.id);
  await expect(service.revise({ identity: parent, cycleId: c.cycle.id,
    body: { ...seen(approved), revisedText: 'later', revisionReason: 'later' } })).rejects.toMatchObject({ code: 'AI_VERSION_CONFLICT' });
  expect(await M.Reservation.countDocuments()).toBe(1); expect((await M.Job.findById(g.job.id)).createdBy.toString()).toBe(parent.id);
});
test('AI1-REV-02 concurrent revision/review: one CAS winner and no orphan artifact', async () => {
  const { c, result } = await candidate();
  const r = await Promise.allSettled([
    service.revise({ identity: parent, cycleId: c.cycle.id, body: { ...seen(result), revisedText: 'Changed draft.', revisionReason: 'Fix' } }),
    service.review({ identity: coparent, cycleId: c.cycle.id, body: reviewBody(result) })
  ]);
  expect(r.filter(x => x.status === 'fulfilled')).toHaveLength(1);
  expect(r.find(x => x.status === 'rejected').reason.code).toBe('AI_VERSION_CONFLICT');
  const cycle = await M.Cycle.findById(c.cycle.id); expect(cycle.stateVersion).toBe(result.cycleStateVersion + 1);
  const winner = r.find(x => x.status === 'fulfilled').value.artifact;
  const artifacts = await M.Artifact.find({ cycleId: c.cycle.id }).sort({ version: 1 }).lean();
  expect(String(cycle.currentArtifactId)).toBe(winner.id);
  expect(artifacts[0].text).toBe(result.artifact.text); expect(artifacts[0].contentHash).toBe(result.artifact.contentHash);
  expect(artifacts[0].reviewVersion).toBe(2);
  if (winner.origin === 'parent_revision') {
    expect(artifacts).toHaveLength(2); expect(artifacts[0].status).toBe('superseded');
    expect(artifacts[1]).toMatchObject({ status: 'candidate', reviewVersion: 1, version: 2 });
    expect(String(artifacts[1].derivedFromArtifactId)).toBe(result.artifact.id);
  } else {
    expect(artifacts).toHaveLength(1); expect(artifacts[0].status).toBe('parent_approved');
    expect(artifacts[0].review.reviewerId).toBe(coparent.id);
  }
});
test('AI1-REV-03 same text, missing checks and rejection without reason are zero-write', async () => {
  const { c, result } = await candidate(), before = await M.Cycle.findById(c.cycle.id).lean();
  await expect(service.revise({ identity: parent, cycleId: c.cycle.id,
    body: { ...seen(result), revisedText: result.artifact.text, revisionReason: 'none' } })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  await expect(service.review({ identity: parent, cycleId: c.cycle.id,
    body: { ...reviewBody(result), checks: {} } })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  await expect(service.review({ identity: parent, cycleId: c.cycle.id,
    body: { ...reviewBody(result), decision: 'reject', comment: ' ' } })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(await M.Cycle.findById(c.cycle.id).lean()).toEqual(before); expect(await M.Artifact.countDocuments()).toBe(1);
});
test('unknown holds global slot and cycle, GET is read-only; co-parent cannot claim original job', async () => {
  const c = await create(), g = await generate(c); await service.claim({ identity: parent, jobId: g.job.id });
  await service.markUnknown({ jobId: g.job.id });
  const before = await M.Job.findById(g.job.id).lean();
  await service.getJob({ identity: coparent, jobId: g.job.id });
  expect(await M.Job.findById(g.job.id).lean()).toEqual(before);
  await expect(service.claim({ identity: coparent, jobId: g.job.id })).rejects.toMatchObject({ code: 'AI_ORIGINAL_ACTOR_REQUIRED' });
  await expect(service.close({ identity: parent, cycleId: c.cycle.id, body: { ...command(), expectedCycleStateVersion: 2, reason: 'close' } })).rejects.toMatchObject({ code: 'AI_OPERATION_UNRESOLVED' });
  const c2 = await create(parent, body(id())), g2 = await generate(c2);
  await expect(service.claim({ identity: parent, jobId: g2.job.id })).rejects.toMatchObject({ code: 'AI_OPERATION_UNRESOLVED' });
});
test('storage isolation precedes old success settlement; correct terminal evidence settles only once', async () => {
  const c = await create(), g = await generate(c); await service.claim({ identity: parent, jobId: g.job.id });
  const job = await M.Job.findById(g.job.id).lean(), e = outcome(job); config.continuousStore = false;
  await expect(service.applyOutcome({ jobId: g.job.id, evidence: e })).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
  expect(await M.Artifact.countDocuments()).toBe(0); config.continuousStore = true;
  const r = await service.applyOutcome({ jobId: g.job.id, evidence: e });
  expect(await service.applyOutcome({ jobId: g.job.id, evidence: e })).toEqual(r);
  expect(r.artifact.contentHash).toBe(sha(e.text));
  expect((await M.Account.findById(String(family._id))).settledMicros).toBe(2250);
  await expect(service.applyOutcome({ jobId: g.job.id, evidence: { ...e, text: 'late conflict' } })).rejects.toMatchObject({ code: 'AI_REMOTE_CONTRACT_INVALID' });
});
test('replay after deleted source and disabled generation reads persisted current job, not stale reserved snapshot', async () => {
  const b = body(), c = await create(parent, b), gb = genBody(c), g = await generate(c, parent, gb);
  await service.claim({ identity: parent, jobId: g.job.id });
  const job = await M.Job.findById(g.job.id).lean(); await service.applyOutcome({ jobId: g.job.id, evidence: outcome(job) });
  reader.mockRejectedValue(Object.assign(new Error('removed'), { code: 'RESOURCE_NOT_FOUND', statusCode: 404 }));
  config.enabled = false;
  expect(await create(parent, b)).toEqual(c);
  expect((await generate(c, parent, gb)).job.status).toBe('succeeded');
  expect(await M.Job.countDocuments()).toBe(1);
});
test('missing usage holds reservation even after close, preserves approved artifact and allows no extra job', async () => {
  const c = await create(), g = await generate(c); await service.claim({ identity: parent, jobId: g.job.id });
  const job = await M.Job.findById(g.job.id).lean();
  const result = await service.applyOutcome({ jobId: g.job.id, evidence: { ...outcome(job), usage: null } });
  const approved = await service.review({ identity: parent, cycleId: c.cycle.id, body: reviewBody(result) });
  await expect(generate(c)).rejects.toMatchObject({ code: 'AI_OPERATION_UNRESOLVED' });
  await service.close({ identity: parent, cycleId: c.cycle.id,
    body: { ...command(), expectedCycleStateVersion: approved.cycleStateVersion, reason: 'done' } });
  expect((await M.Artifact.findById(result.artifact.id)).status).toBe('parent_approved');
  expect((await M.Account.findById(String(family._id))).outstandingMicros).toBe(184320);
  expect((await M.Reservation.findById(job.reservationId)).state).toBe('reserved_unknown');
});
test('AI1-AUTH-01 all private getters refuse children/outsiders and removed co-parent before edits/replays', async () => {
  const { c, g, result } = await candidate();
  const methods = actor => [() => service.getCycle({ identity: actor, cycleId: c.cycle.id }),
    () => service.getJob({ identity: actor, jobId: g.job.id }),
    () => service.getArtifact({ identity: actor, artifactId: result.artifact.id }),
    () => service.review({ identity: actor, cycleId: c.cycle.id, body: reviewBody(result) })];
  for (const actor of [{ id: child, role: 'student' }, outsider]) {
    for (const call of methods(actor)) await expect(call()).rejects.toMatchObject({ statusCode: 403 });
  }
  await Family.updateOne({ _id: family._id }, { $set: { memberParentIds: [parent.id] } });
  for (const call of methods(coparent)) await expect(call()).rejects.toMatchObject({ statusCode: 403 });
  expect((await M.Artifact.findById(result.artifact.id)).status).toBe('candidate');
});
test('AI1-BUDGET-03 settlement belongs to actual settlement period and experiment ceiling never resets', async () => {
  const c = await create(), g = await generate(c); await service.claim({ identity: parent, jobId: g.job.id });
  clock = Date.parse('2026-12-01T00:00:01Z');
  const job = await M.Job.findById(g.job.id).lean(); await service.applyOutcome({ jobId: g.job.id, evidence: outcome(job) });
  const r = await M.Reservation.findById(job.reservationId); expect(r.reservedMonth).toBe('2026-11');
  expect(r.settledAt.toISOString()).toBe('2026-12-01T00:00:01.000Z');
  limits.dayMicros = 184320; const next = await create(parent, body(id()));
  await expect(generate(next)).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
  limits.dayMicros = 1843200; limits.experimentMicros = 184320;
  await expect(generate(next)).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
});
test('AI1-IDEM-01 concurrent identical commands and lost commit acknowledgement preserve one mapping', async () => {
  const c = await create(), b = genBody(c);
  const losingResponse = createAi1Service({ now: () => clock, getProfile: () => profile, getLimits: () => limits,
    getRuntime: () => config, sourceReader: { require: reader }, transactionRunner: async work => {
      await runMongoTransaction({ mongooseInstance: mongoose, work }); throw new Error('synthetic lost commit acknowledgement');
    } });
  await expect(losingResponse.generate({ identity: parent, cycleId: c.cycle.id, body: b })).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  const persisted = await M.Job.findOne({ cycleId: c.cycle.id }).lean();
  const retried = await Promise.all([generate(c, parent, b), generate(c, parent, b)]);
  expect(retried.map(r => r.job.id)).toEqual([String(persisted._id), String(persisted._id)]);
  expect((await M.Job.findById(persisted._id)).remoteOperationId).toBe(persisted.remoteOperationId);
  expect(await M.Reservation.countDocuments()).toBe(1);
  expect((await M.Account.findById('experiment')).outstandingMicros).toBe(184320);
});
test('AI1-REV-02 wrong hash/version and two concurrent reviews cannot change first audit', async () => {
  const { c, result } = await candidate();
  for (const patch of [{ artifactContentHash: '0'.repeat(64) }, { artifactVersion: 2 }, { expectedArtifactReviewVersion: 2 }, { expectedCycleStateVersion: 1 }]) {
    await expect(service.review({ identity: parent, cycleId: c.cycle.id, body: { ...reviewBody(result), ...patch } })).rejects.toMatchObject({ code: 'AI_VERSION_CONFLICT' });
  }
  const results = await Promise.allSettled([parent, coparent].map(identity => service.review({ identity, cycleId: c.cycle.id, body: reviewBody(result) })));
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.find(r => r.status === 'rejected').reason.code).toBe('AI_VERSION_CONFLICT');
  const a = await M.Artifact.findById(result.artifact.id).lean(); expect(a.reviewVersion).toBe(2);
  expect(a.review).toEqual(results.find(r => r.status === 'fulfilled').value.artifact.review);
});
test('AI1-OFF-01 missing unique index refuses new writes without creating counters', async () => {
  await M.Job.collection.dropIndex('cycleId_1');
  try {
    await expect(create()).rejects.toMatchObject({ code: 'AI_PROFILE_UNAVAILABLE' });
    expect(await M.Cycle.countDocuments()).toBe(0); expect(await M.Account.countDocuments()).toBe(0);
  } finally { await M.Job.createIndexes(); }
});
test('AI1-AUTH-01 parent in another family receives scoped 404; sibling source cannot be substituted', async () => {
  const { c, g, result } = await candidate();
  await Family.create({ familyName: 'Other synthetic family', ownerParentId: outsider.id, memberParentIds: [outsider.id], childIds: [] });
  for (const call of [() => service.getCycle({ identity: outsider, cycleId: c.cycle.id }),
    () => service.getJob({ identity: outsider, jobId: g.job.id }), () => service.getArtifact({ identity: outsider, artifactId: result.artifact.id })]) {
    await expect(call()).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', statusCode: 404 });
  }
  await expect(create(parent, { ...body(id()), childId: otherChild })).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
});
test('AI1-BUDGET-01 one micro short in each budget refuses atomically', async () => {
  const c = await create();
  for (const key of ['singleMicros', 'dayMicros', 'monthMicros', 'experimentMicros']) {
    const previous = limits[key]; limits[key] = 184319;
    await expect(generate(c)).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' }); limits[key] = previous;
    expect(await M.Job.countDocuments()).toBe(0); expect(await M.Account.countDocuments()).toBe(0);
  }
  expect((await generate(c)).job.budget.reservedMicros).toBe(184320);
});
test('AI1-IDEM-01 two absent identical commands race on FIRST execution, with one shared reservation', async () => {
  const c = await create(), b = genBody(c);
  expect(await M.Job.countDocuments()).toBe(0);
  expect(await M.Command.countDocuments({ endpointOperation: 'ai1.generate' })).toBe(0);
  const results = await Promise.all([generate(c, parent, b), generate(c, parent, b)]);
  expect(results[0].job.id).toBe(results[1].job.id);
  expect(await M.Job.countDocuments()).toBe(1); expect(await M.Reservation.countDocuments()).toBe(1);
  expect(await M.Command.countDocuments({ endpointOperation: 'ai1.generate' })).toBe(1);
  for (const key of [String(family._id), 'experiment']) {
    expect((await M.Account.findById(key)).outstandingMicros).toBe(184320);
  }
});

describe('batch B persistent recovery and terminal accounting', () => {
  const { buildRequest } = require('../../services/ai1Operation');
  let client;
  const remoteResult = (j, patch = {}) => ({ remoteOperationId: j.remoteOperationId, requestHash: buildRequest(j).requestHash,
    modelProfileVersion: j.preview.modelProfileVersion, pricingProfileVersion: j.preview.pricingProfileVersion,
    sendNotAfter: j.preview.sendNotAfter, status: 'succeeded', result: { text: 'Synthetic draft', contentHash: sha('Synthetic draft') },
    error: null, usage: { inputTokens: 100, outputTokens: 50 }, sendClaimed: true, updatedAt: new Date(clock).toISOString(), ...patch });
  const restart = () => createAi1Service({ now: () => clock, getProfile: () => profile, getLimits: () => limits,
    getRuntime: () => config, sourceReader: { require: reader }, operationClient: client });
  beforeEach(() => { client = { put: jest.fn(async j => remoteResult(j)), get: jest.fn(async j => remoteResult(j)) }; service = restart(); });
  const afterCommit = hook => createAi1Service({ now: () => clock, getProfile: () => profile,
    getLimits: () => limits, getRuntime: () => config, sourceReader: { require: reader }, operationClient: client,
    transactionRunner: async work => {
      const result = await runMongoTransaction({ mongooseInstance: mongoose, work });
      await hook(result); return result;
    } });
  const accountsAre = async (outstandingMicros, settledMicros) => {
    const rows = await M.Account.find().lean();
    expect(rows.map(row => row._id).sort()).toEqual([String(family._id), 'experiment'].sort());
    for (const row of rows) expect(row).toMatchObject({ outstandingMicros, settledMicros });
  };
  test('AI1-AUTH-02 revocation after durable claim and before PUT preserves the unknown charge', async () => {
    const c = await create(), g = await generate(c);
    let revoked = false;
    service = afterCommit(async result => {
      if (result?.claimed === true) {
        revoked = true;
        await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: coparent.id, memberParentIds: [coparent.id] } });
      }
    });
    await expect(service.recover({ identity: parent, jobId: g.job.id, body: command() })).rejects.toMatchObject({ statusCode: 403 });
    expect(revoked).toBe(true);
    expect(client.put).not.toHaveBeenCalled(); expect(client.get).not.toHaveBeenCalled();
    const job = await M.Job.findById(g.job.id).lean();
    expect(job.status).toBe('dispatching'); expect(job.owner).toBeTruthy();
    expect(String((await M.Slot.findById('global')).jobId)).toBe(g.job.id);
    expect((await M.Reservation.findById(job.reservationId)).state).toBe('reserved');
    await accountsAre(184320, 0);
  });
  test('AI1-RECOVER-02 committed settlement acknowledgement loss never duplicates artifact or charge', async () => {
    const c = await create(), g = await generate(c); let lost = false;
    service = afterCommit(async result => {
      if (!lost && result?.artifact) { lost = true; throw new Error('synthetic settlement acknowledgement loss'); }
    });
    await expect(service.recover({ identity: parent, jobId: g.job.id, body: command() })).rejects.toMatchObject({ code: 'AI_REMOTE_UNAVAILABLE' });
    expect(lost).toBe(true);
    const persisted = await M.Job.findById(g.job.id).lean();
    const before = JSON.stringify(await Promise.all([M.Job, M.Artifact, M.Account, M.Reservation, M.Slot]
      .map(model => model.find().sort({ _id: 1 }).lean())));
    service = restart();
    expect((await service.recover({ identity: parent, jobId: g.job.id, body: command() })).job.status).toBe('succeeded');
    expect(JSON.stringify(await Promise.all([M.Job, M.Artifact, M.Account, M.Reservation, M.Slot]
      .map(model => model.find().sort({ _id: 1 }).lean())))).toBe(before);
    expect(await M.Artifact.countDocuments()).toBe(1);
    expect((await M.Job.findById(g.job.id)).remoteOperationId).toBe(persisted.remoteOperationId);
    expect(client.put).toHaveBeenCalledTimes(1); expect(client.get).not.toHaveBeenCalled();
    await accountsAre(0, 2250);
  });
  test.each([true, false])('AI1-BUDGET-07 deadline transaction acknowledgement loss: dispatch=%s', async dispatch => {
    const c = await create(), g = await generate(c);
    clock = Date.parse(c.preview.sendNotAfter) - (dispatch ? 1 : 0);
    let lost = false;
    service = afterCommit(async result => {
      if (!lost && typeof result?.claimed === 'boolean') {
        lost = true; throw new Error('synthetic claim acknowledgement loss');
      }
    });
    await expect(service.claim({ identity: parent, jobId: g.job.id })).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    expect(lost).toBe(true); clock += 1000;
    const persisted = await M.Job.findById(g.job.id).lean();
    const terminal = remoteResult(persisted, { status: 'sending', result: null, usage: null });
    client.get.mockResolvedValue(terminal);
    service = restart();
    const recovered = await service.recover({ identity: parent, jobId: g.job.id, body: command() });
    expect(recovered.job.status).toBe(dispatch ? 'unknown' : 'failed');
    expect(client.put).not.toHaveBeenCalled(); expect(client.get).toHaveBeenCalledTimes(dispatch ? 1 : 0);
    expect((await M.Job.findById(g.job.id)).remoteOperationId).toBe(persisted.remoteOperationId);
    expect((await M.Reservation.findById(persisted.reservationId)).state).toBe(dispatch ? 'reserved_unknown' : 'released');
    expect((await M.Slot.findById('global'))?.jobId?.toString() || null).toBe(dispatch ? g.job.id : null);
    await accountsAre(dispatch ? 184320 : 0, 0);
  });
  test.each(['expired', 'replaced'])('AI1-BUDGET-09 original quote settles once after current quote is %s', async change => {
    const c = await create(), g = await generate(c); await service.claim({ identity: parent, jobId: g.job.id });
    const original = await M.Job.findById(g.job.id).lean(), terminal = remoteResult(original);
    client.get.mockResolvedValue(terminal);
    if (change === 'expired') clock = Date.parse(profile.expiresAt) + 1;
    else profile = { ...profile, pricingProfileVersion: 'replacement', inputPriceMicrosPerMillion: 90000000, outputPriceMicrosPerMillion: 270000000 };
    service = restart();
    const rb = command();
    for (let i = 0; i < 2; i++) expect((await service.recover({ identity: parent, jobId: g.job.id, body: rb })).job.status).toBe('succeeded');
    expect(client.put).not.toHaveBeenCalled(); expect(client.get).toHaveBeenCalledTimes(1);
    expect(await M.Artifact.countDocuments()).toBe(1); await accountsAre(0, 2250);
    expect((await M.Reservation.findById(original.reservationId)).settledMicros).toBe(2250);
    expect((await M.Job.findById(g.job.id)).preview.pricingProfileVersion).toBe(original.preview.pricingProfileVersion);
  });
  test.each(['task', 'mistake'])('AI1-SCOPE-03 %s subject drift after preview releases once without remote calls', async type => {
    const request = body(); request.source.type = type;
    const c = await create(parent, request), g = await generate(c);
    expect(await M.Cycle.findById(c.cycle.id).lean()).toMatchObject({ sourceType: type,
      sourceSubject: '\u6570\u5b66', subjectAliasVersion: 'ai1-subject-alias-v1' });
    reader.mockImplementation(async q => ({ id: q.sourceTaskId || q.sourceMistakeId,
      familyId: String(family._id), childId: child, subject: 'mathematics' }));
    const rb = command();
    for (let i = 0; i < 2; i++) expect((await service.recover({ identity: parent, jobId: g.job.id, body: rb })).job)
      .toMatchObject({ status: 'failed', failureCode: 'AI_SOURCE_SUBJECT_UNSUPPORTED', budget: { state: 'released' } });
    expect(client.put).not.toHaveBeenCalled(); expect(client.get).not.toHaveBeenCalled();
    expect(await M.Artifact.countDocuments()).toBe(0); await accountsAre(0, 0);
    expect((await M.Cycle.findById(c.cycle.id)).sourceSubject).toBe('\u6570\u5b66');
  });
  test('AI1-BUDGET-08 lost reliable rejection response releases only after original mapping GET', async () => {
    const c = await create(), g = await generate(c); let rejected;
    client.put.mockImplementation(async j => {
      rejected = remoteResult(j, { status: 'failed_not_sent', result: null, usage: null, sendClaimed: false, error: 'PREVIEW_STALE' });
      throw new Error('synthetic rejected response lost');
    });
    await expect(service.recover({ identity: parent, jobId: g.job.id, body: command() })).rejects.toMatchObject({ code: 'AI_REMOTE_UNAVAILABLE' });
    expect(rejected).toBeDefined(); await accountsAre(184320, 0);
    client.get.mockResolvedValue(rejected); service = restart();
    const rb = command();
    for (let i = 0; i < 2; i++) expect((await service.recover({ identity: parent, jobId: g.job.id, body: rb })).job)
      .toMatchObject({ status: 'failed', failureCode: 'AI_PREVIEW_STALE', budget: { state: 'released' } });
    expect(client.put).toHaveBeenCalledTimes(1); expect(client.get).toHaveBeenCalledTimes(1);
    expect(client.get.mock.calls[0][0].remoteOperationId).toBe(rejected.remoteOperationId);
    expect(await M.Artifact.countDocuments()).toBe(0); await accountsAre(0, 0);
  });
  test('lost PUT response then restart queries persisted mapping only and settles once', async () => {
    const c = await create(), b = genBody(c);
    client.put.mockRejectedValueOnce(new Error('synthetic transport loss'));
    await expect(service.generateAndRun({ identity: parent, cycleId: c.cycle.id, body: b })).rejects.toMatchObject({ code: 'AI_REMOTE_UNAVAILABLE' });
    const j = await M.Job.findOne().lean(); expect(j.status).toBe('unknown');
    expect(j.remoteRequestHash).toBe(buildRequest(j).requestHash); expect(j.owner).toBeTruthy(); expect(j.leaseExpiresAt).toBeInstanceOf(Date);
    service = restart(); const rb = command();
    expect((await service.recover({ identity: parent, jobId: String(j._id), body: rb })).job.status).toBe('succeeded');
    expect((await service.recover({ identity: parent, jobId: String(j._id), body: rb })).job.status).toBe('succeeded');
    expect(client.put).toHaveBeenCalledTimes(1); expect(client.get).toHaveBeenCalledTimes(1);
    expect(await M.Artifact.countDocuments()).toBe(1); expect((await M.Account.findById('experiment')).settledMicros).toBe(2250);
    expect((await M.Job.findById(j._id)).remoteOperationId).toBe(j.remoteOperationId);
  });
  test('reserved expiry releases once by CAS; claimed expiry and 404 never release or resend', async () => {
    const c = await create(), g = await generate(c); clock = Date.parse(c.preview.sendNotAfter);
    const r = await service.recover({ identity: parent, jobId: g.job.id, body: command() });
    expect(r.job).toMatchObject({ status: 'failed', failureCode: 'AI_PREVIEW_STALE', budget: { state: 'released' } });
    expect((await M.Account.findById('experiment')).outstandingMicros).toBe(0);
    expect(client.put).not.toHaveBeenCalled(); expect(client.get).not.toHaveBeenCalled();
    await service.recover({ identity: parent, jobId: g.job.id, body: command() });
    expect((await M.Account.findById('experiment')).outstandingMicros).toBe(0);
  });
  test('post-claim expiry, missing remote and unknown lease remain held; GET stays read-only', async () => {
    const c = await create(), g = await generate(c); await service.claim({ identity: parent, jobId: g.job.id });
    clock = Date.parse(c.preview.sendNotAfter) + 100000;
    client.get.mockRejectedValue(Object.assign(new Error('missing'), { statusCode: 503, code: 'AI_REMOTE_UNAVAILABLE' }));
    await expect(service.recover({ identity: parent, jobId: g.job.id, body: command() })).rejects.toMatchObject({ code: 'AI_REMOTE_UNAVAILABLE' });
    expect(client.put).not.toHaveBeenCalled(); expect((await M.Account.findById('experiment')).outstandingMicros).toBe(184320);
    expect((await M.Slot.findById('global')).jobId.toString()).toBe(g.job.id);
    const before = await M.Job.findById(g.job.id).lean(); await service.getJob({ identity: parent, jobId: g.job.id });
    expect(await M.Job.findById(g.job.id).lean()).toEqual(before);
  });
  test.each(['failed_not_sent', 'failed_sent'])('reliable %s closes once, preserving usage semantics', async status => {
    client.put.mockImplementation(async j => remoteResult(j, { status, result: null, error: status === 'failed_not_sent' ? 'PREVIEW_STALE' : 'PROVIDER_FAILED',
      sendClaimed: status !== 'failed_not_sent', usage: null }));
    const c = await create(), g = await service.generateAndRun({ identity: parent, cycleId: c.cycle.id, body: genBody(c) });
    expect(g.job.status).toBe('failed');
    expect(g.job.budget.state).toBe(status === 'failed_not_sent' ? 'released' : 'reserved_unknown');
    expect((await M.Account.findById('experiment')).outstandingMicros).toBe(status === 'failed_not_sent' ? 0 : 184320);
    expect((await M.Cycle.findById(c.cycle.id)).status).toBe('ready');
    await expect(generate(c)).rejects.toMatchObject({ code: 'AI_OPERATION_UNRESOLVED' });
    await service.recover({ identity: parent, jobId: g.job.id, body: command() }); expect(client.put).toHaveBeenCalledTimes(1);
  });
  test('original actor, live revocation and restoration isolation precede all remote requests', async () => {
    const c = await create(), g = await generate(c);
    await expect(service.recover({ identity: coparent, jobId: g.job.id, body: command() })).rejects.toMatchObject({ code: 'AI_ORIGINAL_ACTOR_REQUIRED' });
    config.continuousStore = false;
    await expect(service.recover({ identity: parent, jobId: g.job.id, body: command() })).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
    config.continuousStore = true; await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: coparent.id, memberParentIds: [coparent.id] } });
    await expect(service.recover({ identity: parent, jobId: g.job.id, body: command() })).rejects.toMatchObject({ statusCode: 403 });
    expect(client.put).not.toHaveBeenCalled(); expect(client.get).not.toHaveBeenCalled();
  });
  test('list discovery is actor scoped, paginated and read-only; another parent sees no body', async () => {
    const c = await create(), g = await generate(c);
    expect((await service.listJobs({ identity: coparent, childId: child })).items).toEqual([]);
    const rows = await service.listJobs({ identity: parent, childId: child });
    expect(rows.items.map(r => r.id)).toEqual([g.job.id]);
    expect(Object.keys(rows.items[0]).sort()).toEqual(['id', 'cycleId', 'operationId', 'createdBy', 'status', 'recoveryStatus',
      'canRecover', 'artifactId', 'failureCode', 'budget', 'createdAt', 'updatedAt'].sort());
    expect(JSON.stringify(rows)).not.toContain('124 * 23');
    await expect(service.listJobs({ identity: parent, childId: child, pageSize: 101 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(client.get).not.toHaveBeenCalled(); expect(client.put).not.toHaveBeenCalled();
  });
  test('invalid terminal halts pending claims too, not just new reservations', async () => {
    const a = await create(), b = await create(parent, body(id()));
    const ga = await generate(a), gb = await generate(b);
    client.put.mockImplementation(async j => remoteResult(j, { usage: { inputTokens: 8193, outputTokens: 0 } }));
    await expect(service.recover({ identity: parent, jobId: ga.job.id, body: command() })).rejects.toMatchObject({ code: 'AI_REMOTE_CONTRACT_INVALID' });
    expect((await M.Account.findById('experiment')).halted).toBe(true);
    // A global slot can be empty after operator/test evidence; halt is independently enforced.
    await M.Slot.updateOne({ _id: 'global' }, { $set: { jobId: null } });
    await expect(service.recover({ identity: parent, jobId: gb.job.id, body: command() })).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
    expect(client.put).toHaveBeenCalledTimes(1); expect((await M.Job.findById(gb.job.id)).status).toBe('reserved');
  });
  test('concurrent recover on reserved job never creates a second PUT or charge', async () => {
    const c = await create(), g = await generate(c), rb = command();
    await Promise.all([service.recover({ identity: parent, jobId: g.job.id, body: rb }), service.recover({ identity: parent, jobId: g.job.id, body: rb })]);
    expect(client.put).toHaveBeenCalledTimes(1); expect(await M.Artifact.countDocuments()).toBe(1);
    expect((await M.Account.findById('experiment')).settledMicros).toBe(2250);
  });
  test('source error before claim stays reserved; removed source releases without any remote request', async () => {
    const c = await create(), g = await generate(c);
    reader.mockRejectedValueOnce(Object.assign(new Error('synthetic'), { code: 'SOURCE_SERVICE_UNAVAILABLE', statusCode: 503 }));
    await expect(service.recover({ identity: parent, jobId: g.job.id, body: command() })).rejects.toMatchObject({ code: 'SOURCE_SERVICE_UNAVAILABLE' });
    expect((await M.Job.findById(g.job.id)).status).toBe('reserved');
    reader.mockResolvedValueOnce(null);
    expect((await service.recover({ identity: parent, jobId: g.job.id, body: command() })).job.budget.state).toBe('released');
    expect(client.put).not.toHaveBeenCalled();
  });
  test('claim crossing deadline retains unknown charge and does not PUT after final recheck', async () => {
    const c = await create(), g = await generate(c), deadline = Date.parse(c.preview.sendNotAfter);
    let checks = 0;
    service = createAi1Service({ now: () => clock, getProfile: () => {
      checks++; if (checks === 2) clock = deadline;
      return profile;
    }, getRuntime: () => config, getLimits: () => limits, sourceReader: { require: reader }, operationClient: client });
    await expect(service.recover({ identity: parent, jobId: g.job.id, body: command() })).rejects.toMatchObject({ code: 'AI_PREVIEW_STALE' });
    expect(client.put).not.toHaveBeenCalled(); expect((await M.Job.findById(g.job.id)).status).toBe('unknown');
    expect((await M.Account.findById('experiment')).outstandingMicros).toBe(184320);
  });
  test('review P1 remote claim evidence survives restart and rejects contradictory refund', async () => {
    client.put.mockImplementation(async j => remoteResult(j, { status: 'sending', result: null, usage: null }));
    const c = await create(), g = await service.generateAndRun({ identity: parent, cycleId: c.cycle.id, body: genBody(c) });
    service = restart();
    client.get.mockImplementation(async j => remoteResult(j, { status: 'failed_not_sent', result: null, usage: null, sendClaimed: false, error: 'PREVIEW_STALE' }));
    await expect(service.recover({ identity: parent, jobId: g.job.id, body: command() })).rejects.toMatchObject({ code: 'AI_REMOTE_CONTRACT_INVALID' });
    const j = await M.Job.findById(g.job.id); expect(j.remoteClaimObserved).toBe(true); expect(j.status).toBe('unknown');
    expect((await M.Reservation.findById(j.reservationId)).state).toBe('reserved_unknown');
    const a = await M.Account.findById('experiment'); expect(a.outstandingMicros).toBe(184320); expect(a.halted).toBe(true);
    expect(String((await M.Slot.findById('global')).jobId)).toBe(g.job.id); expect(await M.Artifact.countDocuments()).toBe(0);
  });
  test('review P1 late contradictory refund cannot race past committed remote claim observation', async () => {
    client.put.mockRejectedValueOnce(new Error('lost'));
    const c = await create(); await expect(service.generateAndRun({ identity: parent, cycleId: c.cycle.id, body: genBody(c) })).rejects.toThrow();
    const j = await M.Job.findOne().lean(); let releaseRefund;
    const deferred = new Promise(resolve => { releaseRefund = resolve; });
    client.get.mockImplementationOnce(async job => { await deferred; return remoteResult(job, { status: 'failed_not_sent', result: null,
      usage: null, sendClaimed: false, error: 'PREVIEW_STALE' }); });
    const pending = service.recover({ identity: parent, jobId: String(j._id), body: command() });
    const rejection = expect(pending).rejects.toMatchObject({ code: 'AI_REMOTE_CONTRACT_INVALID' });
    while (client.get.mock.calls.length === 0) await new Promise(resolve => setImmediate(resolve));
    client.get.mockImplementationOnce(async job => remoteResult(job, { status: 'sending', result: null, usage: null }));
    await service.recover({ identity: parent, jobId: String(j._id), body: command() });
    releaseRefund(); await rejection;
    expect((await M.Account.findById('experiment')).outstandingMicros).toBe(184320);
    expect((await M.Reservation.findById(j.reservationId)).state).toBe('reserved_unknown');
  });
  test.each([true, false])('deadline release versus dispatch transaction: dispatchWins=%s', async dispatchWins => {
    const c = await create(), g = await generate(c), deadline = Date.parse(c.preview.sendNotAfter);
    let ready, unblock, secondEntered;
    const readyPromise = new Promise(resolve => { ready = resolve; });
    const release = new Promise(resolve => { unblock = resolve; });
    const secondReady = new Promise(resolve => { secondEntered = resolve; });
    const factory = (time, first) => createAi1Service({ now: () => time, getProfile: () => profile, getRuntime: () => config,
      getLimits: () => limits, sourceReader: { require: reader }, transactionRunner: work => runMongoTransaction({ mongooseInstance: mongoose,
        work: async session => {
          if (!first) secondEntered();
          const result = await work(session);
          if (first) { ready(); await release; }
          return result;
        } }) });
    const first = factory(dispatchWins ? deadline - 1 : deadline, true).claim({ identity: parent, jobId: g.job.id });
    await readyPromise;
    const second = factory(dispatchWins ? deadline : deadline - 1, false).claim({ identity: parent, jobId: g.job.id });
    await secondReady; unblock();
    const results = await Promise.all([first, second]);
    expect(results.filter(r => r.claimed)).toHaveLength(dispatchWins ? 1 : 0);
    const j = await M.Job.findById(g.job.id), r = await M.Reservation.findById(j.reservationId), a = await M.Account.findById('experiment');
    expect(j.status).toBe(dispatchWins ? 'dispatching' : 'failed'); expect(r.state).toBe(dispatchWins ? 'reserved' : 'released');
    expect(a.outstandingMicros).toBe(dispatchWins ? 184320 : 0);
    expect((await M.Cycle.findById(c.cycle.id)).status).toBe(dispatchWins ? 'generating' : 'ready');
    const slot = await M.Slot.findById('global');
    expect(slot?.jobId ? String(slot.jobId) : null).toBe(dispatchWins ? g.job.id : null);
    expect(client.put).not.toHaveBeenCalled();
  });
});

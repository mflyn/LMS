const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const A = require('../../models/Ai2');
const M = require('../../models/Ai3');
const Budget = require('../../models/Ai1');
const C = require('../../services/ai3Contract');
const { sha } = require('../../services/ai1Contract');
const { createAi3Service } = require('../../services/ai3Service');
const id = () => String(new mongoose.Types.ObjectId());
let parent, child, family, pkg, attempt, service, client, profile, config, trial;
const clock = Date.parse('2026-11-21T00:00:00Z');
const content = { instructions: 'Show steps.', exercises: [
  { exerciseId: 'q1', questionText: '132 * 24', answerForParent: '3168', rubricForParent: 'Align units.' },
  { exerciseId: 'q2', questionText: '203 * 31', answerForParent: '6293', rubricForParent: 'Align units.' }
] };
const remote = (c, overrides = {}) => ({ remoteOperationId: c.generation.remoteOperationId,
  schemaVersion: 'ai3-provider-operation-v2', feeMode: 'estimate_only',
  requestHash: c.generation.remoteRequestHash, providerProfile: 'ai3-practice-v1',
  modelProfileVersion: c.generation.preview.modelProfileVersion, pricingProfileVersion: c.generation.preview.pricingProfileVersion,
  sendNotAfter: c.generation.preview.sendNotAfter, status: 'succeeded', sendClaimed: true, error: null,
  result: { text: JSON.stringify(content), contentHash: sha(JSON.stringify(content)) },
  usage: { inputTokens: 30000, outputTokens: 100 }, updatedAt: new Date(clock).toISOString(), ...overrides });
beforeAll(async () => {
  for (const model of [...Object.values(M), ...Object.values(A), ...Object.values(Budget), Family, User]) await model.init();
});
beforeEach(async () => {
  parent = { id: id(), role: 'parent' }; child = id();
  family = await Family.create({ familyName: 'Synthetic trial', ownerParentId: parent.id,
    memberParentIds: [parent.id], childIds: [child], timezone: 'UTC' });
  await User.collection.insertMany([{ _id: new mongoose.Types.ObjectId(parent.id), role: 'parent', username: parent.id },
    { _id: new mongoose.Types.ObjectId(child), role: 'student', username: child, familyId: family._id }]);
  const childSnapshot = { questionText: '124 * 23', explanationText: 'Synthetic parent-reviewed explanation.',
    chapter: { provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper', textbookLabel: 'Synthetic',
      chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' } };
  pkg = await A.Package.create({ familyId: family._id, childId: child, ai1CycleId: id(),
    source: { type: 'task', id: id(), subject: 'math' }, artifact: { id: id(), version: 1, contentHash: 'a'.repeat(64) },
    childSnapshot, childSnapshotHash: C.hash(childSnapshot), publishedBy: parent.id, publishedAt: new Date(clock),
    visibility: 'published', learningState: 'approved', stateVersion: 3 });
  attempt = await A.Attempt.create({ familyId: family._id, childId: child, packageId: pkg._id, attemptVersion: 1,
    submitCommandId: id(), submittedBy: child, submittedAt: new Date(clock), note: '', mediaIds: [id()], mediaBindings: [],
    payloadHash: 'b'.repeat(64), review: { decision: 'approve', reviewerId: parent.id, reviewedAt: new Date(clock).toISOString() } });
  await A.Package.updateOne({ _id: pkg._id }, { $set: { currentAttemptId: attempt._id, currentAttemptVersion: 1 } });
  profile = { feeMode: 'estimate_only', model: 'synthetic-only', modelProfileVersion: 'synthetic-v2', pricingProfileVersion: 'price-v2',
    inputPriceMicrosPerMillion: 9000000, outputPriceMicrosPerMillion: 27000000, sourceReference: 'https://example.test/price',
    checkedAt: '2026-11-01T00:00:00.000Z', expiresAt: '2026-12-01T00:00:00.000Z', callWindowMs: 60000, clockMarginMs: 5000 };
  config = { enabled: true, continuousStore: true };
  trial = { authorizationVersion: 'synthetic-trial-1', maxSubmissions: 3 };
  client = { put: jest.fn(async c => remote(c)), get: jest.fn(async c => remote(c)) };
  service = createAi3Service({ now: () => clock, getProfile: () => profile, getRuntime: () => config,
    getLimits: () => ({ singleMicros: 184320, dayMicros: 2000000, monthMicros: 2000000, experimentMicros: 2000000 }),
    getTrial: () => trial, operationClient: client,
    sourceReader: { require: async q => ({ id: q.sourceTaskId, familyId: String(family._id), childId: child, subject: 'math' }) } });
});
async function prepare() {
  const { round } = await service.create({ identity: parent, body: { schemaVersion: 'ai3-min-v1', operationId: randomUUID(),
    sourcePackageId: String(pkg._id), expectedSourcePackageVersion: 3, sourceAttemptId: String(attempt._id),
    expectedSourceAttemptVersion: 1, sourceAttemptPayloadHash: attempt.payloadHash, sourceReviewHash: C.hash(attempt.review),
    exerciseCount: 2, knowledgePointId: null } });
  const { preview } = await service.generationPreview({ identity: parent, roundId: round.id });
  const body = { schemaVersion: preview.generationSchemaVersion || 'ai3-min-v1', operationId: randomUUID(), expectedRoundVersion: round.stateVersion,
    generationInputHash: preview.generationInputHash, modelProfileVersion: preview.modelProfileVersion,
    pricingProfileVersion: preview.pricingProfileVersion,
    ...(preview.feeMode === 'estimate_only' ? { expectedEstimatedReservationMicros: preview.estimatedReservationMicros,
      feeMode: preview.feeMode, estimateMethodVersion: preview.estimateMethodVersion, feeNoticeVersion: preview.feeNoticeVersion,
      estimateAcknowledged: true } : { maxAuthorizedCostMicros: preview.reservedCeilingMicros }),
    externalSendConfirmed: true, deidentifiedConfirmed: true };
  const ack = await service.generate({ identity: parent, roundId: round.id, body });
  return { round, preview, body, ack, recover: { identity: parent, commandId: ack.command.id,
    body: { schemaVersion: 'ai3-min-v2', operationId: body.operationId } } };
}
test('original reserved trial recovers once, retains overestimate candidate and never auto-publishes', async () => {
  const x = await prepare();
  const result = await service.recover(x.recover);
  expect(result.command.phase).toBe('SUCCEEDED');
  expect(result.command.budget.usagePricedMicros).toBe(272700);
  expect(result.command.sendBlocked).toBe(true);
  const r = await M.Round.findById(x.round.id).lean();
  expect(r).toMatchObject({ preparation: 'candidate', visibility: 'draft', learningState: 'open' });
  expect(await M.Content.countDocuments()).toBe(1);
  const again = await service.recover(x.recover);
  expect(again.command.id).toBe(x.ack.command.id);
  expect(client.put).toHaveBeenCalledTimes(1); expect(client.get).not.toHaveBeenCalled();
});
test('unknown retry keeps old preview and UUID, survives disabled sending, and only queries', async () => {
  const x = await prepare();
  client.put.mockRejectedValueOnce(new Error('Synthetic loss'));
  await expect(service.recover(x.recover)).rejects.toBeDefined();
  expect((await M.Command.findById(x.ack.command.id).lean()).phase).toBe('UNKNOWN');
  config.enabled = false; profile = null;
  expect((await service.generationPreview({ identity: parent, roundId: x.round.id })).preview).toEqual(x.preview);
  await expect(service.recover({ ...x.recover, body: { ...x.recover.body, schemaVersion: 'ai3-min-v1' } }))
    .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  const done = await service.recover(x.recover);
  expect(done.command.phase).toBe('SUCCEEDED');
  expect(client.put).toHaveBeenCalledTimes(1); expect(client.get).toHaveBeenCalledTimes(1);
  expect((await Budget.Account.findById('experiment').lean()).halted).toBe(true);
  expect(await Budget.Reservation.countDocuments()).toBe(1);
});
test('trusted not-sent releases only fee, never allowance; original replay never sends again', async () => {
  const x = await prepare();
  client.put.mockImplementation(async c => remote(c, { status: 'failed_not_sent', sendClaimed: false,
    result: null, usage: null, error: 'PREVIEW_STALE' }));
  const done = await service.recover(x.recover);
  expect(done.command.phase).toBe('FAILED');
  expect(done.command.budget).toMatchObject({ state: 'released', usagePricedMicros: 0 });
  expect((await Budget.Account.findById('experiment').lean()).trialUsedSubmissions).toBe(1);
  await service.recover(x.recover);
  expect(client.put).toHaveBeenCalledTimes(1); expect(client.get).not.toHaveBeenCalled();
});
test.each([[1, true], [1, false], [2, true], [2, false]])(
  'persistent v%i preview remains read-only with sending enabled=%s and no current quote', async (version, enabled) => {
    if (version === 1) { delete profile.feeMode; delete profile.sourceReference; trial = null; }
    const x = await prepare();
    config.enabled = enabled; profile = null;
    const snapshot = async () => JSON.stringify(await Promise.all([...Object.values(M), ...Object.values(Budget)]
      .map(model => model.find().sort({ _id: 1 }).lean())));
    const before = await snapshot();
    const result = await service.generationPreview({ identity: parent, roundId: x.round.id });
    expect(result.preview).toEqual(x.preview);
    expect(await snapshot()).toBe(before);
    expect(client.put).not.toHaveBeenCalled(); expect(client.get).not.toHaveBeenCalled();
    await User.collection.deleteOne({ _id: new mongoose.Types.ObjectId(parent.id) });
    await expect(service.generationPreview({ identity: parent, roundId: x.round.id }))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(await snapshot()).toBe(before);
  });

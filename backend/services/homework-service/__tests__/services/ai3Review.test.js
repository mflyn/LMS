const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const A = require('../../models/Ai2');
const M = require('../../models/Ai3');
const C = require('../../services/ai3Contract');
const { createAi3Service } = require('../../services/ai3Service');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { referenceSetHash } = require('../../../../common/services/completionMediaProtocol');
const id = () => String(new mongoose.Types.ObjectId());
const transact = work => runMongoTransaction({ mongooseInstance: mongoose, work });
const envelope = () => ({ schemaVersion: 'ai3-min-v1', operationId: randomUUID() });
let child, parent, coparent, sibling, outsider, family, pkg, round, content, body, clock, runtime, client, inspector, remote;
let mistakeClient, masteryClient, attempt;
const factory = extra => createAi3Service({ getRuntime: () => runtime, now: () => clock,
  mediaReferenceClient: client, mediaInspectClient: inspector, submissionLeaseMs: 1000,
  mistakeEvidenceClient: mistakeClient, masteryEvidenceClient: masteryClient, reviewLeaseMs: 1000, ...extra });
const submit = (service = factory(), input = body, actor = child) => service.submit({ identity: actor, roundId: String(round._id), body: input });
const recover = (c, service = factory(), actor = child) => service.recover({ identity: actor, commandId: String(c._id),
  body: { schemaVersion: 'ai3-min-v1', operationId: c.operationId } });
const scope = q => ({ resourceType: 'ai3_attempt', resourceId: q.resourceId, field: 'practiceMediaIds' });
function reply(q, state) {
  return { operation: { ...scope(q), operationId: q.remoteOperationId, state,
    commandHash: state === 'ABSENT' ? null : q.commandHash,
    referenceSetHash: state === 'ABSENT' ? null : referenceSetHash({ ...q,
      references: [...q.references].sort((a, b) => a.mediaId.localeCompare(b.mediaId)) }),
    leaseExpiresAt: state === 'PREPARED' ? new Date(clock + 60000).toISOString() : null,
    leaseExpired: state === 'PREPARED' ? false : null, failureCode: state === 'ABORTED' ? 'MEDIA_OPERATION_ABORTED' : null },
  references: q.references.map(r => ({ ...scope(q), ...r,
    state: { ABSENT: 'absent', PREPARED: 'prepared', COMMITTED: 'bound', ABORTED: 'released' }[state],
    ...(state === 'ABSENT' ? {} : { bindingOperationId: q.remoteOperationId }), privacyDeletion: null })) };
}
const withdrawAncestor = () => A.Package.updateOne({ _id: pkg._id }, { $set: { visibility: 'withdrawn' }, $inc: { stateVersion: 1 } });
beforeAll(async () => { for (const model of [...Object.values(M), ...Object.values(A), Family, User]) await model.init(); });
beforeEach(async () => {
  clock = Date.parse('2026-11-04T00:00:00Z'); runtime = { enabled: true, continuousStore: true }; remote = new Map();
  parent = { id: id(), role: 'parent' }; coparent = { id: id(), role: 'parent' }; outsider = { id: id(), role: 'parent' };
  child = { id: id(), role: 'student', tokenVersion: 0 }; sibling = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic submission', ownerParentId: parent.id,
    memberParentIds: [parent.id, coparent.id], childIds: [child.id, sibling.id] });
  await Family.create({ familyName: 'Other synthetic', ownerParentId: outsider.id, memberParentIds: [outsider.id] });
  for (const actor of [child, sibling]) Object.assign(actor, { childId: actor.id, familyId: String(family._id) });
  await User.collection.insertMany([parent, coparent, outsider, child, sibling].map(actor => ({ _id: new mongoose.Types.ObjectId(actor.id),
    role: actor.role, username: actor.id, ...(actor.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  const chapter = { subject: 'math', grade: 4, term: 'upper', provenance: 'parent_declared', chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' };
  pkg = await A.Package.create({ familyId: family._id, childId: child.id, ai1CycleId: id(), source: { type: 'task', id: id() },
    artifact: { id: id() }, childSnapshot: { chapter }, childSnapshotHash: C.hash({ chapter }), publishedBy: parent.id,
    publishedAt: new Date(clock), visibility: 'published', learningState: 'approved', stateVersion: 3 });
  const a = await A.Attempt.create({ familyId: family._id, childId: child.id, packageId: pkg._id, attemptVersion: 1,
    submitCommandId: id(), submittedBy: child.id, submittedAt: new Date(clock), note: '', mediaIds: [id()], mediaBindings: [],
    payloadHash: 'b'.repeat(64), review: { decision: 'approve', reviewerId: parent.id, reviewedAt: new Date(clock).toISOString() } });
  await A.Package.updateOne({ _id: pkg._id }, { $set: { currentAttemptId: a._id, currentAttemptVersion: 1 } });
  round = await M.Round.create({ familyId: family._id, childId: child.id, sourcePackageId: pkg._id, sourceAttemptId: a._id,
    sourceAttemptVersion: 1, sourceAttemptPayloadHash: a.payloadHash, sourceReviewHash: C.hash(a.review), source: pkg.source,
    chapter, exerciseCount: 2, createdBy: parent.id, stateVersion: 3, active: true, preparation: 'candidate',
    visibility: 'published', learningState: 'open', publishedAt: new Date(clock), publishedBy: parent.id });
  const value = { instructions: 'Show steps.', exercises: ['q1', 'q2'].map(exerciseId => ({ exerciseId,
    questionText: '132 * 24', answerForParent: 'SECRET_3168', rubricForParent: 'SECRET_RUBRIC' })) };
  content = await M.Content.create({ familyId: family._id, childId: child.id, roundId: round._id, version: 1,
    content: value, contentHash: C.hash(value), childSnapshot: C.childSnapshot(value), childSnapshotHash: C.hash(C.childSnapshot(value)),
    createdBy: parent.id, origin: 'parent_manual', reason: 'Synthetic approved fixture' });
  await M.Round.updateOne({ _id: round._id }, { $set: { currentContentId: content._id, currentContentVersion: 1,
    currentContentHash: content.contentHash, publication: { contentId: String(content._id), contentVersion: 1,
      contentHash: content.contentHash, childSnapshotHash: content.childSnapshotHash, actorId: parent.id } } });
  body = { ...envelope(), expectedRoundVersion: 3, contentId: String(content._id), contentVersion: 1,
    childSnapshotHash: content.childSnapshotHash, note: '', mediaIds: [id(), id()] };
  client = {
    status: jest.fn(async q => remote.get(q.remoteOperationId) || reply(q, 'ABSENT')),
    prepare: jest.fn(async q => { const result = reply(q, 'PREPARED'); remote.set(q.remoteOperationId, result); return result; }),
    commit: jest.fn(async q => { const result = reply(q, 'COMMITTED'); remote.set(q.remoteOperationId, result); return result; }),
    abort: jest.fn(async q => { const prior = remote.get(q.remoteOperationId); if (prior?.operation.state === 'COMMITTED') return prior;
      const result = reply(q, 'ABORTED'); remote.set(q.remoteOperationId, result); return result; }),
    unbind: jest.fn(async q => ({ operation: null, references: q.references.map(ref => ({ ...scope(q), ...ref, state: 'released', privacyDeletion: null })) }))
  };
  inspector = { inspect: jest.fn(async q => q.mediaIds.map(mediaId => ({ mediaId, mimeType: 'image/png', sizeBytes: 42, status: 'available' }))) };
});

beforeEach(async () => {
  mistakeClient = { getContext: jest.fn(), apply: jest.fn(), getReceipt: jest.fn() };
  masteryClient = { getContext: jest.fn(), apply: jest.fn(), getReceipt: jest.fn() };
  await submit();
  attempt = await M.Attempt.findOne().lean();
  round = await M.Round.findById(round._id);
  inspector.inspect.mockClear();
});
const reviewRow = () => M.Command.findOne({ endpointOperation: 'ai3.review' }).lean();
const reviewBody = (decision = 'revise', extra = {}) => ({ ...envelope(), expectedRoundVersion: round.stateVersion,
  contentId: String(content._id), contentVersion: content.version, contentHash: content.contentHash,
  expectedAttemptVersion: attempt.attemptVersion, attemptPayloadHash: attempt.payloadHash, decision,
  comment: decision === 'revise' ? 'Check the second partial product.' : 'Both exercises checked.',
  evidenceSummary: decision === 'revise' ? '' : 'All exercises and working checked by parent.',
  masteryConfirmed: false, reviewReminderDate: null, reviewContextHash: null, ...extra });
const review = (input, service = factory(), identity = parent) => service.review({ identity, roundId: String(round._id),
  attemptId: String(attempt._id), body: input });
const context = (service = factory(), identity = parent) => service.reviewContext({ identity, roundId: String(round._id), attemptId: String(attempt._id) });
const approveBody = async (extra = {}) => reviewBody('approve', { reviewContextHash: (await context()).reviewContextHash, ...extra });
const unchanged = async () => JSON.stringify(await Promise.all([M.Round, M.Attempt, M.Command].map(m => m.find().sort({ _id: 1 }).lean())));

test('closed review contract permits revise and rejects unsafe branch combinations', () => {
  const value = reviewBody(); expect(C.normalize('review', value)).toEqual(value);
  for (const patch of [{ comment: '' }, { comment: '  ' }, { evidenceSummary: 'not allowed' },
    { masteryConfirmed: true }, { reviewReminderDate: '2026-11-04' }, { childId: child.id }]) {
    expect(() => C.normalize('review', { ...value, ...patch })).toThrow('VALIDATION_ERROR');
  }
});

test.each(['2024-02-29', '2001-01-01', '2099-12-31'])('approve accepts real LocalDate %s', date => {
  const value = reviewBody('approve', { reviewContextHash: 'a'.repeat(64), reviewReminderDate: date });
  expect(C.normalize('review', value)).toEqual(value);
});
test.each(['2023-02-29', '2026-04-31', '2026-1-01', '0000-01-01', '2026-11-04T00:00:00Z', 20261104])(
  'invalid review LocalDate %s rejects', date => {
    expect(() => C.normalize('review', reviewBody('approve', { reviewContextHash: 'a'.repeat(64), reviewReminderDate: date }))).toThrow('VALIDATION_ERROR');
  });
test('approve requires reviewed context and nonblank evidence', () => {
  expect(() => C.normalize('review', reviewBody('approve'))).toThrow('VALIDATION_ERROR');
  expect(() => C.normalize('review', reviewBody('approve', { reviewContextHash: 'a'.repeat(64), evidenceSummary: ' ' }))).toThrow('VALIDATION_ERROR');
});
test('review-context is read-only and task without targets has explicit null targets', async () => {
  const before = await unchanged(), ctx = await context();
  expect(ctx).toMatchObject({ roundId: String(round._id), attemptId: String(attempt._id),
    expectedRoundVersion: round.stateVersion, contentHash: content.contentHash, attemptPayloadHash: attempt.payloadHash,
    targets: { mistake: null, knowledgePoint: null } });
  const { reviewContextHash, ...snapshot } = ctx; expect(reviewContextHash).toBe(C.hash(snapshot));
  expect(Object.keys(ctx).sort()).toEqual(['roundId', 'expectedRoundVersion', 'contentId', 'contentVersion', 'contentHash',
    'attemptId', 'expectedAttemptVersion', 'attemptPayloadHash', 'targets', 'reviewContextHash'].sort());
  expect(await unchanged()).toBe(before);
  expect(inspector.inspect).not.toHaveBeenCalled();
  expect(mistakeClient.getContext).not.toHaveBeenCalled(); expect(masteryClient.getContext).not.toHaveBeenCalled();
});
test('revise atomically saves first feedback without media, targets, finalReview or new Attempt', async () => {
  inspector.inspect.mockRejectedValue(new Error('media offline'));
  const input = reviewBody(), result = await review(input), saved = await M.Attempt.findById(attempt._id).lean();
  expect(result).toMatchObject({ reviewSaved: true, pending: false, command: { phase: 'SUCCEEDED' } });
  expect(saved.review).toMatchObject({ decision: 'revise', comment: input.comment, reviewedByParentId: parent.id });
  expect((await M.Round.findById(round._id)).learningState).toBe('revise');
  expect(await M.Attempt.countDocuments()).toBe(1);
  expect((await reviewRow()).finalReview).toBeFalsy();
  expect(inspector.inspect).not.toHaveBeenCalled();
  for (const port of [mistakeClient, masteryClient]) for (const fn of Object.values(port)) expect(fn).not.toHaveBeenCalled();
  expect((await review(input)).command.id).toBe(result.command.id);
  await expect(review({ ...input, comment: 'Changed' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
});
test('real revise then child resubmission approves only the new Attempt and preserves old feedback', async () => {
  const oldAttemptId = attempt._id, oldReviewBody = reviewBody();
  await review(oldReviewBody);
  const oldAttempt = await M.Attempt.findById(oldAttemptId).lean();
  round = await M.Round.findById(round._id);
  await submit(factory(), { ...body, operationId: randomUUID(), expectedRoundVersion: round.stateVersion, mediaIds: [id()] });
  round = await M.Round.findById(round._id);
  attempt = await M.Attempt.findById(round.currentAttemptId).lean();
  expect(attempt.attemptVersion).toBe(2);
  expect((await review(await approveBody())).pending).toBe(false);
  expect((await M.Attempt.findById(oldAttemptId)).review).toEqual(oldAttempt.review);
  expect((await M.Attempt.findById(attempt._id)).review.decision).toBe('approve');
  expect(await M.Attempt.countDocuments({ roundId: round._id })).toBe(2);
  const replay = await factory().review({ identity: parent, roundId: String(round._id), attemptId: String(oldAttemptId), body: oldReviewBody });
  expect(replay.reviewSaved).toBe(true);
  expect((await M.Round.findById(round._id)).learningState).toBe('passed');
});
test.each(['expectedRoundVersion', 'contentId', 'contentVersion', 'contentHash', 'expectedAttemptVersion', 'attemptPayloadHash'])(
  'stale reviewed %s has no mutation or media effect', async key => {
    const input = reviewBody(), before = await unchanged();
    input[key] = { expectedRoundVersion: 1, contentId: id(), contentVersion: 2, contentHash: '0'.repeat(64),
      expectedAttemptVersion: 2, attemptPayloadHash: '0'.repeat(64) }[key];
    await expect(review(input)).rejects.toMatchObject({ code: 'AI3_VERSION_CONFLICT' });
    expect(await unchanged()).toBe(before); expect(inspector.inspect).not.toHaveBeenCalled();
  });
test.each(['child', 'sibling', 'outsider'])('unauthorized %s cannot inspect context or review', async who => {
  const actor = { child, sibling, outsider }[who], before = await unchanged();
  await expect(context(factory(), actor)).rejects.toHaveProperty('statusCode');
  await expect(review(reviewBody(), factory(), actor)).rejects.toHaveProperty('statusCode');
  expect(await unchanged()).toBe(before);
});
test('two authorized parents cannot overwrite the first review actor/time', async () => {
  const inputs = [reviewBody(), reviewBody('revise', { comment: 'Other parent feedback' })];
  const results = await Promise.allSettled([review(inputs[0]), review(inputs[1], factory(), coparent)]);
  expect(results.filter(x => x.status === 'fulfilled')).toHaveLength(1);
  expect(results.find(x => x.status === 'rejected').reason.code).toBe('AI3_VERSION_CONFLICT');
  const winner = results[0].status === 'fulfilled' ? parent : coparent;
  const saved = (await M.Attempt.findById(attempt._id)).review;
  expect(saved.reviewedByParentId).toBe(winner.id); expect(await M.Command.countDocuments({ endpointOperation: 'ai3.review' })).toBe(1);
  clock += 5000; const winningBody = inputs[winner === parent ? 0 : 1];
  await review(winningBody, factory(), winner);
  expect((await M.Attempt.findById(attempt._id)).review).toEqual(saved);
});
test('approve without effects stores immutable final evidence and reminder; ack does not reread media', async () => {
  const input = await approveBody({ reviewReminderDate: '2024-02-29' });
  inspector.inspect.mockImplementationOnce(async q => q.mediaIds.map(mediaId => ({ mediaId, mimeType: 'image/png', sizeBytes: 42, status: 'available' })));
  inspector.inspect.mockRejectedValue(new Error('second media read forbidden'));
  const result = await review(input), c = await reviewRow();
  expect(result).toMatchObject({ reviewSaved: true, pending: false, command: { phase: 'SUCCEEDED' },
    finalReviewId: String(c._id), effects: { mistake: 'not_requested', mastery: 'not_requested' } });
  expect(c.finalReview).toMatchObject({ id: String(c._id), reviewedByParentId: parent.id,
    attemptId: String(attempt._id), reviewReminderDate: '2024-02-29', targets: { mistake: null, knowledgePoint: null } });
  expect(c.finalReviewHash).toBe(C.hash(c.finalReview));
  expect((await M.Round.findById(round._id)).learningState).toBe('passed');
  expect((await M.Round.findById(round._id)).active).toBe(false);
  expect(inspector.inspect).toHaveBeenCalledTimes(1);
  await M.Command.updateOne({ _id: c._id }, { $set: { finalReview: { ...c.finalReview, comment: 'mutated' }, finalReviewHash: '0'.repeat(64) } });
  expect((await reviewRow()).finalReview).toEqual(c.finalReview); expect((await reviewRow()).finalReviewHash).toBe(c.finalReviewHash);
  expect((await review(input)).command.id).toBe(String(c._id));
  expect(inspector.inspect).toHaveBeenCalledTimes(1);
  const childView = await factory().getRound({ identity: child, roundId: String(round._id) });
  expect(childView.round.reviewReminderDate).toBe('2024-02-29');
  expect(JSON.stringify(childView)).not.toMatch(/SECRET|evidenceSummary|finalReviewHash|reviewedByParentId/);
});
test.each(['deleted', 'offline'])('approve with %s media refuses before review persistence', async state => {
  const input = await approveBody(), before = await unchanged();
  inspector.inspect.mockImplementation(async q => {
    if (state === 'offline') throw new Error('network');
    return q.mediaIds.map(mediaId => ({ mediaId, mimeType: 'image/png', sizeBytes: 42, status: 'deleted' }));
  });
  await expect(review(input)).rejects.toMatchObject({ code: state === 'offline' ? 'MEDIA_SERVICE_UNAVAILABLE' : 'AI3_MEDIA_UNAVAILABLE' });
  expect(await unchanged()).toBe(before);
});
test('ancestor or own withdrawal prevents new review but preserves prior successful audit', async () => {
  await withdrawAncestor(); const before = await unchanged();
  await expect(review(reviewBody())).rejects.toMatchObject({ code: 'AI3_SOURCE_NOT_APPROVED' });
  expect(await unchanged()).toBe(before);
});
test('off rejects new review but terminal original replay remains readable', async () => {
  const input = reviewBody(); runtime.enabled = false;
  await expect(review(input)).rejects.toMatchObject({ code: 'AI3_NOT_ENABLED' });
  runtime.enabled = true; const result = await review(input); runtime.enabled = false;
  expect((await review(input)).command.id).toBe(result.command.id);
});
async function targets({ mistake = true, mastery = true } = {}) {
  const knowledgePointId = mastery ? id() : null, source = { type: mistake ? 'mistake' : 'task', id: id() };
  await M.Round.collection.updateOne({ _id: round._id }, { $set: { source, knowledgePointId: knowledgePointId ? new mongoose.Types.ObjectId(knowledgePointId) : null } });
  await A.Package.collection.updateOne({ _id: pkg._id }, { $set: { source } });
  round = await M.Round.findById(round._id);
  mistakeClient.getContext.mockResolvedValue({ id: source.id, stateRevision: 4, knowledgePointId });
  masteryClient.getContext.mockResolvedValue({ id: knowledgePointId, stateRevision: 7 });
  for (const port of [mistakeClient, masteryClient]) {
    port.getReceipt.mockRejectedValue(C.error(404, 'RESOURCE_NOT_FOUND'));
    port.apply.mockImplementation(async ({ body: request }) => {
      const c = await reviewRow(); expect(c.phase).toBe('EFFECTS_PENDING');
      const { schemaVersion: _schemaVersion, ...fields } = request;
      return { ...fields, status: 'applied', reviewedAt: c.finalReview.reviewedAt,
        appliedAt: new Date(clock).toISOString(), decidedAt: new Date(clock).toISOString(), eventId: id() };
    });
  }
  return { knowledgePointId, source };
}
test('approve commits exact final proof before effects and both receipts release the active slot', async () => {
  await targets(); const input = await approveBody({ masteryConfirmed: true, reviewReminderDate: '2027-01-01' });
  const result = await review(input), c = await reviewRow();
  expect(result).toMatchObject({ reviewSaved: true, pending: false, effects: { mistake: 'applied', mastery: 'applied' } });
  expect(c.finalReviewHash).toBe(C.hash(c.finalReview));
  const E = require('../../../../common/services/ai3ReviewEvidence'); E.validateFinalReview(c.finalReview);
  expect((await M.Round.findById(round._id)).activeCommandId).toBeNull();
  expect((await M.Round.findById(round._id)).active).toBe(false);
  for (const [kind, port] of [['mistake', mistakeClient], ['mastery', masteryClient]]) {
    const request = port.apply.mock.calls[0][0].body;
    E.normalizeEffectRequest(request);
    const proof = await factory().getFinalReview({ familyId: String(family._id), childId: child.id,
      finalReviewId: String(c._id), effectId: request.effectId });
    expect(E.validateProof(proof, request, kind)).toEqual(c.finalReview);
    expect(request.reviewedByParentId).toBe(parent.id);
  }
  expect(mistakeClient.apply).toHaveBeenCalledTimes(1); expect(masteryClient.apply).toHaveBeenCalledTimes(1);
  expect((await review(input)).command.id).toBe(String(c._id));
  expect(mistakeClient.apply).toHaveBeenCalledTimes(1);
});
test('approved child Round exact whitelist excludes effects; parent retains pointers, child projection and effects', async () => {
  await targets(); await review(await approveBody({ masteryConfirmed: true }));
  const childResult = (await factory().getRound({ identity: child, roundId: String(round._id) })).round;
  expect(Object.keys(childResult).sort()).toEqual(['id', 'sourcePackageId', 'source', 'chapter', 'exerciseCount', 'visibility', 'learningState',
    'stateVersion', 'publishedAt', 'contentId', 'contentVersion', 'childSnapshot', 'childSnapshotHash', 'currentAttemptId',
    'currentAttemptVersion', 'pending', 'reviewReminderDate', 'sourceAvailability'].sort());
  const parentResult = (await factory().getRound({ identity: parent, roundId: String(round._id) })).round;
  expect(parentResult).toMatchObject({ currentAttemptId: String(attempt._id), currentAttemptVersion: attempt.attemptVersion,
    childSnapshotHash: content.childSnapshotHash, childSnapshot: content.childSnapshot,
    effects: { mistake: 'applied', mastery: 'applied' } });
});
test('unknown side is read back with original request; successful side is never repeated', async () => {
  await targets(); let receipt;
  const original = masteryClient.apply.getMockImplementation();
  masteryClient.apply.mockImplementationOnce(async input => { receipt = await original(input); throw new Error('lost response'); });
  const input = await approveBody({ masteryConfirmed: true }), result = await review(input), c = await reviewRow();
  expect(result).toMatchObject({ reviewSaved: true, pending: true, effects: { mistake: 'applied', mastery: 'unknown' } });
  expect((await M.Round.findById(round._id)).active).toBe(true);
  const before = await unchanged(); await factory().getCommand({ identity: parent, commandId: String(c._id) });
  await factory().getRound({ identity: parent, roundId: String(round._id) }); expect(await unchanged()).toBe(before);
  expect(masteryClient.getReceipt).not.toHaveBeenCalled();
  clock = Number(c.leaseExpiresAt) + 1; runtime.enabled = false;
  masteryClient.getReceipt.mockResolvedValue(receipt);
  const recovered = await recover(c, factory(), parent);
  expect(recovered).toMatchObject({ pending: false, effects: { mistake: 'applied', mastery: 'applied' } });
  expect(mistakeClient.apply).toHaveBeenCalledTimes(1); expect(masteryClient.apply).toHaveBeenCalledTimes(1);
  expect((await reviewRow()).finalReview).toEqual(c.finalReview);
});
test('original reviewer only can recover and revocation preserves unknown lock', async () => {
  await targets(); masteryClient.apply.mockRejectedValue(new Error('unknown'));
  await review(await approveBody({ masteryConfirmed: true })); const c = await reviewRow(); clock = Number(c.leaseExpiresAt) + 1;
  await expect(recover(c, factory(), coparent)).rejects.toMatchObject({ statusCode: 404 });
  await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: coparent.id, memberParentIds: [coparent.id] } });
  await expect(recover(c, factory(), parent)).rejects.toMatchObject({ statusCode: 403 });
  expect(masteryClient.getReceipt).not.toHaveBeenCalled(); expect((await M.Round.findById(round._id)).active).toBe(true);
});
test('target context version change or dependency outage cannot turn into no-target approval', async () => {
  await targets(); const input = await approveBody({ masteryConfirmed: true }), before = await unchanged();
  masteryClient.getContext.mockResolvedValue({ id: String(round.knowledgePointId), stateRevision: 8 });
  await expect(review(input)).rejects.toMatchObject({ code: 'AI3_VERSION_CONFLICT' }); expect(await unchanged()).toBe(before);
  masteryClient.getContext.mockRejectedValue(C.error(503, 'AI3_EVIDENCE_UNAVAILABLE'));
  await expect(context()).rejects.toMatchObject({ statusCode: 503 });
  await expect(review(input)).rejects.toMatchObject({ statusCode: 503 }); expect(await unchanged()).toBe(before);
  expect(masteryClient.apply).not.toHaveBeenCalled();
});
test('mistake without mastery keeps its original association and requests no mastery effect', async () => {
  const { knowledgePointId } = await targets();
  const result = await review(await approveBody());
  expect(result.effects).toEqual({ mistake: 'applied', mastery: 'not_requested' });
  expect((await reviewRow()).finalReview.targets.mistake.knowledgePointId).toBe(knowledgePointId);
  expect((await reviewRow()).finalReview.targets.knowledgePoint).toBeNull();
  expect(masteryClient.apply).not.toHaveBeenCalled();
});
test.each(['not_applied_conflict', 'not_applied_missing'])('consumer terminal %s is preserved without chasing a new target revision', async status => {
  await targets({ mastery: false });
  mistakeClient.apply.mockImplementation(async ({ body: request }) => {
    const { schemaVersion: _schemaVersion, ...fields } = request;
    return { ...fields, status, reviewedAt: (await reviewRow()).finalReview.reviewedAt,
      appliedAt: null, eventId: null, decidedAt: new Date(clock).toISOString() };
  });
  const input = await approveBody(), result = await review(input), c = await reviewRow();
  expect(result.effects.mistake).toBe(status); expect(result.command.phase).toBe('SUCCEEDED');
  expect((await M.Round.findById(round._id)).active).toBe(false);
  await recover(c, factory(), parent); expect(mistakeClient.apply).toHaveBeenCalledTimes(1);
});
test.each(['targetId', 'finalReviewHash', 'reviewedAt'])('wrong receipt %s cannot settle the pending effect', async field => {
  await targets({ mastery: false }); const original = mistakeClient.apply.getMockImplementation();
  mistakeClient.apply.mockImplementationOnce(async input => ({ ...await original(input),
    [field]: field === 'targetId' ? id() : field === 'finalReviewHash' ? '0'.repeat(64) : '2020-01-01T00:00:00.000Z' }));
  const result = await review(await approveBody());
  expect(result).toMatchObject({ pending: true, effects: { mistake: 'unknown' } });
  expect((await M.Round.findById(round._id)).active).toBe(true);
});
test.each([null, undefined])('unknown recovery requires a trusted 404, not empty receipt %s, before resending', async value => {
  await targets({ mastery: false }); mistakeClient.apply.mockRejectedValue(new Error('lost response'));
  await review(await approveBody()); const c = await reviewRow(); clock = Number(c.leaseExpiresAt) + 1;
  mistakeClient.getReceipt.mockResolvedValue(value);
  expect((await recover(c, factory(), parent)).pending).toBe(true);
  expect(mistakeClient.apply).toHaveBeenCalledTimes(1);
});
test('live lease blocks recovery; trusted 404 after expiry resends only the same fixed effect', async () => {
  await targets({ mastery: false }); mistakeClient.apply.mockRejectedValueOnce(new Error('unknown'));
  const input = await approveBody(); await review(input); const c = await reviewRow();
  expect((await recover(c, factory(), parent)).pending).toBe(true); expect(mistakeClient.getReceipt).not.toHaveBeenCalled();
  clock = Number(c.leaseExpiresAt) + 1;
  expect((await recover(c, factory(), parent)).pending).toBe(false);
  expect(mistakeClient.getReceipt).toHaveBeenCalledTimes(1);
  expect(mistakeClient.apply.mock.calls[1][0]).toEqual(mistakeClient.apply.mock.calls[0][0]);
  await expect(review({ ...input, reviewReminderDate: '2027-11-04' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
});
test('owner lost during receipt lookup cannot send or settle using its successor lease', async () => {
  await targets({ mastery: false }); mistakeClient.apply.mockRejectedValueOnce(new Error('unknown'));
  await review(await approveBody()); const c = await reviewRow(); clock = Number(c.leaseExpiresAt) + 1;
  mistakeClient.getReceipt.mockImplementation(async () => {
    await M.Command.updateOne({ _id: c._id }, { $set: { owner: 'successor', leaseExpiresAt: new Date(clock + 5000) } });
    throw C.error(404, 'RESOURCE_NOT_FOUND');
  });
  expect((await recover(c, factory(), parent)).pending).toBe(true);
  expect((await reviewRow()).owner).toBe('successor'); expect(mistakeClient.apply).toHaveBeenCalledTimes(1);
  expect((await M.Round.findById(round._id)).active).toBe(true);
});
test.each(['rolled-back', 'committed'])('local approval %s unknown never speculatively dispatches effects', async outcome => {
  await targets(); const input = await approveBody({ masteryConfirmed: true }), before = await unchanged();
  const service = factory({ transactionRunner: async work => {
    await transact(async session => {
      const value = await work(session);
      if (await M.Command.exists({ endpointOperation: 'ai3.review' }).session(session)) {
        if (outcome === 'rolled-back') throw new Error('aborted review');
      }
      return value;
    });
    throw new Error('unknown commit');
  } });
  if (outcome === 'rolled-back') {
    await expect(review(input, service)).rejects.toMatchObject({ statusCode: 503 }); expect(await unchanged()).toBe(before);
  } else {
    expect((await review(input, service)).pending).toBe(true); const c = await reviewRow();
    expect((await M.Attempt.findById(attempt._id)).review.finalReviewId).toBe(String(c._id));
  }
  expect(mistakeClient.apply).not.toHaveBeenCalled(); expect(masteryClient.apply).not.toHaveBeenCalled();
  if (outcome === 'committed') expect((await recover(await reviewRow(), factory(), parent)).pending).toBe(false);
});
test.each(['rolled-back', 'committed'])('effect convergence transaction %s unknown preserves receipts and never repeats effects', async outcome => {
  await targets({ mastery: false });
  const service = factory({ transactionRunner: async work => {
    let finishing = false;
    const result = await transact(async session => {
      const value = await work(session);
      finishing = Boolean(await M.Command.exists({ endpointOperation: 'ai3.review', phase: 'SUCCEEDED' }).session(session));
      if (finishing && outcome === 'rolled-back') throw new Error('rollback final convergence');
      return value;
    });
    if (finishing) throw new Error('unknown final convergence'); return result;
  } });
  const result = await review(await approveBody(), service), c = await reviewRow();
  expect(result.command.phase).toBe(outcome === 'committed' ? 'SUCCEEDED' : 'EFFECTS_PENDING');
  expect(result.effects.mistake).toBe('applied'); clock = Math.max(clock, Number(c.leaseExpiresAt) + 1);
  expect((await recover(c, factory(), parent)).pending).toBe(false);
  expect(mistakeClient.apply).toHaveBeenCalledTimes(1); expect(mistakeClient.getReceipt).not.toHaveBeenCalled();
});
test.each(['own', 'ancestor'])('withdrawal %s after saved approval preserves original effects and proof', async which => {
  await targets({ mastery: false }); mistakeClient.apply.mockRejectedValueOnce(new Error('unknown'));
  await review(await approveBody()); const c = await reviewRow();
  if (which === 'ancestor') await withdrawAncestor();
  else await factory().withdraw({ identity: coparent, roundId: String(round._id), body: { ...envelope(),
    expectedRoundVersion: (await M.Round.findById(round._id)).stateVersion, reason: 'Hide incorrect questions' } });
  await expect(factory().getRound({ identity: child, roundId: String(round._id) })).rejects.toMatchObject({ statusCode: 404 });
  const proof = await factory().getFinalReview({ finalReviewId: String(c._id), familyId: String(family._id), childId: child.id,
    effectId: c.finalReview.targets.mistake.effectId });
  expect(proof.finalReview).toEqual(c.finalReview);
  clock = Number(c.leaseExpiresAt) + 1; expect((await recover(c, factory(), parent)).effects.mistake).toBe('applied');
  expect((await reviewRow()).finalReview).toEqual(c.finalReview);
  expect((await M.Round.findById(round._id)).active).toBe(false);
});
test('approval ancestor snapshot read cannot win after concurrent ancestor withdrawal', async () => {
  const input = await approveBody(); let entered, release, held = false;
  const arrived = new Promise(resolve => { entered = resolve; }), hold = new Promise(resolve => { release = resolve; });
  const original = A.Package.findOne.bind(A.Package);
  const spy = jest.spyOn(A.Package, 'findOne').mockImplementation((...args) => {
    const query = original(...args), exec = query.exec.bind(query);
    query.exec = async (...params) => { const result = await exec(...params);
      if (!held && query.getOptions().session) { held = true; entered(); await hold; } return result; }; return query;
  });
  const running = review(input); const observed = running.then(value => ({ value }), cause => ({ cause }));
  try { await arrived; await withdrawAncestor(); } finally { release(); }
  const result = await observed; spy.mockRestore();
  expect(result.cause).toMatchObject({ code: 'AI3_SOURCE_NOT_APPROVED' });
  expect(await reviewRow()).toBeNull(); expect((await M.Attempt.findById(attempt._id)).review).toBeNull();
});
test('permission revoked during media inspect cannot commit a new approval', async () => {
  const input = await approveBody();
  inspector.inspect.mockImplementationOnce(async q => {
    await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: coparent.id, memberParentIds: [coparent.id] } });
    return q.mediaIds.map(mediaId => ({ mediaId, mimeType: 'image/png', sizeBytes: 42, status: 'available' }));
  });
  await expect(review(input)).rejects.toMatchObject({ statusCode: 403 });
  expect(await reviewRow()).toBeNull(); expect((await M.Attempt.findById(attempt._id)).review).toBeNull();
});
test('own Round withdrawal during approval inspect wins without saved review or effect dispatch', async () => {
  await targets(); const input = await approveBody({ masteryConfirmed: true });
  inspector.inspect.mockImplementationOnce(async q => {
    await factory().withdraw({ identity: coparent, roundId: String(round._id), body: { ...envelope(),
      expectedRoundVersion: round.stateVersion, reason: 'Withdraw before approval' } });
    return q.mediaIds.map(mediaId => ({ mediaId, mimeType: 'image/png', sizeBytes: 42, status: 'available' }));
  });
  await expect(review(input)).rejects.toMatchObject({ code: 'AI3_VERSION_CONFLICT' });
  expect(await reviewRow()).toBeNull(); expect((await M.Attempt.findById(attempt._id)).review).toBeNull();
  expect(mistakeClient.apply).not.toHaveBeenCalled(); expect(masteryClient.apply).not.toHaveBeenCalled();
});
test('proof is scoped, read-only, and refuses changed hashes or unknown effects', async () => {
  await targets({ mastery: false }); await review(await approveBody()); const c = await reviewRow();
  const query = { familyId: String(family._id), childId: child.id, finalReviewId: String(c._id), effectId: c.finalReview.targets.mistake.effectId };
  const before = await unchanged(); await factory().getFinalReview(query); expect(await unchanged()).toBe(before);
  for (const patch of [{ familyId: id() }, { childId: sibling.id }, { finalReviewId: id() }, { effectId: randomUUID() }]) {
    await expect(factory().getFinalReview({ ...query, ...patch })).rejects.toMatchObject({ statusCode: 404 });
  }
  await M.Command.collection.updateOne({ _id: c._id }, { $set: { finalReviewHash: '0'.repeat(64) } });
  await expect(factory().getFinalReview(query)).rejects.toMatchObject({ statusCode: 503 });
});
async function listedRound({ ancestorVisible = true, date = null, offset = 0 } = {}) {
  const p = await A.Package.findById(pkg._id).lean(), a = await A.Attempt.findById(p.currentAttemptId).lean();
  const packageId = new mongoose.Types.ObjectId(), ancestorAttemptId = new mongoose.Types.ObjectId();
  await A.Package.create({ ...p, _id: packageId, ai1CycleId: id(), currentAttemptId: ancestorAttemptId,
    visibility: ancestorVisible ? 'published' : 'withdrawn' });
  await A.Attempt.create({ ...a, _id: ancestorAttemptId, packageId, submitCommandId: id() });
  const roundId = new mongoose.Types.ObjectId(), contentId = new mongoose.Types.ObjectId();
  await M.Content.create({ ...content.toObject(), _id: contentId, roundId });
  return M.Round.create({ ...round.toObject(), _id: roundId, sourcePackageId: packageId, sourceAttemptId: ancestorAttemptId,
    active: false, currentContentId: contentId, currentAttemptId: null, currentAttemptVersion: null,
    publication: { ...round.publication, contentId: String(contentId) }, reviewReminderDate: date,
    publishedAt: new Date(clock + offset) });
}
test('listRounds pages the authorized visible set, not raw rows before ancestor filtering', async () => {
  const visible = await listedRound({ offset: 1000, date: '2024-02-29' });
  await listedRound({ offset: 2000, ancestorVisible: false, date: '2024-02-29' });
  const first = await factory().listRounds({ identity: child, page: 1, pageSize: 1 });
  const second = await factory().listRounds({ identity: child, page: 2, pageSize: 1 });
  expect(first.items.map(r => r.id)).toEqual([String(visible._id)]);
  expect(second.items.map(r => r.id)).toEqual([String(round._id)]);
  expect(JSON.stringify(first)).not.toMatch(/SECRET|contentHash|finalReviewHash|evidenceSummary/);
  const parentList = await factory().listRounds({ identity: parent, childId: child.id, page: 1, pageSize: 20 });
  expect(parentList.items).toHaveLength(3); expect(JSON.stringify(parentList)).not.toContain('SECRET');
});
test('listRounds calendar filters are inclusive and reads are family/child scoped', async () => {
  const yes = await listedRound({ date: '2024-02-29' }); await listedRound({ date: '2027-01-01' });
  const before = await unchanged();
  const list = await factory().listRounds({ identity: parent, childId: child.id, reviewFrom: '2024-02-29', reviewTo: '2024-02-29' });
  expect(list.items.map(r => r.id)).toEqual([String(yes._id)]); expect(await unchanged()).toBe(before);
  await expect(factory().listRounds({ identity: outsider, childId: child.id })).rejects.toMatchObject({ statusCode: 403 });
  await expect(factory().listRounds({ identity: sibling, childId: child.id })).rejects.toMatchObject({ statusCode: 403 });
  expect((await factory().listRounds({ identity: sibling })).items).toEqual([]);
});
test('listRounds propagates ancestor dependency failure instead of returning a partial normal page', async () => {
  const original = A.Package.findOne.bind(A.Package);
  const spy = jest.spyOn(A.Package, 'findOne').mockImplementation((...args) => {
    const query = original(...args); query.exec = async () => { throw C.error(503, 'AI3_NOT_READY'); }; return query;
  });
  try { await expect(factory().listRounds({ identity: child })).rejects.toMatchObject({ statusCode: 503 }); }
  finally { spy.mockRestore(); }
});
test.each([{ reviewFrom: '2023-02-29' }, { reviewTo: '2026-4-01' }, { reviewFrom: '2027-01-01', reviewTo: '2026-01-01' },
  { reviewFrom: null }, { page: 0 }, { pageSize: 101 }])('invalid list range/pagination %j rejects', async query => {
  await expect(factory().listRounds({ identity: parent, childId: child.id, ...query })).rejects.toMatchObject({ statusCode: 400 });
});

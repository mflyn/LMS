const E = require('../../../common/services/ai3ReviewEvidence');
const { id, randomUUID, Mistake, Event, Family, User, seed, transactionRunner, mediaService } = require('./helpers/ai3MistakeFixtures');
const { createAi3MistakeEffectService } = require('../services/ai3MistakeEffectService');
const Receipt = require('../models/Ai3ReviewEffectReceipt');
let f, body, proof, clock, proofClient, service;
const factory = extra => createAi3MistakeEffectService({ proofClient, now: () => clock, transactionRunner, ...extra });
const scope = () => ({ familyId: f.familyId, childId: f.childId, actorId: f.actorId });
function bindReview(changes = {}) {
  const finalReview = { schemaVersion: 'ai3-final-review-v1', id: id(), familyId: f.familyId, childId: f.childId,
    roundId: id(), sourcePackageId: id(), sourceAttemptId: id(), sourceAttemptVersion: 1,
    sourceAttemptPayloadHash: 'a'.repeat(64), sourceReviewHash: 'b'.repeat(64), source: { type: 'mistake', id: f.targetId },
    contentId: id(), contentVersion: 1, contentHash: 'c'.repeat(64), childSnapshotHash: 'd'.repeat(64),
    attemptId: id(), attemptVersion: 1, attemptPayloadHash: 'e'.repeat(64), reviewedByParentId: f.actorId,
    reviewedAt: '2026-11-01T03:00:00.000Z', evidenceSummary: 'Synthetic parent checked every exercise', comment: '',
    masteryConfirmed: false, reviewReminderDate: null,
    targets: { mistake: { id: f.targetId, stateRevision: 0, knowledgePointId: null, effectId: randomUUID() }, knowledgePoint: null }, ...changes };
  const target = finalReview.targets.mistake;
  body = { schemaVersion: 'ai3-review-effect-v1', effectId: target.effectId, finalReviewId: finalReview.id,
    finalReviewHash: E.hash(finalReview), familyId: f.familyId, childId: f.childId, reviewedByParentId: f.actorId,
    targetId: f.targetId, expectedStateRevision: target.stateRevision };
  proof = { finalReview, finalReviewHash: body.finalReviewHash,
    effect: { kind: 'mistake', effectId: body.effectId, targetId: f.targetId, expectedStateRevision: body.expectedStateRevision } };
}
const apply = (extra = {}) => service.apply({ body: { ...body, ...extra } });
const row = () => Mistake.findById(f.targetId).select('+mediaReferenceState').lean();
const counts = async () => [await Receipt.countDocuments(), await Event.countDocuments()];
beforeAll(async () => { for (const model of [Mistake, Event, Family, User, Receipt]) await model.init(); });
beforeEach(async () => {
  f = await seed(); clock = Date.parse('2026-11-04T03:00:00.000Z'); bindReview();
  proofClient = { getFinalReview: jest.fn(async input => {
    expect(input).toEqual({ familyId: body.familyId, childId: body.childId, effectId: body.effectId, finalReviewId: body.finalReviewId });
    return proof;
  }) };
  service = factory();
});
test('context is a read-only scoped DTO and reads legacy revision as zero', async () => {
  await Mistake.collection.updateOne({ _id: f.mistake._id }, { $unset: { stateRevision: '' } });
  const before = await row();
  expect(await service.getContext({ ...scope(), targetId: f.targetId })).toEqual({ id: f.targetId, stateRevision: 0, knowledgePointId: null });
  expect(await row()).toEqual(before); expect(await counts()).toEqual([0, 0]);
});
test.each(['math', 'MATH', ' \u6570\u5b66 '])('context accepts the existing math alias %s', async subject => {
  await Mistake.updateOne({ _id: f.targetId }, { $set: { subject } });
  expect((await service.getContext({ ...scope(), targetId: f.targetId })).id).toBe(f.targetId);
});
test('apply persists one allowed state change, immutable event proof and exact raw receipt', async () => {
  await Mistake.updateOne({ _id: f.targetId }, { $set: { mastered: true } });
  const result = await apply();
  expect(E.validateReceipt(result, body)).toEqual(result);
  expect(result).toMatchObject({ status: 'applied', reviewedAt: '2026-11-01T03:00:00.000Z',
    appliedAt: '2026-11-04T03:00:00.000Z', decidedAt: '2026-11-04T03:00:00.000Z' });
  expect(await row()).toMatchObject({ reviewed: true, mastered: true, corrected: true, stateRevision: 1,
    parentNote: 'Preserve synthetic note', reviewReminderDate: '2026-10-01' });
  const event = await Event.findById(result.eventId).lean();
  expect(event.effectiveAt.toISOString()).toBe(result.appliedAt);
  expect(event.ai3Evidence).toMatchObject({ effectId: body.effectId, finalReviewHash: body.finalReviewHash });
  expect(String(event.ai3Evidence.finalReviewId)).toBe(body.finalReviewId);
  expect(String(event.ai3Evidence.reviewedByParentId)).toBe(f.actorId);
  expect(event.ai3Evidence.reviewedAt.toISOString()).toBe(result.reviewedAt);
  expect(await counts()).toEqual([1, 1]);
});
test('mastery true and a non-null historical date apply only the proof values', async () => {
  const point = id(); await Mistake.updateOne({ _id: f.targetId }, { $set: { knowledgePointId: point } });
  bindReview({ masteryConfirmed: true, reviewReminderDate: '2026-09-01', targets: {
    mistake: { id: f.targetId, stateRevision: 0, knowledgePointId: point, effectId: randomUUID() },
    knowledgePoint: { id: point, stateRevision: 0, effectId: randomUUID() } } });
  expect((await apply()).status).toBe('applied');
  expect(await row()).toMatchObject({ reviewed: true, mastered: true, reviewReminderDate: '2026-09-01', corrected: true });
});
test('legacy missing stateRevision is CAS-applied once as zero', async () => {
  await Mistake.collection.updateOne({ _id: f.mistake._id }, { $unset: { stateRevision: '' } });
  expect((await apply()).status).toBe('applied'); expect((await row()).stateRevision).toBe(1);
});
test('original receipt wins over changed target and unavailable proof on replay', async () => {
  const original = await apply(); clock += 86400000;
  await Mistake.deleteOne({ _id: f.targetId }); proofClient.getFinalReview.mockRejectedValue(new Error('Synthetic offline'));
  expect(await apply()).toEqual(original);
  expect(await service.getReceipt({ ...scope(), effectId: body.effectId })).toEqual(original);
  expect(await counts()).toEqual([1, 1]);
});
test.each(['finalReviewHash', 'targetId', 'expectedStateRevision'])(
  'same effect with changed %s is rejected before target CAS', async key => {
    await apply(); const change = { finalReviewHash: 'f'.repeat(64), targetId: id(), expectedStateRevision: 1 };
    await expect(apply({ [key]: change[key] })).rejects.toMatchObject({ statusCode: 409, code: 'AI3_EFFECT_CONFLICT' });
    expect(await counts()).toEqual([1, 1]);
  });
test.each(['actorRemoved', 'actorDeleted', 'actorRole', 'childMoved', 'childRemoved'])(
  'live authorization rejects %s before original receipt replay', async change => {
    await apply();
    if (change === 'actorRemoved') await Family.updateOne({ _id: f.familyId }, { $set: { ownerParentId: f.memberId }, $pull: { memberParentIds: f.actorId } });
    if (change === 'actorDeleted') await User.deleteOne({ _id: f.actorId });
    if (change === 'actorRole') await User.updateOne({ _id: f.actorId }, { $set: { role: 'student' } });
    if (change === 'childMoved') await User.updateOne({ _id: f.childId }, { $set: { familyId: id() } });
    if (change === 'childRemoved') await Family.updateOne({ _id: f.familyId }, { $pull: { childIds: f.childId } });
    await expect(apply()).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.getReceipt({ ...scope(), effectId: body.effectId })).rejects.toMatchObject({ statusCode: 403 });
    expect(await counts()).toEqual([1, 1]);
  });
test('revocation while obtaining proof is checked again before transaction', async () => {
  proofClient.getFinalReview.mockImplementationOnce(async () => {
    await Family.updateOne({ _id: f.familyId }, { $set: { ownerParentId: f.memberId }, $pull: { memberParentIds: f.actorId } }); return proof;
  });
  await expect(apply()).rejects.toMatchObject({ statusCode: 403 }); expect(await counts()).toEqual([0, 0]);
});
test.each([{ stateRevision: 1 }, { knowledgePointId: '665000000000000000000099' }, { mediaReferenceState: 'pending' }, { subject: 'english' }])(
  'changed target %j yields a permanent conflict without state/event writes', async change => {
    await Mistake.collection.updateOne({ _id: f.mistake._id }, { $set: change });
    const before = await row(), result = await apply();
    expect(result).toMatchObject({ status: 'not_applied_conflict', appliedAt: null, eventId: null });
    expect(await row()).toEqual(before); expect(await counts()).toEqual([1, 0]);
    await Mistake.collection.updateOne({ _id: f.mistake._id }, { $set: { stateRevision: 0, knowledgePointId: null, mediaReferenceState: 'none', subject: 'math' } });
    expect(await apply()).toEqual(result); expect(await counts()).toEqual([1, 0]);
  });
test('missing target gets permanent missing receipt only with verified original proof', async () => {
  await Mistake.deleteOne({ _id: f.targetId });
  proofClient.getFinalReview.mockRejectedValueOnce(E.error(404, 'RESOURCE_NOT_FOUND'));
  await expect(apply()).rejects.toMatchObject({ statusCode: 404 }); expect(await counts()).toEqual([0, 0]);
  const result = await apply(); expect(result.status).toBe('not_applied_missing'); expect(await counts()).toEqual([1, 0]);
});
test.each(['familyId', 'childId'])('existing wrong-scope target %s is not treated as genuinely missing', async key => {
  await Mistake.collection.updateOne({ _id: f.mistake._id }, { $set: { [key]: new (require('mongoose').Types.ObjectId)() } });
  await expect(apply()).rejects.toMatchObject({ statusCode: 404 }); expect(await counts()).toEqual([0, 0]);
});
test.each(['finalReviewHash', 'actor', 'target', 'effect', 'extra'])(
  'invalid homework proof %s cannot create receipts or state events', async key => {
    if (key === 'finalReviewHash') proof.finalReviewHash = 'f'.repeat(64);
    if (key === 'actor') proof.finalReview.reviewedByParentId = id();
    if (key === 'target') proof.effect.targetId = id();
    if (key === 'effect') proof.effect.effectId = randomUUID();
    if (key === 'extra') proof.finalReview.extra = 'forged';
    await expect(apply()).rejects.toHaveProperty('statusCode'); expect(await counts()).toEqual([0, 0]);
  });
test('proof dependency 503 has zero side effects', async () => {
  proofClient.getFinalReview.mockRejectedValue(new Error('Synthetic network failure'));
  await expect(apply()).rejects.toMatchObject({ statusCode: 503 }); expect(await counts()).toEqual([0, 0]);
});
test('concurrent same effect applies and audits once', async () => {
  const results = await Promise.all([apply(), apply()]); expect(results[0]).toEqual(results[1]);
  expect(await counts()).toEqual([1, 1]); expect((await row()).stateRevision).toBe(1);
});
test('two different effects with the same viewed revision have one CAS winner', async () => {
  const firstBody = { ...body }, firstProof = proof; bindReview();
  proofClient.getFinalReview.mockImplementation(async input => input.effectId === firstBody.effectId ? firstProof : proof);
  const results = await Promise.all([service.apply({ body: firstBody }), apply()]);
  expect(results.map(r => r.status).sort()).toEqual(['applied', 'not_applied_conflict']); expect(await counts()).toEqual([2, 1]);
});
test.each(['committed', 'rolled-back'])('unknown transaction %s uses original receipt without duplicate state', async outcome => {
  const transaction = async work => {
    await transactionRunner(async session => { await work(session); if (outcome === 'rolled-back') throw new Error('Synthetic rollback'); });
    throw new Error('Synthetic unknown commit');
  };
  service = factory({ transactionRunner: transaction });
  if (outcome === 'committed') expect((await apply()).status).toBe('applied');
  else { await expect(apply()).rejects.toMatchObject({ statusCode: 503 }); expect(await counts()).toEqual([0, 0]); }
  clock += 86400000; service = factory(); const result = await apply();
  expect(result.appliedAt).toBe(outcome === 'committed' ? '2026-11-04T03:00:00.000Z' : '2026-11-05T03:00:00.000Z');
  expect(await counts()).toEqual([1, 1]);
});
test('transaction retry resamples appliedAt and event effectiveAt after rollback', async () => {
  service = factory({ transactionRunner: async work => {
    try { await transactionRunner(async session => { await work(session); throw new Error('Synthetic retry'); }); } catch (_) { clock += 1000; }
    return transactionRunner(work);
  } });
  const result = await apply(); expect(result.appliedAt).toBe('2026-11-04T03:00:01.000Z');
  expect((await Event.findById(result.eventId)).effectiveAt.toISOString()).toBe(result.appliedAt);
  expect(await counts()).toEqual([1, 1]);
});
test('missing receipt unique index fails closed before any effect writes', async () => {
  await Receipt.collection.dropIndex('ai3_mistake_effect_identity');
  try { await expect(apply()).rejects.toMatchObject({ statusCode: 503 }); expect(await counts()).toEqual([0, 0]); }
  finally { await Receipt.createIndexes(); }
});
test.each([Event, Receipt])('audit-store failure rolls back target and the other audit record (%p)', async model => {
  const before = await row();
  jest.spyOn(model, 'create').mockRejectedValueOnce(new Error('Synthetic audit failure'));
  await expect(apply()).rejects.toMatchObject({ statusCode: 503 });
  expect(await row()).toEqual(before); expect(await counts()).toEqual([0, 0]);
  expect((await apply()).status).toBe('applied'); expect(await counts()).toEqual([1, 1]);
});
test.each(['reviewReminderDate', 'masteryConfirmed', 'reviewed', 'ai3Evidence'])(
  'effect body cannot override proof-only field %s', async key => {
    await expect(apply({ [key]: true })).rejects.toMatchObject({ statusCode: 400 });
    expect(await counts()).toEqual([0, 0]); expect((await row()).reviewed).toBe(false);
  });
test('getReceipt is scoped to the original actor and does not recover missing effects', async () => {
  await expect(service.getReceipt({ ...scope(), effectId: body.effectId })).rejects.toMatchObject({ statusCode: 404 });
  await apply();
  await expect(service.getReceipt({ ...scope(), actorId: f.memberId, effectId: body.effectId })).rejects.toMatchObject({ statusCode: 404 });
  expect(await counts()).toEqual([1, 1]);
});
test('media pending claim wins against an effect held after its target snapshot', async () => {
  let entered, release, held = false;
  const arrived = new Promise(resolve => { entered = resolve; }), hold = new Promise(resolve => { release = resolve; });
  const original = Mistake.findOneAndUpdate.bind(Mistake);
  const spy = jest.spyOn(Mistake, 'findOneAndUpdate').mockImplementation((...args) => {
    const query = original(...args), exec = query.exec.bind(query);
    query.exec = async () => {
      if (!held && args[2]?.session && args[1].$set?.reviewed === true) { held = true; entered(); await hold; }
      return exec();
    };
    return query;
  });
  const running = apply(); await arrived;
  try {
    const { client, service: media } = mediaService(); client.prepare.mockRejectedValue(new Error('Synthetic pending'));
    await expect(media.mutate({ mistake: f.mistake, mistakePatch: { mastered: true }, mediaPatch: { questionMediaIds: [id()] } })).rejects.toBeDefined();
  } finally { release(); }
  const receipt = await running; spy.mockRestore();
  expect(receipt.status).toBe('not_applied_conflict');
  expect(await row()).toMatchObject({ stateRevision: 1, mediaReferenceState: 'pending', reviewed: false, mastered: false });
  expect(await counts()).toEqual([1, 0]);
});
test.each([false, true])('effect invalidates an older media claim including missing legacy __v=%s', async legacy => {
  if (legacy) await Mistake.collection.updateOne({ _id: f.mistake._id }, { $unset: { __v: '' } });
  let entered, release, held = false;
  const arrived = new Promise(resolve => { entered = resolve; }), hold = new Promise(resolve => { release = resolve; });
  const original = Mistake.findOneAndUpdate.bind(Mistake);
  const spy = jest.spyOn(Mistake, 'findOneAndUpdate').mockImplementation((...args) => {
    const query = original(...args), exec = query.exec.bind(query);
    query.exec = async () => {
      if (!held && args[1].$set?.mediaReferenceState === 'pending') { held = true; entered(); await hold; }
      return exec();
    };
    return query;
  });
  const { service: media } = mediaService();
  const running = media.mutate({ mistake: f.mistake, mistakePatch: { reviewed: false }, mediaPatch: { questionMediaIds: [id()] } });
  const outcome = running.catch(e => e); await arrived;
  try { expect((await apply()).status).toBe('applied'); } finally { release(); }
  expect(await outcome).toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' }); spy.mockRestore();
  expect(await row()).toMatchObject({ stateRevision: 1, mediaReferenceState: 'none', reviewed: true });
  expect(await counts()).toEqual([1, 1]);
});
test.each(['getContext', 'getReceipt', 'apply'])('%s reports local authorization dependency failures as 503', async method => {
  jest.spyOn(User, 'findOne').mockImplementationOnce(() => { throw new Error('Synthetic database unavailable'); });
  const input = method === 'apply' ? { body } : { ...scope(), ...(method === 'getContext' ? { targetId: f.targetId } : { effectId: body.effectId }) };
  await expect(service[method](input)).rejects.toMatchObject({ statusCode: 503 });
  expect(await counts()).toEqual([0, 0]);
});

jest.mock('../../../common/config/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }));
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Point = require('../models/KnowledgePoint');
const Event = require('../models/KnowledgePointMasteryEvent');
const User = require('../../../common/models/User');
const Family = require('../../../common/models/Family');
const { runMongoTransaction } = require('../../../common/services/mongoTransaction');
const { hash } = require('../../../common/services/ai3ReviewEvidence');
const express = require('express');
const { createHttpTestHarness } = require('../../../common/test/httpTestHarness');
const { createIdentityHeaders } = require('../../../common/middleware/gatewayIdentity');
const { request: httpRequest, close: closeHttp } = createHttpTestHarness();
const app = express(); app.use(express.json()); app.use('/api/knowledge-points', require('../routes/knowledgePoints'));
const id = () => String(new mongoose.Types.ObjectId());
const runner = work => runMongoTransaction({ mongooseInstance: mongoose, work });
let parentId, familyId, childId, targetId, review, body, proofClient, clock;
const receiptModel = () => require('../models/Ai3MasteryEffectReceipt');
const make = options => {
  expect(() => require('../services/ai3MasteryEffectService')).not.toThrow();
  return require('../services/ai3MasteryEffectService').createAi3MasteryEffectService({ proofClient,
    transactionRunner: runner, now: () => clock, ...options });
};
const proof = () => ({ finalReview: review, finalReviewHash: hash(review), effect: { kind: 'mastery',
  effectId: body.effectId, targetId, expectedStateRevision: body.expectedStateRevision } });
const context = () => ({ familyId, childId, actorId: parentId, targetId });
const receiptScope = () => ({ familyId, childId, actorId: parentId, effectId: body.effectId });
beforeAll(async () => { await Point.init(); await Event.init(); });
beforeEach(async () => {
  parentId = id(); familyId = id(); childId = id(); targetId = id(); clock = Date.parse('2026-11-06T10:00:00.000Z');
  await User.collection.insertMany([{ _id: new mongoose.Types.ObjectId(parentId), role: 'parent', username: parentId },
    { _id: new mongoose.Types.ObjectId(childId), role: 'student', familyId: new mongoose.Types.ObjectId(familyId), username: childId }]);
  await Family.create({ _id: familyId, familyName: 'Synthetic', ownerParentId: parentId, memberParentIds: [parentId], childIds: [childId] });
  await Point.create({ _id: targetId, familyId, childId, dimension: 'academic', subject: 'math', name: 'Synthetic multiplication',
    masteryLevel: 'learning', practiceCount: 5, createdByParentId: parentId, updatedByParentId: parentId });
  review = { schemaVersion: 'ai3-final-review-v1', id: id(), familyId, childId, roundId: id(), sourcePackageId: id(),
    sourceAttemptId: id(), sourceAttemptVersion: 1, sourceAttemptPayloadHash: 'a'.repeat(64), sourceReviewHash: 'b'.repeat(64),
    source: { type: 'task', id: id() }, contentId: id(), contentVersion: 1, contentHash: 'c'.repeat(64),
    childSnapshotHash: 'd'.repeat(64), attemptId: id(), attemptVersion: 1, attemptPayloadHash: 'e'.repeat(64),
    reviewedByParentId: parentId, reviewedAt: '2026-11-05T10:00:00.000Z', evidenceSummary: 'Synthetic reviewed work',
    comment: '', masteryConfirmed: true, reviewReminderDate: null,
    targets: { mistake: null, knowledgePoint: { id: targetId, stateRevision: 0, effectId: randomUUID() } } };
  body = { schemaVersion: 'ai3-review-effect-v1', effectId: review.targets.knowledgePoint.effectId,
    finalReviewId: review.id, finalReviewHash: hash(review), familyId, childId, reviewedByParentId: parentId,
    targetId, expectedStateRevision: 0 };
  proofClient = { getFinalReview: jest.fn(async () => proof()) };
});
afterEach(async () => { jest.restoreAllMocks(); await closeHttp(); });

test.each(['math', ' MATH ', '\u6570\u5b66'])('context accepts existing math alias %s and old missing revision zero', async subject => {
  await Point.collection.updateOne({ _id: new mongoose.Types.ObjectId(targetId) }, { $set: { subject }, $unset: { stateRevision: '' } });
  expect(await make().getContext(context())).toEqual({ id: targetId, stateRevision: 0 });
  expect(proofClient.getFinalReview).not.toHaveBeenCalled();
});
test('applies one exact event and receipt with transaction application time, without practice increments', async () => {
  const service = make(), result = await service.apply({ body });
  expect(result).toEqual({ ...Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'schemaVersion')),
    status: 'applied', reviewedAt: review.reviewedAt, appliedAt: new Date(clock).toISOString(),
    decidedAt: new Date(clock).toISOString(), eventId: expect.stringMatching(/^[a-f0-9]{24}$/) });
  expect(await Point.findById(targetId).lean()).toMatchObject({ masteryLevel: 'skilled', stateRevision: 1, practiceCount: 5 });
  const event = await Event.findById(result.eventId).lean();
  expect(event).toMatchObject({ operationId: body.effectId, sourceType: 'ai3_practice', finalReviewHash: body.finalReviewHash,
    effectiveAt: new Date(clock), reviewedAt: new Date(review.reviewedAt) });
  expect(String(event.finalReviewId)).toBe(review.id); expect(String(event.reviewedByParentId)).toBe(parentId);
  expect(await service.getReceipt(receiptScope())).toEqual(result);
});
test('already skilled still gets one new per-round evidence and replay consults receipt before target CAS/proof', async () => {
  await Point.updateOne({ _id: targetId }, { $set: { masteryLevel: 'skilled' } });
  const service = make(), result = await service.apply({ body }); clock += 86400000;
  await Point.updateOne({ _id: targetId }, { $set: { stateRevision: 9, masteryLevel: 'learning' } });
  proofClient.getFinalReview.mockRejectedValue(Error('offline'));
  expect(await service.apply({ body })).toEqual(result);
  expect(proofClient.getFinalReview).toHaveBeenCalledTimes(1);
  expect(await Event.countDocuments({ operationId: body.effectId })).toBe(1);
  expect((await Point.findById(targetId)).masteryLevel).toBe('learning');
});
test.each(['version', 'dimension', 'subject', 'missing'])('verified %s mismatch produces permanent nonapplied receipt', async kind => {
  if (kind === 'missing') await Point.deleteOne({ _id: targetId });
  if (kind === 'version') await Point.updateOne({ _id: targetId }, { $set: { stateRevision: 2 } });
  if (kind === 'dimension') await Point.updateOne({ _id: targetId }, { $set: { dimension: 'physical' } });
  if (kind === 'subject') await Point.updateOne({ _id: targetId }, { $set: { subject: 'english' } });
  const service = make(), result = await service.apply({ body });
  expect(result).toMatchObject({ status: kind === 'missing' ? 'not_applied_missing' : 'not_applied_conflict',
    appliedAt: null, eventId: null, decidedAt: new Date(clock).toISOString() });
  expect(await Event.countDocuments()).toBe(0);
  await Point.updateOne({ _id: targetId }, { $set: { stateRevision: 0, dimension: 'academic', subject: 'math' } });
  expect(await service.apply({ body })).toEqual(result); expect(await Event.countDocuments()).toBe(0);
});
test('same effect with changed request conflicts even after target changed', async () => {
  const service = make(); await service.apply({ body });
  await expect(service.apply({ body: { ...body, expectedStateRevision: 1 } })).rejects.toMatchObject({ statusCode: 409, code: 'AI3_EFFECT_CONFLICT' });
  expect(await Event.countDocuments()).toBe(1);
});
test.each(['actor role', 'parent membership', 'child membership', 'child family', 'foreign target'])(
  'live %s refusal has no receipt or event', async change => {
    if (change === 'actor role') await User.collection.updateOne({ _id: new mongoose.Types.ObjectId(parentId) }, { $set: { role: 'student' } });
    if (change === 'parent membership') await Family.updateOne({ _id: familyId }, { $set: { ownerParentId: id(), memberParentIds: [] } });
    if (change === 'child membership') await Family.updateOne({ _id: familyId }, { $set: { childIds: [] } });
    if (change === 'child family') await User.updateOne({ _id: childId }, { $set: { familyId: id() } });
    if (change === 'foreign target') await Point.updateOne({ _id: targetId }, { $set: { childId: id() } });
    await expect(make().apply({ body })).rejects.toMatchObject({ statusCode: 403 });
    expect(await Event.countDocuments()).toBe(0); expect(await receiptModel().countDocuments()).toBe(0);
  });
test('revocation while proof is pending is checked again inside final transaction', async () => {
  proofClient.getFinalReview.mockImplementation(async () => {
    await Family.updateOne({ _id: familyId }, { $set: { ownerParentId: id(), memberParentIds: [] } }); return proof();
  });
  await expect(make().apply({ body })).rejects.toMatchObject({ statusCode: 403 });
  expect(await Event.countDocuments()).toBe(0);
});
test.each(['hash', 'actor', 'effect', 'mastery', 'missing proof', 'unavailable'])('invalid %s cannot consume', async change => {
  proofClient.getFinalReview.mockImplementation(async () => {
    if (change === 'missing proof') throw Object.assign(Error('missing'), { statusCode: 404, code: 'RESOURCE_NOT_FOUND' });
    if (change === 'unavailable') throw Error('synthetic transport failure');
    const value = proof();
    if (change === 'hash') value.finalReviewHash = 'f'.repeat(64);
    if (change === 'actor') value.finalReview = { ...review, reviewedByParentId: id() };
    if (change === 'effect') value.effect.effectId = randomUUID();
    if (change === 'mastery') value.finalReview = { ...review, masteryConfirmed: false };
    return value;
  });
  await expect(make().apply({ body })).rejects.toBeDefined();
  expect(await Event.countDocuments()).toBe(0); expect(await receiptModel().countDocuments()).toBe(0);
  expect((await Point.findById(targetId)).masteryLevel).toBe('learning');
});
test('receipt/event/state roll back together on event or receipt write failure', async () => {
  const service = make();
  jest.spyOn(Event, 'create').mockRejectedValueOnce(Error('synthetic event failure'));
  await expect(service.apply({ body })).rejects.toMatchObject({ statusCode: 503 });
  expect((await Point.findById(targetId)).stateRevision).toBe(0);
  expect(await receiptModel().countDocuments()).toBe(0);
  jest.spyOn(receiptModel(), 'create').mockRejectedValueOnce(Error('synthetic receipt failure'));
  await expect(service.apply({ body })).rejects.toMatchObject({ statusCode: 503 });
  expect(await Event.countDocuments()).toBe(0); expect((await Point.findById(targetId)).stateRevision).toBe(0);
});
test('committed response loss is recovered only by exact receipt without rewriting event time', async () => {
  let transactionCount = 0;
  const service = make({ transactionRunner: async work => {
    const result = await runner(work);
    if (++transactionCount === 2) throw Error('synthetic committed response lost');
    return result;
  } });
  await expect(service.apply({ body })).rejects.toMatchObject({ statusCode: 503 }); clock += 86400000;
  const result = await service.getReceipt(receiptScope());
  expect(result.status).toBe('applied'); expect(result.appliedAt).toBe('2026-11-06T10:00:00.000Z');
  expect(await make().apply({ body })).toEqual(result); expect(await Event.countDocuments()).toBe(1);
});
test('concurrent same effect converges to one receipt/event and current authorization still precedes replay', async () => {
  const service = make(); await receiptModel().init();
  const results = await Promise.all([service.apply({ body }), service.apply({ body })]);
  expect(results[0]).toEqual(results[1]); expect(await Event.countDocuments()).toBe(1);
  await User.collection.updateOne({ _id: new mongoose.Types.ObjectId(parentId) }, { $set: { role: 'student' } });
  await expect(service.apply({ body })).rejects.toMatchObject({ statusCode: 403 });
  await expect(service.getReceipt(receiptScope())).rejects.toMatchObject({ statusCode: 403 });
});
test('unknown receipt is read-only 404 and cannot trigger proof or apply', async () => {
  await expect(make().getReceipt(receiptScope())).rejects.toMatchObject({ statusCode: 404 });
  expect(proofClient.getFinalReview).not.toHaveBeenCalled(); expect(await Event.countDocuments()).toBe(0);
});
test('transaction rollback resamples appliedAt and does not leave its first event behind', async () => {
  const create = Event.create.bind(Event); let calls = 0, samples = 0;
  jest.spyOn(Event, 'create').mockImplementation(async (...args) => {
    if (++calls === 1) throw new mongoose.mongo.MongoServerError({ message: 'synthetic transient', code: 112,
      errorLabels: ['TransientTransactionError'] });
    return create(...args);
  });
  const result = await make({ now: () => clock + samples++ * 1000 }).apply({ body });
  expect(samples).toBe(2); expect(result.appliedAt).toBe(new Date(clock + 1000).toISOString());
  expect((await Event.findById(result.eventId)).effectiveAt).toEqual(new Date(clock + 1000));
  expect(await Event.countDocuments()).toBe(1); expect((await Point.findById(targetId)).stateRevision).toBe(1);
});
test('actual old PATCH ABA while proof awaits permanently rejects the old revision', async () => {
  let enter, release;
  const entered = new Promise(resolve => { enter = resolve; });
  const paused = new Promise(resolve => { release = resolve; });
  proofClient.getFinalReview.mockImplementation(async () => { enter(); await paused; return proof(); });
  const pending = make().apply({ body }); await entered;
  try {
    const url = `/api/knowledge-points/${targetId}`;
    for (const masteryLevel of ['needs_review', 'learning']) {
      const result = await (await httpRequest(app)).patch(url).set(createIdentityHeaders({ method: 'PATCH', originalUrl: url,
        user: { id: parentId, role: 'parent' }, secret: process.env.GATEWAY_IDENTITY_SECRET })).send({ masteryLevel });
      expect(result.status).toBe(200);
    }
  } finally { release(); }
  expect((await pending).status).toBe('not_applied_conflict');
  expect(await Point.findById(targetId).lean()).toMatchObject({ masteryLevel: 'learning', stateRevision: 2 });
  expect(await Event.countDocuments({ sourceType: 'ai3_practice' })).toBe(0);
});
test('different effects competing for one target revision produce one event and permanent conflict', async () => {
  const secondReview = JSON.parse(JSON.stringify(review)); secondReview.id = id();
  secondReview.targets.knowledgePoint.effectId = randomUUID();
  const second = { ...body, effectId: secondReview.targets.knowledgePoint.effectId,
    finalReviewId: secondReview.id, finalReviewHash: hash(secondReview) };
  proofClient.getFinalReview.mockImplementation(async input => input.effectId === body.effectId ? proof()
    : { finalReview: secondReview, finalReviewHash: second.finalReviewHash,
      effect: { kind: 'mastery', effectId: second.effectId, targetId, expectedStateRevision: 0 } });
  const service = make(); await receiptModel().init();
  const results = await Promise.all([service.apply({ body }), service.apply({ body: second })]);
  expect(results.map(result => result.status).sort()).toEqual(['applied', 'not_applied_conflict']);
  expect(await Event.countDocuments()).toBe(1); expect(await receiptModel().countDocuments()).toBe(2);
});
test('a co-parent cannot read another original actor receipt and malformed stored receipt is unavailable', async () => {
  const service = make(); await service.apply({ body });
  const other = id(); await User.collection.insertOne({ _id: new mongoose.Types.ObjectId(other), role: 'parent', username: other });
  await Family.updateOne({ _id: familyId }, { $push: { memberParentIds: other } });
  await expect(service.getReceipt({ ...receiptScope(), actorId: other })).rejects.toMatchObject({ statusCode: 403 });
  await receiptModel().collection.updateOne({ effectId: body.effectId }, { $set: { eventId: null } });
  await expect(service.getReceipt(receiptScope())).rejects.toMatchObject({ statusCode: 503 });
});
test('proof client traverses real loopback HTTP before the consumer verifies and atomically applies', async () => {
  const http = require('http');
  const { createAi3EvidenceClient } = require('../../../common/services/ai3EvidenceClient');
  const token = 'synthetic-ai3-evidence-token-at-least-32-characters';
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({ url: req.url, token: req.headers['x-ai3-evidence-token'] });
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true, data: proof() }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const client = createAi3EvidenceClient({ kind: 'proof', baseUrl: `http://127.0.0.1:${server.address().port}`, serviceToken: token });
    expect((await make({ proofClient: client }).apply({ body })).status).toBe('applied');
    expect(requests).toHaveLength(1); expect(requests[0].token).toBe(token);
    const url = new URL(requests[0].url, 'http://localhost');
    expect(url.pathname).toBe(`/api/internal/ai3/final-reviews/${body.finalReviewId}`);
    expect(Object.fromEntries(url.searchParams)).toEqual({ familyId, childId, effectId: body.effectId });
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('effect CAS consumes absent legacy revision as zero', async () => {
  await Point.collection.updateOne({ _id: new mongoose.Types.ObjectId(targetId) }, { $unset: { stateRevision: '' } });
  const result = await make().apply({ body });
  expect(result.status).toBe('applied');
  expect(await Point.findById(targetId).lean()).toMatchObject({ stateRevision: 1, masteryLevel: 'skilled' });
  expect(await Event.countDocuments()).toBe(1);
});
test('deleted target and offline proof do not invalidate original applied receipt', async () => {
  const service = make(), result = await service.apply({ body });
  await Point.deleteOne({ _id: targetId }); proofClient.getFinalReview.mockRejectedValue(Error('synthetic offline'));
  expect(await service.apply({ body })).toEqual(result);
  expect(await service.getReceipt(receiptScope())).toEqual(result);
  expect(proofClient.getFinalReview).toHaveBeenCalledTimes(1);
  expect(await Event.countDocuments()).toBe(1);
});
test('foreign-family existing target is denied, never missing receipt', async () => {
  await Point.collection.updateOne({ _id: new mongoose.Types.ObjectId(targetId) }, { $set: { familyId: new mongoose.Types.ObjectId() } });
  await expect(make().apply({ body })).rejects.toMatchObject({ statusCode: 403 });
  await expect(make().getContext(context())).rejects.toMatchObject({ statusCode: 403 });
  expect(await receiptModel().countDocuments()).toBe(0); expect(await Event.countDocuments()).toBe(0);
});
test('removed parent cannot replay an existing receipt through any endpoint', async () => {
  const service = make(); await service.apply({ body }); await User.deleteOne({ _id: parentId });
  await expect(service.apply({ body })).rejects.toMatchObject({ statusCode: 403 });
  await expect(service.getReceipt(receiptScope())).rejects.toMatchObject({ statusCode: 403 });
  await expect(service.getContext(context())).rejects.toMatchObject({ statusCode: 403 });
});
test('uncommitted ambiguous failure has no receipt and retry samples a fresh time', async () => {
  let count = 0;
  const service = make({ transactionRunner: async work => {
    if (++count !== 2) return runner(work);
    return runner(async session => { await work(session); throw Error('synthetic lost uncommitted result'); });
  } });
  await expect(service.apply({ body })).rejects.toMatchObject({ statusCode: 503 });
  await expect(service.getReceipt(receiptScope())).rejects.toMatchObject({ statusCode: 404 });
  expect(await Event.countDocuments()).toBe(0); expect((await Point.findById(targetId)).stateRevision).toBe(0);
  clock += 60000;
  const result = await service.apply({ body }); expect(result.appliedAt).toBe(new Date(clock).toISOString());
  expect((await Event.findById(result.eventId)).effectiveAt).toEqual(new Date(clock));
});
test('public writer wins after consumer snapshot and before its CAS', async () => {
  const original = Point.findOneAndUpdate.bind(Point); let raced = false;
  jest.spyOn(Point, 'findOneAndUpdate').mockImplementation(async (...args) => {
    if (!raced) {
      raced = true;
      const url = `/api/knowledge-points/${targetId}`;
      const response = await (await httpRequest(app)).patch(url).set(createIdentityHeaders({ method: 'PATCH', originalUrl: url,
        user: { id: parentId, role: 'parent' }, secret: process.env.GATEWAY_IDENTITY_SECRET })).send({ practiceCount: 42 });
      expect(response.status).toBe(200);
    }
    return original(...args);
  });
  const result = await make().apply({ body });
  expect(result.status).toBe('not_applied_conflict');
  expect(await Point.findById(targetId).lean()).toMatchObject({ stateRevision: 1, practiceCount: 42, masteryLevel: 'learning' });
  expect(await Event.countDocuments()).toBe(0);
});
test('deletion after snapshot retries to verified missing without partial effect', async () => {
  const original = Point.findOneAndUpdate.bind(Point); let raced = false;
  jest.spyOn(Point, 'findOneAndUpdate').mockImplementation(async (...args) => {
    if (!raced) { raced = true; await Point.deleteOne({ _id: targetId }); }
    return original(...args);
  });
  const result = await make().apply({ body });
  expect(result).toMatchObject({ status: 'not_applied_missing', appliedAt: null, eventId: null });
  expect(await Event.countDocuments()).toBe(0); expect(await receiptModel().countDocuments()).toBe(1);
});
test('second target cannot reuse original effect identity', async () => {
  const service = make(); await service.apply({ body });
  await expect(service.apply({ body: { ...body, targetId: id() } })).rejects.toMatchObject({ statusCode: 409 });
  expect(proofClient.getFinalReview).toHaveBeenCalledTimes(1); expect(await Event.countDocuments()).toBe(1);
});
test.each([true, false])('mistake-source association matches=%s with recomputed valid hash', async matches => {
  const mistakeId = id();
  review.source = { type: 'mistake', id: mistakeId };
  review.targets.mistake = { id: mistakeId, stateRevision: 4, knowledgePointId: matches ? targetId : id(), effectId: randomUUID() };
  body.finalReviewHash = hash(review);
  if (matches) {
    expect((await make().apply({ body })).status).toBe('applied');
    expect(await Event.countDocuments()).toBe(1);
  } else {
    await expect(make().apply({ body })).rejects.toMatchObject({ statusCode: 409 });
    expect(await Event.countDocuments()).toBe(0); expect(await receiptModel().countDocuments()).toBe(0);
    expect((await Point.findById(targetId)).masteryLevel).toBe('learning');
  }
});

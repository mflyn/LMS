const { createHash } = require('crypto');
const { canonicalize } = require('json-canonicalize');
let C;
try { C = require('../ai3ReviewEvidence'); } catch (_) { C = {}; }
const hash = v => createHash('sha256').update(canonicalize(v)).digest('hex');
const id = n => String(n).padStart(24, '0');
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const make = () => {
  const finalReview = { schemaVersion: 'ai3-final-review-v1', id: id(1), familyId: id(2), childId: id(3),
    roundId: id(4), sourcePackageId: id(5), sourceAttemptId: id(6), sourceAttemptVersion: 1,
    sourceAttemptPayloadHash: 'a'.repeat(64), sourceReviewHash: 'b'.repeat(64), source: { type: 'mistake', id: id(7) },
    contentId: id(8), contentVersion: 2, contentHash: 'c'.repeat(64), childSnapshotHash: 'd'.repeat(64),
    attemptId: id(9), attemptVersion: 1, attemptPayloadHash: 'e'.repeat(64), reviewedByParentId: id(10),
    reviewedAt: '2026-11-01T23:59:00.000Z', evidenceSummary: 'Both exercises checked', comment: '',
    masteryConfirmed: true, reviewReminderDate: '2026-11-06', targets: {
      mistake: { id: id(7), stateRevision: 0, knowledgePointId: id(11), effectId: uuid(1) },
      knowledgePoint: { id: id(11), stateRevision: 3, effectId: uuid(2) }
    } };
  const request = { schemaVersion: 'ai3-review-effect-v1', effectId: uuid(1), finalReviewId: id(1),
    finalReviewHash: hash(finalReview), familyId: id(2), childId: id(3), reviewedByParentId: id(10),
    targetId: id(7), expectedStateRevision: 0 };
  const proof = { finalReview, finalReviewHash: hash(finalReview), effect: {
    kind: 'mistake', effectId: uuid(1), targetId: id(7), expectedStateRevision: 0 } };
  const receipt = { effectId: uuid(1), finalReviewId: id(1), finalReviewHash: hash(finalReview), familyId: id(2),
    childId: id(3), targetId: id(7), reviewedByParentId: id(10), expectedStateRevision: 0,
    status: 'applied', reviewedAt: finalReview.reviewedAt, appliedAt: '2026-11-02T00:01:00.000Z',
    decidedAt: '2026-11-02T00:01:00.000Z', eventId: id(12) };
  return { finalReview, request, proof, receipt };
};

test('valid review proof and delayed consumer receipt preserve exact scope and separate times', () => {
  const { finalReview, request, proof, receipt } = make();
  expect(C.normalizeEffectRequest(request)).toEqual(request);
  expect(C.validateFinalReview(finalReview)).toEqual(finalReview);
  expect(C.validateProof(proof, request, 'mistake')).toEqual(finalReview);
  expect(C.validateReceipt(receipt, request)).toEqual(receipt);
  expect(receipt.reviewedAt).not.toBe(receipt.appliedAt);
});
test.each(['familyId', 'childId', 'reviewedByParentId', 'finalReviewId', 'targetId', 'effectId', 'finalReviewHash', 'expectedStateRevision'])('proof cannot replace request %s', field => {
  const { request, proof } = make();
  request[field] = field === 'expectedStateRevision' ? 1 : field === 'effectId' ? uuid(9) : field.endsWith('Hash') ? 'f'.repeat(64) : id(99);
  expect(() => C.validateProof(proof, request, 'mistake')).toThrow();
});
test.each(['rawAuthority', 'masteryLevel', 'reviewReminderDate'])('effect request rejects client override %s', field => {
  const { request } = make(); request[field] = 'skilled';
  expect(() => C.normalizeEffectRequest(request)).toThrow();
});
test.each([null, -1, 1.1, Number.MAX_SAFE_INTEGER + 1])('effect request rejects invalid revision %s', revision => {
  const { request } = make(); request.expectedStateRevision = revision;
  expect(() => C.normalizeEffectRequest(request)).toThrow();
});
test.each(['2026-02-29', '2026-11-31', '2026-1-01', 20261104])('review rejects invalid LocalDate %s', value => {
  const { finalReview } = make(); finalReview.reviewReminderDate = value;
  expect(() => C.validateFinalReview(finalReview)).toThrow();
});
test.each([null, '2024-02-29', '2020-01-01', '2030-01-01'])('review accepts null or valid historical/future date %s', value => {
  const { finalReview } = make(); finalReview.reviewReminderDate = value;
  expect(C.validateFinalReview(finalReview)).toEqual(finalReview);
});
test('missing knowledge point cannot claim mastery, and effects cannot cross original source', () => {
  const { finalReview } = make(); finalReview.targets.knowledgePoint = null;
  expect(() => C.validateFinalReview(finalReview)).toThrow();
  finalReview.masteryConfirmed = false;
  expect(C.validateFinalReview(finalReview)).toEqual(finalReview);
  finalReview.targets.mistake.id = id(99);
  expect(() => C.validateFinalReview(finalReview)).toThrow();
});
test('task no-effect practice remains valid but does not invent a mistake effect', () => {
  const { finalReview } = make(); finalReview.source.type = 'task'; finalReview.masteryConfirmed = false;
  finalReview.targets = { mistake: null, knowledgePoint: null };
  expect(C.validateFinalReview(finalReview)).toEqual(finalReview);
  finalReview.targets.mistake = { id: finalReview.source.id, effectId: uuid(1), stateRevision: 0, knowledgePointId: null };
  expect(() => C.validateFinalReview(finalReview)).toThrow();
});
test('mastery proof requires the correct kind and exact selected target', () => {
  const { request, proof } = make();
  Object.assign(request, { effectId: uuid(2), targetId: id(11), expectedStateRevision: 3 });
  proof.effect = { kind: 'mastery', effectId: uuid(2), targetId: id(11), expectedStateRevision: 3 };
  expect(C.validateProof(proof, request, 'mastery')).toEqual(proof.finalReview);
  expect(() => C.validateProof(proof, request, 'mistake')).toThrow();
});
test('receipt cannot smuggle status success or change target, event or time semantics', () => {
  const { receipt, request } = make();
  for (const delta of [{ status: 'success' }, { familyId: id(99) }, { eventId: null }, { appliedAt: null },
    { decidedAt: '2026-11-02T00:02:00.000Z' }, { unknown: true }]) {
    expect(() => C.validateReceipt({ ...receipt, ...delta }, request)).toThrow();
  }
  const conflict = { ...receipt, status: 'not_applied_conflict', appliedAt: null, eventId: null };
  expect(C.validateReceipt(conflict, request)).toEqual(conflict);
  expect(() => C.validateReceipt({ ...conflict, eventId: id(8) }, request)).toThrow();
});
test('raw parsing counts real UTF8 bytes and rejects malformed UTF8', () => {
  const at = Buffer.from(`{"x":"${'a'.repeat(32760)}"}`);
  expect(at.length).toBe(32768);
  expect(C.parseRaw(at).x).toHaveLength(32760);
  expect(() => C.parseRaw(Buffer.concat([at, Buffer.from(' ')]))).toThrow();
  expect(() => C.parseRaw(Buffer.from([0xff]))).toThrow();
});
test('plain proof input rejects getters without executing them', () => {
  const { proof, request } = make(); const getter = jest.fn(() => proof.finalReview);
  Object.defineProperty(proof, 'finalReview', { enumerable: true, get: getter });
  expect(() => C.validateProof(proof, request, 'mistake')).toThrow();
  expect(getter).not.toHaveBeenCalled();
});

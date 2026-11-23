const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const M = require('../../models/Ai1');
const A3 = require('../../models/Ai3');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { createAiGenerationBudget, assertAiBudgetOwners } = require('../../services/aiGenerationBudget');

const oid = () => new mongoose.Types.ObjectId();
const tx = work => runMongoTransaction({ mongooseInstance: mongoose, work });
let ledger, trial, limits, clock, familyId, childId;
const access = (id = familyId) => ({ familyId: id, family: { timezone: 'UTC' } });
const preview = () => ({ feeMode: 'estimate_only', estimatedReservationMicros: 100 });
const rebuild = () => { ledger = createAiGenerationBudget({ now: () => clock, getLimits: () => limits, getTrial: () => trial }); };
beforeAll(async () => { for (const model of [...Object.values(M), ...Object.values(A3)]) await model.init(); });
beforeEach(() => {
  clock = Date.parse('2026-11-30T23:59:00Z'); familyId = oid(); childId = oid();
  trial = { authorizationVersion: 'synthetic-trial-1', maxSubmissions: 3 };
  limits = { singleMicros: 1000, dayMicros: 1000, monthMicros: 1000, experimentMicros: 3000 };
  rebuild();
});
async function reserve(p = 'ai1', id = familyId, v2 = true, session = null) {
  if (!session) return tx(s => reserve(p, id, v2, s));
  const ownerId = oid(), reservationId = oid(), frozen = v2 ? preview() : { reservedCeilingMicros: 100 };
  const proof = await ledger.reserve(access(id), childId, ownerId, reservationId, 100, session, p, v2 ? frozen : null);
  const common = { _id: ownerId, familyId: id, childId, operationId: randomUUID() };
  if (p === 'ai1') {
    const [owner] = await M.Job.create([{ ...common, cycleId: oid(), createdBy: oid(), requestHash: 'a'.repeat(64),
      remoteOperationId: randomUUID(), reservationId, preview: frozen, sendNotAfter: new Date(clock + 60000), status: 'reserved',
      ...(v2 ? proof : { maxAuthorizedCostMicros: 100 }) }], { session });
    return owner.toObject();
  }
  const [owner] = await A3.Command.create([{ ...common, roundId: oid(), actorId: oid(), endpointOperation: 'ai3.generate',
    requestHash: 'b'.repeat(64), payload: { synthetic: true }, phase: 'RESERVED', generation: {
      reservationId, preview: frozen, ...(v2 ? { ...proof, feeMode: 'estimate_only', estimatedReservationMicros: 100 }
        : { reservedCeilingMicros: 100 }) } }], { session });
  return owner.toObject();
}
const snapshot = async () => JSON.stringify(await Promise.all([M.Account, M.Reservation, M.Slot, M.Job, A3.Command]
  .map(m => m.find().sort({ _id: 1 }).lean())));
async function claim(p, owner, session) {
  await ledger.claimSlot(p, owner, session);
  await (p === 'ai1' ? M.Job : A3.Command).updateOne({ _id: owner._id },
    { $set: p === 'ai1' ? { status: 'dispatching' } : { phase: 'DISPATCHING' } }, { session });
}

test('third owner can claim after exhaustion and reconstruction; fourth cannot reserve across families/profiles', async () => {
  await reserve(); await reserve('ai3', oid()); const third = await reserve('ai3');
  clock += 120000; rebuild();
  expect(await M.Account.findById('experiment').lean()).toMatchObject({ trialAuthorizationVersion: trial.authorizationVersion,
    trialMaxSubmissions: 3, trialUsedSubmissions: 3 });
  expect(await ledger.view('ai3', third)).toMatchObject({ sendBlocked: true, sendBlockReason: 'trial_exhausted' });
  await tx(s => claim('ai3', third, s));
  await expect(reserve()).rejects.toMatchObject({ code: 'AI_TRIAL_LIMIT_REACHED' });
  await assertAiBudgetOwners();
});
test('rollback does not spend a submission; release does not refund it', async () => {
  await expect(tx(async s => { await reserve('ai3', familyId, true, s); throw new Error('rollback'); })).rejects.toThrow('rollback');
  expect(await M.Account.countDocuments()).toBe(0);
  const owner = await reserve('ai3');
  await tx(s => ledger.settle('ai3', owner, { charge: null, release: true }, s));
  expect(await M.Account.findById('experiment').lean()).toMatchObject({ outstandingMicros: 0, trialUsedSubmissions: 1 });
  expect(await ledger.view('ai3', owner)).toMatchObject({ state: 'released', chargeStatus: 'released', usagePricedMicros: 0 });
});
test.each(['renamed', 'capacity', 'disabled'])('configuration %s cannot reset or grant historical v2 send eligibility', async change => {
  const owner = await reserve();
  trial = change === 'disabled' ? null : { ...trial, ...(change === 'renamed' ? { authorizationVersion: 'other' } : { maxSubmissions: 4 }) };
  rebuild(); const before = await snapshot();
  await expect(tx(s => claim('ai1', owner, s))).rejects.toMatchObject({ code: 'AI_PROFILE_UNAVAILABLE' });
  await expect(reserve()).rejects.toMatchObject({ code: 'AI_PROFILE_UNAVAILABLE' });
  expect(await snapshot()).toBe(before);
  await tx(s => ledger.settle('ai1', owner, { charge: 80 }, s));
  expect(await M.Account.findById('experiment').lean()).toMatchObject({ settledMicros: 80, trialUsedSubmissions: 1 });
});
test('trial blocks new and reserved v1 without conversion while preserving old settlement/view', async () => {
  trial = null; const owner = await reserve('ai1', familyId, false);
  trial = { authorizationVersion: 'synthetic-trial-1', maxSubmissions: 3 }; const before = await snapshot();
  await expect(reserve('ai3', familyId, false)).rejects.toMatchObject({ code: 'AI_PROFILE_UNAVAILABLE' });
  await expect(tx(s => claim('ai1', owner, s))).rejects.toMatchObject({ code: 'AI_PROFILE_UNAVAILABLE' });
  expect(await snapshot()).toBe(before);
  await expect(tx(s => ledger.settle('ai1', owner, { charge: 101 }, s))).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
  await tx(s => ledger.settle('ai1', owner, { charge: 99 }, s));
  expect(await ledger.view('ai1', owner)).toEqual({ reservationId: String(owner.reservationId), reservedMicros: 100,
    settledMicros: 99, state: 'settled' });
});
test.each(['ai1', 'ai3'])('%s full over-estimate charge latches both accounts, survives config-off and does not repeat', async p => {
  const owner = await reserve(p); trial = null;
  await tx(s => ledger.settle(p, owner, { charge: 150 }, s));
  for (const id of [String(familyId), 'experiment']) expect(await M.Account.findById(id).lean()).toMatchObject({
    outstandingMicros: 0, settledMicros: 150, halted: true, haltReason: 'estimate_exceeded' });
  expect(await ledger.view(p, owner)).toMatchObject({ estimatedReservationMicros: 100, usagePricedMicros: 150,
    chargeStatus: 'usage_priced', sendBlocked: true, sendBlockReason: 'estimate_exceeded' });
  const before = await snapshot();
  await expect(tx(s => ledger.settle(p, owner, { charge: 150 }, s))).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
  expect(await snapshot()).toBe(before);
});
test.each(['settle', 'markUnknown'])('%s retains unknown occupancy; cross-family halt is generic and later evidence cannot unlock', async method => {
  const other = await reserve('ai3', oid()), owner = await reserve();
  await tx(s => method === 'settle' ? ledger.settle('ai1', owner, { charge: null }, s) : ledger.markUnknown('ai1', owner, s));
  expect(await M.Account.findById('experiment').lean()).toMatchObject({ outstandingMicros: 200, settledMicros: 0, halted: true });
  expect(await ledger.view('ai1', owner)).toMatchObject({ state: 'reserved_unknown', usagePricedMicros: null,
    chargeStatus: 'unknown', sendBlockReason: 'cost_unknown' });
  expect(await ledger.view('ai3', other)).toMatchObject({ sendBlocked: true, sendBlockReason: 'cost_review_required' });
  await expect(reserve()).rejects.toMatchObject({ code: 'AI_COST_REVIEW_REQUIRED' });
  await expect(tx(s => claim('ai3', other, s))).rejects.toMatchObject({ code: 'AI_COST_REVIEW_REQUIRED' });
  await tx(s => ledger.settle('ai1', owner, { charge: 0 }, s));
  expect(await M.Account.findById('experiment').lean()).toMatchObject({ outstandingMicros: 100, settledMicros: 0, halted: true });
});
test.each(['reserved_unknown', 'owner_unknown'])('legacy %s without halted flag blocks a new trial globally', async kind => {
  trial = null; const old = await reserve('ai1', oid(), false);
  if (kind === 'reserved_unknown') await M.Reservation.updateOne({ _id: old.reservationId }, { $set: { state: kind } });
  else await M.Job.updateOne({ _id: old._id }, { $set: { status: 'unknown' } });
  trial = { authorizationVersion: 'synthetic-trial-1', maxSubmissions: 3 };
  const before = await snapshot(); await expect(reserve('ai3')).rejects.toMatchObject({ code: 'AI_COST_REVIEW_REQUIRED' });
  expect(await snapshot()).toBe(before);
});
test.each(['ownerProof', 'reservationProof', 'preview', 'amount', 'profile', 'accountProof'])('invalid v2 %s cannot claim or settle', async kind => {
  const owner = await reserve('ai3');
  if (kind === 'ownerProof') await A3.Command.collection.updateOne({ _id: owner._id }, { $unset: { 'generation.trialAuthorizationVersion': '' } });
  if (kind === 'preview') await A3.Command.collection.updateOne({ _id: owner._id }, { $set: { 'generation.preview.estimatedReservationMicros': 99 } });
  if (kind === 'amount') await A3.Command.collection.updateOne({ _id: owner._id }, { $set: { 'generation.estimatedReservationMicros': 99 } });
  if (kind === 'reservationProof') await M.Reservation.collection.updateOne({ _id: owner.generation.reservationId }, { $unset: { trialAuthorizationVersion: '' } });
  if (kind === 'profile') await M.Reservation.collection.updateOne({ _id: owner.generation.reservationId }, { $set: { ownerProfile: 'future' } });
  if (kind === 'accountProof') await M.Account.collection.updateOne({ _id: 'experiment' }, { $set: { trialAuthorizationVersion: 'wrong' } });
  const fresh = await A3.Command.findById(owner._id).lean(), before = await snapshot();
  await expect(tx(s => claim('ai3', fresh, s))).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
  await expect(tx(s => ledger.settle('ai3', fresh, { charge: 80 }, s))).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
  expect(await snapshot()).toBe(before);
});
test('reserve verifies its estimate against the supplied preview before consuming a submission', async () => {
  await expect(tx(s => ledger.reserve(access(), childId, oid(), oid(), 99, s, 'ai1', preview())))
    .rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
  expect(await M.Account.countDocuments()).toBe(0);
});
test('halt and settlement roll back atomically and claim writes a shared revision barrier', async () => {
  const owner = await reserve('ai3'), other = await reserve(); const before = await snapshot();
  await expect(tx(async s => { await ledger.settle('ai3', owner, { charge: 150 }, s); throw new Error('after settlement'); }))
    .rejects.toThrow('after settlement');
  expect(await snapshot()).toBe(before);
  const revision = (await M.Account.findById('experiment')).revision;
  await tx(s => claim('ai1', other, s));
  expect((await M.Account.findById('experiment')).revision).toBeGreaterThan(revision);
});
test('concurrent final submissions consume exactly three durable owner-bound slots', async () => {
  await reserve(); await reserve('ai3');
  const results = await Promise.allSettled([reserve(), reserve('ai3')]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.find(r => r.status === 'rejected').reason.code).toBe('AI_TRIAL_LIMIT_REACHED');
  expect(await M.Reservation.countDocuments()).toBe(3);
  expect(await M.Account.findById('experiment').lean()).toMatchObject({ trialUsedSubmissions: 3, outstandingMicros: 300 });
});
test('compatibility guard precedes stale release and does not reject the third allocated owner', async () => {
  trial = null; const old = await reserve('ai1', familyId, false);
  trial = { authorizationVersion: 'synthetic-trial-1', maxSubmissions: 3 };
  await expect(tx(s => ledger.assertClaimCompatible('ai1', old, s))).rejects.toMatchObject({ code: 'AI_PROFILE_UNAVAILABLE' });
  await reserve(); await reserve('ai3'); const third = await reserve();
  await tx(s => ledger.assertClaimCompatible('ai1', third, s));
  expect(await M.Account.findById('experiment').lean()).toMatchObject({ trialUsedSubmissions: 3 });
});
test('markUnknown repairs an already UNKNOWN owner idempotently, halt preserves terminal accounting', async () => {
  const owner = await reserve();
  await M.Job.updateOne({ _id: owner._id }, { $set: { status: 'unknown' } });
  await M.Reservation.updateOne({ _id: owner.reservationId }, { $set: { state: 'reserved_unknown' } });
  await tx(s => ledger.markUnknown('ai1', owner, s));
  await tx(s => ledger.markUnknown('ai1', owner, s));
  expect(await M.Account.findById('experiment').lean()).toMatchObject({ halted: true, outstandingMicros: 100, settledMicros: 0 });
  await tx(s => ledger.settle('ai1', owner, { charge: 80 }, s));
  const paid = await M.Reservation.findById(owner.reservationId).lean();
  const revision = (await M.Account.findById('experiment')).revision;
  await tx(s => ledger.halt('ai1', owner, s));
  expect(await M.Reservation.findById(owner.reservationId).lean()).toEqual(paid);
  expect(await M.Account.findById('experiment').lean()).toMatchObject({ halted: true, outstandingMicros: 0, settledMicros: 80, revision: revision + 1 });
});
test('a claim snapshot taken before another transaction halts cannot commit', async () => {
  const first = await reserve(), next = await reserve('ai3');
  await M.Slot.create({ _id: 'global', jobId: null });
  const session = await mongoose.startSession();
  try {
    session.startTransaction({ readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    await M.Account.findById('experiment').session(session).lean();
    await tx(s => ledger.settle('ai1', first, { charge: 150 }, s));
    await expect(claim('ai3', next, session)).rejects.toMatchObject({ code: 112 });
    await session.abortTransaction();
  } finally { await session.endSession(); }
  expect((await M.Slot.findById('global')).jobId).toBeNull();
  expect((await A3.Command.findById(next._id)).phase).toBe('RESERVED');
  await expect(tx(s => claim('ai3', next, s))).rejects.toMatchObject({ code: 'AI_COST_REVIEW_REQUIRED' });
});
test('v2 view reports subsequent budget admission, never rewrites the original reservation', async () => {
  const owner = await reserve(); limits.dayMicros = 150;
  const before = await snapshot();
  expect(await ledger.view('ai1', owner)).toMatchObject({ sendBlocked: true, sendBlockReason: 'budget_exceeded' });
  expect(await snapshot()).toBe(before);
  limits.singleMicros = 99;
  await expect(tx(s => claim('ai1', owner, s))).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
});
test.each(['resetCount', 'missingExperiment', 'missingMode'])('damaged durable trial %s cannot mint another submission or claim', async kind => {
  const owner = await reserve();
  if (kind === 'resetCount') await M.Account.collection.updateOne({ _id: 'experiment' }, { $set: { trialUsedSubmissions: 0 } });
  if (kind === 'missingExperiment') await M.Account.deleteOne({ _id: 'experiment' });
  if (kind === 'missingMode') await M.Reservation.collection.updateOne({ _id: owner.reservationId }, { $unset: { feeMode: '' } });
  const before = await snapshot();
  await expect(reserve('ai3')).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
  await expect(tx(s => claim('ai1', owner, s))).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
  expect(await snapshot()).toBe(before);
});
test('historical over-estimate without halt flags is not allowed to admit another trial', async () => {
  const owner = await reserve(); await tx(s => ledger.settle('ai1', owner, { charge: 150 }, s));
  await M.Account.updateMany({}, { $set: { halted: false }, $unset: { haltReason: '' } });
  const before = await snapshot();
  await expect(reserve('ai3', oid())).rejects.toMatchObject({ code: 'AI_COST_REVIEW_REQUIRED' });
  expect(await ledger.view('ai1', owner)).toMatchObject({ sendBlocked: true, sendBlockReason: 'estimate_exceeded' });
  expect(await snapshot()).toBe(before);
});
test.each([undefined, -1, 0.5, '80', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('invalid charge %p never releases or accounts a reservation', async charge => {
  const owner = await reserve(); const before = await snapshot();
  await expect(tx(s => ledger.settle('ai1', owner, { charge }, s))).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
  expect(await snapshot()).toBe(before);
});
test('duplicate reserve rolls back its quota write; same ID with wrong profile cannot settle', async () => {
  const owner = await reserve(); const before = await snapshot();
  await expect(tx(s => ledger.reserve(access(), childId, owner._id, oid(), 100, s, 'ai1', owner.preview)))
    .rejects.toMatchObject({ code: 11000 });
  await expect(tx(s => ledger.settle('ai3', { ...owner, endpointOperation: 'ai3.generate', generation: {
    reservationId: owner.reservationId, preview: owner.preview, feeMode: 'estimate_only', estimatedReservationMicros: 100,
    trialAuthorizationVersion: owner.trialAuthorizationVersion } }, { charge: 80 }, s))).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
  expect(await snapshot()).toBe(before);
});
test('valid charge after trial is disabled settles without current limits and never initializes a fresh quota', async () => {
  const owner = await reserve('ai3'); trial = null; limits = null; rebuild();
  await tx(s => ledger.settle('ai3', owner, { charge: 100 }, s));
  expect(await ledger.view('ai3', owner)).toMatchObject({ usagePricedMicros: 100, chargeStatus: 'usage_priced' });
  expect(await M.Account.findById('experiment').lean()).toMatchObject({ trialUsedSubmissions: 1, settledMicros: 100 });
});

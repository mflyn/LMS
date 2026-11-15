const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const M = require('../../models/Ai1');
const A3 = require('../../models/Ai3');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { createAi1Service } = require('../../services/ai1Service');
const { createAiGenerationBudget, assertAiBudgetOwners } = require('../../services/aiGenerationBudget');
const oid = () => new mongoose.Types.ObjectId();
const tx = work => runMongoTransaction({ mongooseInstance: mongoose, work });
let family, child, parent, clock, limits, ledger, ai1;
const command = () => ({ schemaVersion: 'ai1-min-v1', operationId: randomUUID() });
beforeAll(async () => { for (const m of [...Object.values(M), ...Object.values(A3), Family, User]) await m.init(); });
beforeEach(async () => {
  clock = Date.parse('2026-11-30T23:59:00Z'); child = oid(); parent = { id: String(oid()), role: 'parent' };
  family = await Family.create({ familyName: 'Synthetic shared budget', ownerParentId: parent.id,
    memberParentIds: [parent.id], childIds: [child], timezone: 'UTC' });
  await User.collection.insertMany([{ _id: new mongoose.Types.ObjectId(parent.id), role: 'parent', username: parent.id },
    { _id: child, familyId: family._id, role: 'student', username: String(child) }]);
  limits = { singleMicros: 184320, dayMicros: 368640, monthMicros: 368640, experimentMicros: 737280 };
  ledger = createAiGenerationBudget({ now: () => clock, getLimits: () => limits });
  const profile = { model: 'synthetic-no-provider', modelProfileVersion: 'synthetic-model-1', pricingProfileVersion: 'synthetic-price-1',
    inputPriceMicrosPerMillion: 9000000, outputPriceMicrosPerMillion: 27000000,
    checkedAt: '2026-11-01T00:00:00.000Z', expiresAt: '2026-12-31T00:00:00.000Z', callWindowMs: 60000, clockMarginMs: 5000 };
  ai1 = createAi1Service({ now: () => clock, getProfile: () => profile, getLimits: () => limits,
    getRuntime: () => ({ enabled: true, continuousStore: true }), sourceReader: { require: async q => ({
      id: q.sourceTaskId, familyId: String(family._id), childId: String(child), subject: 'math' }) } });
});
async function ai1Cycle() {
  return ai1.create({ identity: parent, body: { ...command(), childId: String(child), source: { type: 'task', id: String(oid()) },
    input: { questionText: '124 * 23', answerText: null, parentContext: '' },
    chapter: { provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper', textbookLabel: 'Synthetic',
      chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' }, deidentifiedConfirmed: true } });
}
const generateAi1 = c => ai1.generate({ identity: parent, cycleId: c.cycle.id, body: { ...command(), expectedCycleStateVersion: c.cycle.stateVersion,
  generationInputHash: c.preview.generationInputHash, modelProfileVersion: c.preview.modelProfileVersion,
  pricingProfileVersion: c.preview.pricingProfileVersion, maxAuthorizedCostMicros: 184320, externalSendConfirmed: true } });
// Internal ledger consumer fixture, not an implemented public AI3 generate or Provider path.
async function reserveAi3(session, seed = { id: oid(), reservationId: oid(), operationId: randomUUID() }) {
  const { id, reservationId, operationId } = seed;
  await ledger.reserve({ familyId: family._id, family }, child, id, reservationId, 184320, session, 'ai3');
  const [c] = await A3.Command.create([{ _id: id, familyId: family._id, childId: child, roundId: oid(), actorId: parent.id,
    endpointOperation: 'ai3.generate', operationId, requestHash: 'a'.repeat(64), payload: { synthetic: true },
    phase: 'RESERVED', resultReference: { synthetic: true }, generation: { reservationId, reservedCeilingMicros: 184320 } }], { session });
  return c.toObject();
}
async function claimAi3(c) {
  return tx(async session => {
    const current = await A3.Command.findById(c._id).session(session).lean();
    if (current.phase !== 'RESERVED') throw new Error('Fixture cannot reclaim');
    await ledger.budgetState({ familyId: family._id, family }, 0, session, 184320);
    await ledger.claimSlot('ai3', current, session);
    await A3.Command.updateOne({ _id: c._id, phase: 'RESERVED' }, { $set: { phase: 'DISPATCHING' } }, { session });
  });
}
async function settleAi3(c, session) {
  const r = await ledger.reservation('ai3', c, session);
  await ledger.adjust(await ledger.account(String(family._id), session), -r.reservedMicros, 100, session);
  await ledger.adjust(await ledger.account('experiment', session), -r.reservedMicros, 100, session);
  await M.Reservation.updateOne({ _id: r._id }, { $set: { state: 'settled', settledMicros: 100, settledAt: new Date(clock) } }, { session });
  await A3.Command.updateOne({ _id: c._id }, { $set: { phase: 'SUCCEEDED' } }, { session });
  await ledger.releaseSlot('ai3', c, session);
}
const snapshot = async () => JSON.stringify(await Promise.all([M.Account, M.Reservation, M.Slot, M.Job, A3.Command]
  .map(m => m.find().sort({ _id: 1 }).lean())));

test('AI1 and AI3 race for the same final allowance, with one reservation and unchanged loser', async () => {
  limits.dayMicros = 184320; const c = await ai1Cycle();
  // Existing counters avoid testing first-upsert Mongo behavior instead of budget CAS.
  await tx(async session => { await ledger.account(String(family._id), session); await ledger.account('experiment', session); });
  const result = await Promise.allSettled([generateAi1(c), tx(reserveAi3)]);
  expect(result.filter(x => x.status === 'fulfilled')).toHaveLength(1);
  expect(result.find(x => x.status === 'rejected').reason.code).toBe('AI_BUDGET_EXCEEDED');
  expect(await M.Reservation.countDocuments()).toBe(1);
  expect(await M.Job.countDocuments() + await A3.Command.countDocuments()).toBe(1);
  expect((await M.Account.findById(String(family._id))).outstandingMicros).toBe(184320);
  expect((await M.Account.findById('experiment')).outstandingMicros).toBe(184320);
});
test('both profiles contend for one global slot; losing claim preserves reserved state', async () => {
  const one = await generateAi1(await ai1Cycle()), three = await tx(reserveAi3);
  await M.Slot.create({ _id: 'global', jobId: null });
  const result = await Promise.allSettled([ai1.claim({ identity: parent, jobId: one.job.id }), claimAi3(three)]);
  expect(result.filter(x => x.status === 'fulfilled')).toHaveLength(1);
  expect(result.find(x => x.status === 'rejected').reason.code).toBe('AI_OPERATION_UNRESOLVED');
  const slot = await M.Slot.findById('global').lean();
  const firstWon = result[0].status === 'fulfilled';
  expect(slot.ownerProfile).toBe(firstWon ? 'ai1' : 'ai3');
  expect(String(slot.jobId)).toBe(firstWon ? one.job.id : String(three._id));
  expect((await M.Job.findById(one.job.id)).status).toBe(firstWon ? 'dispatching' : 'reserved');
  expect((await A3.Command.findById(three._id)).phase).toBe(firstWon ? 'RESERVED' : 'DISPATCHING');
  await assertAiBudgetOwners();
});
test('cold counter and slot contention is atomic; a duplicate upsert retries only the same local owner', async () => {
  const cycle = await ai1Cycle(), seed = { id: oid(), reservationId: oid(), operationId: randomUUID() };
  expect(await M.Account.countDocuments()).toBe(0); expect(await M.Slot.countDocuments()).toBe(0);
  const results = await Promise.allSettled([generateAi1(cycle), tx(s => reserveAi3(s, seed))]);
  expect(results[0].status).toBe('fulfilled');
  let three;
  if (results[1].status === 'rejected') {
    expect(results[1].reason.code).toBe(11000);
    expect(await M.Reservation.countDocuments({ _id: seed.reservationId })).toBe(0);
    expect(await A3.Command.countDocuments({ _id: seed.id })).toBe(0);
    three = await tx(s => reserveAi3(s, seed));
  } else three = results[1].value;
  expect(String(three._id)).toBe(String(seed.id)); expect(three.operationId).toBe(seed.operationId);
  expect(await M.Reservation.countDocuments()).toBe(2);
  expect(await M.Account.findById(String(family._id))).toMatchObject({ outstandingMicros: 368640, settledMicros: 0 });
  const one = results[0].value;
  const claims = await Promise.allSettled([ai1.claim({ identity: parent, jobId: one.job.id }), claimAi3(three)]);
  expect(claims.filter(x => x.status === 'fulfilled')).toHaveLength(1);
  const failed = claims.findIndex(x => x.status === 'rejected');
  expect(['AI_OPERATION_UNRESOLVED', 11000]).toContain(claims[failed].reason.code);
  const before = await snapshot();
  await expect(failed === 0 ? ai1.claim({ identity: parent, jobId: one.job.id }) : claimAi3(three))
    .rejects.toMatchObject({ code: 'AI_OPERATION_UNRESOLVED' });
  expect(await snapshot()).toBe(before); await assertAiBudgetOwners();
});
test('legacy missing profile is AI1 and can settle; it is never guessed as AI3', async () => {
  const g = await generateAi1(await ai1Cycle()); await ai1.claim({ identity: parent, jobId: g.job.id });
  await M.Reservation.collection.updateOne({ jobId: new mongoose.Types.ObjectId(g.job.id) }, { $unset: { ownerProfile: '' } });
  await M.Slot.collection.updateOne({ _id: 'global' }, { $unset: { ownerProfile: '' } });
  await assertAiBudgetOwners();
  const j = await M.Job.findById(g.job.id).lean();
  await ai1.applyOutcome({ jobId: g.job.id, evidence: { remoteOperationId: j.remoteOperationId,
    generationInputHash: j.preview.generationInputHash, modelProfileVersion: j.preview.modelProfileVersion,
    pricingProfileVersion: j.preview.pricingProfileVersion, sendNotAfter: j.sendNotAfter.toISOString(), status: 'succeeded',
    text: 'Synthetic parent draft', usage: { inputTokens: 100, outputTokens: 50 } } });
  expect((await M.Account.findById(String(family._id)))).toMatchObject({ outstandingMicros: 0, settledMicros: 2250 });
  expect((await M.Slot.findById('global')).jobId).toBeNull();
  await assertAiBudgetOwners();
  const c = await tx(reserveAi3);
  await M.Reservation.collection.updateOne({ _id: c.generation.reservationId }, { $unset: { ownerProfile: '' } });
  const before = await snapshot(); await expect(assertAiBudgetOwners()).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
  expect(await snapshot()).toBe(before);
});
test('unknown AI3 occupancy survives day/month rollover, lease absence and reconstruction', async () => {
  const c = await tx(reserveAi3); await claimAi3(c);
  await tx(async session => {
    await A3.Command.updateOne({ _id: c._id }, { $set: { phase: 'UNKNOWN' } }, { session });
    await M.Reservation.updateOne({ _id: c.generation.reservationId }, { $set: { state: 'reserved_unknown' } }, { session });
  });
  clock = Date.parse('2026-12-01T00:01:00Z'); limits.dayMicros = 184320;
  ledger = createAiGenerationBudget({ now: () => clock, getLimits: () => limits });
  const before = await snapshot(); await assertAiBudgetOwners(); expect(await snapshot()).toBe(before);
  await expect(generateAi1(await ai1Cycle())).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
  expect((await M.Account.findById(String(family._id))).outstandingMicros).toBe(184320);
  expect((await M.Reservation.findById(c.generation.reservationId))).toMatchObject({ state: 'reserved_unknown', reservedMonth: '2026-11' });
  expect(String((await M.Slot.findById('global')).jobId)).toBe(String(c._id));
});
test.each(['unknown', 'null', 'crossChild', 'wrongOwner', 'wrongAmount', 'notGenerate'])('invalid persisted reservation %s isolates without repair', async kind => {
  const c = await tx(reserveAi3);
  if (kind === 'notGenerate') await A3.Command.collection.updateOne({ _id: c._id }, { $set: { endpointOperation: 'ai3.publish' } });
  else await M.Reservation.collection.updateOne({ _id: c.generation.reservationId }, { $set:
    kind === 'unknown' ? { ownerProfile: 'future' } : kind === 'null' ? { ownerProfile: null }
      : kind === 'crossChild' ? { childId: oid() } : kind === 'wrongOwner' ? { jobId: oid() } : { reservedMicros: 1 } });
  const before = await snapshot();
  await expect(assertAiBudgetOwners()).rejects.toMatchObject({ statusCode: 503, code: 'AI_STORE_ISOLATED' });
  await expect(generateAi1(await ai1Cycle())).rejects.toMatchObject({ statusCode: 503, code: 'AI_STORE_ISOLATED' });
  expect(await snapshot()).toBe(before);
});
test('same ID with a different profile cannot release or reuse the other slot', async () => {
  const c = await tx(reserveAi3); await claimAi3(c); const before = await snapshot();
  await expect(tx(s => ledger.releaseSlot('ai1', { ...c, reservationId: c.generation.reservationId,
    preview: { reservedCeilingMicros: 184320 } }, s))).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
  expect(await snapshot()).toBe(before);
});
test('legal AI3 slot survives another expired AI1 release, then releases only its own settled slot', async () => {
  const one = await generateAi1(await ai1Cycle()), three = await tx(reserveAi3);
  await claimAi3(three); const originalSlot = await M.Slot.findById('global').lean();
  const deadline = (await M.Job.findById(one.job.id)).sendNotAfter.getTime();
  expect(clock).toBeLessThan(deadline); clock = deadline;
  const expired = await ai1.claim({ identity: parent, jobId: one.job.id });
  expect(expired).toMatchObject({ claimed: false, job: { status: 'failed', budget: { state: 'released' } } });
  expect(await M.Slot.findById('global').lean()).toEqual(originalSlot);
  expect((await M.Account.findById(String(family._id))).outstandingMicros).toBe(184320);
  await tx(s => settleAi3(three, s));
  const slot = await M.Slot.findById('global').lean();
  expect(slot.jobId).toBeNull(); expect(Object.hasOwn(slot, 'ownerProfile')).toBe(false);
  expect(await M.Account.findById(String(family._id))).toMatchObject({ outstandingMicros: 0, settledMicros: 100 });
  expect(await M.Account.findById('experiment')).toMatchObject({ outstandingMicros: 0, settledMicros: 100 });
  await assertAiBudgetOwners();
});
test('claim and release failures after slot writes roll back owner, slot and accounts together', async () => {
  const c = await tx(reserveAi3), reserved = await snapshot();
  await expect(tx(async s => {
    await ledger.claimSlot('ai3', c, s);
    await A3.Command.updateOne({ _id: c._id }, { $set: { phase: 'DISPATCHING' } }, { session: s });
    throw new Error('after claim');
  })).rejects.toThrow('after claim');
  expect(await snapshot()).toBe(reserved);
  await claimAi3(c); const claimed = await snapshot();
  await expect(tx(async s => { await settleAi3(c, s); throw new Error('after release'); })).rejects.toThrow('after release');
  expect(await snapshot()).toBe(claimed);
  await assertAiBudgetOwners();
});
test('matching reservation cannot release a slot whose identical ID has a conflicting profile', async () => {
  const c = await tx(reserveAi3); await claimAi3(c);
  await M.Slot.collection.updateOne({ _id: 'global' }, { $set: { ownerProfile: 'ai1' } });
  const before = await snapshot();
  await expect(tx(s => ledger.releaseSlot('ai3', c, s))).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
  expect(await snapshot()).toBe(before);
});
test('reservation and owner rollback together; duplicate ID cannot create a second budget pool', async () => {
  await expect(tx(async s => { await reserveAi3(s); throw new Error('rollback'); })).rejects.toThrow('rollback');
  for (const m of [M.Account, M.Reservation, A3.Command]) expect(await m.countDocuments()).toBe(0);
  const c = await tx(reserveAi3), before = await snapshot();
  await expect(tx(s => ledger.reserve({ familyId: family._id, family }, child, c._id, oid(), 184320, s, 'ai1'))).rejects.toMatchObject({ code: 11000 });
  expect(await snapshot()).toBe(before);
});
test('unknown slot profile or dangling owner stops claims; readonly preflight never releases it', async () => {
  const g = await generateAi1(await ai1Cycle());
  for (const fields of [{ jobId: oid(), ownerProfile: 'future' }, { jobId: oid(), ownerProfile: 'ai3' }, { jobId: null, ownerProfile: 'ai3' }]) {
    await M.Slot.collection.updateOne({ _id: 'global' }, { $set: fields }, { upsert: true });
    const before = await snapshot();
    await expect(assertAiBudgetOwners()).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
    await expect(ai1.claim({ identity: parent, jobId: g.job.id })).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
    expect(await snapshot()).toBe(before);
  }
});
test('missing transaction and unknown new profile cannot create a reservation', async () => {
  await expect(ledger.reserve({ familyId: family._id, family }, child, oid(), oid(), 184320, null, 'ai3')).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
  await expect(tx(s => ledger.reserve({ familyId: family._id, family }, child, oid(), oid(), 184320, s, 'future'))).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED' });
  expect(await M.Account.countDocuments()).toBe(0); expect(await M.Reservation.countDocuments()).toBe(0);
});
test.each(['read', 'close'])('owner preflight %s failure closes its cursor and returns only sanitized error', async failure => {
  const before = await snapshot(); let closed = false;
  const cursor = { async *[Symbol.asyncIterator]() { if (failure === 'read') throw new Error('SYNTHETIC_PRIVATE_DB_MARKER'); },
    close: async () => { closed = true; if (failure === 'close') throw new Error('SYNTHETIC_PRIVATE_DB_MARKER'); } };
  const spy = jest.spyOn(M.Reservation, 'find').mockReturnValue({ lean: () => ({ cursor: () => cursor }) });
  try {
    await expect(assertAiBudgetOwners()).rejects.toMatchObject({ code: 'AI_STORE_ISOLATED', message: 'AI_STORE_ISOLATED', details: [] });
    expect(closed).toBe(true);
  } finally { spy.mockRestore(); }
  expect(await snapshot()).toBe(before);
});

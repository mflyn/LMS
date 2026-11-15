const M = require('../models/Ai1');
const C = require('./ai1Contract');
const { formatLocalDate } = require('../../../common/utils/familyDate');
const isolated = () => C.error(503, 'AI_STORE_ISOLATED');
const same = (a, b) => a != null && b != null && String(a) === String(b);
const isObjectId = value => value?._bsontype === 'ObjectId';
const profile = value => { if (!['ai1', 'ai3'].includes(value)) throw isolated(); return value; };
const storedProfile = row => Object.hasOwn(row, 'ownerProfile') ? profile(row.ownerProfile) : 'ai1';
const inTransaction = session => { if (!session?.inTransaction()) throw isolated(); };
const ownerFields = (p, owner) => p === 'ai1'
  ? { reservationId: owner.reservationId, amount: owner.preview?.reservedCeilingMicros }
  : { reservationId: owner.generation?.reservationId, amount: owner.generation?.reservedCeilingMicros };

function validateReservation(p, owner, r) {
  profile(p);
  const fields = ownerFields(p, owner);
  if (!r || storedProfile(r) !== p || ![r._id, r.jobId, r.familyId, r.childId].every(isObjectId)
    || !same(r._id, fields.reservationId) || !same(r.jobId, owner._id)
    || !same(r.familyId, owner.familyId) || !same(r.childId, owner.childId)
    || !C.integer(r.reservedMicros) || r.reservedMicros !== fields.amount
    || (p === 'ai3' && owner.endpointOperation !== 'ai3.generate')) throw isolated();
  return r;
}
async function reservation(p, owner, session = null) {
  profile(p);
  const fields = ownerFields(p, owner);
  if (!isObjectId(fields.reservationId)) throw isolated();
  return validateReservation(p, owner, await M.Reservation.findById(fields.reservationId).session(session).lean());
}
async function resolveOwner(r, session = null) {
  const p = storedProfile(r);
  if (!isObjectId(r.jobId)) throw isolated();
  // Same homework database, closed two-owner dispatch. Raw AI3 read avoids model auto-init on an AI1-only startup.
  const owner = p === 'ai1' ? await M.Job.findById(r.jobId).session(session).lean()
    : await M.Reservation.db.collection('ai3commands').findOne({ _id: r.jobId }, { session });
  if (!owner) throw isolated();
  validateReservation(p, owner, r);
  return { profile: p, owner };
}
async function validateSlot(slot, session = null) {
  if (!slot) return;
  if (slot._id !== 'global') throw isolated();
  if (slot.jobId == null) { if (Object.hasOwn(slot, 'ownerProfile')) throw isolated(); return; }
  const p = storedProfile(slot);
  if (!isObjectId(slot.jobId)) throw isolated();
  const r = await M.Reservation.findOne({ jobId: slot.jobId }).session(session).lean();
  if (!r || storedProfile(r) !== p || !['reserved', 'reserved_unknown'].includes(r.state)) throw isolated();
  const { owner } = await resolveOwner(r, session);
  const phase = p === 'ai1' ? owner.status : owner.phase;
  if (!(p === 'ai1' ? ['dispatching', 'unknown'] : ['DISPATCHING', 'UNKNOWN']).includes(phase)) throw isolated();
}
async function assertAiBudgetOwners() {
  try {
    const cursor = M.Reservation.find().lean().cursor();
    try {
      for await (const r of cursor) await resolveOwner(r);
      await validateSlot(await M.Slot.findById('global').lean());
    } finally { await cursor.close(); }
  } catch (_) { throw isolated(); }
}

// Internal transactional primitives only. Callers own authorization, quote/claim proof and owner state CAS.
// These functions never send, retry a Provider, expire unknown charges or repair stored data.
function createAiGenerationBudget({ now = Date.now, getLimits = () => null } = {}) {
  const account = async (key, session) => {
    inTransaction(session);
    return M.Account.findOneAndUpdate({ _id: key }, { $setOnInsert: {
      outstandingMicros: 0, settledMicros: 0, revision: 0, halted: false } }, { upsert: true, new: true, session }).lean();
  };
  const adjust = async (a, outstandingDelta, settledDelta, session) => {
    inTransaction(session);
    if (![a.outstandingMicros + outstandingDelta, a.settledMicros + settledDelta].every(C.integer)) throw isolated();
    const result = await M.Account.updateOne({ _id: a._id, revision: a.revision },
      { $inc: { outstandingMicros: outstandingDelta, settledMicros: settledDelta, revision: 1 } }, { session });
    if (result.matchedCount !== 1) throw C.error(409, 'AI_VERSION_CONFLICT');
  };
  const budgetState = async (access, amount, session, singleAmount = amount) => {
    inTransaction(session);
    if (!C.integer(amount) || !C.integer(singleAmount)) throw isolated();
    const limits = getLimits();
    if (!limits || !['singleMicros', 'dayMicros', 'monthMicros', 'experimentMicros'].every(k => C.integer(limits[k]))) throw C.error(503, 'AI_PROFILE_UNAVAILABLE');
    const a = await account(String(access.familyId), session), experiment = await account('experiment', session);
    if (a.halted || experiment.halted) throw isolated();
    const date = new Date(Number(now())), timezone = access.family.timezone;
    const day = formatLocalDate(date, timezone), month = day.slice(0, 7);
    const rows = await M.Reservation.find({ familyId: access.familyId }).session(session).lean();
    let daily = 0n, monthly = 0n;
    for (const r of rows) {
      await resolveOwner(r, session);
      if (r.state !== 'settled') continue;
      if (!C.integer(r.settledMicros)) throw isolated();
      const d = formatLocalDate(r.settledAt, timezone);
      if (d === day) daily += BigInt(r.settledMicros);
      if (d.slice(0, 7) === month) monthly += BigInt(r.settledMicros);
    }
    const pending = BigInt(a.outstandingMicros) + BigInt(amount);
    if (singleAmount > limits.singleMicros || daily + pending > BigInt(limits.dayMicros) || monthly + pending > BigInt(limits.monthMicros)
      || BigInt(experiment.settledMicros) + BigInt(experiment.outstandingMicros) + BigInt(amount) > BigInt(limits.experimentMicros)) throw C.error(409, 'AI_BUDGET_EXCEEDED');
    return { a, experiment, day, month, timezone };
  };
  const reserve = async (access, childId, jobId, reservationId, amount, session, ownerProfile = 'ai1') => {
    inTransaction(session); profile(ownerProfile);
    const { a, experiment, day, month, timezone } = await budgetState(access, amount, session);
    await adjust(a, amount, 0, session); await adjust(experiment, amount, 0, session);
    await M.Reservation.create([{ _id: reservationId, familyId: access.familyId, childId, jobId, ownerProfile, reservedMicros: amount,
      state: 'reserved', reservedDay: day, reservedMonth: month, reservedTimezone: timezone }], { session });
  };
  const claimSlot = async (p, owner, session) => {
    inTransaction(session); await reservation(p, owner, session);
    const slot = await M.Slot.findOneAndUpdate({ _id: 'global' }, { $setOnInsert: { jobId: null } }, { upsert: true, new: true, session }).lean();
    await validateSlot(slot, session);
    if (slot.jobId) throw C.error(409, 'AI_OPERATION_UNRESOLVED');
    const result = await M.Slot.updateOne({ _id: 'global', jobId: null, ownerProfile: { $exists: false } },
      { $set: { jobId: owner._id, ownerProfile: p } }, { session });
    if (result.matchedCount !== 1) throw isolated();
  };
  const releaseSlot = async (p, owner, session) => {
    inTransaction(session); await reservation(p, owner, session);
    const slot = await M.Slot.findById('global').session(session).lean();
    if (!slot || !same(slot.jobId, owner._id)) { await validateSlot(slot, session); return; }
    if (storedProfile(slot) !== p) throw isolated();
    const result = await M.Slot.updateOne({ _id: 'global', jobId: owner._id,
      ...(Object.hasOwn(slot, 'ownerProfile') ? { ownerProfile: p } : { ownerProfile: { $exists: false } }) },
    { $set: { jobId: null }, $unset: { ownerProfile: '' } }, { session });
    if (result.matchedCount !== 1) throw isolated();
  };
  return { account, adjust, budgetState, reserve, reservation, claimSlot, releaseSlot };
}
module.exports = { createAiGenerationBudget, assertAiBudgetOwners };

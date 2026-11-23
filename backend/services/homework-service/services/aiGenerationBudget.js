const M = require('../models/Ai1');
const C = require('./ai1Contract');
const { formatLocalDate } = require('../../../common/utils/familyDate');
const isolated = () => C.error(503, 'AI_STORE_ISOLATED');
const same = (a, b) => a != null && b != null && String(a) === String(b);
const isObjectId = value => value?._bsontype === 'ObjectId';
const profile = value => { if (!['ai1', 'ai3'].includes(value)) throw isolated(); return value; };
const storedProfile = row => Object.hasOwn(row, 'ownerProfile') ? profile(row.ownerProfile) : 'ai1';
const inTransaction = session => { if (!session?.inTransaction()) throw isolated(); };
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const estimate = value => value?.feeMode === 'estimate_only';
const costReview = () => C.error(409, 'AI_COST_REVIEW_REQUIRED');
const ownerFields = (p, owner) => {
  const source = p === 'ai1' ? owner : owner.generation;
  const preview = source?.preview;
  return { reservationId: source?.reservationId, preview, trialAuthorizationVersion: source?.trialAuthorizationVersion,
    amount: estimate(preview) ? preview.estimatedReservationMicros
      : p === 'ai1' ? preview?.reservedCeilingMicros : source?.reservedCeilingMicros };
};
function validateTrialAccount(a) {
  if (!a || !nonempty(a.trialAuthorizationVersion) || a.trialMaxSubmissions !== 3
    || !C.integer(a.trialUsedSubmissions) || a.trialUsedSubmissions > a.trialMaxSubmissions) throw isolated();
}
async function validateTrialProof(r, session) {
  if (!estimate(r)) return;
  const a = await M.Account.findById('experiment').session(session).lean();
  validateTrialAccount(a);
  if (a.trialUsedSubmissions < 1 || a.trialAuthorizationVersion !== r.trialAuthorizationVersion) throw isolated();
}

function validateReservation(p, owner, r) {
  profile(p);
  const fields = ownerFields(p, owner);
  if (!r || storedProfile(r) !== p || ![r._id, r.jobId, r.familyId, r.childId].every(isObjectId)
    || !same(r._id, fields.reservationId) || !same(r.jobId, owner._id)
    || !same(r.familyId, owner.familyId) || !same(r.childId, owner.childId)
    || !C.integer(r.reservedMicros) || r.reservedMicros !== fields.amount
    || (p === 'ai3' && owner.endpointOperation !== 'ai3.generate')) throw isolated();
  if (estimate(fields.preview)) {
    if (!estimate(r) || !Object.hasOwn(r, 'ownerProfile') || !nonempty(r.trialAuthorizationVersion)
      || r.trialAuthorizationVersion !== fields.trialAuthorizationVersion
      || Object.hasOwn(fields.preview, 'reservedCeilingMicros')
      || (p === 'ai3' && (!estimate(owner.generation) || owner.generation.estimatedReservationMicros !== fields.amount))) throw isolated();
  } else if (Object.hasOwn(r, 'feeMode') || Object.hasOwn(r, 'trialAuthorizationVersion')
    || fields.preview?.feeMode != null || fields.trialAuthorizationVersion != null
    || (p === 'ai3' && owner.generation?.feeMode != null)) throw isolated();
  return r;
}
async function reservation(p, owner, session = null) {
  profile(p);
  const fields = ownerFields(p, owner);
  if (!isObjectId(fields.reservationId)) throw isolated();
  const r = validateReservation(p, owner, await M.Reservation.findById(fields.reservationId).session(session).lean());
  await resolveOwner(r, session);
  return r;
}
async function resolveOwner(r, session = null) {
  const p = storedProfile(r);
  if (!isObjectId(r.jobId)) throw isolated();
  // Same homework database, closed two-owner dispatch. Raw AI3 read avoids model auto-init on an AI1-only startup.
  const owner = p === 'ai1' ? await M.Job.findById(r.jobId).session(session).lean()
    : await M.Reservation.db.collection('ai3commands').findOne({ _id: r.jobId }, { session });
  if (!owner) throw isolated();
  validateReservation(p, owner, r);
  await validateTrialProof(r, session);
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
function createAiGenerationBudget({ now = Date.now, getLimits = () => null, getTrial = () => null } = {}) {
  const trialConfig = () => {
    const t = getTrial();
    if (!t || !nonempty(t.authorizationVersion) || t.maxSubmissions !== 3) throw C.error(503, 'AI_PROFILE_UNAVAILABLE');
    return t;
  };
  const account = async (key, session) => {
    inTransaction(session);
    return M.Account.findOneAndUpdate({ _id: key }, { $setOnInsert: {
      outstandingMicros: 0, settledMicros: 0, revision: 0, halted: false } }, { upsert: true, new: true, session }).lean();
  };
  const adjust = async (a, outstandingDelta, settledDelta, session) => {
    inTransaction(session);
    if (![a.outstandingMicros, a.settledMicros, a.revision].every(C.integer)
      || ![outstandingDelta, settledDelta].every(Number.isSafeInteger)
      || ![a.outstandingMicros + outstandingDelta, a.settledMicros + settledDelta, a.revision + 1].every(C.integer)) throw isolated();
    const result = await M.Account.updateOne({ _id: a._id, revision: a.revision },
      { $inc: { outstandingMicros: outstandingDelta, settledMicros: settledDelta, revision: 1 } }, { session });
    if (result.matchedCount !== 1) throw C.error(409, 'AI_VERSION_CONFLICT');
  };
  const inspect = async session => {
    const rows = await M.Reservation.find().session(session).lean();
    let unknown = false;
    const unknownFamilies = new Set();
    const exceededFamilies = new Set();
    for (const r of rows) {
      const { profile: p, owner } = await resolveOwner(r, session);
      if (r.state === 'reserved_unknown' || (p === 'ai1' ? owner.status === 'unknown' : owner.phase === 'UNKNOWN')) {
        unknown = true; unknownFamilies.add(String(r.familyId));
      }
      if (estimate(r) && r.state === 'settled') {
        if (!C.integer(r.settledMicros)) throw isolated();
        if (r.settledMicros > r.reservedMicros) exceededFamilies.add(String(r.familyId));
      }
    }
    const experiment = await M.Account.findById('experiment').session(session).lean();
    const trialRows = rows.filter(estimate);
    if (trialRows.length || experiment?.trialAuthorizationVersion != null || experiment?.trialUsedSubmissions != null
      || experiment?.trialMaxSubmissions != null) {
      validateTrialAccount(experiment);
      if (experiment.trialUsedSubmissions !== trialRows.length) throw isolated();
    }
    return { rows, experiment, unknown, unknownFamilies, exceededFamilies, trialActive: getTrial() != null || trialRows.length > 0 };
  };
  const checkCapacity = (access, amount, singleAmount, a, experiment, rows) => {
    if (!C.integer(amount) || !C.integer(singleAmount)) throw isolated();
    const limits = getLimits();
    if (!limits || !['singleMicros', 'dayMicros', 'monthMicros', 'experimentMicros'].every(k => C.integer(limits[k]))) throw C.error(503, 'AI_PROFILE_UNAVAILABLE');
    if (![a.outstandingMicros, a.settledMicros, experiment.outstandingMicros, experiment.settledMicros].every(C.integer)) throw isolated();
    const date = new Date(Number(now())), timezone = access.family.timezone;
    const day = formatLocalDate(date, timezone), month = day.slice(0, 7);
    let daily = 0n, monthly = 0n;
    for (const r of rows) {
      if (!same(r.familyId, access.familyId)) continue;
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
  const budgetState = async (access, amount, session, singleAmount = amount) => {
    inTransaction(session);
    const audit = await inspect(session);
    if (audit.trialActive && (audit.unknown || audit.exceededFamilies.size)) throw costReview();
    const a = await account(String(access.familyId), session), experiment = await account('experiment', session);
    if (a.halted || experiment.halted) throw audit.trialActive ? costReview() : isolated();
    return checkCapacity(access, amount, singleAmount, a, experiment, audit.rows);
  };
  const ownerAccess = async (owner, r, session) => {
    const family = await M.Reservation.db.collection('families').findOne({ _id: owner.familyId },
      { session, projection: { timezone: 1 } });
    return { familyId: owner.familyId, family: { timezone: family?.timezone || r.reservedTimezone } };
  };
  const reserve = async (access, childId, jobId, reservationId, amount, session, ownerProfile = 'ai1', preview = null) => {
    inTransaction(session); profile(ownerProfile);
    const v2 = estimate(preview);
    if (preview?.feeMode != null && !v2) throw isolated();
    if (v2 && (!C.integer(amount) || amount !== preview.estimatedReservationMicros
      || Object.hasOwn(preview, 'reservedCeilingMicros'))) throw isolated();
    const t = v2 ? trialConfig() : null;
    if (!v2 && getTrial() != null) throw C.error(503, 'AI_PROFILE_UNAVAILABLE');
    const { a, experiment, day, month, timezone } = await budgetState(access, amount, session);
    if (v2) {
      if (experiment.trialAuthorizationVersion != null) {
        validateTrialAccount(experiment);
        if (experiment.trialAuthorizationVersion !== t.authorizationVersion || experiment.trialMaxSubmissions !== t.maxSubmissions)
          throw C.error(503, 'AI_PROFILE_UNAVAILABLE');
      }
      if ((experiment.trialUsedSubmissions || 0) >= t.maxSubmissions) throw C.error(409, 'AI_TRIAL_LIMIT_REACHED');
    }
    await adjust(a, amount, 0, session); await adjust(experiment, amount, 0, session);
    if (v2) {
      const result = await M.Account.updateOne({ _id: 'experiment', revision: experiment.revision + 1 }, { $set: {
        trialAuthorizationVersion: t.authorizationVersion, trialMaxSubmissions: t.maxSubmissions,
        trialUsedSubmissions: (experiment.trialUsedSubmissions || 0) + 1 } }, { session });
      if (result.matchedCount !== 1) throw isolated();
    }
    await M.Reservation.create([{ _id: reservationId, familyId: access.familyId, childId, jobId, ownerProfile, reservedMicros: amount,
      ...(v2 ? { feeMode: 'estimate_only', trialAuthorizationVersion: t.authorizationVersion } : {}),
      state: 'reserved', reservedDay: day, reservedMonth: month, reservedTimezone: timezone }], { session });
    if (v2) return { trialAuthorizationVersion: t.authorizationVersion };
  };
  const assertClaimCompatible = async (p, owner, session) => {
    inTransaction(session); const r = await reservation(p, owner, session);
    if (estimate(r)) {
      const t = trialConfig();
      if (t.authorizationVersion !== r.trialAuthorizationVersion) throw C.error(503, 'AI_PROFILE_UNAVAILABLE');
    } else if (getTrial() != null) throw C.error(503, 'AI_PROFILE_UNAVAILABLE');
    return r;
  };
  const claimSlot = async (p, owner, session) => {
    const r = await assertClaimCompatible(p, owner, session);
    if (r.state !== 'reserved') throw isolated();
    const { experiment } = await budgetState(await ownerAccess(owner, r, session), 0, session, r.reservedMicros);
    const slot = await M.Slot.findOneAndUpdate({ _id: 'global' }, { $setOnInsert: { jobId: null } }, { upsert: true, new: true, session }).lean();
    await validateSlot(slot, session);
    if (slot.jobId) throw C.error(409, 'AI_OPERATION_UNRESOLVED');
    const result = await M.Slot.updateOne({ _id: 'global', jobId: null, ownerProfile: { $exists: false } },
      { $set: { jobId: owner._id, ownerProfile: p } }, { session });
    if (result.matchedCount !== 1) throw isolated();
    // Every final claim and every halt write this same account: stale snapshots cannot win after a halt.
    const barrier = await M.Account.updateOne({ _id: 'experiment', revision: experiment.revision, halted: false },
      { $inc: { revision: 1 } }, { session });
    if (barrier.matchedCount !== 1) throw C.error(409, 'AI_VERSION_CONFLICT');
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
  const latch = async (owner, reason, session) => {
    for (const key of [String(owner.familyId), 'experiment']) {
      const a = await account(key, session);
      if (!C.integer(a.revision + 1)) throw isolated();
      const result = await M.Account.updateOne({ _id: key, revision: a.revision }, {
        $set: { halted: true, haltReason: a.haltReason || reason }, $inc: { revision: 1 }
      }, { session });
      if (result.matchedCount !== 1) throw C.error(409, 'AI_VERSION_CONFLICT');
    }
  };
  const halt = async (p, owner, session) => {
    inTransaction(session); await reservation(p, owner, session);
    await latch(owner, 'cost_unknown', session);
  };
  const markUnknown = async (p, owner, session) => {
    inTransaction(session); const r = await reservation(p, owner, session);
    if (!['reserved', 'reserved_unknown'].includes(r.state)) throw isolated();
    const changed = await M.Reservation.updateOne({ _id: r._id, state: r.state },
      { $set: { state: 'reserved_unknown' } }, { session });
    if (changed.matchedCount !== 1) throw isolated();
    if (estimate(r) || getTrial() != null) await latch(owner, 'cost_unknown', session);
  };
  const settle = async (p, owner, { charge, release = false }, session) => {
    inTransaction(session); const r = await reservation(p, owner, session);
    if (!['reserved', 'reserved_unknown'].includes(r.state) || typeof release !== 'boolean'
      || (charge !== null && !C.integer(charge)) || (release && charge !== null && charge !== 0)
      || (!estimate(r) && charge > r.reservedMicros)) throw isolated();
    if (!release && charge === null) { await markUnknown(p, owner, session); return; }
    const paid = release ? 0 : charge;
    await adjust(await account(String(owner.familyId), session), -r.reservedMicros, paid, session);
    await adjust(await account('experiment', session), -r.reservedMicros, paid, session);
    const changed = await M.Reservation.updateOne({ _id: r._id, state: r.state }, { $set: {
      state: release ? 'released' : 'settled', settledMicros: paid, settledAt: new Date(Number(now()))
    } }, { session });
    if (changed.matchedCount !== 1) throw isolated();
    if (estimate(r) && paid > r.reservedMicros) await latch(owner, 'estimate_exceeded', session);
  };
  const view = async (p, owner, session = null) => {
    const r = await reservation(p, owner, session);
    if (!estimate(r)) return { reservationId: String(r._id), reservedMicros: r.reservedMicros,
      settledMicros: r.settledMicros, state: r.state };
    const audit = await inspect(session), a = await M.Account.findById(String(owner.familyId)).session(session).lean();
    if (!a) throw isolated();
    let reason = null;
    if (a.halted) reason = ['estimate_exceeded', 'cost_unknown'].includes(a.haltReason) ? a.haltReason : 'cost_review_required';
    else if (audit.exceededFamilies.has(String(owner.familyId))) reason = 'estimate_exceeded';
    else if (audit.unknownFamilies.has(String(owner.familyId))) reason = 'cost_unknown';
    else if (audit.experiment.halted || audit.unknown || audit.exceededFamilies.size) reason = 'cost_review_required';
    else if (audit.experiment.trialUsedSubmissions >= audit.experiment.trialMaxSubmissions) reason = 'trial_exhausted';
    if (!reason && getLimits() != null) {
      try { checkCapacity(await ownerAccess(owner, r, session), r.reservedMicros, r.reservedMicros, a, audit.experiment, audit.rows); }
      catch (err) { if (err.code !== 'AI_BUDGET_EXCEEDED') throw err; reason = 'budget_exceeded'; }
    }
    return { reservationId: String(r._id), state: r.state, estimatedReservationMicros: r.reservedMicros,
      usagePricedMicros: r.settledMicros, feeMode: 'estimate_only',
      chargeStatus: { reserved: 'estimated', reserved_unknown: 'unknown', settled: 'usage_priced', released: 'released' }[r.state],
      sendBlocked: reason !== null, sendBlockReason: reason };
  };
  return { account, adjust, budgetState, reserve, reservation, assertClaimCompatible, claimSlot, releaseSlot, settle, markUnknown, halt, view };
}
module.exports = { createAiGenerationBudget, assertAiBudgetOwners };

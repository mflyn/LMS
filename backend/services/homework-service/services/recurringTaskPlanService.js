const mongoose = require('mongoose');
const Plan = require('../models/RecurringTaskPlan');
const Command = require('../models/RecurringTaskPlanCommand');
const Task = require('../models/GrowthTask');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const { resolveChildAccess } = require('../../../common/utils/familyAccess');
const { addLocalDateDays, formatLocalDate } = require('../../../common/utils/familyDate');
const { error, ID, UUID, matches } = require('./growthTaskCompletionCommand');
const { normalize, normalizeAbort, digest, countDays, matchesDate, invalid } = require('./recurringTaskPlanCommand');
const denied = () => error(403, 'CHILD_ACCESS_DENIED');
const unknown = () => error(503, 'RECURRING_PLAN_WRITE_UNKNOWN');
const conflict = () => error(409, 'RECURRING_PLAN_COMMAND_CONFLICT');
const clone = value => JSON.parse(JSON.stringify(value));
const key = value => ({ familyId: value.familyId, actorId: value.actorId, operationId: value.operationId });
const identityView = value => ({ familyId: String(value.familyId), actorId: String(value.actorId),
  childId: String(value.childId), operationId: value.operationId, action: value.action,
  targetPlanId: value.targetPlanId ? String(value.targetPlanId) : null, requestDigest: value.requestDigest });
const terminalView = value => ({ state: value.state, identity: identityView(value), command: value.command,
  result: value.result, settledAt: new Date(value.settledAt).toISOString() });
const planView = plan => ({ id: String(plan._id), childId: String(plan.childId), timezone: plan.timezone,
  startDate: plan.startDate, status: plan.status, version: plan.version,
  currentRevision: clone(plan.currentRevision), pendingRevision: plan.pendingRevision ? clone(plan.pendingRevision) : null,
  createdAt: plan.createdAt?.toISOString(), updatedAt: plan.updatedAt?.toISOString(), stoppedAt: plan.stoppedAt?.toISOString() || null,
  generationHealth: { lastEvaluatedDate: plan.lastEvaluatedDate, lastSucceededAt: plan.lastSucceededAt?.toISOString() || null,
    lastFailureCode: plan.lastFailureCode, skippedOccurrenceCount: plan.skippedOccurrenceCount,
    lastSkippedRange: plan.lastSkippedRange ? clone(plan.lastSkippedRange) : null } });

// Account for missed dates before replacing the old rule. Never create historical tasks.
const advance = (plan, today) => {
  // The initial watermark is a future start's previous day, not an evaluated day.
  if (plan.lastEvaluatedDate >= plan.startDate && today < plan.lastEvaluatedDate) throw unknown();
  if (today < plan.startDate) {
    if (plan.pendingRevision && plan.pendingRevision.effectiveFrom <= today) {
      plan.currentRevision = plan.pendingRevision;
      plan.pendingRevision = null;
    }
    return;
  }
  const from = [addLocalDateDays(plan.lastEvaluatedDate, 1), plan.startDate].sort().at(-1);
  const yesterday = addLocalDateDays(today, -1), pending = plan.pendingRevision;
  let count = 0;
  for (const [rule, until] of [[plan.currentRevision, pending ? addLocalDateDays(pending.effectiveFrom, -1) : yesterday],
    ...(pending ? [[pending, yesterday]] : [])]) {
    const begin = [from, rule.effectiveFrom].sort().at(-1);
    const end = [yesterday, until, rule.endDate || yesterday].sort()[0];
    count += countDays(begin, end, rule.schedule);
  }
  if (count) {
    plan.skippedOccurrenceCount += count;
    plan.lastSkippedRange = { from, to: yesterday, count };
  }
  if (pending && pending.effectiveFrom <= today) { plan.currentRevision = pending; plan.pendingRevision = null; }
  const last = [yesterday, plan.currentRevision.endDate || yesterday].sort()[0];
  if (last > plan.lastEvaluatedDate) plan.lastEvaluatedDate = last;
};

const createRecurringTaskPlanService = ({ transactionRunner, now = Date.now, enabled = () => false } = {}) => {
  if (typeof transactionRunner !== 'function' || typeof now !== 'function' || typeof enabled !== 'function') {
    throw new TypeError('Recurring transaction runner, clock and enable predicate required');
  }
  const at = () => { const value = new Date(now()); if (!Number.isFinite(value.getTime())) throw unknown(); return value; };
  const requireEnabled = () => { if (enabled() !== true) throw error(503, 'RECURRING_TASKS_DISABLED'); };
  const tx = async work => {
    // Duplicate terminal insertions and a crossed local midnight are re-read in a fresh transaction.
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await transactionRunner(async session => {
        if (!session?.inTransaction()) throw unknown();
        return work(session);
      }); } catch (cause) {
        if (cause?.code === 'RECURRING_DATE_CHANGED'
          || cause?.code === 11000 && cause?.keyPattern?.familyId && cause?.keyPattern?.actorId && cause?.keyPattern?.operationId) continue;
        if (cause?.statusCode < 500 || cause?.code === 'RECURRING_TASKS_DISABLED') throw cause;
        throw unknown();
      }
    }
    throw unknown();
  };
  const authorize = async (identity, childId, session) => {
    if (identity?.role !== 'parent' || !matches(identity.id, ID) || !matches(childId, ID)) throw denied();
    const actor = await User.findOne({ _id: identity.id, role: 'parent' }).session(session).lean();
    const access = await resolveChildAccess(identity, childId, {
      FamilyModel: { findOne: query => Family.findOne(query).session(session) },
      UserModel: { findOne: query => User.findOne(query).session(session) }
    });
    if (!actor || actor.status && actor.status !== 'active' || !access
      || access.child.status && access.child.status !== 'active') throw denied();
    return access;
  };
  const target = async (identity, planId, session) => {
    if (!matches(planId, ID)) throw denied();
    const plan = await Plan.findById(planId).session(session).lean();
    if (!plan) throw denied();
    const access = await authorize(identity, String(plan.childId), session);
    if (String(plan.familyId) !== String(access.familyId)) throw denied();
    return { plan, access };
  };
  const findTerminal = async (intent, session) => {
    const row = await Command.findOne(key(intent)).session(session).lean();
    if (row && JSON.stringify(identityView(row)) !== JSON.stringify(identityView(intent))) throw conflict();
    return row;
  };
  const boundary = (plan, today) => {
    requireEnabled();
    if (formatLocalDate(at(), plan.timezone) !== today) throw error(503, 'RECURRING_DATE_CHANGED');
  };
  const generateToday = async (plan, today, session) => {
    const revision = plan.currentRevision;
    if (plan.status !== 'active' || today < plan.startDate || today < revision.effectiveFrom
      || revision.endDate && today > revision.endDate || !matchesDate(today, revision.schedule)) return null;
    let task = await Task.findOne({ recurringPlanId: plan._id, occurrenceDate: today }).session(session).lean();
    if (task && (String(task.familyId) !== String(plan.familyId) || String(task.childId) !== String(plan.childId))) throw unknown();
    if (!task) {
      [task] = await Task.create([{ ...revision.template, familyId: plan.familyId, childId: plan.childId,
        createdByParentId: plan.createdByParentId, dueDate: today, recurringPlanId: plan._id,
        occurrenceDate: today, planRevision: revision.revisionNumber }], { session });
    }
    return String(task._id);
  };
  const savePlan = async (plan, old, session) => {
    if (!Number.isSafeInteger(old.generationFence) || old.generationFence >= Number.MAX_SAFE_INTEGER) throw unknown();
    plan.generationFence = old.generationFence + 1;
    plan.updatedAt = at();
    await Plan.hydrate(plan).validate();
    const { _id, __v, ...values } = plan;
    const changed = await Plan.updateOne({ _id, version: old.version, generationFence: old.generationFence },
      { $set: values }, { session });
    if (changed.matchedCount !== 1) throw unknown();
  };
  const execute = ({ identity, action, planId = null, body } = {}) => tx(async session => {
    const found = action === 'create' ? { access: await authorize(identity, body?.childId, session) }
      : await target(identity, planId, session);
    requireEnabled();
    const normalized = normalize(action, body), access = found.access;
    const scope = { familyId: String(access.familyId), actorId: identity.id.toLowerCase(), childId: String(access.child._id) };
    const intent = { schemaVersion: 1, ...scope, action, targetPlanId: action === 'create' ? null : String(found.plan._id),
      operationId: normalized.operationId };
    intent.requestDigest = digest(scope, action, intent.targetPlanId, normalized);
    const existing = await findTerminal(intent, session);
    if (existing) {
      if (existing.state === 'aborted') throw error(409, 'RECURRING_PLAN_COMMAND_ABORTED');
      return clone(existing.result);
    }
    const stamp = at(), timezone = found.plan?.timezone || access.family.timezone;
    const today = formatLocalDate(stamp, timezone);
    let plan = found.plan, generatedTaskId = null, effectiveFrom;
    if (action === 'create') {
      if (normalized.startDate < today) throw invalid();
      plan = new Plan({ familyId: scope.familyId, childId: scope.childId, createdByParentId: scope.actorId,
        timezone, startDate: normalized.startDate, lastEvaluatedDate: addLocalDateDays(normalized.startDate, -1),
        currentRevision: { revisionNumber: 1, effectiveFrom: normalized.startDate,
          template: normalized.template, schedule: normalized.schedule, endDate: normalized.endDate },
        createdAt: stamp, updatedAt: stamp }).toObject();
      generatedTaskId = await generateToday(plan, today, session);
      if (today >= plan.startDate) { plan.lastEvaluatedDate = today; plan.lastSucceededAt = stamp; }
      await Plan.create([plan], { session });
    } else {
      const old = { ...plan };
      advance(plan, today);
      if (plan.version !== normalized.expectedVersion) throw error(409, 'RECURRING_PLAN_VERSION_CONFLICT');
      if (plan.status !== 'active') throw error(409, 'RECURRING_PLAN_STATE_CONFLICT');
      plan.version++;
      if (action === 'patch') {
        if (plan.currentRevision.endDate && today > plan.currentRevision.endDate) throw error(409, 'RECURRING_PLAN_STATE_CONFLICT');
        effectiveFrom = addLocalDateDays(today, 1);
        if (normalized.endDate !== null && normalized.endDate < [effectiveFrom, plan.startDate].sort().at(-1)) throw invalid();
        plan.pendingRevision = { revisionNumber: plan.version, effectiveFrom,
          template: normalized.template, schedule: normalized.schedule, endDate: normalized.endDate };
      } else { plan.status = 'stopped'; plan.stoppedAt = stamp; plan.stoppedByParentId = new mongoose.Types.ObjectId(scope.actorId); }
      await savePlan(plan, old, session);
    }
    const result = { httpStatus: action === 'create' ? 201 : 200,
      data: { operationId: normalized.operationId, plan: planView(plan),
        ...(action === 'create' ? { generatedTaskId } : action === 'patch' ? { effectiveFrom } : { existingTasksPreserved: true }) } };
    await Command.create([{ ...intent, state: 'succeeded', command: normalized, result, settledAt: stamp }], { session });
    boundary(plan, today);
    return result;
  });
  const abort = ({ identity, operationId, body } = {}) => tx(async session => {
    const access = await authorize(identity, body?.childId, session);
    requireEnabled();
    const parsed = normalizeAbort(operationId, body);
    if (parsed.action !== 'create') {
      const found = await target(identity, parsed.targetPlanId, session);
      if (String(found.plan.childId) !== parsed.childId || String(found.plan.familyId) !== String(access.familyId)) throw denied();
    }
    const intent = { schemaVersion: 1, ...parsed, familyId: String(access.familyId), actorId: identity.id.toLowerCase() };
    const existing = await findTerminal(intent, session);
    if (existing) return terminalView(existing);
    const [row] = await Command.create([{ ...intent, state: 'aborted', settledAt: at() }], { session });
    requireEnabled();
    return terminalView(row.toObject());
  });
  const getCommand = ({ identity, childId, operationId } = {}) => tx(async session => {
    const access = await authorize(identity, childId, session);
    if (!matches(operationId, UUID)) throw invalid();
    const scope = { familyId: String(access.familyId), actorId: identity.id.toLowerCase(), childId: childId.toLowerCase(),
      operationId: operationId.toLowerCase() };
    const row = await Command.findOne({ ...key(scope), childId: scope.childId }).session(session).lean();
    return row ? terminalView(row) : { state: 'not_found', identity: scope };
  });
  const getPlan = ({ identity, planId } = {}) => tx(async session => planView((await target(identity, planId, session)).plan));
  const list = (commands, { identity, childId, page = 1, pageSize = 20 } = {}) => tx(async session => {
    const access = await authorize(identity, childId, session);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50
      || !Number.isSafeInteger((page - 1) * pageSize)) throw invalid();
    const Model = commands ? Command : Plan;
    const filter = { familyId: access.familyId, childId, ...(commands ? { actorId: identity.id } : {}) };
    const total = await Model.countDocuments(filter).session(session);
    const rows = await Model.find(filter).sort(commands ? { settledAt: -1, _id: -1 } : { _id: -1 })
      .skip((page - 1) * pageSize).limit(pageSize).session(session).lean();
    return { items: rows.map(row => commands ? { operationId: row.operationId, action: row.action,
      targetPlanId: row.targetPlanId ? String(row.targetPlanId) : null, state: row.state,
      settledAt: row.settledAt.toISOString() } : planView(row)), page, pageSize, total };
  });
  const generate = ({ planId } = {}) => tx(async session => {
    requireEnabled();
    if (!matches(planId, ID)) throw invalid();
    const plan = await Plan.findById(planId).session(session).lean();
    if (!plan) throw denied();
    if (plan.status === 'stopped') return { generatedTaskId: null };
    const family = await Family.findOne({ _id: plan.familyId, childIds: plan.childId }).session(session).lean();
    const child = await User.findOne({ _id: plan.childId, familyId: plan.familyId, role: 'student' }).session(session).lean();
    if (!family || !child || child.status && child.status !== 'active') throw denied();
    const stamp = at(), today = formatLocalDate(stamp, plan.timezone), old = { ...plan };
    advance(plan, today);
    if (today < plan.startDate) {
      if (old.pendingRevision && !plan.pendingRevision) await savePlan(plan, old, session);
      boundary(plan, today);
      return { generatedTaskId: null };
    }
    const generatedTaskId = await generateToday(plan, today, session);
    plan.lastEvaluatedDate = [today, plan.currentRevision.endDate || today].sort()[0];
    plan.lastSucceededAt = stamp; plan.lastFailureCode = null;
    await savePlan(plan, old, session);
    boundary(plan, today);
    return { generatedTaskId };
  });
  return { execute, abort, getCommand, getPlan, generate,
    listPlans: input => list(false, input), listCommands: input => list(true, input) };
};
module.exports = { createRecurringTaskPlanService, planView };

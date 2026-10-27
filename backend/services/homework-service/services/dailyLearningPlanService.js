const mongoose = require('mongoose');
const Plan = require('../models/DailyLearningPlan');
const Task = require('../models/GrowthTask');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const { resolveChildAccess } = require('../../../common/utils/familyAccess');
const { addLocalDateDays, formatLocalDate } = require('../../../common/utils/familyDate');
const { runMongoTransaction } = require('../../../common/services/mongoTransaction');
const { normalizeDailyLearningPlanInput: normalize } = require('../../../common/utils/dailyLearningPlanInput');
const { ID, matches, invalid, error } = require('./growthTaskCompletionCommand');
const conflict = () => error(409, 'VERSION_CONFLICT');
const denied = () => error(403, 'CHILD_ACCESS_DENIED');
const actorView = actor => actor ? { actorId: String(actor.actorId), role: actor.role } : null;
const createDailyLearningPlanService = ({ now = Date.now,
  transactionRunner = work => runMongoTransaction({ mongooseInstance: mongoose, work }) } = {}) => {
  const authorize = async (identity, childId, session = null) => {
    if (!matches(identity?.id, ID) || !['parent', 'student'].includes(identity.role) || !matches(childId, ID)) throw denied();
    const access = await resolveChildAccess(identity, childId, {
      FamilyModel: { findOne: q => Family.findOne(q).session(session) },
      UserModel: { findOne: q => User.findOne(q).session(session) }
    });
    const actor = await User.findOne({ _id: identity.id, role: identity.role }).session(session).lean();
    if (!access || !actor || identity.role === 'student' && (!Number.isInteger(identity.tokenVersion)
      || identity.tokenVersion !== actor.childProfile?.tokenVersion)) throw denied();
    return access;
  };
  const dateCheck = (localDate, family, write) => {
    try { if (typeof localDate !== 'string' || addLocalDateDays(localDate, 0) !== localDate) throw invalid(); }
    catch (_) { throw invalid(); }
    const today = formatLocalDate(new Date(Number(now())), family.timezone);
    if (write && localDate !== today) throw error(409, 'LOCAL_DATE_NOT_WRITABLE');
    if (!write && localDate > today) throw invalid();
  };
  const scopeFor = (access, childId, localDate) => ({ familyId: access.familyId, childId, localDate });
  const view = async (plan, scope, session = null) => {
    const tasks = await Task.find({ _id: { $in: (plan?.items || []).map(i => i.taskId) },
      familyId: scope.familyId, childId: scope.childId }).select('title dimension status dueDate').session(session).lean();
    const byId = new Map(tasks.map(t => [String(t._id), t]));
    return { success: true, data: { plan: {
      childId: String(scope.childId), localDate: scope.localDate, version: plan?.version ?? 0,
      updatedByActor: actorView(plan?.updatedByActor), items: (plan?.items || []).map(item => {
        const task = byId.get(String(item.taskId));
        return { taskId: String(item.taskId), childEstimatedMinutes: item.childEstimatedMinutes ?? null,
          estimateRecordedBy: actorView(item.estimateRecordedBy),
          task: task ? { taskId: String(task._id), title: task.title, dimension: task.dimension,
            status: task.status, dueDate: task.dueDate } : null };
      })
    } } };
  };
  const get = async ({ identity, childId, localDate }) => {
    const access = await authorize(identity, childId); dateCheck(localDate, access.family, false);
    const scope = scopeFor(access, childId, localDate);
    return view(await Plan.findOne(scope).lean(), scope);
  };
  const put = async ({ identity, childId, localDate, body }) => {
    // Authenticate before input errors; repeat inside each transaction attempt.
    const access = await authorize(identity, childId); dateCheck(localDate, access.family, true);
    const command = normalize(body);
    try {
      // Driver listIndexes() drops includeBuildUUIDs; inspect the raw, bounded cursor instead.
      const cursor = Plan.db.db.runCursorCommand({ listIndexes: Plan.collection.collectionName,
        includeBuildUUIDs: true, cursor: { batchSize: 100 }, maxTimeMS: 5000 }, { readPreference: 'primary' });
      let indexes;
      try { indexes = await cursor.toArray(); } finally { await cursor.close(); }
      if (!indexes.some(index => index.unique === true && !index.sparse && !index.partialFilterExpression
        && index.buildUUID === undefined && index.spec === undefined && index.indexBuildInfo === undefined
        && index.buildInfo === undefined && index.prepareUnique !== true
        && (!index.collation || index.collation.locale === 'simple')
        && JSON.stringify(index.key) === JSON.stringify({ familyId: 1, childId: 1, localDate: 1 }))) {
        throw new Error('Daily plan unique index required');
      }
      return await transactionRunner(async session => {
        if (!session?.inTransaction()) throw new Error('Transaction required');
        const currentAccess = await authorize(identity, childId, session);
        dateCheck(localDate, currentAccess.family, true);
        const scope = scopeFor(currentAccess, childId, localDate), current = await Plan.findOne(scope).session(session).lean();
        if ((current?.version ?? 0) !== command.expectedVersion) throw conflict();
        const previous = new Map((current?.items || []).map(item => [String(item.taskId), item]));
        const tasks = await Task.find({ _id: { $in: command.items.map(i => i.taskId) },
          familyId: scope.familyId, childId }).session(session).lean();
        const byId = new Map(tasks.map(t => [String(t._id), t]));
        const actor = { actorId: identity.id.toLowerCase(), role: identity.role };
        const items = command.items.map(item => {
          const task = byId.get(item.taskId), prior = previous.get(item.taskId);
          if (!task) throw error(404, 'RESOURCE_NOT_FOUND');
          if (!prior && task.status !== 'pending') throw error(409, 'TASK_STATE_CONFLICT');
          return { ...item, estimateRecordedBy: item.childEstimatedMinutes === null ? null
            : prior?.childEstimatedMinutes === item.childEstimatedMinutes ? prior.estimateRecordedBy ?? null : actor };
        });
        // A transactional write fence prevents stale pending reads from adding a task after a competing transition.
        for (const item of items.filter(i => !previous.has(i.taskId)).sort((a, b) => a.taskId.localeCompare(b.taskId))) {
          const changed = await Task.updateOne({ _id: item.taskId, familyId: scope.familyId, childId, status: 'pending' },
            { $inc: { __v: 1 } }, { session, timestamps: false });
          if (changed.matchedCount !== 1) throw error(409, 'TASK_STATE_CONFLICT');
        }
        dateCheck(localDate, currentAccess.family, true);
        const set = { items, version: command.expectedVersion + 1, updatedByActor: actor };
        let saved;
        if (!current) [saved] = await Plan.create([{ ...scope, ...set }], { session });
        else {
          saved = await Plan.findOneAndUpdate({ ...scope, version: command.expectedVersion }, { $set: set },
            { new: true, session, runValidators: true }).lean();
          if (!saved) throw conflict();
        }
        return view(saved, scope, session);
      });
    } catch (cause) {
      if (cause?.code === 11000) throw conflict();
      if (cause?.statusCode < 500) throw cause;
      throw error(503, 'SERVICE_UNAVAILABLE');
    }
  };
  return { get, put };
};
module.exports = { createDailyLearningPlanService };

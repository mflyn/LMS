const Task = require('../models/GrowthTask');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const { resolveChildAccess } = require('../../../common/utils/familyAccess');
const { ID, UUID, matches, error, invalid, pending, unlockedFilter } = require('./growthTaskCompletionCommand');
const HIDDEN = '+activeCompletionOperation +completionPending +completionMediaBindings';
const starPending = () => error(503, 'STAR_AWARD_PENDING');
const exact = value => value === undefined ? { $exists: false } : value;
const version = task => task.completionVersion === undefined ? 0 : task.completionVersion;

const normalize = body => {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some(k => !['expectedCompletionVersion', 'parentFeedback'].includes(k))) throw invalid();
  if (!Object.prototype.hasOwnProperty.call(body, 'expectedCompletionVersion')) throw error(400, 'CLIENT_UPGRADE_REQUIRED');
  if (!Number.isSafeInteger(body.expectedCompletionVersion) || body.expectedCompletionVersion < 0
    || Object.prototype.hasOwnProperty.call(body, 'parentFeedback') && typeof body.parentFeedback !== 'string') throw invalid();
  return { expectedCompletionVersion: body.expectedCompletionVersion, parentFeedback: (body.parentFeedback || '').trim() };
};

const createGrowthTaskCompletionConfirmationService = ({ transactionRunner, awardTaskStar, now = Date.now } = {}) => {
  if (typeof transactionRunner !== 'function' || typeof awardTaskStar !== 'function' || typeof now !== 'function') {
    throw new Error('Confirmation transaction runner, star client and clock are required');
  }
  const transact = async (label, work) => {
    try {
      return await transactionRunner(async session => {
        if (!session?.inTransaction()) throw Error('Active confirmation transaction is required');
        return work(session);
      }, label);
    } catch (cause) {
      if (cause?.statusCode < 500 || cause?.code === 'MEDIA_REFERENCE_PENDING') throw cause;
      throw starPending();
    }
  };
  const authorize = async (identity, taskId, session) => {
    if (!identity || identity.role !== 'parent' || !matches(identity.id, ID)) throw error(403, 'CHILD_ACCESS_DENIED');
    if (!matches(taskId, ID)) throw invalid();
    const task = await Task.findById(taskId).select(HIDDEN).session(session).lean();
    if (!task) throw error(403, 'CHILD_ACCESS_DENIED');
    const access = await resolveChildAccess(identity, String(task.childId), {
      FamilyModel: { findOne: query => Family.findOne(query).session(session) },
      UserModel: { findOne: query => User.findOne(query).session(session) }
    });
    const parent = await User.findOne({ _id: identity.id, role: 'parent' }).session(session).lean();
    if (!access || !parent || String(access.familyId) !== String(task.familyId)) throw error(403, 'CHILD_ACCESS_DENIED');
    return task;
  };
  const check = (task, expected) => {
    if (task.activeCompletionOperation || task.completionPending || task.mediaReferenceState === 'pending') throw pending();
    const ids = task.completionEvidence?.completionMediaIds || [], bindings = task.completionMediaBindings || [];
    if (!Number.isSafeInteger(version(task)) || version(task) < 0
      || !Array.isArray(ids) || !Array.isArray(bindings) || ids.length > 10
      || new Set(ids.map(String)).size !== ids.length || ids.length !== bindings.length
      || ids.some((id, i) => String(id) !== String(bindings[i]?.mediaId) || !matches(bindings[i]?.bindingOperationId, UUID))
      || task.completionVersion === undefined && ids.length
      || !(task.completionMediaReferenceState === 'stable'
        || task.completionMediaReferenceState === undefined && ids.length === 0)) throw pending();
    if (version(task) !== expected) throw error(409, 'VERSION_CONFLICT');
    if (!['completed', 'confirmed'].includes(task.status)) throw error(409, 'TASK_STATE_CONFLICT');
    if (task.status === 'completed' && ![undefined, null, 'not_applicable'].includes(task.starAwardState)) {
      throw error(409, 'TASK_STATE_CONFLICT');
    }
    if (task.status === 'confirmed' && (!['pending', 'awarded'].includes(task.starAwardState)
      || !matches(String(task.confirmedByParentId), ID) || !(task.confirmedAt instanceof Date)
      || !Number.isFinite(task.confirmedAt.getTime()))) throw starPending();
  };
  const filter = task => ({ _id: task._id, familyId: task.familyId, childId: task.childId,
    ...unlockedFilter(), status: task.status, completionVersion: exact(task.completionVersion),
    completionMediaReferenceState: exact(task.completionMediaReferenceState),
    starAwardState: exact(task.starAwardState), __v: exact(task.__v) });
  const update = async (task, set, session) => {
    const result = await Task.updateOne(filter(task), { $set: set, $inc: { __v: 1 } }, { session, runValidators: true });
    if (result.matchedCount !== 1) throw starPending();
    return Task.findById(task._id).select(HIDDEN).session(session).lean();
  };
  const response = (task, starAward) => ({ success: true, data: {
    task: { taskId: String(task._id), status: task.status, completionVersion: version(task),
      checklistVersion: task.checklistVersion ?? 0, completionMediaIds: (task.completionEvidence?.completionMediaIds || []).map(String),
      completionMediaReferenceState: task.completionMediaReferenceState || 'stable', parentConfirmed: true,
      parentFeedback: task.parentFeedback, confirmedByParentId: String(task.confirmedByParentId),
      confirmedAt: task.confirmedAt, completedAt: task.completedAt, starAwardState: task.starAwardState },
    ...(starAward ? { starAward } : {})
  } });
  const confirm = async ({ identity, taskId, body } = {}) => {
    await transact('read', session => authorize(identity, taskId, session));
    const command = normalize(body);
    const confirmation = await transact('confirm', async session => {
      const task = await authorize(identity, taskId, session); check(task, command.expectedCompletionVersion);
      const set = task.completionVersion === undefined ? { completionVersion: 0 } : {};
      if (task.status === 'completed') {
        const confirmedAt = new Date(Number(now())); if (!Number.isFinite(confirmedAt.getTime())) throw starPending();
        Object.assign(set, { status: 'confirmed', confirmedAt, confirmedByParentId: identity.id,
          parentFeedback: command.parentFeedback, starAwardState: 'pending' });
      }
      return Object.keys(set).length ? update(task, set, session) : task;
    });
    if (confirmation.starAwardState === 'awarded') return response(confirmation);
    let starAward;
    try {
      // The current caller authorizes recovery; the first confirmer remains immutable task audit.
      starAward = await awardTaskStar({ familyId: String(confirmation.familyId), childId: String(confirmation.childId),
        taskId: String(confirmation._id), confirmedByParentId: identity.id });
      if (!starAward || typeof starAward.awarded !== 'boolean' || typeof starAward.ledgerEntryId !== 'string'
        || !starAward.ledgerEntryId || !Number.isInteger(starAward.starBalance) || starAward.starBalance < 0) throw starPending();
    } catch (_cause) { throw starPending(); }
    const awarded = await transact('award', async session => {
      const task = await authorize(identity, taskId, session); check(task, command.expectedCompletionVersion);
      if (task.status !== 'confirmed' || String(task.familyId) !== String(confirmation.familyId)
        || String(task.childId) !== String(confirmation.childId)
        || String(task.confirmedByParentId) !== String(confirmation.confirmedByParentId)
        || task.confirmedAt.getTime() !== confirmation.confirmedAt.getTime()) throw starPending();
      if (task.starAwardState === 'awarded') return task;
      return update(task, { starAwardState: 'awarded' }, session);
    });
    return response(awarded, starAward);
  };
  return { confirm };
};

module.exports = { createGrowthTaskCompletionConfirmationService };

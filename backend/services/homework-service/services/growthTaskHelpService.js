const Task = require('../models/GrowthTask');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const { resolveChildAccess } = require('../../../common/utils/familyAccess');
const { HELP_TYPES } = require('../models/growthTaskHelpFields');
const { taskView } = require('./growthTaskCompletionReadService');
const { ID, matches, invalid, error } = require('./growthTaskCompletionCommand');
const denied = () => error(403, 'CHILD_ACCESS_DENIED');
const conflict = () => error(409, 'VERSION_CONFLICT');
const stateConflict = () => error(409, 'TASK_STATE_CONFLICT');
const pending = () => error(503, 'HELP_UPDATE_PENDING');

const text = value => {
  if (value === undefined) return '';
  if (typeof value !== 'string') throw invalid();
  const normalized = value.normalize('NFC').trim();
  if ([...normalized].length > 200) throw invalid();
  return normalized;
};
const normalize = body => {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || !['request', 'resolve'].includes(body.action)
    || !Number.isSafeInteger(body.expectedHelpVersion) || body.expectedHelpVersion < 0) throw invalid();
  const fields = body.action === 'request' ? ['helpType', 'note'] : ['parentResponse'];
  if (Object.keys(body).some(k => !['action', 'expectedHelpVersion', ...fields].includes(k))) throw invalid();
  if (body.action === 'request' && !HELP_TYPES.includes(body.helpType)) throw invalid();
  return { action: body.action, expectedHelpVersion: body.expectedHelpVersion,
    ...(body.action === 'request' ? { helpType: body.helpType, note: text(body.note) }
      : { parentResponse: text(body.parentResponse) }) };
};

const createGrowthTaskHelpService = ({ transactionRunner, now = Date.now } = {}) => {
  if (typeof transactionRunner !== 'function' || typeof now !== 'function') throw new TypeError('Help transaction runner and clock required');
  const authorize = async (identity, taskId, session) => {
    if (!matches(identity?.id, ID) || !['parent', 'student'].includes(identity.role)) throw denied();
    if (!matches(taskId, ID)) throw invalid();
    const task = await Task.findById(taskId).session(session).lean();
    if (!task) throw denied();
    const access = await resolveChildAccess(identity, String(task.childId), {
      FamilyModel: { findOne: query => Family.findOne(query).session(session) },
      UserModel: { findOne: query => User.findOne(query).session(session) }
    });
    const actor = await User.findOne({ _id: identity.id, role: identity.role }).session(session).lean();
    if (!access || String(access.familyId) !== String(task.familyId) || !actor
      || identity.role === 'student' && (!Number.isInteger(identity.tokenVersion)
        || actor.childProfile?.tokenVersion !== identity.tokenVersion)) throw denied();
    return task;
  };
  const update = async ({ identity, taskId, body } = {}) => {
    try {
      return await transactionRunner(async session => {
        if (!session?.inTransaction()) throw pending();
        // Authorization is repeated on transaction retries, before request validation or replay.
        const task = await authorize(identity, taskId, session), command = normalize(body);
        if (command.action === 'resolve' && identity.role !== 'parent') throw denied();
        const version = task.helpVersion === undefined ? 0 : task.helpVersion;
        if (!Number.isSafeInteger(version) || version < 0) throw conflict();
        if (!['pending', 'completed', 'confirmed'].includes(task.status)) throw stateConflict();
        const previous = task.helpRequest;
        if (command.action === 'request' && previous?.status === 'pending'
          && version === command.expectedHelpVersion + 1 && previous.helpType === command.helpType
          && previous.note === command.note && String(previous.requestedByActor?.id) === identity.id.toLowerCase()
          && previous.requestedByActor?.role === identity.role) return { success: true, data: { task: taskView(task) } };
        if (version !== command.expectedHelpVersion || version === Number.MAX_SAFE_INTEGER) throw conflict();
        if (command.action === 'request' ? task.status !== 'pending' : previous?.status !== 'pending') throw stateConflict();
        const at = new Date(Number(now())); if (!Number.isFinite(at.getTime())) throw pending();
        const actor = { id: identity.id.toLowerCase(), role: identity.role };
        const helpRequest = command.action === 'request'
          ? { status: 'pending', helpType: command.helpType, note: command.note, requestedByActor: actor, requestedAt: at }
          : { ...previous, status: 'resolved', parentResponse: command.parentResponse, resolvedByActor: actor, resolvedAt: at };
        // Never replace the task or touch a completion owner, evidence, version or reward.
        const changed = await Task.updateOne({ _id: task._id, familyId: task.familyId, childId: task.childId,
          status: task.status, helpVersion: task.helpVersion === undefined ? { $exists: false } : version },
        { $set: { helpRequest, helpVersion: version + 1 }, $inc: { __v: 1 } }, { session, runValidators: true });
        if (changed.matchedCount !== 1) throw conflict();
        const current = await Task.findById(task._id).session(session).lean();
        return { success: true, data: { task: taskView(current) } };
      }, 'help');
    } catch (cause) {
      if (cause?.statusCode < 500) throw cause;
      throw pending();
    }
  };
  return { update };
};
module.exports = { createGrowthTaskHelpService };

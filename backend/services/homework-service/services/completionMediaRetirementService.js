const Guard = require('../models/CompletionMediaGuard');
const Task = require('../models/GrowthTask');
const Operation = require('../models/GrowthTaskCompletionOperation');
const { assertIntent, ownerKeys } = require('./completionIntentValidation');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const { guardCollision, touchGuard } = require('./completionMediaGuardService');
const { ID, UUID, matches, error, invalid } = require('./growthTaskCompletionCommand');

const fields = ['familyId', 'childId', 'mediaId', 'retirementId'];
const unavailable = () => error(503, 'MEDIA_RETIREMENT_PENDING');
const usagePaths = ['completionEvidence.completionMediaIds', 'completionMediaBindings.mediaId',
  'completionPending.mediaIds', 'completionPending.previousBindings.mediaId',
  'completionPending.additionIds', 'completionPending.removalBindings.mediaId'];

const assertActiveIntents = async (familyId, childId, session) => {
  const operations = await Operation.find({ familyId, childId, phase: { $nin: ['SUCCEEDED', 'FAILED'] } }).session(session).lean();
  const tasks = await Task.find({ familyId, childId, $or: [
    { activeCompletionOperation: { $ne: null } }, { completionPending: { $ne: null } },
    { completionMediaReferenceState: 'pending_recovery' }, { _id: { $in: operations.map(op => op.taskId) } }
  ] }).select('+activeCompletionOperation +completionPending +completionMediaBindings').session(session).lean();
  const byTask = new Map(tasks.map(task => [String(task._id), task]));
  const validated = new Set();
  for (const op of operations) {
    const taskId = String(op.taskId), task = byTask.get(taskId);
    if (!task || validated.has(taskId) || !matches(op.remoteOperationId, UUID)
      || op.remoteOperationId !== op.remoteOperationId.toLowerCase()
      || !['PREPUBLISH', 'PUBLISHED_CLEANUP'].includes(op.phase)
      || !Number.isSafeInteger(op.version) || op.version < 0
      || !Number.isSafeInteger(op.targetCompletionVersion) || op.targetCompletionVersion < 1) throw unavailable();
    const scope = Object.fromEntries(ownerKeys.map(key => [key, String(op[key])]));
    assertIntent(task, op, scope);
    validated.add(taskId);
  }
  if (tasks.some(task => !validated.has(String(task._id)))) throw unavailable();
};

const createCompletionMediaRetirementService = ({ transactionRunner, now = Date.now } = {}) => {
  if (typeof transactionRunner !== 'function' || typeof now !== 'function') throw new TypeError('Retirement transaction runner and clock required');
  const retire = async body => {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== fields.length
      || Object.keys(body).some(key => !fields.includes(key))
      || fields.some(key => !matches(body[key], key === 'retirementId' ? UUID : ID))) throw invalid();
    const command = Object.fromEntries(fields.map(key => [key, body[key].toLowerCase()]));
    const { familyId, childId, mediaId, retirementId } = command;
    const scope = { familyId, childId, mediaId };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await transactionRunner(async session => {
          if (!session?.inTransaction()) throw unavailable();
          const family = await Family.findOne({ _id: familyId, childIds: childId }).session(session).lean();
          const child = await User.findOne({ _id: childId, familyId, role: 'student' }).session(session).lean();
          if (!family || !child) throw error(403, 'CHILD_ACCESS_DENIED');
          const previous = await Guard.findOne(scope).session(session);
          if (previous) await previous.validate();
          if (previous?.state === 'retired') {
            if (previous.retirementId !== retirementId) throw error(409, 'MEDIA_RETIREMENT_CONFLICT');
            return { ...command, state: 'granted' };
          }
          const guard = await touchGuard(scope, session);
          if (guard.state !== 'available') throw unavailable();
          // No task status/date filter: hidden, archived and legacy pending all retain ownership.
          const used = await Task.exists({ familyId, childId,
            $or: usagePaths.map(key => ({ [key]: mediaId })) }).session(session);
          if (used) return { ...command, state: 'in_use' };
          // Missing task-side markers cannot prove absence while a ledger intent survives.
          await assertActiveIntents(familyId, childId, session);
          const retiredAt = new Date(Number(now()));
          if (!Number.isFinite(retiredAt.getTime())) throw unavailable();
          const changed = await Guard.updateOne({ ...scope, state: 'available', revision: guard.revision },
            { $set: { state: 'retired', retirementId, retiredAt } }, { session, runValidators: true });
          if (changed.matchedCount !== 1) throw unavailable();
          return { ...command, state: 'granted' };
        });
      } catch (cause) {
        if (guardCollision(cause)) continue;
        if (cause?.statusCode < 500) throw cause;
        throw unavailable();
      }
    }
    throw unavailable();
  };
  const status = async body => {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== fields.length
      || Object.keys(body).some(key => !fields.includes(key))
      || fields.some(key => !matches(body[key], key === 'retirementId' ? UUID : ID))) throw invalid();
    const command = Object.fromEntries(fields.map(key => [key, body[key].toLowerCase()]));
    const { familyId, childId, mediaId, retirementId } = command;
    try {
      return await transactionRunner(async session => {
        if (!session?.inTransaction()) throw unavailable();
        const family = await Family.findOne({ _id: familyId, childIds: childId }).session(session).lean();
        const child = await User.findOne({ _id: childId, familyId, role: 'student' }).session(session).lean();
        if (!family || !child) throw error(403, 'CHILD_ACCESS_DENIED');
        // Read raw persisted fields: hydration defaults must not hide corrupt or missing guard evidence.
        const guard = await Guard.findOne({ familyId, childId, mediaId }).session(session).lean();
        if (!guard) return { ...command, state: 'absent' };
        if (!Number.isSafeInteger(guard.revision) || guard.revision < 1
          || !['available', 'retired'].includes(guard.state)) throw unavailable();
        if (guard.state === 'available') {
          if (guard.retirementId !== null || guard.retiredAt !== null) throw unavailable();
        } else {
          if (!matches(guard.retirementId, UUID) || guard.retirementId !== guard.retirementId.toLowerCase()
            || !(guard.retiredAt instanceof Date) || !Number.isFinite(guard.retiredAt.getTime())) throw unavailable();
          if (guard.retirementId !== retirementId) throw error(409, 'MEDIA_RETIREMENT_CONFLICT');
        }
        // For available/absent, retirementId is only the caller's echo, not a stored retirement fact.
        return { ...command, state: guard.state };
      });
    } catch (cause) {
      if (cause?.statusCode < 500) throw cause;
      throw unavailable();
    }
  };
  return { retire, status };
};

module.exports = { createCompletionMediaRetirementService };

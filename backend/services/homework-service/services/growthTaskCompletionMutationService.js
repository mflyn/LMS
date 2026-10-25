const Task = require('../models/GrowthTask');
const { authorizeParentTask } = require('./growthTaskCompletionParentAccess');
const { parseGrowthTaskPatch, entriesToMongoSet, validateGrowthTaskValues } = require('./growthTaskPatch');
const { error, invalid, pending, unlockedFilter } = require('./growthTaskCompletionCommand');

const HIDDEN = '+activeCompletionOperation +completionPending';
const exact = value => value === undefined ? { $exists: false } : value;
const PUBLIC_FIELDS = ['dimension', 'area', 'subject', 'title', 'taskType', 'description', 'dueDate',
  'estimatedMinutes', 'actualMinutes', 'targetAmount', 'actualAmount', 'unit', 'priority', 'status',
  'difficulty', 'needsHelp', 'childNote', 'parentFeedback', 'completedAt', 'confirmedAt', 'cancelledAt', 'starAwardState'];
const view = task => ({
  taskId: String(task._id), familyId: String(task.familyId), childId: String(task.childId),
  createdByParentId: String(task.createdByParentId),
  ...Object.fromEntries(PUBLIC_FIELDS.map(field => [field, task[field]])),
  attachmentMediaIds: (task.attachmentMediaIds || []).map(String),
  completionMediaIds: (task.completionEvidence?.completionMediaIds || []).map(String),
  completionVersion: task.completionVersion ?? 0, checklistVersion: task.checklistVersion ?? 0,
  completionMediaReferenceState: task.completionMediaReferenceState || 'stable',
  confirmedByParentId: task.confirmedByParentId ? String(task.confirmedByParentId) : undefined,
  parentConfirmed: task.status === 'confirmed'
});

const createGrowthTaskCompletionMutationService = ({ transactionRunner, now = Date.now } = {}) => {
  if (typeof transactionRunner !== 'function' || typeof now !== 'function') {
    throw new Error('Mutation transaction runner and clock are required');
  }
  const transact = async (label, work) => {
    try {
      return await transactionRunner(async session => {
        if (!session?.inTransaction()) throw pending();
        return work(session);
      }, label);
    } catch (cause) {
      if (cause?.statusCode < 500) throw cause;
      if (cause?.name === 'ValidationError' || cause?.name === 'CastError') throw invalid();
      throw pending();
    }
  };
  const authorize = authorizeParentTask;
  const assertUnlocked = task => {
    if (task.activeCompletionOperation || task.completionPending
      || ![undefined, 'stable'].includes(task.completionMediaReferenceState)
      || ![undefined, 'none', 'bound'].includes(task.mediaReferenceState)) throw pending();
  };
  const update = async (task, set, session) => {
    const result = await Task.updateOne({ _id: task._id, familyId: task.familyId, childId: task.childId,
      ...unlockedFilter(), status: task.status, __v: exact(task.__v),
      completionVersion: exact(task.completionVersion), checklistVersion: exact(task.checklistVersion),
      completionMediaReferenceState: exact(task.completionMediaReferenceState),
      mediaReferenceState: exact(task.mediaReferenceState), starAwardState: exact(task.starAwardState)
    }, { $set: set, $inc: { __v: 1 } }, { session, runValidators: true });
    if (result.matchedCount !== 1) throw pending();
    return Task.findById(task._id).select(HIDDEN).session(session).lean();
  };
  const edit = async ({ identity, taskId, body } = {}) => {
    await transact('read', session => authorize(identity, taskId, session));
    if (body && Object.prototype.hasOwnProperty.call(body, 'repeatRule')) throw error(400, 'REPEAT_RULE_NOT_SUPPORTED');
    let parsed;
    try { parsed = parseGrowthTaskPatch(body); } catch (_cause) { throw invalid(); }
    if (parsed.hasAttachmentMutation) throw error(400, 'MEDIA_NOT_ENABLED');
    const set = entriesToMongoSet(parsed.entries);
    try { await validateGrowthTaskValues(Task, set); } catch (_cause) { throw invalid(); }
    const task = await transact('edit', async session => {
      const current = await authorize(identity, taskId, session); assertUnlocked(current);
      if (current.status !== 'pending') throw error(409, 'TASK_STATE_CONFLICT');
      return Object.keys(set).length ? update(current, set, session) : current;
    });
    return { success: true, data: { task: view(task) } };
  };
  const remove = async ({ identity, taskId } = {}) => {
    const task = await transact('remove', async session => {
      const current = await authorize(identity, taskId, session); assertUnlocked(current);
      if (['cancelled', 'archived'].includes(current.status)) return current;
      if (current.status === 'confirmed' && current.starAwardState === 'pending') throw error(409, 'STAR_AWARD_PENDING');
      if (!['pending', 'completed', 'confirmed'].includes(current.status)
        || current.status === 'confirmed' && current.starAwardState !== 'awarded') throw error(409, 'TASK_STATE_CONFLICT');
      const set = { status: 'archived' };
      if (current.status === 'pending') {
        const cancelledAt = new Date(Number(now())); if (!Number.isFinite(cancelledAt.getTime())) throw pending();
        Object.assign(set, { status: 'cancelled', cancelledAt });
      }
      return update(current, set, session);
    });
    return { success: true, data: { deleted: false, task: view(task) } };
  };
  return { edit, remove };
};

module.exports = { createGrowthTaskCompletionMutationService };

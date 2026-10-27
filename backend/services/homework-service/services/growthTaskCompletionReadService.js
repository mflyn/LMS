const Task = require('../models/GrowthTask');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const { AppError } = require('../../../common/middleware/errorTypes');
const { resolveChildAccess } = require('../../../common/utils/familyAccess');
const { parsePagination } = require('../../../common/utils/familyResponse');
const { formatLocalDate, getWeekRange } = require('../../../common/utils/familyDate');
const { sourceProjection, createLearningSourceReader } = require('../../../common/services/learningSource');

const ID = /^[0-9a-f]{24}$/i;
const objectId = value => typeof value === 'string' && ID.test(value);
const error = (status, code) => new AppError(code, status, code, true, []);
const denied = () => error(403, 'CHILD_ACCESS_DENIED');
const invalid = () => error(400, 'VALIDATION_ERROR');
const pick = (value, fields) => Object.fromEntries(fields.filter(k => value?.[k] !== undefined).map(k => [k, value[k]]));
const ids = values => (values || []).map(String);
const TASK_FIELDS = ['dimension', 'area', 'subject', 'title', 'taskType', 'description', 'dueDate',
  'estimatedMinutes', 'actualMinutes', 'targetAmount', 'actualAmount', 'unit', 'priority', 'status',
  'difficulty', 'needsHelp', 'childNote', 'parentFeedback', 'completedAt', 'confirmedAt', 'starAwardState', 'cancelledAt'];
const EVIDENCE_FIELDS = ['actualMinutes', 'actualAmount', 'difficulty', 'needsHelp', 'childNote', 'childSubmittedAt'];

// Explicit nested projection also excludes unknown fields in legacy/raw documents.
const taskView = task => {
  const evidence = task.completionEvidence;
  return {
    ...sourceProjection(task),
    ...pick(task, TASK_FIELDS), taskId: String(task._id), childId: String(task.childId), familyId: String(task.familyId),
    createdByParentId: String(task.createdByParentId), attachmentMediaIds: ids(task.attachmentMediaIds),
    ...(task.confirmedByParentId ? { confirmedByParentId: String(task.confirmedByParentId) } : {}),
    parentConfirmed: task.status === 'confirmed', checklistVersion: task.checklistVersion ?? 0,
    checklistSnapshot: (task.checklistSnapshot || []).map(row => pick(row, ['itemId', 'label', 'required'])),
    completionVersion: task.completionVersion ?? 0, completionMediaIds: ids(evidence?.completionMediaIds),
    helpVersion: task.helpVersion ?? 0,
    helpRequest: task.helpRequest ? {
      ...pick(task.helpRequest, ['status', 'helpType', 'note', 'requestedAt', 'parentResponse', 'resolvedAt']),
      ...Object.fromEntries(['requestedByActor', 'resolvedByActor'].filter(k => task.helpRequest[k])
        .map(k => [k, { id: String(task.helpRequest[k].id), role: task.helpRequest[k].role }]))
    } : null,
    completionMediaReferenceState: task.completionMediaReferenceState || 'stable',
    completionEvidence: evidence ? {
      ...pick(evidence, EVIDENCE_FIELDS), checkedItemIds: [...(evidence.checkedItemIds || [])],
      completionMediaIds: ids(evidence.completionMediaIds),
      ...(evidence.subjectChildId ? { subjectChildId: String(evidence.subjectChildId) } : {}),
      ...(evidence.submittedByActor ? { submittedByActor: {
        id: String(evidence.submittedByActor.id), role: evidence.submittedByActor.role
      } } : {})
    } : null
  };
};

const createGrowthTaskCompletionReadService = ({ transactionRunner, now = Date.now,
  sourceReader = createLearningSourceReader({ TaskModel: Task }) } = {}) => {
  if (typeof transactionRunner !== 'function' || typeof now !== 'function') throw new TypeError('Read transaction runner and clock are required');
  const read = async work => {
    try {
      return await transactionRunner(async session => {
        if (!session?.inTransaction()) throw new Error('Read snapshot transaction is required');
        return work(session);
      });
    } catch (cause) {
      if (cause instanceof AppError && cause.statusCode < 500) throw cause;
      throw error(503, 'MEDIA_REFERENCE_PENDING');
    }
  };
  const identityCheck = identity => {
    if (!objectId(identity?.id) || !['parent', 'student'].includes(identity.role)) throw denied();
  };
  const authorize = async (identity, childId, session) => {
    identityCheck(identity);
    if (!objectId(childId)) throw denied();
    const access = await resolveChildAccess(identity, childId.toLowerCase(), {
      FamilyModel: { findOne: query => Family.findOne(query).session(session) },
      UserModel: { findOne: query => User.findOne(query).session(session) }
    });
    const actor = await User.findOne({ _id: identity.id, role: identity.role }).session(session).lean();
    if (!access || !actor || identity.role === 'student' && (!Number.isInteger(identity.tokenVersion)
      || actor.childProfile?.tokenVersion !== identity.tokenVersion)) throw denied();
    return access;
  };
  const detail = async ({ identity, taskId } = {}) => {
    const result = await read(async session => {
    identityCheck(identity);
    if (!objectId(taskId)) throw invalid();
    const task = await Task.findById(taskId).session(session).lean();
    if (!task) throw denied();
    const access = await authorize(identity, String(task.childId), session);
    if (String(access.familyId) !== String(task.familyId)) throw denied();
    return { success: true, data: { task: taskView(task) } };
    });
    // Resolve the source after the authorized snapshot, without holding a DB transaction over HTTP.
    Object.assign(result.data.task, await sourceReader.describe(result.data.task));
    return result;
  };
  const list = ({ identity, query = {} } = {}) => read(async session => {
    identityCheck(identity);
    if (!query || typeof query !== 'object' || Array.isArray(query)) throw invalid();
    const childId = query.childId === undefined && identity.role === 'student' ? identity.id : query.childId;
    if (childId === undefined) throw invalid();
    if (!objectId(childId)) throw invalid();
    const access = await authorize(identity, childId, session);
    const allowed = ['childId', 'status', 'dimension', 'scope', 'page', 'pageSize', 'helpStatus'];
    if (Object.keys(query).some(k => !allowed.includes(k) || typeof query[k] !== 'string' || query[k] === '')) throw invalid();
    const filter = { familyId: access.familyId, childId: childId.toLowerCase() };
    for (const [key, values] of [ ['status', ['pending', 'completed', 'confirmed', 'cancelled', 'archived']],
      ['dimension', ['moral', 'academic', 'physical', 'artistic', 'labor']] ]) {
      if (query[key] !== undefined) {
        if (!values.includes(query[key])) throw invalid();
        filter[key] = query[key];
      }
    }
    if (query.scope !== undefined) {
      if (!['today', 'week'].includes(query.scope)) throw invalid();
      const today = formatLocalDate(new Date(Number(now())), access.family.timezone);
      const range = query.scope === 'week' ? getWeekRange(today) : { start: today, end: today };
      filter.dueDate = { $gte: range.start, $lte: range.end };
    }
    if (query.helpStatus !== undefined) {
      if (!['pending', 'resolved'].includes(query.helpStatus)) throw invalid();
      filter['helpRequest.status'] = query.helpStatus;
      filter.$and = [{ status: { $nin: ['cancelled', 'archived'] } }];
    }
    let pagination;
    try { pagination = parsePagination(query); } catch (_cause) { throw invalid(); }
    if (![pagination.page, pagination.pageSize, pagination.skip].every(Number.isSafeInteger)) throw invalid();
    // Sequential operations share a snapshot; parallel commands on one session are unsupported.
    const tasks = await Task.find(filter).session(session).sort({ dueDate: 1, createdAt: 1, _id: 1 })
      .skip(pagination.skip).limit(pagination.pageSize).lean();
    const total = await Task.countDocuments(filter).session(session);
    return { success: true, data: { items: tasks.map(taskView), page: pagination.page, pageSize: pagination.pageSize, total } };
  });
  return { detail, list };
};
module.exports = { createGrowthTaskCompletionReadService, taskView };

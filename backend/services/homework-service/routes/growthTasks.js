const express = require('express');
const mongoose = require('mongoose');
const GrowthTask = require('../models/GrowthTask');
const User = require('../../../common/models/User');
const Family = require('../../../common/models/Family');
const { authenticateGateway } = require('../../../common/middleware/auth');
const { formatLocalDate, getWeekRange } = require('../../../common/utils/familyDate');
const { parsePagination, sendFamilyError } = require('../../../common/utils/familyResponse');
const { logFamilyOperation } = require('../../../common/utils/familyAudit');
const defaultStarAwardClient = require('../services/starAwardClient');
const {
  parseGrowthTaskCreate,
  parseGrowthTaskPatch
} = require('../services/growthTaskPatch');

const DIMENSIONS = ['moral', 'academic', 'physical', 'artistic', 'labor'];
const STATUSES = ['pending', 'completed', 'confirmed', 'cancelled', 'archived'];

const statusCodes = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'CHILD_ACCESS_DENIED',
  404: 'RESOURCE_NOT_FOUND',
  409: 'TASK_STATE_CONFLICT'
};
const sendError = (res, status, message, code = statusCodes[status] || 'INTERNAL_ERROR', details = []) => (
  sendFamilyError(res, status, code, message, details)
);
const sendMediaRecoveryError = (res, error) => {
  if (!error || !error.status || !error.code) return false;
  sendFamilyError(res, error.status, error.code, error.message, error.details || []);
  return true;
};

const safeObjectIdString = (value) => {
  if (!value) return undefined;
  const stringValue = value.toString();
  return mongoose.Types.ObjectId.isValid(stringValue) ? stringValue : undefined;
};

const mediaAuditResultForError = (error) => {
  if (!error || !error.code) return null;
  if (error.code === 'MEDIA_REFERENCE_PENDING') return 'pending';
  if (error.code === 'MEDIA_REFERENCE_CONFLICT' || error.code === 'TASK_STATE_CONFLICT') return 'conflict';
  if (error.code.startsWith('MEDIA_REFERENCE_')) return 'rejected';
  return null;
};

const mediaErrorTaskId = (error) => {
  const resourceId = error && error.details && !Array.isArray(error.details)
    ? error.details.resourceId
    : undefined;
  return safeObjectIdString(resourceId);
};

const logAttachmentMediaAudit = (req, context, result, overrides = {}) => {
  if (!context) return;
  const taskId = safeObjectIdString(overrides.taskId || context.taskId);
  const event = {
    operation: context.operation,
    result,
    familyId: context.familyId,
    childId: context.childId,
    mediaIds: overrides.mediaIds || context.mediaIds || []
  };
  if (taskId) {
    event.taskId = taskId;
  }
  logFamilyOperation(req, event);
};

const logAttachmentMediaError = (req, context, error) => {
  const result = mediaAuditResultForError(error);
  if (!result) return;
  logAttachmentMediaAudit(req, context, result, {
    taskId: mediaErrorTaskId(error)
  });
};

const taskView = (task) => ({
  taskId: task._id.toString(),
  childId: task.childId.toString(),
  familyId: task.familyId.toString(),
  createdByParentId: task.createdByParentId.toString(),
  dimension: task.dimension,
  area: task.area,
  subject: task.subject,
  title: task.title,
  taskType: task.taskType,
  description: task.description,
  dueDate: task.dueDate,
  estimatedMinutes: task.estimatedMinutes,
  actualMinutes: task.actualMinutes,
  targetAmount: task.targetAmount,
  actualAmount: task.actualAmount,
  unit: task.unit,
  priority: task.priority,
  status: task.status,
  difficulty: task.difficulty,
  needsHelp: task.needsHelp,
  childNote: task.childNote,
  parentFeedback: task.parentFeedback,
  attachmentMediaIds: (task.attachmentMediaIds || []).map((id) => id.toString()),
  completedAt: task.completedAt,
  confirmedAt: task.confirmedAt,
  confirmedByParentId: task.confirmedByParentId ? task.confirmedByParentId.toString() : undefined,
  starAwardState: task.starAwardState,
  cancelledAt: task.cancelledAt,
  parentConfirmed: task.status === 'confirmed'
});

const findParentFamily = (parentId) => Family.findOne({
  $or: [
    { ownerParentId: parentId },
    { memberParentIds: parentId }
  ]
});

const assertParentOwnsChild = async (parentId, childId) => {
  if (!mongoose.Types.ObjectId.isValid(parentId)
    || !mongoose.Types.ObjectId.isValid(childId)) {
    return null;
  }

  const family = await findParentFamily(parentId);
  if (!family || !family.childIds.some((id) => id.toString() === childId)) {
    return null;
  }

  const child = await User.findOne({
    _id: childId,
    role: 'student',
    familyId: family._id
  });

  return child ? { family, child } : null;
};

const assertUserCanAccessChild = async (user, childId) => {
  if (!user || !mongoose.Types.ObjectId.isValid(childId)) {
    return null;
  }

  if (user.role === 'student') {
    if (user.id !== childId) {
      return null;
    }

    const child = await User.findOne({ _id: childId, role: 'student' });
    return child && child.familyId
      ? { familyId: child.familyId, child }
      : null;
  }

  if (user.role === 'parent') {
    const ownedChild = await assertParentOwnsChild(user.id, childId);
    return ownedChild
      ? { familyId: ownedChild.family._id, child: ownedChild.child }
      : null;
  }

  return null;
};

const getDateRangeForScope = (scope, timezone, now = new Date(Date.now())) => {
  const today = formatLocalDate(now, timezone);
  if (scope === 'today') {
    return { start: today, end: today };
  }

  if (scope === 'week') {
    return getWeekRange(today);
  }

  return null;
};

const createGrowthTaskRouter = ({
  awardTaskStar = defaultStarAwardClient.awardTaskStar,
  attachmentMediaService = null
} = {}) => {
  const router = express.Router();
  const resumePendingAttachmentMedia = async (task) => {
    if (!attachmentMediaService || !task || task.mediaReferenceState !== 'pending') {
      return task;
    }
    return attachmentMediaService.resume(task._id.toString());
  };

router.post('/', authenticateGateway, async (req, res) => {
  let attachmentAuditContext;
  try {
    if (req.user.role !== 'parent') {
      return sendError(res, 403, 'Only parents can create growth tasks');
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'repeatRule')) {
      return sendError(res, 400, 'repeatRule is not supported in the MVP', 'REPEAT_RULE_NOT_SUPPORTED');
    }
    const parsed = parseGrowthTaskCreate(req.body);
    if (parsed.hasAttachmentMutation && !attachmentMediaService) {
      return sendError(res, 400, 'Private media is not enabled yet', 'MEDIA_NOT_ENABLED');
    }

    const ownership = await assertParentOwnsChild(req.user.id, parsed.taskInput.childId);
    if (!ownership) {
      return sendError(res, 403, 'Cannot create a task for another family child');
    }

    const taskInput = {
      ...parsed.taskInput,
      familyId: ownership.family._id,
      createdByParentId: req.user.id
    };
    if (parsed.hasAttachmentMutation) {
      attachmentAuditContext = {
        operation: 'task.attachments.create',
        familyId: ownership.family._id.toString(),
        childId: ownership.child._id.toString(),
        mediaIds: parsed.attachmentMediaIds || []
      };
    }
    const task = attachmentMediaService
      ? await attachmentMediaService.create({
        taskInput,
        attachmentMediaIds: parsed.attachmentMediaIds || []
      })
      : await GrowthTask.create(taskInput);

    if (parsed.hasAttachmentMutation) {
      logAttachmentMediaAudit(req, attachmentAuditContext, 'bound', {
        taskId: task._id.toString(),
        mediaIds: (task.attachmentMediaIds || []).map((id) => id.toString())
      });
    }

    return res.status(201).json({
      success: true,
      data: { task: taskView(task) }
    });
  } catch (error) {
    logAttachmentMediaError(req, attachmentAuditContext, error);
    if (sendMediaRecoveryError(res, error)) return undefined;
    if (error.name === 'ValidationError' || error.name === 'CastError' || error.code === 'VALIDATION_ERROR') {
      return sendError(res, 400, error.message, error.code || 'VALIDATION_ERROR', error.details || []);
    }
    return sendError(res, 500, 'Failed to create growth task');
  }
});

router.get('/', authenticateGateway, async (req, res) => {
  try {
    const childId = req.user.role === 'student' ? req.user.id : req.query.childId;
    if (!childId) {
      return sendError(res, 400, 'childId is required');
    }

    const access = await assertUserCanAccessChild(req.user, childId);
    if (!access) {
      return sendError(res, 403, 'Cannot access this child');
    }

    const query = {
      childId,
      familyId: access.familyId
    };

    if (req.query.status) {
      if (!STATUSES.includes(req.query.status)) {
        return sendError(res, 400, 'Invalid status');
      }
      query.status = req.query.status;
    }
    if (req.query.dimension) {
      if (!DIMENSIONS.includes(req.query.dimension)) {
        return sendError(res, 400, 'Invalid dimension');
      }
      query.dimension = req.query.dimension;
    }

    if (req.query.scope && !['today', 'week'].includes(req.query.scope)) {
      return sendError(res, 400, 'Invalid scope');
    }
    const family = await Family.findById(access.familyId).select('timezone');
    if (!family) return sendError(res, 404, 'Family not found');
    const dateRange = getDateRangeForScope(req.query.scope, family.timezone);
    if (dateRange) {
      query.dueDate = {
        $gte: dateRange.start,
        $lte: dateRange.end
      };
    }

    let pagination;
    try {
      pagination = parsePagination(req.query);
    } catch (error) {
      return sendError(res, 400, error.message, error.code);
    }
    const [tasks, total] = await Promise.all([
      GrowthTask.find(query)
        .sort({ dueDate: 1, createdAt: 1 })
        .skip(pagination.skip)
        .limit(pagination.pageSize),
      GrowthTask.countDocuments(query)
    ]);
    const items = tasks.map(taskView);

    return res.json({
      success: true,
      data: {
        items,
        page: pagination.page,
        pageSize: pagination.pageSize,
        total
      }
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
});

router.get('/:taskId', authenticateGateway, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.taskId)) {
      return sendError(res, 400, 'Invalid taskId');
    }

    const task = await GrowthTask.findById(req.params.taskId);
    if (!task) {
      return sendError(res, 404, 'Growth task not found');
    }

    const access = await assertUserCanAccessChild(req.user, task.childId.toString());
    if (!access || access.familyId.toString() !== task.familyId.toString()) {
      return sendError(res, 403, 'Cannot access this task');
    }

    const activeTask = await resumePendingAttachmentMedia(task);
    return res.json({
      success: true,
      data: { task: taskView(activeTask) }
    });
  } catch (error) {
    if (sendMediaRecoveryError(res, error)) return undefined;
    return sendError(res, 500, error.message);
  }
});

router.patch('/:taskId/complete', authenticateGateway, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.taskId)) {
      return sendError(res, 400, 'Invalid taskId');
    }

    const task = await GrowthTask.findById(req.params.taskId);
    if (!task) {
      return sendError(res, 404, 'Growth task not found');
    }

    const access = await assertUserCanAccessChild(req.user, task.childId.toString());
    if (!access || access.familyId.toString() !== task.familyId.toString()) {
      return sendError(res, 403, 'Cannot complete this task');
    }
    const activeTask = await resumePendingAttachmentMedia(task);
    if (activeTask.status === 'confirmed' || activeTask.status === 'cancelled' || activeTask.status === 'archived') {
      return sendError(res, 409, 'Task can no longer be completed');
    }

    const allowedFields = [
      'actualMinutes',
      'actualAmount',
      'difficulty',
      'needsHelp',
      'childNote'
    ];
    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        activeTask[field] = req.body[field];
      }
    });
    activeTask.status = 'completed';
    activeTask.completedAt = new Date();
    await activeTask.save();

    return res.json({
      success: true,
      data: { task: taskView(activeTask) }
    });
  } catch (error) {
    if (sendMediaRecoveryError(res, error)) return undefined;
    if (error.name === 'ValidationError') {
      return sendError(res, 400, error.message);
    }
    return sendError(res, 500, error.message);
  }
});

router.patch('/:taskId/confirm', authenticateGateway, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return sendError(res, 403, 'Only parents can confirm growth tasks');
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.taskId)) {
      return sendError(res, 400, 'Invalid taskId');
    }

    const task = await GrowthTask.findById(req.params.taskId);
    if (!task) {
      return sendError(res, 404, 'Growth task not found');
    }

    const ownership = await assertParentOwnsChild(req.user.id, task.childId.toString());
    if (!ownership || ownership.family._id.toString() !== task.familyId.toString()) {
      return sendError(res, 403, 'Cannot confirm another family task');
    }
    const activeTask = await resumePendingAttachmentMedia(task);
    let confirmation = activeTask;
    if (activeTask.status === 'completed' && (!activeTask.starAwardState || activeTask.starAwardState === 'not_applicable')) {
      confirmation = await GrowthTask.findOneAndUpdate(
        {
          _id: activeTask._id,
          familyId: activeTask.familyId,
          childId: activeTask.childId,
          status: 'completed',
          starAwardState: { $in: ['not_applicable', null] }
        },
        {
          $set: {
            status: 'confirmed',
            parentFeedback: req.body.parentFeedback || '',
            confirmedAt: new Date(),
            confirmedByParentId: req.user.id,
            starAwardState: 'pending'
          }
        },
        { new: true, runValidators: true }
      );
      if (!confirmation) confirmation = await GrowthTask.findById(activeTask._id);
    }

    if (confirmation.status === 'confirmed' && confirmation.starAwardState === 'awarded') {
      logFamilyOperation(req, {
        operation: 'task.confirm', result: 'already_awarded',
        familyId: confirmation.familyId.toString(), childId: confirmation.childId.toString(),
        taskId: confirmation._id.toString()
      });
      return res.json({ success: true, data: { task: taskView(confirmation) } });
    }
    if (confirmation.status !== 'confirmed' || confirmation.starAwardState !== 'pending') {
      return sendError(res, 409, 'Only completed tasks can be confirmed');
    }

    let starAward;
    try {
      starAward = await awardTaskStar({
        familyId: confirmation.familyId.toString(),
        childId: confirmation.childId.toString(),
        taskId: confirmation._id.toString(),
        confirmedByParentId: req.user.id.toString()
      });
    } catch (error) {
      logFamilyOperation(req, {
        operation: 'task.confirm', result: 'star_award_pending',
        familyId: confirmation.familyId.toString(), childId: confirmation.childId.toString(),
        taskId: confirmation._id.toString()
      });
      return sendError(res, 503, 'Star award is pending', 'STAR_AWARD_PENDING');
    }

    let awardedTask;
    try {
      awardedTask = await GrowthTask.findOneAndUpdate(
        { _id: confirmation._id, status: 'confirmed', starAwardState: 'pending' },
        { $set: { starAwardState: 'awarded' } },
        { new: true, runValidators: true }
      );
    } catch (error) {
      logFamilyOperation(req, {
        operation: 'task.confirm', result: 'star_state_pending',
        familyId: confirmation.familyId.toString(), childId: confirmation.childId.toString(),
        taskId: confirmation._id.toString()
      });
      return sendError(res, 503, 'Star award is pending', 'STAR_AWARD_PENDING');
    }
    if (!awardedTask) {
      awardedTask = await GrowthTask.findById(confirmation._id);
      if (!awardedTask || awardedTask.starAwardState !== 'awarded') {
        logFamilyOperation(req, {
          operation: 'task.confirm', result: 'star_state_pending',
          familyId: confirmation.familyId.toString(), childId: confirmation.childId.toString(),
          taskId: confirmation._id.toString()
        });
        return sendError(res, 503, 'Star award is pending', 'STAR_AWARD_PENDING');
      }
    }

    logFamilyOperation(req, {
      operation: 'task.confirm', result: starAward.awarded ? 'awarded' : 'replayed',
      familyId: awardedTask.familyId.toString(), childId: awardedTask.childId.toString(),
      taskId: awardedTask._id.toString()
    });

    return res.json({
      success: true,
      data: { task: taskView(awardedTask), starAward }
    });
  } catch (error) {
    if (sendMediaRecoveryError(res, error)) return undefined;
    return sendError(res, 500, error.message);
  }
});

router.patch('/:taskId', authenticateGateway, async (req, res) => {
  let attachmentAuditContext;
  try {
    if (req.user.role !== 'parent') {
      return sendError(res, 403, 'Only parents can edit growth tasks');
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'repeatRule')) {
      return sendError(res, 400, 'repeatRule is not supported in the MVP', 'REPEAT_RULE_NOT_SUPPORTED');
    }
    const parsed = parseGrowthTaskPatch(req.body);
    if (parsed.hasAttachmentMutation && !attachmentMediaService) {
      return sendError(res, 400, 'Private media is not enabled yet', 'MEDIA_NOT_ENABLED');
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.taskId)) {
      return sendError(res, 400, 'Invalid taskId');
    }

    const task = await GrowthTask.findById(req.params.taskId);
    if (!task) {
      return sendError(res, 404, 'Growth task not found');
    }

    const ownership = await assertParentOwnsChild(req.user.id, task.childId.toString());
    if (!ownership || ownership.family._id.toString() !== task.familyId.toString()) {
      return sendError(res, 403, 'Cannot edit another family task');
    }
    if (task.status !== 'pending') {
      return sendError(res, 409, 'Only pending tasks can be edited');
    }

    if (parsed.hasAttachmentMutation) {
      attachmentAuditContext = {
        operation: 'task.attachments.patch',
        familyId: task.familyId.toString(),
        childId: task.childId.toString(),
        taskId: task._id.toString(),
        mediaIds: parsed.attachmentMediaIds || []
      };
    }

    let updatedTask;
    if (attachmentMediaService) {
      updatedTask = await attachmentMediaService.mutate({
        task,
        taskPatch: parsed.entries,
        attachmentMediaIds: parsed.attachmentMediaIds
      });
    } else {
      parsed.entries.forEach((entry) => {
        task[entry.path] = entry.value;
      });
      await task.save();
      updatedTask = task;
    }

    if (parsed.hasAttachmentMutation) {
      logAttachmentMediaAudit(req, attachmentAuditContext, 'bound', {
        taskId: task._id.toString(),
        mediaIds: (updatedTask.attachmentMediaIds || []).map((id) => id.toString())
      });
    }

    return res.json({
      success: true,
      data: { task: taskView(updatedTask) }
    });
  } catch (error) {
    logAttachmentMediaError(req, attachmentAuditContext, error);
    if (sendMediaRecoveryError(res, error)) return undefined;
    if (error.name === 'ValidationError' || error.name === 'CastError' || error.code === 'VALIDATION_ERROR') {
      return sendError(res, 400, error.message, error.code || 'VALIDATION_ERROR', error.details || []);
    }
    return sendError(res, 500, 'Failed to update growth task');
  }
});

router.delete('/:taskId', authenticateGateway, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return sendError(res, 403, 'Only parents can delete growth tasks');
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.taskId)) {
      return sendError(res, 400, 'Invalid taskId');
    }

    const task = await GrowthTask.findById(req.params.taskId);
    if (!task) {
      return sendError(res, 404, 'Growth task not found');
    }

    const ownership = await assertParentOwnsChild(req.user.id, task.childId.toString());
    if (!ownership || ownership.family._id.toString() !== task.familyId.toString()) {
      return sendError(res, 403, 'Cannot delete another family task');
    }

    const activeTask = await resumePendingAttachmentMedia(task);
    if (activeTask.status === 'pending') {
      activeTask.status = 'cancelled';
      activeTask.cancelledAt = new Date();
      await activeTask.save();
      return res.json({
        success: true,
        data: { deleted: false, task: taskView(activeTask) }
      });
    }

    if (activeTask.status === 'cancelled' || activeTask.status === 'archived') {
      return res.json({
        success: true,
        data: { deleted: false, task: taskView(activeTask) }
      });
    }

    activeTask.status = 'archived';
    await activeTask.save();
    return res.json({
      success: true,
      data: { task: taskView(activeTask) }
    });
  } catch (error) {
    if (sendMediaRecoveryError(res, error)) return undefined;
    return sendError(res, 500, error.message);
  }
});

  return router;
};

const router = createGrowthTaskRouter();
module.exports = router;
module.exports.createGrowthTaskRouter = createGrowthTaskRouter;
module.exports.assertParentOwnsChild = assertParentOwnsChild;
module.exports.assertUserCanAccessChild = assertUserCanAccessChild;
module.exports.getDateRangeForScope = getDateRangeForScope;

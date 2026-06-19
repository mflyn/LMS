const express = require('express');
const mongoose = require('mongoose');
const GrowthTask = require('../models/GrowthTask');
const User = require('../../../common/models/User');
const Family = require('../../../common/models/Family');
const { authenticateGateway } = require('../../../common/middleware/auth');
const { formatLocalDate, getWeekRange } = require('../../../common/utils/familyDate');
const { parsePagination, sendFamilyError } = require('../../../common/utils/familyResponse');
const defaultStarAwardClient = require('../services/starAwardClient');

const DIMENSIONS = ['moral', 'academic', 'physical', 'artistic', 'labor'];
const STATUSES = ['pending', 'completed', 'confirmed', 'cancelled', 'archived'];

const statusCodes = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'CHILD_ACCESS_DENIED',
  404: 'RESOURCE_NOT_FOUND',
  409: 'TASK_STATE_CONFLICT'
};
const sendError = (res, status, message, code = statusCodes[status] || 'INTERNAL_ERROR') => (
  sendFamilyError(res, status, code, message)
);

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
  attachments: task.attachments,
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

const createGrowthTaskRouter = ({ awardTaskStar = defaultStarAwardClient.awardTaskStar } = {}) => {
  const router = express.Router();

router.post('/', authenticateGateway, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return sendError(res, 403, 'Only parents can create growth tasks');
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'repeatRule')) {
      return sendError(res, 400, 'repeatRule is not supported in the MVP', 'REPEAT_RULE_NOT_SUPPORTED');
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'attachments')
      || Object.prototype.hasOwnProperty.call(req.body, 'attachmentMediaIds')) {
      return sendError(res, 400, 'Private media is not enabled yet', 'MEDIA_NOT_ENABLED');
    }

    const { childId, dimension, title, taskType, dueDate } = req.body;
    if (!childId || !DIMENSIONS.includes(dimension) || !title || !taskType || !dueDate) {
      return sendError(res, 400, 'childId, dimension, title, taskType and dueDate are required');
    }

    const ownership = await assertParentOwnsChild(req.user.id, childId);
    if (!ownership) {
      return sendError(res, 403, 'Cannot create a task for another family child');
    }

    const task = await GrowthTask.create({
      childId,
      familyId: ownership.family._id,
      createdByParentId: req.user.id,
      dimension,
      area: req.body.area,
      subject: req.body.subject,
      title,
      taskType,
      description: req.body.description,
      dueDate,
      estimatedMinutes: req.body.estimatedMinutes,
      targetAmount: req.body.targetAmount,
      unit: req.body.unit,
      priority: req.body.priority
    });

    return res.status(201).json({
      success: true,
      data: { task: taskView(task) }
    });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return sendError(res, 400, error.message);
    }
    return sendError(res, 500, error.message);
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

    return res.json({
      success: true,
      data: { task: taskView(task) }
    });
  } catch (error) {
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
    if (task.status === 'confirmed' || task.status === 'cancelled' || task.status === 'archived') {
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
        task[field] = req.body[field];
      }
    });
    task.status = 'completed';
    task.completedAt = new Date();
    await task.save();

    return res.json({
      success: true,
      data: { task: taskView(task) }
    });
  } catch (error) {
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
    let confirmation = task;
    if (task.status === 'completed' && (!task.starAwardState || task.starAwardState === 'not_applicable')) {
      confirmation = await GrowthTask.findOneAndUpdate(
        {
          _id: task._id,
          familyId: task.familyId,
          childId: task.childId,
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
      if (!confirmation) confirmation = await GrowthTask.findById(task._id);
    }

    if (confirmation.status === 'confirmed' && confirmation.starAwardState === 'awarded') {
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
      return sendError(res, 503, 'Star award is pending', 'STAR_AWARD_PENDING');
    }
    if (!awardedTask) {
      awardedTask = await GrowthTask.findById(confirmation._id);
      if (!awardedTask || awardedTask.starAwardState !== 'awarded') {
        return sendError(res, 503, 'Star award is pending', 'STAR_AWARD_PENDING');
      }
    }

    return res.json({
      success: true,
      data: { task: taskView(awardedTask), starAward }
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
});

router.patch('/:taskId', authenticateGateway, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return sendError(res, 403, 'Only parents can edit growth tasks');
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'repeatRule')) {
      return sendError(res, 400, 'repeatRule is not supported in the MVP', 'REPEAT_RULE_NOT_SUPPORTED');
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'attachments')
      || Object.prototype.hasOwnProperty.call(req.body, 'attachmentMediaIds')) {
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

    const allowedFields = [
      'dimension',
      'area',
      'subject',
      'title',
      'taskType',
      'description',
      'dueDate',
      'estimatedMinutes',
      'targetAmount',
      'unit',
      'priority'
    ];
    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        task[field] = req.body[field];
      }
    });
    await task.save();

    return res.json({
      success: true,
      data: { task: taskView(task) }
    });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return sendError(res, 400, error.message);
    }
    return sendError(res, 500, error.message);
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

    if (task.status === 'pending') {
      task.status = 'cancelled';
      task.cancelledAt = new Date();
      await task.save();
      return res.json({
        success: true,
        data: { deleted: false, task: taskView(task) }
      });
    }

    if (task.status === 'cancelled' || task.status === 'archived') {
      return res.json({
        success: true,
        data: { deleted: false, task: taskView(task) }
      });
    }

    task.status = 'archived';
    await task.save();
    return res.json({
      success: true,
      data: { task: taskView(task) }
    });
  } catch (error) {
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

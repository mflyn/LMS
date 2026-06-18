const express = require('express');
const mongoose = require('mongoose');
const GrowthTask = require('../models/GrowthTask');
const User = require('../../../common/models/User');
const Family = require('../../../common/models/Family');
const { authenticateGateway } = require('../../../common/middleware/auth');

const router = express.Router();
const DIMENSIONS = ['moral', 'academic', 'physical', 'artistic', 'labor'];

const sendError = (res, status, message) => res.status(status).json({
  success: false,
  message
});

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
  repeatRule: task.repeatRule,
  status: task.status,
  difficulty: task.difficulty,
  needsHelp: task.needsHelp,
  childNote: task.childNote,
  parentFeedback: task.parentFeedback,
  attachments: task.attachments,
  completedAt: task.completedAt,
  confirmedAt: task.confirmedAt,
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

const getDateRangeForScope = (scope, now = new Date()) => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (scope === 'today') {
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  if (scope === 'week') {
    const mondayOffset = start.getDay() === 0 ? -6 : 1 - start.getDay();
    start.setDate(start.getDate() + mondayOffset);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }

  return null;
};

router.post('/', authenticateGateway, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return sendError(res, 403, 'Only parents can create growth tasks');
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
      priority: req.body.priority,
      repeatRule: req.body.repeatRule,
      attachments: req.body.attachments
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
      query.status = req.query.status;
    }
    if (req.query.dimension) {
      if (!DIMENSIONS.includes(req.query.dimension)) {
        return sendError(res, 400, 'Invalid dimension');
      }
      query.dimension = req.query.dimension;
    }

    const dateRange = getDateRangeForScope(req.query.scope);
    if (dateRange) {
      query.dueDate = {
        $gte: dateRange.start,
        $lt: dateRange.end
      };
    }

    const tasks = await GrowthTask.find(query).sort({ dueDate: 1, createdAt: 1 });
    const items = tasks.map(taskView);

    return res.json({
      success: true,
      data: {
        items,
        total: items.length
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
    if (task.status === 'confirmed' || task.status === 'archived') {
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
    if (task.status !== 'completed') {
      return sendError(res, 409, 'Only completed tasks can be confirmed');
    }

    task.status = 'confirmed';
    task.parentFeedback = req.body.parentFeedback || '';
    task.confirmedAt = new Date();
    await task.save();

    return res.json({
      success: true,
      data: { task: taskView(task) }
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
      'priority',
      'repeatRule',
      'attachments'
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
      await task.deleteOne();
      return res.json({ success: true, data: { deleted: true } });
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

module.exports = router;
module.exports.assertParentOwnsChild = assertParentOwnsChild;
module.exports.assertUserCanAccessChild = assertUserCanAccessChild;
module.exports.getDateRangeForScope = getDateRangeForScope;

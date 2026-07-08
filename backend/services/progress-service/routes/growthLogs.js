const express = require('express');
const mongoose = require('mongoose');
const GrowthLog = require('../models/GrowthLog');
const { authenticateGateway } = require('../../../common/middleware/auth');
const { parsePagination, sendFamilyError } = require('../../../common/utils/familyResponse');
const { logFamilyOperation } = require('../../../common/utils/familyAudit');
const { resolveChildAccess } = require('../services/growthAccess');

const router = express.Router();
const DIMENSIONS = ['moral', 'academic', 'physical', 'artistic', 'labor'];
const CHILD_FIELDS = [
  'content', 'durationMinutes', 'amount', 'unit', 'completedTaskIds',
  'focusLevel', 'difficulty', 'physicalState', 'mood', 'childReflection'
];
const PARENT_FIELDS = [
  ...CHILD_FIELDS, 'date', 'dimension', 'area', 'subject', 'parentNote'
];
const CREATE_FIELDS = ['childId', 'date', 'dimension', 'area', 'subject', ...CHILD_FIELDS, 'parentNote'];
const CHILD_CREATE_FIELDS = ['childId', 'date', 'dimension', 'area', 'subject', ...CHILD_FIELDS];

const sendError = (res, status, code, message) => sendFamilyError(res, status, code, message);
const hasForbiddenField = (body, allowed) => Object.keys(body).some((field) => !allowed.includes(field));
const isValidLocalDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.toISOString().slice(0, 10) === value;
};
const logView = (log) => ({
  logId: log._id.toString(),
  familyId: log.familyId.toString(),
  childId: log.childId.toString(),
  date: log.date,
  dimension: log.dimension,
  area: log.area,
  subject: log.subject,
  content: log.content,
  durationMinutes: log.durationMinutes,
  amount: log.amount,
  unit: log.unit,
  completedTaskIds: log.completedTaskIds.map((id) => id.toString()),
  focusLevel: log.focusLevel,
  difficulty: log.difficulty,
  physicalState: log.physicalState,
  mood: log.mood,
  childReflection: log.childReflection,
  parentNote: log.parentNote,
  createdBy: log.createdBy.toString(),
  updatedBy: log.updatedBy.toString(),
  createdAt: log.createdAt,
  updatedAt: log.updatedAt
});

router.post('/', authenticateGateway, async (req, res) => {
  try {
    const allowed = req.user.role === 'student' ? CHILD_CREATE_FIELDS : CREATE_FIELDS;
    if (!['parent', 'student'].includes(req.user.role)) {
      return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Role cannot create growth logs');
    }
    if (hasForbiddenField(req.body, allowed)) {
      return sendError(res, 403, 'FIELD_ACCESS_DENIED', 'Request contains fields not allowed for this role');
    }
    if (req.user.role === 'student' && req.body.childId
      && req.body.childId.toString() !== (req.user.childId || req.user.id).toString()) {
      return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot create a log for another child');
    }
    const childId = req.user.role === 'student' ? req.user.childId || req.user.id : req.body.childId;
    if (!childId || !req.body.date || !req.body.dimension || !req.body.content) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'childId, date, dimension and content are required');
    }
    const access = await resolveChildAccess(req.user, childId);
    if (!access) return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot access this child');

    const data = {};
    allowed.filter((field) => field !== 'childId').forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) data[field] = req.body[field];
    });
    const log = await GrowthLog.create({
      ...data,
      familyId: access.familyId,
      childId,
      createdBy: req.user.id,
      updatedBy: req.user.id
    });
    logFamilyOperation(req, {
      operation: 'growth_log.create', result: 'created', familyId: log.familyId.toString(),
      childId: log.childId.toString(), logId: log._id.toString()
    });
    return res.status(201).json({ success: true, data: { log: logView(log) } });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return sendError(res, 400, 'VALIDATION_ERROR', error.message);
    }
    return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
});

router.get('/', authenticateGateway, async (req, res) => {
  try {
    if (req.user.role === 'student' && req.query.childId
      && req.query.childId.toString() !== (req.user.childId || req.user.id).toString()) {
      return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot list another child growth logs');
    }
    const childId = req.user.role === 'student' ? req.user.childId || req.user.id : req.query.childId;
    if (!childId) return sendError(res, 400, 'VALIDATION_ERROR', 'childId is required');
    const access = await resolveChildAccess(req.user, childId);
    if (!access) return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot access this child');
    if (req.query.dimension && !DIMENSIONS.includes(req.query.dimension)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid dimension');
    }
    if (req.query.from && !isValidLocalDate(req.query.from)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid from date');
    }
    if (req.query.to && !isValidLocalDate(req.query.to)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid to date');
    }
    if (req.query.from && req.query.to && req.query.from > req.query.to) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'from must not be later than to');
    }

    let pagination;
    try {
      pagination = parsePagination(req.query);
    } catch (error) {
      return sendError(res, 400, error.code, error.message);
    }
    const query = { familyId: access.familyId, childId };
    if (req.query.dimension) query.dimension = req.query.dimension;
    if (req.query.from || req.query.to) {
      query.date = {};
      if (req.query.from) query.date.$gte = req.query.from;
      if (req.query.to) query.date.$lte = req.query.to;
    }
    const [logs, total] = await Promise.all([
      GrowthLog.find(query).sort({ date: -1, createdAt: -1 })
        .skip(pagination.skip).limit(pagination.pageSize),
      GrowthLog.countDocuments(query)
    ]);
    return res.json({
      success: true,
      data: {
        items: logs.map(logView),
        page: pagination.page,
        pageSize: pagination.pageSize,
        total
      }
    });
  } catch (error) {
    return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
});

router.patch('/:logId', authenticateGateway, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.logId)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid logId');
    }
    const log = await GrowthLog.findById(req.params.logId);
    if (!log) return sendError(res, 404, 'RESOURCE_NOT_FOUND', 'Growth log not found');
    const access = await resolveChildAccess(req.user, log.childId.toString());
    if (!access || access.familyId.toString() !== log.familyId.toString()) {
      return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot access this growth log');
    }
    const allowed = req.user.role === 'student' ? CHILD_FIELDS : PARENT_FIELDS;
    if (hasForbiddenField(req.body, allowed)) {
      return sendError(res, 403, 'FIELD_ACCESS_DENIED', 'Request contains fields not allowed for this role');
    }
    allowed.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) log[field] = req.body[field];
    });
    log.updatedBy = req.user.id;
    await log.save();
    logFamilyOperation(req, {
      operation: 'growth_log.update', result: 'updated', familyId: log.familyId.toString(),
      childId: log.childId.toString(), logId: log._id.toString()
    });
    return res.json({ success: true, data: { log: logView(log) } });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return sendError(res, 400, 'VALIDATION_ERROR', error.message);
    }
    return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
});

module.exports = router;
module.exports.logView = logView;

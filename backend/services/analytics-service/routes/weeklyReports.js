const express = require('express');
const mongoose = require('mongoose');

const { authenticateGateway } = require('../../../common/middleware/auth');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const { createFamilyReadRepository } = require('../../../common/repositories/familyReadRepository');
const { logFamilyOperation } = require('../../../common/utils/familyAudit');
const { sendFamilyError } = require('../../../common/utils/familyResponse');
const WeeklyReport = require('../models/WeeklyReport');
const { createWeeklyReportService, WeeklyReportError } = require('../services/weeklyReportService');

const FEEDBACK_FIELDS = ['parentNote', 'nextWeekSuggestion'];
const FORBIDDEN_FEEDBACK_FIELDS = [
  'statistics',
  'generatedSuggestion',
  'sourceCutoffAt',
  'generatedAt',
  'frozen',
  'weekStart',
  'weekEnd',
  'familyId',
  'childId'
];

const sendError = (res, status, code, message, details) => sendFamilyError(res, status, code, message, details);
const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const objectIdString = (value) => (value ? value.toString() : undefined);

const reportView = (report) => ({
  reportId: objectIdString(report._id),
  familyId: objectIdString(report.familyId),
  childId: objectIdString(report.childId),
  weekStart: report.weekStart,
  weekEnd: report.weekEnd,
  timezone: report.timezone,
  statistics: report.statistics,
  generatedSuggestion: report.generatedSuggestion,
  nextWeekSuggestion: report.nextWeekSuggestion,
  parentNote: report.parentNote,
  sourceCutoffAt: report.sourceCutoffAt,
  generatedAt: report.generatedAt,
  frozen: report.frozen,
  feedbackUpdatedBy: objectIdString(report.feedbackUpdatedBy),
  feedbackUpdatedAt: report.feedbackUpdatedAt,
  createdAt: report.createdAt,
  updatedAt: report.updatedAt
});

const resolveChildAccess = async (identity, requestedChildId) => {
  if (!identity) return null;

  if (identity.role === 'student') {
    const identityChildId = identity.childId || identity.id;
    if (!isObjectId(identityChildId)) return null;
    if (requestedChildId && requestedChildId.toString() !== identityChildId.toString()) return null;
    if (identity.id && identity.id.toString() !== identityChildId.toString()) return null;

    const child = await User.findOne({ _id: identityChildId, role: 'student' });
    if (!child || !child.familyId) return null;
    if (identity.familyId && child.familyId.toString() !== identity.familyId.toString()) return null;
    const family = await Family.findOne({ _id: child.familyId, childIds: child._id });
    return family ? { familyId: family._id, family, child } : null;
  }

  if (identity.role !== 'parent' || !isObjectId(identity.id) || !isObjectId(requestedChildId)) return null;
  const family = await Family.findOne({
    $or: [{ ownerParentId: identity.id }, { memberParentIds: identity.id }],
    childIds: requestedChildId
  });
  if (!family) return null;
  const child = await User.findOne({ _id: requestedChildId, role: 'student', familyId: family._id });
  return child ? { familyId: family._id, family, child } : null;
};

const sendServiceError = (res, error) => {
  if (error instanceof WeeklyReportError || (error && error.status && error.code)) {
    sendError(res, error.status, error.code, error.message, error.details || []);
    return true;
  }
  if (error && (error.name === 'ValidationError' || error.name === 'CastError')) {
    sendError(res, 400, 'VALIDATION_ERROR', error.message);
    return true;
  }
  return false;
};

const parseFeedbackPatch = (body = {}) => {
  const keys = Object.keys(body);
  if (keys.some((key) => FORBIDDEN_FEEDBACK_FIELDS.includes(key) || !FEEDBACK_FIELDS.includes(key))) {
    const error = new Error('Only feedback fields can be updated');
    error.status = 403;
    error.code = 'FIELD_ACCESS_DENIED';
    throw error;
  }
  const patch = {};
  FEEDBACK_FIELDS.forEach((field) => {
    if (body[field] === undefined) return;
    if (typeof body[field] !== 'string' || body[field].length > 1000) {
      const error = new Error(`${field} must be a string of at most 1000 characters`);
      error.status = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    patch[field] = body[field].trim();
  });
  if (Object.keys(patch).length === 0) {
    const error = new Error('At least one feedback field is required');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return patch;
};

const createDefaultWeeklyReportService = (connection) => createWeeklyReportService({
  WeeklyReportModel: WeeklyReport,
  repository: createFamilyReadRepository({ connection })
});

const createWeeklyReportsRouter = ({
  WeeklyReportModel = WeeklyReport,
  weeklyReportService = createDefaultWeeklyReportService(mongoose.connection),
  now = () => new Date()
} = {}) => {
  const router = express.Router();

  router.get('/', authenticateGateway, async (req, res, next) => {
    try {
      const access = await resolveChildAccess(req.user, req.query.childId);
      if (!access) return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot access this child');

      const report = await weeklyReportService.generateOrRead({
        user: { ...req.user, familyId: access.familyId.toString() },
        childId: access.child._id.toString(),
        weekStart: req.query.weekStart,
        timezone: access.family.timezone || 'Asia/Shanghai'
      });

      logFamilyOperation(req, {
        operation: 'weekly-report-read',
        familyId: access.familyId.toString(),
        childId: access.child._id.toString(),
        reportId: report._id.toString()
      });
      return res.json({ success: true, data: { report: reportView(report) } });
    } catch (error) {
      if (sendServiceError(res, error)) return undefined;
      return next(error);
    }
  });

  router.patch('/:reportId/feedback', authenticateGateway, async (req, res, next) => {
    try {
      if (req.user.role !== 'parent') {
        return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Only parents can update weekly report feedback');
      }
      if (!isObjectId(req.params.reportId)) {
        return sendError(res, 404, 'RESOURCE_NOT_FOUND', 'Weekly report not found');
      }

      const patch = parseFeedbackPatch(req.body);
      const report = await WeeklyReportModel.findById(req.params.reportId);
      if (!report) return sendError(res, 404, 'RESOURCE_NOT_FOUND', 'Weekly report not found');

      const access = await resolveChildAccess(req.user, report.childId.toString());
      if (!access || access.familyId.toString() !== report.familyId.toString()) {
        return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot access this report');
      }

      const updated = await WeeklyReportModel.findOneAndUpdate(
        { _id: report._id },
        {
          $set: {
            ...patch,
            feedbackUpdatedBy: req.user.id,
            feedbackUpdatedAt: now()
          }
        },
        { new: true, runValidators: true }
      );

      logFamilyOperation(req, {
        operation: 'weekly-report-feedback',
        familyId: report.familyId.toString(),
        childId: report.childId.toString(),
        reportId: report._id.toString()
      });
      return res.json({ success: true, data: { report: reportView(updated) } });
    } catch (error) {
      if (sendServiceError(res, error)) return undefined;
      return next(error);
    }
  });

  return router;
};

module.exports = createWeeklyReportsRouter();
module.exports.createWeeklyReportsRouter = createWeeklyReportsRouter;

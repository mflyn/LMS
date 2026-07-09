const express = require('express');

const ReminderSettings = require('../models/ReminderSettings');
const { authenticateGateway } = require('../../../common/middleware/auth');
const { sendFamilyError } = require('../../../common/utils/familyResponse');
const { resolveChildAccess, resolveFamilyAccess } = require('../../../common/utils/familyAccess');
const { LOCAL_DATE_PATTERN, formatLocalDate } = require('../../../common/utils/familyDate');
const { deriveFamilyReminders } = require('../services/familyReminderService');
const { createFamilyNotificationSourceRepository } = require('../services/familyNotificationSourceRepository');

const SWITCH_FIELDS = [
  'taskReminderEnabled',
  'overdueReminderEnabled',
  'mistakeReviewReminderEnabled',
  'dimensionReminderEnabled',
  'weeklyReportReminderEnabled'
];
const PATCH_FIELDS = [...SWITCH_FIELDS, 'weeklyReportDay', 'quietHours'];
const OWNERSHIP_FIELDS = ['familyId', 'updatedByParentId'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const sendError = (res, status, code, message, details = []) => (
  sendFamilyError(res, status, code, message, details)
);

const settingsView = (settings) => ({
  settingsId: settings._id.toString(),
  familyId: settings.familyId.toString(),
  taskReminderEnabled: settings.taskReminderEnabled,
  overdueReminderEnabled: settings.overdueReminderEnabled,
  mistakeReviewReminderEnabled: settings.mistakeReviewReminderEnabled,
  dimensionReminderEnabled: settings.dimensionReminderEnabled,
  weeklyReportReminderEnabled: settings.weeklyReportReminderEnabled,
  weeklyReportDay: settings.weeklyReportDay,
  quietHours: {
    start: settings.quietHours.start,
    end: settings.quietHours.end
  },
  updatedByParentId: settings.updatedByParentId ? settings.updatedByParentId.toString() : undefined,
  createdAt: settings.createdAt,
  updatedAt: settings.updatedAt
});

const assertValidLocalDate = (localDate) => {
  if (!LOCAL_DATE_PATTERN.test(localDate || '')) return false;
  const [year, month, day] = localDate.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.toISOString().slice(0, 10) === localDate;
};

const getOrCreateSettings = async (SettingsModel, familyId) => {
  let settings = await SettingsModel.findOne({ familyId });
  if (settings) return settings;

  try {
    settings = await SettingsModel.create({ familyId });
  } catch (error) {
    if (error.code !== 11000) throw error;
    settings = await SettingsModel.findOne({ familyId });
  }
  return settings;
};

const parsePatch = (body) => {
  const details = [];
  OWNERSHIP_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      details.push({ field, message: `${field} cannot be updated by clients` });
    }
  });

  SWITCH_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field) && typeof body[field] !== 'boolean') {
      details.push({ field, message: `${field} must be boolean` });
    }
  });

  if (Object.prototype.hasOwnProperty.call(body, 'weeklyReportDay')) {
    const day = body.weeklyReportDay;
    if (!Number.isInteger(day) || day < 1 || day > 7) {
      details.push({ field: 'weeklyReportDay', message: 'weeklyReportDay must be an integer from 1 to 7' });
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'quietHours')) {
    const quietHours = body.quietHours;
    if (!quietHours || typeof quietHours !== 'object'
      || !TIME_PATTERN.test(quietHours.start || '')
      || !TIME_PATTERN.test(quietHours.end || '')) {
      details.push({ field: 'quietHours', message: 'quietHours.start and quietHours.end must use HH:mm' });
    }
  }

  if (details.length > 0) {
    const error = new Error('Invalid reminder settings');
    error.details = details;
    throw error;
  }

  return PATCH_FIELDS.reduce((patch, field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      patch[field] = body[field];
    }
    return patch;
  }, {});
};

const createFamilyNotificationsRouter = ({
  ReminderSettingsModel = ReminderSettings,
  sourceRepository = createFamilyNotificationSourceRepository(),
  now = () => new Date()
} = {}) => {
  const router = express.Router();

  router.get('/family', authenticateGateway, async (req, res) => {
    try {
      const childId = req.query.childId;
      if (!childId) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'childId is required');
      }
      if (req.query.date && !assertValidLocalDate(req.query.date)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid date');
      }

      const access = await resolveChildAccess(req.user, childId);
      if (!access) {
        return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot access this child reminders');
      }

      const familyId = access.family._id.toString();
      const settings = await getOrCreateSettings(ReminderSettingsModel, familyId);
      const timezone = access.family.timezone || 'Asia/Shanghai';
      const localDate = req.query.date || formatLocalDate(now(), timezone);
      const result = await deriveFamilyReminders({
        childId: access.child._id.toString(),
        familyId,
        settings,
        sourceRepository,
        timezone,
        date: localDate,
        now
      });

      return res.json({ success: true, data: result });
    } catch (error) {
      if (error.name === 'ValidationError' || error.name === 'CastError') {
        return sendError(res, 400, 'VALIDATION_ERROR', error.message);
      }
      return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  });

  router.get('/settings', authenticateGateway, async (req, res) => {
    try {
      const access = await resolveFamilyAccess(req.user, req.query.familyId);
      if (!access) {
        return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot access this family reminder settings');
      }

      const familyId = access.familyId;
      const settings = await getOrCreateSettings(ReminderSettingsModel, familyId);
      return res.json({ success: true, data: { settings: settingsView(settings) } });
    } catch (error) {
      if (error.name === 'ValidationError' || error.name === 'CastError') {
        return sendError(res, 400, 'VALIDATION_ERROR', error.message);
      }
      return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  });

  router.patch('/settings', authenticateGateway, async (req, res) => {
    try {
      if (req.user.role !== 'parent') {
        return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Only parents can update reminder settings');
      }

      const access = await resolveFamilyAccess(req.user);
      if (!access) {
        return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot access this family reminder settings');
      }

      const familyId = access.familyId;
      let patch;
      try {
        patch = parsePatch(req.body || {});
      } catch (error) {
        return sendError(res, 400, 'VALIDATION_ERROR', error.message, error.details || []);
      }

      const settings = await getOrCreateSettings(ReminderSettingsModel, familyId);
      Object.assign(settings, patch, { updatedByParentId: req.user.id });
      await settings.save();

      return res.json({ success: true, data: { settings: settingsView(settings) } });
    } catch (error) {
      if (error.name === 'ValidationError' || error.name === 'CastError') {
        return sendError(res, 400, 'VALIDATION_ERROR', error.message);
      }
      return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  });

  return router;
};

module.exports = {
  createFamilyNotificationsRouter,
  parsePatch,
  settingsView
};

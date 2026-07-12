const GrowthTask = require('../../homework-service/models/GrowthTask');
const GrowthLog = require('../../progress-service/models/GrowthLog');
const FamilyMistake = require('../../analytics-service/models/FamilyMistake');
const WeeklyReport = require('../../analytics-service/models/WeeklyReport');

const DEFAULT_MAX_TIME_MS = 3000;

const taskView = (task) => ({
  taskId: task._id.toString(),
  childId: task.childId.toString(),
  dimension: task.dimension,
  title: task.title,
  dueDate: task.dueDate,
  status: task.status
});

const logView = (log) => ({
  logId: log._id.toString(),
  childId: log.childId.toString(),
  dimension: log.dimension,
  date: log.date
});

const mistakeView = (mistake) => ({
  mistakeId: mistake._id.toString(),
  childId: (mistake.childId || mistake.student).toString(),
  subject: mistake.subject,
  knowledgePoint: mistake.knowledgePointName || mistake.knowledgePoint,
  mastered: mistake.mastered,
  reviewReminderDate: mistake.reviewReminderDate || undefined
});

const withMaxTime = (query, maxTimeMS) => (
  query && typeof query.maxTimeMS === 'function' ? query.maxTimeMS(maxTimeMS) : query
);

const createFamilyNotificationSourceRepository = ({
  models = {},
  maxTimeMS = Number(process.env.NOTIFICATION_SOURCE_MAX_TIME_MS || DEFAULT_MAX_TIME_MS)
} = {}) => {
  if (!Number.isInteger(maxTimeMS) || maxTimeMS < 1) {
    throw new Error('NOTIFICATION_SOURCE_MAX_TIME_MS must be a positive integer');
  }

  const GrowthTaskModel = models.GrowthTaskModel || GrowthTask;
  const FamilyMistakeModel = models.FamilyMistakeModel
    || models.MistakeRecordModel
    || FamilyMistake;
  const GrowthLogModel = models.GrowthLogModel || GrowthLog;
  const WeeklyReportModel = models.WeeklyReportModel
    || models.ReportModel
    || WeeklyReport;

  return {
    async getTasks({ familyId, childId, localDate }) {
      const tasks = await withMaxTime(GrowthTaskModel.find({
        familyId,
        childId,
        status: { $nin: ['completed', 'confirmed', 'cancelled', 'archived'] },
        dueDate: { $lte: localDate }
      }).sort({ dueDate: 1, createdAt: 1 }), maxTimeMS);
      return tasks.map(taskView);
    },

    async getMistakes({ familyId, childId }) {
      const mistakes = await withMaxTime(FamilyMistakeModel.find({
        familyId,
        childId,
        mastered: false
      }).sort({ createdAt: 1 }), maxTimeMS);
      return mistakes.map(mistakeView);
    },

    async getLogs({ familyId, childId, localDate }) {
      const logs = await withMaxTime(GrowthLogModel.find({
        familyId,
        childId,
        date: localDate
      }).sort({ createdAt: 1 }), maxTimeMS);
      return logs.map(logView);
    },

    async hasWeeklyReport({ familyId, childId, weekStart, weekEnd }) {
      const report = await withMaxTime(WeeklyReportModel.findOne({
        familyId,
        childId,
        weekStart,
        weekEnd
      }).select('_id'), maxTimeMS);
      return Boolean(report);
    }
  };
};

module.exports = {
  createFamilyNotificationSourceRepository,
  withMaxTime
};

const GrowthTask = require('../../homework-service/models/GrowthTask');
const GrowthLog = require('../../progress-service/models/GrowthLog');
const MistakeRecord = require('../../analytics-service/models/MistakeRecord');
const Report = require('../../progress-service/models/Report');

const toDate = (localDate) => new Date(`${localDate}T00:00:00.000Z`);
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
  childId: mistake.student.toString(),
  subject: mistake.subject,
  knowledgePoint: mistake.knowledgePoint,
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

  const {
    GrowthTaskModel = GrowthTask,
    MistakeRecordModel = MistakeRecord,
    GrowthLogModel = GrowthLog,
    ReportModel = Report
  } = models;

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

    async getMistakes({ childId }) {
      const mistakes = await withMaxTime(MistakeRecordModel.find({
        student: childId,
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

    async hasWeeklyReport({ childId, weekStart, weekEnd }) {
      const report = await withMaxTime(ReportModel.findOne({
        student: childId,
        period: 'week',
        startDate: { $lte: toDate(weekStart) },
        endDate: { $gte: toDate(weekEnd) },
        status: { $in: ['draft', 'published'] }
      }).select('_id'), maxTimeMS);
      return Boolean(report);
    }
  };
};

module.exports = {
  createFamilyNotificationSourceRepository,
  withMaxTime
};

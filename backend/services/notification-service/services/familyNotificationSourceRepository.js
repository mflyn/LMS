const GrowthTask = require('../../homework-service/models/GrowthTask');
const GrowthLog = require('../../progress-service/models/GrowthLog');
const MistakeRecord = require('../../analytics-service/models/MistakeRecord');
const Report = require('../../progress-service/models/Report');

const toDate = (localDate) => new Date(`${localDate}T00:00:00.000Z`);

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

const createFamilyNotificationSourceRepository = () => ({
  async getTasks({ familyId, childId, localDate }) {
    const tasks = await GrowthTask.find({
      familyId,
      childId,
      status: { $nin: ['completed', 'confirmed', 'cancelled', 'archived'] },
      dueDate: { $lte: localDate }
    }).sort({ dueDate: 1, createdAt: 1 });
    return tasks.map(taskView);
  },

  async getMistakes({ childId }) {
    const mistakes = await MistakeRecord.find({
      student: childId,
      mastered: false
    }).sort({ createdAt: 1 });
    return mistakes.map(mistakeView);
  },

  async getLogs({ familyId, childId, localDate }) {
    const logs = await GrowthLog.find({
      familyId,
      childId,
      date: localDate
    }).sort({ createdAt: 1 });
    return logs.map(logView);
  },

  async hasWeeklyReport({ childId, weekStart, weekEnd }) {
    const report = await Report.findOne({
      student: childId,
      period: 'week',
      startDate: { $lte: toDate(weekStart) },
      endDate: { $gte: toDate(weekEnd) },
      status: { $in: ['draft', 'published'] }
    }).select('_id');
    return Boolean(report);
  }
});

module.exports = {
  createFamilyNotificationSourceRepository
};

const { addLocalDateDays, formatLocalDate, getWeekRange } = require('../../../common/utils/familyDate');
const {
  REMINDER_SEVERITY_ORDER,
  REMINDER_TYPE_ORDER
} = require('../../../common/contracts/familyGrowthApi');

const DIMENSION_REMINDERS = [
  ['physical', 'dimension_physical'],
  ['moral', 'dimension_moral'],
  ['labor', 'dimension_labor']
];

const toId = (value) => {
  if (!value) return undefined;
  return value.toString ? value.toString() : String(value);
};

const taskId = (task) => toId(task.taskId || task._id || task.id);
const mistakeId = (mistake) => toId(mistake.mistakeId || mistake._id || mistake.id);
const logId = (log) => toId(log.logId || log._id || log.id);
const mistakeTitle = (mistake) => (
  mistake.knowledgePointName || mistake.knowledgePoint || mistake.subject || '错题复习'
);

const isoWeekday = (localDate) => {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
};

const isPendingTask = (task) => !['completed', 'confirmed', 'cancelled', 'archived'].includes(task.status);
const isActiveEntry = (entry) => !['cancelled', 'archived'].includes(entry.status);

const reminder = ({
  type,
  childId,
  localDate,
  sourceId,
  severity = 'info',
  title,
  message = title,
  dimension,
  source
}) => ({
  reminderId: `${type}:${childId}:${localDate}:${sourceId}`,
  type,
  childId,
  localDate,
  sourceId,
  severity,
  title,
  message,
  dimension,
  source
});

const readSource = async (sourceName, unavailableSources, reader) => {
  try {
    return await reader();
  } catch (error) {
    unavailableSources.push(sourceName);
    return undefined;
  }
};

const dedupeAndSort = (items) => {
  const seen = new Map();
  items.forEach((item) => {
    const key = `${item.type}:${item.childId}:${item.localDate}:${item.sourceId}`;
    if (!seen.has(key)) seen.set(key, item);
  });
  return [...seen.values()].sort((left, right) => (
    REMINDER_SEVERITY_ORDER.indexOf(left.severity) - REMINDER_SEVERITY_ORDER.indexOf(right.severity)
    || REMINDER_TYPE_ORDER.indexOf(left.type) - REMINDER_TYPE_ORDER.indexOf(right.type)
    || left.sourceId.localeCompare(right.sourceId)
  ));
};

const deriveFamilyReminders = async ({
  childId,
  familyId,
  settings,
  sourceRepository,
  timezone,
  date,
  now = () => new Date()
}) => {
  const localDate = date || formatLocalDate(now(), timezone);
  const previousDate = addLocalDateDays(localDate, -1);
  const unavailableSources = [];

  const [tasks, mistakes, logs, weeklyReportExists] = await Promise.all([
    readSource('tasks', unavailableSources, () => sourceRepository.getTasks({ familyId, childId, localDate, previousDate })),
    readSource('mistakes', unavailableSources, () => sourceRepository.getMistakes({ familyId, childId, localDate })),
    readSource('logs', unavailableSources, () => sourceRepository.getLogs({ familyId, childId, localDate })),
    readSource('weeklyReport', unavailableSources, async () => {
      const week = getWeekRange(localDate);
      return sourceRepository.hasWeeklyReport({ familyId, childId, weekStart: week.start, weekEnd: week.end });
    })
  ]);

  const reminders = [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeMistakes = Array.isArray(mistakes) ? mistakes : [];
  const safeLogs = Array.isArray(logs) ? logs : [];

  if (settings.taskReminderEnabled && tasks) {
    safeTasks
      .filter((task) => isPendingTask(task) && task.dueDate === localDate)
      .forEach((task) => reminders.push(reminder({
        type: 'task_today',
        childId,
        localDate,
        sourceId: taskId(task),
        title: task.title || '今日任务',
        dimension: task.dimension,
        source: 'task'
      })));
  }

  if (settings.overdueReminderEnabled && tasks) {
    safeTasks
      .filter((task) => isPendingTask(task) && task.dueDate < localDate)
      .forEach((task) => reminders.push(reminder({
        type: 'task_overdue',
        childId,
        localDate,
        sourceId: taskId(task),
        severity: 'warning',
        title: task.title || '逾期任务',
        message: `逾期任务：${task.title || '待完成任务'}`,
        dimension: task.dimension,
        source: 'task'
      })));
  }

  if (settings.mistakeReviewReminderEnabled && mistakes) {
    safeMistakes
      .filter((mistake) => !mistake.mastered && (!mistake.reviewReminderDate || mistake.reviewReminderDate <= localDate))
      .forEach((mistake) => reminders.push(reminder({
        type: 'mistake_review',
        childId,
        localDate,
        sourceId: mistakeId(mistake),
        title: mistakeTitle(mistake),
        message: `错题复习：${mistakeTitle(mistake)}`,
        dimension: 'academic',
        source: 'mistake'
      })));
  }

  if (settings.dimensionReminderEnabled && (tasks || logs)) {
    DIMENSION_REMINDERS.forEach(([dimension, type]) => {
      const hasTask = safeTasks.some((task) => task.dimension === dimension
        && task.dueDate === localDate && isActiveEntry(task));
      const hasLog = safeLogs.some((log) => log.dimension === dimension
        && log.date === localDate && isActiveEntry(log));
      if (!hasTask && !hasLog) {
        reminders.push(reminder({
          type,
          childId,
          localDate,
          sourceId: dimension,
          title: `${dimension} reminder`,
          message: `${dimension} 今日尚无成长任务或记录`,
          dimension,
          source: 'dimension'
        }));
      }
    });
  }

  if (settings.weeklyReportReminderEnabled
    && weeklyReportExists === false
    && settings.weeklyReportDay === isoWeekday(localDate)) {
    const week = getWeekRange(localDate);
    reminders.push(reminder({
      type: 'weekly_report',
      childId,
      localDate,
      sourceId: `${week.start}:${week.end}`,
      title: '周报待生成',
      message: '本周成长周报尚未生成',
      source: 'weeklyReport'
    }));
  }

  return {
    items: dedupeAndSort(reminders),
    meta: {
      childId,
      familyId,
      localDate,
      timezone,
      partial: unavailableSources.length > 0,
      unavailableSources
    }
  };
};

module.exports = {
  deriveFamilyReminders,
  isoWeekday
};

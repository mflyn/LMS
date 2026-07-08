const { ObjectId } = require('mongodb');

const {
  addLocalDateDays,
  formatLocalDate,
  isValidTimeZone
} = require('../../../common/utils/familyDate');

const DIMENSIONS = ['moral', 'academic', 'physical', 'artistic', 'labor'];
const DEFAULT_SUGGESTION = '继续保持本周节奏，优先复盘最需要巩固的任务。';
const MATH_SUGGESTION = '保持数学错题复习';
const PHYSICAL_SUGGESTION = '增加 2 次户外运动';
const LABOR_SUGGESTION = '固定周三和周六做劳动任务';

class WeeklyReportError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const reportError = (code, message, status) => new WeeklyReportError(code, message, status);

const parseLocalDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    throw reportError('VALIDATION_ERROR', 'weekStart must be a valid LocalDate', 400);
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.toISOString().slice(0, 10) !== value) {
    throw reportError('VALIDATION_ERROR', 'weekStart must be a valid LocalDate', 400);
  }
  return parsed;
};

const validateWeekStart = (weekStart) => {
  const parsed = parseLocalDate(weekStart);
  if (parsed.getUTCDay() !== 1) {
    throw reportError('VALIDATION_ERROR', 'weekStart must be a Monday', 400);
  }
};

const zonedParts = (instant, timeZone) => new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
}).formatToParts(instant).reduce((result, part) => {
  result[part.type] = part.value;
  return result;
}, {});

const zoneOffsetMs = (instant, timeZone) => {
  const parts = zonedParts(instant, timeZone);
  const localAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return localAsUtc - instant.getTime();
};

const localDateStartToUtc = (localDate, timeZone) => {
  const [year, month, day] = localDate.split('-').map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day);
  let guess = localAsUtc;
  for (let index = 0; index < 3; index += 1) {
    guess = localAsUtc - zoneOffsetMs(new Date(guess), timeZone);
  }
  return new Date(guess);
};

const completionRate = (completed, planned) => (
  planned === 0 ? null : Math.round((completed * 10000) / planned) / 100
);

const emptyDimensionStats = () => Object.fromEntries(
  DIMENSIONS.map((dimension) => [dimension, { planned: 0, completed: 0, durationMinutes: 0 }])
);

const compareLocalDate = (left, right) => left.localeCompare(right);
const before = (value, cutoff) => value instanceof Date && value.getTime() < cutoff.getTime();
const onOrAfter = (value, cutoff) => value instanceof Date && value.getTime() >= cutoff.getTime();

const inLocalWeek = (localDate, weekStart, weekEnd) => (
  compareLocalDate(localDate, weekStart) >= 0 && compareLocalDate(localDate, weekEnd) <= 0
);

const normalizeDimension = (dimension) => (DIMENSIONS.includes(dimension) ? dimension : 'academic');

const isPlannedTask = (task, weekStart, weekEnd, cutoff) => (
  inLocalWeek(task.dueDate || '', weekStart, weekEnd)
  && before(task.createdAt, cutoff)
  && (!task.cancelledAt || onOrAfter(task.cancelledAt, cutoff))
);

const sourceDateInWeek = (row, timeZone, weekStart, weekEnd) => {
  if (!(row.createdAt instanceof Date)) return false;
  return inLocalWeek(formatLocalDate(row.createdAt, timeZone), weekStart, weekEnd);
};

const lastById = (rows, idField) => {
  const result = new Map();
  rows
    .slice()
    .sort((left, right) => {
      const diff = new Date(left.effectiveAt).getTime() - new Date(right.effectiveAt).getTime();
      if (diff !== 0) return diff;
      return String(left.eventId || '').localeCompare(String(right.eventId || ''));
    })
    .forEach((row) => {
      result.set(String(row[idField]), row);
    });
  return result;
};

const pointSort = (left, right) => (
  String(left.dimension || '').localeCompare(String(right.dimension || ''))
  || String(left.subject || left.area || '').localeCompare(String(right.subject || right.area || ''))
  || String(left.area || '').localeCompare(String(right.area || ''))
  || String(left.name || '').localeCompare(String(right.name || ''))
);

const addReviewPoint = (points, point) => {
  const name = (point.name || point.knowledgePointName || '').trim();
  if (!name || points.has(name)) return;
  points.set(name, {
    dimension: point.dimension || 'academic',
    subject: point.subject || '',
    area: point.area || '',
    name
  });
};

const buildGeneratedSuggestion = ({ weeklyMistakes, dimensionStats }) => {
  const parts = [];
  if (weeklyMistakes.some((mistake) => (
    String(mistake.subject || '').toLowerCase() === 'math'
    && mistake.mastered !== true
  ))) {
    parts.push(MATH_SUGGESTION);
  }
  if (dimensionStats.physical.completed < 6) parts.push(PHYSICAL_SUGGESTION);
  if (dimensionStats.labor.completed < 3) parts.push(LABOR_SUGGESTION);
  return parts.length > 0 ? `${parts.join('，')}。` : DEFAULT_SUGGESTION;
};

const mapAggregationError = (error) => {
  if (error instanceof WeeklyReportError) throw error;
  throw reportError(
    'AGGREGATION_UNAVAILABLE',
    error && error.message ? error.message : 'Weekly report aggregation unavailable',
    503
  );
};

const createSnapshotBuilder = ({ repository }) => async ({
  familyId,
  childId,
  weekStart,
  timezone,
  cutoff,
  generatedAt
}) => {
  const weekEnd = addLocalDateDays(weekStart, 6);
  const scope = {
    familyId,
    childId,
    from: weekStart,
    to: weekEnd,
    cutoff
  };

  let source;
  try {
    const [
      tasks,
      logs,
      mistakes,
      mistakeEvents,
      points,
      masteryEvents
    ] = await Promise.all([
      repository.listTaskProjection(scope),
      repository.listGrowthLogProjection(scope),
      repository.listMistakeProjection(scope),
      repository.listMistakeStateEventProjection(scope),
      repository.listKnowledgePointProjection(scope),
      repository.listKnowledgePointMasteryEventProjection(scope)
    ]);
    source = { tasks, logs, mistakes, mistakeEvents, points, masteryEvents };
  } catch (error) {
    mapAggregationError(error);
  }

  const dimensionTaskStats = emptyDimensionStats();
  const plannedTasks = source.tasks.filter((row) => isPlannedTask(row, weekStart, weekEnd, cutoff));
  const completedTasks = plannedTasks.filter((row) => before(row.completedAt, cutoff));

  plannedTasks.forEach((row) => {
    dimensionTaskStats[normalizeDimension(row.dimension)].planned += 1;
  });
  completedTasks.forEach((row) => {
    dimensionTaskStats[normalizeDimension(row.dimension)].completed += 1;
  });

  const eligibleLogs = source.logs.filter((row) => (
    inLocalWeek(row.date || '', weekStart, weekEnd) && before(row.createdAt, cutoff)
  ));
  const recordDays = new Set(eligibleLogs.map((row) => row.date)).size;
  let totalDurationMinutes = 0;
  eligibleLogs.forEach((row) => {
    const duration = Number.isFinite(row.durationMinutes) ? row.durationMinutes : 0;
    totalDurationMinutes += duration;
    dimensionTaskStats[normalizeDimension(row.dimension)].durationMinutes += duration;
  });
  const dimensionDurations = Object.fromEntries(
    DIMENSIONS.map((dimension) => [dimension, dimensionTaskStats[dimension].durationMinutes])
  );

  const weeklyMistakes = source.mistakes.filter((row) => (
    before(row.createdAt, cutoff) && sourceDateInWeek(row, timezone, weekStart, weekEnd)
  ));
  const reasonCounts = weeklyMistakes.reduce((result, row) => {
    const reason = row.reason || 'unknown';
    result.set(reason, (result.get(reason) || 0) + 1);
    return result;
  }, new Map());
  const topMistakeReasons = Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => (right.count - left.count) || left.reason.localeCompare(right.reason));

  const preCutoffMistakeEvents = source.mistakeEvents.filter((row) => before(row.effectiveAt, cutoff));
  const lastMistakeEvents = lastById(preCutoffMistakeEvents, 'mistakeId');
  const reviewPoints = new Map();
  source.mistakes.filter((row) => before(row.createdAt, cutoff)).forEach((row) => {
    const event = lastMistakeEvents.get(String(row.mistakeId));
    const mastered = event ? event.mastered : row.mastered;
    const reviewReminderDate = (event && event.reviewReminderDate) || row.reviewReminderDate;
    if (mastered !== true && reviewReminderDate && compareLocalDate(reviewReminderDate, weekEnd) <= 0) {
      addReviewPoint(reviewPoints, row);
    }
  });

  const preCutoffMasteryEvents = source.masteryEvents.filter((row) => before(row.effectiveAt, cutoff));
  const lastMasteryEvents = lastById(preCutoffMasteryEvents, 'knowledgePointId');
  lastMasteryEvents.forEach((row) => {
    if (row.masteryLevel === 'needs_review') addReviewPoint(reviewPoints, row);
  });
  source.points.forEach((row) => {
    if (!lastMasteryEvents.has(String(row.knowledgePointId)) && row.masteryLevel === 'needs_review') {
      addReviewPoint(reviewPoints, row);
    }
  });

  const statistics = {
    weekStart,
    weekEnd,
    recordDays,
    totalDurationMinutes,
    plannedTaskCount: plannedTasks.length,
    completedTaskCount: completedTasks.length,
    taskCompletionRate: completionRate(completedTasks.length, plannedTasks.length),
    dimensionTaskStats,
    dimensionDurations,
    mistakeCount: weeklyMistakes.length,
    topMistakeReasons,
    reviewKnowledgePoints: Array.from(reviewPoints.values()).sort(pointSort).map((point) => point.name)
  };

  return {
    familyId,
    childId,
    weekStart,
    weekEnd,
    timezone,
    statistics,
    generatedSuggestion: buildGeneratedSuggestion({ weeklyMistakes, dimensionStats: dimensionTaskStats }),
    sourceCutoffAt: cutoff,
    generatedAt
  };
};

const asObjectId = (value) => {
  if (!ObjectId.isValid(value)) throw reportError('VALIDATION_ERROR', 'Invalid child or family identifier', 400);
  return new ObjectId(value);
};

const retryFrozenWinner = async (WeeklyReportModel, identity) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const winner = await WeeklyReportModel.findOne({ ...identity, frozen: true });
    if (winner) return winner;
  }
  throw reportError('AGGREGATION_UNAVAILABLE', 'Frozen weekly report is not visible', 503);
};

const createWeeklyReportService = ({
  WeeklyReportModel,
  repository,
  now = () => new Date()
} = {}) => {
  if (!WeeklyReportModel || typeof WeeklyReportModel.findOne !== 'function') {
    throw new Error('WeeklyReportModel is required');
  }
  if (!repository || typeof repository.listTaskProjection !== 'function') {
    throw new Error('repository is required');
  }

  const buildSnapshot = createSnapshotBuilder({ repository });

  const generateOrRead = async ({
    user,
    childId,
    weekStart,
    timezone = 'Asia/Shanghai'
  }) => {
    validateWeekStart(weekStart);
    if (!isValidTimeZone(timezone)) {
      throw reportError('VALIDATION_ERROR', 'Invalid timezone', 400);
    }
    if (!user || !user.familyId) {
      throw reportError('VALIDATION_ERROR', 'Missing family identity', 400);
    }

    const familyId = user.familyId;
    const effectiveChildId = user.role === 'student' ? user.childId : childId;
    if (!effectiveChildId) throw reportError('VALIDATION_ERROR', 'childId is required', 400);

    const weekEnd = addLocalDateDays(weekStart, 6);
    const cutoff = localDateStartToUtc(addLocalDateDays(weekStart, 7), timezone);
    const generatedAt = now();
    const ended = generatedAt.getTime() >= cutoff.getTime();
    const identity = {
      familyId: asObjectId(familyId),
      childId: asObjectId(effectiveChildId),
      weekStart
    };

    if (ended) {
      const frozen = await WeeklyReportModel.findOne({ ...identity, frozen: true });
      if (frozen) return frozen;
    }

    const snapshot = await buildSnapshot({
      familyId,
      childId: effectiveChildId,
      weekStart,
      timezone,
      cutoff,
      generatedAt
    });
    const existing = await WeeklyReportModel.findOne(identity);
    const existingHasFeedbackOverride = existing
      && existing.nextWeekSuggestion
      && existing.nextWeekSuggestion !== existing.generatedSuggestion;
    const update = {
      ...snapshot,
      nextWeekSuggestion: existingHasFeedbackOverride
        ? existing.nextWeekSuggestion
        : snapshot.generatedSuggestion
    };

    if (!ended) {
      const current = await WeeklyReportModel.findOneAndUpdate(
        { ...identity, frozen: false },
        { $set: { ...update, frozen: false } },
        { new: true }
      );
      if (current) return current;
      try {
        return await WeeklyReportModel.create({
          ...update,
          frozen: false,
          parentNote: '',
          nextWeekSuggestion: snapshot.generatedSuggestion
        });
      } catch (error) {
        if (error && error.code === 11000) {
          return WeeklyReportModel.findOneAndUpdate(
            { ...identity, frozen: false },
            { $set: { ...update, frozen: false } },
            { new: true }
          );
        }
        throw error;
      }
    }

    if (existing && existing.frozen === false) {
      const promoted = await WeeklyReportModel.findOneAndUpdate(
        { ...identity, frozen: false },
        {
          $set: {
            ...update,
            frozen: true
          }
        },
        { new: true }
      );
      if (promoted) return promoted;
      return retryFrozenWinner(WeeklyReportModel, identity);
    }

    try {
      return await WeeklyReportModel.create({
        ...update,
        frozen: true,
        parentNote: '',
        nextWeekSuggestion: snapshot.generatedSuggestion
      });
    } catch (error) {
      if (error && error.code === 11000) return retryFrozenWinner(WeeklyReportModel, identity);
      throw error;
    }
  };

  return {
    generateOrRead
  };
};

module.exports = {
  DIMENSIONS,
  WeeklyReportError,
  completionRate,
  createWeeklyReportService,
  emptyDimensionStats
};

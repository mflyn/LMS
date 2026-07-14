const { ObjectId } = require('mongodb');

const DEFAULT_TIMEOUT_MS = 3000;

const taskProjection = {
  _id: 1,
  familyId: 1,
  childId: 1,
  dimension: 1,
  area: 1,
  subject: 1,
  title: 1,
  taskType: 1,
  status: 1,
  dueDate: 1,
  estimatedMinutes: 1,
  actualMinutes: 1,
  completedAt: 1,
  confirmedAt: 1,
  cancelledAt: 1,
  createdAt: 1,
  updatedAt: 1
};

const growthLogProjection = {
  _id: 1,
  familyId: 1,
  childId: 1,
  date: 1,
  dimension: 1,
  area: 1,
  subject: 1,
  content: 1,
  durationMinutes: 1,
  amount: 1,
  unit: 1,
  completedTaskIds: 1,
  focusLevel: 1,
  difficulty: 1,
  createdAt: 1,
  updatedAt: 1
};

const knowledgePointProjection = {
  _id: 1,
  familyId: 1,
  childId: 1,
  dimension: 1,
  subject: 1,
  area: 1,
  name: 1,
  masteryLevel: 1,
  practiceCount: 1,
  mistakeCount: 1,
  lastReviewedAt: 1,
  createdAt: 1,
  updatedAt: 1
};

const masteryEventProjection = {
  _id: 1,
  familyId: 1,
  childId: 1,
  knowledgePointId: 1,
  dimension: 1,
  subject: 1,
  area: 1,
  name: 1,
  masteryLevel: 1,
  effectiveAt: 1,
  operationId: 1
};

const mistakeProjection = {
  _id: 1,
  familyId: 1,
  childId: 1,
  dimension: 1,
  subject: 1,
  knowledgePointId: 1,
  knowledgePointName: 1,
  reason: 1,
  reviewReminderDate: 1,
  corrected: 1,
  reviewed: 1,
  mastered: 1,
  createdAt: 1,
  updatedAt: 1
};

const mistakeStateEventProjection = {
  _id: 1,
  familyId: 1,
  childId: 1,
  mistakeId: 1,
  reviewed: 1,
  mastered: 1,
  reviewReminderDate: 1,
  effectiveAt: 1,
  operationId: 1
};

const repositoryError = (code, message, source) => Object.assign(new Error(message), {
  code,
  status: 503,
  source
});

const scopeError = () => Object.assign(new Error('Family read requires family, child, date range and cutoff scope'), {
  code: 'UNSCOPED_FAMILY_READ',
  status: 400
});

const objectId = (value) => {
  if (!ObjectId.isValid(value)) throw scopeError();
  return new ObjectId(value);
};

const requireScope = ({ familyId, childId, from, to, cutoff, timeoutMs }) => {
  if (!familyId || !childId || !from || !to || !(cutoff instanceof Date) || Number.isNaN(cutoff.getTime())) {
    throw scopeError();
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw scopeError();
};

const normalizeSourceError = (source, error) => {
  if (error && (error.code === 50 || error.codeName === 'MaxTimeMSExpired')) {
    return repositoryError('FAMILY_READ_TIMEOUT', 'Family read source timed out', source);
  }
  return repositoryError('FAMILY_READ_SOURCE_UNAVAILABLE', 'Family read source unavailable', source);
};

const withSourceError = async (source, fn) => {
  try {
    return await fn();
  } catch (error) {
    if (error && (error.code === 'UNSCOPED_FAMILY_READ')) throw error;
    throw normalizeSourceError(source, error);
  }
};

const idString = (value) => (value ? value.toString() : undefined);
const beforeCutoff = (options, field = 'createdAt') => ({
  [field]: { [options.inclusiveCutoff ? '$lte' : '$lt']: options.cutoff }
});

const baseView = (row) => ({
  familyId: idString(row.familyId),
  childId: idString(row.childId),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

const createFamilyReadRepository = ({ connection, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) => {
  if (!connection || typeof connection.collection !== 'function') {
    throw new Error('connection is required');
  }

  const effectiveTimeout = (options) => options.timeoutMs || timeoutMs;

  const findRows = async ({ collection, query, projection, sort, options }) => {
    const readTimeoutMs = effectiveTimeout(options);
    requireScope({ ...options, timeoutMs: readTimeoutMs });
    return withSourceError(collection, () => {
      let cursor = connection.collection(collection).find(query, { projection });
      if (cursor && typeof cursor.sort === 'function') cursor = cursor.sort(sort || { _id: 1 });
      return cursor.maxTimeMS(readTimeoutMs).toArray();
    });
  };

  const rangeScope = (options) => ({
    familyId: objectId(options.familyId),
    childId: objectId(options.childId)
  });

  const listTaskProjection = async (options = {}) => {
    const ids = rangeScope(options);
    const rows = await findRows({
      collection: 'growthtasks',
      options,
      projection: taskProjection,
      sort: { dueDate: 1, _id: 1 },
      query: {
        ...ids,
        dueDate: { $gte: options.from, $lte: options.to },
        ...beforeCutoff(options)
      }
    });
    return rows.map((row) => ({
      ...baseView(row),
      taskId: idString(row._id),
      dimension: row.dimension,
      area: row.area,
      subject: row.subject,
      title: row.title,
      taskType: row.taskType,
      status: row.status,
      dueDate: row.dueDate,
      estimatedMinutes: row.estimatedMinutes,
      actualMinutes: row.actualMinutes,
      completedAt: row.completedAt,
      confirmedAt: row.confirmedAt,
      cancelledAt: row.cancelledAt
    }));
  };

  const listGrowthLogProjection = async (options = {}) => {
    const ids = rangeScope(options);
    const rows = await findRows({
      collection: 'growthlogs',
      options,
      projection: growthLogProjection,
      sort: { date: 1, _id: 1 },
      query: {
        ...ids,
        date: { $gte: options.from, $lte: options.to },
        ...beforeCutoff(options)
      }
    });
    return rows.map((row) => ({
      ...baseView(row),
      logId: idString(row._id),
      date: row.date,
      dimension: row.dimension,
      area: row.area,
      subject: row.subject,
      content: row.content,
      durationMinutes: row.durationMinutes,
      amount: row.amount,
      unit: row.unit,
      completedTaskIds: (row.completedTaskIds || []).map(idString),
      focusLevel: row.focusLevel,
      difficulty: row.difficulty
    }));
  };

  const listKnowledgePointProjection = async (options = {}) => {
    const ids = rangeScope(options);
    const rows = await findRows({
      collection: 'knowledgepoints',
      options,
      projection: knowledgePointProjection,
      sort: { dimension: 1, name: 1, _id: 1 },
      query: {
        ...ids,
        ...beforeCutoff(options)
      }
    });
    return rows.map((row) => ({
      ...baseView(row),
      knowledgePointId: idString(row._id),
      dimension: row.dimension,
      subject: row.subject,
      area: row.area,
      name: row.name,
      masteryLevel: row.masteryLevel,
      practiceCount: row.practiceCount,
      mistakeCount: row.mistakeCount,
      lastReviewedAt: row.lastReviewedAt
    }));
  };

  const listKnowledgePointMasteryEventProjection = async (options = {}) => {
    const ids = rangeScope(options);
    const rows = await findRows({
      collection: 'knowledgepointmasteryevents',
      options,
      projection: masteryEventProjection,
      sort: { effectiveAt: 1, _id: 1 },
      query: {
        ...ids,
        ...beforeCutoff(options, 'effectiveAt')
      }
    });
    return rows.map((row) => ({
      familyId: idString(row.familyId),
      childId: idString(row.childId),
      eventId: idString(row._id),
      knowledgePointId: idString(row.knowledgePointId),
      dimension: row.dimension,
      subject: row.subject,
      area: row.area,
      name: row.name,
      masteryLevel: row.masteryLevel,
      effectiveAt: row.effectiveAt,
      operationId: row.operationId
    }));
  };

  const listMistakeProjection = async (options = {}) => {
    const ids = rangeScope(options);
    const rows = await findRows({
      collection: 'familymistakes',
      options,
      projection: mistakeProjection,
      sort: { createdAt: 1, _id: 1 },
      query: {
        ...ids,
        ...beforeCutoff(options)
      }
    });
    return rows.map((row) => ({
      ...baseView(row),
      mistakeId: idString(row._id),
      dimension: row.dimension,
      subject: row.subject,
      knowledgePointId: idString(row.knowledgePointId),
      knowledgePointName: row.knowledgePointName,
      reason: row.reason,
      reviewReminderDate: row.reviewReminderDate,
      corrected: row.corrected,
      reviewed: row.reviewed,
      mastered: row.mastered
    }));
  };

  const listMistakeStateEventProjection = async (options = {}) => {
    const ids = rangeScope(options);
    const rows = await findRows({
      collection: 'familymistakestateevents',
      options,
      projection: mistakeStateEventProjection,
      sort: { effectiveAt: 1, _id: 1 },
      query: {
        ...ids,
        ...beforeCutoff(options, 'effectiveAt')
      }
    });
    return rows.map((row) => ({
      familyId: idString(row.familyId),
      childId: idString(row.childId),
      eventId: idString(row._id),
      mistakeId: idString(row.mistakeId),
      reviewed: row.reviewed,
      mastered: row.mastered,
      reviewReminderDate: row.reviewReminderDate,
      effectiveAt: row.effectiveAt,
      operationId: row.operationId
    }));
  };

  const hasWeeklyReportProjection = async (options = {}) => {
    const ids = rangeScope(options);
    const rows = await findRows({
      collection: 'weeklyreports',
      options,
      projection: { _id: 1 },
      sort: { _id: 1 },
      query: {
        ...ids,
        weekStart: options.from,
        weekEnd: options.to,
        ...beforeCutoff(options)
      }
    });
    return rows.length > 0;
  };

  return {
    hasWeeklyReportProjection,
    listTaskProjection,
    listGrowthLogProjection,
    listKnowledgePointProjection,
    listKnowledgePointMasteryEventProjection,
    listMistakeProjection,
    listMistakeStateEventProjection
  };
};

module.exports = { createFamilyReadRepository };

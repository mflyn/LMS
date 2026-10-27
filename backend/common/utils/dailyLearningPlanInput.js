const { AppError } = require('../middleware/errorTypes');

const ID = /^[0-9a-f]{24}$/i;
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const invalid = () => new AppError('VALIDATION_ERROR', 400, 'VALIDATION_ERROR');

// Shared by the pre-sanitization gateway boundary and the authorized service.
const normalizeDailyLearningPlanInput = body => {
  if (plain(body) && !Object.prototype.hasOwnProperty.call(body, 'expectedVersion')) {
    throw new AppError('CLIENT_UPGRADE_REQUIRED', 400, 'CLIENT_UPGRADE_REQUIRED');
  }
  if (!plain(body) || Object.keys(body).some(k => !['expectedVersion', 'items'].includes(k))
    || !Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0
    || body.expectedVersion === Number.MAX_SAFE_INTEGER || !Array.isArray(body.items) || body.items.length > 20) throw invalid();
  const items = Array.from(body.items, item => {
    if (!plain(item) || Object.keys(item).some(k => !['taskId', 'childEstimatedMinutes'].includes(k))
      || typeof item.taskId !== 'string' || !ID.test(item.taskId)) throw invalid();
    const minutes = item.childEstimatedMinutes ?? null;
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 240)) throw invalid();
    return { taskId: item.taskId.toLowerCase(), childEstimatedMinutes: minutes };
  });
  if (new Set(items.map(i => i.taskId)).size !== items.length) throw invalid();
  return { expectedVersion: body.expectedVersion, items };
};

module.exports = { normalizeDailyLearningPlanInput };

const { AppError } = require('../../../common/middleware/errorTypes');

const revisionOf = point => {
  const value = point.stateRevision === undefined ? 0 : point.stateRevision;
  if (!Number.isSafeInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER) {
    throw new AppError('STATE_EVENT_UNAVAILABLE', 503, 'STATE_EVENT_UNAVAILABLE', true, []);
  }
  return value;
};
const revisionMatch = revision => revision === 0
  ? { $or: [{ stateRevision: 0 }, { stateRevision: { $exists: false } }] }
  : { stateRevision: revision };

module.exports = { revisionOf, revisionMatch };

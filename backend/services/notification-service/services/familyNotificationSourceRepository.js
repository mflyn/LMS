const mongoose = require('mongoose');

const { createFamilyReadRepository } = require('../../../common/repositories/familyReadRepository');

const DEFAULT_MAX_TIME_MS = 3000;
const EARLIEST_LOCAL_DATE = '0001-01-01';

const createFamilyNotificationSourceRepository = ({
  familyReadRepository = null,
  connection = mongoose.connection,
  maxTimeMS = Number(process.env.NOTIFICATION_SOURCE_MAX_TIME_MS || DEFAULT_MAX_TIME_MS),
  cutoff = () => new Date()
} = {}) => {
  if (!Number.isInteger(maxTimeMS) || maxTimeMS < 1) {
    throw new Error('NOTIFICATION_SOURCE_MAX_TIME_MS must be a positive integer');
  }
  if (typeof cutoff !== 'function') throw new Error('cutoff must be a function');

  const repository = familyReadRepository || createFamilyReadRepository({
    connection,
    timeoutMs: maxTimeMS
  });

  const scope = ({ familyId, childId, from, to }) => {
    const readCutoff = cutoff();
    if (!(readCutoff instanceof Date) || Number.isNaN(readCutoff.getTime())) {
      throw new Error('cutoff must return a valid Date');
    }
    return {
      familyId,
      childId,
      from,
      to,
      cutoff: readCutoff,
      inclusiveCutoff: true,
      timeoutMs: maxTimeMS
    };
  };

  return {
    getTasks({ familyId, childId, localDate }) {
      return repository.listTaskProjection(scope({
        familyId,
        childId,
        from: EARLIEST_LOCAL_DATE,
        to: localDate
      }));
    },

    getMistakes({ familyId, childId, localDate }) {
      return repository.listMistakeProjection(scope({
        familyId,
        childId,
        from: localDate,
        to: localDate
      }));
    },

    getLogs({ familyId, childId, localDate }) {
      return repository.listGrowthLogProjection(scope({
        familyId,
        childId,
        from: localDate,
        to: localDate
      }));
    },

    hasWeeklyReport({ familyId, childId, weekStart, weekEnd }) {
      return repository.hasWeeklyReportProjection(scope({
        familyId,
        childId,
        from: weekStart,
        to: weekEnd
      }));
    }
  };
};

module.exports = { createFamilyNotificationSourceRepository };

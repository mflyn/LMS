describe('family notification source repository', () => {
  const chain = (result) => {
    const query = {
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      maxTimeMS: jest.fn().mockReturnThis(),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
    };
    return query;
  };

  test('bounds all source queries with maxTimeMS', async () => {
    const { createFamilyNotificationSourceRepository } = require('../services/familyNotificationSourceRepository');
    const taskQuery = chain([]);
    const mistakeQuery = chain([]);
    const logQuery = chain([]);
    const reportQuery = chain(null);
    const models = {
      GrowthTaskModel: { find: jest.fn(() => taskQuery) },
      FamilyMistakeModel: { find: jest.fn(() => mistakeQuery) },
      GrowthLogModel: { find: jest.fn(() => logQuery) },
      WeeklyReportModel: { findOne: jest.fn(() => reportQuery) }
    };
    const repository = createFamilyNotificationSourceRepository({ models, maxTimeMS: 1234 });

    await repository.getTasks({ familyId: 'family-1', childId: 'child-1', localDate: '2026-07-07' });
    await repository.getMistakes({ familyId: 'family-1', childId: 'child-1' });
    await repository.getLogs({ familyId: 'family-1', childId: 'child-1', localDate: '2026-07-07' });
    await repository.hasWeeklyReport({
      familyId: 'family-1', childId: 'child-1', weekStart: '2026-07-06', weekEnd: '2026-07-12'
    });

    expect(models.FamilyMistakeModel.find).toHaveBeenCalledWith({
      familyId: 'family-1', childId: 'child-1', mastered: false
    });
    expect(models.WeeklyReportModel.findOne).toHaveBeenCalledWith({
      familyId: 'family-1', childId: 'child-1', weekStart: '2026-07-06', weekEnd: '2026-07-12'
    });

    expect(taskQuery.maxTimeMS).toHaveBeenCalledWith(1234);
    expect(mistakeQuery.maxTimeMS).toHaveBeenCalledWith(1234);
    expect(logQuery.maxTimeMS).toHaveBeenCalledWith(1234);
    expect(reportQuery.maxTimeMS).toHaveBeenCalledWith(1234);
  });

  test('uses NOTIFICATION_SOURCE_MAX_TIME_MS when maxTimeMS is not injected', async () => {
    const original = process.env.NOTIFICATION_SOURCE_MAX_TIME_MS;
    const { createFamilyNotificationSourceRepository } = require('../services/familyNotificationSourceRepository');
    const taskQuery = chain([]);
    const models = {
      GrowthTaskModel: { find: jest.fn(() => taskQuery) }
    };

    try {
      process.env.NOTIFICATION_SOURCE_MAX_TIME_MS = '5000';
      const repository = createFamilyNotificationSourceRepository({ models });
      await repository.getTasks({ familyId: 'family-1', childId: 'child-1', localDate: '2026-07-07' });
      expect(taskQuery.maxTimeMS).toHaveBeenCalledWith(5000);
    } finally {
      if (original === undefined) delete process.env.NOTIFICATION_SOURCE_MAX_TIME_MS;
      else process.env.NOTIFICATION_SOURCE_MAX_TIME_MS = original;
    }
  });

  test('rejects invalid NOTIFICATION_SOURCE_MAX_TIME_MS values', () => {
    const original = process.env.NOTIFICATION_SOURCE_MAX_TIME_MS;
    const { createFamilyNotificationSourceRepository } = require('../services/familyNotificationSourceRepository');

    try {
      process.env.NOTIFICATION_SOURCE_MAX_TIME_MS = '0';
      expect(() => createFamilyNotificationSourceRepository({ models: {} }))
        .toThrow('NOTIFICATION_SOURCE_MAX_TIME_MS');
    } finally {
      if (original === undefined) delete process.env.NOTIFICATION_SOURCE_MAX_TIME_MS;
      else process.env.NOTIFICATION_SOURCE_MAX_TIME_MS = original;
    }
  });
});

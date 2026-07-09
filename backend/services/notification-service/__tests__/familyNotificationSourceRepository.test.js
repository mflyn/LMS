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
      MistakeRecordModel: { find: jest.fn(() => mistakeQuery) },
      GrowthLogModel: { find: jest.fn(() => logQuery) },
      ReportModel: { findOne: jest.fn(() => reportQuery) }
    };
    const repository = createFamilyNotificationSourceRepository({ models, maxTimeMS: 1234 });

    await repository.getTasks({ familyId: 'family-1', childId: 'child-1', localDate: '2026-07-07' });
    await repository.getMistakes({ childId: 'child-1' });
    await repository.getLogs({ familyId: 'family-1', childId: 'child-1', localDate: '2026-07-07' });
    await repository.hasWeeklyReport({ childId: 'child-1', weekStart: '2026-07-06', weekEnd: '2026-07-12' });

    expect(taskQuery.maxTimeMS).toHaveBeenCalledWith(1234);
    expect(mistakeQuery.maxTimeMS).toHaveBeenCalledWith(1234);
    expect(logQuery.maxTimeMS).toHaveBeenCalledWith(1234);
    expect(reportQuery.maxTimeMS).toHaveBeenCalledWith(1234);
  });
});

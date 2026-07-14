const fs = require('fs');
const path = require('path');

const {
  createFamilyNotificationSourceRepository
} = require('../services/familyNotificationSourceRepository');

const familyId = '665000000000000000000001';
const childId = '665000000000000000000011';

describe('family notification source repository', () => {
  test('adapts every source to the shared bounded family read boundary', async () => {
    const familyReadRepository = {
      listTaskProjection: jest.fn().mockResolvedValue([{ taskId: 'task-1' }]),
      listMistakeProjection: jest.fn().mockResolvedValue([{ mistakeId: 'mistake-1' }]),
      listGrowthLogProjection: jest.fn().mockResolvedValue([{ logId: 'log-1' }]),
      hasWeeklyReportProjection: jest.fn().mockResolvedValue(true)
    };
    const cutoff = new Date('2026-07-07T12:00:00.000Z');
    const repository = createFamilyNotificationSourceRepository({
      familyReadRepository,
      cutoff: () => cutoff,
      maxTimeMS: 1234
    });
    const sourceScope = { familyId, childId };

    await expect(repository.getTasks({ ...sourceScope, localDate: '2026-07-07' }))
      .resolves.toEqual([{ taskId: 'task-1' }]);
    await expect(repository.getMistakes({ ...sourceScope, localDate: '2026-07-07' }))
      .resolves.toEqual([{ mistakeId: 'mistake-1' }]);
    await expect(repository.getLogs({ ...sourceScope, localDate: '2026-07-07' }))
      .resolves.toEqual([{ logId: 'log-1' }]);
    await expect(repository.hasWeeklyReport({
      ...sourceScope,
      weekStart: '2026-07-06',
      weekEnd: '2026-07-12'
    })).resolves.toBe(true);

    expect(familyReadRepository.listTaskProjection).toHaveBeenCalledWith({
      ...sourceScope,
      from: '0001-01-01',
      to: '2026-07-07',
      cutoff,
      inclusiveCutoff: true,
      timeoutMs: 1234
    });
    expect(familyReadRepository.listMistakeProjection).toHaveBeenCalledWith(expect.objectContaining({
      ...sourceScope,
      from: '2026-07-07',
      to: '2026-07-07',
      cutoff,
      inclusiveCutoff: true,
      timeoutMs: 1234
    }));
    expect(familyReadRepository.listGrowthLogProjection).toHaveBeenCalledWith(expect.objectContaining({
      ...sourceScope,
      from: '2026-07-07',
      to: '2026-07-07'
    }));
    expect(familyReadRepository.hasWeeklyReportProjection).toHaveBeenCalledWith(expect.objectContaining({
      ...sourceScope,
      from: '2026-07-06',
      to: '2026-07-12'
    }));
  });

  test('does not import private models owned by other services', () => {
    const source = fs.readFileSync(path.join(
      __dirname,
      '../services/familyNotificationSourceRepository.js'
    ), 'utf8');

    expect(source).not.toMatch(/services\/(homework|progress|analytics)-service\/models/);
    expect(source).not.toMatch(/require\([^)]*(GrowthTask|GrowthLog|FamilyMistake|WeeklyReport)/);
    expect(source).toContain("common/repositories/familyReadRepository");
  });

  test('uses and validates NOTIFICATION_SOURCE_MAX_TIME_MS', () => {
    const original = process.env.NOTIFICATION_SOURCE_MAX_TIME_MS;
    const shared = {
      listTaskProjection: jest.fn(),
      listMistakeProjection: jest.fn(),
      listGrowthLogProjection: jest.fn(),
      hasWeeklyReportProjection: jest.fn()
    };

    try {
      process.env.NOTIFICATION_SOURCE_MAX_TIME_MS = '0';
      expect(() => createFamilyNotificationSourceRepository({ familyReadRepository: shared }))
        .toThrow('NOTIFICATION_SOURCE_MAX_TIME_MS');
    } finally {
      if (original === undefined) delete process.env.NOTIFICATION_SOURCE_MAX_TIME_MS;
      else process.env.NOTIFICATION_SOURCE_MAX_TIME_MS = original;
    }
  });
});

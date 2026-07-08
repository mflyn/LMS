const request = require('supertest');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET
  || 'test-gateway-identity-secret-32-bytes-long';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

const WeeklyReport = require('../models/WeeklyReport');
const { createWeeklyReportService } = require('../services/weeklyReportService');
const { createApp } = require('../app');

const {
  CHILD_A2_ID,
  CHILD_A1_ID,
  CHILD_B1_ID,
  FAMILY_B_ID,
  FAMILY_A_ID,
  PARENT_A_ID,
  PARENT_B_ID,
  childA1,
  childA2,
  childB1,
  parentA,
  parentB,
  resetIdentityNonceStore,
  signedHeaders
} = require('./helpers/familyAnalyticsFixtures');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');

const WEEK_START = '2026-06-22';
const WEEK_END = '2026-06-28';
const ENDED_NOW = '2026-06-30T00:00:00.000Z';
const CURRENT_NOW = '2026-06-24T00:00:00.000Z';

const date = (value) => new Date(value);

const task = (overrides = {}) => ({
  taskId: overrides.taskId || `task-${Math.random()}`,
  dimension: 'academic',
  dueDate: WEEK_START,
  status: 'pending',
  createdAt: date('2026-06-22T00:00:00.000Z'),
  actualMinutes: 120,
  ...overrides
});

const log = (overrides = {}) => ({
  logId: overrides.logId || `log-${Math.random()}`,
  date: WEEK_START,
  dimension: 'academic',
  durationMinutes: 30,
  createdAt: date('2026-06-22T00:00:00.000Z'),
  ...overrides
});

const mistake = (overrides = {}) => ({
  mistakeId: overrides.mistakeId || `mistake-${Math.random()}`,
  dimension: 'academic',
  subject: 'math',
  reason: 'calculation',
  knowledgePointName: '分数计算',
  reviewReminderDate: WEEK_END,
  mastered: false,
  createdAt: date('2026-06-23T00:00:00.000Z'),
  ...overrides
});

const masteryEvent = (overrides = {}) => ({
  eventId: overrides.eventId || `event-${Math.random()}`,
  knowledgePointId: overrides.knowledgePointId || `kp-${Math.random()}`,
  dimension: 'academic',
  subject: 'math',
  area: '',
  name: '分数计算',
  masteryLevel: 'needs_review',
  effectiveAt: date('2026-06-23T00:00:00.000Z'),
  ...overrides
});

const mistakeStateEvent = (overrides = {}) => ({
  eventId: overrides.eventId || `mistake-event-${Math.random()}`,
  mistakeId: overrides.mistakeId || `mistake-${Math.random()}`,
  reviewed: false,
  mastered: false,
  reviewReminderDate: WEEK_END,
  effectiveAt: date('2026-06-23T00:00:00.000Z'),
  ...overrides
});

const makeRepository = (overrides = {}) => ({
  listTaskProjection: jest.fn().mockResolvedValue(overrides.tasks || []),
  listGrowthLogProjection: jest.fn().mockResolvedValue(overrides.logs || []),
  listMistakeProjection: jest.fn().mockResolvedValue(overrides.mistakes || []),
  listMistakeStateEventProjection: jest.fn().mockResolvedValue(overrides.mistakeEvents || []),
  listKnowledgePointProjection: jest.fn().mockResolvedValue(overrides.points || []),
  listKnowledgePointMasteryEventProjection: jest.fn().mockResolvedValue(overrides.masteryEvents || [])
});

const makeService = ({ repository = makeRepository(), now = ENDED_NOW } = {}) => createWeeklyReportService({
  WeeklyReportModel: WeeklyReport,
  repository,
  now: () => date(now)
});

const readReport = (service, overrides = {}) => service.generateOrRead({
  user: parentA(),
  childId: CHILD_A1_ID,
  weekStart: WEEK_START,
  timezone: 'Asia/Shanghai',
  ...overrides
});

const makeTasks = ({ planned, completed, dimension = 'academic', dueDate = WEEK_START }) => Array.from({ length: planned }, (_, index) => task({
  taskId: `${dimension}-${index}`,
  dimension,
  dueDate,
  completedAt: index < completed ? date('2026-06-24T00:00:00.000Z') : undefined,
  status: index < completed ? 'completed' : 'pending'
}));

const seedFamilies = async () => {
  resetIdentityNonceStore();
  await User.create([
    {
      _id: PARENT_A_ID,
      username: 'parenta',
      password: 'parent123',
      email: 'parenta@example.com',
      name: 'Parent A',
      role: 'parent',
      familyId: FAMILY_A_ID,
      children: [CHILD_A1_ID, CHILD_A2_ID]
    },
    {
      _id: PARENT_B_ID,
      username: 'parentb',
      password: 'parent123',
      email: 'parentb@example.com',
      name: 'Parent B',
      role: 'parent',
      familyId: FAMILY_B_ID,
      children: [CHILD_B1_ID]
    },
    {
      _id: CHILD_A1_ID,
      username: 'childa1',
      password: 'child123',
      email: 'childa1@example.com',
      name: 'Child A1',
      role: 'student',
      familyId: FAMILY_A_ID,
      childProfile: { tokenVersion: 0 }
    },
    {
      _id: CHILD_A2_ID,
      username: 'childa2',
      password: 'child123',
      email: 'childa2@example.com',
      name: 'Child A2',
      role: 'student',
      familyId: FAMILY_A_ID,
      childProfile: { tokenVersion: 0 }
    },
    {
      _id: CHILD_B1_ID,
      username: 'childb1',
      password: 'child123',
      email: 'childb1@example.com',
      name: 'Child B1',
      role: 'student',
      familyId: FAMILY_B_ID,
      childProfile: { tokenVersion: 0 }
    }
  ]);
  await Family.create([
    {
      _id: FAMILY_A_ID,
      familyName: 'Family A',
      timezone: 'Asia/Shanghai',
      ownerParentId: PARENT_A_ID,
      memberParentIds: [PARENT_A_ID],
      childIds: [CHILD_A1_ID, CHILD_A2_ID]
    },
    {
      _id: FAMILY_B_ID,
      familyName: 'Family B',
      timezone: 'America/Los_Angeles',
      ownerParentId: PARENT_B_ID,
      memberParentIds: [PARENT_B_ID],
      childIds: [CHILD_B1_ID]
    }
  ]);
};

const weeklyPath = (query = {}) => {
  const params = new URLSearchParams(query);
  return `/api/reports/weekly${params.toString() ? `?${params.toString()}` : ''}`;
};

const seedFrozenReport = (overrides = {}) => WeeklyReport.create({
  familyId: FAMILY_A_ID,
  childId: CHILD_A1_ID,
  weekStart: WEEK_START,
  weekEnd: WEEK_END,
  timezone: 'Asia/Shanghai',
  statistics: {
    recordDays: 2,
    taskCompletionRate: 50,
    dimensionTaskStats: {
      moral: { planned: 0, completed: 0, durationMinutes: 0 },
      academic: { planned: 2, completed: 1, durationMinutes: 60 },
      physical: { planned: 0, completed: 0, durationMinutes: 0 },
      artistic: { planned: 0, completed: 0, durationMinutes: 0 },
      labor: { planned: 0, completed: 0, durationMinutes: 0 }
    }
  },
  generatedSuggestion: '保持数学错题复习。',
  nextWeekSuggestion: '保持数学错题复习。',
  sourceCutoffAt: date('2026-06-28T16:00:00.000Z'),
  generatedAt: date('2026-06-30T00:00:00.000Z'),
  frozen: true,
  ...overrides
});

describe('Task 6 weekly reports service', () => {
  test('TC-T6-REPORT-001 validates Monday weekStart and computes timezone-specific cutoff', async () => {
    const repository = makeRepository();
    const service = makeService({ repository });

    await readReport(service, { timezone: 'Asia/Shanghai' });
    expect(repository.listTaskProjection).toHaveBeenLastCalledWith(expect.objectContaining({
      from: WEEK_START,
      to: WEEK_END,
      cutoff: date('2026-06-28T16:00:00.000Z')
    }));

    await readReport(service, { timezone: 'America/Los_Angeles', childId: CHILD_A1_ID, weekStart: '2026-07-06' });
    expect(repository.listTaskProjection).toHaveBeenLastCalledWith(expect.objectContaining({
      from: '2026-07-06',
      to: '2026-07-12',
      cutoff: date('2026-07-13T07:00:00.000Z')
    }));

    await expect(readReport(service, { weekStart: '2026-06-23' }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    await expect(readReport(service, { weekStart: '2026-02-31' }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
  });

  test('TC-T6-REPORT-002 counts distinct GrowthLog local dates only once', async () => {
    const repository = makeRepository({
      logs: [
        log({ date: '2026-06-22' }),
        log({ date: '2026-06-22', durationMinutes: 15 }),
        log({ date: '2026-06-23' }),
        log({ date: '2026-06-24' }),
        log({ date: '2026-06-25' }),
        log({ date: '2026-06-26' }),
        log({ date: '2026-06-27' })
      ]
    });

    const report = await readReport(makeService({ repository }));

    expect(report.statistics.recordDays).toBe(6);
  });

  test('TC-T6-REPORT-003 computes completion rates with explicit dimension zeros', async () => {
    const repository = makeRepository({
      tasks: makeTasks({ planned: 30, completed: 24 })
    });

    const report = await readReport(makeService({ repository }));

    expect(report.statistics.taskCompletionRate).toBe(80);
    expect(report.statistics.dimensionTaskStats.academic).toEqual({ planned: 30, completed: 24, durationMinutes: 0 });
    expect(report.statistics.dimensionTaskStats.artistic).toEqual({ planned: 0, completed: 0, durationMinutes: 0 });

    const rounded = await readReport(makeService({
      repository: makeRepository({ tasks: makeTasks({ planned: 3, completed: 2, dueDate: '2026-06-29' }) })
    }), { weekStart: '2026-06-29' });
    expect(rounded.statistics.taskCompletionRate).toBe(66.67);
  });

  test('TC-T6-REPORT-004 applies cancellation and completion cutoff rules', async () => {
    const repository = makeRepository({
      tasks: [
        task({ taskId: 'cancel-before', status: 'cancelled', cancelledAt: date('2026-06-26T00:00:00.000Z') }),
        task({ taskId: 'cancel-after', status: 'cancelled', cancelledAt: date('2026-06-29T00:00:00.000Z') }),
        task({ taskId: 'late-complete', status: 'completed', completedAt: date('2026-06-29T00:00:00.000Z') })
      ]
    });

    const report = await readReport(makeService({ repository }));

    expect(report.statistics.plannedTaskCount).toBe(2);
    expect(report.statistics.completedTaskCount).toBe(0);
    expect(report.statistics.taskCompletionRate).toBe(0);
  });

  test('TC-T6-REPORT-005 excludes task records created after cutoff even when dueDate is in the week', async () => {
    const repository = makeRepository({
      tasks: [
        task({ taskId: 'eligible', completedAt: date('2026-06-24T00:00:00.000Z') }),
        task({ taskId: 'created-after-cutoff', createdAt: date('2026-06-29T00:00:00.000Z'), completedAt: date('2026-06-24T00:00:00.000Z') })
      ]
    });

    const report = await readReport(makeService({ repository }));

    expect(report.statistics.plannedTaskCount).toBe(1);
    expect(report.statistics.completedTaskCount).toBe(1);
  });

  test('TC-T6-REPORT-006 returns null completion rate and explicit dimensions when no task is planned', async () => {
    const report = await readReport(makeService());

    expect(report.statistics.taskCompletionRate).toBeNull();
    expect(Object.keys(report.statistics.dimensionTaskStats).sort()).toEqual([
      'academic',
      'artistic',
      'labor',
      'moral',
      'physical'
    ]);
  });

  test('TC-T6-REPORT-007 sums duration from GrowthLog only and never adds task actualMinutes', async () => {
    const repository = makeRepository({
      tasks: [task({ taskId: 'task-with-actual', actualMinutes: 180 })],
      logs: [log({ dimension: 'academic', durationMinutes: 45 }), log({ dimension: 'physical', durationMinutes: 30 })]
    });

    const report = await readReport(makeService({ repository }));

    expect(report.statistics.totalDurationMinutes).toBe(75);
    expect(report.statistics.dimensionTaskStats.academic.durationMinutes).toBe(45);
    expect(report.statistics.dimensionTaskStats.physical.durationMinutes).toBe(30);
  });

  test('TC-T6-REPORT-008 counts weekly mistake reasons with deterministic ordering', async () => {
    const repository = makeRepository({
      mistakes: [
        mistake({ reason: 'careless' }),
        mistake({ reason: 'calculation' }),
        mistake({ reason: 'careless' }),
        mistake({ reason: 'calculation' }),
        mistake({ reason: 'concept', createdAt: date('2026-06-21T00:00:00.000Z') }),
        mistake({ reason: 'late', createdAt: date('2026-06-29T00:00:00.000Z') })
      ]
    });

    const report = await readReport(makeService({ repository }));

    expect(report.statistics.mistakeCount).toBe(4);
    expect(report.statistics.topMistakeReasons).toEqual([
      { reason: 'calculation', count: 2 },
      { reason: 'careless', count: 2 }
    ]);
  });

  test('TC-T6-REPORT-009 builds historical review points from pre-cutoff mistake and mastery events', async () => {
    const repository = makeRepository({
      mistakes: [
        mistake({ mistakeId: 'm1', knowledgePointName: '分数计算', reviewReminderDate: WEEK_END, mastered: true }),
        mistake({ mistakeId: 'm2', knowledgePointName: '小数乘法', reviewReminderDate: '2026-07-10', mastered: false })
      ],
      mistakeEvents: [
        mistakeStateEvent({ mistakeId: 'm1', mastered: false, reviewReminderDate: WEEK_END, effectiveAt: date('2026-06-24T00:00:00.000Z') }),
        mistakeStateEvent({ mistakeId: 'm1', mastered: true, effectiveAt: date('2026-06-29T00:00:00.000Z') })
      ],
      masteryEvents: [
        masteryEvent({ knowledgePointId: 'kp1', name: '分数计算', masteryLevel: 'needs_review' }),
        masteryEvent({ knowledgePointId: 'kp2', name: '诗词背诵', dimension: 'artistic', subject: 'music', area: 'recite', masteryLevel: 'needs_review' }),
        masteryEvent({ knowledgePointId: 'kp2', name: '诗词背诵', masteryLevel: 'skilled', effectiveAt: date('2026-06-29T00:00:00.000Z') })
      ]
    });

    const report = await readReport(makeService({ repository }));

    expect(report.statistics.reviewKnowledgePoints).toEqual(['分数计算', '诗词背诵']);
  });

  test('TC-T6-REPORT-010 generates approved suggestions in math, physical, labor order', async () => {
    const repository = makeRepository({
      tasks: [
        ...makeTasks({ planned: 4, completed: 4, dimension: 'physical' }),
        ...makeTasks({ planned: 2, completed: 2, dimension: 'labor' })
      ],
      mistakes: [mistake({ subject: 'math', mastered: false })]
    });

    const report = await readReport(makeService({ repository }));

    expect(report.generatedSuggestion).toBe('保持数学错题复习，增加 2 次户外运动，固定周三和周六做劳动任务。');
    expect(report.nextWeekSuggestion).toBe(report.generatedSuggestion);
  });

  test('TC-T6-REPORT-011 omits satisfied suggestions and repeats byte-equivalent deterministic fields', async () => {
    const repository = makeRepository({
      tasks: [
        ...makeTasks({ planned: 6, completed: 6, dimension: 'physical' }),
        ...makeTasks({ planned: 3, completed: 3, dimension: 'labor' })
      ],
      mistakes: [mistake({ subject: 'math', mastered: true })]
    });
    const service = makeService({ repository });

    const first = await readReport(service);
    const second = await readReport(service);

    expect(first.generatedSuggestion).toBe('继续保持本周节奏，优先复盘最需要巩固的任务。');
    expect(second.statistics).toEqual(first.statistics);
    expect(second.generatedSuggestion).toBe(first.generatedSuggestion);
  });

  test('TC-T6-REPORT-012 freezes ended-week snapshots against later source mutation', async () => {
    const repository = makeRepository({ tasks: makeTasks({ planned: 3, completed: 2 }) });
    const service = makeService({ repository });

    const first = await readReport(service);
    repository.listTaskProjection.mockResolvedValue(makeTasks({ planned: 10, completed: 10 }));
    const second = await readReport(service);

    expect(first.frozen).toBe(true);
    expect(second.statistics).toEqual(first.statistics);
    expect(second.sourceCutoffAt.toISOString()).toBe(first.sourceCutoffAt.toISOString());
    expect(second.generatedAt.toISOString()).toBe(first.generatedAt.toISOString());
    expect(repository.listTaskProjection).toHaveBeenCalledTimes(1);
  });

  test('TC-T6-REPORT-013 recomputes current week then promotes it to one frozen snapshot with feedback preserved', async () => {
    const repository = makeRepository({ tasks: makeTasks({ planned: 2, completed: 1 }) });
    const currentService = makeService({ repository, now: CURRENT_NOW });

    const current = await readReport(currentService);
    await WeeklyReport.findByIdAndUpdate(current._id, {
      parentNote: '本周专注度不错',
      nextWeekSuggestion: '家长自定义下周建议',
      feedbackUpdatedBy: parentA().id
    });

    repository.listTaskProjection.mockResolvedValue(makeTasks({ planned: 4, completed: 4 }));
    const ended = await readReport(makeService({ repository, now: ENDED_NOW }));
    repository.listTaskProjection.mockResolvedValue(makeTasks({ planned: 10, completed: 0 }));
    const reread = await readReport(makeService({ repository, now: '2026-07-01T00:00:00.000Z' }));

    expect(current.frozen).toBe(false);
    expect(ended.frozen).toBe(true);
    expect(ended.statistics.taskCompletionRate).toBe(100);
    expect(ended.parentNote).toBe('本周专注度不错');
    expect(ended.nextWeekSuggestion).toBe('家长自定义下周建议');
    expect(reread.statistics.taskCompletionRate).toBe(100);
    expect(await WeeklyReport.countDocuments({ familyId: FAMILY_A_ID, childId: CHILD_A1_ID, weekStart: WEEK_START })).toBe(1);
  });

  test('TC-T6-REPORT-014 returns one frozen winner for concurrent ended-week insert and promotion races', async () => {
    const insertService = makeService({ repository: makeRepository({ tasks: makeTasks({ planned: 1, completed: 1 }) }) });
    const inserted = await Promise.all(Array.from({ length: 3 }, () => readReport(insertService)));

    expect(inserted.every((report) => report.frozen)).toBe(true);
    expect(new Set(inserted.map((report) => report._id.toString())).size).toBe(1);
    expect(await WeeklyReport.countDocuments()).toBe(1);

    await WeeklyReport.deleteMany({});
    const current = await readReport(makeService({
      repository: makeRepository({ tasks: makeTasks({ planned: 2, completed: 1 }) }),
      now: CURRENT_NOW
    }));
    expect(current.frozen).toBe(false);

    const promoteService = makeService({ repository: makeRepository({ tasks: makeTasks({ planned: 2, completed: 2 }) }) });
    const promoted = await Promise.all(Array.from({ length: 3 }, () => readReport(promoteService)));

    expect(promoted.every((report) => report.frozen)).toBe(true);
    expect(new Set(promoted.map((report) => report._id.toString())).size).toBe(1);
    expect(await WeeklyReport.countDocuments()).toBe(1);
  });

  test('TC-T6-REPORT-015 maps source failures to 503 and stores no failed snapshot', async () => {
    const repository = makeRepository();
    repository.listGrowthLogProjection.mockRejectedValueOnce(new Error('growth logs down'));

    await expect(readReport(makeService({ repository })))
      .rejects.toMatchObject({ code: 'AGGREGATION_UNAVAILABLE', status: 503 });
    expect(await WeeklyReport.countDocuments()).toBe(0);
  });
});

describe('Task 6 weekly reports routes', () => {
  beforeEach(async () => {
    await seedFamilies();
  });

  test('TC-T6-REPORT-016 authorizes parent and own child reads while denying cross-family and sibling access', async () => {
    const app = createApp();
    const parentPath = weeklyPath({ childId: CHILD_A1_ID, weekStart: WEEK_START });
    const childPath = weeklyPath({ weekStart: WEEK_START });
    const siblingPath = weeklyPath({ childId: CHILD_A1_ID, weekStart: WEEK_START });

    const parentResponse = await request(app)
      .get(parentPath)
      .set(signedHeaders(parentA(), 'GET', parentPath))
      .expect(200);
    expect(parentResponse.body.success).toBe(true);
    expect(parentResponse.body.data.report.childId).toBe(CHILD_A1_ID);

    const childResponse = await request(app)
      .get(childPath)
      .set(signedHeaders(childA1(), 'GET', childPath))
      .expect(200);
    expect(childResponse.body.data.report.childId).toBe(CHILD_A1_ID);

    const parentBDenied = await request(app)
      .get(parentPath)
      .set(signedHeaders(parentB(), 'GET', parentPath))
      .expect(403);
    expect(parentBDenied.body.error.code).toBe('CHILD_ACCESS_DENIED');

    const siblingDenied = await request(app)
      .get(siblingPath)
      .set(signedHeaders(childA2(), 'GET', siblingPath))
      .expect(403);
    expect(siblingDenied.body.error.code).toBe('CHILD_ACCESS_DENIED');

    const childBDenied = await request(app)
      .get(parentPath)
      .set(signedHeaders(childB1(), 'GET', parentPath))
      .expect(403);
    expect(childBDenied.body.error.code).toBe('CHILD_ACCESS_DENIED');
  });

  test('TC-T6-REPORT-017 restricts feedback to parents and rejects forbidden fields or unknown reports', async () => {
    const app = createApp();
    const report = await seedFrozenReport();
    const feedbackPath = `/api/reports/weekly/${report._id}/feedback`;

    const parentResponse = await request(app)
      .patch(feedbackPath)
      .set(signedHeaders(parentA(), 'PATCH', feedbackPath))
      .send({
        parentNote: '本周复盘很认真',
        nextWeekSuggestion: '下周继续整理错题'
      })
      .expect(200);
    expect(parentResponse.body.data.report.parentNote).toBe('本周复盘很认真');
    expect(parentResponse.body.data.report.nextWeekSuggestion).toBe('下周继续整理错题');

    const childDenied = await request(app)
      .patch(feedbackPath)
      .set(signedHeaders(childA1(), 'PATCH', feedbackPath))
      .send({ parentNote: 'not allowed' })
      .expect(403);
    expect(childDenied.body.error.code).toBe('CHILD_ACCESS_DENIED');

    const forbidden = await request(app)
      .patch(feedbackPath)
      .set(signedHeaders(parentA(), 'PATCH', feedbackPath))
      .send({ statistics: { taskCompletionRate: 100 } })
      .expect(403);
    expect(forbidden.body.error.code).toBe('FIELD_ACCESS_DENIED');

    const unknownPath = '/api/reports/weekly/665000000000000000009999/feedback';
    const missing = await request(app)
      .patch(unknownPath)
      .set(signedHeaders(parentA(), 'PATCH', unknownPath))
      .send({ parentNote: 'missing' })
      .expect(404);
    expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  test('TC-T6-REPORT-018 repeated feedback updates never mutate frozen snapshot fields', async () => {
    const app = createApp();
    const report = await seedFrozenReport();
    const feedbackPath = `/api/reports/weekly/${report._id}/feedback`;
    const original = report.toObject();

    await request(app)
      .patch(feedbackPath)
      .set(signedHeaders(parentA(), 'PATCH', feedbackPath))
      .send({ parentNote: '第一次反馈' })
      .expect(200);
    const second = await request(app)
      .patch(feedbackPath)
      .set(signedHeaders(parentA(), 'PATCH', feedbackPath))
      .send({ parentNote: '第二次反馈', nextWeekSuggestion: '新的家庭建议' })
      .expect(200);

    expect(second.body.data.report.parentNote).toBe('第二次反馈');
    expect(second.body.data.report.nextWeekSuggestion).toBe('新的家庭建议');
    expect(second.body.data.report.statistics).toEqual(original.statistics);
    expect(second.body.data.report.generatedSuggestion).toBe(original.generatedSuggestion);
    expect(second.body.data.report.sourceCutoffAt).toBe(original.sourceCutoffAt.toISOString());
    expect(second.body.data.report.generatedAt).toBe(original.generatedAt.toISOString());
    expect(second.body.data.report.frozen).toBe(true);
  });
});

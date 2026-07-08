process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET
  || 'test-gateway-identity-secret-32-bytes-long';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

const mongoose = require('mongoose');
const request = require('supertest');

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
  parentA,
  parentB,
  resetIdentityNonceStore,
  signedHeaders
} = require('./helpers/familyAnalyticsFixtures');

const createApp = () => require('../app').createApp();
const FamilyMistake = require('../models/FamilyMistake');
const FamilyMistakeStateEvent = require('../models/FamilyMistakeStateEvent');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');

const seedMistake = (overrides = {}) => FamilyMistake.create({
  familyId: FAMILY_A_ID,
  childId: CHILD_A1_ID,
  subject: 'math',
  reason: 'concept_misunderstanding',
  createdBy: PARENT_A_ID,
  updatedBy: PARENT_A_ID,
  ...overrides
});

const mistakePath = (suffix = '') => `/api/mistakes${suffix}`;

beforeEach(() => {
  resetIdentityNonceStore();
});

beforeEach(async () => {
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
      ownerParentId: PARENT_A_ID,
      memberParentIds: [PARENT_A_ID],
      childIds: [CHILD_A1_ID, CHILD_A2_ID]
    },
    {
      _id: FAMILY_B_ID,
      familyName: 'Family B',
      ownerParentId: PARENT_B_ID,
      memberParentIds: [PARENT_B_ID],
      childIds: [CHILD_B1_ID]
    }
  ]);
});

describe('Task 6 family mistakes', () => {
  test('TC-T6-MISTAKE-001 persists a minimal academic mistake with default review state', async () => {
    const mistake = await FamilyMistake.create({
      familyId: FAMILY_A_ID,
      childId: CHILD_A1_ID,
      subject: 'math',
      reason: 'concept_misunderstanding',
      createdBy: PARENT_A_ID,
      updatedBy: PARENT_A_ID
    });

    expect(mistake.dimension).toBe('academic');
    expect(mistake.corrected).toBe(false);
    expect(mistake.reviewed).toBe(false);
    expect(mistake.mastered).toBe(false);
    expect(mistake.mediaReferenceState).toBe('none');

    const selected = await FamilyMistake.findById(mistake._id).lean();
    expect(selected.mediaReferenceState).toBeUndefined();
    expect(selected.mediaBindingOperationId).toBeUndefined();
    expect(selected.mediaPendingPatch).toBeUndefined();
  });

  test('TC-T6-MISTAKE-002 validates academic-only scope, local dates, text bounds and state event uniqueness', async () => {
    const base = {
      familyId: FAMILY_A_ID,
      childId: CHILD_A1_ID,
      subject: 'math',
      reason: 'careless',
      createdBy: PARENT_A_ID,
      updatedBy: PARENT_A_ID
    };

    await expect(new FamilyMistake({ ...base, dimension: 'physical' }).validate())
      .rejects.toMatchObject({ name: 'ValidationError' });
    await expect(new FamilyMistake({ ...base, reviewReminderDate: '2026-02-31' }).validate())
      .rejects.toMatchObject({ name: 'ValidationError' });
    await expect(new FamilyMistake({ ...base, subject: 'x'.repeat(101) }).validate())
      .rejects.toMatchObject({ name: 'ValidationError' });

    const mistake = await FamilyMistake.create({
      ...base,
      reviewReminderDate: '2026-06-22',
      questionMediaId: new mongoose.Types.ObjectId(),
      childAnswerMediaId: new mongoose.Types.ObjectId()
    });
    await FamilyMistakeStateEvent.syncIndexes();
    await FamilyMistakeStateEvent.create({
      familyId: FAMILY_A_ID,
      childId: CHILD_A1_ID,
      mistakeId: mistake._id,
      reviewed: false,
      mastered: false,
      reviewReminderDate: '2026-06-22',
      effectiveAt: new Date('2026-06-20T00:00:00.000Z'),
      operationId: 'operation-1'
    });

    await expect(FamilyMistakeStateEvent.create({
      familyId: FAMILY_A_ID,
      childId: CHILD_A1_ID,
      mistakeId: mistake._id,
      reviewed: true,
      mastered: false,
      reviewReminderDate: '2026-06-23',
      effectiveAt: new Date('2026-06-20T00:01:00.000Z'),
      operationId: 'operation-1'
    })).rejects.toMatchObject({ code: 11000 });
  });

  test('TC-T6-MISTAKE-003 parent creates an academic mistake and state event through the route', async () => {
    const app = createApp();
    const path = mistakePath();

    const response = await request(app)
      .post(path)
      .set(signedHeaders(parentA(), 'POST', path))
      .send({
        childId: CHILD_A1_ID,
        subject: 'math',
        reason: 'concept_misunderstanding',
        correctAnswer: '42',
        parentNote: 'needs fraction review',
        reviewReminderDate: '2026-06-22'
      });

    expect(response.status).toBe(201);
    expect(response.body.data.mistake).toEqual(expect.objectContaining({
      familyId: FAMILY_A_ID,
      childId: CHILD_A1_ID,
      subject: 'math',
      reason: 'concept_misunderstanding',
      reviewed: false,
      mastered: false
    }));
    const events = await FamilyMistakeStateEvent.find({ mistakeId: response.body.data.mistake.mistakeId });
    expect(events).toHaveLength(1);
  });

  test('TC-T6-MISTAKE-004 child creates own mistake but cannot create for sibling', async () => {
    const app = createApp();
    const path = mistakePath();

    const own = await request(app)
      .post(path)
      .set(signedHeaders(childA1(), 'POST', path))
      .send({
        childId: CHILD_A1_ID,
        subject: 'math',
        reason: 'careless',
        childExplanation: 'I copied the sign incorrectly'
      });
    expect(own.status).toBe(201);
    expect(own.body.data.mistake.childId).toBe(CHILD_A1_ID);

    const sibling = await request(app)
      .post(path)
      .set(signedHeaders(childA1(), 'POST', path))
      .send({
        childId: CHILD_A2_ID,
        subject: 'math',
        reason: 'careless'
      });
    expect(sibling.status).toBe(403);
    expect(sibling.body.error.code).toBe('CHILD_ACCESS_DENIED');
  });

  test('TC-T6-MISTAKE-005 child cannot patch parent-owned fields but can update review state', async () => {
    const app = createApp();
    const mistake = await seedMistake();

    const forbiddenPath = mistakePath(`/${mistake._id}`);
    const forbidden = await request(app)
      .patch(forbiddenPath)
      .set(signedHeaders(childA1(), 'PATCH', forbiddenPath))
      .send({ subject: 'science', parentNote: 'private parent note' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FIELD_ACCESS_DENIED');

    const allowed = await request(app)
      .patch(forbiddenPath)
      .set(signedHeaders(childA1(), 'PATCH', forbiddenPath))
      .send({ reviewed: true, mastered: true, reviewReminderDate: '2026-06-24' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.mistake).toEqual(expect.objectContaining({
      reviewed: true,
      mastered: true,
      reviewReminderDate: '2026-06-24'
    }));
    const events = await FamilyMistakeStateEvent.find({ mistakeId: mistake._id }).sort({ effectiveAt: 1 });
    expect(events.map((event) => event.mastered)).toEqual([true]);
  });

  test('TC-T6-MISTAKE-006 denies cross-family and sibling list/detail/patch access', async () => {
    const app = createApp();
    const mistake = await seedMistake();

    const detailPath = mistakePath(`/${mistake._id}`);
    for (const user of [parentB(), childA2()]) {
      const detail = await request(app)
        .get(detailPath)
        .set(signedHeaders(user, 'GET', detailPath));
      expect(detail.status).toBe(403);
      expect(detail.body.error.code).toBe('CHILD_ACCESS_DENIED');

      const patch = await request(app)
        .patch(detailPath)
        .set(signedHeaders(user, 'PATCH', detailPath))
        .send({ reviewed: true });
      expect(patch.status).toBe(403);
    }
  });

  test('TC-T6-MISTAKE-007 lists filtered mistakes with pagination inside family scope', async () => {
    const app = createApp();
    await FamilyMistake.create([
      {
        familyId: FAMILY_A_ID,
        childId: CHILD_A1_ID,
        subject: 'math',
        reason: 'careless',
        reviewed: false,
        mastered: false,
        reviewReminderDate: '2026-06-22',
        createdBy: PARENT_A_ID,
        updatedBy: PARENT_A_ID
      },
      {
        familyId: FAMILY_A_ID,
        childId: CHILD_A1_ID,
        subject: 'math',
        reason: 'concept_misunderstanding',
        reviewed: true,
        mastered: false,
        reviewReminderDate: '2026-06-23',
        createdBy: PARENT_A_ID,
        updatedBy: PARENT_A_ID
      },
      {
        familyId: FAMILY_A_ID,
        childId: CHILD_A1_ID,
        subject: 'math',
        reason: 'concept_misunderstanding',
        reviewed: true,
        mastered: true,
        reviewReminderDate: '2026-06-24',
        createdBy: PARENT_A_ID,
        updatedBy: PARENT_A_ID
      },
      { familyId: FAMILY_B_ID, childId: CHILD_B1_ID, subject: 'math', reason: 'careless', createdBy: PARENT_B_ID, updatedBy: PARENT_B_ID }
    ]);
    const path = mistakePath(`?childId=${CHILD_A1_ID}&subject=math&reviewed=false&page=1&pageSize=1`);

    const response = await request(app)
      .get(path)
      .set(signedHeaders(parentA(), 'GET', path));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({
      page: 1,
      pageSize: 1,
      total: 1
    }));
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].familyId).toBe(FAMILY_A_ID);

    const statusExpectations = [
      ['pending', 'careless'],
      ['reviewed', 'concept_misunderstanding'],
      ['mastered', 'concept_misunderstanding']
    ];
    for (const [reviewStatus, reason] of statusExpectations) {
      const statusPath = mistakePath(
        `?childId=${CHILD_A1_ID}&reviewStatus=${reviewStatus}`
        + '&reviewReminderFrom=2026-06-22&reviewReminderTo=2026-06-24'
      );
      const statusResponse = await request(app)
        .get(statusPath)
        .set(signedHeaders(parentA(), 'GET', statusPath));

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data.items).toHaveLength(1);
      expect(statusResponse.body.data.items[0].reason).toBe(reason);
    }
  });

  test('TC-T6-MISTAKE-008/013/014 rejects invalid fields and preserves source when state event write fails', async () => {
    const app = createApp();
    const createPath = mistakePath();
    const invalid = await request(app)
      .post(createPath)
      .set(signedHeaders(parentA(), 'POST', createPath))
      .send({
        childId: CHILD_A1_ID,
        subject: 'math',
        reason: 'careless',
        dimension: 'physical',
        privateState: 'forbidden'
      });
    expect(invalid.status).toBe(403);
    expect(invalid.body.error.code).toBe('FIELD_ACCESS_DENIED');

    const mistake = await seedMistake();
    const createEvent = FamilyMistakeStateEvent.create;
    FamilyMistakeStateEvent.create = jest.fn().mockRejectedValueOnce(new Error('event store down'));
    const patchPath = mistakePath(`/${mistake._id}`);
    const response = await request(app)
      .patch(patchPath)
      .set(signedHeaders(parentA(), 'PATCH', patchPath))
      .send({ reviewed: true });
    FamilyMistakeStateEvent.create = createEvent;

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('STATE_EVENT_UNAVAILABLE');
    const unchanged = await FamilyMistake.findById(mistake._id);
    expect(unchanged.reviewed).toBe(false);
  });
});

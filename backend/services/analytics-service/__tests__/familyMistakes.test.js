process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET
  || 'test-gateway-identity-secret-32-bytes-long';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

const mongoose = require('mongoose');

const {
  CHILD_A1_ID,
  FAMILY_A_ID,
  PARENT_A_ID
} = require('./helpers/familyAnalyticsFixtures');

describe('Task 6 family mistakes', () => {
  test('TC-T6-MISTAKE-001 persists a minimal academic mistake with default review state', async () => {
    const FamilyMistake = require('../models/FamilyMistake');

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
    const FamilyMistake = require('../models/FamilyMistake');
    const FamilyMistakeStateEvent = require('../models/FamilyMistakeStateEvent');
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
});

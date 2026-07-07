process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET
  || 'test-gateway-identity-secret-32-bytes-long';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

const request = require('supertest');

const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const {
  CHILD_A1_ID,
  CHILD_A2_ID,
  FAMILY_A_ID,
  PARENT_A_ID,
  childA1,
  parentA,
  resetIdentityNonceStore,
  signedHeaders
} = require('./helpers/familyAnalyticsFixtures');
const { createApp } = require('../app');
const FamilyMistake = require('../models/FamilyMistake');

const QUESTION_MEDIA_A1 = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const ANSWER_MEDIA_A1 = 'bbbbbbbbbbbbbbbbbbbbbbbb';

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
      _id: CHILD_A1_ID,
      username: 'childa1',
      password: 'child123',
      email: 'childa1@example.com',
      name: 'Child A1',
      role: 'student',
      familyId: FAMILY_A_ID,
      childProfile: { tokenVersion: 0 }
    }
  ]);
  await Family.create({
    _id: FAMILY_A_ID,
    familyName: 'Family A',
    ownerParentId: PARENT_A_ID,
    memberParentIds: [PARENT_A_ID],
    childIds: [CHILD_A1_ID]
  });
});

const basePayload = (overrides = {}) => ({
  childId: CHILD_A1_ID,
  subject: 'math',
  reason: 'careless',
  ...overrides
});

describe('Task 6 family mistake media route contract', () => {
  test('TC-T6-MISTAKE-009 delegates create and patch media fields to the media service after authorization', async () => {
    const familyMistakeMediaService = {
      create: jest.fn(async ({ mistakeInput, mediaPatch }) => FamilyMistake.create({
        ...mistakeInput,
        ...mediaPatch,
        mediaReferenceState: 'bound'
      })),
      mutate: jest.fn(async ({ mistake, mistakePatch, mediaPatch }) => {
        Object.assign(mistake, mistakePatch, mediaPatch, { mediaReferenceState: 'bound' });
        await mistake.save({ validateModifiedOnly: true });
        return mistake;
      })
    };
    const app = createApp({ familyMistakeMediaService });
    const createPath = mistakePath();

    const created = await request(app)
      .post(createPath)
      .set(signedHeaders(parentA(), 'POST', createPath))
      .send(basePayload({ questionMediaId: QUESTION_MEDIA_A1 }));
    expect(created.status).toBe(201);
    expect(familyMistakeMediaService.create).toHaveBeenCalledWith({
      mistakeInput: expect.objectContaining({
        familyId: expect.anything(),
        childId: CHILD_A1_ID,
        subject: 'math',
        reason: 'careless'
      }),
      mediaPatch: { questionMediaId: QUESTION_MEDIA_A1 }
    });
    expect(created.body.data.mistake.questionMediaId).toBe(QUESTION_MEDIA_A1);

    const patchPath = mistakePath(`/${created.body.data.mistake.mistakeId}`);
    const patched = await request(app)
      .patch(patchPath)
      .set(signedHeaders(childA1(), 'PATCH', patchPath))
      .send({ childAnswerMediaId: ANSWER_MEDIA_A1, childExplanation: 'uploaded answer' });
    expect(patched.status).toBe(200);
    expect(familyMistakeMediaService.mutate).toHaveBeenCalledWith({
      mistake: expect.objectContaining({ _id: expect.anything() }),
      mistakePatch: { childExplanation: 'uploaded answer' },
      mediaPatch: { childAnswerMediaId: ANSWER_MEDIA_A1 }
    });
    expect(patched.body.data.mistake.childAnswerMediaId).toBe(ANSWER_MEDIA_A1);
  });

  test('TC-T6-MISTAKE-009 rejects media writes when private media is not enabled', async () => {
    const app = createApp();
    const path = mistakePath();

    const response = await request(app)
      .post(path)
      .set(signedHeaders(parentA(), 'POST', path))
      .send(basePayload({ questionMediaId: QUESTION_MEDIA_A1 }));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('MEDIA_NOT_ENABLED');
    expect(await FamilyMistake.countDocuments()).toBe(0);
  });

  test('TC-T6-MISTAKE-010 detail resumes a pending mistake media commit', async () => {
    const pendingMistake = await FamilyMistake.create({
      ...basePayload(),
      familyId: FAMILY_A_ID,
      createdBy: PARENT_A_ID,
      updatedBy: PARENT_A_ID,
      mediaReferenceState: 'pending'
    });
    const familyMistakeMediaService = {
      resume: jest.fn(async (mistakeId) => FamilyMistake.findOneAndUpdate(
        { _id: mistakeId },
        {
          $set: {
            questionMediaId: QUESTION_MEDIA_A1,
            mediaReferenceState: 'bound'
          },
          $unset: {
            mediaBindingOperationId: '',
            mediaPendingPatch: ''
          }
        },
        { new: true, runValidators: true }
      ))
    };
    const app = createApp({ familyMistakeMediaService });
    const path = mistakePath(`/${pendingMistake._id}`);

    const response = await request(app)
      .get(path)
      .set(signedHeaders(parentA(), 'GET', path));

    expect(response.status).toBe(200);
    expect(familyMistakeMediaService.resume).toHaveBeenCalledWith(pendingMistake._id.toString());
    expect(response.body.data.mistake.questionMediaId).toBe(QUESTION_MEDIA_A1);
    expect(response.body.data.mistake).not.toHaveProperty('mediaReferenceState');
    expect(response.body.data.mistake).not.toHaveProperty('mediaBindingOperationId');
    expect(response.body.data.mistake).not.toHaveProperty('mediaPendingPatch');
  });

  test('TC-T6-MEDIA-018 rejects raw, nested, dotted, and internal media fields before service calls', async () => {
    const familyMistakeMediaService = { create: jest.fn(), mutate: jest.fn() };
    const app = createApp({ familyMistakeMediaService });
    const badBodies = [
      { questionMediaId: { url: 'https://private.example/raw.jpg' } },
      { questionMedia: { mediaId: QUESTION_MEDIA_A1 } },
      { 'questionMediaId.mediaId': QUESTION_MEDIA_A1 },
      { mediaBindingOperationId: '11111111-1111-4111-8111-111111111111' },
      { mediaPendingPatch: [{ path: 'questionMediaId', value: QUESTION_MEDIA_A1 }] }
    ];

    for (const body of badBodies) {
      const response = await request(app)
        .post(mistakePath())
        .set(signedHeaders(parentA(), 'POST', mistakePath()))
        .send(basePayload(body));

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(familyMistakeMediaService.create).not.toHaveBeenCalled();
    }
  });
});

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET
  || 'test-gateway-identity-secret-32-bytes-long';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

const request = require('supertest');
const mongoose = require('mongoose');

const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const { runMongoTransaction } = require('../../../common/services/mongoTransaction');
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
const FamilyMistakeStateEvent = require('../models/FamilyMistakeStateEvent');
const { createFamilyMistakeMediaService } = require('../services/familyMistakeMediaService');

const QUESTION_MEDIA_A1 = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const ANSWER_MEDIA_A1 = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const QUESTION_MEDIA_A1_REPLACEMENT = 'cccccccccccccccccccccccc';
const QUESTION_MEDIA_A2 = 'dddddddddddddddddddddddd';
const ANSWER_MEDIA_A2 = 'eeeeeeeeeeeeeeeeeeeeeeee';
const QUESTION_MEDIA_A3 = 'ffffffffffffffffffffffff';
const OPERATION_A = '11111111-1111-4111-8111-111111111111';
const OPERATION_B = '22222222-2222-4222-8222-222222222222';

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
      mediaPatch: { questionMediaIds: [QUESTION_MEDIA_A1] }
    });
    expect(created.body.data.mistake.questionMediaId).toBe(QUESTION_MEDIA_A1);

    const patchPath = mistakePath(`/${created.body.data.mistake.mistakeId}`);
    const patched = await request(app)
      .patch(patchPath)
      .set(signedHeaders(childA1(), 'PATCH', patchPath))
      .send({
        questionMediaIds: [QUESTION_MEDIA_A1_REPLACEMENT],
        childAnswerMediaId: ANSWER_MEDIA_A1,
        childExplanation: 'uploaded answer'
      });
    expect(patched.status).toBe(200);
    expect(familyMistakeMediaService.mutate).toHaveBeenCalledWith({
      mistake: expect.objectContaining({ _id: expect.anything() }),
      mistakePatch: {
        childExplanation: 'uploaded answer',
        updatedBy: CHILD_A1_ID
      },
      mediaPatch: {
        questionMediaIds: [QUESTION_MEDIA_A1_REPLACEMENT],
        childAnswerMediaIds: [ANSWER_MEDIA_A1]
      }
    });
    expect(patched.body.data.mistake.questionMediaId).toBe(QUESTION_MEDIA_A1_REPLACEMENT);
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

describe('Task 6 family mistake media owner-state service', () => {
  test('TC-MPA-API-003/005 binds repeated fields, preserves order, and releases only removals', async () => {
    const mediaReferenceClient = {
      prepare: jest.fn(async ({ references }) => references.map((reference) => ({
        ...reference,
        state: 'prepared'
      }))),
      commit: jest.fn(async ({ references }) => references.map((reference) => ({
        ...reference,
        state: 'bound'
      }))),
      unbind: jest.fn(async ({ references }) => references.map((reference) => ({
        ...reference,
        state: 'released'
      })))
    };
    let operationIndex = 0;
    const operationIds = [OPERATION_A, OPERATION_B, '33333333-3333-4333-8333-333333333333'];
    const service = createFamilyMistakeMediaService({
      FamilyMistakeModel: FamilyMistake,
      FamilyMistakeStateEventModel: FamilyMistakeStateEvent,
      mediaReferenceClient,
      randomUUID: () => operationIds[operationIndex++]
    });
    const app = createApp({ familyMistakeMediaService: service });
    const createPath = mistakePath();

    const created = await request(app)
      .post(createPath)
      .set(signedHeaders(parentA(), 'POST', createPath))
      .send(basePayload({
        questionMediaIds: [QUESTION_MEDIA_A1, QUESTION_MEDIA_A2],
        childAnswerMediaIds: [ANSWER_MEDIA_A1, ANSWER_MEDIA_A2]
      }));

    expect(created.status).toBe(201);
    expect(mediaReferenceClient.prepare.mock.calls[0][0].references).toEqual([
      { field: 'questionMediaId', mediaId: QUESTION_MEDIA_A1 },
      { field: 'questionMediaId', mediaId: QUESTION_MEDIA_A2 },
      { field: 'childAnswerMediaId', mediaId: ANSWER_MEDIA_A1 },
      { field: 'childAnswerMediaId', mediaId: ANSWER_MEDIA_A2 }
    ]);
    expect(created.body.data.mistake).toEqual(expect.objectContaining({
      questionMediaIds: [QUESTION_MEDIA_A1, QUESTION_MEDIA_A2],
      questionMediaId: QUESTION_MEDIA_A1,
      childAnswerMediaIds: [ANSWER_MEDIA_A1, ANSWER_MEDIA_A2],
      childAnswerMediaId: ANSWER_MEDIA_A1
    }));

    mediaReferenceClient.prepare.mockClear();
    mediaReferenceClient.commit.mockClear();
    const patchPath = mistakePath(`/${created.body.data.mistake.mistakeId}`);
    const reordered = await request(app)
      .patch(patchPath)
      .set(signedHeaders(parentA(), 'PATCH', patchPath))
      .send({
        questionMediaIds: [QUESTION_MEDIA_A2, QUESTION_MEDIA_A1],
        childAnswerMediaIds: [ANSWER_MEDIA_A1]
      });

    expect(reordered.status).toBe(200);
    expect(reordered.body.data.mistake.questionMediaIds).toEqual([QUESTION_MEDIA_A2, QUESTION_MEDIA_A1]);
    expect(reordered.body.data.mistake.questionMediaId).toBe(QUESTION_MEDIA_A2);
    expect(mediaReferenceClient.prepare).not.toHaveBeenCalled();
    expect(mediaReferenceClient.commit).not.toHaveBeenCalled();
    expect(mediaReferenceClient.unbind).toHaveBeenLastCalledWith(expect.objectContaining({
      references: [{
        field: 'childAnswerMediaId',
        mediaId: ANSWER_MEDIA_A2,
        bindingOperationId: OPERATION_A
      }]
    }));

    const appended = await request(app)
      .patch(patchPath)
      .set(signedHeaders(parentA(), 'PATCH', patchPath))
      .send({ questionMediaIds: [QUESTION_MEDIA_A2, QUESTION_MEDIA_A1, QUESTION_MEDIA_A3], reviewed: true });

    expect(appended.status).toBe(200);
    expect(mediaReferenceClient.prepare).toHaveBeenLastCalledWith(expect.objectContaining({
      references: [{ field: 'questionMediaId', mediaId: QUESTION_MEDIA_A3 }]
    }));
    expect(appended.body.data.mistake.questionMediaIds).toEqual([
      QUESTION_MEDIA_A2,
      QUESTION_MEDIA_A1,
      QUESTION_MEDIA_A3
    ]);
    expect(appended.body.data.mistake.reviewed).toBe(true);
    expect(await FamilyMistakeStateEvent.countDocuments({
      mistakeId: created.body.data.mistake.mistakeId
    })).toBe(2);
  });

  test('TC-T6-MISTAKE-010 create commit failure leaves a resumable pending owner', async () => {
    const mediaReferenceClient = {
      prepare: jest.fn().mockResolvedValue([
        { mediaId: QUESTION_MEDIA_A1, field: 'questionMediaId', state: 'prepared' }
      ]),
      commit: jest.fn()
        .mockRejectedValueOnce(Object.assign(new Error('remote timeout'), {
          status: 503,
          code: 'MEDIA_REFERENCE_PENDING',
          details: []
        }))
        .mockResolvedValueOnce([
          { mediaId: QUESTION_MEDIA_A1, field: 'questionMediaId', state: 'bound' }
        ]),
      unbind: jest.fn()
    };
    const service = createFamilyMistakeMediaService({
      FamilyMistakeModel: FamilyMistake,
      FamilyMistakeStateEventModel: FamilyMistakeStateEvent,
      mediaReferenceClient,
      randomUUID: () => OPERATION_A
    });
    const app = createApp({ familyMistakeMediaService: service });
    const path = mistakePath();

    const createResponse = await request(app)
      .post(path)
      .set(signedHeaders(parentA(), 'POST', path))
      .send(basePayload({ questionMediaId: QUESTION_MEDIA_A1 }));

    expect(createResponse.status).toBe(503);
    expect(createResponse.body.error).toMatchObject({
      code: 'MEDIA_REFERENCE_PENDING',
      details: { resourceId: expect.any(String) }
    });
    const pending = await FamilyMistake.findById(createResponse.body.error.details.resourceId)
      .select('+mediaReferenceState +mediaBindingOperationId +mediaPendingPatch');
    expect(pending.mediaReferenceState).toBe('pending');
    expect(pending.questionMediaId).toBeUndefined();

    const detailPath = mistakePath(`/${pending._id}`);
    const detailResponse = await request(app)
      .get(detailPath)
      .set(signedHeaders(parentA(), 'GET', detailPath));

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.mistake.questionMediaId).toBe(QUESTION_MEDIA_A1);
    expect(await FamilyMistakeStateEvent.countDocuments({ mistakeId: pending._id })).toBe(1);
  });

  test('TC-T6-MISTAKE-009 stable media rejection rolls back the created mistake', async () => {
    const mediaReferenceClient = {
      prepare: jest.fn().mockRejectedValue(Object.assign(new Error('Media scope does not match'), {
        status: 403,
        code: 'CHILD_ACCESS_DENIED',
        details: [{ field: 'questionMediaId' }]
      })),
      commit: jest.fn(),
      unbind: jest.fn()
    };
    const service = createFamilyMistakeMediaService({
      FamilyMistakeModel: FamilyMistake,
      FamilyMistakeStateEventModel: FamilyMistakeStateEvent,
      mediaReferenceClient,
      randomUUID: () => OPERATION_A
    });
    const app = createApp({ familyMistakeMediaService: service });
    const path = mistakePath();

    const response = await request(app)
      .post(path)
      .set(signedHeaders(parentA(), 'POST', path))
      .send(basePayload({ questionMediaId: QUESTION_MEDIA_A1 }));

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      code: 'CHILD_ACCESS_DENIED',
      details: [{ field: 'questionMediaId' }]
    });
    expect(await FamilyMistake.countDocuments()).toBe(0);
    expect(await FamilyMistakeStateEvent.countDocuments()).toBe(0);
    expect(mediaReferenceClient.commit).not.toHaveBeenCalled();
  });

  test('TC-MPA-SAGA-002 stable patch rejection restores the published owner state', async () => {
    const boundMistake = await FamilyMistake.create({
      ...basePayload({ questionMediaId: QUESTION_MEDIA_A1, parentNote: 'keep me' }),
      familyId: FAMILY_A_ID,
      createdBy: PARENT_A_ID,
      updatedBy: PARENT_A_ID,
      mediaReferenceState: 'bound',
      mediaReferenceBindings: [{
        field: 'questionMediaId',
        mediaId: QUESTION_MEDIA_A1,
        bindingOperationId: OPERATION_A
      }]
    });
    const mediaReferenceClient = {
      prepare: jest.fn().mockRejectedValue(Object.assign(new Error('Media scope does not match'), {
        status: 403,
        code: 'CHILD_ACCESS_DENIED',
        details: [{ field: 'questionMediaId' }]
      })),
      commit: jest.fn(),
      unbind: jest.fn()
    };
    const service = createFamilyMistakeMediaService({
      FamilyMistakeModel: FamilyMistake,
      FamilyMistakeStateEventModel: FamilyMistakeStateEvent,
      mediaReferenceClient,
      randomUUID: () => OPERATION_B
    });
    const app = createApp({ familyMistakeMediaService: service });
    const patchPath = mistakePath(`/${boundMistake._id}`);

    const response = await request(app)
      .patch(patchPath)
      .set(signedHeaders(parentA(), 'PATCH', patchPath))
      .send({
        questionMediaId: QUESTION_MEDIA_A1_REPLACEMENT,
        parentNote: 'must not publish',
        reviewed: true
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CHILD_ACCESS_DENIED');
    const persisted = await FamilyMistake.findById(boundMistake._id)
      .select('+mediaReferenceState +mediaBindingOperationId +mediaPendingPatch +mediaPendingMistakePatch');
    expect(persisted).toEqual(expect.objectContaining({
      parentNote: 'keep me',
      reviewed: false,
      mediaReferenceState: 'bound'
    }));
    expect(persisted.questionMediaId.toString()).toBe(QUESTION_MEDIA_A1);
    expect(persisted.mediaBindingOperationId).toBeUndefined();
    expect(persisted.mediaPendingPatch).toBeUndefined();
    expect(persisted.mediaPendingMistakePatch).toBeUndefined();
    expect(mediaReferenceClient.commit).not.toHaveBeenCalled();
    expect(mediaReferenceClient.unbind).not.toHaveBeenCalled();
    expect(await FamilyMistakeStateEvent.countDocuments({ mistakeId: boundMistake._id })).toBe(0);
  });

  test('TC-T6-MISTAKE-011 replaces and removes question media with checked unbind', async () => {
    const boundMistake = await FamilyMistake.create({
      ...basePayload({ questionMediaId: QUESTION_MEDIA_A1 }),
      familyId: FAMILY_A_ID,
      createdBy: PARENT_A_ID,
      updatedBy: PARENT_A_ID,
      mediaReferenceState: 'bound',
      mediaReferenceBindings: [{
        field: 'questionMediaId',
        mediaId: QUESTION_MEDIA_A1,
        bindingOperationId: OPERATION_A
      }]
    });
    const mediaReferenceClient = {
      prepare: jest.fn().mockResolvedValue([
        { mediaId: QUESTION_MEDIA_A1_REPLACEMENT, field: 'questionMediaId', state: 'prepared' }
      ]),
      commit: jest.fn().mockResolvedValue([
        { mediaId: QUESTION_MEDIA_A1_REPLACEMENT, field: 'questionMediaId', state: 'bound' }
      ]),
      unbind: jest.fn().mockResolvedValue([
        { mediaId: QUESTION_MEDIA_A1, field: 'questionMediaId', state: 'released' }
      ])
    };
    const service = createFamilyMistakeMediaService({
      FamilyMistakeModel: FamilyMistake,
      FamilyMistakeStateEventModel: FamilyMistakeStateEvent,
      mediaReferenceClient,
      randomUUID: () => OPERATION_B
    });
    const app = createApp({ familyMistakeMediaService: service });
    const patchPath = mistakePath(`/${boundMistake._id}`);

    const replaceResponse = await request(app)
      .patch(patchPath)
      .set(signedHeaders(parentA(), 'PATCH', patchPath))
      .send({ questionMediaId: QUESTION_MEDIA_A1_REPLACEMENT });

    expect(replaceResponse.status).toBe(200);
    expect(replaceResponse.body.data.mistake.questionMediaId).toBe(QUESTION_MEDIA_A1_REPLACEMENT);
    expect(mediaReferenceClient.prepare).toHaveBeenCalledWith(expect.objectContaining({
      operationId: OPERATION_B,
      references: [{ mediaId: QUESTION_MEDIA_A1_REPLACEMENT, field: 'questionMediaId' }]
    }));
    expect(mediaReferenceClient.unbind).toHaveBeenCalledWith(expect.objectContaining({
      references: [{
        mediaId: QUESTION_MEDIA_A1,
        field: 'questionMediaId',
        bindingOperationId: OPERATION_A
      }]
    }));

    mediaReferenceClient.prepare.mockClear();
    mediaReferenceClient.commit.mockClear();
    mediaReferenceClient.unbind.mockResolvedValueOnce([
      { mediaId: QUESTION_MEDIA_A1_REPLACEMENT, field: 'questionMediaId', state: 'released' }
    ]);

    const removeResponse = await request(app)
      .patch(patchPath)
      .set(signedHeaders(parentA(), 'PATCH', patchPath))
      .send({ questionMediaId: null });

    expect(removeResponse.status).toBe(200);
    expect(removeResponse.body.data.mistake.questionMediaId).toBeUndefined();
    expect(mediaReferenceClient.prepare).not.toHaveBeenCalled();
    expect(mediaReferenceClient.commit).not.toHaveBeenCalled();
    expect(mediaReferenceClient.unbind).toHaveBeenLastCalledWith(expect.objectContaining({
      references: [{
        mediaId: QUESTION_MEDIA_A1_REPLACEMENT,
        field: 'questionMediaId',
        bindingOperationId: OPERATION_B
      }]
    }));
  });

  test('TC-T6-MISTAKE-010 patch commit failure leaves a resumable pending owner', async () => {
    const boundMistake = await FamilyMistake.create({
      ...basePayload({ questionMediaId: QUESTION_MEDIA_A1 }),
      familyId: FAMILY_A_ID,
      createdBy: PARENT_A_ID,
      updatedBy: PARENT_A_ID,
      mediaReferenceState: 'bound',
      mediaReferenceBindings: [{
        field: 'questionMediaId',
        mediaId: QUESTION_MEDIA_A1,
        bindingOperationId: OPERATION_A
      }]
    });
    const mediaReferenceClient = {
      prepare: jest.fn().mockResolvedValue([
        { mediaId: QUESTION_MEDIA_A1_REPLACEMENT, field: 'questionMediaId', state: 'prepared' }
      ]),
      commit: jest.fn()
        .mockRejectedValueOnce(Object.assign(new Error('remote timeout'), {
          status: 503,
          code: 'MEDIA_REFERENCE_PENDING',
          details: []
        }))
        .mockResolvedValueOnce([
          { mediaId: QUESTION_MEDIA_A1_REPLACEMENT, field: 'questionMediaId', state: 'bound' }
        ]),
      unbind: jest.fn().mockResolvedValue([
        { mediaId: QUESTION_MEDIA_A1, field: 'questionMediaId', state: 'released' }
      ])
    };
    const service = createFamilyMistakeMediaService({
      FamilyMistakeModel: FamilyMistake,
      FamilyMistakeStateEventModel: FamilyMistakeStateEvent,
      mediaReferenceClient,
      randomUUID: () => OPERATION_B
    });
    const app = createApp({ familyMistakeMediaService: service });
    const patchPath = mistakePath(`/${boundMistake._id}`);

    const patchResponse = await request(app)
      .patch(patchPath)
      .set(signedHeaders(parentA(), 'PATCH', patchPath))
      .send({ questionMediaId: QUESTION_MEDIA_A1_REPLACEMENT });

    expect(patchResponse.status).toBe(503);
    expect(patchResponse.body.error).toMatchObject({
      code: 'MEDIA_REFERENCE_PENDING',
      details: { resourceId: boundMistake._id.toString() }
    });
    const pending = await FamilyMistake.findById(boundMistake._id)
      .select('+mediaReferenceState +mediaBindingOperationId +mediaPendingPatch +mediaPreviousBindings');
    expect(pending.mediaReferenceState).toBe('pending');
    expect(pending.mediaBindingOperationId).toBe(OPERATION_B);
    expect(pending.mediaPendingPatch.map((entry) => ({
      path: entry.path,
      value: entry.value && entry.value.toString()
    }))).toEqual([
      { path: 'questionMediaId', value: QUESTION_MEDIA_A1_REPLACEMENT },
      { path: 'childAnswerMediaId', value: null }
    ]);
    expect(pending.mediaPreviousBindings.map((binding) => ({
      field: binding.field,
      mediaId: binding.mediaId.toString(),
      bindingOperationId: binding.bindingOperationId
    }))).toEqual([
      {
        field: 'questionMediaId',
        mediaId: QUESTION_MEDIA_A1,
        bindingOperationId: OPERATION_A
      }
    ]);

    const detailPath = mistakePath(`/${boundMistake._id}`);
    const detailResponse = await request(app)
      .get(detailPath)
      .set(signedHeaders(parentA(), 'GET', detailPath));

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.mistake.questionMediaId).toBe(QUESTION_MEDIA_A1_REPLACEMENT);
    expect(mediaReferenceClient.unbind).toHaveBeenCalledWith(expect.objectContaining({
      references: [{
        mediaId: QUESTION_MEDIA_A1,
        field: 'questionMediaId',
        bindingOperationId: OPERATION_A
      }]
    }));
  });

  test('TC-MPA-SAGA-001 publication failure delays unbind and retry emits one state event', async () => {
    const boundMistake = await FamilyMistake.create({
      ...basePayload({ questionMediaId: QUESTION_MEDIA_A1, parentNote: 'before' }),
      familyId: FAMILY_A_ID,
      createdBy: PARENT_A_ID,
      updatedBy: PARENT_A_ID,
      mediaReferenceState: 'bound',
      mediaReferenceBindings: [{
        field: 'questionMediaId',
        mediaId: QUESTION_MEDIA_A1,
        bindingOperationId: OPERATION_A
      }]
    });
    const mediaReferenceClient = {
      prepare: jest.fn(async ({ references }) => references.map((reference) => ({
        ...reference,
        state: 'prepared'
      }))),
      commit: jest.fn(async ({ references }) => references.map((reference) => ({
        ...reference,
        state: 'bound'
      }))),
      unbind: jest.fn(async ({ references }) => references.map((reference) => ({
        ...reference,
        state: 'released'
      })))
    };
    let transactionAttempt = 0;
    const runTransaction = jest.fn(async (work) => {
      transactionAttempt += 1;
      if (transactionAttempt === 1) throw new Error('transaction unavailable');
      return runMongoTransaction({ mongooseInstance: mongoose, work });
    });
    const service = createFamilyMistakeMediaService({
      FamilyMistakeModel: FamilyMistake,
      FamilyMistakeStateEventModel: FamilyMistakeStateEvent,
      mediaReferenceClient,
      randomUUID: () => OPERATION_B,
      runTransaction
    });
    const app = createApp({ familyMistakeMediaService: service });
    const patchPath = mistakePath(`/${boundMistake._id}`);

    const failed = await request(app)
      .patch(patchPath)
      .set(signedHeaders(parentA(), 'PATCH', patchPath))
      .send({
        questionMediaId: QUESTION_MEDIA_A1_REPLACEMENT,
        parentNote: 'after',
        reviewed: true
      });

    expect(failed.status).toBe(503);
    expect(failed.body.error.code).toBe('MEDIA_REFERENCE_PENDING');
    const pending = await FamilyMistake.findById(boundMistake._id).select('+mediaReferenceState');
    expect(pending.mediaReferenceState).toBe('pending');
    expect(pending.questionMediaId.toString()).toBe(QUESTION_MEDIA_A1);
    expect(pending.parentNote).toBe('before');
    expect(pending.reviewed).toBe(false);
    expect(mediaReferenceClient.unbind).not.toHaveBeenCalled();
    expect(await FamilyMistakeStateEvent.countDocuments({ mistakeId: boundMistake._id })).toBe(0);

    const detailPath = mistakePath(`/${boundMistake._id}`);
    const recovered = await request(app)
      .get(detailPath)
      .set(signedHeaders(parentA(), 'GET', detailPath));

    expect(recovered.status).toBe(200);
    expect(recovered.body.data.mistake).toEqual(expect.objectContaining({
      questionMediaId: QUESTION_MEDIA_A1_REPLACEMENT,
      parentNote: 'after',
      reviewed: true
    }));
    expect(mediaReferenceClient.unbind).toHaveBeenCalledTimes(1);
    expect(await FamilyMistakeStateEvent.countDocuments({ mistakeId: boundMistake._id })).toBe(1);
    expect(runTransaction).toHaveBeenCalledTimes(2);
  });
});

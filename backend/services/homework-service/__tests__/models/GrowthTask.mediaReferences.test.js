const mongoose = require('mongoose');
const GrowthTask = require('../../models/GrowthTask');

const HIDDEN_MEDIA_PATHS = [
  '+attachmentMediaBindings',
  '+mediaBindingOperationId',
  '+attachmentMediaPendingIds',
  '+attachmentMediaPreviousBindings',
  '+mediaBindingPhase',
  '+mediaPendingTaskPatch',
  '+mediaMutationKind',
  '+mediaRemoteOutcomeUncertain'
].join(' ');

const OPERATION_A = '11111111-1111-4111-8111-111111111111';
const OPERATION_B = '22222222-2222-4222-8222-222222222222';

const mediaId = () => new mongoose.Types.ObjectId();

const binding = (id, operationId = OPERATION_A) => ({
  mediaId: id,
  bindingOperationId: operationId
});

const taskFields = (overrides = {}) => ({
  childId: mediaId(),
  familyId: mediaId(),
  createdByParentId: mediaId(),
  dimension: 'academic',
  title: 'Read for twenty minutes',
  taskType: 'reading',
  dueDate: '2026-06-23',
  ...overrides
});

const expectInvalid = async (overrides) => {
  const task = new GrowthTask(taskFields(overrides));
  await expect(task.validate()).rejects.toMatchObject({ name: 'ValidationError' });
};

describe('TC-T6-MEDIA-017A GrowthTask media persistence invariants', () => {
  test('treats a legacy task without media fields as stable none', async () => {
    const legacy = taskFields();
    const { insertedId } = await GrowthTask.collection.insertOne(legacy);

    const task = await GrowthTask.findById(insertedId);

    expect(task.mediaReferenceState).toBe('none');
    expect(task.attachmentMediaIds).toEqual([]);
    await expect(task.validate()).resolves.toBeUndefined();
  });

  test('persists stable none without internal media metadata', async () => {
    const task = await GrowthTask.create(taskFields({
      attachmentMediaIds: [],
      mediaReferenceState: 'none'
    }));

    const stored = await GrowthTask.findById(task._id).select(HIDDEN_MEDIA_PATHS).lean();
    expect(stored.attachmentMediaIds).toEqual([]);
    expect(stored.mediaReferenceState).toBe('none');
    for (const path of HIDDEN_MEDIA_PATHS.split(' ')) {
      expect(stored[path.slice(1)]).toBeUndefined();
    }
  });

  test('persists stable bound state and hides binding generations by default', async () => {
    const first = mediaId();
    const second = mediaId();
    const task = await GrowthTask.create(taskFields({
      attachmentMediaIds: [first, second],
      attachmentMediaBindings: [binding(first), binding(second, OPERATION_B)],
      mediaReferenceState: 'bound'
    }));

    const publicTask = await GrowthTask.findById(task._id).lean();
    expect(publicTask.attachmentMediaIds.map(String)).toEqual([String(first), String(second)]);
    expect(publicTask.mediaReferenceState).toBe('bound');
    expect(publicTask.attachmentMediaBindings).toBeUndefined();

    const internalTask = await GrowthTask.findById(task._id).select(HIDDEN_MEDIA_PATHS).lean();
    expect(internalTask.attachmentMediaBindings.map((entry) => ({
      mediaId: String(entry.mediaId),
      bindingOperationId: entry.bindingOperationId
    }))).toEqual([
      { mediaId: String(first), bindingOperationId: OPERATION_A },
      { mediaId: String(second), bindingOperationId: OPERATION_B }
    ]);
  });

  test.each([
    ['create pending', () => {
      const first = mediaId();
      const second = mediaId();
      return {
        attachmentMediaIds: [],
        attachmentMediaBindings: [],
        mediaReferenceState: 'pending',
        mediaBindingOperationId: OPERATION_A,
        attachmentMediaPendingIds: [first, second],
        attachmentMediaPreviousBindings: [],
        mediaBindingPhase: 'binding',
        mediaPendingTaskPatch: [],
        mediaMutationKind: 'create',
        mediaRemoteOutcomeUncertain: false
      };
    }],
    ['patch binding', () => {
      const previous = mediaId();
      const added = mediaId();
      return {
        attachmentMediaIds: [previous],
        attachmentMediaBindings: [binding(previous)],
        mediaReferenceState: 'pending',
        mediaBindingOperationId: OPERATION_B,
        attachmentMediaPendingIds: [previous, added],
        attachmentMediaPreviousBindings: [binding(previous)],
        mediaBindingPhase: 'binding',
        mediaPendingTaskPatch: [{ path: 'title', value: 'Updated title' }],
        mediaMutationKind: 'patch',
        mediaRemoteOutcomeUncertain: true
      };
    }],
    ['patch unbinding', () => {
      const kept = mediaId();
      const removed = mediaId();
      return {
        attachmentMediaIds: [kept],
        attachmentMediaBindings: [binding(kept)],
        mediaReferenceState: 'pending',
        mediaBindingOperationId: OPERATION_B,
        attachmentMediaPendingIds: [kept],
        attachmentMediaPreviousBindings: [binding(kept), binding(removed, OPERATION_B)],
        mediaBindingPhase: 'unbinding',
        mediaPendingTaskPatch: [{ path: 'description', value: null }],
        mediaMutationKind: 'patch',
        mediaRemoteOutcomeUncertain: false
      };
    }]
  ])('persists %s state and hides recovery metadata by default', async (_label, stateFactory) => {
    const state = stateFactory();
    const task = await GrowthTask.create(taskFields(state));

    const publicTask = await GrowthTask.findById(task._id).lean();
    for (const path of HIDDEN_MEDIA_PATHS.split(' ')) {
      expect(publicTask[path.slice(1)]).toBeUndefined();
    }

    const internalTask = await GrowthTask.findById(task._id).select(HIDDEN_MEDIA_PATHS).lean();
    expect(internalTask.mediaBindingOperationId).toBe(state.mediaBindingOperationId);
    expect(internalTask.mediaMutationKind).toBe(state.mediaMutationKind);
    expect(internalTask.mediaRemoteOutcomeUncertain).toBe(state.mediaRemoteOutcomeUncertain);
  });

  test('rejects duplicate public IDs and current bindings that differ by ID or order', async () => {
    const first = mediaId();
    const second = mediaId();

    await expectInvalid({
      attachmentMediaIds: [first, first],
      attachmentMediaBindings: [binding(first), binding(first)],
      mediaReferenceState: 'bound'
    });
    await expectInvalid({
      attachmentMediaIds: [first, second],
      attachmentMediaBindings: [binding(first)],
      mediaReferenceState: 'bound'
    });
    await expectInvalid({
      attachmentMediaIds: [first, second],
      attachmentMediaBindings: [binding(second), binding(first)],
      mediaReferenceState: 'bound'
    });
  });

  test.each([
    ['public media ID', { attachmentMediaIds: ['not-an-object-id'], mediaReferenceState: 'bound' }],
    ['current binding media ID', {
      attachmentMediaIds: [mediaId()],
      attachmentMediaBindings: [{ mediaId: 'not-an-object-id', bindingOperationId: OPERATION_A }],
      mediaReferenceState: 'bound'
    }],
    ['pending media ID', {
      attachmentMediaIds: [],
      attachmentMediaBindings: [],
      mediaReferenceState: 'pending',
      mediaBindingOperationId: OPERATION_A,
      attachmentMediaPendingIds: ['not-an-object-id'],
      attachmentMediaPreviousBindings: [],
      mediaBindingPhase: 'binding',
      mediaPendingTaskPatch: [],
      mediaMutationKind: 'create',
      mediaRemoteOutcomeUncertain: false
    }],
    ['mutation operation UUID', {
      attachmentMediaIds: [],
      attachmentMediaBindings: [],
      mediaReferenceState: 'pending',
      mediaBindingOperationId: 'not-a-uuid',
      attachmentMediaPendingIds: [],
      attachmentMediaPreviousBindings: [],
      mediaBindingPhase: 'binding',
      mediaPendingTaskPatch: [],
      mediaMutationKind: 'create',
      mediaRemoteOutcomeUncertain: false
    }],
    ['binding operation UUID', (() => {
      const id = mediaId();
      return {
        attachmentMediaIds: [id],
        attachmentMediaBindings: [binding(id, 'not-a-uuid')],
        mediaReferenceState: 'bound'
      };
    })()]
  ])('rejects malformed %s', async (_label, state) => {
    await expectInvalid(state);
  });

  test.each([
    'mediaBindingOperationId',
    'attachmentMediaPendingIds',
    'attachmentMediaPreviousBindings',
    'mediaBindingPhase',
    'mediaMutationKind',
    'mediaRemoteOutcomeUncertain'
  ])('rejects pending state missing %s', async (missingPath) => {
    const desired = mediaId();
    const state = {
      attachmentMediaIds: [],
      attachmentMediaBindings: [],
      mediaReferenceState: 'pending',
      mediaBindingOperationId: OPERATION_A,
      attachmentMediaPendingIds: [desired],
      attachmentMediaPreviousBindings: [],
      mediaBindingPhase: 'binding',
      mediaPendingTaskPatch: [],
      mediaMutationKind: 'create',
      mediaRemoteOutcomeUncertain: false
    };
    delete state[missingPath];

    await expectInvalid(state);
  });

  test.each([
    ['none', { mediaBindingOperationId: OPERATION_A }],
    ['bound', { attachmentMediaPendingIds: [] }]
  ])('rejects internal metadata on stable %s state', async (state, metadata) => {
    const id = mediaId();
    await expectInvalid(state === 'none'
      ? { attachmentMediaIds: [], mediaReferenceState: state, ...metadata }
      : {
        attachmentMediaIds: [id],
        attachmentMediaBindings: [binding(id)],
        mediaReferenceState: state,
        ...metadata
      });
  });

  test.each([
    ['phase', { mediaBindingPhase: 'publishing' }],
    ['mutation kind', { mediaMutationKind: 'replace' }]
  ])('rejects an invalid pending %s', async (_label, override) => {
    await expectInvalid({
      attachmentMediaIds: [],
      attachmentMediaBindings: [],
      mediaReferenceState: 'pending',
      mediaBindingOperationId: OPERATION_A,
      attachmentMediaPendingIds: [],
      attachmentMediaPreviousBindings: [],
      mediaBindingPhase: 'binding',
      mediaPendingTaskPatch: [],
      mediaMutationKind: 'create',
      mediaRemoteOutcomeUncertain: false,
      ...override
    });
  });

  test.each(['profile.name', '$set.title', 'actualMinutes'])('rejects non-canonical pending path %s', async (path) => {
    await expectInvalid({
      attachmentMediaIds: [],
      attachmentMediaBindings: [],
      mediaReferenceState: 'pending',
      mediaBindingOperationId: OPERATION_A,
      attachmentMediaPendingIds: [],
      attachmentMediaPreviousBindings: [],
      mediaBindingPhase: 'binding',
      mediaPendingTaskPatch: [{ path, value: 'unsafe' }],
      mediaMutationKind: 'patch',
      mediaRemoteOutcomeUncertain: false
    });
  });

  test('requires every pending patch entry to own value, including when null is valid', async () => {
    const valid = new GrowthTask(taskFields({
      attachmentMediaIds: [],
      attachmentMediaBindings: [],
      mediaReferenceState: 'pending',
      mediaBindingOperationId: OPERATION_A,
      attachmentMediaPendingIds: [],
      attachmentMediaPreviousBindings: [],
      mediaBindingPhase: 'binding',
      mediaPendingTaskPatch: [{ path: 'description', value: null }],
      mediaMutationKind: 'patch',
      mediaRemoteOutcomeUncertain: false
    }));
    await expect(valid.validate()).resolves.toBeUndefined();

    valid.mediaPendingTaskPatch = [{ path: 'description' }];
    await expect(valid.validate()).rejects.toMatchObject({ name: 'ValidationError' });
  });

  test('uses strict throwing sub-schemas for bindings and pending patches', () => {
    const id = mediaId();
    const invalidBinding = new GrowthTask(taskFields({
      attachmentMediaIds: [id],
      attachmentMediaBindings: [{ ...binding(id), unexpected: true }],
      mediaReferenceState: 'bound'
    }));
    const invalidPatch = new GrowthTask(taskFields({
      mediaPendingTaskPatch: [{ path: 'title', value: 'new', unexpected: true }]
    }));

    const bindingError = invalidBinding.validateSync();
    const patchError = invalidPatch.validateSync();
    expect(bindingError.errors.attachmentMediaBindings.reason).toBeInstanceOf(mongoose.Error.StrictModeError);
    expect(patchError.errors.mediaPendingTaskPatch.reason).toBeInstanceOf(mongoose.Error.StrictModeError);
  });

  test('rejects public, pending, and previous arrays over 100 entries', async () => {
    const ids = Array.from({ length: 101 }, mediaId);

    await expectInvalid({
      attachmentMediaIds: ids,
      attachmentMediaBindings: ids.map((id) => binding(id)),
      mediaReferenceState: 'bound'
    });
    await expectInvalid({
      attachmentMediaIds: [],
      attachmentMediaBindings: [],
      mediaReferenceState: 'pending',
      mediaBindingOperationId: OPERATION_A,
      attachmentMediaPendingIds: ids,
      attachmentMediaPreviousBindings: [],
      mediaBindingPhase: 'binding',
      mediaPendingTaskPatch: [],
      mediaMutationKind: 'create',
      mediaRemoteOutcomeUncertain: false
    });
    await expectInvalid({
      attachmentMediaIds: [],
      attachmentMediaBindings: [],
      mediaReferenceState: 'pending',
      mediaBindingOperationId: OPERATION_A,
      attachmentMediaPendingIds: [],
      attachmentMediaPreviousBindings: ids.map((id) => binding(id)),
      mediaBindingPhase: 'unbinding',
      mediaPendingTaskPatch: [],
      mediaMutationKind: 'patch',
      mediaRemoteOutcomeUncertain: false
    });
  });
});

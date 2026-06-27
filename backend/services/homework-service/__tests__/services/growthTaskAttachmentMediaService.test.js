const GrowthTask = require('../../models/GrowthTask');
const {
  createGrowthTaskAttachmentMediaService
} = require('../../services/growthTaskAttachmentMediaService');
const {
  parseGrowthTaskCreate,
  parseGrowthTaskPatch,
  entriesToMongoSet,
  normalizeAttachmentMediaIds
} = require('../../services/growthTaskPatch');

const MEDIA_A = 'AAAAAAAAAAAAAAAAAAAAAAAA';
const MEDIA_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const MEDIA_C = 'cccccccccccccccccccccccc';
const FAMILY_A = '111111111111111111111111';
const CHILD_A = '222222222222222222222222';
const PARENT_A = '333333333333333333333333';
const OPERATION_A = '9bf7c3f3-cc6d-41fe-95b5-b2832aafd394';
const OPERATION_B = '11111111-1111-4111-8111-111111111111';
const OPERATION_C = '22222222-2222-4222-8222-222222222222';
const HIDDEN_GROWTH_TASK_MEDIA_STATE = [
  '+attachmentMediaBindings',
  '+mediaBindingOperationId',
  '+attachmentMediaPendingIds',
  '+attachmentMediaPreviousBindings',
  '+mediaBindingPhase',
  '+mediaPendingTaskPatch',
  '+mediaMutationKind',
  '+mediaRemoteOutcomeUncertain'
].join(' ');

const requiredCreateFields = (overrides = {}) => ({
  childId: '111111111111111111111111',
  dimension: 'academic',
  title: '阅读',
  taskType: 'practice',
  dueDate: '2026-06-23',
  ...overrides
});

const createTaskInput = (overrides = {}) => ({
  childId: CHILD_A,
  familyId: FAMILY_A,
  createdByParentId: PARENT_A,
  dimension: 'academic',
  title: '阅读',
  taskType: 'practice',
  dueDate: '2026-06-23',
  ...overrides
});

const loadInternalTask = (taskId) => (
  GrowthTask.findById(taskId).select(HIDDEN_GROWTH_TASK_MEDIA_STATE)
);

const pendingClientError = () => Object.assign(new Error('network unavailable'), {
  status: 503,
  code: 'UPSTREAM_UNAVAILABLE',
  details: { private: true }
});

const stableMediaError = (status = 404) => Object.assign(new Error('Media not found'), {
  status,
  code: 'RESOURCE_NOT_FOUND',
  details: []
});

const createHarness = ({
  GrowthTaskModel = GrowthTask,
  prepare,
  commit,
  unbind,
  operationId = OPERATION_A
} = {}) => {
  const mediaReferenceClient = {
    prepare: jest.fn(prepare || (async () => [
      { mediaId: MEDIA_A.toLowerCase(), field: 'attachmentMediaIds', state: 'prepared' },
      { mediaId: MEDIA_B, field: 'attachmentMediaIds', state: 'prepared' }
    ])),
    commit: jest.fn(commit || (async () => [
      { mediaId: MEDIA_A.toLowerCase(), field: 'attachmentMediaIds', state: 'bound' },
      { mediaId: MEDIA_B, field: 'attachmentMediaIds', state: 'bound' }
    ])),
    unbind: jest.fn(unbind || (async (command) => command.references.map((reference) => ({
      mediaId: reference.mediaId,
      field: reference.field,
      state: 'released'
    }))))
  };
  const randomUUID = jest.fn(() => operationId);
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const service = createGrowthTaskAttachmentMediaService({
    GrowthTaskModel,
    mediaReferenceClient,
    randomUUID,
    logger
  });
  return { service, mediaReferenceClient, randomUUID, logger };
};

const expectRequiredCommand = (mediaReferenceClient, taskId) => {
  const command = {
    familyId: FAMILY_A,
    childId: CHILD_A,
    resourceType: 'growth_task',
    resourceId: taskId,
    operationId: OPERATION_A,
    references: [
      { mediaId: MEDIA_A.toLowerCase(), field: 'attachmentMediaIds' },
      { mediaId: MEDIA_B, field: 'attachmentMediaIds' }
    ]
  };
  expect(mediaReferenceClient.prepare).toHaveBeenCalledWith(command);
  return command;
};

const bindingValues = (entries = []) => entries.map((entry) => ({
  mediaId: String(entry.mediaId),
  bindingOperationId: entry.bindingOperationId
}));

const boundEnvelope = (command, state) => command.references.map((reference) => ({
  mediaId: reference.mediaId,
  field: reference.field,
  state
}));

const releasedEnvelope = (command) => command.references.map((reference) => ({
  mediaId: reference.mediaId,
  field: reference.field,
  state: 'released'
}));

const createBoundTask = async ({
  ids = [MEDIA_A, MEDIA_B],
  title = '阅读',
  status = 'pending',
  bindings = ids.map((mediaId) => ({ mediaId, bindingOperationId: OPERATION_B })),
  overrides = {}
} = {}) => GrowthTask.create({
  ...createTaskInput({
    title,
    status,
    attachmentMediaIds: ids,
    ...overrides
  }),
  attachmentMediaBindings: bindings,
  mediaReferenceState: ids.length ? 'bound' : 'none'
});

const expectPendingError = async (promise, taskId) => {
  await expect(promise).rejects.toMatchObject({
    status: 503,
    code: 'MEDIA_REFERENCE_PENDING',
    details: { resourceId: String(taskId) }
  });
};

const expectValidationError = (operation) => {
  let error;
  try {
    operation();
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeInstanceOf(Error);
  expect(error).toMatchObject({
    status: 400,
    code: 'VALIDATION_ERROR',
    details: []
  });
  expect([
    'Invalid growth task request',
    'Required growth task fields are missing',
    'Invalid growth task dimension',
    'Invalid attachment media IDs',
    'Invalid growth task patch entries'
  ]).toContain(error.message);
};

describe('TC-T6-MEDIA-017H normalization/order parser boundary', () => {
  test('returns canonical patch entries and normalized IDs in first-occurrence order', () => {
    expect(parseGrowthTaskPatch({
      title: '  新任务  ',
      priority: 'high',
      attachmentMediaIds: [MEDIA_A, MEDIA_B, MEDIA_A]
    })).toEqual({
      entries: [
        { path: 'title', value: '新任务' },
        { path: 'priority', value: 'high' }
      ],
      hasAttachmentMutation: true,
      attachmentMediaIds: [MEDIA_A.toLowerCase(), MEDIA_B]
    });
  });

  test('distinguishes omitted attachments from explicit removal and accepts route-compatible no-op', () => {
    expect(parseGrowthTaskPatch({ title: 'task' })).toEqual({
      entries: [{ path: 'title', value: 'task' }],
      hasAttachmentMutation: false,
      attachmentMediaIds: undefined
    });
    expect(parseGrowthTaskPatch({ attachmentMediaIds: [] })).toEqual({
      entries: [],
      hasAttachmentMutation: true,
      attachmentMediaIds: []
    });
    expect(parseGrowthTaskPatch({})).toEqual({
      entries: [],
      hasAttachmentMutation: false,
      attachmentMediaIds: undefined
    });
  });

  test('checks the 100-item limit before deduplication', () => {
    expectValidationError(() => normalizeAttachmentMediaIds(Array(101).fill(MEDIA_A)));
  });

  test.each([
    null,
    MEDIA_A,
    7,
    {},
    [null],
    [7],
    [{}],
    ['https://private.example/media'],
    ['not-an-object-id']
  ])('rejects malformed attachmentMediaIds %#', (value) => {
    expectValidationError(() => normalizeAttachmentMediaIds(value));
  });
});

describe('TC-T6-MEDIA-017I canonical owner patch parser boundary', () => {
  test('accepts every editable plan field, trims schema-trimmed strings, and retains falsy values', () => {
    expect(parseGrowthTaskPatch({
      dimension: 'physical',
      area: '  跳绳  ',
      subject: '',
      title: '  晨练  ',
      taskType: '  exercise  ',
      description: '',
      dueDate: '2026-06-24',
      estimatedMinutes: 0,
      targetAmount: 0,
      unit: '  count  ',
      priority: 'low'
    }).entries).toEqual([
      { path: 'dimension', value: 'physical' },
      { path: 'area', value: '跳绳' },
      { path: 'subject', value: '' },
      { path: 'title', value: '晨练' },
      { path: 'taskType', value: 'exercise' },
      { path: 'description', value: '' },
      { path: 'dueDate', value: '2026-06-24' },
      { path: 'estimatedMinutes', value: 0 },
      { path: 'targetAmount', value: 0 },
      { path: 'unit', value: 'count' },
      { path: 'priority', value: 'low' }
    ]);
  });

  test('strictly parses create fields and enforces required business fields', () => {
    expect(parseGrowthTaskCreate(requiredCreateFields({
      title: '  新任务  ',
      description: '',
      estimatedMinutes: 0,
      attachmentMediaIds: [MEDIA_A, MEDIA_A]
    }))).toEqual({
      taskInput: {
        childId: '111111111111111111111111',
        dimension: 'academic',
        title: '新任务',
        taskType: 'practice',
        description: '',
        dueDate: '2026-06-23',
        estimatedMinutes: 0
      },
      hasAttachmentMutation: true,
      attachmentMediaIds: [MEDIA_A.toLowerCase()]
    });

    for (const field of ['childId', 'dimension', 'title', 'taskType', 'dueDate']) {
      const body = requiredCreateFields();
      delete body[field];
      expectValidationError(() => parseGrowthTaskCreate(body));
    }
    expectValidationError(() => parseGrowthTaskCreate(requiredCreateFields({ dimension: 'unknown' })));
    expectValidationError(() => parseGrowthTaskCreate(requiredCreateFields({ title: '   ' })));
  });

  test('entriesToMongoSet accepts canonical entries only and emits fixed server paths', () => {
    expect(entriesToMongoSet([
      { path: 'title', value: 'task' },
      { path: 'estimatedMinutes', value: 0 },
      { path: 'description', value: '' }
    ])).toEqual({ title: 'task', estimatedMinutes: 0, description: '' });

    expectValidationError(() => entriesToMongoSet([{ path: '$set.status', value: 'confirmed' }]));
    expectValidationError(() => entriesToMongoSet([{ path: 'title.value', value: 'unsafe' }]));
    expectValidationError(() => entriesToMongoSet({ title: 'unsafe' }));
  });
});

describe('TC-T6-MEDIA-018C strict request contract', () => {
  const forbiddenFields = [
    'attachments', '$set', 'task', 'growthTask', 'title.value', 'unknown',
    'familyId', 'createdByParentId', 'status', 'actualMinutes', 'actualAmount',
    'difficulty', 'needsHelp', 'completionNote', 'parentFeedback', 'starAwardState',
    'completedAt', 'confirmedAt', 'confirmedByParentId', 'cancelledAt',
    'attachmentMediaBindings', 'mediaReferenceState', 'mediaBindingOperationId',
    'attachmentMediaPendingIds', 'attachmentMediaPreviousBindings',
    'mediaBindingPhase', 'mediaPendingTaskPatch', 'mediaMutationKind',
    'mediaRemoteOutcomeUncertain'
  ];

  test.each(forbiddenFields)('rejects forbidden create field %s before parsing values', (field) => {
    expectValidationError(() => parseGrowthTaskCreate({
      ...requiredCreateFields({ title: 'PRIVATE_SENTINEL' }),
      [field]: field === 'attachments' ? [{ url: 'https://private.example/file' }] : 'PRIVATE_SENTINEL'
    }));
  });

  test.each([...forbiddenFields, 'childId'])('rejects forbidden patch field %s', (field) => {
    expectValidationError(() => parseGrowthTaskPatch({ [field]: 'PRIVATE_SENTINEL' }));
  });

  test('does not expose raw request values in validation messages', () => {
    try {
      parseGrowthTaskPatch({ ownership: 'PRIVATE_SENTINEL' });
      throw new Error('expected parser to reject request');
    } catch (error) {
      expect(error.message).toBe('Invalid growth task request');
      expect(error.message).not.toContain('PRIVATE_SENTINEL');
      expect(error.details).toEqual([]);
    }
  });

  test('rejects non-object request bodies', () => {
    for (const body of [null, undefined, [], 'task', 0]) {
      expectValidationError(() => parseGrowthTaskPatch(body));
      expectValidationError(() => parseGrowthTaskCreate(body));
    }
  });
});

describe('TC-T6-MEDIA-017B GrowthTask attachment create binding', () => {
  test('creates an unexposed pending owner, sends the exact prepare command, and publishes after commit', async () => {
    let taskId;
    const events = [];
    const { service, mediaReferenceClient, randomUUID } = createHarness({
      prepare: async (command) => {
        taskId = command.resourceId;
        const duringPrepare = await loadInternalTask(taskId);
        expect(duringPrepare.mediaReferenceState).toBe('pending');
        expect(duringPrepare.attachmentMediaIds).toEqual([]);
        expect(duringPrepare.attachmentMediaPendingIds.map(String)).toEqual([
          MEDIA_A.toLowerCase(),
          MEDIA_B
        ]);
        expect(duringPrepare.mediaBindingPhase).toBe('binding');
        expect(duringPrepare.mediaMutationKind).toBe('create');
        expect(duringPrepare.mediaRemoteOutcomeUncertain).toBe(true);
        events.push('prepare');
        return [
          { mediaId: MEDIA_A.toLowerCase(), field: 'attachmentMediaIds', state: 'prepared' },
          { mediaId: MEDIA_B, field: 'attachmentMediaIds', state: 'prepared' }
        ];
      },
      commit: async () => {
        const duringCommit = await loadInternalTask(taskId);
        expect(duringCommit.attachmentMediaIds).toEqual([]);
        events.push('commit');
        return [
          { mediaId: MEDIA_A.toLowerCase(), field: 'attachmentMediaIds', state: 'bound' },
          { mediaId: MEDIA_B, field: 'attachmentMediaIds', state: 'bound' }
        ];
      }
    });

    const result = await service.create({
      taskInput: createTaskInput(),
      attachmentMediaIds: [MEDIA_A, MEDIA_B]
    });

    const command = expectRequiredCommand(mediaReferenceClient, result._id.toString());
    expect(mediaReferenceClient.commit).toHaveBeenCalledWith(command);
    expect(events).toEqual(['prepare', 'commit']);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(result.mediaReferenceState).toBe('bound');
    expect(result.attachmentMediaIds.map(String)).toEqual([MEDIA_A.toLowerCase(), MEDIA_B]);
    expect(result.attachmentMediaBindings.map((entry) => ({
      mediaId: String(entry.mediaId),
      bindingOperationId: entry.bindingOperationId
    }))).toEqual([
      { mediaId: MEDIA_A.toLowerCase(), bindingOperationId: OPERATION_A },
      { mediaId: MEDIA_B, bindingOperationId: OPERATION_A }
    ]);

    const stored = await loadInternalTask(result._id);
    expect(stored.mediaBindingOperationId).toBeUndefined();
    expect(stored.attachmentMediaPendingIds).toBeUndefined();
    expect(stored.attachmentMediaPreviousBindings).toBeUndefined();
    expect(stored.mediaBindingPhase).toBeUndefined();
    expect(stored.mediaMutationKind).toBeUndefined();
    expect(stored.mediaRemoteOutcomeUncertain).toBeUndefined();
  });

  test('creates without attachments through ordinary owner create and sends no media command', async () => {
    const { service, mediaReferenceClient, randomUUID } = createHarness();

    const result = await service.create({
      taskInput: createTaskInput({ title: '无附件' }),
      attachmentMediaIds: []
    });

    expect(result.mediaReferenceState).toBe('none');
    expect(result.attachmentMediaIds).toEqual([]);
    expect(mediaReferenceClient.prepare).not.toHaveBeenCalled();
    expect(mediaReferenceClient.commit).not.toHaveBeenCalled();
    expect(randomUUID).not.toHaveBeenCalled();
  });

  test('accepts sorted media-service envelopes while preserving requested public order', async () => {
    const { service, mediaReferenceClient } = createHarness({
      prepare: async () => [
        { mediaId: MEDIA_A.toLowerCase(), field: 'attachmentMediaIds', state: 'prepared' },
        { mediaId: MEDIA_B, field: 'attachmentMediaIds', state: 'prepared' }
      ],
      commit: async () => [
        { mediaId: MEDIA_A.toLowerCase(), field: 'attachmentMediaIds', state: 'bound' },
        { mediaId: MEDIA_B, field: 'attachmentMediaIds', state: 'bound' }
      ]
    });

    const result = await service.create({
      taskInput: createTaskInput(),
      attachmentMediaIds: [MEDIA_B, MEDIA_A]
    });

    expect(mediaReferenceClient.prepare).toHaveBeenCalledWith(expect.objectContaining({
      references: [
        { mediaId: MEDIA_B, field: 'attachmentMediaIds' },
        { mediaId: MEDIA_A.toLowerCase(), field: 'attachmentMediaIds' }
      ]
    }));
    expect(result.mediaReferenceState).toBe('bound');
    expect(result.attachmentMediaIds.map(String)).toEqual([MEDIA_B, MEDIA_A.toLowerCase()]);
  });
});

describe('TC-T6-MEDIA-017D GrowthTask attachment rollback boundary', () => {
  test('deletes the first-attempt pending owner and returns a sanitized stable prepare rejection', async () => {
    const stable = Object.assign(stableMediaError(404), {
      config: { headers: { authorization: 'Bearer private-token' } },
      response: { data: { secret: 'private-response' } },
      details: [{ private: 'raw-media-details' }]
    });
    const { service, mediaReferenceClient } = createHarness({
      prepare: async () => { throw stable; }
    });

    let caught;
    try {
      await service.create({
        taskInput: createTaskInput(),
        attachmentMediaIds: [MEDIA_A, MEDIA_B]
      });
    } catch (error) {
      caught = error;
    }

    const taskId = mediaReferenceClient.prepare.mock.calls[0][0].resourceId;
    expectRequiredCommand(mediaReferenceClient, taskId);
    expect(await GrowthTask.findById(taskId)).toBeNull();
    expect(mediaReferenceClient.commit).not.toHaveBeenCalled();
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBe(stable);
    expect(caught.message).toBe('Media reference rejected');
    expect(caught.status).toBe(404);
    expect(caught.code).toBe('RESOURCE_NOT_FOUND');
    expect(caught.details).toEqual([]);
    expect(Object.keys(caught).sort()).toEqual(['code', 'details', 'status']);
    expect(caught).not.toHaveProperty('config');
    expect(caught).not.toHaveProperty('response');
    expect(JSON.stringify(caught)).not.toContain('private');
  });

  test('keeps an uncertain owner and returns pending when first-attempt rollback cannot confirm deletion', async () => {
    const stable = stableMediaError(409);
    let taskId;
    const GrowthTaskModel = {
      create: (...args) => GrowthTask.create(...args),
      findById: (...args) => GrowthTask.findById(...args),
      findOneAndUpdate: (...args) => GrowthTask.findOneAndUpdate(...args),
      deleteOne: jest.fn(async (filter) => {
        taskId = filter._id;
        return { deletedCount: 0 };
      })
    };
    const { service } = createHarness({
      GrowthTaskModel,
      prepare: async () => { throw stable; }
    });

    await expect(service.create({
      taskInput: createTaskInput(),
      attachmentMediaIds: [MEDIA_A, MEDIA_B]
    })).rejects.toMatchObject({
      status: 503,
      code: 'MEDIA_REFERENCE_PENDING'
    });

    const stored = await loadInternalTask(taskId);
    expect(stored.mediaReferenceState).toBe('pending');
    expect(stored.mediaRemoteOutcomeUncertain).toBe(true);
  });

  test('resume never deletes a pending owner after a stable prepare rejection', async () => {
    const stable = stableMediaError(403);
    const { service } = createHarness({ prepare: async () => { throw pendingClientError(); } });

    await expect(service.create({
      taskInput: createTaskInput(),
      attachmentMediaIds: [MEDIA_A, MEDIA_B]
    })).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
    const taskId = (await GrowthTask.findOne({ title: '阅读' }))._id.toString();

    const GrowthTaskModel = {
      create: (...args) => GrowthTask.create(...args),
      findById: (...args) => GrowthTask.findById(...args),
      findOneAndUpdate: (...args) => GrowthTask.findOneAndUpdate(...args),
      deleteOne: jest.fn((...args) => GrowthTask.deleteOne(...args))
    };
    const resumedHarness = createHarness({
      GrowthTaskModel,
      prepare: async () => { throw stable; }
    });

    await expectPendingError(resumedHarness.service.resume(taskId), taskId);
    expect(GrowthTaskModel.deleteOne).not.toHaveBeenCalled();
    expect(await GrowthTask.findById(taskId)).not.toBeNull();
  });
});

describe('TC-T6-MEDIA-017E GrowthTask attachment recovery', () => {
  test.each(['prepare', 'commit'])('reuses the durable operation after a lost %s response', async (failedMethod) => {
    let failed = false;
    const successEnvelope = failedMethod === 'prepare'
      ? [
        { mediaId: MEDIA_A.toLowerCase(), field: 'attachmentMediaIds', state: 'prepared' },
        { mediaId: MEDIA_B, field: 'attachmentMediaIds', state: 'prepared' }
      ]
      : [
        { mediaId: MEDIA_A.toLowerCase(), field: 'attachmentMediaIds', state: 'bound' },
        { mediaId: MEDIA_B, field: 'attachmentMediaIds', state: 'bound' }
      ];
    const behavior = async () => {
      if (!failed) {
        failed = true;
        throw pendingClientError();
      }
      return successEnvelope;
    };
    const { service, mediaReferenceClient, randomUUID } = createHarness({
      ...(failedMethod === 'prepare' ? { prepare: behavior } : { commit: behavior })
    });

    await expect(service.create({
      taskInput: createTaskInput(),
      attachmentMediaIds: [MEDIA_A, MEDIA_B]
    })).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });

    const pending = await GrowthTask.findOne({ title: '阅读' }).select(HIDDEN_GROWTH_TASK_MEDIA_STATE);
    expect(pending.mediaBindingOperationId).toBe(OPERATION_A);
    expect(pending.attachmentMediaIds).toEqual([]);

    const recovered = await service.resume(pending._id);
    expect(recovered.mediaReferenceState).toBe('bound');
    expect(recovered.attachmentMediaIds.map(String)).toEqual([MEDIA_A.toLowerCase(), MEDIA_B]);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(mediaReferenceClient.prepare).toHaveBeenCalledTimes(2);
    expect(mediaReferenceClient.commit).toHaveBeenCalledTimes(failedMethod === 'prepare' ? 1 : 2);
  });

  test('retains pending owner and sanitizes commit failure', async () => {
    const rawCommitError = Object.assign(new Error('raw commit failure'), {
      status: 500,
      code: 'RAW_COMMIT',
      config: { secret: 'do-not-leak' },
      response: { data: { token: 'do-not-leak' } }
    });
    const { service } = createHarness({
      commit: async () => { throw rawCommitError; }
    });

    let caught;
    try {
      await service.create({
        taskInput: createTaskInput(),
        attachmentMediaIds: [MEDIA_A, MEDIA_B]
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      status: 503,
      code: 'MEDIA_REFERENCE_PENDING'
    });
    expect(caught).not.toHaveProperty('config');
    expect(caught).not.toHaveProperty('response');
    expect(await GrowthTask.findOne({ title: '阅读' })).not.toBeNull();
  });

  test.each([
    ['before persistence', false],
    ['after persistence', true]
  ])('recovers when the owner publication response is lost %s', async (label, persistFirst) => {
    let losePublishResponse = true;
    const GrowthTaskModel = {
      create: (...args) => GrowthTask.create(...args),
      findById: (...args) => GrowthTask.findById(...args),
      deleteOne: (...args) => GrowthTask.deleteOne(...args),
      findOneAndUpdate: (filter, update, options) => {
        const isPublish = update.$set
          && update.$set.mediaReferenceState === 'bound'
          && update.$unset
          && filter.mediaBindingPhase === 'binding';
        if (!isPublish || !losePublishResponse) {
          return GrowthTask.findOneAndUpdate(filter, update, options);
        }
        losePublishResponse = false;
        if (!persistFirst) return Promise.reject(new Error('owner publish unavailable'));
        return GrowthTask.findOneAndUpdate(filter, update, options)
          .then(() => { throw new Error('owner publish response lost'); });
      }
    };
    const { service } = createHarness({ GrowthTaskModel });

    if (persistFirst) {
      const result = await service.create({
        taskInput: createTaskInput(),
        attachmentMediaIds: [MEDIA_A, MEDIA_B]
      });
      expect(result.mediaReferenceState).toBe('bound');
    } else {
      await expect(service.create({
        taskInput: createTaskInput(),
        attachmentMediaIds: [MEDIA_A, MEDIA_B]
      })).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });

      const pending = await GrowthTask.findOne({ title: '阅读' });
      const result = await service.resume(pending._id);
      expect(result.mediaReferenceState).toBe('bound');
    }
  });

  test('crash after uncertainty marker before prepare is recoverable without a duplicate task or operation', async () => {
    let failAfterUncertaintyMarker = true;
    const GrowthTaskModel = {
      create: (...args) => GrowthTask.create(...args),
      findById: (...args) => GrowthTask.findById(...args),
      deleteOne: (...args) => GrowthTask.deleteOne(...args),
      findOneAndUpdate: (filter, update, options) => {
        const markingUncertain = update.$set
          && update.$set.mediaRemoteOutcomeUncertain === true
          && filter.mediaRemoteOutcomeUncertain === false;
        if (markingUncertain && failAfterUncertaintyMarker) {
          failAfterUncertaintyMarker = false;
          return GrowthTask.findOneAndUpdate(filter, update, options)
            .then(() => { throw new Error('crash after marker'); });
        }
        return GrowthTask.findOneAndUpdate(filter, update, options);
      }
    };
    const { service, mediaReferenceClient, randomUUID } = createHarness({ GrowthTaskModel });

    await expect(service.create({
      taskInput: createTaskInput(),
      attachmentMediaIds: [MEDIA_A, MEDIA_B]
    })).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });

    expect(mediaReferenceClient.prepare).not.toHaveBeenCalled();
    const pendingTasks = await GrowthTask.find({ title: '阅读' }).select(HIDDEN_GROWTH_TASK_MEDIA_STATE);
    expect(pendingTasks).toHaveLength(1);
    expect(pendingTasks[0].mediaRemoteOutcomeUncertain).toBe(true);

    const recovered = await service.resume(pendingTasks[0]._id);
    expect(recovered.mediaReferenceState).toBe('bound');
    expect(mediaReferenceClient.prepare).toHaveBeenCalledTimes(1);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(await GrowthTask.countDocuments({ title: '阅读' })).toBe(1);
  });

  test('resume marks uncertainty before prepare and never rolls back on a stable prepare response', async () => {
    const task = await GrowthTask.create({
      ...createTaskInput({ attachmentMediaIds: [] }),
      attachmentMediaBindings: [],
      mediaReferenceState: 'pending',
      mediaBindingOperationId: OPERATION_A,
      attachmentMediaPendingIds: [MEDIA_A.toLowerCase(), MEDIA_B],
      attachmentMediaPreviousBindings: [],
      mediaBindingPhase: 'binding',
      mediaPendingTaskPatch: [],
      mediaMutationKind: 'create',
      mediaRemoteOutcomeUncertain: false
    });
    const initialVersion = task.__v;
    let versionDuringPrepare;
    let uncertaintyDuringPrepare;
    const stable = stableMediaError(409);
    const GrowthTaskModel = {
      create: (...args) => GrowthTask.create(...args),
      findById: (...args) => GrowthTask.findById(...args),
      findOneAndUpdate: (...args) => GrowthTask.findOneAndUpdate(...args),
      deleteOne: jest.fn((...args) => GrowthTask.deleteOne(...args))
    };
    const { service, mediaReferenceClient } = createHarness({
      GrowthTaskModel,
      prepare: async (command) => {
        const duringPrepare = await loadInternalTask(command.resourceId);
        versionDuringPrepare = duringPrepare.__v;
        uncertaintyDuringPrepare = duringPrepare.mediaRemoteOutcomeUncertain;
        throw stable;
      }
    });

    await expectPendingError(service.resume(task._id), task._id);

    expect(mediaReferenceClient.prepare).toHaveBeenCalledTimes(1);
    expect(versionDuringPrepare).toBe(initialVersion + 1);
    expect(uncertaintyDuringPrepare).toBe(true);
    expect(GrowthTaskModel.deleteOne).not.toHaveBeenCalled();
    const stored = await loadInternalTask(task._id);
    expect(stored.mediaReferenceState).toBe('pending');
    expect(stored.mediaRemoteOutcomeUncertain).toBe(true);
    expect(stored.__v).toBe(initialVersion + 1);
  });

  test.each([
    ['empty prepare response', { prepare: [] }],
    ['prepare response with wrong mediaId', {
      prepare: [
        { mediaId: MEDIA_C, field: 'attachmentMediaIds', state: 'prepared' },
        { mediaId: MEDIA_B, field: 'attachmentMediaIds', state: 'prepared' }
      ]
    }],
    ['prepare response with wrong field', {
      prepare: [
        { mediaId: MEDIA_A.toLowerCase(), field: 'otherField', state: 'prepared' },
        { mediaId: MEDIA_B, field: 'attachmentMediaIds', state: 'prepared' }
      ]
    }],
    ['prepare response with wrong state', {
      prepare: [
        { mediaId: MEDIA_A.toLowerCase(), field: 'attachmentMediaIds', state: 'bound' },
        { mediaId: MEDIA_B, field: 'attachmentMediaIds', state: 'prepared' }
      ]
    }],
    ['empty commit response', { commit: [] }],
    ['commit response with wrong mediaId', {
      commit: [
        { mediaId: MEDIA_A.toLowerCase(), field: 'attachmentMediaIds', state: 'bound' },
        { mediaId: MEDIA_A.toLowerCase(), field: 'attachmentMediaIds', state: 'bound' }
      ]
    }],
    ['commit response with wrong field', {
      commit: [
        { mediaId: MEDIA_A.toLowerCase(), field: 'attachmentMediaIds', state: 'bound' },
        { mediaId: MEDIA_B, field: 'otherField', state: 'bound' }
      ]
    }],
    ['commit response with wrong state', {
      commit: [
        { mediaId: MEDIA_A.toLowerCase(), field: 'attachmentMediaIds', state: 'bound' },
        { mediaId: MEDIA_B, field: 'attachmentMediaIds', state: 'prepared' }
      ]
    }]
  ])('does not publish after malformed successful %s', async (_label, envelopes) => {
    const validPrepare = [
      { mediaId: MEDIA_A.toLowerCase(), field: 'attachmentMediaIds', state: 'prepared' },
      { mediaId: MEDIA_B, field: 'attachmentMediaIds', state: 'prepared' }
    ];
    const validCommit = [
      { mediaId: MEDIA_A.toLowerCase(), field: 'attachmentMediaIds', state: 'bound' },
      { mediaId: MEDIA_B, field: 'attachmentMediaIds', state: 'bound' }
    ];
    const { service } = createHarness({
      prepare: async () => envelopes.prepare || validPrepare,
      commit: async () => envelopes.commit || validCommit
    });

    await expect(service.create({
      taskInput: createTaskInput(),
      attachmentMediaIds: [MEDIA_A, MEDIA_B]
    })).rejects.toMatchObject({
      status: 503,
      code: 'MEDIA_REFERENCE_PENDING'
    });

    const stored = await loadInternalTask((await GrowthTask.findOne({ title: '阅读' }))._id);
    expect(stored.mediaReferenceState).toBe('pending');
    expect(stored.attachmentMediaIds).toEqual([]);
    expect(stored.mediaBindingOperationId).toBe(OPERATION_A);
  });
});

describe('TC-T6-MEDIA-017F GrowthTask attachment patch replacement', () => {
  test('binds only additions, publishes atomically, and checked-unbinds only removals', async () => {
    const task = await createBoundTask({ ids: [MEDIA_A, MEDIA_B] });
    const events = [];
    const { service, mediaReferenceClient, randomUUID } = createHarness({
      prepare: async (command) => {
        const duringPrepare = await loadInternalTask(task._id);
        expect(duringPrepare.mediaBindingPhase).toBe('binding');
        expect(duringPrepare.mediaMutationKind).toBe('patch');
        expect(duringPrepare.mediaRemoteOutcomeUncertain).toBe(true);
        expect(duringPrepare.attachmentMediaIds.map(String)).toEqual([MEDIA_A.toLowerCase(), MEDIA_B]);
        events.push('prepare');
        return boundEnvelope(command, 'prepared');
      },
      commit: async (command) => {
        const duringCommit = await loadInternalTask(task._id);
        expect(duringCommit.attachmentMediaIds.map(String)).toEqual([MEDIA_A.toLowerCase(), MEDIA_B]);
        expect(duringCommit.title).toBe('阅读');
        events.push('commit');
        return boundEnvelope(command, 'bound');
      },
      unbind: async (command) => {
        const duringUnbind = await loadInternalTask(task._id);
        expect(duringUnbind.mediaBindingPhase).toBe('unbinding');
        expect(duringUnbind.title).toBe('替换后');
        expect(duringUnbind.attachmentMediaIds.map(String)).toEqual([MEDIA_B, MEDIA_C]);
        expect(bindingValues(duringUnbind.attachmentMediaBindings)).toEqual([
          { mediaId: MEDIA_B, bindingOperationId: OPERATION_B },
          { mediaId: MEDIA_C, bindingOperationId: OPERATION_A }
        ]);
        events.push('unbind');
        return releasedEnvelope(command);
      }
    });

    const result = await service.mutate({
      task,
      taskPatch: [{ path: 'title', value: '替换后' }],
      attachmentMediaIds: [MEDIA_B, MEDIA_C]
    });

    expect(events).toEqual(['prepare', 'commit', 'unbind']);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(mediaReferenceClient.prepare).toHaveBeenCalledWith(expect.objectContaining({
      operationId: OPERATION_A,
      references: [{ mediaId: MEDIA_C, field: 'attachmentMediaIds' }]
    }));
    expect(mediaReferenceClient.commit).toHaveBeenCalledWith(mediaReferenceClient.prepare.mock.calls[0][0]);
    expect(mediaReferenceClient.unbind).toHaveBeenCalledWith(expect.objectContaining({
      operationId: OPERATION_A,
      references: [{
        mediaId: MEDIA_A.toLowerCase(),
        field: 'attachmentMediaIds',
        bindingOperationId: OPERATION_B
      }]
    }));
    expect(result.mediaReferenceState).toBe('bound');
    expect(result.title).toBe('替换后');
    expect(result.attachmentMediaIds.map(String)).toEqual([MEDIA_B, MEDIA_C]);
    expect(bindingValues(result.attachmentMediaBindings)).toEqual([
      { mediaId: MEDIA_B, bindingOperationId: OPERATION_B },
      { mediaId: MEDIA_C, bindingOperationId: OPERATION_A }
    ]);

    const replay = await service.resume(result._id);
    expect(replay.mediaReferenceState).toBe('bound');
    expect(replay.attachmentMediaIds.map(String)).toEqual([MEDIA_B, MEDIA_C]);
  });

  test('keeps old public state when replacement publication fails before persistence and resumes', async () => {
    const task = await createBoundTask({ ids: [MEDIA_A, MEDIA_B] });
    let failPublish = true;
    const GrowthTaskModel = {
      create: (...args) => GrowthTask.create(...args),
      findById: (...args) => GrowthTask.findById(...args),
      deleteOne: (...args) => GrowthTask.deleteOne(...args),
      findOneAndUpdate: (filter, update, options) => {
        const publishing = update.$set
          && update.$set.attachmentMediaIds
          && update.$set.mediaReferenceState === 'pending'
          && filter.mediaBindingPhase === 'binding';
        if (publishing && failPublish) {
          failPublish = false;
          return Promise.reject(new Error('publish db raw secret'));
        }
        return GrowthTask.findOneAndUpdate(filter, update, options);
      }
    };
    const { service } = createHarness({
      GrowthTaskModel,
      prepare: async (command) => boundEnvelope(command, 'prepared'),
      commit: async (command) => boundEnvelope(command, 'bound')
    });

    await expect(service.mutate({
      task,
      taskPatch: [{ path: 'title', value: '替换后' }],
      attachmentMediaIds: [MEDIA_B, MEDIA_C]
    })).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });

    const pending = await loadInternalTask(task._id);
    expect(pending.title).toBe('阅读');
    expect(pending.attachmentMediaIds.map(String)).toEqual([MEDIA_A.toLowerCase(), MEDIA_B]);

    const recovered = await service.resume(task._id);
    expect(recovered.title).toBe('替换后');
    expect(recovered.attachmentMediaIds.map(String)).toEqual([MEDIA_B, MEDIA_C]);
  });

  test('replays checked replacement unbind after transient unbind failure', async () => {
    const task = await createBoundTask({ ids: [MEDIA_A, MEDIA_B] });
    let failUnbind = true;
    const { service, mediaReferenceClient } = createHarness({
      prepare: async (command) => boundEnvelope(command, 'prepared'),
      commit: async (command) => boundEnvelope(command, 'bound'),
      unbind: async (command) => {
        if (failUnbind) {
          failUnbind = false;
          throw pendingClientError();
        }
        return releasedEnvelope(command);
      }
    });

    await expect(service.mutate({
      task,
      taskPatch: [{ path: 'title', value: '替换后' }],
      attachmentMediaIds: [MEDIA_B, MEDIA_C]
    })).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });

    const pending = await loadInternalTask(task._id);
    expect(pending.mediaBindingPhase).toBe('unbinding');
    expect(pending.title).toBe('替换后');
    expect(pending.attachmentMediaIds.map(String)).toEqual([MEDIA_B, MEDIA_C]);

    const recovered = await service.resume(task._id);
    expect(recovered.mediaReferenceState).toBe('bound');
    expect(recovered.attachmentMediaIds.map(String)).toEqual([MEDIA_B, MEDIA_C]);
    expect(mediaReferenceClient.unbind).toHaveBeenCalledTimes(2);
  });

  test('replays replacement finalization after final owner response is lost', async () => {
    const task = await createBoundTask({ ids: [MEDIA_A, MEDIA_B] });
    let failFinalize = true;
    const GrowthTaskModel = {
      create: (...args) => GrowthTask.create(...args),
      findById: (...args) => GrowthTask.findById(...args),
      deleteOne: (...args) => GrowthTask.deleteOne(...args),
      findOneAndUpdate: (filter, update, options) => {
        const finalizing = update.$set
          && update.$set.mediaReferenceState === 'bound'
          && filter.mediaBindingPhase === 'unbinding';
        if (finalizing && failFinalize) {
          failFinalize = false;
          return GrowthTask.findOneAndUpdate(filter, update, options)
            .then(() => { throw new Error('lost final response with private data'); });
        }
        return GrowthTask.findOneAndUpdate(filter, update, options);
      }
    };
    const { service } = createHarness({
      GrowthTaskModel,
      prepare: async (command) => boundEnvelope(command, 'prepared'),
      commit: async (command) => boundEnvelope(command, 'bound'),
      unbind: async (command) => releasedEnvelope(command)
    });

    const result = await service.mutate({
      task,
      taskPatch: [{ path: 'title', value: '替换后' }],
      attachmentMediaIds: [MEDIA_B, MEDIA_C]
    });

    expect(result.mediaReferenceState).toBe('bound');
    expect(result.title).toBe('替换后');
    expect(result.attachmentMediaIds.map(String)).toEqual([MEDIA_B, MEDIA_C]);
  });
});

describe('TC-T6-MEDIA-017G GrowthTask attachment removal', () => {
  test('publishes an empty list before checked batch unbind, resumes finalization, and avoids empty commands', async () => {
    const task = await createBoundTask({ ids: [MEDIA_A, MEDIA_B] });
    let failFinalize = true;
    const GrowthTaskModel = {
      create: (...args) => GrowthTask.create(...args),
      findById: (...args) => GrowthTask.findById(...args),
      deleteOne: (...args) => GrowthTask.deleteOne(...args),
      findOneAndUpdate: (filter, update, options) => {
        const finalizing = update.$set
          && update.$set.mediaReferenceState === 'none'
          && filter.mediaBindingPhase === 'unbinding';
        if (finalizing && failFinalize) {
          failFinalize = false;
          return Promise.reject(new Error('finalize unavailable'));
        }
        return GrowthTask.findOneAndUpdate(filter, update, options);
      }
    };
    const { service, mediaReferenceClient } = createHarness({
      GrowthTaskModel,
      unbind: async (command) => {
        const duringUnbind = await loadInternalTask(task._id);
        expect(duringUnbind.mediaBindingPhase).toBe('unbinding');
        expect(duringUnbind.attachmentMediaIds).toEqual([]);
        expect(duringUnbind.description).toBe('cleared');
        return releasedEnvelope(command);
      }
    });

    await expect(service.mutate({
      task,
      taskPatch: [{ path: 'description', value: 'cleared' }],
      attachmentMediaIds: []
    })).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });

    expect(mediaReferenceClient.prepare).not.toHaveBeenCalled();
    expect(mediaReferenceClient.commit).not.toHaveBeenCalled();
    expect(mediaReferenceClient.unbind).toHaveBeenCalledWith(expect.objectContaining({
      references: [
        { mediaId: MEDIA_A.toLowerCase(), field: 'attachmentMediaIds', bindingOperationId: OPERATION_B },
        { mediaId: MEDIA_B, field: 'attachmentMediaIds', bindingOperationId: OPERATION_B }
      ]
    }));

    const recovered = await service.resume(task._id);
    expect(recovered.mediaReferenceState).toBe('none');
    expect(recovered.attachmentMediaIds).toEqual([]);

    mediaReferenceClient.unbind.mockClear();
    const alreadyEmpty = await service.mutate({
      task: recovered,
      taskPatch: [],
      attachmentMediaIds: []
    });
    expect(alreadyEmpty.mediaReferenceState).toBe('none');
    expect(mediaReferenceClient.unbind).not.toHaveBeenCalled();
  });
});

describe('TC-T6-MEDIA-017H GrowthTask attachment normalization and reorder', () => {
  test('applies omitted attachment patches through owner CAS without media calls', async () => {
    const task = await createBoundTask({ ids: [MEDIA_A], overrides: { description: 'old' } });
    const { service, mediaReferenceClient, randomUUID } = createHarness();

    const result = await service.mutate({
      task,
      taskPatch: [
        { path: 'title', value: '只改文字' },
        { path: 'description', value: 'new' }
      ]
    });

    expect(result.title).toBe('只改文字');
    expect(result.description).toBe('new');
    expect(result.attachmentMediaIds.map(String)).toEqual([MEDIA_A.toLowerCase()]);
    expect(mediaReferenceClient.prepare).not.toHaveBeenCalled();
    expect(mediaReferenceClient.commit).not.toHaveBeenCalled();
    expect(mediaReferenceClient.unbind).not.toHaveBeenCalled();
    expect(randomUUID).not.toHaveBeenCalled();
  });

  test('applies identical attachment order patches through owner CAS without media calls', async () => {
    const task = await createBoundTask({ ids: [MEDIA_A, MEDIA_B] });
    const { service, mediaReferenceClient, randomUUID } = createHarness();

    const result = await service.mutate({
      task,
      taskPatch: [{ path: 'priority', value: 'high' }],
      attachmentMediaIds: [MEDIA_A, MEDIA_B]
    });

    expect(result.priority).toBe('high');
    expect(result.attachmentMediaIds.map(String)).toEqual([MEDIA_A.toLowerCase(), MEDIA_B]);
    expect(mediaReferenceClient.prepare).not.toHaveBeenCalled();
    expect(mediaReferenceClient.commit).not.toHaveBeenCalled();
    expect(mediaReferenceClient.unbind).not.toHaveBeenCalled();
    expect(randomUUID).not.toHaveBeenCalled();
  });

  test('normalizes requested order, preserves generations, and sends no media calls for set-equal reorder or no-op', async () => {
    const task = await createBoundTask({
      ids: [MEDIA_A, MEDIA_B, MEDIA_C],
      bindings: [
        { mediaId: MEDIA_A, bindingOperationId: OPERATION_A },
        { mediaId: MEDIA_B, bindingOperationId: OPERATION_B },
        { mediaId: MEDIA_C, bindingOperationId: OPERATION_C }
      ]
    });
    const { service, mediaReferenceClient, randomUUID } = createHarness();

    const reordered = await service.mutate({
      task,
      taskPatch: [],
      attachmentMediaIds: [MEDIA_C, MEDIA_A, MEDIA_C, MEDIA_B]
    });

    expect(reordered.mediaReferenceState).toBe('bound');
    expect(reordered.attachmentMediaIds.map(String)).toEqual([MEDIA_C, MEDIA_A.toLowerCase(), MEDIA_B]);
    expect(bindingValues(reordered.attachmentMediaBindings)).toEqual([
      { mediaId: MEDIA_C, bindingOperationId: OPERATION_C },
      { mediaId: MEDIA_A.toLowerCase(), bindingOperationId: OPERATION_A },
      { mediaId: MEDIA_B, bindingOperationId: OPERATION_B }
    ]);
    expect(mediaReferenceClient.prepare).not.toHaveBeenCalled();
    expect(mediaReferenceClient.commit).not.toHaveBeenCalled();
    expect(mediaReferenceClient.unbind).not.toHaveBeenCalled();
    expect(randomUUID).not.toHaveBeenCalled();

    const identical = await service.mutate({
      task: reordered,
      taskPatch: [],
      attachmentMediaIds: [MEDIA_C, MEDIA_A, MEDIA_B]
    });
    expect(identical.attachmentMediaIds.map(String)).toEqual([MEDIA_C, MEDIA_A.toLowerCase(), MEDIA_B]);
    expect(mediaReferenceClient.prepare).not.toHaveBeenCalled();
    expect(mediaReferenceClient.commit).not.toHaveBeenCalled();
    expect(mediaReferenceClient.unbind).not.toHaveBeenCalled();
  });
});

describe('TC-T6-MEDIA-017I GrowthTask attachment atomic owner patch', () => {
  test('clears first stable prepare rejection without changing public attachments or canonical fields', async () => {
    const task = await createBoundTask({ ids: [MEDIA_A] });
    const stable = Object.assign(stableMediaError(404), {
      message: 'https://resource.internal/private-token operation 9bf7c3f3-cc6d-41fe-95b5-b2832aafd394'
    });
    const { service, mediaReferenceClient } = createHarness({
      prepare: async () => { throw stable; }
    });

    let caught;
    try {
      await service.mutate({
        task,
        taskPatch: [{ path: 'title', value: '不会发布' }],
        attachmentMediaIds: [MEDIA_A, MEDIA_B]
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ status: 404, code: 'RESOURCE_NOT_FOUND', details: [] });
    expect(caught.message).toBe('Media reference rejected');
    expect(JSON.stringify(caught)).not.toContain('private-token');
    expect(mediaReferenceClient.commit).not.toHaveBeenCalled();
    expect(mediaReferenceClient.unbind).not.toHaveBeenCalled();
    const stored = await loadInternalTask(task._id);
    expect(stored.mediaReferenceState).toBe('bound');
    expect(stored.title).toBe('阅读');
    expect(stored.attachmentMediaIds.map(String)).toEqual([MEDIA_A.toLowerCase()]);
    expect(stored.mediaBindingOperationId).toBeUndefined();
  });

  test('keeps old public state while binding is pending and publishes patch fields exactly once', async () => {
    const task = await createBoundTask({ ids: [MEDIA_A], overrides: { description: 'old' } });
    let failCommit = true;
    const { service, mediaReferenceClient } = createHarness({
      prepare: async (command) => boundEnvelope(command, 'prepared'),
      commit: async (command) => {
        if (failCommit) {
          failCommit = false;
          throw pendingClientError();
        }
        return boundEnvelope(command, 'bound');
      }
    });

    await expect(service.mutate({
      task,
      taskPatch: [
        { path: 'title', value: '发布后' },
        { path: 'description', value: 'new' }
      ],
      attachmentMediaIds: [MEDIA_A, MEDIA_B]
    })).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });

    const pending = await loadInternalTask(task._id);
    expect(pending.mediaBindingPhase).toBe('binding');
    expect(pending.title).toBe('阅读');
    expect(pending.description).toBe('old');
    expect(pending.attachmentMediaIds.map(String)).toEqual([MEDIA_A.toLowerCase()]);

    const result = await service.resume(task._id);
    expect(result.mediaReferenceState).toBe('bound');
    expect(result.title).toBe('发布后');
    expect(result.description).toBe('new');
    expect(result.attachmentMediaIds.map(String)).toEqual([MEDIA_A.toLowerCase(), MEDIA_B]);
    expect(mediaReferenceClient.prepare).toHaveBeenCalledTimes(2);
    expect(mediaReferenceClient.commit).toHaveBeenCalledTimes(2);
  });

  test('sanitizes owner errors from stable patch and patch claim paths', async () => {
    const stableTask = await createBoundTask({ ids: [MEDIA_A] });
    const claimTask = await createBoundTask({ ids: [MEDIA_A], title: 'claim' });
    const GrowthTaskModel = {
      create: (...args) => GrowthTask.create(...args),
      findById: (...args) => GrowthTask.findById(...args),
      deleteOne: (...args) => GrowthTask.deleteOne(...args),
      findOneAndUpdate: (filter, update, options) => {
        if (update.$set && update.$set.title === 'raw stable secret') {
          return Promise.reject(Object.assign(new Error('raw stable secret'), {
            config: { token: 'raw stable secret' }
          }));
        }
        if (update.$set && update.$set.mediaMutationKind === 'patch') {
          return Promise.reject(Object.assign(new Error('raw claim secret'), {
            response: { data: 'raw claim secret' }
          }));
        }
        return GrowthTask.findOneAndUpdate(filter, update, options);
      }
    };
    const { service } = createHarness({ GrowthTaskModel });

    const stableError = await service.mutate({
      task: stableTask,
      taskPatch: [{ path: 'title', value: 'raw stable secret' }]
    }).catch((error) => error);
    expect(stableError).toMatchObject({ status: 409, code: 'RESOURCE_CONFLICT', details: [] });
    expect(JSON.stringify(stableError)).not.toContain('raw stable secret');

    const claimError = await service.mutate({
      task: claimTask,
      taskPatch: [],
      attachmentMediaIds: [MEDIA_A, MEDIA_B]
    }).catch((error) => error);
    expect(claimError).toMatchObject({ status: 503, code: 'MEDIA_REFERENCE_PENDING' });
    expect(JSON.stringify(claimError)).not.toContain('raw claim secret');
  });
});

describe('TC-T6-MEDIA-017L GrowthTask attachment checked batch unbind safety', () => {
  test('sends at most 100 checked releases with exact generations and remains pending on unbind conflict', async () => {
    const ids = Array.from({ length: 100 }, (_, index) => (
      (index + 1).toString(16).padStart(24, '0')
    ));
    const bindings = ids.map((mediaId, index) => ({
      mediaId,
      bindingOperationId: index % 2 === 0 ? OPERATION_A : OPERATION_B
    }));
    const task = await createBoundTask({
      ids,
      bindings,
      title: '批量解绑'
    });
    const { service, mediaReferenceClient } = createHarness({
      operationId: OPERATION_C,
      unbind: async () => { throw stableMediaError(409); }
    });

    await expect(service.mutate({
      task,
      taskPatch: [],
      attachmentMediaIds: []
    })).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });

    const command = mediaReferenceClient.unbind.mock.calls[0][0];
    expect(command.references).toHaveLength(100);
    expect(command.references.length).toBeLessThanOrEqual(100);
    expect(command.references).toEqual(bindings.map((binding) => ({
      mediaId: binding.mediaId,
      field: 'attachmentMediaIds',
      bindingOperationId: binding.bindingOperationId
    })));
    const stored = await loadInternalTask(task._id);
    expect(stored.mediaReferenceState).toBe('pending');
    expect(stored.mediaBindingPhase).toBe('unbinding');
    expect(stored.attachmentMediaIds).toEqual([]);
  });
});

describe('TC-T6-MEDIA-017J GrowthTask attachment public view helper', () => {
  test('returns only public attachment IDs while create binding is pending', async () => {
    const { service } = createHarness();
    const task = await GrowthTask.create({
      ...createTaskInput(),
      attachmentMediaIds: [],
      attachmentMediaBindings: [],
      mediaReferenceState: 'pending',
      mediaBindingOperationId: OPERATION_A,
      attachmentMediaPendingIds: [MEDIA_A, MEDIA_B],
      attachmentMediaPreviousBindings: [],
      mediaBindingPhase: 'binding',
      mediaPendingTaskPatch: [],
      mediaMutationKind: 'create',
      mediaRemoteOutcomeUncertain: true
    });

    expect(service.publicAttachmentMediaIds(task)).toEqual([]);
  });

  test('returns desired public IDs while patch unbinding is pending without exposing previous bindings', async () => {
    const { service } = createHarness();
    const task = await GrowthTask.create({
      ...createTaskInput(),
      attachmentMediaIds: [MEDIA_B, MEDIA_C],
      attachmentMediaBindings: [
        { mediaId: MEDIA_B, bindingOperationId: OPERATION_B },
        { mediaId: MEDIA_C, bindingOperationId: OPERATION_A }
      ],
      mediaReferenceState: 'pending',
      mediaBindingOperationId: OPERATION_A,
      attachmentMediaPendingIds: [MEDIA_B, MEDIA_C],
      attachmentMediaPreviousBindings: [
        { mediaId: MEDIA_A, bindingOperationId: OPERATION_B },
        { mediaId: MEDIA_B, bindingOperationId: OPERATION_B }
      ],
      mediaBindingPhase: 'unbinding',
      mediaPendingTaskPatch: [],
      mediaMutationKind: 'patch',
      mediaRemoteOutcomeUncertain: true
    });

    expect(service.publicAttachmentMediaIds(task)).toEqual([MEDIA_B, MEDIA_C]);
  });
});

describe('TC-T6-MEDIA-017K GrowthTask attachment service concurrency', () => {
  test('identical CAS loser helps the winner and returns one converged operation', async () => {
    const task = await createBoundTask({ ids: [MEDIA_A] });
    let firstClaim = true;
    const GrowthTaskModel = {
      create: (...args) => GrowthTask.create(...args),
      findById: (...args) => GrowthTask.findById(...args),
      deleteOne: (...args) => GrowthTask.deleteOne(...args),
      findOneAndUpdate: async (filter, update, options) => {
        const isClaim = update.$set && update.$set.mediaMutationKind === 'patch';
        if (isClaim && firstClaim) {
          firstClaim = false;
          await GrowthTask.findOneAndUpdate(filter, update, options);
          return null;
        }
        return GrowthTask.findOneAndUpdate(filter, update, options);
      }
    };
    const { service, mediaReferenceClient, randomUUID } = createHarness({
      GrowthTaskModel,
      prepare: async (command) => boundEnvelope(command, 'prepared'),
      commit: async (command) => boundEnvelope(command, 'bound')
    });

    const result = await service.mutate({
      task,
      taskPatch: [],
      attachmentMediaIds: [MEDIA_A, MEDIA_B]
    });

    expect(result.mediaReferenceState).toBe('bound');
    expect(result.attachmentMediaIds.map(String)).toEqual([MEDIA_A.toLowerCase(), MEDIA_B]);
    expect(bindingValues(result.attachmentMediaBindings)).toEqual([
      { mediaId: MEDIA_A.toLowerCase(), bindingOperationId: OPERATION_B },
      { mediaId: MEDIA_B, bindingOperationId: OPERATION_A }
    ]);
    expect(mediaReferenceClient.prepare).toHaveBeenCalledTimes(1);
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  test('different CAS loser helps pending winner then returns resource conflict', async () => {
    const task = await createBoundTask({ ids: [MEDIA_A] });
    await GrowthTask.findOneAndUpdate(
      { _id: task._id },
      {
        $set: {
          mediaReferenceState: 'pending',
          mediaBindingOperationId: OPERATION_A,
          attachmentMediaPendingIds: [MEDIA_A, MEDIA_B],
          attachmentMediaPreviousBindings: [{ mediaId: MEDIA_A, bindingOperationId: OPERATION_B }],
          mediaBindingPhase: 'binding',
          mediaPendingTaskPatch: [],
          mediaMutationKind: 'patch',
          mediaRemoteOutcomeUncertain: false
        },
        $inc: { __v: 1 }
      },
      { runValidators: true }
    );
    const fresh = await loadInternalTask(task._id);
    const { service, mediaReferenceClient, randomUUID } = createHarness({
      operationId: OPERATION_C,
      prepare: async (command) => boundEnvelope(command, 'prepared'),
      commit: async (command) => boundEnvelope(command, 'bound')
    });

    await expect(service.mutate({
      task: fresh,
      taskPatch: [],
      attachmentMediaIds: [MEDIA_A, MEDIA_C]
    })).rejects.toMatchObject({
      status: 409,
      code: 'RESOURCE_CONFLICT'
    });

    const stored = await loadInternalTask(task._id);
    expect(stored.mediaReferenceState).toBe('bound');
    expect(stored.attachmentMediaIds.map(String)).toEqual([MEDIA_A.toLowerCase(), MEDIA_B]);
    expect(mediaReferenceClient.prepare).toHaveBeenCalledTimes(1);
    expect(randomUUID).not.toHaveBeenCalled();
  });

  test('non-attachment patch resumes pending media first and applies against refreshed version', async () => {
    const task = await createBoundTask({ ids: [MEDIA_A], overrides: { description: 'old' } });
    await GrowthTask.findOneAndUpdate(
      { _id: task._id },
      {
        $set: {
          mediaReferenceState: 'pending',
          mediaBindingOperationId: OPERATION_A,
          attachmentMediaPendingIds: [MEDIA_A, MEDIA_B],
          attachmentMediaPreviousBindings: [{ mediaId: MEDIA_A, bindingOperationId: OPERATION_B }],
          mediaBindingPhase: 'binding',
          mediaPendingTaskPatch: [],
          mediaMutationKind: 'patch',
          mediaRemoteOutcomeUncertain: false
        },
        $inc: { __v: 1 }
      },
      { runValidators: true }
    );
    const stale = await loadInternalTask(task._id);
    const { service, mediaReferenceClient, randomUUID } = createHarness({
      prepare: async (command) => boundEnvelope(command, 'prepared'),
      commit: async (command) => boundEnvelope(command, 'bound')
    });

    const result = await service.mutate({
      task: stale,
      taskPatch: [{ path: 'description', value: 'after resume' }]
    });

    expect(result.description).toBe('after resume');
    expect(result.attachmentMediaIds.map(String)).toEqual([MEDIA_A.toLowerCase(), MEDIA_B]);
    expect(mediaReferenceClient.prepare).toHaveBeenCalledTimes(1);
    expect(randomUUID).not.toHaveBeenCalled();
  });
});

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
const FAMILY_A = '111111111111111111111111';
const CHILD_A = '222222222222222222222222';
const PARENT_A = '333333333333333333333333';
const OPERATION_A = '9bf7c3f3-cc6d-41fe-95b5-b2832aafd394';
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
    ]))
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
        return [];
      },
      commit: async () => {
        const duringCommit = await loadInternalTask(taskId);
        expect(duringCommit.attachmentMediaIds).toEqual([]);
        events.push('commit');
        return [];
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
});

describe('TC-T6-MEDIA-017D GrowthTask attachment rollback boundary', () => {
  test('deletes the first-attempt pending owner and returns the stable prepare rejection', async () => {
    const stable = stableMediaError(404);
    const { service, mediaReferenceClient } = createHarness({
      prepare: async () => { throw stable; }
    });

    await expect(service.create({
      taskInput: createTaskInput(),
      attachmentMediaIds: [MEDIA_A, MEDIA_B]
    })).rejects.toBe(stable);

    const taskId = mediaReferenceClient.prepare.mock.calls[0][0].resourceId;
    expectRequiredCommand(mediaReferenceClient, taskId);
    expect(await GrowthTask.findById(taskId)).toBeNull();
    expect(mediaReferenceClient.commit).not.toHaveBeenCalled();
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
    const behavior = async () => {
      if (!failed) {
        failed = true;
        throw pendingClientError();
      }
      return [];
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
});

const {
  parseGrowthTaskCreate,
  parseGrowthTaskPatch,
  entriesToMongoSet,
  normalizeAttachmentMediaIds
} = require('../../services/growthTaskPatch');

const MEDIA_A = 'AAAAAAAAAAAAAAAAAAAAAAAA';
const MEDIA_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';

const requiredCreateFields = (overrides = {}) => ({
  childId: '111111111111111111111111',
  dimension: 'academic',
  title: '阅读',
  taskType: 'practice',
  dueDate: '2026-06-23',
  ...overrides
});

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

const mongoose = require('mongoose');

const User = require('../../../../common/models/User');
const {
  applyEntries,
  buildChildProfilePatch,
  entriesToMongoSet
} = require('../../services/childProfilePatch');
const { createChildAvatarMediaService } = require('../../services/childAvatarMediaService');

const OPERATION_A = '8a9dc72a-558b-4818-b388-677862431377';
const MEDIA_A = '0123456789abcdef01234567';
const MEDIA_B = 'ABCDEF0123456789ABCDEF01';
const HIDDEN_AVATAR_STATE = [
  '+childProfile.avatarMediaBindingOperationId',
  '+childProfile.mediaBindingOperationId',
  '+childProfile.avatarMediaPendingId',
  '+childProfile.avatarMediaPreviousId',
  '+childProfile.avatarMediaPreviousBindingOperationId',
  '+childProfile.mediaBindingPhase',
  '+childProfile.mediaPendingProfilePatch'
].join(' ');

let childSequence = 0;

const createChild = async () => {
  childSequence += 1;
  return User.create({
    username: `bindingchild${childSequence}`,
    password: 'child123',
    email: `bindingchild${childSequence}@example.com`,
    name: '原名字',
    role: 'student',
    familyId: new mongoose.Types.ObjectId(),
    childProfile: { nickname: '原名字', school: '原学校', grade: 3 }
  });
};

const loadInternal = (childId) => User.findById(childId).select(HIDDEN_AVATAR_STATE);

const pendingError = () => Object.assign(new Error('Media reference operation is pending'), {
  status: 503,
  code: 'MEDIA_REFERENCE_PENDING',
  details: []
});

const createHarness = ({ UserModel = User, prepare, commit } = {}) => {
  const mediaReferenceClient = {
    prepare: jest.fn(prepare || (async () => [{ mediaId: MEDIA_A, field: 'avatarMediaId', state: 'prepared' }])),
    commit: jest.fn(commit || (async () => [{ mediaId: MEDIA_A, field: 'avatarMediaId', state: 'bound' }])),
    unbind: jest.fn()
  };
  const randomUUID = jest.fn(() => OPERATION_A);
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const service = createChildAvatarMediaService({
    UserModel,
    mediaReferenceClient,
    randomUUID,
    logger
  });
  return { service, mediaReferenceClient, randomUUID, logger };
};

const mutation = (child, profilePatch = []) => ({
  child,
  familyId: child.familyId.toString(),
  requestedAvatarMediaId: MEDIA_A,
  profilePatch
});

const expectValidationError = (action) => {
  let caught;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toEqual(expect.objectContaining({
    status: 400,
    code: 'VALIDATION_ERROR',
    message: expect.any(String)
  }));
  expect(caught.details).toEqual([]);
  expect(Object.keys(caught).sort()).toEqual(['code', 'details', 'status']);
};

describe('TC-T6-MEDIA-016J canonical Child profile patch', () => {
  test('builds fixed paths and mirrors name and grade in canonical order', () => {
    expect(buildChildProfilePatch({
      moralGoals: ['守时'],
      avatarMediaId: MEDIA_B,
      interests: [],
      grade: 4,
      name: '  小明  ',
      school: null
    })).toEqual({
      requestedAvatarMediaId: MEDIA_B.toLowerCase(),
      hasAvatarMutation: true,
      entries: [
        { path: 'name', value: '小明' },
        { path: 'childProfile.nickname', value: '小明' },
        { path: 'grade', value: 4 },
        { path: 'childProfile.grade', value: 4 },
        { path: 'childProfile.school', value: null },
        { path: 'childProfile.interests', value: [] },
        { path: 'childProfile.moralGoals', value: ['守时'] }
      ]
    });
  });

  test('distinguishes absent avatar input from explicit removal', () => {
    expect(buildChildProfilePatch({ school: '' })).toEqual({
      requestedAvatarMediaId: undefined,
      hasAvatarMutation: false,
      entries: [{ path: 'childProfile.school', value: '' }]
    });
    expect(buildChildProfilePatch({ avatarMediaId: null })).toEqual({
      requestedAvatarMediaId: null,
      hasAvatarMutation: true,
      entries: []
    });
  });

  test('converts canonical entries to a Mongo set without deriving paths', () => {
    const entries = [
      { path: 'name', value: '小红' },
      { path: 'childProfile.grade', value: 5 },
      { path: 'childProfile.interests', value: [] }
    ];

    expect(entriesToMongoSet(entries)).toEqual({
      name: '小红',
      'childProfile.grade': 5,
      'childProfile.interests': []
    });
  });

  test('applies canonical entries to a real User document', () => {
    const child = new User({
      username: 'patchchild',
      password: 'child123',
      email: 'patchchild@example.com',
      name: '旧名字',
      role: 'student',
      familyId: new mongoose.Types.ObjectId(),
      childProfile: { nickname: '旧名字', grade: 3 }
    });
    const entries = [
      { path: 'name', value: '新名字' },
      { path: 'childProfile.nickname', value: '新名字' },
      { path: 'grade', value: 4 },
      { path: 'childProfile.grade', value: 4 }
    ];

    expect(applyEntries(child, entries)).toBe(child);
    expect(child.name).toBe('新名字');
    expect(child.childProfile.nickname).toBe('新名字');
    expect(child.grade).toBe(4);
    expect(child.childProfile.grade).toBe(4);
  });
});

describe('TC-T6-MEDIA-018A unsafe Child profile input', () => {
  test.each([
    null,
    [],
    'name=child'
  ])('rejects a non-object body: %p', (body) => {
    expectValidationError(() => buildChildProfilePatch(body));
  });

  test.each([
    'avatar',
    'childProfile',
    '$set',
    'childProfile.school',
    'familyId',
    'role',
    'mediaReferenceState',
    'mediaBindingOperationId',
    'avatarMediaBindingOperationId',
    'avatarMediaPendingId',
    'avatarMediaPreviousId',
    'avatarMediaPreviousBindingOperationId',
    'mediaBindingPhase',
    'mediaPendingProfilePatch'
  ])('rejects unknown or server-controlled field %s', (field) => {
    expectValidationError(() => buildChildProfilePatch({ [field]: 'unsafe' }));
  });

  test.each([
    'https://example.com/avatar.png',
    'abc',
    [],
    {},
    [MEDIA_B],
    undefined
  ])('rejects malformed avatarMediaId %p', (avatarMediaId) => {
    expectValidationError(() => buildChildProfilePatch({ avatarMediaId }));
  });

  test.each([
    '',
    '   ',
    123,
    null
  ])('rejects invalid name %p', (name) => {
    expectValidationError(() => buildChildProfilePatch({ name }));
  });

  test('rejects non-canonical entries before producing Mongo paths', () => {
    expectValidationError(() => entriesToMongoSet([
      { path: 'childProfile.$where', value: 'unsafe' }
    ]));
  });
});

describe('TC-T6-MEDIA-016E initial Child avatar binding', () => {
  test('claims before prepare and exposes the avatar only after commit', async () => {
    const child = await createChild();
    const { service, mediaReferenceClient, randomUUID } = createHarness({
      prepare: async (command) => {
        const duringPrepare = await loadInternal(child._id);
        expect(duringPrepare.childProfile.mediaReferenceState).toBe('pending');
        expect(duringPrepare.childProfile.avatarMediaId).toBeNull();
        expect(duringPrepare.childProfile.avatarMediaPendingId.toString()).toBe(MEDIA_A);
        expect(service.publicAvatarMediaId(duringPrepare)).toBeNull();
        return [{ mediaId: MEDIA_A, field: 'avatarMediaId', state: 'prepared' }];
      }
    });

    const result = await service.mutate(mutation(child, [
      { path: 'name', value: '新名字' },
      { path: 'childProfile.nickname', value: '新名字' }
    ]));

    const command = {
      familyId: child.familyId.toString(),
      childId: child._id.toString(),
      resourceType: 'child',
      resourceId: child._id.toString(),
      operationId: OPERATION_A,
      references: [{ mediaId: MEDIA_A, field: 'avatarMediaId' }]
    };
    expect(mediaReferenceClient.prepare).toHaveBeenCalledWith(command);
    expect(mediaReferenceClient.commit).toHaveBeenCalledWith(command);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(service.publicAvatarMediaId(result)).toBe(MEDIA_A);

    const stored = await loadInternal(child._id);
    expect(stored.name).toBe('新名字');
    expect(stored.childProfile.nickname).toBe('新名字');
    expect(stored.childProfile.mediaReferenceState).toBe('bound');
    expect(stored.childProfile.avatarMediaId.toString()).toBe(MEDIA_A);
    expect(stored.childProfile.avatarMediaBindingOperationId).toBe(OPERATION_A);
    expect(stored.childProfile.mediaBindingOperationId).toBeNull();
    expect(stored.childProfile.mediaBindingPhase).toBeNull();
  });

  test('same bound avatar is a media no-op while ordinary fields still update', async () => {
    const child = await createChild();
    const { service, mediaReferenceClient, randomUUID } = createHarness();
    await service.mutate(mutation(child));
    mediaReferenceClient.prepare.mockClear();
    mediaReferenceClient.commit.mockClear();

    const result = await service.mutate(mutation(child, [
      { path: 'childProfile.school', value: '新学校' }
    ]));

    expect(result.childProfile.school).toBe('新学校');
    expect(mediaReferenceClient.prepare).not.toHaveBeenCalled();
    expect(mediaReferenceClient.commit).not.toHaveBeenCalled();
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });
});

describe('TC-T6-MEDIA-016F stable prepare rejection', () => {
  test('clears untouched intent and preserves the prior profile', async () => {
    const child = await createChild();
    const stable = Object.assign(new Error('Media not found'), {
      status: 404,
      code: 'RESOURCE_NOT_FOUND',
      details: []
    });
    const { service, mediaReferenceClient } = createHarness({
      prepare: async () => { throw stable; }
    });

    await expect(service.mutate(mutation(child, [
      { path: 'name', value: '不应保存' },
      { path: 'childProfile.nickname', value: '不应保存' }
    ]))).rejects.toBe(stable);

    const stored = await loadInternal(child._id);
    expect(stored.name).toBe('原名字');
    expect(stored.childProfile.mediaReferenceState).toBe('none');
    expect(stored.childProfile.avatarMediaId).toBeNull();
    expect(stored.childProfile.mediaBindingOperationId).toBeNull();
    expect(mediaReferenceClient.commit).not.toHaveBeenCalled();
  });
});

describe('TC-T6-MEDIA-016G initial binding recovery', () => {
  test.each(['prepare', 'commit'])('reuses the durable operation after a lost %s response', async (failedMethod) => {
    const child = await createChild();
    let failed = false;
    const behavior = async () => {
      if (!failed) {
        failed = true;
        throw pendingError();
      }
      return [{ mediaId: MEDIA_A, field: 'avatarMediaId', state: 'bound' }];
    };
    const { service, mediaReferenceClient, randomUUID } = createHarness({
      ...(failedMethod === 'prepare' ? { prepare: behavior } : { commit: behavior })
    });

    await expect(service.mutate(mutation(child, [
      { path: 'childProfile.school', value: '恢复后学校' }
    ]))).rejects.toMatchObject({
      status: 503,
      code: 'MEDIA_REFERENCE_PENDING',
      details: { resourceId: child._id.toString() }
    });

    const pending = await loadInternal(child._id);
    expect(pending.childProfile.mediaBindingOperationId).toBe(OPERATION_A);
    expect(pending.childProfile.avatarMediaId).toBeNull();

    const recovered = await service.resume(child._id);
    expect(service.publicAvatarMediaId(recovered)).toBe(MEDIA_A);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(mediaReferenceClient.prepare).toHaveBeenCalledTimes(2);
    expect(mediaReferenceClient.commit).toHaveBeenCalledTimes(failedMethod === 'prepare' ? 1 : 2);
    expect((await User.findById(child._id)).childProfile.school).toBe('恢复后学校');
  });

  test.each([
    ['before persistence', false],
    ['after persistence', true]
  ])('recovers when the owner switch response is lost %s', async (label, persistFirst) => {
    const child = await createChild();
    let loseSwitchResponse = true;
    const UserModel = {
      findById: (...args) => User.findById(...args),
      findOneAndUpdate: (filter, update, options) => {
        const isSwitch = update.$set
          && update.$set['childProfile.mediaReferenceState'] === 'bound';
        if (!isSwitch || !loseSwitchResponse) return User.findOneAndUpdate(filter, update, options);
        loseSwitchResponse = false;
        if (!persistFirst) return Promise.reject(new Error('owner switch unavailable'));
        return User.findOneAndUpdate(filter, update, options)
          .then(() => { throw new Error('owner switch response lost'); });
      }
    };
    const { service, randomUUID } = createHarness({ UserModel });

    if (persistFirst) {
      const result = await service.mutate(mutation(child));
      expect(service.publicAvatarMediaId(result)).toBe(MEDIA_A);
    } else {
      await expect(service.mutate(mutation(child))).rejects.toMatchObject({
        status: 503,
        code: 'MEDIA_REFERENCE_PENDING',
        details: { resourceId: child._id.toString() }
      });
      const result = await service.resume(child._id);
      expect(service.publicAvatarMediaId(result)).toBe(MEDIA_A);
    }

    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect((await loadInternal(child._id)).childProfile.mediaReferenceState).toBe('bound');
  });
});

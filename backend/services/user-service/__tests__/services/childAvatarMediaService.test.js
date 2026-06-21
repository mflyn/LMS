const mongoose = require('mongoose');

const User = require('../../../../common/models/User');
const {
  applyEntries,
  buildChildProfilePatch,
  entriesToMongoSet
} = require('../../services/childProfilePatch');

const MEDIA_B = 'ABCDEF0123456789ABCDEF01';

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

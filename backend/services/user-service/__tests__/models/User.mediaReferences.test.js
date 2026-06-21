const mongoose = require('mongoose');

const User = require('../../../../common/models/User');

const OPERATION_A = '8a9dc72a-558b-4818-b388-677862431377';
const OPERATION_B = '56c18cc8-9977-4bb7-b70a-2a358dff5e4e';
const MEDIA_A = new mongoose.Types.ObjectId();
const MEDIA_B = new mongoose.Types.ObjectId();

const hiddenAvatarState = [
  '+childProfile.avatarMediaBindingOperationId',
  '+childProfile.mediaBindingOperationId',
  '+childProfile.avatarMediaPendingId',
  '+childProfile.avatarMediaPreviousId',
  '+childProfile.avatarMediaPreviousBindingOperationId',
  '+childProfile.mediaBindingPhase',
  '+childProfile.mediaPendingProfilePatch'
].join(' ');

let sequence = 0;

const childData = (childProfile = {}) => {
  sequence += 1;
  return {
    username: `mediachild${sequence}`,
    password: 'child123',
    email: `mediachild${sequence}@example.com`,
    name: '测试孩子',
    role: 'student',
    familyId: new mongoose.Types.ObjectId(),
    childProfile
  };
};

describe('TC-T6-MEDIA-016D Child avatar media model', () => {
  test('legacy children default to none without media metadata', async () => {
    const child = await User.create(childData({ nickname: '小明' }));
    const stored = await User.findById(child._id).lean();

    expect(stored.childProfile.mediaReferenceState).toBe('none');
    expect(stored.childProfile.avatarMediaId).toBeNull();
    expect(stored.childProfile.avatarMediaBindingOperationId).toBeUndefined();
    expect(stored.childProfile.mediaBindingOperationId).toBeUndefined();
    expect(stored.childProfile.mediaBindingPhase).toBeUndefined();
  });

  test('bound state persists a public media ID while hiding its generation', async () => {
    const child = await User.create(childData({
      avatarMediaId: MEDIA_A,
      avatarMediaBindingOperationId: OPERATION_A,
      mediaReferenceState: 'bound'
    }));

    const normal = await User.findById(child._id).lean();
    expect(normal.childProfile.avatarMediaId.toString()).toBe(MEDIA_A.toString());
    expect(normal.childProfile.avatarMediaBindingOperationId).toBeUndefined();

    const internal = await User.findById(child._id).select(hiddenAvatarState).lean();
    expect(internal.childProfile.avatarMediaBindingOperationId).toBe(OPERATION_A);
  });

  test.each([
    {
      label: 'initial binding',
      profile: {
        mediaReferenceState: 'pending',
        mediaBindingOperationId: OPERATION_A,
        avatarMediaPendingId: MEDIA_A,
        mediaBindingPhase: 'binding',
        mediaPendingProfilePatch: [{ path: 'childProfile.school', value: null }]
      }
    },
    {
      label: 'replacement unbind',
      profile: {
        avatarMediaId: MEDIA_B,
        avatarMediaBindingOperationId: OPERATION_B,
        mediaReferenceState: 'pending',
        mediaBindingOperationId: OPERATION_B,
        avatarMediaPendingId: MEDIA_B,
        avatarMediaPreviousId: MEDIA_A,
        avatarMediaPreviousBindingOperationId: OPERATION_A,
        mediaBindingPhase: 'unbinding',
        mediaPendingProfilePatch: []
      }
    },
    {
      label: 'removal unbind',
      profile: {
        avatarMediaId: null,
        avatarMediaBindingOperationId: null,
        mediaReferenceState: 'pending',
        mediaBindingOperationId: OPERATION_B,
        avatarMediaPendingId: null,
        avatarMediaPreviousId: MEDIA_A,
        avatarMediaPreviousBindingOperationId: OPERATION_A,
        mediaBindingPhase: 'unbinding',
        mediaPendingProfilePatch: []
      }
    }
  ])('validates a complete $label state', async ({ profile }) => {
    await expect(new User(childData(profile)).validate()).resolves.toBeUndefined();
  });

  test.each([
    ['malformed bind generation', {
      avatarMediaId: MEDIA_A,
      avatarMediaBindingOperationId: 'not-a-uuid',
      mediaReferenceState: 'bound'
    }],
    ['bound state without media', {
      avatarMediaBindingOperationId: OPERATION_A,
      mediaReferenceState: 'bound'
    }],
    ['none state with public media', {
      avatarMediaId: MEDIA_A,
      avatarMediaBindingOperationId: OPERATION_A,
      mediaReferenceState: 'none'
    }],
    ['pending state without operation', {
      mediaReferenceState: 'pending',
      avatarMediaPendingId: MEDIA_A,
      mediaBindingPhase: 'binding'
    }],
    ['pending state without target', {
      mediaReferenceState: 'pending',
      mediaBindingOperationId: OPERATION_A,
      mediaBindingPhase: 'binding'
    }],
    ['binding state with half a previous generation', {
      mediaReferenceState: 'pending',
      mediaBindingOperationId: OPERATION_A,
      avatarMediaPendingId: MEDIA_B,
      avatarMediaPreviousId: MEDIA_A,
      mediaBindingPhase: 'binding'
    }],
    ['unbinding state without a previous generation', {
      avatarMediaId: MEDIA_B,
      avatarMediaBindingOperationId: OPERATION_B,
      mediaReferenceState: 'pending',
      mediaBindingOperationId: OPERATION_B,
      avatarMediaPendingId: MEDIA_B,
      mediaBindingPhase: 'unbinding'
    }],
    ['bound state with pending metadata', {
      avatarMediaId: MEDIA_A,
      avatarMediaBindingOperationId: OPERATION_A,
      mediaReferenceState: 'bound',
      mediaBindingOperationId: OPERATION_B
    }],
    ['pending patch entry without value', {
      mediaReferenceState: 'pending',
      mediaBindingOperationId: OPERATION_A,
      avatarMediaPendingId: MEDIA_A,
      mediaBindingPhase: 'binding',
      mediaPendingProfilePatch: [{ path: 'childProfile.school' }]
    }]
  ])('rejects %s', async (label, profile) => {
    await expect(new User(childData(profile)).validate()).rejects.toThrow();
  });

  test('rejects non-canonical pending patch paths', async () => {
    const child = new User(childData({
      mediaReferenceState: 'pending',
      mediaBindingOperationId: OPERATION_A,
      avatarMediaPendingId: MEDIA_A,
      mediaBindingPhase: 'binding',
      mediaPendingProfilePatch: [{ path: 'childProfile.$where', value: 'unsafe' }]
    }));

    await expect(child.validate()).rejects.toThrow();
  });
});

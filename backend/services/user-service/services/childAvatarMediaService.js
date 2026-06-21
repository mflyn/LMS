const { entriesToMongoSet } = require('./childProfilePatch');

const HIDDEN_AVATAR_STATE = [
  '+childProfile.avatarMediaBindingOperationId',
  '+childProfile.mediaBindingOperationId',
  '+childProfile.avatarMediaPendingId',
  '+childProfile.avatarMediaPreviousId',
  '+childProfile.avatarMediaPreviousBindingOperationId',
  '+childProfile.mediaBindingPhase',
  '+childProfile.mediaPendingProfilePatch'
].join(' ');
const STABLE_PREPARE_STATUSES = new Set([400, 403, 404, 409]);

const pendingError = (childId) => Object.assign(
  new Error('Media reference operation is pending'),
  {
    status: 503,
    code: 'MEDIA_REFERENCE_PENDING',
    details: { resourceId: String(childId) }
  }
);

const conflictError = () => Object.assign(
  new Error('Child avatar changed concurrently'),
  { status: 409, code: 'RESOURCE_CONFLICT', details: [] }
);

const normalizeId = (value) => value == null ? null : String(value).toLowerCase();

const createChildAvatarMediaService = ({
  UserModel,
  mediaReferenceClient,
  randomUUID,
  logger
} = {}) => {
  if (!UserModel
    || typeof UserModel.findById !== 'function'
    || typeof UserModel.findOneAndUpdate !== 'function') {
    throw new Error('UserModel is required');
  }
  if (!mediaReferenceClient
    || ['prepare', 'commit', 'unbind'].some(
      (method) => typeof mediaReferenceClient[method] !== 'function'
    )) {
    throw new Error('mediaReferenceClient is required');
  }
  if (typeof randomUUID !== 'function') throw new Error('randomUUID is required');
  if (!logger || ['info', 'warn', 'error'].some((method) => typeof logger[method] !== 'function')) {
    throw new Error('logger is required');
  }

  const selectHidden = async (queryOrPromise) => {
    if (queryOrPromise && typeof queryOrPromise.select === 'function') {
      return queryOrPromise.select(HIDDEN_AVATAR_STATE);
    }
    return queryOrPromise;
  };

  const load = async (childOrId) => {
    const childId = childOrId && childOrId._id ? childOrId._id : childOrId;
    return selectHidden(UserModel.findById(childId));
  };

  const update = (filter, updateDocument) => selectHidden(UserModel.findOneAndUpdate(
    filter,
    updateDocument,
    { new: true, runValidators: true }
  ));

  const publicAvatarMediaId = (child) => {
    const mediaId = child && child.childProfile && child.childProfile.avatarMediaId;
    return mediaId ? String(mediaId) : null;
  };

  const commandFor = (child) => ({
    familyId: String(child.familyId),
    childId: String(child._id),
    resourceType: 'child',
    resourceId: String(child._id),
    operationId: child.childProfile.mediaBindingOperationId,
    references: [{
      mediaId: String(child.childProfile.avatarMediaPendingId),
      field: 'avatarMediaId'
    }]
  });

  const pendingPatchEntries = (child) => (
    (child.childProfile.mediaPendingProfilePatch || []).map((entry) => ({
      path: entry.path,
      value: entry.value
    }))
  );

  const clearIntent = async (child) => {
    const hasPublicAvatar = Boolean(child.childProfile.avatarMediaId);
    return update({
      _id: child._id,
      'childProfile.mediaReferenceState': 'pending',
      'childProfile.mediaBindingOperationId': child.childProfile.mediaBindingOperationId,
      'childProfile.mediaBindingPhase': 'binding'
    }, {
      $set: {
        'childProfile.mediaReferenceState': hasPublicAvatar ? 'bound' : 'none'
      },
      $unset: {
        'childProfile.mediaBindingOperationId': '',
        'childProfile.avatarMediaPendingId': '',
        'childProfile.avatarMediaPreviousId': '',
        'childProfile.avatarMediaPreviousBindingOperationId': '',
        'childProfile.mediaBindingPhase': '',
        'childProfile.mediaPendingProfilePatch': ''
      },
      $inc: { __v: 1 }
    });
  };

  const convergedInitialBinding = (child, operationId, targetId) => (
    child
    && child.childProfile.mediaReferenceState === 'bound'
    && normalizeId(child.childProfile.avatarMediaId) === normalizeId(targetId)
    && child.childProfile.avatarMediaBindingOperationId === operationId
  );

  const resumeBinding = async (child) => {
    const operationId = child.childProfile.mediaBindingOperationId;
    const targetId = normalizeId(child.childProfile.avatarMediaPendingId);
    const command = commandFor(child);

    try {
      await mediaReferenceClient.prepare(command);
    } catch (error) {
      if (STABLE_PREPARE_STATUSES.has(error && error.status)) {
        try {
          const cleared = await clearIntent(child);
          if (cleared) throw error;
        } catch (clearError) {
          if (clearError === error) throw error;
          throw pendingError(child._id);
        }
      }
      throw pendingError(child._id);
    }

    try {
      await mediaReferenceClient.commit(command);
    } catch (error) {
      throw pendingError(child._id);
    }

    const profileSet = entriesToMongoSet(pendingPatchEntries(child));
    const hasPrevious = Boolean(child.childProfile.avatarMediaPreviousId);
    const transition = {
      ...profileSet,
      'childProfile.avatarMediaId': targetId,
      'childProfile.avatarMediaBindingOperationId': operationId,
      'childProfile.mediaReferenceState': hasPrevious ? 'pending' : 'bound'
    };
    if (hasPrevious) transition['childProfile.mediaBindingPhase'] = 'unbinding';

    let switched;
    try {
      switched = await update({
        _id: child._id,
        'childProfile.mediaReferenceState': 'pending',
        'childProfile.mediaBindingOperationId': operationId,
        'childProfile.mediaBindingPhase': 'binding'
      }, {
        $set: transition,
        ...(!hasPrevious ? {
          $unset: {
            'childProfile.mediaBindingOperationId': '',
            'childProfile.avatarMediaPendingId': '',
            'childProfile.avatarMediaPreviousId': '',
            'childProfile.avatarMediaPreviousBindingOperationId': '',
            'childProfile.mediaBindingPhase': '',
            'childProfile.mediaPendingProfilePatch': ''
          }
        } : {}),
        $inc: { __v: 1 }
      });
    } catch (error) {
      const reloaded = await load(child._id).catch(() => null);
      if (convergedInitialBinding(reloaded, operationId, targetId)) return reloaded;
      throw pendingError(child._id);
    }

    if (switched && !hasPrevious) return switched;
    if (switched && hasPrevious) throw pendingError(child._id);
    const reloaded = await load(child._id).catch(() => null);
    if (convergedInitialBinding(reloaded, operationId, targetId)) return reloaded;
    throw pendingError(child._id);
  };

  const resume = async (childOrId) => {
    const child = await load(childOrId);
    if (!child) throw conflictError();
    if (child.childProfile.mediaReferenceState !== 'pending') return child;
    if (child.childProfile.mediaBindingPhase === 'binding') return resumeBinding(child);
    throw pendingError(child._id);
  };

  const applyNoOpPatch = async (child, profilePatch) => {
    if (!profilePatch.length) return child;
    const updated = await update({
      _id: child._id,
      familyId: child.familyId,
      role: 'student',
      __v: child.__v,
      'childProfile.mediaReferenceState': { $ne: 'pending' }
    }, {
      $set: entriesToMongoSet(profilePatch),
      $inc: { __v: 1 }
    });
    if (!updated) throw conflictError();
    return updated;
  };

  const claim = (child, familyId, requestedAvatarMediaId, profilePatch, operationId) => update({
    _id: child._id,
    familyId,
    role: 'student',
    __v: child.__v,
    'childProfile.mediaReferenceState': { $ne: 'pending' }
  }, {
    $set: {
      'childProfile.mediaReferenceState': 'pending',
      'childProfile.mediaBindingOperationId': operationId,
      'childProfile.avatarMediaPendingId': requestedAvatarMediaId,
      'childProfile.avatarMediaPreviousId': child.childProfile.avatarMediaId || null,
      'childProfile.avatarMediaPreviousBindingOperationId':
        child.childProfile.avatarMediaBindingOperationId || null,
      'childProfile.mediaBindingPhase': 'binding',
      'childProfile.mediaPendingProfilePatch': profilePatch
    },
    $inc: { __v: 1 }
  });

  const mutate = async ({
    child: childOrId,
    familyId,
    requestedAvatarMediaId,
    profilePatch = []
  }) => {
    let child = await load(childOrId);
    if (!child || normalizeId(child.familyId) !== normalizeId(familyId)) throw conflictError();
    if (child.childProfile.mediaReferenceState === 'pending') child = await resume(child);

    if (normalizeId(child.childProfile.avatarMediaId) === normalizeId(requestedAvatarMediaId)) {
      return applyNoOpPatch(child, profilePatch);
    }
    if (requestedAvatarMediaId === null) throw conflictError();

    const operationId = randomUUID();
    const claimed = await claim(
      child,
      familyId,
      normalizeId(requestedAvatarMediaId),
      profilePatch,
      operationId
    );
    if (claimed) return resumeBinding(claimed);

    const winner = await load(child._id);
    if (winner
      && winner.childProfile.mediaReferenceState === 'pending'
      && normalizeId(winner.childProfile.avatarMediaPendingId)
        === normalizeId(requestedAvatarMediaId)) {
      return resume(winner);
    }
    throw conflictError();
  };

  return { mutate, publicAvatarMediaId, resume };
};

module.exports = { createChildAvatarMediaService };

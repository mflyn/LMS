const mongoose = require('mongoose');

const HIDDEN_FAMILY_MISTAKE_MEDIA_STATE = [
  '+mediaReferenceState',
  '+mediaBindingOperationId',
  '+mediaPendingPatch',
  '+mediaReferenceBindings',
  '+mediaPreviousBindings',
  '+mediaMutationKind'
].join(' ');

const FIELD_PURPOSES = Object.freeze({
  questionMediaId: 'mistake_question',
  childAnswerMediaId: 'mistake_answer'
});

const pendingError = (mistakeId) => Object.assign(
  new Error('Media reference operation is pending'),
  { status: 503, code: 'MEDIA_REFERENCE_PENDING', details: { resourceId: String(mistakeId) } }
);

const stableMediaError = (error) => Object.assign(
  new Error(error.message || 'Media reference rejected'),
  {
    status: error.status,
    code: typeof error.code === 'string' ? error.code : 'MEDIA_REFERENCE_REJECTED',
    details: Array.isArray(error.details) ? error.details : []
  }
);

const isStableMediaError = (error) => error
  && [400, 403, 404, 409].includes(error.status)
  && typeof error.code === 'string';

const normalizeId = (value) => String(value).toLowerCase();

const createFamilyMistakeMediaService = ({
  FamilyMistakeModel,
  FamilyMistakeStateEventModel,
  mediaReferenceClient,
  randomUUID
} = {}) => {
  if (!FamilyMistakeModel
    || typeof FamilyMistakeModel.create !== 'function'
    || typeof FamilyMistakeModel.findById !== 'function'
    || typeof FamilyMistakeModel.findOneAndUpdate !== 'function'
    || typeof FamilyMistakeModel.deleteOne !== 'function') {
    throw new Error('FamilyMistakeModel is required');
  }
  if (!FamilyMistakeStateEventModel || typeof FamilyMistakeStateEventModel.create !== 'function') {
    throw new Error('FamilyMistakeStateEventModel is required');
  }
  if (!mediaReferenceClient
    || ['prepare', 'commit', 'unbind'].some((method) => typeof mediaReferenceClient[method] !== 'function')) {
    throw new Error('mediaReferenceClient is required');
  }
  if (typeof randomUUID !== 'function') throw new Error('randomUUID is required');

  const selectHidden = async (queryOrPromise) => {
    if (queryOrPromise && typeof queryOrPromise.select === 'function') {
      return queryOrPromise.select(HIDDEN_FAMILY_MISTAKE_MEDIA_STATE);
    }
    return queryOrPromise;
  };

  const load = (mistakeOrId) => {
    const mistakeId = mistakeOrId && mistakeOrId._id ? mistakeOrId._id : mistakeOrId;
    return selectHidden(FamilyMistakeModel.findById(mistakeId));
  };

  const update = (filter, updateDocument) => FamilyMistakeModel.findOneAndUpdate(
    filter,
    updateDocument,
    { new: true, runValidators: true }
  ).select(HIDDEN_FAMILY_MISTAKE_MEDIA_STATE);

  const commandFor = (mistake, references) => ({
    familyId: String(mistake.familyId),
    childId: String(mistake.childId),
    resourceType: 'family_mistake',
    resourceId: String(mistake._id),
    operationId: mistake.mediaBindingOperationId,
    references
  });

  const pendingReferencesFor = (mistake) => (mistake.mediaPendingPatch || [])
    .filter((entry) => entry.value)
    .map((entry) => ({
      mediaId: String(entry.value),
      field: entry.path
    }));

  const bindingDtos = (bindings = []) => bindings.map((binding) => ({
    field: binding.field,
    mediaId: String(binding.mediaId),
    bindingOperationId: binding.bindingOperationId
  }));

  const sameMediaId = (left, right) => normalizeId(left) === normalizeId(right);

  const publicMediaByField = (mistake) => {
    const byField = {};
    Object.keys(FIELD_PURPOSES).forEach((field) => {
      if (mistake[field]) byField[field] = String(mistake[field]);
    });
    return byField;
  };

  const desiredMediaByField = (mistake, mediaPatch = {}) => {
    const desired = publicMediaByField(mistake);
    Object.entries(mediaPatch).forEach(([field, value]) => {
      if (value === null || value === undefined || value === '') {
        delete desired[field];
      } else {
        desired[field] = String(value);
      }
    });
    return desired;
  };

  const additionReferences = (previousBindings, desiredByField) => (
    Object.entries(desiredByField)
      .filter(([field, mediaId]) => !previousBindings.some((binding) => (
        binding.field === field && sameMediaId(binding.mediaId, mediaId)
      )))
      .map(([field, mediaId]) => ({ field, mediaId }))
  );

  const removalReferences = (previousBindings, desiredByField) => previousBindings
    .filter((binding) => !desiredByField[binding.field]
      || !sameMediaId(desiredByField[binding.field], binding.mediaId))
    .map((binding) => ({
      field: binding.field,
      mediaId: binding.mediaId,
      bindingOperationId: binding.bindingOperationId
    }));

  const nextBindingsFor = (previousBindings, desiredByField, operationId) => Object.entries(desiredByField)
    .map(([field, mediaId]) => {
      const previous = previousBindings.find((binding) => (
        binding.field === field && sameMediaId(binding.mediaId, mediaId)
      ));
      return previous || { field, mediaId, bindingOperationId: operationId };
    });

  const finalStateForBindings = (bindings) => (bindings.length ? 'bound' : 'none');

  const pendingPatchForDesired = (desiredByField) => Object.keys(FIELD_PURPOSES).map((path) => ({
    path,
    value: desiredByField[path] || null
  }));

  const desiredFromPendingPatch = (mistake) => {
    const desired = {};
    (mistake.mediaPendingPatch || []).forEach((entry) => {
      if (entry.value) desired[entry.path] = String(entry.value);
    });
    return desired;
  };

  const assertValidClientEnvelope = (value, command, expectedState) => {
    if (!Array.isArray(value) || value.length !== command.references.length) {
      throw new Error('invalid media reference response');
    }
    const pending = new Map(command.references.map((reference) => [
      `${reference.field}:${normalizeId(reference.mediaId)}`,
      reference
    ]));
    value.forEach((entry) => {
      const key = entry && `${entry.field}:${normalizeId(entry.mediaId)}`;
      const reference = pending.get(key);
      if (!entry
        || !reference
        || entry.field !== reference.field
        || normalizeId(entry.mediaId) !== normalizeId(reference.mediaId)
        || entry.state !== expectedState) {
        throw new Error('invalid media reference response');
      }
      pending.delete(key);
    });
    if (pending.size !== 0) throw new Error('invalid media reference response');
  };

  const stateEventFor = (mistake) => FamilyMistakeStateEventModel.create({
    familyId: mistake.familyId,
    childId: mistake.childId,
    mistakeId: mistake._id,
    reviewed: mistake.reviewed,
    mastered: mistake.mastered,
    reviewReminderDate: mistake.reviewReminderDate,
    effectiveAt: new Date(),
    operationId: randomUUID()
  });

  const removalReferencesForPending = (mistake) => removalReferences(
    bindingDtos(mistake.mediaPreviousBindings || []),
    desiredFromPendingPatch(mistake)
  );

  const finalizePending = async (mistake) => {
    const bindings = bindingDtos(mistake.mediaReferenceBindings || []);
    const finalized = await update(
      {
        _id: mistake._id,
        familyId: mistake.familyId,
        childId: mistake.childId,
        mediaReferenceState: 'pending',
        mediaBindingOperationId: mistake.mediaBindingOperationId
      },
      {
        $set: { mediaReferenceState: finalStateForBindings(bindings) },
        $unset: {
          mediaBindingOperationId: '',
          mediaPendingPatch: '',
          mediaPreviousBindings: '',
          mediaMutationKind: ''
        },
        $inc: { __v: 1 }
      }
    );
    if (!finalized) throw pendingError(mistake._id);
    return finalized;
  };

  const releasePreviousBindings = async (mistake) => {
    const removals = removalReferencesForPending(mistake);
    if (removals.length === 0) return finalizePending(mistake);
    const command = commandFor(mistake, removals);
    try {
      assertValidClientEnvelope(await mediaReferenceClient.unbind(command), command, 'released');
    } catch (error) {
      throw pendingError(mistake._id);
    }
    return finalizePending(mistake);
  };

  const publishBinding = async (mistake) => {
    const desiredByField = desiredFromPendingPatch(mistake);
    const previousBindings = bindingDtos(mistake.mediaPreviousBindings || []);
    const nextBindings = nextBindingsFor(previousBindings, desiredByField, mistake.mediaBindingOperationId);
    const removals = removalReferences(previousBindings, desiredByField);
    const setDocument = {
      mediaReferenceState: removals.length ? 'pending' : finalStateForBindings(nextBindings),
      mediaReferenceBindings: nextBindings
    };
    const unsetDocument = {};
    (mistake.mediaPendingPatch || []).forEach((entry) => {
      if (entry.value) {
        setDocument[entry.path] = entry.value;
      } else {
        unsetDocument[entry.path] = '';
      }
    });
    const updateDocument = {
      $set: setDocument,
      $inc: { __v: 1 }
    };
    if (removals.length === 0) {
      updateDocument.$unset = {
        ...unsetDocument,
        mediaBindingOperationId: '',
        mediaPendingPatch: '',
        mediaPreviousBindings: '',
        mediaMutationKind: ''
      };
    } else if (Object.keys(unsetDocument).length > 0) {
      updateDocument.$unset = unsetDocument;
    }
    const published = await update(
      {
        _id: mistake._id,
        familyId: mistake.familyId,
        childId: mistake.childId,
        mediaReferenceState: 'pending',
        mediaBindingOperationId: mistake.mediaBindingOperationId
      },
      updateDocument
    );

    if (!published) throw pendingError(mistake._id);
    if (mistake.mediaMutationKind === 'create') await stateEventFor(published);
    if (removals.length > 0) return releasePreviousBindings(published);
    return published;
  };

  const resumeBinding = async (mistake, { allowStablePrepareError = false } = {}) => {
    const previousBindings = bindingDtos(mistake.mediaPreviousBindings || []);
    const references = additionReferences(previousBindings, desiredFromPendingPatch(mistake));
    if (references.length === 0) return publishBinding(mistake);
    const command = commandFor(mistake, references);
    try {
      assertValidClientEnvelope(await mediaReferenceClient.prepare(command), command, 'prepared');
    } catch (error) {
      if (allowStablePrepareError && isStableMediaError(error)) throw stableMediaError(error);
      throw pendingError(mistake._id);
    }
    try {
      assertValidClientEnvelope(await mediaReferenceClient.commit(command), command, 'bound');
    } catch (error) {
      throw pendingError(mistake._id);
    }
    return publishBinding(mistake);
  };

  const create = async ({ mistakeInput, mediaPatch = {} } = {}) => {
    const operationId = randomUUID();
    const pendingPatch = Object.entries(mediaPatch).map(([path, value]) => ({ path, value }));
    const mistake = await FamilyMistakeModel.create({
      _id: new mongoose.Types.ObjectId(),
      ...mistakeInput,
      mediaReferenceState: 'pending',
      mediaBindingOperationId: operationId,
      mediaPendingPatch: pendingPatch,
      mediaMutationKind: 'create'
    });
    try {
      return await resumeBinding(mistake, { allowStablePrepareError: true });
    } catch (error) {
      if (isStableMediaError(error)) {
        await FamilyMistakeModel.deleteOne({ _id: mistake._id });
        throw error;
      }
      throw pendingError(mistake._id);
    }
  };

  const mutate = async ({ mistake, mistakePatch = {}, mediaPatch = {} } = {}) => {
    const current = await load(mistake);
    if (!current) throw pendingError(mistake && mistake._id);
    if (current.mediaReferenceState === 'pending') return resumeBinding(current);

    const previousBindings = bindingDtos(current.mediaReferenceBindings || []);
    const desiredByField = desiredMediaByField(current, mediaPatch);
    const additions = additionReferences(previousBindings, desiredByField);
    const removals = removalReferences(previousBindings, desiredByField);
    const operationId = randomUUID();

    if (additions.length === 0 && removals.length === 0) {
      Object.assign(current, mistakePatch);
      await current.save({ validateModifiedOnly: true });
      return current;
    }

    const claimed = await update(
      {
        _id: current._id,
        familyId: current.familyId,
        childId: current.childId,
        __v: current.__v,
        mediaReferenceState: current.mediaReferenceState
      },
      {
        $set: {
          ...mistakePatch,
          mediaReferenceState: 'pending',
          mediaBindingOperationId: operationId,
          mediaPendingPatch: pendingPatchForDesired(desiredByField),
          mediaPreviousBindings: previousBindings,
          mediaMutationKind: 'patch'
        },
        $inc: { __v: 1 }
      }
    );
    if (!claimed) throw pendingError(current._id);
    return resumeBinding(claimed, { allowStablePrepareError: true });
  };

  const resume = async (mistakeOrId) => {
    const mistake = await load(mistakeOrId);
    if (!mistake) throw pendingError(mistakeOrId);
    if (mistake.mediaReferenceState !== 'pending') return mistake;
    return resumeBinding(mistake);
  };

  return { create, mutate, resume };
};

module.exports = { createFamilyMistakeMediaService };

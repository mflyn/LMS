const mongoose = require('mongoose');

const { runMongoTransaction } = require('../../../common/services/mongoTransaction');
const { MEDIA_GROUPS, stateChangedBy } = require('./familyMistakePatch');

const HIDDEN_FAMILY_MISTAKE_MEDIA_STATE = [
  '+mediaReferenceState',
  '+mediaBindingOperationId',
  '+mediaPendingPatch',
  '+mediaPendingMistakePatch',
  '+mediaPendingStateEvent',
  '+mediaReferenceBindings',
  '+mediaPreviousBindings',
  '+mediaMutationKind'
].join(' ');

const FIELD_PURPOSES = Object.freeze({
  questionMediaId: 'mistake_question',
  childAnswerMediaId: 'mistake_answer'
});
const FIELD_ARRAYS = Object.freeze(Object.fromEntries(
  Object.entries(MEDIA_GROUPS).map(([arrayField, field]) => [field, arrayField])
));
const LOGICAL_FIELDS = Object.freeze(Object.keys(FIELD_PURPOSES));

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
const sameMediaId = (left, right) => normalizeId(left) === normalizeId(right);

const createFamilyMistakeMediaService = ({
  FamilyMistakeModel,
  FamilyMistakeStateEventModel,
  mediaReferenceClient,
  randomUUID,
  runTransaction = (work) => runMongoTransaction({ mongooseInstance: mongoose, work })
} = {}) => {
  if (!FamilyMistakeModel
    || typeof FamilyMistakeModel.create !== 'function'
    || typeof FamilyMistakeModel.findById !== 'function'
    || typeof FamilyMistakeModel.findOneAndUpdate !== 'function'
    || typeof FamilyMistakeModel.deleteOne !== 'function') {
    throw new Error('FamilyMistakeModel is required');
  }
  if (!FamilyMistakeStateEventModel || typeof FamilyMistakeStateEventModel.updateOne !== 'function') {
    throw new Error('FamilyMistakeStateEventModel is required');
  }
  if (!mediaReferenceClient
    || ['prepare', 'commit', 'unbind'].some((method) => typeof mediaReferenceClient[method] !== 'function')) {
    throw new Error('mediaReferenceClient is required');
  }
  if (typeof randomUUID !== 'function') throw new Error('randomUUID is required');
  if (typeof runTransaction !== 'function') throw new Error('runTransaction is required');

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

  const update = (filter, updateDocument, session = null) => {
    let query = FamilyMistakeModel.findOneAndUpdate(
      filter,
      updateDocument,
      { new: true, runValidators: true }
    );
    if (session && typeof query.session === 'function') query = query.session(session);
    return query.select(HIDDEN_FAMILY_MISTAKE_MEDIA_STATE);
  };

  const bindingDtos = (bindings = []) => bindings.map((binding) => ({
    field: binding.field,
    mediaId: String(binding.mediaId),
    bindingOperationId: binding.bindingOperationId
  }));

  const arraysByField = (mistake) => Object.fromEntries(LOGICAL_FIELDS.map((field) => {
    const arrayField = FIELD_ARRAYS[field];
    const arrayValue = mistake[arrayField];
    if (Array.isArray(arrayValue)) return [field, arrayValue.map(String)];
    return [field, mistake[field] ? [String(mistake[field])] : []];
  }));

  const desiredMediaByField = (mistake, mediaPatch = {}) => {
    const desired = arraysByField(mistake);
    Object.entries(MEDIA_GROUPS).forEach(([arrayField, field]) => {
      if (Object.prototype.hasOwnProperty.call(mediaPatch, arrayField)) {
        desired[field] = mediaPatch[arrayField].map(String);
      }
    });
    return desired;
  };

  const desiredFromPendingPatch = (mistake) => {
    const desired = Object.fromEntries(LOGICAL_FIELDS.map((field) => [field, []]));
    (mistake.mediaPendingPatch || []).forEach((entry) => {
      if (entry.value) desired[entry.path].push(String(entry.value));
    });
    return desired;
  };

  const pendingPatchForDesired = (desired) => LOGICAL_FIELDS.flatMap((field) => (
    desired[field].length > 0
      ? desired[field].map((value) => ({ path: field, value }))
      : [{ path: field, value: null }]
  ));

  const additionReferences = (previousBindings, desired) => LOGICAL_FIELDS.flatMap((field) => (
    desired[field]
      .filter((mediaId) => !previousBindings.some((binding) => (
        binding.field === field && sameMediaId(binding.mediaId, mediaId)
      )))
      .map((mediaId) => ({ field, mediaId }))
  ));

  const removalReferences = (previousBindings, desired) => previousBindings
    .filter((binding) => !desired[binding.field].some((mediaId) => sameMediaId(mediaId, binding.mediaId)))
    .map((binding) => ({
      field: binding.field,
      mediaId: binding.mediaId,
      bindingOperationId: binding.bindingOperationId
    }));

  const nextBindingsFor = (previousBindings, desired, operationId) => LOGICAL_FIELDS.flatMap((field) => (
    desired[field].map((mediaId) => previousBindings.find((binding) => (
      binding.field === field && sameMediaId(binding.mediaId, mediaId)
    )) || { field, mediaId, bindingOperationId: operationId })
  ));

  const commandFor = (mistake, references) => ({
    familyId: String(mistake.familyId),
    childId: String(mistake.childId),
    resourceType: 'family_mistake',
    resourceId: String(mistake._id),
    operationId: mistake.mediaBindingOperationId,
    references
  });

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
      if (!entry || !reference || entry.state !== expectedState) {
        throw new Error('invalid media reference response');
      }
      pending.delete(key);
    });
    if (pending.size !== 0) throw new Error('invalid media reference response');
  };

  const finalStateForBindings = (bindings) => (bindings.length ? 'bound' : 'none');

  const eventDocumentFor = (mistake, operationId) => ({
    familyId: mistake.familyId,
    childId: mistake.childId,
    mistakeId: mistake._id,
    reviewed: mistake.reviewed,
    mastered: mistake.mastered,
    reviewReminderDate: mistake.reviewReminderDate,
    effectiveAt: new Date(),
    operationId
  });

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
          mediaPendingMistakePatch: '',
          mediaPendingStateEvent: '',
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
    const removals = removalReferences(
      bindingDtos(mistake.mediaPreviousBindings || []),
      desiredFromPendingPatch(mistake)
    );
    if (removals.length === 0) return finalizePending(mistake);
    const command = commandFor(mistake, removals);
    try {
      assertValidClientEnvelope(await mediaReferenceClient.unbind(command), command, 'released');
    } catch (_error) {
      throw pendingError(mistake._id);
    }
    return finalizePending(mistake);
  };

  const publishBinding = async (mistake) => {
    const desired = desiredFromPendingPatch(mistake);
    const previousBindings = bindingDtos(mistake.mediaPreviousBindings || []);
    const nextBindings = nextBindingsFor(previousBindings, desired, mistake.mediaBindingOperationId);
    const removals = removalReferences(previousBindings, desired);
    const pendingMistakePatch = mistake.mediaPendingMistakePatch || {};

    const published = await runTransaction(async (session) => {
      const setDocument = {
        ...pendingMistakePatch,
        mediaReferenceState: removals.length ? 'pending' : finalStateForBindings(nextBindings),
        mediaReferenceBindings: nextBindings
      };
      const unsetDocument = {};
      LOGICAL_FIELDS.forEach((field) => {
        const arrayField = FIELD_ARRAYS[field];
        setDocument[arrayField] = desired[field];
        if (desired[field][0]) setDocument[field] = desired[field][0];
        else unsetDocument[field] = '';
      });
      if (removals.length === 0) {
        Object.assign(unsetDocument, {
          mediaBindingOperationId: '',
          mediaPendingPatch: '',
          mediaPendingMistakePatch: '',
          mediaPendingStateEvent: '',
          mediaPreviousBindings: '',
          mediaMutationKind: ''
        });
      }
      const updateDocument = {
        $set: setDocument,
        $unset: unsetDocument,
        $inc: { __v: 1 }
      };
      const owner = await update(
        {
          _id: mistake._id,
          familyId: mistake.familyId,
          childId: mistake.childId,
          mediaReferenceState: 'pending',
          mediaBindingOperationId: mistake.mediaBindingOperationId
        },
        updateDocument,
        session
      );
      if (!owner) throw pendingError(mistake._id);
      if (mistake.mediaPendingStateEvent) {
        const event = eventDocumentFor(owner, mistake.mediaBindingOperationId);
        await FamilyMistakeStateEventModel.updateOne(
          {
            familyId: owner.familyId,
            mistakeId: owner._id,
            operationId: mistake.mediaBindingOperationId
          },
          { $setOnInsert: event },
          { upsert: true, runValidators: true, setDefaultsOnInsert: true, session }
        );
      }
      return owner;
    });

    if (removals.length > 0) return releasePreviousBindings(published);
    return published;
  };

  const resumeBinding = async (mistake, { allowStablePrepareError = false } = {}) => {
    const previousBindings = bindingDtos(mistake.mediaPreviousBindings || []);
    const references = additionReferences(previousBindings, desiredFromPendingPatch(mistake));
    if (references.length === 0) {
      try {
        return await publishBinding(mistake);
      } catch (_error) {
        throw pendingError(mistake._id);
      }
    }
    const command = commandFor(mistake, references);
    try {
      assertValidClientEnvelope(await mediaReferenceClient.prepare(command), command, 'prepared');
    } catch (error) {
      if (allowStablePrepareError && isStableMediaError(error)) throw stableMediaError(error);
      throw pendingError(mistake._id);
    }
    try {
      assertValidClientEnvelope(await mediaReferenceClient.commit(command), command, 'bound');
    } catch (_error) {
      throw pendingError(mistake._id);
    }
    try {
      return await publishBinding(mistake);
    } catch (_error) {
      throw pendingError(mistake._id);
    }
  };

  const rollbackPatchClaim = (mistake) => update(
    {
      _id: mistake._id,
      mediaReferenceState: 'pending',
      mediaBindingOperationId: mistake.mediaBindingOperationId
    },
    {
      $set: {
        mediaReferenceState: finalStateForBindings(mistake.mediaPreviousBindings || [])
      },
      $unset: {
        mediaBindingOperationId: '',
        mediaPendingPatch: '',
        mediaPendingMistakePatch: '',
        mediaPendingStateEvent: '',
        mediaPreviousBindings: '',
        mediaMutationKind: ''
      },
      $inc: { __v: 1 }
    }
  );

  const create = async ({ mistakeInput, mediaPatch = {} } = {}) => {
    const operationId = randomUUID();
    const desired = desiredMediaByField({}, mediaPatch);
    const mistake = await FamilyMistakeModel.create({
      _id: new mongoose.Types.ObjectId(),
      ...mistakeInput,
      mediaReferenceState: 'pending',
      mediaBindingOperationId: operationId,
      mediaPendingPatch: pendingPatchForDesired(desired),
      mediaPendingMistakePatch: {},
      mediaPendingStateEvent: true,
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
    const desired = desiredMediaByField(current, mediaPatch);
    const operationId = randomUUID();
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
          mediaReferenceState: 'pending',
          mediaBindingOperationId: operationId,
          mediaPendingPatch: pendingPatchForDesired(desired),
          mediaPendingMistakePatch: mistakePatch,
          mediaPendingStateEvent: stateChangedBy(mistakePatch),
          mediaPreviousBindings: previousBindings,
          mediaMutationKind: 'patch'
        },
        $inc: { __v: 1 }
      }
    );
    if (!claimed) throw pendingError(current._id);
    try {
      return await resumeBinding(claimed, { allowStablePrepareError: true });
    } catch (error) {
      if (isStableMediaError(error)) await rollbackPatchClaim(claimed);
      throw error;
    }
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

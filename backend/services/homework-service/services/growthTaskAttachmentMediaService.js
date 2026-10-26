const mongoose = require('mongoose');
const { isDeepStrictEqual } = require('node:util');
const { entriesToMongoSet } = require('./growthTaskPatch');
const { assertChecklistVersion } = require('./growthTaskChecklist');

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
const STABLE_PREPARE_STATUSES = new Set([400, 403, 404, 409]);

const pendingError = (taskId) => Object.assign(
  new Error('Media reference operation is pending'),
  { status: 503, code: 'MEDIA_REFERENCE_PENDING', details: { resourceId: String(taskId) } }
);

const conflictError = () => Object.assign(
  new Error('Growth task attachments changed concurrently'),
  { status: 409, code: 'RESOURCE_CONFLICT', details: [] }
);

const stableMediaError = (error) => Object.assign(
  new Error('Media reference rejected'),
  {
    status: error.status,
    code: typeof error.code === 'string' ? error.code : 'MEDIA_REFERENCE_REJECTED',
    details: []
  }
);

const normalizeId = (value) => String(value).toLowerCase();
const idsEqual = (left, right) => normalizeId(left) === normalizeId(right);

const normalizeAttachmentMediaIds = (attachmentMediaIds = []) => {
  const normalized = [];
  const seen = new Set();
  for (const mediaId of attachmentMediaIds) {
    const canonicalId = normalizeId(mediaId);
    if (!seen.has(canonicalId)) {
      seen.add(canonicalId);
      normalized.push(canonicalId);
    }
  }
  return normalized;
};

const createGrowthTaskAttachmentMediaService = ({
  GrowthTaskModel,
  mediaReferenceClient,
  randomUUID,
  logger,
  completionIsolation = false
} = {}) => {
  if (!GrowthTaskModel
    || typeof GrowthTaskModel.create !== 'function'
    || typeof GrowthTaskModel.findById !== 'function'
    || typeof GrowthTaskModel.findOneAndUpdate !== 'function'
    || typeof GrowthTaskModel.deleteOne !== 'function') {
    throw new Error('GrowthTaskModel is required');
  }
  if (!mediaReferenceClient
    || ['prepare', 'commit', 'unbind'].some((method) => typeof mediaReferenceClient[method] !== 'function')) {
    throw new Error('mediaReferenceClient is required');
  }
  if (typeof randomUUID !== 'function') throw new Error('randomUUID is required');
  if (!logger || ['info', 'warn', 'error'].some((method) => typeof logger[method] !== 'function')) {
    throw new Error('logger is required');
  }

  if (typeof completionIsolation !== 'boolean') throw new Error('completionIsolation must be boolean');
  const hiddenState = HIDDEN_GROWTH_TASK_MEDIA_STATE
    + (completionIsolation ? ' +activeCompletionOperation +completionPending +mediaCompletionFence' : '');
  const versionKeys = ['completionVersion', 'checklistVersion'];
  const storedFence = task => Object.fromEntries(versionKeys.map(key => [key, task[key] ?? 0]));
  const plainValue = value => value && typeof value.toObject === 'function' ? value.toObject() : value;
  const publishedPatchSet = previous => {
    const set = entriesToMongoSet(pendingPatchEntries(previous));
    const cast = typeof GrowthTaskModel.castObject === 'function' ? GrowthTaskModel.castObject(set) : set;
    // Mongoose castObject omits nulls; an explicit clear is still part of the persisted intent.
    return Object.fromEntries(Object.keys(set).map(key => [key, set[key] === null ? null : cast[key]]));
  };
  const publishedPatchMatches = (task, previous) => {
    const expected = publishedPatchSet(previous);
    return Object.keys(expected).every(key => JSON.stringify(plainValue(task[key])) === JSON.stringify(expected[key]));
  };
  const assertCompletionIdle = (task) => {
    if (!completionIsolation || !task) return;
    if (task.activeCompletionOperation || task.completionPending
      || ![undefined, 'stable'].includes(task.completionMediaReferenceState)
      || versionKeys.some(key => task[key] !== undefined && (!Number.isSafeInteger(task[key]) || task[key] < 0))) throw pendingError(task._id);
    if (task.mediaReferenceState === 'pending' && task.mediaCompletionFence !== undefined) {
      const fence = task.mediaCompletionFence;
      if (versionKeys.some(key => !Number.isSafeInteger(fence?.[key]) || fence[key] < 0)
        || fence.completionVersion !== (task.completionVersion ?? 0)) throw pendingError(task._id);
      let expectedChecklistVersion = fence.checklistVersion;
      if (task.mediaMutationKind === 'patch') {
        let set;
        try {
          set = entriesToMongoSet(pendingPatchEntries(task));
          assertChecklistVersion(fence, set);
        } catch (_cause) { throw pendingError(task._id); }
        if (task.mediaBindingPhase === 'unbinding') {
          expectedChecklistVersion = set.checklistVersion ?? fence.checklistVersion;
          try {
            if (!publishedPatchMatches(task, task)
              || !sameOrder(stringIds(task.attachmentMediaIds), stringIds(task.attachmentMediaPendingIds))
              || !isDeepStrictEqual(bindingDtos(task.attachmentMediaBindings), desiredBindingsFor(task))) throw pendingError(task._id);
          } catch (_cause) { throw pendingError(task._id); }
        }
      }
      if (expectedChecklistVersion !== (task.checklistVersion ?? 0)) throw pendingError(task._id);
    }
    if (task.status !== 'pending') throw conflictError();
  };
  const exact = value => value === undefined ? { $exists: false } : value;
  const completionFence = task => {
    if (!completionIsolation) return {};
    assertCompletionIdle(task);
    const published = task.mediaMutationKind === 'patch' && task.mediaBindingPhase === 'unbinding'
      ? publishedPatchSet(task) : null;
    return { status: 'pending', activeCompletionOperation: null, completionPending: null,
      completionMediaReferenceState: exact(task.completionMediaReferenceState),
      completionVersion: exact(task.completionVersion), checklistVersion: exact(task.checklistVersion),
      mediaCompletionFence: task.mediaCompletionFence === undefined ? { $exists: false } : plainValue(task.mediaCompletionFence),
      ...(task.mediaReferenceState === 'pending' && task.mediaMutationKind === 'patch'
        ? { mediaPendingTaskPatch: pendingPatchEntries(task),
          attachmentMediaPendingIds: exact(plainValue(task.attachmentMediaPendingIds)),
          attachmentMediaPreviousBindings: exact(plainValue(task.attachmentMediaPreviousBindings)) } : {}),
      ...(published ? {
        ...Object.fromEntries(Object.entries(published).map(([key, value]) => [key,
          value === null ? { $eq: null, $exists: true } : exact(value)])),
        attachmentMediaIds: plainValue(task.attachmentMediaIds),
        attachmentMediaBindings: plainValue(task.attachmentMediaBindings)
      } : {}) };
  };
  const sameCompletionVersions = (left, right) => ['completionVersion', 'checklistVersion', 'completionMediaReferenceState']
    .every(key => left[key] === right[key]);
  // A lost local response may replay only this write, never a later owner's similar result.
  const isNextSnapshot = (next, previous, published = false) => !completionIsolation || Boolean(next
    && next.__v === (previous.__v ?? 0) + 1 && sameCompletionVersions(next, published
      ? { ...plainValue(previous), checklistVersion: entriesToMongoSet(pendingPatchEntries(previous)).checklistVersion
        ?? previous.checklistVersion } : previous)
    && idsEqual(next.familyId, previous.familyId) && idsEqual(next.childId, previous.childId));
  const selectHidden = async (queryOrPromise) => {
    if (queryOrPromise && typeof queryOrPromise.select === 'function') {
      return queryOrPromise.select(hiddenState);
    }
    return queryOrPromise;
  };

  const load = async (taskOrId) => {
    const taskId = taskOrId && taskOrId._id ? taskOrId._id : taskOrId;
    const task = await selectHidden(GrowthTaskModel.findById(taskId));
    assertCompletionIdle(task);
    return task;
  };

  const assertCurrentMaterialOwner = async task => {
    if (!completionIsolation) return;
    const current = await load(task._id);
    if (!current || current.__v !== task.__v || !sameCompletionVersions(current, task)
      || !idsEqual(current.familyId, task.familyId) || !idsEqual(current.childId, task.childId)
      || current.mediaBindingOperationId !== task.mediaBindingOperationId
      || current.mediaBindingPhase !== task.mediaBindingPhase
      || current.mediaMutationKind !== task.mediaMutationKind
      || current.mediaReferenceState !== 'pending'
      || !isDeepStrictEqual(recoverySnapshot(current), recoverySnapshot(task))) throw pendingError(task._id);
  };

  const update = async (filter, updateDocument) => {
    if (completionIsolation && filter.__v === undefined) filter = { ...filter, __v: { $exists: false } };
    const result = GrowthTaskModel.findOneAndUpdate(
      filter,
      updateDocument,
      { new: true, runValidators: true }
    );
    if (result && typeof result.select === 'function') {
      return result.select(hiddenState);
    }
    const resolved = await result;
    if (resolved && resolved._id) {
      return selectHidden(GrowthTaskModel.findById(resolved._id));
    }
    return resolved;
  };

  const commandForReferences = (task, references) => ({
    familyId: String(task.familyId),
    childId: String(task.childId),
    resourceType: 'growth_task',
    resourceId: String(task._id),
    operationId: task.mediaBindingOperationId,
    references
  });

  const commandFor = (task) => commandForReferences(
    task,
    (task.attachmentMediaPendingIds || []).map((mediaId) => ({
      mediaId: String(mediaId),
      field: 'attachmentMediaIds'
    }))
  );

  const commandForAdditionIds = (task, additionIds) => commandForReferences(
    task,
    additionIds.map((mediaId) => ({ mediaId, field: 'attachmentMediaIds' }))
  );

  const commandForRemovalBindings = (task, removalBindings) => commandForReferences(
    task,
    removalBindings.map((binding) => ({
      mediaId: String(binding.mediaId),
      field: 'attachmentMediaIds',
      bindingOperationId: binding.bindingOperationId
    }))
  );

  const assertValidClientEnvelope = (value, command, expectedState) => {
    const expectedStates = Array.isArray(expectedState) ? expectedState : [expectedState];
    if (!Array.isArray(value)) throw new Error('invalid media reference response');
    if (value.length !== command.references.length) throw new Error('invalid media reference response');
    const pending = new Map(command.references.map((reference) => [
      `${reference.field}:${normalizeId(reference.mediaId)}`,
      reference
    ]));
    value.forEach((entry) => {
      const key = entry && `${entry.field}:${normalizeId(entry.mediaId)}`;
      const reference = pending.get(key);
      if (!entry
        || !reference
        || !idsEqual(entry.mediaId, reference.mediaId)
        || entry.field !== reference.field
        || !expectedStates.includes(entry.state)) {
        throw new Error('invalid media reference response');
      }
      pending.delete(key);
    });
    if (pending.size !== 0) throw new Error('invalid media reference response');
  };

  const convergedCreateBinding = (task, operationId, desiredIds, previous) => {
    if (!task || !isNextSnapshot(task, previous)) return false;
    if (desiredIds.length === 0) {
      return task.mediaReferenceState === 'none' && (task.attachmentMediaIds || []).length === 0;
    }
    const publicIds = task.attachmentMediaIds || [];
    const bindings = task.attachmentMediaBindings || [];
    return task.mediaReferenceState === 'bound'
      && publicIds.length === desiredIds.length
      && bindings.length === desiredIds.length
      && desiredIds.every((id, index) => idsEqual(publicIds[index], id))
      && desiredIds.every((id, index) => (
        idsEqual(bindings[index].mediaId, id)
        && bindings[index].bindingOperationId === operationId
      ));
  };

  const stringIds = (ids = []) => ids.map(String);

  const bindingDtos = (bindings = []) => bindings.map((binding) => ({
    mediaId: String(binding.mediaId),
    bindingOperationId: binding.bindingOperationId
  }));

  const sameOrder = (left = [], right = []) => (
    left.length === right.length && left.every((id, index) => idsEqual(id, right[index]))
  );

  const sameSet = (left = [], right = []) => (
    left.length === right.length && left.every((id) => right.some((candidate) => idsEqual(id, candidate)))
  );

  const mediaStateForIds = (desiredIds) => (desiredIds.length ? 'bound' : 'none');

  const pendingPatchEntries = (task) => (task.mediaPendingTaskPatch || []).map((entry) => ({
    path: entry.path,
    value: Object.prototype.hasOwnProperty.call(entry, 'value') ? entry.value : entry._doc.value
  }));

  const recoverySnapshot = task => ({
    taskId: String(task._id), familyId: String(task.familyId), childId: String(task.childId),
    version: task.__v, status: task.status,
    completionVersion: task.completionVersion, checklistVersion: task.checklistVersion,
    completionMediaReferenceState: task.completionMediaReferenceState,
    mediaReferenceState: task.mediaReferenceState,
    operationId: task.mediaBindingOperationId, phase: task.mediaBindingPhase, kind: task.mediaMutationKind,
    remoteOutcomeUncertain: task.mediaRemoteOutcomeUncertain,
    fence: task.mediaCompletionFence === undefined ? undefined : {
      completionVersion: task.mediaCompletionFence.completionVersion,
      checklistVersion: task.mediaCompletionFence.checklistVersion
    },
    publicIds: stringIds(task.attachmentMediaIds), bindings: bindingDtos(task.attachmentMediaBindings),
    pendingIds: stringIds(task.attachmentMediaPendingIds),
    previousBindings: bindingDtos(task.attachmentMediaPreviousBindings),
    patch: entriesToMongoSet(pendingPatchEntries(task))
  });

  const finalUnset = () => ({
    mediaBindingOperationId: '',
    attachmentMediaPendingIds: '',
    attachmentMediaPreviousBindings: '',
    mediaBindingPhase: '',
    mediaPendingTaskPatch: '',
    mediaMutationKind: '',
    mediaRemoteOutcomeUncertain: '',
    ...(completionIsolation ? { mediaCompletionFence: '' } : {})
  });

  const convergedPatch = (task, desiredIds, previous) => {
    if (!task || !isNextSnapshot(task, previous, previous.mediaBindingPhase === 'binding')
      || task.mediaReferenceState !== mediaStateForIds(desiredIds)) return false;
    if (completionIsolation && (task.mediaBindingOperationId || task.mediaBindingPhase
      || !publishedPatchMatches(task, previous)
      || JSON.stringify(bindingDtos(task.attachmentMediaBindings)) !== JSON.stringify(desiredBindingsFor(previous)))) return false;
    return sameOrder(stringIds(task.attachmentMediaIds || []), desiredIds);
  };

  const canResumeUnbinding = (task, previous) => task && task.mediaBindingPhase === 'unbinding'
    && (!completionIsolation || isNextSnapshot(task, previous, true)
      && task.mediaBindingOperationId === previous.mediaBindingOperationId
      && task.mediaMutationKind === 'patch' && task.mediaReferenceState === 'pending'
      && publishedPatchMatches(task, previous)
      && isDeepStrictEqual(entriesToMongoSet(pendingPatchEntries(task)), entriesToMongoSet(pendingPatchEntries(previous)))
      && isDeepStrictEqual(plainValue(task.mediaCompletionFence), plainValue(previous.mediaCompletionFence))
      && sameOrder(stringIds(task.attachmentMediaPendingIds), stringIds(previous.attachmentMediaPendingIds))
      && sameOrder(stringIds(task.attachmentMediaIds), stringIds(previous.attachmentMediaPendingIds))
      && isDeepStrictEqual(bindingDtos(task.attachmentMediaPreviousBindings), bindingDtos(previous.attachmentMediaPreviousBindings))
      && isDeepStrictEqual(bindingDtos(task.attachmentMediaBindings), desiredBindingsFor(previous)));

  const rollbackCreateOnStablePrepare = async (task, stableError) => {
    let deleted;
    try {
      deleted = await GrowthTaskModel.deleteOne({
        ...completionFence(task),
        _id: task._id,
        familyId: task.familyId,
        childId: task.childId,
        __v: completionIsolation ? exact(task.__v) : task.__v,
        mediaReferenceState: 'pending',
        mediaBindingOperationId: task.mediaBindingOperationId,
        mediaMutationKind: 'create',
        mediaBindingPhase: 'binding',
        mediaRemoteOutcomeUncertain: true
      });
    } catch (error) {
      throw pendingError(task._id);
    }
    if (deleted && deleted.deletedCount === 1) throw stableMediaError(stableError);
    throw pendingError(task._id);
  };

  const publishCreateBinding = async (task, desiredIds, operationId) => {
    const nextBindings = desiredIds.map((mediaId) => ({
      mediaId,
      bindingOperationId: operationId
    }));
    let published;
    try {
      published = await update({
        ...completionFence(task),
        _id: task._id,
        familyId: task.familyId,
        childId: task.childId,
        __v: task.__v,
        mediaReferenceState: 'pending',
        mediaBindingOperationId: operationId,
        mediaMutationKind: 'create',
        mediaBindingPhase: 'binding'
      }, {
        $set: {
          attachmentMediaIds: desiredIds,
          attachmentMediaBindings: nextBindings,
          mediaReferenceState: desiredIds.length ? 'bound' : 'none'
        },
        $unset: {
          mediaBindingOperationId: '',
          attachmentMediaPendingIds: '',
          attachmentMediaPreviousBindings: '',
          mediaBindingPhase: '',
          mediaPendingTaskPatch: '',
          mediaMutationKind: '',
          mediaRemoteOutcomeUncertain: '',
          ...(completionIsolation ? { mediaCompletionFence: '' } : {})
        },
        $inc: { __v: 1 }
      });
    } catch (error) {
      const reloaded = await load(task._id).catch(() => null);
      if (convergedCreateBinding(reloaded, operationId, desiredIds, task)) return reloaded;
      throw pendingError(task._id);
    }

    if (published) return published;
    const reloaded = await load(task._id).catch(() => null);
    if (convergedCreateBinding(reloaded, operationId, desiredIds, task)) return reloaded;
    throw pendingError(task._id);
  };

  const resumeBinding = async (task, { allowFirstRollback = false } = {}) => {
    const operationId = task.mediaBindingOperationId;
    const desiredIds = (task.attachmentMediaPendingIds || []).map(String);
    const command = commandFor(task);

    try {
      await assertCurrentMaterialOwner(task);
      // A lost commit response leaves the same operation bound on prepare replay.
      assertValidClientEnvelope(await mediaReferenceClient.prepare(command), command, ['prepared', 'bound']);
    } catch (error) {
      if (allowFirstRollback && STABLE_PREPARE_STATUSES.has(error && error.status)) {
        return rollbackCreateOnStablePrepare(task, error);
      }
      throw pendingError(task._id);
    }

    try {
      await assertCurrentMaterialOwner(task);
      assertValidClientEnvelope(await mediaReferenceClient.commit(command), command, 'bound');
    } catch (error) {
      throw pendingError(task._id);
    }

    return publishCreateBinding(task, desiredIds, operationId);
  };

  const markRemoteOutcomeUncertain = async (task) => {
    let marked;
    try {
      marked = await update({
        ...completionFence(task),
        _id: task._id,
        familyId: task.familyId,
        childId: task.childId,
        __v: task.__v,
        mediaReferenceState: 'pending',
        mediaBindingOperationId: task.mediaBindingOperationId,
        mediaMutationKind: 'create',
        mediaBindingPhase: 'binding',
        mediaRemoteOutcomeUncertain: false
      }, {
        $set: { mediaRemoteOutcomeUncertain: true },
        $inc: { __v: 1 }
      });
    } catch (error) {
      throw pendingError(task._id);
    }
    if (!marked) throw pendingError(task._id);
    return marked;
  };

  const markPatchRemoteOutcomeUncertain = async (task) => {
    let marked;
    try {
      marked = await update({
        ...completionFence(task),
        _id: task._id,
        familyId: task.familyId,
        childId: task.childId,
        __v: task.__v,
        status: 'pending',
        mediaReferenceState: 'pending',
        mediaBindingOperationId: task.mediaBindingOperationId,
        mediaMutationKind: 'patch',
        mediaBindingPhase: 'binding',
        mediaRemoteOutcomeUncertain: false
      }, {
        $set: { mediaRemoteOutcomeUncertain: true },
        $inc: { __v: 1 }
      });
    } catch (error) {
      throw pendingError(task._id);
    }
    if (!marked) throw pendingError(task._id);
    return marked;
  };

  const clearPatchIntentOnStablePrepare = async (task, stableError) => {
    const publicIds = stringIds(task.attachmentMediaIds || []);
    let cleared;
    try {
      cleared = await update({
        ...completionFence(task),
        _id: task._id,
        familyId: task.familyId,
        childId: task.childId,
        __v: task.__v,
        status: 'pending',
        mediaReferenceState: 'pending',
        mediaBindingOperationId: task.mediaBindingOperationId,
        mediaMutationKind: 'patch',
        mediaBindingPhase: 'binding',
        mediaRemoteOutcomeUncertain: true
      }, {
        $set: { mediaReferenceState: mediaStateForIds(publicIds) },
        $unset: finalUnset(),
        $inc: { __v: 1 }
      });
    } catch (error) {
      throw pendingError(task._id);
    }
    if (cleared) throw stableMediaError(stableError);
    throw pendingError(task._id);
  };

  const additionIdsFor = (task) => {
    const previousIds = bindingDtos(task.attachmentMediaPreviousBindings || [])
      .map((binding) => binding.mediaId);
    return stringIds(task.attachmentMediaPendingIds || [])
      .filter((id) => !previousIds.some((previousId) => idsEqual(previousId, id)));
  };

  const removalBindingsFor = (task) => {
    const desiredIds = stringIds(task.attachmentMediaPendingIds || []);
    return bindingDtos(task.attachmentMediaPreviousBindings || [])
      .filter((binding) => !desiredIds.some((id) => idsEqual(id, binding.mediaId)));
  };

  const desiredBindingsFor = (task) => {
    const operationId = task.mediaBindingOperationId;
    const previousById = new Map(bindingDtos(task.attachmentMediaPreviousBindings || [])
      .map((binding) => [normalizeId(binding.mediaId), binding]));
    return stringIds(task.attachmentMediaPendingIds || []).map((mediaId) => {
      const previous = previousById.get(normalizeId(mediaId));
      return previous || { mediaId, bindingOperationId: operationId };
    });
  };

  const finalizePatch = async (task) => {
    const desiredIds = stringIds(task.attachmentMediaPendingIds || []);
    let finalized;
    try {
      finalized = await update({
        ...completionFence(task),
        _id: task._id,
        familyId: task.familyId,
        childId: task.childId,
        __v: task.__v,
        status: 'pending',
        mediaReferenceState: 'pending',
        mediaBindingOperationId: task.mediaBindingOperationId,
        mediaMutationKind: 'patch',
        mediaBindingPhase: 'unbinding'
      }, {
        $set: { mediaReferenceState: mediaStateForIds(desiredIds) },
        $unset: finalUnset(),
        $inc: { __v: 1 }
      });
    } catch (error) {
      const reloaded = await load(task._id).catch(() => null);
      if (convergedPatch(reloaded, desiredIds, task)) return reloaded;
      throw pendingError(task._id);
    }
    if (finalized) return finalized;
    const reloaded = await load(task._id).catch(() => null);
    if (convergedPatch(reloaded, desiredIds, task)) return reloaded;
    throw pendingError(task._id);
  };

  const resumePatchUnbinding = async (task) => {
    const removals = removalBindingsFor(task);
    if (removals.length === 0) return finalizePatch(task);
    const command = commandForRemovalBindings(task, removals);
    try {
      await assertCurrentMaterialOwner(task);
      assertValidClientEnvelope(await mediaReferenceClient.unbind(command), command, 'released');
    } catch (error) {
      throw pendingError(task._id);
    }
    return finalizePatch(task);
  };

  const publishPatchBinding = async (task) => {
    const desiredIds = stringIds(task.attachmentMediaPendingIds || []);
    const removals = removalBindingsFor(task);
    const desiredBindings = desiredBindingsFor(task);
    const taskPatchSet = entriesToMongoSet(pendingPatchEntries(task));
    const nextPhase = removals.length ? 'unbinding' : undefined;
    const setDocument = {
      ...taskPatchSet,
      attachmentMediaIds: desiredIds,
      attachmentMediaBindings: desiredBindings,
      mediaReferenceState: removals.length ? 'pending' : mediaStateForIds(desiredIds)
    };
    if (nextPhase) setDocument.mediaBindingPhase = nextPhase;

    const updateDocument = {
      $set: setDocument,
      $inc: { __v: 1 }
    };
    if (!removals.length) updateDocument.$unset = finalUnset();

    let published;
    try {
      published = await update({
        ...completionFence(task),
        _id: task._id,
        familyId: task.familyId,
        childId: task.childId,
        __v: task.__v,
        status: 'pending',
        mediaReferenceState: 'pending',
        mediaBindingOperationId: task.mediaBindingOperationId,
        mediaMutationKind: 'patch',
        mediaBindingPhase: 'binding'
      }, updateDocument);
    } catch (error) {
      const reloaded = await load(task._id).catch(() => null);
      if (canResumeUnbinding(reloaded, task)) return resumePatchUnbinding(reloaded);
      if (convergedPatch(reloaded, desiredIds, task)) return reloaded;
      throw pendingError(task._id);
    }
    if (!published) {
      const reloaded = await load(task._id).catch(() => null);
      if (canResumeUnbinding(reloaded, task)) return resumePatchUnbinding(reloaded);
      if (convergedPatch(reloaded, desiredIds, task)) return reloaded;
      throw pendingError(task._id);
    }
    if (removals.length) return resumePatchUnbinding(published);
    return published;
  };

  const resumePatchBinding = async (task, { allowFirstStableClear = false } = {}) => {
    let current = task;
    const additions = additionIdsFor(current);
    if (additions.length) {
      if (current.mediaRemoteOutcomeUncertain !== true) {
        current = await markPatchRemoteOutcomeUncertain(current);
      }
      const command = commandForAdditionIds(current, additions);
      try {
        await assertCurrentMaterialOwner(current);
        assertValidClientEnvelope(await mediaReferenceClient.prepare(command), command, ['prepared', 'bound']);
      } catch (error) {
        if (allowFirstStableClear && STABLE_PREPARE_STATUSES.has(error && error.status)) {
          return clearPatchIntentOnStablePrepare(current, error);
        }
        throw pendingError(current._id);
      }
      try {
        await assertCurrentMaterialOwner(current);
        assertValidClientEnvelope(await mediaReferenceClient.commit(command), command, 'bound');
      } catch (error) {
        throw pendingError(current._id);
      }
    }
    return publishPatchBinding(current);
  };

  const resume = async (taskOrId, { expectedSnapshot } = {}) => {
    let task = await load(taskOrId);
    if (!task) throw conflictError();
    // Do not adopt another writer's intent or stable result after the validated read.
    if (expectedSnapshot && !isDeepStrictEqual(recoverySnapshot(task), expectedSnapshot)) throw pendingError(task._id);
    if (task.mediaReferenceState !== 'pending') return task;
    if (completionIsolation && task.mediaCompletionFence === undefined) {
      // Only pre-completion version-zero legacy intents have a provable adoption baseline.
      if (versionKeys.some(key => (task[key] ?? 0) !== 0)) throw pendingError(task._id);
      let adopted;
      try {
        adopted = await update({ ...completionFence(task), _id: task._id, familyId: task.familyId,
          childId: task.childId, __v: task.__v, mediaReferenceState: 'pending',
          mediaBindingOperationId: task.mediaBindingOperationId, mediaBindingPhase: task.mediaBindingPhase,
          mediaMutationKind: task.mediaMutationKind },
        { $set: { mediaCompletionFence: storedFence(task) }, $inc: { __v: 1 } });
      } catch (_error) { throw pendingError(task._id); }
      if (!adopted) throw pendingError(task._id);
      task = adopted;
    }
    if (task.mediaMutationKind === 'create' && task.mediaBindingPhase === 'binding') {
      const resumableTask = task.mediaRemoteOutcomeUncertain !== true
        ? await markRemoteOutcomeUncertain(task)
        : task;
      return resumeBinding(resumableTask);
    }
    if (task.mediaMutationKind === 'patch' && task.mediaBindingPhase === 'binding') {
      return resumePatchBinding(task);
    }
    if (task.mediaMutationKind === 'patch' && task.mediaBindingPhase === 'unbinding') {
      return resumePatchUnbinding(task);
    }
    throw pendingError(task._id);
  };

  const applyStablePatch = async (task, taskPatch = [], attachmentSet) => {
    const setDocument = {
      ...entriesToMongoSet(taskPatch),
      ...(attachmentSet || {})
    };
    if (Object.keys(setDocument).length === 0) {
      const expectedSnapshot = completionIsolation ? recoverySnapshot(task) : undefined;
      const current = await load(task._id);
      if (completionIsolation && (!current || !isDeepStrictEqual(recoverySnapshot(current), expectedSnapshot))) {
        throw pendingError(task._id);
      }
      return current;
    }
    let patched;
    try {
      patched = await update({
        ...completionFence(task),
        _id: task._id,
        familyId: task.familyId,
        childId: task.childId,
        __v: task.__v,
        status: 'pending',
        mediaReferenceState: task.mediaReferenceState
      }, {
        $set: setDocument,
        $inc: { __v: 1 }
      });
    } catch (error) {
      throw completionIsolation ? pendingError(task._id) : conflictError();
    }
    if (!patched) throw completionIsolation ? pendingError(task._id) : conflictError();
    return patched;
  };

  const resolvePendingAttachmentRequest = async (task, desiredIds, taskPatch = []) => {
    const pendingTask = task && task.mediaReferenceState === 'pending'
      ? task
      : await load(task._id);
    if (!pendingTask || pendingTask.mediaReferenceState !== 'pending') throw conflictError();
    const pendingIds = stringIds(pendingTask.attachmentMediaPendingIds || []);
    // A matching media set alone cannot identify the original mixed-field intent.
    if (completionIsolation && (!sameOrder(pendingIds, desiredIds)
      || !isDeepStrictEqual(entriesToMongoSet(pendingPatchEntries(pendingTask)), entriesToMongoSet(taskPatch)))) {
      throw conflictError();
    }
    const converged = await resume(pendingTask, {
      expectedSnapshot: completionIsolation ? recoverySnapshot(pendingTask) : undefined
    });
    if (sameOrder(pendingIds, desiredIds)) return converged;
    throw conflictError();
  };

  const claimPatch = async (task, taskPatch, desiredIds) => {
    const operationId = randomUUID();
    const previousBindings = bindingDtos(task.attachmentMediaBindings || []);
    let claimed;
    try {
      claimed = await update({
        ...completionFence(task),
        _id: task._id,
        familyId: task.familyId,
        childId: task.childId,
        __v: task.__v,
        status: 'pending',
        mediaReferenceState: task.mediaReferenceState
      }, {
        $set: {
          mediaReferenceState: 'pending',
          mediaBindingOperationId: operationId,
          attachmentMediaPendingIds: desiredIds,
          attachmentMediaPreviousBindings: previousBindings,
          mediaBindingPhase: 'binding',
          mediaPendingTaskPatch: taskPatch,
          mediaMutationKind: 'patch',
          mediaRemoteOutcomeUncertain: false,
          ...(completionIsolation ? { mediaCompletionFence: storedFence(task) } : {})
        },
        $inc: { __v: 1 }
      });
    } catch (error) {
      const reloaded = await load(task._id).catch(() => null);
      if (reloaded
        && isNextSnapshot(reloaded, task)
        && reloaded.mediaReferenceState === 'pending'
        && reloaded.mediaBindingOperationId === operationId
        && reloaded.mediaMutationKind === 'patch'
        && (!completionIsolation || reloaded.mediaBindingPhase === 'binding'
          && sameOrder(stringIds(reloaded.attachmentMediaPendingIds), desiredIds)
          && isDeepStrictEqual(entriesToMongoSet(pendingPatchEntries(reloaded)), entriesToMongoSet(taskPatch))
          && isDeepStrictEqual(plainValue(reloaded.mediaCompletionFence), storedFence(task)))) {
        return reloaded;
      }
      throw pendingError(task._id);
    }
    if (!claimed && completionIsolation) throw pendingError(task._id);
    if (!claimed) return resolvePendingAttachmentRequest(task, desiredIds, taskPatch);
    return claimed;
  };

  const mutate = async ({ task, taskPatch = [], attachmentMediaIds } = {}) => {
    const patchSet = entriesToMongoSet(taskPatch);
    if (!completionIsolation && Object.prototype.hasOwnProperty.call(patchSet, 'checklistVersion')) {
      throw conflictError();
    }
    const initial = await load(task);
    if (!initial) throw conflictError();
    if (initial.mediaReferenceState === 'pending' && attachmentMediaIds !== undefined) {
      const desiredIds = normalizeAttachmentMediaIds(attachmentMediaIds);
      return resolvePendingAttachmentRequest(initial, desiredIds, taskPatch);
    }
    if (initial.mediaReferenceState === 'pending' && patchSet.checklistVersion !== undefined) throw pendingError(initial._id);
    assertChecklistVersion(initial, patchSet);

    const current = await resume(initial, {
      expectedSnapshot: completionIsolation ? recoverySnapshot(initial) : undefined
    });
    const publicIds = stringIds(current.attachmentMediaIds || []);
    const bindings = bindingDtos(current.attachmentMediaBindings || []);

    if (attachmentMediaIds === undefined) {
      return applyStablePatch(current, taskPatch);
    }

    const desiredIds = normalizeAttachmentMediaIds(attachmentMediaIds);
    if (sameOrder(publicIds, desiredIds)) {
      return applyStablePatch(current, taskPatch);
    }

    if (sameSet(publicIds, desiredIds)) {
      const byId = new Map(bindings.map((binding) => [normalizeId(binding.mediaId), binding]));
      const reorderedBindings = desiredIds.map((id) => byId.get(normalizeId(id)));
      return applyStablePatch(current, taskPatch, {
        attachmentMediaIds: desiredIds,
        attachmentMediaBindings: reorderedBindings
      });
    }

    const claimed = await claimPatch(current, taskPatch, desiredIds);
    if (claimed.mediaReferenceState !== 'pending') return claimed;
    return resumePatchBinding(claimed, { allowFirstStableClear: true });
  };

  const create = async ({ taskInput, attachmentMediaIds = [] } = {}) => {
    assertCompletionIdle({ ...taskInput, status: taskInput?.status || 'pending' });
    const desiredIds = normalizeAttachmentMediaIds(attachmentMediaIds);
    if (desiredIds.length === 0) {
      return GrowthTaskModel.create(taskInput);
    }

    const operationId = randomUUID();
    const task = await GrowthTaskModel.create({
      _id: new mongoose.Types.ObjectId(),
      ...taskInput,
      attachmentMediaIds: [],
      attachmentMediaBindings: [],
      mediaReferenceState: 'pending',
      mediaBindingOperationId: operationId,
      attachmentMediaPendingIds: desiredIds,
      attachmentMediaPreviousBindings: [],
      mediaBindingPhase: 'binding',
      mediaPendingTaskPatch: [],
      mediaMutationKind: 'create',
      mediaRemoteOutcomeUncertain: false,
      ...(completionIsolation ? { mediaCompletionFence: storedFence(taskInput) } : {})
    });
    const marked = await markRemoteOutcomeUncertain(task);
    return resumeBinding(marked, { allowFirstRollback: true });
  };

  const publicAttachmentMediaIds = (task) => (
    (task && task.attachmentMediaIds ? task.attachmentMediaIds : []).map(String)
  );

  return { create, mutate, resume, publicAttachmentMediaIds };
};

module.exports = { createGrowthTaskAttachmentMediaService };

const mongoose = require('mongoose');

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
  logger
} = {}) => {
  if (!GrowthTaskModel
    || typeof GrowthTaskModel.create !== 'function'
    || typeof GrowthTaskModel.findById !== 'function'
    || typeof GrowthTaskModel.findOneAndUpdate !== 'function'
    || typeof GrowthTaskModel.deleteOne !== 'function') {
    throw new Error('GrowthTaskModel is required');
  }
  if (!mediaReferenceClient
    || ['prepare', 'commit'].some((method) => typeof mediaReferenceClient[method] !== 'function')) {
    throw new Error('mediaReferenceClient is required');
  }
  if (typeof randomUUID !== 'function') throw new Error('randomUUID is required');
  if (!logger || ['info', 'warn', 'error'].some((method) => typeof logger[method] !== 'function')) {
    throw new Error('logger is required');
  }

  const selectHidden = async (queryOrPromise) => {
    if (queryOrPromise && typeof queryOrPromise.select === 'function') {
      return queryOrPromise.select(HIDDEN_GROWTH_TASK_MEDIA_STATE);
    }
    return queryOrPromise;
  };

  const load = async (taskOrId) => {
    const taskId = taskOrId && taskOrId._id ? taskOrId._id : taskOrId;
    return selectHidden(GrowthTaskModel.findById(taskId));
  };

  const update = (filter, updateDocument) => selectHidden(GrowthTaskModel.findOneAndUpdate(
    filter,
    updateDocument,
    { new: true, runValidators: true }
  ));

  const commandFor = (task) => ({
    familyId: String(task.familyId),
    childId: String(task.childId),
    resourceType: 'growth_task',
    resourceId: String(task._id),
    operationId: task.mediaBindingOperationId,
    references: (task.attachmentMediaPendingIds || []).map((mediaId) => ({
      mediaId: String(mediaId),
      field: 'attachmentMediaIds'
    }))
  });

  const assertValidClientEnvelope = (value) => {
    if (!Array.isArray(value)) throw new Error('invalid media reference response');
  };

  const convergedCreateBinding = (task, operationId, desiredIds) => {
    if (!task) return false;
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

  const rollbackCreateOnStablePrepare = async (task, stableError) => {
    let deleted;
    try {
      deleted = await GrowthTaskModel.deleteOne({
        _id: task._id,
        familyId: task.familyId,
        childId: task.childId,
        __v: task.__v,
        mediaReferenceState: 'pending',
        mediaBindingOperationId: task.mediaBindingOperationId,
        mediaMutationKind: 'create',
        mediaBindingPhase: 'binding',
        mediaRemoteOutcomeUncertain: true
      });
    } catch (error) {
      throw pendingError(task._id);
    }
    if (deleted && deleted.deletedCount === 1) throw stableError;
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
          mediaRemoteOutcomeUncertain: ''
        },
        $inc: { __v: 1 }
      });
    } catch (error) {
      const reloaded = await load(task._id).catch(() => null);
      if (convergedCreateBinding(reloaded, operationId, desiredIds)) return reloaded;
      throw pendingError(task._id);
    }

    if (published) return published;
    const reloaded = await load(task._id).catch(() => null);
    if (convergedCreateBinding(reloaded, operationId, desiredIds)) return reloaded;
    throw pendingError(task._id);
  };

  const resumeBinding = async (task, { allowFirstRollback = false } = {}) => {
    const operationId = task.mediaBindingOperationId;
    const desiredIds = (task.attachmentMediaPendingIds || []).map(String);
    const command = commandFor(task);

    try {
      assertValidClientEnvelope(await mediaReferenceClient.prepare(command));
    } catch (error) {
      if (allowFirstRollback && STABLE_PREPARE_STATUSES.has(error && error.status)) {
        return rollbackCreateOnStablePrepare(task, error);
      }
      throw pendingError(task._id);
    }

    try {
      assertValidClientEnvelope(await mediaReferenceClient.commit(command));
    } catch (error) {
      throw pendingError(task._id);
    }

    return publishCreateBinding(task, desiredIds, operationId);
  };

  const markRemoteOutcomeUncertain = async (task) => {
    let marked;
    try {
      marked = await update({
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

  const resume = async (taskOrId) => {
    const task = await load(taskOrId);
    if (!task) throw conflictError();
    if (task.mediaReferenceState !== 'pending') return task;
    if (task.mediaMutationKind === 'create' && task.mediaBindingPhase === 'binding') {
      return resumeBinding(task);
    }
    throw pendingError(task._id);
  };

  const create = async ({ taskInput, attachmentMediaIds = [] } = {}) => {
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
      mediaRemoteOutcomeUncertain: false
    });
    const marked = await markRemoteOutcomeUncertain(task);
    return resumeBinding(marked, { allowFirstRollback: true });
  };

  const publicAttachmentMediaIds = (task) => (
    (task && task.attachmentMediaIds ? task.attachmentMediaIds : []).map(String)
  );

  return { create, resume, publicAttachmentMediaIds };
};

module.exports = { createGrowthTaskAttachmentMediaService };

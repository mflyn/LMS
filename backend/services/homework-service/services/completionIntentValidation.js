const { ID, UUID, matches, pending, bodyFromPending, bindings, hashCommand, difference } = require('./growthTaskCompletionCommand');
const ownerKeys = ['familyId', 'childId', 'taskId', 'actorId', 'action', 'operationId'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const assertIntent = (task, op, scope) => {
  const p = task.completionPending, owner = task.activeCompletionOperation;
  if (!owner || ownerKeys.some(k => String(owner[k]) !== scope[k]) || !p
    || p.phase !== op.phase || p.version !== op.version || p.targetCompletionVersion !== op.targetCompletionVersion
    || p.commandHash !== op.commandHash || task.completionMediaReferenceState !== 'pending_recovery'
    || task.mediaReferenceState === 'pending' || typeof p.remoteOutcomeUncertain !== 'boolean') throw pending();
  try {
    const command = bodyFromPending(op, p), previous = bindings(p.previousBindings);
    if (hashCommand(scope, command) !== op.commandHash || !p.patch.submittedByActor
      || String(p.patch.submittedByActor.id) !== scope.actorId || !['student', 'parent'].includes(p.patch.submittedByActor.role)
      || p.expectedCompletionVersion + 1 !== op.targetCompletionVersion
      || (task.checklistVersion ?? 0) !== p.expectedChecklistVersion
      || (task.completionVersion ?? 0) !== (op.phase === 'PREPUBLISH' ? p.expectedCompletionVersion : op.targetCompletionVersion)
      || !['pending', 'completed'].includes(task.status) || op.phase === 'PUBLISHED_CLEANUP' && task.status !== 'completed'
      || !Array.isArray(p.previousBindings) || previous.length > 10 || new Set(previous.map(r => r.mediaId)).size !== previous.length
      || previous.some(r => !matches(r.mediaId, ID) || !matches(r.bindingOperationId, UUID))) throw pending();
    const diff = difference(previous, command.completionMediaIds);
    if (!same(diff.additionIds, p.additionIds.map(String)) || !same(diff.removalBindings, bindings(p.removalBindings))) throw pending();
    const expectedBindings = op.phase === 'PREPUBLISH' ? previous : command.completionMediaIds.map(mediaId =>
      previous.find(r => r.mediaId === mediaId) || { mediaId, bindingOperationId: op.remoteOperationId });
    if (!same(bindings(task.completionMediaBindings), expectedBindings)
      || !same((task.completionEvidence?.completionMediaIds || []).map(String), expectedBindings.map(r => r.mediaId))) throw pending();
  } catch (_cause) { throw pending(); }
};

module.exports = { assertIntent, ownerKeys };

const { pending } = require('./growthTaskCompletionCommand');
const FIELD = 'completionMediaIds';
const createGrowthTaskCompletionMediaService = ({ mediaReferenceClient: client } = {}) => {
  if (!client || ['prepare', 'commit', 'abort', 'status', 'unbind'].some(k => typeof client[k] !== 'function')) {
    throw new Error('Completion media client is required');
  }
  const scope = op => ({ familyId: String(op.familyId), childId: String(op.childId), resourceType: 'growth_task', resourceId: String(op.taskId) });
  const command = (op, p) => ({ ...scope(op), remoteOperationId: op.remoteOperationId, commandHash: op.commandHash,
    references: p.additionIds.map(id => ({ mediaId: String(id), field: FIELD })) });
  const inspect = (result, op, command) => {
    const terminal = result?.operation;
    if (!terminal || terminal.operationId !== op.remoteOperationId
      || (terminal.state === 'ABSENT' ? terminal.commandHash !== null : terminal.commandHash !== op.commandHash)
      || !Array.isArray(result.references) || result.references.length !== command.references.length) throw pending();
    const left = new Set(command.references.map(r => r.mediaId));
    for (const ref of Array.from(result.references)) {
      if (!ref || ref.field !== FIELD || !left.delete(ref.mediaId)) throw pending();
    }
    if (left.size) throw pending();
    return terminal;
  };
  const prepareForPublish = async ({ operation: op, intent: p, firstPrepare = false }) => {
    if (!p.additionIds.length) return { kind: 'publish' };
    const c = command(op, p);
    let result = firstPrepare ? await client.prepare(c) : await client.status({ ...c, mode: 'operation' });
    let terminal = inspect(result, op, c);
    if (terminal.state === 'ABSENT' || terminal.state === 'PREPARED' && terminal.leaseExpired === true) {
      result = await client.abort(c); terminal = inspect(result, op, c);
    } else if (terminal.state === 'PREPARED' && terminal.leaseExpired === false) {
      result = await client.commit(c); terminal = inspect(result, op, c);
    }
    if (terminal.state === 'ABORTED') {
      const code = terminal.failureCode;
      if (['MEDIA_OPERATION_ABORTED', 'MEDIA_OPERATION_EXPIRED'].includes(code)) return { kind: 'fail', code, status: 409 };
      if (['RESOURCE_NOT_FOUND', 'CHILD_ACCESS_DENIED', 'MEDIA_PURPOSE_MISMATCH', 'RESOURCE_CONFLICT'].includes(code)) {
        return { kind: 'fail', code: 'RESOURCE_NOT_FOUND', status: 404 };
      }
      throw pending();
    }
    if (terminal.state !== 'COMMITTED') throw pending();
    for (const ref of result.references) {
      if (ref.state === 'bound' && ref.bindingOperationId === op.remoteOperationId) continue;
      const proof = ref.privacyDeletion;
      if (!['released', 'absent'].includes(ref.state) || !proof || proof.mediaId !== ref.mediaId
        || proof.resourceType !== 'growth_task' || proof.resourceId !== String(op.taskId) || proof.field !== FIELD
        || proof.bindingOperationId !== op.remoteOperationId
        || ref.state === 'released' && ref.bindingOperationId !== op.remoteOperationId) throw pending();
    }
    return { kind: 'publish' };
  };
  const cleanup = async ({ operation: op, intent: p }) => {
    if (!p.removalBindings.length) return;
    const c = { ...scope(op), references: p.removalBindings.map(r => ({ mediaId: String(r.mediaId), field: FIELD })) };
    const result = await client.status({ ...c, mode: 'references' });
    if (result?.operation !== null || !Array.isArray(result.references) || result.references.length !== c.references.length) throw pending();
    const expected = new Map(p.removalBindings.map(r => [String(r.mediaId), r.bindingOperationId])), bound = [];
    for (const ref of Array.from(result.references)) {
      if (!ref || ref.field !== FIELD || !expected.has(ref.mediaId)) throw pending();
      const old = expected.get(ref.mediaId); expected.delete(ref.mediaId);
      if (ref.state === 'absent') continue;
      if (ref.bindingOperationId !== old || !['released', 'bound'].includes(ref.state)) throw pending();
      if (ref.state === 'bound') bound.push({ mediaId: ref.mediaId, field: FIELD, bindingOperationId: old });
    }
    if (expected.size) throw pending();
    if (bound.length) {
      const released = await client.unbind({ ...scope(op), remoteOperationId: op.remoteOperationId, references: bound });
      if (released?.operation !== null || !Array.isArray(released.references) || released.references.length !== bound.length) throw pending();
      const remaining = new Map(bound.map(r => [r.mediaId, r.bindingOperationId]));
      for (const ref of Array.from(released.references)) {
        if (!ref || !remaining.has(ref.mediaId) || ref.field !== FIELD || !['released', 'absent'].includes(ref.state)
          || ref.state === 'released' && ref.bindingOperationId !== remaining.get(ref.mediaId)) throw pending();
        remaining.delete(ref.mediaId);
      }
      if (remaining.size) throw pending();
    }
  };
  return { prepareForPublish, cleanup };
};
module.exports = { createGrowthTaskCompletionMediaService };

const { createHash } = require('crypto');

const oid = number => number.toString(16).padStart(24, '0');
const uuid = number => `00000000-0000-4000-8000-${number.toString(16).padStart(12, '0')}`;
const TIMES = Object.freeze({ created: '2026-10-20T00:00:00.000Z', committed: '2026-10-20T00:01:00.000Z',
  deleted: '2026-10-23T00:00:00.000Z', released: '2026-10-23T00:00:00.001Z',
  updated: '2026-10-23T00:00:00.002Z', evidence: '2026-10-23T00:00:00.003Z', lease: '2026-10-24T00:00:00.000Z' });
const referenceHash = references => createHash('sha256').update(JSON.stringify(
  references.map(({ mediaId, field }) => ({ mediaId, field })))).digest('hex');

const makeUnsignedEvidence = (kind = 'committed') => {
  if (!['committed', 'prepared', 'history', 'empty'].includes(kind)) throw new TypeError('Unknown synthetic fixture');
  const familyId = oid(1), childId = oid(2), mediaId = oid(4);
  const scope = { familyId, childId, resourceType: 'growth_task', resourceId: oid(6), field: 'completionMediaIds' };
  const evidence = {
    version: 2, evidenceId: uuid(1), evidenceCreatedAt: TIMES.evidence,
    tombstone: { _id: oid(3), mediaId, familyId, childId, actorId: oid(5), role: 'parent',
      purpose: 'task_completion', reason: 'user_requested', deletedAt: TIMES.deleted },
    uploadIdentity: { mediaId, familyId, childId, storageKey: uuid(2), metadataHash: 'b'.repeat(64) },
    operations: [], referenceEffects: [], receipts: []
  };
  if (kind === 'empty') return evidence;
  const references = [mediaId, oid(7)].map(value => ({ mediaId: value, field: 'completionMediaIds' }));
  const operation = { _id: oid(8), ...scope, operationId: uuid(3), commandHash: 'a'.repeat(64),
    referenceSetHash: referenceHash(references), references, state: 'COMMITTED', version: 1,
    leaseExpiresAt: null, terminalAt: TIMES.committed, failureCode: null,
    createdAt: TIMES.created, updatedAt: TIMES.committed };
  const reference = (value, index) => ({ _id: oid(9 + index), ...scope, mediaId: value, operationId: operation.operationId,
    state: 'bound', leaseExpiresAt: null, releasedAt: null, releaseOperationId: null,
    createdAt: TIMES.created, updatedAt: TIMES.committed });
  if (kind === 'committed') {
    evidence.operations.push({ before: operation, after: { ...operation, version: 2, updatedAt: TIMES.updated } });
    const before = reference(mediaId, 0);
    evidence.referenceEffects.push({ before, after: { ...before, state: 'released', releasedAt: TIMES.released,
      updatedAt: TIMES.updated } });
    evidence.receipts.push({ _id: oid(11), ...scope, mediaId, bindingOperationId: operation.operationId, releasedAt: TIMES.released });
  } else {
    const before = { ...operation, state: 'PREPARED', version: 0, terminalAt: null,
      leaseExpiresAt: TIMES.lease, updatedAt: TIMES.created };
    const after = { ...operation, state: 'ABORTED', terminalAt: TIMES.released,
      failureCode: 'RESOURCE_NOT_FOUND', updatedAt: TIMES.updated };
    if (kind === 'history') {
      after.terminalAt = TIMES.committed; after.updatedAt = TIMES.committed;
      after.failureCode = 'MEDIA_OPERATION_ABORTED';
    }
    evidence.operations.push({ before: kind === 'history' ? null : before, after });
    if (kind === 'prepared') evidence.referenceEffects = references.map((ref, index) => {
      const prior = { ...reference(ref.mediaId, index), state: 'prepared', leaseExpiresAt: TIMES.lease, updatedAt: TIMES.created };
      return { before: prior, after: { ...prior, state: 'released', leaseExpiresAt: null,
        releasedAt: TIMES.released, releaseOperationId: operation.operationId, updatedAt: TIMES.updated } };
    });
  }
  return evidence;
};

module.exports = { makeUnsignedEvidence, referenceHash, oid, uuid, TIMES };

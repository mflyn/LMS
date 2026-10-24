const { createHash } = require('crypto');
const { validateEvidence, serializeEvidence, LIMITS } = require('./userDeletionRecoveryEvidence');

const ID = /^[0-9a-f]{24}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const SCOPE = ['familyId', 'childId', 'resourceType', 'resourceId', 'field', 'operationId'];
const IDENTITY = ['_id', ...SCOPE, 'commandHash', 'referenceSetHash', 'references', 'createdAt'];
const MUTABLE = ['state', 'version', 'leaseExpiresAt', 'terminalAt', 'failureCode', 'updatedAt'];
const invalid = () => { throw Object.assign(Error('USER_DELETION_EVIDENCE_INVALID'), { code: 'USER_DELETION_EVIDENCE_INVALID' }); };
const pending = () => { throw Object.assign(Error('USER_DELETION_DEPENDENCY_PENDING'), { code: 'USER_DELETION_DEPENDENCY_PENDING' }); };
const assert = condition => { if (!condition) invalid(); };
const matches = (pattern, value) => typeof value === 'string' && pattern.exec(value)?.[0] === value;
const own = (value, key) => {
  const descriptor = value && typeof value === 'object' && Object.getOwnPropertyDescriptor(value, key);
  assert(descriptor && descriptor.enumerable && Object.hasOwn(descriptor, 'value'));
  return descriptor.value;
};
const exact = (value, keys) => assert(value && typeof value === 'object' && !Array.isArray(value)
  && Reflect.ownKeys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)));
const timestamp = value => {
  assert(typeof value === 'string' && value.length <= 27);
  const time = new Date(value);
  assert(Number.isFinite(time.getTime()) && time.toISOString() === value);
  return time.getTime();
};
const arrayValues = value => {
  assert(Array.isArray(value) && Reflect.ownKeys(value).length === value.length + 1);
  return Array.from({ length: value.length }, (_, index) => own(value, String(index)));
};
const identity = value => {
  assert(value && typeof value === 'object' && !Array.isArray(value));
  const output = Object.fromEntries(IDENTITY.map(key => [key, own(value, key)]));
  assert(['_id', 'familyId', 'childId', 'resourceId'].every(key => matches(ID, output[key]))
    && matches(UUID, output.operationId) && matches(HASH, output.commandHash) && matches(HASH, output.referenceSetHash)
    && output.resourceType === 'growth_task' && output.field === 'completionMediaIds');
  timestamp(output.createdAt);
  assert(Array.isArray(output.references) && output.references.length <= 10);
  const references = arrayValues(output.references);
  assert(references.length >= 1 && references.length <= 10);
  output.references = references.map(ref => {
    exact(ref, ['mediaId', 'field']);
    const mediaId = own(ref, 'mediaId'), field = own(ref, 'field');
    assert(matches(ID, mediaId) && field === 'completionMediaIds');
    return { mediaId, field };
  });
  assert(output.references.every((ref, index) => index === 0 || output.references[index - 1].mediaId < ref.mediaId));
  const digest = createHash('sha256').update(JSON.stringify(output.references)).digest('hex');
  assert(digest === output.referenceSetHash);
  return output;
};
const sameOperationIdentity = (a, b) => {
  try { return JSON.stringify(identity(a)) === JSON.stringify(identity(b)); } catch (_cause) { return false; }
};
const operation = value => {
  exact(value, [...IDENTITY, ...MUTABLE]);
  const output = { ...identity(value), ...Object.fromEntries(MUTABLE.map(key => [key, own(value, key)])) };
  assert(Number.isSafeInteger(output.version) && output.version >= 0);
  const created = timestamp(output.createdAt), updated = timestamp(output.updatedAt);
  assert(created <= updated);
  if (output.state === 'PREPARED') {
    assert(output.terminalAt === null && output.failureCode === null && timestamp(output.leaseExpiresAt) > created);
  } else {
    assert(['COMMITTED', 'ABORTED'].includes(output.state) && output.leaseExpiresAt === null);
    const terminal = timestamp(output.terminalAt);
    assert(terminal <= updated && (output.state === 'ABORTED' && output.version === 0 || terminal >= created));
    if (output.state === 'COMMITTED') assert(output.version >= 1 && output.failureCode === null);
    else assert(matches(/^[A-Z][A-Z0-9_]{0,79}$/, output.failureCode)
      && (output.failureCode !== 'MEDIA_OPERATION_EXPIRED' || output.version > 0));
  }
  return output;
};
const groupKey = value => JSON.stringify(SCOPE.map(key => value[key]));
const terminalKey = value => JSON.stringify([value.state, value.leaseExpiresAt, value.terminalAt, value.failureCode]);
const snapshotKey = value => JSON.stringify(operation(value));

const proveOperationVersionChain = ({ from, to, proofs } = {}) => {
  // Validate every supplied proof, even unrelated groups and no-op requests.
  const validated = arrayValues(proofs).map(validateEvidence);
  const start = operation(from), end = operation(to);
  assert(sameOperationIdentity(start, end) && terminalKey(start) === terminalKey(end));
  const vertices = new Map(), edges = new Map(), byEvidence = new Map(), byMedia = new Map();
  const register = value => {
    const key = snapshotKey(value), known = vertices.get(value.version);
    assert(known === undefined || known === key);
    vertices.set(value.version, key);
  };
  register(start); register(end);
  for (const proof of validated) {
    const encoded = serializeEvidence(proof), mediaId = proof.tombstone.mediaId;
    assert(!byEvidence.has(proof.evidenceId) || byEvidence.get(proof.evidenceId) === encoded);
    assert(!byMedia.has(mediaId) || byMedia.get(mediaId) === encoded);
    if (byEvidence.has(proof.evidenceId)) continue;
    byEvidence.set(proof.evidenceId, encoded); byMedia.set(mediaId, encoded);
    for (const { before, after } of proof.operations) {
      if (after._id !== start._id && groupKey(after) !== groupKey(start)) continue;
      assert(sameOperationIdentity(start, after) && terminalKey(start) === terminalKey(after));
      register(after);
      if (before === null || after.state !== 'COMMITTED') continue;
      // A historical assertion is not a transition; only complete COMMITTED deletion edges compose.
      assert(before.state === 'COMMITTED' && after.state === 'COMMITTED'
        && sameOperationIdentity(start, before) && terminalKey(start) === terminalKey(before)
        && after.version === before.version + 1);
      register(before);
      assert(!edges.has(before.version));
      edges.set(before.version, { evidenceId: proof.evidenceId, mediaId, before, after });
    }
  }
  if (end.version < start.version) pending();
  if (snapshotKey(start) === snapshotKey(end)) return [];
  assert(start.state === 'COMMITTED' && end.state === 'COMMITTED');
  const result = [];
  let current = start;
  while (current.version < end.version) {
    const edge = edges.get(current.version);
    if (!edge) pending();
    assert(snapshotKey(current) === snapshotKey(edge.before));
    result.push(edge); current = edge.after;
  }
  assert(snapshotKey(current) === snapshotKey(end));
  return result;
};

const createUserDeletionProofCache = ({ journal } = {}) => {
  if (typeof journal?.read !== 'function') throw new TypeError('Read-only proof journal required');
  if (journal.createReadSession !== undefined && typeof journal.createReadSession !== 'function') {
    throw new TypeError('Read session factory must be a function');
  }
  const reader = journal.createReadSession === undefined ? journal : journal.createReadSession();
  if (typeof reader?.read !== 'function') throw new TypeError('Read-only proof session required');
  const entries = new Map(), completed = new Map();
  let totalBytes = 0;
  const read = async mediaId => {
    assert(matches(ID, mediaId));
    if (!entries.has(mediaId)) {
      // Reserve before invoking the reader; concurrent distinct misses count toward the same limit.
      assert(entries.size < LIMITS.MAX_DEPENDENCIES);
      const loading = Promise.resolve().then(() => reader.read(mediaId)).catch(cause => {
        if (cause?.code === 'ENOENT') pending();
        throw cause;
      }).then(value => {
        if (value === null) pending();
        const proof = validateEvidence(value);
        assert(proof.tombstone.mediaId === mediaId);
        const encoded = serializeEvidence(proof), size = Buffer.byteLength(encoded, 'utf8');
        assert(totalBytes + size <= LIMITS.MAX_DEPENDENCY_BYTES);
        // No await between checking and charging the shared byte budget.
        totalBytes += size; completed.set(mediaId, encoded);
        return encoded;
      }).catch(cause => { entries.delete(mediaId); throw cause; });
      entries.set(mediaId, loading);
    }
    return JSON.parse(await entries.get(mediaId));
  };
  const values = () => [...completed.values()].map(encoded => JSON.parse(encoded));
  return { read, values };
};

module.exports = { sameOperationIdentity, proveOperationVersionChain, createUserDeletionProofCache };

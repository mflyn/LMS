const { createHash } = require('crypto');
const { canonicalize } = require('json-canonicalize');

const LIMITS = Object.freeze({ MAX_OPERATIONS: 100, MAX_EFFECTS: 1000, MAX_BYTES: 2 * 1024 * 1024,
  MAX_DEPENDENCIES: 100, MAX_DEPENDENCY_BYTES: 16 * 1024 * 1024 });
const ID = /^[0-9a-f]{24}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const STORAGE_KEY = new RegExp(UUID.source, 'i');
const HASH = /^[0-9a-f]{64}$/;
const CODE = /^[A-Z][A-Z0-9_]{0,79}$/;
const TOP = ['version', 'evidenceId', 'evidenceCreatedAt', 'tombstone', 'uploadIdentity', 'operations', 'referenceEffects', 'receipts'];
const SCOPE = ['familyId', 'childId', 'resourceType', 'resourceId', 'field'];
const OP_IDENTITY = ['_id', ...SCOPE, 'operationId', 'commandHash', 'referenceSetHash', 'references', 'createdAt'];
const OP_KEYS = [...OP_IDENTITY, 'state', 'version', 'leaseExpiresAt', 'terminalAt', 'failureCode', 'updatedAt'];
const REF_IDENTITY = ['_id', ...SCOPE, 'mediaId', 'operationId', 'createdAt'];
const REF_KEYS = [...REF_IDENTITY, 'state', 'leaseExpiresAt', 'releasedAt', 'releaseOperationId', 'updatedAt'];
const RECEIPT_KEYS = ['_id', ...SCOPE, 'mediaId', 'bindingOperationId', 'releasedAt'];
const invalid = () => { throw Object.assign(new Error('USER_DELETION_EVIDENCE_INVALID'), { code: 'USER_DELETION_EVIDENCE_INVALID' }); };
const assert = condition => { if (!condition) invalid(); };
const matches = (pattern, value) => typeof value === 'string' && pattern.exec(value)?.[0] === value;
const exact = (value, keys) => assert(value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)));
const digest = value => createHash('sha256').update(value).digest('hex');
const equal = (a, b) => canonicalize(a) === canonicalize(b);
const same = (a, b, keys) => assert(keys.every(key => equal(a[key], b[key])));
const timestamp = value => {
  assert(typeof value === 'string' && value.length <= 27);
  const date = new Date(value);
  assert(Number.isFinite(date.getTime()) && date.toISOString() === value);
  return date.getTime();
};
const nativePrototype = (proto, constructor) => {
  if (!proto) return false;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'constructor');
  return descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'function'
    && Function.prototype.toString.call(descriptor.value) === Function.prototype.toString.call(constructor)
    && descriptor.value.prototype === proto;
};
const objectPrototype = proto => proto === null
  || Object.getPrototypeOf(proto) === null && nativePrototype(proto, Object);

// Inspect descriptors before copying, so neither getters nor JSON hooks execute.
// The budget bounds even malformed inputs before canonical encoding allocates a string.
const detach = value => {
  const active = new WeakSet(); let budget = LIMITS.MAX_BYTES;
  const spend = size => { budget -= size; assert(budget >= 0); };
  const copy = (input, depth) => {
    assert(depth <= 12);
    if (input === null || typeof input === 'boolean') { spend(input === false ? 5 : 4); return input; }
    if (typeof input === 'string') { spend(Buffer.byteLength(JSON.stringify(input), 'utf8')); return input; }
    if (typeof input === 'number') { assert(Number.isFinite(input)); spend(String(input).length); return input; }
    assert(input && typeof input === 'object' && !active.has(input));
    const array = Array.isArray(input), proto = Object.getPrototypeOf(input);
    assert(array ? nativePrototype(proto, Array) && objectPrototype(Object.getPrototypeOf(proto)) : objectPrototype(proto));
    active.add(input);
    const keys = Reflect.ownKeys(input), output = array ? [] : Object.create(null);
    if (array) {
      assert(input.length <= LIMITS.MAX_EFFECTS && keys.length === input.length + 1);
      assert(keys.every(key => key === 'length' || typeof key === 'string' && /^(0|[1-9][0-9]*)$/.test(key)
        && Number(key) < input.length));
    }
    const members = keys.length - (array ? 1 : 0);
    spend(2 + Math.max(0, members - 1));
    for (const key of keys) {
      if (array && key === 'length') continue;
      assert(typeof key === 'string');
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      assert(descriptor && descriptor.enumerable && Object.hasOwn(descriptor, 'value'));
      spend(array ? 0 : Buffer.byteLength(JSON.stringify(key), 'utf8') + 1);
      output[key] = copy(descriptor.value, depth + 1);
    }
    active.delete(input); return output;
  };
  return copy(value, 0);
};
const ordered = (values, max, identify) => {
  assert(Array.isArray(values) && values.length <= max);
  let previous;
  for (const value of values) {
    const key = identify(value); assert(matches(ID, key) && (previous === undefined || previous < key)); previous = key;
  }
};
const scopeKey = value => JSON.stringify(SCOPE.map(key => value[key]));
const operationKey = value => JSON.stringify([scopeKey(value), value.operationId]);
const slotKey = value => JSON.stringify([scopeKey(value), value.mediaId]);
const scope = (value, tombstone) => {
  assert(['_id', 'familyId', 'childId', 'resourceId'].every(key => matches(ID, value[key])));
  assert(value.familyId === tombstone.familyId && value.childId === tombstone.childId
    && value.resourceType === 'growth_task' && value.field === 'completionMediaIds');
};
const operation = (value, tombstone, createdAt, terminalOnly) => {
  exact(value, OP_KEYS); scope(value, tombstone);
  assert(matches(UUID, value.operationId) && matches(HASH, value.commandHash) && matches(HASH, value.referenceSetHash));
  ordered(value.references, 10, ref => ref?.mediaId); assert(value.references.length > 0);
  for (const ref of value.references) { exact(ref, ['mediaId', 'field']); assert(ref.field === 'completionMediaIds'); }
  assert(value.references.some(ref => ref.mediaId === tombstone.mediaId));
  // This hash is the existing operation wire protocol, not the v2 evidence encoding.
  assert(digest(JSON.stringify(value.references.map(ref => ({ mediaId: ref.mediaId, field: ref.field })))) === value.referenceSetHash);
  assert(Number.isSafeInteger(value.version) && value.version >= 0);
  const start = timestamp(value.createdAt), updated = timestamp(value.updatedAt);
  assert(start <= updated && updated <= createdAt);
  if (value.state === 'PREPARED') {
    assert(!terminalOnly && value.terminalAt === null && value.failureCode === null && timestamp(value.leaseExpiresAt) > start);
  } else {
    assert(['COMMITTED', 'ABORTED'].includes(value.state) && value.leaseExpiresAt === null);
    const terminal = timestamp(value.terminalAt);
    // A never-prepared failure samples terminalAt before Mongoose inserts its timestamps.
    assert((value.state === 'ABORTED' && value.version === 0 || start <= terminal) && terminal <= updated);
    if (value.state === 'COMMITTED') assert(value.version >= 1 && value.failureCode === null);
    else assert(matches(CODE, value.failureCode) && (value.failureCode !== 'MEDIA_OPERATION_EXPIRED' || value.version > 0));
  }
};
const reference = (value, tombstone, createdAt) => {
  exact(value, REF_KEYS); scope(value, tombstone);
  assert(matches(ID, value.mediaId) && matches(UUID, value.operationId));
  const start = timestamp(value.createdAt), updated = timestamp(value.updatedAt);
  assert(start <= updated && updated <= createdAt);
  if (value.state === 'prepared') {
    assert(timestamp(value.leaseExpiresAt) > start && value.releasedAt === null && value.releaseOperationId === null);
  } else if (value.state === 'bound') {
    assert(value.leaseExpiresAt === null && value.releasedAt === null && value.releaseOperationId === null);
  } else {
    assert(value.state === 'released' && value.leaseExpiresAt === null
      && (value.releaseOperationId === null || matches(UUID, value.releaseOperationId)));
    const released = timestamp(value.releasedAt); assert(start <= released && released <= updated);
  }
};

const validateStructure = (proof, sealed) => {
  exact(proof, sealed ? [...TOP, 'evidenceHash'] : TOP);
  assert(proof.version === 2 && matches(UUID, proof.evidenceId));
  if (sealed) assert(matches(HASH, proof.evidenceHash));
  const created = timestamp(proof.evidenceCreatedAt), tomb = proof.tombstone;
  exact(tomb, ['_id', 'mediaId', 'familyId', 'childId', 'actorId', 'role', 'purpose', 'reason', 'deletedAt']);
  assert(['_id', 'mediaId', 'familyId', 'childId', 'actorId'].every(key => matches(ID, tomb[key])));
  assert(['parent', 'student'].includes(tomb.role) && (tomb.role !== 'student' || tomb.actorId === tomb.childId)
    && tomb.purpose === 'task_completion' && tomb.reason === 'user_requested');
  const deleted = timestamp(tomb.deletedAt); assert(deleted <= created);
  exact(proof.uploadIdentity, ['mediaId', 'familyId', 'childId', 'storageKey', 'metadataHash']);
  same(proof.uploadIdentity, tomb, ['mediaId', 'familyId', 'childId']);
  assert(matches(STORAGE_KEY, proof.uploadIdentity.storageKey) && matches(HASH, proof.uploadIdentity.metadataHash));
  ordered(proof.operations, LIMITS.MAX_OPERATIONS, item => item?.after?._id);
  ordered(proof.referenceEffects, LIMITS.MAX_EFFECTS, item => item?.after?._id);
  ordered(proof.receipts, LIMITS.MAX_OPERATIONS, item => item?._id);
  const groups = new Map(), effects = new Map(), receipts = new Map(), slots = new Set();
  for (const pair of proof.operations) {
    exact(pair, ['before', 'after']); operation(pair.after, tomb, created, true);
    const { before, after } = pair, key = operationKey(after);
    assert(!groups.has(key)); groups.set(key, pair); effects.set(key, []);
    if (before === null) {
      if (after.version > 0) assert(timestamp(after.terminalAt) <= deleted && timestamp(after.updatedAt) <= deleted);
      else if (timestamp(after.terminalAt) > deleted || timestamp(after.updatedAt) > deleted) {
        assert(['RESOURCE_NOT_FOUND', 'MEDIA_OPERATION_ABORTED'].includes(after.failureCode));
      }
      continue;
    }
    operation(before, tomb, created, false); same(before, after, OP_IDENTITY);
    assert(after.version === before.version + 1 && timestamp(before.updatedAt) <= deleted
      && timestamp(after.updatedAt) >= deleted && timestamp(after.updatedAt) >= timestamp(before.updatedAt));
    if (before.state === 'PREPARED') {
      assert(after.state === 'ABORTED' && timestamp(after.terminalAt) >= deleted);
      const expired = timestamp(after.terminalAt) >= timestamp(before.leaseExpiresAt);
      assert(expired ? after.failureCode === 'MEDIA_OPERATION_EXPIRED'
        : ['RESOURCE_NOT_FOUND', 'MEDIA_OPERATION_ABORTED'].includes(after.failureCode));
    } else {
      assert(before.state === 'COMMITTED' && after.state === 'COMMITTED');
      same(before, after, ['terminalAt', 'failureCode', 'leaseExpiresAt']);
    }
  }
  for (const pair of proof.referenceEffects) {
    exact(pair, ['before', 'after']); const { before, after } = pair;
    reference(before, tomb, created); reference(after, tomb, created); same(before, after, REF_IDENTITY);
    assert(after.state === 'released' && timestamp(before.updatedAt) <= deleted
      && timestamp(after.updatedAt) >= timestamp(before.updatedAt) && timestamp(after.releasedAt) >= deleted);
    const key = operationKey(after), group = groups.get(key), slot = slotKey(after);
    assert(group?.before && !slots.has(slot) && group.after.references.some(ref => ref.mediaId === after.mediaId));
    slots.add(slot); effects.get(key).push(pair);
    if (group.before.state === 'PREPARED') {
      assert(before.state === 'prepared' && before.leaseExpiresAt === group.before.leaseExpiresAt
        && timestamp(before.updatedAt) >= timestamp(group.before.createdAt)
        && after.releaseOperationId === group.after.operationId && after.releasedAt === group.after.terminalAt);
    } else {
      assert(before.state === 'bound' && after.mediaId === tomb.mediaId && after.releaseOperationId === null
        && timestamp(before.updatedAt) >= timestamp(group.before.terminalAt));
    }
  }
  for (const receipt of proof.receipts) {
    exact(receipt, RECEIPT_KEYS); scope(receipt, tomb);
    assert(receipt.mediaId === tomb.mediaId && matches(UUID, receipt.bindingOperationId));
    assert(timestamp(receipt.releasedAt) >= deleted && timestamp(receipt.releasedAt) <= created);
    const key = operationKey({ ...receipt, operationId: receipt.bindingOperationId }), group = groups.get(key);
    assert(group?.before?.state === 'COMMITTED' && !receipts.has(key)); receipts.set(key, receipt);
    const changes = effects.get(key);
    assert(changes.length === 1 && changes[0].after.mediaId === tomb.mediaId && changes[0].after.releasedAt === receipt.releasedAt);
  }
  for (const [key, group] of groups) {
    const changes = effects.get(key);
    if (group.before === null) { assert(changes.length === 0 && !receipts.has(key)); continue; }
    if (group.before.state === 'PREPARED') {
      assert(changes.length === group.after.references.length && !receipts.has(key));
      const mediaIds = new Set(changes.map(change => change.after.mediaId));
      assert(group.after.references.every(ref => mediaIds.has(ref.mediaId)));
    } else assert(changes.length === 1 && receipts.has(key));
  }
};

const processEvidence = (value, sealed) => {
  const proof = detach(value); validateStructure(proof, sealed);
  const { evidenceHash, ...unsigned } = proof, computed = digest(canonicalize(unsigned));
  if (sealed) assert(evidenceHash === computed);
  else proof.evidenceHash = computed;
  const encoded = canonicalize(proof) + '\n';
  assert(Buffer.byteLength(encoded, 'utf8') <= LIMITS.MAX_BYTES);
  return { proof: JSON.parse(encoded), encoded };
};
const validateEvidence = value => processEvidence(value, true).proof;
const sealEvidence = value => processEvidence(value, false).proof;
const serializeEvidence = value => processEvidence(value, true).encoded;
const validateAndSerializeEvidence = value => processEvidence(value, true);

module.exports = { validateEvidence, sealEvidence, serializeEvidence, validateAndSerializeEvidence, LIMITS };

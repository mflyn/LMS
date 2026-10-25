const { createHash } = require('crypto');
const { canonicalize } = require('json-canonicalize');
const { execFileSync } = require('child_process');
const fs = require('fs');
const vm = require('vm');
const { makeUnsignedEvidence, referenceHash, oid, uuid, TIMES } = require('./fixtures/userDeletionRecoveryEvidence');
const { validateEvidence, sealEvidence, serializeEvidence, LIMITS } = require('../services/userDeletionRecoveryEvidence');

const hash = value => createHash('sha256').update(canonicalize(value)).digest('hex');
const sign = unsigned => ({ ...unsigned, evidenceHash: hash(unsigned) });
const invalid = value => {
  expect(() => sealEvidence(value)).toThrow();
  // A fresh digest must not disguise an invalid semantic proof.
  expect(() => validateEvidence(sign(value))).toThrow();
};

test.each(['empty', 'committed', 'prepared', 'history'])('valid %s proof seals, verifies, detaches and serializes canonically', kind => {
  const input = makeUnsignedEvidence(kind), before = structuredClone(input);
  const sealed = sealEvidence(input), output = validateEvidence(sealed);
  expect(sealed).toEqual(sign(input)); expect(output).toEqual(sealed);
  expect(serializeEvidence(output)).toBe(canonicalize(sign(input)) + '\n');
  expect(input).toEqual(before); expect(output).not.toBe(sealed);
  output.tombstone.actorId = oid(99);
  expect(sealed.tombstone.actorId).toBe(oid(5));
  input.uploadIdentity.metadataHash = 'c'.repeat(64);
  expect(sealed.uploadIdentity.metadataHash).toBe('b'.repeat(64));
});
test('unbound evidence can be created at the exact first deletion timestamp', () => {
  const input = makeUnsignedEvidence('empty'); input.evidenceCreatedAt = input.tombstone.deletedAt;
  expect(validateEvidence(sign(input))).toEqual(sign(input));
});
test.each(['committed', 'prepared'])('reused %s slots retain an older row createdAt than their current operation', kind => {
  const input = makeUnsignedEvidence(kind);
  for (const effect of input.referenceEffects) {
    effect.before.createdAt = effect.after.createdAt = '2026-10-01T00:00:00.000Z';
  }
  expect(validateEvidence(sign(input))).toEqual(sign(input));
});
test('a reused prepared row must have been updated no earlier than its current operation creation', () => {
  const input = makeUnsignedEvidence('prepared');
  const effect = input.referenceEffects[0];
  effect.before.createdAt = effect.after.createdAt = '2026-10-01T00:00:00.000Z';
  effect.before.updatedAt = '2026-10-19T00:00:00.000Z';
  invalid(input);
});
test('prepared row updatedAt may equal current operation creation while its original createdAt stays older', () => {
  const input = makeUnsignedEvidence('prepared');
  for (const effect of input.referenceEffects) {
    effect.before.createdAt = effect.after.createdAt = '2026-10-01T00:00:00.000Z';
    effect.before.updatedAt = input.operations[0].before.createdAt;
  }
  expect(validateEvidence(sign(input))).toEqual(sign(input));
});
test('plain cross-realm JSON objects and arrays remain valid detached evidence', () => {
  const input = require('vm').runInNewContext(`JSON.parse(${JSON.stringify(JSON.stringify(makeUnsignedEvidence()))})`);
  expect(validateEvidence(sign(input))).toEqual(sign(makeUnsignedEvidence()));
});
test.each(['id', 'uuid', 'hash', 'code'])('trailing carriage return in %s is not canonical', kind => {
  const input = makeUnsignedEvidence('history');
  if (kind === 'id') input.tombstone._id += '\r';
  if (kind === 'uuid') input.evidenceId += '\r';
  if (kind === 'hash') input.uploadIdentity.metadataHash += '\r';
  if (kind === 'code') input.operations[0].after.failureCode += '\r';
  invalid(input);
});
test('a bound reference cannot have last updated before the operation committed', () => {
  const input = makeUnsignedEvidence(); input.referenceEffects[0].before.updatedAt = TIMES.created;
  invalid(input);
});
test('student first audit identifies the same child and uppercase storage UUID preserves its exact identity', () => {
  const input = makeUnsignedEvidence('empty'); input.tombstone.role = 'student';
  input.tombstone.actorId = input.tombstone.childId;
  input.uploadIdentity.storageKey = 'ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF';
  expect(sealEvidence(input).uploadIdentity.storageKey).toBe(input.uploadIdentity.storageKey);
});
test('object insertion order is irrelevant but array order is part of the contract', () => {
  const input = makeUnsignedEvidence();
  const reverse = value => Array.isArray(value) ? value.map(reverse) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverse(v)])) : value;
  expect(serializeEvidence(sealEvidence(reverse(input)))).toBe(serializeEvidence(sealEvidence(input)));
});
test('referenceSetHash retains the existing mediaId/field wire encoding, not JCS', () => {
  const input = makeUnsignedEvidence();
  expect(referenceHash(input.operations[0].after.references)).not.toBe(hash(input.operations[0].after.references));
  for (const op of [input.operations[0].before, input.operations[0].after]) op.referenceSetHash = hash(op.references);
  invalid(input);
});
test('digest mismatch, unsigned verification and already-signed sealing are rejected', () => {
  const input = makeUnsignedEvidence(); const sealed = sealEvidence(input);
  expect(() => validateEvidence(input)).toThrow(); expect(() => sealEvidence(sealed)).toThrow();
  sealed.uploadIdentity.metadataHash = 'c'.repeat(64);
  expect(() => validateEvidence(sealed)).toThrow(); expect(() => serializeEvidence(sealed)).toThrow();
});

test.each([
  ['unknown version', e => { e.version = 1; }],
  ['unknown field', e => { e.learningContent = 'forbidden'; }],
  ['unknown nested field', e => { e.uploadIdentity.filename = 'forbidden'; }],
  ['uppercase object id', e => { e.tombstone._id = 'ABCDEFABCDEFABCDEFABCDEFAB'; }],
  ['invalid uuid', e => { e.evidenceId = oid(1); }],
  ['noncanonical date', e => { e.tombstone.deletedAt = '2026-10-23T00:00:00Z'; }],
  ['impossible date', e => { e.evidenceCreatedAt = '2026-02-30T00:00:00.000Z'; }],
  ['audit after evidence', e => { e.tombstone.deletedAt = TIMES.lease; }],
  ['system audit', e => { e.tombstone.reason = 'orphan_retention'; }],
  ['student impersonation', e => { e.tombstone.role = 'student'; }],
  ['wrong purpose', e => { e.tombstone.purpose = 'avatar'; }],
  ['upload scope', e => { e.uploadIdentity.childId = oid(99); }],
  ['bad metadata digest', e => { e.uploadIdentity.metadataHash = 'B'.repeat(64); }],
  ['operation scope', e => { e.operations[0].after.familyId = oid(99); }],
  ['operation identity change', e => { e.operations[0].after._id = oid(99); }],
  ['command digest change', e => { e.operations[0].after.commandHash = 'c'.repeat(64); }],
  ['set digest mismatch', e => { e.operations[0].after.referenceSetHash = 'c'.repeat(64); }],
  ['unsorted complete set', e => { e.operations[0].after.references.reverse(); }],
  ['duplicate set member', e => { e.operations[0].after.references[1] = e.operations[0].after.references[0]; }],
  ['target omitted', e => { for (const op of [e.operations[0].before, e.operations[0].after]) {
    op.references = [{ mediaId: oid(7), field: 'completionMediaIds' }]; op.referenceSetHash = referenceHash(op.references);
  } }],
  ['terminal lease', e => { e.operations[0].after.leaseExpiresAt = TIMES.lease; }],
  ['committed failure', e => { e.operations[0].after.failureCode = 'RESOURCE_NOT_FOUND'; }],
  ['terminal before creation', e => { e.operations[0].after.terminalAt = '2020-01-01T00:00:00.000Z'; }],
  ['updated before terminal', e => { e.operations[0].after.updatedAt = TIMES.created; }],
  ['future update', e => { e.operations[0].after.updatedAt = TIMES.lease; }],
  ['unsafe version', e => { e.operations[0].after.version = Number.MAX_SAFE_INTEGER + 1; }],
  ['skipped version', e => { e.operations[0].after.version += 1; }],
  ['committed terminal rewrite', e => { e.operations[0].after.terminalAt = TIMES.deleted; }],
  ['missing receipt', e => { e.receipts = []; }],
  ['wrong receipt binding', e => { e.receipts[0].bindingOperationId = uuid(99); }],
  ['wrong receipt media', e => { e.receipts[0].mediaId = oid(7); }],
  ['receipt time mismatch', e => { e.receipts[0].releasedAt = TIMES.updated; }],
  ['missing target effect', e => { e.referenceEffects = []; }],
  ['changed reference id', e => { e.referenceEffects[0].after._id = oid(99); }],
  ['wrong reference generation', e => { e.referenceEffects[0].after.operationId = uuid(99); }],
  ['privacy release has unbind id', e => { e.referenceEffects[0].after.releaseOperationId = uuid(99); }],
  ['already unbound is not privacy change', e => { Object.assign(e.referenceEffects[0].before,
    { state: 'released', releasedAt: TIMES.committed, releaseOperationId: uuid(99) }); }],
  ['duplicate operation', e => { e.operations.push(structuredClone(e.operations[0])); }],
  ['duplicate effect', e => { e.referenceEffects.push(structuredClone(e.referenceEffects[0])); }],
  ['duplicate receipt', e => { e.receipts.push(structuredClone(e.receipts[0])); }]
])('%s is rejected even with a recomputed evidenceHash', (_name, mutate) => {
  const input = makeUnsignedEvidence(); mutate(input); invalid(input);
});

test.each([
  ['missing group member', e => { e.referenceEffects.pop(); }],
  ['extra group member', e => { const effect = structuredClone(e.referenceEffects[1]);
    effect.before._id = effect.after._id = oid(90); effect.before.mediaId = effect.after.mediaId = oid(91);
    e.referenceEffects.push(effect); }],
  ['wrong original lease', e => { e.referenceEffects[1].before.leaseExpiresAt = TIMES.updated; }],
  ['wrong group release id', e => { e.referenceEffects[1].after.releaseOperationId = uuid(90); }],
  ['wrong group release time', e => { e.referenceEffects[1].after.releasedAt = TIMES.updated; }],
  ['expired too soon', e => { e.operations[0].after.failureCode = 'MEDIA_OPERATION_EXPIRED'; }],
  ['nonexpired at lease boundary', e => { e.operations[0].before.leaseExpiresAt = TIMES.released;
    e.referenceEffects.forEach(x => { x.before.leaseExpiresAt = TIMES.released; }); }],
  ['lease before creation', e => { e.operations[0].before.leaseExpiresAt = TIMES.created; }],
  ['prepared after snapshot', e => { e.operations[0].after.state = 'PREPARED'; }],
  ['privacy abort cannot commit', e => { e.operations[0].after.state = 'COMMITTED'; e.operations[0].after.failureCode = null; }],
  ['unexplained effects without before', e => { e.operations[0].before = null; }],
  ['aborted receipt', e => { e.receipts = makeUnsignedEvidence().receipts; }]
])('PREPARED: %s rejected', (_name, mutate) => {
  const input = makeUnsignedEvidence('prepared'); mutate(input); invalid(input);
});
test('expired PREPARED abort preserves its exact lease boundary and full group effects', () => {
  const input = makeUnsignedEvidence('prepared'); input.operations[0].before.leaseExpiresAt = TIMES.released;
  input.referenceEffects.forEach(effect => { effect.before.leaseExpiresAt = TIMES.released; });
  input.operations[0].after.failureCode = 'MEDIA_OPERATION_EXPIRED';
  expect(validateEvidence(sign(input))).toEqual(sign(input));
});
test('unchanged historical terminal cannot occur after the first deletion', () => {
  const input = makeUnsignedEvidence('history');
  input.operations[0].after.terminalAt = TIMES.released; input.operations[0].after.updatedAt = TIMES.updated;
  invalid(input);
});
const versionZeroHistory = (failureCode, timing) => {
  const input = makeUnsignedEvidence('history'), after = input.operations[0].after;
  after.version = 0; after.failureCode = failureCode;
  if (timing === 'terminal_late') { after.terminalAt = TIMES.released; after.updatedAt = TIMES.updated; }
  if (timing === 'updated_late') after.updatedAt = TIMES.updated;
  if (timing === 'boundary') after.terminalAt = after.updatedAt = TIMES.deleted;
  return input;
};
test.each(['terminal_late', 'updated_late'])('late version-zero RESOURCE_CONFLICT with %s cannot enter frozen history', timing => {
  invalid(versionZeroHistory('RESOURCE_CONFLICT', timing));
});
test.each([
  ['RESOURCE_NOT_FOUND', 'terminal_late'], ['RESOURCE_NOT_FOUND', 'updated_late'],
  ['MEDIA_OPERATION_ABORTED', 'terminal_late'], ['MEDIA_OPERATION_ABORTED', 'updated_late'],
  ['RESOURCE_CONFLICT', 'earlier'], ['RESOURCE_CONFLICT', 'boundary']
])('version-zero %s at %s remains admissible without claiming database reference absence', (code, timing) => {
  const input = versionZeroHistory(code, timing);
  expect(validateEvidence(sign(input))).toEqual(sign(input));
});
test('historical COMMITTED without a target effect cannot manufacture a privacy receipt', () => {
  const input = makeUnsignedEvidence(); input.operations[0].before = null;
  input.operations[0].after.updatedAt = TIMES.committed; input.referenceEffects = [];
  invalid(input);
});

test('version-zero failure preserves terminal sampling before database insert timestamps', () => {
  const input = versionZeroHistory('MEDIA_OPERATION_ABORTED', 'earlier');
  const after = input.operations[0].after;
  after.createdAt = after.updatedAt;
  after.terminalAt = new Date(Date.parse(after.createdAt) - 5).toISOString();
  expect(validateEvidence(sign(input))).toEqual(sign(input));
  after.terminalAt = new Date(Date.parse(after.updatedAt) + 1).toISOString();
  invalid(input);
});

test.each(['getter', 'array_getter', 'sparse', 'symbol', 'hidden', 'array_extra', 'prototype', 'undefined', 'date', 'cycle', 'bigint', 'nan'])
('rejects non-JSON/descriptor shape %s without invoking accessors', kind => {
  const input = makeUnsignedEvidence(); let calls = 0;
  const getter = () => { calls += 1; throw Error('must not execute'); };
  if (kind === 'getter') Object.defineProperty(input.tombstone, 'actorId', { get: getter, enumerable: true });
  if (kind === 'array_getter') Object.defineProperty(input.operations, '0', { get: getter, enumerable: true });
  if (kind === 'sparse') delete input.operations[0];
  if (kind === 'symbol') input[Symbol('hidden')] = 1;
  if (kind === 'hidden') Object.defineProperty(input, 'hidden', { value: 1 });
  if (kind === 'array_extra') input.operations.extra = true;
  if (kind === 'prototype') Object.setPrototypeOf(input.tombstone, { inherited: true });
  if (kind === 'undefined') input.tombstone.actorId = undefined;
  if (kind === 'date') input.evidenceCreatedAt = new Date(TIMES.evidence);
  if (kind === 'cycle') input.operations.push(input);
  if (kind === 'bigint') input.version = 2n;
  if (kind === 'nan') input.operations[0].after.version = NaN;
  expect(() => sealEvidence(input)).toThrow(); expect(calls).toBe(0);
});
test('a forged prototype constructor cannot execute a prototype accessor during shape inspection', () => {
  const input = makeUnsignedEvidence('empty'), fake = () => {}; let calls = 0;
  Object.defineProperty(fake, 'prototype', { get() { calls += 1; throw Error('must not execute'); } });
  const proto = Object.create(null); Object.defineProperty(proto, 'constructor', { value: fake });
  Object.setPrototypeOf(input.tombstone, proto);
  expect(() => sealEvidence(input)).toThrow(); expect(calls).toBe(0);
});

const capacityFixture = count => {
  const input = makeUnsignedEvidence('empty');
  for (let i = 0; i < count; i += 1) {
    const group = makeUnsignedEvidence('prepared'), operation = group.operations[0];
    const refs = Array.from({ length: 10 }, (_, j) => ({ mediaId: j ? oid(100 + j) : input.tombstone.mediaId,
      field: 'completionMediaIds' }));
    for (const op of [operation.before, operation.after]) {
      op._id = oid(1000 + i); op.resourceId = oid(2000 + i); op.operationId = uuid(1000 + i);
      op.references = refs; op.referenceSetHash = referenceHash(refs);
    }
    input.operations.push(operation);
    for (let j = 0; j < 10; j += 1) {
      const effect = structuredClone(group.referenceEffects[0]);
      for (const ref of [effect.before, effect.after]) {
        ref._id = oid(10000 + i * 10 + j); ref.mediaId = refs[j].mediaId;
        ref.resourceId = operation.after.resourceId; ref.operationId = operation.after.operationId;
      }
      effect.after.releaseOperationId = operation.after.operationId; input.referenceEffects.push(effect);
    }
  }
  return input;
};
test('the approved 100-group/1000-effect boundary is accepted without truncating history', () => {
  const sealed = sealEvidence(capacityFixture(100));
  expect(sealed.operations).toHaveLength(100); expect(sealed.referenceEffects).toHaveLength(1000);
  expect(Buffer.byteLength(serializeEvidence(sealed), 'utf8')).toBeLessThanOrEqual(2 * 1024 * 1024);
  expect(LIMITS).toEqual({ MAX_OPERATIONS: 100, MAX_EFFECTS: 1000, MAX_BYTES: 2 * 1024 * 1024,
    MAX_DEPENDENCIES: 100, MAX_DEPENDENCY_BYTES: 16 * 1024 * 1024 });
  expect(Object.isFrozen(LIMITS)).toBe(true);
});
test('capacity overflow never silently truncates operations or effects', () => {
  expect(() => sealEvidence(capacityFixture(101))).toThrow();
  const effects = capacityFixture(100); effects.referenceEffects.push(structuredClone(effects.referenceEffects[0]));
  expect(() => sealEvidence(effects)).toThrow();
});

// Mutations exist only in isolated VM copies; no production parameter or file edit.
const byteLimitModule = (maxBytes, mutation = 'none') => {
  const filename = require.resolve('../services/userDeletionRecoveryEvidence');
  let source = fs.readFileSync(filename, 'utf8'), canonicalCalls = 0;
  const replaceOnce = (from, to) => {
    expect(source.split(from)).toHaveLength(2); source = source.replace(from, to);
  };
  replaceOnce('MAX_BYTES: 2 * 1024 * 1024', `MAX_BYTES: ${maxBytes}`);
  if (['budget', 'both'].includes(mutation)) replaceOnce('assert(budget >= 0);', 'void budget;');
  if (['final', 'both'].includes(mutation)) replaceOnce("assert(Buffer.byteLength(encoded, 'utf8') <= LIMITS.MAX_BYTES);", '');
  const module = { exports: {} };
  vm.runInNewContext(source, { module, Buffer, require(name) {
    if (name === 'crypto') return require('crypto');
    if (name === 'json-canonicalize') return { canonicalize(value) { canonicalCalls += 1; return canonicalize(value); } };
    throw Error('Unexpected isolated module dependency');
  } }, { filename });
  return { api: module.exports, canonicalCalls: () => canonicalCalls };
};
test.each(['empty', 'committed', 'prepared', 'history'])('legal %s bytes include the newline at exact len and reject len-minus-one', kind => {
  const unsigned = makeUnsignedEvidence(kind), signed = sign(unsigned), encoded = canonicalize(signed) + '\n';
  const len = Buffer.byteLength(encoded, 'utf8');
  const exact = byteLimitModule(len).api, short = byteLimitModule(len - 1).api;
  expect(exact.sealEvidence(unsigned)).toEqual(signed);
  expect(exact.validateEvidence(signed)).toEqual(signed);
  expect(exact.serializeEvidence(signed)).toBe(encoded);
  expect(() => short.sealEvidence(unsigned)).toThrow('USER_DELETION_EVIDENCE_INVALID');
  expect(() => short.validateEvidence(signed)).toThrow('USER_DELETION_EVIDENCE_INVALID');
  expect(() => short.serializeEvidence(signed)).toThrow('USER_DELETION_EVIDENCE_INVALID');
});
test.each([
  ['none', true, true], ['budget', false, true], ['final', true, false], ['both', false, false]
])('byte guard mutation %s exposes its distinct early-budget/final-limit contract', (mutation, earlyGuard, finalGuard) => {
  const unsigned = makeUnsignedEvidence(), signed = sign(unsigned);
  const len = Buffer.byteLength(canonicalize(signed) + '\n', 'utf8');
  const early = byteLimitModule(len - 2, mutation);
  let earlyError;
  try { early.api.validateEvidence(signed); } catch (error) { earlyError = error; }
  const stoppedBeforeCanonical = earlyError?.code === 'USER_DELETION_EVIDENCE_INVALID' && early.canonicalCalls() === 0;
  expect(stoppedBeforeCanonical).toBe(earlyGuard);
  const final = byteLimitModule(len - 1, mutation);
  if (finalGuard) expect(() => final.api.sealEvidence(unsigned)).toThrow('USER_DELETION_EVIDENCE_INVALID');
  else {
    // The mutated implementation now admits an otherwise legal oversized proof.
    expect(final.api.sealEvidence(unsigned)).toEqual(signed);
    expect(Buffer.byteLength(final.api.serializeEvidence(signed), 'utf8')).toBe(len);
    expect(len).toBeGreaterThan(final.api.LIMITS.MAX_BYTES);
  }
});
test('cold import and validation never load models, mongoose, filesystem or service writers', () => {
  const target = require.resolve('../services/userDeletionRecoveryEvidence');
  const fixture = require.resolve('./fixtures/userDeletionRecoveryEvidence');
  const script = `const Module=require('module'),old=Module._load;
    const allowed=new Set(${JSON.stringify([target, fixture, 'crypto', 'json-canonicalize'])});
    Module._load=function(name,...args){if(!allowed.has(name))throw Error('forbidden import');return old.call(this,name,...args)};
    const api=require(${JSON.stringify(target)}), f=require(${JSON.stringify(fixture)});
    console.log(api.validateEvidence(api.sealEvidence(f.makeUnsignedEvidence('empty'))).version);`;
  expect(execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }).trim()).toBe('2');
});

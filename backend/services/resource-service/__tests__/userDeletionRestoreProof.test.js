const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { execFileSync } = require('child_process');
const { createHash } = require('crypto');
const { canonicalize } = require('json-canonicalize');
const codec = require('../services/userDeletionRecoveryEvidence');
const { makeUnsignedEvidence, oid, uuid, TIMES, referenceHash } = require('./fixtures/userDeletionRecoveryEvidence');
const { sameOperationIdentity, proveOperationVersionChain, createUserDeletionProofCache } = require('../services/userDeletionRestoreProof');
const modulePath = require.resolve('../services/userDeletionRestoreProof');
const INVALID = 'USER_DELETION_EVIDENCE_INVALID', PENDING = 'USER_DELETION_DEPENDENCY_PENDING';
const clone = value => JSON.parse(JSON.stringify(value));
const resign = unsigned => {
  const value = clone(unsigned); delete value.evidenceHash;
  return { ...value, evidenceHash: createHash('sha256').update(canonicalize(value)).digest('hex') };
};
const empty = number => {
  const value = makeUnsignedEvidence('empty');
  value.evidenceId = uuid(number); value.tombstone.mediaId = oid(number); value.uploadIdentity.mediaId = oid(number);
  return codec.sealEvidence(value);
};
const fixture = () => {
  const first = codec.sealEvidence(makeUnsignedEvidence('committed'));
  const second = makeUnsignedEvidence('committed');
  second.evidenceId = uuid(2); second.tombstone._id = oid(13); second.tombstone.mediaId = oid(7);
  second.uploadIdentity.mediaId = oid(7); second.tombstone.deletedAt = '2026-10-23T00:00:01.000Z';
  second.evidenceCreatedAt = '2026-10-23T00:00:01.003Z';
  second.operations[0].before = clone(first.operations[0].after);
  second.operations[0].after = { ...clone(second.operations[0].before), version: 3, updatedAt: '2026-10-23T00:00:01.002Z' };
  for (const row of [second.referenceEffects[0].before, second.referenceEffects[0].after]) {
    row._id = oid(10); row.mediaId = oid(7);
  }
  second.referenceEffects[0].after.releasedAt = '2026-10-23T00:00:01.001Z';
  second.referenceEffects[0].after.updatedAt = '2026-10-23T00:00:01.002Z';
  second.receipts[0] = { ...second.receipts[0], _id: oid(14), mediaId: oid(7), releasedAt: '2026-10-23T00:00:01.001Z' };
  const last = codec.sealEvidence(second);
  return { first, second: last, from: clone(first.operations[0].before), to: clone(last.operations[0].after) };
};
const chain = (f, proofs = [f.first, f.second]) => proveOperationVersionChain({ from: f.from, to: f.to, proofs });
const changeOperation = (proof, modify) => {
  const unsigned = clone(proof); delete unsigned.evidenceHash;
  modify(unsigned.operations[0], unsigned);
  return codec.sealEvidence(unsigned);
};

describe('operation identity', () => {
  test('compares the immutable identity and ignores all six mutable fields', () => {
    const { from } = fixture();
    expect(sameOperationIdentity(from, { ...clone(from), state: 'ABORTED', version: 99, leaseExpiresAt: TIMES.lease,
      terminalAt: TIMES.deleted, failureCode: 'RESOURCE_NOT_FOUND', updatedAt: TIMES.evidence })).toBe(true);
    expect(sameOperationIdentity(from, Object.fromEntries(Object.entries(from).reverse()))).toBe(true);
  });
  test.each(['_id', 'familyId', 'childId', 'resourceType', 'resourceId', 'field', 'operationId',
    'commandHash', 'referenceSetHash', 'createdAt'])('detects changed identity %s', field => {
    const { from } = fixture(); const other = clone(from); other[field] += 'x';
    expect(sameOperationIdentity(from, other)).toBe(false);
  });
  test.each(['order', 'mediaId', 'field', 'missing'])('compares complete ordered references: %s', kind => {
    const { from } = fixture(); const other = clone(from);
    if (kind === 'order') other.references.reverse();
    if (kind === 'mediaId') other.references[0].mediaId = oid(99);
    if (kind === 'field') other.references[0].field = 'attachmentMediaIds';
    if (kind === 'missing') other.references.pop();
    expect(sameOperationIdentity(from, other)).toBe(false);
  });
  test('missing identity fields do not compare equal and getters are not invoked', () => {
    expect(sameOperationIdentity({}, {})).toBe(false);
    const { from } = fixture(); const other = clone(from); const getter = jest.fn(() => from.commandHash);
    Object.defineProperty(other, 'commandHash', { get: getter, enumerable: true });
    expect(sameOperationIdentity(from, other)).toBe(false); expect(getter).not.toHaveBeenCalled();
  });
});

describe('complete operation version chain', () => {
  test.each(['missing field', 'extra field', 'fractional version', 'unsafe version', 'noncanonical date',
    'wrong hash', 'unordered references', 'sparse references', 'lease on terminal', 'getter'])(
    'rejects malformed equal endpoints: %s', kind => {
      const f = fixture(), value = clone(f.from); const getter = jest.fn(() => TIMES.committed);
      if (kind === 'missing field') delete value.updatedAt;
      if (kind === 'extra field') value.extra = true;
      if (kind === 'fractional version') value.version = 1.5;
      if (kind === 'unsafe version') value.version = Number.MAX_SAFE_INTEGER + 1;
      if (kind === 'noncanonical date') value.createdAt = '2026-10-20';
      if (kind === 'wrong hash') value.referenceSetHash = 'a'.repeat(64);
      if (kind === 'unordered references') value.references.reverse();
      if (kind === 'sparse references') value.references.length = 3;
      if (kind === 'lease on terminal') value.leaseExpiresAt = TIMES.lease;
      if (kind === 'getter') Object.defineProperty(value, 'updatedAt', { get: getter });
      expect(() => proveOperationVersionChain({ from: value, to: value, proofs: [] }))
        .toThrow(expect.objectContaining({ code: INVALID }));
      expect(getter).not.toHaveBeenCalled();
    });
  test('returns ordered detached COMMITTED edges, regardless of proof input order', () => {
    const f = fixture(); const result = chain(f, [f.second, f.first]);
    expect(result).toEqual([f.first, f.second].map(proof => ({ evidenceId: proof.evidenceId,
      mediaId: proof.tombstone.mediaId, before: proof.operations[0].before, after: proof.operations[0].after })));
    result[0].after.references[0].mediaId = oid(99);
    expect(f.first.operations[0].after.references[0].mediaId).toBe(oid(4));
  });
  test('equal endpoints return an empty path and repeated identical proofs are deduplicated', () => {
    const f = fixture();
    expect(proveOperationVersionChain({ from: f.from, to: clone(f.from), proofs: [f.first] })).toEqual([]);
    expect(chain(f, [f.first, clone(f.first), f.second])).toHaveLength(2);
  });
  test('equal ABORTED endpoints remain a no-op, not a fabricated COMMITTED edge', () => {
    const proof = codec.sealEvidence(makeUnsignedEvidence('prepared'));
    const endpoint = proof.operations[0].after;
    expect(proveOperationVersionChain({ from: endpoint, to: clone(endpoint), proofs: [proof] })).toEqual([]);
  });
  test.each(['missing first', 'missing last', 'lower target', 'ordinary unbind gap', 'historical assertion only'])(
    '%s cannot skip a missing transition', kind => {
      const f = fixture(); let proofs = [f.first, f.second];
      if (kind === 'missing first') proofs = [f.second];
      if (kind === 'missing last') proofs = [f.first];
      if (kind === 'lower target') [f.from, f.to] = [f.to, f.from];
      if (kind === 'ordinary unbind gap') {
        f.second = changeOperation(f.second, pair => { pair.before.version = 3; pair.after.version = 4; });
        f.to = f.second.operations[0].after; proofs = [f.first, f.second];
      }
      if (kind === 'historical assertion only') {
        const historical = clone(f.first); delete historical.evidenceHash;
        historical.operations[0].before = null; historical.tombstone.deletedAt = TIMES.evidence;
        historical.referenceEffects = []; historical.receipts = [];
        proofs = [codec.sealEvidence(historical), f.second];
      }
      expect(() => chain(f, proofs)).toThrow(expect.objectContaining({ code: PENDING }));
    });
  test.each(['identity', 'opposite terminal', 'terminalAt', 'endpoint updatedAt', 'joining updatedAt'])(
    '%s conflict is INVALID, not a version-only match', kind => {
      const f = fixture();
      if (kind === 'identity') f.to.commandHash = 'd'.repeat(64);
      if (kind === 'opposite terminal') { f.to.state = 'ABORTED'; f.to.failureCode = 'RESOURCE_NOT_FOUND'; }
      if (kind === 'terminalAt') f.to.terminalAt = TIMES.deleted;
      if (kind === 'endpoint updatedAt') f.to.updatedAt = '2026-10-23T00:00:01.003Z';
      if (kind === 'joining updatedAt') f.second = changeOperation(f.second, pair => { pair.before.updatedAt = TIMES.evidence; });
      expect(() => chain(f)).toThrow(expect.objectContaining({ code: INVALID }));
    });
  test.each(['branch', 'same edge different owner', 'same media different evidence', 'same evidence different content'])(
    'rejects %s even if one available path reaches the target', kind => {
      const f = fixture(); const other = clone(f.first); delete other.evidenceHash;
      if (kind !== 'same evidence different content') other.evidenceId = uuid(90);
      if (kind === 'branch' || kind === 'same edge different owner') {
        other.tombstone.mediaId = oid(7); other.uploadIdentity.mediaId = oid(7); other.tombstone._id = oid(90);
        other.receipts[0].mediaId = oid(7); other.receipts[0]._id = oid(91);
        for (const ref of [other.referenceEffects[0].before, other.referenceEffects[0].after]) { ref.mediaId = oid(7); ref._id = oid(92); }
      }
      if (kind === 'branch' || kind === 'same evidence different content') other.operations[0].after.updatedAt = TIMES.evidence;
      const proof = codec.sealEvidence(other);
      f.to = clone(f.first.operations[0].after);
      expect(() => chain(f, [f.first, proof])).toThrow(expect.objectContaining({ code: INVALID }));
    });
  test.each(['same group different hash', 'same id different scope', 'ABORTED history'])(
    'rejects relevant %s proof instead of ignoring its conflict', kind => {
      const f = fixture(); const other = clone(f.first); delete other.evidenceHash;
      other.evidenceId = uuid(88); other.tombstone.mediaId = oid(7); other.uploadIdentity.mediaId = oid(7);
      other.receipts[0].mediaId = oid(7);
      for (const row of [other.referenceEffects[0].before, other.referenceEffects[0].after]) row.mediaId = oid(7);
      if (kind === 'same group different hash') for (const op of [other.operations[0].before, other.operations[0].after]) op.commandHash = 'e'.repeat(64);
      if (kind === 'same id different scope') {
        for (const op of [other.operations[0].before, other.operations[0].after]) op.resourceId = oid(88);
        for (const row of [other.referenceEffects[0].before, other.referenceEffects[0].after, other.receipts[0]]) row.resourceId = oid(88);
      }
      if (kind === 'ABORTED history') {
        other.operations[0].before = null; other.operations[0].after.state = 'ABORTED';
        other.operations[0].after.failureCode = 'MEDIA_OPERATION_ABORTED';
        other.tombstone.deletedAt = TIMES.evidence; other.referenceEffects = []; other.receipts = [];
      }
      f.to = clone(f.first.operations[0].after);
      expect(() => chain(f, [codec.sealEvidence(other), f.first])).toThrow(expect.objectContaining({ code: INVALID }));
    });
  test('unrelated valid groups do not become edges of the requested operation', () => {
    const f = fixture(); const other = makeUnsignedEvidence('history');
    other.evidenceId = uuid(91); other.tombstone.mediaId = oid(9); other.uploadIdentity.mediaId = oid(9);
    other.operations[0].after._id = oid(90); other.operations[0].after.resourceId = oid(91);
    other.operations[0].after.references = [{ mediaId: oid(9), field: 'completionMediaIds' }];
    other.operations[0].after.referenceSetHash = referenceHash(other.operations[0].after.references);
    expect(chain(f, [f.first, f.second, codec.sealEvidence(other)])).toHaveLength(2);
  });
  test.each(['bad hash', 'valid digest invalid semantics', 'extra field', 'sparse proofs'])(
    'validates every proof even for equal endpoints: %s', kind => {
      const f = fixture(); const other = clone(empty(77)); let proofs;
      if (kind === 'bad hash') other.evidenceHash = 'f'.repeat(64);
      if (kind === 'valid digest invalid semantics') other.uploadIdentity.familyId = oid(99);
      if (kind === 'extra field') other.extra = true;
      proofs = [f.first, kind === 'bad hash' ? other : resign(other)];
      if (kind === 'sparse proofs') proofs.length = 3;
      expect(() => proveOperationVersionChain({ from: f.from, to: f.from, proofs }))
        .toThrow(expect.objectContaining({ code: INVALID }));
    });
});

const deferred = () => {
  let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const isolatedModule = (bytes, replacements = []) => {
  const context = { module: { exports: {} }, Buffer, require: name => {
    if (name === './userDeletionRecoveryEvidence') return { ...codec,
      LIMITS: { ...codec.LIMITS, MAX_DEPENDENCY_BYTES: bytes } };
    if (['json-canonicalize', 'crypto', 'util'].includes(name)) return require(name);
    throw Error('Unexpected pure helper dependency');
  } };
  let source = fs.readFileSync(modulePath, 'utf8');
  for (const [before, after] of replacements) {
    expect(source.split(before)).toHaveLength(2); source = source.replace(before, after);
  }
  vm.runInNewContext(source, context, { filename: modulePath });
  return context.module.exports;
};
const cacheWithLimit = bytes => isolatedModule(bytes).createUserDeletionProofCache;
const largeProof = number => {
  const value = makeUnsignedEvidence('prepared'), template = clone(value);
  value.evidenceId = uuid(number); value.tombstone.mediaId = oid(number); value.uploadIdentity.mediaId = oid(number);
  value.operations = []; value.referenceEffects = [];
  const references = [oid(number), ...Array.from({ length: 9 }, (_, i) => oid(5000 + i))]
    .sort().map(mediaId => ({ mediaId, field: 'completionMediaIds' }));
  for (let group = 0; group < 60; group += 1) {
    const pair = clone(template.operations[0]);
    for (const row of [pair.before, pair.after]) {
      row._id = oid(500 + group); row.resourceId = oid(600 + group); row.operationId = uuid(10 + group);
      row.references = clone(references); row.referenceSetHash = referenceHash(references);
    }
    value.operations.push(pair);
    references.forEach((ref, index) => {
      const effect = clone(template.referenceEffects[0]);
      for (const row of [effect.before, effect.after]) {
        row._id = oid(10000 + group * 10 + index); row.resourceId = pair.after.resourceId;
        row.operationId = pair.after.operationId; row.mediaId = ref.mediaId;
      }
      effect.after.releaseOperationId = pair.after.operationId; value.referenceEffects.push(effect);
    });
  }
  return codec.sealEvidence(value);
};
describe('bounded detached proof cache', () => {
  test('one cache uses one read session across target dependencies and retry; a new cache gets fresh ownership', async () => {
    let sessions = 0;
    const journal = { read: async () => { throw Error('Unscoped reader must not be used'); }, createReadSession() {
      sessions += 1; const seen = new Map();
      return { async read(mediaId) {
        if (!seen.has(mediaId)) seen.set(mediaId, Promise.resolve(empty(Number.parseInt(mediaId, 16))));
        return seen.get(mediaId);
      } };
    } };
    const first = createUserDeletionProofCache({ journal });
    expect(await first.read(oid(1))).toEqual(empty(1));
    expect(await first.read(oid(2))).toEqual(empty(2));
    expect(await first.read(oid(1))).toEqual(empty(1)); expect(sessions).toBe(1);
    const second = createUserDeletionProofCache({ journal });
    expect(await second.read(oid(1))).toEqual(empty(1)); expect(sessions).toBe(2);
  });
  test.each([null, {}, { read: true }, Promise.resolve({ read() {} })])('malformed session %j cannot fall back to an unscoped reader', value => {
    const journal = { read: async () => empty(1), createReadSession: () => value };
    expect(() => createUserDeletionProofCache({ journal })).toThrow(TypeError);
  });
  test.each([null, true, 'session'])('invalid session capability %j is not ignored', createReadSession => {
    expect(() => createUserDeletionProofCache({ journal: { read: async () => empty(1), createReadSession } })).toThrow(TypeError);
  });
  test.each([undefined, {}, { journal: {} }, { journal: { read: true } }])('requires a read-only journal dependency: %j', options => {
    expect(() => createUserDeletionProofCache(options)).toThrow();
  });
  test('deduplicates pending and repeated reads and never leaks internal objects', async () => {
    const hold = deferred(), input = empty(1), read = jest.fn(() => hold.promise);
    const cache = createUserDeletionProofCache({ journal: { read } });
    const first = cache.read(oid(1)), second = cache.read(oid(1));
    hold.resolve(input);
    const [a, b] = await Promise.all([first, second]); expect(a).toEqual(input); expect(b).toEqual(input);
    a.tombstone.actorId = oid(99); input.evidenceId = uuid(99);
    expect(b).toEqual(empty(1)); expect(await cache.read(oid(1))).toEqual(empty(1));
    const values = cache.values(); values[0].uploadIdentity.metadataHash = 'c'.repeat(64); values.pop();
    expect(cache.values()).toEqual([empty(1)]); expect(read).toHaveBeenCalledTimes(1);
  });
  test.each(['', '../escape', oid(1) + '\n', oid(1) + '\r', 'ABCDEFABCDEFABCDEFABCDEF', null])(
    'invalid mediaId %j is rejected before journal IO', async mediaId => {
      const read = jest.fn(); const cache = createUserDeletionProofCache({ journal: { read } });
      await expect(cache.read(mediaId)).rejects.toMatchObject({ code: INVALID }); expect(read).not.toHaveBeenCalled();
    });
  test.each(['undefined', 'different media', 'invalid digest', 'valid digest invalid semantics', 'getter'])(
    'rejects %s without adding a cached value', async kind => {
      let value = empty(1);
      if (kind === 'undefined') value = undefined;
      if (kind === 'different media') value = empty(2);
      if (kind === 'invalid digest') value.evidenceHash = 'f'.repeat(64);
      if (kind === 'valid digest invalid semantics') { value.uploadIdentity.childId = oid(99); value = resign(value); }
      const getter = jest.fn(() => value.evidenceHash);
      if (kind === 'getter') Object.defineProperty(value, 'evidenceHash', { get: getter });
      const cache = createUserDeletionProofCache({ journal: { read: async () => value } });
      await expect(cache.read(oid(1))).rejects.toMatchObject({ code: INVALID });
      expect(cache.values()).toEqual([]); expect(getter).not.toHaveBeenCalled();
    });
  test.each(['null', 'async ENOENT', 'sync ENOENT'])(
    'missing journal result %s is PENDING for concurrent readers and remains retryable', async kind => {
      const missing = Object.assign(Error('Synthetic missing journal'), { code: 'ENOENT' });
      const read = jest.fn().mockImplementationOnce(() => {
        if (kind === 'null') return Promise.resolve(null);
        if (kind === 'async ENOENT') return Promise.reject(missing);
        throw missing;
      }).mockResolvedValue(empty(1));
      const cache = createUserDeletionProofCache({ journal: { read } });
      const results = await Promise.allSettled([cache.read(oid(1)), cache.read(oid(1))]);
      expect(results.map(result => ({ status: result.status, code: result.reason?.code })))
        .toEqual([{ status: 'rejected', code: PENDING }, { status: 'rejected', code: PENDING }]);
      expect(read).toHaveBeenCalledTimes(1); expect(cache.values()).toEqual([]);
      expect(await cache.read(oid(1))).toEqual(empty(1)); expect(read).toHaveBeenCalledTimes(2);
    });
  test.each(['EACCES', 'EIO'])('journal %s is not downgraded to a missing dependency', async code => {
    const error = Object.assign(Error('Synthetic journal failure'), { code });
    const cache = createUserDeletionProofCache({ journal: { read: async () => { throw error; } } });
    await expect(cache.read(oid(1))).rejects.toBe(error);
    expect(cache.values()).toEqual([]);
  });
  test('a rejected read is not accepted as evidence and can be retried after the journal recovers', async () => {
    const read = jest.fn().mockRejectedValueOnce(Error('Synthetic I/O')).mockResolvedValue(empty(1));
    const cache = createUserDeletionProofCache({ journal: { read } });
    await expect(cache.read(oid(1))).rejects.toThrow(); expect(cache.values()).toEqual([]);
    expect(await cache.read(oid(1))).toEqual(empty(1)); expect(read).toHaveBeenCalledTimes(2);
  });
  test('100 distinct proofs fit; a 101st distinct read cannot bypass the count while repeated reads still work', async () => {
    const read = jest.fn(async id => empty(Number.parseInt(id, 16)));
    const cache = createUserDeletionProofCache({ journal: { read } });
    for (let i = 1; i <= 100; i += 1) await cache.read(oid(i));
    await expect(cache.read(oid(101))).rejects.toMatchObject({ code: INVALID });
    expect(await cache.read(oid(1))).toEqual(empty(1)); expect(read).toHaveBeenCalledTimes(100);
    expect(cache.values()).toHaveLength(100);
  });
  test('pending distinct reads reserve the 100 slots before any journal result arrives', async () => {
    const holds = Array.from({ length: 100 }, deferred);
    const read = jest.fn(id => holds[Number.parseInt(id, 16) - 1].promise);
    const cache = createUserDeletionProofCache({ journal: { read } });
    const pending = Array.from({ length: 100 }, (_, i) => cache.read(oid(i + 1)));
    const extra = cache.read(oid(101));
    const checked = expect(extra).rejects.toMatchObject({ code: INVALID });
    holds.forEach((hold, i) => hold.resolve(empty(i + 1)));
    await checked; await Promise.all(pending);
    expect(read).toHaveBeenCalledTimes(100); expect(cache.values()).toHaveLength(100);
  });
  test.each([false, true])('canonical byte budget includes newline, with concurrent completion=%s', async concurrent => {
    const inputs = [empty(1), empty(2)];
    const total = inputs.reduce((sum, value) => sum + Buffer.byteLength(canonicalize(value) + '\n'), 0);
    for (const limit of [total, total - 1]) {
      const factory = cacheWithLimit(limit);
      const cache = factory({ journal: { read: async id => inputs[Number.parseInt(id, 16) - 1] } });
      let outcomes;
      if (concurrent) outcomes = await Promise.allSettled([cache.read(oid(1)), cache.read(oid(2))]);
      else { await cache.read(oid(1)); outcomes = [{ status: 'fulfilled' }, ...(await Promise.allSettled([cache.read(oid(2))]))]; }
      expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(limit === total ? 2 : 1);
      if (limit < total) expect(outcomes.find(o => o.status === 'rejected').reason.code).toBe(INVALID);
      const size = cache.values().reduce((sum, value) => sum + Buffer.byteLength(canonicalize(value) + '\n'), 0);
      expect(size).toBeLessThanOrEqual(limit);
    }
  });
  test('real 16 MiB budget rejects the next legal proof before 100-file count is exhausted', async () => {
    const first = largeProof(1000), perFile = Buffer.byteLength(codec.serializeEvidence(first));
    const allowed = Math.floor(codec.LIMITS.MAX_DEPENDENCY_BYTES / perFile);
    expect(allowed).toBeGreaterThan(1); expect(allowed).toBeLessThan(100);
    expect(perFile).toBeLessThan(codec.LIMITS.MAX_BYTES);
    const cache = createUserDeletionProofCache({ journal: { read: async id => largeProof(Number.parseInt(id, 16)) } });
    for (let i = 0; i < allowed; i += 1) await cache.read(oid(1000 + i));
    await expect(cache.read(oid(1000 + allowed))).rejects.toMatchObject({ code: INVALID });
    expect(cache.values()).toHaveLength(allowed);
    expect(await cache.read(oid(1000))).toEqual(first);
  }, 30000);
  test.each(['count', 'bytes'])('capacity oracle detects a removed %s guard without changing production files', async kind => {
    const size = Buffer.byteLength(codec.serializeEvidence(empty(1)));
    const removed = kind === 'count' ? 'assert(entries.size < LIMITS.MAX_DEPENDENCIES);'
      : 'assert(totalBytes + size <= LIMITS.MAX_DEPENDENCY_BYTES);';
    const factory = isolatedModule(kind === 'bytes' ? size : codec.LIMITS.MAX_DEPENDENCY_BYTES,
      [[removed, '']]).createUserDeletionProofCache;
    const cache = factory({ journal: { read: async id => empty(Number.parseInt(id, 16)) } });
    const count = kind === 'count' ? 101 : 2;
    for (let i = 1; i <= count; i += 1) await cache.read(oid(i));
    expect(cache.values()).toHaveLength(count);
    if (kind === 'bytes') expect(cache.values().reduce((sum, value) => sum + Buffer.byteLength(codec.serializeEvidence(value)), 0)).toBeGreaterThan(size);
  });
  test('semantic-validation oracle detects bypassing both codec validation paths', () => {
    const f = fixture(), malformed = empty(90); malformed.uploadIdentity.childId = oid(99);
    const mutant = isolatedModule(codec.LIMITS.MAX_DEPENDENCY_BYTES, [
      ['arrayValues(proofs).map(validateEvidence)', 'arrayValues(proofs)'],
      ['const encoded = serializeEvidence(proof), mediaId = proof.tombstone.mediaId;',
        'const encoded = JSON.stringify(proof), mediaId = proof.tombstone.mediaId;']
    ]);
    const args = { from: f.from, to: f.from, proofs: [resign(malformed)] };
    expect(() => proveOperationVersionChain(args)).toThrow(expect.objectContaining({ code: INVALID }));
    expect(mutant.proveOperationVersionChain(args)).toEqual([]);
  });
  test('cold load imports no models, database, filesystem or journal writer', () => {
    const script = `const Module=require('module'); const load=Module._load;
      Module._load=function(name,...rest){ if(/mongoose|models|fs|journal/i.test(name)) throw Error('Forbidden import '+name);
        return load.call(this,name,...rest); }; const api=require(process.argv[1]);
      if(Object.keys(api).sort().join(',')!=='createUserDeletionProofCache,proveOperationVersionChain,sameOperationIdentity') throw Error('Unexpected exports');`;
    expect(() => execFileSync(process.execPath, ['-e', script, path.resolve(modulePath)], { stdio: 'pipe' })).not.toThrow();
  });
});

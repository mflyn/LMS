const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { TextDecoder } = require('util');
const { canonicalize } = require('json-canonicalize');
const codec = require('../services/userDeletionRecoveryEvidence');
const { makeUnsignedEvidence, oid, uuid, referenceHash } = require('./fixtures/userDeletionRecoveryEvidence');
const { createMediaDeletionJournal } = require('../services/mediaDeletionJournal');
const { createUserDeletionRecoveryJournal } = require('../services/userDeletionRecoveryJournal');

const INVALID = 'USER_DELETION_EVIDENCE_INVALID', PENDING = 'USER_DELETION_DEPENDENCY_PENDING';
let base, root, v2root;
const factory = () => require('../services/userDeletionRecoveryReader').createUserDeletionRecoveryReader;
const reader = () => factory()({ root });
const evidence = (id = 4, kind = 'empty') => {
  const value = makeUnsignedEvidence(kind);
  if (kind === 'empty') {
    value.tombstone.mediaId = oid(id); value.uploadIdentity.mediaId = oid(id); value.evidenceId = uuid(id);
  }
  return codec.sealEvidence(value);
};
const legacy = proof => ({ tombstone: Object.fromEntries(Object.entries(proof.tombstone).filter(([k]) => k !== '_id')),
  receipts: proof.receipts.map(({ _id, ...receipt }) => receipt) });
const filename = (id, version = 2) => path.join(version === 2 ? v2root : root, oid(id) + '.json');
const put = async (proof, paired = false) => {
  await fs.mkdir(v2root, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(v2root, proof.tombstone.mediaId + '.json'), codec.serializeEvidence(proof), { mode: 0o600 });
  if (paired) await fs.writeFile(path.join(root, proof.tombstone.mediaId + '.json'), JSON.stringify(legacy(proof)) + '\n', { mode: 0o600 });
};
beforeEach(async () => {
  base = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'lms-udr-reader-'));
  root = path.join(base, 'deletions'); v2root = path.join(root, 'user-deletions-v2');
  await fs.mkdir(root, { mode: 0o700 });
});
afterEach(async () => { jest.restoreAllMocks(); await fs.rm(base, { recursive: true, force: true }); });

// All handles and reads remain real; hooks inject only the race/failure under test.
const trace = (hooks = {}) => {
  const open = fs.open.bind(fs), records = [];
  jest.spyOn(fs, 'open').mockImplementation(async (name, flags, ...args) => {
    if (hooks.beforeOpen) await hooks.beforeOpen(name);
    const handle = await open(name, flags, ...args);
    const record = { name, flags, bytes: 0, reads: 0, stats: 0, closed: false };
    records.push(record);
    const stat = handle.stat.bind(handle), read = handle.read.bind(handle), close = handle.close.bind(handle);
    if (hooks.forbidSync) handle.sync = async () => { throw Error('Unexpected sync'); };
    handle.stat = async () => {
      record.stats++; const value = await stat();
      if (hooks.stat) await hooks.stat(record, value);
      return value;
    };
    handle.read = async (...values) => {
      if (hooks.read) await hooks.read(record);
      record.reads++;
      const result = await read(...values); record.bytes += result.bytesRead; return result;
    };
    handle.close = async () => {
      await close(); record.closed = true;
      if (hooks.close) await hooks.close(record);
    };
    return handle;
  });
  return records;
};
const files = records => records.filter(r => r.name.endsWith('.json'));

test.each(['empty', 'committed', 'prepared', 'history'])('reads actual B and legacy writer output for %s', async kind => {
  const proof = evidence(4, kind);
  await createUserDeletionRecoveryJournal({ root: v2root }).persist(proof);
  await createMediaDeletionJournal({ root }).persist(legacy(proof));
  const before = await fs.readFile(filename(4, 1));
  expect(await reader().read(oid(4))).toEqual(proof);
  expect(await fs.readFile(filename(4, 1))).toEqual(before);
});
test('v2-only returns detached values and deduplicates concurrent and repeated reads', async () => {
  const proof = evidence(); await put(proof);
  const records = trace(), session = reader().createReadSession();
  const results = await Promise.all([session.read(oid(4)), session.read(oid(4))]);
  results[0].tombstone.actorId = oid(999);
  expect(results[1]).toEqual(proof); expect(await session.read(oid(4))).toEqual(proof);
  expect(files(records)).toHaveLength(1); expect(records.every(r => r.closed)).toBe(true);
  expect(await fs.readdir(root)).toEqual(['user-deletions-v2']);
});
test('safe absence is cached; v1-only never supplies a proof; a new session sees repaired files', async () => {
  await fs.writeFile(filename(4, 1), JSON.stringify(legacy(evidence())) + '\n', { mode: 0o600 });
  const instance = reader(), session = instance.createReadSession();
  expect(await session.read(oid(4))).toBeNull();
  await put(evidence());
  expect(await session.read(oid(4))).toBeNull();
  expect(await instance.createReadSession().read(oid(4))).toEqual(evidence());
});
test('a missing configured root stays absent and does not create directories', async () => {
  await fs.rmdir(root);
  expect(await reader().read(oid(4))).toBeNull(); expect(await fs.readdir(base)).toEqual([]);
});
test('rejected results are deduplicated even after repair; standalone read starts a new attempt', async () => {
  await put(evidence(), true);
  await fs.writeFile(filename(4, 1), '{}\n');
  const records = trace(), instance = reader(), session = instance.createReadSession();
  const outcomes = await Promise.allSettled([session.read(oid(4)), session.read(oid(4))]);
  expect(outcomes.map(o => o.reason.code)).toEqual([INVALID, INVALID]);
  await put(evidence(), true);
  await expect(session.read(oid(4))).rejects.toMatchObject({ code: INVALID });
  expect(files(records)).toHaveLength(2);
  expect(await instance.read(oid(4))).toEqual(evidence());
});
test.each([true, false])('physical file boundary, paired=%s', async paired => {
  const allowed = paired ? 50 : 100;
  for (let i = 1; i <= allowed + 1; i++) await put(evidence(i), paired);
  const records = trace(), session = reader().createReadSession();
  for (let i = 1; i <= allowed; i++) expect((await session.read(oid(i))).tombstone.mediaId).toBe(oid(i));
  await expect(session.read(oid(allowed + 1))).rejects.toMatchObject({ code: INVALID });
  expect(files(records).filter(r => r.reads)).toHaveLength(100);
  expect(files(records).at(-1).reads).toBe(0);
  expect(records.every(r => r.closed)).toBe(true);
  expect(await reader().read(oid(allowed + 1))).toEqual(evidence(allowed + 1));
});
test('concurrent boundary misses cannot reserve more than 100 physical files', async () => {
  for (let i = 1; i <= 101; i++) await put(evidence(i));
  const records = trace(), session = reader().createReadSession();
  const outcomes = await Promise.allSettled(Array.from({ length: 101 }, (_, i) => session.read(oid(i + 1))));
  expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(100);
  expect(outcomes.filter(o => o.status === 'rejected').map(o => o.reason.code)).toEqual([INVALID]);
  expect(files(records).filter(r => r.reads)).toHaveLength(100);
});
test.each(['', '/', 'relative', '/a/../b', '/absolute/'])('invalid root %j is coded', value => {
  expect(() => factory()({ root: value })).toThrow(expect.objectContaining({ code: INVALID }));
});
test.each(['../x', oid(4) + '\n', oid(4) + '\r', 'ABCDEFABCDEFABCDEFABCDEF', null])('invalid mediaId %j performs no I/O', async id => {
  const records = trace();
  await expect(reader().read(id)).rejects.toMatchObject({ code: INVALID }); expect(records).toHaveLength(0);
});
test.each([1, 2])('namespace %s rejects noncanonical bytes, unknown fields, duplicate keys and bad UTF8', async version => {
  await put(evidence(), true);
  const valid = await fs.readFile(filename(4, version), 'utf8');
  const object = JSON.parse(valid);
  const cases = [valid.trimEnd(), ' ' + valid, valid + '\n', '{"x":1,' + valid.slice(1),
    valid.replace('"tombstone":', '"tombstone":null,"tombstone":'), Buffer.from([0xff]), JSON.stringify({ ...object, extra: 1 }) + '\n'];
  for (const content of cases) {
    await fs.writeFile(filename(4, version), content);
    await expect(reader().read(oid(4))).rejects.toMatchObject({ code: INVALID });
  }
});
test.each(['actorId', 'familyId', 'childId', 'mediaId', 'deletedAt', 'role'])('v1 tombstone %s conflict rejects', async field => {
  const proof = evidence(); await put(proof);
  const old = legacy(proof); old.tombstone[field] = field.endsWith('Id') ? oid(99) : 'different';
  await fs.writeFile(filename(4, 1), JSON.stringify(old) + '\n', { mode: 0o600 });
  await expect(reader().read(oid(4))).rejects.toMatchObject({ code: INVALID });
});
test.each(['missing', 'duplicate', 'binding', 'releasedAt', 'extra'])('v1 receipt %s conflict rejects', async kind => {
  const proof = evidence(4, 'committed'); await put(proof);
  const old = legacy(proof);
  if (kind === 'missing') old.receipts = [];
  if (kind === 'duplicate') old.receipts.push(old.receipts[0]);
  if (kind === 'binding') old.receipts[0].bindingOperationId = uuid(99);
  if (kind === 'releasedAt') old.receipts[0].releasedAt = proof.evidenceCreatedAt;
  if (kind === 'extra') old.receipts[0].extra = true;
  await fs.writeFile(filename(4, 1), JSON.stringify(old) + '\n', { mode: 0o600 });
  await expect(reader().read(oid(4))).rejects.toMatchObject({ code: INVALID });
});
test.each(['root symlink', 'v2 symlink', 'ancestor symlink', 'file symlink', 'root mode', 'v2 mode', 'file mode', 'file directory'])(
  'rejects unsafe %s without repair', async kind => {
    await put(evidence(), true);
    if (kind === 'root symlink' || kind === 'ancestor symlink') {
      const alias = path.join(base, 'alias'); await fs.symlink(root, alias);
      root = kind === 'root symlink' ? alias : path.join(alias, 'sub');
    } else if (kind === 'v2 symlink') {
      await fs.rename(v2root, v2root + '-real'); await fs.symlink(v2root + '-real', v2root);
    } else if (kind === 'file symlink' || kind === 'file directory') {
      await fs.unlink(filename(4));
      if (kind === 'file symlink') await fs.symlink(filename(4, 1), filename(4));
      else await fs.mkdir(filename(4));
    } else await fs.chmod(kind === 'root mode' ? root : kind === 'v2 mode' ? v2root : filename(4), 0o755);
    await expect(reader().read(oid(4))).rejects.toMatchObject({ code: INVALID });
  });
test.each(['EACCES', 'EIO', 'ENOENT'])('existing v1 open %s is pending, never optional absence', async code => {
  await put(evidence(), true);
  const records = trace({ beforeOpen: name => { if (name === filename(4, 1)) throw Object.assign(Error('/secret'), { code }); } });
  await expect(reader().read(oid(4))).rejects.toMatchObject({ code: PENDING, message: PENDING });
  expect(records.every(r => r.closed)).toBe(true);
});
test.each([false, true])('close failure is pending unless preserving primary INVALID=%s', async corrupt => {
  await put(evidence(), true);
  if (corrupt) await fs.writeFile(filename(4, 1), '{}\n');
  const records = trace({ close: r => { if (r.name === filename(4, 1)) throw Error('/secret close'); } });
  await expect(reader().read(oid(4))).rejects.toMatchObject({ code: corrupt ? INVALID : PENDING });
  expect(records.every(r => r.closed)).toBe(true);
});
test('growth after opened fstat consumes at most one detector byte and never returns a proof', async () => {
  await put(evidence()); const size = (await fs.stat(filename(4))).size;
  const records = trace({ stat: async r => {
    if (r.name === filename(4) && r.stats === 1) await fs.appendFile(r.name, Buffer.alloc(3 * 1024 * 1024));
  } });
  await expect(reader().read(oid(4))).rejects.toMatchObject({ code: INVALID });
  expect(files(records)[0].bytes).toBe(size + 1); expect(records.every(r => r.closed)).toBe(true);
});
test('oversize growth before opened fstat is rejected without reading or allocating content', async () => {
  await put(evidence());
  const records = trace({ beforeOpen: async name => { if (name === filename(4)) await fs.appendFile(name, Buffer.alloc(2 * 1024 * 1024)); } });
  await expect(reader().read(oid(4))).rejects.toMatchObject({ code: INVALID });
  expect(files(records)[0].reads).toBe(0); expect(records.every(r => r.closed)).toBe(true);
});

const largeUnsigned = (id, groups = 80) => {
  const result = makeUnsignedEvidence('empty'), template = makeUnsignedEvidence('prepared');
  result.tombstone.mediaId = oid(id); result.uploadIdentity.mediaId = oid(id); result.evidenceId = uuid(id);
  const refs = Array.from({ length: 10 }, (_, i) => ({ mediaId: oid(id + i), field: 'completionMediaIds' }));
  for (let i = 0; i < groups; i++) {
    const identity = { _id: oid(2000 + i), resourceId: oid(3000 + i), operationId: uuid(100 + i),
      references: refs, referenceSetHash: referenceHash(refs) };
    result.operations.push({ before: { ...template.operations[0].before, ...identity },
      after: { ...template.operations[0].after, ...identity } });
    for (let j = 0; j < refs.length; j++) {
      const refIdentity = { _id: oid(5000 + i * 10 + j), resourceId: identity.resourceId,
        operationId: identity.operationId, mediaId: refs[j].mediaId };
      result.referenceEffects.push({ before: { ...template.referenceEffects[0].before, ...refIdentity },
        after: { ...template.referenceEffects[0].after, ...refIdentity, releaseOperationId: identity.operationId } });
    }
  }
  const history = makeUnsignedEvidence('history').operations[0].after;
  for (let i = 0; i < 20; i++) result.operations.push({ before: null,
    after: { ...history, _id: oid(2200 + i), resourceId: oid(3200 + i), operationId: uuid(300 + i),
      references: refs, referenceSetHash: referenceHash(refs), failureCode: 'A' } });
  return result;
};
const physicalSize = unsigned => {
  // Size planning only: every resulting proof is independently sealed/validated before filesystem use.
  return Buffer.byteLength(canonicalize({ ...unsigned, evidenceHash: 'a'.repeat(64) }) + '\n')
    + Buffer.byteLength(JSON.stringify(legacy(unsigned)) + '\n');
};

test('valid paired proofs exactly fill 16MiB including newlines; one extra byte is rejected before content read', async () => {
  const budget = 16 * 1024 * 1024, values = [], unit = physicalSize(largeUnsigned(100));
  let remaining = budget;
  while (remaining >= unit) { values.push(largeUnsigned(100 + values.length * 20)); remaining -= unit; }
  let partial = 0;
  for (let n = 1; n <= 80; n++) if (physicalSize(largeUnsigned(900, n)) <= remaining) partial = n;
  if (partial) { values.push(largeUnsigned(900, partial)); remaining -= physicalSize(values.at(-1)); }
  // Legal failure codes provide exact byte tuning without padding, unknown fields or invalid hashes.
  const adjustable = values.flatMap(value => value.operations.filter(op => op.before === null));
  for (const operation of adjustable) {
    const extra = Math.min(79, remaining); operation.after.failureCode += 'A'.repeat(extra); remaining -= extra;
  }
  expect(remaining).toBe(0); expect(values.reduce((sum, value) => sum + physicalSize(value), 0)).toBe(budget);
  const proofs = values.map(codec.sealEvidence);
  for (const proof of proofs) await put(proof, true);
  const session = reader().createReadSession(), records = trace();
  for (const proof of proofs) expect(await session.read(proof.tombstone.mediaId)).toEqual(proof);
  expect(files(records).reduce((sum, r) => sum + r.bytes, 0)).toBe(budget);
  jest.restoreAllMocks();
  adjustable[0].after.failureCode = adjustable[0].after.failureCode.slice(0, -1);
  adjustable.at(-1).after.failureCode += 'AA';
  // Keep both codes within the schema maximum while adding exactly one aggregate byte.
  expect(adjustable.at(-1).after.failureCode.length).toBeLessThanOrEqual(80);
  for (const value of values) await put(codec.sealEvidence(value), true);
  const overflow = reader().createReadSession(), observed = trace();
  for (const value of values.slice(0, -1)) await overflow.read(value.tombstone.mediaId);
  await expect(overflow.read(values.at(-1).tombstone.mediaId)).rejects.toMatchObject({ code: INVALID });
  expect(files(observed).at(-1).reads).toBe(0);
}, 120000);

test('failed reads retain physical slots and cannot be refunded by repeated rejected requests', async () => {
  for (let i = 1; i <= 101; i++) { await put(evidence(i)); if (i <= 100) await fs.writeFile(filename(i), '{}\n'); }
  const session = reader().createReadSession(), records = trace();
  for (let i = 1; i <= 100; i++) await expect(session.read(oid(i))).rejects.toMatchObject({ code: INVALID });
  await expect(session.read(oid(1))).rejects.toMatchObject({ code: INVALID });
  await expect(session.read(oid(101))).rejects.toMatchObject({ code: INVALID });
  expect(files(records).filter(r => r.reads)).toHaveLength(100); expect(files(records).at(-1).reads).toBe(0);
});
test('failed malformed content retains all reserved bytes, not only accepted proof bytes', async () => {
  await fs.mkdir(v2root, { mode: 0o700 });
  for (let i = 1; i <= 8; i++) await fs.writeFile(filename(i), Buffer.alloc(2 * 1024 * 1024, 32), { mode: 0o600 });
  await put(evidence(9)); const session = reader().createReadSession(), records = trace();
  for (let i = 1; i <= 8; i++) await expect(session.read(oid(i))).rejects.toMatchObject({ code: INVALID });
  await expect(session.read(oid(9))).rejects.toMatchObject({ code: INVALID });
  expect(files(records).reduce((sum, r) => sum + r.bytes, 0)).toBe(16 * 1024 * 1024);
  expect(files(records).at(-1).reads).toBe(0);
});
test('loss of the shared root after v2 is not optional v1 absence', async () => {
  await put(evidence(), true);
  const records = trace({ close: async r => { if (r.name === filename(4)) await fs.rename(root, root + '-moved'); } });
  await expect(reader().read(oid(4))).rejects.toMatchObject({ code: PENDING });
  expect(records.every(r => r.closed)).toBe(true);
});
test.each(['truncate', 'replace', 'unlink', 'mode', 'ancestor'])('post-open %s cannot yield evidence', async action => {
  await put(evidence());
  const records = trace({ stat: async r => {
    if (r.name !== filename(4) || r.stats !== 1) return;
    if (action === 'truncate') await fs.truncate(r.name, 3);
    if (action === 'replace') { await fs.rename(r.name, r.name + '-old'); await fs.writeFile(r.name, codec.serializeEvidence(evidence()), { mode: 0o600 }); }
    if (action === 'unlink') await fs.unlink(r.name);
    if (action === 'mode') await fs.chmod(r.name, 0o644);
    if (action === 'ancestor') { await fs.rename(v2root, v2root + '-old'); await fs.symlink(v2root + '-old', v2root); }
  } });
  await expect(reader().read(oid(4))).rejects.toMatchObject({ code: action === 'unlink' ? PENDING : INVALID });
  expect(records.every(r => r.closed)).toBe(true);
});
test('v1 object key order and receipt binding order need not match v2 receipt _id order', async () => {
  const value = makeUnsignedEvidence('committed');
  const group = JSON.parse(JSON.stringify(value.operations[0]));
  for (const item of [group.before, group.after]) { item._id = oid(30); item.resourceId = oid(1); item.operationId = uuid(30); }
  const effect = JSON.parse(JSON.stringify(value.referenceEffects[0]));
  for (const item of [effect.before, effect.after]) { item._id = oid(31); item.resourceId = oid(1); item.operationId = uuid(30); }
  value.operations.push(group); value.referenceEffects.push(effect);
  value.receipts.push({ ...value.receipts[0], _id: oid(32), resourceId: oid(1), bindingOperationId: uuid(30) });
  const proof = codec.sealEvidence(value); await put(proof);
  const old = legacy(proof); old.receipts.reverse(); old.tombstone = Object.fromEntries(Object.entries(old.tombstone).reverse());
  await fs.writeFile(filename(4, 1), JSON.stringify(old) + '\n', { mode: 0o600 });
  expect(await reader().read(oid(4))).toEqual(proof);
});
test('close is awaited before success is observable', async () => {
  await put(evidence()); let release, enter;
  const held = new Promise(resolve => { release = resolve; }), entered = new Promise(resolve => { enter = resolve; });
  trace({ close: async r => { if (r.name === filename(4)) { enter(); await held; } } });
  let settled = false;
  const reading = reader().read(oid(4)).finally(() => { settled = true; });
  try { await entered; await new Promise(resolve => setTimeout(resolve, 10)); expect(settled).toBe(false); }
  finally { release(); await reading; }
});
test('reader never writes, changes modes, syncs, scans directories or loads models', async () => {
  await put(evidence(), true);
  for (const method of ['mkdir', 'chmod', 'writeFile', 'appendFile', 'link', 'unlink', 'rename', 'readdir']) {
    jest.spyOn(fs, method).mockImplementation(() => { throw Error('Unexpected write/scan: ' + method); });
  }
  expect(await reader().read(oid(4))).toEqual(evidence());
  const { execFileSync } = require('child_process');
  const source = require.resolve('../services/userDeletionRecoveryReader');
  const output = execFileSync(process.execPath, ['-e', `require(${JSON.stringify(source)}); process.stdout.write(JSON.stringify(Object.keys(require.cache).filter(p=>/mongoose|[/\\\\]models[/\\\\]/.test(p))))`], { encoding: 'utf8' });
  expect(JSON.parse(output)).toEqual([]);
});

// Isolated source mutations exercise budget enforcement without adding production switches.
const isolatedFactory = async ({ replace, limits = {}, allocations = [] } = {}) => {
  const module = { exports: {} };
  let source = await fs.readFile(require.resolve('../services/userDeletionRecoveryReader'), 'utf8');
  if (replace) {
    expect(source).toContain(replace[0]); source = source.replace(replace[0], replace[1]);
  }
  const instrumentedBuffer = Object.create(Buffer);
  instrumentedBuffer.alloc = size => { allocations.push(size); return Buffer.alloc(size); };
  vm.runInNewContext(source, { module, exports: module.exports, Buffer: instrumentedBuffer, TextDecoder,
    require: name => name === './userDeletionRecoveryEvidence'
      ? { ...codec, LIMITS: { ...codec.LIMITS, ...limits } } : require(name)
  }, { filename: 'isolated-userDeletionRecoveryReader.js' });
  return module.exports.createUserDeletionRecoveryReader;
};
test('mutation sensitivity: removing the physical count charge permits a forbidden second file', async () => {
  await put(evidence(1)); await put(evidence(2));
  const options = { limits: { MAX_DEPENDENCIES: 1 } };
  const good = (await isolatedFactory(options))({ root }).createReadSession();
  await good.read(oid(1)); await expect(good.read(oid(2))).rejects.toMatchObject({ code: INVALID });
  const mutant = (await isolatedFactory({ ...options, replace: ['fileCount++;', '/* omitted count */'] }))({ root }).createReadSession();
  await mutant.read(oid(1)); expect(await mutant.read(oid(2))).toEqual(evidence(2));
});
test('mutation sensitivity: removing the byte charge bypasses budget; normal denial allocates no buffer', async () => {
  await put(evidence(1)); await put(evidence(2));
  const size = (await fs.stat(filename(1))).size, allocations = [];
  const options = { limits: { MAX_DEPENDENCY_BYTES: size }, allocations };
  const good = (await isolatedFactory(options))({ root }).createReadSession();
  await good.read(oid(1)); allocations.length = 0;
  await expect(good.read(oid(2))).rejects.toMatchObject({ code: INVALID }); expect(allocations).toEqual([]);
  const mutant = (await isolatedFactory({ ...options, replace: ['byteCount += size;', '/* omitted bytes */'] }))({ root }).createReadSession();
  await mutant.read(oid(1)); expect(await mutant.read(oid(2))).toEqual(evidence(2));
});
test('mutation sensitivity: pathname pre-stat charging misses valid growth before opened fstat', async () => {
  const small = evidence(), large = evidence(4, 'committed'), size = Buffer.byteLength(codec.serializeEvidence(small));
  const allocations = [], options = { limits: { MAX_DEPENDENCY_BYTES: size }, allocations };
  const good = (await isolatedFactory(options))({ root });
  const mutant = (await isolatedFactory({ ...options, replace: ['reserve(opened.size);', 'reserve(named.size);'] }))({ root });
  for (const [instance, rejected] of [[good, true], [mutant, false]]) {
    await put(small); allocations.length = 0;
    const records = trace({ beforeOpen: async name => {
      if (name === filename(4)) await fs.writeFile(name, codec.serializeEvidence(large));
    } });
    if (rejected) {
      await expect(instance.read(oid(4))).rejects.toMatchObject({ code: INVALID });
      expect(allocations).toEqual([]); expect(files(records)[0].reads).toBe(0);
    } else expect(await instance.read(oid(4))).toEqual(large);
    expect(records.every(r => r.closed)).toBe(true); jest.restoreAllMocks();
  }
});
test('mutation sensitivity: evicting rejected promises allows a forbidden same-session repair retry', async () => {
  const good = reader();
  const mutant = (await isolatedFactory({ replace: ['entries.set(mediaId, loading);',
    'entries.set(mediaId, loading); loading.catch(() => entries.delete(mediaId));'] }))({ root });
  for (const [instance, rejected] of [[good, true], [mutant, false]]) {
    await put(evidence()); await fs.writeFile(filename(4), '{}\n');
    const session = instance.createReadSession();
    await expect(session.read(oid(4))).rejects.toMatchObject({ code: INVALID });
    await put(evidence());
    if (rejected) await expect(session.read(oid(4))).rejects.toMatchObject({ code: INVALID });
    else expect(await session.read(oid(4))).toEqual(evidence());
  }
});

describe('D2a standalone legacy reader', () => {
  test.each(['empty', 'committed'])('actual legacy writer %s projection is independently valid and detached', async kind => {
    const value = legacy(evidence(4, kind));
    await createMediaDeletionJournal({ root }).persist(value);
    const result = await reader().readLegacy(oid(4)); expect(result).toEqual(value);
    result.tombstone.actorId = oid(99);
    expect(await reader().readLegacy(oid(4))).toEqual(value);
    expect(await reader().read(oid(4))).toBeNull();
  });
  test('safe initial missing file/root returns null, but cannot replace known invalid v2', async () => {
    expect(await reader().readLegacy(oid(4))).toBeNull();
    await fs.rmdir(root); expect(await reader().readLegacy(oid(4))).toBeNull();
    await put(evidence(), true); await fs.writeFile(filename(4), '{}\n');
    expect(await reader().readLegacy(oid(4))).toEqual(legacy(evidence()));
    await expect(reader().read(oid(4))).rejects.toMatchObject({ code: INVALID });
  });
  test.each([
    ['tombstone.mediaId', oid(5)], ['tombstone.familyId', 'ABCDEFABCDEFABCDEFABCDEF'],
    ['tombstone.childId', oid(2) + '\r'], ['tombstone.actorId', 5], ['tombstone.role', 'admin'],
    ['tombstone.purpose', 'avatar'], ['tombstone.reason', 'system'], ['tombstone.deletedAt', '2026-10-23'],
    ['receipts.0.mediaId', oid(5)], ['receipts.0.familyId', oid(5)], ['receipts.0.childId', oid(5)],
    ['receipts.0.resourceId', 'bad'], ['receipts.0.resourceType', 'homework'], ['receipts.0.field', 'images'],
    ['receipts.0.bindingOperationId', uuid(99).toUpperCase() + '\n'], ['receipts.0.releasedAt', 'invalid']
  ])('rejects legacy semantic violation %s', async (field, replacement) => {
    const value = legacy(evidence(4, 'committed')), keys = field.split('.');
    let container = value; for (const key of keys.slice(0, -1)) container = container[key];
    container[keys.at(-1)] = replacement;
    await fs.writeFile(filename(4, 1), JSON.stringify(value) + '\n', { mode: 0o600 });
    await expect(reader().readLegacy(oid(4))).rejects.toMatchObject({ code: INVALID });
  });
  test('student actor must be child and duplicate receipt bindings are rejected', async () => {
    const value = legacy(evidence(4, 'committed')); value.tombstone.role = 'student';
    await fs.writeFile(filename(4, 1), JSON.stringify(value) + '\n', { mode: 0o600 });
    await expect(reader().readLegacy(oid(4))).rejects.toMatchObject({ code: INVALID });
    value.tombstone.actorId = value.tombstone.childId;
    await fs.writeFile(filename(4, 1), JSON.stringify(value) + '\n');
    expect(await reader().readLegacy(oid(4))).toEqual(value);
    value.receipts.push({ ...value.receipts[0] });
    await fs.writeFile(filename(4, 1), JSON.stringify(value) + '\n');
    await expect(reader().readLegacy(oid(4))).rejects.toMatchObject({ code: INVALID });
  });
  test.each(['unknown', 'duplicate-key', 'utf8', 'newline', 'oversize'])('rejects legacy %s without paired proof', async kind => {
    let value = JSON.stringify(legacy(evidence())) + '\n';
    if (kind === 'unknown') value = value.replace('{', '{"extra":1,');
    if (kind === 'duplicate-key') value = value.replace('"receipts":', '"receipts":[],"receipts":');
    if (kind === 'utf8') value = Buffer.from([0xff]);
    if (kind === 'newline') value = value.trimEnd();
    if (kind === 'oversize') value = Buffer.alloc(2 * 1024 * 1024 + 1);
    await fs.writeFile(filename(4, 1), value, { mode: 0o600 });
    const records = trace(); await expect(reader().readLegacy(oid(4))).rejects.toMatchObject({ code: INVALID });
    if (kind === 'oversize') expect(files(records)[0].reads).toBe(0);
    expect(records.every(r => r.closed)).toBe(true);
  });
  test('legacy growth uses the same single detector and closes on failure', async () => {
    await put(evidence(), true); const size = (await fs.stat(filename(4, 1))).size;
    const records = trace({ stat: async r => {
      if (r.name === filename(4, 1) && r.stats === 1) await fs.appendFile(r.name, Buffer.alloc(1024));
    } });
    await expect(reader().readLegacy(oid(4))).rejects.toMatchObject({ code: INVALID });
    expect(files(records)[0].bytes).toBe(size + 1); expect(records.every(r => r.closed)).toBe(true);
  });
});

const collectInventory = async instance => {
  const values = []; for await (const value of instance.inventory()) values.push(value); return values;
};
const traceInventory = (hooks = {}) => {
  const opendir = fs.opendir.bind(fs), records = [];
  jest.spyOn(fs, 'opendir').mockImplementation(async (name, options) => {
    const dir = await opendir(name, options), record = { name, options, reads: 0, closed: false };
    records.push(record);
    const read = dir.read.bind(dir), close = dir.close.bind(dir);
    dir.read = async () => {
      record.reads++; const entry = await read();
      if (hooks.read) await hooks.read(record, entry);
      return entry;
    };
    dir.close = async () => {
      if (hooks.beforeClose) await hooks.beforeClose(record);
      await close(); record.closed = true;
      if (hooks.close) await hooks.close(record);
    };
    if (hooks.open) await hooks.open(record);
    return dir;
  });
  return records;
};
describe('D2a protected streaming inventory', () => {
  test('streams more than 100 entries, paired IDs once per namespace, never loads bodies or other protocols', async () => {
    for (let i = 1; i <= 105; i++) await put(evidence(i), true);
    for (const name of ['uploads-v1', 'orphan-retirements-v1']) {
      await fs.mkdir(path.join(root, name), { mode: 0o700 });
      await fs.writeFile(path.join(root, name, 'not-our-protocol'), 'ignored');
    }
    const handles = trace({ read: () => { throw Error('Inventory must not read content'); } }), dirs = traceInventory();
    jest.spyOn(fs, 'readdir').mockImplementation(() => { throw Error('Unbounded scan'); });
    const values = await collectInventory(reader());
    expect(values).toHaveLength(210);
    for (let i = 1; i <= 105; i++) for (const version of [1, 2]) {
      expect(values.filter(v => v.mediaId === oid(i) && v.version === version)).toHaveLength(1);
    }
    expect(values.every(v => Object.keys(v).sort().join(',') === 'mediaId,version')).toBe(true);
    expect(dirs.map(d => d.name).sort()).toEqual([root, v2root].sort());
    expect(dirs.every(d => d.options.bufferSize === 32 && d.closed)).toBe(true);
    expect(handles.every(h => h.closed)).toBe(true); expect(files(handles)).toHaveLength(0);
  });
  test('absent v2 and empty base are valid, but missing base fails without creation', async () => {
    expect(await collectInventory(reader())).toEqual([]);
    expect(await fs.readdir(root)).toEqual([]);
    await fs.rmdir(root); await expect(collectInventory(reader())).rejects.toMatchObject({ code: PENDING });
    expect(await fs.readdir(base)).toEqual([]);
  });
  test.each(['unexpected', '.temporary', 'ABCDEFABCDEFABCDEFABCDEF.json', oid(4) + '.JSON', oid(4) + '.json\n'])(
    'rejects noncanonical base name %j', async name => {
      await fs.writeFile(path.join(root, name), '', { mode: 0o600 });
      await expect(collectInventory(reader())).rejects.toMatchObject({ code: INVALID });
    });
  test.each(['file-mode', 'file-directory', 'file-symlink', 'namespace-file', 'namespace-mode', 'namespace-symlink', 'root-mode', 'root-symlink', 'v2-unknown'])(
    'rejects inventory unsafe %s using lstat rather than dirent trust', async kind => {
      await put(evidence(), true);
      if (kind === 'file-mode') await fs.chmod(filename(4, 1), 0o644);
      if (kind === 'file-directory' || kind === 'file-symlink') {
        await fs.unlink(filename(4, 1));
        if (kind === 'file-directory') await fs.mkdir(filename(4, 1)); else await fs.symlink(filename(4), filename(4, 1));
      }
      if (kind.startsWith('namespace')) {
        const target = path.join(root, 'uploads-v1');
        if (kind === 'namespace-file') await fs.writeFile(target, '');
        if (kind === 'namespace-mode') await fs.mkdir(target, { mode: 0o755 });
        if (kind === 'namespace-symlink') await fs.symlink(v2root, target);
      }
      if (kind === 'root-mode') await fs.chmod(root, 0o755);
      if (kind === 'root-symlink') { await fs.rename(root, root + '-old'); await fs.symlink(root + '-old', root); }
      if (kind === 'v2-unknown') await fs.writeFile(path.join(v2root, 'uploads-v1'), '');
      await expect(collectInventory(reader())).rejects.toMatchObject({ code: INVALID });
    });
  test.each(['early-break', 'early-return', 'consumer-throw'])('closes enumeration and all pinned handles on %s', async kind => {
    await put(evidence(), true); const handles = trace(), dirs = traceInventory();
    if (kind === 'early-return') { const iterator = reader().inventory(); await iterator.next(); await iterator.return(); }
    else {
      try { for await (const entry of reader().inventory()) { expect(entry.mediaId).toBe(oid(4)); if (kind === 'consumer-throw') throw Error('Consumer'); break; } }
      catch (cause) { expect(cause.message).toBe('Consumer'); }
    }
    expect(dirs.length).toBeGreaterThan(0); expect(dirs.every(d => d.closed)).toBe(true);
    expect(handles.every(h => h.closed)).toBe(true);
  });
  test.each(['root-add', 'root-replace', 'ancestor-replace', 'v2-appears'])('resume fails after %s', async action => {
    await put(evidence(), action !== 'v2-appears');
    if (action === 'v2-appears') { await fs.writeFile(filename(4, 1), '{}\n', { mode: 0o600 }); await fs.rm(v2root, { recursive: true }); }
    const dirs = traceInventory(), handles = trace(), iterator = reader().inventory();
    expect((await iterator.next()).done).toBe(false);
    if (action === 'root-add') await fs.writeFile(filename(5, 1), '', { mode: 0o600 });
    if (action === 'root-replace') { await fs.rename(root, root + '-old'); await fs.mkdir(root, { mode: 0o700 }); }
    if (action === 'ancestor-replace') { await fs.rename(base, base + '-old'); await fs.symlink(base + '-old', base); }
    if (action === 'v2-appears') await fs.mkdir(v2root, { mode: 0o700 });
    try { await expect(iterator.next()).rejects.toMatchObject({ code: INVALID }); }
    finally { if (action === 'ancestor-replace') { await fs.unlink(base); await fs.rename(base + '-old', base); } }
    expect(dirs.every(d => d.closed)).toBe(true); expect(handles.every(h => h.closed)).toBe(true);
  });
  test('previously scanned base is rechecked while yielding v2 and at final resume', async () => {
    await put(evidence()); const iterator = reader().inventory();
    expect(await iterator.next()).toEqual({ value: { version: 2, mediaId: oid(4) }, done: false });
    await fs.writeFile(filename(5, 1), '', { mode: 0o600 });
    await expect(iterator.next()).rejects.toMatchObject({ code: INVALID });
  });
  test.each(['read-eof', 'close', 'path-swap-open', 'absent-at-eof'])('terminal %s fails and closes all resources', async kind => {
    if (kind !== 'absent-at-eof') await put(evidence());
    const handles = trace(), dirs = traceInventory({
      read: async (record, entry) => {
        if (entry === null && kind === 'read-eof') throw Error('/secret EOF');
        if (entry === null && kind === 'absent-at-eof') await fs.mkdir(v2root, { mode: 0o700 });
      },
      close: () => { if (kind === 'close') throw Error('/secret close'); },
      open: async record => { if (kind === 'path-swap-open') { await fs.rename(record.name, record.name + '-old'); await fs.mkdir(record.name, { mode: 0o700 }); } }
    });
    await expect(collectInventory(reader())).rejects.toMatchObject({ code: ['read-eof', 'close'].includes(kind) ? PENDING : INVALID });
    expect(dirs.every(d => d.closed)).toBe(true); expect(handles.every(h => h.closed)).toBe(true);
  });
  test('primary invalid survives a secondary close failure', async () => {
    await fs.writeFile(path.join(root, 'bad'), '', { mode: 0o600 });
    const dirs = traceInventory({ close: () => { throw Error('close'); } });
    await expect(collectInventory(reader())).rejects.toMatchObject({ code: INVALID });
    expect(dirs.every(d => d.closed)).toBe(true);
  });
  test('inventory and standalone legacy read perform no writes, syncs, or body inventory loading', async () => {
    await put(evidence(), true);
    for (const method of ['mkdir', 'chmod', 'writeFile', 'appendFile', 'link', 'unlink', 'rename']) {
      jest.spyOn(fs, method).mockImplementation(() => { throw Error('Unexpected mutation'); });
    }
    const handles = trace({ forbidSync: true });
    expect(await collectInventory(reader())).toHaveLength(2);
    expect(await reader().readLegacy(oid(4))).toEqual(legacy(evidence()));
    expect(handles.every(h => h.closed)).toBe(true);
  });
  test('discovered file disappearing before lstat fails instead of silently truncating inventory', async () => {
    await put(evidence(), true);
    const dirs = traceInventory({ read: async (record, entry) => {
      if (entry?.name === oid(4) + '.json') await fs.unlink(path.join(record.name, entry.name));
    } });
    await expect(collectInventory(reader())).rejects.toMatchObject({ code: INVALID });
    expect(dirs.every(d => d.closed)).toBe(true);
  });
  test('absent namespace is explicitly rechecked even without a detected parent timestamp change', async () => {
    await put(evidence()); const lstat = fs.lstat.bind(fs); let absent = false;
    jest.spyOn(fs, 'lstat').mockImplementation(async name => {
      if (name === v2root && !absent) { absent = true; throw Object.assign(Error('Synthetic first absence'), { code: 'ENOENT' }); }
      return lstat(name);
    });
    const handles = trace();
    await expect(collectInventory(reader())).rejects.toMatchObject({ code: INVALID });
    expect(handles.every(h => h.closed)).toBe(true);
  });
  test('early return propagates a close failure instead of acknowledging successful resource release', async () => {
    await put(evidence(), true); const dirs = traceInventory({ close: () => { throw Error('/secret close'); } });
    const iterator = reader().inventory(); await iterator.next();
    await expect(iterator.return()).rejects.toMatchObject({ code: PENDING, message: PENDING });
    expect(dirs.every(d => d.closed)).toBe(true);
  });
  test('mutation sensitivity: directory ctime guards detect change when identity/mode/mtime are unchanged', async () => {
    await put(evidence());
    const mutant = (await isolatedFactory({ replace: ['&& stat.ctimeMs === entry.stat.ctimeMs', '/* omitted ctime */'] }))({ root });
    for (const [instance, rejected] of [[reader(), true], [mutant, false]]) {
      const iterator = instance.inventory(); expect((await iterator.next()).done).toBe(false);
      const before = await fs.stat(root); await new Promise(resolve => setTimeout(resolve, 15));
      await fs.chmod(root, 0o700); const after = await fs.stat(root);
      expect(after.ino).toBe(before.ino); expect(after.mtimeMs).toBe(before.mtimeMs); expect(after.ctimeMs).not.toBe(before.ctimeMs);
      if (rejected) await expect(iterator.next()).rejects.toMatchObject({ code: INVALID });
      else expect((await iterator.next()).done).toBe(true);
    }
  });
  test('mutation sensitivity: disabling stable directory timestamps misses additions during suspended iteration', async () => {
    await put(evidence());
    const mutant = (await isolatedFactory({ replace: ['const scope = createDirectoryScope(true);',
      'const scope = createDirectoryScope(false);'] }))({ root });
    for (const [instance, rejected] of [[reader(), true], [mutant, false]]) {
      const iterator = instance.inventory(); expect((await iterator.next()).done).toBe(false);
      await fs.writeFile(filename(5, 1), '', { mode: 0o600 });
      if (rejected) await expect(iterator.next()).rejects.toMatchObject({ code: INVALID });
      else expect((await iterator.next()).done).toBe(true);
      await fs.unlink(filename(5, 1));
    }
  });
  test('mutation sensitivity: omitting legacy semantics accepts duplicate receipt bindings', async () => {
    const value = legacy(evidence(4, 'committed')); value.receipts.push(value.receipts[0]);
    await fs.writeFile(filename(4, 1), JSON.stringify(value) + '\n', { mode: 0o600 });
    await expect(reader().readLegacy(oid(4))).rejects.toMatchObject({ code: INVALID });
    const mutant = (await isolatedFactory({ replace: ['validateLegacy(value, mediaId);', '/* omitted legacy validation */'] }))({ root });
    expect(await mutant.readLegacy(oid(4))).toEqual(value);
  });
  test('mutation sensitivity: EOF cannot be acknowledged before the opendir handle closes', async () => {
    const mutant = (await isolatedFactory({ replace: ['await closing.close();', 'closing.close();'] }))({ root });
    for (const [instance, shouldWait] of [[reader(), true], [mutant, false]]) {
      let enter, release, closed;
      const entered = new Promise(resolve => { enter = resolve; });
      const held = new Promise(resolve => { release = resolve; });
      const finished = new Promise(resolve => { closed = resolve; });
      const dirs = traceInventory({ beforeClose: async () => { enter(); await held; }, close: () => { closed(); } });
      let settled = false;
      const scanning = collectInventory(instance).finally(() => { settled = true; });
      try {
        await entered; await new Promise(resolve => setTimeout(resolve, 20)); expect(settled).toBe(!shouldWait);
      } finally { release(); await scanning; await finished; }
      expect(dirs.every(d => d.closed)).toBe(true); jest.restoreAllMocks();
    }
  });
});

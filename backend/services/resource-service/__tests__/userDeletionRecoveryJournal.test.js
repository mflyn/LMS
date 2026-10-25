const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { TextDecoder } = require('util');
const { canonicalize } = require('json-canonicalize');
const proof = require('../services/userDeletionRecoveryEvidence');
const { makeUnsignedEvidence, uuid, oid } = require('./fixtures/userDeletionRecoveryEvidence');
const { createUserDeletionRecoveryJournal } = require('../services/userDeletionRecoveryJournal');
const modulePath = require.resolve('../services/userDeletionRecoveryJournal');

let base, root, destination;
const evidence = (kind = 'empty') => proof.sealEvidence(makeUnsignedEvidence(kind));
const bytes = value => Buffer.from(canonicalize(value) + '\n');
const journal = () => createUserDeletionRecoveryJournal({ root });
beforeEach(async () => {
  base = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'lms-t2-udr-b-journal-'));
  root = path.join(base, 'user-deletions-v2');
  destination = path.join(root, oid(4) + '.json');
});
afterEach(async () => { jest.restoreAllMocks(); await fs.rm(base, { recursive: true, force: true }); });

// Keep all filesystem effects real; intercept only the failure or wait under test.
const traceFilesystem = ({ fail, hold } = {}) => {
  const events = [], handles = [];
  let cleaned = false, release, enter;
  const blocked = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { enter = resolve; });
  const step = async (name, work) => {
    events.push(name);
    if (name === fail) throw Error('Synthetic ' + name);
    const result = await work();
    if (name === hold) { enter(); await blocked; }
    return result;
  };
  const open = fs.open.bind(fs), link = fs.link.bind(fs), unlink = fs.unlink.bind(fs);
  jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await open(...args), sync = handle.sync.bind(handle), close = handle.close.bind(handle);
    const write = handle.writeFile.bind(handle);
    const record = { path: args[0], closed: false }; handles.push(record);
    handle.sync = () => step(args[0] === base ? 'parent-sync' : args[0] === root
      ? (cleaned ? 'cleanup-sync' : 'publish-sync') : args[0] === destination ? 'existing-sync' : 'file-sync', sync);
    handle.writeFile = (...values) => step('write', () => write(...values));
    handle.close = async () => { events.push('close:' + args[0]); await close(); record.closed = true; };
    return handle;
  });
  jest.spyOn(fs, 'link').mockImplementation((...args) => step('publish', () => link(...args)));
  jest.spyOn(fs, 'unlink').mockImplementation((...args) => step('unlink', async () => {
    await unlink(...args); cleaned = true;
  }));
  return { events, handles, entered, release };
};

test.each(['empty', 'committed', 'prepared', 'history'])('canonical %s evidence round trips with private permissions and void persist', async kind => {
  const input = evidence(kind), trace = traceFilesystem();
  expect(await journal().persist(input)).toBeUndefined();
  expect(await fs.readFile(destination)).toEqual(bytes(input));
  expect(await journal().read(oid(4))).toEqual(input);
  expect((await fs.stat(root)).mode & 0o7777).toBe(0o700);
  expect((await fs.stat(destination)).mode & 0o7777).toBe(0o600);
  expect(trace.events.filter(e => !e.startsWith('close:')))
    .toEqual(['parent-sync', 'write', 'file-sync', 'publish', 'publish-sync', 'unlink', 'cleanup-sync']);
  expect(trace.handles.every(h => h.closed)).toBe(true);
  expect(await fs.readdir(root)).toEqual([oid(4) + '.json']);
});
test('read absence is side-effect free for a missing root and missing destination', async () => {
  expect(await journal().read(oid(4))).toBeNull();
  expect(await fs.readdir(base)).toEqual([]);
  await fs.mkdir(root, { mode: 0o700 });
  expect(await journal().read(oid(4))).toBeNull();
  expect(await fs.readdir(root)).toEqual([]);
});
test('snapshots caller input before first await and returns detached reads', async () => {
  const input = evidence('prepared'), expected = structuredClone(input);
  const writing = journal().persist(input);
  input.evidenceId = uuid(99); input.operations.length = 0;
  await writing;
  const read = await journal().read(oid(4)); expect(read).toEqual(expected);
  read.uploadIdentity.metadataHash = 'c'.repeat(64);
  expect(await journal().read(oid(4))).toEqual(expected);
});
test('concurrent identical writers converge without replacing the existing inode or original bytes', async () => {
  await Promise.all(Array.from({ length: 4 }, () => journal().persist(evidence())));
  const before = await fs.stat(destination);
  await journal().persist(Object.fromEntries(Object.entries(evidence()).reverse()));
  expect((await fs.stat(destination)).ino).toBe(before.ino);
  expect(await fs.readFile(destination)).toEqual(bytes(evidence()));
  expect(await fs.readdir(root)).toEqual([oid(4) + '.json']);
});
test('concurrent conflicting first writers have one winner and cannot overwrite it', async () => {
  const other = makeUnsignedEvidence('empty'); other.evidenceId = uuid(9);
  const inputs = [evidence(), proof.sealEvidence(other)];
  const outcomes = await Promise.allSettled(inputs.map(value => journal().persist(value)));
  expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
  expect(await journal().read(oid(4))).toEqual(inputs[outcomes.findIndex(o => o.status === 'fulfilled')]);
  expect(await fs.readdir(root)).toEqual([oid(4) + '.json']);
});
test.each(['parent-sync', 'write', 'file-sync', 'publish', 'publish-sync', 'cleanup-sync', 'existing-sync'])(
  '%s failure rejects, closes handles and retry durably preserves the same evidence', async phase => {
    if (phase === 'existing-sync') await journal().persist(evidence());
    const trace = traceFilesystem({ fail: phase });
    await expect(journal().persist(evidence())).rejects.toThrow('Synthetic ' + phase);
    expect(trace.events).toContain(phase);
    expect(trace.handles.every(h => h.closed)).toBe(true);
    jest.restoreAllMocks();
    await journal().persist(evidence());
    expect(await journal().read(oid(4))).toEqual(evidence());
    expect(await fs.readdir(root)).toEqual([oid(4) + '.json']);
  });
test.each(['parent-sync', 'file-sync', 'publish-sync', 'cleanup-sync', 'existing-sync'])(
  '%s is awaited before continuing or acknowledging', async phase => {
    if (phase === 'existing-sync') await journal().persist(evidence());
    const trace = traceFilesystem({ hold: phase });
    let settled = false;
    const writing = journal().persist(evidence()).finally(() => { settled = true; });
    try {
      await Promise.race([trace.entered, writing]);
      const boundary = trace.events.length;
      await new Promise(resolve => setTimeout(resolve, 25));
      expect(settled).toBe(false);
      expect(trace.events.length).toBe(boundary);
    } finally { trace.release(); await writing; }
    expect(trace.handles.every(h => h.closed)).toBe(true);
  });
test('failure cleanup also waits for directory sync and closes every opened handle', async () => {
  const trace = traceFilesystem({ fail: 'write', hold: 'cleanup-sync' });
  let settled = false;
  const writing = journal().persist(evidence()).then(() => null, error => error).finally(() => { settled = true; });
  try {
    await Promise.race([trace.entered, writing]);
    await new Promise(resolve => setTimeout(resolve, 25));
    expect(settled).toBe(false);
    expect(await fs.readdir(root)).toEqual([]);
  } finally { trace.release(); expect(await writing).toBeInstanceOf(Error); }
  expect(trace.handles.every(h => h.closed)).toBe(true);
});
test.each(['', '/', 'relative', '/absolute/../escape', '/absolute/'])('rejects invalid root %j', value => {
  expect(() => createUserDeletionRecoveryJournal({ root: value })).toThrow();
});
test('missing parent is an error even for read; never creates ancestors', async () => {
  root = path.join(base, 'missing', 'user-deletions-v2');
  await expect(journal().persist(evidence())).rejects.toThrow();
  await expect(journal().read(oid(4))).rejects.toThrow();
  expect(await fs.readdir(base)).toEqual([]);
});
test.each(['../escape', oid(4) + '\n', oid(4) + '\r', 'ABCDEFABCDEFABCDEFABCDEF', null])('rejects invalid media id %j', async value => {
  await expect(journal().read(value)).rejects.toThrow();
  expect(await fs.readdir(base)).toEqual([]);
});
test.each(['root symlink', 'ancestor symlink', 'root file', 'root mode', 'file symlink', 'file directory', 'file mode'])(
  'rejects %s without repairing modes or following paths', async kind => {
    const target = path.join(base, 'target'); await fs.mkdir(target, { mode: 0o700 });
    if (kind === 'root symlink') await fs.symlink(target, root);
    else if (kind === 'ancestor symlink') {
      const alias = path.join(base, 'alias'); await fs.symlink(target, alias);
      root = path.join(alias, 'user-deletions-v2');
    } else if (kind === 'root file') await fs.writeFile(root, 'x');
    else {
      await fs.mkdir(root, { mode: 0o700 });
      if (kind === 'root mode') await fs.chmod(root, 0o755);
      else if (kind === 'file symlink') {
        const file = path.join(target, 'proof'); await fs.writeFile(file, bytes(evidence()), { mode: 0o600 });
        await fs.symlink(file, destination);
      } else if (kind === 'file directory') await fs.mkdir(destination);
      else await fs.writeFile(destination, bytes(evidence()), { mode: 0o644 });
    }
    await expect(journal().persist(evidence())).rejects.toThrow();
    await expect(journal().read(oid(4))).rejects.toThrow();
    if (kind === 'root mode') expect((await fs.stat(root)).mode & 0o777).toBe(0o755);
    if (kind === 'ancestor symlink') expect(await fs.readdir(target)).toEqual([]);
  });
test.each(['duplicate key', 'whitespace', 'missing newline', 'invalid utf8', 'unknown field', 'bad hash', 'wrong media', 'oversize'])(
  'read and retry reject %s bytes without replacement', async kind => {
    await fs.mkdir(root, { mode: 0o700 });
    let content = bytes(evidence());
    if (kind === 'duplicate key') content = Buffer.from(content.toString().replace('{', '{"version":2,'));
    if (kind === 'whitespace') content = Buffer.concat([Buffer.from(' '), content]);
    if (kind === 'missing newline') content = content.subarray(0, -1);
    if (kind === 'invalid utf8') content = Buffer.concat([content, Buffer.from([0xff])]);
    if (kind === 'unknown field') content = bytes({ ...evidence(), extra: true });
    if (kind === 'bad hash') content = bytes({ ...evidence(), evidenceHash: 'f'.repeat(64) });
    if (kind === 'wrong media') {
      const other = makeUnsignedEvidence('empty'); other.tombstone.mediaId = oid(90); other.uploadIdentity.mediaId = oid(90);
      content = bytes(proof.sealEvidence(other));
    }
    if (kind === 'oversize') content = Buffer.alloc(proof.LIMITS.MAX_BYTES + 1, 32);
    await fs.writeFile(destination, content, { mode: 0o600 });
    await expect(journal().read(oid(4))).rejects.toThrow();
    await expect(journal().persist(evidence())).rejects.toThrow();
    expect((await fs.readFile(destination)).equals(content)).toBe(true);
  });
test('invalid object evidence is rejected before any filesystem work', async () => {
  const input = evidence(); Object.defineProperty(input, 'evidenceHash', { get() { throw Error('getter called'); } });
  await expect(journal().persist(input)).rejects.not.toThrow('getter called');
  expect(await fs.readdir(base)).toEqual([]);
});
test('lstat/open inode replacement is rejected and handles are closed', async () => {
  await journal().persist(evidence());
  const original = fs.open.bind(fs); let swapped = false, opened, closed = false;
  jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    if (args[0] === destination && !swapped) {
      swapped = true; await fs.rename(destination, destination + '.old');
      await fs.writeFile(destination, bytes(evidence()), { mode: 0o600 });
    }
    const handle = await original(...args);
    if (args[0] === destination) { opened = handle; const close = handle.close.bind(handle);
      handle.close = async () => { await close(); closed = true; }; }
    return handle;
  });
  await expect(journal().read(oid(4))).rejects.toThrow();
  expect(opened).toBeDefined(); expect(closed).toBe(true);
});
test.each(['publication', 'existing fsync'])('rejects destination replacement during %s without overwriting the replacement', async phase => {
  const altered = makeUnsignedEvidence('empty'); altered.evidenceId = uuid(100);
  const replacement = bytes(proof.sealEvidence(altered));
  const swap = async () => {
    await fs.rename(destination, destination + '.original');
    await fs.writeFile(destination, replacement, { mode: 0o600 });
  };
  if (phase === 'publication') {
    const link = fs.link.bind(fs);
    jest.spyOn(fs, 'link').mockImplementation(async (...args) => { await link(...args); await swap(); });
  } else {
    await journal().persist(evidence());
    const open = fs.open.bind(fs);
    jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
      const handle = await open(...args);
      if (args[0] === destination) { const sync = handle.sync.bind(handle);
        handle.sync = async () => { await sync(); await swap(); }; }
      return handle;
    });
  }
  await expect(journal().persist(evidence())).rejects.toThrow();
  expect((await fs.readFile(destination)).equals(replacement)).toBe(true);
});
test('root lstat/open replacement is rejected without creating files in the substituted directory', async () => {
  await fs.mkdir(root, { mode: 0o700 });
  const open = fs.open.bind(fs); let swapped = false;
  jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    if (args[0] === root && !swapped) {
      swapped = true; await fs.rename(root, root + '.old'); await fs.mkdir(root, { mode: 0o700 });
    }
    return open(...args);
  });
  await expect(journal().persist(evidence())).rejects.toThrow();
  expect(await fs.readdir(root)).toEqual([]);
  expect(await fs.readdir(root + '.old')).toEqual([]);
});
test('bounded read detects file growth after stat without allocating or reading the appended extent', async () => {
  await journal().persist(evidence());
  const open = fs.open.bind(fs); const requests = []; let grew = false, closed = false;
  jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await open(...args);
    if (args[0] === destination) {
      const read = handle.read.bind(handle), close = handle.close.bind(handle);
      handle.read = async (...values) => {
        requests.push({ allocation: values[0].length, length: values[2] });
        if (!grew) { grew = true; await fs.appendFile(destination, Buffer.alloc(proof.LIMITS.MAX_BYTES + 1)); }
        return read(...values);
      };
      handle.close = async () => { await close(); closed = true; };
    }
    return handle;
  });
  await expect(journal().read(oid(4))).rejects.toThrow();
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every(r => r.allocation <= bytes(evidence()).length + 1)).toBe(true);
  expect(requests.reduce((sum, r) => sum + r.length, 0)).toBeLessThanOrEqual(proof.LIMITS.MAX_BYTES + 1);
  expect(closed).toBe(true);
});
test('read does not downgrade EACCES to missing evidence', async () => {
  await journal().persist(evidence());
  const open = fs.open.bind(fs);
  jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    if (args[0] === destination) throw Object.assign(Error('Synthetic access refusal'), { code: 'EACCES' });
    return open(...args);
  });
  await expect(journal().read(oid(4))).rejects.toMatchObject({ code: 'EACCES' });
});

// Each mutant runs against real temporary files with the same held-fsync oracle.
const loadMutation = async (site, removeAwait) => {
  let source = await fs.readFile(modulePath, 'utf8');
  const expression = {
    parent: 'await parent.handle.sync();', file: 'await temporaryHandle.sync();',
    existing: 'await existingHandle.sync();', publish: 'await directory.handle.sync(); // Published entry',
    cleanup: 'await directory.handle.sync(); // Removed temporary entry'
  }[site];
  expect(source.split(expression)).toHaveLength(2);
  source = source.replace(expression, removeAwait ? expression.replace('await ', '') : '');
  const context = { module: { exports: {} }, Buffer, TextDecoder, require: name => {
    if (name === './userDeletionRecoveryEvidence') return proof;
    if (['fs/promises', 'fs', 'path', 'crypto', 'util'].includes(name)) return require(name);
    throw Error('Unexpected journal import');
  } };
  vm.runInNewContext(source, context, { filename: modulePath });
  return context.module.exports.createUserDeletionRecoveryJournal;
};
test.each(['parent', 'file', 'existing', 'publish', 'cleanup'].flatMap(site => [
  [site, false], [site, true]
]))('durability oracle detects removal at %s (await only: %s)', async (site, removeAwait) => {
  if (site === 'existing') await journal().persist(evidence());
  const factory = await loadMutation(site, removeAwait);
  const phase = { parent: 'parent-sync', file: 'file-sync', existing: 'existing-sync', publish: 'publish-sync', cleanup: 'cleanup-sync' }[site];
  const trace = traceFilesystem({ hold: phase });
  let settled = false;
  const writing = factory({ root }).persist(evidence()).finally(() => { settled = true; });
  try {
    await Promise.race([trace.entered, writing]);
    const boundary = trace.events.length;
    await new Promise(resolve => setTimeout(resolve, 40));
    const respected = trace.events.includes(phase) && !settled && trace.events.length === boundary;
    expect(respected).toBe(false);
  } finally { trace.release(); await writing; }
});

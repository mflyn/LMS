const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { assertCompletionStorageReadiness, assertCompletionStorageStructure } = require('../services/completionStorageReadiness');

let base, env;
beforeEach(async () => {
  base = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'completion-storage-')));
  await fs.chmod(base, 0o700);
  env = { PRIVATE_MEDIA_ROOT: path.join(base, 'media'),
    COMPLETION_DELETION_JOURNAL_ROOT: path.join(base, 'journal'), COMPLETION_STORAGE_CONFIRMED: 'true' };
  for (const root of [env.PRIVATE_MEDIA_ROOT, env.COMPLETION_DELETION_JOURNAL_ROOT]) await fs.mkdir(root, { mode: 0o700 });
});
afterEach(async () => { jest.restoreAllMocks(); await fs.rm(base, { recursive: true, force: true }); });
const run = () => assertCompletionStorageReadiness({ env });
test.each(['PRIVATE_MEDIA_ROOT', 'COMPLETION_DELETION_JOURNAL_ROOT'])('rejects a foreign owner on %s before probing', async key => {
  const original = fs.lstat;
  jest.spyOn(fs, 'lstat').mockImplementation(async file => {
    const stat = await original(file);
    if (file === env[key]) stat.uid = process.getuid() + 1;
    return stat;
  });
  const open = jest.spyOn(fs, 'open');
  await expect(run()).rejects.toMatchObject({ code: 'COMPLETION_STORAGE_NOT_READY' });
  expect(open).not.toHaveBeenCalled();
  expect(await fs.readdir(env[key])).toEqual([]);
  expect((await fs.stat(env[key])).mode & 0o777).toBe(0o700);
});
test('enabled retention namespaces are checked without provisioning missing directories', async () => {
  env.COMPLETION_PROTOCOL_MODE = 'enabled';
  await run();
  expect(await fs.readdir(env.COMPLETION_DELETION_JOURNAL_ROOT)).toEqual([]);
  for (const name of ['uploads-v1', 'orphan-retirements-v1']) {
    const directory = path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, name);
    await fs.mkdir(directory, { mode: 0o700 });
    await run();
    expect(await fs.readdir(directory)).toEqual([]);
    await fs.chmod(directory, 0o755);
    await expect(run()).rejects.toMatchObject({ code: 'COMPLETION_STORAGE_NOT_READY' });
    await fs.chmod(directory, 0o700);
  }
});
test.each(['uploads-v1', 'orphan-retirements-v1'])('enabled mode rejects a symlink namespace %s', async name => {
  env.COMPLETION_PROTOCOL_MODE = 'enabled';
  await fs.symlink(env.PRIVATE_MEDIA_ROOT, path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, name));
  await expect(run()).rejects.toMatchObject({ code: 'COMPLETION_STORAGE_NOT_READY' });
});
const blocked = async () => {
  await expect(run()).rejects.toMatchObject({ code: 'COMPLETION_STORAGE_NOT_READY', message: 'Completion storage readiness check failed' });
};

const syncCases = ['PRIVATE_MEDIA_ROOT', 'COMPLETION_DELETION_JOURNAL_ROOT'].flatMap(rootKey =>
  ['file', 'published-directory', 'cleaned-directory'].map(phase => [rootKey, phase]));
const interceptSync = (root, phase, onSync) => {
  const open = fs.open.bind(fs), handles = [];
  let directoryOpens = 0;
  jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await open(...args);
    handles.push(handle);
    jest.spyOn(handle, 'close');
    let currentPhase;
    if (args[0] === root && args[1] === 'r') {
      currentPhase = ++directoryOpens === 1 ? 'published-directory' : 'cleaned-directory';
    } else if (path.dirname(args[0]) === root && args[1] === 'wx') currentPhase = 'file';
    if (currentPhase === phase) {
      const sync = handle.sync.bind(handle);
      jest.spyOn(handle, 'sync').mockImplementation(() => onSync(handle, sync));
    }
    return handle;
  });
  return handles;
};
const preserveAudit = async () => {
  const sentinel = path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, 'existing-audit.json');
  await fs.writeFile(sentinel, 'synthetic-existing-evidence', { mode: 0o600 });
  return async () => {
    expect(await fs.readdir(env.PRIVATE_MEDIA_ROOT)).toEqual([]);
    expect(await fs.readdir(env.COMPLETION_DELETION_JOURNAL_ROOT)).toEqual(['existing-audit.json']);
    expect(await fs.readFile(sentinel, 'utf8')).toBe('synthetic-existing-evidence');
    for (const root of [env.PRIVATE_MEDIA_ROOT, env.COMPLETION_DELETION_JOURNAL_ROOT]) {
      expect((await fs.stat(root)).mode & 0o777).toBe(0o700);
    }
  };
};

test.each(syncCases)('%s rejects isolated %s fsync failure and preserves existing audit', async (rootKey, phase) => {
  const assertPreserved = await preserveAudit();
  const failure = jest.fn(async () => { throw Error('private-path-secret'); });
  const handles = interceptSync(env[rootKey], phase, failure);
  await blocked();
  expect(failure).toHaveBeenCalledTimes(1);
  for (const handle of handles) expect(handle.close).toHaveBeenCalledTimes(1);
  await assertPreserved();
});

test.each(syncCases)('%s waits for %s fsync before closing or reporting ready', async (rootKey, phase) => {
  const assertPreserved = await preserveAudit();
  let release, entered, targetHandle, settled = false;
  const barrier = new Promise(resolve => { release = resolve; });
  const reached = new Promise(resolve => { entered = resolve; });
  const handles = interceptSync(env[rootKey], phase, (handle, sync) => {
    targetHandle = handle;
    entered('reached');
    const pending = barrier.then(sync);
    // A missing-await mutation may close the real handle early; keep that rejection observed.
    pending.catch(() => {});
    return pending;
  });
  // Race completion against entry so removing fsync fails immediately instead of hanging the test.
  const outcome = run().then(value => ({ value }), error => ({ error }));
  outcome.then(() => { settled = true; });
  try {
    expect(await Promise.race([reached, outcome.then(() => 'completed-before-sync')])).toBe('reached');
    await new Promise(resolve => setImmediate(resolve));
    expect(settled).toBe(false);
    expect(targetHandle.close).not.toHaveBeenCalled();
    const probes = (await fs.readdir(env[rootKey])).filter(name => name.startsWith('.completion-probe-'));
    expect(probes).toHaveLength({ file: 1, 'published-directory': 2, 'cleaned-directory': 0 }[phase]);
  } finally {
    release();
    await outcome;
  }
  expect(await outcome).toEqual({ value: { mediaRoot: env.PRIVATE_MEDIA_ROOT, journalRoot: env.COMPLETION_DELETION_JOURNAL_ROOT } });
  for (const handle of handles) expect(handle.close).toHaveBeenCalledTimes(1);
  await assertPreserved();
});

test('probes private storage and durable publication without leaving files or changing permissions', async () => {
  const sentinel = path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, 'existing-audit.json');
  await fs.writeFile(sentinel, 'synthetic-existing-evidence', { mode: 0o600 });
  expect(await run()).toEqual({ mediaRoot: env.PRIVATE_MEDIA_ROOT, journalRoot: env.COMPLETION_DELETION_JOURNAL_ROOT });
  expect(await fs.readdir(env.PRIVATE_MEDIA_ROOT)).toEqual([]);
  expect(await fs.readdir(env.COMPLETION_DELETION_JOURNAL_ROOT)).toEqual(['existing-audit.json']);
  expect(await fs.readFile(sentinel, 'utf8')).toBe('synthetic-existing-evidence');
  expect((await fs.stat(env.COMPLETION_DELETION_JOURNAL_ROOT)).mode & 0o777).toBe(0o700);
});
test.each(['missing acknowledgement', 'relative path', 'missing directory', 'public directory', 'writable parent', 'symlink', 'same root', 'nested root'])(
  'rejects %s without provisioning or chmod', async kind => {
    if (kind === 'missing acknowledgement') delete env.COMPLETION_STORAGE_CONFIRMED;
    if (kind === 'relative path') env.COMPLETION_DELETION_JOURNAL_ROOT = 'relative-journal';
    if (kind === 'missing directory') await fs.rmdir(env.COMPLETION_DELETION_JOURNAL_ROOT);
    if (kind === 'public directory') await fs.chmod(env.COMPLETION_DELETION_JOURNAL_ROOT, 0o755);
    if (kind === 'writable parent') await fs.chmod(base, 0o777);
    if (kind === 'symlink') {
      await fs.rmdir(env.COMPLETION_DELETION_JOURNAL_ROOT);
      await fs.symlink(env.PRIVATE_MEDIA_ROOT, env.COMPLETION_DELETION_JOURNAL_ROOT);
    }
    if (kind === 'same root') env.COMPLETION_DELETION_JOURNAL_ROOT = env.PRIVATE_MEDIA_ROOT;
    if (kind === 'nested root') {
      env.COMPLETION_DELETION_JOURNAL_ROOT = path.join(env.PRIVATE_MEDIA_ROOT, 'journal');
      await fs.mkdir(env.COMPLETION_DELETION_JOURNAL_ROOT, { mode: 0o700 });
    }
    await blocked();
    if (kind === 'public directory') expect((await fs.stat(env.COMPLETION_DELETION_JOURNAL_ROOT)).mode & 0o777).toBe(0o755);
    if (kind === 'missing directory') await expect(fs.stat(env.COMPLETION_DELETION_JOURNAL_ROOT)).rejects.toMatchObject({ code: 'ENOENT' });
  }
);
test.each(['open', 'link', 'sync'])('sanitizes %s failure, closes handles and removes only its probes', async phase => {
  const handles = [];
  const open = fs.open.bind(fs);
  jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    if (phase === 'open') throw Error('private-path-secret');
    const handle = await open(...args); handles.push(handle); jest.spyOn(handle, 'close');
    if (phase === 'sync') jest.spyOn(handle, 'sync').mockRejectedValue(Error('private-path-secret'));
    return handle;
  });
  if (phase === 'link') jest.spyOn(fs, 'link').mockRejectedValue(Error('private-path-secret'));
  await blocked();
  for (const handle of handles) expect(handle.close).toHaveBeenCalled();
  expect(await fs.readdir(env.PRIVATE_MEDIA_ROOT)).toEqual([]);
  expect(await fs.readdir(env.COMPLETION_DELETION_JOURNAL_ROOT)).toEqual([]);
});
test('rejects an untrusted writable ancestor even when root and immediate parent are private', async () => {
  const shared = path.join(base, 'shared'), privateParent = path.join(shared, 'private');
  await fs.mkdir(shared); await fs.chmod(shared, 0o777);
  await fs.mkdir(privateParent, { mode: 0o700 });
  env.PRIVATE_MEDIA_ROOT = path.join(privateParent, 'media');
  env.COMPLETION_DELETION_JOURNAL_ROOT = path.join(privateParent, 'journal');
  await fs.mkdir(env.PRIVATE_MEDIA_ROOT, { mode: 0o700 });
  await fs.mkdir(env.COMPLETION_DELETION_JOURNAL_ROOT, { mode: 0o700 });
  await blocked();
  expect(await fs.readdir(env.PRIVATE_MEDIA_ROOT)).toEqual([]);
});
test('accepts a trusted sticky ancestor protecting privately owned children', async () => {
  const shared = path.join(base, 'sticky'), privateParent = path.join(shared, 'private');
  await fs.mkdir(shared); await fs.chmod(shared, 0o1777);
  await fs.mkdir(privateParent, { mode: 0o700 });
  env.PRIVATE_MEDIA_ROOT = path.join(privateParent, 'media');
  env.COMPLETION_DELETION_JOURNAL_ROOT = path.join(privateParent, 'journal');
  await fs.mkdir(env.PRIVATE_MEDIA_ROOT, { mode: 0o700 });
  await fs.mkdir(env.COMPLETION_DELETION_JOURNAL_ROOT, { mode: 0o700 });
  expect(await run()).toEqual({ mediaRoot: env.PRIVATE_MEDIA_ROOT, journalRoot: env.COMPLETION_DELETION_JOURNAL_ROOT });
});

const v2Directory = () => path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, 'user-deletions-v2');
const structure = options => assertCompletionStorageStructure({ env, ...options });
const requiredProbe = options => assertCompletionStorageReadiness({ env, userDeletionRecovery: true, ...options });
const forbidWrites = () => ['open', 'writeFile', 'appendFile', 'mkdir', 'chmod', 'link', 'unlink', 'rm', 'rmdir', 'rename']
  .map(method => jest.spyOn(fs, method).mockImplementation(() => { throw Error('Unexpected storage mutation'); }));
const setupV2 = async () => {
  env.COMPLETION_PROTOCOL_MODE = 'enabled';
  await fs.mkdir(v2Directory(), { mode: 0o700 });
};

test('UDR-D1 structural inspection performs no transient writes or sync and preserves audit bytes', async () => {
  await setupV2();
  const sentinel = path.join(v2Directory(), 'synthetic-audit.json');
  await fs.writeFile(sentinel, 'synthetic-original-log', { mode: 0o600 });
  const before = await fs.stat(v2Directory()), writes = forbidWrites();
  expect(await structure({ userDeletionRecovery: true })).toEqual({
    mediaRoot: env.PRIVATE_MEDIA_ROOT, journalRoot: env.COMPLETION_DELETION_JOURNAL_ROOT
  });
  for (const spy of writes) expect(spy).not.toHaveBeenCalled();
  expect(await fs.readdir(env.PRIVATE_MEDIA_ROOT)).toEqual([]);
  expect(await fs.readdir(env.COMPLETION_DELETION_JOURNAL_ROOT)).toEqual(['user-deletions-v2']);
  expect(await fs.readdir(v2Directory())).toEqual(['synthetic-audit.json']);
  expect(await fs.readFile(sentinel, 'utf8')).toBe('synthetic-original-log');
  const after = await fs.stat(v2Directory());
  for (const key of ['ino', 'dev', 'mode', 'uid', 'mtimeMs', 'ctimeMs']) expect(after[key]).toBe(before[key]);
});

test.each([structure, requiredProbe])('UDR-D1 missing required v2 fails before any probe or provisioning (%#)', async check => {
  env.COMPLETION_PROTOCOL_MODE = 'enabled';
  const writes = forbidWrites();
  await expect(check({ userDeletionRecovery: true })).rejects.toMatchObject({
    code: 'COMPLETION_STORAGE_NOT_READY', message: 'Completion storage readiness check failed'
  });
  for (const spy of writes) expect(spy).not.toHaveBeenCalled();
  await expect(fs.lstat(v2Directory())).rejects.toMatchObject({ code: 'ENOENT' });
});

test.each([undefined, 'legacy', 'maintenance'])('UDR-D1 required v2 cannot be used in mode %s', async mode => {
  await setupV2(); env.COMPLETION_PROTOCOL_MODE = mode;
  const writes = forbidWrites();
  for (const check of [structure, requiredProbe]) {
    await expect(check({ userDeletionRecovery: true })).rejects.toMatchObject({ code: 'COMPLETION_STORAGE_NOT_READY' });
  }
  for (const spy of writes) expect(spy).not.toHaveBeenCalled();
});

test.each([null, 'true', 1, {}])('UDR-D1 malformed required-namespace option %# cannot silently disable protection', async value => {
  await setupV2(); const writes = forbidWrites();
  for (const check of [structure, requiredProbe]) {
    await expect(check({ userDeletionRecovery: value })).rejects.toMatchObject({ code: 'COMPLETION_STORAGE_NOT_READY' });
  }
  for (const spy of writes) expect(spy).not.toHaveBeenCalled();
});

test.each([undefined, 'legacy', 'enabled'])('UDR-D1 optional absent namespace remains compatible in mode %s', async mode => {
  env.COMPLETION_PROTOCOL_MODE = mode;
  const writes = forbidWrites();
  expect(await structure()).toEqual({ mediaRoot: env.PRIVATE_MEDIA_ROOT, journalRoot: env.COMPLETION_DELETION_JOURNAL_ROOT });
  for (const spy of writes) expect(spy).not.toHaveBeenCalled();
  expect(await fs.readdir(env.COMPLETION_DELETION_JOURNAL_ROOT)).toEqual([]);
});

test.each(['permission', 'symlink', 'file', 'ancestor', 'nested root', 'acknowledgement'])
('UDR-D1 both entrances reject %s without probe side effects', async fault => {
  await setupV2();
  if (fault === 'permission') await fs.chmod(v2Directory(), 0o755);
  if (fault === 'symlink' || fault === 'file') {
    await fs.rmdir(v2Directory());
    if (fault === 'symlink') await fs.symlink(env.PRIVATE_MEDIA_ROOT, v2Directory());
    else await fs.writeFile(v2Directory(), 'not-a-directory');
  }
  if (fault === 'ancestor') {
    const unsafe = path.join(base, 'unsafe'), safe = path.join(unsafe, 'safe');
    await fs.mkdir(unsafe); await fs.chmod(unsafe, 0o777); await fs.mkdir(safe, { mode: 0o700 });
    env.PRIVATE_MEDIA_ROOT = path.join(safe, 'media'); await fs.mkdir(env.PRIVATE_MEDIA_ROOT, { mode: 0o700 });
  }
  if (fault === 'nested root') env.PRIVATE_MEDIA_ROOT = v2Directory();
  if (fault === 'acknowledgement') env.COMPLETION_STORAGE_CONFIRMED = 'false';
  const writes = forbidWrites();
  for (const check of [structure, requiredProbe]) {
    await expect(check({ userDeletionRecovery: true })).rejects.toMatchObject({ code: 'COMPLETION_STORAGE_NOT_READY' });
  }
  for (const spy of writes) expect(spy).not.toHaveBeenCalled();
});

test.each([undefined, 'legacy', 'enabled'])('UDR-D1 existing optional v2 is not ignored in mode %s', async mode => {
  await setupV2(); env.COMPLETION_PROTOCOL_MODE = mode; await fs.chmod(v2Directory(), 0o755);
  const writes = forbidWrites();
  for (const check of [structure, requiredProbe]) {
    await expect(check({ userDeletionRecovery: false })).rejects.toMatchObject({ code: 'COMPLETION_STORAGE_NOT_READY' });
  }
  for (const spy of writes) expect(spy).not.toHaveBeenCalled();
});

test.each(['file', 'published-directory', 'cleaned-directory'])
('UDR-D1 v2 %s fsync failure prevents success, closes handles and preserves audit', async phase => {
  await setupV2(); const sentinel = path.join(v2Directory(), 'original.json');
  await fs.writeFile(sentinel, 'synthetic-original-audit', { mode: 0o600 });
  const fault = jest.fn(async () => { throw Error('private-storage-sentinel'); });
  const handles = interceptSync(v2Directory(), phase, fault);
  await expect(requiredProbe()).rejects.toMatchObject({ code: 'COMPLETION_STORAGE_NOT_READY', message: 'Completion storage readiness check failed' });
  expect(fault).toHaveBeenCalledTimes(1);
  for (const handle of handles) expect(handle.close).toHaveBeenCalledTimes(1);
  expect(await fs.readdir(env.PRIVATE_MEDIA_ROOT)).toEqual([]);
  expect(await fs.readdir(env.COMPLETION_DELETION_JOURNAL_ROOT)).toEqual(['user-deletions-v2']);
  expect(await fs.readdir(v2Directory())).toEqual(['original.json']);
  expect(await fs.readFile(sentinel, 'utf8')).toBe('synthetic-original-audit');
});

test.each(['file', 'published-directory', 'cleaned-directory'])
('UDR-D1 v2 waits for %s fsync before reporting readiness', async phase => {
  await setupV2(); let release, enter, target, settled = false;
  const barrier = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { enter = resolve; });
  const handles = interceptSync(v2Directory(), phase, (handle, sync) => {
    target = handle; enter('reached'); const pending = barrier.then(sync); pending.catch(() => {}); return pending;
  });
  const outcome = requiredProbe().then(value => ({ value }), error => ({ error }));
  outcome.then(() => { settled = true; });
  try {
    expect(await Promise.race([entered, outcome.then(() => 'completed-before-sync')])).toBe('reached');
    await new Promise(resolve => setImmediate(resolve));
    expect(settled).toBe(false); expect(target.close).not.toHaveBeenCalled();
    expect((await fs.readdir(v2Directory())).length).toBe({ file: 1, 'published-directory': 2, 'cleaned-directory': 0 }[phase]);
  } finally { release(); await outcome; }
  expect(await outcome).toEqual({ value: { mediaRoot: env.PRIVATE_MEDIA_ROOT, journalRoot: env.COMPLETION_DELETION_JOURNAL_ROOT } });
  for (const handle of handles) expect(handle.close).toHaveBeenCalledTimes(1);
  expect(await fs.readdir(v2Directory())).toEqual([]);
});

const syncOracle = async (check, phase) => {
  let release, enter, target, settled = false;
  const pendingSyncs = [], barrier = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { enter = resolve; });
  interceptSync(v2Directory(), phase, (handle, sync) => {
    target = handle; enter('reached');
    const pending = barrier.then(sync); pending.catch(() => {}); pendingSyncs.push(pending); return pending;
  });
  const outcome = check({ env, userDeletionRecovery: true }).then(value => ({ value }), error => ({ error }));
  outcome.then(() => { settled = true; });
  let protectedUntilSync;
  try {
    const reached = await Promise.race([entered, outcome.then(() => 'completed')]);
    await new Promise(resolve => setImmediate(resolve));
    protectedUntilSync = reached === 'reached' && !settled && target.close.mock.calls.length === 0;
  } finally {
    release(); await outcome; await Promise.allSettled(pendingSyncs); jest.restoreAllMocks();
  }
  expect(await fs.readdir(v2Directory())).toEqual([]);
  return protectedUntilSync;
};
test.each(['file', 'published-directory', 'cleaned-directory'].flatMap(phase =>
  ['remove', 'no-await'].map(kind => [phase, kind])))
('UDR-D1 v2 sync oracle detects %s %s mutation', async (phase, kind) => {
  await setupV2();
  const source = await fs.readFile(require.resolve('../services/completionStorageReadiness'), 'utf8');
  const needle = phase === 'file' ? 'await handle.sync();' : 'await directory.sync();';
  const position = phase === 'cleaned-directory' ? source.lastIndexOf(needle) : source.indexOf(needle);
  expect(position).toBeGreaterThan(-1);
  const replacement = kind === 'remove' ? '/* isolated missing fsync */' : needle.replace('await ', '');
  const mutant = source.slice(0, position) + replacement + source.slice(position + needle.length);
  const isolated = { exports: {} };
  require('vm').runInNewContext(mutant, { require, module: isolated, process }, { filename: 'isolated-storage-mutation.js' });
  expect(await syncOracle(assertCompletionStorageReadiness, phase)).toBe(true);
  expect(await syncOracle(isolated.exports.assertCompletionStorageReadiness, phase)).toBe(false);
});

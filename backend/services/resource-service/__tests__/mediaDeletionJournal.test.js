const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { createMediaDeletionJournal } = require('../services/mediaDeletionJournal');

const run = promisify(execFile);
const modulePath = require.resolve('../services/mediaDeletionJournal');
const mediaId = '000000000000000000000001';
const evidence = {
  tombstone: { mediaId, familyId: '000000000000000000000002', childId: '000000000000000000000003',
    actorId: '000000000000000000000004', role: 'parent', purpose: 'task_completion',
    reason: 'user_requested', deletedAt: '2026-10-22T00:00:00.000Z' },
  receipts: [{ mediaId, familyId: '000000000000000000000002', childId: '000000000000000000000003',
    resourceType: 'growth_task', resourceId: '000000000000000000000005', field: 'completionMediaIds',
    bindingOperationId: '00000000-0000-4000-8000-000000000001', releasedAt: '2026-10-22T00:00:00.000Z' }]
};
const content = `${JSON.stringify(evidence)}\n`;
let base, root, destination;
beforeEach(async () => {
  base = await fs.mkdtemp(path.join(os.tmpdir(), 'deletion-journal-'));
  root = path.join(base, 'journal'); destination = path.join(root, `${mediaId}.json`);
});
afterEach(async () => { jest.restoreAllMocks(); await fs.rm(base, { recursive: true, force: true }); });

// Only the selected filesystem call fails; all other I/O uses real temporary files.
const traceFilesystem = (failure) => {
  const events = [], handles = [];
  const step = async (name, work) => {
    events.push(name);
    if (name === failure) throw new Error(`Synthetic ${name} failure`);
    return work();
  };
  const open = fs.open.bind(fs), link = fs.link.bind(fs), unlink = fs.unlink.bind(fs);
  jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await open(...args);
    const kind = args[0] === base ? 'parent' : args[0] === root ? 'directory' : 'file';
    const sync = handle.sync.bind(handle), close = handle.close.bind(handle), write = handle.writeFile.bind(handle);
    const tracked = { kind, closed: false }; handles.push(tracked);
    handle.sync = () => step(`${kind}-sync`, sync);
    handle.writeFile = (...values) => step('write', () => write(...values));
    handle.close = async () => { await close(); tracked.closed = true; };
    return handle;
  });
  jest.spyOn(fs, 'link').mockImplementation((...args) => step('publish', () => link(...args)));
  jest.spyOn(fs, 'unlink').mockImplementation((...args) => step('unlink', () => unlink(...args)));
  return { events, handles };
};

test('success syncs file before immutable publication and directory before acknowledgement', async () => {
  const trace = traceFilesystem();
  await createMediaDeletionJournal({ root }).persist(evidence);
  expect(trace.events).toEqual(['parent-sync', 'write', 'file-sync', 'publish', 'unlink', 'directory-sync']);
  expect(trace.handles.every(h => h.closed)).toBe(true);
  expect(await fs.readFile(destination, 'utf8')).toBe(content);
  expect((await fs.stat(root)).mode & 0o777).toBe(0o700);
  expect((await fs.stat(destination)).mode & 0o777).toBe(0o600);
  expect(await fs.readdir(root)).toEqual([`${mediaId}.json`]);
});

test.each(['parent-sync', 'write', 'file-sync', 'publish', 'unlink', 'directory-sync'])(
  '%s failure rejects, closes handles and permits a fresh instance to retry original evidence', async phase => {
    const trace = traceFilesystem(phase);
    await expect(createMediaDeletionJournal({ root }).persist(evidence)).rejects.toThrow(`Synthetic ${phase} failure`);
    expect(trace.events).toContain(phase);
    expect(trace.handles.every(h => h.closed)).toBe(true);
    const published = ['unlink', 'directory-sync'].includes(phase);
    expect(await fs.readdir(root)).toEqual(published ? [`${mediaId}.json`] : []);
    if (published) expect(await fs.readFile(destination, 'utf8')).toBe(content);
    jest.restoreAllMocks();
    const retry = traceFilesystem();
    await createMediaDeletionJournal({ root }).persist(evidence);
    expect(retry.events).toContain('directory-sync');
    expect(retry.handles.every(h => h.closed)).toBe(true);
    expect(await fs.readFile(destination, 'utf8')).toBe(content);
    expect(await fs.readdir(root)).toEqual([`${mediaId}.json`]);
  }
);

test.each(['file-sync', 'publish', 'directory-sync'])('a pending %s must finish before dependent I/O or acknowledgement', async phase => {
  let release, reached;
  const blocked = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { reached = resolve; });
  let finished = false;
  const early = [];
  const hold = async work => { await work(); reached(); await blocked; finished = true; };
  const open = fs.open.bind(fs), link = fs.link.bind(fs), unlink = fs.unlink.bind(fs);
  jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await open(...args), sync = handle.sync.bind(handle), close = handle.close.bind(handle);
    const selected = phase === 'file-sync' ? args[0].endsWith('.tmp') : phase === 'directory-sync' && args[0] === root;
    if (selected) {
      handle.sync = () => hold(sync);
      handle.close = async () => { if (!finished) early.push('close'); await close(); };
    }
    return handle;
  });
  jest.spyOn(fs, 'link').mockImplementation((...args) => {
    if (phase === 'file-sync' && !finished) early.push('publish');
    return phase === 'publish' ? hold(() => link(...args)) : link(...args);
  });
  jest.spyOn(fs, 'unlink').mockImplementation((...args) => {
    if (phase === 'publish' && !finished) early.push('unlink');
    return unlink(...args);
  });
  let settled = false;
  const pending = createMediaDeletionJournal({ root }).persist(evidence).then(() => { settled = true; });
  try {
    // Completion without reaching the barrier must fail rather than leave the test hanging.
    await Promise.race([entered, pending]);
    expect(settled).toBe(false);
  } finally { release(); await pending; }
  expect(finished).toBe(true);
  expect(early).toEqual([]);
  expect(settled).toBe(true);
  expect(await fs.readFile(destination, 'utf8')).toBe(content);
});

test('concurrent equal evidence publishes one immutable file without temporary leaks', async () => {
  await Promise.all(Array.from({ length: 8 }, () => createMediaDeletionJournal({ root }).persist(evidence)));
  expect(await fs.readFile(destination, 'utf8')).toBe(content);
  expect(await fs.readdir(root)).toEqual([`${mediaId}.json`]);
});

test('concurrent conflicting evidence cannot overwrite the winning first audit', async () => {
  const other = { ...evidence, tombstone: { ...evidence.tombstone, actorId: '000000000000000000000006' } };
  const candidates = [evidence, other];
  const results = await Promise.allSettled(candidates.map(value => createMediaDeletionJournal({ root }).persist(value)));
  const winner = results.findIndex(r => r.status === 'fulfilled');
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(results[1 - winner].reason.message).toBe('Deletion journal evidence conflict');
  const original = await fs.readFile(destination, 'utf8');
  expect(original).toBe(`${JSON.stringify(candidates[winner])}\n`);
  await expect(createMediaDeletionJournal({ root }).persist(candidates[1 - winner])).rejects.toThrow('evidence conflict');
  expect(await fs.readFile(destination, 'utf8')).toBe(original);
  expect(await fs.readdir(root)).toEqual([`${mediaId}.json`]);
});

test.each(['partial-write', 'before-publish', 'after-publish'])(
  'process termination %s is recoverable without treating an orphan temporary file as acknowledged evidence', async phase => {
    const script = `
      const fs = require('fs/promises');
      const link = fs.link.bind(fs);
      const open = fs.open.bind(fs);
      fs.open = async (...args) => {
        const handle = await open(...args), write = handle.writeFile.bind(handle);
        if (process.argv[3] === 'partial-write' && args[1] === 'wx') {
          handle.writeFile = async content => { await write(content.slice(0, 12)); process.exit(42); };
        }
        return handle;
      };
      fs.link = async (...args) => {
        if (process.argv[3] === 'before-publish') process.exit(42);
        await link(...args); process.exit(42);
      };
      require(process.argv[1]).createMediaDeletionJournal({root: process.argv[2]})
        .persist(JSON.parse(process.argv[4])).catch(() => process.exit(43));
    `;
    await expect(run(process.execPath, ['-e', script, modulePath, root, phase, JSON.stringify(evidence)], { timeout: 10000 }))
      .rejects.toMatchObject({ code: 42 });
    const interrupted = await fs.readdir(root);
    const orphan = interrupted.find(name => name.endsWith('.tmp'));
    expect(orphan).toBeDefined();
    expect(interrupted.includes(`${mediaId}.json`)).toBe(phase === 'after-publish');
    expect(await fs.readFile(path.join(root, orphan), 'utf8')).toBe(phase === 'partial-write' ? content.slice(0, 12) : content);
    const restart = `require(process.argv[1]).createMediaDeletionJournal({root: process.argv[2]})
      .persist(JSON.parse(process.argv[3])).catch(err => { process.stderr.write(err.message); process.exit(43); });`;
    await run(process.execPath, ['-e', restart, modulePath, root, JSON.stringify(evidence)], { timeout: 10000 });
    expect(await fs.readFile(destination, 'utf8')).toBe(content);
    const conflicting = { ...evidence, tombstone: { ...evidence.tombstone, actorId: '000000000000000000000006' } };
    await expect(run(process.execPath, ['-e', restart, modulePath, root, JSON.stringify(conflicting)], { timeout: 10000 }))
      .rejects.toMatchObject({ code: 43, stderr: 'Deletion journal evidence conflict' });
    expect(await fs.readFile(destination, 'utf8')).toBe(content);
    // Crash leftovers are deliberately not automatically deleted by unrelated retries.
    expect((await fs.readdir(root)).sort()).toEqual([orphan, `${mediaId}.json`].sort());
  }
);

test.each(['../escape', `${mediaId}\n`, '', null])('invalid media identity %j writes nothing', async invalid => {
  await expect(createMediaDeletionJournal({ root }).persist({ ...evidence,
    tombstone: { ...evidence.tombstone, mediaId: invalid } })).rejects.toThrow('Invalid deletion journal identity');
  expect(await fs.readdir(base)).toEqual([]);
});

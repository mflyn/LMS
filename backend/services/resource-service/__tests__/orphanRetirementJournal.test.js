const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { createOrphanRetirementJournal } = require('../services/orphanRetirementJournal');
const run = promisify(execFile);
const modulePath = require.resolve('../services/orphanRetirementJournal');

const id = digit => digit.repeat(24);
const uuid = digit => `00000000-0000-4000-8000-00000000000${digit}`;
const at = '2026-10-23T00:00:00.000Z';
const evidence = () => ({ version: 1,
  retirement: { mediaId: id('a'), familyId: id('b'), childId: id('c'), retirementId: uuid('1'), storageKey: uuid('2'),
    uploadMetadataHash: 'c'.repeat(64), retentionPolicyVersion: 1, orphanEligibleAt: at, actorType: 'system', createdAt: at, deletedAt: at },
  operations: [{ _id: id('d'), familyId: id('b'), childId: id('c'), resourceId: id('e'), resourceType: 'growth_task',
    field: 'completionMediaIds', operationId: uuid('3'), commandHash: 'a'.repeat(64), referenceSetHash: 'b'.repeat(64),
    references: [{ mediaId: id('a'), field: 'completionMediaIds' }, { mediaId: id('f'), field: 'completionMediaIds' }],
    state: 'ABORTED', version: 2, leaseExpiresAt: null, terminalAt: at, failureCode: 'MEDIA_OPERATION_ABORTED' }],
  references: [{ _id: id('1'), familyId: id('b'), childId: id('c'), mediaId: id('a'), resourceType: 'growth_task',
    resourceId: id('e'), field: 'completionMediaIds', operationId: uuid('3'), releaseOperationId: uuid('3'),
    state: 'released', leaseExpiresAt: null, releasedAt: at }] });
let base, root, destination;
beforeEach(async () => {
  base = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'lms-t2-g-sidecar-journal-'));
  root = path.join(base, 'orphan-journal'); destination = path.join(root, id('a') + '.json');
});
afterEach(async () => { jest.restoreAllMocks(); await fs.rm(base, { recursive: true, force: true }); });
const journal = () => createOrphanRetirementJournal({ root });

const traceFilesystem = (failure, barrier) => {
  const events = [], handles = [];
  const step = async (name, work) => {
    events.push(name);
    if (name === failure) throw Error('Synthetic ' + name);
    const result = await work();
    if (barrier?.phase === name) { barrier.enter(); await barrier.wait; }
    return result;
  };
  const open = fs.open.bind(fs), link = fs.link.bind(fs), unlink = fs.unlink.bind(fs);
  jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await open(...args);
    const kind = args[0] === base ? 'parent' : args[0] === root ? 'directory' : 'file';
    const sync = handle.sync.bind(handle), close = handle.close.bind(handle), write = handle.writeFile.bind(handle);
    const tracked = { closed: false }; handles.push(tracked);
    handle.sync = () => step(kind + '-sync', sync);
    handle.writeFile = (...values) => step('write', () => write(...values));
    handle.close = async () => { await close(); tracked.closed = true; };
    return handle;
  });
  jest.spyOn(fs, 'link').mockImplementation((...args) => step('publish', () => link(...args)));
  jest.spyOn(fs, 'unlink').mockImplementation((...args) => step('unlink', () => unlink(...args)));
  return { events, handles };
};

test('publishes complete evidence only after file, parent and directory durability, with private modes', async () => {
  const trace = traceFilesystem(), input = evidence();
  await journal().persist(input);
  expect(trace.events.indexOf('file-sync')).toBeLessThan(trace.events.indexOf('publish'));
  expect(trace.events).toContain('parent-sync');
  expect(trace.events.at(-1)).toBe('directory-sync');
  expect(trace.handles.every(h => h.closed)).toBe(true);
  expect((await fs.stat(root)).mode & 0o777).toBe(0o700);
  expect((await fs.stat(destination)).mode & 0o777).toBe(0o600);
  expect(await journal().read(id('a'))).toEqual(input);
  expect(await fs.readdir(root)).toEqual([id('a') + '.json']);
});
test('missing read returns null without creating a journal', async () => {
  expect(await journal().read(id('a'))).toBeNull(); expect(await fs.readdir(base)).toEqual([]);
});
test.each(['ABCDEFAB-CDEF-4ABC-ABCD-ABCDEFABCDEF', 'AbCdEfAb-CdEf-4AbC-aBcD-AbCdEfAbCdEf'])(
  'storage key %s preserves its original path casing through persist, read and replay', async storageKey => {
    const input = evidence(); input.retirement.storageKey = storageKey;
    await journal().persist(input);
    expect(await journal().read(id('a'))).toEqual(input);
    expect(JSON.parse(await fs.readFile(destination, 'utf8')).retirement.storageKey).toBe(storageKey);
    await journal().persist(input);
    const differentPath = evidence(); differentPath.retirement.storageKey = storageKey.toLowerCase();
    await expect(journal().persist(differentPath)).rejects.toThrow(/conflict/i);
    expect((await journal().read(id('a'))).retirement.storageKey).toBe(storageKey);
  });
test('empty history and legacy null release operation round trip without inventing proof', async () => {
  const input = evidence(); input.references[0].releaseOperationId = null;
  await journal().persist(input); expect(await journal().read(id('a'))).toEqual(input);
  const empty = evidence(); empty.retirement.mediaId = id('2'); empty.operations = []; empty.references = [];
  await journal().persist(empty); expect(await journal().read(id('2'))).toEqual(empty);
});
test('all historical generations and full reference sets survive, not only latest generation', async () => {
  const input = evidence();
  input.operations.push({ ...input.operations[0], _id: id('2'), operationId: uuid('4') });
  await journal().persist(input); expect(await journal().read(id('a'))).toEqual(input);
});
test('concurrent identical publication is idempotent; conflicting evidence cannot overwrite', async () => {
  const input = evidence();
  await Promise.all(Array.from({ length: 5 }, () => journal().persist(input)));
  const before = await fs.readFile(destination, 'utf8');
  const changed = evidence(); changed.retirement.retirementId = uuid('4');
  await expect(journal().persist(changed)).rejects.toThrow(/conflict/i);
  expect(await fs.readFile(destination, 'utf8')).toBe(before);
  expect(await fs.readdir(root)).toEqual([id('a') + '.json']);
});
test('concurrent conflicting first publishers have exactly one winner', async () => {
  const other = evidence(); other.operations[0].version += 1;
  const inputs = [evidence(), other];
  const results = await Promise.allSettled(inputs.map(value => journal().persist(value)));
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(await journal().read(id('a'))).toEqual(inputs[results.findIndex(r => r.status === 'fulfilled')]);
});
test.each(['parent-sync', 'write', 'file-sync', 'publish', 'unlink', 'directory-sync'])(
  '%s failure never acknowledges and restart retries same immutable evidence', async phase => {
    const trace = traceFilesystem(phase);
    await expect(journal().persist(evidence())).rejects.toThrow();
    expect(trace.events).toContain(phase); expect(trace.handles.every(h => h.closed)).toBe(true);
    jest.restoreAllMocks();
    await journal().persist(evidence()); expect(await journal().read(id('a'))).toEqual(evidence());
    expect(await fs.readdir(root)).toEqual([id('a') + '.json']);
  });
test.each(['parent-sync', 'file-sync', 'publish', 'directory-sync'])('%s must settle before acknowledgement', async phase => {
  let release, enter, settled = false;
  const wait = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { enter = resolve; });
  const trace = traceFilesystem(null, { phase, wait, enter });
  const writing = journal().persist(evidence()).then(() => { settled = true; });
  try {
    await Promise.race([entered, writing]); expect(settled).toBe(false);
    if (phase === 'parent-sync' || phase === 'file-sync') expect(trace.events).not.toContain('publish');
  } finally { release(); await writing; }
  expect(settled).toBe(true);
});
test.each([
  ['extra envelope', e => { e.extra = 'secret'; }], ['extra retirement', e => { e.retirement.originalName = 'private'; }],
  ['extra operation', e => { e.operations[0].createdAt = at; }], ['extra reference', e => { e.references[0].updatedAt = at; }],
  ['nested extra', e => { e.operations[0].references[0].extra = true; }],
  ['missing', e => { delete e.retirement.storageKey; }], ['undefined', e => { e.operations[0].failureCode = undefined; }],
  ['id', e => { e.retirement.mediaId = '../escape'; }], ['uuid', e => { e.retirement.retirementId = 'x'; }],
  ['uppercase media id', e => { e.retirement.mediaId = id('A'); }],
  ['uppercase retirement id', e => { e.retirement.retirementId = 'ABCDEFAB-CDEF-4ABC-ABCD-ABCDEFABCDEF'; }],
  ['id newline', e => { e.retirement.mediaId += '\n'; }], ['uuid newline', e => { e.retirement.retirementId += '\n'; }],
  ['storage path', e => { e.retirement.storageKey = '../secret'; }], ['actor', e => { e.retirement.actorType = 'parent'; }],
  ['policy', e => { e.retirement.retentionPolicyVersion = 2; }], ['envelope version', e => { e.version = 2; }],
  ['missing upload hash', e => { delete e.retirement.uploadMetadataHash; }],
  ['invalid upload hash', e => { e.retirement.uploadMetadataHash = 'C'.repeat(64); }],
  ['date', e => { e.retirement.deletedAt = '2026-02-30T00:00:00.000Z'; }],
  ['date object', e => { e.retirement.createdAt = new Date(at); }],
  ['hash', e => { e.operations[0].commandHash = 'invalid'; }], ['operation state', e => { e.operations[0].state = 'PREPARED'; }],
  ['version', e => { e.operations[0].version = -1; }], ['lease', e => { e.operations[0].leaseExpiresAt = at; }],
  ['failure', e => { e.operations[0].failureCode = null; }], ['resource', e => { e.operations[0].resourceType = 'child'; }],
  ['field', e => { e.references[0].field = 'attachmentMediaIds'; }], ['release id', e => { e.references[0].releaseOperationId = 'x'; }],
  ['released state', e => { e.references[0].state = 'bound'; }], ['released time', e => { e.references[0].releasedAt = null; }],
  ['sparse', e => { e.operations.length = 2; }], ['sparse nested', e => { e.operations[0].references.length = 3; }],
  ['undefined reference', e => { e.references.push(undefined); }],
  ['non-enumerable required field', e => { Object.defineProperty(e.retirement, 'storageKey', { enumerable: false }); }],
  ['accessor array member', e => {
    const original = e.operations[0]; Object.defineProperty(e.operations, '0', { enumerable: true, get: () => original });
  }]
])('invalid %s evidence is rejected before filesystem writes', async (_name, mutate) => {
  const input = evidence(); mutate(input);
  await expect(journal().persist(input)).rejects.toThrow(); expect(await fs.readdir(base)).toEqual([]);
});
test.each(['root symlink', 'ancestor symlink', 'destination symlink', 'destination directory', 'destination permissions'])(
  'rejects %s without following or overwriting', async kind => {
    const target = path.join(base, 'target'); await fs.mkdir(target, { mode: 0o700 });
    if (kind === 'root symlink') await fs.symlink(target, root);
    else if (kind === 'ancestor symlink') {
      const alias = path.join(base, 'alias'); await fs.symlink(target, alias); root = path.join(alias, 'journal');
    } else {
      await fs.mkdir(root, { mode: 0o700 });
      if (kind === 'destination symlink') {
        await fs.writeFile(path.join(target, 'evidence'), JSON.stringify(evidence()), { mode: 0o600 });
        await fs.symlink(path.join(target, 'evidence'), destination);
      } else if (kind === 'destination directory') await fs.mkdir(destination);
      else await fs.writeFile(destination, JSON.stringify(evidence()), { mode: 0o644 });
    }
    await expect(journal().persist(evidence())).rejects.toThrow();
    await expect(journal().read(id('a'))).rejects.toThrow();
    if (kind === 'ancestor symlink') expect(await fs.readdir(target)).toEqual([]);
  });
test.each(['malformed json', 'wrong identity', 'extra field'])('read rejects %s on disk', async kind => {
  await journal().persist(evidence());
  const altered = evidence();
  if (kind === 'wrong identity') altered.retirement.mediaId = id('f');
  if (kind === 'extra field') altered.extra = 'private';
  await fs.writeFile(destination, kind === 'malformed json' ? '{' : JSON.stringify(altered));
  await expect(journal().read(id('a'))).rejects.toThrow();
});
test.each(['../escape', '', null])('read rejects invalid mediaId %j', async mediaId => {
  await expect(journal().read(mediaId)).rejects.toThrow(); expect(await fs.readdir(base)).toEqual([]);
});
test('caller mutation during I/O does not alter journal evidence', async () => {
  const input = evidence(), expected = evidence();
  const writing = journal().persist(input);
  input.retirement.retirementId = uuid('5'); input.operations[0].references.pop();
  await writing;
  expect(await journal().read(id('a'))).toEqual(expected);
});
test('object key order does not create an evidence conflict', async () => {
  const input = evidence(); await journal().persist(input);
  const reordered = Object.fromEntries(Object.entries(input).reverse());
  reordered.retirement = Object.fromEntries(Object.entries(input.retirement).reverse());
  await journal().persist(reordered); expect(await journal().read(id('a'))).toEqual(input);
});
test.each(['partial-write', 'before-publish', 'after-publish'])('process exit %s preserves retry identity and never accepts partial evidence', async phase => {
  const script = `
    const fs = require('fs/promises');
    const open = fs.open.bind(fs), link = fs.link.bind(fs);
    fs.open = async (...args) => {
      const handle = await open(...args), write = handle.writeFile.bind(handle);
      if (process.argv[3] === 'partial-write' && args[0].endsWith('.tmp')) {
        handle.writeFile = async text => { await write(text.slice(0, 12)); process.exit(42); };
      }
      return handle;
    };
    fs.link = async (...args) => {
      if (process.argv[3] === 'before-publish') process.exit(42);
      await link(...args); process.exit(42);
    };
    require(process.argv[1]).createOrphanRetirementJournal({root: process.argv[2]})
      .persist(JSON.parse(process.argv[4])).catch(() => process.exit(43));
  `;
  await expect(run(process.execPath, ['-e', script, modulePath, root, phase, JSON.stringify(evidence())], { timeout: 5000 }))
    .rejects.toMatchObject({ code: 42 });
  expect(await journal().read(id('a'))).toEqual(phase === 'after-publish' ? evidence() : null);
  await journal().persist(evidence());
  expect(await journal().read(id('a'))).toEqual(evidence());
  const conflict = evidence(); conflict.retirement.uploadMetadataHash = 'd'.repeat(64);
  await expect(journal().persist(conflict)).rejects.toThrow(/conflict/i);
  expect(await journal().read(id('a'))).toEqual(evidence());
});

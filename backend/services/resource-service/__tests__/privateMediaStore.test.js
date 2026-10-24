const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const STORAGE_KEY = '35ba3f3d-1908-49f0-85e4-fdc0d66f7c06';
const CANONICAL_BYTES = Buffer.from('canonical private media bytes');

let mediaStoreModule;
let roots = [];

const loadStore = () => {
  mediaStoreModule = mediaStoreModule || require('../services/privateMediaStore');
  return mediaStoreModule;
};

const tempRoot = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'family-media-'));
  roots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true })));
  roots = [];
});

describe('private canonical media store', () => {
  test('stores canonical bytes exactly and atomically beneath a private root', async () => {
    const { createPrivateMediaStore } = loadStore();
    const root = await tempRoot();
    const store = createPrivateMediaStore({ root, randomUUID: () => STORAGE_KEY });

    const result = await store.writeCanonical(CANONICAL_BYTES);

    expect(result).toEqual({ storageKey: STORAGE_KEY });
    expect(await store.read(STORAGE_KEY)).toEqual(CANONICAL_BYTES);
    expect((await fs.stat(root)).mode & 0o777).toBe(0o700);
    expect((await fs.stat(path.join(root, STORAGE_KEY))).mode & 0o777).toBe(0o600);
    expect(await fs.readdir(root)).toEqual([STORAGE_KEY]);
    expect(store.write).toBeUndefined();
  });

  test('rejects traversal keys and removes objects idempotently', async () => {
    const { createPrivateMediaStore } = loadStore();
    const root = await tempRoot();
    const store = createPrivateMediaStore({ root, randomUUID: () => STORAGE_KEY });
    await store.writeCanonical(CANONICAL_BYTES);

    await expect(store.read('../public/file.jpg')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(store.remove('../public/file.jpg')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(store.remove(STORAGE_KEY)).resolves.toBe(true);
    await expect(store.remove(STORAGE_KEY)).resolves.toBe(false);
    await expect(store.read(STORAGE_KEY)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  test('cleans the temporary object when atomic publish fails', async () => {
    const { createPrivateMediaStore } = loadStore();
    const root = await tempRoot();
    const failingFs = {
      ...fs,
      link: jest.fn().mockRejectedValue(new Error('simulated publish failure'))
    };
    const store = createPrivateMediaStore({ root, randomUUID: () => STORAGE_KEY, fsPromises: failingFs });

    await expect(store.writeCanonical(CANONICAL_BYTES)).rejects.toThrow('simulated publish failure');
    expect(await fs.readdir(root)).toEqual([]);
  });

  test('never overwrites an existing object when a storage key collides', async () => {
    const { createPrivateMediaStore } = loadStore();
    const root = await tempRoot();
    const store = createPrivateMediaStore({ root, randomUUID: () => STORAGE_KEY });
    await store.writeCanonical(CANONICAL_BYTES);

    await expect(store.writeCanonical(Buffer.from('replacement')))
      .rejects.toMatchObject({ code: 'RESOURCE_CONFLICT' });
    expect(await store.read(STORAGE_KEY)).toEqual(CANONICAL_BYTES);
    expect(await fs.readdir(root)).toEqual([STORAGE_KEY]);
  });

  test('a colliding temporary name is not owned and must not be deleted', async () => {
    const root = await tempRoot(), filename = `.${STORAGE_KEY}.${process.pid}.tmp`;
    await fs.writeFile(path.join(root, filename), Buffer.from('other upload'));
    const store = loadStore().createPrivateMediaStore({ root, randomUUID: () => STORAGE_KEY });
    await expect(store.writeCanonical(CANONICAL_BYTES)).rejects.toMatchObject({ code: 'RESOURCE_CONFLICT' });
    expect(await fs.readdir(root)).toEqual([filename]);
    expect(await fs.readFile(path.join(root, filename), 'utf8')).toBe('other upload');
  });

  test('persistent directory sync failure reports cleanup failure instead of success', async () => {
    const root = await tempRoot();
    const io = { ...fs, open: async (filename, ...args) => {
      const handle = await fs.open(filename, ...args);
      if (filename === root) handle.sync = async () => { throw Error('directory unavailable'); };
      return handle;
    } };
    const store = loadStore().createPrivateMediaStore({ root, randomUUID: () => STORAGE_KEY, fsPromises: io });
    await expect(store.writeCanonical(CANONICAL_BYTES)).rejects.toMatchObject({
      name: 'AggregateError', message: 'Media write and cleanup failed', errors: [expect.any(Error), expect.any(Error)]
    });
    expect(await fs.readdir(root)).toEqual([]);
  });

  test('post-publication failure does not remove a temporary name reused by another upload', async () => {
    const root = await tempRoot(), filename = `.${STORAGE_KEY}.${process.pid}.tmp`;
    let injected = false;
    const io = { ...fs, open: async (name, ...args) => {
      const handle = await fs.open(name, ...args), sync = handle.sync.bind(handle);
      if (name === root) handle.sync = async () => {
        if (!injected) {
          injected = true;
          await fs.writeFile(path.join(root, filename), 'other upload', { flag: 'wx' });
          throw Error('publish directory sync failed');
        }
        await sync();
      };
      return handle;
    } };
    const store = loadStore().createPrivateMediaStore({ root, randomUUID: () => STORAGE_KEY, fsPromises: io });
    await expect(store.writeCanonical(CANONICAL_BYTES)).rejects.toThrow('publish directory sync failed');
    expect(await fs.readdir(root)).toEqual([filename]);
    expect(await fs.readFile(path.join(root, filename), 'utf8')).toBe('other upload');
  });

  test('rejects invalid canonical input before creating an object', async () => {
    const { createPrivateMediaStore, MAX_MEDIA_BYTES } = loadStore();
    const root = await tempRoot();
    const store = createPrivateMediaStore({ root, randomUUID: () => STORAGE_KEY });

    for (const input of [null, Buffer.alloc(0), Buffer.alloc(MAX_MEDIA_BYTES + 1)]) {
      await expect(store.writeCanonical(input)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    }
    expect(await fs.readdir(root)).toEqual([]);
  });

  const deferred = () => {
    let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve };
  };
  const instrumented = async ({ fail, pause } = {}) => {
    const root = await tempRoot(), events = [], entered = deferred(), released = deferred();
    let failed = false;
    const io = { ...fs, link: async (...args) => { events.push('link'); return fs.link(...args); },
      open: async (filename, ...args) => {
        const handle = await fs.open(filename, ...args), kind = filename === root ? 'directory' : 'file';
        let pending = false;
        return { writeFile: (...values) => handle.writeFile(...values), chmod: mode => handle.chmod(mode),
          sync: async () => {
            pending = true;
            events.push(`${kind}:sync:start`);
            try {
              if (fail === kind && !failed) { failed = true; throw new Error(`${kind} sync failed`); }
              if (pause === kind) { entered.resolve(); await released.promise; }
              if (handle.fd !== -1) await handle.sync();
              events.push(`${kind}:sync:done`);
            } finally { pending = false; }
          }, close: async () => {
            if (pending) events.push(`${kind}:closed-before-sync`);
            events.push(`${kind}:close`); await handle.close();
          } };
      } };
    return { root, events, entered, released,
      store: loadStore().createPrivateMediaStore({ root, randomUUID: () => STORAGE_KEY, fsPromises: io }) };
  };

  test.each(['file', 'directory'])('%s synchronization failure rejects and cleans only this unpublished upload', async kind => {
    const { root, store, events } = await instrumented({ fail: kind });
    await expect(store.writeCanonical(CANONICAL_BYTES)).rejects.toThrow(`${kind} sync failed`);
    expect(events).toContain(`${kind}:close`);
    if (kind === 'file') expect(events).not.toContain('link');
    expect(await fs.readdir(root)).toEqual([]);
  });

  test.each(['file', 'directory'])('awaits %s sync before publish/success and closes both handles', async kind => {
    const { root, store, events, entered, released } = await instrumented({ pause: kind });
    let settled = false;
    const writing = store.writeCanonical(CANONICAL_BYTES).finally(() => { settled = true; });
    try {
      // If sync is removed, completion wins the race and the test fails without hanging.
      await Promise.race([entered.promise, writing]);
      expect(events).toContain(`${kind}:sync:start`);
      await new Promise(resolve => setImmediate(resolve));
      expect(settled).toBe(false);
      if (kind === 'file') expect(events).not.toContain('link');
    } finally { released.resolve(); await writing; }
    expect(events.indexOf('file:sync:done')).toBeLessThan(events.indexOf('link'));
    expect(events).not.toContain(`${kind}:closed-before-sync`);
    expect(events.indexOf('link')).toBeLessThan(events.indexOf('directory:sync:done'));
    expect(events).toEqual(expect.arrayContaining(['file:close', 'directory:close']));
    expect(await fs.readdir(root)).toEqual([STORAGE_KEY]);
  });
});

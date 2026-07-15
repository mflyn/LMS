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

  test('rejects invalid canonical input before creating an object', async () => {
    const { createPrivateMediaStore, MAX_MEDIA_BYTES } = loadStore();
    const root = await tempRoot();
    const store = createPrivateMediaStore({ root, randomUUID: () => STORAGE_KEY });

    for (const input of [null, Buffer.alloc(0), Buffer.alloc(MAX_MEDIA_BYTES + 1)]) {
      await expect(store.writeCanonical(input)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    }
    expect(await fs.readdir(root)).toEqual([]);
  });
});

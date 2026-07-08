const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const STORAGE_KEY = '35ba3f3d-1908-49f0-85e4-fdc0d66f7c06';
const MIME_BY_FORMAT = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};

let mediaStoreModule;
let roots = [];

const loadStore = () => {
  mediaStoreModule = mediaStoreModule || require('../services/privateMediaStore');
  return mediaStoreModule;
};

const fixture = async (format, withMetadata = false) => {
  let image = sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 32, g: 96, b: 160 }
    }
  });
  if (withMetadata) image = image.withMetadata({ orientation: 6 });
  return image.toFormat(format).toBuffer();
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

describe('Task 6 private media store', () => {
  test.each(['jpeg', 'png', 'webp'])('TC-T6-MEDIA-002 decodes and normalizes %s bytes', async (format) => {
    const { sanitizeImage } = loadStore();

    const result = await sanitizeImage(await fixture(format));

    expect(result.mimeType).toBe(MIME_BY_FORMAT[format]);
    expect(result.sizeBytes).toBe(result.buffer.length);
    expect((await sharp(result.buffer).metadata()).format).toBe(format);
  });

  test.each(['jpeg', 'webp'])('TC-T6-MEDIA-003 strips embedded metadata from %s', async (format) => {
    const { sanitizeImage } = loadStore();
    const original = await fixture(format, true);
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const result = await sanitizeImage(original);

    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });

  test('TC-T6-MEDIA-002 rejects empty, corrupt, unsupported, and oversized bytes', async () => {
    const { MAX_MEDIA_BYTES, sanitizeImage } = loadStore();
    const unsupportedGif = await fixture('gif');

    for (const input of [
      Buffer.alloc(0),
      Buffer.from('not an image'),
      unsupportedGif,
      Buffer.alloc(MAX_MEDIA_BYTES + 1)
    ]) {
      await expect(sanitizeImage(input)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    }
  });

  test('writes sanitized bytes atomically beneath a private root', async () => {
    const { createPrivateMediaStore } = loadStore();
    const root = await tempRoot();
    const store = createPrivateMediaStore({ root, randomUUID: () => STORAGE_KEY });

    const result = await store.write(await fixture('jpeg', true));

    expect(result).toEqual({ storageKey: STORAGE_KEY, mimeType: 'image/jpeg', sizeBytes: expect.any(Number) });
    expect(await store.read(STORAGE_KEY)).toEqual(expect.any(Buffer));
    expect((await sharp(await store.read(STORAGE_KEY)).metadata()).exif).toBeUndefined();
    expect((await fs.stat(root)).mode & 0o777).toBe(0o700);
    expect((await fs.stat(path.join(root, STORAGE_KEY))).mode & 0o777).toBe(0o600);
    expect(await fs.readdir(root)).toEqual([STORAGE_KEY]);
  });

  test('rejects traversal keys and removes objects idempotently', async () => {
    const { createPrivateMediaStore } = loadStore();
    const root = await tempRoot();
    const store = createPrivateMediaStore({ root, randomUUID: () => STORAGE_KEY });
    await store.write(await fixture('png'));

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

    await expect(store.write(await fixture('webp'))).rejects.toThrow('simulated publish failure');
    expect(await fs.readdir(root)).toEqual([]);
  });

  test('never overwrites an existing object when a storage key collides', async () => {
    const { createPrivateMediaStore } = loadStore();
    const root = await tempRoot();
    const store = createPrivateMediaStore({ root, randomUUID: () => STORAGE_KEY });
    await store.write(await fixture('jpeg'));
    const original = await store.read(STORAGE_KEY);

    await expect(store.write(await fixture('png'))).rejects.toMatchObject({ code: 'RESOURCE_CONFLICT' });
    expect(await store.read(STORAGE_KEY)).toEqual(original);
    expect(await fs.readdir(root)).toEqual([STORAGE_KEY]);
  });

  test('rejects invalid image input before creating an object', async () => {
    const { createPrivateMediaStore } = loadStore();
    const root = await tempRoot();
    const store = createPrivateMediaStore({ root, randomUUID: () => STORAGE_KEY });

    await expect(store.write(Buffer.from('not an image'))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await fs.readdir(root)).toEqual([]);
  });
});

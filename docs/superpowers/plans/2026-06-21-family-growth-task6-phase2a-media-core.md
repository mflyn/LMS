# Task 6 Phase 2A Media Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved private-media metadata models and an atomic private filesystem store that validates, decodes, re-encodes, and strips metadata from JPEG, PNG, and WebP images.

**Architecture:** `MediaAsset` and `MediaReference` remain resource-service-owned Mongoose models with family-first indexes. `privateMediaStore` is a filesystem adapter injected with its root, key generator, and fs implementation; it validates the original in-memory buffer, uses Sharp to decode and re-encode it, then atomically publishes a mode-0600 temporary object with a no-clobber hard link beneath a mode-0700 private root. HTTP authorization, signed URLs, deletion policy, and reference commands remain Phase 2B/2C work.

**Tech Stack:** Node.js 18.17+, Mongoose 8.14.1, Sharp 0.33.5, Jest 29 family project

---

### Task 1: Add Media Model Contracts

**Files:**
- Create: `backend/services/resource-service/models/MediaAsset.js`
- Create: `backend/services/resource-service/models/MediaReference.js`
- Create: `backend/services/resource-service/__tests__/mediaModels.test.js`
- Modify: `backend/services/resource-service/jest.family.config.js`

- [x] **Step 1: Write failing model tests**

The tests instantiate documents without a database and assert schema validation plus exact indexes:

```js
test('TC-T6-MEDIA-001 accepts six purposes and only family-scoped avatar may omit childId', async () => {
  for (const purpose of MEDIA_PURPOSES) {
    const asset = new MediaAsset(validAsset({ purpose, childId: purpose === 'avatar' ? null : childId }));
    await expect(asset.validate()).resolves.toBeUndefined();
  }
  await expect(new MediaAsset(validAsset({ purpose: 'growth_evidence', childId: null })).validate())
    .rejects.toThrow('childId is required');
});

test('uses family-first asset and reference unique indexes', () => {
  expect(MediaAsset.schema.indexes()).toEqual(expect.arrayContaining([
    [{ familyId: 1, storageKey: 1 }, { unique: true, background: true }]
  ]));
  expect(MediaReference.schema.indexes()).toEqual(expect.arrayContaining([
    [{ familyId: 1, mediaId: 1, resourceType: 1, resourceId: 1, field: 1 },
      { unique: true, background: true }]
  ]));
});
```

- [x] **Step 2: Run RED**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand mediaModels
```

Expected: FAIL because both model modules do not exist.

- [x] **Step 3: Implement schemas and constants**

`MediaAsset` exports `MEDIA_PURPOSES`, `MEDIA_MIME_TYPES`, and `MAX_MEDIA_BYTES`. It enforces `familyId`, nullable child only for avatar, positive size through 10 MiB, random internal key, active/deleted status, and deletedAt consistency. `MediaReference` exports resource/field enums, uses `prepared|bound|released`, and includes `leaseExpiresAt` and `releasedAt`.

```js
mediaAssetSchema.index({ familyId: 1, childId: 1, status: 1, createdAt: -1 });
mediaAssetSchema.index({ familyId: 1, storageKey: 1 }, { unique: true });
mediaAssetSchema.index({ status: 1, deletedAt: 1 });

mediaReferenceSchema.index(
  { familyId: 1, mediaId: 1, resourceType: 1, resourceId: 1, field: 1 },
  { unique: true }
);
```

- [x] **Step 4: Run GREEN**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand mediaModels
```

Expected: all model cases pass.

### Task 2: Add Image Sanitization and Atomic Store

**Files:**
- Create: `backend/services/resource-service/services/privateMediaStore.js`
- Create: `backend/services/resource-service/__tests__/privateMediaStore.test.js`
- Modify: `backend/services/resource-service/package.json`
- Modify: `backend/services/resource-service/package-lock.json`

- [x] **Step 1: Add the Node-18-compatible image dependency**

```bash
npm install --prefix backend/services/resource-service --save-exact sharp@0.33.5
```

Expected: package and lock record Sharp 0.33.5 as a production dependency.

- [x] **Step 2: Write failing validation and privacy tests**

Generate fixtures at runtime with Sharp. Include valid JPEG/PNG/WebP, EXIF-bearing JPEG/WebP, empty/corrupt/spoofed input, and a buffer over 10 MiB.

```js
test.each(['jpeg', 'png', 'webp'])('TC-T6-MEDIA-002 decodes and normalizes %s bytes', async (format) => {
  const result = await sanitizeImage(await fixture(format));
  expect(result.mimeType).toBe(MIME_BY_FORMAT[format]);
  expect((await sharp(result.buffer).metadata()).format).toBe(format);
});

test('TC-T6-MEDIA-003 strips embedded EXIF', async () => {
  const result = await sanitizeImage(await fixtureWithMetadata('jpeg'));
  expect((await sharp(result.buffer).metadata()).exif).toBeUndefined();
});

test.each([Buffer.alloc(0), Buffer.from('not an image'), Buffer.alloc(MAX_MEDIA_BYTES + 1)])(
  'TC-T6-MEDIA-002 rejects invalid input without writing an object',
  async (buffer) => expect(store.write(buffer)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
);
```

- [x] **Step 3: Run RED**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand privateMediaStore
```

Expected: FAIL because `privateMediaStore` does not exist.

- [x] **Step 4: Implement the sanitizer and private store**

Export `sanitizeImage`, `createPrivateMediaStore`, and `MAX_MEDIA_BYTES`. `write` sanitizes before any filesystem write, writes `<key>.tmp`, chmods 0600, and uses `link(temp, key)` for atomic no-clobber publication; any error removes temporary and partially published paths. `read` and `remove` accept only UUID storage keys resolved beneath the configured root.

```js
const sanitizeImage = async (input) => {
  assertInputBuffer(input);
  const metadata = await sharp(input, { failOn: 'error' }).metadata();
  const mimeType = MIME_BY_FORMAT[metadata.format];
  if (!mimeType) throw validationError('Only JPEG, PNG, and WebP are supported');
  const pipeline = sharp(input, { failOn: 'error' }).rotate();
  const buffer = await ENCODE[metadata.format](pipeline).toBuffer();
  return { buffer, mimeType, sizeBytes: buffer.length };
};
```

- [x] **Step 5: Run GREEN and the Phase 2A gate**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand mediaModels privateMediaStore task6Startup
npm run test:family-regression
git diff --check
```

Expected: all focused cases and all family projects pass.

- [x] **Step 6: Commit Phase 2A**

```bash
git add backend/services/resource-service/models/MediaAsset.js \
  backend/services/resource-service/models/MediaReference.js \
  backend/services/resource-service/services/privateMediaStore.js \
  backend/services/resource-service/__tests__/mediaModels.test.js \
  backend/services/resource-service/__tests__/privateMediaStore.test.js \
  backend/services/resource-service/jest.family.config.js \
  backend/services/resource-service/package.json \
  backend/services/resource-service/package-lock.json \
  docs/superpowers/plans/2026-06-21-family-growth-task6-phase2a-media-core.md
git commit -m "feat: add private media core"
```

# Task 6 Phase 2B2 Private Media API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver authenticated private-image upload, short-lived access grants, capability-protected content streaming, and idempotent soft deletion without exposing filenames, storage keys, original bytes, or permanent URLs.

**Architecture:** A route-local bounded disk upload middleware writes opaque temporary files beneath the private media root and always removes them after processing. A dependency-injected media service owns scope authorization, `MediaAsset` persistence, private-store orchestration, capability issuance/verification, and atomic soft deletion; the Express router owns HTTP parsing, response headers, and response shapes. The signed content route is deliberately mounted before gateway authentication, while upload, access-grant, and delete require a verified gateway identity.

**Tech Stack:** Node.js, Express, Multer disk storage, Mongoose, Sharp-backed `privateMediaStore`, HMAC `mediaCapability`, Supertest, mongodb-memory-server, Jest

---

### Task 1: Add Bounded Multipart Upload and Upload Service

**Files:**
- Create: `backend/services/resource-service/middleware/privateMediaUpload.js`
- Create: `backend/services/resource-service/services/mediaService.js`
- Create: `backend/services/resource-service/routes/media.js`
- Create: `backend/services/resource-service/__tests__/familyMedia.test.js`
- Modify: `backend/services/resource-service/jest.family.config.js`

- [ ] **Step 1: Write failing upload route tests**

Build one test application with the real `authenticateGateway`, `MediaAsset`, `privateMediaStore`, and a Mongo memory database. Insert parent A, child A1, sibling A2, and family-B child B1 into the users collection; sign every protected request with `createIdentityHeaders`.

Cover these approved cases in `familyMedia.test.js`:

```js
test.each([
  ['avatar', null],
  ['avatar', CHILD_A1_ID],
  ['task_attachment', CHILD_A1_ID],
  ['task_completion', CHILD_A1_ID],
  ['mistake_question', CHILD_A1_ID],
  ['mistake_answer', CHILD_A1_ID],
  ['growth_evidence', CHILD_A1_ID]
])('TC-T6-MEDIA-001 parent uploads %s for child scope %s', async (purpose, childId) => {
  const response = await signedUpload(parentA, { purpose, childId, bytes: await image('jpeg') });
  expect(response.status).toBe(201);
  expect(response.body.data.media).toEqual({
    mediaId: expect.any(String), purpose, mimeType: 'image/jpeg', sizeBytes: expect.any(Number)
  });
  expect(JSON.stringify(response.body)).not.toMatch(/storageKey|original|filename|url/i);
});
```

Also prove:

- JPEG, PNG, and WebP are detected from bytes rather than filename/client MIME.
- corrupt, unsupported, empty, and over-10-MiB uploads return `400 VALIDATION_ERROR` and leave neither `MediaAsset` nor temporary/private objects.
- child A1 cannot target A2/B1 and cannot upload `avatar` or `task_attachment`; omitted childId resolves to A1 for the four approved child purposes.
- parent A cannot target child B1.
- a forced `MediaAsset.create` failure removes the newly written private object.
- stored JPEG/WebP bytes are decodable and contain no EXIF metadata.

- [ ] **Step 2: Run upload RED**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand familyMedia --testNamePattern='MEDIA-00[1-5]|persistence failure'
```

Expected: FAIL because the private media router, upload middleware, and service do not exist.

- [ ] **Step 3: Implement bounded temporary upload middleware**

`createPrivateMediaUpload` must use Multer disk storage with an opaque random filename under `<PRIVATE_MEDIA_ROOT>/.incoming`, create/chmod that directory as `0700`, enforce `fileSize=10 MiB`, and translate Multer `LIMIT_FILE_SIZE`, missing file, and multipart errors into operational `400 VALIDATION_ERROR` errors. It must never use or persist `file.originalname`.

Expose:

```js
const createPrivateMediaUpload = ({ privateRoot, fsPromises, randomUUID } = {}) => ({
  singleImage: Function,
  removeTemporary: async (temporaryPath) => Boolean
});
```

The route executes `removeTemporary(req.file.path)` in `finally`, including authorization, decode, persistence, and response failures.

- [ ] **Step 4: Implement upload authorization and persistence**

`createMediaService` accepts injected `MediaAssetModel`, `UserModel`, `mediaStore`, `capabilityService`, and `now`. Its `upload` method:

```js
upload({ identity, suppliedChildId, purpose, bytes })
```

must:

1. require `identity.id`, `identity.familyId`, and role `parent|student`;
2. validate the six-purpose enum;
3. reject a child-supplied different childId and force omitted childId to `identity.childId || identity.id`;
4. restrict children to `task_completion|mistake_question|mistake_answer|growth_evidence`;
5. permit `childId=null` only for a parent family-scoped avatar;
6. verify every non-null child with `{ _id: childId, familyId: identity.familyId, role: 'student' }` before private storage;
7. call `mediaStore.write(bytes)`, create active metadata, and remove the stored object if metadata persistence fails;
8. return only `mediaId`, `purpose`, `mimeType`, and `sizeBytes`.

Use stable errors: malformed input `400 VALIDATION_ERROR`; family, sibling, role, or child-scope denial `403 CHILD_ACCESS_DENIED`.

- [ ] **Step 5: Implement upload route and run GREEN**

The router must mount protected upload as:

```js
router.post('/', authenticate, upload.singleImage, asyncHandler(async (req, res) => {
  try {
    const bytes = await fsPromises.readFile(req.file.path);
    const media = await mediaService.upload({
      identity: req.user,
      suppliedChildId: req.body.childId,
      purpose: req.body.purpose,
      bytes
    });
    res.status(201).json({ success: true, data: { media } });
  } finally {
    await upload.removeTemporary(req.file && req.file.path);
  }
}));
```

Run:

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand familyMedia --testNamePattern='MEDIA-00[1-5]|persistence failure'
```

Expected: all upload, authorization, cleanup, and privacy cases pass.

### Task 2: Add Access Grants and Signed Content Streaming

**Files:**
- Modify: `backend/services/resource-service/services/mediaService.js`
- Modify: `backend/services/resource-service/routes/media.js`
- Modify: `backend/services/resource-service/__tests__/familyMedia.test.js`

- [ ] **Step 1: Write failing access/content tests**

Add cases that persist sanitized media through the upload route and then prove:

```js
test('TC-T6-MEDIA-006 returns a no-store capability without storage metadata', async () => {
  const response = await signedGet(parentA, `/api/media/${mediaId}/access`);
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body.data.access).toEqual({ url: expect.stringMatching(/\/content\?/), expiresAt: FIXED_EXPIRY });
  expect(JSON.stringify(response.body)).not.toMatch(/storageKey/);
});
```

`TC-T6-MEDIA-007` must request the returned URL without JWT and assert exact sanitized bytes plus:

```text
Cache-Control: private, no-store
Content-Disposition: inline
X-Content-Type-Options: nosniff
Content-Type: persisted mimeType
```

Independently tamper path, media ID, expiry, nonce, and signature and use an expired capability; every altered request returns `400 VALIDATION_ERROR` and no bytes. `TC-T6-MEDIA-008` must return `403 CHILD_ACCESS_DENIED` for family B, sibling A2, and a child requesting a family-scoped avatar. Missing/deleted owner access returns `404 RESOURCE_NOT_FOUND`.

- [ ] **Step 2: Run access/content RED**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand familyMedia --testNamePattern='MEDIA-00[6-8]'
```

Expected: FAIL because access grant and content handlers are absent.

- [ ] **Step 3: Implement service access policy and content lookup**

Add:

```js
issueAccess({ identity, mediaId })
readContent({ mediaId, path, expires, nonce, signature })
```

`issueAccess` validates ObjectId syntax, loads the asset, checks family first, enforces same-child access for students, permits `childId=null` only to parents in that family, rejects non-active media as `404`, and returns exactly the capability service result.

`readContent` first calls `capabilityService.verify` with every signed field, then loads `{ _id: mediaId, status: 'active' }`, reads only `storageKey` from the private store, and returns `{ bytes, mimeType }`. It never returns or redirects to a storage path.

- [ ] **Step 4: Implement route order and security headers**

Mount `GET /:mediaId/content` before `router.use(authenticate)`. Mount `GET /:mediaId/access` after authentication, set `Cache-Control: no-store`, and return:

```js
{ success: true, data: { access: { url, expiresAt } } }
```

The content route sets the four approved response headers and sends the exact bytes. It must not log the signed URL; shared request/error middleware handles query redaction.

- [ ] **Step 5: Run access/content GREEN**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand familyMedia --testNamePattern='MEDIA-00[6-8]'
```

Expected: all capability, stream, header, and scope cases pass.

### Task 3: Add Idempotent Soft Delete and App Integration

**Files:**
- Modify: `backend/services/resource-service/services/mediaService.js`
- Modify: `backend/services/resource-service/routes/media.js`
- Modify: `backend/services/resource-service/app.js`
- Modify: `backend/services/resource-service/__tests__/familyMedia.test.js`
- Modify: `backend/services/resource-service/__tests__/task6Startup.test.js`

- [ ] **Step 1: Write failing delete and mounting tests**

`TC-T6-MEDIA-009` must delete an owned active asset twice and expect `204` both times, one immutable `deletedAt`, retained private bytes, and immediate `404 RESOURCE_NOT_FOUND` from both access-grant and a previously issued content URL. Add cross-family, sibling, and child-to-family-avatar delete attempts expecting `403 CHILD_ACCESS_DENIED`.

Extend the startup test to inject a media router into `createApp` and assert it is reachable without database connection or listener startup.

- [ ] **Step 2: Run delete/mount RED**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand familyMedia task6Startup --testNamePattern='MEDIA-009|media router'
```

Expected: FAIL because delete and app mounting are absent.

- [ ] **Step 3: Implement atomic idempotent soft delete**

Add:

```js
deleteMedia({ identity, mediaId })
```

Load the asset regardless of status so an authorized retry remains `204`; apply the same family/child/family-scoped-avatar policy as access. For the first delete, use an atomic predicate `{ _id: mediaId, status: 'active' }` and `$set: { status: 'deleted', deletedAt: new Date(now()) }`. Never remove private bytes here. Phase 2C will extend this transaction to release only prepared references while retaining bound references.

- [ ] **Step 4: Mount the injected media router**

Extend `createApp` with an optional `mediaRouter` dependency and mount it at `/api/media` before legacy resource routes. Do not construct environment-bound media dependencies at module import time. Phase 5 will create the production router from validated environment configuration and add gateway/deployment routing.

- [ ] **Step 5: Run Phase 2B2 regression**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand familyMedia task6Startup
npm run test:family-regression
git diff --check
```

Expected: the complete resource-family suite and all six family regression projects pass with no open handles or formatting errors.

- [ ] **Step 6: Commit Phase 2B2**

```bash
git add backend/services/resource-service/middleware/privateMediaUpload.js \
  backend/services/resource-service/services/mediaService.js \
  backend/services/resource-service/routes/media.js \
  backend/services/resource-service/__tests__/familyMedia.test.js \
  backend/services/resource-service/__tests__/task6Startup.test.js \
  backend/services/resource-service/jest.family.config.js \
  backend/services/resource-service/app.js \
  docs/superpowers/plans/2026-06-21-family-growth-task6-phase2b2-media-api.md
git commit -m "feat: add private media API"
```

## Self-Review Checklist

- [x] `TC-T6-MEDIA-001` through `009` are covered at the correct route/integration level; reference-specific portions of `009` remain explicitly assigned to Phase 2C.
- [x] Upload authorization happens before private-object persistence; every temporary file is removed in `finally`; metadata failure removes the new object.
- [x] No response or structured log includes filename, original bytes, EXIF, temporary path, storage key, or signed URL.
- [x] Content requires no JWT but validates every capability field; all other routes require the signed gateway identity.
- [x] Family-scoped avatar rules and child/sibling/cross-family denials are identical for access and deletion.
- [x] No environment validation, database connection, or listener starts during module import.

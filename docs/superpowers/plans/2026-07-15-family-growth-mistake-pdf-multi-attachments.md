# Family Growth Mistake PDF and Multi-Attachment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver secure image/PDF collections for parent and child mistake question/answer attachments, add PDF to parent task attachments, and preserve legacy scalar media compatibility.

**Architecture:** Resource-service turns every upload into canonical private bytes, applies an explicit `trusted-local` or `secure-production` security policy, then persists a safe descriptor and private object. Analytics-service stores ordered canonical attachment arrays while retaining first-item scalar projections and extends the existing recoverable media-reference saga to repeated logical fields. Parent and child Web clients share collection rules and draft lifecycle but keep separate authenticated API methods.

**Tech Stack:** Node.js 22, Express, Mongoose/MongoDB replica sets, `sharp`, `pdf-lib`, TCP `clamd` protocol, React 18, Axios, Testing Library/Jest, Playwright, Docker Compose, Kubernetes.

## Global Constraints

- Every production-code behavior starts with a focused failing `TC-MPA-*` test and follows red-green-refactor.
- JPEG, PNG, WebP, and PDF input and canonical output are each limited to 10 MiB; PDF is limited to 1-50 pages and must be reparsed after serialization.
- PDF is allowed only for `task_attachment`, `mistake_question`, and `mistake_answer`; avatar, task completion, and growth evidence remain image-only.
- Each mistake group contains at most 10 unique media IDs, preserves first-occurrence order, and exposes both canonical arrays and deprecated first-item scalar projections.
- Parents and children may manage both question and answer arrays only within server-resolved family/child scope.
- `trusted-local` never constructs a scanner and records `skipped_trusted_local`; `secure-production` scans all canonical bytes, records only `clean`, and never silently degrades.
- Default local Compose remains ClamAV-free. A separate security overlay is the only real-scanner path and is not part of the 8 GiB local Gate.
- Public responses and logs never expose storage keys, temporary paths, scanner protocol text, malware bytes, identity envelopes, or signed URLs outside the existing access contract.
- Existing image, task-reference, mistake-state, rollback, family isolation, and Task 11 behavior must remain green.
- Baseline note: the 2026-07-15 full family run produced 762/763 passes with one `growthTasks.test.js` archive assertion failure; the exact case immediately passed in isolation. Do not modify that unrelated test unless the final full Gate reproduces a proven root cause.

---

### Task 1: Media Metadata and Public Descriptor Contract

**Files:**
- Modify: `backend/services/resource-service/models/MediaAsset.js`
- Modify: `backend/services/resource-service/middleware/privateMediaUpload.js`
- Modify: `backend/services/resource-service/services/mediaService.js`
- Modify: `backend/services/resource-service/routes/media.js`
- Modify: `backend/services/resource-service/__tests__/mediaModels.test.js`
- Modify: `backend/services/resource-service/__tests__/familyMedia.test.js`

**Interfaces:**
- Produces `sanitizeDisplayName(originalName): string`.
- Upload passes `{ bytes, originalName }` and returns `{ mediaId, purpose, mimeType, displayName, sizeBytes, pageCount? }`.
- Access returns `{ access, media }`; content returns descriptor fields required for `Content-Disposition`.

- [x] **Step 1: Write failing model and route tests**

Add `TC-MPA-MEDIA-006`, `009`, and `TC-MPA-SCAN-009` cases for bounded basename sanitization, legacy scan status, descriptor shape, image inline disposition, and absence of storage metadata.

```js
expect(upload.body.data.media).toEqual(expect.objectContaining({
  displayName: 'question.png',
  mimeType: 'image/png',
  sizeBytes: expect.any(Number)
}));
expect(upload.body.data.media).not.toHaveProperty('storageKey');
```

- [x] **Step 2: Verify red**

Run: `npx jest --config=backend/services/resource-service/jest.config.js --runInBand mediaModels familyMedia`

Expected: FAIL because descriptor and scan-audit fields do not exist.

- [x] **Step 3: Implement the metadata contract**

Add `displayName`, `pageCount`, `malwareScanStatus`, and `malwareScannedAt` model validation. Pass Multer `originalname` into the service. Sanitize only for display/disposition, never for storage. Keep image content inline and prepare PDF attachment disposition support without enabling PDF yet.

- [x] **Step 4: Verify green and regression**

Run the red command plus `privateMediaStore` and `mediaCapability` suites.

- [x] **Step 5: Commit**

```bash
git add backend/services/resource-service
git commit -m "feat: add private media descriptors"
```

### Task 2: Canonical Image/PDF Processing

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `backend/services/resource-service/package.json`, `backend/services/resource-service/package-lock.json`
- Create: `backend/services/resource-service/services/privateMediaProcessor.js`
- Modify: `backend/services/resource-service/services/privateMediaStore.js`
- Create: `backend/services/resource-service/__tests__/privateMediaProcessor.test.js`
- Modify: `backend/services/resource-service/__tests__/privateMediaStore.test.js`

**Interfaces:**
- `createPrivateMediaProcessor().prepare({ bytes, purpose, originalName })` returns `{ buffer, mimeType, displayName, sizeBytes, pageCount? }`.
- `mediaStore.writeCanonical(buffer)` stores already validated bytes and returns only `{ storageKey }`.
- Processor is the sole owner of magic-byte detection, purpose matrix, image re-encoding, PDF inspection, canonical serialization, and post-transform limits.

- [x] **Step 1: Add `pdf-lib@1.17.1` to root and resource-service lockfiles**

Use exact version `1.17.1`; do not add browser PDF rendering or native PDF dependencies.

- [x] **Step 2: Write failing image and PDF processor tests**

Implement `TC-MPA-MEDIA-001`-`008` fixtures in memory. Assert safe 1/50-page PDFs, 51-page/encrypted/malformed rejection, dangerous catalog/page/object names, magic-byte MIME, EXIF removal, purpose matrix, and pre/post 10 MiB checks.

```js
await expect(processor.prepare({
  bytes: javascriptPdf,
  purpose: 'mistake_question',
  originalName: 'unsafe.pdf'
})).rejects.toMatchObject({ code: 'PDF_ACTIVE_CONTENT_REJECTED' });
```

- [x] **Step 3: Verify red**

Run: `npx jest --config=backend/services/resource-service/jest.config.js --runInBand privateMediaProcessor`

Expected: FAIL because the processor is absent.

- [x] **Step 4: Implement conservative processing**

Detect image/PDF from bytes. Continue `sharp(..., { failOn: 'error' }).rotate()` image re-encoding. Load PDF with encryption disallowed and invalid objects rejected; traverse parsed dictionaries, arrays, names, and streams with cycle protection and reject the approved active-content tokens. Copy accepted pages into a new document, serialize without metadata-derived paths, verify `%PDF-`, size, page count, and second parse.

- [x] **Step 5: Refactor private storage and verify green**

Keep UUID/atomic-link/private-permission behavior in `privateMediaStore`; move format processing out. Run processor, store, media-model, and family-media suites.

- [x] **Step 6: Commit**

```bash
git add package.json package-lock.json backend/services/resource-service
git commit -m "feat: canonicalize private PDF media"
```

### Task 3: Security Profiles and ClamAV Adapter

**Files:**
- Create: `backend/services/resource-service/config/mediaSecurity.js`
- Create: `backend/services/resource-service/services/clamAvScanner.js`
- Modify: `backend/services/resource-service/services/mediaService.js`
- Modify: `backend/services/resource-service/server.js`
- Modify: `backend/services/resource-service/app.js`
- Create: `backend/services/resource-service/__tests__/mediaSecurity.test.js`
- Create: `backend/services/resource-service/__tests__/clamAvScanner.test.js`
- Modify: `backend/services/resource-service/__tests__/server.test.js`
- Modify: `backend/services/resource-service/__tests__/familyMedia.test.js`

**Interfaces:**
- `resolveMediaSecurity(env)` returns `{ profile, scannerConfig? }` and rejects absent production profile.
- Scanner exposes `ping(): Promise<void>` and `scan(buffer): Promise<void>`; `scan` resolves only for `OK` and throws stable `MALWARE_DETECTED` or `MALWARE_SCANNER_UNAVAILABLE` errors.
- Media service receives `processor`, `scanner|null`, and immutable `securityProfile`.

- [x] **Step 1: Write failing configuration/profile tests**

Cover `TC-MPA-SCAN-001`, `002`, `006`, `008`, and audit fields. In trusted-local, inject a scanner getter that throws if constructed.

- [x] **Step 2: Verify red**

Run: `npx jest --config=backend/services/resource-service/jest.config.js --runInBand mediaSecurity server familyMedia`

- [x] **Step 3: Implement profile resolution and pipeline integration**

Development/test default to trusted-local; production requires explicit valid mode. Scan canonical bytes before storage. Persist `skipped_trusted_local` or `clean`/timestamp only after the corresponding policy succeeds. Add health metadata without claiming scanner cleanliness in trusted-local.

- [x] **Step 4: Write failing TCP protocol tests**

Use a local fake TCP server for `TC-MPA-SCAN-003`-`007`: `PING`, bounded `INSTREAM` chunks, terminator, clean, found, timeout, refusal, malformed/oversized response, and socket cleanup.

- [x] **Step 5: Implement and verify the ClamAV adapter**

Use `net.createConnection`, `zPING\0`, and `zINSTREAM\0`; cap chunk and response sizes, own all timers/listeners, and sanitize outward errors. `startServer` performs `ping` after Mongo connection and before listen only in secure-production.

- [x] **Step 6: Commit**

```bash
git add backend/services/resource-service
git commit -m "feat: add explicit media scan profiles"
```

### Task 4: Canonical Mistake Attachment Arrays

**Files:**
- Modify: `backend/services/analytics-service/models/FamilyMistake.js`
- Modify: `backend/services/analytics-service/services/familyMistakePatch.js`
- Modify: `backend/services/analytics-service/routes/familyMistakes.js`
- Modify: `backend/services/analytics-service/__tests__/familyMistakes.test.js`

**Interfaces:**
- Canonical fields: `questionMediaIds`, `childAnswerMediaIds`.
- Compatibility aliases: `questionMediaId`, `childAnswerMediaId`.
- `normalizeMistakeMediaInput(data)` returns canonical changed arrays; ambiguous group input fails.
- `toPublicMistake` returns arrays plus first-item projections and normalizes legacy-only documents lazily.

- [x] **Step 1: Write failing parser/model/response tests**

Cover `TC-MPA-API-001`-`004`, `007`, `008`: legacy reads, alias requests, mixed rejection, dedupe/order, 0/10/11 limits, child self-scope, and both group permissions.

- [x] **Step 2: Verify red**

Run: `npx jest --config=backend/services/analytics-service/jest.family.config.js --runInBand familyMistakes`

- [x] **Step 3: Implement schema and strict parser**

Keep arrays absent on legacy rows, normalize on reads, store arrays on new mutations, and update/remove scalar projections atomically. Keep internal logical field names singular for resource references.

```js
const MEDIA_GROUPS = Object.freeze({
  questionMediaIds: 'questionMediaId',
  childAnswerMediaIds: 'childAnswerMediaId'
});
```

- [x] **Step 4: Verify green and commit**

Run family mistakes and startup suites, then commit.

```bash
git add backend/services/analytics-service
git commit -m "feat: add mistake attachment arrays"
```

### Task 5: Multi-Reference Mistake Saga and State Events

**Files:**
- Modify: `backend/services/analytics-service/services/familyMistakeMediaService.js`
- Modify: `backend/services/analytics-service/routes/familyMistakes.js`
- Modify: `backend/services/analytics-service/models/FamilyMistake.js`
- Modify: `backend/services/analytics-service/__tests__/familyMistakeMediaSaga.test.js`
- Modify: `backend/services/analytics-service/__tests__/familyMistakes.test.js`

**Interfaces:**
- Binding identity remains `(field, mediaId)` and supports repeated singular `field` values.
- Pending state carries ordered desired arrays, prior bindings, complete non-media patch, actor, and recoverable state-event intent.
- Owner publication and `FamilyMistakeStateEvent` persistence run in one local Mongo transaction after remote additions are bound and before removals are released.

- [x] **Step 1: Write failing multi-binding saga tests**

Cover `TC-MPA-API-005`, `006`, `009`, `010`: create, append, replace, reorder-only, remove-all, repeated field commands, stable/retryable failures, exact operation replay, and rollback projection behavior.

- [x] **Step 2: Verify red**

Run: `npx jest --config=backend/services/analytics-service/jest.family.config.js --runInBand familyMistakeMediaSaga`

- [x] **Step 3: Implement set-difference and ordered publication**

Prepare/commit additions, publish arrays/projections/non-media patch/`updatedBy`, then release removals. Reorder-only performs no resource call. Preserve exact binding generations and operation ID across recovery.

- [x] **Step 4: Write failing combined state/media tests**

Submit attachment changes with `reviewed`, `mastered`, or `reviewReminderDate`; force owner/event transaction failure and detail-read recovery. Assert no published state exists without its state event.

- [x] **Step 5: Implement transactional local publication and verify green**

Reuse the existing transaction runner/state-event builder instead of adding a separate non-recoverable post-publication write. Run saga, route, weekly-report cutoff, resource reference, and startup tests.

- [x] **Step 6: Commit**

```bash
git add backend/services/analytics-service
git commit -m "feat: bind mistake attachment collections"
```

### Task 6: Shared Web Media Collections and Child API

**Files:**
- Create: `frontend/web/src/components/family/privateMediaRules.js`
- Modify: `frontend/web/src/components/family/PrivateMediaCollectionField.js`
- Modify: `frontend/web/src/components/family/PrivateMediaField.js`
- Modify: `frontend/web/src/hooks/useDraftMedia.js`
- Modify: `frontend/web/src/services/familyApi.js`
- Modify: `frontend/web/src/services/childApi.js`
- Create: `frontend/web/src/__tests__/shared/PrivateMediaCollectionField.test.js`
- Create: `frontend/web/src/__tests__/shared/useDraftMedia.test.js`
- Modify: `frontend/web/src/__tests__/child/childApi.test.js`

**Interfaces:**
- Collection value remains ordered media descriptors/IDs and emits canonical ordered IDs.
- `useDraftMedia({ deleteMedia })` supports parent or child authenticated cleanup.
- Child API adds `uploadOwnPrivateMedia`, `getOwnPrivateMediaAccess`, and `deleteOwnPrivateMedia`; it never accepts `childId`.

- [x] **Step 1: Write failing shared rule/collection tests**

Cover `TC-MPA-WEB-001`-`003`, `007`, `008`: purpose limits, MIME/size hints, sequential partial failure, PDF metadata/download, image preview, no iframe, duplicate/order, draft cleanup, long names, and keyboard labels.

- [x] **Step 2: Verify red**

Run: `npm run test:ci --prefix frontend/web -- --runInBand PrivateMediaCollectionField useDraftMedia`

- [x] **Step 3: Implement shared rules, collection, and injected cleanup**

Keep `PrivateMediaField` image-only for avatar. Do not persist signed URLs. Stop a selected batch after the first failed upload while preserving prior successes.

- [x] **Step 4: Write child API red tests and implement**

Allow only canonical arrays in mistake payloads; attach the child bearer token per call; omit `childId` from multipart and method signatures.

- [x] **Step 5: Verify green and commit**

```bash
git add frontend/web/src
git commit -m "feat: add shared PDF media collections"
```

### Task 7: Parent and Child Mistake Workflows

**Files:**
- Modify: `frontend/web/src/pages/family/MistakesPage.js`
- Modify: `frontend/web/src/pages/family/TasksPage.js`
- Modify: `frontend/web/src/pages/child/ChildMistakesPage.js`
- Modify: `frontend/web/src/pages/child/ChildTaskPage.js`
- Modify: `frontend/web/src/family-shell.css`
- Modify: `frontend/web/src/child-shell.css`
- Modify: `frontend/web/src/__tests__/family/Task9LogsMistakes.test.js`
- Modify: `frontend/web/src/__tests__/family/Task9TodayTasks.test.js`
- Modify: `frontend/web/src/__tests__/child/ChildMistakes.test.js`
- Modify: `frontend/web/src/__tests__/child/ChildTodayTasks.test.js`

**Interfaces:**
- Parent and child forms send only `questionMediaIds` and `childAnswerMediaIds`.
- Legacy scalar records normalize to one-item arrays at form-open time.
- Each editor owns independent draft state; list rows show counts without access grants.

- [x] **Step 1: Write failing parent workflow tests**

Cover `TC-MPA-WEB-004`, `006`: create/edit/reopen, legacy normalization, arrays-only payload, counts, failure preservation, cleanup, and task PDF while retaining the 100-item limit.

- [x] **Step 2: Verify parent red, implement, and verify green**

Run the two family suites after each minimal implementation slice.

- [x] **Step 3: Write failing child workflow tests**

Cover `TC-MPA-WEB-005`, `008`: own create/review with both collections, child media auth, independent row drafts, error retry, 44px controls, and 360px-safe structure.

- [x] **Step 4: Verify child red, implement, and verify green**

Expose task image/PDF access in ChildTaskPage only when returned by the task API; no child upload is added to task completion in this increment.

- [x] **Step 5: Run frontend regression and commit**

```bash
npm run test:ci --prefix frontend/web -- --runInBand
git add frontend/web/src
git commit -m "feat: manage mistake attachment collections"
```

### Task 8: Deployment, E2E, Documentation, and Release Gate

**Files:**
- Modify: `docker-compose.family.yml`, `docker-compose.ubuntu.yml`
- Create: `docker-compose.security.yml`
- Modify: `deployment/kubernetes/resource-service-deployment.yaml`
- Create: `deployment/kubernetes/clamav-deployment.yaml`
- Create: `deployment/kubernetes/clamav-service.yaml`
- Modify: `deployment/kubernetes/kustomization.yaml` and deployment overlays/config as required
- Modify: `backend/common/deployment/__tests__/composeFamilySmoke.test.js`
- Modify/Create: deployment tests under `backend/common/deployment/__tests__/`
- Modify: `tests/e2e/task11/family-growth-flow.spec.js` and its fixtures/helpers
- Modify: `package.json`, `scripts/release-family-gate.sh`
- Modify: `docs/api/family-learning-tracker-api.md`, deployment/user guides, traceability, design asset index
- Create: `docs/development/family-growth-mistake-pdf-multi-attachments-gate.md`

**Interfaces:**
- Default Compose explicitly sets `MEDIA_SECURITY_PROFILE=trusted-local` and contains no scanner.
- Security overlay sets `secure-production`, private ClamAV networking/health, and no host-published scanner port.
- New `npm run test:family-security-scan` is separate from `npm run release:family`.

- [x] **Step 1: Write failing deployment static tests**

Cover `TC-MPA-DEPLOY-001`-`004`: default absence, explicit profile, secure overlay, digest pin, no ingress/host port, startup dependency, and Kubernetes 3 GiB request/4 GiB limit.

- [x] **Step 2: Verify red, implement deployment assets, verify green**

Use rendered Compose/Kustomize assertions; do not start ClamAV on the local 8 GiB Gate.

- [x] **Step 3: Extend real-service and browser E2E red-first**

Cover `TC-MPA-DEPLOY-005`-`006` parent/child upload, reload, PDF download, reorder, removal, sibling/cross-family denial, desktop, and 360px. Generate PDFs at runtime and assert no console error/overflow.

- [x] **Step 4: Add secure scanner smoke command**

Generate antivirus test content only at runtime, run only through the secure overlay, emit stable result codes, and always tear the overlay down. Keep the command protected/manual until a sized runner is configured.

- [x] **Step 5: Update final contracts and gate evidence**

Set implemented statuses only after evidence exists. Record exact commands, commit, suite/test counts, browser viewports, secure-scan runner constraints, and any approved residual risk.

- [ ] **Step 6: Run final verification**

```bash
npm run docs:family:check
npm run lint
npm run test:family-regression
npm run test:ci --prefix frontend/web -- --runInBand
npm run test:task11
npm run release:family
git diff --check
bash scripts/check-git-clean.sh
```

Run `npm run test:family-security-scan` only on a sufficiently sized scanner runner. The branch cannot claim secure-production release approval without it.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "test: close secure attachment release gate"
```

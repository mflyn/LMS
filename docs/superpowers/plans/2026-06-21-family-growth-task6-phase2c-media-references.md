# Task 6 Phase 2C Media References and Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the internal prepare/commit/unbind media-reference protocol, transactional deletion integration, expired-lease reclamation, and 30-day physical cleanup while retaining bound business references.

**Architecture:** Resource-service owns reference state through one dependency-injected service and three internal-only routes protected by an independent constant-time service credential. Batch prepare/commit/unbind commands use one resource identity, one operation UUID, and normalized `{ mediaId, field }` references; Mongo transactions make each batch and media deletion atomic. Cleanup is a separate idempotent service that removes bytes and metadata only after deletion age, last-release age, and bound-reference conditions all pass.

**Tech Stack:** Node.js crypto, Express, Mongoose transactions, MongoMemoryReplSet, Jest, Supertest

---

## Command Contract

All three internal commands accept:

```json
{
  "familyId": "6656875da7f86a0012c2a101",
  "childId": "6656875da7f86a0012c2a301",
  "resourceType": "family_mistake",
  "resourceId": "6656875da7f86a0012c2a501",
  "operationId": "5dc38fc9-ee29-4dba-9181-df49f66b9050",
  "references": [
    { "mediaId": "6656875da7f86a0012c2a601", "field": "questionMediaId" }
  ]
}
```

`references` is non-empty, normalized, sorted, and deduplicated by `(mediaId, field)`. Field-purpose mapping is fixed:

```text
child.avatarMediaId                    -> avatar
growth_task.attachmentMediaIds         -> task_attachment
family_mistake.questionMediaId         -> mistake_question
family_mistake.childAnswerMediaId      -> mistake_answer
```

Success returns `200 { success: true, data: { references: [...] } }`; each item contains only `mediaId`, `field`, `state`, and applicable `leaseExpiresAt`/`releasedAt`. Internal storage IDs, credentials, and storage keys are never returned.

### Task 1: Correct the Resource Integration-Test Contract

**Files:**
- Modify: `backend/services/resource-service/jest.family.config.js`
- Modify: `backend/services/resource-service/__tests__/familyMedia.test.js`

- [x] **Step 1: Add a failing real-handler assertion**

Remove `testErrorHandler` from `familyMedia.test.js`, mount the shared `errorHandler`, and assert one invalid media request returns the approved production envelope. Add a Jest module mapping for `uuid` to its Node CommonJS entry so resource-family resolves the same runtime branch as production.

- [x] **Step 2: Run RED**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand familyMedia --testNamePattern='production error envelope'
```

Expected: FAIL before the mapping because Jest resolves the browser ESM export, then pass only after the Node CJS mapping is configured.

- [x] **Step 3: Run the complete existing media API suite**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand familyMedia
```

Expected: all existing media API cases pass through the real shared error handler.

### Task 2: Add Service Credential and Reference State Machine

**Files:**
- Create: `backend/services/resource-service/middleware/mediaReferenceCredential.js`
- Create: `backend/services/resource-service/services/mongoTransaction.js`
- Create: `backend/services/resource-service/services/mediaReferenceService.js`
- Create: `backend/services/resource-service/routes/internalMediaReferences.js`
- Create: `backend/services/resource-service/__tests__/mediaReferences.test.js`
- Modify: `backend/services/resource-service/jest.family.config.js`

- [x] **Step 1: Write failing credential and state-machine tests**

Use one `MongoMemoryReplSet`, the real `MediaAsset`/`MediaReference` models, the shared error handler, and Supertest. Cover:

- `TC-T6-MEDIA-011`: absent, short, and incorrect `x-service-token` return `401 INVALID_SERVICE_CREDENTIAL` on prepare, commit, and unbind; a valid token reaches the command; constructor secrets shorter than 32 characters fail fast.
- `TC-T6-MEDIA-012`: prepare, replay prepare, commit, replay commit, unbind, and replay unbind converge on one row without duplicates; duplicate request entries normalize to one row.
- one batch with question and answer media commits all rows atomically.
- same reference with a different unexpired prepared operation returns `409 RESOURCE_CONFLICT`.
- a released reference can be prepared by a new operation, but replaying its released operation cannot resurrect it.

- [x] **Step 2: Run state-machine RED**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand mediaReferences --testNamePattern='MEDIA-01[1-2]|atomic|conflict|resurrect'
```

Expected: FAIL because credential middleware, service, and internal routes do not exist.

- [x] **Step 3: Implement constant-time service credential**

`createMediaReferenceCredential(expectedToken)` validates a configured token of at least 32 characters, hashes supplied and expected values to equal-length SHA-256 buffers, compares with `crypto.timingSafeEqual`, reads only `x-service-token`, and passes `401 INVALID_SERVICE_CREDENTIAL` to the shared error handler without logging either value.

- [x] **Step 4: Implement transaction runner and command validation**

`createMongoTransactionRunner(connection)` starts one session, executes `withTransaction`, returns the callback result, and always ends the session. The reference service validates all IDs, UUID operation ID, resource type/field pairs, and a non-empty bounded references array before starting writes.

- [x] **Step 5: Implement prepare/commit/unbind**

`createMediaReferenceService` exposes:

```js
prepare(command)
commit(command)
unbind(command)
reclaimExpiredPrepared({ limit })
releasePreparedForDeletedMedia({ mediaId, releasedAt, session })
```

Prepare validates each asset as active, same family/child, and exact field purpose, then creates a `prepared` row with `leaseExpiresAt = now + leaseSeconds`. Same-operation replay returns the current row without extending the lease. A bound identity is already satisfied; a released row requires a new operation; a different live prepared operation conflicts.

Commit changes only matching non-expired prepared rows to `bound` and clears the lease. Same-operation bound replay returns the row; missing, released, expired, or mismatched-operation rows never bind.

Unbind requires the original binding/preparation operation ID, changes matching prepared or bound rows to `released`, clears the lease, and sets `releasedAt` once. Released replay preserves the original timestamp; a missing row is an idempotent no-op result.

- [x] **Step 6: Implement internal-only routes and run GREEN**

Mount `POST /prepare`, `/commit`, and `/unbind` behind the credential middleware. Log only operation name/result plus familyId, childId, resource type/ID, and media IDs.

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand mediaReferences --testNamePattern='MEDIA-01[1-2]|atomic|conflict|resurrect'
```

Expected: all credential and state-machine cases pass.

### Task 3: Enforce Scope, Purpose, Lease, and Delete Semantics

**Files:**
- Modify: `backend/services/resource-service/__tests__/mediaReferences.test.js`
- Modify: `backend/services/resource-service/__tests__/familyMedia.test.js`
- Modify: `backend/services/resource-service/services/mediaReferenceService.js`
- Modify: `backend/services/resource-service/services/mediaService.js`

- [x] **Step 1: Write failing validation and reclamation tests**

Cover `TC-T6-MEDIA-013` for missing/deleted media (`404 RESOURCE_NOT_FOUND`), wrong family/child (`403 CHILD_ACCESS_DENIED`), and wrong field purpose (`400 MEDIA_PURPOSE_MISMATCH`) with no partial batch rows. Cover `TC-T6-MEDIA-014` by reclaiming only expired prepared rows while retaining live prepared, bound, and released rows.

- [x] **Step 2: Write failing transactional delete test**

Replace the existing family-media test database with a one-node `MongoMemoryReplSet`, then extend `TC-T6-MEDIA-009`: create one prepared and one bound reference for the same media, delete twice, and prove the first delete atomically releases only prepared rows, preserves bound rows and bytes, rejects every new prepare, and keeps the second delete side-effect free.

- [x] **Step 3: Run RED**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand mediaReferences familyMedia --testNamePattern='MEDIA-009|MEDIA-01[3-4]'
```

Expected: validation/reclamation and delete-reference assertions fail before integration.

- [x] **Step 4: Implement stable validation and lease reclamation**

Run prepare validation for the whole normalized batch before creating any row. `reclaimExpiredPrepared` deletes only `state=prepared, leaseExpiresAt<=now` rows, in bounded batches, and is idempotent.

- [x] **Step 5: Integrate transactional delete**

Inject the transaction runner and `MediaReferenceModel` into `mediaService`. Within one transaction, authorize the asset, atomically set the first `deletedAt`, and update only prepared references to `released` with that same timestamp. Never release bound references and never remove bytes during soft delete.

- [x] **Step 6: Run GREEN**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand mediaReferences familyMedia --testNamePattern='MEDIA-009|MEDIA-01[3-4]'
```

Expected: all scope, purpose, reclamation, and deletion cases pass.

### Task 4: Add 30-Day Physical Cleanup

**Files:**
- Create: `backend/services/resource-service/services/mediaCleanupService.js`
- Create: `backend/services/resource-service/__tests__/mediaCleanup.test.js`
- Modify: `backend/services/resource-service/jest.family.config.js`

- [x] **Step 1: Write failing retention-boundary tests**

`TC-T6-MEDIA-010` creates deleted assets covering:

- deleted 29 days ago, no references;
- deleted exactly 30 days ago, no references;
- deleted over 30 days ago with a bound reference;
- deleted over 30 days ago, released 29 days ago;
- deleted over 30 days ago, released exactly 30 days ago;
- already-missing private bytes and repeated cleanup.

Assert cleanup requires no bound reference and 30 full days after both deletion and latest release; eligible cleanup removes bytes, `MediaAsset`, and released-reference metadata only.

- [x] **Step 2: Run cleanup RED**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand mediaCleanup
```

Expected: FAIL because `mediaCleanupService` does not exist.

- [x] **Step 3: Implement bounded idempotent cleanup**

`cleanupDeletedMedia({ limit = 100 })` selects `status=deleted, deletedAt<=cutoff`, rejects invalid limits, skips any bound reference, checks the latest `releasedAt<=cutoff`, removes the private object idempotently, conditionally deletes the still-eligible asset, and then removes released reference rows. Return only counts and cleaned media IDs; never return storage keys.

- [x] **Step 4: Run cleanup GREEN**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand mediaCleanup
```

Expected: all independent deletion/release boundaries and replay cases pass.

### Task 5: Mount Internal Router and Run the Phase Gate

**Files:**
- Modify: `backend/services/resource-service/app.js`
- Modify: `backend/services/resource-service/__tests__/task6Startup.test.js`
- Create: `backend/services/resource-service/__tests__/familyMediaPrivacy.test.js`
- Modify: `backend/services/resource-service/jest.family.config.js`

- [x] **Step 1: Add failing app-mount and privacy tests**

Inject `internalMediaRouter` into `createApp`, mount it at `/api/internal/media/references`, and prove construction/import still causes no database connection or listener. Capture upload/access/content/prepare/commit/unbind/delete logs for `TC-T6-MEDIA-015`; assert no bytes, original filename, EXIF, temporary/storage key, signed URL/query, or service credential appears.

- [x] **Step 2: Run mount/privacy RED**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand task6Startup familyMediaPrivacy
```

Expected: app-mount and complete privacy-flow assertions fail before wiring.

- [x] **Step 3: Mount only by explicit injection and run GREEN**

Add optional `internalMediaRouter` to `createApp`; do not create environment-bound services during import. Phase 5 will construct production routers from validated environment and will keep this internal prefix out of gateway routes.

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand task6Startup familyMediaPrivacy
```

Expected: startup isolation and privacy flow pass.

- [x] **Step 4: Run Phase 2C regression**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand
npm run test:family-regression
git diff --check
```

Expected: resource-family and all six family projects pass with no open handles or formatting errors.

- [x] **Step 5: Commit Phase 2C**

```bash
git add backend/services/resource-service \
  docs/superpowers/plans/2026-06-21-family-growth-task6-phase2c-media-references.md
git commit -m "feat: add private media references"
```

## Self-Review Checklist

- [x] `TC-T6-MEDIA-009` through `015` have executable route/integration evidence at their approved levels.
- [x] Every batch command is all-or-none, normalized, operation-scoped, and idempotent.
- [x] Deleted media rejects prepare; soft delete releases prepared only and retains bound references and bytes.
- [x] Cleanup independently enforces deletion age, latest-release age, and no-bound-reference conditions.
- [x] Internal credential, signed URLs, storage metadata, bytes, and private text never enter responses or logs.
- [x] Internal routes are injectable into resource-service but remain absent from gateway routing.
- [x] Module import still performs no database connection, transaction, cleanup, or listener startup.

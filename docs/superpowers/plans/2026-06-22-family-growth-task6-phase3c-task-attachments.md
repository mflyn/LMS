# Task 6 Phase 3C GrowthTask Attachment Consumer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Document status:** READY FOR EXECUTION
**Design:** `docs/superpowers/specs/2026-06-22-family-growth-task6-phase3c-task-attachments-design.md`
**Test cases:** `docs/development/family-growth-task6-phase3c-test-cases.md`

**Goal:** Add durable, recoverable private attachments to GrowthTask create and patch operations while exposing only committed references and preserving every existing task lifecycle.

**Architecture:** GrowthTask stores an owner-local ordered attachment intent and per-media binding generations before homework-service calls resource-service. A focused state service performs normalization, compare-and-set transitions, prepare/commit, public publication, checked batch unbind, and recovery; a strict parser builds only canonical task paths. The existing router factory injects the service for tests and future deployment composition while its default remains media-disabled.

**Tech Stack:** Node.js, Express, Mongoose, MongoMemoryServer, Jest, Supertest, Phase 3A `mediaReferenceClient`

---

## File Map

| File | Responsibility |
| --- | --- |
| `backend/services/homework-service/models/GrowthTask.js` | Ordered public attachment IDs, hidden generation/intent fields, and document invariants |
| `backend/services/homework-service/services/growthTaskPatch.js` | Strict create/patch request whitelist, ID normalization, and canonical Mongo paths |
| `backend/services/homework-service/services/growthTaskAttachmentMediaService.js` | Durable create/patch claim, prepare/commit, publication, checked unbind, resume, and CAS conflict handling |
| `backend/services/homework-service/routes/growthTasks.js` | Authorization, service invocation, safe views, lifecycle recovery, and injected composition |
| `backend/services/homework-service/__tests__/models/GrowthTask.mediaReferences.test.js` | `TC-T6-MEDIA-017A` model evidence |
| `backend/services/homework-service/__tests__/services/growthTaskAttachmentMediaService.test.js` | `017B`, `017D`, `017E`, `017F`, `017G`, `017H`, `017I`, `017K`, `017L` state-machine evidence |
| `backend/services/homework-service/__tests__/growthTaskMediaReferences.test.js` | `017B`, `017C`, `017D`, `017E`, `017G`, `017H`, `017I`, `017J`, `017K`, `017M`, `018C`, `018D` route/contract evidence |
| `backend/services/homework-service/__tests__/growthTasks.test.js` | Existing task lifecycle, star award, filtering, and pagination regression |
| `docs/development/family-growth-task6-phase3c-review.md` | Final design/test/implementation traceability and gate evidence |

## Task 1: Add GrowthTask Media Persistence Invariants

**Files:**
- Modify: `backend/services/homework-service/models/GrowthTask.js`
- Create: `backend/services/homework-service/__tests__/models/GrowthTask.mediaReferences.test.js`

- [x] **Step 1: Write failing `TC-T6-MEDIA-017A` model tests**

Use the real model to cover legacy none, stable bound, create pending, patch binding, and patch unbinding states. Explicitly select hidden fields and assert ordinary queries omit them:

```js
const HIDDEN_MEDIA_PATHS = [
  '+attachmentMediaBindings',
  '+mediaBindingOperationId',
  '+attachmentMediaPendingIds',
  '+attachmentMediaPreviousBindings',
  '+mediaBindingPhase',
  '+mediaPendingTaskPatch',
  '+mediaMutationKind',
  '+mediaRemoteOutcomeUncertain'
].join(' ');

const publicTask = await GrowthTask.findById(task._id).lean();
expect(publicTask.mediaBindingOperationId).toBeUndefined();
const internalTask = await GrowthTask.findById(task._id).select(HIDDEN_MEDIA_PATHS).lean();
expect(internalTask.mediaBindingOperationId).toBe(OPERATION_A);
```

Reject duplicate public IDs, binding arrays that differ in ID or order, malformed UUIDs/ObjectIds, incomplete pending state, internal metadata on stable state, invalid phase/kind, and non-canonical pending paths.

- [x] **Step 2: Run model RED**

```bash
npx jest --config backend/services/homework-service/jest.config.js --runInBand GrowthTask.mediaReferences
```

Expected: FAIL because GrowthTask has no attachment media state.

- [x] **Step 3: Add strict sub-schemas and fields**

Define reusable strict sub-schemas and additive owner fields:

```js
const OPERATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const attachmentBindingSchema = new Schema({
  mediaId: { type: Schema.Types.ObjectId, required: true },
  bindingOperationId: { type: String, required: true, match: OPERATION_ID_PATTERN }
}, { _id: false, strict: 'throw' });

const pendingTaskPatchSchema = new Schema({
  path: {
    type: String,
    required: true,
    enum: [
      'dimension', 'area', 'subject', 'title', 'taskType', 'description',
      'dueDate', 'estimatedMinutes', 'targetAmount', 'unit', 'priority'
    ]
  },
  value: { type: Schema.Types.Mixed }
}, { _id: false, strict: 'throw' });
```

Add `attachmentMediaIds`, `attachmentMediaBindings`, `mediaReferenceState`, `mediaBindingOperationId`, `attachmentMediaPendingIds`, `attachmentMediaPreviousBindings`, `mediaBindingPhase`, `mediaPendingTaskPatch`, `mediaMutationKind`, and `mediaRemoteOutcomeUncertain`. Mark every field except public IDs/state as `select:false`. Model validation limits public, pending, and previous arrays to 100 entries so internal callers cannot bypass the resource-service command bound.

- [x] **Step 4: Add one document invariant validator**

Normalize missing legacy state to `none`; require public IDs and binding entries to be unique and ordered identically; require stable none/bound metadata rules; require complete pending metadata; require explicit `value` ownership on each pending patch entry. Do not infer generations from IDs.

- [x] **Step 5: Run model GREEN and existing task model tests**

```bash
npx jest --config backend/services/homework-service/jest.config.js --runInBand \
  GrowthTask.mediaReferences GrowthTask
```

Expected: all matching suites pass with no validation warning.

- [x] **Step 6: Commit model contract**

```bash
git add backend/services/homework-service/models/GrowthTask.js \
  backend/services/homework-service/__tests__/models/GrowthTask.mediaReferences.test.js
git commit -m "feat: add growth task attachment state"
```

## Task 2: Build Strict GrowthTask Request Parsing

**Files:**
- Create: `backend/services/homework-service/services/growthTaskPatch.js`
- Create: `backend/services/homework-service/__tests__/services/growthTaskAttachmentMediaService.test.js`

- [x] **Step 1: Write failing parser cases from `017H`, `017I`, and `018C`**

Assert first-occurrence normalization, exact create/patch whitelists, canonical entries, empty-array removal, maximum input length, and rejection of unknown/raw/internal input:

```js
expect(parseGrowthTaskPatch({
  title: '  新任务  ',
  priority: 'high',
  attachmentMediaIds: [MEDIA_A, MEDIA_B, MEDIA_A]
})).toEqual({
  entries: [
    { path: 'title', value: '新任务' },
    { path: 'priority', value: 'high' }
  ],
  hasAttachmentMutation: true,
  attachmentMediaIds: [MEDIA_A, MEDIA_B]
});
```

Cover `attachments`, URLs, objects, `null`, scalars, 101 entries, `$set`, dotted keys, wrappers, ownership/status fields, and every hidden media field.

- [x] **Step 2: Run parser RED**

```bash
npx jest --config backend/services/homework-service/jest.config.js --runInBand \
  growthTaskAttachmentMediaService --testNamePattern='017H|017I|018C'
```

Expected: FAIL because `growthTaskPatch` does not exist.

- [x] **Step 3: Implement constants and normalization**

Export `parseGrowthTaskCreate`, `parseGrowthTaskPatch`, `entriesToMongoSet`, and `normalizeAttachmentMediaIds`. Reject any key outside fixed sets before building paths:

```js
const CREATE_FIELDS = new Set([
  'childId', 'dimension', 'area', 'subject', 'title', 'taskType',
  'description', 'dueDate', 'estimatedMinutes', 'targetAmount',
  'unit', 'priority', 'attachmentMediaIds'
]);
const PATCH_FIELDS = new Set([...CREATE_FIELDS].filter((field) => field !== 'childId'));
const EDITABLE_PATHS = new Set([...PATCH_FIELDS].filter((field) => field !== 'attachmentMediaIds'));
```

Validate the input array length before deduplication, validate each 24-hex ID, lowercase IDs for equality, and preserve first occurrence. Build paths from `EDITABLE_PATHS` only; never copy request keys into a Mongo update.

- [x] **Step 4: Run parser GREEN**

```bash
npx jest --config backend/services/homework-service/jest.config.js --runInBand \
  growthTaskAttachmentMediaService --testNamePattern='017H|017I|018C'
```

Expected: parser and normalization cases pass.

- [x] **Step 5: Commit request boundary**

```bash
git add backend/services/homework-service/services/growthTaskPatch.js \
  backend/services/homework-service/__tests__/services/growthTaskAttachmentMediaService.test.js
git commit -m "feat: validate growth task attachment input"
```

## Task 3: Implement Create Binding, Rollback, and Recovery

**Files:**
- Create: `backend/services/homework-service/services/growthTaskAttachmentMediaService.js`
- Modify: `backend/services/homework-service/__tests__/services/growthTaskAttachmentMediaService.test.js`

- [x] **Step 1: Write failing `017B`, `017D`, and `017E` service cases**

Use the real model, fixed UUID generator, and injected media client. Assert exact create command:

```js
expect(mediaReferenceClient.prepare).toHaveBeenCalledWith({
  familyId: FAMILY_A,
  childId: CHILD_A,
  resourceType: 'growth_task',
  resourceId: taskId,
  operationId: OPERATION_A,
  references: [
    { mediaId: MEDIA_A, field: 'attachmentMediaIds' },
    { mediaId: MEDIA_B, field: 'attachmentMediaIds' }
  ]
});
```

Cover direct stable first-prepare rejection, confirmed and uncertain task deletion, lost prepare/commit responses, commit failure, failed/lost owner publication, and crash after uncertainty marker before prepare.

- [x] **Step 2: Run create RED**

```bash
npx jest --config backend/services/homework-service/jest.config.js --runInBand \
  growthTaskAttachmentMediaService --testNamePattern='017B|017D|017E'
```

Expected: FAIL because the attachment service does not exist.

- [x] **Step 3: Implement service construction and fixed errors**

Export `createGrowthTaskAttachmentMediaService({ GrowthTaskModel, mediaReferenceClient, randomUUID, logger })`. Validate every dependency and define sanitized errors:

```js
const pendingError = (taskId) => Object.assign(
  new Error('Media reference operation is pending'),
  { status: 503, code: 'MEDIA_REFERENCE_PENDING', details: { resourceId: String(taskId) } }
);
const conflictError = () => Object.assign(
  new Error('Growth task attachments changed concurrently'),
  { status: 409, code: 'RESOURCE_CONFLICT', details: [] }
);
```

Internal loads explicitly select all hidden paths. No caught client/database object is attached to an outward error.

- [x] **Step 4: Implement owner-first create claim**

`create({ taskInput, attachmentMediaIds })` uses ordinary `GrowthTask.create` for an empty desired list. For a non-empty list, preallocate `_id` and save empty public IDs/bindings plus pending desired IDs, empty previous bindings, `mutationKind=create`, `phase=binding`, `mediaRemoteOutcomeUncertain=false`, and one random operation.

- [x] **Step 5: Implement first-attempt rollback boundary**

Before prepare, CAS-set `mediaRemoteOutcomeUncertain=true` and increment `__v`. The same in-process first attempt may delete on a direct stable prepare response using `_id`, family/child IDs, operation, kind, state, phase, and version. Return the stable error only when `deletedCount===1`; otherwise return pending. A resumed attempt never deletes from a stable response.

- [x] **Step 6: Implement create binding resume**

Replay prepare and commit for all desired IDs. After commit, CAS-publish IDs and bindings in desired order, set stable bound, clear all hidden intent fields, and increment `__v`. If a transition throws or returns no row, reload: return an already-converged task, otherwise throw pending.

- [x] **Step 7: Run create GREEN**

```bash
npx jest --config backend/services/homework-service/jest.config.js --runInBand \
  growthTaskAttachmentMediaService --testNamePattern='017B|017D|017E'
```

Expected: create, rollback, uncertainty, and recovery cases pass with no duplicate task/reference.

- [x] **Step 8: Commit create recovery**

```bash
git add backend/services/homework-service/services/growthTaskAttachmentMediaService.js \
  backend/services/homework-service/__tests__/services/growthTaskAttachmentMediaService.test.js
git commit -m "feat: bind growth task attachments"
```

## Task 4: Implement Patch Difference, Publication, and Checked Unbind

**Files:**
- Modify: `backend/services/homework-service/services/growthTaskAttachmentMediaService.js`
- Modify: `backend/services/homework-service/__tests__/services/growthTaskAttachmentMediaService.test.js`

- [ ] **Step 1: Write failing `017F`, `017G`, `017H`, `017I`, and `017L` cases**

Record prepare, commit, publication, unbind, and finalization events. For `[A,B] -> [B,C]`, assert prepare/commit contains only C and unbind contains only A with its previous generation:

```js
expect(mediaReferenceClient.unbind).toHaveBeenCalledWith({
  familyId: FAMILY_A,
  childId: CHILD_A,
  resourceType: 'growth_task',
  resourceId: taskId,
  operationId: OPERATION_B,
  references: [{
    mediaId: MEDIA_A,
    field: 'attachmentMediaIds',
    bindingOperationId: OPERATION_A
  }]
});
```

Cover clear-all, replay, reorder-only, identical order, 100-ID boundary, combined ordinary patch, direct stable rejection, and every publication/unbind/finalization uncertainty.

- [ ] **Step 2: Run patch RED**

```bash
npx jest --config backend/services/homework-service/jest.config.js --runInBand \
  growthTaskAttachmentMediaService --testNamePattern='017F|017G|017H|017I|017L'
```

Expected: FAIL because patch, ordered differences, and checked unbind are absent.

- [ ] **Step 3: Implement stable no-op and reorder-only publication**

`mutate({ task, taskPatch, attachmentMediaIds })` resumes an existing intent first. Omitted attachments apply only canonical entries with observed-version CAS. Identical IDs/order do the same. Set-equal reorder updates public IDs and reorders current binding entries by ID with no media call.

- [ ] **Step 4: Implement patch claim and binding**

Compute additions/removals/unchanged from normalized IDs. CAS-claim the desired list, complete previous binding snapshot, canonical patch, random operation, patch kind, false uncertainty flag, and binding phase while leaving public fields unchanged. If additions exist, set uncertainty before prepare, then replay prepare/commit additions only.

- [ ] **Step 5: Implement atomic public publication**

Build desired bindings from unchanged previous entries plus `{mediaId, bindingOperationId: currentOperation}` for each addition. One CAS publishes desired IDs/bindings and canonical task entries. It either finalizes stable bound/none or moves to unbinding with previous snapshot intact.

- [ ] **Step 6: Implement checked batch unbind and finalization**

Derive removals from previous bindings absent from desired IDs. Send one unbind command with every expected generation. On success, CAS-finalize and clear pending fields. Any failure retains intent and returns pending; reload recognizes already-finalized state. Never send an empty media command.

- [ ] **Step 7: Run full service GREEN**

```bash
npx jest --config backend/services/homework-service/jest.config.js --runInBand \
  growthTaskAttachmentMediaService
```

Expected: `017B`, `017D-I`, and `017L` service cases pass without sleep or retry wrappers.

- [ ] **Step 8: Commit complete mutation state machine**

```bash
git add backend/services/homework-service/services/growthTaskAttachmentMediaService.js \
  backend/services/homework-service/__tests__/services/growthTaskAttachmentMediaService.test.js
git commit -m "feat: recover growth task attachment changes"
```

## Task 5: Add Deterministic Concurrency and Lifecycle Exclusion

**Files:**
- Modify: `backend/services/homework-service/services/growthTaskAttachmentMediaService.js`
- Modify: `backend/services/homework-service/__tests__/services/growthTaskAttachmentMediaService.test.js`
- Create: `backend/services/homework-service/__tests__/growthTaskMediaReferences.test.js`

- [ ] **Step 1: Write failing `017J` and `017K` concurrency/read cases**

Use barriers around the first owner claim and remote call. Race identical arrays, different arrays, non-attachment patch, complete, and delete. Add safe-view assertions for create binding, patch binding, and unbinding.

- [ ] **Step 2: Run concurrency RED**

```bash
npx jest --config backend/services/homework-service/jest.config.js --runInBand \
  growthTaskAttachmentMediaService growthTaskMediaReferences \
  --testNamePattern='017J|017K'
```

Expected: FAIL because CAS-loser policy and HTTP lifecycle recovery are absent.

- [ ] **Step 3: Implement CAS-loser policy**

When claim returns null, reload hidden state. If pending desired IDs equal the request, resume the winner and return convergence. If they differ, resume the winner and throw `RESOURCE_CONFLICT`. Profile-only patch resumes first, reloads, then applies its own observed-version CAS.

- [ ] **Step 4: Add service-level public view helper**

Export `publicAttachmentMediaIds(task)` as normalized strings from public `attachmentMediaIds` only. It never reads pending IDs. Binding therefore returns old/empty public IDs and unbinding returns desired public IDs.

- [ ] **Step 5: Add route-test fixture and lifecycle expectations**

Mount `createGrowthTaskRouter({ attachmentMediaService, awardTaskStar })` with `express.json()` and production `errorHandler`. Assert complete/confirm/delete call resume before status changes and return pending without mutation when recovery cannot converge.

- [ ] **Step 6: Run concurrency GREEN**

```bash
npx jest --config backend/services/homework-service/jest.config.js --runInBand \
  growthTaskAttachmentMediaService growthTaskMediaReferences \
  --testNamePattern='017J|017K'
```

Expected: deterministic barrier cases pass; no timing sleep is present.

- [ ] **Step 7: Commit concurrency and lifecycle safeguards**

```bash
git add backend/services/homework-service/services/growthTaskAttachmentMediaService.js \
  backend/services/homework-service/__tests__/services/growthTaskAttachmentMediaService.test.js \
  backend/services/homework-service/__tests__/growthTaskMediaReferences.test.js
git commit -m "feat: serialize growth task attachment recovery"
```

## Task 6: Integrate the Public GrowthTask Contract

**Files:**
- Modify: `backend/services/homework-service/routes/growthTasks.js`
- Modify: `backend/services/homework-service/__tests__/growthTaskMediaReferences.test.js`
- Modify: `backend/services/homework-service/__tests__/growthTasks.test.js`

- [ ] **Step 1: Write remaining route RED cases**

Add route tests `017B`, `017C`, `017D`, `017E`, `017G`, `017H`, `017I`, `017M`, `018C`, and `018D`: valid create/patch, stable rollback, pending envelope, disabled mode, authorization, unsafe body rejection, detail resume, list no-remote behavior, hidden-field omission, privacy logging, legacy view omission, import side-effect checks, and preservation of `repeatRule -> 400 REPEAT_RULE_NOT_SUPPORTED`.

- [ ] **Step 2: Run route RED**

```bash
npx jest --config backend/services/homework-service/jest.config.js --runInBand \
  growthTaskMediaReferences growthTasks
```

Expected: FAIL because the router still rejects every `attachmentMediaIds` request and returns legacy `attachments`.

- [ ] **Step 3: Extend the router factory without changing the default contract**

Use:

```js
const createGrowthTaskRouter = ({
  awardTaskStar = defaultStarAwardClient.awardTaskStar,
  attachmentMediaService = null
} = {}) => {
```

Default composition returns `400 MEDIA_NOT_ENABLED` only when `attachmentMediaIds` is supplied. Legacy `attachments` is always `400 VALIDATION_ERROR`; non-media requests continue unchanged.

- [ ] **Step 4: Integrate create and patch**

Before strict parsing, retain the existing explicit `repeatRule` check and its `400 REPEAT_RULE_NOT_SUPPORTED` error. Parse all other bodies strictly, derive family/child ownership first, and call the service only after authorization. Create returns `201` only after convergence. Patch remains parent-only and pending-task-only. Known service errors preserve sanitized status/code/message/details; unknown errors return fixed production `500` text.

- [ ] **Step 5: Integrate detail/list and status transitions**

Detail loads hidden state only after scoped authorization, resumes one pending task, then returns `taskView`. List does not select hidden state and makes no remote calls. Complete, confirm, and delete load hidden state, resume before changing status, and stop on pending/conflict.

- [ ] **Step 6: Make `taskView` media-safe**

Remove `attachments` from the family view and add only:

```js
attachmentMediaIds: (task.attachmentMediaIds || []).map((id) => id.toString())
```

Never spread a Mongoose object and never include hidden state, media metadata, operations, generations, URLs, or storage fields.

- [ ] **Step 7: Add sanitized audit events**

Use `logFamilyOperation` for create/patch attachment success, pending, stable rejection, and conflict with only operation/result/family/child/task/media IDs. Do not log `error.message`, task patch values, descriptions, operation UUIDs, generation UUIDs, credentials, or Axios objects.

- [ ] **Step 8: Run route and existing GrowthTask GREEN**

```bash
npx jest --config backend/services/homework-service/jest.config.js --runInBand \
  growthTaskMediaReferences growthTasks
```

Expected: all Phase 3C route cases and existing GrowthTask lifecycle tests pass.

- [ ] **Step 9: Commit HTTP integration**

```bash
git add backend/services/homework-service/routes/growthTasks.js \
  backend/services/homework-service/__tests__/growthTaskMediaReferences.test.js \
  backend/services/homework-service/__tests__/growthTasks.test.js
git commit -m "feat: expose growth task media attachments"
```

## Task 7: Verify and Record the Phase Gate

**Files:**
- Modify after successful execution: `docs/superpowers/plans/2026-06-22-family-growth-task6-phase3c-task-attachments.md`
- Create after evidence passes: `docs/development/family-growth-task6-phase3c-review.md`

- [ ] **Step 1: Run the fixed focused gate**

```bash
npx jest --config backend/services/homework-service/jest.config.js --runInBand \
  GrowthTask.mediaReferences \
  growthTaskAttachmentMediaService \
  growthTaskMediaReferences \
  growthTasks
```

Expected: all matching suites and tests pass once with no open-handle warning.

- [ ] **Step 2: Run the full family regression twice consecutively**

```bash
npm run test:family-regression
npm run test:family-regression
```

Expected: both runs exit 0 with identical suite/test totals. A failed run followed by a pass does not satisfy the gate; restart the two-run sequence after fixing the cause.

- [ ] **Step 3: Run static evidence checks**

```bash
git diff --check
rg -n "\.only\(|\.skip\(|test-only error|process\.exit" \
  backend/services/homework-service \
  docs/development/family-growth-task6-phase3c-test-cases.md
rg -n "TC-T6-MEDIA-(017[A-M]|018[C-D])" \
  backend/services/homework-service/__tests__
```

Expected: no whitespace errors, focused/skipped tests, route-local test error handler, new forced exit, or missing numbered case IDs. Review any existing `process.exit` match by scope; do not suppress it blindly.

- [ ] **Step 4: Audit every acceptance criterion against evidence**

Create a traceability table mapping design sections and all `017A-M`/`018C-D` cases to executable test names, implementation commits, and gate output. Confirm list/detail visibility, stable versus uncertain errors, batch generations, canonical updates, lifecycle exclusion, privacy, and regression evidence directly.

- [ ] **Step 5: Write the formal Phase 3C review record**

Create `docs/development/family-growth-task6-phase3c-review.md` with reviewed artifacts, criteria, findings/resolutions, traceability, exact focused totals, both full-regression totals, static audit result, decision, and sign-off. Do not mark it approved while any finding or gate is open.

- [ ] **Step 6: Mark this plan completed and commit evidence**

Change `Document status` to `COMPLETED`, mark checkboxes only for steps supported by current evidence, then commit:

```bash
git add docs/superpowers/plans/2026-06-22-family-growth-task6-phase3c-task-attachments.md \
  docs/development/family-growth-task6-phase3c-review.md
git commit -m "docs: complete growth task attachment phase"
```

## Execution Discipline

- Execute one numbered task at a time and keep each production slice within its listed files.
- Preserve unrelated worktree changes; never reset or rewrite user work.
- RED must fail for the intended absent behavior before production edits.
- GREEN must pass the listed narrow command before committing.
- Update this checklist as each task finishes; do not batch-mark it at the end.
- Stop for review if the implementation requires changing the approved public contract, owner state model, remote protocol, or test acceptance criteria.
- Do not claim Phase 3C complete until Task 7 proves every requirement with current evidence.

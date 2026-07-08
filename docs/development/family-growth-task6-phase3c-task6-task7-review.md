# Task 6 Phase 3C Task6/Task7 Pre-Implementation Review

**Document status:** APPROVED_FOR_IMPLEMENTATION
**Review date:** 2026-06-27
**Scope:** Remaining GrowthTask attachment HTTP contract and final Phase 3C gate
**Source plan:** `docs/superpowers/plans/2026-06-22-family-growth-task6-phase3c-task-attachments.md`
**Source design:** `docs/superpowers/specs/2026-06-22-family-growth-task6-phase3c-task-attachments-design.md`
**Source test catalog:** `docs/development/family-growth-task6-phase3c-test-cases.md`

## 1. Detailed Design Baseline

Task6 completes the public GrowthTask attachment contract on top of the service-layer state machine already implemented in Tasks 1-5.

The router remains the authorization and response boundary. It must authenticate the gateway identity, verify the parent owns the child or task before any media call, parse only allowlisted fields, and delegate attachment state transitions to `growthTaskAttachmentMediaService`. The service remains the only owner of attachment normalization, durable intent state, resource-service prepare/commit/unbind calls, and recovery.

The default router composition remains media-disabled. Requests without `attachmentMediaIds` must preserve existing behavior. Requests with `attachmentMediaIds` and no injected `attachmentMediaService` return `400 MEDIA_NOT_ENABLED`. Legacy `attachments` input is never accepted and returns `400 VALIDATION_ERROR`, not `MEDIA_NOT_ENABLED`.

## 2. Task6 Route Contract

### 2.1 Create

`POST /api/growth-tasks` keeps the explicit `repeatRule -> 400 REPEAT_RULE_NOT_SUPPORTED` check before strict parsing. For other bodies:

- reject unknown, legacy, internal, and unsafe fields through the strict create parser;
- authorize the parent-child relationship before invoking media service;
- build `taskInput` from canonical non-media fields plus `familyId` and `createdByParentId`;
- call `attachmentMediaService.create({ taskInput, attachmentMediaIds })` only when media is enabled;
- return `201` after service convergence;
- preserve service error status/code/message/details for validation, stable media rejection, pending recovery, and conflicts.

### 2.2 Patch

`PATCH /api/growth-tasks/:taskId` keeps the explicit `repeatRule` check and remains parent-only. It must:

- reject unsafe body fields instead of ignoring them;
- fetch the task with hidden media state only after task ID validation;
- authorize the parent-task relationship before any media service call;
- reject non-pending tasks before mutation;
- call `attachmentMediaService.mutate({ task, taskPatch, attachmentMediaIds })`;
- return the converged task view, with no hidden state or legacy attachment fields.

### 2.3 Read

List must not select hidden state and must not call resource-service or attachment recovery per row. It returns the public owner state only.

Detail may load hidden state only after scoped authorization. If the task is pending, it calls `attachmentMediaService.resume(taskId)` once and returns the converged task. If recovery remains pending, it returns `503 MEDIA_REFERENCE_PENDING` without hidden metadata.

### 2.4 Lifecycle Transitions

Complete, confirm, and delete already resume pending media before status mutation from Task5. Task6 must preserve that behavior while switching route reads to the media-safe public view.

### 2.5 Public View and Privacy

`taskView` removes legacy `attachments` and adds only:

```js
attachmentMediaIds: (task.attachmentMediaIds || []).map((id) => id.toString())
```

It must never spread Mongoose documents or expose:

- `attachmentMediaBindings`
- `mediaBindingOperationId`
- `attachmentMediaPendingIds`
- `attachmentMediaPreviousBindings`
- `mediaBindingPhase`
- `mediaPendingTaskPatch`
- `mediaMutationKind`
- `mediaRemoteOutcomeUncertain`
- operation UUIDs, generation UUIDs, storage keys, URLs, Axios data, credentials, or task patch values

### 2.6 Audit Logging

Attachment create/patch audit events may contain operation, result, family ID, child ID, task ID, and normalized public media IDs. They must not log raw error objects, request bodies, descriptions, patch values, operation IDs, generation IDs, URLs, storage details, or credentials.

## 3. Task6 Test Cases To Add

All new route tests live in `backend/services/homework-service/__tests__/growthTaskMediaReferences.test.js`; existing non-media regression coverage remains in `backend/services/homework-service/__tests__/growthTasks.test.js`.

| Case | Test name | Required evidence |
| --- | --- | --- |
| `TC-T6-MEDIA-017B` | `creates a task with normalized attachment media through the route` | `201`, normalized `attachmentMediaIds`, one service create call after authorization |
| `TC-T6-MEDIA-017C` | `rejects attachment writes before authorization and when media is disabled` | no media service call for cross-family/child actor; default composition returns `MEDIA_NOT_ENABLED` only for `attachmentMediaIds` |
| `TC-T6-MEDIA-017D` | `returns sanitized stable media rejection without leaking request values` | stable service error propagates only approved envelope; no task remains when service reports rollback |
| `TC-T6-MEDIA-017E` | `returns pending envelope and lets detail resume a pending create` | create returns `503` with task ID; detail calls resume once and returns converged public IDs |
| `TC-T6-MEDIA-017G` | `patch removes attachment media through the route` | empty `attachmentMediaIds` accepted and returned; service mutate receives empty array |
| `TC-T6-MEDIA-017H` | `patch normalizes reorder input through the route` | duplicate/reordered input returns normalized first-occurrence order |
| `TC-T6-MEDIA-017I` | `patch applies attachment and canonical task fields atomically` | response shows both normalized media and canonical non-media field updates |
| `TC-T6-MEDIA-017J` | `list does not resume media and detail resumes one pending task` | list returns public current IDs and makes no service call; detail calls resume and hides pending fields |
| `TC-T6-MEDIA-017M` | `preserves non-media growth task behavior and omits legacy attachments` | existing growth task suites pass; family task views do not include `attachments` |
| `TC-T6-MEDIA-018C` | `rejects legacy, unknown, nested, dotted, and internal media fields` | create and patch reject unsafe bodies; no unsafe owner field persists |
| `TC-T6-MEDIA-018D` | `redacts privacy-sensitive values from responses and audit logs` | sentinel request text, raw URLs, operation IDs, generations, and credentials absent from responses/logs |

## 4. Task7 Verification Design

Task7 is evidence-only unless the gate finds a defect. It must run after Task6 implementation is committed.

Required gate commands:

```bash
npx jest --config backend/services/homework-service/jest.config.js --runInBand \
  GrowthTask.mediaReferences \
  growthTaskAttachmentMediaService \
  growthTaskMediaReferences \
  growthTasks

npm run test:family-regression
npm run test:family-regression

git diff --check
rg -n "\.only\(|\.skip\(|test-only error|process\.exit" \
  backend/services/homework-service \
  docs/development/family-growth-task6-phase3c-test-cases.md
rg -n "TC-T6-MEDIA-(017[A-M]|018[C-D])" \
  backend/services/homework-service/__tests__
```

The two family regression runs must be consecutive successful runs on the same candidate commit with identical suite and test totals. A fail-then-pass sequence does not satisfy Task7.

The final review record `docs/development/family-growth-task6-phase3c-review.md` must include:

- reviewed artifacts;
- exact focused gate totals;
- both full-regression totals;
- static audit output summary;
- traceability from `017A-M` and `018C-D` to executable tests and commits;
- open findings and resolutions;
- final decision.

## 5. Review Findings

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| `FGT-P3C-T6-001` | MINOR | Task5 introduced `attachmentMediaService` injection but not the media-enabled create/patch contract. | Covered by Task6 create/patch tests and implementation. |
| `FGT-P3C-T6-002` | MINOR | Existing task view still returns legacy `attachments`. | Covered by `017M` and Task6 public view change. |
| `FGT-P3C-T7-001` | MINOR | Phase completion has no current evidence table yet. | Covered by Task7 formal review record after gates pass. |

No BLOCKER or MAJOR finding remains open. Task6 may proceed to TDD implementation after the RED route tests are written and observed failing for the intended missing contract.

## 6. Entry Criteria For Coding

- This review document is committed.
- Task6 RED route tests are written before production route edits.
- RED failure is caused by absent route contract behavior, not test setup errors.
- Implementation preserves existing non-media GrowthTask tests.
- Task7 does not begin until Task6 route integration is green and committed.

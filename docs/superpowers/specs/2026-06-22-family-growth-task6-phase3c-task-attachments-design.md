# Task 6 Phase 3C GrowthTask Attachment Consumer Detailed Design

**Document status:** WRITTEN REVIEW PENDING
**Parent design:** `docs/superpowers/specs/2026-06-20-family-growth-task6-design.md`
**Reference addendum:** `docs/superpowers/specs/2026-06-21-family-growth-task6-phase3a-reference-release-design.md`
**Related consumer design:** `docs/superpowers/specs/2026-06-21-family-growth-task6-phase3b-child-avatar-design.md`
**Scope:** `GrowthTask.attachmentMediaIds[]` ownership, recovery, authorization, and public representation
**Requirements:** `FR-MEDIA-001`, `NFR-DATA-001`, `NFR-PRIVACY-001`, `NFR-SEC-001`

## 1. Objective and Boundaries

Phase 3C enables private task attachments on `POST /api/growth-tasks` and `PATCH /api/growth-tasks/:taskId`. Homework-service owns the GrowthTask and all mutation-recovery metadata. Resource-service remains the authority for media status, purpose, family/child scope, and binding generations.

This phase supports parent-created and parent-edited task plans only. It does not add attachment upload, task-completion evidence, child attachment mutation, media metadata expansion, arbitrary URLs, attachment editing on non-pending tasks, bulk task mutation, or physical media cleanup. Existing upload and access operations remain in resource-service.

The legacy `attachments[{name,url,type}]` field is not part of the family contract. Family routes reject it and return only validated `attachmentMediaIds`.

## 2. Chosen Recovery Architecture

The approved approach is a durable owner-local mutation intent on the GrowthTask. The intent is persisted before the first remote prepare and is claimed with compare-and-set predicates. A random UUID identifies the complete attachment mutation. No separate mutation collection and no public idempotency header are added.

For create, homework-service preallocates the task ObjectId and persists the validated non-media task fields with an empty public attachment list plus a pending attachment intent. This removes the unowned-prepare window. Until binding converges, list and detail responses may expose the created task with an empty attachment list, but never expose an unbound requested media ID. A stable initial prepare rejection deletes that newly created task; an uncertain remote or database result retains the task and returns its ID for recovery.

For patch, the prior public attachment list remains visible while additions bind. After all additions commit, one owner compare-and-set transition publishes the desired list and applies the stored non-media patch. Only then are removed references unbound.

Rejected alternatives:

- Prepare-first create avoids temporary task visibility but recreates the unowned-prepare and compensation window and uses a different protocol from patch.
- A separate mutation-intent collection can hide incomplete tasks but adds cross-document lifecycle, transaction, retention, and cleanup work not required by one owner model.
- Treating attachment arrays as publicly unordered makes response behavior ambiguous. Phase 3C preserves the first occurrence of each requested ID and uses sets only for binding differences.

## 3. Public Normalization Rules

`attachmentMediaIds` is optional on create and patch. When present it must be an array with at most 100 entries before and after normalization; every entry must be a 24-hex ObjectId string. Empty arrays remove all attachments. `null`, scalar values, media objects, URLs, dotted keys, and nested wrappers are invalid.

Normalization preserves the first occurrence of each media ID and removes later duplicates. Public responses preserve that normalized order. Set difference determines additions and removals:

```text
additions = desired IDs not present in current public IDs
removals  = current public IDs not present in desired IDs
unchanged = desired IDs present in current public IDs
```

Unchanged references retain their existing binding generation even if their public order changes. A reorder-only patch performs no remote media call but still publishes the normalized order atomically with other supplied task fields.

## 4. GrowthTask Data Model

The family GrowthTask gains the following server-controlled fields:

| Field | Type | Rule |
| --- | --- | --- |
| `attachmentMediaIds` | ObjectId array | Public, currently bound attachments in normalized request order |
| `attachmentMediaBindings` | array of `{mediaId, bindingOperationId}` | Hidden current generation for each public attachment |
| `mediaReferenceState` | `none|pending|bound` | `none` for an empty stable set; `bound` for a non-empty stable set |
| `mediaBindingOperationId` | UUID string or null | Current mutation operation while pending |
| `attachmentMediaPendingIds` | ObjectId array | Desired normalized public list while pending |
| `attachmentMediaPreviousBindings` | array of `{mediaId, bindingOperationId}` | Complete prior visible set and generations for recovery |
| `mediaBindingPhase` | `binding|unbinding` or null | Recovery cursor |
| `mediaPendingTaskPatch` | array of `{path,value}` or null | Canonical allowlisted non-media patch stored for all-or-nothing publication |
| `mediaMutationKind` | `create|patch` or null | Controls stable-rejection rollback behavior |
| `mediaRemoteOutcomeUncertain` | Boolean | True before the first remote attempt; only that in-process first attempt may roll back on its direct stable response |

All operation, generation, previous, pending, phase, patch, mutation-kind, and uncertainty fields are hidden by default selection where Mongoose permits and are always omitted by `taskView`. Public bodies cannot set any of them.

Model invariants:

1. Public attachment IDs are unique and have one matching current binding entry each, in the same order.
2. `none` has no public attachments, no current bindings, and no pending metadata.
3. `bound` has at least one public attachment, a complete current binding map, and no pending metadata.
4. `pending` requires a mutation operation, mutation kind, phase, desired list, complete previous binding snapshot, and the uncertainty flag.
5. `binding` leaves the previous public IDs and generation map unchanged.
6. `unbinding` exposes the desired IDs and generation map; previous bindings remain hidden until every removal is released.
7. Every binding operation ID is a UUID and every media ID is a valid ObjectId.
8. Legacy tasks without the new fields read as `none` when they have no `attachmentMediaIds`; legacy `attachments` URLs never become media IDs.

`mediaPendingTaskPatch` contains only canonical paths produced by a fixed server map. The map covers the existing editable plan fields: `dimension`, `area`, `subject`, `title`, `taskType`, `description`, `dueDate`, `estimatedMinutes`, `targetAmount`, `unit`, and `priority`. Request-provided keys never become Mongo paths.

## 5. Component Boundaries

### 5.1 GrowthTask attachment service

`growthTaskAttachmentMediaService` owns normalization and the state machine:

```js
create({ taskInput, attachmentMediaIds })
mutate({ task, taskPatch, attachmentMediaIds })
resume(task)
publicAttachmentMediaIds(task)
```

Dependencies are injected: GrowthTask model, shared media-reference client, UUID generator, and logger. The service does not authenticate users, read environment variables, or send HTTP responses.

### 5.2 Router

The router authenticates the gateway identity, verifies the parent owns the child/task, rejects unknown and protected body fields, builds canonical task input or patch data, and calls the attachment service. Detail GET resumes one pending task before returning it. List does not perform remote recovery per row and uses the safe public list represented by the owner state.

`createGrowthTaskRouter` receives the attachment service in addition to the existing star-award dependency. Its default export remains compatible. Importing the router does not connect to MongoDB or call resource-service.

When family media is not configured, a request containing `attachmentMediaIds` returns `400 MEDIA_NOT_ENABLED`; requests without that field retain existing behavior.

### 5.3 Shared media-reference command

Every remote call uses:

```js
{
  familyId,
  childId,
  resourceType: 'growth_task',
  resourceId: taskId,
  operationId: storedMutationOperationId,
  references: [{ mediaId, field: 'attachmentMediaIds' }]
}
```

Prepare and commit contain additions only. Unbind contains removals only and adds each removal's stored `bindingOperationId`. Empty commands are not sent.

## 6. Create State Machine

### 6.1 Create without attachments

An omitted or empty `attachmentMediaIds` value follows the ordinary create path and persists stable `mediaReferenceState=none`. Empty input is not considered a pending media operation.

### 6.2 Create with attachments

1. Validate the complete request, authorize the child, normalize IDs, preallocate the task ObjectId, and create a canonical task input.
2. Persist the task with all non-media fields, empty public attachments/bindings, `state=pending`, `phase=binding`, `mutationKind=create`, `mediaRemoteOutcomeUncertain=false`, the desired IDs, a random operation ID, and an empty previous snapshot.
3. CAS-set `mediaRemoteOutcomeUncertain=true`, then prepare all desired references with the stored task and operation IDs. Resource-service validates active status, `purpose=task_attachment`, family, and exact child. The service does not call resource-service unless this transition is confirmed.
4. Commit the same prepared references. Prepare and commit are replayed during every binding resume.
5. Compare-and-set the owner from the exact pending operation to the desired public IDs, one generation entry per desired ID, and stable `bound`; clear all pending metadata.
6. Return `201` with the bound normalized attachments.

A task pending in `binding` is safe to list: its public attachment array remains empty.

### 6.3 Stable rejection and uncertain create

If the in-process first prepare returns a direct stable `400/403/404/409`, that same execution may conditionally delete the task using task ID, pending state, operation ID, mutation kind, and unchanged version. It returns the sanitized stable resource-service error only after deletion is confirmed. A resumed execution cannot make this rollback decision because the persisted uncertainty flag means a previous call may have reached resource-service. If deletion is uncertain or the row no longer matches, it returns `503 MEDIA_REFERENCE_PENDING` instead.

Timeouts, connection failures, 5xx responses, malformed success envelopes, commit failures, and owner-transition uncertainty retain the pending task and return `503 MEDIA_REFERENCE_PENDING` with `details.resourceId=taskId`. Later recovery never deletes the owner based on a stable response; it remains pending for replay or operational reconciliation.

Setting the uncertainty marker before the call closes the crash window between sending prepare and recording that it may have succeeded. A crash after the marker but before the call is conservatively indistinguishable from a lost response and may require operational reconciliation if future prepare attempts return only stable errors. This deliberately favors retaining a recoverable owner over deleting a task whose generation may exist.

## 7. Patch State Machine

Only parent-owned tasks with `status=pending` may enter this state machine.

### 7.1 Resume and no-op

Patch first resumes an existing pending media mutation. If the caller supplies no `attachmentMediaIds`, it then applies only the ordinary canonical patch. If the desired normalized IDs and order equal the public list, it applies the ordinary patch with no media call.

A set-equal reorder is not a media no-op: it atomically changes public order and applies the ordinary patch, but sends no prepare, commit, or unbind command.

### 7.2 Add, replace, or remove

1. Compute additions, removals, and unchanged references from the current stable public list.
2. CAS-claim a random operation ID, complete desired IDs, complete previous bindings, canonical ordinary patch, `mutationKind=patch`, `mediaRemoteOutcomeUncertain=false`, and `phase=binding`. Public fields remain unchanged.
3. If additions exist, CAS-set the uncertainty flag and then prepare and commit additions under the stored operation ID. Replays use the same command. If no remote command is needed, the flag remains false.
4. Build the desired generation map from unchanged prior entries plus one new operation generation for each addition.
5. CAS-publish desired public IDs and generation map and apply the stored ordinary patch. If removals exist, move to `phase=unbinding`; otherwise finalize to `bound` or `none` and clear pending metadata.
6. Unbind all removals in one command using their previous expected generations.
7. CAS-finalize to `bound` or `none` and clear pending metadata.

All additions commit before publication. All removals unbind after publication. Therefore no response exposes an unbound desired attachment, and a stale unbind cannot release a later generation.

### 7.3 Stable and retryable patch failures

A direct stable prepare rejection on the in-process first attempt clears the untouched patch intent by CAS and leaves the prior public attachments and non-media task fields unchanged. It then returns the sanitized stable error. A resumed execution with the uncertainty flag set cannot clear the intent from a later stable response.

Timeouts, network errors, 5xx or malformed responses, commit/unbind errors, and owner database uncertainty retain the intent and return `503 MEDIA_REFERENCE_PENDING`. During binding, reads show the prior list and prior task fields. During unbinding, reads show the desired list and newly published task fields.

If owner publication succeeds but its response is lost, resume reloads the task, recognizes `phase=unbinding` or stable completion, and does not bind additions twice. A lost finalization response is likewise recognized by the stable owner state.

## 8. Concurrency and Other Task Transitions

Every owner mutation uses conditional `findOneAndUpdate` or `deleteOne` predicates containing task ID, family ID, child ID, observed `__v`, expected media state, operation ID, phase, and task status where applicable. Successful owner transitions increment `__v`; no transition replaces the complete document.

Concurrency rules:

- Identical concurrent attachment requests converge on one claimed operation and one generation per addition.
- A different attachment request that encounters a pending intent resumes it, then returns `409 RESOURCE_CONFLICT`; it does not overwrite the completed winner. The caller may retry against the new version.
- A non-attachment task patch resumes pending media first, then applies its own canonical fields against the refreshed version.
- Complete, confirm, delete/cancel, or archive operations resume a pending attachment mutation before changing task status. If recovery remains pending, they return `503 MEDIA_REFERENCE_PENDING` and do not change status.
- A task cannot be cancelled or archived while exposing a pending desired attachment set. This phase does not automatically unbind attachments when task status later changes; task retention and media retention follow the existing owner lifecycle until a separate deletion design is approved.

## 9. Authorization and Public Contract

Only a parent in the task child's family may create or edit task attachments. Children may read their own task attachments but cannot mutate them. Resource-service independently requires active media with `purpose=task_attachment`, the same family, and the exact child. Sibling, cross-family, family-scoped, deleted, wrong-purpose, missing, and malformed media are rejected.

Success responses include `attachmentMediaIds` in normalized order. They never include legacy attachment URLs, filenames, media metadata, operation UUIDs, generations, phases, desired or previous arrays, service credentials, storage keys, or signed URLs.

Pending errors use the approved envelope:

```json
{
  "success": false,
  "error": {
    "code": "MEDIA_REFERENCE_PENDING",
    "message": "Media reference operation is pending",
    "details": { "resourceId": "6656875da7f86a0012c2a501" }
  }
}
```

## 10. Observability and Privacy

Audit events may contain operation name, result, family ID, child ID, task ID, and approved media IDs. They must not contain credentials, Axios config, attachment order snapshots, task descriptions, stored patch values, operation UUIDs, generation UUIDs, storage information, URLs, image bytes, or hidden state.

Stable errors preserve only approved status, code, message, and sanitized details. Unexpected database errors use the shared production `500` envelope without raw Mongo state. Pending errors disclose only the task resource ID.

## 11. Migration and Rollback

No bulk migration is required. Existing tasks default to stable `none` unless valid new attachment IDs and matching generations were created by this feature. The legacy `attachments` array remains stored for unrelated compatibility but is not accepted or returned by family GrowthTask routes.

Rollback disables new attachment mutation routing and leaves bound IDs and hidden pending intents intact. It must not unbind or delete media automatically. Forward recovery is required before hidden intent fields can be removed. Reverting generation-checked unbind is prohibited after this consumer is enabled.

## 12. Acceptance Criteria

Phase 3C design is acceptable only when tests can prove:

- valid create, add, replace, remove, clear, duplicate normalization, reorder, and stable no-op behavior;
- first-occurrence order preservation and unchanged-generation retention;
- wrong-purpose, missing, deleted, sibling, family-scoped, malformed, and cross-family rejection;
- create rollback after a stable initial rejection without an orphan task;
- durable create and patch recovery from lost prepare, commit, publication, unbind, deletion, and finalization responses;
- replacement ordering and stale-generation protection for multi-reference batches;
- all-or-nothing publication of attachment and ordinary task fields;
- safe list/detail representation during both recovery phases;
- deterministic concurrent requests and exclusion of task status transitions while pending;
- raw URL, legacy attachment, unknown field, and internal-field rejection;
- no credential, task text, generation, storage data, or hidden state leakage;
- no regression in task lifecycle, star award, authorization, filtering, pagination, and family regression gates.

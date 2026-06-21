# Task 6 Phase 3B Child Avatar Consumer Detailed Design

**Document status:** REVIEW_PENDING
**Parent design:** `docs/superpowers/specs/2026-06-20-family-growth-task6-design.md`
**Reference addendum:** `docs/superpowers/specs/2026-06-21-family-growth-task6-phase3a-reference-release-design.md`
**Scope:** `Child.avatarMediaId` ownership, recovery, authorization, and public representation
**Requirements:** `FR-MEDIA-001`, `NFR-DATA-001`, `NFR-PRIVACY-001`, `NFR-SEC-001`

## 1. Objective and Boundaries

Phase 3B makes `PATCH /api/children/:childId` the only public operation that sets, replaces, or removes a child's avatar media reference. The user service owns the Child profile and all mutation-recovery metadata. Resource-service remains the sole authority for media status, family/child scope, purpose, and reference generations.

This phase does not add avatar upload, image editing, family-scoped avatar binding, public URLs, create-child avatar input, bulk avatar updates, or GrowthTask attachments. Upload/access already belong to resource-service; GrowthTask media is Phase 3C.

## 2. Chosen Recovery Architecture

The approved approach is a durable owner-local mutation intent stored on the Child document before the first remote prepare. It uses a random UUID persisted by a compare-and-set claim. It does not add a mutation collection and does not change the public API.

Three rejected approaches remain out of scope:

- A deterministic operation ID cannot satisfy both compensation and retry. If persistence fails, compensation releases that generation; retrying the same deterministic ID cannot reactivate it.
- A separate MutationIntent collection provides stronger workflow audit but adds a second owner model, cleanup, and cross-document transaction work not required for one avatar field.
- A public `Idempotency-Key` changes the approved API and shifts durable retry responsibility to every client.

The local intent makes a lost prepare/commit response recoverable because every retry reads the same stored operation ID. Public avatar data remains a currently bound value throughout recovery.

This is an intentional refinement of the parent design's generic "prepare, then persist owner" sequence. For this single-field owner, persisting the intent first removes the unowned-prepare window and therefore removes the need to compensate a failed initial owner save. Resource-service remains authoritative: the intent does not make the media public, and prepare still performs every media, purpose, family, and child validation before commit.

## 3. Child Data Model

The following fields are server-controlled paths under `childProfile`:

| Field | Type | Rule |
| --- | --- | --- |
| `avatarMediaId` | ObjectId or null | Publicly usable, currently bound avatar only |
| `avatarMediaBindingOperationId` | UUID string or null | Bind generation for `avatarMediaId` |
| `mediaReferenceState` | `none|pending|bound` | Defaults to `none` for legacy children without media |
| `mediaBindingOperationId` | UUID string or null | Current mutation/release operation while pending |
| `avatarMediaPendingId` | ObjectId or null | Desired avatar in the pending mutation; null means removal |
| `avatarMediaPreviousId` | ObjectId or null | Prior bound avatar retained for checked unbind |
| `avatarMediaPreviousBindingOperationId` | UUID string or null | Expected generation of the prior avatar |
| `mediaBindingPhase` | `binding|unbinding` or null | Recovery cursor |
| `mediaPendingProfilePatch` | array of `{ path, value }` or null | Sanitized allowlisted non-media fields from the same PATCH |

Internal operation, generation, phase, previous, pending, and patch paths use `select: false` where Mongoose permits it and are always omitted by `childView`. Public request validation rejects every internal field even when nested.

Model invariants:

1. `none` requires no public avatar generation and no pending metadata.
2. `bound` requires both `avatarMediaId` and `avatarMediaBindingOperationId`, with no pending metadata.
3. `pending` requires `mediaBindingOperationId`, `mediaBindingPhase`, and a present pending target whose value may be null.
4. Previous ID and previous generation are either both null or both populated.
5. `binding` leaves the prior public avatar/generation unchanged until the new generation is committed.
6. `unbinding` exposes only the already-bound desired avatar, or null for removal, while retaining the previous pair internally.
7. Legacy `childProfile.avatar` strings are neither migrated into nor returned as `avatarMediaId`. Family child responses stop exposing that raw URL field.

`mediaPendingProfilePatch` stores only canonical Mongo paths produced by server validation. Allowed paths are fixed to the existing editable child-profile contract; request-provided keys never become Mongo paths. This preserves all-or-nothing recovery when one PATCH combines an avatar and ordinary profile fields.

The canonical patch builder has an explicit map rather than accepting dotted request keys. It covers `name`, `grade`, `school`, `textbookVersion`, `interests`, `weakSubjects`, `sportsPreferences`, `artInterests`, `laborHabits`, and `moralGoals`, including the existing `name -> childProfile.nickname` and `grade -> childProfile.grade` mirrors. Phase 3B does not rename the existing profile contract.

## 4. Component Boundaries

### 4.1 Child avatar binding service

`childAvatarMediaService` owns the state machine and exposes:

```js
mutate({ child, familyId, requestedAvatarMediaId, profilePatch })
resume(child)
publicAvatarMediaId(child)
```

Dependencies are injected: User model, shared media-reference client, UUID generator, and logger. The service never reads environment variables and never sends HTTP responses.

### 4.2 Controller and router

The family controller validates ownership and body fields, creates the canonical profile patch, invokes resume before a detail read or mutation, maps domain errors to the approved envelope, and calls `childView` only after the service returns a safe state.

`createChildrenRouter` and `createFamilyController` accept the binding service for tests and production composition while retaining current default exports. Importing routes must not connect to MongoDB or call resource-service.

### 4.3 Shared client and deployment wiring

The service consumes the Phase 3A `mediaReferenceClient`; it does not duplicate Axios or credential handling. Environment-bound construction and startup validation are completed with the Task 6 deployment wiring. Until that wiring enables family media, an avatar write without an injected/configured binding service returns `400 MEDIA_NOT_ENABLED`; existing non-avatar profile operations remain available.

Every remote call uses the following command identity; only `references` differs for unbind:

```js
{
  familyId,
  childId,
  resourceType: 'child',
  resourceId: childId,
  operationId: storedMutationOperationId,
  references: [{ mediaId, field: 'avatarMediaId' }]
}
```

Unbind adds `bindingOperationId: avatarMediaPreviousBindingOperationId` to its one reference. Prepare and commit must not send `bindingOperationId`.

## 5. Mutation State Machine

All owner transitions use conditional `findOneAndUpdate` operations with `runValidators: true`. The first claim filters by child ID, family ID, role, observed `__v`, and non-pending state, then increments `__v`. Later transitions filter by child ID, `mediaReferenceState=pending`, exact mutation operation ID, and expected phase. No transition replaces an entire `childProfile` object.

### 5.1 Stable no-op

After resuming any existing mutation, a requested avatar equal to the current public avatar performs no media call. Ordinary profile fields still update through their existing validation path.

### 5.2 Initial set or replacement

1. Validate and canonicalize the full PATCH body without changing public fields.
2. CAS-claim a random operation ID, pending target, previous avatar/generation, `phase=binding`, and sanitized profile patch. The previous public avatar remains visible and bound.
3. Call prepare for `resourceType=child`, `resourceId=childId`, field `avatarMediaId`, same family/child, and the stored operation ID.
4. Replay commit for that same generation. Prepare and commit are both called during every `binding` resume, so a lost response is harmless.
5. CAS-switch the public avatar and current generation to the committed target, apply the stored ordinary profile patch atomically, and move to `phase=unbinding` when a previous avatar exists.
6. If no previous avatar exists, finalize directly to `bound` and clear all pending metadata.
7. During `unbinding`, call unbind with the mutation operation ID and the previous per-reference `bindingOperationId`.
8. Finalize to `bound` and clear pending/previous/patch metadata.

The new avatar is committed before the old avatar is unbound. A delayed unbind cannot affect a newer generation because resource-service checks the expected previous generation.

### 5.3 Removal

1. CAS-claim the mutation and store the previous pair.
2. In the same claim, set public `avatarMediaId` and its current generation to null, apply the sanitized ordinary profile patch, and set `phase=unbinding`.
3. Unbind the previous reference using its exact generation.
4. Finalize to `none` and clear pending metadata.

The public view becomes null before the old generation is released, so no response can expose an unbound avatar.

### 5.4 Failure before or after a remote call

- Stable prepare errors (`400/403/404/409`) clear the untouched binding intent by CAS, leave the prior public avatar/profile unchanged, and return the sanitized remote error.
- A timeout, network error, 5xx, malformed response, any commit or unbind error, or owner transition uncertainty retains the intent and returns `503 MEDIA_REFERENCE_PENDING` with `details.resourceId=childId`. Once prepare may have succeeded, a later stable remote error is not exposed as a terminal client error because clearing owner state could orphan or misrepresent a generation.
- Because the claim is durable before prepare, no prepared generation exists without a recovery owner. Explicit compensation is unnecessary for an unpersisted owner mutation; the owner intent itself is the persisted mutation.
- Unexpected owner database errors return the standard production `500` envelope without raw Mongo, Axios, patch, or credential data.

## 6. Retry and Concurrency

`GET /api/children/:childId` and `PATCH /api/children/:childId` call `resume` when state is pending. The list operation does not make N remote calls: during `binding` it returns the still-bound previous public avatar; during `unbinding` it returns the already-bound desired avatar or null.

Concurrent behavior is explicit:

- Two identical avatar PATCH requests may race for the claim. One wins; the other reloads, resumes the same intent, and returns the converged result.
- A different avatar request that encounters another pending avatar intent first resumes it, then returns `409 RESOURCE_CONFLICT`; it does not silently overwrite the completed winner. The caller may retry against the new version.
- A non-avatar PATCH may resume the pending media mutation and then apply its own fields.
- Every remote command and owner transition is replay-safe. A response lost after the final CAS is recognized by reloading the already converged Child.

## 7. Authorization and Public Contract

Only a parent belonging to the Child's family may mutate `avatarMediaId`. Children may read their own profile but cannot write avatars. Resource-service independently enforces active status, `purpose=avatar`, exact family, and exact child. A family-scoped avatar with null child ID, sibling media, another-family media, deleted media, wrong-purpose media, malformed IDs, and raw URL/object input are rejected.

The request accepts `avatarMediaId` as a 24-hex ObjectId string or null. It rejects `avatar`, URL fields, media metadata objects, and every server-controlled binding field. Success returns `avatarMediaId` only after it identifies a bound reference; no storage key, upload filename, capability URL, generation ID, phase, pending patch, or previous ID is returned.

Errors use:

```json
{
  "success": false,
  "error": {
    "code": "MEDIA_REFERENCE_PENDING",
    "message": "Media reference operation is pending",
    "details": { "resourceId": "6656875da7f86a0012c2a301" }
  }
}
```

## 8. Observability and Privacy

Audit events contain operation name, result, family ID, child ID, and approved media IDs. They never contain service credentials, Axios config, profile patch values, legacy avatar URLs, image bytes, storage keys, signed URLs, previous-generation UUIDs, or pending internal state. Pending and conflict logs identify the resource and phase result without private profile values.

## 9. Migration and Rollback

No bulk data migration is required. Missing state on legacy children reads as `none`; legacy raw avatar strings remain stored for compatibility with unrelated legacy APIs but are omitted from family child responses. The new paths are additive.

Rollback disables avatar mutation routing and leaves current bound IDs plus hidden pending intents intact. It does not unbind or delete media. Forward recovery must be run before removing hidden intent fields. Phase 3B does not physically clean media.

## 10. Acceptance Criteria

Phase 3B design is acceptable only when tests can prove:

- valid set, replacement, removal, and stable no-op behavior;
- wrong-purpose, missing, deleted, sibling, family-scoped, and cross-family rejection;
- durable recovery from lost prepare/commit/unbind/finalization responses;
- replacement ordering and stale-generation protection;
- all-or-nothing combined profile patch recovery;
- safe public representation in both pending phases;
- deterministic concurrent outcomes with CAS;
- raw URL and internal-field rejection;
- absence of credentials, profile values, generations, and private media data from responses/logs;
- no regression in existing family, child PIN, and pagination behavior.

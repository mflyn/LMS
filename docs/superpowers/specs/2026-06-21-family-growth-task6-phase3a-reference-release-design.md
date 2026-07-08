# Task 6 Phase 3A Media Reference Release Design Addendum

**Document status:** APPROVED
**Parent design:** `docs/superpowers/specs/2026-06-20-family-growth-task6-design.md`
**Scope:** Media-reference release generation and shared internal client only
**Requirements:** `FR-MEDIA-001`, `NFR-DATA-001`, `NFR-SEC-001`

## 1. Problem

The approved replacement sequence binds new media before unbinding old media. Phase 2C stores only the prepare/bind `operationId` and currently requires unbind to use that same value. A replacement mutation has a new operation ID and therefore cannot release the previous binding. Simply accepting any release operation is also unsafe: a delayed old unbind could release the same identity after a later rebind.

## 2. Generation Model

`MediaReference.operationId` is the current bind generation. Unbind keeps that value unchanged and writes the release mutation to a nullable `releaseOperationId`.

Each unbind reference carries its expected generation:

```json
{
  "familyId": "6656875da7f86a0012c2a101",
  "childId": "6656875da7f86a0012c2a301",
  "resourceType": "growth_task",
  "resourceId": "6656875da7f86a0012c2a501",
  "operationId": "5dc38fc9-ee29-4dba-9181-df49f66b9050",
  "references": [
    {
      "mediaId": "6656875da7f86a0012c2a601",
      "field": "attachmentMediaIds",
      "bindingOperationId": "8a9dc72a-558b-4818-b388-677862431377"
    }
  ]
}
```

Prepare and commit reject `bindingOperationId`; resource-service remains the schema authority. Unbind validates every expected generation before its first write and atomically releases the batch only when every live row matches.

## 3. State Rules

1. Prepare creates a generation or replays the same generation.
2. Commit binds only the matching prepared generation. A different operation against a bound row conflicts.
3. Unbind requires each live row's `operationId` to equal its reference's `bindingOperationId`.
4. First release sets `state=released`, `releasedAt`, and `releaseOperationId=command.operationId` without changing the bind generation.
5. Release replay for the same released generation preserves all timestamps and IDs, including when a second release mutation arrives.
6. Prepare replay with the released bind generation cannot resurrect the row.
7. A new prepare generation may reactivate the identity and clears release metadata.
8. A delayed unbind for an older generation returns `409 RESOURCE_CONFLICT` after rebind and cannot alter the newer generation.
9. Existing family, child, active-status, and field-purpose checks remain unchanged.

## 4. Owner Contract

Child and GrowthTask owners persist hidden per-media generation mappings. Public request bodies cannot set operation IDs, generation maps, pending state, or previous media state.

For replacement:

1. Normalize current and desired media-ID sets.
2. Prepare additions only with the new mutation operation.
3. Persist desired IDs, the desired generation map, the previous visible IDs/map, and pending state.
4. Commit additions.
5. Unbind removals with their stored expected generations.
6. Mark the owner bound and clear previous recovery state.

Unchanged references retain their existing generation. Pending reads return the previous visible set until convergence. Phases 3B and 3C detail owner persistence and recovery separately.

## 5. Shared Client

`backend/common/services/mediaReferenceClient.js` exposes injected `prepare`, `commit`, and `unbind` calls. It validates URL, service token length, timeout, and response shape; sends the command unchanged to fixed internal paths; and never logs or exposes the token or Axios request config.

Resource-service `400/403/404/409` envelopes remain actionable errors with sanitized `status`, `code`, `message`, and `details`. Network errors, timeouts, 5xx responses, and malformed success envelopes become `503 MEDIA_REFERENCE_PENDING`.

## 6. Compatibility and Rollback

The new model field is optional for already released rows. No public API or gateway route changes in Phase 3A. Rollback may stop new consumers and revert the client; persisted `releaseOperationId` is additive and harmless to older readers. Reverting generation checks after consumers start using replacement is prohibited because it reintroduces stale-unbind corruption.

## 7. Acceptance

This addendum passes review only if:

- replacement can release an older binding generation;
- stale release cannot affect a newer rebind;
- old prepare replay cannot resurrect released media;
- mixed-generation unbind is atomic;
- stable remote validation errors remain distinguishable from retryable failures;
- service credentials and request configs remain absent from public errors and logs.

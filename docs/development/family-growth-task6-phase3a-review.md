# Task 6 Phase 3A Design and Test Review

**Review ID:** FGT-T6-P3A-DR-2026-06-21
**Status:** APPROVED
**Candidate commit:** `efe8f747`
**Scope:** Reference release generation, shared internal client, numbered test addendum, and TDD implementation plan

## Reviewed Artifacts

- `docs/superpowers/specs/2026-06-21-family-growth-task6-phase3a-reference-release-design.md`
- `docs/development/family-growth-task6-phase3a-test-cases.md`
- `docs/superpowers/plans/2026-06-21-family-growth-task6-phase3a-reference-client.md`
- Parent design section 5 in `docs/superpowers/specs/2026-06-20-family-growth-task6-design.md`
- Approved parent cases `TC-T6-MEDIA-012`, `016`, and `017`

## Review Criteria

- Replacement can bind additions before releasing removals.
- A release command identifies both its own mutation and the exact bind generation it may release.
- Delayed prepare, commit, or unbind commands cannot overwrite a newer generation.
- Mixed-generation attachment removals remain atomic.
- Public clients cannot write internal operation or recovery metadata.
- Shared-client failures preserve actionable validation errors and classify only retryable failures as pending.
- Credentials and Axios request configuration cannot enter public errors or logs.
- Every implementation step has a RED command, concrete behavior, GREEN command, and bounded commit.

## Findings

| ID | Severity | Finding | Resolution | Status |
| --- | --- | --- | --- | --- |
| `FGT-T6-P3A-DES-001` | BLOCKER | Phase 2C unbind requires the release mutation to equal the older bind `operationId`, so approved avatar/attachment replacement cannot release the prior reference. | Keep bind `operationId` unchanged, add `releaseOperationId`, and require per-reference `bindingOperationId` on unbind. | CLOSED |
| `FGT-T6-P3A-DES-002` | BLOCKER | Accepting any unbind operation would let a delayed old command release the same identity after a newer rebind. | Validate the expected binding generation for every existing row before any batch write; mismatched generations return `409 RESOURCE_CONFLICT`. | CLOSED |
| `FGT-T6-P3A-DES-003` | MAJOR | Advancing all retained references to one replacement generation allows a delayed old commit to roll a generation backward unless another pending-generation state is introduced. | Do not advance unchanged references. Owners retain a hidden per-media generation map and prepare/commit additions only. | CLOSED |
| `FGT-T6-P3A-DES-004` | MAJOR | A mixed-generation unbind could partially write before discovering a later mismatch. | Normalize and load the complete batch, validate every generation, then perform writes inside the existing Mongo transaction. | CLOSED |
| `FGT-T6-P3A-TEST-001` | MAJOR | Approved parent cases do not explicitly prove stale unbind after rebind or mixed-generation rollback. | Add suffix cases `012A-C` with stale-generation conflict, resurrection prevention, and forced transactional rollback. | CLOSED |
| `FGT-T6-P3A-TEST-002` | MINOR | The first plan draft modified family-common Jest configuration even though its existing glob already includes the new client test. | Remove the unnecessary configuration edit and keep the diff scoped to client/test files. | CLOSED |

## Traceability

| Contract | Test evidence | Plan task |
| --- | --- | --- |
| Independent bind and release identities | `TC-T6-MEDIA-012A` | Task 1, Task 2 |
| Stale unbind cannot release a newer generation | `TC-T6-MEDIA-012B` | Task 2 |
| Replay, reactivation, and mixed-generation atomicity | `TC-T6-MEDIA-012C` | Task 2 |
| Exact internal client request contract | `TC-T6-MEDIA-016A` | Task 3 |
| Stable remote validation errors | `TC-T6-MEDIA-016B` | Task 3 |
| Retryable error classification and secret safety | `TC-T6-MEDIA-016C` | Task 3 |
| Focused and six-project regression gates | all above | Task 4 |

## Artifact Result

| Artifact | Result | Notes |
| --- | --- | --- |
| Design addendum | TECHNICAL_PASS | State identities, ordering, concurrency, recovery ownership, compatibility, and rollback are explicit. |
| Test addendum | TECHNICAL_PASS | Six unique executable cases cover all addendum acceptance rules. |
| Implementation plan | TECHNICAL_PASS | 22 unchecked TDD steps; no placeholders; exact files and commands are present. |
| Parent baseline compatibility | TECHNICAL_PASS | No public route, product scope, field-purpose rule, or retention behavior changes. |
| Product-owner decision | APPROVED | Approved by linmingfeng on 2026-06-21; implementation may start at Task 1 RED. |

## Evidence

```bash
rg '^\| `TC-T6-' docs/development/family-growth-task6-phase3a-test-cases.md \
  | sed -E 's/^\| `([^`]+)`.*/\1/' | sort | uniq -c
rg -c '^- \[ \]' docs/superpowers/plans/2026-06-21-family-growth-task6-phase3a-reference-client.md
git diff --check
```

Observed during technical review: six unique suffix case IDs, 22 implementation steps, no placeholder matches, and no whitespace errors.

## Decision

No BLOCKER, MAJOR, or MINOR finding remains open. Product-owner approval was received on 2026-06-21. The design addendum, test addendum, and implementation plan are approved, and implementation may start at Task 1 RED.

## Sign-off

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Product owner | linmingfeng | APPROVED | 2026-06-21 |
| Technical reviewer | Codex | APPROVED | 2026-06-21 |

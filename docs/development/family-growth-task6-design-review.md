# Task 6 Design Review Record

**Review ID:** FGT-T6-DR-2026-06-20  
**Baseline candidate:** FGT-MVP-1.4  
**Status:** APPROVED  
**Scope:** Product requirements, API contract, detailed design, privacy, data consistency, historical aggregation, and deployment for Task 6

## Review Criteria

- Every Task 6 behavior has a stable requirement and observable result.
- Every media-bearing business field participates in one ownership and reference protocol.
- Private media authorization, capability signing, deletion, retention, and log redaction are explicit.
- Historical reports reconstruct cutoff state instead of reading mutable current state.
- Current-week recomputation, ended-week promotion, concurrency, and feedback isolation are defined.
- Service startup, transaction topology, timeouts, errors, secrets, rollback, and regression gates are explicit.
- No BLOCKER or MAJOR finding remains open before implementation planning.

## Findings

| ID | Severity | Finding | Resolution | Status |
| --- | --- | --- | --- | --- |
| `FGT-T6-DES-001` | BLOCKER | The first draft bound only mistake media, while `Child.avatarMediaId` and `GrowthTask.attachmentMediaIds` could persist unvalidated IDs. | Extended the reference protocol, pending state, recovery, and field-purpose table to user-, homework-, and analytics-service consumers. | CLOSED |
| `FGT-T6-DES-002` | BLOCKER | A report generated after week end could read the current mistake/mastery state and misrepresent the historical cutoff. | Added immutable owner-side mistake and knowledge-point state events, atomic source/event writes, cutoff projection, and `REPORT_HISTORY_AVAILABLE_FROM`. | CLOSED |
| `FGT-T6-DES-003` | MAJOR | Deleting media could release bound references and permit physical cleanup while a business row still retained the media ID. | Deletion now releases only prepared rows; bound rows remain retention guards until explicit unbind, followed by a full 30-day retention interval. | CLOSED |
| `FGT-T6-DES-004` | MAJOR | A report first generated during the current week had no defined atomic transition to an ended frozen snapshot. | Added compare-and-set promotion, bounded winner read, feedback preservation, and prohibition on returning an ended non-frozen report. | CLOSED |
| `FGT-T6-DES-005` | MAJOR | Avatar upload and access did not distinguish child-scoped avatars from the API's parent-only family-scoped avatar case. | Defined nullable childId only for parent-uploaded family-scoped avatar and explicit parent-only access/deletion rules. | CLOSED |
| `FGT-T6-DES-006` | MAJOR | Media uniqueness and signed-content input did not consistently include the family boundary and nonce. | Added family-first unique indexes and signed every security-relevant capability value, including nonce. | CLOSED |
| `FGT-T6-DES-007` | MAJOR | Child mistake creation and `reviewStatus` filtering were ambiguous. | Defined child create-only classification fields, post-create immutability, and the mutually exclusive status mapping. | CLOSED |
| `FGT-T6-DES-008` | MINOR | Completion-rate rounding had no executable numeric rule. | Defined integer-based half-up rounding to at most two decimals and aligned the API example contract. | CLOSED |

## Artifact Review

| Artifact | Result | Notes |
| --- | --- | --- |
| Product requirements | PASS | Task 6 scope remains media, mistakes, and weekly reports. |
| API contract | PASS | Pending-reference, media scope, mistake filters, retention, and rounding are explicit. |
| Detailed design | PASS | Ownership, events, indexes, recovery, concurrency, deployment, and rollback are defined. |
| ADR consistency | PASS | Ended-week snapshots obey ADR-0007 and do not use mutable post-cutoff state. |
| Traceability | PASS | All Task 6 requirements map to approved numbered test groups. |

## Evidence

```bash
rg -n "TBD|TODO|implement later|fill in details|similar to|待定|稍后补充" \
  docs/api/family-learning-tracker-api.md \
  docs/superpowers/specs/2026-06-20-family-growth-task6-design.md
git diff --check
```

Observed before sign-off: no placeholder matches and no whitespace errors.

## Decision

No BLOCKER, MAJOR, or MINOR design finding remains open. Product-owner review was completed on 2026-06-20. Task 6 may proceed to implementation planning after the test design review is also approved.

## Sign-off

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Product owner | linmingfeng | APPROVED | 2026-06-20 |
| Technical reviewer | Codex | APPROVED | 2026-06-20 |

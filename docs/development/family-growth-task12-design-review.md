# Task 12 Second Parent Co-Management Design Review

**Review ID:** FGT-T12-DR-2026-07-16
**Baseline candidate:** FGT-MVP-1.7
**Status:** APPROVED
**Scope:** Product decisions, permission model, invitation security, transaction boundaries, API, frontend, compatibility, and release criteria
**Requirements:** `FR-FAM-004`, `FR-FAM-005`, `NFR-DATA-003`

## 1. Approved Decisions

| Decision | Approved result |
| --- | --- |
| Daily permission model | Two active parents have equal family-growth management permissions. |
| Governance model | Family creator is the initial owner; invitation, removal, and transfer belong to the current owner. |
| Joining mechanism | Authenticated acceptance of a single-use 72-hour opaque invitation link/token. |
| Membership limit | At most two active parents per family. |
| Departure history | Historical records and attribution remain; access ends immediately. |
| Owner departure | Ownership must be transferred before the owner can leave. |

## 2. Review Findings

| ID | Severity | Finding | Resolution | Status |
| --- | --- | --- | --- | --- |
| `FGT-T12-DES-001` | MAJOR | Reusing a signed stateless invitation would not support revocation, one-time use, or durable audit. | Use a random opaque token, store only its SHA-256 digest, and persist lifecycle state. | CLOSED |
| `FGT-T12-DES-002` | MAJOR | Updating Family, User, invitation, and event separately could create partial membership or exceed two parents under concurrency. | Use replica-set transactions, conditional updates, and invitation compare-and-set acceptance. | CLOSED |
| `FGT-T12-DES-003` | MAJOR | Equal daily access could accidentally imply equal ability to remove the creator. | Separate ordinary family permission from owner-only governance permission. | CLOSED |
| `FGT-T12-DES-004` | MAJOR | JWT-contained family information could leave removed parents authorized until token expiry. | Resolve live Family owner/member relationship on every protected family request. | CLOSED |
| `FGT-T12-DES-005` | MINOR | Existing `User.children` can drift when a second parent joins or a child is added. | Keep Family.childIds authoritative and maintain User.children only as an explicitly tested compatibility projection. | CLOSED |
| `FGT-T12-DES-006` | MINOR | Deleting departing-parent records would corrupt the child's longitudinal history. | Preserve business records and original actor IDs; change only membership and compatibility projections. | CLOSED |

## 3. Artifact Review

| Artifact | Result | Notes |
| --- | --- | --- |
| PRD | PASS | Three independently testable Task 12 requirements and observable acceptance boundaries. |
| Overall architecture | PASS | Domain ownership, states, transactions, authorization, compatibility, and rollback defined. |
| Detailed design | PASS | Invitation lifecycle, governance commands, UI, stable errors, and release criteria defined. |
| API contract | PASS | Eight public operations and safe parent projections defined. |
| Test design | READY_FOR_REVIEW | Numbered model, route, concurrency, cross-service, frontend, browser, repair, and rollback cases prepared. |

## 4. Decision

No design BLOCKER or MAJOR finding remains open. The approved design may be frozen as the Task 12
implementation baseline after the written test design is reviewed. Implementation planning and
production code changes remain outside this documentation commit.

## 5. Sign-off

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Product owner | linmingfeng | APPROVED | 2026-07-16 |
| Technical reviewer | Codex | APPROVED | 2026-07-16 |

# Task 12 Second Parent Co-Management Design Review

**Review ID:** FGT-T12-DR-2026-07-16
**Baseline candidate:** FGT-MVP-1.7
**Status:** APPROVED
**Approved revision:** 2026-07-16 review remediation
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
| `FGT-T12-DES-005` | MINOR | Existing `User.children` can drift when a second parent joins or a child is added. | Keep Family.childIds authoritative; transactionally update every active parent's projection. Reject a startup full scan and require repair dry-run/apply/`--check` before enablement. | CLOSED |
| `FGT-T12-DES-006` | MINOR | Deleting departing-parent records would corrupt the child's longitudinal history. | Preserve business records and original actor IDs; change only membership and compatibility projections. | CLOSED |
| `FGT-T12-DES-007` | MINOR | Preview and accept could expose invitation history if inactive states or endpoints return distinguishable errors. | For every well-formed inactive token, decide inactivity before parent eligibility and use the same `409`, code, message, and details; only requestId may differ. | CLOSED |
| `FGT-T12-DES-008` | MAJOR | resource-service can trust parent `identity.familyId`/legacy User projection before live Family membership, weakening immediate revocation. | Parent tokens/envelopes carry no authoritative family claim; all parent services, including resource-service, query live owner/member membership and ignore stale/forged family claims. | CLOSED |
| `FGT-T12-DES-009` | MINOR | The invitation fragment is currently lost because login restores only pathname and registration uses a fixed destination. | Preserve the whitelisted invitation location and `useLocation().hash` through both auth flows; replace history after acceptance and prohibit persistent storage. | CLOSED |
| `FGT-T12-DES-010` | MINOR | Historical owner/member projections may violate stricter Task 12 schema, including ambiguous sets above two members. | Keep Task 12 disabled through dry-run, manual conflict resolution, apply, and zero-drift `--check`; never auto-truncate or guess membership. | CLOSED |
| `FGT-T12-DES-011` | MINOR | Core invitation, canonical membership, governance, transaction, and compatibility decisions lacked a durable ADR. | Record accepted ADR-0008 and link it from architecture and Task 12 traceability. | CLOSED |

## 3. Artifact Review

| Artifact | Result | Notes |
| --- | --- | --- |
| PRD | PASS | Three independently testable Task 12 requirements and observable acceptance boundaries. |
| Overall architecture | PASS | Domain ownership, states, transactions, authorization, compatibility, and rollback defined. |
| ADR-0008 | PASS | Opaque invitation, canonical Family membership, live authorization, transaction, projection, and preflight decisions recorded. |
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

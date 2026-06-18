# 家庭成长跟踪设计基线评审记录

**Review ID:** FGT-DR-2026-06-18
**Status:** IN_REVIEW
**Branch:** codex/family-growth-tracker
**Gate:** Task 4.5

## Baseline Inventory

| Artifact | Review status | Approved commit | Reviewer | Review date |
| --- | --- | --- | --- | --- |
| Product requirements | IN_REVIEW | not-approved | unassigned | pending |
| Architecture design and ADRs | IN_REVIEW | not-approved | unassigned | pending |
| API contract | IN_REVIEW | not-approved | unassigned | pending |
| Test strategy | IN_REVIEW | not-approved | Codex | 2026-06-18 |
| Traceability matrix | IN_REVIEW | not-approved | Codex | 2026-06-18 |

## Finding Rules

- BLOCKER: cross-family access, irreversible data corruption, credential exposure, or a core contract that cannot support the MVP flow.
- MAJOR: an approved MVP behavior, authorization rule, state transition, or deterministic test is missing or contradictory.
- MINOR: naming, documentation, or non-blocking consistency issue.

## Findings

| ID | Severity | Requirement | Evidence | Disposition | Status |
| --- | --- | --- | --- | --- | --- |
| FGT-T3-001 | MAJOR | `FR-FAM-001`, `NFR-TIME-001` | `Family.js:4-24` has no timezone; `familyController.js:116-120` ignores request timezone and `familyView:9-16` cannot return it. | Add validated IANA timezone with default and API tests. | OPEN |
| FGT-T3-002 | MAJOR | `FR-CHILD-003` | `familyController.js:335-337` accepts 4-8 digits while baseline requires 4-6. | Add contract tests and restrict validation to 4-6 digits. | OPEN |
| FGT-T3-003 | BLOCKER | `FR-CHILD-005` | `User.js:100-150` has no tokenVersion; PIN reset at `familyController.js:346-347` only replaces hash; JWT verification never checks current version. | Add tokenVersion, include it in child token and reject stale child tokens. | OPEN |
| FGT-T3-004 | MAJOR | `FR-CHILD-004` | `familyController.js:358-374` performs credential checks without per-IP/family/child failure tracking or `429`. | Add 5-attempt/15-minute limiter with generic credentials response. | OPEN |
| FGT-T3-005 | MAJOR | `FR-CHILD-004` | Child token at `familyController.js:376-380` includes only id/username/role; `auth.js:150-162` uses global 1-day expiry and omits familyId, childId and tokenVersion. | Issue a child token capped at 12 hours with required claims. | OPEN |
| FGT-T3-006 | MAJOR | Task 3 API contract | `familyController.js:38-41` returns top-level message instead of stable `error.code/message/details`; child list also omits contract pagination. | Introduce shared family error/list response helpers and contract tests. | OPEN |
| FGT-T3-007 | MINOR | Engineering quality | Fresh tests emit duplicate Mongoose index warnings for username, email, phone, name and ownerParentId. | Remove duplicate schema index declarations without changing uniqueness. | OPEN |

## Verification Evidence

### Task 3 targeted tests

- Date: 2026-06-18
- Command: `npm test --prefix backend/services/user-service -- --runInBand __tests__/routes/family.test.js __tests__/routes/children.test.js`
- Result: exit 0; 2 suites passed; 5 tests passed; 0 failed.
- Covered: one family per parent, multiple children, cross-family child read/edit denial, child PIN happy path, sibling list denial.
- Not covered: timezone, PIN bounds, rate limiting, stale-token rejection, child token claims/expiry, stable errors and pagination.

## Task 5 Entry Decision

**Decision:** BLOCKED
**Reason:** Baseline review and Task 3/4 conformance review are not complete.

## Sign-off

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Product owner | linmingfeng | PENDING | pending |
| Technical reviewer | Codex | PENDING | pending |

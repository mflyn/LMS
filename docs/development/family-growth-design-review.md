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
| FGT-T4-001 | MAJOR | `FR-TASK-002`, `FR-TASK-003`, `NFR-TIME-001` | `GrowthTask.js:48-52` stores dueDate as BSON Date; `growthTasks.js:99-115` calculates today/week in server local time and never reads Family.timezone. | Store LocalDate String and add fixed-clock family-timezone boundary tests. | OPEN |
| FGT-T4-002 | MAJOR | `FR-TASK-006` | `GrowthTask.js:82-86` defines repeatRule; `growthTasks.js:151` and `344-357` accept it instead of `400 REPEAT_RULE_NOT_SUPPORTED`. | Remove field and reject repeatRule on create/edit. | OPEN |
| FGT-T4-003 | MAJOR | Task 4 API contract | `growthTasks.js:11-14` returns top-level message; list at `202-210` has no page/pageSize or maximum validation. | Adopt stable errors and pagination with contract tests. | OPEN |
| FGT-T4-004 | MAJOR | `NFR-DATA-001` | `GrowthTask.js:119` index `{ childId, dimension, status }` omits familyId, contrary to the family-first index baseline. | Replace with `{ familyId, childId, dimension, status }`. | OPEN |
| FGT-T4-005 | MAJOR | `FR-TASK-003` | `growthTasks.js:184-192` validates dimension but accepts arbitrary status values; current tests cover only valid filters. | Validate status enum and add stable validation-error tests. | OPEN |
| FGT-T4-006 | MAJOR | `NFR-SEC-001`, `FR-TASK-003`-`FR-TASK-006` | Tests deny cross-family create only; list, detail, edit, complete, confirm and delete are not exercised against another family. | Add database-backed cross-family tests for every task operation. | OPEN |

## Verification Evidence

### Task 3 targeted tests

- Date: 2026-06-18
- Command: `npm test --prefix backend/services/user-service -- --runInBand __tests__/routes/family.test.js __tests__/routes/children.test.js`
- Result: exit 0; 2 suites passed; 5 tests passed; 0 failed.
- Covered: one family per parent, multiple children, cross-family child read/edit denial, child PIN happy path, sibling list denial.
- Not covered: timezone, PIN bounds, rate limiting, stale-token rejection, child token claims/expiry, stable errors and pagination.

### Task 4 targeted tests

- Date: 2026-06-18
- Command: `npm test --prefix backend/services/homework-service -- --runInBand __tests__/growthTasks.test.js`
- Result: exit 0; 1 suite passed; 12 tests passed; 0 failed.
- Covered: five-dimension create, cross-family create denial, server-local today/week filters, dimension filter, child completion, parent confirmation and child confirmation denial.
- Not covered: family timezone boundaries, LocalDate storage, repeatRule rejection, pagination, stable errors, invalid status, delete/archive and cross-family operations other than create.

## Task 5 Entry Decision

**Decision:** BLOCKED
**Reason:** Baseline review and Task 3/4 conformance review are not complete.

## Sign-off

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Product owner | linmingfeng | PENDING | pending |
| Technical reviewer | Codex | PENDING | pending |

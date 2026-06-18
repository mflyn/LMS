# 家庭成长跟踪设计基线评审记录

**Review ID:** FGT-DR-2026-06-18
**Status:** APPROVED
**Branch:** codex/family-growth-tracker
**Gate:** Task 4.5

## Baseline Inventory

| Artifact | Review status | Approved commit | Reviewer | Review date |
| --- | --- | --- | --- | --- |
| Product requirements | APPROVED | baseline manifest candidate | linmingfeng | 2026-06-19 |
| Architecture design and ADRs | APPROVED | baseline manifest candidate | linmingfeng / Codex | 2026-06-19 |
| API contract | APPROVED | baseline manifest candidate | linmingfeng / Codex | 2026-06-19 |
| Test strategy | APPROVED | baseline manifest candidate | Codex | 2026-06-19 |
| Traceability matrix | APPROVED | baseline manifest candidate | Codex | 2026-06-19 |

## Finding Rules

- BLOCKER: cross-family access, irreversible data corruption, credential exposure, or a core contract that cannot support the MVP flow.
- MAJOR: an approved MVP behavior, authorization rule, state transition, or deterministic test is missing or contradictory.
- MINOR: naming, documentation, or non-blocking consistency issue.

## Findings

| ID | Severity | Requirement | Evidence | Disposition | Status |
| --- | --- | --- | --- | --- | --- |
| FGT-T3-001 | MAJOR | `FR-FAM-001`, `NFR-TIME-001` | `Family.js:4-24` has no timezone; `familyController.js:116-120` ignores request timezone and `familyView:9-16` cannot return it. | Added validated IANA timezone, default, response field and tests. | CLOSED |
| FGT-T3-002 | MAJOR | `FR-CHILD-003` | `familyController.js:335-337` accepts 4-8 digits while baseline requires 4-6. | Restricted PIN to 4-6 digits with boundary tests. | CLOSED |
| FGT-T3-003 | BLOCKER | `FR-CHILD-005` | `User.js:100-150` has no tokenVersion; PIN reset at `familyController.js:346-347` only replaces hash; JWT verification never checks current version. | Added tokenVersion, reset increment and stale-token rejection. | CLOSED |
| FGT-T3-004 | MAJOR | `FR-CHILD-004` | `familyController.js:358-374` performs credential checks without per-IP/family/child failure tracking or `429`. | Added 5-attempt/15-minute limiter and generic response. | CLOSED |
| FGT-T3-005 | MAJOR | `FR-CHILD-004` | Child token at `familyController.js:376-380` includes only id/username/role; `auth.js:150-162` uses global 1-day expiry and omits familyId, childId and tokenVersion. | Added familyId, childId, tokenVersion and 12-hour expiry. | CLOSED |
| FGT-T3-006 | MAJOR | Task 3 API contract | `familyController.js:38-41` returns top-level message instead of stable `error.code/message/details`; child list also omits contract pagination. | Added stable response helpers and child pagination. | CLOSED |
| FGT-T3-007 | MINOR | Engineering quality | Fresh tests emit duplicate Mongoose index warnings for username, email, phone, name and ownerParentId. | Removed duplicate declarations while retaining uniqueness. | CLOSED |
| FGT-T4-001 | MAJOR | `FR-TASK-002`, `FR-TASK-003`, `NFR-TIME-001` | `GrowthTask.js:48-52` stores dueDate as BSON Date; `growthTasks.js:99-115` calculates today/week in server local time and never reads Family.timezone. | Stores LocalDate and scopes today/week by family timezone. | CLOSED |
| FGT-T4-002 | MAJOR | `FR-TASK-006` | `GrowthTask.js:82-86` defines repeatRule; `growthTasks.js:151` and `344-357` accept it instead of `400 REPEAT_RULE_NOT_SUPPORTED`. | Removed field and rejects repeatRule on create/edit. | CLOSED |
| FGT-T4-003 | MAJOR | Task 4 API contract | `growthTasks.js:11-14` returns top-level message; list at `202-210` has no page/pageSize or maximum validation. | Added stable errors and bounded pagination. | CLOSED |
| FGT-T4-004 | MAJOR | `NFR-DATA-001` | `GrowthTask.js:119` index `{ childId, dimension, status }` omits familyId, contrary to the family-first index baseline. | Replaced with family-first compound index. | CLOSED |
| FGT-T4-005 | MAJOR | `FR-TASK-003` | `growthTasks.js:184-192` validates dimension but accepts arbitrary status values; current tests cover only valid filters. | Added enum validation and stable error test. | CLOSED |
| FGT-T4-006 | MAJOR | `NFR-SEC-001`, `FR-TASK-003`-`FR-TASK-006` | Tests deny cross-family create only; list, detail, edit, complete, confirm and delete are not exercised against another family. | Added database-backed denial tests for every operation. | CLOSED |
| FGT-GW-001 | BLOCKER | `NFR-SEC-002` | `gateway/server.js:25-48` writes decoded claims into request headers without a strip-all identity-header step or signature; `auth.js:67-96` trusts any supplied x-user-id/x-user-role. | Added strip-all and HMAC-signed identity envelope. | CLOSED |
| FGT-GW-002 | BLOCKER | `NFR-SEC-002` | No gateway/downstream code generates or verifies method/path/timestamp/nonce; there is no freshness or replay protection. | Added canonical method/path/timestamp/nonce, freshness and replay checks. | CLOSED |
| FGT-GW-003 | MAJOR | `NFR-SEC-002` | Repository search finds no tests for forged headers, signature tampering, expiry or nonce replay; family tests directly set trusted x-user headers. | Added common and gateway security suites; family tests use signed headers. | CLOSED |
| FGT-GW-004 | MAJOR | `NFR-SEC-002`, `NFR-COMPAT-001` | `gateway/simple-server.js:13-31` is a second unsigned gateway entrypoint and does not contain family routes. | Simple entrypoint now delegates to the secured production server. | CLOSED |
| FGT-FR-001 | MAJOR | `NFR-SEC-002` | Final review found gateway and user-service global error handlers mounted before business routes. | Mounted a final error handler after routes in both production services. | CLOSED |
| FGT-FR-002 | MAJOR | `FR-CHILD-004` | Final review found nonexistent family/child credentials did not increment the PIN failure counter. | Centralized failure recording; nonexistent credentials lock on attempt five. | CLOSED |
| FGT-FR-003 | MAJOR | `NFR-SEC-002` | Final review found missing/short identity secrets failed only during a request and deployment examples omitted the shared secret. | Validate at middleware creation and require the secret in example/Compose configuration. | CLOSED |

## Verification Evidence

- Date: 2026-06-19
- Shared auth: 2 suites, 21 tests passed.
- Gateway: 1 suite, 3 tests passed.
- Family and children: 2 suites, 11 tests passed.
- Growth tasks: 1 suite, 17 tests passed.
- Deployment configuration: both Compose files passed `docker compose config -q` with a valid identity secret.
- Static quality: `git diff --check` passed and targeted user tests emit no duplicate schema-index warnings.
- Total targeted regression: 6 suites, 52 tests passed, 0 failed.

## Task 5 Entry Decision

**Decision:** APPROVED
**Reason:** All 3 BLOCKER, 16 MAJOR and 1 MINOR findings are closed with code and regression evidence. Task 5 may start from the tagged baseline.

## Sign-off

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Product owner | linmingfeng | APPROVED | 2026-06-19 |
| Technical reviewer | Codex | APPROVED | 2026-06-19 |

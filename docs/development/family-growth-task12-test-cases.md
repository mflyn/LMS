# Task 12 Second Parent Co-Management Test Design and Cases

**Document status:** READY_FOR_REVIEW
**Date:** 2026-07-16
**Baseline candidate:** FGT-MVP-1.7
**Design:** `docs/superpowers/specs/2026-07-16-family-growth-task12-co-parent-design.md`
**Requirements:** `FR-FAM-004`, `FR-FAM-005`, `NFR-DATA-003`

## 1. Test Principles

- Membership and invitation tests use a real transaction-capable MongoDB replica set.
- Every mutation is tested for success, authorization denial, validation, conflict, rollback,
  replay, and relevant concurrency.
- Cross-service tests use signed gateway identity envelopes and real family relationships.
- Frontend tests mock only public API envelopes; the browser gate uses the real gateway and APIs.
- Logs and responses are inspected to prove that clear invitation tokens and digests are absent.
- No retry converts an unstable test into release evidence.

## 2. Model and Invitation Lifecycle

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T12-MODEL-001` | Save a family with owner absent from members, duplicate members, or more than two members. | Validation rejects the invalid family state. | Family model test |
| `TC-T12-MODEL-002` | Save valid owner-only and two-parent families. | Both persist with unique, ordered member identities. | Family model test |
| `TC-T12-INV-001` | Owner creates an invitation for a one-parent family. | `201`; one clear token is returned, only its digest is stored, and expiry is 72 hours. | user-service route test |
| `TC-T12-INV-002` | Non-owner or unrelated parent creates or lists an invitation. | `403 FAMILY_GOVERNANCE_DENIED`; no invitation or token metadata leaks. | route test |
| `TC-T12-INV-003` | Owner creates another invitation while one is active. | `409 FAMILY_INVITATION_ALREADY_ACTIVE`; existing invitation remains usable and a second pending row is not created. | route and unique-index test |
| `TC-T12-INV-004` | Owner creates after prior invitation elapsed. | Prior row becomes expired and one new invitation is created atomically. | fixed-clock route test |
| `TC-T12-INV-005` | Owner revokes active invitation twice. | First returns `204`; replay returns `409 FAMILY_INVITATION_NOT_ACTIVE` without another event. | route test |
| `TC-T12-INV-006` | Inspect API responses, request targets, application logs, errors, and audit events. | Clear token appears in the create response and redacted preview/accept body only; token and digest are absent from request URLs, other responses, logs, errors, and events. | log-capture security test |

## 3. Acceptance and Concurrency

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T12-ACCEPT-001` | Eligible parent accepts an active token with a valid family role. | Invitation becomes accepted; Family, User compatibility projection, and event commit together. | transaction integration test |
| `TC-T12-ACCEPT-002` | Child/admin account attempts acceptance. | `403`; no document changes. | route test |
| `TC-T12-ACCEPT-003` | Parent already in this or another family accepts. | `409 PARENT_ALREADY_IN_FAMILY`; original membership remains unchanged. | transaction integration test |
| `TC-T12-ACCEPT-004` | Accept invalid, expired, revoked, or consumed token. | `409 FAMILY_INVITATION_NOT_ACTIVE` for every case; no history enumeration. | fixed-clock route test |
| `TC-T12-ACCEPT-005` | Two different parents concurrently accept the same token. | Exactly one succeeds; family has exactly two members, one accepted event, and no partial loser update. | replica-set concurrency test |
| `TC-T12-ACCEPT-006` | Inject failure after Family or User write. | Entire transaction rolls back, invitation remains usable, and no event persists. | transaction rollback test |
| `TC-T12-ACCEPT-007` | Family already contains two members before acceptance. | `409 FAMILY_PARENT_LIMIT_REACHED`; invitation and users are unchanged. | integration test |

## 4. Co-Management and Governance

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T12-ACCESS-001` | Second parent reads and updates family settings and child profile. | Same success contract as owner. | user-service integration test |
| `TC-T12-ACCESS-002` | Second parent creates/completes/confirms tasks and manages logs, mistakes, media, reports, reminders, points, and rewards. | Every existing daily operation succeeds for the shared family and remains scoped to it. | selected service regression matrix |
| `TC-T12-ACCESS-003` | Second parent accesses another family or sibling through forged IDs. | Stable `403`; no foreign data returned or mutated. | cross-service security tests |
| `TC-T12-GOV-001` | Non-owner attempts invite, revoke, remove, or transfer. | `403 FAMILY_GOVERNANCE_DENIED`; no state/event changes. | user-service route test |
| `TC-T12-GOV-002` | Owner removes active second parent. | Membership and User projection clear atomically; history remains; one removal event exists. | transaction integration test |
| `TC-T12-GOV-003` | Second parent leaves. | Same atomic cleanup and history retention with one leave event. | transaction integration test |
| `TC-T12-GOV-004` | Owner attempts to leave or remove self. | `409 OWNER_TRANSFER_REQUIRED`; state is unchanged. | route test |
| `TC-T12-GOV-005` | Owner transfers ownership to active second parent. | Owner ID changes, both members remain, one before/after event exists. | transaction integration test |
| `TC-T12-GOV-006` | Transfer to self, unrelated parent, removed parent, child, or malformed ID. | Stable validation/member error; no state changes. | route test |
| `TC-T12-GOV-007` | Inject transaction failures in leave, removal, and transfer. | Every related write and event rolls back. | transaction rollback test |
| `TC-T12-GOV-008` | Former member reuses an unexpired parent token after leave/removal. | Next family request is denied because live membership no longer exists. | real auth integration test |

## 5. API, Frontend, and Browser

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T12-API-001` | Read family as either active parent. | Safe `parents` summaries contain ID, name, role, and owner flag only. | contract test |
| `TC-T12-API-002` | Submit unknown fields, forged actor IDs, or client family ownership fields. | `400` and no server-controlled field changes. | contract test |
| `TC-T12-UI-001` | Owner opens family members page with no second parent. | Two stable slots render; only owner invitation controls are available. | React integration test |
| `TC-T12-UI-002` | Create, copy, reload, and revoke invitation. | Token is copyable only immediately after creation; reload shows metadata without token; revoke updates state. | React integration test |
| `TC-T12-UI-003` | Open fragment-based invitation logged out, login/register, then accept. | Token never enters a request URL or persistent storage; intended route survives authentication and FamilyContext refreshes to joined family. | React and Chromium test |
| `TC-T12-UI-004` | Second parent uses normal family pages. | Navigation and child workflows match owner; governance controls remain absent. | React integration test |
| `TC-T12-UI-005` | Owner transfers ownership then old owner reloads. | Controls swap immediately according to server response. | React and Chromium test |
| `TC-T12-UI-006` | Remove or leave after confirmation. | History-retention copy is visible; family route becomes inaccessible to departed member. | React and Chromium test |
| `TC-T12-UX-001` | Complete invite, accept, shared task, transfer, and removal at desktop and 360px. | No overflow, overlap, inaccessible controls, or relevant console errors. | Chromium, one worker, zero retries |

## 6. Repair, Regression, and Gate

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T12-REPAIR-001` | Run repair against missing owner membership, duplicate IDs, and stale compatibility projections. | Deterministic changes are corrected and reported. | repair script test |
| `TC-T12-REPAIR-002` | Run repair where one parent appears in conflicting families. | Conflict is reported and no guessed reassignment occurs. | repair script test |
| `TC-T12-REG-001` | Run Task 12 focused integration twice. | Identical totals, zero failures, no open handles. | Task 12 gate |
| `TC-T12-REG-002` | Run family backend, frontend, Task 11, production build, docs, and clean-worktree checks. | Every command exits zero and no generated artifact is tracked. | Task 12 gate and CI |
| `TC-T12-REG-003` | Roll back Task 12 routes/UI with a two-parent family present. | Existing services still authorize both members; no relationship or history is deleted. | rollback integration test |

## 7. Entry and Exit Criteria

Entry requires approved product, overall, detailed, API, and test designs; no open design
BLOCKER or MAJOR finding; and a passing v1.6 baseline.

Exit requires every `TC-T12-*` case to have executable evidence, all Task 12 and regression
commands to pass without retries, traceability to move all three requirements to `COVERED`, and
the v1.7 candidate manifest to identify the verified implementation commit and remote CI run.

## 8. Requirement Traceability

| Requirement | Cases |
| --- | --- |
| `FR-FAM-004` | `INV-*`, `ACCEPT-*`, `ACCESS-*`, `API-*`, `UI-001` to `004`, `UX-001` |
| `FR-FAM-005` | `GOV-*`, `UI-005` to `006`, `UX-001`, `REG-003` |
| `NFR-DATA-003` | `MODEL-*`, `ACCEPT-005` to `007`, `GOV-007` to `008`, `REPAIR-*`, `REG-*` |

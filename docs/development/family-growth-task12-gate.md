# Task 12 Second Parent Co-Management Gate

**Gate ID:** FGT-T12-GATE-2026-07-16
**Baseline:** FGT-MVP-1.7
**Status:** IMPLEMENTED / LOCAL RELEASE GATE PASSED
**Implementation evidence commit:** `a5ebae9b`
**Requirements:** `FR-FAM-004`, `FR-FAM-005`, `NFR-DATA-003`

## 1. Automated Evidence

| Layer | Executable evidence | Contract |
| --- | --- | --- |
| Models and repair | `FamilyMembership.test.js`, `repairFamilyRelationships.test.js` | Owner/member invariant, max two parents, deterministic repair, conflicts, apply and check exit behavior |
| Invitation and governance | `parentMembership.test.js` | Token digest, expiry/revoke/consume uniformity, role ordering, concurrency, transaction rollback, projections, leave/remove/transfer |
| Authentication and Gateway | Gateway auth/proxy tests and Task 12 integration | Parent JWT has no authoritative family claim; invitation routes proxy through signed identity |
| Downstream authorization | homework/progress/resource family tests and Task 12 integration | Both parents use live Family membership; forged claims and removed-member tokens are denied |
| Parent Web | `Task12FamilyMembers.test.js`, `Task12InvitationFlow.test.js`, family API/context tests | Stable slots, one-time token, auth return, owner controls and context refresh |
| Browser | `tests/e2e/task12/co-parent.spec.js` | Real Gateway/API flow, registration return, accept, transfer/remove, history cleanup, desktop and 360px |
| Regression | Unified `release:family` script | Family backend and compatibility contracts, Task 11, frontend, build, Chromium, Compose smoke and clean tree |

The clear invitation token is returned once and stored only in component memory. Route tests prove
that persistence and metadata responses contain only the SHA-256 digest or redacted metadata;
frontend and Chromium tests prove the clear token is absent from request URLs and persistent Web
storage. Service request logging records method and URL, not request bodies.

## 2. Repeatable Commands

The 2026-07-16 implementation candidate produced the following local component evidence without
retries: 81 family backend suites / 895 tests; two consecutive Task 12 runs of 1 suite / 2 tests;
29 frontend suites / 183 tests; 4 Task 11 integration suites / 6 tests; 4 Task 11 Chromium tests;
1 Task 12 Chromium test; ESLint, documentation audit, and production Web build all passed.
The unified release command completed with `status=0` at commit `a5ebae9b`; Compose validation,
image builds, service health checks, the private-media smoke flow, teardown, and the clean-tree
check also passed in that run.

The unified local and CI release command is:

```bash
npm run release:family
```

It performs clean dependency installs and then runs, in order:

```bash
npm run lint
npm run docs:family:check
npm run test:family-regression
npm run test:family-flow:integration
npm run test:task12:integration
npm run test:task12:integration
npm run test:ci --prefix frontend/web -- --runInBand
npm run build --prefix frontend/web
npm run test:family-flow:e2e
npm run test:task12:e2e
```

The same script then validates, builds and starts the family Compose stack, executes the private
media smoke flow, tears the stack down without deleting persistent volumes, and checks that no
generated file changed the Git worktree. Logs and the tested commit are written under
`release-gate-artifacts/`, which remains untracked.

The explicitly isolated school-version backend command `npm run test:legacy-regression` is not an
FGT-MVP release Gate: it contains known obsolete mocks, removed school models, and pre-baseline
configuration assumptions. Family route-preservation and rollback compatibility are covered by the
`family-common` contracts inside `test:family-regression`; Task 12 does not broaden scope to repair
the archived school application.

## 3. Deployment Preflight

Automated tests verify the repair planner and CLI semantics with transaction-capable disposable
MongoDB replica sets. Before enabling Task 12 routes and UI in any existing environment, operators
must separately run the following against that environment's backup-verified database:

```bash
npm run repair:family-relationships
npm run repair:family-relationships -- --apply
npm run repair:family-relationships:check
```

Conflicts, including any family with more than two candidate parents or a parent associated with
multiple families, require manual resolution. Task 12 remains disabled until `--check` reports zero
operations and zero conflicts with exit code `0`. The command never truncates or guesses a member
set. This environment-specific result is deployment evidence and is not claimed by the repository
release Gate.

## 4. Rollback

Rollback disables the invitation and governance routes and the two parent-management pages. It
does not delete Family membership, invitation history, membership events, child data, or actor IDs.
Existing daily services continue to authorize active owner/member relationships through live Family
queries. A removed parent remains denied even while an old JWT is otherwise unexpired.

## 5. Release Decision

The implementation may merge only after the unified release command passes from a clean feature
commit and the GitHub pull request Gate passes. Target-environment activation remains conditional
on Section 3 and the normal Secret, backup, TLS, capacity, monitoring and rollback approvals.

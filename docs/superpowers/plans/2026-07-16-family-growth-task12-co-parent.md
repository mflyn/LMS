# Task 12 Second Parent Co-Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one-family/two-parent co-management with opaque invitations, owner governance,
immediate live authorization, auditable transactions, repair preflight, and parent Web workflows.

**Architecture:** user-service owns Family membership, invitation lifecycle, compatibility projections,
and immutable membership events in one MongoDB replica-set transaction. Gateway forwards authenticated
parent identity without an authoritative family claim; every downstream parent service resolves live
Family membership. React keeps invitation secrets in URL fragments/component memory and exposes a
family-members workspace inside the existing parent shell.

**Tech Stack:** Node.js, Express, Mongoose/MongoDB replica-set transactions, Jest/Supertest,
React 18, React Router 6, Testing Library, Playwright, existing family CSS and API helpers.

## Global Constraints

- One family contains one or two unique active parents and always includes `ownerParentId`.
- Both parents have equal daily permissions; only owner can invite, revoke, remove, or transfer.
- Invitation token is 32 random bytes encoded base64url; only SHA-256 digest persists; expiry is 72 hours.
- Inactive invitation preview/accept returns identical `409 FAMILY_INVITATION_NOT_ACTIVE` envelopes.
- Parent tokens and signed identity envelopes do not authorize by `familyId`; live Family membership is mandatory.
- `Family.childIds` and `memberParentIds` are authoritative; User relationship fields are compatibility projections.
- Runtime membership changes require a transaction-capable replica set and do not downgrade to sequential writes.
- Task 12 remains disabled until repair dry-run, conflict resolution, apply, and zero-drift `--check` pass.
- Tests use zero retries; browser checks cover desktop and 360px.

---

### Task 1: Family Membership Domain Models

**Files:**
- Modify: `backend/common/models/Family.js`
- Create: `backend/common/models/FamilyParentInvitation.js`
- Create: `backend/common/models/FamilyMembershipEvent.js`
- Test: `backend/services/user-service/__tests__/models/FamilyMembership.test.js`

**Interfaces:**
- Produces `FamilyParentInvitation.STATUSES`, `FamilyMembershipEvent.ACTIONS`, model validation,
  invitation partial unique index, and max-two/owner-member Family invariants.

- [ ] Write model tests for valid one/two-parent families, duplicate/missing owner/over-two rejection,
  invitation lifecycle fields/index, and immutable event action fields.
- [ ] Run `npx jest --config=backend/services/user-service/jest.config.js --runInBand backend/services/user-service/__tests__/models/FamilyMembership.test.js`; verify RED on missing models/invariants.
- [ ] Implement schema validation and the two models using existing common-model conventions.
- [ ] Re-run the focused command and existing user-service family model/route tests; verify GREEN.
- [ ] Commit `feat: add co-parent membership models`.

### Task 2: Invitation and Governance Transactions

**Files:**
- Create: `backend/services/user-service/services/familyMembershipService.js`
- Create: `backend/services/user-service/controllers/parentMembershipController.js`
- Create: `backend/services/user-service/routes/parentInvitations.js`
- Modify: `backend/services/user-service/controllers/familyController.js`
- Modify: `backend/services/user-service/routes/family.js`
- Modify: `backend/services/user-service/routes/index.js`
- Test: `backend/services/user-service/__tests__/routes/parentMembership.test.js`
- Test: `backend/services/user-service/__tests__/routes/family.test.js`

**Interfaces:**
- Produces `createFamilyMembershipService({ FamilyModel, UserModel, InvitationModel, EventModel,
  mongooseInstance, now, randomBytes })` with create/list/revoke/preview/accept/leave/remove/transfer methods.
- Produces the eight approved public endpoints and safe `family.parents` projections.
- Reuses `runMongoTransaction`; all mutating methods re-check actor/target state inside the transaction.

- [ ] Write route/integration tests for owner and non-owner permissions, clear-token-once/digest storage,
  72-hour expiry, stable inactive response, accept success, already-member/full-family conflict, leave,
  removal, ownership transfer, event history, replay, rollback injection, and concurrent single winner.
- [ ] Add projection tests proving child creation synchronizes both active parents and rolls back on failure.
- [ ] Run the focused user-service suites; verify RED because routes/service do not exist.
- [ ] Implement service/controller/routes with allowlisted bodies, safe parent summaries, stable errors,
  compare-and-set invitation updates, and transaction-scoped Family/User/event writes.
- [ ] Update `getMyFamily`, family create, and child create paths to return parents and maintain all parent projections.
- [ ] Re-run focused suites twice with identical totals; verify GREEN and no open handles.
- [ ] Commit `feat: implement co-parent invitation governance`.

### Task 3: Relationship Repair Release Preflight

**Files:**
- Modify: `backend/services/user-service/scripts/repairFamilyRelationships.js`
- Modify: `backend/services/user-service/__tests__/scripts/repairFamilyRelationships.test.js`
- Modify: `package.json`

**Interfaces:**
- `planFamilyRelationshipRepairs` returns no write operation for a family with ambiguous multi-family
  declarations or more than two candidate parents.
- CLI accepts exactly one of dry-run default, `--apply`, or `--check`; check exits nonzero when
  `operations.length > 0 || conflicts.length > 0`.

- [ ] Write failing tests for over-two conflict/no-write, check dirty/conflict exit `1`, and clean exit `0`.
- [ ] Run the repair suite and verify RED.
- [ ] Refactor CLI argument/result handling into exported testable functions and implement strict check behavior.
- [ ] Add `repair:family-relationships:check` script and re-run focused tests; verify GREEN.
- [ ] Commit `feat: enforce co-parent repair preflight`.

### Task 4: Gateway and Live Cross-Service Authorization

**Files:**
- Modify: `backend/gateway/server.js`
- Modify: `backend/gateway/__tests__/familyTask12Routes.test.js`
- Modify: `backend/services/resource-service/services/mediaService.js`
- Modify: `backend/services/resource-service/server.js`
- Create: `backend/services/resource-service/models/Family.js`
- Modify: resource-service family media tests.
- Test: `backend/common/middleware/__tests__/auth.test.js`

**Interfaces:**
- Gateway proxies `/api/parent-invitations` and existing `/api/families` governance subpaths through
  signed parent authentication.
- `createMediaService` receives `FamilyModel` and resolves parent scope by live owner/member query;
  student scope continues to use signed child family/child/version identity.

- [ ] Write failing Gateway tests for preview/accept proxying and parent envelope without family authorization data.
- [ ] Write failing resource tests for forged/stale `identity.familyId`, second-parent access, and post-removal denial.
- [ ] Implement proxy and FamilyModel injection; split parent and child identity resolution in mediaService.
- [ ] Run common auth, Gateway, and resource family suites; verify GREEN.
- [ ] Commit `fix: require live family membership for parent access`.

### Task 5: Parent Invitation and Family Members Web Flows

**Files:**
- Modify: `frontend/web/src/App.js`
- Modify: `frontend/web/src/config/familyNavigation.js`
- Modify: `frontend/web/src/components/family/FamilyShell.js`
- Modify: `frontend/web/src/components/family/ParentRoute.js`
- Modify: `frontend/web/src/pages/Login.js`
- Modify: `frontend/web/src/pages/Register.js`
- Modify: `frontend/web/src/services/familyApi.js`
- Modify: `frontend/web/src/contexts/FamilyContext.js`
- Create: `frontend/web/src/services/invitationReturn.js`
- Create: `frontend/web/src/pages/family/FamilyMembersPage.js`
- Create: `frontend/web/src/pages/family/ParentInvitationPage.js`
- Modify: `frontend/web/src/family-shell.css`
- Create: `frontend/web/src/__tests__/family/Task12FamilyMembers.test.js`
- Create: `frontend/web/src/__tests__/family/Task12InvitationFlow.test.js`

**Interfaces:**
- API helpers implement create/get/revoke/preview/accept/leave/remove/transfer contracts.
- `invitationReturn` accepts only `/family/invitations` and preserves `location.hash` in Router state,
  never storage/query; successful accept uses replace navigation to `/app/family-members`.

- [ ] Write failing API/component tests for owner controls, member controls, two stable slots, safe token
  lifecycle, login/register fragment return, acceptance reload, transfer, removal, and leave confirmations.
- [ ] Run focused frontend tests and verify RED.
- [ ] Implement API helpers, route return utility, pages, navigation, dialogs, loading/empty/error states,
  accessible controls, and responsive CSS using existing components.
- [ ] Re-run focused tests, full frontend CI, and production build; verify GREEN.
- [ ] Commit `feat: add co-parent web management flows`.

### Task 6: Task 12 Integration, Browser, and Release Gate

**Files:**
- Create: `backend/tests/task12/jest.config.js`
- Create: `backend/tests/task12/coParentFlow.integration.test.js`
- Create: `tests/e2e/task12/co-parent.spec.js`
- Modify: `playwright.config.js`
- Modify: `package.json`
- Create: `scripts/release-family-task12-gate.sh`
- Create: `docs/development/family-growth-task12-gate.md`
- Modify: Task 12 design/test/traceability/index/README documents and `scripts/check-family-docs.js`.

**Interfaces:**
- `npm run test:task12` runs transaction-capable integration and Chromium acceptance with zero retries.
- `npm run release:family:task12` runs repair check, focused tests twice, family/legacy regression,
  frontend CI/build, Task 11, docs check, generated-artifact check, and clean-worktree check.

- [ ] Write the real-service integration flow and browser flow for invite, accept, shared child/task/media,
  transfer, removal, stale-token denial, fragment privacy, responsive layout, and console cleanliness.
- [ ] Add scripts/config and run focused tests; diagnose every RED as implementation or environment failure.
- [ ] Fix product defects exposed by the real flows, keeping regression tests for each.
- [ ] Run Task 12 focused integration twice and Chromium at desktop/360px with zero retries.
- [ ] Run full family and legacy regression, frontend CI/build, Task 11, docs and clean-worktree checks.
- [ ] Record exact commit-independent evidence in the Task 12 Gate, move requirements to `COVERED` only
  after executable evidence exists, and commit `test: close task12 co-parent release gate`.

### Task 7: Merge and Remote Main Verification

**Files:** Git history only after all gates pass.

**Interfaces:**
- Produces local `main == origin/main` at the verified Task 12 merge commit.

- [ ] Fetch origin and compare feature merge-base, local main, and origin/main; stop on unexpected divergence.
- [ ] Rebase or merge current origin/main into the feature branch without rewriting remote history; rerun release gate.
- [ ] Push feature branch and create/merge a PR when GitHub authentication permits, otherwise perform a
  non-fast-forward local merge only after explicit remote comparison.
- [ ] Run the release gate on merged main, push main without force, fetch again, and verify
  `git rev-parse main == git rev-parse origin/main`.
- [ ] Preserve or remove the worktree only after merge and remote equality are confirmed.

# Family Growth Task 10 Child Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved child PIN Web entry, child-only workflows, regression evidence, and Task 10 gate on remote `main`.

**Architecture:** Add a child credential vertical slice parallel to the accepted parent slice: validated child storage, a dedicated auth provider and API client, child route guard/shell, and focused pages. Protected child methods derive identity from session and expose only role-approved operations. Existing backend APIs remain unchanged.

**Tech Stack:** React 18, React Router 6, Axios, Testing Library/Jest, existing family public APIs, GitHub Actions.

---

### Task 1: Child Session Contract

**Files:**
- Modify: `frontend/web/src/services/familySession.js`
- Create: `frontend/web/src/__tests__/child/childSession.test.js`

- [x] **Step 1: Write failing storage-isolation tests**

Cover valid save/load, malformed session rejection, child-only clear, and expiry event. The key assertion is:

```js
saveChildSession({ token: 'child-token', child: childIdentity });
clearChildSession();
expect(localStorage.getItem(CHILD_SESSION_KEY)).toBeNull();
expect(localStorage.getItem(PARENT_SESSION_KEY)).toBe(parentSnapshot);
```

- [x] **Step 2: Verify red**

Run: `cd frontend/web && npm test -- --runInBand src/__tests__/child/childSession.test.js`

Expected: FAIL because child session functions and expiry event are not exported.

- [x] **Step 3: Implement validated child session functions**

Add `loadChildSession`, `saveChildSession`, `clearChildSession`, `expireChildSession`, and `CHILD_SESSION_EXPIRED_EVENT`. Validate token plus `childId`, `familyId`, and name. Never read or clear parent storage.

- [x] **Step 4: Verify green**

Run the Task 1 test command and existing `src/__tests__/family/familySession.test.js`.

Expected: both suites pass.

- [x] **Step 5: Commit**

```bash
git add frontend/web/src/services/familySession.js frontend/web/src/__tests__/child/childSession.test.js
git commit -m "feat: add isolated child session storage"
```

### Task 2: Child API and Resource State

**Files:**
- Create: `frontend/web/src/services/childApi.js`
- Create: `frontend/web/src/hooks/useChildDataResource.js`
- Create: `frontend/web/src/__tests__/child/childApi.test.js`
- Create: `frontend/web/src/__tests__/child/useChildDataResource.test.js`

- [x] **Step 1: Write failing API contract tests**

Assert public login payload, per-request child bearer token, session-derived profile/reminder child ID, no caller child ID on task/mistake/reward lists, mutation allowlists, abort forwarding, and protected `401` expiry.

```js
await completeOwnTask('task-a1', {
  actualMinutes: 0,
  difficulty: 'hard',
  needsHelp: true,
  childNote: '还需要练习',
  parentFeedback: 'must-not-send'
});
expect(axios.patch).toHaveBeenCalledWith(
  '/api/growth-tasks/task-a1/complete',
  { actualMinutes: 0, difficulty: 'hard', needsHelp: true, childNote: '还需要练习' },
  expect.any(Object)
);
```

- [x] **Step 2: Verify API red**

Run: `cd frontend/web && npm test -- --runInBand src/__tests__/child/childApi.test.js`

Expected: FAIL because `childApi.js` does not exist.

- [x] **Step 3: Implement child API**

Implement approved methods from design section 2.2. Build query strings from allowlisted values, unwrap the standard envelope, attach child authorization per request, and call `expireChildSession` only for protected `401` responses.

- [x] **Step 4: Write and verify resource-hook red**

Test loading, empty, ready, partial, stable error, retryable error, reload, and abort-on-unmount. Run the hook suite and confirm it fails before implementation.

- [x] **Step 5: Implement resource hook and verify green**

Use one `AbortController` per load and the same retry classification as the parent resource layer without depending on `FamilyContext`.

- [x] **Step 6: Commit**

```bash
git add frontend/web/src/services/childApi.js frontend/web/src/hooks/useChildDataResource.js frontend/web/src/__tests__/child
git commit -m "feat: add child API boundary"
```

### Task 3: Child Authentication and Route Isolation

**Files:**
- Create: `frontend/web/src/contexts/ChildAuthContext.js`
- Create: `frontend/web/src/components/child/ChildRoute.js`
- Create: `frontend/web/src/components/child/ChildShell.js`
- Create: `frontend/web/src/config/childNavigation.js`
- Modify: `frontend/web/src/App.js`
- Create: `frontend/web/src/__tests__/child/ChildNavigation.test.js`

- [x] **Step 1: Write failing route tests**

Cover unauthenticated redirect, refresh persistence, parent-only rejection from child routes, child-only rejection from parent routes, intended-destination return, four child navigation links, and child-only logout storage effects.

- [x] **Step 2: Verify red**

Run: `cd frontend/web && npm test -- --runInBand src/__tests__/child/ChildNavigation.test.js`

Expected: FAIL because child provider/routes do not exist.

- [x] **Step 3: Implement provider and guards**

`ChildAuthProvider` owns login, logout, stored session, public login errors, and expiry-event recovery. `ChildRoute` renders an `Outlet` only for an authenticated child. Move `FamilyProvider` into the parent route boundary so child pages never trigger parent-family reads.

- [x] **Step 4: Implement child shell**

Render only 今天、错题、成就、我的 and a child identity header. Use `NavLink` active state and an `Outlet`; do not reuse school navigation.

- [x] **Step 5: Verify green and parent regression**

Run ChildNavigation plus `FamilyNavigation.test.js` and `AuthContext.test.js`.

- [x] **Step 6: Commit**

```bash
git add frontend/web/src/App.js frontend/web/src/contexts/ChildAuthContext.js frontend/web/src/components/child frontend/web/src/config/childNavigation.js frontend/web/src/__tests__/child/ChildNavigation.test.js
git commit -m "feat: isolate child routes and authentication"
```

### Task 4: PIN Login

**Files:**
- Create: `frontend/web/src/pages/child/ChildPinLoginPage.js`
- Create: `frontend/web/src/__tests__/child/ChildLogin.test.js`

- [x] **Step 1: Write failing login tests**

Cover success redirect, numeric/length validation, generic `401`, rate-limited `429`, retryable errors, disabled submit, and PIN clearing after every server response.

- [x] **Step 2: Verify red**

Run the ChildLogin suite and confirm the login route lacks the approved form.

- [x] **Step 3: Implement login page**

Use visible labels, `inputMode="numeric"`, pattern `[0-9]{4,6}`, and `autoComplete="one-time-code"`. Preserve family/child IDs, never persist PIN, and replace navigation on success.

- [x] **Step 4: Verify green**

Run ChildLogin and ChildNavigation suites.

- [x] **Step 5: Commit**

```bash
git add frontend/web/src/pages/child/ChildPinLoginPage.js frontend/web/src/__tests__/child/ChildLogin.test.js frontend/web/src/App.js
git commit -m "feat: add child PIN login"
```

### Task 5: Today and Task Completion

**Files:**
- Create: `frontend/web/src/pages/child/ChildTodayPage.js`
- Create: `frontend/web/src/pages/child/ChildTaskPage.js`
- Create: `frontend/web/src/__tests__/child/ChildTodayTasks.test.js`

- [x] **Step 1: Write failing Today tests**

Cover five dimensions, task status copy, pending task links, reminder partial data, and independent stable/retryable failures.

- [x] **Step 2: Verify Today red, implement, and verify green**

Load tasks and reminders independently through `useChildDataResource`. Use server data only and preserve partial-source labels.

- [x] **Step 3: Write failing completion tests**

Cover approved fields, zero numeric values, measurable unit display, completed response replacement, in-flight disable, `409` reload, and terminal-state form suppression.

- [x] **Step 4: Verify completion red, implement, and verify green**

Convert only non-empty numeric strings; preserve zero. On `409`, reload and show `任务状态已变化，已重新加载。`.

- [ ] **Step 5: Commit**

```bash
git add frontend/web/src/pages/child/ChildTodayPage.js frontend/web/src/pages/child/ChildTaskPage.js frontend/web/src/__tests__/child/ChildTodayTasks.test.js
git commit -m "feat: add child task completion flow"
```

### Task 6: Mistake Review

**Files:**
- Create: `frontend/web/src/pages/child/ChildMistakesPage.js`
- Create: `frontend/web/src/__tests__/child/ChildMistakes.test.js`

- [ ] **Step 1: Write failing mistake tests**

Cover own non-mastered list, explanation preservation, still-learning patch, mastered patch/removal, stable failure, and absence of parent-only fields.

- [ ] **Step 2: Verify red**

Run the ChildMistakes suite.

- [ ] **Step 3: Implement review page**

Keep an explanation draft keyed by mistake ID. Replace rows from server responses; filter mastered results from the active list only after success.

- [ ] **Step 4: Verify green**

Run ChildMistakes and child API suites.

- [ ] **Step 5: Commit**

```bash
git add frontend/web/src/pages/child/ChildMistakesPage.js frontend/web/src/__tests__/child/ChildMistakes.test.js
git commit -m "feat: add child mistake review"
```

### Task 7: Achievements, Profile, and Logout

**Files:**
- Create: `frontend/web/src/pages/child/ChildAchievementsPage.js`
- Create: `frontend/web/src/pages/child/ChildProfilePage.js`
- Create: `frontend/web/src/__tests__/child/ChildAchievementsProfile.test.js`

- [ ] **Step 1: Write failing achievements/profile tests**

Cover rewards, ledger, star balance, confirmed tasks, independent failure rows, complete/sparse profile rendering, and logout isolation.

- [ ] **Step 2: Verify red**

Run the ChildAchievementsProfile suite.

- [ ] **Step 3: Implement achievements**

Load rewards and confirmed tasks independently. Render reward items without command buttons and ledger entries with signed amount semantics.

- [ ] **Step 4: Implement profile/logout**

Render only the returned child profile. Logout calls child context, replaces to `/child/login`, and leaves parent storage untouched.

- [ ] **Step 5: Verify green and commit**

```bash
git add frontend/web/src/pages/child/ChildAchievementsPage.js frontend/web/src/pages/child/ChildProfilePage.js frontend/web/src/__tests__/child/ChildAchievementsProfile.test.js
git commit -m "feat: add child achievements and profile"
```

### Task 8: Child Responsive UI

**Files:**
- Create: `frontend/web/src/child-shell.css`
- Modify: `frontend/web/src/App.js`
- Modify: child components/pages created in Tasks 3-7 only where accessibility evidence requires it

- [ ] **Step 1: Add stable child layout styles**

Use constrained content width, non-nested panels, dimension colors, 44px controls, desktop top navigation, and mobile bottom navigation. Add bottom content padding equal to mobile navigation height.

- [ ] **Step 2: Run production build**

Run: `cd frontend/web && npm run build`

Expected: compiled successfully with no new ESLint warnings.

- [ ] **Step 3: Browser verification**

Run the approved flow against a local deterministic API stub at desktop and 360px. Verify URL/title, meaningful DOM, no framework overlay, console health, target interactions, screenshot evidence, and `scrollWidth === clientWidth`.

- [ ] **Step 4: Commit**

```bash
git add frontend/web/src/child-shell.css frontend/web/src/App.js frontend/web/src/components/child frontend/web/src/pages/child
git commit -m "style: finish responsive child entry"
```

### Task 9: Documentation, Traceability, and Final Gate

**Files:**
- Modify: `docs/product/family-learning-tracker.md`
- Modify: `docs/development/family-growth-requirement-traceability.md`
- Modify: `frontend/README.md`
- Create: `docs/development/family-growth-task10-gate.md`

- [ ] **Step 1: Run all local gates**

```bash
cd frontend/web && npm run test:ci
cd frontend/web && npm run build
npm run test:family-regression
git diff --check
bash scripts/check-git-clean.sh
```

Expected: 0 failed suites/tests, successful build, clean generated-artifact check.

- [ ] **Step 2: Update requirements and traceability**

Set `FR-UI-002` to implemented only after every direct test and browser gate passes. Record exact files, `TC-T10-*` cases, commands, test counts, browser viewports, and residual Task 11 scope.

- [ ] **Step 3: Publish and merge the implementation**

Push `codex/task10-child-web-entry`, open a ready PR to `main`, wait for required CI, address review/CI findings with direct tests, merge with a merge commit, delete the branch, and verify remote `main` contains the implementation.

- [ ] **Step 4: Create and merge the final gate closure**

From the merged `main`, create a gate-closure branch and write `family-growth-task10-gate.md` with the actual implementation PR, CI run, merge commit, delivered behavior, security boundary, verification counts, browser evidence, and known non-blocking dependency warnings. Update product status, traceability, and `frontend/README.md` in the same closure change.

- [ ] **Step 5: Commit gate closure**

```bash
git add docs/product/family-learning-tracker.md docs/development/family-growth-requirement-traceability.md docs/development/family-growth-task10-gate.md frontend/README.md
git commit -m "docs: close Task 10 child web gate"
```

- [ ] **Step 6: Merge gate closure and audit remote main**

Open the gate-closure PR, wait for CI, merge it, delete the branch, and verify remote `main` contains both implementation and final gate evidence before closing Task 10.

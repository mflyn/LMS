# Family Growth Task 8 Parent Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the school-oriented Web shell with a tested parent family-growth shell that protects `/app/*`, initializes a family, and provides shared child context.

**Architecture:** The browser has one parent session storage key and a separate child-token namespace reserved for Task 10. `AuthContext` owns parent authentication; `FamilyContext` loads `/api/families/me`, derives setup readiness, and owns the selected child plus a child-scope version. The route table renders the family shell only after both contexts are ready, while all school URLs redirect into the protected family entry point.

**Tech Stack:** React 18, React Router 6, Ant Design 5, Axios 1, Create React App 5, Jest, React Testing Library.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `frontend/web/src/services/familySession.js` | Versioned parent/child storage keys and safe parent-session persistence. |
| `frontend/web/src/services/familyApi.js` | Public API wrappers and parent-token authorization. |
| `frontend/web/src/services/childScope.js` | Child-scoped state reset registry used before a child switch is committed. |
| `frontend/web/src/contexts/AuthContext.js` | Parent-only login, registration, restoration, and logout. |
| `frontend/web/src/contexts/FamilyContext.js` | Family readiness, selected child, retry, and child-scope invalidation. |
| `frontend/web/src/config/familyNavigation.js` | The only permitted parent navigation labels and route metadata. |
| `frontend/web/src/components/family/*` | Header, responsive navigation, guards, child selector, and route-state UI. |
| `frontend/web/src/pages/family/*` | Setup, today, and explicit Task 9 placeholder pages. |
| `frontend/web/src/App.js` | Router composition only; no business state. |
| `frontend/web/src/__tests__/family/*` | Current Task 8 unit/integration tests. |

### Task 1: Restore a Deterministic Frontend Test Entry Point

**Files:**
- Modify: `frontend/web/package.json`
- Modify: `frontend/web/package-lock.json`
- Create: `frontend/web/src/setupTests.js`
- Create: `frontend/web/src/__tests__/smoke.test.js`
- Move: legacy school tests to `frontend/web/src/__tests__/legacy/`

- [ ] **Step 1: Reproduce the clean-install failure**

Run: `cd frontend/web && npm ci`

Expected: FAIL because the React 19 / TypeScript 5 type graph is not represented by the lock file.

- [ ] **Step 2: Align CRA 5-compatible type dependencies and regenerate the lock file**

Keep React and Axios runtime dependencies unchanged. Change only the incompatible development type ranges:

```json
"@types/node": "^18.19.115",
"@types/react": "^18.3.23",
"@types/react-dom": "^18.3.7",
"typescript": "^4.9.5"
```

Run: `npm install --package-lock-only`

- [ ] **Step 3: Isolate obsolete school tests and add a current smoke test**

Move the 15 school-era `*.test.*` files and old `setup.js` under
`src/__tests__/legacy/`. Add `test:ci` with
`--watchAll=false --testPathIgnorePatterns=src/__tests__/legacy`; make `test`
delegate to it and add `test:legacy` as the explicit legacy path. `setupTests.js`
must load `@testing-library/jest-dom`, `matchMedia`, `ResizeObserver`, and
`scrollTo` shims. The smoke test must render the `/login` route and assert its
parent-login heading and submit button.

- [ ] **Step 4: Verify the new test entry point**

Run: `cd frontend/web && npm ci && npm test`

Expected: PASS with the smoke suite; no legacy test is discovered.

- [ ] **Step 5: Commit the test baseline**

```bash
git add frontend/web/package.json frontend/web/package-lock.json frontend/web/src .github/workflows/ci-cd.yml
git commit -m "test: establish frontend family smoke baseline"
```

### Task 2: Parent Session and API Contracts

**Files:**
- Create: `frontend/web/src/services/familySession.js`
- Create: `frontend/web/src/services/familyApi.js`
- Modify: `frontend/web/src/contexts/AuthContext.js`
- Create: `frontend/web/src/__tests__/family/familySession.test.js`
- Create: `frontend/web/src/__tests__/family/AuthContext.test.js`

- [ ] **Step 1: Write failing parent-session and authentication tests**

Test that a valid parent response persists only the parent session key; a
student/child response cannot authenticate the parent app; logout clears it;
and legacy `token` does not restore a session.

```js
expect(loadParentSession()).toBeNull();
await user.click(screen.getByRole('button', { name: '登录' }));
expect(localStorage.getItem(PARENT_SESSION_KEY)).toContain('parent-token');
```

- [ ] **Step 2: Run the focused tests to verify RED**

Run: `cd frontend/web && npm test -- --runInBand familySession AuthContext`

Expected: FAIL because the family session API and parent-only auth behavior do not exist.

- [ ] **Step 3: Implement the minimal session and auth boundary**

`familySession.js` exports `PARENT_SESSION_KEY`, `CHILD_SESSION_KEY`,
`loadParentSession`, `saveParentSession`, and `clearParentSession`.
`AuthContext` accepts only `user.role === 'parent'`, persists only a sanitized
`{ token, user }` object, calls `POST /api/auth/login` and
`POST /api/auth/register`, and exposes `{ status, user, token, login,
register, logout }`. Do not use Axios global default headers.

- [ ] **Step 4: Verify GREEN**

Run: `cd frontend/web && npm test -- --runInBand familySession AuthContext`

Expected: PASS.

- [ ] **Step 5: Commit the session boundary**

```bash
git add frontend/web/src/services/familySession.js frontend/web/src/services/familyApi.js frontend/web/src/contexts/AuthContext.js frontend/web/src/__tests__/family
git commit -m "feat: add parent session boundary"
```

### Task 3: Family Context, Setup Gate, and Child Switching

**Files:**
- Create: `frontend/web/src/contexts/FamilyContext.js`
- Create: `frontend/web/src/__tests__/family/FamilyContext.test.js`

- [ ] **Step 1: Write failing family-state tests**

Cover a ready family, `404 RESOURCE_NOT_FOUND` becoming `needs_family`, a
retryable error becoming `error`, and a child switch incrementing the
child-scope version before the new child is exposed.

```js
expect(await screen.findByText('小明')).toBeInTheDocument();
await user.selectOptions(screen.getByLabelText('当前孩子'), 'child-a2');
expect(screen.getByText('小红')).toBeInTheDocument();
expect(scopeVersion).toBeGreaterThan(initialScopeVersion);
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `cd frontend/web && npm test -- --runInBand FamilyContext`

Expected: FAIL because no family provider exists.

- [ ] **Step 3: Implement the explicit family state machine**

`FamilyContext` must use only `unknown`, `needs_family`, `ready`, and `error`.
It calls `getMyFamily` after parent authentication, selects the documented
default child or first child, calls `resetChildScope({ previousChildId,
nextChildId })` before committing a new child selection, and increments
`childScopeVersion` so Task 9 queries can key or clear child-scoped data. Task
9 data holders must register their cache-reset behavior through
`registerChildScopeReset`. A `401` delegates to parent logout; only a 404 with
`RESOURCE_NOT_FOUND` means setup is needed.

- [ ] **Step 4: Verify GREEN**

Run: `cd frontend/web && npm test -- --runInBand FamilyContext`

Expected: PASS.

- [ ] **Step 5: Commit family state**

```bash
git add frontend/web/src/contexts/FamilyContext.js frontend/web/src/__tests__/family/FamilyContext.test.js
git commit -m "feat: add family context and child selection"
```

### Task 4: Route Guards, Family Navigation, and Placeholder Pages

**Files:**
- Create: `frontend/web/src/config/familyNavigation.js`
- Create: `frontend/web/src/components/family/ParentRoute.js`
- Create: `frontend/web/src/components/family/FamilyShell.js`
- Create: `frontend/web/src/components/family/ChildSelector.js`
- Create: `frontend/web/src/pages/family/FamilySetupPage.js`
- Create: `frontend/web/src/pages/family/TodayPage.js`
- Create: `frontend/web/src/pages/family/FamilyPlaceholderPage.js`
- Modify: `frontend/web/src/App.js`
- Modify: `frontend/web/src/pages/Login.js`
- Modify: `frontend/web/src/pages/Register.js`
- Create: `frontend/web/src/__tests__/family/FamilyNavigation.test.js`

- [ ] **Step 1: Write failing route and menu tests**

Assert unauthenticated `/app/today` redirects to `/login`, no-family parents
reach `/family/setup`, `/app` redirects to `/app/today`, all seven Task 8 data
routes render their expected labels, and every school route redirects to the
family entry. Assert the exact allowed navigation labels and absence of school
labels.

```js
expect(await screen.findByRole('heading', { name: '家长登录' })).toBeInTheDocument();
expect(screen.queryByText('班级管理')).not.toBeInTheDocument();
expect(screen.getByRole('link', { name: '今日' })).toHaveAttribute('href', '/app/today');
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `cd frontend/web && npm test -- --runInBand FamilyNavigation`

Expected: FAIL because the legacy route table and menu remain active.

- [ ] **Step 3: Implement the family-only route table**

Use `PARENT_NAV_ITEMS` for 今日、任务、记录、错题、周报、提醒、星星与奖励.
`ParentRoute` blocks rendering until auth restoration completes. `FamilyShell`
blocks content while family state is `unknown`, redirects `needs_family` to
setup, displays a retryable error state, and renders a labelled child selector
when ready. `FamilySetupPage` posts `familyName` plus `Asia/Shanghai` and then
reloads the family context. Login and register show parent-only forms; success
navigates to `/app/today`, which naturally reaches setup when needed.

- [ ] **Step 4: Verify GREEN**

Run: `cd frontend/web && npm test -- --runInBand FamilyNavigation`

Expected: PASS.

- [ ] **Step 5: Commit the application shell**

```bash
git add frontend/web/src/App.js frontend/web/src/config/familyNavigation.js frontend/web/src/components/family frontend/web/src/pages/family frontend/web/src/pages/Login.js frontend/web/src/pages/Register.js frontend/web/src/__tests__/family/FamilyNavigation.test.js
git commit -m "feat: add family parent web shell"
```

### Task 5: Responsive Accessibility, CI, and Final Gate

**Files:**
- Create: `frontend/web/src/family-shell.css`
- Modify: `frontend/web/src/App.js`
- Modify: `.github/workflows/ci-cd.yml`
- Create: `docs/development/family-growth-task8-gate.md`

- [ ] **Step 1: Write failing keyboard and mobile-navigation tests**

At the compact breakpoint the navigation trigger must be a labelled button;
the child selector must be a labelled native/selectable control; every route
label must remain keyboard reachable.

- [ ] **Step 2: Run the focused test to verify RED**

Run: `cd frontend/web && npm test -- --runInBand FamilyNavigation`

Expected: FAIL until the responsive shell exposes labelled controls.

- [ ] **Step 3: Implement focused responsive styles**

Use a fixed desktop side navigation and a compact mobile navigation trigger at
`max-width: 767px`. Ensure a 360px viewport has no horizontal scrolling,
controls retain accessible names, and status pages use text rather than color
alone. Keep page placeholders constrained to task scope; do not implement Task
9 data workflows.

- [ ] **Step 4: Run automated and browser verification**

Run:

```bash
cd frontend/web && npm test -- --watchAll=false
cd frontend/web && npm run build
npm run test:family-regression
git diff --check
```

Start the frontend and inspect `/login`, `/family/setup`, and `/app/today` at
360px and desktop. Record screenshots and result counts in the Task 8 gate
record. The CI workflow must run `cd frontend/web && npm ci && npm run test:ci`.

- [ ] **Step 5: Commit gate evidence and open the PR**

```bash
git add frontend/web .github/workflows/ci-cd.yml docs/development/family-growth-task8-gate.md docs/development/family-growth-task8-test-cases.md docs/superpowers
git commit -m "test: close task8 parent shell gate"
git push -u origin codex/task8-parent-web-shell
gh pr create --base main --head codex/task8-parent-web-shell --title "feat: add family parent web shell" --body-file .github/PULL_REQUEST_TEMPLATE.md
```

## Plan Self-Review

- `FR-UI-001` maps to Tasks 2-5 and `TC-T8-*` cases.
- The design's protected routes, setup redirect, child state, legacy isolation,
  responsive support, and keyboard access each have a named implementation and
  verification step.
- Task 9-11 workflows are deliberately not implemented; their API wrappers do
  not become a substitute for page behavior.
- No step depends on the old generic token, role menus, or uncontracted profile
  endpoint.

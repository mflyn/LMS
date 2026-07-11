# Task 10 Child Web Test Design and Cases

**Document status:** APPROVED DESIGN / IMPLEMENTATION BASELINE
**Date:** 2026-07-11
**Design:** `docs/superpowers/specs/2026-07-11-family-growth-task10-child-web-design.md`
**Scope:** `FR-UI-002` child Web entry; Task 11 cross-role E2E is excluded.

## Test Principles

- Frontend integration tests mock only public gateway envelopes, not internal service headers.
- Protected child methods derive `childId` from the validated child session; test callers cannot inject a sibling ID.
- Every behavior-changing test is introduced red-first and run in isolation before implementation.
- Authentication tests assert both rendered behavior and storage effects.
- Error tests distinguish stable `4xx`, retryable failures, and session-ending `401` responses.
- Browser evidence covers the same primary flow at desktop and 360px; unit tests remain authoritative for negative API permutations.

## Session and API Boundary

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T10-SESSION-001` | Save then reload a valid child session. | Token and child identity round-trip under `CHILD_SESSION_KEY`; parent storage is unchanged. | `childSession.test.js` |
| `TC-T10-SESSION-002` | Load malformed JSON, missing token, missing child/family ID, or non-object child. | Load returns null and removes only invalid child storage. | `childSession.test.js` |
| `TC-T10-SESSION-003` | Logout child while a parent session exists. | Child storage clears; parent storage remains byte-for-byte unchanged. | `childSession.test.js`, `ChildNavigation.test.js` |
| `TC-T10-SESSION-004` | Protected API returns `401` or `STALE_CHILD_TOKEN`. | Child storage clears, one expiry event fires, and UI returns to PIN login with recoverable copy. | `childApi.test.js`, `ChildNavigation.test.js` |
| `TC-T10-API-001` | Call a protected child method. | Request sends the child bearer token per call and never changes Axios defaults. | `childApi.test.js` |
| `TC-T10-API-002` | List tasks, mistakes, rewards, reminders, and profile. | Required child ID comes from session; caller API exposes no sibling identifier argument. | `childApi.test.js` |
| `TC-T10-API-003` | Complete a task with approved and unsupported fields. | Only actual minutes/amount, difficulty, help, and child note reach the PATCH body. | `childApi.test.js` |
| `TC-T10-API-004` | Review a mistake with approved and unsupported fields. | Only child explanation, reviewed, and mastered reach the PATCH body. | `childApi.test.js` |
| `TC-T10-API-005` | Abort a protected list request. | Abort signal is forwarded and does not expire the child session. | `childApi.test.js`, `useChildDataResource.test.js` |
| `TC-T10-API-006` | Public PIN login returns `401`. | No child-expiry event is emitted; login error remains local to the form. | `childApi.test.js`, `ChildLogin.test.js` |

## Login and Route Isolation

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T10-LOGIN-001` | Submit valid family ID, child ID, and 4-to-6 digit PIN. | Session saves returned token/child; PIN is not stored; route replaces to `/child/today`. | `ChildLogin.test.js` |
| `TC-T10-LOGIN-002` | Submit server `401 INVALID_CHILD_CREDENTIALS`. | UI shows one generic message without identifying family, child, or PIN failure. | `ChildLogin.test.js` |
| `TC-T10-LOGIN-003` | Submit server `429 PIN_LOGIN_RATE_LIMITED`. | UI shows wait-and-retry copy; identifiers remain editable and PIN clears. | `ChildLogin.test.js` |
| `TC-T10-LOGIN-004` | Submit non-numeric or wrong-length PIN. | Browser validation prevents API call and names the PIN requirement. | `ChildLogin.test.js`, browser QA |
| `TC-T10-ROUTE-001` | Open protected child route without child session. | Redirects to `/child/login`, preserving intended child destination. | `ChildNavigation.test.js` |
| `TC-T10-ROUTE-002` | Refresh a child route with valid stored session. | Child route renders without a new login. | `ChildNavigation.test.js` |
| `TC-T10-ROUTE-003` | Store only a parent session and open child route. | Redirects to child login. | `ChildNavigation.test.js` |
| `TC-T10-ROUTE-004` | Store only a child session and open `/app/today`. | Existing parent guard redirects to parent login; child token is not accepted. | `ChildNavigation.test.js` |
| `TC-T10-ROUTE-005` | Navigate child shell. | Only 今天、错题、成就、我的 appear; no parent or school controls render. | `ChildNavigation.test.js`, browser QA |

## Child Workflows

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T10-TODAY-001` | Load own today tasks across all five dimensions. | Titles, dimension labels, and server statuses render; pending tasks link to completion. | `ChildTodayTasks.test.js` |
| `TC-T10-TODAY-002` | Reminders return `meta.partial`. | Available reminders remain visible and only returned unavailable sources are named. | `ChildTodayTasks.test.js` |
| `TC-T10-TODAY-003` | Tasks fail stably while reminders fail retryably. | Named independent errors render; only retryable source exposes retry. | `ChildTodayTasks.test.js` |
| `TC-T10-TASK-001` | Complete task with zero minutes, measurable amount, difficulty, help, and reflection. | Payload preserves numeric zero, sends approved fields, and renders server-returned completed state. | `ChildTodayTasks.test.js` |
| `TC-T10-TASK-002` | Complete task after server state changes. | `409` reloads task; stale local completion is not shown as successful. | `ChildTodayTasks.test.js` |
| `TC-T10-TASK-003` | Open cancelled, archived, confirmed, or sibling-inaccessible task. | No completion form is exposed; stable state/error is shown. | `ChildTodayTasks.test.js` |
| `TC-T10-MISTAKE-001` | Mark mistake `我还不会` with explanation. | PATCH sends reviewed true/mastered false and keeps server-returned row active. | `ChildMistakes.test.js` |
| `TC-T10-MISTAKE-002` | Mark mistake `我已经会了`. | PATCH sends reviewed/mastered true and removes mastered row from active list. | `ChildMistakes.test.js` |
| `TC-T10-MISTAKE-003` | Mistake update fails. | Explanation remains editable; retry does not send parent-only fields. | `ChildMistakes.test.js` |
| `TC-T10-ACHIEVE-001` | Load rewards, ledger, balance, and confirmed tasks. | All own achievement sections render; reward actions are read-only. | `ChildAchievementsProfile.test.js` |
| `TC-T10-ACHIEVE-002` | Rewards fail while confirmed tasks load. | Confirmed tasks remain visible with a named rewards error. | `ChildAchievementsProfile.test.js` |
| `TC-T10-PROFILE-001` | Load own complete or sparse profile. | Available five-development preferences render; missing optional groups use empty copy. | `ChildAchievementsProfile.test.js` |
| `TC-T10-PROFILE-002` | Activate logout. | Child session clears, parent session remains, and history replaces to child login. | `ChildAchievementsProfile.test.js`, browser QA |

## Browser and Gate

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T10-UX-001` | Run login -> today -> task completion -> mistakes -> achievements -> profile/logout at desktop. | Primary controls and state transitions work with zero relevant console errors. | Browser QA and Task 10 gate |
| `TC-T10-UX-002` | Repeat route inspection and core controls at 360px. | No horizontal overflow, overlap, clipped text, or navigation-covered content. | Browser QA and Task 10 gate |
| `TC-T10-A11Y-001` | Complete login and workflow with keyboard-addressable controls. | Labels, headings, focus targets, live status, and buttons have stable accessible names. | Frontend tests and browser DOM inspection |
| `TC-T10-REG-001` | Run frontend, build, family regression, and diff checks. | Commands exit zero; no generated browser artifacts are tracked. | Task 10 gate and CI |

## Traceability

| Requirement | Cases |
| --- | --- |
| `FR-UI-002` | All `TC-T10-*` cases |
| `FR-CHILD-002` | `SESSION-001` to `004`, `API-001` to `002`, `ROUTE-001` to `005`, `PROFILE-001` |
| `FR-CHILD-004` | `LOGIN-001` to `004`, `API-006` |
| `FR-CHILD-005` | `SESSION-004`, `ROUTE-001` |
| `FR-TASK-003` / `FR-TASK-004` | `TODAY-001` to `003`, `TASK-001` to `003` |
| `FR-MISTAKE-001` | `MISTAKE-001` to `003` |
| `FR-REWARD-001` / `FR-REWARD-002` | `ACHIEVE-001` to `002` |
| `FR-NOTIFY-001` | `TODAY-002` to `003` |
| `NFR-SEC-001` | `SESSION-001` to `004`, `API-001` to `006`, `ROUTE-001` to `005` |

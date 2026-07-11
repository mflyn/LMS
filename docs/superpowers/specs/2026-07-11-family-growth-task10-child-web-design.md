# Family Growth Task 10 Child Web Design

**Document status:** APPROVED / IMPLEMENTATION BASELINE
**Date:** 2026-07-11
**Scope:** Task 10 child PIN entry and child-only Web workflows
**Requirements:** `FR-UI-002`, `FR-CHILD-002`, `FR-CHILD-004`, `FR-CHILD-005`, `FR-TASK-003`, `FR-TASK-004`, `FR-MISTAKE-001`, `FR-REWARD-001`, `FR-REWARD-002`, `FR-NOTIFY-001`, `NFR-SEC-001`
**Predecessor:** Task 9 parent workflows merged at `01d9810e3883222dadff8acdff0e97dff72d6108`

## 1. Objective and Boundary

Task 10 adds a child-specific Web entry over the existing family APIs. A child can authenticate with family ID, child ID, and a 4-to-6 digit PIN; view only their own tasks, reminders, mistakes, achievements, rewards, and profile; complete an eligible task; update allowed mistake-review fields; and end the child session.

Task 10 does not change backend authorization, add public family or sibling discovery, add parent task management, add reward redemption, persist a new mood model, or automate the full parent-to-child Task 11 flow. It does not reuse the school student dashboard.

## 2. Architecture

### 2.1 Separate Child Session Boundary

The child experience uses a dedicated `ChildAuthProvider` backed only by `CHILD_SESSION_KEY`. The persisted value contains:

```json
{
  "token": "child-scoped-jwt",
  "child": {
    "childId": "child_001",
    "familyId": "family_001",
    "name": "小明"
  }
}
```

Session loading rejects missing tokens, missing child/family identifiers, or malformed objects and removes invalid storage. The child provider does not read, write, or clear the parent session. Child logout clears only child storage. Parent authentication remains owned by `AuthProvider`.

Protected child API responses with HTTP `401`, including `STALE_CHILD_TOKEN`, clear child storage and dispatch one child-session-expired event. `ChildAuthProvider` converts the event into the recoverable login message `会话已过期，请重新登录。`. A failed public PIN login does not emit the expiry event.

### 2.2 Child API Boundary

`childApi.js` is the only authenticated API client used by child pages. It reads the child token for every request and never writes Axios global defaults. Except for public PIN login, methods do not accept `familyId` or `childId` from page callers. The client derives any required child identifier from the validated child session, preventing UI code from querying a sibling.

Approved methods are:

| Method | HTTP contract | Caller-controlled fields |
| --- | --- | --- |
| `childPinLogin` | `POST /api/auth/child-pin-login` | `familyId`, `childId`, `pin` |
| `getOwnProfile` | `GET /api/children/:sessionChildId` | none |
| `listOwnTasks` | `GET /api/growth-tasks` | `scope`, `status`, `dimension`, pagination |
| `getOwnTask` | `GET /api/growth-tasks/:taskId` | `taskId` |
| `completeOwnTask` | `PATCH /api/growth-tasks/:taskId/complete` | `actualMinutes`, `actualAmount`, `difficulty`, `needsHelp`, `childNote` |
| `listOwnMistakes` | `GET /api/mistakes` | approved filters and pagination |
| `reviewOwnMistake` | `PATCH /api/mistakes/:mistakeId` | `childExplanation`, `reviewed`, `mastered` |
| `listOwnRewards` | `GET /api/rewards` | status and pagination only |
| `listOwnReminders` | `GET /api/notifications/family?childId=:sessionChildId` | optional LocalDate |

The client strips unsupported mutation fields before sending. Child pages cannot create or confirm tasks, edit plans, create or redeem rewards, update reminder settings, modify parent mistake fields, or list children.

### 2.3 Resource State

A small child resource hook owns abortable reads and returns `loading`, `empty`, `ready`, `partial`, `error`, or `retryable_error`. Network failures, `408`, `429`, and `5xx` are retryable. Stable non-authentication `4xx` errors remain visible without retry. Abort responses are ignored. Child logout or expiry unmounts protected routes, which aborts active reads.

### 2.4 Route Isolation

`App` mounts child routes under `ChildAuthProvider` without placing them inside `FamilyProvider` or the parent shell.

| Route | Authentication | Purpose |
| --- | --- | --- |
| `/child/login` | public | PIN login and recoverable credential/session errors |
| `/child` | child | redirect to `/child/today` |
| `/child/today` | child | today tasks and reminders |
| `/child/tasks/:taskId` | child | task details and completion feedback |
| `/child/mistakes` | child | own mistake review |
| `/child/achievements` | child | star balance, ledger, rewards, and confirmed tasks |
| `/child/me` | child | own profile and logout |

`ChildRoute` accepts only a validated child session. A parent session alone redirects to `/child/login`. Existing `ParentRoute` continues to accept only a parent session, so a child-only browser cannot enter `/app/*`. The two stores may coexist, but each route and API family uses only its own credential.

## 3. Page Design

### 3.1 PIN Login

The login form uses labeled family ID, child ID, and numeric PIN controls. It does not enumerate families or children because no privacy-safe public discovery API exists. PIN is constrained to 4-to-6 numeric characters in the browser but server responses remain authoritative.

`401 INVALID_CHILD_CREDENTIALS` always renders `家庭、孩子或 PIN 不正确。` without identifying which value failed. `429 PIN_LOGIN_RATE_LIMITED` renders `尝试次数过多，请稍后再试。`. Other retryable failures preserve all identifiers except the PIN and allow resubmission. Successful login stores only the returned token and child view, then replaces history with `/child/today`.

### 3.2 Child Shell

The child shell is visually distinct from the parent operational shell but reuses existing colors, spacing, buttons, and data-state components. It has four navigation destinations: 今天、错题、成就、我的. Desktop uses a compact top navigation; 360px uses a stable bottom navigation with fixed icon/text targets. No school, family administration, or parent controls appear.

### 3.3 Today

Today loads `scope=today` tasks and own reminders in parallel. It renders all five growth dimensions, preserves reminder partial-source labels, and never treats a failed source as zero. Pending tasks link to task completion. Completed tasks show `等待家长确认`; confirmed tasks show `已获得星星`; cancelled or archived tasks do not expose completion controls.

### 3.4 Task Completion

The task page loads the selected task using its opaque task ID. It shows plan details and accepts actual minutes, actual amount, difficulty (`easy|normal|hard`), needs-help, and one-sentence child reflection. Empty numeric fields are omitted, zero remains valid, and unsupported fields are never sent. Successful completion replaces the task with the server response and shows a return action. `409` reloads the task and explains that its state changed.

### 3.5 Mistake Review

The mistake page lists the child's non-mastered academic mistakes. Each row accepts an optional child explanation and two explicit commands:

- `我还不会`: `{ reviewed: true, mastered: false, childExplanation? }`
- `我已经会了`: `{ reviewed: true, mastered: true, childExplanation? }`

The server-returned mistake replaces the local row. Mastered rows leave the active review list. The page does not modify correct answers, parent notes, reasons, knowledge points, or question media.

### 3.6 Achievements

Achievements loads rewards/ledger and confirmed tasks independently. It displays star balance, available family rewards, immutable earn/spend history, and confirmed task titles. Rewards are read-only; redemption remains a parent action. A failure in one source leaves the other source visible with a named error state.

### 3.7 My Profile

The profile page loads only `/api/children/:sessionChildId` and displays name, grade, interests, weak subjects, sports preferences, art interests, labor habits, and moral goals when present. Missing optional profile values use concise empty copy. Logout clears the child session and replaces history with `/child/login`.

## 4. Security and Privacy

- Child identifiers used by protected calls come only from the validated session.
- Child API requests attach only the child token and never fall back to the parent token.
- Parent feedback, child reflection, PIN, token, and signed media URLs are never logged.
- PIN is never persisted, retained after submission, placed in URLs, or included in error copy.
- A child-only session cannot render parent routes; a parent-only session cannot render protected child routes.
- A `401` from any protected child endpoint invalidates the entire child session before redirect.
- Child pages expose no family ID editor after authentication and no sibling selector.

## 5. Accessibility and Responsive Behavior

All forms have visible labels and named controls. Status changes use text and live regions, not color alone. Keyboard users can log in, navigate, open a task, submit completion, review mistakes, and log out. Focus enters the routed page heading after navigation where practical. Controls maintain at least 44px touch height on child pages. At 360px there is no horizontal page overflow, fixed navigation does not cover content, and the longest Chinese labels wrap without clipping.

## 6. Test Strategy

| Area | Required evidence |
| --- | --- |
| Session | malformed storage rejected; child save/load/logout isolated from parent storage; expiry event clears child only |
| API | child bearer header, session-derived child ID, mutation allowlist, abort signal, no global header, protected `401` expiry |
| Login | success, generic `401`, rate-limited `429`, retryable failure, PIN not retained |
| Routes | unauthenticated redirect, refresh persistence, child-only rejection from parent route, parent-only rejection from child route |
| Today | five-dimension own tasks, reminders, partial and retryable states, no sibling query |
| Completion | numeric zero, amount/unit display, difficulty/help/reflection payload, `409` reload |
| Mistakes | still-learning and mastered patches, explanation, mastered row removal, forbidden fields absent |
| Achievements | star balance, ledger, rewards, confirmed tasks, independent source failures |
| Profile/logout | own profile only, optional empty copy, child-only storage clear and login redirect |
| Browser | desktop and 360px login, task completion, mistake review, achievements, profile/logout, no console errors |
| Regression | complete frontend suite, production build, family regression, Git clean check, remote CI |

Task 11 remains responsible for a backend-backed cross-role browser flow. Task 10 tests use mocked public API envelopes plus existing backend authorization suites as contract evidence.

## 7. Acceptance Gate

Task 10 is complete only when:

1. Every route in section 2.4 is implemented and keyboard reachable.
2. Child pages use only `childApi.js` and child session credentials.
3. Today, task completion, mistake review, achievements, profile, token expiry, and logout have direct automated tests.
4. Route tests prove parent/child credential isolation and refresh behavior.
5. Desktop and 360px browser flows pass with no relevant console errors, overlap, or horizontal overflow.
6. `npm run test:ci`, `npm run build`, `npm run test:family-regression`, and `git diff --check` exit zero.
7. `FR-UI-002` traceability points to implementation, tests, browser evidence, CI, PR, and merge commit.
8. The implementation PR is merged into remote `main` and its feature branch is deleted.

## 8. Non-Goals

- Public family/child lookup or QR pairing.
- Child profile editing, avatar upload, or PIN reset.
- Reward creation or redemption by a child.
- Parent task planning or confirmation in child routes.
- New mood, diary, chat, or notification persistence.
- Task 11 cross-role E2E automation.
- School student dashboard restoration.

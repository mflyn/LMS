# Task 9 Parent MVP Pages Gate

**Gate status:** PASSED
**Closed at:** 2026-07-11
**Scope:** `FR-UI-001` Task 9 parent workflows at `/app/today`, `/app/tasks`, `/app/logs`, `/app/mistakes`, `/app/reports`, `/app/reminders`, and `/app/rewards`.
**Pull request:** [#8](https://github.com/mflyn/LMS/pull/8)
**Merge commit:** `1923caa11ed8b4b6328a91c1cb7adb181bc5f9ad`
**CI run:** [29144249888](https://github.com/mflyn/LMS/actions/runs/29144249888)

## Delivered Baseline

- All seven parent routes use selected-child public APIs instead of Task 8 placeholders.
- Read requests abort and clear on child switch; late mutation responses are discarded by child ID and scope version.
- Pages distinguish loading, empty, partial, stable error, and retryable error states.
- Tasks and growth logs support all five development dimensions. Mistakes remain academic-only.
- Weekly reports use server `statistics`, including `dimensionTaskStats.*.planned`; reminder settings use nested `quietHours.start/end`.
- Private media stores IDs, reads signed URLs, and soft-deletes unbound form drafts.
- Task attachments preserve the complete backend media-ID array and support multi-file upload plus item-level access/removal.
- Reward redemption reuses one idempotency key across retries.
- Dialogs trap keyboard focus, close with Escape, hide background content from assistive technology, and restore opener focus.

## Review Remediation

Independent review initially found two P1 and five P2 findings. The gate closed them with mutation scope guards, deployed weekly-report field alignment, mutation controls during list loading, private-media draft lifecycle management, stable/retryable error classification, a shared accessible dialog, and direct regression cases. A second automated review attempt was unavailable because the external reviewer quota was exhausted; final verification therefore relied on targeted remediation tests, full frontend and backend regressions, production build, browser inspection, and CI.

A post-gate review raised two additional observations. The reported Today-page infinite-loading path was not reproducible because loading requires every source to be loading, but the review exposed a real mixed-failure recovery gap. The page now renders every failed source independently and retries only retryable sources. The single-file task attachment control also disagreed with the backend array contract, so it was replaced with a multi-file collection control rather than deferred to Task 11.

## Verification Evidence

| Gate | Result |
| --- | --- |
| Frontend integration | `npm run test:ci`: 12 suites, 68 tests passed; Today mixed-failure and task multi-attachment remediation included |
| Production build | `npm run build`: compiled successfully |
| Task confirmation smoke | `growthTasks.test.js`: 25 tests passed, including `TC-T5-SAGA-001` |
| Family regression | 52 suites, 652 tests passed across six Jest projects |
| Browser workflows | Task, growth-log, and mistake creation; report, reminder, and reward reads passed |
| Browser responsive | All seven routes at 1280px and 360px: `scrollWidth == clientWidth` |
| Browser console | Zero errors and zero warnings during final route inspection |
| Git hygiene | `git diff --check` passed; generated browser artifacts excluded |
| Remote CI | `Family Regression` job passed, including `Frontend Smoke`; controlled release jobs skipped as designed |

## Acceptance Decision

Task 9 is accepted and merged. Task 10 child PIN entry and child-only routes, plus Task 11 cross-role E2E, remain outside this gate.

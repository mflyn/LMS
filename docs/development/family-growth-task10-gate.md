# Task 10 Child Web Entry Gate

**Gate status:** PASSED
**Closed at:** 2026-07-11
**Scope:** `FR-UI-002` child Web entry at `/child/login`, `/child/today`,
`/child/tasks/:taskId`, `/child/mistakes`, `/child/achievements`, and `/child/me`.
**Pull request:** [#11](https://github.com/mflyn/LMS/pull/11)
**Merge commit:** `6f62934b5d2237fa3ce734d5800defe856102ff7`
**Passing CI run:** [29155432245](https://github.com/mflyn/LMS/actions/runs/29155432245)

## Delivered Baseline

- Child storage, authentication context, route guard, API client, and expiry handling
  are isolated from the parent session and parent family provider.
- PIN login handles browser validation, generic invalid-credential responses, rate
  limiting, successful replace-navigation, stale tokens, and explicit logout.
- Protected child API methods derive the effective child ID from the validated child
  session, attach a per-request child bearer token, allowlist mutation fields, forward
  abort signals, and never alter global Axios authorization defaults.
- The child shell exposes only Today, Mistakes, Achievements, and Profile navigation.
  Parent and school actions are absent and parent routes do not accept child sessions.
- Today supports all five development dimensions and independent stable/retryable
  source errors. Task completion records approved child feedback and handles stale
  state conflicts. Mistake review supports not-mastered and mastered outcomes.
- Achievements and rewards are read-only for the child. Profile renders the approved
  development preferences and logout clears only the child session.
- Desktop navigation and a four-item mobile bottom bar are responsive from 360px;
  controls retain accessible names, focus styling, and stable minimum dimensions.

## Verification Evidence

The following counts are the Task 10 candidate snapshot. Current aggregate evidence is
recorded separately so that results from different commits are not combined.

| Gate | Result |
| --- | --- |
| Targeted TDD suites | Session/API/resource, routes/login, Today/task, mistakes, achievements/profile suites passed red-to-green during implementation |
| Frontend CI entry | `CI=true npm run test:ci`: 20 suites, 130 tests passed |
| Production build | `npm run build`: compiled successfully; only the existing Browserslist data-age warning remained |
| Family regression | `npm run test:family-regression`: 52 suites, 652 tests passed across six Jest projects |
| Desktop browser | 1440x900 login, Today, task completion, mistake mastery, achievements, profile, and logout flow passed |
| Mobile browser | 360x800 login and every child route passed; fixed navigation remained usable and content was not covered |
| Browser layout/console | `scrollWidth == clientWidth` on inspected routes; zero browser errors and warnings in the final pass |
| Git hygiene | `git diff --check` passed and no browser/build artifacts were tracked |
| Remote CI | Run 29155432245 passed `Family Regression`, including `Frontend Smoke`, for PR head `23350f46754b0c4a2d815d813b9897c75135c5f7` |

## CI Remediation

The first PR run passed the backend family regression but exposed one frontend test
timing failure. `FamilyNavigation.test.js` tested `/app` redirect and parent navigation
by waiting for the Today page's unrelated business-resource heading. Under concurrent
Linux workers that indirect assertion timed out. The test now waits for the parent
shell's selected-child control and directly asserts `/app/today`; dedicated Task 9
tests remain responsible for Today resource loading. The full local and remote suites
then passed without retrying the same commit.

## Security Boundary

- Parent storage cannot authenticate a child route, and child storage cannot
  authenticate a parent route.
- Child logout and expiry remove only child credentials.
- Child list and mutation APIs expose no sibling-ID input and send only approved
  completion or mistake-review fields.
- Stable `4xx` responses do not enter retry loops; protected `401` responses expire
  the child session while public PIN-login failures remain local to the form.

## Residual Scope Revalidation

Task 11 has since closed the automated cross-role flow, and Stage 5 removed the React
`act()`/Router warning debt from the current frontend gate. The Browserslist data-age
notice and dependency audit findings remain separate dependency-maintenance work; they
do not change Task 10 behavior.

## Acceptance Decision

Task 10 is accepted and merged. `FR-UI-002` is `implemented` and `COVERED`;
`FR-FLOW-001` is also now implemented and covered by Task 11 and the unified v1.6 gate.

## v1.6 Revalidation

The 2026-07-14 clean-main `npm run release:family` run passed 70 backend suites / 755
tests, 4 Task 11 integration suites / 6 tests, 25 frontend suites / 156 tests, production
build, 4 Chromium tests, Compose build/health, and the media-backed gateway smoke. See
the [v1.6 release gate](./family-growth-v1.6-release-gate.md) for current totals.

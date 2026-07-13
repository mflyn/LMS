# Family Growth Task 8-11 Frontend and E2E Design Baseline

**Document status:** IMPLEMENTED / TASK 8-11 FINAL BASELINE INPUT
**Date:** 2026-07-09
**Status updated:** 2026-07-13
**Scope:** Task 8 parent web shell, Task 9 parent MVP pages, Task 10 child web entry, Task 11 end-to-end MVP flow
**Requirements:** `FR-UI-001`, `FR-UI-002`, `FR-FLOW-001`

This document was the approved Task 8 implementation baseline and the shared design
input for Task 9-11. All four stages are now implemented and closed by their own
detailed design, test, and gate evidence. The future-tense sections below are retained
as the approved design intent; current delivery status is determined by this closure
table and the linked gates.

| Stage | Detailed design / plan | Test and gate evidence | Final status |
| --- | --- | --- | --- |
| Task 8 parent shell | [Task 8 implementation plan](../plans/2026-07-10-family-growth-task8-parent-shell.md) | [test cases](../../development/family-growth-task8-test-cases.md), [gate](../../development/family-growth-task8-gate.md) | `PASSED`, merged by PR #6 |
| Task 9 parent pages | [Task 9 detailed design](./2026-07-10-family-growth-task9-parent-pages-design.md) | [test cases](../../development/family-growth-task9-test-cases.md), [gate](../../development/family-growth-task9-gate.md) | `PASSED`, merged by PR #8 |
| Task 10 child web | [Task 10 detailed design](./2026-07-11-family-growth-task10-child-web-design.md) | [test cases](../../development/family-growth-task10-test-cases.md), [gate](../../development/family-growth-task10-gate.md) | `PASSED`, merged by PR #11 |
| Task 11 family E2E | [Task 11 detailed design](./2026-07-12-family-growth-task11-e2e-design.md) | [test cases](../../development/family-growth-task11-test-cases.md), [gate](../../development/family-growth-task11-gate.md) | `PASSED`, merged by PR #14 |

The complete MVP merge and CI evidence is recorded in the
[FGT-MVP-1.6 final baseline candidate](../../development/family-growth-baseline-v1.6-manifest.md).
This status convergence does not retroactively expand any stage's accepted scope.

## 1. Current-State Assessment

`frontend/web` currently contains a school-oriented React app with Ant Design layout, role menus for student/parent/teacher/admin, and pages such as courses, classes, grades, home-school interaction, resources and analytics. That code is not the accepted family-growth UI baseline. Task 8 must first isolate a family UI shell before Task 9-11 add workflows.

The existing app may be reused only for infrastructure that remains valid:

- React Router and protected route mechanics.
- Ant Design base components.
- Zustand stores where they can be renamed and narrowed to family state.
- Existing login/register scaffolding after API contract alignment.

The following existing web elements are legacy-school surface and must not appear in the family MVP navigation: teacher/admin menus, classes, courses, grades, school homework, parent communication, meetings, announcements, generic learning resources and school analytics.

## 2. Task 8 Parent Web Shell

Task 8 creates the family parent shell and route/state foundation. It does not need to finish every page feature.

Required routes:

| Route | Purpose |
| --- | --- |
| `/login` | Parent login. |
| `/register` | Parent registration. |
| `/family/setup` | First-family initialization when the parent has no family. |
| `/app` | Authenticated parent shell redirecting to `/app/today`. |
| `/app/today` | Parent overview placeholder backed by real family/child context. |
| `/app/tasks` | Growth task list placeholder. |
| `/app/logs` | Growth log placeholder. |
| `/app/mistakes` | Mistake placeholder. |
| `/app/reports` | Weekly report placeholder. |
| `/app/reminders` | Reminder placeholder. |
| `/app/rewards` | Stars and rewards placeholder. |

State boundaries:

- Parent auth token is stored under a family-specific key, separate from child token storage.
- The selected child is a first-class app state value. Child switching must clear child-scoped query state before loading the next child.
- Family initialization state is explicit: `unknown`, `needs_family`, `ready`, `error`.
- Every data route supports `loading`, `empty`, `ready`, `partial`, and `retryable_error`.

Acceptance:

- Unauthenticated users cannot reach `/app/*`.
- A parent without a family is redirected to `/family/setup`.
- School routes are removed or redirected to the family shell.
- The shell works from 360px width to desktop and has keyboard-reachable navigation.

## 3. Task 9 Parent MVP Pages

Task 9 replaces placeholders with parent workflows over the approved API:

- Create, list, complete on behalf of child, confirm, cancel and archive five-dimension growth tasks.
- Read and create growth logs for all five dimensions.
- Create, patch, review and list academic mistakes.
- Read weekly reports and submit parent feedback.
- Read family reminders and reminder settings.
- Read star balance, list rewards and confirm redemption.
- Upload and view private media only through signed media access flows.

Page-level rules:

- Pages must never trust a query `familyId` for authorization.
- Mutations use stable idempotency where the API requires it.
- `partial` responses render available data and name only approved unavailable source labels.
- Parent feedback and child private text are not logged to the browser console.

## 4. Task 10 Child Simplified Entry

Task 10 adds a separate child experience:

| Route | Purpose |
| --- | --- |
| `/child/login` | PIN login with family and child identifiers. |
| `/child/today` | Child-owned tasks and reminders for today. |
| `/child/tasks/:taskId` | Complete task and add child feedback. |
| `/child/mistakes` | Read and review own mistakes. |
| `/child/achievements` | Stars, confirmed tasks and rewards visible to the child. |
| `/child/me` | Profile and logout. |

Rules:

- Child routes use child token storage only.
- Parent routes are unreachable from child identity.
- Sibling data is never listed.
- PIN failures and expired tokens show recoverable states.
- Logout clears child token and selected child state.

## 5. Task 11 End-to-End MVP Flow

Task 11 creates the automated acceptance flow for the family MVP:

1. Register parent and create a family.
2. Create two children.
3. Create five-dimension tasks.
4. Child logs in with PIN and completes a task.
5. Parent confirms the task and awards stars once.
6. Parent records growth logs and one academic mistake.
7. Parent uploads private media and verifies signed access.
8. Parent reads deterministic weekly report.
9. Parent reads reminders and verifies deduplication.
10. Parent creates and redeems a reward idempotently.
11. Child session cannot access parent routes or sibling data.

The E2E test must run against seeded disposable data and must not depend on a public internet endpoint.

## 6. Test Strategy

- Task 8: route guard tests, family setup redirect tests, menu snapshot tests, responsive smoke checks.
- Task 9: page integration tests with mocked API contracts plus one backend-backed smoke flow.
- Task 10: child auth/route isolation tests and token-expiry recovery tests.
- Task 11: one full browser E2E happy path plus focused negative cases for sibling/parent route access.

## 7. Out of Scope

- Mobile app implementation.
- Push notification, email, SMS and background schedulers.
- AI recommendations or AI report generation.
- School teacher/admin UI restoration inside the family MVP shell.

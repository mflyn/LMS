# Task 8 Parent Web Shell Test Design and Numbered Cases

**Document status:** APPROVED FOR IMPLEMENTATION
**Date:** 2026-07-10
**Requirements:** `FR-UI-001`, `NFR-SEC-001`, `NFR-COMPAT-001`
**Design:** `docs/superpowers/specs/2026-07-09-family-growth-task8-task11-frontend-design.md`

Task 8 covers the parent Web shell only. Child PIN entry and business-page
mutations remain Task 9-11 work. Frontend tests mock the documented public API
envelope and use stable family A / child A1 / child A2 fixtures. Browser checks
run at 360px and desktop width against the local application.

## Session and Access

| ID | Requirement | Level | Action | Expected result | Automated test |
| --- | --- | --- | --- | --- | --- |
| `TC-T8-AUTH-001` | `FR-UI-001` | unit | Restore a saved parent session and issue a family request. | Only `family-growth.parent-session.v1` restores parent identity and supplies the `Authorization` header; legacy `token` and child-session keys do not authenticate the parent shell. | `familySession.test.js`, `familyApi.test.js` |
| `TC-T8-AUTH-002` | `FR-UI-001`, `NFR-SEC-001` | context | Login returns a `parent` user. | Parent token and sanitized user are saved under the parent key; an account with any other role is rejected and no parent session is saved. | `AuthContext.test.js` |
| `TC-T8-AUTH-003` | `FR-UI-001` | context | Logout or receive `401` from a family request. | Parent session, authorization header state, family state, and selected child are cleared; the next protected navigation reaches `/login`. | `AuthContext.test.js`, `FamilyNavigation.test.js` |
| `TC-T8-AUTH-004` | `FR-UI-001` | route | Open `/app/today` without a parent session or with only a child session. | The route redirects to `/login`; no parent page content or school navigation is rendered first. | `FamilyNavigation.test.js` |

## Family Context and Routes

| ID | Requirement | Level | Action | Expected result | Automated test |
| --- | --- | --- | --- | --- | --- |
| `TC-T8-FAMILY-001` | `FR-UI-001` | context | `GET /api/families/me` returns family A and children A1/A2. | State becomes `ready`; the documented default child is selected and visible to all shell pages. | `FamilyContext.test.js` |
| `TC-T8-FAMILY-002` | `FR-UI-001` | route | Family lookup returns `404 RESOURCE_NOT_FOUND`. | State becomes `needs_family`; parent routes redirect to `/family/setup` and the setup form is usable. | `FamilyNavigation.test.js` |
| `TC-T8-FAMILY-003` | `FR-UI-001` | context | Family lookup fails with a retryable non-401 error. | State becomes `error`; no stale child is rendered and the retry action repeats the lookup. | `FamilyContext.test.js` |
| `TC-T8-FAMILY-004` | `FR-UI-001` | context | Switch from A1 to A2. | Registered child-scoped state is synchronously reset before A2 becomes active, and the child-scope version changes. | `FamilyContext.test.js`, `childScope.test.js` |
| `TC-T8-ROUTE-001` | `FR-UI-001` | route | Navigate to `/app`. | It redirects to `/app/today`; today, tasks, logs, mistakes, reports, reminders, and rewards are each available as protected placeholder routes. | `FamilyNavigation.test.js` |
| `TC-T8-ROUTE-002` | `NFR-COMPAT-001` | route | Visit legacy school paths such as `/dashboard`, `/interaction`, `/courses`, `/classes`, `/analytics`, or `/resources`. | Each redirects into the family parent entry path; legacy school page content is unreachable from the family shell. | `FamilyNavigation.test.js` |

## Navigation, Accessibility, and Delivery Gate

| ID | Requirement | Level | Action | Expected result | Automated test/evidence |
| --- | --- | --- | --- | --- | --- |
| `TC-T8-NAV-001` | `FR-UI-001` | component | Render the parent navigation. | It contains only 今日、任务、记录、错题、周报、提醒、星星与奖励; it contains none of 班级、课程、教师、家校互动、会议、公告、资源、学校分析 or 管理端. | `FamilyNavigation.test.js` |
| `TC-T8-NAV-002` | `FR-UI-001` | accessibility | Navigate the shell with Tab, Enter, and the child selector. | Navigation controls and child selector have accessible names, visible focus, and keyboard activation. | `FamilyNavigation.test.js`, browser check |
| `TC-T8-NAV-003` | `FR-UI-001` | responsive | Render at 360px and a desktop viewport. | Mobile navigation is reachable via a labelled menu control; no horizontal overflow or clipped primary controls occurs. | `FamilyNavigation.test.js`, browser inspection |
| `TC-T8-REG-001` | Task 8 gate | build/test | Run the default frontend command on a clean checkout. | `npm ci` succeeds; default `npm test` runs family-current tests only. Legacy school tests are isolated under `src/__tests__/legacy/` and run only through `npm run test:legacy`. | CI `Frontend Smoke`, local evidence |
| `TC-T8-REG-002` | Task 8 gate | regression | Run the Task 8 suite, frontend build, and backend family regression. | All commands exit 0; Task 8 changes introduce no backend family regression. | Task 8 gate record |

## Coverage Summary

| Requirement | Cases |
| --- | --- |
| `FR-UI-001` | `TC-T8-AUTH-001`-`004`, `TC-T8-FAMILY-001`-`004`, `TC-T8-ROUTE-001`, `TC-T8-NAV-001`-`003` |
| `NFR-SEC-001` | `TC-T8-AUTH-002`-`004` |
| `NFR-COMPAT-001` | `TC-T8-ROUTE-002` |
| Task 8 quality gate | `TC-T8-REG-001`-`002` |

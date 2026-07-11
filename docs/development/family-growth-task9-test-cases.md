# Task 9 Parent MVP Pages Test Design and Cases

**Document status:** FINAL / GATE PASSED
**Date:** 2026-07-10
**Design:** `docs/superpowers/specs/2026-07-10-family-growth-task9-parent-pages-design.md`
**Scope:** Parent pages only; Task 10 child portal and Task 11 cross-role E2E are excluded.

## Test Fixtures

Frontend integration tests use a parent session for family A, children A1 and A2, and stable public gateway envelopes. Fixture records carry requested child IDs. Tests do not invent a `familyId` query parameter. Backend smoke uses the existing homework-service in-memory MongoDB fixture and gateway-identity headers.

## API and Child Scope

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T9-API-001` | Query selected-child list endpoints. | Parent token is sent per request; `childId` is selected child; no global authorization or UI family ID. | `familyApi.task9.test.js` |
| `TC-T9-API-002` | Pass abort signal to list request. | Wrapper forwards signal and abort does not become a page error. | `familyApi.task9.test.js`, `useChildResource.test.js` |
| `TC-T9-SCOPE-001` | Switch A1 to A2 while an A1 query or mutation is pending. | A1 read is aborted; A1 records clear; a late A1 mutation response is discarded before A2 data renders. | `useChildResource.test.js`, `Task9LogsMistakes.test.js` |
| `TC-T9-AUTH-001` | Receive `401` from Task 9 method. | Existing expiry event clears parent session and route returns to login. | `familyApi.task9.test.js`, `FamilyNavigation.test.js` |

## Today and Tasks

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T9-TODAY-001` | Load today tasks, report, pending mistakes, and reminders. | Counts, rate/minutes, pending-review count, and reminders render for selected child. | `Task9TodayTasks.test.js` |
| `TC-T9-TODAY-002` | One aggregate source is unavailable. | Available panels render and only returned unavailable-source labels are shown. | `Task9TodayTasks.test.js` |
| `TC-T9-TASK-001` | Create moral, academic, physical, artistic, and labor tasks. | Each uses valid dimension payload and appears pending. | `Task9TodayTasks.test.js` |
| `TC-T9-TASK-002` | Filter tasks by dimension/status. | List contains only matching selected-child records. | `Task9TodayTasks.test.js` |
| `TC-T9-TASK-003` | Parent completes and confirms a task. | Actual values and feedback are sent; confirmed task and award state replace prior state once. | `Task9TodayTasks.test.js` |
| `TC-T9-TASK-004` | Cancel pending or archive completed task. | Returned state replaces item; conflict triggers reload, not a blind transition. | `Task9TodayTasks.test.js` |
| `TC-T9-MEDIA-001` | Attach, view, or cancel a task image draft. | Upload purpose is `task_attachment`; mutation stores media ID; view requests signed access; cancelled unbound draft is soft-deleted. | `familyApi.task9.test.js`, `Task9TodayTasks.test.js` |

## Logs and Mistakes

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T9-LOG-001` | Create and edit five-dimension logs. | Date, dimension, area, duration/amount, reflection, and parent note persist. | `Task9LogsMistakes.test.js` |
| `TC-T9-LOG-002` | Load no logs then retryable error. | Empty and error states differ; retry reloads selected-child data. | `Task9LogsMistakes.test.js` |
| `TC-T9-MISTAKE-001` | Create academic mistake with reason/review date. | It is academic-only and appears under pending review. | `Task9LogsMistakes.test.js` |
| `TC-T9-MISTAKE-002` | Update correction/review/mastery/note. | Patch result replaces row without browser-console private text. | `Task9LogsMistakes.test.js` |
| `TC-T9-MEDIA-002` | Add question/answer images. | Upload purposes are `mistake_question` and `mistake_answer`; payload holds only IDs. | `familyApi.task9.test.js`, `Task9LogsMistakes.test.js` |

## Reports, Reminders, and Rewards

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T9-REPORT-001` | Select Monday and read report. | Server summary displays without browser recomputation; `503` is retryable. | `Task9ReportsRemindersRewards.test.js` |
| `TC-T9-REPORT-002` | Submit feedback. | Only parent note and next-week suggestion are patched. | `Task9ReportsRemindersRewards.test.js` |
| `TC-T9-REMIND-001` | Read partial reminders. | Available reminders and unavailable sources render. | `Task9ReportsRemindersRewards.test.js` |
| `TC-T9-REMIND-002` | Update settings. | Nested `quietHours.start/end`, ISO day, and switches are sent without family ID. | `familyApi.task9.test.js`, `Task9ReportsRemindersRewards.test.js` |
| `TC-T9-REWARD-001` | Read balance/rewards/ledger and create reward. | Selected-child collections render and new active reward is appended. | `Task9ReportsRemindersRewards.test.js` |
| `TC-T9-REWARD-002` | Redeem and retry same action. | Stable `Idempotency-Key` is reused and command is disabled in flight. | `familyApi.task9.test.js`, `Task9ReportsRemindersRewards.test.js` |
| `TC-T9-REWARD-003` | Redeem with insufficient balance. | Stable error is shown and reward remains active. | `Task9ReportsRemindersRewards.test.js` |

## Backend, Browser, and Gate

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T9-SMOKE-001` | Parent creates, completes, and confirms task against homework-service. | `pending -> completed -> confirmed`, `starAwardState=awarded`, and one internal award call. | Existing `TC-T5-SAGA-001` in `growthTasks.test.js` |
| `TC-T9-UX-001` | Operate routes at desktop and 360px. | Child switch, forms, report/reminder/reward access, focus, and primary controls have no horizontal page overflow. | Browser inspection and Task 9 gate |
| `TC-T9-REG-001` | Run frontend/build/family regression/diff checks. | Commands exit zero and default frontend path excludes legacy school tests. | Task 9 gate and CI |
| `TC-T9-A11Y-001` | Open and close a page dialog using the keyboard. | Focus enters and stays in the dialog, Escape closes it, and focus returns to the opener. | `Task9TodayTasks.test.js`, browser inspection |

## Traceability

| Requirement group | Cases |
| --- | --- |
| `FR-UI-001` | `TC-T9-API-001` to `002`, `TC-T9-SCOPE-001`, `TC-T9-TODAY-001` to `002`, `TC-T9-UX-001` |
| `FR-TASK-001` to `006` | `TC-T9-TASK-001` to `004`, `TC-T9-SMOKE-001` |
| `FR-LOG-001` / `FR-MISTAKE-001` | `TC-T9-LOG-001` to `002`, `TC-T9-MISTAKE-001` to `002` |
| `FR-REPORT-001` / `FR-NOTIFY-001` to `002` | `TC-T9-REPORT-001` to `002`, `TC-T9-REMIND-001` to `002` |
| `FR-REWARD-001` to `002` | `TC-T9-REWARD-001` to `003`, `TC-T9-SMOKE-001` |
| `FR-MEDIA-001` to `002` / privacy | `TC-T9-MEDIA-001` to `002` |

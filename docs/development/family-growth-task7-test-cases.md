# Task 7 Notification Service Test Design and Numbered Cases

**Document status:** APPROVED FOR IMPLEMENTATION
**Date:** 2026-07-07
**Design:** `docs/superpowers/specs/2026-07-07-family-growth-task7-notifications-design.md`

Tests use fixed family A/child A1/sibling A2/family B fixtures, signed gateway identity, fixed clocks, and injected source repositories unless a case explicitly verifies persistence.

## Reminder Settings

| ID | Requirement | Level | Action | Expected result | Automated test |
| --- | --- | --- | --- | --- | --- |
| `TC-T7-SETTINGS-001` | `FR-NOTIFY-002` | model/route | Parent reads settings for the first time. | Default row is created once with all switches enabled, `weeklyReportDay=7`, and quiet hours `21:00`-`07:00`. | `familyNotifications.test.js` |
| `TC-T7-SETTINGS-002` | `FR-NOTIFY-002` | route | Parent patches every allowed field. | Response returns updated settings, `updatedByParentId`, and unknown/client ownership fields are rejected. | `familyNotifications.test.js` |
| `TC-T7-SETTINGS-003` | `FR-NOTIFY-002` | validation | Patch `weeklyReportDay=0/8`, malformed quiet hours, or non-boolean switches. | `400 VALIDATION_ERROR`; stored settings remain unchanged. | `familyNotifications.test.js` |
| `TC-T7-SETTINGS-004` | `FR-NOTIFY-002`, `NFR-SEC-001` | authorization | Child reads and then attempts to patch settings; family B attempts family A settings. | Child read succeeds, child patch returns `403 CHILD_ACCESS_DENIED`, cross-family returns `403`. | `familyNotifications.test.js` |

## Derived Reminders

| ID | Requirement | Level | Action | Expected result | Automated test |
| --- | --- | --- | --- | --- | --- |
| `TC-T7-NOTIFY-001` | `FR-NOTIFY-001` | service/route | Query a date with two pending tasks due today. | Returns stable `task_today` reminders with deterministic IDs and ordering. | `familyNotifications.test.js` |
| `TC-T7-NOTIFY-002` | `FR-NOTIFY-001` | service/route | Query pending tasks due before the local date. | Returns `task_overdue` warnings only when `overdueReminderEnabled=true`. | `familyNotifications.test.js` |
| `TC-T7-NOTIFY-003` | `FR-NOTIFY-001` | service/route | Query unmastered mistakes with `reviewReminderDate <= localDate`. | Returns `mistake_review`; mastered or future reminders are excluded. | `familyNotifications.test.js` |
| `TC-T7-NOTIFY-004` | `FR-NOTIFY-001` | service/route | Query a date with no physical, moral, or labor task/log. | Returns `dimension_physical`, `dimension_moral`, and `dimension_labor` nudges. | `familyNotifications.test.js` |
| `TC-T7-NOTIFY-005` | `FR-NOTIFY-001` | service/route | Query a date that has a physical task and a labor GrowthLog. | Suppresses corresponding dimension nudges but keeps missing moral nudge. | `familyNotifications.test.js` |
| `TC-T7-NOTIFY-006` | `FR-NOTIFY-001` | service/route | Query on configured weekly report day without a report. | Returns one `weekly_report` reminder; non-report day or existing report returns none. | `familyNotifications.test.js` |
| `TC-T7-NOTIFY-007` | `FR-NOTIFY-001` | service | Two sources produce duplicate reminder identities. | Dedupes by `type + childId + LocalDate + sourceId` and returns one item. | `familyNotifications.test.js` |
| `TC-T7-NOTIFY-008` | `FR-NOTIFY-001` | route | Disable each switch and query otherwise matching source data. | Disabled categories are absent while enabled categories remain. | `familyNotifications.test.js` |
| `TC-T7-NOTIFY-009` | `FR-NOTIFY-001`, `NFR-TIME-001` | route | Omit `date` with fixed now near UTC/family midnight. | Uses family timezone, not server timezone, for LocalDate and ISO weekday. | `familyNotifications.test.js` |
| `TC-T7-NOTIFY-010` | `FR-NOTIFY-001`, `NFR-SEC-001` | route | Child A1 queries sibling A2, parent B queries A1, anonymous request. | Returns stable `403` or `401` and discloses no source data. | `familyNotifications.test.js` |
| `TC-T7-NOTIFY-011` | `FR-NOTIFY-001` | resilience | Make task, mistake, log, and report sources fail independently. | Returns available reminders with `meta.partial=true` and exact `unavailableSources`. | `familyNotifications.test.js` |
| `TC-T7-NOTIFY-012` | `FR-NOTIFY-001`, `NFR-PRIVACY-001` | privacy | Source failures contain private task/mistake text and connection details. | Response and logs include only approved source names and stable codes. | `familyNotifications.test.js` |

## Gateway and Regression

| ID | Requirement | Level | Action | Expected result | Automated test/evidence |
| --- | --- | --- | --- | --- | --- |
| `TC-T7-GW-001` | Task 7 API | gateway | Request `/api/notifications/family` and `/api/notifications/settings` through gateway. | Gateway signs identity and proxies both prefixes to notification-service. | `familyTask7Routes.test.js` |
| `TC-T7-REG-001` | Task 7 gate | startup | Import notification app module and construct injected app. | No Mongo connection, RabbitMQ connection, Socket.IO listener, or port opens during import. | `familyNotifications.test.js` |
| `TC-T7-REG-002` | Task 7 gate | regression | Run notification focused tests plus family regression. | New tests pass and Task 3-6 family suites remain green or documented unchanged if Task 6 pending suites are not part of the gate. | `family-growth-task7-gate.md` |

## Coverage Summary

| Requirement | Cases |
| --- | --- |
| `FR-NOTIFY-001` | `TC-T7-NOTIFY-001`-`012`, `TC-T7-GW-001` |
| `FR-NOTIFY-002` | `TC-T7-SETTINGS-001`-`004` |
| `NFR-SEC-001` | `TC-T7-SETTINGS-004`, `TC-T7-NOTIFY-010`, `TC-T7-GW-001` |
| `NFR-DATA-001` | stable family/child scoped settings and repository source predicates in notification tests |
| `NFR-TIME-001` | `TC-T7-NOTIFY-009` and weekly report weekday cases |

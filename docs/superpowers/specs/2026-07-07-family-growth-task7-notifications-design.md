# Family Growth Task 7 Notifications Detailed Design

**Document status:** APPROVED FOR IMPLEMENTATION
**Date:** 2026-07-07
**Scope:** Product Task 7 reminder settings and read-time derived family reminders
**Requirements:** `FR-NOTIFY-001`, `FR-NOTIFY-002`, `NFR-SEC-001`, `NFR-DATA-001`, `NFR-TIME-001`

## 1. Objective

Task 7 adds a lightweight family reminder service for the MVP:

- Parents and children can read family reminders for an accessible child.
- Parents can configure reminder switches, weekly report day, and quiet hours.
- Children can read settings but cannot update them.
- Reminders are derived on read and are not pushed by background jobs in this phase.
- Independent reminder source failures return available reminders with `meta.partial=true`.

Task 7 does not implement push notifications, email, SMS, background schedulers, monthly reports, AI recommendations, or frontend UI.

## 2. Architecture

`notification-service` remains the owner of `ReminderSettings`. It does not copy task, mistake, report, or log data. Instead, it receives a `sourceRepository` dependency with bounded read methods. Production adapts the Task 6 shared `familyReadRepository` and must not import private service models; tests inject deterministic sources. The adapter uses an inclusive request-time cutoff so writes committed at the same clock instant are visible, while historical weekly-report aggregation retains the shared repository's default exclusive cutoff.

The public API is mounted under the notification service:

```text
GET   /api/notifications/family?childId=&date=
GET   /api/notifications/settings
PATCH /api/notifications/settings
```

Gateway exposes `/api/notifications/family` and `/api/notifications/settings` to `notification-service`. The route uses signed gateway identity; client-supplied `familyId` is not trusted for authorization.

## 3. ReminderSettings Model

`ReminderSettings` is unique per family.

| Field | Type | Default | Constraint |
| --- | --- | --- | --- |
| `familyId` | ObjectId | required | unique |
| `weeklyReportDay` | Number | `7` | ISO weekday `1..7` |
| `taskReminderEnabled` | Boolean | `true` | parent mutable |
| `overdueReminderEnabled` | Boolean | `true` | parent mutable |
| `mistakeReviewReminderEnabled` | Boolean | `true` | parent mutable |
| `dimensionReminderEnabled` | Boolean | `true` | parent mutable |
| `weeklyReportReminderEnabled` | Boolean | `true` | parent mutable |
| `quietHours` | Object | `{ start: "21:00", end: "07:00" }` | parent mutable as one object |
| `quietHours.start` | String | `21:00` | required with `quietHours.end`; `HH:mm` |
| `quietHours.end` | String | `07:00` | required with `quietHours.start`; `HH:mm` |
| `updatedByParentId` | ObjectId | optional | set on parent patch |

The service creates a default row on first read if none exists. `PATCH` accepts
`quietHours` only as the complete nested object; `start` and `end` must be submitted
together and each must be a valid 24-hour `HH:mm` value. A partial object or invalid
weekday/time value returns `400 VALIDATION_ERROR`. Flat quiet-hours names are not part
of the approved contract; clients must send the nested object shown below.

```json
{
  "quietHours": {
    "start": "21:00",
    "end": "07:00"
  }
}
```

## 4. Reminder Derivation

All reminders include:

```json
{
  "reminderId": "type:childId:localDate:sourceId",
  "type": "task_today",
  "childId": "...",
  "localDate": "2026-07-07",
  "sourceId": "...",
  "severity": "info",
  "title": "...",
  "message": "...",
  "dimension": "physical"
}
```

`reminderId` is stable and deduplicates by `type + childId + LocalDate + sourceId`. Items are sorted by severity order `warning > info`, then type order, then `sourceId`.

Reminder categories:

| Type | Source | Rule | Switch |
| --- | --- | --- | --- |
| `task_today` | GrowthTask | Pending task due on `localDate` | `taskReminderEnabled` |
| `task_overdue` | GrowthTask | Pending task with `dueDate < localDate` | `overdueReminderEnabled` |
| `mistake_review` | FamilyMistake | Unmastered mistake with `reviewReminderDate <= localDate` | `mistakeReviewReminderEnabled` |
| `dimension_physical` | GrowthTask/GrowthLog | No physical task/log found on `localDate` | `dimensionReminderEnabled` |
| `dimension_moral` | GrowthTask/GrowthLog | No moral task/log found on `localDate` | `dimensionReminderEnabled` |
| `dimension_labor` | GrowthTask/GrowthLog | No labor task/log found on `localDate` | `dimensionReminderEnabled` |
| `weekly_report` | WeeklyReport | `localDate` ISO weekday equals `weeklyReportDay` and report is not generated for the current week | `weeklyReportReminderEnabled` |

Dimension reminders are positive nudges, not failures. They are suppressed if a same-dimension task is due today or a same-dimension GrowthLog exists today.

## 5. Partial Degradation

Each category reads independently. If one source fails, the response still returns other categories:

```json
{
  "success": true,
  "data": { "items": [] },
  "meta": {
    "partial": true,
    "unavailableSources": ["mistakes"],
    "localDate": "2026-07-07",
    "timezone": "Asia/Shanghai"
  }
}
```

Failures are logged with source names only; no connection string, stack trace, child private text, answer, media URL, or credentials are returned.

## 6. Authorization

Parents may read reminders for a child in their family. A child identity can read only its own reminders. Children can read settings but cannot patch settings. Cross-family and sibling access return `403 CHILD_ACCESS_DENIED`.

The service derives `familyId` from the signed identity and source repository ownership checks. Request body/query `familyId` is ignored and rejected if present in a patch body.

## 7. Time Rules

`date` is optional; when omitted, the service computes today with the family IANA timezone. Supplied `date` must be a valid LocalDate. ISO weekdays use family-local dates. Quiet hours are stored for frontend display in MVP; they do not suppress read-time reminders because no push is sent.

## 8. Observability

Allowed audit/log fields: requestId, familyId, childId, localDate, reminder type, source name, result, count. Logs must not include task descriptions, mistake answers, child explanations, parent notes, media URLs, credentials, or database errors.

## 9. Rollback

Rollback removes the gateway prefixes and route mounting. `ReminderSettings` rows can remain because they do not affect other service writes and are only used when the Task 7 route is enabled.

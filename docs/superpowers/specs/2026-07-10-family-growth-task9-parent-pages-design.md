# Family Growth Task 9 Parent MVP Pages Design

**Document status:** APPROVED FOR DOCUMENTATION REVIEW
**Date:** 2026-07-10
**Scope:** Task 9 parent MVP pages only
**Requirements:** `FR-UI-001`, `FR-TASK-001` to `006`, `FR-LOG-001`, `FR-MISTAKE-001`, `FR-REPORT-001`, `FR-NOTIFY-001` to `002`, `FR-REWARD-001` to `002`, `FR-MEDIA-001` to `002`, `NFR-SEC-001`, `NFR-PRIVACY-001`, `NFR-TIME-001`
**Predecessor:** Task 8 parent shell at `/app/*`

## 1. Objective and Boundary

Task 9 replaces every Task 8 business-page placeholder with a usable parent workflow for the selected child. It delivers `/app/today`, `/app/tasks`, `/app/logs`, `/app/mistakes`, `/app/reports`, `/app/reminders`, and `/app/rewards`.

This task does not add a child Web experience, change service authorization, introduce backend business endpoints, or automate the full cross-role browser flow. Those remain Task 10 and Task 11 responsibilities.

## 2. Architecture

### 2.1 Child-Scoped Resource Boundary

`FamilyContext` remains the only owner of the selected child. A new frontend resource layer will build every request from `selectedChildId`, add an `AbortController` to each request, and register cancellation with `registerChildScopeReset`. A switch synchronously aborts old-child requests and erases their records before the next child is exposed. Abort errors are ignored; `401` delegates to existing parent-session expiry; stable `400`, `403`, `409`, and `503` responses remain visible in-page.

The resource layer returns exactly `loading`, `empty`, `ready`, `partial`, and `retryable_error`. It does not add a query-cache dependency. This keeps page forms local while preserving the Task 8 child-isolation contract.

### 2.2 API Client

`frontend/web/src/services/familyApi.js` becomes the parent-only wrapper for the public gateway API. It unwraps `{ success, data }`, forwards an optional abort signal, sends an authorization header per request, never writes Axios global headers, and never logs parent feedback or private child text. Its methods cover tasks, logs, mistakes, reports, reminders/settings, rewards, and private media. Redemption requires a caller-supplied idempotency key and sends it as `Idempotency-Key`.

### 2.3 Private Media

Task attachments and mistake images follow one private-media sequence:

1. Validate JPEG, PNG, or WebP and a maximum 10 MiB before upload.
2. Upload with selected child and approved purpose through `POST /api/media`.
3. Store only returned `mediaId` in task or mistake mutations; never a public URL.
4. Request `GET /api/media/:mediaId/access` before rendering; do not persist the short-lived URL or log it.
5. Keep failed forms editable and show the stable error response.

`growth_evidence` is not a standalone Task 9 upload action because the approved GrowthLog API has no media-reference field. The UI will not create orphan media assets.

## 3. Page Design

### 3.1 Today

The overview loads selected-child today tasks, current Monday-based weekly report, pending academic mistakes, and family reminders in parallel. It shows task status counts, completion rate and minutes, pending-review count, reminders, and direct links to task/log/mistake creation. An approved partial response keeps available panels visible and names only API-provided unavailable sources. It never treats missing data as zero.

### 3.2 Tasks

The page filters five dimensions (`moral`, `academic`, `physical`, `artistic`, `labor`) and status/today/week. Parents create and edit pending tasks, complete on behalf of a child, confirm with parent feedback, and cancel or archive according to API state. Academic tasks may include `subject`; all dimensions use `area`, title, task type, family-local due date, estimates, target/unit, priority, description, and optional private `task_attachment` IDs. In-flight commands are disabled; `409 TASK_STATE_CONFLICT` reloads rather than applying a blind transition.

### 3.3 Growth Logs

The page lists selected-child records by date range and dimension, then creates or edits five-dimension records. It sends the documented LocalDate, content, duration/amount, unit, area, optional academic subject, reflection, and parent note fields. It does not invent a log attachment field.

### 3.4 Academic Mistakes

The page is academic-only. It filters by subject and `pending|reviewed|mastered`, creates a mistake with reason and review date, and lets a parent update correction, review, mastery, answer, and note. Question and answer images use only `mistake_question` and `mistake_answer` private media IDs.

### 3.5 Weekly Reports

The page selects a Monday, reads the deterministic report, displays server-returned statistics without recomputing them, and submits only `parentNote` and `nextWeekSuggestion`. Aggregation `503` is retryable, not a zero report.

### 3.6 Reminders and Settings

The page shows derived selected-child reminders and a distinct family settings form. It preserves `meta.partial` and `meta.unavailableSources`. Settings include five switches, ISO report day, and quiet hours.

The API document currently says `quietHoursStart`/`quietHoursEnd`, while the deployed notification service accepts this tested payload:

```json
{
  "weeklyReportDay": 7,
  "quietHours": { "start": "21:00", "end": "07:00" },
  "taskReminderEnabled": true
}
```

Task 9 uses this nested `quietHours` contract, corrects the API document in the same change, and does not send query `familyId` for settings reads or writes.

### 3.7 Stars and Rewards

The page reads selected-child star balance, separately paginated rewards, and ledger. Parents create rewards and redeem active rewards. One opaque UUID-based idempotency key is generated when redemption begins and reused for retry. The command is disabled pending a definitive response; `409 INSUFFICIENT_STARS` remains a stable form error.

## 4. UI, Accessibility, and Consistency

The Task 8 shell remains unchanged. Pages use dense, keyboard-operable tables, filters, forms, dialogs, and text status panels. Every control has an accessible name; dialog focus returns to its opener; status does not depend on color. At 360px filters and forms stack, tables retain row access without horizontal page overflow, and mobile navigation remains usable.

Successful mutations invalidate only affected selected-child resources. Failed mutations leave submitted form values intact. Parent feedback and child text never reach browser console or client telemetry.

## 5. Test Design

| Area | Evidence |
| --- | --- |
| API client | Endpoint/query/header, parent token, abort signal, signed media read, idempotency header tests |
| Child switching | Reset aborts old request, clears data before new child load, ignores abort errors |
| Today | Loading, empty, partial, retryable-error and ready aggregate states |
| Tasks and logs | All five dimensions, filters, create/edit/complete/confirm/cancel, create/edit log |
| Mistakes | Academic-only create/update and private-media IDs |
| Reports | Monday read and feedback-only patch |
| Reminders | Partial source labels and nested quiet-hours settings |
| Rewards | Create, redeem, stable-key retry and insufficient-balance handling |
| Backend smoke | Parent create -> complete -> confirm task with real API and star-award state |
| Browser | Desktop and 360px task creation, child switch, log/mistake creation, report/reminder/reward access |

Gate commands:

```bash
cd frontend/web && npm ci && npm run test:ci
cd frontend/web && npm run build
npm run test:family-regression
git diff --check
```

## 6. Acceptance and Non-Goals

The gate requires all seven routes to use selected-child data, explicit loading/empty/error/partial states, private signed-media flows where the API supports media references, stable reward redemption, keyboard access, and 360px support. Task 9 does not add child PIN routes, backend data models or endpoints, a cross-role E2E suite, or school UI restoration.

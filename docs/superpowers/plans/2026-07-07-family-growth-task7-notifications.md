# Task 7 Family Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build product Task 7 reminder settings and read-time family reminders for the family growth MVP.

**Architecture:** Notification-service owns `ReminderSettings` and derives reminders on read through an injected source repository. The route uses signed gateway identity, family-local dates, deterministic IDs, category switches, and partial degradation by source. Gateway exposes only the family reminder and settings prefixes.

**Tech Stack:** Node.js, Express, Mongoose, Jest, Supertest, existing gateway identity middleware, existing family date/response helpers.

---

## File Map

| Path | Action | Responsibility |
| --- | --- | --- |
| `backend/services/notification-service/app.js` | Create | Side-effect-free app factory and route injection |
| `backend/services/notification-service/server.js` | Modify | Move Mongo/RabbitMQ/Socket.IO/listen side effects behind `startServer` |
| `backend/services/notification-service/models/ReminderSettings.js` | Create | Unique per-family reminder settings |
| `backend/services/notification-service/services/familyReminderService.js` | Create | Derive reminders, dedupe, sort, partial metadata |
| `backend/services/notification-service/services/familyNotificationSourceRepository.js` | Create | Production read adapter for tasks, mistakes, logs, and reports |
| `backend/services/notification-service/routes/familyNotifications.js` | Create | `GET /family`, `GET /settings`, `PATCH /settings` |
| `backend/services/notification-service/__tests__/familyNotifications.test.js` | Create | Task 7 numbered cases |
| `backend/gateway/server.js` | Modify | Proxy Task 7 notification prefixes |
| `backend/gateway/__tests__/familyTask7Routes.test.js` | Create | Gateway proxy/identity coverage |
| `docs/development/family-growth-task7-gate.md` | Create | Final gate evidence |
| `docs/development/family-growth-requirement-traceability.md` | Modify | Move `FR-NOTIFY-*` to covered after final gate |
| `docs/product/family-learning-tracker.md` | Modify | Move `FR-NOTIFY-*` to implemented after final gate |

## Task 1: Side-Effect-Free Notification App

**Files:**
- Create: `backend/services/notification-service/app.js`
- Modify: `backend/services/notification-service/server.js`
- Test: `backend/services/notification-service/__tests__/familyNotifications.test.js`

- [ ] **Step 1: Write failing import/startup test**

```js
test('TC-T7-REG-001 createApp mounts injected routes without opening external resources', async () => {
  const familyRouter = require('express').Router();
  familyRouter.get('/probe', (req, res) => res.json({ ok: true }));
  const app = createApp({ familyNotificationsRouter: familyRouter, logger: silentLogger });

  await request(app).get('/api/notifications/family/probe').expect(200, { ok: true });
});
```

- [ ] **Step 2: Run RED**

```bash
npx jest backend/services/notification-service/__tests__/familyNotifications.test.js --runInBand --testNamePattern='TC-T7-REG-001'
```

Expected: fail because `app.js` does not exist or no injected route is mounted.

- [ ] **Step 3: Implement `createApp` and explicit `startServer`**

`createApp` must mount legacy routes and optional family route. `server.js` must only connect/listen when executed directly or when `startServer` is called.

- [ ] **Step 4: Run GREEN and commit**

```bash
npx jest backend/services/notification-service/__tests__/familyNotifications.test.js --runInBand --testNamePattern='TC-T7-REG-001'
git add backend/services/notification-service/app.js backend/services/notification-service/server.js backend/services/notification-service/__tests__/familyNotifications.test.js
git commit -m "test: add notification task7 app boundary"
```

## Task 2: ReminderSettings Model and Settings Routes

**Files:**
- Create: `backend/services/notification-service/models/ReminderSettings.js`
- Create: `backend/services/notification-service/routes/familyNotifications.js`
- Test: `backend/services/notification-service/__tests__/familyNotifications.test.js`

- [ ] **Step 1: Write failing `TC-T7-SETTINGS-001` through `004`**

Tests cover default creation, parent patch, validation, child read-only, and cross-family denial.

- [ ] **Step 2: Run RED**

```bash
npx jest backend/services/notification-service/__tests__/familyNotifications.test.js --runInBand --testNamePattern='TC-T7-SETTINGS'
```

- [ ] **Step 3: Implement model and routes**

Use `authenticateGateway`, reject body `familyId`, and validate weekday/time/switches.

- [ ] **Step 4: Run GREEN and commit**

```bash
npx jest backend/services/notification-service/__tests__/familyNotifications.test.js --runInBand --testNamePattern='TC-T7-SETTINGS'
git add backend/services/notification-service/models/ReminderSettings.js backend/services/notification-service/routes/familyNotifications.js backend/services/notification-service/__tests__/familyNotifications.test.js
git commit -m "feat: add family reminder settings"
```

## Task 3: Derived Reminder Service

**Files:**
- Create: `backend/services/notification-service/services/familyReminderService.js`
- Create: `backend/services/notification-service/services/familyNotificationSourceRepository.js`
- Modify: `backend/services/notification-service/routes/familyNotifications.js`
- Test: `backend/services/notification-service/__tests__/familyNotifications.test.js`

- [ ] **Step 1: Write failing `TC-T7-NOTIFY-001` through `012`**

Tests use an injected source repository and cover category rules, switches, timezone, dedupe, ordering, authorization, partial degradation, and privacy.

- [ ] **Step 2: Run RED**

```bash
npx jest backend/services/notification-service/__tests__/familyNotifications.test.js --runInBand --testNamePattern='TC-T7-NOTIFY'
```

- [ ] **Step 3: Implement derivation**

Build reminders for `task_today`, `task_overdue`, `mistake_review`, `dimension_physical`, `dimension_moral`, `dimension_labor`, and `weekly_report`. Wrap each source read independently and populate `meta.unavailableSources`.

- [ ] **Step 4: Run GREEN and commit**

```bash
npx jest backend/services/notification-service/__tests__/familyNotifications.test.js --runInBand
git add backend/services/notification-service/services/familyReminderService.js backend/services/notification-service/services/familyNotificationSourceRepository.js backend/services/notification-service/routes/familyNotifications.js backend/services/notification-service/__tests__/familyNotifications.test.js
git commit -m "feat: derive family growth reminders"
```

## Task 4: Gateway Wiring

**Files:**
- Modify: `backend/gateway/server.js`
- Create: `backend/gateway/__tests__/familyTask7Routes.test.js`

- [ ] **Step 1: Write failing gateway tests**

Cover `/api/notifications/family` and `/api/notifications/settings` proxying to notification-service with signed identity.

- [ ] **Step 2: Run RED**

```bash
npm test --prefix backend/gateway -- --runInBand familyTask7Routes
```

- [ ] **Step 3: Add proxy mappings**

Do not expose legacy school notification routes as part of family MVP.

- [ ] **Step 4: Run GREEN and commit**

```bash
npm test --prefix backend/gateway -- --runInBand familyTask7Routes
git add backend/gateway/server.js backend/gateway/__tests__/familyTask7Routes.test.js
git commit -m "feat: route family notifications through gateway"
```

## Task 5: Final Gate and Traceability

**Files:**
- Create: `docs/development/family-growth-task7-gate.md`
- Modify: `docs/development/family-growth-requirement-traceability.md`
- Modify: `docs/product/family-learning-tracker.md`
- Modify: `docs/superpowers/plans/2026-07-07-family-growth-task7-notifications.md`

- [ ] **Step 1: Run focused tests**

```bash
npx jest backend/services/notification-service/__tests__/familyNotifications.test.js --runInBand
npm test --prefix backend/gateway -- --runInBand familyTask7Routes
```

- [ ] **Step 2: Run family regression**

```bash
npm run test:family-regression
```

If unfinished Task 6 analytics rows are outside the current Task 7 gate, record that explicitly; do not claim Task 6 complete.

- [ ] **Step 3: Static checks**

```bash
git diff --check
rg -n "\b(describe|it|test)\.skip\(|\.only\(|test-only error|process\.exit" backend/services/notification-service backend/gateway/__tests__/familyTask7Routes.test.js
```

- [ ] **Step 4: Record gate and update traceability**

Only after passing evidence, update `FR-NOTIFY-001` and `FR-NOTIFY-002` to implemented/COVERED.

- [ ] **Step 5: Commit gate docs**

```bash
git add docs/development/family-growth-task7-gate.md docs/development/family-growth-requirement-traceability.md docs/product/family-learning-tracker.md docs/superpowers/plans/2026-07-07-family-growth-task7-notifications.md
git commit -m "docs: record task7 notification gate"
```

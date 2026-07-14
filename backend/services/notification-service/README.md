# Notification Service

Current family-growth responsibility: read-time family reminders and per-family reminder settings.

Task 7 intentionally does not implement push notifications, email, SMS, background schedulers or third-party messaging. Older README content about delivery channels, RabbitMQ queues, templates and notification preference models is not part of the accepted family-growth baseline.

## Current Family MVP Surface

- `GET /api/notifications/family`
- `GET /api/notifications/settings`
- `PATCH /api/notifications/settings`

The family routes use signed gateway identity. Parents can read and patch settings; children can read settings and their own reminders only.

## Current Family Models and Services

- `models/ReminderSettings.js`
- `routes/familyNotifications.js`
- `services/familyReminderService.js`
- `services/familyNotificationSourceRepository.js`

Reminders are derived on read from bounded source repositories. `familyNotificationSourceRepository.js`
is only an adapter around `backend/common/repositories/familyReadRepository.js`: it supplies
`familyId`, `childId`, LocalDate, cutoff and timeout parameters, and must not import private
homework, progress or analytics models. If one source fails, available reminders still return
with `meta.partial=true` and approved source names only.

The adapter requests an inclusive request-time cutoff so a write committed at the same clock
instant is immediately visible. Weekly-report snapshot aggregation keeps the shared repository's
default exclusive cutoff, preserving its historical boundary semantics.

Source MongoDB reads apply `maxTimeMS`; configure it with `NOTIFICATION_SOURCE_MAX_TIME_MS`, default `3000`.

## Legacy Surface Still Present

- `models/Notification.js`
- `routes/notifications.js`

These legacy notification records support older tests and compatibility. They are not push delivery infrastructure.

## Dependencies

Runtime dependencies are Express, Mongoose, CORS and dotenv. There is no Redis, RabbitMQ, email, SMS or push SDK dependency in `package.json`.

## Tests

```bash
npx jest backend/services/notification-service/__tests__/familyNotifications.test.js --runInBand
```

Family regression also exercises the gateway notification route:

```bash
npm run test:family-regression
```

# Backend Services

This directory contains both accepted family-growth MVP services and legacy school-oriented services retained for compatibility. The family-growth source of truth is the product/API/architecture documentation under `docs/`, not old service boilerplate.

## Current Service Inventory

| Service | Family-growth status | Current role |
| --- | --- | --- |
| `user-service` | active | Parent auth, family, children, child PIN login and child profile media references. |
| `homework-service` | active | Five-dimension `GrowthTask` APIs; legacy homework routes remain. |
| `progress-service` | active | Growth logs, knowledge points, star ledger and rewards; legacy progress routes remain. |
| `analytics-service` | active | Family mistakes and deterministic weekly reports; legacy analytics routes remain. |
| `resource-service` | active | Private media and media reference tracking; legacy resource routes remain. |
| `notification-service` | active | Read-time family reminders and reminder settings; legacy notification records remain. |
| `interaction-service` | compatibility only | Old messages, announcements and meetings; not required by Task 1-7 family MVP gates. |
| `data-service` | legacy only | Old school data entry routes; not part of the current family MVP path. |
| `auth-service` | legacy/experimental | Standalone auth service; accepted family auth lives in `user-service`. |

## Family Regression

Run the accepted family backend gate from the repository root:

```bash
npm run test:family-regression
```

The root CI workflow installs dependencies with `npm ci` before running this gate.

## Documentation Rule

Service README files should describe current implemented surfaces and explicitly label retained legacy surfaces. Do not document future capabilities such as AI analytics, push delivery, S3 storage, school administration or rich classroom workflows as if they were implemented.

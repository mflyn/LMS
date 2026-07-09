# Architecture Documents

This directory contains the architecture baseline for the family-growth MVP.

## Source Of Truth

- [Family learning tracker architecture](./family-learning-tracker-architecture.md)
- [ADR 0001: reuse existing services](./decisions/0001-reuse-existing-services.md)
- [ADR 0002: family data isolation](./decisions/0002-family-data-isolation.md)
- [ADR 0003: family local date](./decisions/0003-family-local-date.md)
- [ADR 0004: single-occurrence growth tasks](./decisions/0004-single-occurrence-growth-tasks.md)
- [ADR 0005: idempotent star ledger](./decisions/0005-idempotent-star-ledger.md)
- [ADR 0006: signed gateway identity envelope](./decisions/0006-signed-gateway-identity-envelope.md)
- [ADR 0007: stable weekly report history](./decisions/0007-stable-weekly-report-history.md)
- [Task 7 code review remediation and database boundary plan](../development/family-growth-task7-code-review-remediation.md)

## Current Architecture Scope

The Task 1-7 baseline is a family-growth tracker, not a school LMS. Active family MVP services are:

- `gateway`
- `user-service`
- `homework-service`
- `progress-service`
- `analytics-service`
- `resource-service`
- `notification-service`
- MongoDB replica set
- `frontend/web` after Task 8 replaces the legacy school shell

`interaction-service`, teacher/admin/classroom management, video meetings, announcements and complex message flows are compatibility or future work. They are not required by the current family-growth gate.

## Documentation Rule

When architecture changes, update the main architecture document, the relevant ADR, the API contract if routes change, and `docs/development/family-growth-requirement-traceability.md`.

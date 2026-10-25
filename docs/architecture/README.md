# Architecture Documents

This directory covers the confirmed long-term goal of family self-directed learning, the implemented
FGT-MVP-1.7 family-growth foundation, and the PLANNED SL-01 through SL-07 increment. These are distinct
layers, not a claim that the increment or educational outcomes have been delivered.

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

The implemented Task 1-12 foundation is a family-growth tracker, not a school LMS. Active services are:

- `gateway`
- `user-service`
- `homework-service`
- `progress-service`
- `analytics-service`
- `resource-service`
- `notification-service`
- MongoDB replica set
- `frontend/web` with the implemented parent and child family workflows

`interaction-service`, teacher/admin/classroom management, video meetings, announcements and complex message flows are compatibility or future work. They are not required by the current family-growth gate.

## Current Increment And Proposed Extensions

The [R3 application assembly proposal](./family-self-directed-learning-r3-assembly-proposal.md) covers activation,
compatibility and rollback after R2 closure. It is awaiting approval; production routes remain disconnected and the T1 gate remains open.

The self-directed-learning goal is confirmed. Implementation remains PLANNED: the main architecture §12
and API §14 define the T0 contract; the system design supplies relationships, interactions and sequences,
not a second request schema. AI/K12 and long-term projects remain outside this increment.

- [Family self-directed learning system design](./family-self-directed-learning-system-design.md) — proposed implementation baseline for direction C: child-led planning, age-adaptive scaffolding, parent review, a math-first pilot, local deployment, phased AI/K12 adoption, and an explicitly deferred long-term learning-project reserve. Its upper-level theory and program are in [the research document](../research/family-self-directed-learning-theory-and-program.md). None of its draft routes or models are approved current behavior.
- [Family AI learning platform design](./family-ai-learning-platform-design.md) — draft architecture for integrating the LMS with DeepTutor, K12-KGraph, and parent-reviewed handwriting workflows. The LMS remains the authority; none of the draft routes or models are part of the approved baseline yet.
- [ThinkPad X230i deployment supplement](../ThinkPad_DeepTutor_K12_部署手册/00_总目录与实施路线.md) — staged, low-resource validation and operations guidance for the proposed extension.

## Documentation Rule

When architecture changes, update the main architecture document, the relevant ADR, the API contract if routes change, and `docs/development/family-growth-requirement-traceability.md`.

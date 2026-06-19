# Family Growth Requirements and Architecture Remediation Review

**Status:** IMPLEMENTED_PENDING_BASELINE_FREEZE
**Date:** 2026-06-19
**Scope:** Six P1 findings from the second requirements and architecture review

## Decision Summary

| Finding | Resolution | Normative locations |
| --- | --- | --- |
| MongoDB deployment cannot run reward transactions | All supported Compose and Kubernetes family-growth deployments use replica set `rs0`; single-node layouts are non-HA demo/staging only | architecture 9; Task 5 design 8/10; deployment manifests |
| Pending-task deletion rewrites historical reports | Tasks are soft-cancelled, report cutoff formulas are explicit, and ended-week statistics freeze | product 5.7/10.4; architecture 4.3/4.7; ADR-0007; API 3.5/7 |
| API inventory is not a complete contract | Added family/child, task mutation, mistake update, report feedback, media and reminder-setting contracts plus role field permissions | API 2.8, 3.5, 4.1, 6.3, 7.2, 8, 10.2 |
| Frontend flows are not normative | Added parent/child route guards, child switching, page states, responsive/accessibility and end-to-end requirements | product 10.3/10.4; architecture 8.3; transition Tasks 8-11 |
| Image features lack upload/privacy design | Added private MediaAsset lifecycle, MIME/signature/size/EXIF rules, authorized URLs, soft delete and retention | product 9.11/10.4; architecture 4.8; API 8; transition Task 6.5 |
| Reminder report day has no source | Added unique ReminderSettings, settings APIs, timezone, quiet hours, deduplication and stable ordering | product 9.10/10.4; architecture 4.8; API 10.2; transition Task 7 |

## Compatibility Decisions

- Existing arbitrary task attachment metadata is no longer accepted. Until private media is implemented, attachment input returns `400 MEDIA_NOT_ENABLED`.
- Existing pending GrowthTask rows are preserved on delete as `cancelled`; completed and confirmed rows continue to become `archived`.
- This is an approved semantic correction requested by the product owner, but it is not a frozen baseline until the manifest/hash review is rerun.

## Verification Evidence

- Homework growth-task route suite covers soft cancellation, idempotent delete replay, terminal edit rejection and attachment rejection.
- Root, China and legacy Compose files pass `docker compose config --quiet`.
- Kubernetes manifests pass `kubectl kustomize deployment/kubernetes`.
- Requirement IDs are mapped in the traceability matrix; no six-finding legacy phrases remain in normative documents.

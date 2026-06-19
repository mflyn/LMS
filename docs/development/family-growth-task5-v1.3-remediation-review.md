# Task 5 v1.3 Remediation Review

**Review ID:** FGT-T5-RR-2026-06-19
**Status:** GATE_PASSED_PENDING_PRODUCT_APPROVAL
**Baseline under review:** `family-growth-baseline-v1.3`
**Scope:** Six reported post-baseline findings plus one deployment dependency found during remediation review

## Findings

| ID | Severity | Root cause | Resolution | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `FGT-T5-RM-001` | P1 | Compose user-service signed JWTs with a committed fallback while gateway verified the external value. | Both root and China Compose require the same external `JWT_SECRET`. | `TC-T5-DEPLOY-001` failed on both files, then passed. | CLOSED |
| `FGT-T5-RM-002` | P1 | Kubernetes workloads referenced `family-growth-secrets` without a creation or rotation workflow. | Added an environment-to-stdin `kubectl` workflow, validation, deployment instructions, and removed the committed fallback JWT Secret. | `TC-T5-DEPLOY-002` dry-run and Kustomize rendering pass. | CLOSED |
| `FGT-T5-RM-003` | P1 | progress-service treated a successful Mongo connection as sufficient transaction readiness. | Startup now requires a writable replica-set primary with logical sessions and transaction-capable wire version. | Standalone, secondary, and old-replica tests failed before the guard; all topology cases now pass. | CLOSED |
| `FGT-T5-RM-004` | P1 | Root Jest scheduled stateful family Mongo suites together with legacy projects, allowing host contention to alter Task 5 timing. | `test:nocoverage` runs family projects in an isolated serial process before the legacy-only process. | Two same-commit family runs each passed 28 suites and 231 tests in 56 seconds. | CLOSED |
| `FGT-T5-RM-005` | P2 | Reward redemption validated and stored the raw idempotency header. | The route trims once, validates the normalized 1-128-character value, and passes that value to transaction persistence. | Unicode whitespace rejection and normalized replay failed before the fix; 13 reward tests pass. | CLOSED |
| `FGT-T5-RM-006` | P3 | The knowledge-point update response example retained the pre-update mastery value. | The response now returns `skilled`, and a JSON example contract test compares request and response values. | `TC-T5-CONTRACT-001` failed with `learning`, then passed. | CLOSED |
| `FGT-T5-RM-007` | P1 | user, interaction, and resource Kubernetes workloads used gateway authentication without receiving its identity secret. | All gateway-authenticated supported workloads now reference `family-growth-secrets/gateway-identity-secret`. | The deployment reference test failed for all three manifests, then all six workload cases passed. | CLOSED |

## Review Checks

- No production credential or rendered Secret is committed.
- Secret values are not passed as command-line arguments or written to temporary files by the deployment workflow.
- The immutable v1.3 tag remains unchanged; remediation commits are descendants of that tag.
- Startup rejects unsupported database topology before `listen`.
- Idempotency validation and persistence use one normalized value.
- Root family and legacy projects remain visible as separate phases; legacy failures cannot hide a failed family phase.
- Numbered test cases and requirement traceability include all remediation behavior.

## Decision

All remediation review findings are closed, and the Task 5 remediation gate passed on candidate `0eb011f2`. A corrected immutable baseline requires explicit product-owner approval; the existing v1.3 tag must not move.

# Task 5 Implementation Review

**Review ID:** FGT-T5-IR-2026-06-19
**Status:** APPROVED
**Scope:** Task 5 production code, tests, gateway, configuration, deployment, and requirement traceability

## Findings

| ID | Severity | Finding | Resolution | Status |
| --- | --- | --- | --- | --- |
| `FGT-T5-IMP-001` | BLOCKER | progress-service read `MONGODB_URI`/`PROGRESS_SERVICE_PORT` while supported deployments supplied `MONGO_URI`/`PORT`, causing localhost database use and the wrong listen port. | Standard variables now take precedence with legacy fallback; startup regression asserts the deployed contract. | CLOSED |
| `FGT-T5-IMP-002` | BLOCKER | homework-service Kubernetes probes used `/health`, but the service had no health route. | Added the endpoint and a real Supertest probe assertion. | CLOSED |
| `FGT-T5-IMP-003` | BLOCKER | gateway ignored `PORT=3000` and lacked required production secrets in supported manifests. | Standard `PORT` now takes precedence; Compose and Kubernetes provide external JWT and gateway-identity secret references. | CLOSED |
| `FGT-T5-IMP-004` | MAJOR | The award client accepted an empty success payload and could mark a task awarded without a ledger result. | Require boolean `awarded`, non-empty `ledgerEntryId`, and non-negative integer `starBalance`; malformed success remains pending. | CLOSED |
| `FGT-T5-IMP-005` | MAJOR | The outer redemption retry classified only the first guard-upsert duplicate race. | Added explicit `TransientTransactionError` label classification while excluding domain errors. | CLOSED |
| `FGT-T5-IMP-006` | MAJOR | Replica-set services could start before the one-shot initializer elected a primary. | progress-service and homework-service now wait for Mongo health and successful initialization in both Compose variants. | CLOSED |
| `FGT-T5-IMP-007` | MAJOR | The homework Jest command had duplicate configurations and mixed invalid school-era suites into the family-growth gate. | Kept one canonical config, isolated five classified legacy suites, and retained real Homework model, growth-task, client, and full root legacy projects. | CLOSED |
| `FGT-T5-IMP-008` | MINOR | Task 5 write paths lacked the identifiers and replay result required by the observability design. | Added an explicit-field audit helper and mutation logs without headers or credentials. | CLOSED |
| `FGT-T5-IMP-009` | MAJOR | The test catalog contained two regression case IDs without direct code-test names. | Kept them as executable gate cases: targeted family regression and exact root regression, with command/result evidence recorded in the final gate document. | CLOSED |
| `FGT-T5-IMP-010` | MAJOR | The approved user-service gate command also loaded nine classified school-era suites and retained an open handle after their failures. | The family user-service config now retains the four valid family/User/auth suites and isolates the nine legacy path/controller suites; root legacy projects remain the compatibility evidence. | CLOSED |
| `FGT-T5-IMP-011` | MAJOR | Root multi-project execution could race two in-memory Mongo port selections, failing the otherwise green growth-task suite and then dereferencing an uncreated server in cleanup. | Homework setup retries only the explicit random-port collision up to three times and guards cleanup; all other startup errors remain fatal. | CLOSED |

## Review Results

- Authorization queries derive family ownership from `Family` and `User`; request `familyId` never grants access.
- Ledger awards are idempotent by task source; reward spending uses a replica-set transaction and per-child write guard.
- Confirmation failure remains recoverable as `confirmed + pending`; retries do not overwrite confirmation feedback or time.
- Gateway exposes only the three public Task 5 prefixes; the internal command has no gateway registration.
- Production credentials are environment or Kubernetes Secret references; no real secret is committed.
- Root/China Compose and Kubernetes manifests render successfully with a single-node non-HA replica set for demo/staging.

## Fresh Review Regression

| Scope | Result |
| --- | --- |
| gateway | 3 suites, 7 tests passed |
| homework-service | 3 suites, 34 tests passed |
| progress-service | 11 suites, 75 tests passed |
| Compose/Kubernetes syntax | root PASS, China PASS, kustomize PASS |
| `git diff --check` | PASS |

## Decision

All implementation-review findings are closed. The documented final gate passed on candidate `55d48090`, and product owner linmingfeng approved immutable v1.3 baseline tagging on 2026-06-19.

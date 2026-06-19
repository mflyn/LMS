# Task 5 Design Review Record

**Review ID:** FGT-T5-DR-2026-06-19
**Baseline candidate:** FGT-MVP-1.3
**Status:** READY_FOR_USER_REVIEW
**Scope:** Product requirements, architecture, detailed design, API contract, and traceability for Task 5

## Review Criteria

- Every Task 5 behavior has a stable requirement ID and observable acceptance result.
- Every public and internal operation has an actor, request contract, authorization rule, success result, and stable failure result.
- Data ownership, field constraints, indexes, transaction boundaries, idempotency, concurrency, timeout, retry, rollback, and deployment prerequisites are explicit.
- No Task 6+ feature is pulled into Task 5 without a direct Task 5 requirement.
- No BLOCKER or MAJOR finding remains open before test design begins.

## Findings

| ID | Severity | Finding | Resolution | Status |
| --- | --- | --- | --- | --- |
| FGT-T5-DES-001 | BLOCKER | Ledger-only balance checks allow concurrent redemptions for different rewards to observe the same balance and overspend through write skew. | Added per-child `StarLedgerGuard` version document; every redemption transaction writes it before reading balance, forcing concurrent transactions to conflict and retry. | CLOSED |
| FGT-T5-DES-002 | MAJOR | The baseline API listed GrowthLog update and KnowledgePoint query/update but did not define their fields, authorization, response, or errors. | Added complete operation contracts and role-specific field authorization. | CLOSED |
| FGT-T5-DES-003 | MAJOR | Internal service authentication required a credential but did not define secret separation, minimum strength, comparison, startup validation, or errors. | Defined an independent 32-character minimum token, SHA-256 digest constant-time comparison, startup validation, and `INVALID_SERVICE_CREDENTIAL`. | CLOSED |
| FGT-T5-DES-004 | MAJOR | Reward and ledger collections shared one pagination tuple, making totals and page semantics ambiguous. | Defined independent reward and ledger pagination objects and query parameters. | CLOSED |
| FGT-T5-DES-005 | MAJOR | Reusing a redemption idempotency key for another operation had no defined outcome. | Defined same-operation replay and `409 IDEMPOTENCY_KEY_REUSED` for conflicting reuse. | CLOSED |
| FGT-T5-DES-006 | MAJOR | `completedTaskIds` could be misread as trusted cross-service task ownership evidence. | Explicitly defined it as optional opaque metadata that is never used for authorization, awards, or report totals. | CLOSED |
| FGT-T5-DES-007 | MAJOR | Reward transaction requirements did not state the MongoDB topology needed to make transactions real. | Required a replica set and `MongoMemoryReplSet` integration tests; prohibited non-transactional fallback. | CLOSED |
| FGT-T5-DES-008 | MAJOR | Concurrent task confirmations did not define behavior for the loser of the conditional state update. | Required re-read and state-table handling rather than a generic error. | CLOSED |

## Artifact Review

| Artifact | Result | Notes |
| --- | --- | --- |
| Product requirements | PASS | Added `NFR-SEC-003` and `NFR-DATA-002`; Task 5 functional scope unchanged. |
| Overall architecture | PASS | Links the Task 5 detail and defines internal service trust boundary. |
| Detailed design | PASS | Components, models, indexes, role fields, saga, transaction guard, configuration, rollback, and gate criteria are explicit. |
| API contract | PASS | Public and internal Task 5 operations are specified without pagination or idempotency ambiguity. |
| Traceability | PASS | All Task 5 functional and non-functional requirements are present as planned rows. |

## Review Evidence

```bash
rg -n "TBD|TODO|implement later|fill in|待定|稍后补充" \
  docs/superpowers/specs/2026-06-19-family-growth-task5-design.md \
  docs/api/family-learning-tracker-api.md
git diff --check
```

Results: no placeholders found; `git diff --check` passed.

## Decision

There are no open BLOCKER or MAJOR design findings. The written design may proceed to test strategy and test-case design only after the product owner reviews and approves this baseline candidate.

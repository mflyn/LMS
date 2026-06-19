# Task 5 Test Design Review

**Review ID:** FGT-T5-TR-2026-06-19
**Baseline candidate:** FGT-MVP-1.3
**Status:** READY_FOR_USER_REVIEW
**Scope:** Test strategy, numbered cases, traceability, and TDD implementation plan

## Review Criteria

- Every approved Task 5 requirement maps to one or more numbered cases.
- Cases cover success, validation, authorization, family/sibling isolation, state, idempotency, concurrency, rollback, configuration, gateway exposure, and regression.
- Transaction evidence runs on a replica set and exercises real database behavior.
- Every case names an executable test file and every implementation task has a RED/GREEN command.
- Each implementation checkpoint includes review and requires all findings to close before proceeding.

## Findings

| ID | Severity | Finding | Resolution | Status |
| --- | --- | --- | --- | --- |
| FGT-T5-TEST-001 | BLOCKER | Sequential redemption tests cannot prove ledger-derived balance is safe from concurrent write skew. | Added `TC-T5-REWARD-011`, requiring concurrent redemption of two different rewards with balance sufficient for only one. | CLOSED |
| FGT-T5-TEST-002 | MAJOR | Internal award tests initially covered only route credentials, not missing/short credential failure in both calling and receiving services. | Expanded `TC-T5-STAR-002` and added `starAwardClient.test.js` to the mandatory suites and plan. | CLOSED |
| FGT-T5-TEST-003 | MAJOR | A standalone MongoMemoryServer cannot prove transactional reward behavior. | Standardized all progress Task 5 suites on one `MongoMemoryReplSet` lifecycle and prohibited standalone transaction evidence. | CLOSED |
| FGT-T5-TEST-004 | MAJOR | Reward and ledger pagination could pass while one collection's metadata referred to the other. | Added independent pagination assertions in `TC-T5-REWARD-004`. | CLOSED |
| FGT-T5-TEST-005 | MAJOR | Idempotent replay coverage did not distinguish a same-operation replay from key reuse on another reward. | Added `TC-T5-REWARD-007` and `TC-T5-REWARD-008` with distinct expected results. | CLOSED |
| FGT-T5-TEST-006 | MAJOR | A saga happy-path test would not prove recovery after an award succeeded but the task remained pending. | Added timeout/pending/retry/already-awarded/concurrent cases `TC-T5-SAGA-002`-`005`. | CLOSED |
| FGT-T5-TEST-007 | MAJOR | Public-route tests alone could accidentally expose the internal command through gateway configuration. | Added explicit gateway absence case `TC-T5-GW-002`. | CLOSED |
| FGT-T5-TEST-008 | MINOR | Planned test evidence in the traceability matrix did not identify concrete cases. | Added designed case IDs to all Task 5 trace rows while retaining `PLANNED_TASK_5_PLUS` until implementation passes. | CLOSED |

## Coverage Result

The catalog contains 46 unique cases:

- 10 GrowthLog cases.
- 8 KnowledgePoint cases.
- 7 internal star and ledger cases.
- 11 reward and transaction cases.
- 6 confirmation saga cases.
- 2 gateway cases.
- 2 regression gate cases.

All nine Task 5 functional and cross-cutting requirements in the approved detailed design have explicit case coverage.

## Evidence

```bash
rg -o 'TC-T5-[A-Z]+-[0-9]+' docs/development/family-growth-task5-test-cases.md | sort -u | wc -l
rg -n "TBD|TODO|implement later|fill in details|similar to" \
  docs/development/family-growth-task5-test-cases.md \
  docs/superpowers/plans/2026-06-19-family-growth-task5-implementation.md
git diff --check
```

Expected and observed before sign-off: 46 unique IDs, no placeholder matches, and no whitespace errors.

## Decision

No BLOCKER, MAJOR, or MINOR test-design finding remains open. Test code and production implementation may begin only after product-owner review of the written test package.

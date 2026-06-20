# Task 6 Test Design Review

**Review ID:** FGT-T6-TR-2026-06-20  
**Baseline candidate:** FGT-MVP-1.4  
**Status:** APPROVED  
**Scope:** Numbered cases, requirement coverage, TDD ownership, privacy, consistency, concurrency, deployment, and regression for Task 6

## Review Criteria

- Every approved Task 6 requirement maps to executable numbered cases.
- Cases cover success, validation, authorization, family/sibling isolation, privacy, idempotency, recovery, cutoff history, concurrency, rollback, configuration, gateway exposure, and regression.
- Tests use real image signatures, metadata-bearing fixtures, fixed clocks, multiple family timezones, and transaction-capable MongoDB where atomic event writes are required.
- Every case names an owning test file and implementation planning provides RED/GREEN commands.
- Full-gate evidence is repeatable on one candidate commit and all review findings close before release approval.

## Findings

| ID | Severity | Finding | Resolution | Status |
| --- | --- | --- | --- | --- |
| `FGT-T6-TEST-001` | BLOCKER | Media tests did not prove that existing Child and GrowthTask fields use the reference protocol. | Added `TC-T6-MEDIA-016`-`018` for avatar, task attachment, recovery, replacement ordering, and raw-ID rejection. | CLOSED |
| `FGT-T6-TEST-002` | BLOCKER | Mutable current-state fixtures could not prove first-generation historical report correctness. | Expanded mistake and repository cases for atomic immutable events and made `TC-T6-REPORT-009` change state after cutoff before first report generation. | CLOSED |
| `FGT-T6-TEST-003` | MAJOR | Ended-week concurrency covered insert races but not promotion of an existing current-week row. | Expanded `TC-T6-REPORT-013`/`014` to cover recomputation, compare-and-set promotion, feedback preservation, and concurrent winners. | CLOSED |
| `FGT-T6-TEST-004` | MAJOR | Media deletion tests did not independently enforce deletion age, last-unbind age, and retained bound references. | Expanded `TC-T6-MEDIA-009`/`010` to prove immediate denial and both 30-day retention boundaries. | CLOSED |
| `FGT-T6-TEST-005` | MAJOR | Signed-content tests did not independently tamper every signed capability field or cover family-scoped avatar denial to children. | Expanded `TC-T6-MEDIA-006`-`008` for nonce/path/ID/expiry/signature tampering and avatar scope. | CLOSED |
| `FGT-T6-TEST-006` | MINOR | Child creation fields, review-status mapping, and non-integer completion percentages lacked direct assertions. | Expanded mistake cases and `TC-T6-REPORT-003` with the `2/3 = 66.67` result. | CLOSED |

## Coverage Result

The approved catalog contains 66 unique cases:

- 18 private-media and consumer-integration cases.
- 14 family-mistake cases.
- 7 family-read and cutoff-history repository cases.
- 18 weekly-report cases.
- 3 gateway cases.
- 6 startup, deployment, review, and regression cases.

All eight functional and cross-cutting requirements in the approved Task 6 detailed design have explicit case coverage.

## Evidence

```bash
rg '^\| `TC-T6-' docs/development/family-growth-task6-test-cases.md \
  | sed -E 's/^\| `([^`]+)`.*/\1/' | sort | uniq | wc -l
rg '^\| `TC-T6-' docs/development/family-growth-task6-test-cases.md \
  | sed -E 's/^\| `([^`]+)`.*/\1/' | sort | uniq -d
rg -n "TBD|TODO|implement later|fill in details|similar to|待定|稍后补充" \
  docs/development/family-growth-task6-test-cases.md
git diff --check
```

Observed before sign-off: 66 unique IDs, no duplicates, no placeholder matches, and no whitespace errors.

## Decision

No BLOCKER, MAJOR, or MINOR test-design finding remains open. Product-owner review was completed on 2026-06-20. Task 6 may proceed to TDD implementation planning.

## Sign-off

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Product owner | linmingfeng | APPROVED | 2026-06-20 |
| Technical reviewer | Codex | APPROVED | 2026-06-20 |

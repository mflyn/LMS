# 家庭成长跟踪基线清单

**baselineId:** FGT-MVP-1
**status:** IN_REVIEW
**candidateCommit:** aa63b7f609bc447b2212842be950c49ea3c3d253
**statusUpdatedAt:** 2026-06-18
**owner:** linmingfeng
**baselineApprover:** linmingfeng
**technicalReviewer:** Codex
**qualityApprover:** linmingfeng
**singleMaintainerException:** false

该清单不记录自身哈希。当前候选提交包含设计和审查证据，但存在阻断整改；代码整改或候选内容变化后必须生成新的 candidateCommit 和全部内容哈希。

| documentId | path | version | sha256 | status | owner | author | reviewers | approvers | openRisks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FGT-PRD | `docs/product/family-learning-tracker.md` | 1.0-rc1 | `32c2ad717acde75e310ab39f6a96ffa20e499ee964c0eafe18d298e855983c43` | IN_REVIEW | linmingfeng | Codex | linmingfeng | linmingfeng | `FGT-T3-001`-`FGT-T3-006` |
| FGT-ARCH | `docs/architecture/family-learning-tracker-architecture.md` | 1.0-rc1 | `02bf2cdc5a0b07a7119537b7a2cc52261304b5bfe2821a8d3843f812383fec00` | IN_REVIEW | linmingfeng | Codex | linmingfeng | linmingfeng | `FGT-T3-001`, `FGT-T4-001`-`FGT-T4-006`, `FGT-GW-001`-`FGT-GW-004` |
| FGT-ADR-0001 | `docs/architecture/decisions/0001-reuse-existing-services.md` | 1.0-rc1 | `c076d9b2280a8cd86a5a12b42ca08559b90c7a6d40457771082c612c68d1986a` | IN_REVIEW | linmingfeng | Codex | linmingfeng | linmingfeng | none |
| FGT-ADR-0002 | `docs/architecture/decisions/0002-family-data-isolation.md` | 1.0-rc1 | `424af0bdee3d86eb0ec98fdb8f38e06dd083f4c1ee7cd2d8729d5e3c2287a77d` | IN_REVIEW | linmingfeng | Codex | linmingfeng | linmingfeng | `FGT-T4-006` |
| FGT-ADR-0003 | `docs/architecture/decisions/0003-family-local-date.md` | 1.0-rc1 | `4cd0a1a49d327c02b1eee703ae26d5145f2b1477d8a701d12e95588bcc83cf8c` | IN_REVIEW | linmingfeng | Codex | linmingfeng | linmingfeng | `FGT-T3-001`, `FGT-T4-001` |
| FGT-ADR-0004 | `docs/architecture/decisions/0004-single-occurrence-growth-tasks.md` | 1.0-rc1 | `d8cb4a99984aea9ddfd766ede332ecdd8e8ab5912811bf55ae57c851feb880ba` | IN_REVIEW | linmingfeng | Codex | linmingfeng | linmingfeng | `FGT-T4-002` |
| FGT-ADR-0005 | `docs/architecture/decisions/0005-idempotent-star-ledger.md` | 1.0-rc1 | `65beff3a265a248864f05d0e318f21be2ec8cc3ed3b41b0b0640f25bfba15f33` | IN_REVIEW | linmingfeng | Codex | linmingfeng | linmingfeng | none; planned Task 5 |
| FGT-ADR-0006 | `docs/architecture/decisions/0006-signed-gateway-identity-envelope.md` | 1.0-rc1 | `c2d3e65fb2ccd5935b99eea7a0c573014697ca56a67bf4604783230885e7dbea` | IN_REVIEW | linmingfeng | Codex | linmingfeng | linmingfeng | `FGT-GW-001`-`FGT-GW-004` |
| FGT-API | `docs/api/family-learning-tracker-api.md` | 1.0-rc1 | `b99398d1d7427294ad559176cd2c4ae966dcad581babbd54030736e87fe86e21` | IN_REVIEW | linmingfeng | Codex | linmingfeng | linmingfeng | `FGT-T3-006`, `FGT-T4-003`, `FGT-T4-005` |
| FGT-TEST | `docs/development/family-growth-test-strategy.md` | 1.0-rc1 | `405aedb86fb1dc3a4c19b3ec17d31c649b913a5a0bfd3646bc4a25e9525dd3a6` | IN_REVIEW | linmingfeng | Codex | linmingfeng | linmingfeng | missing remediation security tests |
| FGT-TRACE | `docs/development/family-growth-requirement-traceability.md` | 1.0-rc1 | `97c5da01a724b38c75fcd93c79027bd7fdd62ca243799fb25f38529356378028` | IN_REVIEW | linmingfeng | Codex | linmingfeng | linmingfeng | all open findings in review record |

## Review-open Evidence

- Product, architecture, API, test strategy and traceability are all `IN_REVIEW`.
- Task 3 tests: 2 suites, 5 tests passed.
- Task 4 tests: 1 suite, 12 tests passed.
- Open findings: 3 BLOCKER, 13 MAJOR, 1 MINOR.
- Task 5 decision: BLOCKED_REMEDIATION.

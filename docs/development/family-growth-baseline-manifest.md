# 家庭成长跟踪基线清单

**baselineId:** FGT-MVP-1
**status:** APPROVED
**candidateCommit:** 265da78a07da114f47a2f3bff861f2ddff655707
**statusUpdatedAt:** 2026-06-19
**owner:** linmingfeng
**baselineApprover:** linmingfeng
**technicalReviewer:** Codex
**qualityApprover:** linmingfeng
**singleMaintainerException:** false

该清单不记录自身哈希。`candidateCommit` 是完成代码整改、最终评审和文档审批的内容提交；下表哈希均从该提交生成。后续变更必须建立新基线，不得覆盖本记录。

| documentId | path | version | sha256 | status | owner | author | reviewers | approvers | openRisks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FGT-PRD | `docs/product/family-learning-tracker.md` | 1.0 | `cc139bb0c0fe76d4e2d82f50ed046317d331364e8dcb1992921885adafbba1ee` | APPROVED | linmingfeng | Codex | linmingfeng | linmingfeng | none |
| FGT-ARCH | `docs/architecture/family-learning-tracker-architecture.md` | 1.0 | `0173d5d32dcfc1d75b30b2273ccd937c9b5d36561ceb1296ea23f6186068478a` | APPROVED | linmingfeng | Codex | linmingfeng | linmingfeng | none |
| FGT-ADR-0001 | `docs/architecture/decisions/0001-reuse-existing-services.md` | 1.0 | `883f24725cbd697663c8a1b087eee00e7dc5e571728fcf075e6da330b1c7b593` | APPROVED | linmingfeng | Codex | linmingfeng | linmingfeng | none |
| FGT-ADR-0002 | `docs/architecture/decisions/0002-family-data-isolation.md` | 1.0 | `4c08ef2bfddcda04dcd1f9a2754729de1be8dab91284db0e0c87a99e40265331` | APPROVED | linmingfeng | Codex | linmingfeng | linmingfeng | none |
| FGT-ADR-0003 | `docs/architecture/decisions/0003-family-local-date.md` | 1.0 | `1f7f73ea7f038431edac4e7eb2a2e513ef1421b66a41bb55bc3a1ff72a5c2e90` | APPROVED | linmingfeng | Codex | linmingfeng | linmingfeng | none |
| FGT-ADR-0004 | `docs/architecture/decisions/0004-single-occurrence-growth-tasks.md` | 1.0 | `36be86735522106a1b34f512563fc77a3ec0e80e951f241edd27a744414622a6` | APPROVED | linmingfeng | Codex | linmingfeng | linmingfeng | none |
| FGT-ADR-0005 | `docs/architecture/decisions/0005-idempotent-star-ledger.md` | 1.0 | `4b02a7f0cc4a532410fedddb98b3681f581936f2af104d197f8cc860d9bb0cfb` | APPROVED | linmingfeng | Codex | linmingfeng | linmingfeng | planned Task 5 |
| FGT-ADR-0006 | `docs/architecture/decisions/0006-signed-gateway-identity-envelope.md` | 1.0 | `14b487cf156b27c1dd650a0ebfb7564248790d96776b853cfb71bebcade9311d` | APPROVED | linmingfeng | Codex | linmingfeng | linmingfeng | in-process nonce store is MVP-only |
| FGT-API | `docs/api/family-learning-tracker-api.md` | 1.0 | `68e92bc38052f9b63d7f18627d2ff39e55a2a98d31387a5ce2158eecb802d3b6` | APPROVED | linmingfeng | Codex | linmingfeng | linmingfeng | none |
| FGT-TEST | `docs/development/family-growth-test-strategy.md` | 1.0 | `8b230208adebc87a2433ce3c1924b0f8cb7b5e8af7ec457d6f3472dd13939341` | APPROVED | linmingfeng | Codex | linmingfeng | linmingfeng | full E2E begins after Task 5 |
| FGT-TRACE | `docs/development/family-growth-requirement-traceability.md` | 1.0 | `7dbd0864b1f1c4b69ec96061ec78caca33148fcd01c37fec17b07defa82d0f48` | APPROVED | linmingfeng | Codex | linmingfeng | linmingfeng | Task 5+ items remain planned |

## Approval Evidence

- Product, architecture, API, test strategy, traceability and all six ADRs are approved.
- Targeted regression: 6 suites, 52 tests passed, 0 failed.
- Findings closed: 3 BLOCKER, 16 MAJOR, 1 MINOR; no open Task 4.5 findings.
- Task 5 decision: APPROVED TO START.

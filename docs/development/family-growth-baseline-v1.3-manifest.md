# 家庭成长跟踪基线清单 v1.3

**baselineId:** FGT-MVP-1.3
**status:** GATE_PASSED_PENDING_PRODUCT_APPROVAL
**supersedes:** FGT-MVP-1.2
**candidateCommit:** 7205a0dcc8d1d846cc33925dfae11b8de78cc21a
**statusUpdatedAt:** 2026-06-19
**owner:** linmingfeng
**technicalReviewer:** Codex
**plannedTag:** `family-growth-baseline-v1.3`

本清单不记录自身哈希。`candidateCommit` 包含 Task 5 代码、全部评审修订和最终门禁证据；下表哈希均从该提交生成。产品负责人批准前不得创建计划中的不可变标签。

| Artifact | SHA-256 | Status |
| --- | --- | --- |
| `docs/product/family-learning-tracker.md` | `8631b0ea7c3ca51eeb1969d3eb1fc7a6b8265dc366b2f2ec3129122613a51dd9` | IMPLEMENTED |
| `docs/architecture/family-learning-tracker-architecture.md` | `5bddc323d18f2175e7c0e2806bd1f3a867358c1d2b62ea5d956aedbca8e99315` | APPROVED |
| `docs/architecture/decisions/0005-idempotent-star-ledger.md` | `4b02a7f0cc4a532410fedddb98b3681f581936f2af104d197f8cc860d9bb0cfb` | ACCEPTED |
| `docs/architecture/decisions/0007-stable-weekly-report-history.md` | `d70e885451018956a1ce87085f58f5cf6d2d6edbe9d8a295baa0fb28161e8584` | ACCEPTED |
| `docs/superpowers/specs/2026-06-19-family-growth-task5-design.md` | `e49cefbd4fa6d15da57fe7cf96c49bbd5c3a228204bdb198b05b2eec6bb71e0d` | APPROVED |
| `docs/api/family-learning-tracker-api.md` | `a12f110da486565cc4f7216d9ba00cdcf346905508e5a1f56a8eeb6653b8bc03` | APPROVED |
| `docs/development/family-growth-test-strategy.md` | `fd0f54d0e8a3f8e75dbb2537df218a23c269e5e0cdaaff5bc5c31135131d7d66` | APPROVED |
| `docs/development/family-growth-task5-test-cases.md` | `2369cfe21c27c52bdd4d4a25246ba0093d64b5c073c17d43bb7bb2f850acb807` | VERIFIED |
| `docs/development/family-growth-requirement-traceability.md` | `fb9cc927c9352eb7bd2e92aebff022e062f56ec66ffd5636edb71d027c41c690` | COVERED |
| `docs/development/family-growth-task5-implementation-review.md` | `08a02dbd0b7fdf03029995b5acb4b0b1566a687a7e7a353d8b0f0284345104db` | APPROVED |
| `docs/development/family-growth-task5-gate.md` | `cfd70ae252abf002b8369dd332f8a7b9a2f3cdb979b925683dd678c307d83868` | PASSED |

## Gate Summary

- 46 of 46 numbered Task 5 cases have executable code or regression-gate evidence.
- Six targeted commands passed with 256 total test executions across their reported scopes.
- Root regression completed with 210 failed and 49 passed suites; no Task 5 or family suite failed.
- Relative to v1.2: failed suites -14, passed suites +6, failed tests -30, passed tests +55.
- Root and China Compose parsing, Kubernetes rendering, generated-file cleanup, and `git diff --check` passed.
- Implementation review closed 3 BLOCKER, 7 MAJOR, and 1 MINOR findings.

## Open Risks

- Root legacy projects retain classified school-era failures; no new family failure is present.
- Repository single-node Mongo replica-set manifests are non-HA demo/staging layouts; production requires managed or multi-member topology.
- Baseline tag and final `APPROVED` status require explicit product-owner approval.

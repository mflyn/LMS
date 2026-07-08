# 家庭成长跟踪基线清单 v1.1

**baselineId:** FGT-MVP-1.1
**status:** APPROVED
**supersedes:** FGT-MVP-1
**candidateCommit:** 87c6dab425653d69328a008526acb9529cd20d7d
**statusUpdatedAt:** 2026-06-19
**owner:** linmingfeng
**technicalReviewer:** Codex

该修订基线关闭 v1 评审后的三个 Task 5 准入阻断项。`family-growth-baseline-v1` 保持不可变；Task 5 从本清单对应标签开始。

| Artifact | SHA-256 | Status |
| --- | --- | --- |
| `docs/development/family-growth-design-review.md` | `eb48c5e855d797e211fc9fdbe17195da1b42accf00a4115c341f9a3d603cdb71` | APPROVED |
| `docs/development/family-tracker-test-baseline.md` | `866400a11f812c616c7907fc2bf8fcf2e797aa9730f6cd47f36bfe074342a527` | APPROVED |
| `backend/common/middleware/errorHandler.js` | `c53aeaa2ac34cd8015b8900b4411c4cc4d5c4297da90358a8de5c68810cbdc65` | VERIFIED |
| `backend/services/progress-service/server.js` | `36dd2ee0551e0aa1559ca87736cc2af75429129972e1bf2645d3581bff15a80b` | VERIFIED |
| `backend/jest.config.js` | `a6c38901b62067602f84fe546e14e7db852f1d2621a816b2b07efa06fec73cf2` | VERIFIED |

## Gate Evidence

- Three post-approval P1 findings are closed.
- Family-common and progress projects: 14 suites, 92 tests passed.
- Progress service alone: 7 suites, 35 tests passed.
- Exact full command `npm run test:nocoverage` completed with exit code 1 and a full summary; all remaining failures are classified legacy failures.
- Full comparison: failed suites 238 to 224; passed suites 24 to 43; no new family-branch failure.

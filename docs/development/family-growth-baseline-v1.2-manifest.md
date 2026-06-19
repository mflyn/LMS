# 家庭成长跟踪基线清单 v1.2

**baselineId:** FGT-MVP-1.2
**status:** APPROVED
**supersedes:** FGT-MVP-1.1
**candidateCommit:** 60d7bbeba4c1402939bb0daa7db523996629b40e
**statusUpdatedAt:** 2026-06-19
**owner:** linmingfeng
**technicalReviewer:** Codex

该修订基线关闭 v1.1 评审后的两个 Task 5 准入阻断项。已有基线标签保持不可变；Task 5 从本清单对应标签开始。

| Artifact | SHA-256 | Status |
| --- | --- | --- |
| `docs/development/family-growth-design-review.md` | `3d603a21cd446d7636f4b006b6f697213482e59fa269877a6409486e98cb0ab6` | APPROVED |
| `docs/development/family-tracker-test-baseline.md` | `62ee88e707ddf33ea9d586e4f9af6210807ded4ce2d153198a0a8b07714353db` | APPROVED |
| `backend/common/middleware/errorHandler.js` | `65a951c5f7c1e4178bd5c04f303c59c45b2e2eec59e1534af8e5c7922049d6e9` | VERIFIED |
| `backend/common/middleware/__tests__/errorHandler.test.js` | `3f3063df02826997bffea3cd11287a3ba86f704785bc8c7db0b6bde1aa0ef373` | VERIFIED |
| `backend/services/progress-service/package.json` | `dffe276e5039a877bc6168421ca5cbdb00cdd33adb89d782fdd2325f5a03c7da` | VERIFIED |

## Gate Evidence

- Five post-approval P1 findings are closed.
- Progress Service standard command: 7 suites, 35 tests passed.
- Family-common and progress projects: 14 suites, 94 tests passed.
- Exact full command `npm run test:nocoverage` completed with exit code 1 and a full summary: 224 suites failed, 43 passed; 1126 tests failed, 18 skipped, 393 passed.
- No failed suite or failed test was added relative to v1.1; the two additional passing tests cover process-level exception logging.

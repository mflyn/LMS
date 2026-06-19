# Task 5 v1.3 Remediation Gate Evidence

**Gate ID:** FGT-T5-RG-2026-06-19
**Candidate commit:** `0eb011f21b6cf9ad7f66f0455db9a96cbe8e09ac`
**Executed at:** 2026-06-19 (Asia/Shanghai)
**Technical result:** PASS_WITH_CLASSIFIED_LEGACY_FAILURES
**Product approval:** PENDING

## Targeted Commands

| # | Command | Exit | Result |
| --- | --- | ---: | --- |
| 1 | `npm test --prefix backend/services/progress-service -- --runInBand growthLogs knowledgePoints internalStars rewards startup` | 0 | 5 suites, 48 tests passed |
| 2 | `npm test --prefix backend/services/homework-service -- --runInBand growthTasks` | 0 | 1 suite, 25 tests passed |
| 3 | `npm test --prefix backend/services/homework-service -- --runInBand starAwardClient` | 0 | 1 suite, 4 tests passed |
| 4 | `npx jest --config backend/jest.config.js --selectProjects family-common progress-service --runInBand --coverage=false` | 0 | 21 suites, 154 tests passed |
| 5 | `npm test --prefix backend/gateway -- --runInBand familyTask5Routes` | 0 | 1 suite, 3 tests passed |
| 6 | `npm test --prefix backend/services/user-service -- --runInBand family children` | 0 | 4 suites, 49 tests passed |

All six targeted commands exited 0, reporting 33 suites and 283 test executions across their overlapping scopes.

## Stability Gate

The exact `npm run test:family-regression` command ran twice on the same candidate:

| Run | Exit | Elapsed | Result |
| --- | ---: | ---: | --- |
| 1 | 0 | 56 s | 28 suites, 237 tests passed |
| 2 | 0 | 57 s | 28 suites, 237 tests passed |

Both processes exited normally. No MongoMemory process remained after the runs.

## Root Regression

`npm run test:nocoverage` exited 1 after 112 seconds, with two explicit phases:

| Phase | Suites | Tests | Result |
| --- | --- | --- | --- |
| family regression | 28 passed | 237 passed | PASS |
| classified legacy | 210 failed, 23 passed | 1096 failed, 228 passed, 18 skipped | CLASSIFIED LEGACY FAILURE |

Compared with the approved v1.3 gate, failed suites and tests are unchanged. Passed suites increased from 49 to 51 and passed tests increased from 448 to 465. No Task 5 or family project failed.

## Deployment and Artifact Checks

| Check | Result |
| --- | --- |
| Root Compose parse with three required external secrets | PASS |
| China Compose parse with the same values | PASS |
| Kubernetes Kustomize rendering | PASS |
| External `family-growth-secrets` client dry-run | PASS; all three keys present |
| Numbered Task 5 catalog | 52 distinct cases |
| Committed fallback credential scan | none found |
| Generated resource-test files | removed |
| MongoMemory child processes after gate | none |
| `git diff --check` and worktree cleanliness | PASS |

## Decision

The Task 5 v1.3 remediation technical gate passes. All seven remediation review findings are closed, every new regression case passed, and the candidate is ready for product-owner approval as corrected baseline v1.3.1. The immutable v1.3 tag remains unchanged, and no v1.3.1 tag is created before approval.

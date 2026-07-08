# Family Growth Task 6 Final Gate Evidence

**Gate ID:** FGT-T6-GATE-2026-07-08
**Code candidate commit:** `bcaaea2a`
**Executed at:** 2026-07-08 (Asia/Shanghai)
**Technical result:** PASS_WITH_CLASSIFIED_LEGACY_FAILURES
**Product approval:** PENDING

## Targeted Commands

| # | Command | Exit | Result |
| --- | --- | ---: | --- |
| 1 | `npx jest --config backend/services/resource-service/jest.family.config.js --runInBand familyMedia mediaReferences mediaCleanup familyMediaPrivacy privateMediaStore mediaCapability mediaModels` | 0 | 7 suites, 82 tests passed |
| 2 | `npx jest --config backend/services/user-service/jest.config.js --runInBand User.mediaReferences childAvatarMediaService childMediaReferences family` | 0 | 7 suites, 124 tests passed |
| 3 | `npx jest --config backend/services/homework-service/jest.config.js --runInBand GrowthTask.mediaReferences growthTaskAttachmentMediaService growthTaskMediaReferences growthTasks` | 0 | 4 suites, 210 tests passed |
| 4 | `npx jest --config backend/services/progress-service/jest.config.js --runInBand knowledgePointHistory knowledgePoints growthLogs rewards` | 0 | 4 suites, 38 tests passed |
| 5 | `npx jest --config backend/services/analytics-service/jest.config.js --runInBand task6Startup familyMistakes familyMistakeMediaSaga weeklyReports` | 0 | 4 suites, 39 tests passed |
| 6 | `npx jest --config backend/jest.family-common.config.js --runInBand familyReadRepository task6Deployment` | 0 | 2 suites, 7 tests passed |
| 7 | `npm test --prefix backend/gateway -- --runInBand familyTask6Routes` | 0 | 1 suite, 3 tests passed |

The analytics targeted command exited 0 but printed Jest's existing force-exit notice. The final full family regression runs below completed without leaked-handle warnings.

## Stability Gate

The exact `npm run test:family-regression` command ran twice on the same code candidate after the final gateway and legacy-regression remediation:

| Run | Exit | Result |
| --- | ---: | --- |
| 1 | 0 | 51 suites, 645 tests passed |
| 2 | 0 | 51 suites, 645 tests passed |

Both runs had identical totals and no leaked-handle or timeout-dependent failure.

## Root Baseline

`npm run test:nocoverage` exited 1 with two explicit phases:

| Phase | Result | Decision |
| --- | --- | --- |
| isolated family regression | 51 suites, 645 tests passed | PASS |
| classified legacy regression | 200 failed, 33 passed suites; 942 failed, 329 passed, 18 skipped tests | CLASSIFIED LEGACY FAILURE |

The family phase passed before the legacy phase. The legacy phase no longer executes Task 6 family suites under the legacy Jest project; the log contains no legacy failure for Task 6 resource or analytics family files such as `task6Startup.test.js`, `familyMedia.test.js`, `mediaReferences.test.js`, `familyMistakeMediaSaga.test.js`, `weeklyReports.test.js`, or analytics `server.test.js`.

The remaining legacy failure categories match the approved baseline classes: obsolete school-era imports, missing postponed-module dependencies, incomplete logger mocks, response drift in interaction/resource/data services, and duplicate legacy Mongoose lifecycles. The legacy suite count is lower than the v1.2 baseline because Task 6 family suites are now explicitly excluded from the legacy project after passing in the isolated family phase.

## Static Checks

| Check | Exit | Result |
| --- | ---: | --- |
| `git diff --check` | 0 | PASS |
| `rg -n "\\b(describe\|it\|test)\\.skip\\(\|\\.only\\(\|test-only error\|process\\.exit" ...` | 0 | Only `process.exitCode = 1` in analytics/progress startup error paths matched; no `process.exit()`, skip, only, or test-only error middleware was present. |
| `rg -n "TC-T6-(MISTAKE\|REPORT\|REPO\|GW\|REG)-" ...` | 0 | Required mistake, report, repository, gateway, startup, deployment, and regression case IDs are present in executable tests. |

An additional full Task 6 media case scan confirmed `TC-T6-MEDIA-*` coverage across resource-service, user-service, homework-service, analytics-service, gateway, deployment, and common tests.

## Requirement Closure

| Requirement | Evidence | Decision |
| --- | --- | --- |
| `FR-MISTAKE-001` | `TC-T6-MISTAKE-001`-`014` pass in analytics targeted suite | COVERED |
| `FR-REPORT-001` | `TC-T6-REPO-001`-`007` and `TC-T6-REPORT-001`-`018` pass | COVERED |
| `FR-MEDIA-001` | Resource media, Child avatar, GrowthTask attachments, FamilyMistake media, `TC-T6-GW-003`, deployment, and final regression pass | COVERED |
| `FR-MEDIA-002` | Resource delete/cleanup plus FamilyMistake replacement/removal unbind pass | COVERED |
| `NFR-PRIVACY-001` | Private media storage, signed URLs, redaction, child/task/mistake consumers, deployment secret checks, and static scans pass | COVERED |
| `NFR-DATA-001` | Family-scoped records, media reference state, immutable mastery/mistake events, read repository cutoff projections, and frozen weekly snapshots pass | COVERED |
| `NFR-SEC-001` | Cross-family/sibling denial, gateway identity, internal media route exclusion, signed-content-only public media content route, and unscoped repository rejection pass | COVERED |
| `NFR-TIME-001` | LocalDate validation, family timezone week cutoff, cancellation/completion cutoff rules, and historical snapshot freeze pass | COVERED |

## Decision

The Task 6 technical gate passes on code candidate `bcaaea2a`. All Task 6 backend scope for mistakes, weekly reports, mistake media references, gateway/deployment wiring, and regression evidence is implemented and verified. Product approval is still required before marking a product baseline tag.

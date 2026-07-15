# 家庭成长跟踪需求追踪矩阵

**Document status:** READY_FOR_REVIEW
**Implementation conformance:** COVERED (35/35)
**Baseline candidate:** FGT-MVP-1.6
**Implementation evidence commit:** `30d0e7bb4adddc51edc7d412f82aac8d323f2bfd`
**Revalidated at:** 2026-07-14

Conformance values are `COVERED`, `PARTIAL`, and `GAP`. `plannedTask` and
`gateAtTask` retain the historical delivery phase; conformance describes the current
Task 1~11 implementation. Every row below was reconciled against PRD 10.4, the current
design asset index, merged code, focused tests, and the unified release gate.

## Current full-gate evidence

- Implementation behavior was established on clean `main` commit
  `30d0e7bb4adddc51edc7d412f82aac8d323f2bfd`; the current clean candidate is
  revalidated with `npm run release:family`, and its exact commit is recorded in
  `release-gate-artifacts/release-gate-summary.txt`.
- Current candidate result: 70 backend suites / 756 tests, 4 Task 11 integration suites / 6 tests,
  25 frontend suites / 156 tests, production build, 4 Chromium tests, seven service
  images, eight healthy runtime services, and a private-media gateway smoke flow.
- Detailed evidence and residual boundaries are recorded in
  [the v1.6 release gate](./family-growth-v1.6-release-gate.md). Row-level evidence
  below identifies the focused contract that supplements this common full-gate run.

| Requirement | plannedTask | gateAtTask | Product section | Architecture/ADR | API | Code owner | Test evidence | Conformance | Finding |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FR-FAM-001` | 3 | 4 | 10.4 | 4.1, ADR-0002/0003 | `POST /api/families` | `Family.js`, `familyController.js` | timezone/default/unique-owner and transaction rollback tests pass | COVERED | closed `FGT-T3-001`, `FGT-T3-007`; Stage 2 atomicity remediation closed |
| `FR-FAM-002` | 3 | 4 | 10.4 | 5, 6, ADR-0002 | family read/update | `familyController.js` | ownership database tests pass | COVERED | none |
| `FR-FAM-003` | 3 | 4 | 10.4 | 3.3, ADR-0006 | auth register/login/logout | `authController.js`, `auth.js` | stable family errors, signed gateway auth, and authenticated idempotent logout contract pass | COVERED | closed `FGT-T3-006`; logout contract remediation closed |
| `FR-CHILD-001` | 3 | 4 | 10.4 | 4.2, 6 | children create/update | `User.js`, `familyController.js` | multiple children, cross-family edit, transaction rollback, full-profile and avatar UI tests pass | COVERED | Stage 2 atomicity and Stage 4 parent workflow remediations closed |
| `FR-CHILD-002` | 3 | 4 | 10.4 | 6.1/6.3 | children list/detail | `familyController.js` | self/sibling and cross-family tests pass | COVERED | none |
| `FR-CHILD-003` | 3 | 4 | 10.4 | 4.2, 6.1 | child PIN set | `User.js`, `familyController.js` | 4-6 digit bounds and reset tests pass | COVERED | closed `FGT-T3-002` |
| `FR-CHILD-004` | 3 | 4 | 10.4 | 3.3, 6.1 | child PIN login | `familyController.js`, `auth.js` | claims/12h/generic error/rate-limit tests pass | COVERED | closed `FGT-T3-004`-`FGT-T3-006`, `FGT-FR-002` |
| `FR-CHILD-005` | 3 | 4 | 10.4 | 4.2 | PIN reset/token | `User.js`, `familyController.js`, `auth.js` | stale-token rejection test passes | COVERED | closed `FGT-T3-003` |
| `FR-TASK-001` | 4 | 4 | 10.4 | 4.3, ADR-0002 | task create | `GrowthTask.js`, `growthTasks.js` | five dimensions and cross-family create pass | COVERED | none |
| `FR-TASK-002` | 4 | 4 | 10.4 | 4.3, ADR-0003 | task create/edit | `GrowthTask.js`, `growthTasks.js` | LocalDate and family-timezone boundary tests pass | COVERED | closed `FGT-T4-001` |
| `FR-TASK-003` | 4 | 4 | 10.4 | 3.2, 4.3 | task list/detail | `growthTasks.js` | status/filter/pagination/cross-family tests pass | COVERED | closed `FGT-T4-001`, `FGT-T4-003`, `FGT-T4-005`, `FGT-T4-006` |
| `FR-TASK-004` | 4 | 4 | 10.4 | GrowthTask state machine | task complete | `growthTasks.js` | own-child and cross-family completion tests pass | COVERED | closed `FGT-T4-006` |
| `FR-TASK-005` | 4 | 4 | 10.4 | GrowthTask state machine | task confirm | `growthTasks.js` | role and cross-family confirmation tests pass | COVERED | closed `FGT-T4-006` |
| `FR-TASK-006` | 4 | 4 | 10.4 | GrowthTask state machine, ADR-0004/0007 | task edit/delete | `GrowthTask.js`, `growthTasks.js` | repeat rejection, soft-cancel/archive, and `confirmed + pending` archive-guard tests pass | COVERED | pending award cannot be stranded; historical report semantics retained |
| `FR-LOG-001` | 5 | 5 | 10.4 | 4.4, Task 5 design 4.1/5 | growth logs | `GrowthLog.js`, `growthLogs.js`, `growthAccess.js` | `TC-T5-LOG-001`-`010` pass | COVERED | closed Task 5 implementation review |
| `FR-POINT-001` | 5 | 5 | 10.4 | 4.5, Task 5 design 4.2/5 | knowledge points | `KnowledgePoint.js`, `knowledgePoints.js`, `growthAccess.js`, `KnowledgePointsPage.js` | `TC-T5-POINT-001`-`008`, `TC-T5-CONTRACT-001`, parent create/filter/update UI tests pass | COVERED | Task 5 backend and Stage 4 parent workflow remediations closed |
| `FR-MISTAKE-001` | 6 | 6 | 10.4 | 4.6, Task 6 design 6/6.1, Task 10 design 3.5 | mistakes | `FamilyMistake.js`, `FamilyMistakeStateEvent.js`, `familyMistakes.js`, `familyMistakeMediaService.js`, `ChildMistakesPage.js` | `TC-T6-MISTAKE-001`-`014`, `TC-T10-API-007`, and `TC-T10-MISTAKE-001`-`005` pass; Task 6 and Task 10 gates pass | COVERED | backend lifecycle and child quick-capture/review UI are covered |
| `FR-REPORT-001` | 6 | 6 | 10.4 | 4.7, ADR-0001/0007, Task 6 design 7/8 | weekly reports | `WeeklyReport.js`, `weeklyReportService.js`, `weeklyReports.js`, `familyReadRepository.js`, `knowledgePointHistory` | `TC-T6-REPO-001`-`007`, `TC-T6-REPORT-001`-`018` pass; Task 6 gate pass | COVERED | closed Task 6 implementation review and final gate |
| `FR-MEDIA-001` | 6 | 6 | 9.11/10.4 | 4.8, Task 6 design 4/5 | media upload/access and business references | `resource-service`, `common/mediaReferenceClient`, `user-service`, `homework-service`, `analytics-service`, `gateway/server.js` | See `family-growth-task6-media-traceability.md`; `TC-T6-MEDIA-001`-`018`, `TC-T6-MISTAKE-009`-`012`, `TC-T6-GW-003`, and final gate pass | COVERED | closed Task 6 media traceability, implementation review, and final gate |
| `FR-MEDIA-002` | 6 | 6 | 9.11/10.4 | 4.8, Task 6 design 4.4 | media delete | `resource-service`, `familyMistakeMediaService.js`, Child/GrowthTask media services | `TC-T6-MEDIA-009`-`010`, `TC-T6-MISTAKE-011`, Child/GrowthTask removal cases, and final gate pass | COVERED | closed Task 6 media traceability, implementation review, and final gate |
| `FR-REWARD-001` | 5 | 5 | 10.4 | 4.8, ADR-0005, Task 5 design 6/7 | task confirm/stars | `GrowthTask.js`, `growthTasks.js`, `starAwardClient.js`, `StarLedgerEntry.js`, `internalStars.js` | `TC-T5-STAR-003`-`005`, `TC-T5-SAGA-001`-`008` pass | COVERED | closed Task 5 implementation review; final CAS branches covered |
| `FR-REWARD-002` | 5 | 5 | 10.4 | 4.8, ADR-0005, Task 5 design 8 | rewards | `Reward.js`, `StarLedgerGuard.js`, `rewards.js`, `starLedgerService.js` | `TC-T5-REWARD-001`-`012` pass | COVERED | closed Task 5 implementation review and v1.3 remediation |
| `FR-NOTIFY-001` | 7 | 7 | 10.4 | 3.1, ADR-0001, Task 7 design | notifications | `notification-service`, `familyReadRepository.js`, `gateway/server.js` | `TC-T7-NOTIFY-001`-`013`, shared cutoff boundary, `TC-T7-GW-001`, and Task 7 gate pass | COVERED | closed Task 7 implementation gate; shared read adapter remediation closed |
| `FR-NOTIFY-002` | 7 | 7 | 9.10/10.4 | 4.8, Task 7 design | notification settings | `ReminderSettings.js`, `familyNotifications.js` | `TC-T7-SETTINGS-001`-`004`, timezone/dedup/settings tests, Task 7 gate pass | COVERED | closed Task 7 implementation gate |
| `FR-UI-001` | 8 | 9 | 10.3/10.4 | 8.1/8.3, Task 8-11 and Task 9 frontend designs | parent Web routes | `frontend/web` family shell and seven parent workflows | Task 8 gate; `TC-T9-*` frontend tests; Task 9 browser/build/regression/CI gate | COVERED | Task 8 shell and Task 9 parent workflows merged by PR #8; see Task 9 gate |
| `FR-UI-002` | 10 | 10 | 10.3/10.4 | 8.2/8.3, Task 10 child Web design | child Web routes | `ChildAuthContext.js`, `ChildRoute.js`, `ChildShell.js`, `childApi.js`, child pages | All `TC-T10-*`; current 25-suite / 156-test frontend gate; desktop and 360px Chromium checks | COVERED | Task 10 historical gate and current v1.6 revalidation pass |
| `FR-FLOW-001` | 11 | 11 | 10.3/10.4 | 2/8, Task 11 E2E design | full public API through gateway | `backend/tests/task11`, `tests/e2e/task11`, parent/child Web, Compose smoke | 4 integration suites / 6 tests; 4 Chromium tests; 70-suite / 755-test backend gate; 25-suite / 156-test frontend gate; media-backed gateway smoke | COVERED | Task 11 gate and clean-main v1.6 release gate pass |
| `NFR-SEC-001` | 3 | 4 | 10.4 | 5/6, ADR-0002 | all family APIs | family controllers/routes, gateway, repository adapters | every Task 3/4 cross-family operation plus Task 5/6 internal-route, repository-scope, sibling, gateway, and signed-content checks pass | COVERED | closed `FGT-T4-006`; Task 6 security scope closed by final gate |
| `NFR-SEC-002` | 4 | 4 | 10.4 | 3.3, ADR-0006 | gateway envelope | `gateway/server.js`, `common/middleware/auth.js`, Compose | forged/tampered/expired/replayed/valid/secret tests and `TC-T5-DEPLOY-001` pass | COVERED | closed `FGT-GW-001`-`FGT-GW-004`, `FGT-FR-001`, `FGT-FR-003`, v1.3 remediation |
| `NFR-SEC-003` | 5 | 5 | 10.4 | Task 5 design section 6 | internal star award | `serviceCredential.js`, `internalStars.js`, `starAwardClient.js`, gateway allowlist, external Secret workflow | `TC-T5-STAR-001/002/006`, `TC-T5-GW-002`, `TC-T5-DEPLOY-002` pass | COVERED | closed Task 5 implementation review and v1.3 remediation |
| `NFR-DATA-001` | 3 | 4 | 10.4 | 4/5, ADR-0002 | all child data APIs | Family/User/GrowthTask, Task 6 media state, mistake/mastery events, weekly snapshots | family-first IDs/indexes, family-child and mistake-history transactions, media generations, scoped projections, and frozen weekly snapshots verified | COVERED | Stage 2 cross-document atomicity closed; repair command is auditable and tested |
| `NFR-DATA-002` | 5 | 5 | 10.4 | Task 5 design sections 7/8, ADR-0005 | task award and reward redemption | immutable ledger, guard transaction, recoverable confirmation saga, topology startup guard | `TC-T5-STAR-003`-`005`, `TC-T5-REWARD-005`-`012`, `TC-T5-SAGA-001`-`005`, `TC-T5-DEPLOY-003` pass | COVERED | closed Task 5 implementation review and v1.3 remediation |
| `NFR-PRIVACY-001` | 6 | 6 | 9.11/10.4 | 4.8, Task 6 design 4/9/10 | all media APIs | `resource-service`, `common`, `user-service`, `homework-service`, `analytics-service`, gateway/deployment config | See `family-growth-task6-media-traceability.md`: core media, Child avatar, GrowthTask, FamilyMistake, gateway signed content, deployment secret/volume checks, and final gate pass | COVERED | closed Task 6 media traceability, implementation review, and final gate |
| `NFR-TIME-001` | 4 | 4 | 10.4 | 3.2, ADR-0003 | family/task/report dates | `Family.js`, `GrowthTask.js`, routes, `weeklyReportService.js`, `FamilyMistake.js` | IANA timezone, LocalDate boundary, mistake date validation, weekly cutoff, cancellation/completion cutoff, and historical snapshot tests pass | COVERED | closed `FGT-T3-001`, `FGT-T4-001`; Task 6 time scope closed by final gate |
| `NFR-COMPAT-001` | 3 | 4 | 10.4 | 7 | legacy and family routes | legacy plus family route modules and isolated test projects | route-preservation contracts, family release gate, and explicit legacy-test isolation pass | COVERED | school models/routes retained; family rollback remains route-disable without data deletion |

# 家庭成长跟踪需求追踪矩阵

**Document status:** TASK 12 DESIGN APPROVED / IMPLEMENTATION PENDING
**Implementation conformance:** COVERED (35/38); DESIGN_APPROVED (3/38)
**Baseline candidate:** FGT-MVP-1.7
**Implementation evidence commit:** `e331c2810ba7fc3077748623d2148585177d791a`
**Revalidated at:** 2026-07-15

Conformance values are `COVERED`, `DESIGN_APPROVED`, `PARTIAL`, and `GAP`. `plannedTask` and
`gateAtTask` retain the historical delivery phase; conformance describes the current
Task 1~12 scope. Every row below was reconciled against PRD 10.4, the current
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

## PDF and multi-attachment increment evidence

- The increment extends the existing requirements without adding a new PRD ID. Canonical mistake
  arrays, task PDF attachments, parent/child workflows, PDF processing, explicit media security
  profiles, deployment assets and protected real-scanner command are implemented through commit
  `e331c2810ba7fc3077748623d2148585177d791a`.
- The trusted-local release gate passes with 78 backend suites / 867 tests, 27 frontend suites / 174
  tests, 4 Task 11 integration suites / 6 tests, production build, 4 Chromium tests, seven service
  images, eight healthy runtime services and the gateway media smoke flow. The real ClamAV command
  is intentionally not executed on the 8 GiB development host.
- Exact evidence and the `secure-production` approval boundary are recorded in
  [the increment Gate](./family-growth-mistake-pdf-multi-attachments-gate.md).

## Task 12 design candidate

- `FR-FAM-004`, `FR-FAM-005`, and `NFR-DATA-003` have approved product, architecture,
  detailed design, API, and numbered test contracts but no production implementation evidence.
- They remain `DESIGN_APPROVED`, are excluded from the 35 covered implementation count, and
  cannot enter a v1.7 release claim until every `TC-T12-*` case and remote gate passes.
- The current implemented baseline remains FGT-MVP-1.6 while Task 12 is developed.

| Requirement | plannedTask | gateAtTask | Product section | Architecture/ADR | API | Code owner | Test evidence | Conformance | Finding |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FR-FAM-001` | 3 | 4 | 10.4 | 4.1, ADR-0002/0003 | `POST /api/families` | `Family.js`, `familyController.js` | timezone/default/unique-owner and transaction rollback tests pass | COVERED | closed `FGT-T3-001`, `FGT-T3-007`; Stage 2 atomicity remediation closed |
| `FR-FAM-002` | 3 | 4 | 10.4 | 5, 6, ADR-0002 | family read/update | `familyController.js` | ownership database tests pass | COVERED | none |
| `FR-FAM-003` | 3 | 4 | 10.4 | 3.3, ADR-0006 | auth register/login/logout | `authController.js`, `auth.js` | stable family errors, signed gateway auth, and authenticated idempotent logout contract pass | COVERED | closed `FGT-T3-006`; logout contract remediation closed |
| `FR-FAM-004` | 12 | 12 | 5.1/10.4 | 4.1/6/8.1, ADR-0008, Task 12 design | parent invitation create/read/accept | user-service, gateway, parent Web | `TC-T12-INV-*`, `TC-T12-ACCEPT-*`, `TC-T12-ACCESS-*`, `TC-T12-AUTH-*`, `TC-T12-PROJ-*`, `TC-T12-API-*`, `TC-T12-UI-*` designed; executable evidence pending | DESIGN_APPROVED | implementation must not be claimed before Task 12 gate |
| `FR-FAM-005` | 12 | 12 | 5.1/10.4 | 4.1/6/7/8.1, ADR-0008, Task 12 design | invitation revoke, leave, remove, transfer | user-service, gateway, parent Web | `TC-T12-GOV-*`, `TC-T12-UI-005/006`, `TC-T12-UX-001`, `TC-T12-REG-003` designed; executable evidence pending | DESIGN_APPROVED | implementation must preserve history and immediate access revocation |
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
| `FR-MISTAKE-001` | 6 | 6 | 10.4 | 4.6, Task 6 design 6/6.1, Task 10 design 3.5, multi-attachment design | mistakes | `FamilyMistake.js`, `FamilyMistakeStateEvent.js`, `familyMistakes.js`, `familyMistakeMediaService.js`, parent/child mistake pages | Historical Task 6/10 cases plus `TC-MPA-API-*`, parent/child collection tests and Task 11 browser flow pass | COVERED | ordered 10-item question/answer image/PDF collections and legacy scalar compatibility implemented |
| `FR-REPORT-001` | 6 | 6 | 10.4 | 4.7, ADR-0001/0007, Task 6 design 7/8 | weekly reports | `WeeklyReport.js`, `weeklyReportService.js`, `weeklyReports.js`, `familyReadRepository.js`, `knowledgePointHistory` | `TC-T6-REPO-001`-`007`, `TC-T6-REPORT-001`-`018` pass; Task 6 gate pass | COVERED | closed Task 6 implementation review and final gate |
| `FR-MEDIA-001` | 6 | 6 | 9.11/10.4 | 4.8, Task 6 design 4/5, PDF security design | media upload/access and business references | `resource-service`, media reference clients, owner services, gateway | Historical media cases plus `TC-MPA-MEDIA-*`, `TC-MPA-SCAN-*`, deployment tests and Task 11 PDF flow pass | COVERED | canonical PDF support and explicit trusted-local/secure-production policies implemented; real scanner release approval remains environment-specific |
| `FR-MEDIA-002` | 6 | 6 | 9.11/10.4 | 4.8, Task 6 design 4.4, multi-attachment design | media delete | `resource-service`, FamilyMistake/Child/GrowthTask media services | Historical removal cases plus collection draft cleanup, reference release and Task 11 removal pass | COVERED | multi-reference removal preserves owner/reference ordering and draft cleanup |
| `FR-REWARD-001` | 5 | 5 | 10.4 | 4.8, ADR-0005, Task 5 design 6/7 | task confirm/stars | `GrowthTask.js`, `growthTasks.js`, `starAwardClient.js`, `StarLedgerEntry.js`, `internalStars.js` | `TC-T5-STAR-003`-`005`, `TC-T5-SAGA-001`-`008` pass | COVERED | closed Task 5 implementation review; final CAS branches covered |
| `FR-REWARD-002` | 5 | 5 | 10.4 | 4.8, ADR-0005, Task 5 design 8 | rewards | `Reward.js`, `StarLedgerGuard.js`, `rewards.js`, `starLedgerService.js` | `TC-T5-REWARD-001`-`012` pass | COVERED | closed Task 5 implementation review and v1.3 remediation |
| `FR-NOTIFY-001` | 7 | 7 | 10.4 | 3.1, ADR-0001, Task 7 design | notifications | `notification-service`, `familyReadRepository.js`, `gateway/server.js` | `TC-T7-NOTIFY-001`-`013`, shared cutoff boundary, `TC-T7-GW-001`, and Task 7 gate pass | COVERED | closed Task 7 implementation gate; shared read adapter remediation closed |
| `FR-NOTIFY-002` | 7 | 7 | 9.10/10.4 | 4.8, Task 7 design | notification settings | `ReminderSettings.js`, `familyNotifications.js` | `TC-T7-SETTINGS-001`-`004`, timezone/dedup/settings tests, Task 7 gate pass | COVERED | closed Task 7 implementation gate |
| `FR-UI-001` | 8 | 9 | 10.3/10.4 | 8.1/8.3, Task 8-11, Task 9 and multi-attachment designs | parent Web routes | `frontend/web` family shell and parent workflows | Historical Task 8/9 cases plus parent collection unit tests, full frontend regression and desktop/360px browser checks pass | COVERED | parent task/mistake image/PDF collections implemented |
| `FR-UI-002` | 10 | 10 | 10.3/10.4 | 8.2/8.3, Task 10 and multi-attachment designs | child Web routes | child auth/API/pages and shared media collection | Historical Task 10 cases plus child create/review attachment tests and desktop/360px Chromium checks pass | COVERED | child can manage own mistake image/PDF collections and read task attachments |
| `FR-FLOW-001` | 11 | 11 | 10.3/10.4 | 2/8, Task 11 and multi-attachment designs | full public API through gateway | `backend/tests/task11`, `tests/e2e/task11`, parent/child Web, Compose smoke | 4 integration suites / 6 tests and 4 Chromium tests include PDF upload/download, reorder/removal and sibling/cross-family denial | COVERED | default real-service path is covered in trusted-local; protected real-ClamAV Gate is separate |
| `NFR-SEC-001` | 3 | 4 | 10.4 | 5/6, ADR-0002 | all family APIs | family controllers/routes, gateway, repository adapters | every Task 3/4 cross-family operation plus Task 5/6 internal-route, repository-scope, sibling, gateway, and signed-content checks pass | COVERED | closed `FGT-T4-006`; Task 6 security scope closed by final gate |
| `NFR-SEC-002` | 4 | 4 | 10.4 | 3.3, ADR-0006 | gateway envelope | `gateway/server.js`, `common/middleware/auth.js`, Compose | forged/tampered/expired/replayed/valid/secret tests and `TC-T5-DEPLOY-001` pass | COVERED | closed `FGT-GW-001`-`FGT-GW-004`, `FGT-FR-001`, `FGT-FR-003`, v1.3 remediation |
| `NFR-SEC-003` | 5 | 5 | 10.4 | Task 5 design section 6 | internal star award | `serviceCredential.js`, `internalStars.js`, `starAwardClient.js`, gateway allowlist, external Secret workflow | `TC-T5-STAR-001/002/006`, `TC-T5-GW-002`, `TC-T5-DEPLOY-002` pass | COVERED | closed Task 5 implementation review and v1.3 remediation |
| `NFR-DATA-001` | 3 | 4 | 10.4 | 4/5, ADR-0002 | all child data APIs | Family/User/GrowthTask, Task 6 media state, mistake/mastery events, weekly snapshots | family-first IDs/indexes, family-child and mistake-history transactions, media generations, scoped projections, and frozen weekly snapshots verified | COVERED | Stage 2 cross-document atomicity closed; repair command is auditable and tested |
| `NFR-DATA-002` | 5 | 5 | 10.4 | Task 5 design sections 7/8, ADR-0005 | task award and reward redemption | immutable ledger, guard transaction, recoverable confirmation saga, topology startup guard | `TC-T5-STAR-003`-`005`, `TC-T5-REWARD-005`-`012`, `TC-T5-SAGA-001`-`005`, `TC-T5-DEPLOY-003` pass | COVERED | closed Task 5 implementation review and v1.3 remediation |
| `NFR-DATA-003` | 12 | 12 | 10.4 | 4.1/5/7, ADR-0008, Task 12 design sections 3-5/9 | all parent membership mutations | Family, User, FamilyParentInvitation, FamilyMembershipEvent | `TC-T12-MODEL-*`, concurrency/rollback, projection, strict repair check and regression cases designed; executable evidence pending | DESIGN_APPROVED | transaction, max-two invariant, immutable event, live parent authorization, and zero-drift preflight evidence required |
| `NFR-PRIVACY-001` | 6 | 6 | 9.11/10.4 | 4.8, Task 6 design 4/9/10, PDF security design | all media APIs | resource/common/owner services, gateway and deployment profiles | Historical privacy suite plus PDF active-content, canonicalization, scan fail-closed, signed PDF, family isolation and private deployment tests pass | COVERED | trusted-local is explicitly weaker and private-only; secure-production requires successful real-scanner Gate |
| `NFR-TIME-001` | 4 | 4 | 10.4 | 3.2, ADR-0003 | family/task/report dates | `Family.js`, `GrowthTask.js`, routes, `weeklyReportService.js`, `FamilyMistake.js` | IANA timezone, LocalDate boundary, mistake date validation, weekly cutoff, cancellation/completion cutoff, and historical snapshot tests pass | COVERED | closed `FGT-T3-001`, `FGT-T4-001`; Task 6 time scope closed by final gate |
| `NFR-COMPAT-001` | 3 | 4 | 10.4 | 7 | legacy and family routes | legacy plus family route modules and isolated test projects | route-preservation contracts, family release gate, and explicit legacy-test isolation pass | COVERED | school models/routes retained; family rollback remains route-disable without data deletion |

# 家庭成长跟踪需求追踪矩阵

**Document status:** APPROVED
**Baseline candidate:** FGT-MVP-1

Conformance values are `COVERED`, `PARTIAL`, `GAP`, and `PLANNED_TASK_5_PLUS`. Task 4.5 counts requirements with `plannedTask` 3 or 4 and cross-cutting requirements with `gateAtTask=4`; later requirements remain designed but their unimplemented status is not a Task 3/4 finding.

| Requirement | plannedTask | gateAtTask | Product section | Architecture/ADR | API | Code owner | Test evidence | Conformance | Finding |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FR-FAM-001` | 3 | 4 | 10.4 | 4.1, ADR-0002/0003 | `POST /api/families` | `Family.js`, `familyController.js` | timezone/default/unique-owner tests pass | COVERED | closed `FGT-T3-001`, `FGT-T3-007` |
| `FR-FAM-002` | 3 | 4 | 10.4 | 5, 6, ADR-0002 | family read/update | `familyController.js` | ownership database tests pass | COVERED | none |
| `FR-FAM-003` | 3 | 4 | 10.4 | 3.3, ADR-0006 | auth register/login | `authController.js`, `auth.js` | stable family errors and signed gateway auth pass | COVERED | closed `FGT-T3-006` |
| `FR-CHILD-001` | 3 | 4 | 10.4 | 4.2, 6 | children create/update | `User.js`, `familyController.js` | multiple children and cross-family edit pass | COVERED | none |
| `FR-CHILD-002` | 3 | 4 | 10.4 | 6.1/6.3 | children list/detail | `familyController.js` | self/sibling and cross-family tests pass | COVERED | none |
| `FR-CHILD-003` | 3 | 4 | 10.4 | 4.2, 6.1 | child PIN set | `User.js`, `familyController.js` | 4-6 digit bounds and reset tests pass | COVERED | closed `FGT-T3-002` |
| `FR-CHILD-004` | 3 | 4 | 10.4 | 3.3, 6.1 | child PIN login | `familyController.js`, `auth.js` | claims/12h/generic error/rate-limit tests pass | COVERED | closed `FGT-T3-004`-`FGT-T3-006`, `FGT-FR-002` |
| `FR-CHILD-005` | 3 | 4 | 10.4 | 4.2 | PIN reset/token | `User.js`, `familyController.js`, `auth.js` | stale-token rejection test passes | COVERED | closed `FGT-T3-003` |
| `FR-TASK-001` | 4 | 4 | 10.4 | 4.3, ADR-0002 | task create | `GrowthTask.js`, `growthTasks.js` | five dimensions and cross-family create pass | COVERED | none |
| `FR-TASK-002` | 4 | 4 | 10.4 | 4.3, ADR-0003 | task create/edit | `GrowthTask.js`, `growthTasks.js` | LocalDate and family-timezone boundary tests pass | COVERED | closed `FGT-T4-001` |
| `FR-TASK-003` | 4 | 4 | 10.4 | 3.2, 4.3 | task list/detail | `growthTasks.js` | status/filter/pagination/cross-family tests pass | COVERED | closed `FGT-T4-001`, `FGT-T4-003`, `FGT-T4-005`, `FGT-T4-006` |
| `FR-TASK-004` | 4 | 4 | 10.4 | GrowthTask state machine | task complete | `growthTasks.js` | own-child and cross-family completion tests pass | COVERED | closed `FGT-T4-006` |
| `FR-TASK-005` | 4 | 4 | 10.4 | GrowthTask state machine | task confirm | `growthTasks.js` | role and cross-family confirmation tests pass | COVERED | closed `FGT-T4-006` |
| `FR-TASK-006` | 4 | 4 | 10.4 | ADR-0004 | task edit/delete | `GrowthTask.js`, `growthTasks.js` | repeat rejection and delete/archive tests pass | COVERED | closed `FGT-T4-002`, `FGT-T4-006` |
| `FR-LOG-001` | 5 | 5 | 10.4 | 4.4 | growth logs | `progress-service` planned | planned Task 5 | PLANNED_TASK_5_PLUS | none |
| `FR-POINT-001` | 5 | 5 | 10.4 | 4.5 | knowledge points | `progress-service` planned | planned Task 5 | PLANNED_TASK_5_PLUS | none |
| `FR-MISTAKE-001` | 6 | 6 | 10.4 | 4.6 | mistakes | `analytics-service` planned | planned Task 6 | PLANNED_TASK_5_PLUS | none |
| `FR-REPORT-001` | 6 | 6 | 10.4 | 4.7, ADR-0001 | weekly reports | `analytics-service` planned | planned Task 6 | PLANNED_TASK_5_PLUS | none |
| `FR-REWARD-001` | 5 | 5 | 10.4 | 4.8, ADR-0005 | task confirm/stars | `progress-service` planned | planned Task 5 | PLANNED_TASK_5_PLUS | none |
| `FR-REWARD-002` | 5 | 5 | 10.4 | 4.8, ADR-0005 | rewards | `progress-service` planned | planned Task 5 | PLANNED_TASK_5_PLUS | none |
| `FR-NOTIFY-001` | 7 | 7 | 10.4 | 3.1, ADR-0001 | notifications | `notification-service` planned | planned Task 7 | PLANNED_TASK_5_PLUS | none |
| `NFR-SEC-001` | 3 | 4 | 10.4 | 5/6, ADR-0002 | all family APIs | family controllers/routes | every Task 3/4 cross-family operation passes | COVERED | closed `FGT-T4-006` |
| `NFR-SEC-002` | 4 | 4 | 10.4 | 3.3, ADR-0006 | gateway envelope | `gateway/server.js`, `common/middleware/auth.js` | forged/tampered/expired/replayed/valid/secret tests pass | COVERED | closed `FGT-GW-001`-`FGT-GW-004`, `FGT-FR-001`, `FGT-FR-003` |
| `NFR-DATA-001` | 3 | 4 | 10.4 | 4/5, ADR-0002 | all child data APIs | Family/User/GrowthTask | family-first IDs and indexes verified | COVERED | closed `FGT-T4-004` |
| `NFR-TIME-001` | 4 | 4 | 10.4 | 3.2, ADR-0003 | family/task dates | `Family.js`, `GrowthTask.js`, routes | IANA timezone and LocalDate boundary tests pass | COVERED | closed `FGT-T3-001`, `FGT-T4-001` |
| `NFR-COMPAT-001` | 3 | 4 | 10.4 | 7 | legacy and family routes | legacy plus new route modules | baseline full suite | COVERED | no deletion observed |

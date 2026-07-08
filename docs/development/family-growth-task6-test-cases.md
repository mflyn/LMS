# Task 6 Numbered Test Cases

**Document status:** APPROVED
**Baseline candidate:** FGT-MVP-1.4  
**Design:** `docs/superpowers/specs/2026-06-20-family-growth-task6-design.md`

Test names must begin with the case ID. Unless stated otherwise, database cases use family A/parent A/child A1/sibling A2 and family B/parent B/child B1. Clocks are fixed, identities are signed through the shared test helper, and authorization tests use persisted family ownership.

## Private Media

| ID | Requirement | Level | Preconditions and action | Expected result | Automated test |
| --- | --- | --- | --- | --- | --- |
| `TC-T6-MEDIA-001` | `FR-MEDIA-001`, `NFR-PRIVACY-001` | route/model | Parent uploads generated JPEG, PNG, and WebP files across all six valid purposes, including an avatar with omitted childId. | `201`; sanitized object and active metadata persist; only the avatar may be family-scoped; both unique indexes include familyId; response exposes no storage key or URL. | `familyMedia.test.js` |
| `TC-T6-MEDIA-002` | `FR-MEDIA-001` | validation | Upload an extension-spoofed file, unsupported signature, corrupt image, empty file, or file over 10 MiB. | `400 VALIDATION_ERROR`; no object or metadata remains. | `familyMedia.test.js` |
| `TC-T6-MEDIA-003` | `FR-MEDIA-001`, `NFR-PRIVACY-001` | privacy | Upload JPEG/WebP fixtures containing EXIF location and device metadata, then inspect stored bytes. | Image remains decodable and EXIF values are absent. | `familyMedia.test.js` |
| `TC-T6-MEDIA-004` | `FR-MEDIA-001`, `NFR-SEC-001` | authorization | Child A1 supplies child A2/B1 or a parent-only purpose; parent A targets family B. | `403 CHILD_ACCESS_DENIED`; no object created. | `familyMedia.test.js` |
| `TC-T6-MEDIA-005` | `FR-MEDIA-001` | authorization | Child A1 uploads each allowed purpose and omits childId. | Effective child is A1; only the four child purposes succeed. | `familyMedia.test.js` |
| `TC-T6-MEDIA-006` | `FR-MEDIA-001`, `NFR-PRIVACY-001` | route | Owner requests child-scoped access and a parent requests family-scoped avatar access with a fixed clock. | URL expiry is no more than 300 seconds; response is `no-store` and contains no storage key. | `familyMedia.test.js` |
| `TC-T6-MEDIA-007` | `FR-MEDIA-001`, `NFR-PRIVACY-001` | security | Read content with valid capability, then independently alter path, media ID, expiry, nonce, and signature or use an expired URL. | Only the intact unexpired capability streams exact sanitized bytes with private no-store/nosniff headers. | `familyMedia.test.js` |
| `TC-T6-MEDIA-008` | `FR-MEDIA-001`, `NFR-SEC-001` | security | Family B or sibling A2 requests A1 media, or child A1 requests a family-scoped avatar. | `403 CHILD_ACCESS_DENIED`; no URL or metadata disclosed. | `familyMedia.test.js` |
| `TC-T6-MEDIA-009` | `FR-MEDIA-002` | route | Bind media to a mistake, delete it twice, then request access/content and prepare a new reference. | Both deletes return `204`; media is immediately inaccessible and rejects new prepare; its existing bound reference remains until explicit unbind. | `familyMedia.test.js` |
| `TC-T6-MEDIA-010` | `FR-MEDIA-002`, `NFR-PRIVACY-001` | retention | Evaluate deletion age and last-unbind age independently, including 30-day deleted media still bound and media unbound 29/30 days ago. | Cleanup requires no bound reference and 30 full days after both deletion and last unbind; repeated cleanup is harmless. | `privateMediaStore.test.js` |
| `TC-T6-MEDIA-011` | `FR-MEDIA-001`, `NFR-SEC-001` | internal API | Call prepare/commit/unbind with absent, short, invalid, and valid service credentials. | Invalid credentials return `401`; valid credential is constant-time checked and command is not publicly routed. | `mediaReferences.test.js` |
| `TC-T6-MEDIA-012` | `FR-MEDIA-001` | integration | Prepare, replay, commit, replay, and unbind one field identity. | One reference row converges through states with no duplicate; replays return original result. | `mediaReferences.test.js` |
| `TC-T6-MEDIA-013` | `FR-MEDIA-001` | validation | Prepare wrong-family, wrong-child, deleted, wrong-purpose, or missing media. | Stable `400/403/404` contract; no reference row is created. | `mediaReferences.test.js` |
| `TC-T6-MEDIA-014` | `FR-MEDIA-001` | recovery | Leave a prepared reference beyond its lease and run reclamation. | Expired preparation is removed; active bound reference is retained. | `mediaReferences.test.js` |
| `TC-T6-MEDIA-015` | `NFR-PRIVACY-001` | observability | Exercise upload, access, content, binding, and delete while capturing structured logs. | Logs contain approved IDs/results only and no bytes, filename, EXIF, storage key, URL/signature, credential, or private text. | `familyMediaPrivacy.test.js` |
| `TC-T6-MEDIA-016` | `FR-MEDIA-001`, `NFR-DATA-001` | consumer integration | Set, replace, and remove `Child.avatarMediaId` with valid, wrong-purpose, sibling, deleted, and family-scoped media; force commit failure once. | Only same-child active avatar binds; replacement commits before old unbind; pending state resumes idempotently without exposing an unbound media ID. | `childMediaReferences.test.js` |
| `TC-T6-MEDIA-017` | `FR-MEDIA-001`, `NFR-DATA-001` | consumer integration | Create and patch GrowthTask attachment arrays with valid, duplicate, wrong-purpose, cross-child, and deleted media; force persistence/commit failures. | Normalized same-child task attachments bind once; failures release or resume safely; removed attachments unbind only after new bindings commit. | `growthTaskMediaReferences.test.js` |
| `TC-T6-MEDIA-018` | `FR-MEDIA-001`, `NFR-SEC-001` | contract/security | Exercise every current business field that accepts media and submit raw URLs or media IDs without a valid prepared/bound reference. | Child, task, and mistake writes reject raw URLs and never expose or persist an unvalidated usable media ID. | `familyMediaConsumers.test.js` |

## Family Mistakes

| ID | Requirement | Level | Preconditions and action | Expected result | Automated test |
| --- | --- | --- | --- | --- | --- |
| `TC-T6-MISTAKE-001` | `FR-MISTAKE-001` | model | Save a complete academic mistake and a minimal valid mistake. | Both persist with `dimension=academic`, false state defaults, family and child IDs. | `familyMistakes.test.js` |
| `TC-T6-MISTAKE-002` | `FR-MISTAKE-001`, `NFR-TIME-001` | model | Use non-academic dimension, missing subject, malformed/overlong reason, invalid date, overlong text, or client audit/binding fields. | Validation rejects values and protected fields are not accepted. | `familyMistakes.test.js` |
| `TC-T6-MISTAKE-003` | `FR-MISTAKE-001`, `NFR-SEC-001` | route | Parent A creates a mistake for A1 with parent fields and valid media purposes. | `201`; family/audit fields are server derived and references are bound. | `familyMistakes.test.js` |
| `TC-T6-MISTAKE-004` | `FR-MISTAKE-001` | authorization | Child A1 creates with required subject/reason plus child-owned fields, then patches only child-answer, correction/review/mastery, and explanation fields. | Create and patch succeed; subject/reason become immutable to the child after creation and parent-owned fields remain unchanged. | `familyMistakes.test.js` |
| `TC-T6-MISTAKE-005` | `FR-MISTAKE-001` | authorization | Child patches subject/reason or writes question, correct answer, parent note, knowledge point, ownership, or audit fields. | `403 FIELD_ACCESS_DENIED`; stored record unchanged. | `familyMistakes.test.js` |
| `TC-T6-MISTAKE-006` | `FR-MISTAKE-001`, `NFR-SEC-001` | security | Parent B, child B1, or sibling A2 reads/updates A1 mistake. | `403 CHILD_ACCESS_DENIED`; no fields are disclosed. | `familyMistakes.test.js` |
| `TC-T6-MISTAKE-007` | `FR-MISTAKE-001` | route | List A1 mistakes by subject, reason, corrected, reminder range, and each `reviewStatus=pending|reviewed|mastered` value with pagination. | Statuses follow the mutually exclusive boolean mapping; only scoped matches return with correct page metadata and stable ordering. | `familyMistakes.test.js` |
| `TC-T6-MISTAKE-008` | `FR-MISTAKE-001` | route/consistency | Parent and child patch each documented allowed field combination and force an event-write failure. | `200` changes only supplied authorized fields and appends the state event atomically; forced failure rolls back both source and event. | `familyMistakes.test.js` |
| `TC-T6-MISTAKE-009` | `FR-MISTAKE-001`, `FR-MEDIA-001` | integration | Create or update with wrong-purpose, deleted, sibling, cross-family, or missing media. | Stable purpose/scope/not-found error and no mistake mutation is committed. | `familyMistakes.test.js` |
| `TC-T6-MISTAKE-010` | `FR-MISTAKE-001`, `FR-MEDIA-001` | recovery | Force media commit failure after mistake save, then read or patch the returned mistake ID. | First response is `503 MEDIA_REFERENCE_PENDING`; retry resumes the same operation and converges without duplicate references. | `familyMistakeMediaSaga.test.js` |
| `TC-T6-MISTAKE-011` | `FR-MISTAKE-001`, `FR-MEDIA-002` | integration | Replace and remove bound question/answer media fields. | New binding commits before old binding is idempotently removed; no stale usable reference remains. | `familyMistakeMediaSaga.test.js` |
| `TC-T6-MISTAKE-012` | `FR-MISTAKE-001` | recovery | Force mistake persistence failure after prepare. | Route fails, performs best-effort unbind, and any remaining preparation expires by lease. | `familyMistakeMediaSaga.test.js` |
| `TC-T6-MISTAKE-013` | `FR-MISTAKE-001` | contract | Use malformed IDs, unknown filters, invalid pagination, or illegal state combination. | `400 VALIDATION_ERROR` stable shared envelope. | `familyMistakes.test.js` |
| `TC-T6-MISTAKE-014` | `FR-MISTAKE-001`, `NFR-SEC-001` | query security | Instrument every list/detail/update query. | Each predicate contains both server-resolved `familyId` and `childId`. | `familyMistakes.test.js` |

## Family Read Repository

| ID | Requirement | Level | Preconditions and action | Expected result | Automated test |
| --- | --- | --- | --- | --- | --- |
| `TC-T6-REPO-001` | `FR-REPORT-001`, `NFR-SEC-001` | repository | Call each method without familyId, childId, cutoff/range, or timeout. | Method rejects before querying; no unscoped read occurs. | `familyReadRepository.test.js` |
| `TC-T6-REPO-002` | `FR-REPORT-001` | repository | Read task projection for a fixture week and cutoff. | Only required task fields and matching family/child rows return. | `familyReadRepository.test.js` |
| `TC-T6-REPO-003` | `FR-REPORT-001` | repository | Read log, knowledge-point, mistake, and their immutable state-event projections at a cutoff. | Lean projected values return the last pre-cutoff state without Mongoose documents or private text fields; post-cutoff events are ignored and incomplete history fails. | `familyReadRepository.test.js` |
| `TC-T6-REPO-004` | `FR-REPORT-001` | resilience | Delay each source beyond its explicit timeout. | Promise rejects with the named unavailable source; no empty fallback is returned. | `familyReadRepository.test.js` |
| `TC-T6-REPO-005` | `FR-REPORT-001` | resilience | Make each source throw a connection error or malformed projection. | Repository normalizes the failure without leaking connection details. | `familyReadRepository.test.js` |
| `TC-T6-REPO-006` | `FR-REPORT-001`, `NFR-SEC-001` | architecture | Scan analytics imports and invoke its injected repository adapter. | Analytics imports no homework/progress private model and uses read-only methods. | `familyReadRepository.test.js` |
| `TC-T6-REPO-007` | `FR-REPORT-001`, `NFR-DATA-001` | source consistency | Create and update a knowledge point, inspect mastery events, then force event persistence to fail. | Initial and changed states have idempotent family-scoped events; forced failure rolls back both the knowledge-point mutation and event. | `knowledgePointHistory.test.js` |

## Weekly Reports

| ID | Requirement | Level | Preconditions and action | Expected result | Automated test |
| --- | --- | --- | --- | --- | --- |
| `TC-T6-REPORT-001` | `FR-REPORT-001`, `NFR-TIME-001` | validation | Request Monday weekStart and non-Monday/invalid LocalDates in two family timezones. | Monday succeeds; invalid boundaries return `400`; cutoff is correct UTC instant per timezone. | `weeklyReports.test.js` |
| `TC-T6-REPORT-002` | `FR-REPORT-001` | aggregation | Create six distinct GrowthLog days with multiple logs on two days. | `recordDays=6`; duplicate-day logs do not increase the count. | `weeklyReports.test.js` |
| `TC-T6-REPORT-003` | `FR-REPORT-001` | aggregation | Create 30 planned tasks with 24 completed before cutoff across five dimensions, then a separate 2-of-3 fixture. | Completion rates are 80 and 66.67 using half-up two-decimal rounding; each dimension's planned/completed count is correct. | `weeklyReports.test.js` |
| `TC-T6-REPORT-004` | `FR-REPORT-001` | cutoff | Cancel one task before cutoff and another after cutoff; complete one task after cutoff. | Pre-cutoff cancellation is excluded; post-cutoff cancellation stays planned; late completion is not counted. | `weeklyReports.test.js` |
| `TC-T6-REPORT-005` | `FR-REPORT-001` | cutoff | Create a task after cutoff whose dueDate is in the week. | Task is excluded from planned and completed counts. | `weeklyReports.test.js` |
| `TC-T6-REPORT-006` | `FR-REPORT-001` | aggregation | Generate a week with no planned tasks. | `taskCompletionRate=null` and all five dimensions remain explicitly represented. | `weeklyReports.test.js` |
| `TC-T6-REPORT-007` | `FR-REPORT-001` | aggregation | Give a task actualMinutes and a linked GrowthLog duration. | Duration is counted once from GrowthLog only; dimension totals sum to total duration. | `weeklyReports.test.js` |
| `TC-T6-REPORT-008` | `FR-REPORT-001` | aggregation | Create tied mistake reasons in different insertion orders. | Weekly mistakes are cutoff scoped; reasons sort count descending then reason ascending. | `weeklyReports.test.js` |
| `TC-T6-REPORT-009` | `FR-REPORT-001` | aggregation/history | Create due unmastered mistakes and duplicate needs-review knowledge points, advance past cutoff, change their states, then generate the historical week for the first time. | Review points use the last pre-cutoff events, are unioned, deduplicated, and stable-sorted; post-cutoff changes do not rewrite the week. | `weeklyReports.test.js` |
| `TC-T6-REPORT-010` | `FR-REPORT-001` | deterministic rules | Fixtures contain pending math mistakes, 4 physical completions, and 2 labor completions. | Generated suggestion appears in approved math, physical, labor order; initial `nextWeekSuggestion` matches it. | `weeklyReports.test.js` |
| `TC-T6-REPORT-011` | `FR-REPORT-001` | deterministic rules | Reach physical/labor thresholds and remove pending math mistakes. | Corresponding suggestions are absent; repeated generation is byte-equivalent for statistics and generated suggestion. | `weeklyReports.test.js` |
| `TC-T6-REPORT-012` | `FR-REPORT-001` | snapshot | Generate ended week, mutate/cancel/late-complete sources, then read again. | Original frozen statistics, cutoff, generation time, and suggestions do not change. | `weeklyReports.test.js` |
| `TC-T6-REPORT-013` | `FR-REPORT-001` | current-to-ended transition | Generate current week, add source data and verify recomputation, then advance the fixed clock past cutoff and request the same week again. | The existing non-frozen row is atomically promoted to one frozen cutoff snapshot; feedback is preserved and later source changes have no effect. | `weeklyReports.test.js` |
| `TC-T6-REPORT-014` | `FR-REPORT-001` | concurrency | Issue concurrent ended-week requests both with no row and with an existing non-frozen current-week row. | Insert or compare-and-set promotion yields one frozen snapshot; all successful responses return the frozen winner and none returns an ended non-frozen report. | `weeklyReports.test.js` |
| `TC-T6-REPORT-015` | `FR-REPORT-001` | resilience | Timeout or fail tasks, logs, mistakes, or knowledge points independently. | `503 AGGREGATION_UNAVAILABLE`; failed result is not stored or cached. | `weeklyReports.test.js` |
| `TC-T6-REPORT-016` | `FR-REPORT-001`, `NFR-SEC-001` | authorization | Parent B, sibling A2, and child B1 request A1 report. | `403 CHILD_ACCESS_DENIED`; no snapshot or source detail disclosed. | `weeklyReports.test.js` |
| `TC-T6-REPORT-017` | `FR-REPORT-001` | authorization | Parent patches `parentNote`/`nextWeekSuggestion` by reportId; child attempts it; client submits statistics fields or an unknown reportId. | Parent feedback succeeds; child gets `403`; statistics fields get `403 FIELD_ACCESS_DENIED`; missing report gets `404`. | `weeklyReports.test.js` |
| `TC-T6-REPORT-018` | `FR-REPORT-001` | snapshot | Update feedback on a frozen report multiple times. | Feedback/audit fields change; statistics, generated suggestion, cutoff, and freeze fields remain identical. | `weeklyReports.test.js` |

## Gateway, Deployment, and Regression

| ID | Requirement | Level | Preconditions and action | Expected result | Automated test/evidence |
| --- | --- | --- | --- | --- | --- |
| `TC-T6-GW-001` | Task 6 API | gateway | Request media, mistakes, and weekly report prefixes with valid user JWT. | Gateway authenticates and proxies each public route to its owning service. | `familyTask6Routes.test.js` |
| `TC-T6-GW-002` | `NFR-SEC-001` | gateway | Request internal media reference paths through gateway. | No matching route exists; gateway never forwards the command or service token. | `familyTask6Routes.test.js` |
| `TC-T6-GW-003` | `FR-MEDIA-001` | gateway | Request a valid and invalid signed media content URL without JWT. | Gateway proxies only the signed content path; resource-service accepts only valid capability. | `familyTask6Routes.test.js` |
| `TC-T6-REG-001` | Task 6 gate | startup | Import resource/analytics app modules, start explicit test servers, and start analytics once against a standalone MongoDB. | Imports open no DB/port/process handler; tests control one Mongo and close all handles; analytics rejects non-transactional topology before serving mistake routes. | `task6Startup.test.js` |
| `TC-T6-REG-002` | `NFR-PRIVACY-001` | deployment | Validate Compose/Kubernetes volume, least-service external secret wiring, report-history boundary, and static-route configuration. | Private persistent volume exists, secrets are external, only resource/user/homework/analytics receive the reference token, media root is never static, and a valid `REPORT_HISTORY_AVAILABLE_FROM` is required. | `task6Deployment.test.js` |
| `TC-T6-REG-003` | Task 6 gate | regression | Run targeted Task 6 and all prior family suites. | All family suites pass with no Task 3-5 regression. | `family-growth-task6-gate.md` |
| `TC-T6-REG-004` | Task 6 gate | regression | Run exact root `npm run test:nocoverage` and compare with approved baseline. | Command completes; no new failure category or family failure is introduced. | `family-growth-task6-gate.md` |
| `TC-T6-REG-005` | Task 6 gate | stability | Run isolated family regression twice on one commit. | Both exit 0 with identical passing totals and no leaked handles or timeout-dependent failure. | `family-growth-task6-gate.md` |
| `TC-T6-REG-006` | Task 6 gate | review | Complete implementation review and rerun evidence after every remediation. | No open BLOCKER, MAJOR, or MINOR; evidence belongs to final candidate commit. | `family-growth-task6-implementation-review.md` |

## Coverage Summary

| Requirement | Cases |
| --- | --- |
| `FR-MEDIA-001` | `TC-T6-MEDIA-001`-`008`, `011`-`018`; `TC-T6-MISTAKE-009`-`012`; `TC-T6-GW-003` |
| `FR-MEDIA-002` | `TC-T6-MEDIA-009`-`010`; `TC-T6-MISTAKE-011` |
| `FR-MISTAKE-001` | `TC-T6-MISTAKE-001`-`014` |
| `FR-REPORT-001` | `TC-T6-REPO-001`-`007`; `TC-T6-REPORT-001`-`018` |
| `NFR-PRIVACY-001` | `TC-T6-MEDIA-001`, `003`, `006`-`010`, `015`-`018`; `TC-T6-REG-002` |
| `NFR-SEC-001` | Cross-family, sibling, internal-command, repository-scope, gateway, and deployment cases above |
| `NFR-DATA-001` | Reference idempotency, atomic cutoff-state events (`TC-T6-MISTAKE-008`, `TC-T6-REPO-007`), report snapshot, concurrency, and regression cases above |
| `NFR-TIME-001` | `TC-T6-MISTAKE-002`; `TC-T6-REPORT-001`, `004`-`005`, `012`-`013` |

The catalog contains 66 distinct case IDs. Formal test review must confirm uniqueness, requirement coverage, executable ownership, and consistency with the detailed design before implementation begins.

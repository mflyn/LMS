# Task 6 Phase 3C GrowthTask Attachment Test Design and Numbered Cases

**Document status:** APPROVED
**Parent catalog:** `docs/development/family-growth-task6-test-cases.md`
**Detailed design:** `docs/superpowers/specs/2026-06-22-family-growth-task6-phase3c-task-attachments-design.md`
**Refined parent cases:** `TC-T6-MEDIA-017`, `TC-T6-MEDIA-018`

## 1. Test Objective and Scope

This addendum verifies that `GrowthTask.attachmentMediaIds` contains only currently bound, same-family, same-child `task_attachment` media and that owner-local create and patch intents converge safely across prepare, commit, public publication, checked unbind, retries, and concurrent task transitions.

The phase covers GrowthTask model additions, attachment normalization, the attachment state service, growth-task router composition, public create/list/detail/patch behavior, and interaction with complete/confirm/delete status transitions. It reuses the approved Phase 3A media-reference client and release-generation contract. It does not retest upload/content/delete internals, Child avatars, FamilyMistake media, deployment wiring, or physical retention cleanup.

No business implementation may be added before this catalog is reviewed and approved. RED tests must be committed before each corresponding production slice.

## 2. Test Levels and Evidence

| Level | Purpose | Evidence file |
| --- | --- | --- |
| model | Defaults, hidden fields, UUID/ObjectId validation, ordered binding-map invariants, pending-state invariants, and canonical patch paths | `backend/services/homework-service/__tests__/models/GrowthTask.mediaReferences.test.js` |
| service | Normalization, exact batched commands, owner CAS state machine, ordering, rollback, retry, and concurrency | `backend/services/homework-service/__tests__/services/growthTaskAttachmentMediaService.test.js` |
| route integration | Authorization, body contract, create/list/detail/patch visibility, status-transition exclusion, errors, and dependency injection | `backend/services/homework-service/__tests__/growthTaskMediaReferences.test.js` |
| regression | Existing GrowthTask lifecycle, star award, filters, pagination, server composition, and all family projects | `growthTasks.test.js`, homework server tests, and `npm run test:family-regression` |

Model and service tests use the real Mongoose GrowthTask model against the homework-service MongoMemoryServer. A narrow model wrapper may inject a specific owner write uncertainty, but state-machine tests may not replace the whole model with an in-memory object.

Route tests mount a real Express app with the production shared error handler and an injected attachment service or media client through `createGrowthTaskRouter`. Tests do not install route-local error handlers, connect to MongoDB at module import time, listen on a port, or rely on test-only response shapes.

## 3. Deterministic Fixtures and Failure Injection

Each test uses fixed ObjectIds, UUIDs, and clocks. Fixtures include two families, two children in the primary family, a parent for each family, and media representing active task attachment, duplicate input, wrong purpose, deleted, sibling, family-scoped, missing, malformed, and cross-family resources.

The media-reference double records complete prepare, commit, and unbind commands and models the approved resource-service semantics:

- prepare validates at most 100 unique references and rejects wrong purpose/scope/status;
- prepare and commit replay the same operation without creating duplicate generations;
- unbind validates the complete batch before its first write and requires each previous `bindingOperationId`;
- a stale unbind cannot release a later bind generation;
- stable prepare failures are sanitized `400/403/404/409` errors;
- transport, timeout, 5xx, malformed success, commit, and unbind failures become `503 MEDIA_REFERENCE_PENDING`.

Owner failures are injected immediately before and immediately after create deletion, uncertainty-marker CAS, public publication CAS, unbinding finalization, and ordinary task patch publication. Concurrency tests use explicit promise barriers around owner claims and remote calls; timing sleeps and retry-until-pass wrappers are prohibited.

Every pending response assertion checks the complete production envelope and proves `details` contains only `resourceId`. Privacy tests use sentinel credentials, task descriptions, operation IDs, generations, storage keys, and URLs, then scan both response bodies and captured structured logs.

## 4. Numbered Cases

| ID | Requirement | Level | Preconditions and action | Expected result | Automated test |
| --- | --- | --- | --- | --- | --- |
| `TC-T6-MEDIA-017A` | `FR-MEDIA-001`, `NFR-DATA-001` | model | Validate legacy, stable none, stable bound, create-pending, patch-binding, and patch-unbinding tasks; then try duplicate public IDs, incomplete or misordered binding maps, malformed UUIDs/ObjectIds, missing pending fields, invalid phases/kinds, and request-derived patch paths. | Legacy empty tasks read as none; each valid state persists; every invalid combination fails validation; internal operation, generation, previous, desired, phase, patch, kind, and uncertainty fields are excluded by default selection. | `GrowthTask.mediaReferences.test.js` |
| `TC-T6-MEDIA-017B` | `FR-MEDIA-001`, `NFR-DATA-001` | service/route | Parent creates a task with valid IDs `[A,B,A]`; when recovery is required, use the returned `taskId` through detail GET rather than submitting a second create request. | Input normalizes to `[A,B]` in first-occurrence order; one durable operation prepares/commits exactly A and B; public IDs remain empty until owner publication and then expose `[A,B]`; recovery creates no duplicate reference or task. | `growthTaskAttachmentMediaService.test.js`, `growthTaskMediaReferences.test.js` |
| `TC-T6-MEDIA-017C` | `FR-MEDIA-001`, `NFR-SEC-001` | route integration | Create or patch with malformed, wrong-purpose, deleted, sibling, family-scoped, missing, and cross-family media; use another-family parent, child token, and media-disabled composition. | Body errors and sanitized resource errors are stable; access errors reveal no task/media existence; `MEDIA_NOT_ENABLED` applies only when the field is supplied; no unsafe public ID, owner patch, or bound reference remains. | `growthTaskMediaReferences.test.js` |
| `TC-T6-MEDIA-017D` | `FR-MEDIA-001`, `NFR-DATA-001` | create rollback | Return a direct stable error from the first prepare, then separately fail task deletion before and after persistence. | Confirmed deletion returns the stable media error and leaves no task; uncertain deletion returns `503` with task ID and never claims rollback; a resumed execution with the uncertainty marker set does not delete from a later stable response. | `growthTaskAttachmentMediaService.test.js`, `growthTaskMediaReferences.test.js` |
| `TC-T6-MEDIA-017E` | `FR-MEDIA-001`, `NFR-DATA-001` | create recovery | Lose prepare response, lose commit response, fail commit once, fail owner publication once, persist publication but lose its result, and simulate a crash after the uncertainty marker but before prepare; resume through detail GET. | The task ID and operation are reused; pending reads expose no requested ID; prepare/commit replays converge when possible; no duplicate task/reference appears; ambiguous pre-call crash remains safely pending rather than deleting a possibly referenced owner. | `growthTaskAttachmentMediaService.test.js`, `growthTaskMediaReferences.test.js` |
| `TC-T6-MEDIA-017F` | `FR-MEDIA-001`, `NFR-DATA-001` | replacement | Start with bound `[A,B]` and patch to `[B,C]`; pause or fail at prepare, commit, public publication, unbind, and final owner CAS, then resume. | Only C is prepared/committed; B retains its old generation; `[A,B]` stays public through binding; `[B,C]` publishes before A unbind; unbind carries A's exact generation; all resumes converge without releasing B or C. | `growthTaskAttachmentMediaService.test.js` |
| `TC-T6-MEDIA-017G` | `FR-MEDIA-001`, `NFR-DATA-001` | removal | Patch `[A,B]` to `[]`, fail batch unbind or finalization once, replay, and separately clear an already-empty task. | Empty public list publishes before checked unbind; one batch releases A and B atomically with their generations; replay finalizes none; already-empty clear performs no remote call. | `growthTaskAttachmentMediaService.test.js`, `growthTaskMediaReferences.test.js` |
| `TC-T6-MEDIA-017H` | `FR-MEDIA-001`, `NFR-DATA-001` | normalization/order | Patch `[A,B,C]` with `[C,A,C,B]`, then submit the identical normalized order and an input exceeding 100 entries before normalization. | First patch publishes `[C,A,B]` without media calls and preserves all generations; identical order is a stable no-op; over-limit input returns validation error even when duplicates would normalize below the limit. | `growthTaskAttachmentMediaService.test.js`, `growthTaskMediaReferences.test.js` |
| `TC-T6-MEDIA-017I` | `FR-MEDIA-001`, `NFR-DATA-001` | atomic owner update | Combine attachment replacement with every editable non-media task field; force direct stable prepare rejection and separately force retryable failure after commit. | Stable rejection preserves the complete old task; pending binding reads old attachments and old fields; one publication applies normalized attachments and the canonical field patch exactly once; request keys never become Mongo paths. | `growthTaskAttachmentMediaService.test.js`, `growthTaskMediaReferences.test.js` |
| `TC-T6-MEDIA-017J` | `FR-MEDIA-001`, `NFR-DATA-001` | read recovery | Read tasks during create binding, patch binding, and unbinding through list and detail. | List performs no remote media calls and returns only the currently usable empty/old/new public list; detail resumes one task and either returns the converged task or the pending envelope; no hidden state is returned. | `growthTaskMediaReferences.test.js` |
| `TC-T6-MEDIA-017K` | `FR-MEDIA-001`, `NFR-DATA-001` | concurrency | Race identical desired arrays, different arrays, a non-attachment patch, and complete/delete operations against one pending attachment mutation using controlled barriers. | One CAS claim wins; identical requests share one operation/generation set; differing arrays return `409 RESOURCE_CONFLICT` after helping the winner; ordinary patch resumes then applies; complete/delete remain unchanged while recovery is pending. | `growthTaskAttachmentMediaService.test.js`, `growthTaskMediaReferences.test.js` |
| `TC-T6-MEDIA-017L` | `FR-MEDIA-001`, `NFR-DATA-001` | batch/generation safety | Bind 100 unique IDs, replace a subset, replay commands, inject one wrong previous generation in a multi-removal batch, and deliver a delayed old unbind after rebind. | Consumer commands never exceed 100 references and contain exact set differences/generations; the existing real resource-service contract proves mixed-generation unbind changes no row and delayed unbind cannot release the newer generation. | `growthTaskAttachmentMediaService.test.js`, resource-service `mediaReferences.test.js` (`TC-T6-MEDIA-012B/C`) |
| `TC-T6-MEDIA-017M` | `FR-MEDIA-001` | lifecycle/regression | Exercise create without attachments, existing list/detail/filter/pagination, complete/confirm/star-award/delete flows, legacy tasks containing `attachments` URLs, and module import without configured media. | Existing behavior and counts remain unchanged; non-media operations work without a binding service; family views omit legacy URL attachments; imports make no network, Mongo connection, or listen call. | `growthTasks.test.js`, `growthTaskMediaReferences.test.js`, homework server tests |
| `TC-T6-MEDIA-018C` | `FR-MEDIA-001`, `NFR-SEC-001` | contract/security | Submit legacy `attachments`, raw URLs, media objects, `null`, scalars, dotted keys, nested task wrappers, unknown fields, and every internal media state/generation path on create and patch. | Requests are rejected rather than ignored; no client-controlled ownership, status, operation, generation, pending patch, or legacy URL persists; successful responses expose only approved task fields and `attachmentMediaIds`. | `growthTaskMediaReferences.test.js` |
| `TC-T6-MEDIA-018D` | `NFR-PRIVACY-001`, `NFR-SEC-001` | privacy/error contract | Force stable, pending, conflict, validation, and database failures while capturing production responses/audit logs containing sentinel private values. | Envelopes contain only approved code/message/details; audit retains approved operation/result/family/child/task/media IDs; neither output contains credentials, Axios config, task text, patch values, URLs, storage data, attachment snapshots, operation UUIDs, or generations. | `growthTaskMediaReferences.test.js` |

## 5. Traceability to Detailed Design

| Design section | Cases |
| --- | --- |
| Scope and legacy-field boundary | `017M`, `018C` |
| Recovery architecture | `017D`, `017E`, `017F`, `017G` |
| Normalization and public order | `017B`, `017H`, `017L` |
| GrowthTask model invariants | `017A`, `018C` |
| Component injection and media-disabled behavior | `017C`, `017M` |
| Create state machine | `017B`, `017D`, `017E` |
| Patch state machine | `017F`, `017G`, `017H`, `017I` |
| Concurrency and task transitions | `017K` |
| Authorization and public contract | `017C`, `017J`, `018C` |
| Observability and privacy | `018D` |
| Migration and rollback compatibility | `017A`, `017M` |

## 6. RED/GREEN and Execution Gates

The implementation plan must map every production slice to one or more numbered RED cases. A RED commit must fail for the intended missing behavior, not for syntax, fixture, configuration, or import errors. GREEN commits must run the narrowest relevant command before broader gates.

The fixed focused gate is:

```bash
npx jest --config backend/services/homework-service/jest.config.js --runInBand \
  GrowthTask.mediaReferences \
  growthTaskAttachmentMediaService \
  growthTaskMediaReferences \
  growthTasks
```

The phase exit gate is:

```bash
npm run test:family-regression
npm run test:family-regression
git diff --check
```

Both full regressions must pass consecutively with identical suite and test totals. No `--onlyFailures`, retry wrapper, reduced suite list presented as a full gate, forced process exit, test-only error middleware, skipped case, focused `.only`, leaked handle, or post-failure rerun may be counted as release evidence.

Static review also verifies:

- every `017A-M` and `018C-D` ID appears in an executable test name;
- no duplicate Task 6 case ID exists across test catalogs;
- no family route returns legacy `attachments` or hidden media fields;
- no production import initiates a remote call, Mongo connection, or listener;
- no task transition bypasses pending attachment recovery.

## 7. Review Gate

Phase 3C may proceed to its TDD implementation plan only when review confirms:

- every create, patch, read, concurrency, and task-transition state boundary has executable evidence;
- direct stable first-prepare rollback is distinguished from every uncertain outcome;
- pending create never exposes requested IDs and pending patch never exposes additions before commit;
- unchanged attachments retain generations and batch removals prove atomic generation checks;
- duplicate normalization and first-occurrence order are deterministic;
- attachment and ordinary task fields publish atomically from canonical paths;
- route tests exercise production authorization and error middleware;
- privacy tests exclude task text, credentials, URLs, operations, generations, and hidden state;
- existing task lifecycle, star award, pagination, server behavior, and all family projects remain in the regression gate.

# Family Growth Task 6 Detailed Design

**Document status:** APPROVED
**Baseline candidate:** FGT-MVP-1.4  
**Scope:** Private family media, academic mistakes, deterministic weekly reports  
**Requirements:** `FR-MEDIA-001`, `FR-MEDIA-002`, `FR-MISTAKE-001`, `FR-REPORT-001`, `NFR-PRIVACY-001`, `NFR-SEC-001`, `NFR-DATA-001`, `NFR-TIME-001`

## 1. Objective and Scope

Task 6 delivers the media and analytics capabilities needed to complete the first family-growth reporting loop:

- A parent or child can upload and temporarily access private family images without exposing permanent URLs.
- A parent or child can record and review academic mistakes with role-specific field permissions.
- A parent or child can obtain a deterministic weekly report across moral, academic, physical, artistic, and labor dimensions.
- An ended natural week freezes on its first successful generation while feedback remains independently editable.

The Task 6 gate includes the transition plan's Task 6 and Task 6.5 work. Delivery order is private media, mistakes, and then weekly reports because mistake media validation depends on the media service and report aggregation depends on mistakes.

Task 6 does not add AI summaries, OCR, video, public media, push notifications, background notification jobs, monthly reports, or cross-family sharing.

## 2. Chosen Architecture

`resource-service` is the sole owner of `MediaAsset`, private object bytes, and media reference registrations. It exposes public upload, access-grant, signed-content, and delete operations. It also exposes service-internal prepare, commit, and unbind reference commands authenticated by a dedicated service credential. Internal commands are never registered in the gateway.

`analytics-service` is the sole owner of `FamilyMistake` and `WeeklyReport`. It calls the media reference commands for mistake media fields. It reads task, log, point, and mistake projections through `familyReadRepository`; it does not import private models from `homework-service` or `progress-service`.

Cutoff-state history remains with each source owner: analytics-service writes mistake state events and progress-service writes knowledge-point mastery events. The common read adapter consumes their projections but never mutates either source.

The gateway exposes only these Task 6 public prefixes:

```text
/api/media
/api/mistakes
/api/reports/weekly
```

Alternatives rejected:

- Importing another service's Mongoose models would erase service ownership and make a later database split unsafe.
- Sharing a cross-service MongoDB transaction would couple deployments and cannot protect filesystem writes.
- Permanent media URLs or static-directory mounting would violate the private-by-default requirement.
- Treating an unavailable report source as an empty result would silently publish false family statistics.

## 3. Service Startup Prerequisite

Before mounting Task 6 routes, `resource-service` and `analytics-service` must follow the existing `createApp`/`connectDatabase`/`startServer` contract:

- Importing app modules must not connect to MongoDB, open a port, create a Socket.IO listener, or install process-global handlers.
- `createApp(dependencies)` constructs the Express app and accepts injectable repositories, media store, clock, and logger.
- `connectDatabase(config)` establishes and verifies the MongoDB connection. Analytics additionally requires a transaction-capable replica set before enabling mistake state-event writes.
- `startServer(config)` validates configuration, connects, and only then listens.
- Unit and integration tests own exactly one Mongo lifecycle and never rely on import side effects.
- The shared production error handler returns the approved `success=false`, `error.code/message/details`, and `requestId` envelope.

This refactor is a Task 6 entry condition, not an unrelated cleanup. Existing analytics Socket.IO behavior remains available only from the explicit production start path.

## 4. Private Media Design

### 4.1 MediaAsset

| Field | Type | Constraint |
| --- | --- | --- |
| `familyId` | ObjectId | required; every access predicate starts with it |
| `childId` | ObjectId | required except for a family-scoped `avatar` uploaded by a parent |
| `uploadedBy` | ObjectId | required authenticated parent or child |
| `purpose` | String | required approved purpose enum |
| `mimeType` | String | `image/jpeg|image/png|image/webp` |
| `sizeBytes` | Number | positive integer, maximum 10 MiB |
| `storageKey` | String | required random internal key; never returned |
| `status` | String | `active|deleted`, default `active` |
| `deletedAt` | Date | set exactly once on soft delete |
| `createdAt`, `updatedAt` | Date | server controlled |

Indexes:

```text
{ familyId: 1, childId: 1, status: 1, createdAt: -1 }
{ familyId: 1, storageKey: 1 } unique
{ status: 1, deletedAt: 1 }
```

`MediaReference` is a resource-service internal collection that prevents an unbounded references array in `MediaAsset`. Each row contains `familyId`, `childId`, `mediaId`, `resourceType`, `resourceId`, `field`, `operationId`, `state=prepared|bound|released`, and `leaseExpiresAt`. The unique key is:

```text
{ familyId: 1, mediaId: 1, resourceType: 1, resourceId: 1, field: 1 }
```

The effective reference set of a media asset is the `bound` `MediaReference` rows owned by resource-service. No other service reads or writes this collection directly.

### 4.2 Upload Pipeline

`POST /api/media` accepts `multipart/form-data` fields `file`, `purpose`, and optional `childId`.

The route performs these steps before persistence:

1. Resolve `familyId` and effective `childId` from the authenticated identity. A child's identity always forces its own child ID. A parent may omit `childId` only for `purpose=avatar`; that asset is family-scoped and parent-only for access and deletion. All other purposes require a child owned by the authenticated family.
2. Enforce the complete purpose enum `avatar|task_attachment|task_completion|mistake_question|mistake_answer|growth_evidence` and the actor/purpose allowlist. Child uploads permit only `task_completion`, `mistake_question`, `mistake_answer`, and `growth_evidence`.
3. Stream into a bounded temporary location; abort immediately after 10 MiB.
4. Detect JPEG, PNG, or WebP from magic bytes and parse the image. Filename and client MIME are not trusted.
5. Decode and re-encode the image to remove EXIF and other embedded metadata.
6. Store the sanitized bytes beneath `PRIVATE_MEDIA_ROOT` using a cryptographically random `storageKey` outside all static web roots.
7. Persist `MediaAsset`. If persistence fails, delete the newly stored object.

Fixtures and production code use the same signature and metadata-removal path. Original filename, original bytes, EXIF, and temporary path are never persisted or logged.

### 4.3 Access Grant and Signed Content

`GET /api/media/:mediaId/access` first authorizes an active child-scoped asset by authenticated family and child. A family-scoped avatar (`childId=null`) is authorized by family and parent role. It returns a URL valid for at most 300 seconds and `expiresAt`; the response has `Cache-Control: no-store`.

The URL points to `GET /api/media/:mediaId/content` and contains an expiry, random nonce, and HMAC signature over the normalized path, media ID, expiry, and nonce. Every security-relevant query value is signed. `MEDIA_URL_SIGNING_SECRET` is independent of JWT and service credentials, has at least 32 characters, and signatures are compared in constant time.

The content route does not require JWT because the URL itself is the bearer capability. It verifies the signature and expiry, re-reads the asset as active, streams only its internal object, and returns `Cache-Control: private, no-store`, `Content-Disposition: inline`, and `X-Content-Type-Options: nosniff`. It never redirects to or returns a permanent object URL.

### 4.4 Delete and Cleanup

`DELETE /api/media/:mediaId` is idempotent. The first call atomically changes `active` to `deleted`, sets `deletedAt`, and releases only uncommitted `prepared` references. Existing `bound` references remain as retention guards until the owning business object explicitly replaces or removes the media ID. Repeated calls return `204`.

Deleted media is immediately unavailable through access-grant and signed-content routes and cannot be prepared as a new reference. Physical cleanup is eligible only when all conditions hold:

- status is `deleted`;
- the later of `deletedAt` and the last bound-reference `releasedAt` is at least 30 days old;
- no `bound` `MediaReference` remains.

Task 6 provides the eligibility query and idempotent cleanup operation. Scheduling the operation is a deployment concern; deletion correctness does not depend on a scheduler running immediately.

`MediaReference` uses `prepared|bound|released`; prepare creates `prepared`, commit changes it to `bound`, and unbind changes it to `released` and records `releasedAt`. The effective reference set is the `bound` rows. A deleted asset rejects every new prepare, but deletion never silently releases a bound business reference. Cleanup therefore retains bytes for a full 30 days after both deletion and the last business unbind.

## 5. Media Reference Protocol

Every business model that stores a media ID participates in the protocol:

| Owner/resource field | Required purpose and scope |
| --- | --- |
| user-service `Child.avatarMediaId` | `avatar`, same family and target child |
| homework-service `GrowthTask.attachmentMediaIds[]` | `task_attachment`, same family and child |
| analytics-service `FamilyMistake.questionMediaId` | `mistake_question`, same family and child |
| analytics-service `FamilyMistake.childAnswerMediaId` | `mistake_answer`, same family and child |

Purposes without a persisted business field in the current MVP (`task_completion`, `growth_evidence`, and family-scoped avatar) may be uploaded and read but are not falsely registered as bound. Adding a field for them requires extending this table and its executable consumer tests first.

The caller uses a preallocated or existing resource ObjectId and one operation ID for a mutation:

1. `POST /api/internal/media/references/prepare` validates service credential, family/child scope, active status, and field-specific purpose, then creates or replays `prepared` reference rows with a 15-minute lease.
2. The owning service saves the business mutation with `mediaReferenceState=pending` and the operation ID. Task 6 adds these binding fields to Child and GrowthTask as well as FamilyMistake; clients cannot write them.
3. `POST /api/internal/media/references/commit` changes exactly those prepared rows to `bound`; the owner changes its state to `bound`.
4. Replacement or removal calls `POST /api/internal/media/references/unbind` for the prior field after the new binding is committed.

All commands are idempotent by operation ID and reference identity. If business persistence fails, the owner performs best-effort unbind; an expired prepared lease is also reclaimable. If commit fails after persistence, the public mutation returns `503 MEDIA_REFERENCE_PENDING` with `details.resourceId`. A later detail read or patch first resumes the same commit. Pending media fields are not returned as usable references until binding converges. Replacement commits all new bindings before releasing prior bindings; array updates compare normalized media-ID sets and replay safely.

The internal credential is `MEDIA_REFERENCE_SERVICE_TOKEN`, independent of JWT, gateway identity, and signed-content secrets. It is at least 32 characters, compared in constant time, and absent from logs.

## 6. FamilyMistake Design

`FamilyMistake.dimension` is always `academic`.

| Field | Type | Constraint |
| --- | --- | --- |
| `familyId`, `childId` | ObjectId | required |
| `subject` | String | required, trimmed, maximum 100 |
| `knowledgePointId` | ObjectId | optional same-child point reference |
| `knowledgePointName` | String | optional, trimmed, maximum 100 |
| `questionMediaId`, `childAnswerMediaId` | ObjectId | optional active media IDs only |
| `correctAnswer`, `parentNote`, `childExplanation` | String | trimmed, bounded text |
| `reason` | String | required normalized machine key, maximum 50 characters |
| `corrected`, `reviewed`, `mastered` | Boolean | default false |
| `reviewReminderDate` | String | optional valid LocalDate |
| `mediaReferenceState` | String | `none|pending|bound` |
| `mediaBindingOperationId` | String | optional server operation ID |
| `createdBy`, `updatedBy` | ObjectId | server controlled |
| `createdAt`, `updatedAt` | Date | server controlled |

Indexes:

```text
{ familyId: 1, childId: 1, createdAt: -1 }
{ familyId: 1, childId: 1, subject: 1, reason: 1, mastered: 1 }
{ familyId: 1, childId: 1, reviewReminderDate: 1, mastered: 1 }
```

Every read and mutation predicate contains `familyId + childId`. A parent may create and update all documented business fields. On create, a child must provide `subject` and `reason` and may also provide `childAnswerMediaId`, `corrected`, `reviewed`, `mastered`, and `childExplanation`; `subject` and `reason` become parent-managed after creation. On patch, a child may update only `childAnswerMediaId`, `corrected`, `reviewed`, `mastered`, and `childExplanation`. Parent-owned answer, question, note, knowledge-point, and post-create classification fields return `403 FIELD_ACCESS_DENIED`. Ownership, dimension, audit, and binding fields are never client writable.

`GET /api/mistakes` supports `reviewStatus=pending|reviewed|mastered` in addition to the documented scalar filters. The statuses are mutually exclusive: `mastered` means `mastered=true`; `reviewed` means `mastered=false && reviewed=true`; `pending` means `mastered=false && reviewed=false`. Reminder-date range filters are independent and use family LocalDate values.

Media purposes are field-specific: `questionMediaId` requires `mistake_question`; `childAnswerMediaId` requires `mistake_answer`. A media scope, purpose, or status mismatch is never silently ignored.

### 6.1 Cutoff State History

Weekly reports must reconstruct review state at the week cutoff, not at report-generation time. Analytics owns immutable `FamilyMistakeStateEvent` rows and progress-service owns immutable `KnowledgePointMasteryEvent` rows. Each row contains `familyId`, `childId`, the source ID, the relevant reviewed/mastered or mastery-level state, `effectiveAt`, and an idempotent `operationId`. The unique indexes include `familyId` and the source ID plus operation ID.

Creation writes an initial event, and every state mutation writes the source update and its event atomically in the owning service's MongoDB transaction. The report projection selects the latest event with `effectiveAt < cutoff`. Task 6 deployment records `historyAvailableFrom`; a requested cutoff before complete history is available fails with `503 AGGREGATION_UNAVAILABLE` rather than substituting the current state. No report reads a post-cutoff state to infer a historical review point.

## 7. Family Read Repository

`backend/common/repositories/familyReadRepository.js` is a read-only adapter. Analytics receives it by dependency injection. Each method requires `familyId`, `childId`, a UTC cutoff or LocalDate range, and an explicit timeout:

```text
listTaskProjection({ familyId, childId, from, to, cutoff, timeoutMs })
listGrowthLogProjection({ familyId, childId, from, to, cutoff, timeoutMs })
listKnowledgePointProjection({ familyId, childId, cutoff, timeoutMs })
listMistakeProjection({ familyId, childId, from, to, cutoff, timeoutMs })
```

The implementation returns only fields required by report formulas, uses lean reads, and rejects missing family/child filters. Knowledge-point and mistake review projections resolve the last immutable state event before `cutoff`; missing history is an unavailable source, not an empty projection. The default timeout is 2000 ms and can be lowered in tests. It does not return Mongoose documents and has no mutation API.

Any required projection timeout, connection error, malformed result, or unavailable source aborts report generation with `503 AGGREGATION_UNAVAILABLE`; the response identifies only the source name, not connection details. A failed generation is never cached.

## 8. WeeklyReport Design

### 8.1 Stored Snapshot

The unique identity is `{ familyId, childId, weekStart }`, where `weekStart` is the Monday LocalDate in the family's IANA timezone.

Stored fields include `familyId`, `childId`, `weekStart`, `weekEnd`, `timezone`, the complete statistics snapshot, immutable `generatedSuggestion`, `sourceCutoffAt`, `generatedAt`, `frozen`, mutable `parentNote`, mutable `nextWeekSuggestion`, and feedback audit fields. Child reflection is derived from authorized GrowthLog data and is not directly writable through WeeklyReport. Statistics and feedback are separate update paths.

Unique index:

```text
{ familyId: 1, childId: 1, weekStart: 1 }
```

The current week is recomputed from source projections on every request in Task 6; it may update only a record matching the identity and `frozen=false`. Recalculation updates statistics and `generatedSuggestion` without overwriting feedback. If no parent override exists, `nextWeekSuggestion` follows the regenerated suggestion; otherwise the parent value remains unchanged.

For an ended week, generation first computes the cutoff snapshot and then either inserts `frozen=true` or atomically promotes an existing current-week row with a compare-and-set predicate containing `frozen=false`. Promotion changes only snapshot/freeze fields and preserves feedback. A duplicate-key or compare-and-set loser reads and returns the frozen winner. If the winner is not yet visible, the request retries a bounded number of times and otherwise returns `503 AGGREGATION_UNAVAILABLE`; it never returns an ended non-frozen report. No route can patch statistics or unfreeze a report.

### 8.2 Time Boundary and Formulas

The source cutoff is family-local `weekStart + 7 days 00:00`, converted to UTC. LocalDate comparisons use the family timezone and never the server timezone.

- `recordDays`: count distinct GrowthLog LocalDates in the week.
- Planned tasks: `dueDate` is in the week, `createdAt < cutoff`, and `cancelledAt` is absent or `cancelledAt >= cutoff`.
- Completed tasks: a planned task with `completedAt < cutoff`; confirmation is not required.
- Completion rate: `completed / planned * 100`, rounded half-up to at most two decimal places; when planned is zero return `null`. Implementations use integer counts (`Math.round(completed * 10000 / planned) / 100`) to avoid divergent formatting rules.
- Total and dimension durations: sum GrowthLog `durationMinutes` only. Never add `GrowthTask.actualMinutes`.
- Dimension task statistics: planned and completed counts for all five dimensions, including explicit zeros.
- Mistakes: records whose `createdAt` falls in the family-local week and before cutoff.
- Top mistake reasons: sort by count descending, then reason ascending.
- Review points: union mistakes that were unmastered and due at cutoff with knowledge points whose last pre-cutoff mastery event was `needs_review`; deduplicate and stable-sort by dimension, subject/area, then name.

### 8.3 Deterministic Suggestions

Suggestions are fixed rules in this order:

1. If pending math mistakes exist, add the fixed math-review suggestion.
2. If completed physical tasks are fewer than 6, recommend up to two outdoor exercise sessions.
3. If completed labor tasks are fewer than 3, add the fixed Wednesday/Saturday labor suggestion.

No model call, free-form generation, or random ordering is permitted. The same frozen inputs produce byte-equivalent statistics and `generatedSuggestion`. On first creation, `nextWeekSuggestion` is initialized from `generatedSuggestion`; a later parent override is feedback and does not mutate the generated value.

### 8.4 Feedback

`PATCH /api/reports/weekly/:reportId/feedback` is parent-only and accepts only `parentNote` and `nextWeekSuggestion`, each with the API's 1000-character limit. It creates no report from partial data: if the report does not exist, it returns `404 RESOURCE_NOT_FOUND`; callers generate it through the GET operation first. Feedback changes never alter `statistics`, `generatedSuggestion`, `sourceCutoffAt`, `generatedAt`, or `frozen`. Children record weekly reflection through GrowthLog `childReflection`; Task 6 provides no child write operation on WeeklyReport.

## 9. Authorization and Error Contract

Parents may access children in their own family. Child identities are always forced to their own child ID. Cross-family and sibling attempts return the same stable `403 CHILD_ACCESS_DENIED` without revealing existence.

| Condition | Status/code |
| --- | --- |
| invalid request, media signature/type/size, date, or field combination | `400 VALIDATION_ERROR` |
| invalid internal media credential | `401 INVALID_SERVICE_CREDENTIAL` |
| wrong family, sibling, role, or media scope | `403 CHILD_ACCESS_DENIED` |
| role writes a forbidden field | `403 FIELD_ACCESS_DENIED` |
| missing or deleted resource | `404 RESOURCE_NOT_FOUND` |
| media purpose mismatch | `400 MEDIA_PURPOSE_MISMATCH` |
| report source timeout or failure | `503 AGGREGATION_UNAVAILABLE` |
| persisted mistake awaiting media commit | `503 MEDIA_REFERENCE_PENDING` |

All errors use the shared production envelope. Tests exercise the real app and shared handler; route-local test-only error handlers are forbidden.

## 10. Observability, Configuration, and Deployment

Structured logs may contain requestId, familyId, childId, mediaId/mistakeId/weekStart, purpose, operation, result, source name, and duration. They must not contain bytes, filenames, storage keys, EXIF, signed URLs, query signatures, credentials, correct answers, child explanations, or parent notes.

Required production configuration:

- `PRIVATE_MEDIA_ROOT`: persistent, non-static private volume.
- `MEDIA_URL_SIGNING_SECRET`: external secret, at least 32 characters.
- `MEDIA_REFERENCE_SERVICE_TOKEN`: external secret, at least 32 characters.
- `MEDIA_ACCESS_MAX_AGE_SECONDS`: maximum 300, default 300.
- `MEDIA_REFERENCE_LEASE_SECONDS`: default 900.
- `FAMILY_READ_TIMEOUT_MS`: positive integer, default 2000.
- `REPORT_HISTORY_AVAILABLE_FROM`: required UTC ISO 8601 instant established by the Task 6 event-history migration; cutoffs before it are unavailable.

Compose and Kubernetes mount a persistent resource-service volume and receive both secrets through the existing external `family-growth-secrets` process. The media-reference token is supplied only to resource-service and its user-, homework-, and analytics-service consumers. No Secret manifest or rendered credential is committed. Resource and analytics startup fail when Task 6 routes are enabled but required configuration is invalid; user-service and homework-service fail startup when their media-enabled fields are configured without a valid reference credential.

Rollback removes the three gateway prefixes and disables Task 6 route mounting. It retains mistake/report metadata and private objects. Existing signed URLs naturally expire within 300 seconds; rollback never physically deletes media or frozen reports.

## 11. Verification and Gate

Numbered tests are grouped as:

- `TC-T6-MEDIA-*`: private storage, signatures, authorization, references, deletion, cleanup, and redaction.
- `TC-T6-MISTAKE-*`: model rules, role fields, media binding, filters, and isolation.
- `TC-T6-REPORT-*`: formulas, timezone, deterministic suggestions, freezing, feedback, and concurrency.
- `TC-T6-REPO-*`: mandatory scope, projections, timeout, and source failures.
- `TC-T6-GW-*`: public routes and absent internal commands.
- `TC-T6-REG-*`: startup isolation, prior family tests, full regression, and stability.

Tests use generated JPEG, PNG, and WebP fixtures with real signatures and embedded metadata. They use fixed clocks and at least two family timezones. Concurrent ended-week requests must converge to one frozen snapshot. Every required source is independently forced to timeout and fail. Stateful Mongo suites run serially or with isolated replica-set resources so the same-commit gate is repeatable.

Task 6 may pass only when:

- every numbered test maps to an executable test and approved requirement;
- targeted resource, user, homework, analytics, common repository, and gateway suites pass;
- prior Task 3-5 family suites pass;
- exact root `npm run test:nocoverage` finishes and has no new failure against the approved baseline;
- two same-commit family regression runs have identical passing totals and no leaked process;
- implementation review has no open BLOCKER, MAJOR, or MINOR finding;
- deployment and secret checks pass;
- `git diff --check` passes and no generated artifacts remain.

## 12. Implementation Order and Review Decision

Implementation order after design and test review approval:

1. Refactor resource/analytics startup and shared test lifecycle.
2. Add failing media tests, then private store, models, routes, reference commands, Child/GrowthTask consumers, deployment, and gateway wiring.
3. Add failing mistake tests, then model, role authorization, media binding recovery, mistake state events, and routes.
4. Add failing repository/report tests, then progress-service knowledge-point mastery events, projections, aggregation, current-to-ended snapshot promotion, feedback, and routes.
5. Run targeted tests, implementation review/remediation, full regression twice, and final gate evidence.

This design is ready for implementation planning only after the product owner approves this document and the numbered Task 6 test catalog, and formal design/test reviews close all findings.

# Task 6 Media Capability Traceability

**Document status:** COVERED
**Review date:** 2026-07-08
**Scope:** Task 6 media capabilities across resource-service, common client, Child avatar, GrowthTask attachments, FamilyMistake media, gateway, deployment, and final gate evidence.

## Decision

Task 6 media capability is **covered and final-gate complete** on code candidate `bcaaea2a`.

The following sub-scopes have executable evidence:

- Private media upload, access grants, signed content, soft delete, 30-day cleanup, redaction, and internal reference commands in `resource-service`.
- Shared internal media-reference client in `backend/common/services/mediaReferenceClient.js`.
- Child avatar media consumer in `user-service`.
- GrowthTask attachment media consumer in `homework-service`.
- FamilyMistake `questionMediaId` and `childAnswerMediaId` binding, replacement, removal, recovery, and privacy behavior in `analytics-service`.
- Gateway public signed media content proxy and internal media reference route exclusion.
- Task 6 deployment checks for private volume, external secret wiring, least-service media token exposure, and report-history configuration.
- Final Task 6 implementation review and gate evidence.

`FR-MEDIA-001`, `FR-MEDIA-002`, and `NFR-PRIVACY-001` are now `COVERED`.

## Current Evidence Sources

| Area | Evidence |
| --- | --- |
| Resource media API | `backend/services/resource-service/__tests__/familyMedia.test.js`, `mediaCapability.test.js`, `privateMediaStore.test.js`, `mediaModels.test.js`; plan self-review in `docs/superpowers/plans/2026-06-21-family-growth-task6-phase2b2-media-api.md` |
| Resource media references and cleanup | `backend/services/resource-service/__tests__/mediaReferences.test.js`, `mediaCleanup.test.js`, `familyMediaPrivacy.test.js`; plan self-review in `docs/superpowers/plans/2026-06-21-family-growth-task6-phase2c-media-references.md` |
| Shared reference client | `backend/common/services/__tests__/mediaReferenceClient.test.js`; review record `docs/development/family-growth-task6-phase3a-review.md` |
| Child avatar consumer | `backend/services/user-service/__tests__/models/User.mediaReferences.test.js`, `services/childAvatarMediaService.test.js`, `routes/childMediaReferences.test.js`; review record `docs/development/family-growth-task6-phase3b-review.md` |
| GrowthTask attachment consumer | `backend/services/homework-service/__tests__/models/GrowthTask.mediaReferences.test.js`, `services/growthTaskAttachmentMediaService.test.js`, `growthTaskMediaReferences.test.js`; review record `docs/development/family-growth-task6-phase3c-review.md` |
| FamilyMistake media consumer | `backend/services/analytics-service/__tests__/familyMistakeMediaSaga.test.js`, `familyMistakes.test.js`; review record `docs/development/family-growth-task6-implementation-review.md` |
| Gateway and deployment closure | `backend/gateway/__tests__/familyTask6Routes.test.js`, `backend/common/deployment/__tests__/task6Deployment.test.js` |
| Final Task 6 gate | `docs/development/family-growth-task6-gate.md` |

## Media Case Matrix

| Case | Status | Evidence or remaining owner |
| --- | --- | --- |
| `TC-T6-MEDIA-001` | COVERED | `mediaModels.test.js`, `familyMedia.test.js`; upload accepts approved purposes and preserves family-first metadata without exposing storage data. |
| `TC-T6-MEDIA-002` | COVERED | `privateMediaStore.test.js`, `familyMedia.test.js`; invalid/corrupt/oversized media is rejected and cleanup is asserted. |
| `TC-T6-MEDIA-003` | COVERED | `privateMediaStore.test.js`, `familyMedia.test.js`; persisted JPEG/WebP bytes are sanitized and EXIF-free. |
| `TC-T6-MEDIA-004` | COVERED | `familyMedia.test.js`; child sibling targets, parent-only purpose attempts, and cross-family parent targets are rejected. |
| `TC-T6-MEDIA-005` | COVERED | `familyMedia.test.js`; child uploads resolve to self and only child-allowed purposes succeed. |
| `TC-T6-MEDIA-006` | COVERED | `mediaCapability.test.js`, `familyMedia.test.js`; access grants are short-lived and omit storage metadata. |
| `TC-T6-MEDIA-007` | COVERED | `mediaCapability.test.js`, `familyMedia.test.js`; signed-content path, ID, expiry, nonce, signature, and expiration tampering are rejected. |
| `TC-T6-MEDIA-008` | COVERED | `familyMedia.test.js`; cross-family, sibling, and child-to-family-avatar access attempts are denied without metadata disclosure. |
| `TC-T6-MEDIA-009` | COVERED | Resource-side soft delete/access denial/new-prepare rejection is covered by `familyMedia.test.js`; FamilyMistake replacement/removal interaction is covered by `TC-T6-MISTAKE-011`. |
| `TC-T6-MEDIA-010` | COVERED | `mediaCleanup.test.js`; deletion age, latest-release age, bound-reference retention, and idempotent cleanup are covered. |
| `TC-T6-MEDIA-011` | COVERED | `mediaReferences.test.js`; absent, short, invalid, and valid service credentials are covered. |
| `TC-T6-MEDIA-012` | COVERED | `mediaModels.test.js`, `mediaReferences.test.js`; prepare/commit/unbind replay and single-row convergence are covered. |
| `TC-T6-MEDIA-012A` | COVERED | `mediaModels.test.js`, `mediaReferences.test.js`; release operation identity is independent from bind generation. |
| `TC-T6-MEDIA-012B` | COVERED | `mediaReferences.test.js`; delayed unbind cannot release a newer binding generation. |
| `TC-T6-MEDIA-012C` | COVERED | `mediaReferences.test.js`; old replay cannot resurrect released state and mixed-generation unbind rolls back atomically. |
| `TC-T6-MEDIA-013` | COVERED | `mediaReferences.test.js`; missing, deleted, wrong-family, wrong-child, and wrong-purpose media are rejected without rows. |
| `TC-T6-MEDIA-014` | COVERED | `mediaReferences.test.js`; expired prepared references are reclaimed while active bound references are retained. |
| `TC-T6-MEDIA-015` | COVERED | `familyMediaPrivacy.test.js`, `logRedaction.test.js`, `errorHandler.test.js`; logs and errors redact signed URLs, credentials, storage keys, bytes, EXIF, and private text. |
| `TC-T6-MEDIA-016A` | COVERED | `mediaReferenceClient.test.js`; shared client sends exact internal paths, service token, timeout, and payload. |
| `TC-T6-MEDIA-016B` | COVERED | `mediaReferenceClient.test.js`; stable remote validation/scope/purpose errors remain sanitized and actionable. |
| `TC-T6-MEDIA-016C` | COVERED | `mediaReferenceClient.test.js`; timeout/network/5xx/malformed success results become pending without credential disclosure. |
| `TC-T6-MEDIA-016D` | COVERED | `User.mediaReferences.test.js`; Child avatar model defaults, hidden state, and invariants are covered. |
| `TC-T6-MEDIA-016E` | COVERED | `childAvatarMediaService.test.js`, `childMediaReferences.test.js`; initial Child avatar binding and replay converge. |
| `TC-T6-MEDIA-016F` | COVERED | `childAvatarMediaService.test.js`, `childMediaReferences.test.js`; stable rejection, access denial, disabled mode, and unchanged owner state are covered. |
| `TC-T6-MEDIA-016G` | COVERED | `childAvatarMediaService.test.js`, `childMediaReferences.test.js`; pending initial binding and detail/PATCH recovery are covered. |
| `TC-T6-MEDIA-016H` | COVERED | `childAvatarMediaService.test.js`; avatar replacement ordering and recovery are covered. |
| `TC-T6-MEDIA-016I` | COVERED | `childAvatarMediaService.test.js`; avatar removal, unbind recovery, and already-null no-op are covered. |
| `TC-T6-MEDIA-016J` | COVERED | `childAvatarMediaService.test.js`; canonical profile patching and atomic avatar/profile updates are covered. |
| `TC-T6-MEDIA-016K` | COVERED | `childAvatarMediaService.test.js`; identical/different target concurrency and non-avatar patch recovery are covered. |
| `TC-T6-MEDIA-016L` | COVERED | `childMediaReferences.test.js`; Child detail resumes pending state while list avoids remote media calls. |
| `TC-T6-MEDIA-016M` | COVERED | `childMediaReferences.test.js`; legacy avatar omission and import-safety behavior are covered. |
| `TC-T6-MEDIA-017A` | COVERED | `GrowthTask.mediaReferences.test.js`; GrowthTask media state invariants and hidden selection are covered. |
| `TC-T6-MEDIA-017B` | COVERED | `growthTaskAttachmentMediaService.test.js`, `growthTaskMediaReferences.test.js`; normalized attachment create and duplicate-free recovery are covered. |
| `TC-T6-MEDIA-017C` | COVERED | `growthTaskMediaReferences.test.js`; invalid media, authorization-before-media, and disabled composition are covered. |
| `TC-T6-MEDIA-017D` | COVERED | `growthTaskAttachmentMediaService.test.js`, `growthTaskMediaReferences.test.js`; rollback boundary and stable sanitized rejection are covered. |
| `TC-T6-MEDIA-017E` | COVERED | `growthTaskAttachmentMediaService.test.js`, `growthTaskMediaReferences.test.js`; pending create and detail recovery are covered. |
| `TC-T6-MEDIA-017F` | COVERED | `growthTaskAttachmentMediaService.test.js`; replacement set differences, retained generations, publication ordering, and replay are covered. |
| `TC-T6-MEDIA-017G` | COVERED | `growthTaskAttachmentMediaService.test.js`, `growthTaskMediaReferences.test.js`; removal and checked batch unbind are covered. |
| `TC-T6-MEDIA-017H` | COVERED | `growthTaskAttachmentMediaService.test.js`, `growthTaskMediaReferences.test.js`; normalization, reorder no-op, and over-limit rejection are covered. |
| `TC-T6-MEDIA-017I` | COVERED | `growthTaskAttachmentMediaService.test.js`, `growthTaskMediaReferences.test.js`; attachment and owner patch atomicity are covered. |
| `TC-T6-MEDIA-017J` | COVERED | `growthTaskAttachmentMediaService.test.js`, `growthTaskMediaReferences.test.js`; list/detail read recovery boundaries are covered. |
| `TC-T6-MEDIA-017K` | COVERED | `growthTaskAttachmentMediaService.test.js`, `growthTaskMediaReferences.test.js`; CAS loser behavior and lifecycle recovery exclusion are covered. |
| `TC-T6-MEDIA-017L` | COVERED | `growthTaskAttachmentMediaService.test.js`; 100-reference bound and exact-generation unbind safety are covered. |
| `TC-T6-MEDIA-017M` | COVERED | `growthTaskMediaReferences.test.js`, `growthTasks.test.js`; non-media regression, legacy attachment omission, and import safety are covered. |
| `TC-T6-MEDIA-018A` | COVERED | `childMediaReferences.test.js`; unsafe Child avatar inputs and internal fields are rejected. |
| `TC-T6-MEDIA-018B` | COVERED | `childMediaReferences.test.js`; Child avatar response and audit privacy are covered. |
| `TC-T6-MEDIA-018C` | COVERED | `growthTaskAttachmentMediaService.test.js`, `growthTaskMediaReferences.test.js`; unsafe GrowthTask media inputs and internal fields are rejected. |
| `TC-T6-MEDIA-018D` | COVERED | `growthTaskMediaReferences.test.js`; GrowthTask response and audit privacy are covered. |
| `TC-T6-MEDIA-018` FamilyMistake portion | COVERED | `familyMistakeMediaSaga.test.js`; FamilyMistake rejects raw URLs/media objects/internal binding fields and exposes only approved media IDs. |

## Related Closed Media Requirements

| Case | Status | Evidence |
| --- | --- | --- |
| `TC-T6-MISTAKE-009` | COVERED | FamilyMistake create/update media validation, stable errors, rollback, and disabled-mode behavior pass in `familyMistakeMediaSaga.test.js`. |
| `TC-T6-MISTAKE-010` | COVERED | FamilyMistake pending media commit resumes by read or patch without duplicate references in `familyMistakeMediaSaga.test.js`. |
| `TC-T6-MISTAKE-011` | COVERED | FamilyMistake question media replacement/removal commits new binding before idempotent old unbind in `familyMistakeMediaSaga.test.js`. |
| `TC-T6-MISTAKE-012` | COVERED | FamilyMistake persistence failure after prepare is covered by stable rollback and lease/recovery behavior in `familyMistakeMediaSaga.test.js`. |
| `TC-T6-GW-003` | COVERED | Gateway proxies signed media content URL without JWT only for `/api/media/:mediaId/content`; resource-service validates capability. |
| `TC-T6-REG-002` | COVERED | Compose/Kubernetes private volume, external secret wiring, non-static media root, least-service token exposure, and report history configuration pass in `task6Deployment.test.js`. |

## Requirement Rollup

| Requirement | Current conformance | Reason |
| --- | --- | --- |
| `FR-MEDIA-001` | COVERED | Upload/access/reference protocol, Child/GrowthTask/FamilyMistake consumers, gateway signed-content proxy, deployment checks, and final gate pass. |
| `FR-MEDIA-002` | COVERED | Resource delete/cleanup and FamilyMistake media replacement/removal unbind pass. |
| `NFR-PRIVACY-001` | COVERED | Core media, Child avatar, GrowthTask, FamilyMistake privacy, gateway signed content, deployment secret handling, and final gate pass. |

## Closure Rule

All pending rows above passed on code candidate `bcaaea2a` and are recorded in `docs/development/family-growth-task6-gate.md` and `docs/development/family-growth-task6-implementation-review.md`. New Task 6 media regressions must update this document and rerun the final gate.

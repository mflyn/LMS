# Task 6 Phase 3B Child Avatar Test Design and Numbered Cases

**Document status:** APPROVED
**Parent catalog:** `docs/development/family-growth-task6-test-cases.md`
**Detailed design:** `docs/superpowers/specs/2026-06-21-family-growth-task6-phase3b-child-avatar-design.md`
**Refined parent cases:** `TC-T6-MEDIA-016`, `TC-T6-MEDIA-018`

## 1. Test Objective and Scope

This addendum verifies that `Child.avatarMediaId` is the only usable avatar-media field in the family Child contract and that its owner-local intent converges safely across prepare, commit, owner persistence, replacement unbind, removal, retries, and concurrent requests.

The phase covers the User model additions, the child-avatar state service, family controller/router composition, and the public Child route contract. It reuses the approved Phase 3A media-reference client contract. It does not retest resource-service upload/content/delete internals, GrowthTask attachments, deployment environment wiring, or the cross-consumer Task 6 release gate.

## 2. Test Levels and Evidence

| Level | Purpose | Evidence file |
| --- | --- | --- |
| model | Defaults, hidden fields, UUID/ObjectId validation, state invariants, and canonical pending-patch paths | `backend/services/user-service/__tests__/models/User.mediaReferences.test.js` |
| service | State-machine ordering, exact commands, CAS convergence, retry behavior, and owner failure recovery | `backend/services/user-service/__tests__/services/childAvatarMediaService.test.js` |
| route integration | Parent/child authorization, body contract, stable errors, pending envelope, safe views, and injected composition | `backend/services/user-service/__tests__/routes/childMediaReferences.test.js` |
| regression | Existing Child creation, listing, detail, PIN, pagination, and all family projects | existing family suites and `npm run test:family-regression` |

Service tests use the real Mongoose User model against the existing user-service MongoMemoryServer unless a specific owner-transition failure requires a narrow model method wrapper. Remote media operations use dependency-injected Jest doubles; tests assert the complete command rather than mocking Axios. Route tests mount a real Express app with production error middleware and inject the binding service or media client through the production router factory.

## 3. Deterministic Fixtures and Failure Injection

Each test creates two families, at least two children in the primary family, and media IDs representing active avatar, wrong-purpose, deleted, sibling, family-scoped, missing, and cross-family resources. UUIDs, ObjectIds, and clocks are fixed per case. Test names begin with their case ID.

The media-reference double records prepare, commit, and unbind calls and can fail before a response or after recording a successful remote transition. It models only the approved Phase 3A contract:

- stable prepare failures return sanitized `400/403/404/409` errors;
- transport, 5xx, malformed, commit, and unbind failures return `503 MEDIA_REFERENCE_PENDING`;
- prepare/commit replays preserve one bind generation;
- unbind requires the previous `bindingOperationId` and cannot release a newer generation.

Owner-transition uncertainty is injected at the CAS switch/finalize boundary after the remote call has succeeded. Concurrency tests use barriers around the first claim rather than timing sleeps. No test retries a failed assertion to obtain a pass.

## 4. Numbered Cases

| ID | Requirement | Level | Preconditions and action | Expected result | Automated test |
| --- | --- | --- | --- | --- | --- |
| `TC-T6-MEDIA-016D` | `FR-MEDIA-001`, `NFR-DATA-001` | model | Create legacy, none, bound, and pending Child documents; attempt malformed UUIDs, incomplete ID/generation pairs, invalid phases, and non-canonical pending patch paths. | Legacy state reads as none; valid states persist; invalid combinations fail validation; internal operation, generation, previous, pending, phase, and patch fields are excluded by default selection. | `User.mediaReferences.test.js` |
| `TC-T6-MEDIA-016E` | `FR-MEDIA-001`, `NFR-DATA-001` | service/route | A parent sets a same-family, same-child active avatar; replay the same PATCH and then submit the already-current media ID again. | One durable random operation is claimed; prepare and commit use the exact Child command; public ID appears only after commit; replay converges; stable no-op performs no new media call. | `childAvatarMediaService.test.js`, `childMediaReferences.test.js` |
| `TC-T6-MEDIA-016F` | `FR-MEDIA-001`, `NFR-SEC-001` | route integration | Set missing, malformed, wrong-purpose, deleted, sibling, family-scoped, and cross-family media; attempt another-family Child mutation and a child-token mutation; attempt an avatar write with media binding disabled. | Invalid media returns the sanitized stable error and clears untouched intent; family/role violations return the approved access error; disabled media returns `400 MEDIA_NOT_ENABLED`; no public/profile field or bound reference changes. | `childMediaReferences.test.js` |
| `TC-T6-MEDIA-016G` | `FR-MEDIA-001`, `NFR-DATA-001` | recovery | Lose prepare response, lose commit response, fail commit once, prevent owner CAS after commit, and separately persist the CAS but lose its response during an initial set; invoke detail GET or the same PATCH to resume. | Each uncertain first response is `503 MEDIA_REFERENCE_PENDING` with only `details.resourceId`; one stored operation ID is reused; recovery replays or recognizes the converged owner state and reaches bound without exposing a pending target early. | `childAvatarMediaService.test.js`, `childMediaReferences.test.js` |
| `TC-T6-MEDIA-016H` | `FR-MEDIA-001`, `NFR-DATA-001` | replacement/recovery | Replace bound generation A with media B; pause/fail at prepare, commit, public switch, unbind, and final owner CAS; then resume. | A remains public through binding; B commits before A unbind; after switch only B is public; unbind carries A's generation; every resume converges without releasing B or exposing an unbound ID. | `childAvatarMediaService.test.js` |
| `TC-T6-MEDIA-016I` | `FR-MEDIA-001`, `NFR-DATA-001` | removal/recovery | Remove a bound avatar, fail old-reference unbind or final owner CAS once, and retry; also remove when current avatar is already null. | Public avatar becomes null before unbind; recovery reuses the stored removal operation and finalizes none; already-null removal is a media no-op. | `childAvatarMediaService.test.js`, `childMediaReferences.test.js` |
| `TC-T6-MEDIA-016J` | `FR-MEDIA-001`, `NFR-DATA-001` | atomic owner update | Combine avatar replacement with name, grade, and array profile fields; force stable prepare rejection and separately force pending recovery after commit. | Stable rejection leaves avatar and ordinary profile unchanged; successful recovery applies the canonical full patch exactly once with required name/nickname and grade mirrors; request keys never become Mongo paths. | `childAvatarMediaService.test.js`, `childMediaReferences.test.js` |
| `TC-T6-MEDIA-016K` | `FR-MEDIA-001`, `NFR-DATA-001` | concurrency | Race identical set requests, different target requests, and a non-avatar PATCH against a pending avatar mutation using controlled barriers. | One CAS claim wins; identical requests converge on one generation; a differing request resumes then returns `409 RESOURCE_CONFLICT`; non-avatar update resumes first and does not overwrite hidden media state. | `childAvatarMediaService.test.js` |
| `TC-T6-MEDIA-016L` | `FR-MEDIA-001`, `NFR-DATA-001` | read recovery | Read a Child during binding and unbinding through list and detail endpoints. | Detail resumes pending work; list makes no remote media calls and returns only the currently usable old/new/null public value; neither endpoint returns internal state. | `childMediaReferences.test.js` |
| `TC-T6-MEDIA-018A` | `FR-MEDIA-001`, `NFR-SEC-001` | contract/security | Submit `avatar`, raw URLs, media objects, arrays, malformed IDs, dotted keys, `childProfile` wrappers, and every internal media state/generation field. | Request is rejected rather than silently ignored; no unsafe value or server-controlled field persists; success responses expose only `avatarMediaId` and approved Child fields. | `childMediaReferences.test.js` |
| `TC-T6-MEDIA-018B` | `NFR-PRIVACY-001`, `NFR-SEC-001` | privacy/error contract | Force database, stable remote, pending remote, and conflict paths while capturing responses and structured logs with sentinel secrets/profile values. | Production envelopes contain stable code/message and approved details only; audit events retain approved operation/result/family/child/media IDs; logs/responses contain no credential, Axios config, profile patch value, raw URL, storage data, operation UUID, or previous generation. | `childMediaReferences.test.js` |
| `TC-T6-MEDIA-016M` | `FR-MEDIA-001` | regression | Run existing Child creation/list/detail/PIN/pagination suites with legacy avatar strings and no media binding service. | Existing non-avatar mutations and reads remain available; family Child views omit legacy raw avatar; no import-time Mongo connection or resource-service call occurs. | `children.test.js`, `family.test.js` |

## 5. Traceability to Detailed Design

| Design section | Cases |
| --- | --- |
| Child model and invariants | `016D`, `018A` |
| Component injection and disabled behavior | `016E`, `016F`, `016M` |
| Initial set and stable no-op | `016E`, `016G` |
| Replacement and checked unbind | `016H` |
| Removal | `016I` |
| Failure classification and recovery | `016F`, `016G`, `016H`, `016I` |
| Retry and concurrency | `016G`, `016K`, `016L` |
| Authorization and public contract | `016F`, `018A` |
| Observability and privacy | `018B` |
| Migration and regression | `016D`, `016M` |

## 6. Execution Gates

Focused RED/GREEN commands will be fixed in the implementation plan. The phase exit gate is:

```bash
npx jest --config backend/services/user-service/jest.config.js --runInBand \
  User.mediaReferences childAvatarMediaService childMediaReferences children family
npm run test:family-regression
git diff --check
```

The test command must pass once, then `npm run test:family-regression` must pass twice consecutively with identical suite/test totals. No `--onlyFailures`, retry wrapper, reduced worker subset, open-handle warning, forced process exit, or test-only error middleware may be used as release evidence.

## 7. Review Gate

Phase 3B may proceed to its TDD implementation plan only when review confirms:

- every state transition and public visibility boundary has an executable case;
- stable prepare rejection is distinguished from uncertain post-prepare failure;
- replacement and removal prove generation-checked unbind ordering;
- combined profile mutation is all-or-nothing and request keys cannot become update paths;
- concurrency uses deterministic barriers and CAS evidence rather than timing;
- public responses and logs exclude all internal recovery and private values;
- existing Child/PIN/pagination behavior remains in the regression gate.

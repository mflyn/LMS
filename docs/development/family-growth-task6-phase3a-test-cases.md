# Task 6 Phase 3A Numbered Test Addendum

**Document status:** APPROVED
**Parent catalog:** `docs/development/family-growth-task6-test-cases.md`
**Design addendum:** `docs/superpowers/specs/2026-06-21-family-growth-task6-phase3a-reference-release-design.md`

These suffix cases refine approved `TC-T6-MEDIA-012`, `016`, and `017` without adding product scope. Tests use the existing replica-set fixture, fixed clocks, real Mongoose models, and dependency-injected Axios doubles.

| ID | Requirement | Level | Preconditions and action | Expected result | Automated test |
| --- | --- | --- | --- | --- | --- |
| `TC-T6-MEDIA-012A` | `FR-MEDIA-001`, `NFR-DATA-001` | model/service | Bind generation A, then release it with replacement operation B and replay B plus a competing release operation. | Bind `operationId=A` remains unchanged; first release stores B; all replays preserve one `releasedAt` and one release ID. | `mediaModels.test.js`, `mediaReferences.test.js` |
| `TC-T6-MEDIA-012B` | `FR-MEDIA-001`, `NFR-DATA-001` | concurrency/recovery | Release A, bind the same identity as C, then deliver a delayed unbind that expects A. | Delayed command returns `409 RESOURCE_CONFLICT`; generation C remains bound and unchanged. | `mediaReferences.test.js` |
| `TC-T6-MEDIA-012C` | `FR-MEDIA-001`, `NFR-DATA-001` | transaction/replay | Replay A after release, prepare new C, and force the second write of a mixed-generation two-row unbind to fail. | A replay cannot resurrect; C can reactivate and clears release metadata; failed batch leaves both rows unchanged. | `mediaReferences.test.js` |
| `TC-T6-MEDIA-016A` | `FR-MEDIA-001`, `NFR-SEC-001` | client contract | Invoke prepare, commit, and unbind through the shared client with valid configuration. | Exact fixed paths, unchanged payload, service token header, and timeout are sent; validated references are returned. | `mediaReferenceClient.test.js` |
| `TC-T6-MEDIA-016B` | `FR-MEDIA-001`, `NFR-SEC-001` | error contract | Resource-service returns approved `400/403/404/409` envelopes. | Client preserves sanitized status/code/message/details so owners reject invalid media deterministically. | `mediaReferenceClient.test.js` |
| `TC-T6-MEDIA-016C` | `FR-MEDIA-001`, `NFR-SEC-001` | resilience/privacy | Trigger timeout, connection failure, 5xx, malformed success data, and errors containing credential-bearing Axios config. | Each becomes `503 MEDIA_REFERENCE_PENDING`; no token or Axios config is enumerable, logged, or exposed. | `mediaReferenceClient.test.js` |

## Gate

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand mediaModels mediaReferences mediaCleanup familyMedia
npx jest --config backend/jest.family-common.config.js --runInBand mediaReferenceClient
npm run test:family-regression
```

Phase 3A cannot proceed to coding until the design addendum, this test addendum, and the implementation plan are approved together.

# Mistake PDF and Multi-Attachment Test Design and Cases

**Document status:** APPROVED / IMPLEMENTATION BASELINE
**Approved:** 2026-07-15
**Date:** 2026-07-15  
**Design:** `docs/superpowers/specs/2026-07-15-family-growth-mistake-pdf-multi-attachments-design.md`  
**Scope:** Parent and child mistake attachments, task PDF attachments, private-media PDF security, and deployment security profiles  
**Requirements:** `FR-MISTAKE-001`, `FR-MEDIA-001`, `FR-UI-001`, `FR-UI-002`, `NFR-SEC-001`, `NFR-REL-001`

## 1. Test Objective

The gate must prove that parents and children can manage ordered image/PDF attachment collections without weakening family authorization, reference consistency, or existing image behavior. It must independently prove the static media pipeline and the two approved deployment profiles:

- `trusted-local` keeps all type, structure, active-content, canonicalization, size, page, and authorization controls but performs no malware scan and records that fact;
- `secure-production` scans every canonical image and PDF, accepts only a clean result, and fails closed without silently changing profile;
- the normal low-resource development and release path does not require ClamAV, while a dedicated secure-release gate exercises a real scanner on a sufficiently sized runner.

## 2. Environments and Gate Layers

| Layer | Environment | Scanner | Required for merge | Required for secure-production release |
| --- | --- | --- | --- | --- |
| unit | Jest with injected scanner/fake TCP server | no daemon | yes | yes |
| service integration | Mongo memory replica set and private temp storage | injected scanner | yes | yes |
| family regression | current root release dependencies | none; `trusted-local` | yes | yes |
| browser E2E | real Gateway/API/Web and Chromium | none; `trusted-local` | yes | yes |
| secure scan smoke | security Compose overlay on dedicated runner | real ClamAV | no for trusted-local merge; manual or protected CI | yes |
| deployment static | Compose config and Kubernetes render | configuration only | yes | yes |

The secure scan smoke must not run concurrently with the repository-wide Mongo memory suites on an 8 GiB development machine. The real-scanner runner must provide at least the approved ClamAV memory request plus capacity for resource-service and its test dependencies.

## 3. Fixtures and Safety Rules

- Generate valid one-page, fifty-page, and fifty-one-page PDFs during test setup.
- Generate active-content variants for JavaScript, `OpenAction`, additional actions, launch actions, embedded files, file-attachment annotations, XFA, RichMedia, multimedia, and 3D objects.
- Keep encrypted, malformed, zero-page, oversized-before-canonicalization, and oversized-after-canonicalization fixtures deterministic and free of personal data.
- Generate the standard antivirus test content only at runtime in the secure scan smoke. Do not commit it, print it, or include scanner signatures or raw scanner protocol responses in evidence.
- Use sentinel family, child, filename, storage, and token values and assert they do not appear in public errors or sanitized logs.
- Each failure test asserts temporary-file cleanup, no stored object, no `MediaAsset`, and no owner reference unless the case explicitly tests retry recovery after a committed step.

## 4. Resource-Service Cases

### 4.1 Type, Canonicalization, and Access

| ID | Action | Expected result | Planned evidence |
| --- | --- | --- | --- |
| `TC-MPA-MEDIA-001` | Upload JPEG, PNG, WebP, and PDF using correct, missing, and misleading extensions/client MIME values. | Server detection uses magic bytes and parsed format; persisted MIME is canonical; unsupported bytes return `MEDIA_TYPE_NOT_ALLOWED`. | resource-service media pipeline tests |
| `TC-MPA-MEDIA-002` | Upload valid one-page and fifty-page PDFs. | Both are canonicalized, reparsed, remain at most 10 MiB, and persist page counts 1 and 50. | PDF inspector tests |
| `TC-MPA-MEDIA-003` | Upload zero-page, fifty-one-page, encrypted, password-required, malformed, compressed-object-stream, missing-xref, and invalid-final-`startxref` PDFs. | Stable `PDF_INVALID` or `PDF_PAGE_LIMIT_EXCEEDED`; parsing does not expand object streams before resource bounds; no residual state. | PDF inspector and route tests |
| `TC-MPA-MEDIA-004` | Upload each approved active/embedded-content rejection fixture, including embedded-target, rendition, URI/transition, and form action variants. | Stable `PDF_ACTIVE_CONTENT_REJECTED`; rejected bytes never reach storage or scanner. | PDF inspector and pipeline-order tests |
| `TC-MPA-MEDIA-005` | Upload exactly 10 MiB and over-limit input; separately make canonical output cross the limit. | Boundary file succeeds when otherwise valid; over-limit input or canonical output returns `MEDIA_TOO_LARGE`. | upload and canonicalization tests |
| `TC-MPA-MEDIA-006` | Upload images with EXIF and PDFs with untrusted metadata/path-like names. | Image metadata is removed; display name is a bounded basename; metadata controls no path or authorization. | private media store tests |
| `TC-MPA-MEDIA-007` | Trigger parse, canonicalization, scanner, storage, database, abort, and client-disconnect failures. | Temporary files and partial objects are removed on every path; response and log data remain sanitized. | route lifecycle tests |
| `TC-MPA-MEDIA-008` | Upload PDF for every purpose. | PDF is accepted only for `task_attachment`, `mistake_question`, and `mistake_answer`; image-only purposes reject it. | purpose matrix tests |
| `TC-MPA-MEDIA-009` | Request authorized image and PDF access, then tamper with ID, expiry, nonce, or signature. | Image is inline; PDF is attachment with encoded sanitized name; grants are private and at most 300 seconds; tampering fails. | capability and route tests |
| `TC-MPA-MEDIA-010` | Access media as sibling, other-family parent/child, deleted owner, or wrong-purpose owner. | Access is denied without revealing media existence or storage metadata. | family media authorization tests |

### 4.2 Security Profile and Scanner

| ID | Action | Expected result | Planned evidence |
| --- | --- | --- | --- |
| `TC-MPA-SCAN-001` | Start development/test with an absent profile; start production with absent, unknown, or malformed profile. | Development/test resolves to `trusted-local`; production refuses startup unless the profile is explicitly valid. | config and server startup tests |
| `TC-MPA-SCAN-002` | Upload canonical image and PDF in `trusted-local` with a scanner spy configured to fail if called. | Upload succeeds without scanner construction/call; records use `skipped_trusted_local` and no scan timestamp; health names the profile without a clean claim. | resource-service route and health tests |
| `TC-MPA-SCAN-003` | Scan clean canonical image and PDF in `secure-production`. | Exactly the canonical bytes are scanned once; accepted records use `clean` and a bounded server timestamp. | scanner adapter and route tests |
| `TC-MPA-SCAN-004` | Return `FOUND` in `secure-production`. | `422 MALWARE_DETECTED`; no media, storage object, owner reference, or raw scanner detail survives. | route integration tests |
| `TC-MPA-SCAN-005` | Cause connection refusal, timeout, closed socket, malformed response, oversized response, or unknown result. | `503 MALWARE_SCANNER_UNAVAILABLE`; upload fails closed and cleans up. | fake TCP scanner tests |
| `TC-MPA-SCAN-006` | Exercise bounded `PING` at startup and health after a healthy-to-unhealthy transition. | Secure service listens only after successful `PING`; unhealthy scanner makes health fail; trusted-local performs no probe. | server and health tests |
| `TC-MPA-SCAN-007` | Exercise `INSTREAM` framing across zero, one, and many bounded chunks and forced socket errors. | Framing and terminator are correct; sockets/timers close exactly once; no unbounded buffering or hanging handle remains. | scanner protocol unit tests |
| `TC-MPA-SCAN-008` | Change scanner health while secure-production is running. | Profile remains secure; no request is accepted through trusted-local behavior; no automatic config mutation occurs. | profile invariants tests |
| `TC-MPA-SCAN-009` | Read legacy, trusted-local, and secure-production assets. | Existing assets default to `legacy_unscanned`; new statuses remain audit-only and do not alter authorized content access. | media model and access tests |
| `TC-MPA-SCAN-010` | Run the dedicated overlay against real ClamAV with safe files and runtime-generated antivirus test content. | Safe canonical files pass; test content is rejected; scanner remains private; evidence contains only stable result codes. | planned `test:family-security-scan` gate |

## 5. Owner Model, API, and Reference Cases

| ID | Action | Expected result | Planned evidence |
| --- | --- | --- | --- |
| `TC-MPA-API-001` | Read mistake documents containing only each legacy scalar. | Response returns one-item canonical arrays and unchanged first-item projections. | analytics model/route tests |
| `TC-MPA-API-002` | Create or patch with one canonical array; separately use one legacy scalar; then send both forms for one group. | Either form normalizes; mixed form returns `400 VALIDATION_ERROR` without mutation. | request parser tests |
| `TC-MPA-API-003` | Submit duplicates and reordered IDs within ten unique entries. | First occurrence order is retained; reorder-only updates owner order without media reference calls. | mistake media saga tests |
| `TC-MPA-API-004` | Submit ten and eleven unique IDs to each group. | Ten succeeds; eleven returns `MEDIA_ATTACHMENT_LIMIT_EXCEEDED` before owner/reference mutation. | parser and route tests |
| `TC-MPA-API-005` | Create, append, replace, reorder, and clear question and answer collections. | Arrays and first-item projections update atomically; repeated logical reference fields remain valid. | analytics service tests |
| `TC-MPA-API-006` | Fail or lose prepare, commit, owner publication, release, and recovery responses. | Existing saga semantics converge without leaked, duplicate, or prematurely released references. | mistake media saga tests |
| `TC-MPA-API-007` | Parent edits both groups for own child; child edits both groups on own mistake. | Approved operations succeed and server-resolved scope is persisted. | analytics route tests |
| `TC-MPA-API-008` | Child injects family/child/parent fields, edits a sibling, or sends parent-only classification fields. | Stable authorization/field errors; no hidden ownership field or media reference changes. | analytics security tests |
| `TC-MPA-API-009` | Supply malformed, deleted, wrong-purpose, sibling, and cross-family media IDs. | Owner mutation is rejected without existence disclosure; no partial bind remains. | analytics/resource integration tests |
| `TC-MPA-API-010` | Roll back a new record to a client that reads only scalar fields. | First attachment remains reachable; additional attachments remain bound and recoverable by the new version. | compatibility tests and rollback smoke |

## 6. Frontend Cases

| ID | Action | Expected result | Planned evidence |
| --- | --- | --- | --- |
| `TC-MPA-WEB-001` | Select mixed valid images/PDFs and invalid type/size/count files in the shared collection. | Client applies shared hints and limits; server remains authoritative; stable per-file labels/errors render. | shared attachment control tests |
| `TC-MPA-WEB-002` | Upload several files sequentially and fail a middle file. | Prior successes remain; failed filename is visible; later files wait; retry does not duplicate accepted items. | collection integration tests |
| `TC-MPA-WEB-003` | Cancel/unmount with new drafts; fail owner save; then retry successfully. | Only unbound drafts are deleted on cancel; failed save preserves editor state; successful save commits new and deletes removed persisted files. | draft media hook tests |
| `TC-MPA-WEB-004` | Parent creates/reopens/edits a mistake with both collections and a legacy scalar-only record. | UI normalizes legacy data, sends canonical arrays only, and shows ordered counts/files after reload. | parent mistake page tests |
| `TC-MPA-WEB-005` | Child creates/reviews own mistake with images and PDFs in both groups. | Child-authenticated media methods and mistake payloads use own session; parent/identity fields are absent. | child API and mistakes tests |
| `TC-MPA-WEB-006` | Add PDF to existing parent task attachments. | Existing multi-image behavior remains; PDF metadata/download renders; 100-item owner limit remains. | parent task page tests |
| `TC-MPA-WEB-007` | Preview/download authorized media after grant expiry and after access failure. | Images refresh safe previews; PDFs use explicit download; errors do not expose signed URL or storage data. | API/component tests |
| `TC-MPA-WEB-008` | Exercise parent and child collections by keyboard at desktop and 360px. | Labels, focus, live status, remove/download names, 44px child targets, and layout are usable with no overflow. | frontend tests and browser QA |

## 7. Deployment and End-to-End Cases

| ID | Action | Expected result | Planned evidence |
| --- | --- | --- | --- |
| `TC-MPA-DEPLOY-001` | Render default family and Ubuntu Compose. | Resource-service explicitly uses `trusted-local`; no ClamAV container, dependency, port, or memory reservation exists. | deployment static tests |
| `TC-MPA-DEPLOY-002` | Render default Compose on the approved 8 GiB local profile and run safe upload smoke. | Stack starts within its existing budget and media health/upload reports trusted-local semantics. | low-resource release smoke |
| `TC-MPA-DEPLOY-003` | Render secure Compose overlay. | Overlay sets `secure-production`, adds private digest-pinned ClamAV and health dependency, and publishes no scanner port to the host. | deployment static tests |
| `TC-MPA-DEPLOY-004` | Render secure and trusted-local Kubernetes overlays. | Each selects a profile explicitly; secure overlay includes private scanner service, probes, 3 GiB request/4 GiB limit, and no ingress; trusted overlay omits scanner. | Kubernetes static tests |
| `TC-MPA-DEPLOY-005` | Run parent flow with two question images and one answer PDF, then reopen, download, reorder, and remove. | Persisted order, grants, projections, references, and cleanup are correct. | Task 11-style E2E |
| `TC-MPA-DEPLOY-006` | Run child flow with one PDF question and two answer images, then add an answer PDF during review. | Own-scope creation/review succeeds and sibling/cross-family access remains forbidden. | Task 11-style E2E |
| `TC-MPA-DEPLOY-007` | Run all default release commands twice from a clean tree. | Both runs pass without a ClamAV dependency, leaked process, generated fixture, or worktree change. | updated family release gate |
| `TC-MPA-DEPLOY-008` | Run secure scan smoke on a sized runner and inspect logs/config. | Real clean/infected paths pass; no public scanner access, malware bytes, credentials, or raw protocol data are retained. | secure-release evidence |

## 8. Traceability

| Requirement | Cases |
| --- | --- |
| `FR-MEDIA-001` | `TC-MPA-MEDIA-*`, `TC-MPA-SCAN-*`, `TC-MPA-DEPLOY-001` to `004` |
| `FR-MISTAKE-001` | `TC-MPA-API-*`, `TC-MPA-WEB-004` to `005`, `TC-MPA-DEPLOY-005` to `006` |
| `FR-UI-001` | `TC-MPA-WEB-001` to `004`, `006` to `008` |
| `FR-UI-002` | `TC-MPA-WEB-001` to `003`, `005`, `007` to `008` |
| `NFR-SEC-001` | `TC-MPA-MEDIA-003` to `010`, all `TC-MPA-SCAN-*`, `TC-MPA-API-008` to `009`, all `TC-MPA-DEPLOY-*` |
| `NFR-REL-001` | `TC-MPA-MEDIA-007`, `TC-MPA-SCAN-005` to `008`, `TC-MPA-API-005` to `006`, `TC-MPA-WEB-002` to `003`, `TC-MPA-DEPLOY-007` |

## 9. Entry and Exit Criteria

Implementation may start after this test design and the linked detailed design are approved. Each behavior change follows red-green-refactor with its case ID present in the test name or adjacent test description.

The increment may close only when:

1. every case has automated evidence or an approved browser/deployment evidence record;
2. the default family release gate passes twice in `trusted-local` without a real scanner;
3. scanner protocol and fail-closed behavior pass in merge CI using injected/fake infrastructure;
4. a dedicated real-ClamAV gate passes before any `secure-production` release artifact is approved;
5. no test skips, open handles, generated malware fixture, uncommitted file, or undocumented profile downgrade remains;
6. API, deployment, user guidance, traceability, and final gate documents are updated to the implemented contract.

## 10. Planned Commands

The implementation plan must add or confirm these commands rather than documenting nonexistent success:

```bash
# Targeted service and frontend suites, finalized during implementation.
npm test --prefix backend/services/resource-service -- --runInBand
npm test --prefix backend/services/analytics-service -- --runInBand
npm run test:ci --prefix frontend/web -- --runInBand

# Existing low-resource release gate; remains scanner-free.
npm run release:family

# New dedicated real-scanner gate; to be added by implementation.
npm run test:family-security-scan
```

Until the last command exists and its evidence is recorded, `secure-production` is designed but not release-approved.

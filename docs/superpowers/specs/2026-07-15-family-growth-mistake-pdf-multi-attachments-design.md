# Family Growth Mistake PDF and Multi-Attachment Design

**Document status:** APPROVED / IMPLEMENTATION BASELINE
**Approved:** 2026-07-15
**Date:** 2026-07-15  
**Scope:** Private-media PDF support and multi-attachment mistake workflows for parents and children  
**Requirements:** `FR-MISTAKE-001`, `FR-MEDIA-001`, `FR-UI-001`, `FR-UI-002`, `NFR-SEC-001`, `NFR-REL-001`  
**Supersedes:** The single-value mistake media and child text-only capture boundaries in the Task 6 and Task 10 designs

## 1. Objective and Boundary

Parents and children must be able to attach multiple question files and multiple answer files to an academic mistake. Each group accepts JPEG, PNG, WebP, and PDF. Existing mistake records and clients using `questionMediaId` or `childAnswerMediaId` must continue to work during a compatibility release.

This increment also enables PDF in the existing parent task-attachment collection because it uses the same private-media purpose and collection control. Avatars remain image-only. Task-completion and growth-evidence persistence are unchanged because those purposes still have no approved owner field.

PDF is not treated as an opaque trusted blob. A PDF must pass structural checks, active-content rejection, canonical serialization, and a mandatory ClamAV scan before any `MediaAsset` is persisted. A missing or unhealthy scanner fails closed.

## 2. Approved Product Contract

### 2.1 Mistake Attachment Groups

`FamilyMistake` adds two canonical public fields:

| Field | Type | Constraint |
| --- | --- | --- |
| `questionMediaIds` | ObjectId array | zero to ten unique `mistake_question` assets, ordered |
| `childAnswerMediaIds` | ObjectId array | zero to ten unique `mistake_answer` assets, ordered |

The combined mistake limit is therefore twenty attachments. Duplicate IDs are removed while preserving first occurrence order. Supplying more than ten unique IDs in either field returns `400 MEDIA_ATTACHMENT_LIMIT_EXCEEDED` without mutating the mistake or reference state.

The existing `questionMediaId` and `childAnswerMediaId` fields remain compatibility projections for one release. Their value is the first item of the corresponding canonical array or absent when that array is empty. They are not independent attachment slots.

### 2.2 Supported Media

| Purpose | JPEG/PNG/WebP | PDF | Collection size |
| --- | --- | --- | --- |
| `avatar` | yes | no | one |
| `task_attachment` | yes | yes | existing limit of 100 |
| `mistake_question` | yes | yes | ten per mistake |
| `mistake_answer` | yes | yes | ten per mistake |
| `task_completion` | yes | no | unchanged |
| `growth_evidence` | yes | no | unchanged |

Every incoming and canonical file is at most 10 MiB. Every PDF is at most fifty pages. Encrypted PDFs and PDFs requiring a password are rejected.

## 3. Compatibility and Data Model

### 3.1 Lazy Compatibility

No destructive bulk migration is required for rollout.

- A legacy document containing only `questionMediaId` is read as `questionMediaIds=[questionMediaId]`.
- A legacy document containing only `childAnswerMediaId` is read as `childAnswerMediaIds=[childAnswerMediaId]`.
- A new mutation stores both canonical arrays and their first-item compatibility projections in one owner-service update.
- Empty canonical arrays remove the corresponding compatibility projection.
- API responses return both forms during the compatibility release.
- A request may use either the canonical array field or its legacy scalar field, but not both for the same group. Ambiguous input returns `400 VALIDATION_ERROR`.

The compatibility projection permits rollback to the prior application version without losing access to the first attachment. Attachments after the first remain bound and recoverable by the new version; rollback documentation must state that the old UI cannot display them.

### 3.2 Role Permissions

Parents may create and patch both canonical attachment arrays for a child in their family. Children may create and patch both canonical attachment arrays only on their own mistakes. A compatibility client may submit one approved legacy scalar alias, which the server immediately normalizes into the canonical array. `familyId`, effective `childId`, ownership, audit fields, media-reference state, and persisted compatibility projections are otherwise server controlled for child requests.

The previously approved rule that treated question media as parent-owned is superseded. Knowledge-point classification, correct answer, parent note, and post-create subject/reason classification remain parent-managed.

### 3.3 MediaAsset Additions

`MediaAsset` adds `displayName` and optional `pageCount`. `displayName` is a sanitized basename of at most 255 UTF-8 characters with path separators and control characters removed. `pageCount` is required for `application/pdf`, absent for images, and constrained to 1-50. The MIME enum adds `application/pdf`, while purpose-specific validation continues to reject PDF avatars, task-completion uploads, and growth-evidence uploads.

### 3.4 Media Reference Identity

The resource-service reference protocol retains the existing logical field values `questionMediaId` and `childAnswerMediaId`. A command may contain several references with the same logical field and different media IDs. This is compatible with the existing unique key because `mediaId` is part of that key.

Analytics-service maps:

```text
questionMediaIds[]    -> logical field questionMediaId    -> purpose mistake_question
childAnswerMediaIds[] -> logical field childAnswerMediaId -> purpose mistake_answer
```

Existing bound reference rows remain valid. Array mutation compares normalized `(field, mediaId)` sets, prepares and commits additions, persists ordered arrays, then releases removals. Reordering without a membership change updates only the owner document. Retry and detail-read recovery continue to use the current operation ID and `503 MEDIA_REFERENCE_PENDING` contract.

## 4. Public API Contract

### 4.1 Upload

`POST /api/media` remains a single-file `multipart/form-data` operation with `file`, `purpose`, and optional parent-supplied `childId`. Multi-select clients call it once per selected file. A successful response adds:

```json
{
  "success": true,
  "data": {
    "media": {
      "mediaId": "media_001",
      "purpose": "mistake_question",
      "mimeType": "application/pdf",
      "displayName": "期中试卷第3题.pdf",
      "sizeBytes": 245120,
      "pageCount": 2
    }
  }
}
```

`displayName` is a bounded, control-character-free basename used only for UI display and download disposition. It is never used as a storage path. `pageCount` is present only for PDF.

### 4.2 Mistake Create and Patch

Canonical request fragment:

```json
{
  "questionMediaIds": ["media_question_001", "media_question_002"],
  "childAnswerMediaIds": ["media_answer_001"]
}
```

Parent and child API clients send only the canonical arrays. A patch omits an unchanged group and sends `[]` to remove every attachment in that group. The response returns canonical arrays plus the deprecated first-item projections.

### 4.3 Access and Delete

Image access keeps `Content-Disposition: inline`. PDF access uses `Content-Disposition: attachment` with an RFC 5987 encoded sanitized display name. Both continue to use a family/child-authorized URL valid for no more than 300 seconds and `Cache-Control: private, no-store`.

The authorized access response includes the safe descriptor needed after a page reload:

```json
{
  "success": true,
  "data": {
    "access": {
      "url": "/api/media/media_001/content?expires=...&nonce=...&signature=...",
      "expiresAt": "2026-07-15T05:00:00.000Z"
    },
    "media": {
      "mediaId": "media_001",
      "mimeType": "application/pdf",
      "displayName": "期中试卷第3题.pdf",
      "sizeBytes": 245120,
      "pageCount": 2
    }
  }
}
```

The descriptor contains no storage key, uploader identity, owner path, or untrusted metadata.

Delete remains soft delete. A bound file cannot be physically reclaimed until every owner reference is released and the existing retention period expires.

## 5. Secure Media Pipeline

### 5.1 Type Detection

Client MIME and filename extension are hints only. The service identifies JPEG, PNG, WebP, or PDF from magic bytes and then parses the selected format. A mismatch is accepted only when the detected format itself is allowed for the supplied purpose; the persisted MIME always comes from server detection.

The upload middleware accepts one bounded temporary file and no more than two text fields. Temporary files are removed on every success and failure path.

### 5.2 Image Canonicalization

Images continue through `sharp`: decode with fail-on-error, auto-rotate, re-encode in the detected format, remove EXIF and embedded metadata, enforce the post-encode 10 MiB limit, then scan the canonical bytes with ClamAV.

### 5.3 PDF Inspection and Canonicalization

The PDF inspector loads the document with encryption disallowed and rejects invalid cross-reference or object structure. It rejects zero-page documents and documents over fifty pages. It walks the parsed object graph and rejects document or page objects containing active or embedded-content features, including:

- JavaScript or JavaScript name trees;
- `OpenAction`, additional actions, or launch actions;
- embedded files and file-attachment annotations;
- XFA, RichMedia, multimedia, or three-dimensional content;
- encrypted payloads or external-file launch instructions.

The accepted document is serialized into a new canonical byte sequence. The canonical bytes must still begin with a PDF signature, remain within 10 MiB, and pass a second parse before scanning. PDF metadata is not used for authorization or paths.

### 5.4 ClamAV

Resource-service owns a small ClamAV client that implements the documented TCP `INSTREAM` protocol with bounded chunks. Configuration is:

| Variable | Default | Constraint |
| --- | --- | --- |
| `CLAMAV_HOST` | `clamav` | required non-empty host in production |
| `CLAMAV_PORT` | `3310` | integer 1-65535 |
| `CLAMAV_CONNECT_TIMEOUT_MS` | `2000` | positive integer |
| `CLAMAV_SCAN_TIMEOUT_MS` | `30000` | positive integer |

All canonical private-media bytes are scanned, not only PDFs. `OK` is the only clean result. `FOUND` rejects the upload. Protocol errors, timeouts, connection failures, or unknown responses fail closed.

`startServer` verifies the scanner with `PING` after MongoDB connection and before listening. `/health` reports unhealthy when the latest bounded scanner probe fails. Tests inject a scanner and do not require a global daemon.

Compose and Kubernetes add a private ClamAV service on port 3310 with no public ingress. Deployment pins the selected image by digest, provides a health check, and starts resource-service only after the scanner is healthy. Compose limits the scanner to 2 GiB memory. Kubernetes requests 1 GiB memory and 250 millicores, limits it to 2 GiB memory and one CPU, and allows a 180-second startup window before normal readiness checks. Signature data uses a persistent or image-managed volume according to the target environment; it is never stored in the application repository.

## 6. Frontend Design

### 6.1 Shared Rules and Actor-Specific Clients

A shared attachment-rules module owns accepted MIME types, 10 MiB validation, collection limits, file labels, and image-versus-PDF presentation. Parent and child pages use separate authenticated API functions. Neither client writes Axios global defaults.

The existing draft-media hook accepts an injected delete operation. It tracks newly uploaded drafts separately from persisted files marked for removal:

- cancel or unmount deletes only new unbound drafts;
- successful owner save commits drafts and soft-deletes removed persisted media;
- failed owner save keeps the editor, canonical arrays, and drafts available for retry;
- switching the selected child cancels drafts before clearing the editor.

### 6.2 Collection Interaction

Both mistake groups support multi-select, ordered append, per-item removal, and an explicit count. Upload remains sequential so each file has a stable result. If one selected file fails, prior successful files remain and the failed filename receives a visible error; later selected files are not uploaded until the user retries or makes a new selection.

Images use an authorized thumbnail. PDFs render a document icon, sanitized display name, size, and page count with a download command. No PDF iframe or browser plugin is embedded in the application.

### 6.3 Parent Workflow

The parent create and review dialog replaces the two single-image fields with two collection controls bound to `questionMediaIds` and `childAnswerMediaIds`. Opening a legacy mistake normalizes the scalar projections into arrays. Saving sends only changed canonical groups. The list row shows attachment counts without issuing access grants.

The existing task attachment collection adopts the shared PDF-capable rules while keeping its current one-hundred-item owner limit.

### 6.4 Child Workflow

The child create form exposes the same two collections with child-authenticated upload, access, and delete calls. Its create request includes canonical arrays. Existing mistake rows allow the child to add or remove question and answer attachments while submitting review state and explanation. Child identity is always derived from the stored child session.

Controls maintain the existing 44px child touch target and fit a 360px viewport without horizontal overflow. Status changes use live text and do not rely on color alone.

## 7. Error Contract

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `MEDIA_TYPE_NOT_ALLOWED` | detected type is not allowed for the purpose |
| 400 | `PDF_INVALID` | malformed, encrypted, empty, or non-canonical PDF |
| 400 | `PDF_ACTIVE_CONTENT_REJECTED` | active or embedded PDF content was found |
| 400 | `PDF_PAGE_LIMIT_EXCEEDED` | PDF has more than fifty pages |
| 400 | `MEDIA_ATTACHMENT_LIMIT_EXCEEDED` | owner array exceeds its approved unique limit |
| 413 | `MEDIA_TOO_LARGE` | incoming or canonical file exceeds 10 MiB |
| 422 | `MALWARE_DETECTED` | ClamAV reported `FOUND` |
| 503 | `MALWARE_SCANNER_UNAVAILABLE` | scanner unavailable, timed out, or returned an invalid response |
| 503 | `MEDIA_REFERENCE_PENDING` | owner-reference mutation requires recovery |

Errors use the approved `success=false`, `error.code/message/details`, and `requestId` envelope. Malware signatures, file bytes, signed URLs, temporary paths, and scanner protocol responses are never returned or logged. Logs may include operation, media ID after persistence, detected MIME, byte count, purpose, and stable result code.

## 8. Test and Release Strategy

### 8.1 Resource-Service

- Detect image and PDF by bytes rather than extension or client MIME.
- Preserve image EXIF removal and post-encode size checks.
- Accept a safe one-page and fifty-page PDF; reject zero-page, fifty-one-page, encrypted, malformed, JavaScript, launch-action, embedded-file, XFA, and RichMedia fixtures.
- Verify canonical PDF second parse and PDF attachment disposition.
- Exercise ClamAV `PING` and `INSTREAM`, chunk framing, clean, infected, timeout, connection failure, malformed response, and socket cleanup.
- Prove no `MediaAsset`, storage object, or temporary file survives a rejected upload.
- Keep cross-family, sibling, deleted, and wrong-purpose media tests green.

### 8.2 Analytics-Service

- Read legacy scalar-only documents as one-item canonical arrays.
- Accept scalar compatibility input and canonical arrays separately; reject ambiguous mixed input.
- Enforce dedupe, order, ten-item limits, role permissions, and child self-scope.
- Test create, append, reorder, replace, remove-all, prepare failure, commit failure, unbind failure, and detail-read recovery with repeated logical reference fields.
- Prove compatibility projections update atomically with canonical arrays.

### 8.3 Frontend

- Parent and child API allowlists include canonical arrays but exclude ownership and hidden fields.
- Collection controls cover image/PDF validation, multi-select, order, limit, partial upload failure, retry, authorized image preview, and PDF download.
- Parent and child pages cover create and patch, legacy normalization, cancel cleanup, successful commit cleanup, failed-save preservation, selected-child/session changes, and 360px layout.
- Task attachments retain multi-image behavior and add PDF evidence.

### 8.4 End-to-End and Deployment

- A parent creates a mistake with two question images and one PDF answer, reopens it, downloads the PDF, reorders attachments, and removes one.
- A child creates an own mistake with one PDF question and two answer images, then adds an answer PDF during review.
- Sibling and cross-family access remain forbidden.
- Runtime-generated malware content is rejected by the real Compose ClamAV service without committing its signature as a repository fixture.
- Compose config/build/start, ClamAV health, resource-service health, safe PDF upload, malware rejection, media binding, signed download, and cleanup smoke all pass.
- Kubernetes static validation proves private scanner networking, resource-service dependency/configuration, health probes, and no scanner ingress.

## 9. Rollout and Rollback

Rollout order is ClamAV, resource-service, analytics-service, gateway, then Web. Resource-service must not become ready before ClamAV. Analytics accepts both old and new request forms before the new Web is deployed.

Rollback reverses the application order. The compatibility projections preserve the first attachment for the prior version, but the old application cannot safely reconcile edits to the hidden remaining array. The deployment runbook must therefore place mistake and task attachment mutations in read-only maintenance mode before rolling analytics-service or Web back past this increment. No new media bytes are deleted during rollback. Rolling back ClamAV or resource-service while PDF upload is enabled is prohibited; the old resource-service may continue serving already stored PDFs as private bytes, but the runbook must disable new uploads before that rollback.

## 10. Acceptance Gate

The increment is complete only when:

1. Parent and child create and review workflows manage both attachment groups with ten-item limits.
2. Existing scalar-only mistakes remain readable and editable without data loss.
3. Safe images and PDFs pass, while oversized, active, encrypted, malformed, and infected files fail with stable codes.
4. ClamAV is mandatory, private, health checked, and represented in Compose and Kubernetes.
5. Media-reference create, replace, reorder, removal, failure, and recovery cases pass for multi-value groups.
6. Frontend unit/integration tests and desktop/360px browser flows pass without console errors or overflow.
7. Documentation, API examples, deployment guides, traceability, test cases, and gate evidence describe the canonical contract.
8. `npm run release:family` passes from a clean tree, remote CI succeeds, and the implementation is merged into `main`.

## 11. Non-Goals

- SVG, Office documents, archives, audio, or video in the family private-media contract.
- OCR, answer recognition, PDF text indexing, annotation, or in-browser PDF editing.
- More than ten question or ten answer attachments per mistake.
- Changing task-completion or growth-evidence owner models.
- Public URLs, permanent signed URLs, or bypassing ClamAV when it is unavailable.
- Immediate removal of legacy scalar API fields.

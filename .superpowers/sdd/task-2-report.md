# Task 2 Report: Canonical Image and PDF Processing

## Scope

Implemented exact `pdf-lib@1.17.1` dependencies, a pure private-media
processor, processor-first upload integration, canonical-only atomic storage,
stable upload size/type errors, and focused image/PDF tests. Malware scanning
and deployment profiles remain Task 3.

## RED Evidence

The first approved command was blocked before test discovery by the existing
resource-service Jest/`uuid` resolver conflict. After adding the new suite to
the approved family Jest configuration, the real RED command was:

```sh
npx jest --config=backend/services/resource-service/jest.family.config.js --runInBand backend/services/resource-service/__tests__/privateMediaProcessor.test.js
```

Result: 22 tests failed with `Cannot find module
'../services/privateMediaProcessor'`. The store contract RED separately failed
all five tests because `writeCanonical` did not exist.

## Implementation

- Detects JPEG, PNG, WebP, and PDF from magic bytes rather than client MIME or
  extension.
- Re-encodes images through `sharp`, auto-rotates them, strips metadata, and
  checks the canonical size.
- Loads PDFs with encryption disallowed and invalid-object errors enabled.
- Validates the final cross-reference target before parsing and rejects compressed
  object streams so parser expansion cannot precede resource bounds.
- Rejects zero/over-fifty-page PDFs and walks all reachable and indirect PDF
  objects with cycle, object-count, and depth bounds.
- Rejects JavaScript, automatic/additional/launch/external-file actions,
  embedded-target, rendition, URI/transition, form actions, embedded files,
  file attachments, XFA, RichMedia, movie, sound, and 3D content.
- Copies accepted pages into a new document, serializes without object streams,
  verifies the `%PDF-` signature and size, then reparses and recounts pages.
- Makes the processor the sole format owner; the store persists exact approved
  bytes with UUID keys, atomic publication, and private permissions.
- Persists server-derived MIME, display name, byte size, and PDF page count.

## GREEN Evidence

```sh
npm test --prefix backend/services/resource-service -- --runInBand __tests__/privateMediaProcessor.test.js __tests__/privateMediaStore.test.js __tests__/mediaModels.test.js __tests__/mediaCapability.test.js
```

Passed: 4 suites, 52 tests.

```sh
npx jest --config=backend/services/resource-service/jest.family.config.js --runInBand
```

Passed initially: 9 suites, 112 tests.

After independent review remediation and Task 3 test registration, the complete
resource-family project passed 11 suites and 153 tests. The repository-wide
family regression before remediation passed 72 suites and 790 tests; it is
rerun after each completed implementation task.

The standard resource Jest configuration needed a Node-resolution fallback for
modern native package exports and an explicit local CommonJS `uuid` mapping.
Both the service-local Jest 27 command and root Jest 29 command now execute the
processor suite successfully.

## Self-Review

- No client MIME, filename, PDF metadata, storage path, or parser error detail
  influences authorization or leaks through stable errors.
- Active-content inspection covers unreachable indirect objects as well as the
  catalog/page graph and cannot recurse without bounds.
- Purpose validation happens before persistence; rejected PDFs create no
  private object or `MediaAsset`.
- Database failure retries transient removal failures and surfaces persistent
  cleanup failure instead of suppressing it.
- Exact dependency versions are present in both package roots and
  `git diff --check` is clean.

## Independent Review Remediation

The independent review found object-stream expansion before traversal bounds,
missing action names, permissive xref recovery, suppressed cleanup failures,
an omitted error-envelope request ID, and a fragile Jest `uuid` mapping. The
implementation now rejects object streams before parsing, validates the final
xref target, expands the active-action denylist, retries and surfaces cleanup,
returns `requestId`, and maps Jest to the root direct `uuid` dependency.

## Remaining Work

Task 3 must apply the explicit `trusted-local` or `secure-production` policy to
canonical bytes before storage and replace the temporary legacy audit default
for all new uploads.

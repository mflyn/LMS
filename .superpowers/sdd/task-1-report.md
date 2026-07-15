# Task 1 Report: Media Metadata and Public Descriptor Contract

## Scope

Implemented Task 1 only: bounded display-name metadata, PDF model metadata and
download disposition preparation, scan audit fields, and public upload/access
descriptors. PDF parsing, canonicalization, malware scanning, and ClamAV were
not implemented.

## RED Evidence

Command actually run before production changes:

```sh
npx jest --config=backend/services/resource-service/jest.config.js --runInBand mediaModels familyMedia
```

Observed expected Task 1 failures in `mediaModels.test.js`:

- `TypeError: MediaAsset.sanitizeDisplayName is not a function` from
  `TC-MPA-MEDIA-006`.
- Expected `malwareScanStatus` to equal `legacy_unscanned`, received
  `undefined` from `TC-MPA-SCAN-009`.

The command also selected `familyMediaPrivacy.test.js` and failed its
family-media suites because the configured global Mongo connection conflicts
with suites that create their own `MongoMemoryReplSet`. This was test harness
noise separate from the expected RED assertions.

## GREEN Evidence

```sh
npm test --prefix backend/services/resource-service -- --runInBand __tests__/mediaModels.test.js __tests__/privateMediaStore.test.js __tests__/mediaCapability.test.js
```

Passed: 3 suites, 31 tests.

```sh
npx jest --config=backend/services/resource-service/jest.family.config.js --runInBand backend/services/resource-service/__tests__/familyMedia.test.js
```

Passed: 1 suite, 33 tests.

## Changed Files

- `backend/services/resource-service/models/MediaAsset.js`
- `backend/services/resource-service/services/mediaService.js`
- `backend/services/resource-service/routes/media.js`
- `backend/services/resource-service/__tests__/mediaModels.test.js`
- `backend/services/resource-service/__tests__/familyMedia.test.js`
- `.superpowers/sdd/task-1-report.md`

## Self-Review

- `displayName` is sanitized and bounded before persistence and is never used
  as a storage key.
- Public descriptors exclude storage key and ownership metadata.
- Scan fields are audit-only; authorization does not branch on scan status.
- Images remain inline; the PDF response branch uses an RFC 5987 encoded
  attachment filename without enabling PDF upload processing.
- `git diff --check` completed with no output.

## Commit

`56d9c947 feat: add private media descriptors`

## Concerns

The legacy broad Jest selector continues to conflict with family-media suites
that own their Mongo replica set. `jest.family.config.js` is the approved
isolated configuration for the family-media suite and passed the required
33-test regression.

## Review Remediation

The independent review found two P2 issues. The follow-up strips all Unicode
control and format characters from public display names and applies the same
defense at the PDF response boundary. It also normalizes missing audit fields
on every lean asset read so raw records created before the scan fields existed
are treated as `legacy_unscanned` without a risky in-place migration.

RED evidence covered retained C1/bidi controls and the absent legacy
normalizer. GREEN evidence after remediation:

```sh
npm test --prefix backend/services/resource-service -- --runInBand __tests__/mediaModels.test.js __tests__/privateMediaStore.test.js __tests__/mediaCapability.test.js
```

Passed: 3 suites, 32 tests.

```sh
npx jest --config=backend/services/resource-service/jest.family.config.js --runInBand backend/services/resource-service/__tests__/familyMedia.test.js
```

Passed: 1 suite, 34 tests, including a raw Mongo collection insert that omits
the new scan fields and is normalized through the real access route.

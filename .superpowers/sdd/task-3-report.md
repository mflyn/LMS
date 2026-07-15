# Task 3 Report: Explicit Media Security Profiles

## Scope

Implemented immutable `trusted-local` and `secure-production` configuration,
canonical-byte scan integration, a bounded ClamAV TCP adapter, startup and
health probes, stable scan audit fields, fail-closed errors, and test-only fake
TCP coverage. No real ClamAV daemon is started by the normal development or
merge test path.

## RED Evidence

- Configuration tests first failed because `config/mediaSecurity.js` did not
  exist.
- Upload integration tests then failed with legacy audit state and zero scanner
  calls.
- Scanner protocol tests failed because `services/clamAvScanner.js` did not
  exist.
- Startup and health tests failed because health omitted the selected profile
  and `startServer` listened without a secure scanner probe.

## Implementation

- Development and test default to `trusted-local`; production requires an
  explicit valid profile.
- Secure scanner host, port, connect timeout, and scan timeout are validated and
  frozen.
- Trusted-local never constructs or contacts a scanner and persists
  `skipped_trusted_local` without a scan timestamp.
- Secure-production scans the exact canonical image/PDF buffer before storage,
  accepts only `OK`, and persists `clean` with a server timestamp.
- The ClamAV adapter uses NUL-terminated `zPING` and `zINSTREAM`, 64 KiB default
  chunks, a zero terminator, bounded responses, owned timers, and stable
  sanitized `MALWARE_DETECTED`/`MALWARE_SCANNER_UNAVAILABLE` errors.
- Secure startup connects MongoDB, probes the scanner, and only then listens.
  Health probes fail closed without mutating the configured profile.
- The shared error contract now includes `requestId` as required by the approved
  design.

## Verification

```sh
npm test --prefix backend/services/resource-service -- --runInBand \
  __tests__/privateMediaProcessor.test.js \
  __tests__/mediaSecurity.test.js \
  __tests__/clamAvScanner.test.js \
  __tests__/privateMediaStore.test.js
```

Passed: 4 suites, 59 tests.

```sh
npx jest --config=backend/services/resource-service/jest.family.config.js --runInBand
```

Passed: 11 suites, 153 tests.

```sh
npm run test:family-regression
```

Passed: 74 suites, 831 tests. A first run correctly exposed six stale response
contract assertions and one unrelated analytics test-order fluctuation. The
contract assertions were updated; the analytics suite passed alone and in the
complete clean rerun shown above.

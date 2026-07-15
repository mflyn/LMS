# Mistake PDF and Multi-Attachment Gate

**Document status:** IMPLEMENTED / FINAL LOW-RESOURCE VERIFICATION PENDING
**Implementation evidence commit:** `f5af5c0f`
**Evidence date:** 2026-07-15
**Design:** [Mistake PDF and Multi-Attachment Design](../superpowers/specs/2026-07-15-family-growth-mistake-pdf-multi-attachments-design.md)
**Test cases:** [Mistake PDF and Multi-Attachment Test Cases](./family-growth-mistake-pdf-multi-attachments-test-cases.md)

## 1. Decision

The code and deterministic merge-test path implement the approved increment. The default family
and Ubuntu deployments remain `trusted-local` and scanner-free so the approved 8 GiB family host
can run them. `secure-production` is implemented but is not release-approved until the protected
real-ClamAV command exits zero against the exact candidate commit on a sufficiently sized runner.

No result from `trusted-local` may be described as malware-clean. Scanner failure in
`secure-production` fails closed and never changes the configured profile.

## 2. Implemented Contract

- Parent and child mistake workflows manage ordered `questionMediaIds` and
  `childAnswerMediaIds`, with at most 10 unique attachments per group and legacy scalar read/write
  compatibility.
- Task attachments retain ordered collections up to 100 items and accept PDF in addition to JPEG,
  PNG and WebP. Stable bindings survive task complete, confirm, cancel and archive transitions.
- PDF is accepted only for task attachments and mistake question/answer attachments. It is limited
  to 10 MiB and 50 pages, rejects encryption and active/embedded content, is page-copied into new
  canonical bytes and is reparsed before persistence.
- Images are canonicalized through `sharp`; PDFs download with a sanitized attachment filename.
- `trusted-local` records `skipped_trusted_local` and never constructs a scanner.
  `secure-production` scans canonical bytes through bounded ClamAV `PING`/`INSTREAM`, records only
  clean results and uses stable `MALWARE_DETECTED` or `MALWARE_SCANNER_UNAVAILABLE` errors.
- Compose and Kubernetes keep ClamAV private, digest-pinned and health ordered. The scanner has a
  3 GiB Kubernetes request, 4 GiB limit and no public ingress or host port.

## 3. Focused Evidence

| Scope | Command or check | Result |
| --- | --- | --- |
| resource media/profile | resource-family Jest project and focused processor/scanner suites | 11 suites / 153 tests passed |
| mistake arrays/saga | `analytics-attachments` Jest project | 2 suites / 27 tests passed |
| GrowthTask attachment lifecycle | focused `growthTaskMediaReferences.test.js` | 1 suite / 15 tests passed |
| frontend collections/workflows | `npm run test:ci --prefix frontend/web -- --runInBand` | 27 suites / 174 tests passed; production build passed |
| real-service integration | `npm run test:family-flow:integration` | 4 suites / 6 tests passed |
| browser E2E | `npm run test:family-flow:e2e` | 4 Chromium tests passed on Desktop Chrome and explicit 360 x 800 checks; no overflow or console errors |
| deployment and scan harness | focused family-common deployment/smoke suites | 2 suites / 8 tests passed |
| scanner opt-in guard | `npm run test:family-security-scan` without authorization | exited 2 with `SECURITY_SCAN_SKIPPED:EXPLICIT_OPT_IN_REQUIRED`; no container started |

The browser flow covers parent task PDF upload, child task download, child mistake PDF/image
creation, parent image/PDF collection upload, reload, download, removal, and sibling/cross-family
denial through the real Gateway and services. Test PDFs are generated in memory.

## 4. Deployment Gate Matrix

| Candidate boundary | Required command | Current state | Approval |
| --- | --- | --- | --- |
| private trusted-family / 8 GiB host | `npm run release:family` | final candidate rerun pending | pending final low-resource Gate |
| secure-production implementation | deterministic scanner, deployment and smoke-harness tests | passed | implementation approved |
| secure-production release | `RUN_FAMILY_SECURITY_SCAN=1 npm run test:family-security-scan` on at least 10 GiB Docker memory | intentionally not run on the 8 GiB host | not approved |

The real-scanner script starts the base Compose file plus the security overlay, validates a safe PDF
upload/bind/download path, requires `422 MALWARE_DETECTED` for runtime-generated antivirus test
content, emits stable result codes only and always runs `down --volumes --remove-orphans`.

## 5. Residual Boundary

The only open release boundary is real ClamAV execution on adequate infrastructure. It does not
block a private `trusted-local` family deployment where every uploader is trusted and the network
is not publicly exposed. It does block any claim that the same candidate is approved for untrusted
uploads or `secure-production`.

To close that boundary, run the protected command against the final commit, retain its summary,
record the zero exit here, and repeat the documentation and Git hygiene checks. Do not override the
memory guard merely to obtain a passing label on an undersized host.

# Task 11 Family Growth End-to-End Gate

**Gate status:** PASSED / MERGE AUTHORIZED
**Validated at:** 2026-07-12  
**Requirement:** `FR-FLOW-001`  
**Pull request:** [#14](https://github.com/mflyn/LMS/pull/14)
**Passing CI run:** [29188066334](https://github.com/mflyn/LMS/actions/runs/29188066334)
**Merge commit:** `29991555b305ed4931d36f5b7a210e6bc32a2459`

## Delivered Baseline

- A disposable Task 11 runtime starts a transaction-capable MongoDB replica set, six
  family services, and the API gateway on loopback listeners. Teardown closes every
  listener, Mongoose, the replica set, CRA, and private-media files.
- Parent UI supports family creation, child profiles, visible non-secret family/child
  login IDs, and PIN set/reset without PIN disclosure.
- The backend acceptance flow covers five-development tasks, child completion, parent
  confirmation, star award idempotency, logs, mistakes, private media, deterministic
  current and frozen historical reports, reminder deduplication, and reward redemption.
- Chromium drives the real CRA application through parent registration, family and
  child setup, five tasks, child completion, parent confirmation, growth log, mistake
  image upload and signed preview, report/reminder inspection, and reward redemption.
- Focused browser checks cover parent-route rejection for child identity, sibling
  `403` without sibling content, stale child session recovery after PIN reset, and
  desktop plus 360x800 layout behavior.
- Pull-request CI installs Chromium and runs `npm run test:task11` without retries,
  ignored failures, or `continue-on-error`. Playwright evidence uploads only on failure.

## Implementation Commits

| Commit | Scope |
| --- | --- |
| `d7a46627` | Import-safe family service startup |
| `3f0a8466` | Parent child and PIN management |
| `71964950` | Disposable real-service runtime |
| `5d5734cc` | Gateway identity and task flow |
| `9b0e8c2f` | Complete backend acceptance flow |
| `d1d42d05` | Browser harness and happy path |
| `8a4cd130` | Browser role, stale-session, and mobile checks |
| `100cd9c2` | Full UI acceptance areas and configurable test rate limit |
| `d2b4d1a5` | Parent-visible child login identifiers |
| `0e54b6d6` | Mandatory CI gate and manual demo |
| `94dd6494` | Portable Sharp-generated browser media fixture |

## Verification Evidence

The counts below are the Task 11 candidate snapshot from 2026-07-12. Current aggregate
v1.6 evidence is recorded in a separate section.

| Gate | Result |
| --- | --- |
| Family backend regression | `npm run test:family-regression`: 58 suites, 675 tests passed across 7 projects in 89.453s |
| Frontend CI tests | `npm run test:ci --prefix frontend/web`: 23 suites, 149 tests passed |
| Frontend production build | `npm run build --prefix frontend/web`: compiled successfully; main JS 117.78 kB gzip and CSS 4.21 kB gzip |
| Task 11 integration run 1 | 4 suites, 6 tests passed in 10.555s |
| Task 11 integration run 2 | 4 suites, 6 tests passed in 9.814s |
| Task 11 Chromium | 4 tests passed with 1 worker and 0 retries in 18.3s |
| Browser runtime | Playwright 1.61.1; Chrome for Testing 149.0.7827.55, Chromium revision 1228 |
| Browser viewports | Desktop Chrome profile plus focused 360x800 parent/child checks |
| Repository hygiene | `git diff --check` passed; no tracked Playwright, build, coverage, or runtime artifacts |
| Remote PR CI | Run 29188066334 passed mandatory `Family Regression` and Task 11 acceptance in 4m0s |

## Remote CI Remediation

The first PR run, 29187750639, passed the backend Task 11 integration and three of
four browser cases, then rejected a hard-coded 68-byte PNG fixture on the Linux media
sanitization path with `400 VALIDATION_ERROR`. The test now creates an 8x8 PNG through
the repository's locked Sharp dependency, matching the media fixture path already used
by backend integration tests. The complete local Chromium suite passed, and the new
commit passed run 29188066334. The failed commit was not rerun.

## Security and Determinism

- Sibling and cross-family profile/media requests return stable `403` responses and
  do not disclose sibling names or private media.
- Parent tokens issued before family creation resolve the current family only after
  authenticated ownership lookup.
- Resetting a child PIN increments token version; the old token returns
  `STALE_CHILD_TOKEN`, old PIN login fails, and the new PIN succeeds.
- Confirmation and redemption replays do not duplicate earn or spend ledger entries.
- Prior-week reports remain frozen after late completion and cancellation; current
  report source totals are deterministic across repeated reads.
- Runtime error handling redacts tokens, PINs, signing material, signed URLs, and
  private paths.

## Known Non-Blocking Output Revalidation

- Stage 5 removed the React `act()` and Router future-flag warnings from the current
  frontend gate and added a guard for unexpected `console.error` output.
- CRA still reports stale Browserslist data during the production build.
- Dependency audit findings remain dependency-maintenance work and were not changed by
  Task 11.

## Residual Scope

Stage 6 added Docker image builds, Compose config/start/health, and a real public media
smoke to the mandatory unified release gate. Target Kubernetes deployment, k6
performance, ZAP security scans, Safari, Firefox, and native mobile clients remain
separate target-environment or non-MVP acceptance activities.

## Acceptance Decision

The local and remote Task 11 gates pass. `FR-FLOW-001` is implemented and `COVERED`
by the committed backend and Playwright evidence. PR #14 was merged as
`29991555b305ed4931d36f5b7a210e6bc32a2459`; later main audits retain this gate and its
traceability row.

## v1.6 Revalidation

On 2026-07-14, `npm run release:family` passed from clean `main` implementation commit
from the Stage 7 candidate and merged `main`: 70 backend suites / 755 tests, 4 Task 11
integration suites / 6 tests, 25 frontend suites / 156 tests, production build, 4
Chromium tests, seven image builds, eight healthy services, and a 91-byte private-media
gateway smoke. The [v1.6 release gate](./family-growth-v1.6-release-gate.md) is the current
aggregate evidence; this Task 11 document remains the focused historical closure.

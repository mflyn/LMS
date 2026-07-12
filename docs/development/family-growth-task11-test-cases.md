# Task 11 Family Growth End-to-End Test Design and Cases

**Document status:** IMPLEMENTED / LOCAL GATE PASSED
**Date:** 2026-07-12  
**Design:** `docs/superpowers/specs/2026-07-12-family-growth-task11-e2e-design.md`  
**Requirement:** `FR-FLOW-001`

## Test Principles

- Product acceptance uses public gateway APIs and the real frontend.
- The test runtime is disposable, transaction-capable, deterministic, and self-cleaning.
- Focused frontend tests mock gateway envelopes; Task 11 integration and browser suites do not mock product APIs.
- Every behavior change starts with a failing focused test.
- One case has one primary failure meaning; browser tests do not replace API security assertions.
- A first-run failure is a gate failure. Reruns may diagnose but may not hide instability.

## Parent Child Management

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T11-CHILD-001` | Parent opens `/app/children`. | Existing children render and parent navigation marks `孩子` active. | `ChildrenPage.test.js`, Playwright |
| `TC-T11-CHILD-002` | Submit a trimmed child name and optional profile fields. | `POST /api/children` receives accepted fields once; family context reloads and selector includes the child. | `familyApi.test.js`, `ChildrenPage.test.js` |
| `TC-T11-CHILD-003` | Submit empty/invalid child fields or a server validation error. | No invalid request is sent; server details remain visible without losing entered values. | `ChildrenPage.test.js` |
| `TC-T11-PIN-001` | Set or reset a 4-to-6 digit PIN. | `POST /api/children/:childId/pin` runs once and success is associated with that child; PIN is not displayed. | `familyApi.test.js`, `ChildrenPage.test.js` |
| `TC-T11-PIN-002` | Enter non-digit or wrong-length PIN. | Client validation blocks the request and names the requirement. | `ChildrenPage.test.js`, Playwright |
| `TC-T11-PIN-003` | PIN request fails. | Child row remains available, PIN clears, and retry is possible. | `ChildrenPage.test.js` |

## Runtime and Harness

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T11-RUNTIME-001` | Import user-service server in test mode. | No database connection, listener, process exit, or process-handler installation occurs. | `server.test.js` |
| `TC-T11-RUNTIME-002` | Start the Task 11 runtime. | Replica set, media root, six family services, and gateway become ready on loopback URLs. | runtime integration test |
| `TC-T11-RUNTIME-003` | Stop after success and forced assertion failure. | All listeners, Mongoose, replica set, child processes, and temporary files close. | runtime lifecycle test |
| `TC-T11-RUNTIME-004` | Inspect emitted runtime/error logs. | Tokens, PINs, secrets, private filenames, and signed URLs are absent. | runtime log assertions |

## Public API Closed Loop

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T11-FLOW-001` | Register parent, create family, create two children, and set PINs. | IDs are returned through public APIs and both children belong only to the new family. | `family-growth-demo-flow.integration.test.js` |
| `TC-T11-FLOW-002` | Create moral, academic, physical, artistic, and labor tasks. | Five dimensions persist for child A; child B and another family cannot list them. | integration test |
| `TC-T11-FLOW-003` | Child A logs in and completes the physical task with actual amount/unit. | Approved child fields persist; parent-only fields cannot be injected. | `family-growth-demo-flow.integration.test.js` |
| `TC-T11-FLOW-004` | Parent confirms a completed task twice. | Task remains confirmed and exactly one task-award ledger entry exists. | integration test |
| `TC-T11-FLOW-005` | Parent creates growth logs and an academic mistake. | Entries are returned only in the correct family/child scope. | integration test |

## Media, Reports, Reminders, and Rewards

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T11-MEDIA-001` | Upload private media and bind it to accepted evidence. | Asset and reference persist transactionally; API never exposes a public storage path. | integration test |
| `TC-T11-MEDIA-002` | Authorized parent requests signed access and then reads media. | Short-lived capability grants access through the documented endpoint. | integration test, Playwright |
| `TC-T11-MEDIA-003` | Sibling/cross-family identity requests access, then owner soft-deletes media. | Unauthorized requests return `403`; deleted media no longer yields usable access. | integration test |
| `TC-T11-REPORT-001` | Read/generate the current weekly report after accepted activity. | Dimension distribution and totals match deterministic source records. | integration test, Playwright |
| `TC-T11-REPORT-002` | Persist a prior-week report, then add late completion/cancellation and reopen it. | Persisted report payload remains byte-for-byte equivalent for statistical fields. | integration test |
| `TC-T11-NOTIFY-001` | Configure Sunday report reminders and read reminders at a fixed family-local instant. | One semantic weekly reminder appears with no duplicate key. | integration test, Playwright |
| `TC-T11-NOTIFY-002` | Read reminders across UTC boundaries that map to the same family-local date. | Deduplication uses family timezone and returns one reminder. | integration test |
| `TC-T11-REWARD-001` | Create an affordable reward and redeem with an idempotency key. | One redemption and one debit ledger entry are recorded. | integration test, Playwright |
| `TC-T11-REWARD-002` | Replay the same key, then use a new key without sufficient balance. | Replay returns the original result without debit; new request fails without negative balance. | integration test |

## Cross-Role Browser Flow

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T11-E2E-001` | Complete registration -> family -> two children/PINs -> five tasks in Chromium. | User-visible state matches server state and no relevant console/page error occurs. | Playwright |
| `TC-T11-E2E-002` | Use independent parent and child contexts; child A completes a task and the parent context confirms it. | Role-specific shells remain isolated and parent sees the completed task before confirmation. | `family-growth-flow.spec.js` |
| `TC-T11-E2E-003` | Parent records log/mistake/media, reads report/reminders, and redeems reward. | Each accepted MVP area is reachable through the real UI and backend. | Playwright |
| `TC-T11-E2E-004` | Open parent route with only child session. | Browser reaches parent login; no parent navigation or data renders. | Playwright |
| `TC-T11-E2E-005` | Child A attempts a captured child-B resource URL/API. | Stable `403` is observed and no sibling content renders. | Playwright plus integration test |
| `TC-T11-E2E-006` | Reset child A PIN while its prior session exists, then use that session. | API returns stale-token error, child storage clears, and browser returns to PIN login. | Playwright |
| `TC-T11-E2E-007` | Inspect children page and child shell at 360px. | No horizontal overflow, overlapping controls, clipped labels, or navigation-covered content. | Playwright screenshots/DOM assertions |

## Regression and CI Gate

| ID | Action | Expected result | Evidence |
| --- | --- | --- | --- |
| `TC-T11-GATE-001` | Run focused red/green tests during implementation. | Each changed behavior has a recorded failing assertion before production code and passes after the smallest change. | implementation log/commits |
| `TC-T11-GATE-002` | Run family backend regression, frontend CI tests, and frontend build. | Existing accepted behavior remains green. | Task 11 gate, CI |
| `TC-T11-GATE-003` | Run `test:family-flow:integration` twice from clean runtime state. | Both first executions pass with identical deterministic assertions and no open handles. | Task 11 gate |
| `TC-T11-GATE-004` | Run Playwright Chromium in mandatory PR CI. | Happy and negative paths pass without ignored failures or unconditional retries. | GitHub Actions |
| `TC-T11-GATE-005` | Run diff, clean-worktree, and generated-artifact checks. | No secret, report, trace, screenshot, coverage, or runtime artifact is tracked unintentionally. | Task 11 gate |
| `TC-T11-GATE-006` | Merge implementation PR and audit remote `main`. | Merge commit contains code/evidence; `FR-FLOW-001` is `implemented` and `COVERED`. | remote-main audit |

## Traceability

| Requirement or risk | Cases |
| --- | --- |
| `FR-FLOW-001` | All `TC-T11-*` cases |
| Parent can establish the browser flow | `CHILD-001` to `003`, `PIN-001` to `003`, `E2E-001` |
| Five-development coverage | `FLOW-002`, `FLOW-003`, `REPORT-001`, `E2E-001` |
| Cross-role task and star loop | `FLOW-003`, `FLOW-004`, `E2E-002` |
| Private child evidence | `MEDIA-001` to `003`, `E2E-003` |
| Deterministic reporting | `REPORT-001` to `002` |
| Reminder deduplication | `NOTIFY-001` to `002` |
| Reward idempotency | `REWARD-001` to `002` |
| `NFR-SEC-001` identity isolation | `RUNTIME-004`, `FLOW-002`, `MEDIA-003`, `E2E-004` to `006` |
| Stable mandatory gate | `RUNTIME-001` to `004`, `GATE-001` to `006` |

## Exit Rule

No subset of these cases closes Task 11. The gate requires the parent UI prerequisite, backend integration, real browser happy path, focused browser negatives, regression/build checks, CI evidence, merge, and remote-main traceability audit.

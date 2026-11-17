# Login 429 local candidate

Status: READY_FOR_REVIEW / independent review pending. No issue or release gate is closed here.
Baseline: 7da928e7d4aee992eb1507e3b898572fcbb012ca.

## Approved scope and plan self-review

- Original diagnosis manifest: 83ba99c84132b64ffeae641ff18afe8eaabf8aa53d1177a33e71ca65cdf3aae8 (five files verified unchanged).
- Six parent login 429 responses are archived facts. The original browser body and per-client counters were not captured. Eight non-auth 503 responses remain OPEN, with route template, error code and request correlation missing.
- Change only the derived general/sensitive rate-limit response message to the existing structured RATE_LIMITED contract. Preserve window, max, headers, skip-success policy, middleware order, source keys and trust proxy.
- Classify parent login errors by status before reading optional messages: 429 throttled, 401 invalid credentials, 5xx unavailable, missing response network failure. Do not echo unstructured server/HTML text. Preserve attempt and session guards; no automatic retry, session clear or original-command mutation.
- Add permanent HTTP contract/source tests and component error/race tests before implementation. Verify real loopback HTTP; source sharing is a synthetic reproduction, not attribution of production traffic.
- Run affected gateway/common/user authentication tests, frontend regression/build, and existing child entry/login-race browser suites plus new parent error cases in Chromium and WebKit, serial with zero retries. No real model calls; only temporary synthetic dependencies.
- Risk: common configuration consumers receive JSON instead of plain text on 429. Validate both configured limiters and existing consumers; no successful or unauthorized response contract changes.
- Rollback: revert the two product files in a future reviewed delivery, not any data or counters. No deployment in this batch.

Self-review before implementation: scope is reversible and does not change permissions, numeric limits or proxy trust. The display fix does not solve shared proxy quotas; source attribution and 503 remain separate. No access to server, existing manual instance, account data or credentials is required. PASS to local implementation, not independent acceptance.

## Validation

Evidence files are frozen separately with the final patch and per-file SHA256 manifest. This document is the local plan/self-review record, not an independent acceptance record.

- `backend-red.log`: original product, 2 failed / 1 passed. Configured general response is text/html instead of JSON; configured sensitive body is not structured. No assertion removed.
- `frontend-red.log`: original product, 8 failed / 13 passed. Includes misleading fallback on 429/5xx/network and non-string error causing a render error. Console guards retained.
- `backend-green.log`: initial 3 HTTP cases passed, preserving the actual 100/15-minute and 20/15-minute boundaries, headers and successful-request counting.
- `frontend-full.log`: initial complete active frontend regression, 85 suites / 1412 passed, 109.394s. Existing legacy exclusions unchanged.
- `backend-related.log`: complete selected family-common + user-service regression, 72 suites passed / 2 failed; 1793 tests passed / 2 failed, 217.889s. The two old Git tests failed with executable error -86, not an application assertion. Do not describe this run as green.
- `git-environment-recheck.log`: system Git first and local baseline metadata restored to the isolated archive; original two suites passed, 106 tests, 12.67s. No product/source assertion changes. The old cleanliness test creates/deletes its own synthetic fixture commit; no LMS candidate commit or push was made.
- `chromium.log`: sandbox launch blocked by macOS MachPort permission; stopped with exit 130, 5 failed / 1 interrupted / 35 not run / 4 pure tests passed. Not a browser product verdict; all output retained.
- `chromium-controlled.log`: same 45 cases passed in controlled local context, 5.1m. Serial, zero retries, existing budgets and console contracts unchanged.
- `task-edit-followup.log`: new 401 counterexample exposed test-fixture reuse of a denied session in the next three old cases (3 failed / 52 passed). Fixed only the test setup to create each session through the existing saveParentSession API, not raw storage resurrection. No session product code or old assertion changed.
- `task-edit-followup-green.log`: all three affected suites, 55 tests passed, 11.877s.
- `backend-task-edit.log`: final 4 HTTP cases passed, 2.344s; adds the successful task PATCH / subsequent login rejection boundary.
- `frontend-final.log`: after the task-edit clue and fixture correction, the full active frontend regression passed again: 85 suites / 1417 tests, 99.237s.
- `webkit.log`: the same 45 cases passed in controlled local context, 4.3m, serial and zero retries.
- Build and final targeted ESLint passed; build retains the existing stale Browserslist-data warning. Documentation gate passed. All runtime stop hooks and test processes completed; no manual test instance was reused.

The 45-case browser selection comprises all 32 existing AI1 cases, all 4 child-entry cases, both child-login races, all 6 parent-navigation/cleanup cases, and 1 new parent-login contract case. The new case injects five HTTP errors (legacy/current/empty 429, 401, 503), asserts one POST per explicit action, preserved storage and exact native console error counts, then uses a real synthetic parent login through the formal application. It does not reproduce the original eight production 503 responses. AI1 remote operation/Provider remains a local substitute, never a real model.

## Task-edit clue and limits

The user's additional observation (task editing often precedes login failure) was checked without changing task logic:

- TasksPage.saveTask sends one PATCH for ordinary edits, updates its local row on success, and reloads the list automatically only for creation or specific conflicts/denials. Two permanent component cases verify successful/429 edit paths do not loop list reads or repeat writes.
- The real familyApi/requestWithSession boundary preserves the session on task PATCH 429/503; only 401 expires it. Three new cases preserve that distinction and assert no retry.
- A real loopback limiter test uses 99 synthetic reads, one successful synthetic task PATCH, then a login that receives 429 before its handler. This establishes a possible shared-quota mechanism, not historical per-user attribution or a real task-controller load measurement.
- No evidence in these tested paths supports task editing directly corrupting a password/PIN, logging out on 429, or creating a normal-save refresh loop. Other production timing/path combinations remain unverified.
- Shared source quota behavior is NOT fixed in this batch. No trusted-proxy configuration, IP key, count, window, PIN counter, normal instance or original command was changed.

## Self-review and remaining review scope

- Product diff restricted to two files: common config message objects and AuthContext login error mapping. Identity/attempt guards precede error handling unchanged; no retry, storage write or command mutation was added to the error path.
- HTTP rejection and success controls, stale error/success after account change/logout, newer successful login, malformed message, task-edit no-loop/no-expiry cases retained. Existing frontend/backend assertions and browser cleanup/console checks were not weakened.
- The source tests show peer sharing and forged-header non-bypass under current trust=false. They do not certify a new proxy configuration or identify the original clients. A later source-key fix requires its own bounded design and evidence.
- Eight business 503 responses remain OPEN. Minimum missing evidence is time, method, redacted route template, error code, correlation and response layer. No server collection or replay authorized/executed.
- T4/T8/AI-1 OPEN, DEVICE_PENDING/MANUAL_PENDING, historical failures and deferred work unchanged. All green results here are developer verification; testing/review thread independent replay remains pending.

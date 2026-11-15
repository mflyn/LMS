# AI-1 Actual Dual-Store Synthetic Recovery

Status: ACTUAL_DUAL_RESTORE_LOCAL_REVIEWED. B/D/AI-1 remain OPEN.

## Scope and Candidate

Three test files extend the recovery P2 candidate and its retained dependencies.
`manifest.json` binds the incremental patch and 68 source fingerprints; patch
reconstruction passed. No product implementation, API, real configuration or
automatic restore capability is added. DeepTutor remains the approved local
v1.7.1 baseline; no server or model is contacted.

Actual components: Gateway, seven LMS services, temporary Mongo replica set,
homework production factory/restart, DeepTutor main/SQLite/restricted SDK and LMS
operation client. Provider transport/output, clock and input counter are synthetic.
The test driver coordinates fixed phases through private local files; it is not
a service, worker platform or production recovery procedure.

The local reservation is seeded through the real transactional service with a
reader of the actual synthetic task, not through public generation. This allows
capturing the pre-dispatch BSON state. The actual service then claims and marks
unknown. For old accepted, the local snapshot is unknown with its occupied slot;
for the other four remote states it is reserved, before slot acquisition.

The remote scenarios use the exact persisted local remoteOperationId and request:

| Remote historical snapshot | Real transition after snapshot | Provider attempts before/after isolation |
| --- | --- | --- |
| accepted | same operation succeeds | 1 / 1 |
| sending after Provider return | distinct synthetic operation succeeds | 2 / 2 |
| succeeded | distinct synthetic operation succeeds | 2 / 2 |
| failed_not_sent from revoked price profile | distinct synthetic operation succeeds | 1 / 1 |
| empty | original operation succeeds | 1 / 1 |

Distinct operations above only prove that a remote snapshot is old. They are
test-driver service calls, not extra LMS generation jobs or billed model requests.
LMS then recovers through actual HTTP/GET: success settles exactly 200 microyuan
in both family and experiment accounts; reliable not-sent releases with zero cost;
sending remains unknown with the full 16384-microyuan reservation.

Before restoring SQLite the old remote process stops. Before restoring all AI
Mongo collections the homework listener stops. Both applications are reconstructed
under explicit external isolation; the test does not infer continuity from rows.
Original/new generation and recovery are rejected; authorized historical reads
remain private. Every AI collection, original mapping, reservation and slot stays
identical to the restored BSON snapshot. Learning collections and private media
files remain unchanged. Four direct actual-client probes (old/new GET/PUT) all
return AI_STORE_ISOLATED; SQLite bytes and Provider counts remain unchanged.

## Failures and Review

- Initial author run: 2 passed / 1 failed, 33.47 seconds. New test incorrectly
  expected 200 for sending recovery; the existing API requires 202 for a
  nonterminal result. Corrected to exact sending=202 / terminal=200, without
  changing the product or weakening response checks.
- Intermediate author run: 6 passed, 1 warning, 75.62 seconds, exit 0.
- Static review found two P2 test protections: exact pre-restore settlement in
  both accounts/Reservation, and deadline recheck after synchronous control callbacks.
  Both were locally corrected and statically re-reviewed.
- Deadline red test first hit a sandbox process-audit PermissionError; this is
  retained but is not the valid reproduction. In the existing permitted local
  context, the original helper failed with DID NOT RAISE TimeoutExpired (exit 1,
  0.64 seconds). The child had exited normally during a callback that crossed the
  original deadline. The helper now rechecks that same deadline on return.
- The callback check detects overrun after return; it is not a claim of preemptive
  cancellation of synchronous code. Existing operation and test budgets remain.

Final author regression: 13 passed, 1 warning, 107.76 seconds, exit 0 (new seven
tests plus the existing six business/executor tests). No earlier pass is
substituted for this candidate. An isolated-copy mutation interpreting remote
store-isolated as query-only was caught by the actual accepted-snapshot scenario:
GET returned accepted instead of AI_STORE_ISOLATED, 1 failed, 15.58 seconds,
pytest exit 1 as expected. Original product source remained unchanged.
Independent execution: only the seven new tests, 7 passed, 1 warning, 74.69 seconds,
exit 0. All 68 source fingerprints match before/after, with no timeout, forced
cleanup or recorded owned-process survivors. Both scoped P2 protections passed
static re-review and current independent execution. Existing business tests and
author mutations were not repeated by the reviewer. Exact commands/results and
log hashes are recorded in verification.json. The frozen manifest retains its
original pre-review status; this record carries the later conclusion.

## Acceptance Boundary

This increment supplies actual cross-service synthetic evidence for RECOVER-06/07,
complementing the previously reviewed continuous-restart and isolation tests.
It does not establish production disaster recovery, real vendor token counting,
current pricing, a paid budget, human content suitability or device acceptance.
Historical family failures (161/2 suites, 4980/2 tests), AI-0 human review,
T4/T8 OPEN, T9 NOT_STARTED, DEVICE_PENDING, Docker INCOMPLETE_FAILED,
T5-NB-001/002 OPEN_NONBLOCKING and advanced recovery/new cleanup
REMAINDER_DEFERRED remain. No commit, push, merge or deployment.

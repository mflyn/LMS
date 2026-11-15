# AI-1 Actual Business and Browser Integration

Status: `ACTUAL_BUSINESS_BROWSER_LOCAL_REVIEWED`. B/D/AI-1 remain OPEN.
The original interrupted evidence and failures below are preserved.

The current increment is test-only: parameterized synthetic profile/clock in DeepTutor
`tests/services/ai1/lms_acceptance.py`, new `lms_business_acceptance.py`, and LMS
`backend/tests/t2/ai1ActualRemote.acceptance.js`. It uses actual Gateway/services, a temporary Mongo replica set,
the actual DeepTutor main/SQLite and restricted SDK. Only the model network/response and input counter are doubles.
Task and media-only mistake sources, original-actor recovery, settlement, revisions and co-parent review are covered by the new assertions.

## Preserved Execution History

Prior tool output reported three author scenarios passed (29.47 seconds, one warning, exit 0).
Earlier fixture failures were importlib module resolution, a non-contract chapter label, incorrect 403 expectation
where family-scoped resources deliberately return 404, and an unsupported mistake questionText field.
The fixture was corrected to use the approved chapter and real synthetic private media; production validation was not relaxed.

The subsequent expanded run did NOT pass: output stopped after progress dots and seven failure markers;
the outer 240-second process bound returned status null and SIGTERM, without a complete pytest summary.
Neither a passed-test total nor a cause is inferred from that partial output.

On continuation, the original temporary virtual environment, build outputs, pytest directories and raw logs were absent.
The old independent-review agent and diagnostic handles were also absent. A bounded process check found no matching
pytest/acceptance/Mongo test processes. Two earlier process checks had not executed because permission review timed out.
Later read-only observations showed high host load; this does not establish the historical timeout's root cause.

The prior results above are preserved from conversation tool output, NOT reconstructed raw log files.
Old frozen packages and their recorded hashes remain unchanged, but unavailable original local logs cannot be claimed reproducible.
Fresh raw evidence will use a private Git-ignored directory outside temporary storage; no old failure is overwritten.
Independent static review is restarted; no independent execution or batch acceptance is claimed for this increment yet.

## Remaining Work

Restore the local test dependencies, confirm a usable execution environment, diagnose the expanded-run failure without
increasing timeouts, and complete independent verification. No blind rerun or new load before resource checks.
Actual-remote browser, remaining cross-layer matrix conditions, real-model token bound and human/paid acceptance remain pending.
No real model, server operation, commit, push, merge or deployment. Preserve historical failures, AI-0 human review,
T4/T8 OPEN, T9 NOT_STARTED, DEVICE_PENDING, Docker INCOMPLETE_FAILED, T5-NB-001/002 OPEN_NONBLOCKING,
and advanced recovery/new cleanup REMAINDER_DEFERRED.
# Fresh local verification after environment interruption

The historical interrupted run remains incomplete. Restored local dependencies
and durable private evidence do not recreate missing historical raw logs.

- Serial expanded author regression before the review additions: 171 passed,
  3 warnings, 73.95 seconds, exit 0. This is a new run, not a reclassification of
  the seven failure markers followed by the previous 240-second termination.
- Independent static review found five P2 test protection gaps: descendant
  cleanup, family/global/reservation accounting, GET versus PUT recovery,
  independent version predicates, and same-key changed-body rejection.
- Added partial-output retention, bounded cleanup of observed identities and
  the private Node process group, plus permanent timeout/nonzero/immediate-exit
  helper cases. The test-only preload keeps the known Node/Mongo helpers in the
  group; this is not a general untrusted-process sandbox and does not claim to
  survive external termination of the Python driver itself.
- Added both accounts and the matching reservation at unknown/recovered/replayed
  checkpoints, a method/operation-ID-only remote ingress record, isolated
  cycle/artifact/review version and hash/ID negatives, concurrent approval and
  changed-body command negatives. The concurrent HTTP requests do not claim a
  deterministic Mongo transaction interleaving.
- First process-group refinement failed with transient Darwin EPERM on cleanup;
  its log remains. The final refinement requires the group to disappear within
  the bounded cleanup period; persistent permission failure still fails.
- Final author business/cleanup subset: 6 passed, 1 warning, 47.17 seconds,
  exit 0. Static re-review found the five original gaps addressed in this scope;
  independent execution and final candidate binding were pending at that point;
  see the final run below.
- Frontend production build passed, exit 0. The existing stale Browserslist data
  warning remains; no dependency update was performed to suppress it.
- A documentation check first failed because NODE_PATH was absent. With the
  existing dependency path explicitly supplied, the unchanged check passed
  (412 fixtures, 38 requirements). This is not a product-test failure.

Fresh raw output is kept in the private Git-ignored local evidence directory,
not in disposable temporary storage. Browser acceptance against the actual
remote implementation was validated subsequently as recorded below. B/D/AI-1 remain OPEN.

## Frozen Candidate and Final Author Run

`manifest.json` binds 23 cross-repository files and the 42 unchanged non-document
files from D5. `deeptutor-candidate.patch` reconstructs the complete local remote
implementation against the approved v1.7.1 baseline. `lms-candidate.patch` is a
two-test increment dependent on the retained complete D5 patch, not a complete
replacement for that LMS baseline. Both patch reconstructions passed.

The final author run explicitly selected the six operation suites and all three
cross-checkout acceptance files: **182 passed, 3 warnings, 148.89 seconds, exit 0**.
It contains 6 business/cleanup tests and 8 browser/native-cleanup tests; the latter
are six actual page scenarios plus two forced browser shutdown cases, not eight
business scenarios. Existing test and expect timeouts are unchanged.

The browser path uses actual LMS services and actual DeepTutor operation/store/
SDK in Chromium and WebKit at 820x1180, with a synthetic Provider transport and
input counter. It validates real navigation, accurate previews, task and
media-only mistake sources, generation, refresh, original-actor relogin recovery,
revision, co-parent approval, and readonly revisits. Only synthetic text is sent.
No real model, pricing validation, invoice, textbook upload, or human approval is
implied. Browser simulation does not clear DEVICE_PENDING.

Browser static review additionally found and corrected three P2 protections:
preserve Playwright's native browser process group, separate its 100-second
global deadline from the unchanged 120-second outer fallback, and bind created/
revisited cycle identity to the expected child and source. The nominal difference
includes CLI startup, not a guaranteed twenty-second hook allowance.

The earlier browser run had Chromium 3 pass and WebKit 1 fail due to forced
document navigation aborting Today requests. Real SPA navigation fixed the test
flow without filtering page errors or weakening assertions. The next 6-pass
navigation run precedes the final protections and is not the final candidate run.

In an isolated source copy, removing both cycle version predicates causes the
new single-field negative to fail with expected 409 / actual 200 (exit 1).
Production source was not mutated. First patch reconstruction was unsuccessful
because Git discovered the parent checkout and skipped paths; explicit Git
ceiling isolation corrected the artifact procedure before recording PASS.

Independent static conclusions and actual independent execution are distinct.
Final independent execution passed **14 tests, 1 warning, 112.49 seconds, pytest
exit 0**; all 65 source fingerprints were unchanged. This only repeats the six
business/cleanup and eight browser/native-cleanup tests, not the prior core suites.
The reviewer accepted the eight scoped P2 responses and found no new blocking
issue within the reviewed increment.

The independent supervisor originally exited **1**, because it also observed
the author's two documentation-check Node processes. Its original result remains
unchanged. Exact creation times, parent relationship and commands subsequently
attributed them to the documentation check rather than the independent test;
neither was killed. Final owned/live and matching-process audits were both empty,
with no forced cleanup. This is a separately explained supervisor failure, not
an assertion that every command was green. The documentation Jest subset itself
passed 312 tests, exit 0, in 39.715 seconds.

`manifest.json` retains its immutable freeze-time pending status. Current review
status and execution/attribution evidence are recorded in `verification.json`;
the manifest and original failure evidence are not rewritten to suggest an
earlier review or successful supervisor exit.
Historical family full-regression failures, missing temporary raw evidence,
AI-0 human-review restrictions and all unrelated open/deferred gates remain.


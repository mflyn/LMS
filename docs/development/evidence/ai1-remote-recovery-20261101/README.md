# AI-1 Snapshot Isolation Evidence

Status: ACTUAL_SNAPSHOT_ISOLATION_LOCAL_REVIEWED. B/D/AI-1 remain OPEN.

This test-only increment extends the previous actual-business package. It does not
add a restore command, automatic continuity detection, production configuration,
or permission to re-enable a restored store.

## Candidate

- DeepTutor base: `f7aed0744c36c5afef16a4261c31ebee1208cac2` (approved local v1.7.1).
- LMS base: `1d49abb11580172fa86a7e282cb31588bf682027` plus the retained D5 and actual-business candidates.
- `manifest.json` binds three changed test files and 66 current source fingerprints.
- `candidate.patch` is an increment, not a standalone complete delivery. Apply the
  preceding business package and its D5 dependency first. Repository prefixes in
  this increment are `DeepTutor/` and `LMS/`.
- Increment reconstruction against the preceding test files: PASS.
- Historical packages and failures are not rewritten.

## Actual and Synthetic Boundaries

DeepTutor tests use the actual main, SQLite, restricted SDK and LMS operation
client over loopback HTTP. Only Provider transport/output, token counter and clock
are synthetic. The accepted snapshot is taken before a real operation transition,
then restored after the synthetic Provider was called once, with both application
processes stopped. Explicit `store-isolated` is required before the restored app
starts. Original/new IDs and GET/PUT must all return `AI_STORE_ISOLATED`; database
bytes and the Provider attempt count remain unchanged.

Additional cases restore sending, succeeded, failed-not-sent and empty snapshots;
each snapshot predates another successful operation. An expired quote does not
prevent exact query-only historical success replay. Enabled/query-only startup
without the external continuity declaration must fail before readiness.

LMS tests use the actual Gateway/homework factories, service transactions and a
temporary Mongo replica set. The remote endpoint in this suite is explicitly a
protocol double, not DeepTutor. All AI model collections are serialized as BSON
in reserved/unknown states, advanced through HTTP to succeeded and settled, then
restored before constructing an isolated application. The previous test listener
is idle, not a simulated process restart. Both fee accounts, reservation, mapping,
cycle, commands, artifact collection and global slot must remain exactly as restored.
The unknown snapshot has a positive reservation and an occupied global slot;
the reserved snapshot has no claimed slot. Authorized reads remain available,
outsider reads fail, and original/new generation or recovery cannot resume work.

These are complementary layer tests, not a simultaneous two-service backup drill.
RECOVER-06/07/08 receive scoped evidence; this package does not automatically
upgrade their complete cross-layer acceptance status.

## Author Verification

- `python -m pytest tests/services/ai1/lms_recovery_acceptance.py -xv --tb=short`:
  8 passed, 1 warning, 40.85 seconds, exit 0.
- `node jest/bin/jest.js --config=backend/services/homework-service/jest.config.js --runInBand --runTestsByPath backend/services/homework-service/__tests__/services/ai1Production.test.js`:
  first 11 passed, 6.871 seconds, exit 0; after explicit nonempty financial/slot
  baseline and exact error-code assertions, 11 passed, 6.576 seconds, exit 0.
- Isolated-copy mutation removing the remote `storeContinuous` startup check:
  both new startup cases failed at the explicit unexpected-readiness assertion,
  2 failed, 1 warning, 6.24 seconds, pytest exit 1 as expected. Original source unchanged.
- Raw logs are private, Git-ignored local artifacts. Hashes and independent results
  are recorded separately; no private paths or synthetic credential values are published here.

## Independent Review and Test Protection

The first frozen candidate independently passed 8 remote and 11 LMS tests, but
review identified three test-protection gaps: no explicit successful-terminal
baseline before expired-query replay, generic startup failure matching, and no
missing-continuity-field case. The initial freeze remains unchanged. A subsequent
increment adds exact terminal/usage/persistence assertions, the sanitized runtime
failure plus a same-mode positive control, and false/missing field cases in both
active modes. This does not add detailed product error disclosure.

`manifest-p2.json` and `candidate-p2.patch` bind this subsequent increment against
the first freeze; reconstruction passed. Static re-review accepted all three
protections. Author verification: 10 passed, 1 warning, 46.59 seconds, exit 0.
The current tests reject both isolated-copy mutations: removing the continuity
guard (4 failures, 9.95 seconds) and allowing a missing field by default
(2 failures, 5.15 seconds). Each pytest exit 1 was expected; original product
source remained unchanged. Final independent execution: 10 passed, 1 warning,
46.76 seconds, exit 0; 66/66 source fingerprints unchanged, no timeout, forced
cleanup or recorded owned-process survivors. The unchanged LMS file retains the
independently executed 11-test evidence (5.884 seconds, exit 0), not a claimed rerun;
all 44 LMS fingerprints match that earlier independent run.

The independent reviewer accepted all three scoped test protections after static
re-review and the current execution. No new concrete issue was found in this
increment. Independent execution did not repeat the author's mutations. This is
local review completion, not approval to close B/D/AI-1 or whole RECOVER-06/07.
Both frozen manifests keep their original pre-review status; this record and
`verification.json` carry the later review result without rewriting candidate identity.

## Retained Limits

No real model, current vendor price, qualified v4 complete-input bound or human
AI-1 value acceptance is established here. The previous family regression remains
161 passed / 2 failed suites and 4980 passed / 2 failed tests, not a newly green run.
AI-0 human review restrictions, T4/T8 OPEN, T9 NOT_STARTED, DEVICE_PENDING,
Docker INCOMPLETE_FAILED, T5-NB-001/002 OPEN_NONBLOCKING and advanced recovery/new
cleanup REMAINDER_DEFERRED remain. No server action, commit, push, merge or deployment.

# AI-1 B Local Candidate

Current status: B_LOCAL_REVIEW_PASSED / EXTERNAL_IMPLEMENTATION_PENDING. B and AI-1 gates: OPEN.

User-approved local P1/P2 closure and independent re-review hashes are in [closure.json](closure.json), Gate 29.6.
The original manifest, patch and verification file remain immutable pre-review snapshots, including their pending statuses.
The permanent three-version test and closure documents are a later increment, not part of the reviewed original patch.

A acceptance and issue closure are recorded in Gate 29.4; its original patch and manifest remain unchanged.
This candidate is cumulative from baseline `1d49abb11580172fa86a7e282cb31588bf682027`, including A and B changes.
`manifest.json` identifies source/document hashes and `candidate.patch`; evidence directories are excluded to avoid circular hashes.
`verification.json` records local logs by hash, not private machine paths or raw logs.

## Verified Locally

- Real temporary Mongo replica set, signed-identity router, and real loopback HTTP client.
- Original mapping recovery after a lost response; no second PUT/charge; live parent/child isolation.
- Closed remote states and hashes, no transport retries/redirects, and dedicated synthetic credentials.
- Expiry versus dispatch transaction competition; persistent remote-claim evidence rejects contradictory refunds.
- Raw request-byte limit, fail-closed parser ordering, detail version chain and scoped discovery.
- Related regression: 8 suites / 540 tests passed, exit 0. Not a full-family rerun.

## Review and Remaining Work

Independent first review found P1 contradictory refund and P2 raw-size enforcement, plus detail/read-model and deadline-race gaps.
Fixes passed independent re-review and the user approved local P1/P2 closure; B as a whole is not accepted.
In-memory mutations removing the claim-refund guard and raw-byte limit were caught by two and one targeted counterexamples respectively.
These intentional exit-1 mutation runs are not normal regression failures or substitutes for the full selected regression.
The independent review's HTTP run hit test-log EPERM; the author's controlled local run is separate evidence.
The subsequent independent re-review ran all eight related suites (540 tests, 65.74 seconds) successfully,
including real loopback HTTP, and independently reproduced both expected mutation failures.
Its additional three-version detail probe is now permanent in ai1Service.test.js.
The subsequent closure increment passed 8 suites / 542 tests (59.725 seconds), adding the permanent detail test
and local-closure state protection. Reversing detail ordering was caught by the permanent test (expected exit 1).
ESLint, documentation and diff checks passed. This is author verification of the later increment, not a new independent review.
Hashes, commands and results are in [closure-validation.json](closure-validation.json); no full-family rerun was performed.

The remote endpoint is a durable Mongo protocol double, not DeepTutor. It does not prove a real worker, tokenizer,
Provider serialization/retry bounds, crash recovery, SQLite durability, or storage-continuity enforcement.
External source and authorization are needed before those B items can be completed. No production router is mounted.
No real models, deployments, project Git commits or pushes occurred.

## Retained Boundaries

The A full-family run remains 161 passed / 2 failed suites and 4980 passed / 2 failed tests (exit 1).
The corrected targeted runs do not replace that history. AI-0 parent review/corrections, T4/T8 OPEN,
T9 NOT_STARTED, DEVICE_PENDING, Docker INCOMPLETE_FAILED, T5-NB-001/002 OPEN_NONBLOCKING and
advanced recovery/new cleanup REMAINDER_DEFERRED remain unchanged.

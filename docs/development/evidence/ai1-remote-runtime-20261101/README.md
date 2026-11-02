# AI-1 Remote Runtime Local Candidate

Status: `LOCAL_RUNTIME_REVIEWED_NOT_BATCH_ACCEPTANCE`.
B/D/AI-1 remain OPEN. This is a new snapshot, not a replacement for the store, wire or SDK packages.

## Scope

DeepTutor v1.7.1 base `f7aed0744c36c5afef16a4261c31ebee1208cac2` plus the complete 17-file local candidate.
The existing main mounts `/internal/deeptutor`, defaults off, checks private configuration and existing storage,
and clears runtime state on normal shutdown or another module's startup failure.
No database creation, schema repair, unknown-claim release, server access, real credentials or model calls.

Formal-main tests use fresh temporary HOME directories, actual core/server lifecycle and enabled authentication.
The restricted SDK is real; its counter and model network/response are synthetic. Main probes prohibit network connect.
Two separate processes compare persisted/query-only output to the first HTTP response, not to a later mutable baseline.
The existing operation HTTP suite also uses actual local loopback listeners.
The actual LMS client to formal-main TCP combination is not yet covered by this snapshot.
Missing a qualified real-model counter still prevents enabled startup. Synthetic injection cannot authorize paid use.

## Evidence

Author: 6 suites, 163 passed, 3 warnings, 9.49 seconds, exit 0.
Independent: 6 suites, 163 passed, 3 warnings, 9.43 seconds, exit 0; 17 file hashes unchanged before/after.
These are separate full selected runs, not sums of historical runs.

```sh
PYTHONDONTWRITEBYTECODE=1 python -B -m pytest \
  --confcutdir=tests/services/ai1 -p no:cacheprovider tests/services/ai1
```

The temporary local environment contains repository core/server dependencies, OpenAI 2.6.1, HTTPX 0.28.1,
httpcore 1.0.9, Python 3.13.0 and pytest 9.0.2. No global or server installation was performed.
Root-fixture missing-dependency failures remain historical; the repository-wide suite was not rerun after installation.
Warnings are retained, not represented as zero-warning validation.

FIFO P2 is locally fixed and independently reviewed: nonblocking open followed by regular-file rejection;
config, service-token and provider-key FIFO counterexamples all failed with timeout before the fix and pass after it.
The earlier provider-key test passed prematurely through an expired quote; it is preserved but not credited as protection.
Other retained failures include misplaced storage checks, incomplete startup cleanup and two formal-main fixture mistakes.
Nonblocking coverage observation: the missing-unique-index test also removes PK/NOT NULL, so it does not isolate the index branch.

`candidate.patch` is the complete base-relative DeepTutor patch. `manifest.json` binds source and current LMS documents.
`verification.json` distinguishes author, independent and failure logs; hashes bind original local logs without publishing raw private paths.
`validation.json` records patch reconstruction, documentation checks and diff checks. Old evidence packages remain unchanged.

## Unclosed Boundaries

No real-model token upper bound, actual fee cap, paid test, human end-to-end value acceptance, deployment or Git publication.
Store continuity is a controlled declaration, not automatic detection of an undeclared backup rollback.
Preserve historical family full-regression failure (161/2 suites, 4980/2 tests), AI-0 human review,
T4/T8 OPEN, T9 NOT_STARTED, DEVICE_PENDING, Docker INCOMPLETE_FAILED,
T5-NB-001/002 OPEN_NONBLOCKING and advanced recovery/new cleanup REMAINDER_DEFERRED.

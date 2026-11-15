# AI-1 Actual Client / Formal Main TCP Candidate

Status: `LOCAL_CLIENT_TCP_REVIEWED_NOT_BATCH_ACCEPTANCE`; B/D/AI-1 OPEN.

Only `tests/services/ai1/lms_acceptance.py` is added to the previous 17-file DeepTutor runtime snapshot.
The 18-file patch remains relative to v1.7.1 `f7aed0744c36c5afef16a4261c31ebee1208cac2`.
LMS client, contract and schema hashes are bound separately; they are not edited by this batch.

## Actual and Synthetic Components

Actual: LMS Node client/request builder/response validator, loopback TCP, DeepTutor formal main and lifecycle,
authentication, restricted SDK, SQLite and fresh processes. Model network, response, token counter and clock are synthetic.
No Gateway, LMS business database, fee ledger or browser is exercised here. No model call or server operation.

The test-only subprocess injects failures after durable accept, after durable claim, after Provider return,
and after durable success before the HTTP response body reaches the client. It never changes production fault options.
Claimed operations keep their original response and attempt count across restart/replay. Accepted operations do not
dispatch on GET; only an explicit original PUT can claim them under the declared continuity and current test quote.
This is process restart, not proof that an old backup is safe to send from.

## Invocation and Results

```sh
AI1_LMS_ROOT="$LMS_CHECKOUT" AI1_NODE="$NODE22" AI1_NODE_PATH="$LMS_NODE_MODULES" \
  PYTHONDONTWRITEBYTECODE=1 python -B -m pytest \
  --confcutdir=tests/services/ai1 -p no:cacheprovider tests/services/ai1/lms_acceptance.py -q
```

Missing explicit prerequisites fail; this file is deliberately outside standalone DeepTutor's default test discovery,
which does not include an LMS checkout. This is an explicit acceptance command, not a skipped CI test.

Author first run: 5 passed, 1 warning, 24.27 seconds, exit 0.
Author combined selected run: 168 passed, 3 warnings, 31.98 seconds, exit 0.
Independent: 5 passed, 1 warning, 24.06 seconds, exit 0; 41 source/dependency fingerprints unchanged.
No new reproducible P1/P2 in the reviewed scope. Two earlier fingerprint-wrapper path errors occurred before pytest;
the independent pytest run itself was executed once. Original logs preserve these preparation failures.
Mutations in isolated copies: GET dispatch (1 failure), accepted replay disabled (1 failure), sending re-claim (2 failures),
all expected exit 1. The first mutation-script setup rejected a nonunique replacement anchor before tests, not a product failure.
The reviewer did not repeat the author's mutations. Nonblocking observation: fixture cleanup bounds termination and waits,
but does not classify unexpected ordinary-process exit codes. A follow-up should distinguish intentional SIGTERM,
expected fault 73 and unexpected failure, not require Uvicorn graceful shutdown to return zero. No leftover process was observed.

`manifest.json` binds the complete patch and both repositories' relevant files; `verification.json` binds original local logs
and distinguishes author/independent evidence. `validation.json` records reconstruction and document checks.
No raw logs containing local paths are published. Prior frozen packages remain unchanged.

## Preserved Boundaries

Full service/ledger and browser integration with the actual remote, real-model input bound, paid and human value acceptance remain pending.
Retain AI-0 human review, historical full-regression failures, T4/T8 OPEN, T9 NOT_STARTED, DEVICE_PENDING,
Docker INCOMPLETE_FAILED, T5-NB-001/002 OPEN_NONBLOCKING and advanced recovery/new cleanup REMAINDER_DEFERRED.
No commit, push, merge or deployment is authorized by this evidence.

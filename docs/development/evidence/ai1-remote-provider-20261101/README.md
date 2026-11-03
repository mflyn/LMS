# AI-1 Restricted SDK Local Candidate

Status: LOCAL_SDK_REVIEWED_NOT_BATCH_ACCEPTANCE / B_OPEN / AI1_OPEN.

This is a local DeepTutor v1.7.1 candidate against
`f7aed0744c36c5afef16a4261c31ebee1208cac2`, not a deployment or batch acceptance.
The previous store/wire packages are immutable historical snapshots.

## Scope

- Actual OpenAI SDK request construction; one restricted completion, no generic chat,
  key rotation, fallback, Agent, tools or real model call.
- Canonical complete body is both counted and transmitted. Output limit is 4096,
  thinking is disabled, and missing or wrong-profile input counter rejects before claim.
- Fixed official HTTPS endpoint, verified TLS, no environment proxy, redirects or retries.
  HTTPcore trace checks the deadline before request headers and body after connection/TLS.
- Raw response size/type checks, absent usage retained as unknown cost, no coercion to zero.
  Errors/cancellation keep the durable claim and never create another request.
- Context-scoped SDK logging filter protects private request/error content without
  changing other requests' logger levels or handlers.

The input counter is a synthetic test double, **not** a verified v4 tokenizer or
proof of a real billing bound. No real provider key is read. Formal main mounting,
LMS-to-actual-remote combination, counter qualification and paid/human acceptance remain pending.

## Verification Boundary

Tests use an isolated local Python environment with OpenAI 2.6.1, HTTPX 0.28.1,
HTTPcore 1.0.9 and existing test dependencies. No server installation occurred.
The SDK is real; model responses and network I/O are synthetic. Prior operation HTTP
tests use an actual loopback listener and temporary SQLite, not a live external service.

```sh
python -B -m pytest --confcutdir=tests/services/ai1 -p no:cacheprovider tests/services/ai1
```

The confcutdir limits this command to AI-1 modules. The historical root-fixture failure
due to missing markdown_it and the asyncio configuration warning remain; this is not
a passing full DeepTutor regression. Historical LMS family failures remain 161/2 suites
and 4980/2 tests, not all green.

Author final: 137 passed, 1 warning, 1.67s, exit 0. Independent final: 137 passed,
1 warning, 1.72s, exit 0; all 14 files unchanged before/after the independent run.
These are each full selected AI-1 runs, not sums of earlier 87 and later 50 results.

The first SDK module run failed because the module did not exist. A later logging
counterexample failed twice before scoped filtering; four byte/deadline counterexamples
failed before exact-wire binding and HTTP write-boundary checks. Independent review
verified the connection/TLS deadline P1 and counted-versus-sent bytes P2 fixes, and
the SDK logging observation. Seven final-candidate mutations were intercepted with
expected exit 1; author mutations are not independent review evidence.

Independent probes additionally verified claim/unknown preservation after each
write-boundary rejection and concurrent SDK logging isolation across success, error,
cancellation and timeout. Those extra probes are distinguished from permanent tests.
The default HTTP/1.1 path is exercised; HTTP/2 trace names are not runtime coverage.

Frozen patch/file hashes, author/independent results and expected mutation failures
are recorded in manifest/verification/validation JSON. Original local logs retain failed
runs; public records contain only synthetic descriptions, counts and hashes.

AI-0 human review, T4/T8 OPEN, T9 NOT_STARTED, DEVICE_PENDING, Docker INCOMPLETE_FAILED,
T5-NB-001/002 OPEN_NONBLOCKING and advanced recovery/cleanup REMAINDER_DEFERRED remain.
No Git commit, push, merge, remote environment operation or deployment is authorized here.

# AI-1 D1 Transport and Default-Off Assembly

This is a local partial D candidate, not B/D/AI-1 acceptance. No real model, external service modification,
Git publication, server operation or deployment took place. Runtime activation and query-only recovery assembly
remain pending; the actual DeepTutor operation implementation remains externally blocked.

- `manifest.json`: full source candidate relative to its recorded Git baseline, file hashes, reconstruction result,
  and the unchanged C frozen package identity. The patch includes earlier A/B/C context, not only this batch's delta.
- `candidate.patch`: mechanically generated full candidate. Do not overwrite the B or C frozen packages.
- `verification.json`: author tests, independent review and fault probes, expected mutation failures, and private log hashes.

Real components: Gateway, signed homework router, formal homework factory, AI service, temporary Mongo replica set,
and local loopback HTTP. Gateway transport-only tests replace the business service. Formal default-off tests seed
a historical cycle with a local fixture; they do not construct DeepTutor or a Provider. Earlier C browser evidence
uses synthetic APIs and is not upgraded to formal end-to-end evidence by this batch.

Two local P2 fixes passed focused independent re-review: chunked proxy framing and strict original UTF-8 input.
The independent reviewer ran permanent tests, raw-byte probes and five in-memory mutations without editing source.
Five additional permanent boundary cases then captured the reviewer's nonblocking test recommendations.
No full-family rerun is claimed. The historical family result remains 161 passed / 2 failed suites,
4980 passed / 2 failed tests, exit 1. Failed author and independent-environment runs remain indexed.

AI-0 human review is required; its fee authorization does not transfer. B and AI-1 gates remain OPEN.
T4/T8 OPEN, T9 NOT_STARTED, DEVICE_PENDING, Docker INCOMPLETE_FAILED, T5-NB-001/002 OPEN_NONBLOCKING,
and advanced recovery/new cleanup REMAINDER_DEFERRED remain unchanged.

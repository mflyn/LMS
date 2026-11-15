# AI-1 D2 Local Runtime and Formal HTTP Candidate

Scope: local startup admission, formal HTTP generation/review, query-only recovery and storage isolation.
Status: D2_LOCAL_RUNTIME_REVIEW_PASSED / EXTERNAL_ACTIVATION_PENDING. B/D/AI-1 gates remain OPEN.

- `manifest.json`: baseline, complete cumulative candidate file hashes, parent D1 hashes and patch reconstruction result.
- `candidate.patch`: cumulative candidate against the recorded baseline, not only the latest test increment.
- `verification.json`: author, independent, mutation and historical failure results kept separate; private log hashes.
- `post-freeze-validation.json`: subsequent document/state, diff and frozen-file validation when available.

Real components: Gateway, homework production factory, AI service, temporary Mongo replica set and loopback HTTP.
Remote operation is a protocol double, not the actual DeepTutor implementation. No Provider/model call occurred.
Config continuity/profile flags express operator prerequisites, not proof of remote persistence or billing correctness.
Default mode remains off. Query-only never grants reserved jobs send authority; storage isolation retains mapping and fees.

Author related regression: 9 suites / 220 tests passed before the last two test assertion refinements.
After those test-only refinements: 2 suites / 54 tests passed. Existing unrelated suites were not rerun for formality.
Independent earlier runtime run: 2 suites / 49 tests passed; four supplemental admission probes passed separately.
Final independent focused review: 2 suites / 3 tests passed, 51 unselected; not a complete 54-test rerun.
Two test protection gaps were fixed: completion admission masking the AI factory guard, and approval state self-comparison.
Independent factory/approval mutations caused 2/1 expected failures. The earlier three runtime mutations each caused one expected failure.
Initial missing-module, assembly, fixture, bounded-hello and documentation red runs remain evidence, not green results.
An ESLint dependency-resolution failure was corrected using existing local dependencies, without installation or rule changes.

Actual remote restart/claim/Provider behavior, formal browser integration, complete 35-row matrix, paid and human value acceptance remain incomplete.
Historical family full regression remains 161 passed / 2 failed suites and 4980 passed / 2 failed tests, exit 1.
AI-0 human review and corrections remain mandatory; its budget is not transferred.
T4/T8 OPEN; T9 NOT_STARTED; DEVICE_PENDING; Docker INCOMPLETE_FAILED;
T5-NB-001/002 OPEN_NONBLOCKING; advanced recovery/new cleanup REMAINDER_DEFERRED.
No Git commit, push, merge, server change or deployment is part of this candidate.

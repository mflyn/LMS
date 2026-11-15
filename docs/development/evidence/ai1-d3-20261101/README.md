# AI-1 D3 Formal LMS Browser Evidence

Status: FORMAL_LMS_BROWSER_VERIFIED / EXTERNAL_IMPLEMENTATION_PENDING. B/D/AI-1 gates remain OPEN.

The candidate uses the existing synthetic seven-service runtime and real login, Gateway, homework,
task/mistake source APIs, temporary Mongo replica set and private media storage. The external operation
endpoint is an explicitly in-memory protocol double. No actual DeepTutor or Provider was executed.
Browser routes only reject external traffic; they do not fabricate successful LMS API responses.

- `manifest.json`: cumulative candidate against the original baseline, file hashes and reconstruction.
- `candidate.patch`: includes preceding AI-1 work and this batch; D2 artifacts remain unchanged.
- `verification.json`: separate author/independent/failure/mutation evidence, build and screenshot hashes.
- `post-freeze-validation.json`: subsequent state/lint/diff and candidate checks when available.

Author and independent browser runs each passed six tests, separately, in 41.6 seconds.
Five are business scenarios: task and media-only mistake entry, public-response-loss original retry,
remote-response-loss logout/original-actor recovery, and stale co-parent approval requiring reread.
The sixth tests teardown error propagation with actual listeners closed and environment restored.
Source type/ID/child are asserted in request, create response and stored detail. Browser never reads attachments.
Generated script markup remains text. Revision, original hash, reviewer and approval state survive reload/relogin.
The before/after database snapshot covers source business collections, not AI collections that legitimately change.

Independent review fixed source-binding and teardown-finally P2 protection gaps. A valid wrong source and
removal of the teardown finally each trigger their permanent assertion. The source mutation also retains
the runner max-failures/outside-test summary; the source mismatch stack, not exit status alone, proves capture.
Initial missing-hook, ambiguous cost locator, premature unknown-result observation and restricted Chromium
failures remain recorded. No timeout increase, skipped business assertion or automatic test retry was used.

Runtime lifecycle: six tests passed. New frontend build succeeded and all eight files match the build actually
used by browser tests byte for byte; 12 frontend source files match the C frozen candidate. C full frontend
regression is prior evidence, not a newly executed D3 full regression. Desktop/768/390 layouts were captured;
this is not iPad hardware validation.

The 35-row progress matrix is in the existing test plan section 11. Remaining local browser permission/failure
combinations, actual remote/Provider acceptance and paid/human value validation are explicitly pending.
Historical family full regression: 161 suites passed / 2 failed, 4980 tests passed / 2 failed, exit 1.
Preserve AI-0 human review, T4/T8 OPEN, T9 NOT_STARTED, DEVICE_PENDING, Docker INCOMPLETE_FAILED,
T5-NB-001/002 OPEN_NONBLOCKING and advanced recovery/new cleanup REMAINDER_DEFERRED.
No server access, real model calls, Git commit/push/merge or deployment occurred.

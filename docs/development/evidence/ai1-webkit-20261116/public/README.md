# WebKit focused test delivery

This directory contains reviewed source patches, hashes and sanitized validation summaries.
Raw logs, screenshots, machine paths, process information and original private evidence are retained locally, not published.

- `candidate.patch`: exact six-file pre-closure candidate, based on `09180b863189ff64c41c53c094c85dc32ebacca5`.
- `increment.patch`: exact cleanup-P2 increment relative to the previous five-file WebKit candidate; not a patch against bare main.
- `candidate-files.json`: original frozen file identities and both patch hashes.
- `archive-index.json`: current/review/historical archive identities and counts; no claim that private raw evidence is available in GitHub.
- `validation-summary.json`: developer results and fresh reconstructed focused review results, kept separate.
- `delivery-verification.json`: delivered file identities, explicitly separating post-review closure documents from unchanged reviewed test source.

The current two closure documents differ intentionally from their pre-closure frozen versions. Original patches and historical hashes are unchanged.
Developer focused 13 and review focused 13 are not 26 distinct cases. Chromium 32 and WebKit 32 are developer regressions; the review did not independently rerun the browsers.
The cleanup P2 is CLOSED / USER_APPROVED / LOCAL_ONLY. This does not close the AI-1 gate or the original request incident.
Historical WebKit failures, REAL_REQUEST_EVIDENCE_PENDING, DEVICE_PENDING/MANUAL_PENDING, T4/T8/AI-1 OPEN,
SERVER_TIMING_UNVERIFIED, Docker INCOMPLETE_FAILED, nonblocking followups and deferred scope remain.

No product code, runtime flags or workflow changes are included. No real Provider/model, human-test entry update or deployment is authorized by this delivery.

The full staged `git diff --cached --check` reports exit 2 for ten blank context lines in the exact frozen `candidate.patch` when that unified diff is added as a text file.
The patch bytes are not trimmed or rehashed to hide this result. The other twelve delivery files pass the separate whitespace check; the original patch reconstructs all six candidate files with matching hashes.
No Git whitespace rules, test assertions or CI configuration were relaxed. This artifact-format warning is distinct from source lint, document validation and test results.

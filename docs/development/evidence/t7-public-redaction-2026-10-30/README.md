# T7 Public Evidence Derivatives

Status: SANITIZED_REVIEW_PENDING. No merge or deployment approval is inferred.

This delivery is reconstructed on main `7d519d20` without the original six T7
commits as ancestors. Original commits, the complete pre-redaction patch and
original files are preserved locally. The earlier public branch/PR still exists;
this candidate does not claim to remove GitHub caches, PR refs or prior exposure.
Remote-history handling requires a separate explicit decision after review.

## What Changed

Nine T7 evidence files replace operator home-directory identifiers and the
server login target with `/Users/REDACTED`, `/home/REDACTED` and the documentation
example `qa@192.0.2.10`. These are placeholders, not operational instructions.
No business code, API, product test assertion, runtime configuration or release
entry behavior is changed by this redaction. Synthetic private-address fixtures
used to test isolation are retained, not confused with real server metadata.

The scope is the new T7 delivery. Previously published main history contains
other local-path metadata and is not rewritten by this work. This is not a claim
that the entire repository or all GitHub history has been anonymized.

## Hashes and Historical Evidence

`manifest.json` maps each private original hash to its public derivative hash.
Existing hashes/byte counts embedded in historical evidence describe the
original artifacts. They MUST NOT be interpreted as the hashes of these public
derivatives. Frozen patch originals remain local; the public patches are
redacted representations and cannot reproduce original byte-for-byte identities.
Likewise, original candidate commit identifiers identify historical runs, not
ancestors guaranteed to be available in this reconstructed branch.

Full 01-18 success at `0bddeb7e`, its independent evidence review, and all earlier
failed runs retain their original meaning. Redaction is not a new product run.
T7 remains CLOSED / ENGINEERING_SYNTHETIC_ONLY; T4 OPEN, DEVICE_PENDING,
historical Docker INCOMPLETE_FAILED, both nonblocking items and deferred recovery
and cleanup remain unchanged. Raw logs, private media and original snapshots are
not included in this public derivative directory.

## Local Verification and Review

- Document-state validation passed (388 contract fixtures, 38 requirements).
- Existing documentation gate suite: 287 tests passed, no skips; includes public
  derivative hash and redaction checks. Repository ESLint passed.
- Added-line credential/operator-path scan had no remaining matches. An initial
  scan treated the documented REDACTED placeholder followed by a backtick as an
  identifier; boundary handling was corrected, without accepting real identities.
- Original 115-file snapshot and nine derivative mappings reverified; product
  sources, runtime configuration, release entry and product assertions unchanged.
- Boyle independently verified the scope, original/derivative hashes and retained
  boundaries. Review found a temporary dependency symlink carrying an operator
  path outside the 117-file staged scope; it was removed, not ignored or committed.
  Only that newly created link was removed; existing installed dependencies remain.
- Frozen historical patch whitespace is retained. No product/server rerun, remote
  history rewrite, push, merge, branch deletion or deployment in this revision.

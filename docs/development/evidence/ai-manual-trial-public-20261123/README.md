# Manual-trial dual-repository delivery candidate

2026-11-23. Local preparation only; not committed, pushed or published.
This is a derived public-evidence candidate, not the original private archive.
No product code changed during this preparation. Only the DeepTutor approval
document received a subsequent, append-only user-acceptance record.

## Delivery identity and dependencies

| Repository | Base | Delivery |
| --- | --- | --- |
| LMS | GitHub main `a26786a91b670bc5f24c2eb0931290df2ce02ed2` | 42 files in `lms-delivery.patch` |
| DeepTutor | PR #2 head `d5a30cbd95c7fbed53f7423dd046915a0eb1ebf6` | 17 local files in `deeptutor-delivery.patch` |

Exact file hashes, patch hashes, bases and archive bindings are in
[delivery.json](delivery.json). Both patches passed offline apply and
byte-for-byte reconstruction. GitHub main's tree equals the locally available
PR #60 head tree; no fetch, branch switch, ref update or repository staging was
needed. This proves patch application, not a newly executed product regression.

LMS includes the 24-file first ledger batch hidden in a local application
snapshot plus the later 19-file batch, with one overlapping design file: 42
unique files. The eight PR #61 SRS/guide files are excluded; no snapshot commit
history is proposed for publication. Existing original-repository changes and
WP1/T8 work are untouched. The two dependency symlinks and generated caches are
excluded. Any future remote-main change requires another diff check.

DeepTutor's 17 local files require the existing 15-file PR #2 implementation;
their union against fork main is 26 files. The target is `mflyn/DeepTutor`, not
the third-party upstream. PR #2 stays Draft; Actions blocking and historical
failures remain deferred under support ticket 5036799. No CI rerun occurred.
The appended acceptance document changes the delivery hash; the other 16 files
still match the accepted original freeze. Old PENDING prose is historical,
not an unresolved approval of this already accepted local batch.

LMS owns the shared quota/settlement/halt ledger. DeepTutor owns the restricted
operation and durable result, not another budget pool. Both compatible
deliveries are required for v2. Default-off remains unchanged; neither a merge
nor synthetic evidence authorizes real configuration or sending. Cross-repo
browser fixtures are not automatically proved by either repository's ordinary CI.

## Evidence layers (historical runs, not rerun here)

| Layer | Result and qualification |
| --- | --- |
| DeepTutor developer | 298 passed; excludes five historical leader/plugin failures, not whole-repository green |
| DeepTutor independent | 74 passed: 36 v2 + 12 AI3 formal + 26 AI1 runtime |
| DeepTutor mutations | 12 expected failures / seven controls, eight categories; independently audited, not rerun |
| Initial LMS page/runtime | 253 frontend / 282 backend; earlier 167 passed plus three suites unable to start remains preserved |
| Initial independent | 217 frontend / 109 runtime; distinct from developer results |
| Initial formal browser | One scenario per Chromium/WebKit; formal local applications, synthetic Provider HTTP transport; before latest consent fix |
| Consent P2 red / first green | 16 passed / three expected failures; then 254 passed / one test-key failure, both retained |
| Consent P2 corrected developer | 255 passed; build/lint passed in original archive |
| Consent P2 independent | 19 and 99 targeted cases; rollback 16 passed / three expected failures |
| Final independent review | Five suites / 118 passed; no new browser or backend rerun |

Do not add overlapping counts into a single run. The historical Ubuntu 267
cases exercised the earlier formal-runtime patch, not this v2 delivery. Formal
SDK logs mentioning the official model URL are synthetic MockTransport or
network-I/O substitutes, not proof of an external model call. Real calls: zero.
Automatic browser evidence is not human or iPad acceptance.

## Public derivatives and history

[evidence-map.json](evidence-map.json) identifies every selected derivative's
original relative archive path, original SHA-256/size, public SHA-256/size and
redaction/projection rule. New delivery patches have their own hashes; they are
not relabelled as old frozen patches. Original archives are retained privately.

Only allowlisted reports, candidate identities, result projections and a labelled
log excerpt are included. User home, workspace, evidence-root and temporary paths
are replaced with placeholders. Jest projections retain suite error messages,
case failures and result counts. No runtime HOME, settings, credentials, SQLite,
browser storage, Jest cache or entire raw archive is included. Historical failed
results remain failed; old pending snapshots are not edited into approved ones.

Public copies are incomplete by design: local reviewers can consult original
archives through the recorded hashes. The derivative bundle does not claim to
contain all raw failure logs or independently reproduce all earlier tests.
Pattern screening found no local user paths, private IPs, private-key headers or
common access-token patterns. This is not a universal proof of absence of secrets;
the actual staged diff and any new public files need a final check after Git
publication is separately authorized.

## Retained gates and next step

Exact input qualification remains deferred; v1 stays fail-closed. V2 fees are
estimates, not hard cost caps. Unknown/over-estimate charges halt later sends;
original operations must not be replaced or automatically resent.
T4/T8/AI-1 OPEN, DEVICE_PENDING, SERVER_TIMING_UNVERIFIED,
Docker INCOMPLETE_FAILED, historical failures and other deferred/nonblocking
items remain unchanged. No model, server, deployment or manual-test-entry changes.

Next: review this local delivery candidate. Git commit/push, branch creation and
PR creation/update require separate user authorization. On authorization, use
latest-main selective LMS delivery and the existing DeepTutor fork branch; do
not publish raw application-snapshot history or private evidence wholesale.

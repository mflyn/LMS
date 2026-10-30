# T7 bounded diagnostic evidence

- Candidate: `6166a3e958ef335cc09ddb82a76dce615d78b8c6`.
- Result: one authorized 14-16 diagnostic attempt, `FAILED_STOPPED / MONITOR_EXIT`; 14/15 passed, 16 incomplete, 17/18 `NOT_RUN`. Not a full release pass.
- Gates: T4/T7 OPEN; DEVICE_PENDING, historical failures/Docker INCOMPLETE_FAILED, two OPEN_NONBLOCKING items and REMAINDER_DEFERRED retained.
- No product source changed for this diagnostic. No commit, push, merge or real deployment followed it.

## Frozen local archives

The raw archives are local, Git-ignored evidence, not files shipped by a fresh Git clone. Do not overwrite them or recompute old indices to match later records.

| Archive manifest | SHA-256 | Scope |
| --- | --- | --- |
| `release-gate-artifacts/t7-swap-readonly-2026-10-28-230858/manifest.json` | `19f9b59a9fb954d19168c46dc9d4feb10e19275e24b3a5c42316205b2631c951` | Prior 60-second read-only observation; no retrospective attribution |
| `release-gate-artifacts/t7-swap-diagnostic-2026-10-29/manifest.json` | `e9680c9b596273eb3167618f9a6afffd35070b433bbe71ffdc6f850ef19d2b79` | 46 files: diagnostic tools, tests, raw evidence, analysis and independent review |

The second archive's `README.md`, `review.md`, `evidence/result.json`, `evidence/monitor.stderr` and `evidence/diagnostic-summary.json` describe the failure and limitations. Inspect's original error text/return code were not saved. The later teardown `No such container` is not proof of the earlier failure's cause. Outer scoped cleanup succeeded; selected original resource metadata and inventories matched. This is not a business/data integrity certification.

73 budget samples each have a corresponding cgroup observation, but the next inspection failed before another sample. The observed window does not cover the stopping/cleanup tail. Seven cgroups have only one observation, so their deltas remain unknown. Initial analysis and summary remain preserved alongside the corrected versions.

## Review provenance and pending work

Independent reviewer Avicenna (`01a18282-fc69-7052-927c-ead7dad6296f`) ran six local monitor tests before execution, then reviewed local raw evidence and independently recalculated all 25 cgroup entries and the 11 frozen tool/log hashes. Eight process-control cases and the added analysis fixtures were developer-run evidence, not independently repeated. The reviewer did not rerun SSH, Docker or the server attempt. This evidence review does not close R4 or T7.

The user's subsequent suggestion of accidental Docker cleanup remains unverified. The recorded endpoint is Ubuntu Linux/amd64 through an explicit Docker Unix-socket forward, not the local Docker Desktop context. SSH authentication must be restored before bounded read-only server event/log checks. Do not infer an operator from container disappearance alone, read private shell history, or change server state to investigate it.

See [Gate section 27.25](../../family-self-directed-learning-mvp-gate.md#2725-换页诊断中止与外部清理待核实2026-10-29) for the current continuation boundary. Any further server run must respect the latest authorization and original budget; the single diagnostic attempt is not reusable authorization.

## SSH-restored read-only follow-up and local monitor fix

The earlier SSH-pending statement above is historical. After authentication was restored, bounded read-only Docker event/journal and inventory checks completed. The user could not confirm a cleanup location, time or command. The 256 returned recent events do not cover the failed inspection window. Narrow daemon logs contain task deletion/image-parent warnings consistent with possible transient-job teardown, but cannot identify an operator. Original inspection stderr/exit code remain unavailable; both manual cleanup and the failure cause remain UNDETERMINED. Selected metadata for all 11 original containers and image/network/volume inventories match the prior cleanup snapshot; this is not a business-data or latency audit. No server state was changed or new attempt started.

The temporary diagnostic monitor now records inspect nonzero/timeout failures before stopping, without retry or weaker thresholds. Unknown output is represented only by length/hash and classification, not raw contents. Independent review found and verified a fix for text-mode normalization/decoding: capture is binary and hashes/counts original bytes. Eight inspection cases and the unchanged six monitor cases passed independently, including real local subprocess CRLF/invalid-UTF-8 counterexamples. Historical red evidence (including one missing-fixture error and the byte-handling P2's one failure/one error) is preserved. This covers inspect nonzero/timeout diagnostics only, not every possible monitor failure, and has not yet been exercised on Ubuntu.

| New local archive manifest | Files | SHA-256 |
| --- | --- | --- |
| `release-gate-artifacts/t7-docker-cleanup-check-2026-10-29/manifest.json` | 9 | `97f60435b49f577c9d9493b8df6fcfe3fa5eb8c0ae576643e4caab0cecd42f86` |
| `release-gate-artifacts/t7-monitor-inspect-fix-2026-10-29/manifest.json` | 13 | `159d2843501ce6accfa994eac12a5cfaa0b15cebd67c7485bd581423c35676bf` |

The second archive binds monitor.patch, source, original wrapper/tests, new counterexamples, red/green logs and review.md. Reviewer Avicenna independently reran the 8+6 local tests, not SSH/Docker. The local byte-handling P2 passed review; historical INSPECTION_FAILED, R4 swap diagnosis and T4/T7 remain open. Another bounded 14-16 attempt requires authorization; no 17-18/full-release pass is inferred.

## Newly authorized 14-16 attempt

The user subsequently authorized one further 14-16 attempt with the reviewed monitor and unchanged budget/stop rules. Project `family-growth-isolated-t7-inspect-d45d518b` on the same fixed runtime `6166a3e9` completed configuration, seven-image serial build, all synthetic preparation, both preflights and full service health startup. Runner and shell summary both exit 0; monitorFailure=false, stopReason=null. Stages17-18 and full release were not run. This consumes only the newly granted one-attempt authorization, not permission for another run.

71 paired samples cover 08:07:34.264-08:11:18.390 Asia/Shanghai. Host swap-in/out increased by 36/8,501 pages; one interval exceeded 1,024 pages (1,658), no three-interval streak. Minimum MemAvailable 4.878277 GiB; maximum observed added disk 499.925781 MiB and new configured container limits 1.8 CPU / 2,816 MiB. Eight singleton cgroups retain unknown deltas. Original service cgroups also swapped out: this does not certify zero performance impact or resolve historical R4 causation. Observation ends before the final cleanup snapshot.

Shell/outer scoped cleanup exited 0; original 11-container selected metadata and image/network/volume inventories match; both forwards cancelled and credentials removed. The cleanup-time scan found no credential matches in 20 files. Post-run verification found all 1,855 tracked source files and 15 frozen tool/log entries unchanged, with a clean fixed checkout. Local checkout/bin links reuse that prior clean checkout, not a new clone. No real deployment or Git write occurred. Raw evidence is in `release-gate-artifacts/t7-inspect-diagnostic-2026-10-29`; its README distinguishes this bounded diagnostic from full release and historical failures.

Independent reviewer Avicenna locally verified the stage/cleanup logs, all 34 cgroup statistics, 1,855 source hashes, 15 frozen tool/log hashes and two external dependencies. No SSH/Docker or independent server rerun was performed. The bounded PASS was supported without a new blocking finding; missing final review/manifest files were completed afterward by the primary agent. Developer local tests were 8 runner + 6 monitor + 8 inspect, analysis fixtures, syntax, documentation audit and 268 documentation-state tests, all passed.

Final archive: `release-gate-artifacts/t7-inspect-diagnostic-2026-10-29/manifest.json`, 54 files, SHA-256 `7d042cd32f0edcea841e11db0054711a7d85756850acfc8250932280a1ae41d5`. The final manifest is primary-agent generated/verified, not a reviewer-verified final hash. Frozen source and original failure archives were not rewritten. T4/T7 remain OPEN; this result supports preparing a newly authorized continuous full-release attempt, not closing the full-release gate.

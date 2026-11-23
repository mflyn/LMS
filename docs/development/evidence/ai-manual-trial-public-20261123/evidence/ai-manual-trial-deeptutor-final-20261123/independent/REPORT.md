# DeepTutor manual trial v2: independent review

Status: LOCAL_SYNTHETIC_REVIEW_PASSED / USER_ACCEPTANCE_PENDING.

## Result

No new actionable P1/P2 finding was identified. The reviewed test expansion does not weaken original assertions. The requested independent regression completed once with exit 0: 74 passed, 0 failed, 0 errors, 0 skipped. One warning was reported under the unchanged repository pytest configuration.

| Independently executed file | Passed |
| --- | ---: |
| tests/services/ai1/test_manual_trial_v2.py | 36 |
| tests/services/ai1/test_ai3_formal_runtime.py | 12 |
| tests/services/ai1/test_operation_runtime.py | 26 |
| Total | 74 |

JUnit time: 69.856 seconds. Pytest console time: 69.86 seconds. Outer wall time: 70.758 seconds. Original outer budget: 180 seconds; formal subprocess timeout: 30 seconds, unchanged. No timeout or termination signal occurred. The historical five leader tests were not included. This is not a new independent run of the developer's 298-case suite or any earlier 283/289/290 batch.

## Candidate binding and unchanged files

Observed HEAD: d5a30cbd95c7fbed53f7423dd046915a0eb1ebf6. The existing 17-file dirty candidate includes the prior formal-assembly increment; it is not a new commit and is not the old 11-file patch.

before.json and after.json bind the 17 candidate files plus pyproject.toml, tests/conftest.py and tests/services/ai1/test_operation_provider.py. All 20 files were byte-for-byte hash-identical before and after the independent run. The 16 unchanged historical candidate files still matched the previous snapshot during the preceding static review. The expanded test file is 17462 bytes, SHA256 cc00ee8c76cc66078ba23234a9f0c1f7eb8af895a984f3a435afa5f9f8e6a85f. No business source change was found in the test-expansion increment. git diff --check exited 0; git status retained the same 17-file set.

Final packaging must bind its full patch and file hashes to this reviewed state. This report does not claim an unseen final patch has already been verified.

## Execution and isolation

Interpreter: <HOME>/GitHub PRJ/LMS/.cache/ai1-sdk-local-20261101/bin/python.

Python 3.13.0; pytest 9.0.2; OpenAI SDK 2.6.1; HTTPX 0.28.1; httpcore 1.0.9.

Full command, inline guard, sanitized environment and timing are in command.json and independent.json. Reproducible runner source is runner.cjs. The effective pytest selection was:

```text
-q -p no:cacheprovider
tests/services/ai1/test_manual_trial_v2.py
tests/services/ai1/test_ai3_formal_runtime.py
tests/services/ai1/test_operation_runtime.py
--basetemp=<TEMP>/pytest-temp
--junitxml=<TEMP>/independent.xml
```

The parent process received only PATH, isolated HOME/DEEPTUTOR_HOME and PYTHONDONTWRITEBYTECODE=1; Python used -B. Existing pyproject.toml options were used without replacing config, disabling assertions, installing dependencies or changing budgets. Cacheprovider was disabled. The parent guard rejected AF_INET/AF_INET6 connect and connect_ex; these three files did not require real loopback listeners. Formal subprocesses retained their existing separate synthetic homes, sanitized environments and socket-connect guard. Real HTTPX/httpcore trace tests replaced the network backend with synthetic streams. No mutation was installed during the independent run.

There was no concurrent main-thread pytest according to the user's execution handoff. No whole-machine process-inventory claim is made. No permission escalation or permission blocker occurred. Project and Git files were read-only; only /private/tmp evidence and synthetic test fixtures were created. No real model, real credential, server, deployment, Git write or external notification was used.

## Static and dynamic coverage

- Explicit v2 request/profile and estimate acknowledgement remain mandatory. Estimated fees are not per-call or experiment hard caps. V1 still fails closed without a qualified counter; exact input counting remains deferred.
- Old v1 accepted replay under the trial profile passed the formal-main regression with dispatch forbidden, projection equality and SQLite-byte preservation. This independently verifies the local regression fix; it does not close user or live-service acceptance gates.
- All eight added cases relative to the previous 28 passed: two extra formal None-usage cases, one formal v2 namespace-isolation case, two SDK 429/reopened-store cases and three actual-httpcore trace boundary cases.
- The expanded four formal send cases validate 30000-plus-byte Unicode canonical wire, Content-Length, max_tokens=4096, exact messages and complete usage-or-None, followed by query-only restart with the original projection.
- Namespace isolation retains credential-swap rejection, wrong envelope rejection, same-ID conflict, original snapshot preservation and one-versus-zero synthetic Provider calls.
- A 429 yields one inner request and durable unknown with None usage; reopening the store/service and replaying does not resend. Trace expiry after connect/TLS prevents HTTP writes; expiry after headers prevents body writing and closes the stream.

## Independent audit of developer mutation evidence

This section is an independent inspection of the supplied injection source, execution JSON, logs and JUnit, not a second independent execution of the mutants. Their unmutated target cases passed in the 74-case independent run. mutation-audit.json includes per-case failure text and SHA256 identities for the inspected artifacts and injection/runner scripts.

| Mutation | Expected failure verified | Failed / passed |
| --- | --- | ---: |
| replay | Formal old-accepted PUT returns 503 instead of 200 after forbidden dispatch | 1 / 0 |
| ack | False, None and string true no longer raise ContractError | 3 / 0 |
| bytes | 32769-byte raw request no longer raises; 32768 control remains valid | 1 / 1 |
| usage-cap | Applying v1 result rules rejects legitimate v2 input usage 8193 | 1 / 3 |
| usage-zero | None usage becomes a zero-valued object and fails equality | 1 / 3 |
| validate | Changed prepared wire reaches the forbidden key-loader sentinel | 1 / 0 |
| final-write | Removing trace validation allows all three deadline cases to complete without expected ContractError | 3 / 0 |
| store-zero | Formal operation usage projection becomes zero instead of None | 1 / 0 |

All eight executions exited 1 with no timeout. Aggregate JUnit: 12 expected failures, 7 passing controls, 0 errors, 0 skipped. Failures were at intended behavioral checks, not missing plugins, network guards or imports. The usage-cap mutant tests incorrect v1-cap rejection, not numeric truncation. The store-zero mutant changes OperationStore.get's returned projection, not SQLite persisted data; its claim must remain correspondingly scoped.

## Limits and historical evidence

The large-wire case is a range check below 32768, not proof of an exact outbound 32768/32769 boundary. The raw JSON test covers ingress. Same-ID namespace collision uses AI1 as existing owner and AI3 as rejected contender; credentials are checked both ways. The 429 restart is service/store reconstruction, while separate tests cover formal-main restart. The trace cases use the shared AI1 transport with v2 on HTTP/1.1, not a separate AI3 or HTTP/2 trace matrix.

The original 288-pass/2-failure guard run, missing optional defusedxml startup diagnostic, historical five leader/plugin failures and 180-second timeout remain retained. The developer's subsequent 298-pass result is separate evidence and is not relabeled as this reviewer's execution. No total gate, true-counter qualification, live LMS-to-DeepTutor-to-DeepSeek path, device acceptance or deployment approval is closed. User acceptance remains pending.

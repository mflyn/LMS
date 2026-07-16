# 家庭成长跟踪测试策略

**Document status:** APPROVED
**Baseline candidate:** FGT-MVP-1.3
**Quality gate:** Task 5 completion gate

## 1. 目标

测试必须证明家庭隔离、孩子自访问、德智体美劳任务语义、家庭时区、状态机和 gateway 信任边界，而不只是证明路由返回成功。定向家庭测试全部通过才允许进入 Task 5；遗留全量失败必须与基线报告一致且没有新增回归。

## 2. 测试层级与责任

| Level | Owner | Required evidence |
| --- | --- | --- |
| Model/unit | owning service | validation, indexes, LocalDate/timezone helpers, token version and state transitions |
| Route contract | owning service | request/response schema, stable error codes, pagination, role and field authorization |
| Service integration | owning service | MongoDB-backed family isolation, stale token rejection, idempotency and transactions |
| Gateway integration | gateway/common auth | client identity-header stripping, signed envelope, freshness, nonce replay protection and route mapping |
| End-to-end | repository integration suite | parent creates family/child/tasks, child completes, parent confirms, report and reward flow |
| Security | gateway plus every family service | cross-family, sibling, forged familyId, forged identity headers, PIN brute force and stale token |

## 3. Deterministic Fixtures

Every family-domain integration suite uses:

- `familyA` with `parentA`, `childA1` and sibling `childA2`.
- `familyB` with `parentB` and `childB1`.
- Family timezone `Asia/Shanghai` unless the case explicitly changes it.
- A fixed clock, including cases immediately before and after Shanghai midnight.
- Dates covering Sunday, Monday and an inclusive Monday-Sunday range.
- Tokens for parentA, parentB, childA1 and a stale childA1 token version.

Tests must perform actual database ownership queries. A mocked helper alone cannot prove cross-family isolation.

## 4. Required Security Scenarios

| Scenario | Expected result |
| --- | --- |
| Parent A requests child B data | `403` stable access-denied code |
| Child A1 requests sibling A2 | `403` and no sibling data |
| Request supplies another familyId | server derives family and denies access |
| Client sends forged `x-user-*` through gateway | gateway removes and replaces headers |
| Direct downstream request sends forged identity | `401 INVALID_IDENTITY_ENVELOPE` |
| Identity signature is modified | `401 INVALID_IDENTITY_ENVELOPE` |
| Identity timestamp is older than five minutes | `401 INVALID_IDENTITY_ENVELOPE` |
| Identity nonce is replayed | first request allowed, replay rejected |
| PIN fails five times per IP/family/child | fifth failure causes 15-minute `429` lock |
| PIN is reset | old token version returns `401`; new login succeeds |

Any failure in gateway identity forgery, cross-family access, sibling access or stale-token rejection is a `BLOCKER`.

## 5. Contract and State Coverage

- Error responses use `success=false` and `error.code/message/details`.
- List responses use `items/page/pageSize/total`, with pageSize default 20 and maximum 100.
- GrowthTask accepts five dimensions and rejects `repeatRule`.
- GrowthTask transitions only through documented create, edit, complete, confirm, delete and archive rules.
- `today` and `week` derive from `Family.timezone`; week includes Monday through Sunday.
- Legacy school routes remain mounted and family UI does not expose them.

## 6. Verification Commands

```bash
npm test --prefix backend/services/user-service -- --runInBand __tests__/routes/family.test.js __tests__/routes/children.test.js
npm test --prefix backend/services/homework-service -- --runInBand __tests__/growthTasks.test.js
npm test --prefix backend/gateway -- --runInBand
npm run test:nocoverage
git diff --check
```

The first three targeted commands must pass after remediation. `npm run test:nocoverage` may retain only failures already classified in `docs/development/family-tracker-test-baseline.md`; new family-branch failures block approval.

## 7. Task 5 Test Scope

Task 5 adds these mandatory suites:

| Suite | Test file | Required evidence |
| --- | --- | --- |
| GrowthLog model/routes | `progress-service/__tests__/growthLogs.test.js` | five dimensions, LocalDate, field authorization, filters, pagination, family and sibling isolation |
| KnowledgePoint model/routes | `progress-service/__tests__/knowledgePoints.test.js` | conditional subject/area rules, uniqueness, mastery updates, filters and role isolation |
| Internal stars and ledger | `progress-service/__tests__/internalStars.test.js` | service credential, parent/family validation, first award, replay, concurrency and balance |
| Internal award client | `homework-service/__tests__/starAwardClient.test.js` | missing/short credential rejection, request header, payload, timeout and failure mapping |
| Rewards and transactions | `progress-service/__tests__/rewards.test.js` | creation, independent pagination, balance, transaction rollback, replay, key conflict and concurrent overspend prevention |
| Task confirmation saga | `homework-service/__tests__/growthTasks.test.js` | atomic pending transition, timeout, retry convergence, already-awarded replay and concurrent confirmation |
| Gateway exposure | `gateway/__tests__/familyTask5Routes.test.js` | three public prefixes proxied and internal prefix not exposed |
| Configuration | service startup suites | missing/short internal token fails before listen; valid token starts |

Every case is defined in `docs/development/family-growth-task5-test-cases.md`. Test names include their case ID so evidence can be extracted mechanically.

## 8. Task 5 Environment and Data

- All progress-service Task 5 suites use the same real `MongoMemoryReplSet` lifecycle. This preserves one connection while providing transaction capability.
- Reward transaction evidence must come from that replica set; a standalone-memory-server pass is not transaction evidence.
- The fixed fixture contains family A with parent A, child A1 and sibling A2, plus family B with parent B and child B1.
- Tests set `INTERNAL_SERVICE_TOKEN` to a 32-character minimum non-production value before importing Task 5 server modules.
- Tests use signed gateway identity headers for public routes. Raw `x-user-id` and `x-user-role` headers are not accepted as family-route authentication evidence.
- Each test cleans only collections it owns and never starts an extra Mongo server inside a suite that already uses the shared setup.

## 9. Task 5 Entry and Exit Criteria

Entry requires:

- Task 5 design status `APPROVED`.
- No open design BLOCKER or MAJOR finding.
- Numbered test cases map every Task 5 functional and non-functional requirement.
- The v1.2 regression baseline is recorded.

Exit requires:

- Every `TC-T5-*` case has an executable automated test and passes.
- Every new production function was introduced after a test failed for the expected missing behavior.
- Progress, homework, gateway, Task 3/4 regression and configuration suites pass.
- Reward concurrency tests prove two different redemptions cannot overspend one balance.
- The internal award route rejects missing, invalid and ordinary user credentials and is absent from gateway routing.
- Two consecutive `npm run test:family-regression` executions on the same commit exit 0 with identical totals.
- `npm run test:nocoverage` runs the isolated family regression before legacy projects and introduces no new family-branch failure relative to v1.2.
- `git diff --check` passes and generated test artifacts are absent.

## 10. Task 5 Verification Commands

```bash
npm test --prefix backend/services/progress-service -- --runInBand growthLogs knowledgePoints internalStars rewards
npm test --prefix backend/services/homework-service -- --runInBand growthTasks
npm test --prefix backend/services/homework-service -- --runInBand starAwardClient
npx jest --config backend/jest.config.js --selectProjects family-common progress-service --runInBand --coverage=false
npm test --prefix backend/gateway -- --runInBand familyTask5Routes
npm test --prefix backend/services/user-service -- --runInBand family children
npm run test:family-regression
npm run test:family-regression
npm run test:nocoverage
git diff --check
```

The first eight commands must exit 0. `npm run test:nocoverage` first reruns those family projects in an isolated serial process, then runs only `progress-legacy` and `legacy`; it may exit 1 only for failures already classified in the v1.2 legacy baseline. Both family stability runs, the isolated family phase inside the full command, legacy suite/test deltas, and process exit must be recorded.

## 11. Evidence Recording

For each Task 5 run, `docs/development/family-growth-task5-gate.md` records command, date, exit code, suite/test counts and relevant warning or failure IDs. Evidence from a previous commit is not sufficient after code changes; remediation requires fresh targeted and regression runs.

## 12. Mistake PDF and Multi-Attachment Increment

The [increment test design](./family-growth-mistake-pdf-multi-attachments-test-cases.md) extends this historical strategy for parent/child mistake attachment collections, task PDF attachments, and private-media PDF security.

The increment uses two independent gate paths:

- The merge and low-resource release path uses `trusted-local`. It must exercise the complete static media pipeline and prove that no scanner connection occurs and no malware-clean claim is stored.
- The secure-production path uses injected or fake scanner infrastructure for deterministic merge CI, plus a dedicated real-ClamAV smoke on a sufficiently sized runner before approving a secure-production release.
- Scanner unavailability, malformed protocol responses, or health failure are fail-closed only in `secure-production`; no test may model an automatic downgrade to `trusted-local`.
- The protected real-scanner command is `RUN_FAMILY_SECURITY_SCAN=1 npm run test:family-security-scan`. It is secure-production release evidence only when it exits zero on a sufficiently sized runner and is recorded against the candidate commit.

Historical Task 6 and Task 10 gates remain evidence for their original single-value/image-only boundaries. They do not satisfy the increment's `TC-MPA-*` cases.

## 13. Task 12 Second Parent Co-Management

The [Task 12 test design](./family-growth-task12-test-cases.md) extends the implemented v1.6
baseline with invitation, membership governance, and equal daily parent access. It does not reuse
single-parent route tests as evidence that a second parent can operate every service.

Task 12 uses four mandatory layers:

1. Model and route tests prove Family invariants, token hashing/redaction, stable errors, and
   owner-only governance.
2. Replica-set integration tests prove atomic acceptance, departure, removal, transfer, rollback,
   and concurrent single-winner behavior.
3. Cross-service regression proves that the second parent has ordinary access equal to the owner
   while unrelated and departed parents remain denied.
4. React and real Chromium tests prove invitation preservation through authentication, member
   controls, immediate permission changes, responsive layout, and accessible confirmation flows.

Task 12 release evidence cannot use an in-memory standalone MongoDB, mocked transaction helper,
retry, or only the owner route suite. The focused integration command must pass twice with identical
totals, followed by family regression, frontend CI/build, Task 11, documentation, generated-artifact,
and clean-worktree checks. The three Task 12 requirements remain `DESIGN_APPROVED` until all evidence
is recorded against one candidate commit.

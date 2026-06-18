# 家庭成长跟踪测试策略

**Document status:** IN_REVIEW
**Baseline candidate:** FGT-MVP-1
**Quality gate:** Task 4.5

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

## 7. Evidence Recording

For each run, `docs/development/family-growth-design-review.md` records command, date, exit code, suite/test counts and relevant warning or failure IDs. Evidence from a previous commit is not sufficient after code changes; remediation requires fresh targeted and regression runs.

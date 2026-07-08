# Family Growth Task 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver approved Task 5 growth logs, ability points, idempotent stars, and transactional family rewards with complete traceability and a final quality gate.

**Architecture:** `progress-service` owns all Task 5 collections and exposes three public route groups plus one service-authenticated internal award command. `homework-service` performs a recoverable confirmation saga; MongoDB replica-set transactions and a per-child guard serialize redemptions without storing balance.

**Tech Stack:** Node.js 18+, Express, Mongoose, Jest, Supertest, MongoMemoryReplSet, axios, signed gateway identity envelopes.

---

## File Map

**Create in progress-service:**

- `models/GrowthLog.js`: five-dimension LocalDate entries.
- `models/KnowledgePoint.js`: knowledge, skill, practice, and habit points.
- `models/StarLedgerEntry.js`: immutable earn/spend/adjust ledger.
- `models/StarLedgerGuard.js`: per-child transaction serialization version.
- `models/Reward.js`: reward lifecycle.
- `middleware/serviceCredential.js`: internal token validation.
- `services/growthAccess.js`: parent/child ownership resolution.
- `services/starLedgerService.js`: award, balance, and redemption transaction.
- `routes/growthLogs.js`, `routes/knowledgePoints.js`, `routes/rewards.js`, `routes/internalStars.js`: HTTP contracts.
- `__tests__/helpers/task5Fixtures.js`: two-family database fixtures and signed headers.
- `__tests__/growthLogs.test.js`, `knowledgePoints.test.js`, `internalStars.test.js`, `rewards.test.js`: numbered cases.

**Create in homework-service:**

- `services/starAwardClient.js`: bounded internal HTTP command.

**Modify:**

- `progress-service/server.js`, `config.js`, `package.json`, `__tests__/setup.js`, `__tests__/startup.test.js`.
- `homework-service/models/GrowthTask.js`, `routes/growthTasks.js`, `__tests__/growthTasks.test.js`.
- `gateway/server.js`; create `gateway/__tests__/familyTask5Routes.test.js`.
- `backend/common/config/index.js`, `backend/.env.example`, `docker-compose.yml`, `docker-compose.china.yml`.
- Task 5 traceability, review, baseline, and gate documents.

## Task 1: Transaction-capable Test Harness and Configuration

- [ ] **Step 1: Add failing startup cases `TC-T5-STAR-002`**

In `progress-service/__tests__/startup.test.js`, assert a config validator rejects missing/short tokens and accepts a 32-character token:

```js
expect(() => validateInternalServiceToken('')).toThrow('INTERNAL_SERVICE_TOKEN');
expect(() => validateInternalServiceToken('short')).toThrow('INTERNAL_SERVICE_TOKEN');
expect(validateInternalServiceToken('t'.repeat(32))).toBe('t'.repeat(32));
```

- [ ] **Step 2: Run RED**

```bash
npm test --prefix backend/services/progress-service -- --runInBand startup
```

Expected: FAIL because `validateInternalServiceToken` does not exist.

- [ ] **Step 3: Implement config validation and replica-set setup**

Export a pure validator from `progress-service/config.js` and set test configuration before module imports:

```js
const validateInternalServiceToken = (value) => {
  if (typeof value !== 'string' || value.length < 32) {
    throw new Error('INTERNAL_SERVICE_TOKEN must contain at least 32 characters');
  }
  return value;
};
```

Replace `MongoMemoryServer` with one `MongoMemoryReplSet` in `progress-service/__tests__/setup.js`; retain one lifecycle and collection cleanup. Update the service dev dependency to `mongodb-memory-server ^10.1.4`.

- [ ] **Step 4: Run GREEN and existing progress regression**

```bash
npm test --prefix backend/services/progress-service -- --runInBand startup server
```

Expected: PASS with no duplicate Mongo connection or open port.

- [ ] **Step 5: Review and commit harness**

Review token secrecy, import order, one Mongo lifecycle, and transaction capability. Fix all findings, then commit `test: prepare task five transaction harness`.

## Task 2: Task 5 Models

- [ ] **Step 1: Write model portions of `TC-T5-LOG-001/002`, `POINT-001/002/003`, `STAR-007`, and `REWARD-002`**

Tests instantiate actual models and call `validate()` or save against the replica set. Include this immutable-ledger assertion:

```js
const entry = await StarLedgerEntry.create(validEarn);
entry.amount = 99;
await expect(entry.save()).rejects.toMatchObject({ code: 'IMMUTABLE_LEDGER_ENTRY' });
```

- [ ] **Step 2: Run RED**

```bash
npm test --prefix backend/services/progress-service -- --runInBand growthLogs knowledgePoints internalStars rewards
```

Expected: FAIL because Task 5 models do not exist.

- [ ] **Step 3: Implement the five models**

Use the exact fields, enums, limits, defaults, compound indexes, and conditional subject/area validation from the approved design. `StarLedgerEntry` rejects document update/delete middleware with an error whose code is `IMMUTABLE_LEDGER_ENTRY`; collection cleanup may use `deleteMany` only in test setup before test assertions.

`StarLedgerGuard` schema is limited to:

```js
{ familyId: ObjectId, childId: ObjectId, version: { type: Number, default: 0 } }
```

with a unique `{ familyId: 1, childId: 1 }` index.

- [ ] **Step 4: Run GREEN**

Run the same targeted model cases and `git diff --check`; expected PASS.

- [ ] **Step 5: Review and commit models**

Review every requirement against schema paths and `schema.indexes()`. Fix discrepancies, then commit `feat: add task five progress models`.

## Task 3: Ownership Helper and Fixtures

- [ ] **Step 1: Add failing ownership cases used by `LOG-005/007`, `POINT-006`, and `REWARD-003`**

Create fixtures that persist both families and generate signed headers with `createIdentityHeaders`. Assert the wished-for API:

```js
await expect(resolveChildAccess(parentAIdentity, childA1.id)).resolves.toMatchObject({ familyId: familyA.id });
await expect(resolveChildAccess(parentBIdentity, childA1.id)).resolves.toBeNull();
await expect(resolveChildAccess(childA1Identity, childA2.id)).resolves.toBeNull();
```

- [ ] **Step 2: Run RED**

Expected: FAIL because `growthAccess.js` does not exist.

- [ ] **Step 3: Implement `resolveChildAccess` and `requireParentChild`**

Queries must validate ObjectIds and use `Family.ownerParentId/memberParentIds/childIds` plus `User.familyId`. Return server-derived `{ familyId, child }`; never trust request familyId.

- [ ] **Step 4: Run GREEN and review**

Run the helper-backed suites. Review sibling, cross-family, invalid-ID, and child-token behavior; fix all findings.

- [ ] **Step 5: Commit**

Commit `feat: add task five family access boundary`.

## Task 4: GrowthLog Routes

- [ ] **Step 1: Write all `TC-T5-LOG-*` route tests**

Use Supertest against the real progress app and signed parent/child headers. Each `test()` name begins with its case ID. Verify complete stable envelopes, stored ownership, allowed-field changes, forbidden fields, filters, inclusive ranges, and pagination.

- [ ] **Step 2: Run RED**

Expected: route 404 because `/api/growth-logs` is not mounted.

- [ ] **Step 3: Implement growth-log create/list/update routes**

Use allowlists:

```js
const CHILD_FIELDS = ['content', 'durationMinutes', 'amount', 'unit', 'completedTaskIds',
  'focusLevel', 'difficulty', 'physicalState', 'mood', 'childReflection'];
const PARENT_FIELDS = [...CHILD_FIELDS, 'date', 'dimension', 'area', 'subject', 'parentNote'];
```

Reject any forbidden submitted field rather than silently dropping it. Mount at `/api/growth-logs` before the final error handler.

- [ ] **Step 4: Run GREEN and refactor**

Run `growthLogs`; extract shared validation only after all cases pass.

- [ ] **Step 5: Review and commit**

Review database query predicates and response fields; commit `feat: add five-dimension growth logs` after all findings close.

## Task 5: KnowledgePoint Routes

- [ ] **Step 1: Write all `TC-T5-POINT-*` route tests and run RED**

Expected: `/api/knowledge-points` returns 404.

- [ ] **Step 2: Implement create/list/update**

Parents create/update; parent and child self list. Normalize missing `subject` and `area` to empty strings before save. Duplicate key maps to `409 RESOURCE_CONFLICT`. Update allowlist is exactly:

```js
['masteryLevel', 'practiceCount', 'mistakeCount', 'lastReviewedAt']
```

- [ ] **Step 3: Run GREEN**

Run `knowledgePoints`; expected all numbered cases PASS.

- [ ] **Step 4: Review and commit**

Review conditional validation, normalized uniqueness, filters, pagination, and authorization. Fix findings and commit `feat: add knowledge and ability points`.

## Task 6: Internal Award and Ledger Service

- [ ] **Step 1: Write `TC-T5-STAR-001` and `STAR-003` through `STAR-007`; run RED**

Expected: internal route 404 and missing service.

- [ ] **Step 2: Implement service credential middleware**

Compare SHA-256 digests so `timingSafeEqual` always receives equal-sized buffers:

```js
const digest = (value) => crypto.createHash('sha256').update(String(value || '')).digest();
const valid = crypto.timingSafeEqual(digest(req.get('x-service-token')), digest(expectedToken));
```

- [ ] **Step 3: Implement ledger service and internal route**

`awardTaskStar` creates one earn entry and handles duplicate-key races by reading the existing entry. Verify family, child and confirming parent before calling it. Return first/replay shape from the API contract.

- [ ] **Step 4: Run GREEN including concurrent award**

```bash
npm test --prefix backend/services/progress-service -- --runInBand internalStars
```

Expected: all STAR cases PASS and one ledger entry after concurrent requests.

- [ ] **Step 5: Review and commit**

Review credential bypass paths, token logging, unique indexes, race handling and balance sign calculation. Commit `feat: add idempotent internal star awards`.

## Task 7: Reward Routes and Transactions

- [ ] **Step 1: Write all `TC-T5-REWARD-*` tests; run RED**

Use failpoint dependency injection in `redeemReward` for `REWARD-010`, not a production test-only route. For `REWARD-011`, seed a balance that funds only one reward and submit both requests with distinct keys concurrently.

- [ ] **Step 2: Implement create/list behavior**

Return balance plus independent `rewards` and `ledger` pagination objects.

- [ ] **Step 3: Implement serialized redemption transaction**

Inside `session.withTransaction`, increment `StarLedgerGuard.version`, check idempotency ownership, aggregate balance with session, create spend, and conditionally redeem. Convert domain errors to the approved stable codes.

- [ ] **Step 4: Run GREEN and repeat concurrency case**

```bash
npm test --prefix backend/services/progress-service -- --runInBand rewards
npm test --prefix backend/services/progress-service -- --runInBand rewards -t TC-T5-REWARD-011
```

Expected: PASS on both runs; final balance never negative.

- [ ] **Step 5: Review and commit**

Review transaction session propagation on every read/write, guard write ordering, idempotency collision semantics, and rollback evidence. Commit `feat: add transactional family rewards`.

## Task 8: GrowthTask Confirmation Saga

- [ ] **Step 1: Write homework client part of `TC-T5-STAR-002` and run RED**

In `homework-service/__tests__/starAwardClient.test.js`, require missing/short tokens to fail before axios is called, then verify a valid client sends the exact payload, `x-service-token`, and timeout. Expected RED: client module missing.

- [ ] **Step 2: Implement and verify the focused HTTP client**

Implement `starAwardClient.js` with pure config validation and injected axios instance. Run `npm test --prefix backend/services/homework-service -- --runInBand starAwardClient`; expected PASS.

- [ ] **Step 3: Write `TC-T5-SAGA-001` through `SAGA-006`; run RED**

Inject a `starAwardClient` into a router factory so tests can model success, timeout and replay without a test-only production branch.

- [ ] **Step 4: Add GrowthTask state**

Add required `starAwardState` default `not_applicable` and expose it in task responses. The client maps every outbound failure to a typed pending error.

- [ ] **Step 5: Implement the confirmation state table**

Use conditional `findOneAndUpdate` for first confirmation, re-read on a lost race, retry only confirmed/pending, and return confirmed/awarded without another internal call. Never overwrite original feedback or timestamp on retry.

- [ ] **Step 6: Run GREEN plus Task 4 regression**

```bash
npm test --prefix backend/services/homework-service -- --runInBand growthTasks
```

Expected: Task 4 and all SAGA cases PASS.

- [ ] **Step 7: Review and commit**

Review every state/race/error transition and HTTP timeout. Fix all findings and commit `feat: award stars through recoverable task confirmation`.

## Task 9: Gateway and Deployment Wiring

- [ ] **Step 1: Write `TC-T5-GW-001/002`; run RED**

Mock progress proxy target and assert exact forwarded prefixes. Assert no `/api/internal` proxy registration.

- [ ] **Step 2: Wire public routes only**

Mount authenticated proxies for `/api/growth-logs`, `/api/knowledge-points`, and `/api/rewards`. Do not add any internal prefix.

- [ ] **Step 3: Add configuration examples**

Add `INTERNAL_SERVICE_TOKEN=${INTERNAL_SERVICE_TOKEN}` to homework/progress Compose environments and document a non-secret local example in `backend/.env.example`. Validate the same token reaches both services.

- [ ] **Step 4: Run GREEN and Compose validation**

```bash
npm test --prefix backend/gateway -- --runInBand familyTask5Routes
INTERNAL_SERVICE_TOKEN=test-internal-service-token-32-bytes docker compose config -q
INTERNAL_SERVICE_TOKEN=test-internal-service-token-32-bytes docker compose -f docker-compose.china.yml config -q
```

- [ ] **Step 5: Review and commit**

Review that ordinary JWT cannot reach internal award and no secret value is committed. Commit `feat: expose task five public routes`.

## Task 10: Traceability, Code Review, and Final Gate

- [ ] **Step 1: Update every Task 5 trace row**

Replace planned owners/evidence with exact model, route, service, and `TC-T5-*` references. Use `COVERED` only after named tests pass.

- [ ] **Step 2: Perform requirement and code review**

Review the complete diff for correctness, security, transactions, compatibility, error contracts, test quality and configuration. Record every finding in a Task 5 implementation review; close all BLOCKER, MAJOR and MINOR findings before continuing.

- [ ] **Step 3: Run the final gate commands**

Run every command from test strategy section 10, record exact exit codes/counts, compare full regression with v1.2, clean generated files, and rerun `git diff --check`.

- [ ] **Step 4: Freeze Task 5 baseline**

Create a manifest with candidate commit and SHA-256 hashes for PRD, architecture, detailed design, API, test strategy, test cases, traceability, implementation review, and gate evidence. Tag a new immutable `family-growth-baseline-v1.3` only after product-owner gate approval.

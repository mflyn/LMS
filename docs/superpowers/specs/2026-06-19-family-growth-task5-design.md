# Family Growth Task 5 Design

**Document status:** APPROVED
**Baseline candidate:** FGT-MVP-1.3
**Scope:** Growth logs, knowledge and ability points, stars, and rewards
**Requirements:** `FR-LOG-001`, `FR-POINT-001`, `FR-REWARD-001`, `FR-REWARD-002`, `NFR-SEC-001`, `NFR-SEC-003`, `NFR-DATA-001`, `NFR-DATA-002`, `NFR-TIME-001`

## 1. Objective and Scope

Task 5 adds the remaining progress-domain capabilities required before mistakes and weekly reports can be implemented:

- A parent or the child can record five-dimension daily growth evidence.
- A parent can maintain academic knowledge points and moral, physical, artistic, and labor ability points.
- The first successful parent confirmation of a completed task awards exactly one star.
- A parent can create and redeem family rewards without duplicate awards or duplicate spending.

Task 5 does not add badges, repeat templates, background jobs, AI analysis, school points, or a separately mutable star balance.

## 2. Chosen Architecture

`progress-service` remains the sole writer for `GrowthLog`, `KnowledgePoint`, `StarLedgerEntry`, and `Reward`. Public growth-log, knowledge-point, and reward routes are exposed through the gateway. The star-award command is service-internal and is never proxied by the gateway.

`homework-service` owns `GrowthTask` and performs a small recoverable saga when a parent confirms a task. It calls `progress-service` through a focused `starAwardClient`. The internal command authenticates with a dedicated shared service token of at least 32 characters. The token is independent of JWT and gateway identity secrets, is compared with `crypto.timingSafeEqual`, and is never logged.

Alternatives rejected:

- Writing stars from `homework-service` would violate collection ownership and make a later database split unsafe.
- Reusing the gateway identity envelope would conflate user and service identity.
- RabbitMQ/outbox delivery provides stronger asynchronous guarantees but adds infrastructure beyond this MVP. The pending state and idempotent HTTP retry provide the required recoverability.

## 3. Component Boundaries

| Component | Responsibility | Dependencies |
| --- | --- | --- |
| `growthAccess.js` | Resolve parent/child ownership and field permissions | `Family`, `User`, authenticated identity |
| `GrowthLog.js` | Persist one five-dimension record for a child and LocalDate | Mongoose, LocalDate validator |
| `KnowledgePoint.js` | Persist a knowledge, skill, practice, or habit point | Mongoose |
| `StarLedgerEntry.js` | Persist immutable earn/spend/adjust entries | Mongoose session |
| `StarLedgerGuard.js` | Serialize balance-changing transactions per child without storing balance | Mongoose session |
| `Reward.js` | Persist a family reward and redemption state | Mongoose session |
| `growthLogs.js` | Create, list, and role-scoped update operations | access helper, `GrowthLog` |
| `knowledgePoints.js` | Parent create/update and parent/child read operations | access helper, `KnowledgePoint` |
| `rewards.js` | Parent create/redeem and parent/child balance read operations | access helper, ledger/reward services |
| `internalStars.js` | Authenticated idempotent star-award command | service credential middleware, ledger service |
| `starLedgerService.js` | Award, calculate balance, and redeem in a transaction | ledger, guard, reward, Mongoose session |
| `starAwardClient.js` | Call the internal award command with timeout and service token | axios |

Route modules do HTTP validation and response mapping. Transaction and idempotency rules live in `starLedgerService.js`; they are not duplicated in route handlers.

## 4. Data Design

All child-owned documents contain both `familyId` and `childId`. Every list and mutation query starts with both fields after server-side ownership resolution. Each `GrowthLog` is one entry; multiple entries for the same date and dimension are allowed.

### 4.1 GrowthLog

| Field | Type | Constraint |
| --- | --- | --- |
| `familyId`, `childId` | ObjectId | required |
| `date` | String | required valid `YYYY-MM-DD` LocalDate |
| `dimension` | String | required `moral|academic|physical|artistic|labor` |
| `area`, `subject`, `content` | String | trimmed; content required, max 1000 |
| `durationMinutes`, `amount` | Number | optional, minimum 0 |
| `unit` | String | trimmed, max 30 |
| `completedTaskIds` | ObjectId[] | default empty |
| `focusLevel` | String | `good|normal|distracted` |
| `difficulty` | String | `easy|normal|hard` |
| `physicalState` | String | `energetic|normal|tired|unwell` |
| `mood` | String | `happy|calm|resistant|anxious` |
| `childReflection`, `parentNote` | String | trimmed, max 500, default empty |
| `createdBy`, `updatedBy` | ObjectId | required |

Indexes:

```text
{ familyId: 1, childId: 1, date: -1 }
{ familyId: 1, childId: 1, dimension: 1, date: -1 }
```

Parents may set every mutable field. Children may set content, durationMinutes, amount, unit, completedTaskIds, focusLevel, difficulty, physicalState, mood, and childReflection, but never `parentNote`, ownership fields, or audit fields.

`completedTaskIds` are optional opaque references. The service validates ObjectId syntax but does not dereference them or use them for authorization, star awards, or report totals. Task 6 aggregation reads authoritative tasks instead of trusting this field.

### 4.2 KnowledgePoint

| Field | Type | Constraint |
| --- | --- | --- |
| `familyId`, `childId` | ObjectId | required |
| `dimension` | String | required five-dimension enum |
| `subject`, `area` | String | trimmed, default empty; academic requires subject, non-academic requires area |
| `name` | String | required, trimmed, max 100 |
| `masteryLevel` | String | `not_started|learning|basic|skilled|needs_review`, default `not_started` |
| `practiceCount`, `mistakeCount` | Number | integer, minimum 0, default 0 |
| `lastReviewedAt` | Date | optional UTC event time |
| `createdByParentId`, `updatedByParentId` | ObjectId | required |

Unique index:

```text
{ familyId: 1, childId: 1, dimension: 1, subject: 1, area: 1, name: 1 }
```

Only parents create or update points. Children may list their own points.

### 4.3 StarLedgerEntry

| Field | Type | Constraint |
| --- | --- | --- |
| `familyId`, `childId` | ObjectId | required |
| `type` | String | `earn|spend|adjust` |
| `amount` | Number | required positive integer |
| `sourceType` | String | `task_confirmation|reward_redemption|parent_adjustment` |
| `sourceId` | String | required, max 128 |
| `idempotencyKey` | String | optional for earn; required for redemption |
| `createdBy` | String | parent ObjectId string or service name |
| `createdAt` | Date | immutable timestamp |

Unique indexes:

```text
{ familyId: 1, childId: 1, sourceType: 1, sourceId: 1, type: 1 }
{ familyId: 1, childId: 1, idempotencyKey: 1 } partial where idempotencyKey exists
```

Ledger documents are immutable. No update or delete route exists. Balance is `sum(earn + adjust) - sum(spend)` and is never stored separately.

### 4.4 StarLedgerGuard

`StarLedgerGuard` contains only `familyId`, `childId`, and an integer `version`; it never stores balance. A unique `{ familyId, childId }` index creates one serialization record per child. Every redemption transaction increments `version` before reading balance. Concurrent redemptions therefore conflict on the same document instead of allowing write-skew overspending.

### 4.5 Reward

| Field | Type | Constraint |
| --- | --- | --- |
| `familyId`, `childId` | ObjectId | required |
| `title` | String | required, trimmed, max 100 |
| `requiredStars` | Number | required positive integer |
| `status` | String | `active|redeemed|disabled`, default `active` |
| `createdByParentId` | ObjectId | required |
| `redeemedAt`, `redeemedByParentId` | Date/ObjectId | set together on redemption |

Indexes:

```text
{ familyId: 1, childId: 1, status: 1, createdAt: -1 }
```

## 5. Public API Behavior

All lists use `page` and `pageSize`; defaults are 1 and 20, maximum is 100.

| Method and path | Actor | Behavior |
| --- | --- | --- |
| `POST /api/growth-logs` | parent or child self | create a role-authorized record |
| `GET /api/growth-logs` | parent or child self | filter by child, date range, and dimension |
| `PATCH /api/growth-logs/:logId` | parent or child self | update only role-authorized fields |
| `POST /api/knowledge-points` | parent | create a point |
| `GET /api/knowledge-points` | parent or child self | filter by dimension, subject, area, mastery |
| `PATCH /api/knowledge-points/:id` | parent | update mastery and counters |
| `POST /api/rewards` | parent | create an active reward |
| `GET /api/rewards` | parent or child self | return balance plus independently paginated rewards and ledger |
| `PATCH /api/rewards/:id/redeem` | parent | atomically redeem using idempotency key |

`familyId` is never accepted as an authorization source. For a child token, the effective child ID is always the authenticated child. A child supplying another `childId` receives `403 CHILD_ACCESS_DENIED`.

## 6. Internal Award Command

`POST /api/internal/stars/award` accepts:

```json
{
  "familyId": "...",
  "childId": "...",
  "taskId": "...",
  "confirmedByParentId": "..."
}
```

The request must include `x-service-token`. Missing or invalid credentials return `401 INVALID_SERVICE_CREDENTIAL`. Authentication compares SHA-256 digests with `crypto.timingSafeEqual`, ensuring equal-length comparison buffers. The command validates all ObjectIds, verifies the child belongs to the family, and verifies `confirmedByParentId` is an owner or member parent of that family. It then creates one earn entry with `sourceType=task_confirmation`, `sourceId=taskId`, `amount=1`, and `createdBy=homework-service`. Duplicate-key races are read back and returned as the original success.

Successful first and repeated requests both return `200` with `awarded`, `ledgerEntryId`, and current `starBalance`; repeated requests set `awarded=false`.

## 7. Task Confirmation Saga

`GrowthTask.starAwardState` is required with values `not_applicable|pending|awarded`, default `not_applicable`.

| Current state | Confirm result |
| --- | --- |
| `completed + not_applicable` | atomically set confirmed fields and `pending`, then call award |
| `confirmed + pending` | do not modify confirmation fields; retry award |
| `confirmed + awarded` | return existing task successfully without another call |
| any other state | `409 TASK_STATE_CONFLICT` |

The first state transition uses `findOneAndUpdate` with the current state in the predicate so concurrent confirmations have one winner. After a successful award, a second conditional update changes `pending` to `awarded`. If the internal request times out, returns a non-success response, or the final task update fails, the route returns `503 STAR_AWARD_PENDING`. Because the ledger command and final update are idempotent, a retry converges to `awarded` without a duplicate earn.

If the initial conditional update loses a race, the handler re-reads the task and applies the table above; it never reports a generic server error for an expected concurrent confirmation.

The award client uses `PROGRESS_SERVICE_URL`, `INTERNAL_SERVICE_TOKEN`, and a 3000 ms timeout. It never retries inside one HTTP request; retry belongs to a later confirm command so request latency remains bounded.

## 8. Reward Redemption Transaction

Redemption requires a non-empty `Idempotency-Key` header of at most 128 characters. Within one MongoDB transaction:

1. Read reward by `familyId + childId + rewardId`.
2. If an entry with the idempotency key exists for this reward, return the stored successful result; if it belongs to another operation, return `409 IDEMPOTENCY_KEY_REUSED`.
3. Upsert and increment the child's `StarLedgerGuard.version` to serialize balance-changing transactions. The first concurrent upsert may produce `E11000` on the unique family/child index; classify it as a retryable serialization race and restart the transaction, never return a generic 500.
4. Require reward status `active`.
5. Aggregate the child ledger balance in the same session.
6. If balance is insufficient, abort with `409 INSUFFICIENT_STARS` and write nothing.
7. Create one spend entry using the reward ID as source ID and the request idempotency key.
8. Conditionally update the reward from active to redeemed.

The transaction runner retries explicitly labeled transient transaction failures up to three times. The deployment MongoDB must be a replica set because standalone MongoDB does not support transactions. Task 5 integration tests use `MongoMemoryReplSet`. Startup does not silently downgrade to non-transactional redemption.

## 9. Errors and Observability

| Condition | Status/code |
| --- | --- |
| invalid input or pagination | `400 VALIDATION_ERROR` |
| invalid internal token | `401 INVALID_SERVICE_CREDENTIAL` |
| wrong family, sibling, or disallowed role | `403 CHILD_ACCESS_DENIED` |
| role attempts a forbidden field update | `403 FIELD_ACCESS_DENIED` |
| missing record | `404 RESOURCE_NOT_FOUND` |
| duplicate point | `409 RESOURCE_CONFLICT` |
| idempotency key used for another operation | `409 IDEMPOTENCY_KEY_REUSED` |
| invalid reward/task state | `409 REWARD_STATE_CONFLICT` / `TASK_STATE_CONFLICT` |
| insufficient stars | `409 INSUFFICIENT_STARS` |
| pending star award | `503 STAR_AWARD_PENDING` |

Logs include requestId, familyId, childId, taskId or rewardId, operation, result, and duration. Logs never include service tokens or full request headers. Award and redemption logs distinguish first execution from idempotent replay.

## 10. Configuration and Rollback

Required production variables:

- `INTERNAL_SERVICE_TOKEN`: shared by homework-service and progress-service, at least 32 characters.
- `PROGRESS_SERVICE_URL`: internal base URL used by homework-service.
- `STAR_AWARD_TIMEOUT_MS`: optional positive integer, default 3000.
- `MONGO_URI`: must select replica set `rs0` (or the production replica-set name) and use majority write concern for ledger transactions.

Both services fail startup when Task 5 routes are enabled and the internal token is absent or too short. Docker Compose examples provide the same token through environment substitution, not a committed production secret.

Repository deployment manifests are part of the Task 5 gate:

- Root and China Compose files start MongoDB with `--replSet rs0 --bind_ip_all`, run an idempotent one-shot `rs.initiate()` initializer, wait for primary readiness, and connect every service with `replicaSet=rs0`.
- Kubernetes uses a single-replica StatefulSet with stable DNS for the MVP, an idempotent initialization Job, readiness based on `db.hello().isWritablePrimary`, and service connection strings with `replicaSet=rs0`.
- The legacy monolithic deployment Compose must either use the same replica-set contract or be explicitly documented as not supporting Task 5 rewards; it may not appear as a supported family-growth deployment while using standalone MongoDB.
- Production must use a managed or multi-member replica set. The single-node layouts are only for local demo and non-HA staging.

Rollback disables the three public gateway routes and the internal award client. Existing logs, points, rewards, and ledger entries are retained. An already confirmed task with `starAwardState=pending` remains recoverable when Task 5 is re-enabled.

## 11. Verification Design

Task 5 must provide model, route, integration, gateway, and saga tests. Tests use two families and sibling children; all authorization tests query real MongoDB documents. Transaction tests run on `MongoMemoryReplSet`. The final gate requires:

- Every Task 5 numbered test case mapped to a requirement and executable test.
- Progress and homework targeted suites passing.
- Gateway route exposure tests passing, including proof that the internal route is absent.
- Task 3/4 family regression passing.
- Exact `npm run test:nocoverage` result compared with the v1.2 legacy baseline, with no new family-branch failure.
- `git diff --check` passing and no generated test artifacts left in the worktree.

## 12. Acceptance Decision

The design is ready for implementation planning only after review finds no open BLOCKER or MAJOR issue, the API contract contains every public and internal operation above, the test strategy defines Task 5 entry/exit criteria, and the traceability matrix maps every Task 5 requirement to numbered test cases.

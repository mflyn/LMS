# Family Growth Task 3/4 Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every BLOCKER, MAJOR, and MINOR finding from the Task 3/4 design-baseline review without starting Task 5 domain work.

**Architecture:** Add one shared gateway identity-envelope module used by gateway and downstream middleware, then bring family/child and GrowthTask routes into the approved API/data contracts. Tests use signed gateway headers and database-backed ownership fixtures; each remediation group is committed separately.

**Tech Stack:** Node.js, Express, Mongoose, JWT, HMAC-SHA256, Jest, Supertest, MongoDB Memory Server

---

## Task 1: Signed Gateway Identity Envelope

**Findings:** `FGT-GW-001`, `FGT-GW-002`, `FGT-GW-003`, `FGT-GW-004`

**Files:**
- Create: `backend/common/middleware/gatewayIdentity.js`
- Create: `backend/common/middleware/__tests__/gatewayIdentity.test.js`
- Create: `backend/gateway/__tests__/identityEnvelope.test.js`
- Modify: `backend/common/middleware/auth.js`
- Modify: `backend/gateway/server.js`
- Modify: `backend/gateway/simple-server.js`
- Modify: `backend/gateway/package.json`

- [ ] **Step 1: Add failing common envelope tests**

Tests must assert:

```javascript
expect(stripClientIdentityHeaders(headers)).not.toHaveProperty('x-user-id');
expect(verifyIdentityEnvelope(validHeaders, request)).toMatchObject({ id: parentId, role: 'parent' });
expect(() => verifyIdentityEnvelope(tamperedHeaders, request)).toThrow('INVALID_IDENTITY_ENVELOPE');
expect(() => verifyIdentityEnvelope(expiredHeaders, request)).toThrow('INVALID_IDENTITY_ENVELOPE');
verifyIdentityEnvelope(validHeaders, request);
expect(() => verifyIdentityEnvelope(validHeaders, request)).toThrow('IDENTITY_ENVELOPE_REPLAYED');
```

Run:

```bash
npm test --prefix backend/gateway -- --runInBand identityEnvelope
npm test -- --runInBand backend/common/middleware/__tests__/gatewayIdentity.test.js
```

Expected: RED because the module and gateway test surface do not exist.

- [ ] **Step 2: Implement the canonical envelope**

Export these functions and constants from `gatewayIdentity.js`:

```javascript
const IDENTITY_HEADERS = [
  'x-user-id', 'x-user-role', 'x-user-name', 'x-user-family-id',
  'x-user-child-id', 'x-user-token-version', 'x-gateway-timestamp',
  'x-gateway-nonce', 'x-gateway-signature'
];

stripClientIdentityHeaders(headers);
normalizeRequestTarget(originalUrl);
createIdentityHeaders({ method, originalUrl, user, secret, now, nonce });
verifyIdentityEnvelope({ method, originalUrl, headers, secret, now, nonceStore });
resetIdentityNonceStore();
```

Use `crypto.createHmac('sha256', secret)` and `crypto.timingSafeEqual`. Canonical fields are uppercase method, normalized pathname plus sorted query, id, role, familyId, childId, tokenVersion, timestamp and nonce separated by newlines. Reject secrets shorter than 32 characters, timestamps outside 300 seconds, missing fields, malformed signatures and reused nonce.

- [ ] **Step 3: Integrate gateway and downstream middleware**

`server.js` must strip identity/internal headers before public and authenticated routes, verify JWT, then attach signed headers. Export `app`, `authenticateToken`, and `startServer`; call `startServer()` only under `require.main === module`.

`authenticateGateway` must verify the envelope before setting `req.user`. It must include familyId, childId and tokenVersion in `req.user` when present. Raw x-user headers without a valid envelope return `401 INVALID_IDENTITY_ENVELOPE`.

`simple-server.js` must delegate to the exported production `startServer` and contain no separate authentication or proxy rules.

- [ ] **Step 4: Run GREEN and regression tests**

```bash
npm test --prefix backend/gateway -- --runInBand identityEnvelope
npm test -- --runInBand backend/common/middleware/__tests__/gatewayIdentity.test.js
node --check backend/common/middleware/gatewayIdentity.js
node --check backend/gateway/server.js
```

Expected: envelope tests pass and syntax checks exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/common/middleware/gatewayIdentity.js backend/common/middleware/__tests__/gatewayIdentity.test.js backend/common/middleware/auth.js backend/gateway
git commit -m "fix: authenticate gateway identity envelopes"
```

## Task 2: Family Timezone and Child PIN Security

**Findings:** `FGT-T3-001` through `FGT-T3-006`

**Files:**
- Create: `backend/common/utils/familyDate.js`
- Create: `backend/common/utils/familyResponse.js`
- Modify: `backend/common/models/Family.js`
- Modify: `backend/common/models/User.js`
- Modify: `backend/common/middleware/auth.js`
- Modify: `backend/services/user-service/controllers/familyController.js`
- Modify: `backend/services/user-service/__tests__/routes/family.test.js`
- Modify: `backend/services/user-service/__tests__/routes/children.test.js`

- [ ] **Step 1: Add signed-header test helpers and failing family tests**

Replace raw x-user test headers with `createIdentityHeaders`. Add tests for:

```text
family defaults timezone to Asia/Shanghai and accepts America/New_York
invalid IANA timezone returns 400 VALIDATION_ERROR
PIN rejects 3 and 7 digits and accepts 4 and 6
fifth failed PIN attempt returns 429 PIN_LOGIN_RATE_LIMITED
successful login clears failed attempts
child token claims include familyId, childId and tokenVersion and expire within 12 hours
PIN reset increments tokenVersion and stale child token is rejected
errors use error.code/message/details
children list returns items/page/pageSize/total and caps pageSize at 100
```

Run the two targeted suites and confirm RED on the new assertions.

- [ ] **Step 2: Implement family date and response helpers**

`familyDate.js` exports `isValidTimeZone`, `formatLocalDate`, `addLocalDateDays`, and `getWeekRange`. Use `Intl.DateTimeFormat` for timezone conversion and UTC arithmetic only after a LocalDate string exists.

`familyResponse.js` exports:

```javascript
sendFamilyError(res, status, code, message, details = []);
parsePagination(query); // page >= 1, pageSize 1..100, defaults 1/20
```

- [ ] **Step 3: Implement timezone, PIN and token rules**

Add `Family.timezone` with default and validator. Add `childProfile.tokenVersion` default 0. PIN reset uses `$inc` semantics or a saved increment so every reset invalidates old tokens.

Implement an in-process PIN failure store keyed by `ip|familyId|childId`, with five failures and 15-minute lock for MVP. Invalid family, child or PIN always returns the same `401 INVALID_CHILD_CREDENTIALS`; locked attempts return `429 PIN_LOGIN_RATE_LIMITED`.

Extend `generateToken` to accept an explicit expiry without changing existing callers. Child login uses `12h` and includes id, childId, familyId, role and tokenVersion. Signed downstream authentication loads a child by ID and rejects version mismatch with `401 STALE_CHILD_TOKEN`.

- [ ] **Step 4: Run GREEN and commit**

```bash
npm test --prefix backend/services/user-service -- --runInBand __tests__/routes/family.test.js __tests__/routes/children.test.js
node --check backend/services/user-service/controllers/familyController.js
```

Expected: all family/children tests pass.

```bash
git add backend/common/models backend/common/middleware/auth.js backend/common/utils backend/services/user-service
git commit -m "fix: enforce family and child security contracts"
```

## Task 3: GrowthTask Date, Contract and Ownership

**Findings:** `FGT-T4-001` through `FGT-T4-006`

**Files:**
- Modify: `backend/services/homework-service/models/GrowthTask.js`
- Modify: `backend/services/homework-service/routes/growthTasks.js`
- Modify: `backend/services/homework-service/__tests__/growthTasks.test.js`

- [ ] **Step 1: Add failing GrowthTask contract tests**

Use signed gateway headers and add tests for:

```text
dueDate persists and returns YYYY-MM-DD
today uses Asia/Shanghai across UTC midnight
week includes Monday and Sunday and excludes adjacent dates
create and edit repeatRule return 400 REPEAT_RULE_NOT_SUPPORTED
invalid status returns 400 VALIDATION_ERROR
page/pageSize defaults and pageSize cap
stable error structure
cross-family list, detail, edit, complete, confirm and delete all return 403
pending delete removes; completed and confirmed delete archives
```

Run `npm test --prefix backend/services/homework-service -- --runInBand __tests__/growthTasks.test.js` and confirm RED.

- [ ] **Step 2: Implement LocalDate and schema/index changes**

Change dueDate to a validated `YYYY-MM-DD` String. Remove repeatRule. Replace the second compound index with `{ familyId: 1, childId: 1, dimension: 1, status: 1 }`.

Use `Family.timezone` plus `formatLocalDate/getWeekRange` for scope filters. Since LocalDate strings sort chronologically, query inclusive start/end with `$gte/$lte`.

- [ ] **Step 3: Implement route contract**

Use `sendFamilyError` and `parsePagination`. Validate dimension and status enums. Reject repeatRule before create/edit. Apply `skip/limit`, return total count and preserve familyId+childId in every query or access check.

- [ ] **Step 4: Run GREEN and commit**

```bash
npm test --prefix backend/services/homework-service -- --runInBand __tests__/growthTasks.test.js
node --check backend/services/homework-service/models/GrowthTask.js
node --check backend/services/homework-service/routes/growthTasks.js
```

```bash
git add backend/services/homework-service
git commit -m "fix: align growth tasks with family contracts"
```

## Task 4: Duplicate Index Cleanup

**Findings:** `FGT-T3-007`

**Files:**
- Modify: `backend/common/models/User.js`
- Modify: `backend/common/models/Family.js`
- Inspect: any model named by fresh Mongoose duplicate-index warnings

- [ ] **Step 1: Capture warnings**

Run the user-service targeted tests and record duplicate-index warnings. For a field using `unique: true` or `index: true`, remove the equivalent `schema.index()` declaration; retain compound indexes and one unique declaration.

- [ ] **Step 2: Verify uniqueness and warning removal**

```bash
npm test --prefix backend/services/user-service -- --runInBand __tests__/routes/family.test.js __tests__/routes/children.test.js 2>&1 | tee /tmp/family-user-tests.log
! rg "Duplicate schema index" /tmp/family-user-tests.log
```

Expected: tests pass and no duplicate schema-index warning remains.

- [ ] **Step 3: Commit**

```bash
git add backend/common/models/User.js backend/common/models/Family.js
git commit -m "chore: remove duplicate family model indexes"
```

## Task 5: Close Findings and Verify the Gate

**Files:**
- Modify: `docs/development/family-growth-design-review.md`
- Modify: `docs/development/family-growth-requirement-traceability.md`
- Modify: `docs/development/family-growth-baseline-manifest.md`
- Modify: `docs/superpowers/plans/2026-06-17-family-learning-tracker-transition.md`

- [ ] **Step 1: Run complete remediation verification**

```bash
npm test --prefix backend/gateway -- --runInBand identityEnvelope
npm test -- --runInBand backend/common/middleware/__tests__/gatewayIdentity.test.js
npm test --prefix backend/services/user-service -- --runInBand __tests__/routes/family.test.js __tests__/routes/children.test.js
npm test --prefix backend/services/homework-service -- --runInBand __tests__/growthTasks.test.js
git diff --check
```

- [ ] **Step 2: Close only proven findings**

For each finding, replace OPEN with CLOSED only when a named passing test or direct code check proves the disposition. Update Task 3/4 trace rows to COVERED and record suite/test counts. Keep any unproven item open and Task 5 blocked.

- [ ] **Step 3: Commit review closure**

```bash
git add docs/development/family-growth-design-review.md docs/development/family-growth-requirement-traceability.md docs/development/family-growth-baseline-manifest.md docs/superpowers/plans/2026-06-17-family-learning-tracker-transition.md
git commit -m "docs: close family tracker design findings"
```

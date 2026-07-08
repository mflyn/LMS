# Family Growth Design Baseline Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可签署的家庭成长跟踪设计基线，完成 Task 3/4 的需求到代码和测试追溯审查，并在进入 Task 5 前给出明确的通过或整改结论。

**Architecture:** 以产品需求、架构设计和 API 契约为三个受控基线，使用 ADR 固化关键取舍，使用追踪矩阵连接需求、接口、代码和测试。评审阶段只提交文档和审查证据；发现的代码差异进入单独的 TDD 整改计划，避免将设计批准与实现变更混在同一提交。

**Tech Stack:** Markdown、Git、Node.js、Express、Mongoose、Jest、Supertest、`rg`、`git diff --check`

---

## Execution Rules

- Work only in `/Users/linmingfeng/.config/superpowers/worktrees/LMS/family-growth-tracker` on branch `codex/family-growth-tracker`.
- Preserve the existing uncommitted changes in the product, architecture, API, and transition-plan documents; review and incorporate them instead of reverting them.
- Keep Task 5 frozen throughout this plan.
- Product, architecture, and API documents start this plan as `IN_REVIEW`. Their authoritative status is recorded in the baseline manifest; only designated approvers can approve them.
- A documentation commit must not contain backend code. A later remediation plan must use TDD and separate code commits.
- Do not mark the gate `APPROVED` while any `BLOCKER` or `MAJOR` Task 3/4 finding remains open.

## Controlled File Map

| File | Responsibility |
| --- | --- |
| `docs/product/family-learning-tracker.md` | Product scope, numbered requirements, acceptance criteria, MVP exclusions |
| `docs/architecture/family-learning-tracker-architecture.md` | Service boundaries, data ownership, models, state machines, authorization, time and failure semantics |
| `docs/api/family-learning-tracker-api.md` | Public endpoint and error contract, role rules, pagination, idempotency and examples |
| `docs/architecture/decisions/0001-reuse-existing-services.md` | Reuse existing services and shared MongoDB during MVP |
| `docs/architecture/decisions/0002-family-data-isolation.md` | Derive family scope from authenticated identity and resource ownership |
| `docs/architecture/decisions/0003-family-local-date.md` | Family timezone and LocalDate semantics |
| `docs/architecture/decisions/0004-single-occurrence-growth-tasks.md` | Defer repeat templates and model one task as one occurrence |
| `docs/architecture/decisions/0005-idempotent-star-ledger.md` | Immutable star ledger and idempotent task/reward commands |
| `docs/architecture/decisions/0006-signed-gateway-identity-envelope.md` | Strip client identity headers and authenticate gateway-to-service identity |
| `docs/development/family-growth-requirement-traceability.md` | Requirement-to-design/API/code/test mapping |
| `docs/development/family-growth-test-strategy.md` | Test levels, ownership, commands, fixtures and quality gates |
| `docs/development/family-growth-design-review.md` | Review inventory, findings, disposition, sign-off and Task 5 gate status |
| `docs/development/family-growth-baseline-manifest.md` | Candidate commit, content hashes, authoritative statuses, approvers and risks |
| `docs/superpowers/plans/2026-06-17-family-learning-tracker-transition.md` | Master sequence and Task 4.5 gate |

### Task 1: Insert the Design Review Gate Into the Master Plan

**Files:**
- Modify: `docs/superpowers/plans/2026-06-17-family-learning-tracker-transition.md`
- Create: `docs/development/family-growth-design-review.md`

- [ ] **Step 1: Review and preserve the current master-plan diff**

Run:

```bash
git diff -- docs/superpowers/plans/2026-06-17-family-learning-tracker-transition.md
```

Expected: the diff contains path normalization and clarified PIN, timezone, repeat-task, star-ledger, aggregation, and notification behavior. Do not discard these changes.

- [ ] **Step 2: Add Task 4.5 to the master plan**

Insert Task 4.5 between Task 4 and Task 5 with these exact controls:

```markdown
### Task 4.5: Design Baseline Review Gate

**Status:** IN_REVIEW

Task 5 is blocked until all entry criteria in
`docs/superpowers/specs/2026-06-18-family-growth-design-baseline-review-design.md`
are satisfied.

- [ ] Product requirements have stable IDs and acceptance criteria.
- [ ] Architecture decisions are recorded and approved.
- [ ] API contract is complete and internally consistent.
- [ ] Test strategy and requirement traceability are complete.
- [ ] Task 3/4 implementation findings are recorded.
- [ ] All BLOCKER and MAJOR findings are closed.
- [ ] Product, architecture, and API baselines are approved.
- [ ] Task 5 entry decision is signed.
```

Change the recommended execution order so Task 4.5 is explicitly required before Task 5. Do not mark historical task checkboxes complete in this step; status evidence belongs in the review record.

- [ ] **Step 3: Create the review control record**

Create `docs/development/family-growth-design-review.md` with:

```markdown
# 家庭成长跟踪设计基线评审记录

**Review ID:** FGT-DR-2026-06-18
**Status:** IN_REVIEW
**Branch:** codex/family-growth-tracker
**Gate:** Task 4.5

## Baseline Inventory

| Artifact | Review status | Approved commit | Reviewer | Review date |
| --- | --- | --- | --- | --- |
| Product requirements | IN_REVIEW | - | - | - |
| Architecture design and ADRs | IN_REVIEW | - | - | - |
| API contract | IN_REVIEW | - | - | - |
| Test strategy | DRAFT | - | - | - |
| Traceability matrix | DRAFT | - | - | - |

## Finding Rules

- BLOCKER: cross-family access, irreversible data corruption, credential exposure, or a core contract that cannot support the MVP flow.
- MAJOR: an approved MVP behavior, authorization rule, state transition, or deterministic test is missing or contradictory.
- MINOR: naming, documentation, or non-blocking consistency issue.

## Findings

| ID | Severity | Requirement | Evidence | Disposition | Status |
| --- | --- | --- | --- | --- | --- |

## Task 5 Entry Decision

**Decision:** BLOCKED
**Reason:** Baseline review and Task 3/4 conformance review are not complete.

## Sign-off

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Product owner | - | PENDING | - |
| Technical reviewer | Codex | PENDING | - |
```

- [ ] **Step 4: Verify and commit the gate controls**

Run:

```bash
git diff --check -- docs/superpowers/plans/2026-06-17-family-learning-tracker-transition.md docs/development/family-growth-design-review.md
rg -n "Task 4.5|Status: IN_REVIEW|Decision: BLOCKED" docs/superpowers/plans/2026-06-17-family-learning-tracker-transition.md docs/development/family-growth-design-review.md
```

Expected: no whitespace errors; all three gate markers are present.

Commit:

```bash
git add docs/superpowers/plans/2026-06-17-family-learning-tracker-transition.md docs/development/family-growth-design-review.md
git commit -m "docs: add family tracker design review gate"
```

### Task 2: Baseline Numbered Product Requirements

**Files:**
- Modify: `docs/product/family-learning-tracker.md`

- [ ] **Step 1: Add document control metadata**

Add below the title:

```markdown
**Document status:** IN_REVIEW
**Baseline candidate:** FGT-MVP-1
**Last reviewed:** 2026-06-18
**Change control:** Semantic changes require a review record and traceability update.
```

- [ ] **Step 2: Preserve and reconcile current product decisions**

Keep the current uncommitted decisions:

- PIN is parent-managed and reset invalidates old child tokens.
- Repeat templates, streaks, weekly goals, and badges are not MVP features.
- One task represents one occurrence.
- MVP rewards use immutable star ledger entries and parent-confirmed redemption.
- Business dates use the family IANA timezone, defaulting to `Asia/Shanghai`.

Resolve any older paragraph that still presents those deferred features as MVP behavior.

- [ ] **Step 3: Add the requirement catalog**

Add a `MVP Requirements and Acceptance Criteria` section containing these baseline rows. Each row must state the actor, trigger, observable result, failure result, and authorization boundary. Additions or task-number changes require review-record approval.

| ID | `plannedTask` | `gateAtTask` | Phase | Initial status | Required acceptance behavior |
| --- | --- | --- | --- | --- | --- |
| `FR-FAM-001` | 3 | 4 | baseline | implemented | A parent creates at most one owned family with name and valid IANA timezone; a second create returns `409`. |
| `FR-FAM-002` | 3 | 4 | baseline | implemented | A parent reads or updates only a family they own or belong to; another family returns `403`. |
| `FR-CHILD-001` | 3 | 4 | baseline | implemented | A parent creates and edits multiple child profiles only inside their family. |
| `FR-CHILD-002` | 3 | 4 | baseline | implemented | A child reads only their own profile and cannot list siblings. |
| `FR-CHILD-003` | 3 | 4 | baseline | implemented | A parent sets a 4-6 digit child PIN; plaintext PIN is never stored, logged, or returned. |
| `FR-CHILD-004` | 3 | 4 | baseline | implemented | Child PIN login uses generic credential errors, rate-limits five failures per 15 minutes, and returns a child-scoped token no longer than 12 hours. |
| `FR-CHILD-005` | 3 | 4 | baseline | implemented | PIN reset increments token version and invalidates previously issued child tokens. |
| `FR-TASK-001` | 4 | 4 | baseline | implemented | A parent creates one-occurrence tasks in each of moral, academic, physical, artistic, and labor dimensions for their own child. |
| `FR-TASK-002` | 4 | 4 | baseline | implemented | Task fields support due date, duration, amount/unit, priority, notes, feedback, and optional attachment metadata. |
| `FR-TASK-003` | 4 | 4 | baseline | implemented | Parent and child list only accessible child tasks, filtered by status, dimension, family-local today, or Monday-Sunday week. |
| `FR-TASK-004` | 4 | 4 | baseline | implemented | A child or parent completes an accessible pending task with actual duration/amount, difficulty, help flag, and child note. |
| `FR-TASK-005` | 4 | 4 | baseline | implemented | Only a parent confirms an accessible completed task and records parent feedback. |
| `FR-TASK-006` | 4 | 4 | baseline | implemented | A parent deletes pending tasks and archives completed or confirmed tasks; MVP rejects `repeatRule`. |
| `FR-LOG-001` | 5 | 5 | mvp | planned | Parent or child records dated growth activity in all five dimensions, restricted to the accessible child. |
| `FR-POINT-001` | 5 | 5 | mvp | planned | A parent manages academic knowledge, physical ability, artistic practice, labor skill, and moral habit points. |
| `FR-MISTAKE-001` | 6 | 6 | mvp | planned | Parent or child records and reviews only academic mistakes for the accessible child. |
| `FR-REPORT-001` | 6 | 6 | mvp | planned | Parent or child reads a deterministic Monday-Sunday report covering all five dimensions; source failure returns an explicit partial or unavailable result. |
| `FR-REWARD-001` | 5 | 5 | mvp | planned | First parent confirmation of a task awards exactly one star through an idempotent immutable ledger entry. |
| `FR-REWARD-002` | 5 | 5 | mvp | planned | Only a parent creates and confirms reward redemption; insufficient balance returns `409` and retries cannot double-spend. |
| `FR-NOTIFY-001` | 7 | 7 | mvp | planned | Family reminders are derived from accessible data and declare unavailable sources when partially degraded. |
| `NFR-SEC-001` | 3 | 4 | baseline | implemented | Client-supplied `familyId` is never sufficient for authorization; family scope is derived from authenticated identity and child ownership. |
| `NFR-SEC-002` | 4 | 4 | baseline | implemented | Gateway removes client identity headers and sends a signed, expiring, nonce-protected identity envelope; direct forged downstream requests are rejected. |
| `NFR-DATA-001` | 3 | 4 | baseline | implemented | Every child-owned record stores both `familyId` and `childId`; family isolation is present in every list and item query. |
| `NFR-TIME-001` | 4 | 4 | baseline | implemented | Local dates use `YYYY-MM-DD` in family timezone; timestamps use UTC ISO 8601. |
| `NFR-COMPAT-001` | 3 | 4 | baseline | implemented | Legacy school routes and models remain available but hidden from the family MVP UI until explicit migration approval. |

- [ ] **Step 4: Verify catalog completeness and commit**

Run:

```bash
for prefix in FR-FAM FR-CHILD FR-TASK FR-LOG FR-POINT FR-MISTAKE FR-REPORT FR-REWARD FR-NOTIFY NFR-SEC NFR-DATA NFR-TIME NFR-COMPAT; do
  rg -q "$prefix-" docs/product/family-learning-tracker.md || exit 1
done
git diff --check -- docs/product/family-learning-tracker.md
```

Expected: exit code `0`, no whitespace errors.

Commit:

```bash
git add docs/product/family-learning-tracker.md
git commit -m "docs: baseline family tracker requirements"
```

### Task 3: Baseline Architecture and ADRs

**Files:**
- Modify: `docs/architecture/family-learning-tracker-architecture.md`
- Create: `docs/architecture/decisions/0001-reuse-existing-services.md`
- Create: `docs/architecture/decisions/0002-family-data-isolation.md`
- Create: `docs/architecture/decisions/0003-family-local-date.md`
- Create: `docs/architecture/decisions/0004-single-occurrence-growth-tasks.md`
- Create: `docs/architecture/decisions/0005-idempotent-star-ledger.md`
- Create: `docs/architecture/decisions/0006-signed-gateway-identity-envelope.md`

- [ ] **Step 1: Add architecture document control**

Add `Document status: IN_REVIEW`, baseline candidate `FGT-MVP-1`, and links to all six ADRs below the title.

- [ ] **Step 2: Complete the data-model tables**

For `Family`, `User.childProfile`, and `GrowthTask`, document field type, required/default rules, indexes, ownership, and lifecycle. At minimum lock these decisions:

```text
Family.timezone: String, required, default Asia/Shanghai, valid IANA name
User.childProfile.pinHash: String, select false
User.childProfile.tokenVersion: Number, required, default 0
GrowthTask.dueDate: String LocalDate YYYY-MM-DD
GrowthTask.status: pending -> completed -> confirmed; pending/completed/confirmed -> archived under documented rules
GrowthTask.repeatRule: absent from MVP schema
```

Document compound indexes beginning with family scope:

```text
GrowthTask { familyId: 1, childId: 1, dueDate: 1 }
GrowthTask { familyId: 1, childId: 1, dimension: 1, status: 1 }
StarLedgerEntry { familyId: 1, childId: 1, sourceType: 1, sourceId: 1, type: 1 } unique
```

- [ ] **Step 3: Add state and permission matrices**

Add a task transition table for create, edit, complete, confirm, delete/archive, and repeat attempts. Add a permission matrix whose columns are parent, child self, sibling, other-family parent, and anonymous; rows must cover family, child, task list/detail/create/edit/complete/confirm/delete, PIN set/login, logs, mistakes, reports, and rewards.

- [ ] **Step 4: Add compatibility and migration rules**

State that legacy models are retained, new family routes write only new family fields/models, no destructive migration runs in MVP, and rollback disables family routes without deleting legacy or family data. Document that `dueDate` conversion requires a migration plan before existing family task data can move from BSON Date to LocalDate string.

- [ ] **Step 5: Specify the gateway trust boundary**

Document this request flow:

```text
client JWT
  -> gateway strips all client x-user-* and internal-auth headers
  -> gateway verifies JWT
  -> gateway signs method + normalized path + userId + role + timestamp + nonce
  -> downstream verifies signature, five-minute freshness, and one-time nonce
  -> route performs family/resource authorization
```

Use an independent service identity secret, not `JWT_SECRET`. Internal command endpoints require a separate service credential. Network isolation is defense in depth and does not replace request authentication.

- [ ] **Step 6: Write the ADRs**

Each ADR must contain `Status: Proposed`, Context, Decision, Alternatives, Consequences, and Validation. Record these decisions:

1. Reuse existing services and MongoDB for MVP; each service remains the sole writer for its owned collections.
2. Derive family authorization from token identity plus resource ownership; never trust request `familyId` alone.
3. Store business dates as family-local `YYYY-MM-DD`; store event timestamps as UTC.
4. Model one task as one occurrence and defer recurring templates.
5. Use immutable star ledger entries and source-based unique keys; task confirmation and redemption are idempotent commands.
6. Strip client identity headers at the gateway and use an HMAC-signed identity envelope with timestamp and nonce until mTLS or downstream JWT validation replaces it.

- [ ] **Step 7: Verify and commit architecture baseline**

Run:

```bash
test "$(find docs/architecture/decisions -name '*.md' | wc -l | tr -d ' ')" -ge 6
rg -n "tokenVersion|LocalDate|permission|权限|rollback|回滚|unique|nonce|identity envelope|身份信封" docs/architecture/family-learning-tracker-architecture.md docs/architecture/decisions
git diff --check -- docs/architecture/family-learning-tracker-architecture.md docs/architecture/decisions
```

Expected: six ADR files, required concepts found, no whitespace errors.

Commit:

```bash
git add docs/architecture/family-learning-tracker-architecture.md docs/architecture/decisions
git commit -m "docs: baseline family tracker architecture decisions"
```

### Task 4: Baseline the API Contract

**Files:**
- Modify: `docs/api/family-learning-tracker-api.md`

- [ ] **Step 1: Add API document control and conventions**

Add `Document status: IN_REVIEW`, baseline candidate `FGT-MVP-1`, and these normative conventions:

```json
{
  "success": false,
  "error": {
    "code": "CHILD_ACCESS_DENIED",
    "message": "无权访问该孩子的数据",
    "details": []
  }
}
```

List responses must contain `items`, `page`, `pageSize`, and `total`; defaults are page `1`, pageSize `20`, maximum pageSize `100`. Error codes are stable; display messages are not stable API identifiers.

- [ ] **Step 2: Attach requirement IDs to endpoints**

For every endpoint in the complete interface list, add a `Requirement` column. Task 3 endpoints map to `FR-FAM-*` and `FR-CHILD-*`; Task 4 endpoints map to `FR-TASK-*`; all family-scoped endpoints also map to `NFR-SEC-001` and `NFR-DATA-001`.

- [ ] **Step 3: Reconcile request and response examples**

Ensure examples consistently use:

- `timezone: Asia/Shanghai` on family create/read.
- PIN length 4-6, generic `INVALID_CHILD_CREDENTIALS`, `429 PIN_LOGIN_RATE_LIMITED`, and token invalidation response.
- `dueDate: YYYY-MM-DD`, no `repeatRule`, and family-local `today/week` semantics.
- stable errors for invalid input, unauthenticated, forbidden, not found, conflict, rate limit, and unavailable aggregation.
- paginated task, log, point, mistake, reward, and notification lists.
- idempotent star award and reward redemption semantics as Task 5 final-MVP behavior, clearly marked as not part of Task 4 conformance.

- [ ] **Step 4: Verify endpoint and response consistency**

Run:

```bash
rg -n "Requirement|pageSize|INVALID_CHILD_CREDENTIALS|PIN_LOGIN_RATE_LIMITED|REPEAT_RULE_NOT_SUPPORTED|YYYY-MM-DD|NFR-SEC-001" docs/api/family-learning-tracker-api.md
if rg -n '"success": false,[[:space:]]*"message"' docs/api/family-learning-tracker-api.md; then exit 1; fi
git diff --check -- docs/api/family-learning-tracker-api.md
```

Expected: required contract terms are present; no legacy top-level error example; no whitespace errors.

Commit:

```bash
git add docs/api/family-learning-tracker-api.md
git commit -m "docs: baseline family tracker api contract"
```

### Task 5: Create Test Strategy and Traceability Matrix

**Files:**
- Create: `docs/development/family-growth-test-strategy.md`
- Create: `docs/development/family-growth-requirement-traceability.md`
- Modify: `docs/development/family-growth-design-review.md`

- [ ] **Step 1: Write the test strategy**

Define these levels and owners:

| Level | Required evidence |
| --- | --- |
| Model/unit | validation, indexes, LocalDate/timezone helpers, state transitions |
| Route contract | request/response schema, stable error codes, pagination, role checks |
| Service integration | MongoDB-backed family isolation, token invalidation, idempotency |
| Gateway integration | client identity-header stripping, signed envelope verification, freshness, nonce replay protection, and public route mapping |
| End-to-end | parent creates family/child/tasks, child completes, parent confirms, report/reward flow |
| Security | cross-family, sibling access, forged familyId, PIN brute force and stale token |

Document deterministic fixture rules: two families, two parents, at least two siblings in one family, fixed `now`, family timezone `Asia/Shanghai`, and dates spanning midnight and Monday/Sunday boundaries.

Document the exact current commands:

```bash
npm test --prefix backend/services/user-service -- --runInBand __tests__/routes/family.test.js __tests__/routes/children.test.js
npm test --prefix backend/services/homework-service -- --runInBand __tests__/growthTasks.test.js
npm run test:nocoverage
git diff --check
```

Targeted family suites must pass. Legacy full-suite failures may remain only when they are already classified in `docs/development/family-tracker-test-baseline.md` and no failure is caused by the family branch.

- [ ] **Step 2: Seed the traceability matrix**

Create one row per requirement ID with columns:

```text
Requirement | plannedTask | gateAtTask | Product section | Architecture/ADR | API | Code owner | Test evidence | Conformance | Finding
```

Populate Task 3 rows with actual code owners:

```text
backend/common/models/Family.js
backend/common/models/User.js
backend/services/user-service/controllers/familyController.js
backend/services/user-service/__tests__/routes/family.test.js
backend/services/user-service/__tests__/routes/children.test.js
```

Populate Task 4 rows with:

```text
backend/services/homework-service/models/GrowthTask.js
backend/services/homework-service/routes/growthTasks.js
backend/services/homework-service/__tests__/growthTasks.test.js
```

Use only `COVERED`, `PARTIAL`, `GAP`, or `PLANNED_TASK_5_PLUS` as conformance values. Include every requirement even when its planned task is later. The Task 3/4 gate counts only `plannedTask` 3 or 4 plus cross-cutting requirements with `gateAtTask=4`. Reward behavior implemented in Task 5 must be `PLANNED_TASK_5_PLUS`, not a Task 4 failure.

- [ ] **Step 3: Update review inventory**

Set Test strategy and Traceability matrix to `IN_REVIEW` in `family-growth-design-review.md`. Keep the overall Task 5 decision `BLOCKED`.

- [ ] **Step 4: Verify and commit test governance documents**

Run:

```bash
for id in FR-FAM-001 FR-CHILD-005 FR-TASK-006 NFR-SEC-001 NFR-SEC-002 NFR-DATA-001 NFR-TIME-001; do
  rg -q "$id" docs/development/family-growth-requirement-traceability.md || exit 1
done
rg -n "COVERED|PARTIAL|GAP|PLANNED_TASK_5_PLUS" docs/development/family-growth-requirement-traceability.md
git diff --check -- docs/development/family-growth-test-strategy.md docs/development/family-growth-requirement-traceability.md docs/development/family-growth-design-review.md
```

Expected: representative IDs and all status values are documented; no whitespace errors.

Commit:

```bash
git add docs/development/family-growth-test-strategy.md docs/development/family-growth-requirement-traceability.md docs/development/family-growth-design-review.md
git commit -m "docs: add family tracker traceability and test strategy"
```

### Task 6: Audit Task 3 Family and Child Implementation

**Files:**
- Inspect: `backend/common/models/Family.js`
- Inspect: `backend/common/models/User.js`
- Inspect: `backend/common/middleware/auth.js`
- Inspect: `backend/services/user-service/controllers/familyController.js`
- Inspect: `backend/services/user-service/__tests__/routes/family.test.js`
- Inspect: `backend/services/user-service/__tests__/routes/children.test.js`
- Modify: `docs/development/family-growth-requirement-traceability.md`
- Modify: `docs/development/family-growth-design-review.md`

- [ ] **Step 1: Run Task 3 tests and save the exact result**

Run:

```bash
npm test --prefix backend/services/user-service -- --runInBand __tests__/routes/family.test.js __tests__/routes/children.test.js
```

Expected at plan-writing time: the existing two suites pass. Record actual suite/test counts and command exit code in the review record; do not copy an older result.

- [ ] **Step 2: Audit the model and token contract**

Check and record evidence for:

```text
Family.timezone exists and validates an IANA timezone.
User.childProfile.tokenVersion exists with default 0.
PIN accepts exactly 4-6 digits.
PIN reset increments tokenVersion.
Child token contains familyId, childId, role, and tokenVersion and expires within 12 hours.
Authentication rejects a child token whose tokenVersion is stale.
Five failed attempts per IP+family+child in 15 minutes return 429.
Errors use error.code and do not expose child existence.
```

At plan-writing time, code inspection indicates these likely gaps: missing family timezone, missing tokenVersion, PIN accepts 4-8 digits, no PIN rate limit, child token lacks family claims/version, and family routes use top-level `message`. Verify each against current code before recording it.

- [ ] **Step 3: Audit ownership behavior**

Map evidence for parent own-family access, other-family denial, child self access, sibling denial, and client-supplied familyId rejection. A test that only mocks ownership helpers is not sufficient for `COVERED`; integration evidence must exercise database ownership.

- [ ] **Step 4: Record findings and update traceability**

Assign stable finding IDs `FGT-T3-001`, `FGT-T3-002`, and so on. Each finding must include severity, requirement ID, exact file/line evidence, expected contract, actual behavior, proposed disposition, and status `OPEN` or `CLOSED`.

Set each Task 3 trace row to `COVERED`, `PARTIAL`, or `GAP` based on evidence. Do not edit backend code in this task.

- [ ] **Step 5: Verify and commit Task 3 audit evidence**

Run:

```bash
rg -n "FGT-T3-|FR-FAM-|FR-CHILD-|NFR-SEC-001" docs/development/family-growth-design-review.md docs/development/family-growth-requirement-traceability.md
git diff --check -- docs/development/family-growth-design-review.md docs/development/family-growth-requirement-traceability.md
```

Expected: Task 3 findings and trace rows are present; no whitespace errors.

Commit:

```bash
git add docs/development/family-growth-design-review.md docs/development/family-growth-requirement-traceability.md
git commit -m "docs: audit family and child implementation"
```

### Task 7: Audit Task 4 Growth Task Implementation

**Files:**
- Inspect: `backend/services/homework-service/models/GrowthTask.js`
- Inspect: `backend/services/homework-service/routes/growthTasks.js`
- Inspect: `backend/services/homework-service/__tests__/growthTasks.test.js`
- Inspect: `backend/gateway/server.js`
- Modify: `docs/development/family-growth-requirement-traceability.md`
- Modify: `docs/development/family-growth-design-review.md`

- [ ] **Step 1: Run Task 4 tests and save the exact result**

Run:

```bash
npm test --prefix backend/services/homework-service -- --runInBand __tests__/growthTasks.test.js
```

Expected at plan-writing time: the existing suite passes. Record current suite/test counts and exit code in the review record.

- [ ] **Step 2: Audit task data and date semantics**

Check and record evidence for:

```text
dueDate is a YYYY-MM-DD LocalDate rather than a server-timezone Date.
today uses Family.timezone.
week uses Family.timezone and inclusive Monday-Sunday boundaries.
repeatRule is rejected with 400 REPEAT_RULE_NOT_SUPPORTED.
compound query indexes begin with familyId and childId.
all list/detail/update queries verify familyId and childId ownership.
```

At plan-writing time, code inspection indicates likely gaps: `dueDate` is BSON Date, scope calculations use server local time, `repeatRule` remains in model and writable fields, and the second compound index omits `familyId`. Verify before recording.

- [ ] **Step 3: Audit task API behavior**

Check stable error responses, pagination defaults/max, invalid dimension/status handling, completion state transitions, repeated completion/confirmation behavior, and pending-delete versus completed/confirmed archive behavior.

At plan-writing time, list responses lack `page/pageSize` and errors use top-level `message`; record only after confirming current code. Star award behavior remains `PLANNED_TASK_5_PLUS` and is excluded from Task 4 conformance.

- [ ] **Step 4: Record findings and update traceability**

Assign `FGT-T4-001`, `FGT-T4-002`, and so on with the same evidence fields as Task 3. Set each Task 4 row to `COVERED`, `PARTIAL`, or `GAP`. Do not edit backend code.

- [ ] **Step 5: Verify and commit Task 4 audit evidence**

Run:

```bash
rg -n "FGT-T4-|FR-TASK-|NFR-TIME-001" docs/development/family-growth-design-review.md docs/development/family-growth-requirement-traceability.md
git diff --check -- docs/development/family-growth-design-review.md docs/development/family-growth-requirement-traceability.md
```

Expected: Task 4 findings and trace rows are present; no whitespace errors.

Commit:

```bash
git add docs/development/family-growth-design-review.md docs/development/family-growth-requirement-traceability.md
git commit -m "docs: audit family growth task implementation"
```

### Task 8: Audit the Gateway-to-Service Trust Boundary

**Files:**
- Inspect: `backend/gateway/server.js`
- Inspect: `backend/gateway/simple-server.js`
- Inspect: `backend/common/middleware/auth.js`
- Inspect: `backend/gateway/package.json`
- Modify: `docs/development/family-growth-requirement-traceability.md`
- Modify: `docs/development/family-growth-design-review.md`

- [ ] **Step 1: Inspect header handling and downstream verification**

Record whether the gateway removes client-provided `x-user-id`, `x-user-role`, `x-user-name`, signature, timestamp, and nonce headers before authentication. Record whether it creates a signed identity envelope after JWT verification and whether downstream `authenticateGateway` verifies signature, freshness, and nonce uniqueness.

At plan-writing time, inspection indicates that gateway writes decoded values into request headers without an explicit strip-all step and downstream services trust unsigned `x-user-id/x-user-role`. Verify current code and classify a confirmed direct-forgery path as `BLOCKER` under `NFR-SEC-002`.

- [ ] **Step 2: Inspect security test evidence**

Search for tests covering forged client headers, direct downstream calls, modified signatures, expired timestamps, replayed nonces, and valid gateway requests:

```bash
rg -n "x-user-id|identity envelope|nonce|replay|signature|forged|伪造|重放" backend/gateway backend/common backend/services/*/__tests__
```

Expected at plan-writing time: no complete test suite covers this boundary. Record the actual result and do not create tests during the audit.

- [ ] **Step 3: Record gateway findings and traceability**

Assign finding IDs `FGT-GW-001` onward. Map them to `NFR-SEC-002`, `plannedTask=4`, and `gateAtTask=4`. Include exact file/line evidence and the four mandatory security scenarios from ADR 0006.

- [ ] **Step 4: Verify and commit gateway audit evidence**

Run:

```bash
rg -n "FGT-GW-|NFR-SEC-002|BLOCKER" docs/development/family-growth-design-review.md docs/development/family-growth-requirement-traceability.md
git diff --check -- docs/development/family-growth-design-review.md docs/development/family-growth-requirement-traceability.md
```

Expected: the gateway trust decision has explicit evidence and severity; no whitespace errors.

Commit:

```bash
git add docs/development/family-growth-design-review.md docs/development/family-growth-requirement-traceability.md
git commit -m "docs: audit gateway service trust boundary"
```

### Task 9: Produce the Gate Decision and Remediation Handoff

**Files:**
- Modify: `docs/development/family-growth-design-review.md`
- Modify: `docs/superpowers/plans/2026-06-17-family-learning-tracker-transition.md`
- Create if required: `docs/superpowers/plans/2026-06-18-family-growth-task3-task4-remediation.md`
- Create: `docs/development/family-growth-baseline-manifest.md`

- [ ] **Step 1: Classify the gate result**

Count open findings:

```bash
(rg -c '\| (BLOCKER|MAJOR) \|.*\| OPEN \|' docs/development/family-growth-design-review.md || true)
```

If the count is nonzero, keep `Decision: BLOCKED`, list every blocking finding ID, and do not approve Task 5. If zero, run all verification in Step 5 before proposing approval.

- [ ] **Step 2: Write a separate remediation plan when required**

If any `BLOCKER` or `MAJOR` finding exists, create `docs/superpowers/plans/2026-06-18-family-growth-task3-task4-remediation.md` using `superpowers:writing-plans`. It must contain one TDD task per finding group, with exact failing tests, RED commands, implementation files, GREEN commands, regression commands, and separate commits. Do not implement fixes while writing that plan.

Verify and commit the remediation plan before selecting the candidate commit:

```bash
git diff --check -- docs/superpowers/plans/2026-06-18-family-growth-task3-task4-remediation.md
git add docs/superpowers/plans/2026-06-18-family-growth-task3-task4-remediation.md
git commit -m "docs: plan family tracker baseline remediation"
```

- [ ] **Step 3: Create the immutable candidate manifest**

Before creating the manifest, commit every candidate content document and verify the worktree and index are clean:

```bash
git status --short
git diff --check
candidateCommit=$(git rev-parse HEAD)
```

Expected: `git status --short` prints no output before the manifest is created.

Create `docs/development/family-growth-baseline-manifest.md` with baseline ID `FGT-MVP-1`, status `IN_REVIEW`, and the full 40-character output stored in `candidateCommit`. Use this row schema:

```text
documentId | path | version | sha256 | status | owner | author | reviewers | approvers | openRisks
```

Set owner and product/baseline approver to `linmingfeng`, author and technical reviewer to `Codex`, and quality approver to `linmingfeng`. Set `singleMaintainerException: false` because author and human approver are distinct. Populate actual risk IDs from the review record; use `none` only when no risk is open.

Include product, architecture, all ADRs, API, test strategy, and traceability. Do not include the manifest's own hash. Compute each content hash with:

```bash
git show "$candidateCommit:$doc_path" | shasum -a 256
```

Leave the prepared manifest unstaged until Step 6, where it is committed with the updated review record as a separate review-open commit. Any later candidate content change invalidates this manifest and requires a new candidate commit and hashes.

- [ ] **Step 4: Update the master-plan gate status**

Set Task 4.5 to `BLOCKED_REMEDIATION` when a remediation plan exists, or `READY_FOR_SIGN_OFF` only when no `BLOCKER`/`MAJOR` remains. Task 5 stays pending until user sign-off.

- [ ] **Step 5: Run final documentation and targeted verification**

Run:

```bash
git diff --check
npm test --prefix backend/services/user-service -- --runInBand __tests__/routes/family.test.js __tests__/routes/children.test.js
npm test --prefix backend/services/homework-service -- --runInBand __tests__/growthTasks.test.js
```

Expected: documentation check and targeted existing suites pass. Gateway identity-envelope security tests are expected to be absent until remediation and therefore keep the gate blocked. Any unexpected failure must be recorded.

- [ ] **Step 6: Commit the review-open gate result**

For a blocked result:

```bash
git add docs/development/family-growth-design-review.md docs/development/family-growth-baseline-manifest.md docs/superpowers/plans/2026-06-17-family-learning-tracker-transition.md docs/superpowers/plans/2026-06-18-family-growth-task3-task4-remediation.md
git commit -m "docs: record family tracker remediation gate"
```

For a result with no remediation file:

```bash
git add docs/development/family-growth-design-review.md docs/development/family-growth-baseline-manifest.md docs/superpowers/plans/2026-06-17-family-learning-tracker-transition.md
git commit -m "docs: prepare family tracker baseline sign-off"
```

- [ ] **Step 7: Stop for remediation and user sign-off**

Report the candidate commit, manifest hashes, exact test results, all open risks, and the Task 5 decision. Do not change manifest status to `APPROVED`, create an approval commit/tag, or start Task 5 until all required remediation has passed and the designated approvers explicitly sign off.

After remediation and sign-off, verify every manifest hash against the candidate commit, require a clean worktree and index, create a separate approval commit changing manifest status to `APPROVED`, then create the annotated tag `family-growth-baseline-v1` on that approval commit. Never tag an `IN_REVIEW` or blocked baseline.

## Completion Criteria

This plan is complete only when:

- Product requirements have stable IDs and observable acceptance criteria.
- Architecture decisions are represented in the main architecture document and six ADRs.
- API endpoints map to requirements and use one normative response contract.
- Test strategy and traceability cover all MVP requirement IDs.
- Task 3 and Task 4 have fresh test evidence and line-level conformance findings.
- Gateway identity-header stripping and signed-envelope behavior has explicit security findings and test evidence.
- The manifest binds reviewed content to an immutable candidate commit and SHA-256 hashes.
- The review record gives an evidence-based `BLOCKED`, `READY_FOR_SIGN_OFF`, or later `APPROVED` result.
- Task 5 has not started without explicit sign-off.

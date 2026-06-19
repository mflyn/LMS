# Task 5 Numbered Test Cases

**Document status:** APPROVED
**Baseline candidate:** FGT-MVP-1.3

Test names must begin with the case ID. Unless stated otherwise, database cases use family A/parent A/child A1/sibling A2 and family B/parent B/child B1 with signed identities.

## Growth Logs

| ID | Requirement | Level | Preconditions and action | Expected result | Automated test |
| --- | --- | --- | --- | --- | --- |
| `TC-T5-LOG-001` | `FR-LOG-001` | model | Create one valid log for each five-dimension value. | All five save with familyId, childId and LocalDate. | `growthLogs.test.js` |
| `TC-T5-LOG-002` | `FR-LOG-001`, `NFR-TIME-001` | model | Create invalid calendar date, negative duration/amount, invalid enum or overlong content. | Mongoose validation rejects each value. | `growthLogs.test.js` |
| `TC-T5-LOG-003` | `FR-LOG-001`, `NFR-SEC-001` | route | Parent A creates a log for child A1 with parentNote. | `201`; server-derived family and audit fields are returned. | `growthLogs.test.js` |
| `TC-T5-LOG-004` | `FR-LOG-001`, `NFR-SEC-001` | route | Child A1 creates a self log with reflection and no parent-only fields. | `201`; record belongs to child A1. | `growthLogs.test.js` |
| `TC-T5-LOG-005` | `FR-LOG-001`, `NFR-SEC-001` | security | Child A1 supplies child A2 or child B1. | `403 CHILD_ACCESS_DENIED`; no record created. | `growthLogs.test.js` |
| `TC-T5-LOG-006` | `FR-LOG-001` | authorization | Child creates or patches `parentNote`, familyId, childId, createdBy or updatedBy. | `403 FIELD_ACCESS_DENIED`; stored record unchanged. | `growthLogs.test.js` |
| `TC-T5-LOG-007` | `FR-LOG-001`, `NFR-SEC-001` | route | Parent B reads or patches family A log. | `403 CHILD_ACCESS_DENIED`; no data disclosed. | `growthLogs.test.js` |
| `TC-T5-LOG-008` | `FR-LOG-001` | route | List child A1 by inclusive from/to, dimension and page size. | Only matching entries; `items/page/pageSize/total` correct. | `growthLogs.test.js` |
| `TC-T5-LOG-009` | `FR-LOG-001` | route | Patch allowed parent and child fields. | `200`; only submitted allowed fields change and updatedBy is server-set. | `growthLogs.test.js` |
| `TC-T5-LOG-010` | `FR-LOG-001` | contract | Use malformed ID, inverted date range, pageSize 101 or unknown dimension. | `400 VALIDATION_ERROR` stable envelope. | `growthLogs.test.js` |

## Knowledge and Ability Points

| ID | Requirement | Level | Preconditions and action | Expected result | Automated test |
| --- | --- | --- | --- | --- | --- |
| `TC-T5-POINT-001` | `FR-POINT-001` | model | Create academic point with subject and four non-academic points with area. | All save with normalized empty unused field. | `knowledgePoints.test.js` |
| `TC-T5-POINT-002` | `FR-POINT-001` | model | Omit academic subject, omit non-academic area, use invalid mastery or negative/non-integer count. | Validation rejects each value. | `knowledgePoints.test.js` |
| `TC-T5-POINT-003` | `FR-POINT-001`, `NFR-DATA-001` | model/route | Create duplicate normalized point for same family and child. | Unique index enforced; route returns `409 RESOURCE_CONFLICT`. | `knowledgePoints.test.js` |
| `TC-T5-POINT-004` | `FR-POINT-001`, `NFR-SEC-001` | route | Parent creates one point in each dimension for child A1. | `201`; ownership and parent audit fields are server-derived. | `knowledgePoints.test.js` |
| `TC-T5-POINT-005` | `FR-POINT-001` | authorization | Child attempts create or patch. | `403 CHILD_ACCESS_DENIED`; no mutation. | `knowledgePoints.test.js` |
| `TC-T5-POINT-006` | `FR-POINT-001`, `NFR-SEC-001` | security | Parent B creates, reads or patches child A1 point; child A1 requests sibling. | `403 CHILD_ACCESS_DENIED`. | `knowledgePoints.test.js` |
| `TC-T5-POINT-007` | `FR-POINT-001` | route | Parent/child list by dimension, subject, area and mastery with pagination. | Only accessible matching items and correct totals. | `knowledgePoints.test.js` |
| `TC-T5-POINT-008` | `FR-POINT-001` | route | Parent patches mastery, counts and ISO lastReviewedAt. | `200`; values and updatedByParentId persisted. | `knowledgePoints.test.js` |

## Internal Stars and Ledger

| ID | Requirement | Level | Preconditions and action | Expected result | Automated test |
| --- | --- | --- | --- | --- | --- |
| `TC-T5-STAR-001` | `NFR-SEC-003` | security | Call internal award without token, with short/wrong token, ordinary JWT or gateway headers. | `401 INVALID_SERVICE_CREDENTIAL`; no ledger entry. | `internalStars.test.js` |
| `TC-T5-STAR-002` | `NFR-SEC-003` | unit/startup | Configure missing or less-than-32-character token and create progress server or homework award client. | Both validators fail before listen or outbound request. | `startup.test.js`, `starAwardClient.test.js` |
| `TC-T5-STAR-003` | `FR-REWARD-001`, `NFR-DATA-002` | integration | Valid homework-service command awards confirmed task once. | `200`, awarded true, one immutable 1-star earn, balance 1. | `internalStars.test.js` |
| `TC-T5-STAR-004` | `FR-REWARD-001`, `NFR-DATA-002` | integration | Repeat same task command sequentially. | `200`, awarded false, same ledger ID, one earn. | `internalStars.test.js` |
| `TC-T5-STAR-005` | `FR-REWARD-001`, `NFR-DATA-002` | concurrency | Submit same valid task command concurrently. | All successful/idempotent; exactly one earn entry. | `internalStars.test.js` |
| `TC-T5-STAR-006` | `NFR-SEC-001`, `NFR-SEC-003` | security | Use mismatched family/child or parent outside family. | `403 CHILD_ACCESS_DENIED`; no ledger entry. | `internalStars.test.js` |
| `TC-T5-STAR-007` | `NFR-DATA-002` | model | Attempt update/delete through model APIs after entry creation. | Immutable guard rejects mutation; no public mutation route exists. | `internalStars.test.js` |

## Reward Management and Redemption

| ID | Requirement | Level | Preconditions and action | Expected result | Automated test |
| --- | --- | --- | --- | --- | --- |
| `TC-T5-REWARD-001` | `FR-REWARD-002`, `NFR-SEC-001` | route | Parent A creates reward for child A1. | `201`, active reward with positive integer cost and server ownership. | `rewards.test.js` |
| `TC-T5-REWARD-002` | `FR-REWARD-002` | contract | Create empty/overlong title or non-positive/non-integer cost. | `400 VALIDATION_ERROR`. | `rewards.test.js` |
| `TC-T5-REWARD-003` | `FR-REWARD-002`, `NFR-SEC-001` | security | Child creates/redeems, parent B accesses child A1, or child A1 requests sibling. | `403 CHILD_ACCESS_DENIED`; no mutation/data leak. | `rewards.test.js` |
| `TC-T5-REWARD-004` | `FR-REWARD-001`, `FR-REWARD-002` | route | List multiple rewards and ledger entries with independent page settings. | Correct balance and independent rewards/ledger pagination objects. | `rewards.test.js` |
| `TC-T5-REWARD-005` | `FR-REWARD-002`, `NFR-DATA-002` | transaction | Balance covers active reward; redeem with new idempotency key. | One spend and reward redeemed in one transaction; new balance correct. | `rewards.test.js` |
| `TC-T5-REWARD-006` | `FR-REWARD-002`, `NFR-DATA-002` | transaction | Balance is below cost. | `409 INSUFFICIENT_STARS`; no spend and reward remains active. | `rewards.test.js` |
| `TC-T5-REWARD-007` | `FR-REWARD-002`, `NFR-DATA-002` | idempotency | Repeat successful redemption with same key. | Original success returned; one spend only. | `rewards.test.js` |
| `TC-T5-REWARD-008` | `FR-REWARD-002`, `NFR-DATA-002` | idempotency | Reuse successful key for another reward. | `409 IDEMPOTENCY_KEY_REUSED`; second reward active. | `rewards.test.js` |
| `TC-T5-REWARD-009` | `FR-REWARD-002` | contract | Omit, empty or overlong Idempotency-Key. | `400 VALIDATION_ERROR`; no mutation. | `rewards.test.js` |
| `TC-T5-REWARD-010` | `NFR-DATA-002` | transaction | Force error after spend insert but before reward update. | Transaction aborts: no spend and active reward. | `rewards.test.js` |
| `TC-T5-REWARD-011` | `NFR-DATA-002` | concurrency | Balance funds only one of two different rewards; redeem concurrently. | Exactly one redemption/spend succeeds; other returns insufficient/state conflict; balance never negative. | `rewards.test.js` |

## GrowthTask Confirmation Saga

| ID | Requirement | Level | Preconditions and action | Expected result | Automated test |
| --- | --- | --- | --- | --- | --- |
| `TC-T5-SAGA-001` | `FR-REWARD-001`, `NFR-DATA-002` | integration | Parent confirms completed/not_applicable task and award client succeeds. | Task becomes confirmed/awarded and response includes star result. | `growthTasks.test.js` |
| `TC-T5-SAGA-002` | `FR-REWARD-001` | failure | Award client times out/fails after first transition. | `503 STAR_AWARD_PENDING`; task remains confirmed/pending. | `growthTasks.test.js` |
| `TC-T5-SAGA-003` | `FR-REWARD-001`, `NFR-DATA-002` | recovery | Retry confirmed/pending task and idempotent award succeeds. | Task becomes awarded; confirmation timestamp/feedback unchanged. | `growthTasks.test.js` |
| `TC-T5-SAGA-004` | `FR-REWARD-001` | idempotency | Confirm already confirmed/awarded task. | `200` existing result; award client not called. | `growthTasks.test.js` |
| `TC-T5-SAGA-005` | `FR-REWARD-001`, `NFR-DATA-002` | concurrency | Two parent confirmations race on completed task. | One state transition; calls converge to one ledger award and awarded task. | `growthTasks.test.js` |
| `TC-T5-SAGA-006` | `FR-REWARD-001` | state | Confirm pending/archived or other-family task. | Stable `409 TASK_STATE_CONFLICT` or `403 CHILD_ACCESS_DENIED`; no award call. | `growthTasks.test.js` |

## Gateway, Regression, and Gate

| ID | Requirement | Level | Preconditions and action | Expected result | Automated test |
| --- | --- | --- | --- | --- | --- |
| `TC-T5-GW-001` | Task 5 API | gateway | Request growth-log, knowledge-point and reward prefixes with valid JWT. | Gateway authenticates and proxies each path to progress-service. | `familyTask5Routes.test.js` |
| `TC-T5-GW-002` | `NFR-SEC-003` | gateway | Request `/api/internal/stars/award` through gateway. | No proxy exists; request returns gateway 404. | `familyTask5Routes.test.js` |
| `TC-T5-REG-001` | Task 5 gate | regression | Run the first six commands in test strategy section 10 after Task 5. | All targeted family suites pass. | `family-growth-task5-gate.md` |
| `TC-T5-REG-002` | Task 5 gate | regression | Run exact `npm run test:nocoverage` and compare with v1.2. | No new family-branch failure; all deltas classified. | `family-growth-task5-gate.md` |

## Coverage Summary

| Requirement | Cases |
| --- | --- |
| `FR-LOG-001` | `TC-T5-LOG-001` through `TC-T5-LOG-010` |
| `FR-POINT-001` | `TC-T5-POINT-001` through `TC-T5-POINT-008` |
| `FR-REWARD-001` | `TC-T5-STAR-003` through `TC-T5-STAR-005`, `TC-T5-SAGA-001` through `TC-T5-SAGA-006`, `TC-T5-REWARD-004` |
| `FR-REWARD-002` | `TC-T5-REWARD-001` through `TC-T5-REWARD-011` |
| `NFR-SEC-001` | cross-family and sibling cases in every route suite |
| `NFR-SEC-003` | `TC-T5-STAR-001`, `TC-T5-STAR-002`, `TC-T5-STAR-006`, `TC-T5-GW-002` |
| `NFR-DATA-001` | all model ownership and route query cases |
| `NFR-DATA-002` | star replay/concurrency, saga recovery and all redemption transaction cases |
| `NFR-TIME-001` | `TC-T5-LOG-001`, `TC-T5-LOG-002`, `TC-T5-LOG-008` |

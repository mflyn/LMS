# Task 6 Mistakes and Weekly Reports Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining Task 6 backend scope by implementing family academic mistakes, mistake media references, cutoff-safe source history, deterministic weekly reports, gateway/deployment wiring, and final gate evidence.

**Architecture:** `analytics-service` owns `FamilyMistake`, `FamilyMistakeStateEvent`, and `WeeklyReport`; `progress-service` owns `KnowledgePointMasteryEvent`; cross-service report reads go through a new read-only `backend/common/repositories/familyReadRepository.js`. Mistake media uses the existing Phase 3A `mediaReferenceClient` and the same durable owner-state pattern already used by Child avatars and GrowthTask attachments.

**Tech Stack:** Node.js, Express, Mongoose, MongoDB transactions, Jest, Supertest, `MongoMemoryReplSet`, existing signed gateway identity helpers, existing Task 6 media-reference client.

**Document status:** READY FOR REVIEW
**Design:** `docs/superpowers/specs/2026-06-20-family-growth-task6-design.md`
**Test catalog:** `docs/development/family-growth-task6-test-cases.md`
**Current split:** Private media core, Child avatar, and GrowthTask attachment consumers are implemented; FamilyMistake media, weekly reports, gateway Task 6 public prefixes, deployment validation, and final Task 6 gate remain in this plan.

---

## File Map

| Path | Action | Responsibility |
| --- | --- | --- |
| `backend/services/analytics-service/models/FamilyMistake.js` | Create | Academic-only mistake source model, hidden media owner state, validation, family-first indexes |
| `backend/services/analytics-service/models/FamilyMistakeStateEvent.js` | Create | Immutable reviewed/mastered history for report cutoff projections |
| `backend/services/analytics-service/models/WeeklyReport.js` | Create | Weekly snapshot, freeze fields, feedback fields, unique family/child/week identity |
| `backend/services/analytics-service/services/familyMistakePatch.js` | Create | Strict create/patch parser, role field permissions, canonical media-field patch entries |
| `backend/services/analytics-service/services/familyMistakeMediaService.js` | Create | Durable question/answer media prepare, commit, publication, checked unbind, rollback, and resume |
| `backend/services/analytics-service/services/weeklyReportService.js` | Create | Cutoff calculation, aggregation formulas, deterministic suggestions, freeze/promotion, feedback guard |
| `backend/services/analytics-service/routes/familyMistakes.js` | Create | Public `/api/mistakes` create/list/detail/patch routes with signed gateway auth |
| `backend/services/analytics-service/routes/weeklyReports.js` | Create | Public `/api/reports/weekly` read/generate and feedback routes |
| `backend/services/analytics-service/app.js` | Modify | Inject and mount family mistakes and weekly reports without import-time I/O |
| `backend/services/analytics-service/server.js` | Modify | Validate Task 6 analytics config and construct media/reference/report dependencies only from `startServer` |
| `backend/services/progress-service/models/KnowledgePointMasteryEvent.js` | Create | Immutable mastery-level history owned by progress-service |
| `backend/services/progress-service/routes/knowledgePoints.js` | Modify | Write source update and mastery event atomically for create/update |
| `backend/common/repositories/familyReadRepository.js` | Create | Read-only task, log, point, and mistake projection adapter with family/child/cutoff/timeout enforcement |
| `backend/gateway/server.js` | Modify | Proxy `/api/media`, `/api/mistakes`, and `/api/reports/weekly`; do not proxy internal media reference routes |
| `docker-compose.yml` | Modify | Wire Task 6 runtime environment without committing secrets |
| `deployment/kubernetes/*.yaml` | Modify | Add external-secret references and private media volume/history config checks |
| `docs/development/family-growth-task6-gate.md` | Create | Final Task 6 targeted, regression, baseline, and two-run stability evidence |
| `docs/development/family-growth-task6-implementation-review.md` | Create | Implementation review findings and remediation closure |
| `docs/development/family-growth-requirement-traceability.md` | Modify | Move Task 6 rows from partial/planned to covered only after gate evidence exists |

## Execution Rules

- Keep each task as its own commit. Do not combine model, route, report aggregation, and deployment changes in one commit.
- Use failing tests before production changes for every behavior group.
- Use one `MongoMemoryReplSet` per stateful suite that needs transactions. Do not use standalone `MongoMemoryServer` for mistake state-event, knowledge-point event, or weekly-report snapshot tests.
- Route tests must mount the real app/router with the shared production `errorHandler`; route-local test-only error handlers are forbidden.
- Do not import private Mongoose models across service boundaries. `analytics-service` may read cross-service data only through `familyReadRepository`.
- Do not log correct answers, child explanations, parent notes, signed URLs, storage keys, credentials, operation UUIDs, or Axios errors.

## Task 1: Add Analytics Family Test Harness and Dependency Injection Boundary

**Files:**
- Create: `backend/services/analytics-service/__tests__/helpers/familyAnalyticsFixtures.js`
- Modify: `backend/services/analytics-service/app.js`
- Modify: `backend/services/analytics-service/server.js`
- Test: `backend/services/analytics-service/__tests__/task6Startup.test.js`

- [ ] **Step 1: Write failing startup and injection tests**

Add tests proving `createApp` accepts `familyMistakesRouter` and `weeklyReportsRouter`, imports do not connect/listen, and `startServer` constructs Task 6 dependencies only after transaction-capable Mongo is verified.

```js
test('TC-T6-REG-001 mounts injected Task 6 routers without import-time IO', async () => {
  const familyMistakesRouter = require('express').Router();
  const weeklyReportsRouter = require('express').Router();
  familyMistakesRouter.get('/probe', (req, res) => res.json({ ok: 'mistakes' }));
  weeklyReportsRouter.get('/probe', (req, res) => res.json({ ok: 'reports' }));

  const app = createApp({ familyMistakesRouter, weeklyReportsRouter, logger: silentLogger });

  await request(app).get('/api/mistakes/probe').expect(200, { ok: 'mistakes' });
  await request(app).get('/api/reports/weekly/probe').expect(200, { ok: 'reports' });
});
```

- [ ] **Step 2: Run startup RED**

Run:

```bash
npx jest --config backend/services/analytics-service/jest.config.js --runInBand task6Startup
```

Expected: fail because `createApp` does not accept or mount the Task 6 routers.

- [ ] **Step 3: Implement injectable app mounting**

Modify `createApp` to accept optional routers and mount them before legacy analytics routes.

```js
const createApp = ({
  logger = createLogger('analytics-service'),
  io = null,
  familyMistakesRouter = null,
  weeklyReportsRouter = null
} = {}) => {
  const app = express();
  app.locals.logger = logger;
  app.locals.serviceName = 'analytics-service';
  app.locals.io = io;
  app.use(cors());
  app.use(express.json());
  app.use(requestTracker);
  if (familyMistakesRouter) app.use('/api/mistakes', familyMistakesRouter);
  if (weeklyReportsRouter) app.use('/api/reports/weekly', weeklyReportsRouter);
  return mountLegacyAnalyticsRoutes(app);
};
```

- [ ] **Step 4: Add fixture helpers**

Create signed identity helpers and fixed ObjectIds for two families.

```js
const FAMILY_A_ID = '665000000000000000000001';
const CHILD_A1_ID = '665000000000000000000011';
const CHILD_A2_ID = '665000000000000000000012';
const FAMILY_B_ID = '665000000000000000000002';
const CHILD_B1_ID = '665000000000000000000021';

const parentA = () => ({ id: '665000000000000000000101', role: 'parent', familyId: FAMILY_A_ID });
const childA1 = () => ({ id: CHILD_A1_ID, role: 'student', familyId: FAMILY_A_ID, childId: CHILD_A1_ID });
```

- [ ] **Step 5: Run startup GREEN and commit**

Run:

```bash
npx jest --config backend/services/analytics-service/jest.config.js --runInBand task6Startup
git add backend/services/analytics-service/app.js backend/services/analytics-service/server.js backend/services/analytics-service/__tests__/task6Startup.test.js backend/services/analytics-service/__tests__/helpers/familyAnalyticsFixtures.js
git commit -m "test: add analytics task6 app injection boundary"
```

Expected: startup suite passes and no open handle is reported.

## Task 2: Add FamilyMistake Model and Immutable State Events

**Files:**
- Create: `backend/services/analytics-service/models/FamilyMistake.js`
- Create: `backend/services/analytics-service/models/FamilyMistakeStateEvent.js`
- Test: `backend/services/analytics-service/__tests__/familyMistakes.test.js`

- [ ] **Step 1: Write failing model tests for `TC-T6-MISTAKE-001` and `TC-T6-MISTAKE-002`**

Cover minimal/complete valid academic mistakes, default booleans, required family/child IDs, invalid non-academic dimension, invalid LocalDate, bounded text, and hidden media state.

```js
test('TC-T6-MISTAKE-001 persists a minimal academic mistake with default review state', async () => {
  const mistake = await FamilyMistake.create({
    familyId: FAMILY_A_ID,
    childId: CHILD_A1_ID,
    subject: 'math',
    reason: 'concept_misunderstanding',
    createdBy: PARENT_A_ID,
    updatedBy: PARENT_A_ID
  });

  expect(mistake.dimension).toBe('academic');
  expect(mistake.corrected).toBe(false);
  expect(mistake.reviewed).toBe(false);
  expect(mistake.mastered).toBe(false);
});
```

- [ ] **Step 2: Run model RED**

Run:

```bash
npx jest --config backend/services/analytics-service/jest.config.js --runInBand familyMistakes --testNamePattern='TC-T6-MISTAKE-001|TC-T6-MISTAKE-002'
```

Expected: fail because `FamilyMistake` and `FamilyMistakeStateEvent` do not exist.

- [ ] **Step 3: Implement model schemas and indexes**

Use `select: false` for owner media state fields and reject client-writable binding fields through schema validation.

```js
const familyMistakeSchema = new Schema({
  familyId: { type: Schema.Types.ObjectId, required: true, index: true },
  childId: { type: Schema.Types.ObjectId, required: true, index: true },
  dimension: { type: String, enum: ['academic'], default: 'academic', immutable: true },
  subject: { type: String, required: true, trim: true, maxlength: 100 },
  reason: { type: String, required: true, trim: true, maxlength: 50 },
  reviewReminderDate: { type: String, validate: isValidLocalDate },
  corrected: { type: Boolean, default: false },
  reviewed: { type: Boolean, default: false },
  mastered: { type: Boolean, default: false },
  questionMediaId: { type: Schema.Types.ObjectId },
  childAnswerMediaId: { type: Schema.Types.ObjectId },
  mediaReferenceState: { type: String, enum: ['none', 'pending', 'bound'], default: 'none', select: false },
  mediaBindingOperationId: { type: String, select: false },
  mediaPendingPatch: { type: [pendingPatchSchema], select: false, default: undefined },
  createdBy: { type: Schema.Types.ObjectId, required: true },
  updatedBy: { type: Schema.Types.ObjectId, required: true }
}, { timestamps: true });
```

Create immutable state events:

```js
const familyMistakeStateEventSchema = new Schema({
  familyId: { type: Schema.Types.ObjectId, required: true },
  childId: { type: Schema.Types.ObjectId, required: true },
  mistakeId: { type: Schema.Types.ObjectId, required: true },
  reviewed: { type: Boolean, required: true },
  mastered: { type: Boolean, required: true },
  reviewReminderDate: { type: String },
  effectiveAt: { type: Date, required: true },
  operationId: { type: String, required: true }
}, { timestamps: true });
familyMistakeStateEventSchema.index({ familyId: 1, mistakeId: 1, operationId: 1 }, { unique: true });
```

- [ ] **Step 4: Run model GREEN and commit**

Run:

```bash
npx jest --config backend/services/analytics-service/jest.config.js --runInBand familyMistakes --testNamePattern='TC-T6-MISTAKE-001|TC-T6-MISTAKE-002'
git add backend/services/analytics-service/models/FamilyMistake.js backend/services/analytics-service/models/FamilyMistakeStateEvent.js backend/services/analytics-service/__tests__/familyMistakes.test.js
git commit -m "feat: add family mistake persistence model"
```

Expected: selected model tests pass.

## Task 3: Add Mistake Role Parser, Routes, and State-Event Transactions

**Files:**
- Create: `backend/services/analytics-service/services/familyMistakePatch.js`
- Create: `backend/services/analytics-service/routes/familyMistakes.js`
- Modify: `backend/services/analytics-service/app.js`
- Test: `backend/services/analytics-service/__tests__/familyMistakes.test.js`

- [ ] **Step 1: Write failing route tests for `TC-T6-MISTAKE-003` through `TC-T6-MISTAKE-008`, `013`, and `014`**

Cover parent create, child create/patch allowed fields, forbidden child fields, cross-family/sibling isolation, filters, pagination, invalid fields, and atomic state-event rollback.

```js
test('TC-T6-MISTAKE-005 child cannot patch parent-owned mistake fields', async () => {
  const mistake = await seedMistake({ familyId: FAMILY_A_ID, childId: CHILD_A1_ID });

  const response = await request(app)
    .patch(`/api/mistakes/${mistake._id}`)
    .set(signedHeaders(childA1()))
    .send({ subject: 'science', parentNote: 'private parent note' })
    .expect(403);

  expect(response.body.error.code).toBe('FIELD_ACCESS_DENIED');
  const unchanged = await FamilyMistake.findById(mistake._id);
  expect(unchanged.subject).toBe('math');
  expect(unchanged.parentNote).toBeUndefined();
});
```

- [ ] **Step 2: Run route RED**

Run:

```bash
npx jest --config backend/services/analytics-service/jest.config.js --runInBand familyMistakes
```

Expected: route and service tests fail because parser/routes are absent.

- [ ] **Step 3: Implement strict parser and role permissions**

Use field allowlists with explicit role decisions.

```js
const PARENT_CREATE_FIELDS = [
  'childId', 'subject', 'knowledgePointId', 'knowledgePointName', 'questionMediaId',
  'childAnswerMediaId', 'correctAnswer', 'parentNote', 'childExplanation', 'reason',
  'corrected', 'reviewed', 'mastered', 'reviewReminderDate'
];
const CHILD_CREATE_FIELDS = [
  'childId', 'subject', 'reason', 'childAnswerMediaId',
  'childExplanation', 'corrected', 'reviewed', 'mastered', 'reviewReminderDate'
];
const CHILD_PATCH_FIELDS = ['childAnswerMediaId', 'childExplanation', 'corrected', 'reviewed', 'mastered', 'reviewReminderDate'];
```

- [ ] **Step 4: Implement routes with transaction-backed state events**

Create and every review-state patch must save the source and event in the same session.

```js
await connection.transaction(async (session) => {
  await mistake.save({ session });
  await FamilyMistakeStateEvent.create([{
    familyId: mistake.familyId,
    childId: mistake.childId,
    mistakeId: mistake._id,
    reviewed: mistake.reviewed,
    mastered: mistake.mastered,
    reviewReminderDate: mistake.reviewReminderDate,
    effectiveAt: now(),
    operationId
  }], { session });
});
```

- [ ] **Step 5: Run route GREEN and commit**

Run:

```bash
npx jest --config backend/services/analytics-service/jest.config.js --runInBand familyMistakes
git add backend/services/analytics-service/services/familyMistakePatch.js backend/services/analytics-service/routes/familyMistakes.js backend/services/analytics-service/app.js backend/services/analytics-service/__tests__/familyMistakes.test.js
git commit -m "feat: expose family mistake routes"
```

Expected: all non-media FamilyMistake cases pass.

## Task 4: Add FamilyMistake Media Reference Saga

**Files:**
- Create: `backend/services/analytics-service/services/familyMistakeMediaService.js`
- Modify: `backend/services/analytics-service/services/familyMistakePatch.js`
- Modify: `backend/services/analytics-service/routes/familyMistakes.js`
- Test: `backend/services/analytics-service/__tests__/familyMistakeMediaSaga.test.js`
- Test: `backend/services/analytics-service/__tests__/familyMistakes.test.js`

- [ ] **Step 1: Write failing media saga tests for `TC-T6-MISTAKE-009` through `TC-T6-MISTAKE-012` and mistake portions of `TC-T6-MEDIA-018`**

Cover wrong-purpose/deleted/sibling/cross-family/missing media, lost commit response, replacement, removal, best-effort unbind after persistence failure, pending detail/patch recovery, and raw URL rejection.

```js
test('TC-T6-MISTAKE-010 detail resumes a pending question media commit', async () => {
  mediaReferenceClient.commit.mockRejectedValueOnce(pendingMediaError());
  const createResponse = await createMistakeWithMedia({ questionMediaId: QUESTION_MEDIA_A1 });
  expect(createResponse.status).toBe(503);
  expect(createResponse.body.error.code).toBe('MEDIA_REFERENCE_PENDING');

  mediaReferenceClient.commit.mockResolvedValueOnce({ references: [{ mediaId: QUESTION_MEDIA_A1 }] });
  const detailResponse = await request(app)
    .get(`/api/mistakes/${createResponse.body.error.details.resourceId}`)
    .set(signedHeaders(parentA()))
    .expect(200);

  expect(detailResponse.body.data.mistake.questionMediaId).toBe(QUESTION_MEDIA_A1);
});
```

- [ ] **Step 2: Run media saga RED**

Run:

```bash
npx jest --config backend/services/analytics-service/jest.config.js --runInBand familyMistakeMediaSaga familyMistakes --testNamePattern='TC-T6-MISTAKE-009|TC-T6-MISTAKE-010|TC-T6-MISTAKE-011|TC-T6-MISTAKE-012|TC-T6-MEDIA-018'
```

Expected: fail because `familyMistakeMediaService` does not exist and routes do not bind media.

- [ ] **Step 3: Implement owner-state service**

Use the same state shape as Child/GrowthTask: claim intent, prepare additions, persist owner fields, commit, publish public fields, unbind removals, finalize, and resume by detail/patch before normal mutation.

```js
const FIELD_PURPOSES = {
  questionMediaId: 'mistake_question',
  childAnswerMediaId: 'mistake_answer'
};

const toPrepareReferences = ({ familyId, childId, mistakeId, desiredPatch, operationId }) =>
  Object.entries(FIELD_PURPOSES)
    .filter(([field]) => desiredPatch[field])
    .map(([field, purpose]) => ({
      familyId,
      childId,
      mediaId: desiredPatch[field],
      resourceType: 'family_mistake',
      resourceId: mistakeId,
      field,
      purpose,
      operationId
    }));
```

- [ ] **Step 4: Integrate routes with sanitized pending/stable error envelopes**

Map known stable errors from the media client to approved response codes; unknown remote or owner-transition uncertainty returns `503 MEDIA_REFERENCE_PENDING` with only `resourceId`.

```js
if (error.code === 'MEDIA_REFERENCE_PENDING') {
  return sendFamilyError(res, 503, 'MEDIA_REFERENCE_PENDING', 'Media reference operation is pending', {
    resourceId: error.resourceId
  });
}
```

- [ ] **Step 5: Run media saga GREEN and commit**

Run:

```bash
npx jest --config backend/services/analytics-service/jest.config.js --runInBand familyMistakeMediaSaga familyMistakes
git add backend/services/analytics-service/services/familyMistakeMediaService.js backend/services/analytics-service/services/familyMistakePatch.js backend/services/analytics-service/routes/familyMistakes.js backend/services/analytics-service/__tests__/familyMistakeMediaSaga.test.js backend/services/analytics-service/__tests__/familyMistakes.test.js
git commit -m "feat: bind family mistake media references"
```

Expected: all FamilyMistake and mistake-media cases pass with no leaked handles.

## Task 5: Add KnowledgePoint Mastery History in Progress Service

**Files:**
- Create: `backend/services/progress-service/models/KnowledgePointMasteryEvent.js`
- Modify: `backend/services/progress-service/routes/knowledgePoints.js`
- Test: `backend/services/progress-service/__tests__/knowledgePointHistory.test.js`
- Test: `backend/services/progress-service/__tests__/knowledgePoints.test.js`

- [ ] **Step 1: Write failing history tests for `TC-T6-REPO-007`**

Cover create event, mastery update event, idempotent operation IDs, and rollback when event persistence fails.

```js
test('TC-T6-REPO-007 writes source and mastery event atomically', async () => {
  const createResponse = await createKnowledgePoint({ masteryLevel: 'learning' });
  const pointId = createResponse.body.data.knowledgePoint.knowledgePointId;

  await patchKnowledgePoint(pointId, { masteryLevel: 'needs_review' }).expect(200);

  const events = await KnowledgePointMasteryEvent.find({ knowledgePointId: pointId }).sort({ effectiveAt: 1 });
  expect(events.map((event) => event.masteryLevel)).toEqual(['learning', 'needs_review']);
});
```

- [ ] **Step 2: Run history RED**

Run:

```bash
npx jest --config backend/services/progress-service/jest.config.js --runInBand knowledgePointHistory knowledgePoints
```

Expected: fail because no `KnowledgePointMasteryEvent` exists and route writes are not transactional.

- [ ] **Step 3: Implement event model and transactional writes**

```js
const knowledgePointMasteryEventSchema = new Schema({
  familyId: { type: Schema.Types.ObjectId, required: true },
  childId: { type: Schema.Types.ObjectId, required: true },
  knowledgePointId: { type: Schema.Types.ObjectId, required: true },
  dimension: { type: String, required: true },
  subject: { type: String, default: '' },
  area: { type: String, default: '' },
  name: { type: String, required: true },
  masteryLevel: { type: String, required: true },
  effectiveAt: { type: Date, required: true },
  operationId: { type: String, required: true }
}, { timestamps: true });
knowledgePointMasteryEventSchema.index({ familyId: 1, knowledgePointId: 1, operationId: 1 }, { unique: true });
```

- [ ] **Step 4: Run progress GREEN and commit**

Run:

```bash
npx jest --config backend/services/progress-service/jest.config.js --runInBand knowledgePointHistory knowledgePoints
git add backend/services/progress-service/models/KnowledgePointMasteryEvent.js backend/services/progress-service/routes/knowledgePoints.js backend/services/progress-service/__tests__/knowledgePointHistory.test.js backend/services/progress-service/__tests__/knowledgePoints.test.js
git commit -m "feat: record knowledge point mastery history"
```

Expected: history and existing knowledge-point suites pass.

## Task 6: Add Read-Only Family Projection Repository

**Files:**
- Create: `backend/common/repositories/familyReadRepository.js`
- Create: `backend/common/repositories/__tests__/familyReadRepository.test.js`

- [ ] **Step 1: Write failing repository tests for `TC-T6-REPO-001` through `TC-T6-REPO-006`**

Cover required filters, task/log/point/mistake projection shapes, cutoff event projection, source timeout, source error normalization, and no private model imports from analytics.

```js
test('TC-T6-REPO-001 rejects unscoped task reads before querying', async () => {
  const repository = createFamilyReadRepository({ connection, timeoutMs: 20 });

  await expect(repository.listTaskProjection({
    childId: CHILD_A1_ID,
    from: '2026-06-22',
    to: '2026-06-28',
    cutoff: new Date('2026-06-29T00:00:00.000Z'),
    timeoutMs: 20
  })).rejects.toMatchObject({ code: 'UNSCOPED_FAMILY_READ' });
});
```

- [ ] **Step 2: Run repository RED**

Run:

```bash
npx jest --config backend/jest.family-common.config.js --runInBand familyReadRepository
```

Expected: fail because repository does not exist.

- [ ] **Step 3: Implement bounded read methods**

Expose only the approved methods; use `connection.collection(name).find(query, { projection })`, `maxTimeMS(timeoutMs)`, `toArray()`, and normalized errors.

```js
const listTaskProjection = async ({ familyId, childId, from, to, cutoff, timeoutMs }) => {
  requireScope({ familyId, childId, from, to, cutoff, timeoutMs });
  return withSourceError('tasks', () => connection.collection('growthtasks')
    .find({
      familyId: objectId(familyId),
      childId: objectId(childId),
      dueDate: { $gte: from, $lte: to },
      createdAt: { $lt: cutoff }
    }, { projection: TASK_PROJECTION })
    .maxTimeMS(timeoutMs)
    .toArray());
};
```

- [ ] **Step 4: Run repository GREEN and commit**

Run:

```bash
npx jest --config backend/jest.family-common.config.js --runInBand familyReadRepository
git add backend/common/repositories/familyReadRepository.js backend/common/repositories/__tests__/familyReadRepository.test.js
git commit -m "feat: add family report read repository"
```

Expected: repository tests pass and analytics imports no private homework/progress models.

## Task 7: Add WeeklyReport Model and Aggregation Service

**Files:**
- Create: `backend/services/analytics-service/models/WeeklyReport.js`
- Create: `backend/services/analytics-service/services/weeklyReportService.js`
- Test: `backend/services/analytics-service/__tests__/weeklyReports.test.js`

- [ ] **Step 1: Write failing service tests for `TC-T6-REPORT-001` through `TC-T6-REPORT-015`**

Cover Monday validation, timezone cutoff, record days, completion rates, cancellation cutoff, task-created-after-cutoff exclusion, zero planned tasks, duration source precedence, mistake reason ordering, review-point history, deterministic suggestions, frozen snapshots, current-to-ended promotion, concurrency, and source failure.

```js
test('TC-T6-REPORT-003 computes completion rates with explicit dimension zeros', async () => {
  repository.listTaskProjection.mockResolvedValue(makeThirtyTaskFixture({ completedBeforeCutoff: 24 }));
  repository.listGrowthLogProjection.mockResolvedValue([]);
  repository.listMistakeProjection.mockResolvedValue([]);
  repository.listKnowledgePointProjection.mockResolvedValue([]);

  const report = await service.generateOrRead({ user: parentA(), childId: CHILD_A1_ID, weekStart: '2026-06-22' });

  expect(report.statistics.taskCompletionRate).toBe(80);
  expect(report.statistics.dimensionTaskStats).toHaveProperty('moral');
  expect(report.statistics.dimensionTaskStats.artistic).toEqual({ planned: 0, completed: 0 });
});
```

- [ ] **Step 2: Run weekly RED**

Run:

```bash
npx jest --config backend/services/analytics-service/jest.config.js --runInBand weeklyReports
```

Expected: fail because `WeeklyReport` and `weeklyReportService` do not exist.

- [ ] **Step 3: Implement model and pure formula helpers**

Use explicit statistics shape and freeze fields.

```js
const DIMENSIONS = ['moral', 'academic', 'physical', 'artistic', 'labor'];
const completionRate = (completed, planned) => (
  planned === 0 ? null : Math.round((completed * 10000) / planned) / 100
);
const emptyDimensionStats = () => Object.fromEntries(
  DIMENSIONS.map((dimension) => [dimension, { planned: 0, completed: 0, durationMinutes: 0 }])
);
```

- [ ] **Step 4: Implement current and ended week snapshot rules**

Ended week generation inserts `frozen=true` or promotes `frozen=false` with compare-and-set. Duplicate-key and compare-and-set losers read the frozen winner; no ended non-frozen report is returned.

```js
const promoteCurrentToFrozen = async ({ reportId, snapshot, session }) => WeeklyReport.findOneAndUpdate(
  { _id: reportId, frozen: false },
  { $set: { ...snapshot, frozen: true } },
  { new: true, session }
);
```

- [ ] **Step 5: Run weekly GREEN and commit**

Run:

```bash
npx jest --config backend/services/analytics-service/jest.config.js --runInBand weeklyReports
git add backend/services/analytics-service/models/WeeklyReport.js backend/services/analytics-service/services/weeklyReportService.js backend/services/analytics-service/__tests__/weeklyReports.test.js
git commit -m "feat: generate deterministic weekly reports"
```

Expected: all report service cases pass.

## Task 8: Expose Weekly Report Routes and Feedback Contract

**Files:**
- Create: `backend/services/analytics-service/routes/weeklyReports.js`
- Modify: `backend/services/analytics-service/app.js`
- Test: `backend/services/analytics-service/__tests__/weeklyReports.test.js`

- [ ] **Step 1: Write failing route tests for `TC-T6-REPORT-016` through `TC-T6-REPORT-018`**

Cover parent/child access, cross-family/sibling denial, parent-only feedback, forbidden statistics patch fields, unknown report ID, repeated feedback on a frozen report, and stable production error envelopes.

```js
test('TC-T6-REPORT-017 child cannot patch report feedback', async () => {
  const report = await seedFrozenWeeklyReport({ familyId: FAMILY_A_ID, childId: CHILD_A1_ID });

  const response = await request(app)
    .patch(`/api/reports/weekly/${report._id}/feedback`)
    .set(signedHeaders(childA1()))
    .send({ parentNote: 'not allowed' })
    .expect(403);

  expect(response.body.error.code).toBe('CHILD_ACCESS_DENIED');
});
```

- [ ] **Step 2: Run route RED**

Run:

```bash
npx jest --config backend/services/analytics-service/jest.config.js --runInBand weeklyReports --testNamePattern='TC-T6-REPORT-016|TC-T6-REPORT-017|TC-T6-REPORT-018'
```

Expected: fail because route is not mounted.

- [ ] **Step 3: Implement report routes**

Expose:

```text
GET /api/reports/weekly?childId=&weekStart=
PATCH /api/reports/weekly/:reportId/feedback
```

Use `authenticateGateway`, role-based child resolution, `sendFamilyError`, and sanitized `logFamilyOperation`.

- [ ] **Step 4: Run route GREEN and commit**

Run:

```bash
npx jest --config backend/services/analytics-service/jest.config.js --runInBand weeklyReports
git add backend/services/analytics-service/routes/weeklyReports.js backend/services/analytics-service/app.js backend/services/analytics-service/__tests__/weeklyReports.test.js
git commit -m "feat: expose weekly report routes"
```

Expected: all weekly report cases pass.

## Task 9: Add Gateway, Deployment, and Configuration Gate

**Files:**
- Create: `backend/gateway/__tests__/familyTask6Routes.test.js`
- Modify: `backend/gateway/server.js`
- Create: `backend/common/deployment/__tests__/task6Deployment.test.js`
- Modify: `docker-compose.yml`
- Modify: `deployment/kubernetes/kustomization.yaml`
- Modify: `deployment/kubernetes/resource-service-deployment.yaml`
- Modify: `deployment/kubernetes/analytics-service-deployment.yaml`
- Modify: `deployment/kubernetes/gateway-deployment.yaml`

- [ ] **Step 1: Write failing gateway tests for `TC-T6-GW-001` through `TC-T6-GW-003`**

Assert public prefixes proxy and internal media reference paths do not.

```js
test('TC-T6-GW-001 proxies Task 6 public family routes', async () => {
  await expectProxy('/api/media/probe', 'RESOURCE_SERVICE_URL');
  await expectProxy('/api/mistakes/probe', 'ANALYTICS_SERVICE_URL');
  await expectProxy('/api/reports/weekly/probe', 'ANALYTICS_SERVICE_URL');
});
```

- [ ] **Step 2: Write failing deployment tests for `TC-T6-REG-002`**

Validate private media root is non-static, external secrets are referenced without committed values, `REPORT_HISTORY_AVAILABLE_FROM` is present for analytics, and `MEDIA_REFERENCE_SERVICE_TOKEN` is supplied only to resource/user/homework/analytics services.

- [ ] **Step 3: Run gateway/deployment RED**

Run:

```bash
npm test --prefix backend/gateway -- --runInBand familyTask6Routes
npx jest --config backend/jest.family-common.config.js --runInBand task6Deployment
```

Expected: fail because Task 6 routes and deployment checks are not wired.

- [ ] **Step 4: Implement proxy and deployment wiring**

Add only these public proxy mappings:

```js
app.use('/api/media', createProxyMiddleware({ target: process.env.RESOURCE_SERVICE_URL, changeOrigin: true }));
app.use('/api/mistakes', createProxyMiddleware({ target: process.env.ANALYTICS_SERVICE_URL, changeOrigin: true }));
app.use('/api/reports/weekly', createProxyMiddleware({ target: process.env.ANALYTICS_SERVICE_URL, changeOrigin: true }));
```

Do not add any `/api/internal/media/references` proxy mapping.

- [ ] **Step 5: Run gateway/deployment GREEN and commit**

Run:

```bash
npm test --prefix backend/gateway -- --runInBand familyTask6Routes
npx jest --config backend/jest.family-common.config.js --runInBand task6Deployment
git add backend/gateway/server.js backend/gateway/__tests__/familyTask6Routes.test.js backend/common/deployment/__tests__/task6Deployment.test.js docker-compose.yml deployment/kubernetes/kustomization.yaml deployment/kubernetes/resource-service-deployment.yaml deployment/kubernetes/analytics-service-deployment.yaml deployment/kubernetes/gateway-deployment.yaml
git commit -m "feat: wire task6 gateway and deployment config"
```

Expected: gateway and deployment tests pass without committed secret values.

## Task 10: Run Task 6 Final Gate and Update Traceability

**Files:**
- Create: `docs/development/family-growth-task6-implementation-review.md`
- Create: `docs/development/family-growth-task6-gate.md`
- Modify: `docs/development/family-growth-requirement-traceability.md`
- Modify: `docs/product/family-learning-tracker.md`
- Modify: `docs/superpowers/plans/2026-07-07-family-growth-task6-mistakes-weekly-reports.md`

- [ ] **Step 1: Run targeted Task 6 suites**

Run:

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand familyMedia mediaReferences mediaCleanup familyMediaPrivacy privateMediaStore mediaCapability mediaModels
npx jest --config backend/services/user-service/jest.config.js --runInBand User.mediaReferences childAvatarMediaService childMediaReferences family
npx jest --config backend/services/homework-service/jest.config.js --runInBand GrowthTask.mediaReferences growthTaskAttachmentMediaService growthTaskMediaReferences growthTasks
npx jest --config backend/services/progress-service/jest.config.js --runInBand knowledgePointHistory knowledgePoints growthLogs rewards
npx jest --config backend/services/analytics-service/jest.config.js --runInBand task6Startup familyMistakes familyMistakeMediaSaga weeklyReports
npx jest --config backend/jest.family-common.config.js --runInBand familyReadRepository task6Deployment
npm test --prefix backend/gateway -- --runInBand familyTask6Routes
```

Expected: every command exits 0. Record suite/test counts in `family-growth-task6-gate.md`.

- [ ] **Step 2: Run full family regression twice from the same commit**

Run twice:

```bash
npm run test:family-regression
```

Expected: both runs exit 0 with identical passing suite/test totals and no leaked-handle warning.

- [ ] **Step 3: Run root baseline command and compare**

Run:

```bash
npm run test:nocoverage
```

Expected: command completes; any legacy failures match the approved baseline category and no Task 3-6 family project fails.

- [ ] **Step 4: Run static evidence checks**

Run:

```bash
git diff --check
rg -n "\b(describe|it|test)\.skip\(|\.only\(|test-only error|process\.exit" \
  backend/services/analytics-service backend/services/progress-service backend/common/repositories backend/gateway/__tests__/familyTask6Routes.test.js
rg -n "TC-T6-(MISTAKE|REPORT|REPO|GW|REG)-" \
  backend/services/analytics-service/__tests__ backend/services/progress-service/__tests__ backend/common/repositories/__tests__ backend/gateway/__tests__
```

Expected: whitespace check passes; no Task 6 test-control violation is present; every required case ID appears in executable tests.

- [ ] **Step 5: Write implementation review and gate evidence**

Record final commands, exit codes, suite/test counts, review findings, and remediations. The review must explicitly close:

```text
FR-MISTAKE-001
FR-REPORT-001
FR-MEDIA-001 remaining FamilyMistake consumer scope
FR-MEDIA-002 remaining FamilyMistake unbind/delete interaction
NFR-PRIVACY-001
NFR-DATA-001
NFR-SEC-001
NFR-TIME-001
```

- [ ] **Step 6: Update traceability only after evidence is current**

Change Task 6 rows to `COVERED` only after Step 1 through Step 5 pass on the final candidate commit.

- [ ] **Step 7: Mark this plan completed and commit documentation**

Run:

```bash
git add docs/development/family-growth-task6-implementation-review.md docs/development/family-growth-task6-gate.md docs/development/family-growth-requirement-traceability.md docs/product/family-learning-tracker.md docs/superpowers/plans/2026-07-07-family-growth-task6-mistakes-weekly-reports.md
git commit -m "docs: record task6 final gate evidence"
```

Expected: final Task 6 artifacts are current and no required Task 6 row remains partial/planned.

## Review Checklist Before Coding

- [ ] Product owner confirms this split keeps Task 6 backend scope before Task 7 notification work.
- [ ] The media traceability update remains `PARTIAL` until FamilyMistake media and gateway/deployment cases pass.
- [ ] No frontend or notification work is included in this plan.
- [ ] Every Task 6 requirement has a task and final gate step.
- [ ] Every route test uses production error handling and signed gateway identity.
- [ ] Every state history test uses a replica-set transaction lifecycle.

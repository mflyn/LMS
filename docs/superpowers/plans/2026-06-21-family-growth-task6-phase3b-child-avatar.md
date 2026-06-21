# Task 6 Phase 3B Child Avatar Consumer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Document status:** REVIEW_PENDING
**Design:** `docs/superpowers/specs/2026-06-21-family-growth-task6-phase3b-child-avatar-design.md`
**Test cases:** `docs/development/family-growth-task6-phase3b-test-cases.md`

**Goal:** Add a durable, recoverable `Child.avatarMediaId` consumer that exposes only committed media, replaces and removes references in generation-safe order, and preserves the existing family Child workflows.

**Architecture:** The User document stores one owner-local mutation intent before any resource-service call. A focused state service performs compare-and-set owner transitions and replays the Phase 3A media-reference client; a canonical patch builder prevents request keys from becoming Mongo paths. Factory-based controller and router composition inject the service for tests and later deployment wiring while the default composition rejects avatar writes as disabled.

**Tech Stack:** Node.js, Express, Mongoose, MongoMemoryServer, Jest, Supertest, Phase 3A `mediaReferenceClient`

---

## File Map

| File | Responsibility |
| --- | --- |
| `backend/common/models/User.js` | Additive Child avatar state schema and model invariants |
| `backend/services/user-service/services/childProfilePatch.js` | Strict request whitelist and canonical Mongo update paths |
| `backend/services/user-service/services/childAvatarMediaService.js` | Durable claim, prepare/commit, public switch, checked unbind, resume, and CAS conflict handling |
| `backend/services/user-service/controllers/familyController.js` | Authorization, validation, service invocation, safe Child view, and error mapping |
| `backend/services/user-service/routes/children.js` | Injectable Child router factory with backward-compatible default export |
| `backend/services/user-service/routes/index.js` | Injectable user-service route composition with backward-compatible default export |
| `backend/services/user-service/__tests__/models/User.mediaReferences.test.js` | `TC-T6-MEDIA-016D` model evidence |
| `backend/services/user-service/__tests__/services/childAvatarMediaService.test.js` | State-machine, recovery, ordering, atomic patch, and concurrency evidence |
| `backend/services/user-service/__tests__/routes/childMediaReferences.test.js` | Authorization, public contract, disabled mode, errors, privacy, and read behavior |
| `backend/services/user-service/__tests__/routes/children.test.js` | Existing Child/PIN/pagination regression assertions |

### Task 1: Add Child Avatar Persistence Invariants

**Files:**
- Modify: `backend/common/models/User.js`
- Create: `backend/services/user-service/__tests__/models/User.mediaReferences.test.js`

- [ ] **Step 1: Write `TC-T6-MEDIA-016D` failing model tests**

Create real-model tests for legacy defaults, valid `none|pending|bound` documents, hidden-field selection, malformed UUIDs, incomplete ID/generation pairs, invalid phase/state combinations, and non-canonical pending patch paths. Use fixed IDs and assert hidden fields require explicit selection:

```js
const hidden = [
  '+childProfile.avatarMediaBindingOperationId',
  '+childProfile.mediaBindingOperationId',
  '+childProfile.avatarMediaPendingId',
  '+childProfile.avatarMediaPreviousId',
  '+childProfile.avatarMediaPreviousBindingOperationId',
  '+childProfile.mediaBindingPhase',
  '+childProfile.mediaPendingProfilePatch'
].join(' ');

const normal = await User.findById(child._id).lean();
expect(normal.childProfile.mediaBindingOperationId).toBeUndefined();
const internal = await User.findById(child._id).select(hidden).lean();
expect(internal.childProfile.mediaBindingOperationId).toBe(OPERATION_A);
```

- [ ] **Step 2: Run model RED**

```bash
npx jest --config backend/services/user-service/jest.config.js --runInBand User.mediaReferences
```

Expected: FAIL because the avatar media state paths do not exist.

- [ ] **Step 3: Add the schema fields and document validator**

Add the design fields under `childProfile`. Use the existing ObjectId type, UUID pattern, `select: false` for all internal paths, and `mediaReferenceState` default `none`. Define the pending patch entry as a strict sub-schema:

```js
const childPendingPatchSchema = new Schema({
  path: {
    type: String,
    required: true,
    enum: [
      'name', 'grade', 'childProfile.nickname', 'childProfile.grade',
      'childProfile.school', 'childProfile.textbookVersion',
      'childProfile.interests', 'childProfile.weakSubjects',
      'childProfile.sportsPreferences', 'childProfile.artInterests',
      'childProfile.laborHabits', 'childProfile.moralGoals'
    ]
  },
  value: { type: Schema.Types.Mixed }
}, { _id: false, strict: 'throw' });
```

Add a `pre('validate')` invariant helper that treats missing legacy state as `none`, requires every patch entry to own a `value` property (including an explicit null), requires ID/generation pairs together, requires pending operation/phase metadata only in `pending`, and rejects pending metadata in `none|bound`. The helper must accept `avatarMediaPendingId=null` during removal because `mediaReferenceState=pending` distinguishes removal from no intent.

- [ ] **Step 4: Run model GREEN and existing model regression**

```bash
npx jest --config backend/services/user-service/jest.config.js --runInBand User.mediaReferences User.test
```

Expected: new model tests and the non-ignored User model suite pass.

- [ ] **Step 5: Commit the model contract**

```bash
git add backend/common/models/User.js backend/services/user-service/__tests__/models/User.mediaReferences.test.js
git commit -m "feat: add child avatar media state"
```

### Task 2: Build a Canonical Child Profile Patch

**Files:**
- Create: `backend/services/user-service/services/childProfilePatch.js`
- Create: `backend/services/user-service/__tests__/services/childAvatarMediaService.test.js`

- [ ] **Step 1: Write failing patch-builder cases from `016J` and `018A`**

Assert that a valid body produces fixed update entries and mirrors, that falsy valid values are retained, and that unknown/dotted/nested/internal/raw-avatar keys fail with `400 VALIDATION_ERROR`:

```js
expect(buildChildProfilePatch({
  name: '小明', grade: 4, interests: [], avatarMediaId: MEDIA_B
})).toEqual({
  requestedAvatarMediaId: MEDIA_B,
  hasAvatarMutation: true,
  entries: [
    { path: 'name', value: '小明' },
    { path: 'childProfile.nickname', value: '小明' },
    { path: 'grade', value: 4 },
    { path: 'childProfile.grade', value: 4 },
    { path: 'childProfile.interests', value: [] }
  ]
});
```

Cover `avatar`, `childProfile`, `$set`, dotted keys, arrays/objects for `avatarMediaId`, malformed ObjectIds, and every internal field name.

- [ ] **Step 2: Run patch-builder RED**

```bash
npx jest --config backend/services/user-service/jest.config.js --runInBand childAvatarMediaService --testNamePattern='016J|018A'
```

Expected: FAIL because `childProfilePatch` does not exist.

- [ ] **Step 3: Implement strict parsing and canonical entries**

Export `buildChildProfilePatch(body)`, `entriesToMongoSet(entries)`, and `applyEntries(document, entries)`. Start by rejecting any key outside this exact public set:

```js
const PUBLIC_FIELDS = new Set([
  'name', 'grade', 'school', 'textbookVersion', 'interests',
  'weakSubjects', 'sportsPreferences', 'artInterests',
  'laborHabits', 'moralGoals', 'avatarMediaId'
]);
```

Validate `avatarMediaId` with `/^[0-9a-f]{24}$/i` or null. Trim and require non-empty `name`; preserve Mongoose validation for field types/ranges. Build paths only from a constant field map, never from request keys. Created errors carry only `status=400`, `code=VALIDATION_ERROR`, and a fixed message.

- [ ] **Step 4: Run patch-builder GREEN**

```bash
npx jest --config backend/services/user-service/jest.config.js --runInBand childAvatarMediaService --testNamePattern='016J|018A'
```

Expected: canonical mapping and unsafe-input tests pass.

- [ ] **Step 5: Commit the patch boundary**

```bash
git add backend/services/user-service/services/childProfilePatch.js backend/services/user-service/__tests__/services/childAvatarMediaService.test.js
git commit -m "feat: validate child profile patches"
```

### Task 3: Implement Initial Avatar Binding and Recovery

**Files:**
- Create: `backend/services/user-service/services/childAvatarMediaService.js`
- Modify: `backend/services/user-service/__tests__/services/childAvatarMediaService.test.js`

- [ ] **Step 1: Write failing `016E`, `016F`, and initial-set `016G` service cases**

Use the real User model, fixed UUID generator, and injected media client. Prove exact prepare/commit commands, public invisibility while binding, stable prepare rollback, lost prepare/commit responses, failed post-commit CAS, and a CAS that persists but whose wrapper throws after success.

```js
expect(mediaClient.prepare).toHaveBeenCalledWith({
  familyId: FAMILY_A,
  childId: child._id.toString(),
  resourceType: 'child',
  resourceId: child._id.toString(),
  operationId: OPERATION_A,
  references: [{ mediaId: MEDIA_A, field: 'avatarMediaId' }]
});
```

Assert every uncertain failure is `503 MEDIA_REFERENCE_PENDING` with `{ resourceId: childId }`, while stable prepare errors clear the intent and leave the ordinary patch unchanged.

- [ ] **Step 2: Run initial-binding RED**

```bash
npx jest --config backend/services/user-service/jest.config.js --runInBand childAvatarMediaService --testNamePattern='016E|016F|016G'
```

Expected: FAIL because `createChildAvatarMediaService` does not exist.

- [ ] **Step 3: Implement service construction, claim, and error primitives**

Export `createChildAvatarMediaService({ UserModel, mediaReferenceClient, randomUUID, logger })`. Validate all dependencies at construction. Define fixed helpers:

```js
const pending = (childId) => Object.assign(
  new Error('Media reference operation is pending'),
  { status: 503, code: 'MEDIA_REFERENCE_PENDING', details: { resourceId: String(childId) } }
);
const conflict = () => Object.assign(
  new Error('Child avatar changed concurrently'),
  { status: 409, code: 'RESOURCE_CONFLICT', details: [] }
);
```

The first `findOneAndUpdate` filters `_id`, `familyId`, `role: 'student'`, observed `__v`, and `mediaReferenceState: { $ne: 'pending' }`; it sets the stored operation, pending target, previous pair, phase, and canonical patch and increments `__v`. All internal reads explicitly select every hidden state path.

- [ ] **Step 4: Implement binding resume and safe convergence**

For `phase=binding`, always replay prepare then commit with the stored command. After commit, CAS by `_id`, pending state, exact operation, and phase. Apply `mediaPendingProfilePatch` in the same `$set` that makes the new public avatar/generation current. If no previous pair exists, clear pending metadata and set bound; otherwise retain previous pair and move to unbinding.

Stable errors are terminal only when prepare fails in the current attempt before commit is invoked: CAS-clear the untouched intent and rethrow the sanitized error. Every uncertain remote or owner-transition result reloads the Child; return it if already converged, otherwise throw `pending(childId)`. Never attach the caught database/client error or log patch values.

- [ ] **Step 5: Implement `mutate`, `resume`, and stable no-op**

`resume(childOrId)` reloads hidden state and dispatches by phase. `mutate` resumes an existing intent first, compares normalized requested/current IDs, applies ordinary entries directly for a stable no-op, otherwise claims and resumes the new intent. Export `publicAvatarMediaId(child)` to return a string only when a public bound ID is present.

- [ ] **Step 6: Run initial-binding GREEN**

```bash
npx jest --config backend/services/user-service/jest.config.js --runInBand childAvatarMediaService --testNamePattern='016E|016F|016G|016J'
```

Expected: initial set, stable rejection, recovery, no-op, and atomic profile patch cases pass.

- [ ] **Step 7: Commit initial binding**

```bash
git add backend/services/user-service/services/childAvatarMediaService.js backend/services/user-service/__tests__/services/childAvatarMediaService.test.js
git commit -m "feat: bind child avatar media"
```

### Task 4: Complete Replacement, Removal, and Concurrency

**Files:**
- Modify: `backend/services/user-service/services/childAvatarMediaService.js`
- Modify: `backend/services/user-service/__tests__/services/childAvatarMediaService.test.js`

- [ ] **Step 1: Write failing `016H` and `016I` ordering/recovery cases**

Record a chronological event list around prepare, commit, owner switch, unbind, and finalize. Assert replacement keeps A public until B commit, switches to B before unbinding A, and sends:

```js
{
  familyId: FAMILY_A,
  childId,
  resourceType: 'child',
  resourceId: childId,
  operationId: OPERATION_B,
  references: [{
    mediaId: MEDIA_A,
    field: 'avatarMediaId',
    bindingOperationId: OPERATION_A
  }]
}
```

Removal must set the public pair to null before unbind. Force each unbind/finalize uncertainty once and prove replay convergence.

- [ ] **Step 2: Run replacement/removal RED**

```bash
npx jest --config backend/services/user-service/jest.config.js --runInBand childAvatarMediaService --testNamePattern='016H|016I'
```

Expected: FAIL because unbinding phase and removal are incomplete.

- [ ] **Step 3: Implement checked unbind and removal transitions**

In replacement, the post-commit CAS sets the new public ID and generation, applies pending entries, and changes phase to unbinding while preserving the previous pair. In removal, the initial claim atomically nulls the public pair, applies entries, and starts at unbinding. Unbinding calls the exact command above, then CAS-finalizes to bound for replacement or none for removal and unsets all pending/previous/patch fields.

Any unbind error retains the intent and returns pending. A reload that shows the operation already finalized returns the converged Child. Never classify a post-prepare `400/403/404/409` as safe intent cleanup.

- [ ] **Step 4: Write failing deterministic `016K` concurrency cases**

Use deferred promises around claim/resume calls. Race identical targets, different targets, and a non-avatar patch. Assert one operation UUID is persisted, identical callers converge, different target returns conflict after helping recovery, and the non-avatar update applies only after pending recovery.

- [ ] **Step 5: Implement CAS-loser behavior**

When the claim returns null, reload hidden state. If its pending target equals the requested target, resume that operation and return the converged Child. If it differs, resume the winner and then throw `RESOURCE_CONFLICT`. For a non-avatar mutation, resume first and apply its canonical entries with an observed-version CAS so it cannot overwrite media state.

- [ ] **Step 6: Run complete service GREEN**

```bash
npx jest --config backend/services/user-service/jest.config.js --runInBand childAvatarMediaService
```

Expected: all `016E-K` and service-level `018A` tests pass without timing sleeps or retries.

- [ ] **Step 7: Commit the complete state machine**

```bash
git add backend/services/user-service/services/childAvatarMediaService.js backend/services/user-service/__tests__/services/childAvatarMediaService.test.js
git commit -m "feat: recover child avatar replacement"
```

### Task 5: Integrate the Public Child Contract

**Files:**
- Modify: `backend/services/user-service/controllers/familyController.js`
- Modify: `backend/services/user-service/routes/children.js`
- Modify: `backend/services/user-service/routes/index.js`
- Create: `backend/services/user-service/__tests__/routes/childMediaReferences.test.js`
- Modify: `backend/services/user-service/__tests__/routes/children.test.js`

- [ ] **Step 1: Write failing route cases `016E`, `016F`, `016G`, `016I`, `016L`, `018A`, `018B`, and `016M`**

Mount `createRoutes({ childAvatarMediaService })` in Express with the production `errorHandler`. Cover parent set/replay/remove, another-family and child-token denial, disabled `MEDIA_NOT_ENABLED`, all unsafe fields, stable/pending envelopes, detail recovery, list no-remote behavior, internal-field omission, audit redaction, and existing Child/PIN/pagination behavior. Add an import test that asserts constructing default routes does not call Mongo or the media client.

- [ ] **Step 2: Run route RED**

```bash
npx jest --config backend/services/user-service/jest.config.js --runInBand childMediaReferences children family
```

Expected: FAIL because route factories, injection, and `avatarMediaId` contract are absent.

- [ ] **Step 3: Add backward-compatible router factories**

In `children.js`, export the existing default router and attach `createChildrenRouter`. In `routes/index.js`, export the default router and attach `createRoutes`. Factory construction is synchronous and side-effect free:

```js
const createChildrenRouter = ({ familyController }) => {
  const router = express.Router();
  router.post('/', authenticateGateway, familyController.createChild);
  router.get('/', authenticateGateway, familyController.listChildren);
  router.get('/:childId', authenticateGateway, familyController.getChild);
  router.patch('/:childId', authenticateGateway, familyController.updateChild);
  router.post('/:childId/pin', authenticateGateway, familyController.setChildPin);
  return router;
};
```

`createRoutes` obtains `createFamilyController({ childAvatarMediaService })` and injects it only into the Child router; auth/user/student/family route behavior remains unchanged.

- [ ] **Step 4: Refactor the family controller around an injected service**

Export `createFamilyController({ childAvatarMediaService = null } = {})` plus the backward-compatible default handlers. `childView` removes legacy `avatar` and returns `avatarMediaId` only from `publicAvatarMediaId` or the stored public ID. `getChild` resumes pending state before a detail response for both authorized parent and self child. `listChildren` never resumes and never calls resource-service.

`updateChild` uses `buildChildProfilePatch`. An avatar mutation with no service returns `400 MEDIA_NOT_ENABLED`; non-avatar patches continue to work. Map known service errors with `sendFamilyError(res, status, code, message, details)`. Emit `logFamilyOperation` for avatar success, pending, stable rejection, and conflict with only operation/result/family/child/media IDs. Unknown errors return fixed `500 INTERNAL_ERROR` text and log only approved IDs/result, never `error.message`, patch values, operations, generations, credentials, or Axios objects.

- [ ] **Step 5: Run route GREEN**

```bash
npx jest --config backend/services/user-service/jest.config.js --runInBand childMediaReferences children family
```

Expected: all Phase 3B route cases and existing Child/family cases pass with the production error envelope.

- [ ] **Step 6: Commit public integration**

```bash
git add backend/services/user-service/controllers/familyController.js \
  backend/services/user-service/routes/children.js \
  backend/services/user-service/routes/index.js \
  backend/services/user-service/__tests__/routes/childMediaReferences.test.js \
  backend/services/user-service/__tests__/routes/children.test.js
git commit -m "feat: expose child avatar media references"
```

### Task 6: Verify and Record the Phase Gate

**Files:**
- Modify after successful execution: `docs/superpowers/plans/2026-06-21-family-growth-task6-phase3b-child-avatar.md`
- Create after approval evidence: `docs/development/family-growth-task6-phase3b-review.md`

- [ ] **Step 1: Run focused tests**

```bash
npx jest --config backend/services/user-service/jest.config.js --runInBand \
  User.mediaReferences childAvatarMediaService childMediaReferences children family
```

Expected: all selected suites pass with zero failed tests and no open-handle or forced-exit warning.

- [ ] **Step 2: Run the family regression twice**

```bash
npm run test:family-regression
npm run test:family-regression
```

Expected: both runs pass all six family projects with identical suite and test totals.

- [ ] **Step 3: Audit implementation and public-field safety**

```bash
git diff --check
rg -n '[T]ODO|[T]BD|testErrorHandler|process\.exit' \
  backend/common/models/User.js \
  backend/services/user-service/services/childProfilePatch.js \
  backend/services/user-service/services/childAvatarMediaService.js \
  backend/services/user-service/controllers/familyController.js \
  backend/services/user-service/routes/children.js \
  backend/services/user-service/routes/index.js \
  backend/services/user-service/__tests__/models/User.mediaReferences.test.js \
  backend/services/user-service/__tests__/services/childAvatarMediaService.test.js \
  backend/services/user-service/__tests__/routes/childMediaReferences.test.js
```

Expected: no whitespace errors, placeholders, test-only error handler, or process termination in the scoped files.

- [ ] **Step 4: Record evidence and commit only documentation**

Mark executed checkboxes, add exact suite/test totals and commit hashes under an `Execution Evidence` section, create the review record with requirement/case/commit traceability, then commit only those documents:

```bash
git add docs/superpowers/plans/2026-06-21-family-growth-task6-phase3b-child-avatar.md \
  docs/development/family-growth-task6-phase3b-review.md
git commit -m "docs: complete child avatar media phase"
```

## Review Gate

Implementation must not begin until this plan is reviewed and approved. Approval confirms that:

- the owner intent is persisted before prepare and no deterministic operation ID is used;
- pending profile entries are canonical server paths and apply atomically with the public media switch;
- prepare/commit are replayed only with the stored bind operation and unbind carries the prior bind generation;
- replacement and removal never expose an unbound media ID;
- stable prepare rejection clears an untouched intent, while every post-prepare uncertainty remains recoverable;
- route factories are import-safe and default disabled mode preserves non-avatar workflows;
- focused tests plus two identical full family regressions form the Phase 3B release gate.

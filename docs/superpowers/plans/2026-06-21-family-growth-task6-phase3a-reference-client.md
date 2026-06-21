# Task 6 Phase 3A Reference Release and Client Implementation Plan

**Document status:** APPROVED
**Design:** `docs/superpowers/specs/2026-06-21-family-growth-task6-phase3a-reference-release-design.md`
**Test cases:** `docs/development/family-growth-task6-phase3a-test-cases.md`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make replacement/removal of an existing media reference safely idempotent under a new mutation operation, and provide one validated internal client for the Child and GrowthTask consumers implemented in Phases 3B and 3C.

**Architecture:** `MediaReference.operationId` identifies the current bind generation and is never overwritten by unbind. Each unbind reference carries its expected `bindingOperationId`, while the command's `operationId` identifies the release mutation; a new `releaseOperationId` records which mutation released that generation. Owners keep a hidden per-media generation map, prepare/commit only additions, retain unchanged generations, and release removals in one checked batch, so delayed old commands cannot release newer bindings. A shared, dependency-injected Axios client owns resource-service URL, credential, timeout, response validation, and stable pending-error translation; owning services remain responsible for business persistence and recovery state.

**Tech Stack:** Node.js, Axios, Express, Mongoose transactions, MongoMemoryReplSet, Jest, Supertest

---

## Approved Contract Refinement

This phase resolves a concrete incompatibility discovered while mapping the approved replacement flow to the Phase 2C implementation:

```text
bind operation A: old media -> bound, operationId=A
replacement operation B: new media -> prepared/bound, operationId=B
replacement operation B: old media -> unbind
```

The existing unbind implementation requires `row.operationId === B`, so it rejects the old row whose bind generation is `A`. The corrected row has two independent idempotency identities:

```text
operationId        = current bind generation
releaseOperationId = operation that released this identity, null while prepared/bound
```

Rules:

1. Every unbind reference requires `bindingOperationId` to equal that row's current bind generation.
2. The release mutation's `operationId` is stored separately as `releaseOperationId`; replay preserves `releasedAt`.
3. A different release operation against the same already released generation returns the existing result without changing timestamps.
4. Replacement prepare/commit includes additions only. Unchanged references retain their generations; owners persist a hidden `mediaId -> bindingOperationId` map.
5. A delayed unbind for an older generation conflicts after a newer generation has bound.
6. Replaying the original bind operation against its released row does not resurrect it; a genuinely new prepare may reuse the identity and clears release metadata.
7. Unbind may atomically release mixed generations because the expectation is carried per reference.
8. Prepare, commit, and unbind remain transactional per normalized command batch.

Unbind extends the existing command by one server-controlled field:

```json
{
  "operationId": "replacement-or-removal-operation-uuid",
  "references": [
    {
      "mediaId": "6656875da7f86a0012c2a601",
      "field": "attachmentMediaIds",
      "bindingOperationId": "generation-being-released-uuid"
    }
  ]
}
```

Phases 3B and 3C persist current and previous per-media generation mappings as hidden owner state. Public clients cannot submit operation or generation values.

The shared client contract is:

```js
const client = createMediaReferenceClient({
  axiosInstance,
  resourceServiceUrl,
  serviceToken,
  timeout
});

await client.prepare(command);
await client.commit(command);
await client.unbind(command);
```

Every method returns the validated `data.references` array. Transport errors, non-success envelopes, and malformed responses become `503 MEDIA_REFERENCE_PENDING`; stable resource-service `400/403/404/409` errors are preserved so public consumers can reject invalid media rather than misclassify them as retryable.

## Phase Test Map

| Case | Level | Evidence |
| --- | --- | --- |
| `TC-T6-MEDIA-012A` | resource model/service | replacement operation B releases generation A; replay and competing release preserve one timestamp |
| `TC-T6-MEDIA-012B` | resource service | after release/rebind, delayed unbind of generation A cannot release generation C |
| `TC-T6-MEDIA-012C` | resource service | old bind replay cannot resurrect a released row; a new prepare can, and mixed-generation release is atomic |
| `TC-T6-MEDIA-016A` | shared client prerequisite | prepare/commit/unbind send the exact internal path, token, timeout, and payload |
| `TC-T6-MEDIA-016B` | shared client prerequisite | stable validation/scope/purpose/conflict errors retain status/code/details |
| `TC-T6-MEDIA-016C` | shared client prerequisite | timeout, network failure, 5xx, and malformed success response become `MEDIA_REFERENCE_PENDING` without credential disclosure |

The suffix cases refine existing approved `TC-T6-MEDIA-012`, `016`, and `017`; they do not add product scope.

### Task 1: Add Independent Release Idempotency to the Model

**Files:**
- Modify: `backend/services/resource-service/models/MediaReference.js`
- Modify: `backend/services/resource-service/__tests__/mediaModels.test.js`

- [x] **Step 1: Write the failing model tests**

Add `TC-T6-MEDIA-012A model stores release operation independently` and assert:

```js
const reference = await MediaReference.create({
  familyId,
  childId,
  mediaId,
  resourceType: 'child',
  resourceId: childId,
  field: 'avatarMediaId',
  operationId: bindOperationId,
  releaseOperationId,
  state: 'released',
  releasedAt: now
});

expect(reference.operationId).toBe(bindOperationId);
expect(reference.releaseOperationId).toBe(releaseOperationId);
```

Also prove malformed `releaseOperationId` fails validation and prepared/bound rows reject a non-null release operation.

- [x] **Step 2: Run model RED**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand mediaModels --testNamePattern='MEDIA-012A'
```

Expected: FAIL because `releaseOperationId` is not defined and strict model persistence omits it.

- [x] **Step 3: Add the model field and invariant**

Add after `operationId`:

```js
releaseOperationId: {
  type: String,
  default: null,
  validate: [
    {
      validator(value) { return value == null || OPERATION_ID_PATTERN.test(value); },
      message: 'releaseOperationId must be a UUID'
    },
    {
      validator(value) { return this.state === 'released' || value == null; },
      message: 'releaseOperationId is only valid for released references'
    }
  ]
},
```

Do not make it required for historical released rows; the service fills it for every new unbind.

- [x] **Step 4: Run model GREEN**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand mediaModels --testNamePattern='MEDIA-012A'
```

Expected: the new model tests pass.

- [x] **Step 5: Commit the model contract**

```bash
git add backend/services/resource-service/models/MediaReference.js backend/services/resource-service/__tests__/mediaModels.test.js
git commit -m "fix: separate media release idempotency"
```

### Task 2: Correct Transactional Unbind and Reactivation

**Files:**
- Modify: `backend/services/resource-service/services/mediaReferenceService.js`
- Modify: `backend/services/resource-service/__tests__/mediaReferences.test.js`

- [x] **Step 1: Write failing replacement and replay tests**

Add these exact cases using real models and the existing replica-set fixture:

```js
test('TC-T6-MEDIA-012A replacement operation releases an older binding idempotently', async () => {
  await prepareAndCommit(oldBindCommand);
  const release = {
    ...oldBindCommand,
    operationId: replacementOperationId,
    references: oldBindCommand.references.map((reference) => ({
      ...reference,
      bindingOperationId: oldBindOperationId
    }))
  };
  const first = await referenceService.unbind(release);
  const replay = await referenceService.unbind(release);
  const competing = await referenceService.unbind({ ...release, operationId: anotherOperationId });

  expect(first[0].state).toBe('released');
  expect(replay[0].releasedAt).toBe(first[0].releasedAt);
  expect(competing[0].releasedAt).toBe(first[0].releasedAt);
  const stored = await MediaReference.findOne(referenceIdentity).lean();
  expect(stored.operationId).toBe(oldBindOperationId);
  expect(stored.releaseOperationId).toBe(replacementOperationId);
});
```

Add `TC-T6-MEDIA-012B`: release generation A, bind the same identity as generation C, then prove delayed unbind carrying `bindingOperationId=A` returns `409 RESOURCE_CONFLICT` and leaves C bound. Add `TC-T6-MEDIA-012C` to prove old prepare replay cannot resurrect a released generation, a genuinely new prepare clears release metadata, and a forced second-save failure rolls back a two-row mixed-generation unbind.

Also assert prepare and commit operation B against a live bound generation A return `409 RESOURCE_CONFLICT`; a consumer must diff sets and must not claim an unchanged reference as a new generation.

- [x] **Step 2: Run service RED**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand mediaReferences --testNamePattern='MEDIA-012[ABC]'
```

Expected: the replacement release conflicts and the new release metadata assertions fail.

- [x] **Step 3: Implement corrected unbind semantics**

Change normalization to be action-aware. For unbind only, require and validate a UUID `bindingOperationId` on every normalized reference. Prepare and commit reject that server-only field:

```js
const normalizeReferences = (command, resourceType, action) => {
  if (!['prepare', 'commit', 'unbind'].includes(action)) {
    throw validationError('Invalid media reference action');
  }
  const normalized = new Map();
  command.references.forEach((reference) => {
    const mediaId = String(reference && reference.mediaId || '');
    const field = reference && reference.field;
    if (!validObjectId(mediaId)
      || typeof field !== 'string'
      || !MediaReference.MEDIA_RESOURCE_FIELDS[resourceType].includes(field)) {
      throw validationError('Invalid media reference identity');
    }
    const hasGeneration = Object.prototype.hasOwnProperty.call(reference || {}, 'bindingOperationId');
    if (action === 'unbind') {
      if (!hasGeneration || !OPERATION_ID_PATTERN.test(reference.bindingOperationId)) {
        throw validationError('Invalid binding operation');
      }
    } else if (hasGeneration) {
      throw validationError('bindingOperationId is only valid for unbind');
    }
    normalized.set(`${field}:${mediaId}`, {
      mediaId: String(reference.mediaId),
      field: reference.field,
      ...(action === 'unbind' ? { bindingOperationId: reference.bindingOperationId } : {})
    });
  });
  return [...normalized.values()].sort((left, right) => (
    left.field.localeCompare(right.field) || left.mediaId.localeCompare(right.mediaId)
  ));
};
```

`normalizeCommand(command, action)` retains its existing scalar checks and calls this helper. `prepare`, `commit`, and `unbind` pass their explicit action. Before any unbind write, load and validate the complete batch:

```js
const rows = [];
for (const reference of command.references) {
  const row = await withSession(MediaReferenceModel.findOne(referenceQuery(command, reference)), session);
  if (row && row.operationId !== reference.bindingOperationId) throw conflict();
  rows.push({ reference, row });
}
for (const { row } of rows) {
  if (row && row.state !== 'released') {
    row.state = 'released';
    row.leaseExpiresAt = null;
    row.releasedAt = releasedAt;
    row.releaseOperationId = command.operationId;
    await row.save({ session });
  }
}
```

An already released row for the same `bindingOperationId` is an idempotent no-op, including a competing release operation. Preserve its original `operationId`, `releaseOperationId`, and `releasedAt`. A missing row remains a no-op result. Any existing row from a different generation returns `409 RESOURCE_CONFLICT`. Validate all expectations before the first write so a mixed-generation mismatch leaves the whole batch unchanged.

- [x] **Step 4: Preserve bind generations and distinguish reactivation**

Prepare and commit remain generation-scoped: an already-bound row is idempotent only when its `operationId` matches the command, otherwise it conflicts:

```js
if (row.state === 'bound') {
  if (row.operationId !== command.operationId) throw conflict();
  results.push(serializeReference(row));
  continue;
}
```

Owners therefore send only added identities to prepare/commit. Use the bind-generation identity to distinguish released replay:

```js
if (row.state === 'released' && row.operationId === command.operationId) {
  // Old prepare replay cannot resurrect a released generation.
} else if (row.state === 'released') {
  row.operationId = command.operationId;
  row.releaseOperationId = null;
  row.state = 'prepared';
  row.leaseExpiresAt = leaseExpiresAt;
  row.releasedAt = null;
  await row.save({ session });
}
```

Every transition to prepared or bound must leave `releaseOperationId=null`. Extend `serializeReference` only if tests need release-operation diagnostics internally; public/internal success responses continue omitting operation IDs.

- [x] **Step 5: Run service GREEN and existing reference regression**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand mediaReferences mediaCleanup familyMedia
```

Expected: all existing reference, cleanup, and delete tests plus `012A-C` pass.

- [x] **Step 6: Commit the service correction**

```bash
git add backend/services/resource-service/services/mediaReferenceService.js backend/services/resource-service/__tests__/mediaReferences.test.js
git commit -m "fix: support replacement media unbind"
```

### Task 3: Add the Shared Internal Media Reference Client

**Files:**
- Create: `backend/common/services/mediaReferenceClient.js`
- Create: `backend/common/services/__tests__/mediaReferenceClient.test.js`

- [x] **Step 1: Write failing configuration and request tests**

Create tests for `TC-T6-MEDIA-016A` covering all three methods. For example:

```js
const axiosInstance = { post: jest.fn().mockResolvedValue({
  data: { success: true, data: { references: [referenceResult] } }
}) };
const client = createMediaReferenceClient({
  axiosInstance,
  resourceServiceUrl: 'http://resource-service:3005/',
  serviceToken: validToken,
  timeout: 2500
});

await expect(client.prepare(command)).resolves.toEqual([referenceResult]);
expect(axiosInstance.post).toHaveBeenCalledWith(
  'http://resource-service:3005/api/internal/media/references/prepare',
  command,
  { headers: { 'x-service-token': validToken }, timeout: 2500 }
);
```

Assert blank URL, token shorter than 32, and non-integer/zero timeout fail before Axios is called. The client sends business commands unchanged; resource-service remains the command-schema authority.

- [x] **Step 2: Run client RED**

```bash
npx jest --config backend/jest.family-common.config.js --runInBand mediaReferenceClient
```

Expected: FAIL because the client module does not exist.

- [x] **Step 3: Implement configuration and exact requests**

Export:

```js
createMediaReferenceClient(options)
validateMediaReferenceClientConfig(options)
```

Normalize only trailing slashes from `resourceServiceUrl`. Do not log, stringify, or include `serviceToken` in any created error. Each method posts the caller's command unchanged to its fixed action path.

- [x] **Step 4: Write failing response/error-classification tests**

For `TC-T6-MEDIA-016B/C`, assert:

- an Axios response with `status` in `400|403|404|409` and body `{ error: { code, message, details } }` becomes an error retaining only those approved fields;
- `500/503`, timeout, connection reset, absent response, `success!==true`, missing `data.references`, or malformed reference item becomes status `503`, code `MEDIA_REFERENCE_PENDING`;
- no produced error message or enumerable error field contains the service token or full Axios request config.

- [x] **Step 5: Implement strict response validation and error translation**

Accept only an array whose items contain valid ObjectId strings, approved field/state values, and optional ISO timestamps. Preserve stable resource errors with a new sanitized error object:

```js
const error = new Error(remote.message);
error.status = response.status;
error.code = remote.code;
error.details = Array.isArray(remote.details) ? remote.details : [];
return error;
```

All other failures use:

```js
const error = new Error('Media reference operation is pending');
error.status = 503;
error.code = 'MEDIA_REFERENCE_PENDING';
error.details = [];
```

Do not attach the original Axios error as an enumerable property.

- [x] **Step 6: Run client GREEN**

```bash
npx jest --config backend/jest.family-common.config.js --runInBand mediaReferenceClient
```

Expected: all config, request, stable remote error, retryable failure, malformed response, and secret-safety cases pass.

- [x] **Step 7: Commit the shared client**

```bash
git add backend/common/services/mediaReferenceClient.js backend/common/services/__tests__/mediaReferenceClient.test.js
git commit -m "feat: add media reference client"
```

### Task 4: Run Phase 3A Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-06-21-family-growth-task6-phase3a-reference-client.md`

- [ ] **Step 1: Run focused suites**

```bash
npx jest --config backend/services/resource-service/jest.family.config.js --runInBand mediaModels mediaReferences mediaCleanup familyMedia
npx jest --config backend/jest.family-common.config.js --runInBand mediaReferenceClient
```

Expected: all selected suites pass with zero failed tests and no open handles.

- [ ] **Step 2: Run the family regression gate**

```bash
npm run test:family-regression
```

Expected: all six family projects pass, including every Task 3-6 test already present.

- [ ] **Step 3: Audit the phase diff**

```bash
git diff --check
rg -n '[T]ODO|[T]BD|testErrorHandler' \
  backend/common/services/mediaReferenceClient.js \
  backend/common/services/__tests__/mediaReferenceClient.test.js \
  backend/services/resource-service/models/MediaReference.js \
  backend/services/resource-service/services/mediaReferenceService.js \
  backend/services/resource-service/__tests__/mediaModels.test.js \
  backend/services/resource-service/__tests__/mediaReferences.test.js
```

Expected: no whitespace errors, placeholders, or test-only error handlers.

- [ ] **Step 4: Record evidence and commit the completed plan**

Mark each executed step complete, record exact suite/test totals in the commit message or review record, then commit only this plan update:

```bash
git add docs/superpowers/plans/2026-06-21-family-growth-task6-phase3a-reference-client.md
git commit -m "docs: complete media reference client phase"
```

## Review Gate

Implementation must not begin until this plan is reviewed and approved. Review must confirm:

- `operationId` is the bind-generation identity, per-reference `bindingOperationId` selects the generation to release, and `releaseOperationId` is independent;
- owners prepare/commit only additions and retain a hidden per-media generation map before releasing removals, without weakening family/child/purpose validation;
- a delayed old unbind cannot release a newer generation;
- old prepare replay cannot resurrect a released row;
- the client preserves actionable `400/403/404/409` contracts and converts only retryable/invalid transport outcomes to `MEDIA_REFERENCE_PENDING`;
- secrets and Axios configs cannot enter logs or public errors;
- Phase 3B and 3C remain separate plans for Child and GrowthTask persistence/recovery workflows.

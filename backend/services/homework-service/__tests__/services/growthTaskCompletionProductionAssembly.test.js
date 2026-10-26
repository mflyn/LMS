const express = require('express');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const { createHttpTestHarness } = require('../../../../common/test/httpTestHarness');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');
const { errorHandler } = require('../../../../common/middleware/errorHandler');
const { createProductionApp } = require('../../server');
const { createProductionApp: createResourceApp } = require('../../../resource-service/server');
const { createPrivateMediaStore } = require('../../../resource-service/services/privateMediaStore');
const { createApp: createProgressApp } = require('../../../progress-service/server');
const { createApp: createGatewayApp } = require('../../../../gateway/server');
const jwt = require('jsonwebtoken');
const Task = require('../../models/GrowthTask');
const Operation = require('../../models/GrowthTaskCompletionOperation');
const CompletionGuard = require('../../models/CompletionMediaGuard');
const UploadGuard = require('../../../resource-service/models/CompletionUploadGuard');
const Retirement = require('../../../resource-service/models/MediaOrphanRetirement');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const Asset = require('../../../resource-service/models/MediaAsset');
const Reference = require('../../../resource-service/models/MediaReference');
const RemoteOperation = require('../../../resource-service/models/MediaReferenceOperation');
const Receipt = require('../../../resource-service/models/MediaDeletionReceipt');
const Tombstone = require('../../../resource-service/models/MediaDeletionTombstone');
const Ledger = require('../../../progress-service/models/StarLedgerEntry');

const TOKEN = 'synthetic-r3-homework-media-token-32chars';
const PREFIX = '/api/growth-tasks';
const MEDIA_PREFIX = '/api/internal/media/references/';
const models = [Task, Operation, CompletionGuard, UploadGuard, Retirement, Family, User, Asset, Reference, RemoteOperation, Receipt, Tombstone, Ledger];
const { request, close } = createHttpTestHarness();
const id = () => String(new mongoose.Types.ObjectId());
let root, env, resourceEnv, store, parent, coparent, child, sibling, outsider, family;
let mediaCalls, starCalls, dropped, dropMediaField, dropStars, dropCompletionAction;

// The existing homework setup owns the replica set and clears all collections.
// Providers share that synthetic DB, but every cross-service command goes over HTTP.
beforeAll(async () => { for (const model of models) await model.init(); });
const listen = async app => {
  const client = await request(app);
  const server = client.get('/health').app;
  return 'http://127.0.0.1:' + server.address().port;
};
beforeEach(async () => {
  root = undefined;
  mediaCalls = []; starCalls = []; dropped = []; dropMediaField = null; dropStars = false;
  dropCompletionAction = null;
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'r3-homework-assembly-')));
  await fs.chmod(root, 0o700);
  resourceEnv = { NODE_ENV: 'test', COMPLETION_PROTOCOL_MODE: 'enabled',
    COMPLETION_WRITES_PAUSED: 'true', MEDIA_SECURITY_PROFILE: 'trusted-local',
    MEDIA_REFERENCE_SERVICE_TOKEN: TOKEN, MEDIA_SIGNING_SECRET: TOKEN,
    COMPLETION_RETIREMENT_SERVICE_TOKEN: 'synthetic-distinct-retirement-token-32chars',
    PRIVATE_MEDIA_ROOT: path.join(root, 'media'), COMPLETION_DELETION_JOURNAL_ROOT: path.join(root, 'journal') };
  await fs.mkdir(resourceEnv.PRIVATE_MEDIA_ROOT, { mode: 0o700 });
  await fs.mkdir(resourceEnv.COMPLETION_DELETION_JOURNAL_ROOT, { mode: 0o700 });
  store = createPrivateMediaStore({ root: resourceEnv.PRIVATE_MEDIA_ROOT });
  parent = { id: id(), role: 'parent' }; coparent = { id: id(), role: 'parent' };
  outsider = { id: id(), role: 'parent' };
  child = { id: id(), role: 'student', tokenVersion: 0 };
  sibling = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic assembly', ownerParentId: parent.id,
    memberParentIds: [parent.id, coparent.id], childIds: [child.id, sibling.id] });
  for (const actor of [child, sibling]) Object.assign(actor, { childId: actor.id, familyId: String(family._id) });
  await User.collection.insertMany([parent, coparent, child, sibling, outsider].map(actor => ({
    _id: new mongoose.Types.ObjectId(actor.id), role: actor.role, username: actor.id,
    email: actor.id + '@example.test', ...(actor.role === 'student'
      ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {})
  })));
  await Family.create({ familyName: 'Other synthetic assembly', ownerParentId: outsider.id,
    memberParentIds: [outsider.id], childIds: [] });
  await startProviders();
});

const startProviders = async () => {
  const resource = express();
  resource.use(express.json());
  resource.use((req, res, next) => {
    if (!req.path.startsWith(MEDIA_PREFIX)) return next();
    const action = req.path.slice(MEDIA_PREFIX.length);
    mediaCalls.push({ action, body: structuredClone(req.body) });
    const json = res.json;
    res.json = function send(body) {
      if (dropCompletionAction === action && body.success && req.body.references?.length
        && req.body.references.every(ref => ref.field === 'completionMediaIds')) {
        dropped.push({ action, operationId: req.body.operationId });
        dropCompletionAction = null; this.destroy(); return this;
      }
      // Destroy only a successful commit acknowledgement, after the real DB commit.
      if (dropMediaField && action === 'commit' && body.success && req.body.references?.length
        && req.body.references.every(ref => ref.field === dropMediaField)) {
        dropped.push({ action, field: dropMediaField, operationId: req.body.operationId });
        dropMediaField = null; this.destroy(); return this;
      }
      return json.call(this, body);
    };
    return next();
  });
  resource.use(createResourceApp({ env: resourceEnv }));

  const progress = express();
  progress.use(express.json());
  progress.use((req, res, next) => {
    if (req.path !== '/api/internal/stars/award') return next();
    starCalls.push(structuredClone(req.body));
    const json = res.json;
    res.json = function send(body) {
      if (dropStars && body.success) {
        dropStars = false; dropped.push({ action: 'award' }); this.destroy(); return this;
      }
      return json.call(this, body);
    };
    return next();
  });
  progress.use(createProgressApp());
  progress.use(errorHandler);
  env = { NODE_ENV: 'test', ENABLE_RABBITMQ: 'false', COMPLETION_PROTOCOL_MODE: 'enabled',
    COMPLETION_WRITES_PAUSED: 'true', RESOURCE_SERVICE_URL: await listen(resource),
    MEDIA_REFERENCE_SERVICE_TOKEN: TOKEN, MEDIA_REFERENCE_TIMEOUT_MS: '3000',
    COMPLETION_RETIREMENT_SERVICE_TOKEN: 'synthetic-distinct-retirement-token-32chars',
    PROGRESS_SERVICE_URL: await listen(progress), INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN,
    STAR_AWARD_TIMEOUT_MS: '3000', STAR_AWARD_RETRY_ATTEMPTS: '0' };
};
afterEach(async () => {
  try { await close(); } finally { if (root) await fs.rm(root, { recursive: true, force: true }); }
});

const app = () => createProductionApp({ env });
const call = async (application, method, url, body, identity = parent) => {
  let req = (await request(application))[method.toLowerCase()](url);
  if (identity) req = req.set(createIdentityHeaders({ method, originalUrl: url, user: identity,
    secret: process.env.GATEWAY_IDENTITY_SECRET }));
  if (body !== undefined) req = req.send(body);
  return req;
};
const input = (extra = {}) => ({ childId: child.id, dimension: 'academic', title: 'Original title',
  taskType: 'practice', dueDate: '2026-10-23', ...extra });
const seed = (extra = {}) => Task.create({ ...input(), familyId: family._id, createdByParentId: parent.id, ...extra });
const url = task => PREFIX + '/' + task._id;
const row = task => Task.collection.findOne({ _id: task._id });
const ledgerQuery = task => ({ familyId: family._id, childId: child.id,
  sourceType: 'task_confirmation', sourceId: String(task._id), type: 'earn' });
const command = (extra = {}) => ({ operationId: randomUUID(), expectedCompletionVersion: 0,
  expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: [], ...extra });
const media = async (purpose = 'task_attachment') => {
  const bytes = Buffer.from('synthetic-image');
  const stored = await store.writeCanonical(bytes);
  return String((await Asset.create({ familyId: family._id, childId: child.id, uploadedBy: child.id,
    purpose, mimeType: 'image/jpeg', sizeBytes: bytes.length, storageKey: stored.storageKey }))._id);
};
const forbiddenKeys = new Set(['_id', '__v', 'activeCompletionOperation', 'completionPending',
  'completionMediaBindings', 'attachmentMediaBindings', 'mediaBindingOperationId', 'attachmentMediaPendingIds',
  'attachmentMediaPreviousBindings', 'mediaPendingTaskPatch', 'mediaCompletionFence', 'mediaRemoteOutcomeUncertain',
  'mediaBindingPhase', 'mediaMutationKind', 'remoteOperationId', 'bindingOperationId', 'commandHash', 'storageKey',
  'privateSentinel']);
const expectPublic = value => {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    expect(forbiddenKeys.has(key)).toBe(false);
    expectPublic(nested);
  }
  expect(JSON.stringify(value)).not.toContain(TOKEN);
};
const expectError = (response, status, code, details = []) => {
  expect(response.status).toBe(status);
  expect(response.body).toMatchObject({ success: false, error: { code, details } });
  expectPublic(response.body);
};

describe('T4 formal checklist HTTP', () => {
  const checklist = [{ itemId: 'read', label: 'Read the question', required: true },
    { itemId: 'Read', label: 'Check answer', required: false }];
  test.each(['pending', 'resolved'])('checklist-only response preserves %s help and matches safe GET/material projections', async status => {
    const application = app(), task = await seed();
    const requested = await call(application, 'PATCH', url(task) + '/help', {
      action: 'request', expectedHelpVersion: 0,
      helpType: 'instruction_unclear', note: 'Synthetic help survives checklist edit'
    }, child);
    expect(requested.status).toBe(200);
    if (status === 'resolved') {
      const resolved = await call(application, 'PATCH', url(task) + '/help', {
        action: 'resolve', expectedHelpVersion: 1, parentResponse: 'Synthetic response'
      }, coparent);
      expect(resolved.status).toBe(200);
    }
    await Task.collection.updateOne({ _id: task._id }, { $set: {
      'helpRequest.privateSentinel': 'hidden', 'helpRequest.requestedByActor.privateSentinel': 'hidden'
    } });
    const before = await row(task), ledgers = await Ledger.find().lean(), operations = await Operation.find().lean();
    const changed = await call(application, 'PATCH', url(task), { checklistSnapshot: checklist, expectedChecklistVersion: 0 });
    expect(changed.status).toBe(200);
    expect(changed.body.data.task.helpVersion).toBe(status === 'pending' ? 1 : 2);
    expect(changed.body.data.task.helpRequest).toMatchObject({ status, note: 'Synthetic help survives checklist edit',
      requestedByActor: { id: child.id, role: 'student' } });
    const get = await call(application, 'GET', url(task));
    const material = await call(application, 'PATCH', url(task), { attachmentMediaIds: [] });
    expect(get.status).toBe(200); expect(material.status).toBe(200);
    expect(changed.body.data.task).toEqual(get.body.data.task);
    expect(material.body.data.task).toEqual(get.body.data.task);
    expectPublic(changed.body); expectPublic(material.body); expectPublic(get.body);
    const after = await row(task);
    for (const field of ['helpVersion', 'helpRequest', 'completionVersion', 'completionEvidence', 'starAwardState']) {
      expect(after[field]).toEqual(before[field]);
    }
    expect(await Ledger.find().lean()).toEqual(ledgers); expect(await Operation.find().lean()).toEqual(operations);
    expect(starCalls).toEqual([]); expect(mediaCalls).toEqual([]);
  });
  test.each(['pending', 'completed'])('remove response for %s preserves public help/evidence but excludes hidden fields', async status => {
    const task = await seed({ status });
    await Task.collection.updateOne({ _id: task._id }, { $set: {
      helpVersion: 2, helpRequest: { status: 'resolved', helpType: 'instruction_unclear', note: 'Synthetic note',
        parentResponse: 'Synthetic response', privateSentinel: 'hidden',
        requestedByActor: { id: child.id, role: 'student', privateSentinel: 'hidden' } },
      ...(status === 'completed' ? { completionVersion: 1, completionEvidence: {
        checkedItemIds: [], completionMediaIds: [], subjectChildId: child.id, privateSentinel: 'hidden',
        submittedByActor: { id: parent.id, role: 'parent', privateSentinel: 'hidden' }
      } } : {})
    } });
    const before = await row(task), application = app();
    const removed = await call(application, 'DELETE', url(task));
    expect(removed.status).toBe(200);
    expect(removed.body.data.task.helpVersion).toBe(2);
    expect(removed.body.data.task.helpRequest.status).toBe('resolved');
    const get = await call(application, 'GET', url(task));
    expect(get.status).toBe(200); expect(removed.body.data.task).toEqual(get.body.data.task);
    expectPublic(removed.body);
    const after = await row(task);
    for (const field of ['helpVersion', 'helpRequest', 'completionVersion', 'completionEvidence', 'starAwardState']) {
      expect(after[field]).toEqual(before[field]);
    }
    expect(after.status).toBe(status === 'pending' ? 'cancelled' : 'archived');
    expect(starCalls).toEqual([]); expect(mediaCalls).toEqual([]);
  });
  test.each([undefined, [], checklist])('create initializes checklist %p with its contracted version', async value => {
    const response = await call(app(), 'POST', PREFIX, input(value === undefined ? {} : { checklistSnapshot: value }), coparent);
    expect(response.status).toBe(201);
    expect(response.body.data.task).toMatchObject({ checklistSnapshot: value || [], checklistVersion: value?.length ? 1 : 0 });
    const stored = await Task.findById(response.body.data.task.taskId).lean();
    expect(stored.checklistVersion).toBe(value?.length ? 1 : 0);
    expect(stored.checklistSnapshot).toEqual(value || []); expectPublic(response.body);
  });
  test.each([false, true])('ordinary/material PATCH preserves checklist error contract (material=%s)', async withMedia => {
    const task = await seed(); const before = await row(task); const application = app();
    const base = { expectedChecklistVersion: 0, ...(withMedia ? { attachmentMediaIds: [] } : {}) };
    expectError(await call(application, 'PATCH', url(task), { ...base, checklistSnapshot: [{ ...checklist[0], required: 'true' }] }),
      400, 'CHECKLIST_ITEM_INVALID');
    expectError(await call(application, 'PATCH', url(task), { ...base, checklistSnapshot: [], checklistVersion: 1 }),
      400, 'VALIDATION_ERROR');
    for (const actor of [child, sibling, outsider]) {
      expectError(await call(application, 'PATCH', url(task), { ...base, checklistSnapshot: checklist }, actor), 403, 'CHILD_ACCESS_DENIED');
    }
    await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: coparent.id, memberParentIds: [coparent.id] } });
    expectError(await call(application, 'PATCH', url(task), { ...base, checklistSnapshot: checklist }), 403, 'CHILD_ACCESS_DENIED');
    expect(await row(task)).toEqual(before); expect(mediaCalls).toEqual([]); expect(starCalls).toEqual([]);
  });
  test('checklist update, partial submission, versioned review and child readback use the real services', async () => {
    const application = app(), task = await seed();
    const patch = { checklistSnapshot: checklist, expectedChecklistVersion: 0 };
    const changed = await call(application, 'PATCH', url(task), patch, coparent);
    expect(changed.status).toBe(200); expect(changed.body.data.task.checklistVersion).toBe(1);
    expectError(await call(application, 'PATCH', url(task), patch), 409, 'VERSION_CONFLICT');
    expectError(await call(application, 'PATCH', url(task) + '/complete', command(), child), 409, 'VERSION_CONFLICT');
    const work = await media('task_completion');
    const original = command({ expectedChecklistVersion: 1, checkedItemIds: ['Read'], completionMediaIds: [work] });
    const completed = await call(application, 'PATCH', url(task) + '/complete', original, child);
    expect(completed.status).toBe(200);
    const first = await row(task);
    expect(first.completionEvidence.checkedItemIds).toEqual(['Read']);
    expect(String(first.completionEvidence.submittedByActor.id)).toBe(child.id);
    expect(first.completionEvidence.submittedByActor.role).toBe('student');
    expectError(await call(application, 'PATCH', url(task), { checklistSnapshot: [], expectedChecklistVersion: 1 }), 409, 'TASK_STATE_CONFLICT');
    const reread = await call(app(), 'GET', url(task), undefined, coparent);
    expect(reread.body.data.task).toMatchObject({ checklistSnapshot: checklist, completionVersion: 1 });
    expectError(await call(application, 'PATCH', url(task) + '/confirm', { expectedCompletionVersion: 0 }), 409, 'VERSION_CONFLICT');
    const confirmed = await call(application, 'PATCH', url(task) + '/confirm',
      { expectedCompletionVersion: reread.body.data.task.completionVersion, parentFeedback: 'Reviewed partial checklist' }, coparent);
    expect(confirmed.status).toBe(200);
    const replay = await call(app(), 'PATCH', url(task) + '/complete', original, child);
    expect(replay.status).toBe(200); expect(replay.body).toEqual(completed.body);
    const view = await call(app(), 'GET', url(task), undefined, child);
    expect(view.body.data.task).toMatchObject({ status: 'confirmed', checklistVersion: 1, checklistSnapshot: checklist,
      parentFeedback: 'Reviewed partial checklist', completionEvidence: {
        checkedItemIds: ['Read'], submittedByActor: { id: child.id, role: 'student' }
      } });
    expect(await Ledger.countDocuments(ledgerQuery(task))).toBe(1);
    expectPublic(view.body);
  });
  test('mixed checklist/material real remote commit loss resumes the original target after rebuilding app', async () => {
    const old = await media(), next = await media();
    const created = await call(app(), 'POST', PREFIX, input({ attachmentMediaIds: [old] }));
    expect(created.status).toBe(201);
    const task = await Task.findById(created.body.data.task.taskId);
    const before = await row(task);
    const body = { title: 'Atomic mixed target', checklistSnapshot: checklist, expectedChecklistVersion: 0, attachmentMediaIds: [next] };
    dropMediaField = 'attachmentMediaIds';
    expectError(await call(app(), 'PATCH', url(task), body), 503, 'MEDIA_REFERENCE_PENDING', { resourceId: String(task._id) });
    const held = await row(task);
    for (const key of ['title', 'checklistSnapshot', 'checklistVersion', 'attachmentMediaIds', 'attachmentMediaBindings']) {
      expect(held[key]).toEqual(before[key]);
    }
    expect(held.mediaCompletionFence).toEqual({ completionVersion: 0, checklistVersion: 0 });
    expectError(await call(app(), 'PATCH', url(task), { ...body, checklistSnapshot: [] }), 409, 'RESOURCE_CONFLICT');
    const recovered = await call(app(), 'PATCH', url(task), body, coparent);
    expect(recovered.status).toBe(200);
    expect(recovered.body.data.task).toMatchObject({ title: body.title, checklistVersion: 1, checklistSnapshot: checklist, attachmentMediaIds: [next] });
    const after = await row(task);
    expect(after.attachmentMediaBindings).toHaveLength(1);
    expect(after.attachmentMediaBindings[0].bindingOperationId).toBe(held.mediaBindingOperationId);
    const release = mediaCalls.find(entry => entry.action === 'unbind' && entry.body.references.some(ref => ref.mediaId === old));
    expect(release.body.references[0].bindingOperationId).toBe(before.attachmentMediaBindings[0].bindingOperationId);
    expect(dropped).toHaveLength(1); expectPublic(recovered.body);
    expectError(await call(app(), 'PATCH', url(task), body), 409, 'VERSION_CONFLICT');
    expect(await row(task)).toEqual(after);
  });
});
const snapshot = async () => {
  const result = [];
  for (const model of models) result.push(await model.collection.find().sort({ _id: 1 }).toArray());
  return result;
};
const expectReadOnly = async (application, task) => {
  const before = await snapshot(), calls = mediaCalls.length, awards = starCalls.length;
  const detail = await call(application, 'GET', url(task));
  const list = await call(application, 'GET', PREFIX + '?childId=' + child.id);
  expect(detail.status).toBe(200); expect(list.status).toBe(200);
  expect(detail.body.data.task.taskId).toBe(String(task._id));
  expect(list.body.data.items.some(item => item.taskId === String(task._id))).toBe(true);
  expectPublic(detail.body); expectPublic(list.body);
  expect(await snapshot()).toEqual(before);
  expect(mediaCalls).toHaveLength(calls); expect(starCalls).toHaveLength(awards);
};

test.each(['createMediaDependencies', 'growthTaskRouterFactory'])('enabled formal factory rejects %s before invoking it', key => {
  const override = jest.fn();
  expect(() => createProductionApp({ env, [key]: override })).toThrow(
    expect.objectContaining({ code: 'COMPLETION_ASSEMBLY_NOT_READY' })
  );
  expect(override).not.toHaveBeenCalled();
  expect(mediaCalls).toHaveLength(0); expect(starCalls).toHaveLength(0);
});

test('strict POST creates and binds materials with server-owned identity and public projection', async () => {
  const application = app(), material = await media();
  const response = await call(application, 'POST', PREFIX,
    input({ title: '  Created title  ', estimatedMinutes: '12', attachmentMediaIds: [material, material] }));
  expect(response.status).toBe(201);
  expect(response.body.data.task).toMatchObject({ title: 'Created title', estimatedMinutes: 12,
    familyId: String(family._id), childId: child.id, createdByParentId: parent.id, attachmentMediaIds: [material] });
  expectPublic(response.body);
  expect(await Task.countDocuments()).toBe(1);
  expect(await Reference.countDocuments({ field: 'attachmentMediaIds', state: 'bound' })).toBe(1);
  expect(await Operation.countDocuments()).toBe(0); expect(await RemoteOperation.countDocuments()).toBe(0);
  expect(starCalls).toHaveLength(0);
});

test.each([
  ['unknown field', { unknown: true }], ['completion field', { completionVersion: 10 }],
  ['internal field', { mediaReferenceState: 'bound' }], ['owner field', { createdByParentId: 'override' }],
  ['missing required value', { title: null }], ['invalid date', { dueDate: '2026-02-30' }],
  ['invalid numeric cast', { estimatedMinutes: 'invalid' }], ['null attachments', { attachmentMediaIds: null }]
])('POST rejects %s before any task or provider write', async (_label, extra) => {
  const application = app(), before = await snapshot();
  expectError(await call(application, 'POST', PREFIX, input(extra)), 400, 'VALIDATION_ERROR');
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(0); expect(starCalls).toHaveLength(0);
});

test.each(['child', 'outsider'])('POST denies %s without creating a task', async kind => {
  const application = app(), before = await snapshot();
  expectError(await call(application, 'POST', PREFIX, input(), kind === 'child' ? child : outsider), 403, 'CHILD_ACCESS_DENIED');
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(0);
});

test('PATCH mixed fields and materials publishes together, and empty array releases the exact old binding', async () => {
  const application = app(), task = await seed(), material = await media();
  const result = await call(application, 'PATCH', url(task), { title: 'Mixed title', estimatedMinutes: '15', attachmentMediaIds: [material] });
  expect(result.status).toBe(200);
  expect(result.body.data.task).toMatchObject({ title: 'Mixed title', estimatedMinutes: 15, attachmentMediaIds: [material] });
  const binding = await Reference.findOne({ mediaId: material, state: 'bound' }).lean();
  expect(binding).not.toBeNull();
  const cleared = await call(application, 'PATCH', url(task), { title: 'Cleared title', attachmentMediaIds: [] });
  expect(cleared.status).toBe(200);
  expect(cleared.body.data.task).toMatchObject({ title: 'Cleared title', estimatedMinutes: 15, attachmentMediaIds: [] });
  expect((await Reference.findById(binding._id)).state).toBe('released');
  expectPublic(result.body); expectPublic(cleared.body);
});

describe.each([false, true])('PATCH validation with materials=%s', withMaterials => {
  test.each([
    ['unknown', { unknown: true }], ['single invalid cast', { estimatedMinutes: 'bad' }],
    ['multiple invalid casts', { estimatedMinutes: 'bad', targetAmount: 'bad' }],
    ['required null', { title: null }], ['null date', { dueDate: null }],
    ['invalid date', { dueDate: '2026-02-30' }]
  ])('%s is rejected atomically', async (_label, patch) => {
    const application = app(), task = await seed();
    const body = { ...patch, ...(withMaterials ? { attachmentMediaIds: [await media()] } : {}) };
    const before = await snapshot();
    expectError(await call(application, 'PATCH', url(task), body), 400, 'VALIDATION_ERROR');
    expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(0); expect(starCalls).toHaveLength(0);
  });
  test('nullable numeric fields clear existing values without losing the rest of the patch', async () => {
    const application = app(), task = await seed({ estimatedMinutes: 20, targetAmount: 3 });
    const body = { title: 'Null numbers', estimatedMinutes: null, targetAmount: null,
      ...(withMaterials ? { attachmentMediaIds: [await media()] } : {}) };
    const response = await call(application, 'PATCH', url(task), body);
    expect(response.status).toBe(200);
    expect(await row(task)).toMatchObject({ title: 'Null numbers', estimatedMinutes: null, targetAmount: null });
    expectPublic(response.body);
  });
});

test.each(['outsider', 'sibling', 'departed'])('%s is denied before malformed task commands are parsed', async kind => {
  const application = app(), task = await seed();
  if (kind === 'departed') await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: coparent.id } });
  const actor = kind === 'outsider' ? outsider : kind === 'sibling' ? sibling : coparent;
  const before = await snapshot();
  for (const [method, suffix, body] of [
    ['PATCH', '', { unknown: true }], ['PATCH', '', { attachmentMediaIds: null, unknown: true }],
    ['PATCH', '/complete', { unknown: true }], ['PATCH', '/confirm', { unknown: true }],
    ['DELETE', '', { unknown: true }], ['GET', '', undefined]
  ]) expectError(await call(application, method, url(task) + suffix, body, actor), 403, 'CHILD_ACCESS_DENIED');
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(0); expect(starCalls).toHaveLength(0);
});

test('child cannot edit materials, edit ordinary fields, delete or confirm its own task', async () => {
  const application = app(), task = await seed(), before = await snapshot();
  for (const [method, suffix, body] of [
    ['PATCH', '', { title: 'Denied' }], ['PATCH', '', { attachmentMediaIds: [] }],
    ['DELETE', '', undefined], ['PATCH', '/confirm', { expectedCompletionVersion: 0 }]
  ]) expectError(await call(application, method, url(task) + suffix, body, child), 403, 'CHILD_ACCESS_DENIED');
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(0); expect(starCalls).toHaveLength(0);
});

test.each(['complete', 'confirm'])('old %s client gets the real public 400 upgrade contract', async action => {
  const application = app(), task = await seed(), before = await snapshot();
  expectError(await call(application, 'PATCH', url(task) + '/' + action,
    action === 'complete' ? { actualMinutes: 5 } : { parentFeedback: 'Old client' }, action === 'complete' ? child : parent),
  400, 'CLIENT_UPGRADE_REQUIRED');
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(0); expect(starCalls).toHaveLength(0);
});

test('formal completion and confirmation use real references and one real star ledger entry', async () => {
  const application = app(), task = await seed(), completionId = await media('task_completion');
  const body = command({ completionMediaIds: [completionId], childNote: 'Synthetic private evidence' });
  const completed = await call(application, 'PATCH', url(task) + '/complete', body, child);
  expect(completed.status).toBe(200);
  expect(completed.body.data.task).toMatchObject({ status: 'completed', completionVersion: 1, completionMediaIds: [completionId] });
  expect(JSON.stringify(completed.body)).not.toContain('Synthetic private evidence');
  expect(await Reference.countDocuments({ field: 'completionMediaIds', state: 'bound' })).toBe(1);
  const replay = await call(application, 'PATCH', url(task) + '/complete', body, child);
  expect(replay.body).toEqual(completed.body);
  const confirmed = await call(application, 'PATCH', url(task) + '/confirm', { expectedCompletionVersion: 1, parentFeedback: 'First review' }, coparent);
  expect(confirmed.status).toBe(200);
  expect(confirmed.body.data.task).toMatchObject({ status: 'confirmed', confirmedByParentId: coparent.id, starAwardState: 'awarded' });
  const before = await row(task), awards = starCalls.length;
  expect((await call(application, 'PATCH', url(task) + '/confirm', { expectedCompletionVersion: 1, parentFeedback: 'Different review' })).status).toBe(200);
  expect(await row(task)).toEqual(before); expect(starCalls).toHaveLength(awards);
  expect(await Ledger.countDocuments(ledgerQuery(task))).toBe(1);
  expect(starCalls[0]).toMatchObject({ familyId: String(family._id), childId: child.id, taskId: String(task._id), confirmedByParentId: coparent.id });
  expectPublic(completed.body); expectPublic(confirmed.body); await expectReadOnly(application, task);
});

test('concurrent parent confirmations retain one audit and one ledger entry', async () => {
  const application = app(), task = await seed();
  expect((await call(application, 'PATCH', url(task) + '/complete', command(), child)).status).toBe(200);
  const responses = await Promise.all([parent, coparent].map(actor => call(application, 'PATCH', url(task) + '/confirm',
    { expectedCompletionVersion: 1, parentFeedback: actor.id }, actor)));
  for (const response of responses) expect(response.status).toBe(200);
  const stored = await row(task);
  expect([parent.id, coparent.id]).toContain(String(stored.confirmedByParentId));
  expect(stored.parentFeedback).toBe(String(stored.confirmedByParentId));
  expect(await Ledger.countDocuments(ledgerQuery(task))).toBe(1);
  for (const response of responses) expect(response.body.data.task.confirmedByParentId).toBe(String(stored.confirmedByParentId));
});

test.each(['pending', 'completed', 'confirmed'])('DELETE %s cancels or archives without physical removal', async status => {
  const application = app(), task = await seed();
  if (status !== 'pending') expect((await call(application, 'PATCH', url(task) + '/complete', command(), child)).status).toBe(200);
  if (status === 'confirmed') expect((await call(application, 'PATCH', url(task) + '/confirm', { expectedCompletionVersion: 1 })).status).toBe(200);
  const calls = mediaCalls.length, awards = starCalls.length;
  const result = await call(application, 'DELETE', url(task));
  expect(result.status).toBe(200);
  expect(result.body.data).toMatchObject({ deleted: false, task: { status: status === 'pending' ? 'cancelled' : 'archived' } });
  const stored = await row(task); expect(stored).not.toBeNull();
  expect((await call(application, 'DELETE', url(task))).status).toBe(200);
  expect(await row(task)).toEqual(stored); expectPublic(result.body);
  expect(mediaCalls).toHaveLength(calls); expect(starCalls).toHaveLength(awards);
});

const pendingMaterial = async (application, task) => {
  const material = await media(), body = { title: 'Intent A', attachmentMediaIds: [material] };
  dropMediaField = 'attachmentMediaIds';
  expectError(await call(application, 'PATCH', url(task), body), 503, 'MEDIA_REFERENCE_PENDING', { resourceId: String(task._id) });
  expect(dropped).toHaveLength(1); expect(dropMediaField).toBeNull();
  expect(await Reference.countDocuments({ mediaId: material, state: 'bound' })).toBe(1);
  expect(await row(task)).toMatchObject({ title: 'Original title', mediaReferenceState: 'pending',
    mediaCompletionFence: { completionVersion: 0, checklistVersion: 0 } });
  return { material, body };
};

test('material pending GET is read-only; completion, confirmation, ordinary edit and delete cannot recover it', async () => {
  const application = app(), task = await seed();
  const { body } = await pendingMaterial(application, task);
  await expectReadOnly(application, task);
  const before = await snapshot(), calls = mediaCalls.length;
  for (const [method, suffix, payload, actor] of [
    ['PATCH', '/complete', command(), child], ['PATCH', '/confirm', { expectedCompletionVersion: 0 }, parent],
    ['PATCH', '', { title: 'Must not publish' }, parent], ['DELETE', '', undefined, parent]
  ]) expectError(await call(application, method, url(task) + suffix, payload, actor), 503, 'MEDIA_REFERENCE_PENDING');
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(calls); expect(starCalls).toHaveLength(0);
  const recovered = await call(app(), 'PATCH', url(task), body);
  expect(recovered.status).toBe(200); expect(recovered.body.data.task).toMatchObject(body);
  expect((await row(task)).mediaReferenceState).toBe('bound'); expectPublic(recovered.body);
  expect(new Set(mediaCalls.filter(call => ['prepare', 'commit'].includes(call.action)).map(call => call.body.operationId)).size).toBe(1);
});

test('pending material retry with the same IDs but different title rejects the new intent, then original intent recovers', async () => {
  const application = app(), task = await seed();
  const { material, body } = await pendingMaterial(application, task);
  const before = await snapshot(), calls = mediaCalls.length, awards = starCalls.length;
  const conflict = await call(application, 'PATCH', url(task), { title: 'Intent B', attachmentMediaIds: [material] });
  expectError(conflict, 409, 'RESOURCE_CONFLICT');
  expect(await snapshot()).toEqual(before);
  expect(mediaCalls).toHaveLength(calls); expect(starCalls).toHaveLength(awards);
  expect((await row(task)).title).not.toBe('Intent B');
  const recovered = await call(app(), 'PATCH', url(task), body);
  expect(recovered.status).toBe(200);
  expect(recovered.body.data.task).toMatchObject({ title: 'Intent A', attachmentMediaIds: [material] });
  expect((await row(task)).mediaReferenceState).toBe('bound'); expectPublic(recovered.body);
  expect(await Reference.countDocuments({ mediaId: material, state: 'bound' })).toBe(1);
});

test('POST lost commit response exposes only resourceId and resumes that pending task via attachment-only PATCH', async () => {
  const application = app(), material = await media();
  dropMediaField = 'attachmentMediaIds';
  const result = await call(application, 'POST', PREFIX, input({ attachmentMediaIds: [material] }));
  expect(result.status).toBe(503); expect(dropped).toHaveLength(1);
  expect(result.body.error.details).toEqual({ resourceId: expect.stringMatching(/^[0-9a-f]{24}$/i) });
  expectError(result, 503, 'MEDIA_REFERENCE_PENDING', { resourceId: result.body.error.details.resourceId });
  expect(await Task.countDocuments()).toBe(1);
  const task = await Task.findById(result.body.error.details.resourceId);
  expect(task).not.toBeNull(); expect(task.mediaReferenceState).toBe('pending');
  expect(await Reference.countDocuments({ mediaId: material, state: 'bound' })).toBe(1);
  const calls = mediaCalls.length;
  expectError(await call(application, 'PATCH', url(task), { title: 'Not a recovery command' }), 503, 'MEDIA_REFERENCE_PENDING');
  expect(mediaCalls).toHaveLength(calls);
  // No second POST and no GET recovery: the exposed ID addresses the original task.
  const recovered = await call(app(), 'PATCH', url(task), { attachmentMediaIds: [material] });
  expect(recovered.status).toBe(200);
  expect(recovered.body.data.task).toMatchObject({ taskId: String(task._id), title: 'Original title', attachmentMediaIds: [material] });
  expect(await Task.countDocuments()).toBe(1); expect((await row(task)).mediaReferenceState).toBe('bound');
  expectPublic(recovered.body);
});

test('remote completion commit response loss preserves one operation and resumes only the original complete command', async () => {
  const application = app(), task = await seed(), completionId = await media('task_completion');
  const body = command({ completionMediaIds: [completionId] });
  dropMediaField = 'completionMediaIds';
  expectError(await call(application, 'PATCH', url(task) + '/complete', body, child), 503, 'MEDIA_REFERENCE_PENDING');
  expect(dropped).toHaveLength(1);
  const operation = await Operation.findOne({ taskId: task._id }).lean();
  expect(operation).toMatchObject({ phase: 'PREPUBLISH' });
  expect(await RemoteOperation.findOne({ operationId: operation.remoteOperationId }).lean()).toMatchObject({ state: 'COMMITTED' });
  await expectReadOnly(application, task);
  const before = await snapshot(), calls = mediaCalls.length;
  expectError(await call(application, 'PATCH', url(task), { title: 'Blocked material edit', attachmentMediaIds: [] }),
    503, 'MEDIA_REFERENCE_PENDING', { resourceId: String(task._id) });
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(calls);
  const recovered = await call(app(), 'PATCH', url(task) + '/complete', body, child);
  expect(recovered.status).toBe(200); expect(recovered.body.data.task.completionVersion).toBe(1);
  expect(mediaCalls.slice(calls).some(call => call.action === 'status' && call.body.operationId === operation.remoteOperationId)).toBe(true);
  expect(await Operation.countDocuments({ taskId: task._id })).toBe(1); expect(await RemoteOperation.countDocuments()).toBe(1);
  expect((await Operation.findById(operation._id)).remoteOperationId).toBe(operation.remoteOperationId);
  expect(await Reference.countDocuments({ field: 'completionMediaIds', state: 'bound' })).toBe(1);
  expectPublic(recovered.body);
});

test('lost real star acknowledgement leaves one ledger entry and retry preserves the first confirming parent', async () => {
  const application = app(), task = await seed();
  expect((await call(application, 'PATCH', url(task) + '/complete', command(), child)).status).toBe(200);
  dropStars = true;
  expectError(await call(application, 'PATCH', url(task) + '/confirm', { expectedCompletionVersion: 1, parentFeedback: 'First audit' }),
    503, 'STAR_AWARD_PENDING');
  expect(dropped).toEqual([{ action: 'award' }]);
  expect(await Ledger.countDocuments(ledgerQuery(task))).toBe(1);
  const first = await row(task);
  expect(first.starAwardState).toBe('pending'); await expectReadOnly(application, task);
  const recovered = await call(app(), 'PATCH', url(task) + '/confirm', { expectedCompletionVersion: 1, parentFeedback: 'Later audit' }, coparent);
  expect(recovered.status).toBe(200);
  expect(await row(task)).toMatchObject({ confirmedByParentId: first.confirmedByParentId, confirmedAt: first.confirmedAt,
    parentFeedback: 'First audit', starAwardState: 'awarded' });
  expect(await Ledger.countDocuments(ledgerQuery(task))).toBe(1); expectPublic(recovered.body);
});

test('GET projection excludes unknown top-level and nested document fields without rewriting the document', async () => {
  const application = app(), task = await seed();
  await Task.collection.updateOne({ _id: task._id }, { $set: { privateSentinel: 'private',
    checklistSnapshot: [{ itemId: 'one', label: 'Synthetic item', required: true, privateSentinel: 'private' }],
    completionEvidence: { checkedItemIds: [], completionMediaIds: [], privateSentinel: 'private',
      submittedByActor: { id: child.id, role: 'student', privateSentinel: 'private' } } } });
  await expectReadOnly(application, task);
});

test('enabled formal app resumes an unfenced legacy mixed material PATCH with the original operation and exact binding generations', async () => {
  const legacy = createProductionApp({ env: { ...env, COMPLETION_PROTOCOL_MODE: 'legacy' } });
  const kept = await media(), removed = await media(), addedFirst = await media(), addedLast = await media();
  const created = await call(legacy, 'POST', PREFIX, input({ attachmentMediaIds: [kept, removed] }));
  expect(created.status).toBe(201);
  const task = await Task.findOne(), baseline = await row(task);
  const previousGeneration = baseline.attachmentMediaBindings[0].bindingOperationId;
  expect(baseline.attachmentMediaBindings.map(binding => binding.bindingOperationId))
    .toEqual([previousGeneration, previousGeneration]);
  const body = { title: 'Legacy mixed intent', estimatedMinutes: 17, description: 'Original legacy patch',
    attachmentMediaIds: [addedFirst, kept, addedLast] };
  const intentCallsStart = mediaCalls.length;
  dropMediaField = 'attachmentMediaIds';
  expectError(await call(legacy, 'PATCH', url(task), body), 503, 'MEDIA_REFERENCE_PENDING', { resourceId: String(task._id) });
  const pending = await row(task), operationId = pending.mediaBindingOperationId;
  expect(pending).toMatchObject({ title: 'Original title', mediaReferenceState: 'pending',
    mediaMutationKind: 'patch', mediaBindingPhase: 'binding' });
  expect(pending).not.toHaveProperty('mediaCompletionFence');
  expect(pending.attachmentMediaIds.map(String)).toEqual([kept, removed]);
  expect(pending.attachmentMediaPendingIds.map(String)).toEqual(body.attachmentMediaIds);
  expect(dropped).toEqual([{ action: 'commit', field: 'attachmentMediaIds', operationId }]);
  expect(dropMediaField).toBeNull(); expect(operationId).not.toBe(previousGeneration);
  expect(await Reference.countDocuments({ mediaId: { $in: [addedFirst, addedLast] },
    resourceId: task._id, operationId, state: 'bound' })).toBe(2);

  const enabled = app();
  await expectReadOnly(enabled, task);
  expect(await row(task)).not.toHaveProperty('mediaCompletionFence');
  const recoveryCallsStart = mediaCalls.length;
  const recovered = await call(enabled, 'PATCH', url(task), body);
  expect(recovered.status).toBe(200);
  expect(recovered.body.data.task).toMatchObject({ ...body, taskId: String(task._id) });
  expectPublic(recovered.body);
  const settled = await row(task);
  expect(settled).toMatchObject({ title: body.title, estimatedMinutes: body.estimatedMinutes,
    description: body.description, mediaReferenceState: 'bound' });
  expect(settled.attachmentMediaIds.map(String)).toEqual(body.attachmentMediaIds);
  expect(settled.attachmentMediaBindings.map(binding => ({ mediaId: String(binding.mediaId),
    bindingOperationId: binding.bindingOperationId }))).toEqual([
    { mediaId: addedFirst, bindingOperationId: operationId },
    { mediaId: kept, bindingOperationId: previousGeneration },
    { mediaId: addedLast, bindingOperationId: operationId }
  ]);
  for (const mediaId of [addedFirst, addedLast]) {
    expect(await Reference.findOne({ mediaId, resourceId: task._id }).lean())
      .toMatchObject({ state: 'bound', operationId });
  }
  expect(await Reference.findOne({ mediaId: kept, resourceId: task._id }).lean())
    .toMatchObject({ state: 'bound', operationId: previousGeneration });
  expect(await Reference.findOne({ mediaId: removed, resourceId: task._id }).lean())
    .toMatchObject({ state: 'released', operationId: previousGeneration, releaseOperationId: operationId });
  expect(new Set(mediaCalls.slice(intentCallsStart).map(call => call.body.operationId))).toEqual(new Set([operationId]));
  const recoveryCalls = mediaCalls.slice(recoveryCallsStart);
  expect(recoveryCalls.map(call => call.action)).toEqual(['prepare', 'commit', 'unbind']);
  expect(recoveryCalls.find(call => call.action === 'unbind').body.references).toEqual([
    { mediaId: removed, field: 'attachmentMediaIds', bindingOperationId: previousGeneration }
  ]);
  expect(await Task.countDocuments()).toBe(1); expect(await Operation.countDocuments()).toBe(0);
  expect(await RemoteOperation.countDocuments()).toBe(0); expect(starCalls).toHaveLength(0);
  await expectReadOnly(enabled, task);
});

const verifyRecoveryReloadRace = async (initialState, nextState) => {
  const application = app(), task = await seed();
  const original = initialState === 'pending' ? (await pendingMaterial(application, task)).body
    : initialState === 'noop' ? { attachmentMediaIds: [] }
      : { title: 'Original stable edit', attachmentMediaIds: [] };
  const originalOperation = (await row(task)).mediaBindingOperationId;
  const replacement = { title: 'Replacement intent B', attachmentMediaIds: [await media()] };
  const findById = Task.findById.bind(Task);
  let reads = 0, interleaved = false, before, calls, awards;
  const spy = jest.spyOn(Task, 'findById').mockImplementation((...args) => {
    const query = findById(...args);
    // Authorization, initial load, recovery reload, and an extra read for a no-op.
    if (String(args[0]) === String(task._id) && ++reads === (initialState === 'noop' ? 4 : 3)) {
      const exec = query.exec;
      query.exec = async function (...options) {
        spy.mockRestore();
        if (initialState === 'pending') {
          expect((await call(app(), 'PATCH', url(task), original, coparent)).status).toBe(200);
        }
        if (nextState === 'pending') dropMediaField = 'attachmentMediaIds';
        const next = await call(app(), 'PATCH', url(task), replacement, coparent);
        expect(next.status).toBe(nextState === 'pending' ? 503 : 200);
        const current = await row(task);
        if (nextState === 'pending') {
          expect(current.mediaBindingOperationId).not.toBe(originalOperation);
          expect(current.mediaReferenceState).toBe('pending');
        } else {
          expect(current).toMatchObject({ title: replacement.title, mediaReferenceState: 'bound' });
        }
        before = await snapshot(); calls = mediaCalls.length; awards = starCalls.length;
        interleaved = true;
        return exec.apply(this, options);
      };
    }
    return query;
  });
  let response;
  try { response = await call(application, 'PATCH', url(task), original); }
  finally { spy.mockRestore(); }
  expect(interleaved).toBe(true);
  expectError(response, 503, 'MEDIA_REFERENCE_PENDING', { resourceId: String(task._id) });
  expect(await snapshot()).toEqual(before);
  expect(mediaCalls).toHaveLength(calls); expect(starCalls).toHaveLength(awards);
  if (nextState === 'pending') {
    const recovered = await call(app(), 'PATCH', url(task), replacement, coparent);
    expect(recovered.status).toBe(200);
    expect(recovered.body.data.task).toMatchObject(replacement);
    expect((await row(task)).mediaReferenceState).toBe('bound');
  }
};

test.each(['pending', 'stable'])('original material retry cannot adopt a replacement %s intent during recovery reload',
  nextState => verifyRecoveryReloadRace('pending', nextState));
test.each(['pending', 'stable'])('stable material edit cannot adopt a replacement %s intent during recovery reload',
  nextState => verifyRecoveryReloadRace('stable', nextState));

test.each(['pending', 'stable'])('no-op material edit cannot return a replacement %s intent during final reload',
  nextState => verifyRecoveryReloadRace('noop', nextState));

test('unchanged material no-op succeeds without database or remote side effects', async () => {
  const task = await seed(), before = await snapshot();
  const response = await call(app(), 'PATCH', url(task), { attachmentMediaIds: [] });
  expect(response.status).toBe(200);
  expect(response.body.data.task).toMatchObject({ taskId: String(task._id), title: task.title, attachmentMediaIds: [] });
  expect(await snapshot()).toEqual(before);
  expect(mediaCalls).toHaveLength(0); expect(starCalls).toHaveLength(0);
});

const gateway = async (mode = 'enabled') => createGatewayApp({
  serviceHosts: { user: env.PROGRESS_SERVICE_URL, progress: env.PROGRESS_SERVICE_URL,
    homework: await listen(createProductionApp({ env: { ...env, COMPLETION_PROTOCOL_MODE: mode } })),
    resource: mode === 'enabled' ? env.RESOURCE_SERVICE_URL
      : await listen(createResourceApp({ env: { ...resourceEnv, COMPLETION_PROTOCOL_MODE: mode } })) },
  jwtSecret: process.env.JWT_SECRET, identitySecret: process.env.GATEWAY_IDENTITY_SECRET,
  enableLegacyDataProxy: false, rateLimitOptions: { windowMs: 60000, max: 1000 }
});
const publicCall = async (application, method, target, body, identity = parent, headers = {}) => {
  let req = (await request(application))[method.toLowerCase()](target);
  if (identity) req = req.set('Authorization', 'Bearer ' + jwt.sign(identity, process.env.JWT_SECRET, { expiresIn: '1h' }));
  req = req.set(headers);
  return body === undefined ? req : req.send(body);
};

const recoveryUrl = (task, operationId) => url(task) + '/completion-operations/' + operationId + '/recover';
const expectRecovery = (response, recovery) => {
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body).toEqual({ success: true, data: { recovery } });
  expectPublic(response.body);
};

test('T2-R-001/002 cross-day discovery is read-only and recovers from a fresh Gateway without the original body', async () => {
  let application = await gateway();
  const task = await seed({ dueDate: '2025-01-01' }), ids = [await media('task_completion'), await media('task_completion')];
  const body = command({ completionMediaIds: ids, actualMinutes: 7, childNote: 'Original persisted intent' });
  dropCompletionAction = 'commit';
  expectError(await publicCall(application, 'PATCH', url(task) + '/complete', body, child), 503, 'MEDIA_REFERENCE_PENDING');
  const local = await Operation.findOne({ taskId: task._id }).lean();
  application = await reconstructFormalApps();
  const before = await snapshot(), calls = mediaCalls.length;
  const list = await publicCall(application, 'GET', PREFIX + '/completion-recoveries', undefined, child);
  expect(list.status).toBe(200);
  expect(list.headers['cache-control']).toBe('no-store');
  expect(list.body).toEqual({ success: true, data: { items: [{ taskId: String(task._id), childId: child.id,
    operationId: body.operationId, targetCompletionVersion: 1 }], page: 1, pageSize: 20, hasMore: false } });
  expectPublic(list.body);
  expectRecovery(await publicCall(application, 'GET', url(task) + '/completion-recovery', undefined, child),
    { state: 'recoverable', operationId: body.operationId, targetCompletionVersion: 1 });
  expectRecovery(await publicCall(application, 'GET', url(task) + '/completion-recovery', undefined, coparent),
    { state: 'other_actor', operationId: null, targetCompletionVersion: null });
  expect((await publicCall(application, 'GET', PREFIX + '/completion-recoveries', undefined, coparent)).body.data.items).toEqual([]);
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(calls); expect(starCalls).toHaveLength(0);
  expectError(await publicCall(application, 'POST', recoveryUrl(task, body.operationId), {}, coparent), 404, 'RESOURCE_NOT_FOUND');
  expect(await snapshot()).toEqual(before);
  const recovered = await publicCall(application, 'POST', recoveryUrl(task, body.operationId), undefined, child);
  expect(recovered.status).toBe(200); expectPublic(recovered.body);
  expect(recovered.body.data.task).toMatchObject({ completionVersion: 1, completionMediaIds: ids });
  const completed = await row(task);
  expect(completed.completionEvidence).toMatchObject({ childNote: 'Original persisted intent', actualMinutes: 7 });
  expect(completed.completionMediaBindings.map(r => [String(r.mediaId), r.bindingOperationId]))
    .toEqual(ids.map(id => [id, local.remoteOperationId]));
  expect((await Operation.findById(local._id)).remoteOperationId).toBe(local.remoteOperationId);
  expect(await Operation.countDocuments()).toBe(1); expect(await RemoteOperation.countDocuments()).toBe(1);
  expectRecovery(await publicCall(application, 'GET', url(task) + '/completion-recovery', undefined, child),
    { state: 'none', operationId: null, targetCompletionVersion: null });
  expect((await publicCall(application, 'GET', PREFIX + '/completion-recoveries', undefined, child)).body.data.items).toEqual([]);
});

test.each([{}, [], { operationId: 'different' }, { actorId: 'different' }, { remoteOperationId: 'private' },
  { expectedCompletionVersion: 1 }, { completionMediaIds: [] }])('T2-R-004 recovery body whitelist: %j', async payload => {
  const application = await gateway(), task = await seed(), c = command();
  const completed = await publicCall(application, 'PATCH', url(task) + '/complete', c, child);
  expect(completed.status).toBe(200);
  const before = await snapshot(), calls = mediaCalls.length;
  const response = await publicCall(application, 'POST', recoveryUrl(task, c.operationId), payload, child);
  if (Array.isArray(payload) || Object.keys(payload).length) expectError(response, 400, 'VALIDATION_ERROR');
  else { expect(response.status).toBe(200); expect(response.body).toEqual(completed.body); }
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(calls);
});

test.each(['page=0', 'pageSize=51', 'pageSize=1.5', 'page=9007199254740992', 'actorId=anything', 'familyId=anything', 'childId=anything', 'page=1&page=2'])('T2-R-002 rejects unsafe discovery query %s', async query => {
  const application = await gateway(), before = await snapshot();
  expectError(await publicCall(application, 'GET', PREFIX + '/completion-recoveries?' + query, undefined, child), 400, 'VALIDATION_ERROR');
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(0);
});

test.each(['sibling', 'outsider', 'revoked-parent', 'stale-child', 'anonymous'])('T2-R-002 recovery rejects %s without writes', async kind => {
  const application = await gateway(), task = await seed(), c = command({ completionMediaIds: [await media('task_completion')] });
  dropCompletionAction = 'prepare';
  expectError(await publicCall(application, 'PATCH', url(task) + '/complete', c, child), 503, 'MEDIA_REFERENCE_PENDING');
  let actor = { sibling, outsider, 'revoked-parent': coparent, 'stale-child': child, anonymous: null }[kind];
  if (kind === 'revoked-parent') await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: coparent.id } });
  if (kind === 'stale-child') await User.updateOne({ _id: child.id }, { $inc: { 'childProfile.tokenVersion': 1 } });
  const before = await snapshot(), calls = mediaCalls.length;
  for (const [method, target] of [['GET', url(task) + '/completion-recovery'], ['POST', recoveryUrl(task, c.operationId)]]) {
    const response = await publicCall(application, method, target, undefined, actor);
    expect(response.status).toBe(['anonymous', 'stale-child'].includes(kind) ? 401 : 403);
    if (kind === 'stale-child') expect(response.body.error.code).toBe('STALE_CHILD_TOKEN');
    expectPublic(response.body);
  }
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(calls);
});

test.each(['PREPUBLISH', 'PUBLISHED_CLEANUP'])('T2-R-004 damaged %s mapping rejects discovery and recovery', async phase => {
  const application = await gateway(), task = await seed();
  if (phase === 'PUBLISHED_CLEANUP') expect((await publicCall(application, 'PATCH', url(task) + '/complete',
    command({ completionMediaIds: [await media('task_completion')] }), child)).status).toBe(200);
  const c = command({ expectedCompletionVersion: phase === 'PREPUBLISH' ? 0 : 1, completionMediaIds: [await media('task_completion')] });
  dropCompletionAction = phase === 'PREPUBLISH' ? 'commit' : 'unbind';
  expectError(await publicCall(application, 'PATCH', url(task) + '/complete', c, child), 503, 'MEDIA_REFERENCE_PENDING');
  const op = await Operation.findOne({ taskId: task._id, operationId: c.operationId });
  expect(op.phase).toBe(phase);
  await Operation.collection.updateOne({ _id: op._id }, { $set: { remoteOperationId: 'corrupt' } });
  const before = await snapshot(), calls = mediaCalls.length;
  for (const [method, target] of [['GET', PREFIX + '/completion-recoveries'], ['GET', url(task) + '/completion-recovery'],
    ['POST', recoveryUrl(task, c.operationId)]]) {
    expectError(await publicCall(application, method, target, undefined, child), 503, 'MEDIA_REFERENCE_PENDING');
  }
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(calls);
});

test('T2-R-001 paginates all dates in task order and excludes other actors and terminal operations', async () => {
  const application = await gateway(), expected = [];
  for (const dueDate of ['2025-01-01', '2027-01-01', '2026-10-23']) {
    const task = await seed({ dueDate }), c = command({ completionMediaIds: [await media('task_completion')] });
    dropCompletionAction = 'prepare';
    expectError(await publicCall(application, 'PATCH', url(task) + '/complete', c, parent), 503, 'MEDIA_REFERENCE_PENDING');
    expected.push({ taskId: String(task._id), childId: child.id, operationId: c.operationId, targetCompletionVersion: 1 });
  }
  const other = await seed(), c = command({ completionMediaIds: [await media('task_completion')] });
  dropCompletionAction = 'prepare';
  expectError(await publicCall(application, 'PATCH', url(other) + '/complete', c, child), 503, 'MEDIA_REFERENCE_PENDING');
  const done = await seed();
  expect((await publicCall(application, 'PATCH', url(done) + '/complete', command(), parent)).status).toBe(200);
  expected.sort((a, b) => a.taskId.localeCompare(b.taskId));
  const before = await snapshot(), calls = mediaCalls.length;
  for (const [page, items, hasMore] of [[1, expected.slice(0, 2), true], [2, expected.slice(2), false], [3, [], false]]) {
    const response = await publicCall(application, 'GET', PREFIX + `/completion-recoveries?page=${page}&pageSize=2`, undefined, parent);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { items, page, pageSize: 2, hasMore } });
  }
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(calls);
});

test.each(['missing owner', 'missing owner and pending', 'missing operation', 'wrong hash', 'incomplete collection'])('T2-R-004 inconsistent intent %s cannot masquerade as no recovery', async kind => {
  const application = await gateway(), task = await seed(), c = command({ completionMediaIds: [await media('task_completion')] });
  dropCompletionAction = 'prepare';
  expectError(await publicCall(application, 'PATCH', url(task) + '/complete', c, child), 503, 'MEDIA_REFERENCE_PENDING');
  if (kind === 'missing operation') await Operation.deleteOne({ taskId: task._id });
  else await Task.collection.updateOne({ _id: task._id }, kind === 'missing owner' ? { $unset: { activeCompletionOperation: '' } }
    : kind === 'missing owner and pending' ? { $unset: { activeCompletionOperation: '', completionPending: '' }, $set: { completionMediaReferenceState: 'stable' } }
    : { $set: kind === 'wrong hash' ? { 'completionPending.commandHash': '0'.repeat(64) } : { 'completionPending.additionIds': [] } });
  const before = await snapshot(), calls = mediaCalls.length;
  for (const target of [url(task) + '/completion-recovery', PREFIX + '/completion-recoveries']) {
    expectError(await publicCall(application, 'GET', target, undefined, child), 503, 'MEDIA_REFERENCE_PENDING');
  }
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(calls);
});

test('T2-R-004 same UUID across actors replays terminal A without touching active B', async () => {
  const application = await gateway(), task = await seed(), uuid = randomUUID(), a = command({ operationId: uuid });
  const first = await publicCall(application, 'PATCH', url(task) + '/complete', a, child);
  expect(first.status).toBe(200);
  const b = command({ operationId: uuid, expectedCompletionVersion: 1, completionMediaIds: [await media('task_completion')] });
  dropCompletionAction = 'commit';
  expectError(await publicCall(application, 'PATCH', url(task) + '/complete', b, parent), 503, 'MEDIA_REFERENCE_PENDING');
  const before = await snapshot(), calls = mediaCalls.length;
  const replay = await publicCall(application, 'POST', recoveryUrl(task, uuid), {}, child);
  expect(replay.status).toBe(200); expect(replay.body).toEqual(first.body);
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(calls);
  expectError(await publicCall(application, 'POST', recoveryUrl(task, randomUUID()), {}, child), 404, 'RESOURCE_NOT_FOUND');
  expect(await snapshot()).toEqual(before);
  expectRecovery(await publicCall(application, 'GET', url(task) + '/completion-recovery', undefined, child),
    { state: 'other_actor', operationId: null, targetCompletionVersion: null });
  expect((await publicCall(application, 'POST', recoveryUrl(task, uuid), {}, parent)).status).toBe(200);
  const ops = await Operation.find({ taskId: task._id }).lean();
  expect(ops).toHaveLength(2); expect(new Set(ops.map(op => op.remoteOperationId)).size).toBe(2);
  const stable = await snapshot();
  expect((await publicCall(application, 'POST', recoveryUrl(task, uuid), {}, child)).body).toEqual(first.body);
  expect(await snapshot()).toEqual(stable); expect((await row(task)).completionVersion).toBe(2);
});

test('T2-R-003 expired lease discovery stays read-only and POST replays stable failure', async () => {
  const application = await gateway(), task = await seed(), c = command({ completionMediaIds: [await media('task_completion')] });
  const initial = await row(task);
  dropCompletionAction = 'prepare';
  expectError(await publicCall(application, 'PATCH', url(task) + '/complete', c, child), 503, 'MEDIA_REFERENCE_PENDING');
  const local = await Operation.findOne({ taskId: task._id }).lean();
  await expirePrepared(local);
  const before = await snapshot(), calls = mediaCalls.length;
  expectRecovery(await publicCall(application, 'GET', url(task) + '/completion-recovery', undefined, child),
    { state: 'recoverable', operationId: c.operationId, targetCompletionVersion: 1 });
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(calls);
  expectError(await publicCall(application, 'POST', recoveryUrl(task, c.operationId), {}, child), 409, 'MEDIA_OPERATION_EXPIRED');
  const terminal = await snapshot(), remoteCalls = mediaCalls.length;
  expectError(await publicCall(application, 'POST', recoveryUrl(task, c.operationId), {}, child), 409, 'MEDIA_OPERATION_EXPIRED');
  expect(await snapshot()).toEqual(terminal); expect(mediaCalls).toHaveLength(remoteCalls);
  const final = await row(task);
  for (const field of ['status', 'completionVersion', 'completionEvidence', 'completedAt', 'childNote', 'actualMinutes']) expect(final[field]).toEqual(initial[field]);
  expect((await Operation.findById(local._id)).remoteOperationId).toBe(local.remoteOperationId);
});

test('T2-R-003 published cleanup replay keeps exact retained and removed generations', async () => {
  const application = await gateway(), task = await seed(), a = await media('task_completion'), b = await media('task_completion');
  expect((await publicCall(application, 'PATCH', url(task) + '/complete', command({ completionMediaIds: [a, b] }), child)).status).toBe(200);
  const previous = (await row(task)).completionMediaBindings, c = command({ expectedCompletionVersion: 1, completionMediaIds: [b] });
  dropCompletionAction = 'unbind';
  expectError(await publicCall(application, 'PATCH', url(task) + '/complete', c, child), 503, 'MEDIA_REFERENCE_PENDING');
  const local = await Operation.findOne({ taskId: task._id, operationId: c.operationId }).lean();
  expect(local.phase).toBe('PUBLISHED_CLEANUP');
  const before = await snapshot(), calls = mediaCalls.length;
  expectRecovery(await publicCall(application, 'GET', url(task) + '/completion-recovery', undefined, child),
    { state: 'recoverable', operationId: c.operationId, targetCompletionVersion: 2 });
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(calls);
  expect((await publicCall(application, 'POST', recoveryUrl(task, c.operationId), {}, child)).status).toBe(200);
  const final = await row(task);
  expect(final.completionVersion).toBe(2);
  expect(final.completionMediaBindings).toEqual([previous[1]]);
  expect(await Reference.findOne({ mediaId: a }).lean()).toMatchObject({ state: 'released',
    operationId: previous[0].bindingOperationId, releaseOperationId: local.remoteOperationId });
  expect(await Ledger.countDocuments()).toBe(0);
});

test('T2-R-003 privacy deletion after committed response loss recovers using exact receipts', async () => {
  const application = await gateway(), task = await seed(), mediaId = await media('task_completion');
  const c = command({ completionMediaIds: [mediaId] });
  dropCompletionAction = 'commit';
  expectError(await publicCall(application, 'PATCH', url(task) + '/complete', c, child), 503, 'MEDIA_REFERENCE_PENDING');
  const local = await Operation.findOne({ taskId: task._id }).lean();
  expect((await publicCall(application, 'DELETE', '/api/media/' + mediaId, undefined, child)).status).toBe(204);
  const receipts = await Receipt.find().lean(), tombstones = await Tombstone.find().lean();
  expect(receipts).toHaveLength(1);
  const recovered = await publicCall(application, 'POST', recoveryUrl(task, c.operationId), {}, child);
  expect(recovered.status).toBe(200); expect(recovered.body.data.task.completionMediaIds).toEqual([mediaId]);
  expect((await row(task)).completionMediaBindings.map(r => r.bindingOperationId)).toEqual([local.remoteOperationId]);
  expect(await Receipt.find().lean()).toEqual(receipts); expect(await Tombstone.find().lean()).toEqual(tombstones);
  expect((await publicCall(application, 'GET', '/api/media/' + mediaId + '/access', undefined, child)).status).toBe(404);
  expect(await Ledger.countDocuments()).toBe(0);
});

test('T2-R-003 public recovery response loss replays one publication without remote writes', async () => {
  const application = await gateway(), task = await seed(), c = command({ completionMediaIds: [await media('task_completion')] });
  dropCompletionAction = 'commit';
  expectError(await publicCall(application, 'PATCH', url(task) + '/complete', c, child), 503, 'MEDIA_REFERENCE_PENDING');
  const transport = express(); let lost = false;
  transport.use((req, res, next) => {
    const end = res.end;
    res.end = function (...args) {
      if (!lost && req.method === 'POST' && this.statusCode === 200) { lost = true; this.destroy(); return this; }
      return end.apply(this, args);
    };
    next();
  });
  transport.use(application);
  await expect(publicCall(transport, 'POST', recoveryUrl(task, c.operationId), {}, child)).rejects.toThrow();
  expect(lost).toBe(true);
  const before = await snapshot(), calls = mediaCalls.length;
  const replay = await publicCall(application, 'POST', recoveryUrl(task, c.operationId), {}, child);
  expect(replay.status).toBe(200); expect(replay.body.data.task.completionVersion).toBe(1);
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(calls);
  expect(await Operation.countDocuments()).toBe(1); expect(await RemoteOperation.countDocuments()).toBe(1);
});

test.each(['legacy', 'maintenance'])('T2-R-002 %s mode never exposes recovery or mutates persisted intents', async mode => {
  const enabled = await gateway(), task = await seed(), c = command({ completionMediaIds: [await media('task_completion')] });
  dropCompletionAction = 'prepare';
  expectError(await publicCall(enabled, 'PATCH', url(task) + '/complete', c, child), 503, 'MEDIA_REFERENCE_PENDING');
  const application = await gateway(mode), before = await snapshot(), calls = mediaCalls.length;
  for (const [method, target] of [['GET', PREFIX + '/completion-recoveries'], ['GET', url(task) + '/completion-recovery'],
    ['POST', recoveryUrl(task, c.operationId)]]) {
    const response = await publicCall(application, method, target, undefined, child);
    if (mode === 'maintenance') expectError(response, 503, 'COMPLETION_MAINTENANCE');
    else expect([400, 404]).toContain(response.status);
  }
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(calls);
});

test('T2-R-002 list rejects stale or revoked identities and never accepts client-selected scope', async () => {
  const application = await gateway();
  await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: coparent.id } });
  await User.updateOne({ _id: child.id }, { $inc: { 'childProfile.tokenVersion': 1 } });
  const before = await snapshot();
  expectError(await publicCall(application, 'GET', PREFIX + '/completion-recoveries', undefined, child), 401, 'STALE_CHILD_TOKEN');
  expectError(await publicCall(application, 'GET', PREFIX + '/completion-recoveries', undefined, coparent), 403, 'CHILD_ACCESS_DENIED');
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(0);
});

test('T2-R-004 detail and POST reject query overrides and malformed operation IDs after authorization', async () => {
  const application = await gateway(), task = await seed(), before = await snapshot();
  expectError(await publicCall(application, 'GET', url(task) + '/completion-recovery?actorId=' + parent.id, undefined, child), 400, 'VALIDATION_ERROR');
  expectError(await publicCall(application, 'POST', recoveryUrl(task, randomUUID()) + '?operationId=' + randomUUID(), {}, child), 400, 'VALIDATION_ERROR');
  expectError(await publicCall(application, 'POST', recoveryUrl(task, 'invalid'), {}, child), 400, 'VALIDATION_ERROR');
  expectError(await publicCall(application, 'POST', recoveryUrl(task, 'invalid'), { actorId: child.id }, outsider), 403, 'CHILD_ACCESS_DENIED');
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(0);
});

// Deterministic expired-lease fixture, restricted to this suite's temporary replica set.
const expirePrepared = async operation => {
  const leaseExpiresAt = new Date(Date.now() - 1000);
  expect((await RemoteOperation.updateOne({ operationId: operation.remoteOperationId, state: 'PREPARED' },
    { $set: { leaseExpiresAt } })).matchedCount).toBe(1);
  const remote = await RemoteOperation.findOne({ operationId: operation.remoteOperationId }).lean();
  expect((await Reference.updateMany({ operationId: operation.remoteOperationId, state: 'prepared' },
    { $set: { leaseExpiresAt } })).matchedCount).toBe(remote.references.length);
};
const reconstructFormalApps = async () => {
  await close();
  const before = await snapshot();
  const encoded = mongoose.mongo.BSON.serialize({ collections: before });
  const indexes = await Promise.all(models.map(model => model.collection.indexes()));
  for (const model of models) {
    await model.collection.deleteMany({});
    expect(await model.collection.countDocuments()).toBe(0);
  }
  const decoded = mongoose.mongo.BSON.deserialize(encoded).collections;
  for (let i = 0; i < models.length; i += 1) {
    if (decoded[i].length) await models[i].collection.insertMany(decoded[i]);
    expect(await models[i].collection.indexes()).toEqual(indexes[i]);
  }
  expect(await snapshot()).toEqual(before);
  store = createPrivateMediaStore({ root: resourceEnv.PRIVATE_MEDIA_ROOT });
  await startProviders();
  return gateway();
};

test.each(['COMMITTED', 'ABORTED'])('R4-G1: active UUID conflict and second actor continuation after %s through Gateway', async terminal => {
  const application = await gateway(), task = await seed();
  const aIds = [await media('task_completion'), await media('task_completion')];
  const bId = await media('task_completion');
  const a = command({ completionMediaIds: aIds });
  const b = { ...a, completionMediaIds: [bId] };
  dropCompletionAction = terminal === 'COMMITTED' ? 'commit' : 'prepare';
  expectError(await publicCall(application, 'PATCH', url(task) + '/complete', a, child), 503, 'MEDIA_REFERENCE_PENDING');
  const localA = await Operation.findOne({ taskId: task._id }).lean();
  expect(localA).toMatchObject({ operationId: a.operationId, phase: 'PREPUBLISH' });
  expect(String(localA.actorId)).toBe(child.id);
  expect(localA.remoteOperationId).not.toBe(a.operationId);
  expect(dropped).toEqual([{ action: terminal === 'COMMITTED' ? 'commit' : 'prepare', operationId: localA.remoteOperationId }]);
  const active = await snapshot(), calls = mediaCalls.length;
  expectError(await publicCall(application, 'PATCH', url(task) + '/complete', b, coparent), 503, 'MEDIA_REFERENCE_PENDING');
  expect(await Operation.countDocuments({ taskId: task._id, actorId: coparent.id })).toBe(0);
  expect(await snapshot()).toEqual(active); expect(mediaCalls).toHaveLength(calls); expect(starCalls).toHaveLength(0);
  expectError(await publicCall(application, 'PATCH', url(task) + '/complete', b, child), 409, 'IDEMPOTENCY_KEY_REUSED');
  expect(await snapshot()).toEqual(active); expect(mediaCalls).toHaveLength(calls);

  if (terminal === 'ABORTED') await expirePrepared(localA);
  const completedA = await publicCall(application, 'PATCH', url(task) + '/complete', a, child);
  if (terminal === 'COMMITTED') expect(completedA.status).toBe(200);
  else expectError(completedA, 409, 'MEDIA_OPERATION_EXPIRED');
  const terminalA = await RemoteOperation.findOne({ operationId: localA.remoteOperationId }).lean();
  expect(terminalA).toMatchObject({ state: terminal, commandHash: localA.commandHash });
  const savedA = await Operation.findById(localA._id).lean();
  expect(savedA.phase).toBe(terminal === 'COMMITTED' ? 'SUCCEEDED' : 'FAILED');
  const current = await row(task);
  expect(current.activeCompletionOperation).toBeUndefined(); expect(current.completionPending).toBeUndefined();
  const currentVersion = terminal === 'COMMITTED' ? 1 : 0;
  b.expectedCompletionVersion = currentVersion;
  const completedB = await publicCall(application, 'PATCH', url(task) + '/complete', b, coparent);
  expect(completedB.status).toBe(200); expectPublic(completedB.body);
  expect(completedB.body.data.task).toMatchObject({ completionVersion: currentVersion + 1, completionMediaIds: [bId] });
  const localB = await Operation.findOne({ taskId: task._id, actorId: coparent.id }).lean();
  expect(localB).toMatchObject({ phase: 'SUCCEEDED', operationId: a.operationId });
  expect(localB.remoteOperationId).not.toBe(localA.remoteOperationId);
  expect(localB.remoteOperationId).not.toBe(a.operationId); expect(localB.commandHash).not.toBe(localA.commandHash);
  expect(await Operation.countDocuments({ taskId: task._id })).toBe(2);
  expect(await RemoteOperation.countDocuments({ resourceId: task._id })).toBe(2);
  expect(await RemoteOperation.findOne({ operationId: localB.remoteOperationId }).lean()).toMatchObject({ state: 'COMMITTED', commandHash: localB.commandHash });
  const references = await Reference.find({ resourceId: task._id }).lean();
  expect(references).toHaveLength(3);
  expect(references.map(ref => String(ref.mediaId)).sort()).toEqual([...aIds, bId].sort());
  for (const ref of references) {
    const isB = String(ref.mediaId) === bId;
    expect(ref.field).toBe('completionMediaIds');
    expect(ref.state).toBe(isB ? 'bound' : 'released');
    expect(ref.operationId).toBe(isB ? localB.remoteOperationId : localA.remoteOperationId);
    if (!isB) expect(ref.releaseOperationId).toBe(terminal === 'COMMITTED' ? localB.remoteOperationId : localA.remoteOperationId);
  }
  const afterB = await row(task);
  expect(afterB.completionMediaBindings).toEqual([{ mediaId: new mongoose.Types.ObjectId(bId), bindingOperationId: localB.remoteOperationId }]);
  expect(afterB.completionEvidence.completionMediaIds.map(String)).toEqual([bId]);
  expect(await Operation.findById(localA._id).lean()).toEqual(savedA);
  const oldAfterUnbind = await RemoteOperation.findOne({ operationId: localA.remoteOperationId }).lean();
  if (terminal === 'COMMITTED') {
    // Unbind fences the old terminal once; its identity, result and first terminal timestamp stay immutable.
    expect(oldAfterUnbind).toEqual({ ...terminalA, version: terminalA.version + 1, updatedAt: expect.any(Date) });
    expect(oldAfterUnbind.updatedAt.getTime()).toBeGreaterThanOrEqual(terminalA.updatedAt.getTime());
  } else expect(oldAfterUnbind).toEqual(terminalA);
  const stable = await snapshot(), stableCalls = mediaCalls.length;
  const replayA = await publicCall(application, 'PATCH', url(task) + '/complete', a, child);
  expect(replayA.status).toBe(completedA.status);
  if (terminal === 'COMMITTED') expect(replayA.body).toEqual(completedA.body);
  else {
    expectError(replayA, 409, 'MEDIA_OPERATION_EXPIRED');
    expect(replayA.body.error).toEqual(completedA.body.error);
  }
  expect((await publicCall(application, 'PATCH', url(task) + '/complete', b, coparent)).body).toEqual(completedB.body);
  expect(await snapshot()).toEqual(stable); expect(mediaCalls).toHaveLength(stableCalls);
  expect(starCalls).toHaveLength(0); expect(await Ledger.countDocuments(ledgerQuery(task))).toBe(0);
});

test('R4-G2: committed abort acknowledgement loss survives BSON and formal app reconstruction', async () => {
  let application = await gateway();
  const task = await seed(), ids = [await media('task_completion'), await media('task_completion')];
  const body = command({ completionMediaIds: ids });
  dropCompletionAction = 'prepare';
  expectError(await publicCall(application, 'PATCH', url(task) + '/complete', body, child), 503, 'MEDIA_REFERENCE_PENDING');
  const local = await Operation.findOne({ taskId: task._id }).lean();
  await expirePrepared(local);
  const beforeAbort = await row(task);
  dropCompletionAction = 'abort';
  expectError(await publicCall(application, 'PATCH', url(task) + '/complete', body, child), 503, 'MEDIA_REFERENCE_PENDING');
  expect(dropped).toEqual([{ action: 'prepare', operationId: local.remoteOperationId }, { action: 'abort', operationId: local.remoteOperationId }]);
  expect(await row(task)).toEqual(beforeAbort);
  expect(await Operation.findById(local._id).lean()).toEqual(local);
  const remote = await RemoteOperation.findOne({ operationId: local.remoteOperationId }).lean();
  expect(remote).toMatchObject({ state: 'ABORTED', commandHash: local.commandHash, failureCode: 'MEDIA_OPERATION_EXPIRED', leaseExpiresAt: null });
  expect(remote.terminalAt).toBeInstanceOf(Date);
  const released = await Reference.find({ resourceId: task._id }).sort({ _id: 1 }).lean();
  expect(released.map(ref => String(ref.mediaId)).sort()).toEqual([...ids].sort());
  for (const ref of released) expect(ref).toMatchObject({ state: 'released', operationId: local.remoteOperationId, releaseOperationId: local.remoteOperationId, leaseExpiresAt: null });
  const calls = mediaCalls.length;
  application = await reconstructFormalApps();
  const rebuilt = await snapshot();
  expect((await publicCall(application, 'GET', url(task))).status).toBe(200);
  expect(await snapshot()).toEqual(rebuilt); expect(mediaCalls).toHaveLength(calls);
  const recovered = await publicCall(application, 'PATCH', url(task) + '/complete', body, child);
  expectError(recovered, 409, 'MEDIA_OPERATION_EXPIRED');
  const recoveryCalls = mediaCalls.slice(calls);
  expect(recoveryCalls).toHaveLength(1);
  expect(recoveryCalls[0]).toMatchObject({ action: 'status', body: { mode: 'operation', operationId: local.remoteOperationId, commandHash: local.commandHash } });
  expect(recoveryCalls[0].body.references.map(ref => ref.mediaId).sort()).toEqual([...ids].sort());
  const failed = await Operation.findById(local._id).lean(), stable = await row(task);
  expect(failed).toMatchObject({ phase: 'FAILED', failureStatus: 409, failureCode: 'MEDIA_OPERATION_EXPIRED', remoteOperationId: local.remoteOperationId, commandHash: local.commandHash });
  expect(stable.activeCompletionOperation).toBeUndefined(); expect(stable.completionPending).toBeUndefined();
  expect(stable.completionVersion ?? 0).toBe(0); expect(stable.status).toBe('pending');
  expect(stable.completionMediaReferenceState).toBe('stable'); expect(stable.completionMediaBindings || []).toEqual([]);
  const { activeCompletionOperation: _activeCompletionOperation, completionPending: _completionPending, ...unchangedTask } = beforeAbort;
  expect(stable).toEqual({ ...unchangedTask, __v: beforeAbort.__v + 1,
    completionMediaReferenceState: 'stable', updatedAt: expect.any(Date) });
  expect(stable.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeAbort.updatedAt.getTime());
  expect(await Reference.find({ resourceId: task._id }).sort({ _id: 1 }).lean()).toEqual(released);
  expect(await RemoteOperation.findOne({ operationId: local.remoteOperationId }).lean()).toEqual(remote);
  expect(await Operation.countDocuments({ taskId: task._id })).toBe(1);
  expect(await RemoteOperation.countDocuments({ resourceId: task._id })).toBe(1);
  const finalSnapshot = await snapshot(), finalCalls = mediaCalls.length;
  const replay = await publicCall(application, 'PATCH', url(task) + '/complete', body, child);
  expectError(replay, 409, 'MEDIA_OPERATION_EXPIRED'); expect(replay.body.error).toEqual(recovered.body.error);
  expect(await snapshot()).toEqual(finalSnapshot); expect(mediaCalls).toHaveLength(finalCalls);
  expect(starCalls).toHaveLength(0); expect(await Ledger.countDocuments(ledgerQuery(task))).toBe(0);
  const originalPrepare = mediaCalls.find(call => call.action === 'prepare').body;
  const late = await fetch(env.RESOURCE_SERVICE_URL + MEDIA_PREFIX + 'prepare', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-service-token': TOKEN }, body: JSON.stringify(originalPrepare)
  });
  expect(late.status).toBe(200);
  expect((await late.json()).data.operation).toMatchObject({ state: 'ABORTED', operationId: local.remoteOperationId, commandHash: local.commandHash });
  expect(await snapshot()).toEqual(finalSnapshot);
});

test('gateway formal chain preserves completion replay, exact references, co-parent audit and one star ledger', async () => {
  const application = await gateway();
  const created = await publicCall(application, 'POST', PREFIX, input(), parent, { 'x-user-id': outsider.id, 'x-user-role': 'admin' });
  expect(created.status).toBe(201);
  const task = await Task.findById(created.body.data.task.taskId), ids = [await media('task_completion'), await media('task_completion')];
  const body = command({ completionMediaIds: ids });
  const completed = await publicCall(application, 'PATCH', url(task) + '/complete', body, child);
  expect(completed.status).toBe(200); expectPublic(completed.body);
  expect(completed.body.data.task).toMatchObject({ completionVersion: 1, completionMediaIds: ids, status: 'completed' });
  expect((await publicCall(application, 'PATCH', url(task) + '/complete', body, child)).body).toEqual(completed.body);
  const persisted = await row(task), op = await Operation.findOne({ taskId: task._id }).lean();
  expect(op.remoteOperationId).toBeTruthy();
  expect(persisted.completionMediaBindings.map(binding => binding.bindingOperationId)).toEqual([op.remoteOperationId, op.remoteOperationId]);
  expect(await Reference.countDocuments({ resourceId: task._id, field: 'completionMediaIds', operationId: op.remoteOperationId, state: 'bound' })).toBe(2);
  expect((await publicCall(application, 'PATCH', url(task) + '/confirm', { expectedCompletionVersion: 1, parentFeedback: 'First gateway review' }, coparent)).status).toBe(200);
  const confirmed = await row(task), awards = starCalls.length;
  expect(String(confirmed.confirmedByParentId)).toBe(coparent.id);
  expect((await publicCall(application, 'PATCH', url(task) + '/confirm', { expectedCompletionVersion: 1, parentFeedback: 'Later' })).status).toBe(200);
  expect(await row(task)).toEqual(confirmed); expect(starCalls).toHaveLength(awards);
  expect(await Ledger.countDocuments(ledgerQuery(task))).toBe(1);
  const before = await snapshot(), calls = mediaCalls.length;
  expect((await publicCall(application, 'GET', url(task))).status).toBe(200);
  expect((await publicCall(application, 'GET', PREFIX + '?childId=' + child.id)).status).toBe(200);
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(calls); expect(starCalls).toHaveLength(awards);
});

test.each(['complete', 'confirm'])('gateway rejects old %s clients without creating state', async action => {
  const application = await gateway(), task = await seed(), before = await snapshot();
  expectError(await publicCall(application, 'PATCH', url(task) + '/' + action,
    action === 'complete' ? { actualMinutes: 5 } : { parentFeedback: 'Old client' }, action === 'complete' ? child : parent),
  400, 'CLIENT_UPGRADE_REQUIRED');
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(0); expect(starCalls).toHaveLength(0);
});

test('gateway JWT, child token version and live family boundaries reject without writes', async () => {
  const application = await gateway(), task = await seed(), before = await snapshot();
  expect((await publicCall(application, 'GET', url(task), undefined, null)).status).toBe(401);
  const expired = jwt.sign({ ...child, exp: 1 }, process.env.JWT_SECRET);
  expectError(await publicCall(application, 'PATCH', url(task) + '/complete', command(), null,
    { Authorization: 'Bearer ' + expired }), 401, 'UNAUTHENTICATED');
  expectError(await publicCall(application, 'GET', url(task), undefined, outsider, { 'x-user-id': parent.id }), 403, 'CHILD_ACCESS_DENIED');
  expectError(await publicCall(application, 'PATCH', url(task) + '/complete', command(), sibling), 403, 'CHILD_ACCESS_DENIED');
  expectError(await publicCall(application, 'PATCH', url(task) + '/complete', command(), { ...child, tokenVersion: 1 }), 401, 'STALE_CHILD_TOKEN');
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(0); expect(starCalls).toHaveLength(0);
  await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: coparent.id } });
  const afterRemoval = await snapshot();
  expectError(await publicCall(application, 'GET', url(task), undefined, coparent), 403, 'CHILD_ACCESS_DENIED');
  expect(await snapshot()).toEqual(afterRemoval);
});

test('gateway never exposes internal references or star award endpoints', async () => {
  const application = await gateway(), before = await snapshot();
  for (const target of ['/api/internal/media/references/prepare', '/api/internal/stars/award',
    '/api/internal/completion-media-retirements', '/api/internal/completion-media-retirements/status']) {
    expect((await publicCall(application, 'POST', target, {}, parent, { 'x-service-token': TOKEN })).status).toBe(404);
  }
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(0); expect(starCalls).toHaveLength(0);
});

test.each(['media', 'stars'])('gateway recovers a lost real %s acknowledgement without duplicate effects', async provider => {
  const application = await gateway(), task = await seed(), body = command({ completionMediaIds: [await media('task_completion')] });
  if (provider === 'media') dropMediaField = 'completionMediaIds';
  const first = await publicCall(application, 'PATCH', url(task) + '/complete', body, child);
  expect(first.status).toBe(provider === 'media' ? 503 : 200);
  if (provider === 'media') {
    const pending = await snapshot(), calls = mediaCalls.length;
    expect((await publicCall(application, 'GET', url(task))).status).toBe(200);
    expect(await snapshot()).toEqual(pending); expect(mediaCalls).toHaveLength(calls);
    expect((await publicCall(application, 'PATCH', url(task) + '/complete', body, child)).status).toBe(200);
  }
  if (provider === 'stars') dropStars = true;
  const firstConfirm = await publicCall(application, 'PATCH', url(task) + '/confirm', { expectedCompletionVersion: 1 }, coparent);
  expect(firstConfirm.status).toBe(provider === 'stars' ? 503 : 200);
  expect((await publicCall(application, 'PATCH', url(task) + '/confirm', { expectedCompletionVersion: 1 })).status).toBe(200);
  expect(await Ledger.countDocuments(ledgerQuery(task))).toBe(1);
  expect(String((await row(task)).confirmedByParentId)).toBe(coparent.id);
  expect(await Operation.countDocuments({ taskId: task._id })).toBe(1);
  expect(dropped).toHaveLength(1);
});

test('gateway media upload, signed content and completion deletion preserve exact evidence and first audit', async () => {
  const application = await gateway(), task = await seed();
  const bytes = await require('sharp')({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).png().toBuffer();
  const upload = await (await request(application)).post('/api/media')
    .set('Authorization', 'Bearer ' + jwt.sign(child, process.env.JWT_SECRET))
    .field('childId', child.id).field('purpose', 'task_completion').attach('file', bytes, { filename: 'synthetic.png', contentType: 'image/png' });
  expect(upload.status).toBe(201);
  const mediaId = upload.body.data.media.mediaId;
  expect((await publicCall(application, 'PATCH', url(task) + '/complete', command({ completionMediaIds: [mediaId] }), child)).status).toBe(200);
  const access = await publicCall(application, 'GET', '/api/media/' + mediaId + '/access', undefined, child);
  expect(access.status).toBe(200);
  const target = access.body.data.access.url;
  const content = await publicCall(application, 'GET', target, undefined, null);
  expect(content.status).toBe(200); expect(content.headers['cache-control']).toBe('private, no-store');
  expect((await publicCall(application, 'DELETE', '/api/media/' + mediaId, undefined, outsider)).status).toBe(404);
  expect((await publicCall(application, 'DELETE', '/api/media/' + mediaId, undefined, child)).status).toBe(204);
  const before = await snapshot(), journalPath = path.join(resourceEnv.COMPLETION_DELETION_JOURNAL_ROOT, mediaId + '.json');
  const journal = await fs.readFile(journalPath, 'utf8');
  expect((await publicCall(application, 'DELETE', '/api/media/' + mediaId, undefined, coparent)).status).toBe(204);
  expect(await snapshot()).toEqual(before); expect(await fs.readFile(journalPath, 'utf8')).toBe(journal);
  expect((await publicCall(application, 'GET', target, undefined, null)).status).toBe(404);
  expect(await Receipt.countDocuments({ mediaId })).toBe(1);
});

test('gateway maintenance denies task/media/content requests without modifying persisted state', async () => {
  const application = await gateway('maintenance'), task = await seed(), before = await snapshot();
  for (const target of [url(task), '/api/media/' + id() + '/access', '/api/media/' + id() + '/content?signature=synthetic']) {
    expectError(await publicCall(application, 'GET', target), 503, 'COMPLETION_MAINTENANCE');
  }
  expectError(await publicCall(application, 'PATCH', url(task) + '/complete', command(), child), 503, 'COMPLETION_MAINTENANCE');
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(0); expect(starCalls).toHaveLength(0);
});

test('formal startup allows pre-write withdrawal but blocks both legacy services after new protocol writes', async () => {
  const servers = { homework: require('../../server'), resource: require('../../../resource-service/server') };
  const environments = { homework: env, resource: { ...resourceEnv, COMPLETION_STORAGE_CONFIRMED: 'true' } };
  const before = await snapshot();
  for (const mode of ['enabled', 'legacy']) for (const name of ['resource', 'homework']) {
    const server = await servers[name].startServer({ env: { ...environments[name], COMPLETION_PROTOCOL_MODE: mode,
      MONGO_URI: mongoose.connection.client.s.url }, port: 0, host: '127.0.0.1' });
    try { expect((await require('supertest')(server).get('/health')).status).toBe(200); }
    finally { await new Promise(resolve => server.close(resolve)); }
  }
  expect(await snapshot()).toEqual(before);
  const application = await gateway(), task = await seed();
  expect((await publicCall(application, 'PATCH', url(task) + '/complete', command({ completionMediaIds: [await media('task_completion')] }), child)).status).toBe(200);
  const written = await snapshot();
  for (const name of ['resource', 'homework']) {
    await expect(servers[name].startServer({ env: { ...environments[name], COMPLETION_PROTOCOL_MODE: 'legacy',
      MONGO_URI: mongoose.connection.client.s.url }, port: 0, host: '127.0.0.1' }))
      .rejects.toMatchObject({ code: 'COMPLETION_LEGACY_UNSAFE', message: 'COMPLETION_LEGACY_UNSAFE' });
  }
  expect(await snapshot()).toEqual(written); expect(mongoose.connection.readyState).toBe(1);
});

test.each(['complete', 'confirm'])('gateway public %s response loss replays persisted outcome and first audit', async action => {
  const application = await gateway(), task = await seed(), body = command({ completionMediaIds: [await media('task_completion')] });
  if (action === 'confirm') expect((await publicCall(application, 'PATCH', url(task) + '/complete', body, child)).status).toBe(200);
  const transport = express(); let lost = false;
  transport.use((req, res, next) => {
    const matches = req.method === 'PATCH' && req.originalUrl === url(task) + '/' + action;
    const end = res.end;
    res.end = function (...args) {
      if (!lost && matches && this.statusCode === 200) {
        lost = true; this.destroy(); return this;
      }
      return end.apply(this, args);
    };
    next();
  });
  transport.use(application);
  const payload = action === 'complete' ? body : { expectedCompletionVersion: 1, parentFeedback: 'First public review' };
  await expect(publicCall(transport, 'PATCH', url(task) + '/' + action, payload, action === 'complete' ? child : coparent)).rejects.toThrow();
  expect(lost).toBe(true);
  const before = await snapshot(), calls = mediaCalls.length, awards = starCalls.length;
  const replay = await publicCall(application, 'PATCH', url(task) + '/' + action, payload, action === 'complete' ? child : parent);
  expect(replay.status).toBe(200); expectPublic(replay.body);
  expect(await snapshot()).toEqual(before); expect(mediaCalls).toHaveLength(calls); expect(starCalls).toHaveLength(awards);
  if (action === 'confirm') {
    expect(String((await row(task)).confirmedByParentId)).toBe(coparent.id);
    expect(await Ledger.countDocuments(ledgerQuery(task))).toBe(1);
  }
});

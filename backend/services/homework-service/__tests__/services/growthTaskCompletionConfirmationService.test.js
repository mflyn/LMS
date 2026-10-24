const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const { createHttpTestHarness } = require('../../../../common/test/httpTestHarness');
const { request, close: closeHttp } = createHttpTestHarness();
afterEach(closeHttp);
const express = require('express');
const Task = require('../../models/GrowthTask');
const Operation = require('../../models/GrowthTaskCompletionOperation');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const Ledger = require('../../../progress-service/models/StarLedgerEntry');
const Asset = require('../../../resource-service/models/MediaAsset');
const Reference = require('../../../resource-service/models/MediaReference');
const RemoteOperation = require('../../../resource-service/models/MediaReferenceOperation');
const { createMediaReferenceOperationService } = require('../../../resource-service/services/mediaReferenceOperationService');
const { createCompletionMediaReferenceClient } = require('../../../../common/services/completionMediaReferenceClient');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { createStarAwardClient } = require('../../services/starAwardClient');
const { createGrowthTaskCompletionService } = require('../../services/growthTaskCompletionService');
const { createGrowthTaskCompletionConfirmationService } = require('../../services/growthTaskCompletionConfirmationService');

const id = () => new mongoose.Types.ObjectId();
const runner = work => runMongoTransaction({ mongooseInstance: mongoose, work });
const hidden = '+activeCompletionOperation +completionPending +completionMediaBindings';
const mediaClient = Object.fromEntries(['prepare', 'commit', 'abort', 'status', 'unbind'].map(k =>
  [k, async () => { throw Error('Synthetic unavailable media'); }]));
const app = express(); app.use(express.json());
app.use('/api/internal/stars', require('../../../progress-service/routes/internalStars'));
let task, family, parent, second, child, service, client, transport, time;
const make = options => createGrowthTaskCompletionConfirmationService({ transactionRunner: runner,
  awardTaskStar: client.awardTaskStar, now: () => time, ...options });
const confirm = (body = { expectedCompletionVersion: 1 }, identity = parent) =>
  service.confirm({ identity, taskId: String(task._id), body });
const row = () => Task.findById(task._id).select(hidden).lean();
const completionBody = version => ({ operationId: randomUUID(), expectedCompletionVersion: version,
  expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: [] });
const complete = (body, options = {}) => createGrowthTaskCompletionService({ transactionRunner: runner,
  mediaReferenceClient: mediaClient, ...options }).complete({ identity: child, taskId: String(task._id), body });

beforeAll(async () => { for (const model of [Task, Operation, Family, User, Ledger, Asset, Reference, RemoteOperation]) await model.init(); });
beforeEach(async () => {
  time = Date.parse('2026-10-22T00:00:00Z');
  parent = { id: String(id()), role: 'parent' }; second = { id: String(id()), role: 'parent' };
  child = { id: String(id()), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic confirmation', ownerParentId: parent.id,
    memberParentIds: [parent.id, second.id], childIds: [child.id] });
  child.familyId = String(family._id); child.childId = child.id;
  await User.collection.insertMany([parent, second, child].map(u => ({ _id: new mongoose.Types.ObjectId(u.id),
    role: u.role, username: u.id, email: u.id + '@example.test',
    ...(u.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  task = await Task.create({ familyId: family._id, childId: child.id, createdByParentId: parent.id,
    dimension: 'academic', title: 'Synthetic confirmation', taskType: 'practice', dueDate: '2026-10-22' });
  await complete(completionBody(0));
  transport = { post: jest.fn(async (_url, payload, config) => {
    const response = await (await request(app)).post('/api/internal/stars/award').set(config.headers).send(payload);
    return { status: response.status, data: response.body };
  }) };
  client = createStarAwardClient({ axiosInstance: transport, progressServiceUrl: 'http://synthetic-unused',
    internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN });
  service = make();
});

test('confirms exactly the seen version and reuses the real existing star ledger', async () => {
  const before = await row();
  const result = await confirm({ expectedCompletionVersion: 1, parentFeedback: ' first ' });
  expect(result).toMatchObject({ success: true, data: { task: { taskId: String(task._id), status: 'confirmed',
    completionVersion: 1, parentConfirmed: true, starAwardState: 'awarded', parentFeedback: 'first' } } });
  const after = await row();
  expect(after.completionEvidence).toEqual(before.completionEvidence); expect(after.completedAt).toEqual(before.completedAt);
  expect(after.confirmedAt).toEqual(new Date(time)); expect(String(after.confirmedByParentId)).toBe(parent.id);
  expect(await Ledger.countDocuments()).toBe(1); expect(await Operation.countDocuments()).toBe(1);
});
test('same-version confirmation replay preserves first parent, feedback and timestamp without another award', async () => {
  await confirm({ expectedCompletionVersion: 1, parentFeedback: 'first' }); const before = await row(); time += 1000;
  await confirm({ expectedCompletionVersion: 1, parentFeedback: 'replacement' }, second);
  expect(await row()).toEqual(before); expect(transport.post).toHaveBeenCalledTimes(1);
  expect(await Ledger.countDocuments()).toBe(1);
});
test.each(['completed','confirmed'])('legacy %s without media initializes only completion version zero', async status => {
  await Task.collection.updateOne({ _id: task._id }, { $unset: { completionVersion: '', completionEvidence: '',
    completionMediaBindings: '', completionMediaReferenceState: '' }, $set: { status,
    ...(status === 'confirmed' ? { starAwardState: 'pending', confirmedAt: new Date(time-1000),
      confirmedByParentId: new mongoose.Types.ObjectId(parent.id), parentFeedback: 'legacy' } : {}) } });
  const before = await row(); await confirm({ expectedCompletionVersion: 0 }); const after = await row();
  expect(after.completionVersion).toBe(0); expect(after.completionEvidence).toBeUndefined();
  expect(after.completedAt).toEqual(before.completedAt); expect(after.starAwardState).toBe('awarded');
  if (status === 'confirmed') { expect(after.confirmedAt).toEqual(before.confirmedAt); expect(after.parentFeedback).toBe('legacy'); }
  expect(await Ledger.countDocuments()).toBe(1);
});
test.each([
  [{}, 'CLIENT_UPGRADE_REQUIRED'], [{ expectedCompletionVersion: -1 }, 'VALIDATION_ERROR'],
  [{ expectedCompletionVersion: '1' }, 'VALIDATION_ERROR'],
  [{ expectedCompletionVersion: 1, operationId: randomUUID() }, 'VALIDATION_ERROR'],
  [{ expectedCompletionVersion: 1, parentFeedback: null }, 'VALIDATION_ERROR']
])('invalid confirmation %p is rejected before writes', async (body, code) => {
  const before = await row(); await expect(confirm(body)).rejects.toMatchObject({ code, statusCode: 400 });
  expect(await row()).toEqual(before); expect(await Ledger.countDocuments()).toBe(0); expect(transport.post).not.toHaveBeenCalled();
});
test.each(['pending','cancelled','archived'])('%s cannot be confirmed', async status => {
  await Task.updateOne({ _id: task._id }, { $set: { status } });
  await expect(confirm()).rejects.toMatchObject({ code: 'TASK_STATE_CONFLICT' });
  expect(await Ledger.countDocuments()).toBe(0);
});
test('wrong version cannot confirm or bypass checking on already-awarded replay', async () => {
  await expect(confirm({ expectedCompletionVersion: 0 })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  await confirm();
  await expect(confirm({ expectedCompletionVersion: 0 })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  expect(await Ledger.countDocuments()).toBe(1); expect(transport.post).toHaveBeenCalledTimes(1);
});
test.each([
  ['activeCompletionOperation', { actorId: new mongoose.Types.ObjectId() }],
  ['completionPending', { phase: 'PREPUBLISH' }],
  ['completionMediaReferenceState', 'pending_recovery'], ['mediaReferenceState', 'pending']
])('%s blocks confirmation without recovering or awarding', async (key, value) => {
  await Task.collection.updateOne({ _id: task._id }, { $set: { [key]: value } }); const before = await row();
  await expect(confirm()).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect(await row()).toEqual(before); expect(transport.post).not.toHaveBeenCalled();
});
test('missing reference state with nonempty completion media is not treated as legacy stable', async () => {
  await Task.collection.updateOne({ _id: task._id }, { $unset: { completionMediaReferenceState: '' },
    $set: { 'completionEvidence.completionMediaIds': [id()] } });
  await expect(confirm()).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' }); expect(transport.post).not.toHaveBeenCalled();
});
test('children and removed parents cannot confirm; missing and inaccessible tasks are indistinguishable', async () => {
  await expect(confirm({}, child)).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED', statusCode: 403 });
  await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: second.id, memberParentIds: [second.id] } });
  await expect(confirm({})).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED', statusCode: 403 });
  await expect(service.confirm({ identity: parent, taskId: String(id()), body: {} }))
    .rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED', statusCode: 403 });
  expect(await Ledger.countDocuments()).toBe(0);
});
test('concurrent parent confirmations award one star and preserve the winner audit', async () => {
  await Promise.all([confirm({ expectedCompletionVersion: 1, parentFeedback: 'one' }),
    confirm({ expectedCompletionVersion: 1, parentFeedback: 'two' }, second)]);
  const after = await row(); expect(after.starAwardState).toBe('awarded'); expect(await Ledger.countDocuments()).toBe(1);
  expect(after.parentFeedback).toBe(String(after.confirmedByParentId) === parent.id ? 'one' : 'two');
});
test.each(['confirm','award'])('unknown %s transaction result never duplicates confirmation or stars', async phase => {
  let lost = false;
  service = make({ transactionRunner: async (work, label) => { const result = await runner(work);
    if (!lost && label === phase) { lost = true; throw Error('Synthetic lost local acknowledgement'); } return result; } });
  await expect(confirm({ expectedCompletionVersion: 1, parentFeedback: 'first' })).rejects.toMatchObject({ code: 'STAR_AWARD_PENDING' });
  expect(lost).toBe(true); const before = await row();
  if (phase === 'confirm') expect(transport.post).not.toHaveBeenCalled();
  service = make(); await confirm({ expectedCompletionVersion: 1, parentFeedback: 'second' });
  const after = await row(); expect(after.confirmedAt).toEqual(before.confirmedAt); expect(after.parentFeedback).toBe('first');
  expect(after.completionVersion).toBe(1); expect(await Ledger.countDocuments()).toBe(1);
});
test.each(['confirm','award'])('%s transaction rollback leaves a recoverable state', async phase => {
  let failed = false;
  service = make({ transactionRunner: (work, label) => runner(async session => { const result = await work(session);
    if (!failed && label === phase) { failed = true; throw Error('Synthetic transaction rollback'); } return result; }) });
  await expect(confirm()).rejects.toMatchObject({ code: 'STAR_AWARD_PENDING' }); expect(failed).toBe(true);
  expect((await row()).status).toBe(phase === 'confirm' ? 'completed' : 'confirmed');
  expect(await Ledger.countDocuments()).toBe(phase === 'confirm' ? 0 : 1);
  service = make(); await confirm(); expect((await row()).starAwardState).toBe('awarded'); expect(await Ledger.countDocuments()).toBe(1);
});
test('lost remote award response replays the same ledger command without changing confirmation', async () => {
  const post = transport.post.getMockImplementation(); let lost = false;
  transport.post.mockImplementation(async (...args) => { const result = await post(...args);
    if (!lost) { lost = true; throw Error('Synthetic lost remote response'); } return result; });
  await expect(confirm()).rejects.toMatchObject({ code: 'STAR_AWARD_PENDING' });
  const before = await row(); expect(before.starAwardState).toBe('pending'); expect(await Ledger.countDocuments()).toBe(1);
  await confirm(); expect((await row()).confirmedAt).toEqual(before.confirmedAt); expect(await Ledger.countDocuments()).toBe(1);
});
test('current co-parent recovers pending award after first confirming parent leaves, preserving original audit', async () => {
  transport.post.mockRejectedValueOnce(Error('Synthetic unavailable progress service'));
  await expect(confirm({ expectedCompletionVersion: 1, parentFeedback: 'original' })).rejects.toMatchObject({ code: 'STAR_AWARD_PENDING' });
  const before = await row();
  await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: second.id, memberParentIds: [second.id] } });
  await confirm({ expectedCompletionVersion: 1, parentFeedback: 'replacement' }, second);
  const after = await row(); expect(after.confirmedByParentId).toEqual(before.confirmedByParentId);
  expect(after.confirmedAt).toEqual(before.confirmedAt); expect(after.parentFeedback).toBe('original');
  expect(await Ledger.countDocuments()).toBe(1);
});
test('membership revoked during remote award cannot finalize local awarded state', async () => {
  const post = transport.post.getMockImplementation(); transport.post.mockImplementation(async (...args) => {
    const result = await post(...args); await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: second.id, memberParentIds: [second.id] } }); return result;
  });
  await expect(confirm()).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED' });
  expect((await row()).starAwardState).toBe('pending'); expect(await Ledger.countDocuments()).toBe(1);
  await confirm({ expectedCompletionVersion: 1 }, second); expect((await row()).starAwardState).toBe('awarded');
  expect(await Ledger.countDocuments()).toBe(1);
});
test('completion claim wins: confirm cannot freeze old evidence while a new owner is active', async () => {
  let release, arrived; const gate = new Promise(r => { release = r; }); const signal = new Promise(r => { arrived = r; });
  const work = complete(completionBody(1), { transactionRunner: async (fn, phase) => {
    const value = await runner(fn); if (phase === 'claim') { arrived(); await gate; } return value;
  } });
  try { await signal; await expect(confirm()).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
    expect(await Ledger.countDocuments()).toBe(0); release(); await work;
    await expect(confirm()).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    await confirm({ expectedCompletionVersion: 2 }); expect((await row()).completionVersion).toBe(2);
  } finally { release(); await work; }
});
test('confirmation wins: completion cannot overwrite the confirmed version before star response', async () => {
  let release, arrived; const gate = new Promise(r => { release = r; }); const signal = new Promise(r => { arrived = r; });
  service = make({ transactionRunner: async (fn, phase) => { const value = await runner(fn);
    if (phase === 'confirm') { arrived(); await gate; } return value; } });
  const work = confirm();
  try { await signal; await expect(complete(completionBody(1))).rejects.toMatchObject({ code: 'TASK_STATE_CONFLICT' });
    release(); await work; expect((await row()).completionVersion).toBe(1); expect(await Ledger.countDocuments()).toBe(1);
  } finally { release(); await work; }
});

test('confirming real bound media freezes the exact stable evidence without rebinding', async () => {
  const asset = await Asset.create({ familyId: family._id, childId: child.id, uploadedBy: child.id,
    purpose: 'task_completion', mimeType: 'image/jpeg', sizeBytes: 1, storageKey: randomUUID() });
  const remote = createMediaReferenceOperationService({ transactionRunner: runner });
  const post = jest.fn(async (url, wire) => ({ status: 200, data: { success: true,
    data: JSON.parse(JSON.stringify(await remote[url.split('/').pop()](wire))) } }));
  const references = createCompletionMediaReferenceClient({ axiosInstance: { post }, resourceServiceUrl: 'http://synthetic-unused',
    serviceToken: 'synthetic-reference-token-at-least-32-characters' });
  const c = { ...completionBody(1), completionMediaIds: [String(asset._id)], childNote: 'Synthetic evidence' };
  const completed = await complete(c, { mediaReferenceClient: references });
  const before = await row(), beforeRef = await Reference.findOne().lean(); post.mockClear();
  const result = await confirm({ expectedCompletionVersion: 2 });
  expect(result.data.task.completionMediaIds).toEqual([String(asset._id)]);
  expect(result.data.task.completionVersion).toBe(2);
  expect((await row()).completionEvidence).toEqual(before.completionEvidence);
  expect(await Reference.findOne().lean()).toEqual(beforeRef); expect(post).not.toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toMatch(/completionPending|completionMediaBindings|activeCompletionOperation|remoteOperationId/);
  await expect(complete(c, { mediaReferenceClient: references })).resolves.toEqual(completed);
  expect((await row()).status).toBe('confirmed'); expect(await Ledger.countDocuments()).toBe(1);
});
test('malformed remote award acknowledgement remains pending even when the ledger already exists', async () => {
  const post = transport.post.getMockImplementation(); let malformed = false;
  transport.post.mockImplementation(async (...args) => { const response = await post(...args);
    if (!malformed) { malformed = true; response.data.data.starBalance = '1'; } return response; });
  await expect(confirm()).rejects.toMatchObject({ code: 'STAR_AWARD_PENDING' });
  expect((await row()).starAwardState).toBe('pending'); expect(await Ledger.countDocuments()).toBe(1);
  await confirm(); expect((await row()).starAwardState).toBe('awarded'); expect(await Ledger.countDocuments()).toBe(1);
});
test('late star acknowledgement cannot overwrite changed task state', async () => {
  const post = transport.post.getMockImplementation(); transport.post.mockImplementation(async (...args) => {
    const response = await post(...args);
    await Task.updateOne({ _id: task._id }, { $set: { status: 'archived' }, $inc: { __v: 1 } }); return response;
  });
  await expect(confirm()).rejects.toMatchObject({ code: 'TASK_STATE_CONFLICT' });
  expect((await row()).status).toBe('archived'); expect((await row()).starAwardState).toBe('pending');
  expect(await Ledger.countDocuments()).toBe(1);
});
test('confirmation CAS miss cannot leave a partial pending award or call progress', async () => {
  const update = Task.updateOne.bind(Task);
  const spy = jest.spyOn(Task, 'updateOne').mockImplementationOnce(async (...args) => {
    await update(...args); return { matchedCount: 0 };
  });
  try { await expect(confirm()).rejects.toMatchObject({ code: 'STAR_AWARD_PENDING' }); }
  finally { spy.mockRestore(); }
  expect((await row()).status).toBe('completed'); expect((await row()).confirmedAt).toBeUndefined();
  expect(transport.post).not.toHaveBeenCalled(); expect(await Ledger.countDocuments()).toBe(0);
  await confirm(); expect(await Ledger.countDocuments()).toBe(1);
});

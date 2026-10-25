const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');
const { authenticateGateway } = require('../../../../common/middleware/auth');
const { errorHandler } = require('../../../../common/middleware/errorHandler');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { createCompletionMediaReferenceClient } = require('../../../../common/services/mediaReferenceClient');
const { createCompletionMediaReferencesRouter } = require('../../../resource-service/routes/completionMediaReferences');
const { createMediaReferenceCredential } = require('../../../resource-service/middleware/mediaReferenceCredential');
const { createMediaReferenceOperationService } = require('../../../resource-service/services/mediaReferenceOperationService');
const { createCompletionMediaPrivacyService } = require('../../../resource-service/services/completionMediaPrivacyService');
const { createCompletionMediaCleanupService } = require('../../../resource-service/services/completionMediaCleanupService');
const { createMediaDeletionJournal } = require('../../../resource-service/services/mediaDeletionJournal');
const { createPrivateMediaStore } = require('../../../resource-service/services/privateMediaStore');
const { createMediaCapabilityService } = require('../../../resource-service/services/mediaCapability');
const { createMediaService } = require('../../../resource-service/services/mediaService');
const { createMediaRouter } = require('../../../resource-service/routes/media');
const { createGrowthTaskCompletionRouter } = require('../../routes/growthTaskCompletion');
const { createGrowthTaskCompletionService } = require('../../services/growthTaskCompletionService');
const { createGrowthTaskCompletionConfirmationService } = require('../../services/growthTaskCompletionConfirmationService');
const Task = require('../../models/GrowthTask');
const LocalOperation = require('../../models/GrowthTaskCompletionOperation');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const Asset = require('../../../resource-service/models/MediaAsset');
const Reference = require('../../../resource-service/models/MediaReference');
const Operation = require('../../../resource-service/models/MediaReferenceOperation');
const Receipt = require('../../../resource-service/models/MediaDeletionReceipt');
const Tombstone = require('../../../resource-service/models/MediaDeletionTombstone');

const TOKEN = 'synthetic-privacy-http-service-token-32-characters';
const id = () => String(new mongoose.Types.ObjectId());
const runner = work => runMongoTransaction({ mongooseInstance: mongoose, work });
const http = axios.create({ proxy: false, timeout: 3000, validateStatus: () => true });
let servers, root, resourceUrl, homeworkUrl, family, parent, second, child, sibling, outsider, task, time;
let journal, privacy, operations, store, cleanup, dropDelete, dropRemote, journalFails, transactionFault, award, createRouter, calls;
const app = () => { const a = express(); a.locals.logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }; a.use(express.json()); return a; };
const listen = async a => {
  const server = await new Promise((resolve, reject) => {
    const s = a.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject);
  }); servers.push(server); return 'http://127.0.0.1:' + server.address().port;
};
const sign = (method, target, user = parent, extra = {}) => createIdentityHeaders({
  method, originalUrl: target, user, secret: process.env.GATEWAY_IDENTITY_SECRET, ...extra
});
const del = (mediaId, user = parent, options = {}) => http.delete(resourceUrl + '/api/media/' + mediaId,
  { headers: sign('DELETE', '/api/media/' + mediaId, user), ...options });
const patch = body => http.patch(homeworkUrl + `/api/growth-tasks/${task._id}/complete`, body,
  { headers: sign('PATCH', `/api/growth-tasks/${task._id}/complete`, child) });
const command = ids => ({ operationId: randomUUID(), expectedCompletionVersion: 0,
  expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: ids });
const fixture = async (count = 2, extra = {}) => {
  const assets = [];
  for (let i = 0; i < count; i += 1) {
    const stored = await store.writeCanonical(Buffer.from('synthetic private image'));
    assets.push(await Asset.create({ familyId: family._id, childId: child.id, uploadedBy: child.id,
      purpose: 'task_completion', mimeType: 'image/jpeg', sizeBytes: 23, storageKey: stored.storageKey, ...extra }));
  }
  return { assets, wire: { familyId: String(family._id), childId: child.id, resourceType: 'growth_task',
    resourceId: String(task._id), operationId: randomUUID(), commandHash: 'a'.repeat(64),
    references: assets.map(a => ({ mediaId: String(a._id), field: 'completionMediaIds' })) } };
};
const error = (response, status, code) => {
  expect(response.status).toBe(status);
  expect(response.data).toMatchObject({ success: false, error: { code, details: [] } });
  expect(JSON.stringify(response.data)).not.toMatch(/storageKey|bindingOperationId|privacyDeletion|remoteOperationId/);
  expect(JSON.stringify(response.data)).not.toContain(TOKEN);
};
const deletedFacts = async mediaId => ({ tombstone: await Tombstone.findOne({ mediaId }).lean(),
  receipts: await Receipt.find({ mediaId }).sort({ _id: 1 }).lean() });
const journalText = mediaId => fs.readFile(path.join(root, 'journal', `${mediaId}.json`), 'utf8');

beforeAll(async () => {
  for (const model of [Task, LocalOperation, Family, User, Asset, Reference, Operation, Receipt, Tombstone]) await model.init();
});
beforeEach(async () => {
  servers = []; dropDelete = false; dropRemote = null; journalFails = false; transactionFault = null; calls = [];
  ({ createCompletionMediaPrivacyRouter: createRouter } = require('../../../resource-service/routes/completionMediaPrivacy'));
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'privacy-http-')); time = Date.now();
  parent = { id: id(), role: 'parent' }; second = { id: id(), role: 'parent' }; outsider = { id: id(), role: 'parent' };
  child = { id: id(), role: 'student', tokenVersion: 0 }; sibling = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic privacy', ownerParentId: parent.id,
    memberParentIds: [parent.id, second.id], childIds: [child.id, sibling.id] });
  for (const u of [child, sibling]) Object.assign(u, { familyId: String(family._id), childId: u.id });
  await User.collection.insertMany([parent, second, outsider, child, sibling].map(u => ({ _id: new mongoose.Types.ObjectId(u.id),
    role: u.role, username: u.id, email: u.id + '@example.test',
    ...(u.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  task = await Task.create({ familyId: family._id, childId: child.id, createdByParentId: parent.id,
    dimension: 'academic', title: 'Synthetic privacy task', taskType: 'practice', dueDate: '2026-10-22' });
  journal = createMediaDeletionJournal({ root: path.join(root, 'journal') });
  const durable = { persist: async evidence => { if (journalFails) throw Error('Synthetic disk failure'); await journal.persist(evidence); } };
  const deleteRunner = async work => {
    const fault = transactionFault; transactionFault = null;
    const result = await runner(async session => {
      const value = await work(session);
      if (fault === 'rollback') throw Error('Synthetic rollback');
      return value;
    });
    if (fault === 'lost-ack') throw Error('Synthetic lost commit acknowledgement');
    return result;
  };
  privacy = createCompletionMediaPrivacyService({ transactionRunner: deleteRunner, journal: durable, now: () => time });
  operations = createMediaReferenceOperationService({ transactionRunner: runner, now: () => time });
  store = createPrivateMediaStore({ root: path.join(root, 'media') });
  cleanup = createCompletionMediaCleanupService({ transactionRunner: runner, journal, mediaStore: store, now: () => time });
  const resource = app();
  resource.use((req, res, next) => {
    const send = res.end, json = res.json;
    res.end = function end(...args) {
      if (dropDelete && req.method === 'DELETE' && this.statusCode === 204) { dropDelete = false; this.destroy(); return this; }
      return send.apply(this, args);
    };
    if (req.path.startsWith('/api/internal/')) calls.push({ action: req.path.split('/').pop(), body: req.body });
    res.json = function emit(body) {
      if (dropRemote && req.path.endsWith('/' + dropRemote) && body.success) { dropRemote = null; this.destroy(); return this; }
      return json.call(this, body);
    }; next();
  });
  resource.use('/api/media', createRouter({ privacyService: privacy }));
  const reader = createMediaService({ FamilyModel: Family, UserModel: User, MediaReferenceModel: Reference,
    mediaStore: store, transactionRunner: runner,
    capabilityService: createMediaCapabilityService({ secret: TOKEN, now: () => time }), now: () => time });
  resource.use('/api/media', createMediaRouter({ authenticate: authenticateGateway, mediaService: reader,
    upload: { singleImage: (_req, _res, next) => next(Error('Upload outside test scope')), removeTemporary: async () => {} } }));
  resource.use('/api/internal/media/references', createCompletionMediaReferencesRouter({
    credential: createMediaReferenceCredential(TOKEN), operationService: operations }));
  resource.use(errorHandler); resourceUrl = await listen(resource);
  const client = createCompletionMediaReferenceClient({ resourceServiceUrl: resourceUrl, serviceToken: TOKEN,
    axiosInstance: axios.create({ proxy: false, timeout: 3000 }) });
  award = jest.fn(async () => ({ awarded: true, ledgerEntryId: id(), starBalance: 1 }));
  const homework = app();
  homework.use('/api/growth-tasks', createGrowthTaskCompletionRouter({
    completionService: createGrowthTaskCompletionService({ transactionRunner: runner, mediaReferenceClient: client }),
    confirmationService: createGrowthTaskCompletionConfirmationService({ transactionRunner: runner, awardTaskStar: award }) }));
  homework.use(errorHandler); homeworkUrl = await listen(homework);
});
afterEach(async () => {
  for (const s of servers || []) { s.closeAllConnections(); await new Promise((resolve, reject) => s.close(e => e ? reject(e) : resolve())); }
  if (root) { await fs.rm(root, { recursive: true, force: true }); root = null; }
  jest.restoreAllMocks();
});

test('DELETE authenticates before invoking privacy or interpreting caller data', async () => {
  const spy = jest.spyOn(privacy, 'deleteMedia');
  error(await del(id(), parent, { headers: { 'x-user-id': parent.id, 'x-user-role': 'parent' }, data: { invalid: true } }),
    401, 'INVALID_IDENTITY_ENVELOPE');
  expect(spy).not.toHaveBeenCalled(); expect(await Tombstone.countDocuments()).toBe(0);
});

test.each(['expired', 'tampered', 'stale-child'])('%s identity cannot delete', async kind => {
  const { assets } = await fixture(1), target = '/api/media/' + assets[0]._id;
  let signed = sign('DELETE', target, child), code = 'INVALID_IDENTITY_ENVELOPE';
  if (kind === 'expired') { signed = sign('DELETE', target, child, { now: Date.now() - 360000 }); code = 'IDENTITY_ENVELOPE_EXPIRED'; }
  else if (kind === 'tampered') signed['x-user-id'] = sibling.id;
  else { await User.updateOne({ _id: child.id }, { $set: { 'childProfile.tokenVersion': 1 } }); code = 'STALE_CHILD_TOKEN'; }
  error(await del(assets[0]._id, child, { headers: signed }), 401, code);
  expect((await Asset.findById(assets[0]._id)).status).toBe('active'); expect(await Tombstone.countDocuments()).toBe(0);
});

test.each(['outsider', 'sibling', 'departed'])('%s cannot delete another child media or replay a deletion', async kind => {
  const { assets } = await fixture(1), mediaId = String(assets[0]._id);
  if (kind === 'departed') await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: second.id } });
  const user = kind === 'outsider' ? outsider : kind === 'sibling' ? sibling : second;
  error(await del(mediaId, user), 403, 'CHILD_ACCESS_DENIED');
  expect(await Tombstone.countDocuments()).toBe(0);
  expect((await del(mediaId)).status).toBe(204);
  const before = await deletedFacts(mediaId);
  error(await del(mediaId, user), 403, 'CHILD_ACCESS_DENIED'); expect(await deletedFacts(mediaId)).toEqual(before);
});

test.each(['parent', 'child', 'coparent'])('%s deletion waits for durable journal and returns empty 204', async role => {
  const { assets } = await fixture(1), mediaId = String(assets[0]._id), before = await Task.findById(task._id).lean();
  const response = await del(mediaId, role === 'child' ? child : role === 'coparent' ? second : parent);
  expect(response.status).toBe(204); expect(response.data).toBe('');
  const text = await journalText(mediaId); expect(JSON.parse(text).tombstone.mediaId).toBe(mediaId);
  expect(text).not.toContain(assets[0].storageKey); expect(await Task.findById(task._id).lean()).toEqual(before);
  expect((await store.read(assets[0].storageKey)).length).toBeGreaterThan(0); expect(award).not.toHaveBeenCalled();
});

test('DELETE rejects invalid IDs, missing assets and other media purposes without legacy fallback', async () => {
  error(await del('bad-id'), 400, 'VALIDATION_ERROR'); error(await del(id()), 404, 'RESOURCE_NOT_FOUND');
  const { assets } = await fixture(1, { purpose: 'task_attachment' });
  error(await del(assets[0]._id), 400, 'MEDIA_PURPOSE_MISMATCH');
  expect((await Asset.findById(assets[0]._id)).status).toBe('active'); expect(await Tombstone.countDocuments()).toBe(0);
});

test('DELETE rejects body-supplied identities and proofs without a write', async () => {
  const { assets } = await fixture(1);
  error(await del(assets[0]._id, parent, { data: { identity: child, privacyDeletion: { deletedAt: new Date() } } }), 400, 'VALIDATION_ERROR');
  expect(await Tombstone.countDocuments()).toBe(0); expect((await Asset.findById(assets[0]._id)).status).toBe('active');
});

test('HTTP deletion aborts the entire PREPARED group but only deletes the requested asset', async () => {
  const { assets, wire } = await fixture(); await operations.prepare(wire);
  expect((await del(assets[0]._id)).status).toBe(204);
  expect(await Operation.findOne().lean()).toMatchObject({ state: 'ABORTED', failureCode: 'RESOURCE_NOT_FOUND' });
  const rows = await Reference.find().lean(); expect(rows).toHaveLength(2); expect(rows.every(r => r.state === 'released')).toBe(true);
  expect((await Asset.findById(assets[1]._id)).status).toBe('active'); expect(await Receipt.countDocuments()).toBe(0);
  expect((await operations.commit(wire)).operation.state).toBe('ABORTED');
});

test('HTTP deletion preserves COMMITTED and releases only the exact selected binding', async () => {
  const { assets, wire } = await fixture(); await operations.prepare(wire); await operations.commit(wire);
  const before = await Operation.findOne().lean(); expect((await del(assets[0]._id)).status).toBe(204);
  const status = await operations.status({ ...wire, mode: 'operation' });
  expect(status.operation.state).toBe('COMMITTED');
  expect((await Operation.findOne().lean()).terminalAt).toEqual(before.terminalAt);
  expect(status.references.find(r => r.mediaId === String(assets[0]._id))).toMatchObject({ state: 'released',
    privacyDeletion: { mediaId: String(assets[0]._id), resourceId: String(task._id), bindingOperationId: wire.operationId } });
  expect(status.references.find(r => r.mediaId === String(assets[1]._id)).state).toBe('bound');
});

test('lost public DELETE response replays 204 without replacing first audit or journal', async () => {
  const { assets, wire } = await fixture(1); await operations.prepare(wire); await operations.commit(wire);
  dropDelete = true; await expect(del(assets[0]._id)).rejects.toMatchObject({ code: 'ECONNRESET' }); expect(dropDelete).toBe(false);
  const facts = await deletedFacts(assets[0]._id), text = await journalText(assets[0]._id); time += 1000;
  expect((await del(assets[0]._id, second)).status).toBe(204);
  expect(await deletedFacts(assets[0]._id)).toEqual(facts); expect(await journalText(assets[0]._id)).toBe(text);
  expect(String(facts.tombstone.actorId)).toBe(parent.id); expect(facts.receipts).toHaveLength(1);
});

test('journal failure returns 503 after database deletion; authorized retry persists original evidence', async () => {
  const { assets } = await fixture(1); journalFails = true;
  error(await del(assets[0]._id), 503, 'MEDIA_REFERENCE_PENDING');
  const facts = await deletedFacts(assets[0]._id); expect(facts.tombstone).not.toBeNull();
  expect((await Asset.findById(assets[0]._id)).status).toBe('deleted');
  await expect(journalText(assets[0]._id)).rejects.toMatchObject({ code: 'ENOENT' });
  journalFails = false; time += 1000; expect((await del(assets[0]._id, child)).status).toBe(204);
  expect(await deletedFacts(assets[0]._id)).toEqual(facts); expect(JSON.parse(await journalText(assets[0]._id)).tombstone.actorId).toBe(parent.id);
});

test('deleted asset blocks access and already-issued content URL while bytes remain retained', async () => {
  const { assets } = await fixture(1), accessPath = '/api/media/' + assets[0]._id + '/access';
  const access = await http.get(resourceUrl + accessPath, { headers: sign('GET', accessPath) }); expect(access.status).toBe(200);
  const url = resourceUrl + access.data.data.access.url;
  expect((await http.get(url)).status).toBe(200); expect((await del(assets[0]._id)).status).toBe(204);
  error(await http.get(url), 404, 'RESOURCE_NOT_FOUND');
  error(await http.get(resourceUrl + accessPath, { headers: sign('GET', accessPath) }), 404, 'RESOURCE_NOT_FOUND');
  expect((await store.read(assets[0].storageKey)).length).toBeGreaterThan(0);
});

test.each(['file', 'directory'])('real journal %s sync error returns sanitized 503, blocks prior URL and retries with first audit', async phase => {
  const { assets, wire } = await fixture(1); await operations.prepare(wire); await operations.commit(wire);
  const mediaId = assets[0]._id, accessPath = '/api/media/' + mediaId + '/access';
  const access = await http.get(resourceUrl + accessPath, { headers: sign('GET', accessPath) });
  expect(access.status).toBe(200);
  const url = resourceUrl + access.data.data.access.url;
  expect((await http.get(url)).status).toBe(200);
  const open = fs.open.bind(fs); let hits = 0;
  const spy = jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await open(...args);
    const selected = phase === 'directory' ? args[0] === path.join(root, 'journal')
      : path.dirname(args[0]) === path.join(root, 'journal') && args[0].endsWith('.tmp');
    if (selected) handle.sync = async () => { hits += 1; throw Error(`Synthetic private path ${root}`); };
    return handle;
  });
  try {
    const response = await del(mediaId); error(response, 503, 'MEDIA_REFERENCE_PENDING');
    expect(hits).toBe(1); expect(JSON.stringify(response.data)).not.toContain(root);
    error(await http.get(url), 404, 'RESOURCE_NOT_FOUND');
    error(await http.get(resourceUrl + accessPath, { headers: sign('GET', accessPath) }), 404, 'RESOURCE_NOT_FOUND');
  } finally { spy.mockRestore(); }
  const first = await deletedFacts(mediaId);
  expect(String(first.tombstone.actorId)).toBe(parent.id); expect(first.receipts).toHaveLength(1);
  expect((await store.read(assets[0].storageKey)).length).toBeGreaterThan(0);
  if (phase === 'file') await expect(journalText(mediaId)).rejects.toMatchObject({ code: 'ENOENT' });
  else expect(JSON.parse(await journalText(mediaId)).tombstone.actorId).toBe(parent.id);
  time += 1000;
  const retry = await del(mediaId, second); expect(retry.status).toBe(204); expect(retry.data).toBe('');
  expect(await deletedFacts(mediaId)).toEqual(first);
  expect(JSON.parse(await journalText(mediaId)).tombstone.actorId).toBe(parent.id);
  expect((await operations.status({ ...wire, mode: 'operation' })).operation.state).toBe('COMMITTED');
});

test.each(['prepare', 'commit'])('deletion after lost remote %s response converges the original public completion', async action => {
  const { assets } = await fixture(), body = command(assets.map(a => String(a._id))); dropRemote = action;
  error(await patch(body), 503, 'MEDIA_REFERENCE_PENDING'); expect(dropRemote).toBeNull();
  const local = await LocalOperation.findOne({ taskId: task._id }).lean(); expect(local.phase).toBe('PREPUBLISH');
  expect((await del(assets[0]._id)).status).toBe(204);
  const recovered = await patch(body);
  if (action === 'prepare') {
    error(recovered, 404, 'RESOURCE_NOT_FOUND');
    expect((await LocalOperation.findOne().lean()).phase).toBe('FAILED'); expect((await Task.findById(task._id)).status).toBe('pending');
  } else {
    expect(recovered.status).toBe(200); expect(recovered.data.data.task.completionMediaIds).toEqual(body.completionMediaIds);
    expect((await LocalOperation.findOne().lean()).phase).toBe('SUCCEEDED'); expect((await Task.findById(task._id)).completionVersion).toBe(1);
    const query = calls.find(c => c.action === 'status').body;
    const evidence = await operations.status(query);
    expect(evidence.references.find(r => r.mediaId === String(assets[0]._id)).privacyDeletion.bindingOperationId).toBe(local.remoteOperationId);
  }
  expect(calls.every(c => c.body.operationId === local.remoteOperationId)).toBe(true);
  const stable = await Task.findById(task._id).select('+activeCompletionOperation +completionPending').lean();
  expect(stable.activeCompletionOperation).toBeUndefined(); expect(stable.completionPending).toBeUndefined();
});

test.each(['confirmed', 'archived'])('%s task does not prevent privacy deletion or change teaching audit', async state => {
  const { assets } = await fixture(1); expect((await patch(command([String(assets[0]._id)]))).status).toBe(200);
  const target = `/api/growth-tasks/${task._id}/confirm`;
  expect((await http.patch(homeworkUrl + target, { expectedCompletionVersion: 1 }, { headers: sign('PATCH', target) })).status).toBe(200);
  if (state === 'archived') await Task.updateOne({ _id: task._id }, { $set: { status: state } });
  const before = await Task.findById(task._id).lean(), count = award.mock.calls.length;
  expect((await del(assets[0]._id, child)).status).toBe(204);
  expect(await Task.findById(task._id).lean()).toEqual(before); expect(award).toHaveBeenCalledTimes(count);
});

test('after retention cleanup DELETE still replays from tombstone without recreating assets', async () => {
  const { assets, wire } = await fixture(1); await operations.prepare(wire); await operations.commit(wire);
  expect((await del(assets[0]._id)).status).toBe(204); const facts = await deletedFacts(assets[0]._id);
  time += 31 * 86400000; expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(1);
  expect(await Asset.findById(assets[0]._id)).toBeNull();
  expect((await del(assets[0]._id, child)).status).toBe(204); expect(await deletedFacts(assets[0]._id)).toEqual(facts);
  expect(await Asset.findById(assets[0]._id)).toBeNull();
});

test('factory requires privacy service and errors use the real shared handler', async () => {
  expect(() => createRouter()).toThrow(); expect(() => createRouter({ privacyService: {} })).toThrow();
  jest.spyOn(privacy, 'deleteMedia').mockRejectedValueOnce(Error(TOKEN + ' synthetic fault'));
  error(await del(id()), 500, 'INTERNAL_ERROR'); expect(await Tombstone.countDocuments()).toBe(0);
});

test.each(['rollback', 'lost-ack'])('privacy transaction %s returns 503 and retries without partial or rewritten evidence', async fault => {
  const { assets, wire } = await fixture(); await operations.prepare(wire); await operations.commit(wire);
  const mediaId = String(assets[0]._id); transactionFault = fault;
  error(await del(mediaId), 503, 'MEDIA_REFERENCE_PENDING');
  expect(transactionFault).toBeNull(); const facts = await deletedFacts(mediaId);
  if (fault === 'rollback') {
    expect(facts).toEqual({ tombstone: null, receipts: [] });
    expect((await Asset.findById(mediaId)).status).toBe('active');
    expect(await Reference.countDocuments({ state: 'bound' })).toBe(2);
  } else {
    expect(facts.tombstone).not.toBeNull(); expect(facts.receipts).toHaveLength(1);
    expect((await Asset.findById(mediaId)).status).toBe('deleted');
    expect(await Reference.countDocuments({ state: 'bound' })).toBe(1);
  }
  await expect(journalText(mediaId)).rejects.toMatchObject({ code: 'ENOENT' });
  time += 1000; expect((await del(mediaId, second)).status).toBe(204);
  if (fault === 'lost-ack') expect(await deletedFacts(mediaId)).toEqual(facts);
  expect((await Operation.findOne().lean()).state).toBe('COMMITTED');
  expect((await Asset.findById(assets[1]._id)).status).toBe('active');
  expect(JSON.parse(await journalText(mediaId)).tombstone.actorId).toBe(fault === 'rollback' ? second.id : parent.id);
});

test.each(['prepare', 'commit'])('DELETE racing real HTTP %s never leaves live deleted bindings or a partial aborted group', async action => {
  const { assets, wire } = await fixture(); if (action === 'commit') await operations.prepare(wire);
  const [deleted, remoteResponse] = await Promise.all([
    del(assets[0]._id),
    http.post(resourceUrl + '/api/internal/media/references/' + action, wire, { headers: { 'x-service-token': TOKEN } })
  ]);
  expect(deleted.status).toBe(204); expect(remoteResponse.status).toBe(200);
  const operation = await Operation.findOne().lean(), refs = await Reference.find().lean();
  expect(['ABORTED', 'COMMITTED']).toContain(operation.state);
  expect(refs.filter(r => String(r.mediaId) === String(assets[0]._id)).every(r => r.state === 'released')).toBe(true);
  if (operation.state === 'ABORTED') expect(refs.every(r => r.state === 'released')).toBe(true);
  else { expect(refs).toHaveLength(2); expect(await Receipt.countDocuments()).toBe(1); }
  expect((await Asset.findById(assets[0]._id)).status).toBe('deleted');
  expect((await Asset.findById(assets[1]._id)).status).toBe('active');
  expect(await Tombstone.countDocuments()).toBe(1); expect(JSON.parse(await journalText(assets[0]._id)).tombstone.mediaId).toBe(String(assets[0]._id));
});

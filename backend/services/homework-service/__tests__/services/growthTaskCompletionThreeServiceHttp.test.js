const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');
const { errorHandler } = require('../../../../common/middleware/errorHandler');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { createCompletionMediaReferenceClient } = require('../../../../common/services/mediaReferenceClient');
const { createCompletionMediaReferencesRouter } = require('../../../resource-service/routes/completionMediaReferences');
const { createMediaReferenceCredential } = require('../../../resource-service/middleware/mediaReferenceCredential');
const { createMediaReferenceOperationService } = require('../../../resource-service/services/mediaReferenceOperationService');
const { createCompletionMediaPrivacyRouter } = require('../../../resource-service/routes/completionMediaPrivacy');
const { createCompletionMediaPrivacyService } = require('../../../resource-service/services/completionMediaPrivacyService');
const { createCompletionMediaCleanupService } = require('../../../resource-service/services/completionMediaCleanupService');
const { createMediaDeletionJournal } = require('../../../resource-service/services/mediaDeletionJournal');
const { createPrivateMediaStore } = require('../../../resource-service/services/privateMediaStore');
const { createGrowthTaskCompletionService } = require('../../services/growthTaskCompletionService');
const { createGrowthTaskCompletionConfirmationService } = require('../../services/growthTaskCompletionConfirmationService');
const { createGrowthTaskCompletionReadService } = require('../../services/growthTaskCompletionReadService');
const { createGrowthTaskCompletionRouter } = require('../../routes/growthTaskCompletion');
const { createGrowthTaskCompletionReadRouter } = require('../../routes/growthTaskCompletionRead');
const { createGrowthTaskCompletionMutationRouter } = require('../../routes/growthTaskCompletionMutation');
const { createGrowthTaskCompletionMutationService } = require('../../services/growthTaskCompletionMutationService');
const { createStarAwardClient } = require('../../services/starAwardClient');
const internalStars = require('../../../progress-service/routes/internalStars');
const { calculateBalance } = require('../../../progress-service/services/starLedgerService');
const Task = require('../../models/GrowthTask');
const Operation = require('../../models/GrowthTaskCompletionOperation');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const Asset = require('../../../resource-service/models/MediaAsset');
const Reference = require('../../../resource-service/models/MediaReference');
const RemoteOperation = require('../../../resource-service/models/MediaReferenceOperation');
const Receipt = require('../../../resource-service/models/MediaDeletionReceipt');
const Tombstone = require('../../../resource-service/models/MediaDeletionTombstone');
const Ledger = require('../../../progress-service/models/StarLedgerEntry');
const snapshotModels = [Task, Operation, Family, User, Asset, Reference, RemoteOperation, Receipt, Tombstone, Ledger];

const TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const MEDIA_TOKEN = 'synthetic-three-service-media-token-32-characters';
const id = () => String(new mongoose.Types.ObjectId());
const runner = work => runMongoTransaction({ mongooseInstance: mongoose, work });
const http = axios.create({ proxy: false, timeout: 5000, validateStatus: () => true });
const transport = () => axios.create({ proxy: false, timeout: 3000 });
let servers, base, resourceUrl, progressUrl, parent, second, child, sibling, outsider, family, task;
let completion, confirmation, mutation, mediaCalls, starCalls, dropMedia, dropStar, dropPublic;
let confirmationTime, resourceTime, blockMedia;
let privateRoot, store, journal, cleanup, dropDelete, journalFails, removeFails;
let cleanupCommitFault, cleanupFaultWitness, removals;
const app = () => {
  const instance = express();
  instance.locals.logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  instance.use(express.json()); return instance;
};
const listen = async instance => {
  const server = await new Promise((resolve, reject) => {
    const s = instance.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject);
  });
  servers.push(server); return 'http://127.0.0.1:' + server.address().port;
};
const send = (method, suffix, body, identity = child) => {
  const url = `/api/growth-tasks/${task._id}${suffix}`;
  return http.request({ method, url: base + url, data: body,
    headers: createIdentityHeaders({ method, originalUrl: url, user: identity, secret: process.env.GATEWAY_IDENTITY_SECRET }) });
};
const complete = (body, identity = child) => send('PATCH', '/complete', body, identity);
const confirm = (version = 1, identity = parent, feedback = 'first audit') => send('PATCH', '/confirm', {
  expectedCompletionVersion: version, parentFeedback: feedback
}, identity);
const detail = (identity = child) => send('GET', '', undefined, identity);
const deleteMedia = (mediaId, identity = parent) => {
  const url = '/api/media/' + mediaId;
  return http.delete(resourceUrl + url, { headers: createIdentityHeaders({ method: 'DELETE', originalUrl: url,
    user: identity, secret: process.env.GATEWAY_IDENTITY_SECRET }) });
};
const storedMedia = async () => {
  const stored = await store.writeCanonical(Buffer.from('synthetic completion image'));
  return media({ storageKey: stored.storageKey });
};
const deletionFacts = async mediaId => ({ tombstone: await Tombstone.findOne({ mediaId }).lean(),
  receipts: await Receipt.find({ mediaId }).sort({ _id: 1 }).lean() });
const journalText = mediaId => fs.readFile(path.join(privateRoot, 'journal', `${mediaId}.json`), 'utf8');
const RETENTION = 30 * 86400000;
const command = (ids, version = 0) => ({ operationId: randomUUID(), expectedCompletionVersion: version,
  expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: ids });
const media = async (extra = {}) => String((await Asset.create({ familyId: family._id, childId: child.id,
  uploadedBy: child.id, purpose: 'task_completion', mimeType: 'image/jpeg', sizeBytes: 1,
  storageKey: randomUUID(), ...extra }))._id);
const row = () => Task.collection.findOne({ _id: task._id });
const operation = body => Operation.findOne({ taskId: task._id, operationId: body.operationId }).lean();
const publicBody = body => {
  expect(JSON.stringify(body)).not.toMatch(/remoteOperationId|bindingOperationId|commandHash|completionPending|activeCompletionOperation|storageKey/);
  expect(JSON.stringify(body)).not.toContain(TOKEN); expect(JSON.stringify(body)).not.toContain(MEDIA_TOKEN);
};
const fail = (response, status, code) => {
  expect(response.status).toBe(status);
  expect(response.data).toMatchObject({ success: false, error: { code, details: [] } }); publicBody(response.data);
};
const oneStar = async () => {
  const entries = await Ledger.find().lean(); expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ familyId: family._id, childId: new mongoose.Types.ObjectId(child.id),
    type: 'earn', amount: 1, sourceType: 'task_confirmation', sourceId: String(task._id), createdBy: 'homework-service' });
  expect(await calculateBalance({ familyId: family._id, childId: new mongoose.Types.ObjectId(child.id) })).toBe(1);
  return entries[0];
};
const rebuild = () => {
  mutation = createGrowthTaskCompletionMutationService({ transactionRunner: runner });
  completion = createGrowthTaskCompletionService({ transactionRunner: runner,
    mediaReferenceClient: createCompletionMediaReferenceClient({ resourceServiceUrl: resourceUrl,
      serviceToken: MEDIA_TOKEN, axiosInstance: transport() }) });
  const client = createStarAwardClient({ progressServiceUrl: progressUrl, internalServiceToken: TOKEN,
    axiosInstance: transport(), retryAttempts: 0 });
  confirmation = createGrowthTaskCompletionConfirmationService({ transactionRunner: runner,
    awardTaskStar: client.awardTaskStar, now: () => confirmationTime });
};
// Actual providers compute and persist their result before this transport fault fires.
const dropResponse = predicate => (req, res, next) => {
  const json = res.json;
  res.json = function emit(body) {
    if (body.success && predicate(req)) { this.destroy(); return this; }
    return json.call(this, body);
  }; next();
};

beforeAll(async () => {
  for (const model of snapshotModels) await model.init();
});
beforeEach(async () => {
  servers = []; mediaCalls = []; starCalls = []; dropMedia = null; dropStar = false; dropPublic = null;
  resourceTime = null; blockMedia = null;
  dropDelete = false; journalFails = false; removeFails = false;
  cleanupCommitFault = null; cleanupFaultWitness = null; removals = [];
  privateRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'three-service-privacy-'));
  confirmationTime = Date.parse('2026-10-22T00:00:00Z');
  parent = { id: id(), role: 'parent' }; second = { id: id(), role: 'parent' }; outsider = { id: id(), role: 'parent' };
  child = { id: id(), role: 'student', tokenVersion: 0 }; sibling = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic three service', ownerParentId: parent.id,
    memberParentIds: [parent.id, second.id], childIds: [child.id, sibling.id] });
  for (const u of [child, sibling]) Object.assign(u, { familyId: String(family._id), childId: u.id });
  await User.collection.insertMany([parent, second, child, sibling, outsider].map(u => ({
    _id: new mongoose.Types.ObjectId(u.id), role: u.role, username: u.id, email: u.id + '@example.test',
    ...(u.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {})
  })));
  task = await Task.create({ familyId: family._id, childId: child.id, createdByParentId: parent.id,
    title: 'Synthetic task', dimension: 'physical', taskType: 'practice', dueDate: '2026-10-22' });
  await startProviders();
});
const startProviders = async () => {
  const resource = app();
  resource.use((req, res, next) => {
    if (req.path.startsWith('/api/internal/')) mediaCalls.push({ action: req.path.split('/').pop(), body: req.body });
    const end = res.end;
    res.end = function emit(...args) {
      if (dropDelete && req.method === 'DELETE' && this.statusCode === 204) {
        dropDelete = false; this.destroy(); return this;
      }
      return end.apply(this, args);
    };
    next();
  });
  resource.use((req, res, next) => {
    if (blockMedia !== req.path.split('/').pop()) return next();
    blockMedia = null;
    return res.status(503).json({ success: false, error: { code: 'MEDIA_REFERENCE_PENDING',
      message: 'MEDIA_REFERENCE_PENDING', details: [] } });
  });
  resource.use(dropResponse(req => {
    if (dropMedia !== req.path.split('/').pop()) return false;
    dropMedia = null; return true;
  }));
  resource.use('/api/internal/media/references', createCompletionMediaReferencesRouter({
    credential: createMediaReferenceCredential(MEDIA_TOKEN),
    operationService: createMediaReferenceOperationService({ transactionRunner: runner, now: () => resourceTime ?? Date.now() })
  }));
  store = createPrivateMediaStore({ root: path.join(privateRoot, 'media') });
  journal = createMediaDeletionJournal({ root: path.join(privateRoot, 'journal') });
  const durable = { persist: async evidence => {
    if (journalFails) throw Error('Synthetic journal unavailable');
    await journal.persist(evidence);
  } };
  const privacy = createCompletionMediaPrivacyService({ transactionRunner: runner, journal: durable,
    now: () => resourceTime ?? Date.now() });
  const cleanupRunner = async work => {
    const result = await runner(async session => {
      const value = await work(session);
      // The inspect transaction returns an object/null; true identifies the completed metadata deletion.
      if (value === true && cleanupCommitFault) {
        cleanupFaultWitness = { fault: cleanupCommitFault,
          assets: await Asset.countDocuments({ status: 'deleted' }).session(session),
          references: await Reference.countDocuments({ state: 'released' }).session(session) };
        if (cleanupCommitFault === 'rollback') {
          cleanupCommitFault = null; throw Error('Synthetic cleanup metadata rollback');
        }
      }
      return value;
    });
    if (result === true && cleanupCommitFault === 'lost-ack') {
      cleanupCommitFault = null; throw Error('Synthetic cleanup metadata acknowledgement lost');
    }
    return result;
  };
  cleanup = createCompletionMediaCleanupService({ transactionRunner: cleanupRunner, journal: durable,
    mediaStore: { remove: async key => {
      if (removeFails) throw Error('Synthetic media removal unavailable');
      const removed = await store.remove(key); removals.push({ key, removed });
      return removed;
    } }, now: () => resourceTime ?? Date.now() });
  resource.use('/api/media', createCompletionMediaPrivacyRouter({ privacyService: privacy }));
  resource.use(errorHandler); resourceUrl = await listen(resource);
  const progress = app();
  progress.use((req, res, next) => { starCalls.push(req.body); next(); });
  progress.use(dropResponse(() => { if (!dropStar) return false; dropStar = false; return true; }));
  progress.use('/api/internal/stars', internalStars); progress.use(errorHandler); progressUrl = await listen(progress);
  rebuild();
  const homework = app();
  homework.use(dropResponse(req => {
    if (dropPublic !== req.path.split('/').pop()) return false;
    dropPublic = null; return true;
  }));
  homework.use('/api/growth-tasks', createGrowthTaskCompletionRouter({
    completionService: { complete: input => completion.complete(input) },
    confirmationService: { confirm: input => confirmation.confirm(input) }
  }));
  homework.use('/api/growth-tasks', createGrowthTaskCompletionReadRouter({
    readService: createGrowthTaskCompletionReadService({ transactionRunner: runner })
  }));
  homework.use('/api/growth-tasks', createGrowthTaskCompletionMutationRouter({ mutationService: {
    edit: input => mutation.edit(input), remove: input => mutation.remove(input)
  } }));
  homework.use(errorHandler); base = await listen(homework);
};
const stopProviders = async () => {
  for (const s of (servers || []).splice(0)) {
    s.closeAllConnections(); await new Promise((resolve, reject) => s.close(e => e ? reject(e) : resolve()));
    expect(s.listening).toBe(false);
  }
};
afterEach(async () => {
  try { await stopProviders(); }
  finally {
    if (privateRoot) { await fs.rm(privateRoot, { recursive: true, force: true }); privateRoot = null; }
  }
});

// Test-only reconstruction inside the temporary replica set, not a backup/restore tool.
const reconstructSnapshot = async () => {
  const previousCompletion = completion;
  await stopProviders();
  const snapshots = [];
  for (const model of snapshotModels) {
    const documents = await model.collection.find({}).sort({ _id: 1 }).toArray();
    snapshots.push({ model, documents, bytes: mongoose.mongo.BSON.serialize({ documents }),
      indexes: await model.collection.indexes() });
  }
  for (const { model } of snapshots) {
    await model.collection.deleteMany({});
    expect(await model.collection.countDocuments()).toBe(0);
  }
  for (const { model, bytes, documents, indexes } of snapshots) {
    const decoded = mongoose.mongo.BSON.deserialize(bytes).documents;
    if (decoded.length) await model.collection.insertMany(decoded);
    expect(await model.collection.find({}).sort({ _id: 1 }).toArray()).toEqual(documents);
    expect(await model.collection.indexes()).toEqual(indexes);
  }
  await startProviders();
  expect(servers).toHaveLength(3); expect(completion).not.toBe(previousCompletion);
};

test.each([0, 1, 10])('%i images complete, read and confirm through actual media and star HTTP providers', async count => {
  const ids = []; for (let i = 0; i < count; i += 1) ids.push(await media());
  const body = command(ids), completed = await complete(body); expect(completed.status).toBe(200); publicBody(completed.data);
  const op = await operation(body); expect(op.phase).toBe('SUCCEEDED'); expect(op.remoteOperationId).not.toBe(body.operationId);
  const refs = await Reference.find().lean(); expect(refs).toHaveLength(count);
  expect(refs.map(r => String(r.mediaId)).sort()).toEqual([...ids].sort());
  expect(refs.every(r => r.state === 'bound' && r.operationId === op.remoteOperationId)).toBe(true);
  expect(await RemoteOperation.countDocuments()).toBe(count ? 1 : 0);
  if (count) expect((await RemoteOperation.findOne().lean()).state).toBe('COMMITTED');
  const read = await detail(parent); expect(read.status).toBe(200); publicBody(read.data);
  expect(read.data.data.task).toMatchObject({ status: 'completed', completionVersion: 1, completionMediaIds: ids });
  const accepted = await confirm(read.data.data.task.completionVersion, second); expect(accepted.status).toBe(200);
  expect(accepted.data.data.task).toMatchObject({ status: 'confirmed', completionVersion: 1,
    completionMediaIds: ids, starAwardState: 'awarded', confirmedByParentId: second.id }); publicBody(accepted.data);
  const ledger = await oneStar(); expect(accepted.data.data.starAward).toEqual({ awarded: true, ledgerEntryId: String(ledger._id), starBalance: 1 });
  const before = await row(), calls = mediaCalls.length;
  expect((await complete(body)).data).toEqual(completed.data); expect((await confirm(1, parent, 'ignored')).status).toBe(200);
  expect(await row()).toEqual(before); expect(await Reference.find().lean()).toEqual(refs);
  expect(mediaCalls).toHaveLength(calls); expect(starCalls).toHaveLength(1); expect(await oneStar()).toEqual(ledger);
});

test.each(['reorder', 'remove-all'])('%s preserves generation rules and only stars the resulting version', async kind => {
  const a = await media(), b = await media(), first = command([a, b]);
  expect((await complete(first)).status).toBe(200); const old = await operation(first), calls = mediaCalls.length;
  const ids = kind === 'reorder' ? [b, a] : [], next = command(ids, 1);
  expect((await complete(next)).status).toBe(200); const op = await operation(next);
  expect(op.phase).toBe('SUCCEEDED'); expect(op.remoteOperationId).not.toBe(old.remoteOperationId);
  expect(await RemoteOperation.countDocuments()).toBe(1);
  expect((await RemoteOperation.findOne().lean()).state).toBe('COMMITTED');
  expect(mediaCalls.slice(calls).map(c => c.action)).toEqual(kind === 'reorder' ? [] : ['status', 'unbind']);
  if (kind === 'remove-all') {
    expect(mediaCalls[calls].body.mode).toBe('references');
    expect(mediaCalls[calls + 1].body).toMatchObject({ operationId: op.remoteOperationId,
      references: [a, b].map(mediaId => ({ mediaId, bindingOperationId: old.remoteOperationId })) });
  }
  const refs = await Reference.find().lean(); expect(refs).toHaveLength(2);
  expect(refs.every(r => r.operationId === old.remoteOperationId && r.state === (kind === 'reorder' ? 'bound' : 'released'))).toBe(true);
  expect((await row()).completionMediaBindings.map(r => ({ mediaId: String(r.mediaId), bindingOperationId: r.bindingOperationId })))
    .toEqual(ids.map(mediaId => ({ mediaId, bindingOperationId: old.remoteOperationId })));
  const read = await detail(); expect(read.status).toBe(200);
  expect(read.data.data.task).toMatchObject({ completionVersion: 2, completionMediaIds: ids, completionMediaReferenceState: 'stable' });
  fail(await confirm(1), 409, 'VERSION_CONFLICT'); expect(starCalls).toHaveLength(0);
  expect((await confirm(2)).status).toBe(200); await oneStar();
  expect(await Reference.find().lean()).toEqual(refs);
});

test('actors sharing a public UUID keep separate persisted mappings and immutable replay after the current version earns a star', async () => {
  const a = await media(), b = await media(), first = command([a]);
  const original = await complete(first, child); expect(original.status).toBe(200);
  const old = await Operation.findOne({ taskId: task._id, actorId: child.id }).lean();
  const next = { ...command([b], 1), operationId: first.operationId };
  expect((await complete(next, parent)).status).toBe(200);
  const current = await Operation.findOne({ taskId: task._id, actorId: parent.id }).lean();
  expect(current.remoteOperationId).not.toBe(old.remoteOperationId);
  expect(await Operation.countDocuments()).toBe(2); expect(await RemoteOperation.countDocuments({ state: 'COMMITTED' })).toBe(2);
  expect(await Reference.findOne({ mediaId: a }).lean()).toMatchObject({ state: 'released', operationId: old.remoteOperationId });
  expect(await Reference.findOne({ mediaId: b }).lean()).toMatchObject({ state: 'bound', operationId: current.remoteOperationId });
  expect((await confirm(2, second)).status).toBe(200); const ledger = await oneStar();
  const before = await row(), calls = mediaCalls.length;
  expect((await complete(first, child)).data).toEqual(original.data); expect(await row()).toEqual(before);
  const read = await detail(); expect(read.status).toBe(200);
  expect(read.data.data.task).toMatchObject({ completionVersion: 2, completionMediaIds: [b], starAwardState: 'awarded' });
  expect(mediaCalls).toHaveLength(calls); expect(starCalls).toHaveLength(1); expect(await oneStar()).toEqual(ledger);
});

test.each(['prepare', 'commit'])('lost media %s blocks confirmation and GET cannot help; original PATCH restores the chain', async action => {
  const body = command([await media()]); dropMedia = action;
  fail(await complete(body), 503, 'MEDIA_REFERENCE_PENDING'); expect(dropMedia).toBeNull();
  const op = await operation(body); expect(op.phase).toBe('PREPUBLISH');
  expect((await RemoteOperation.findOne().lean()).state).toBe(action === 'prepare' ? 'PREPARED' : 'COMMITTED');
  const before = await row(), refs = await Reference.find().lean(), calls = mediaCalls.length;
  const read = await detail(parent); expect(read.status).toBe(200); publicBody(read.data);
  expect(read.data.data.task).toMatchObject({ completionVersion: 0, completionMediaIds: [] });
  fail(await confirm(0), 503, 'MEDIA_REFERENCE_PENDING');
  expect(await row()).toEqual(before); expect(await Reference.find().lean()).toEqual(refs);
  expect(mediaCalls).toHaveLength(calls); expect(starCalls).toHaveLength(0); expect(await Ledger.countDocuments()).toBe(0);
  rebuild(); expect((await complete(body)).status).toBe(200);
  expect(await operation(body)).toMatchObject({ phase: 'SUCCEEDED', remoteOperationId: op.remoteOperationId });
  expect(await Operation.countDocuments()).toBe(1); expect(await RemoteOperation.countDocuments()).toBe(1);
  expect((await confirm()).status).toBe(200); await oneStar();
  expect((await row()).completionMediaBindings.map(r => r.bindingOperationId)).toEqual([op.remoteOperationId]);
});

test('lost exact-generation unbind exposes new version but blocks stars until cleanup replay', async () => {
  const a = await media(), b = await media(), c = await media(), first = command([a, b]);
  expect((await complete(first)).status).toBe(200); const old = await operation(first);
  const next = command([b, c], 1); dropMedia = 'unbind';
  fail(await complete(next), 503, 'MEDIA_REFERENCE_PENDING'); expect(dropMedia).toBeNull();
  const op = await operation(next), published = await row(); expect(op.phase).toBe('PUBLISHED_CLEANUP');
  expect(mediaCalls.find(r => r.action === 'unbind').body).toMatchObject({ operationId: op.remoteOperationId,
    references: [{ mediaId: a, bindingOperationId: old.remoteOperationId }] });
  const references = () => Reference.find({ resourceId: task._id }).sort({ mediaId: 1 }).lean();
  const refs = await references(); expect(refs).toHaveLength(3);
  expect(refs.map(r => ({ mediaId: String(r.mediaId), state: r.state, operationId: r.operationId,
    familyId: String(r.familyId), childId: String(r.childId), field: r.field })))
    .toEqual([
      { mediaId: a, state: 'released', operationId: old.remoteOperationId },
      { mediaId: b, state: 'bound', operationId: old.remoteOperationId },
      { mediaId: c, state: 'bound', operationId: op.remoteOperationId }
    ].map(r => ({ ...r, familyId: String(family._id), childId: child.id, field: 'completionMediaIds' }))
      .sort((x, y) => x.mediaId.localeCompare(y.mediaId)));
  const calls = mediaCalls.length, remoteOps = await RemoteOperation.find().lean();
  const read = await detail(); expect(read.status).toBe(200); publicBody(read.data);
  expect(read.data.data.task).toMatchObject({ completionVersion: 2, completionMediaIds: [b, c], completionMediaReferenceState: 'pending_recovery' });
  fail(await confirm(2), 503, 'MEDIA_REFERENCE_PENDING'); expect(starCalls).toHaveLength(0); expect(await Ledger.countDocuments()).toBe(0);
  expect(await row()).toEqual(published); expect(await operation(next)).toEqual(op);
  expect(await references()).toEqual(refs); expect(await RemoteOperation.find().lean()).toEqual(remoteOps);
  expect(mediaCalls).toHaveLength(calls);
  rebuild(); expect((await complete(next)).status).toBe(200);
  const recovered = await row(); expect(recovered.completedAt).toEqual(published.completedAt); expect(recovered.completionVersion).toBe(2);
  expect(recovered.activeCompletionOperation).toBeUndefined(); expect(recovered.completionMediaReferenceState).toBe('stable');
  expect(recovered.completionMediaBindings.map(r => ({ mediaId: String(r.mediaId), bindingOperationId: r.bindingOperationId })))
    .toEqual([{ mediaId: b, bindingOperationId: old.remoteOperationId }, { mediaId: c, bindingOperationId: op.remoteOperationId }]);
  expect(await references()).toEqual(refs); expect(await RemoteOperation.countDocuments()).toBe(2);
  expect((await confirm(2)).status).toBe(200); await oneStar();
  expect(await references()).toEqual(refs);
});

test.each(['purpose', 'child', 'deleted'])('refused media %s cannot publish or reach the star ledger', async kind => {
  const extra = kind === 'purpose' ? { purpose: 'task_attachment' } : kind === 'child'
    ? { childId: sibling.id } : { status: 'deleted', deletedAt: new Date() };
  const body = command([await media(extra)]);
  fail(await complete(body), 404, 'RESOURCE_NOT_FOUND'); expect((await operation(body)).phase).toBe('FAILED');
  expect((await RemoteOperation.findOne().lean()).state).toBe('ABORTED');
  fail(await confirm(0), 409, 'TASK_STATE_CONFLICT');
  expect((await row()).status).toBe('pending'); expect(await Reference.countDocuments({ state: 'bound' })).toBe(0);
  expect(starCalls).toHaveLength(0); expect(await Ledger.countDocuments()).toBe(0);
});

test.each(['complete', 'confirm'])('lost public %s response replays without rebinding images or duplicating stars', async action => {
  const body = command([await media()]);
  if (action === 'confirm') expect((await complete(body)).status).toBe(200);
  dropPublic = action;
  await expect(action === 'complete' ? complete(body) : confirm()).rejects.toMatchObject({ code: 'ECONNRESET' });
  expect(dropPublic).toBeNull(); const before = await row(), refs = await Reference.find().lean(), calls = mediaCalls.length;
  rebuild(); const replay = await (action === 'complete' ? complete(body) : confirm()); expect(replay.status).toBe(200);
  expect(await row()).toEqual(before); expect(await Reference.find().lean()).toEqual(refs); expect(mediaCalls).toHaveLength(calls);
  if (action === 'complete') expect((await confirm()).status).toBe(200);
  expect(starCalls).toHaveLength(1); await oneStar();
});

test('lost real star response resumes with a current coparent without rewriting images or first audit', async () => {
  const body = command([await media(), await media()]); expect((await complete(body)).status).toBe(200);
  const refs = await Reference.find().lean(), op = await operation(body), calls = mediaCalls.length;
  dropStar = true; fail(await confirm(1, second), 503, 'STAR_AWARD_PENDING'); expect(dropStar).toBe(false);
  const before = await row(), ledger = await oneStar(); expect(before.starAwardState).toBe('pending');
  await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: second.id } });
  fail(await confirm(1, second), 403, 'CHILD_ACCESS_DENIED');
  rebuild(); const accepted = await confirm(1, parent, 'do not overwrite'); expect(accepted.status).toBe(200);
  expect(accepted.data.data.starAward).toEqual({ awarded: false, ledgerEntryId: String(ledger._id), starBalance: 1 });
  expect(accepted.data.data.task).toMatchObject({ confirmedByParentId: second.id, confirmedAt: before.confirmedAt.toISOString(),
    parentFeedback: 'first audit', starAwardState: 'awarded', completionMediaIds: body.completionMediaIds });
  expect(await Reference.find().lean()).toEqual(refs); expect(await operation(body)).toEqual(op); expect(mediaCalls).toHaveLength(calls);
  expect(starCalls.map(c => c.confirmedByParentId)).toEqual([second.id, parent.id]); expect(await oneStar()).toEqual(ledger);
});

test('replacement rejects stale confirmation, confirms current version and cannot change confirmed evidence', async () => {
  const a = await media(), b = await media(); expect((await complete(command([a]))).status).toBe(200);
  const next = command([b], 1); expect((await complete(next)).status).toBe(200);
  fail(await confirm(1), 409, 'VERSION_CONFLICT'); expect(starCalls).toHaveLength(0);
  const read = await detail(parent); expect(read.status).toBe(200); expect(read.data.data.task.completionMediaIds).toEqual([b]);
  expect((await confirm(read.data.data.task.completionVersion)).status).toBe(200); const ledger = await oneStar();
  const before = await row(), refs = await Reference.find().lean(), calls = mediaCalls.length;
  fail(await complete(command([a], 2)), 409, 'TASK_STATE_CONFLICT');
  expect(await row()).toEqual(before); expect(await Reference.find().lean()).toEqual(refs);
  expect(mediaCalls).toHaveLength(calls); expect(starCalls).toHaveLength(1); expect(await oneStar()).toEqual(ledger);
});

test.each(['outsider', 'sibling', 'departed'])('%s cannot enter the composed pipeline or read completion images', async kind => {
  if (kind === 'departed') await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: second.id } });
  const identity = kind === 'outsider' ? outsider : kind === 'sibling' ? sibling : second;
  fail(await complete(command([await media()]), identity), 403, 'CHILD_ACCESS_DENIED');
  fail(await detail(identity), 403, 'CHILD_ACCESS_DENIED'); fail(await confirm(0, identity), 403, 'CHILD_ACCESS_DENIED');
  expect(mediaCalls).toHaveLength(0); expect(starCalls).toHaveLength(0);
  expect(await Operation.countDocuments()).toBe(0); expect(await Ledger.countDocuments()).toBe(0);
});

const editTask = (identity = parent) => send('PATCH', '', { title: 'Revised before completion' }, identity);
const removeTask = (identity = parent) => send('DELETE', '', undefined, identity);
const expectFirstAudit = value => {
  expect(String(value.confirmedByParentId)).toBe(second.id);
  expect(value.parentFeedback).toBe('first audit');
  expect(value.confirmedAt).toEqual(new Date(confirmationTime));
};
const providerSnapshot = async () => ({
  assets: await Asset.find().sort({ _id: 1 }).lean(),
  references: await Reference.find().sort({ _id: 1 }).lean(),
  remote: await RemoteOperation.find().sort({ _id: 1 }).lean(),
  local: await Operation.find().sort({ _id: 1 }).lean(),
  ledger: await Ledger.find().sort({ _id: 1 }).lean(),
  receipts: await Receipt.find().sort({ _id: 1 }).lean(),
  tombstones: await Tombstone.find().sort({ _id: 1 }).lean(),
  mediaCalls: mediaCalls.length, starCalls: starCalls.length
});
const replacement = async () => {
  const a = await media(), b = await media(), c = await media();
  const first = command([a, b]);
  const original = await complete(first); expect(original.status).toBe(200);
  return { a, b, c, first, original: original.data, old: await operation(first), next: command([b, c], 1) };
};
const exactReplacement = async ({ a, b, c, old, next }) => {
  const current = await operation(next);
  const refs = await Reference.find({ resourceId: task._id }).lean();
  expect(refs).toHaveLength(3);
  expect(refs.map(r => ({ mediaId: String(r.mediaId), state: r.state, operationId: r.operationId,
    familyId: String(r.familyId), childId: String(r.childId), field: r.field }))
    .sort((x, y) => x.mediaId.localeCompare(y.mediaId))).toEqual([
    { mediaId: a, state: 'released', operationId: old.remoteOperationId },
    { mediaId: b, state: 'bound', operationId: old.remoteOperationId },
    { mediaId: c, state: 'bound', operationId: current.remoteOperationId }
  ].map(r => ({ ...r, familyId: String(family._id), childId: child.id, field: 'completionMediaIds' }))
    .sort((x, y) => x.mediaId.localeCompare(y.mediaId)));
  expect((await row()).completionMediaBindings.map(r => ({ mediaId: String(r.mediaId), bindingOperationId: r.bindingOperationId })))
    .toEqual([{ mediaId: b, bindingOperationId: old.remoteOperationId }, { mediaId: c, bindingOperationId: current.remoteOperationId }]);
  expect(current.phase).toBe('SUCCEEDED');
  expect(await RemoteOperation.countDocuments({ state: 'COMMITTED' })).toBe(2);
};

test.each(['prepare', 'commit', 'unbind'])('mutation composition: lost %s blocks edit/archive without touching actual media recovery', async action => {
  const sequence = await replacement(); dropMedia = action;
  fail(await complete(sequence.next), 503, 'MEDIA_REFERENCE_PENDING'); expect(dropMedia).toBeNull();
  const before = await row(), op = await operation(sequence.next), snapshot = await providerSnapshot();
  expect(op.phase).toBe(action === 'unbind' ? 'PUBLISHED_CLEANUP' : 'PREPUBLISH');
  fail(await editTask(second), 503, 'MEDIA_REFERENCE_PENDING');
  fail(await removeTask(second), 503, 'MEDIA_REFERENCE_PENDING');
  const read = await detail(parent); expect(read.status).toBe(200); publicBody(read.data);
  expect(read.data.data.task.completionVersion).toBe(action === 'unbind' ? 2 : 1);
  expect(await row()).toEqual(before); expect(await providerSnapshot()).toEqual(snapshot);
  rebuild(); expect((await complete(sequence.next)).status).toBe(200);
  expect((await operation(sequence.next)).remoteOperationId).toBe(op.remoteOperationId);
  await exactReplacement(sequence);
  const stable = await row(), providers = await providerSnapshot();
  expect((await removeTask(second)).status).toBe(200); const archived = await row();
  expect(archived.status).toBe('archived'); expect(archived.completionVersion).toBe(2);
  expect(archived.completionEvidence).toEqual(stable.completionEvidence);
  expect(archived.completedAt).toEqual(stable.completedAt); expect(archived.activeCompletionOperation).toBeUndefined();
  expect(await providerSnapshot()).toEqual(providers); await exactReplacement(sequence);
  expect(await Ledger.countDocuments()).toBe(0);
});

test.each([false, true].flatMap(confirmed => [false, true].map(lost => [confirmed, lost])))('mutation composition: archive confirmed=%s lost-response=%s retains exact image generations and audit', async (confirmed, lost) => {
    const sequence = await replacement();
    const completed = await complete(sequence.next); expect(completed.status).toBe(200);
    if (confirmed) { expect((await confirm(2, second)).status).toBe(200); await oneStar(); }
    await exactReplacement(sequence);
    const before = await row(), snapshot = await providerSnapshot();
    if (confirmed) expectFirstAudit(before);
    confirmationTime += 1000;
    if (lost) {
      dropPublic = String(task._id);
      await expect(removeTask()).rejects.toMatchObject({ code: 'ECONNRESET' }); expect(dropPublic).toBeNull();
    } else {
      const result = await removeTask(); expect(result.status).toBe(200); publicBody(result.data);
      expect(result.data.data).toMatchObject({ deleted: false, task: { status: 'archived', completionMediaIds: [sequence.b, sequence.c] } });
    }
    const archived = await row(); expect(archived.status).toBe('archived');
    for (const field of ['completionEvidence', 'completionMediaBindings', 'completionVersion', 'completedAt',
      'confirmedByParentId', 'confirmedAt', 'parentFeedback', 'starAwardState']) expect(archived[field]).toEqual(before[field]);
    rebuild(); const replay = await removeTask(second); expect(replay.status).toBe(200); publicBody(replay.data);
    expect((await complete(sequence.first)).data).toEqual(sequence.original);
    expect((await complete(sequence.next)).data).toEqual(completed.data);
    fail(await editTask(), 409, 'TASK_STATE_CONFLICT'); fail(await confirm(2), 409, 'TASK_STATE_CONFLICT');
    const read = await detail(parent); expect(read.status).toBe(200); publicBody(read.data);
    expect(read.data.data.task).toMatchObject({ status: 'archived', completionVersion: 2, completionMediaIds: [sequence.b, sequence.c] });
    expect(await row()).toEqual(archived); expect(await providerSnapshot()).toEqual(snapshot);
    await exactReplacement(sequence); expect(await Task.countDocuments()).toBe(1);
    expect(await Ledger.countDocuments()).toBe(confirmed ? 1 : 0);
  });

test('mutation composition: lost star response blocks archive until coparent recovery and preserves first audit', async () => {
  const sequence = await replacement(); expect((await complete(sequence.next)).status).toBe(200);
  dropStar = true; fail(await confirm(2, second), 503, 'STAR_AWARD_PENDING'); expect(dropStar).toBe(false);
  const before = await row(), snapshot = await providerSnapshot(), ledger = await oneStar();
  expect(before.starAwardState).toBe('pending');
  expectFirstAudit(before); confirmationTime += 1000;
  fail(await removeTask(), 409, 'STAR_AWARD_PENDING');
  expect(await row()).toEqual(before); expect(await providerSnapshot()).toEqual(snapshot);
  await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: second.id } });
  fail(await removeTask(second), 403, 'CHILD_ACCESS_DENIED');
  rebuild(); expect((await confirm(2, parent, 'must not replace audit')).status).toBe(200);
  const settled = await providerSnapshot(); expect((await removeTask()).status).toBe(200);
  const archived = await row(); expect(archived.status).toBe('archived'); expect(archived.starAwardState).toBe('awarded');
  for (const field of ['confirmedByParentId', 'confirmedAt', 'parentFeedback', 'completedAt', 'completionVersion']) {
    expect(archived[field]).toEqual(before[field]);
  }
  expect(await providerSnapshot()).toEqual(settled); expect(await oneStar()).toEqual(ledger);
  expect(starCalls.map(c => c.confirmedByParentId)).toEqual([second.id, parent.id]);
  expect(settled.references).toEqual(snapshot.references); expect(settled.remote).toEqual(snapshot.remote);
  expect(settled.local).toEqual(snapshot.local); expect(settled.assets).toEqual(snapshot.assets);
  expect(settled.mediaCalls).toBe(snapshot.mediaCalls); await exactReplacement(sequence);
});

test('mutation composition: cancellation wins before a photo completion without creating any remote intent', async () => {
  const body = command([await media()]), snapshot = await providerSnapshot();
  expect((await removeTask()).status).toBe(200); const cancelled = await row();
  expect(cancelled.status).toBe('cancelled'); expect(cancelled.cancelledAt).toBeInstanceOf(Date);
  rebuild(); expect((await removeTask(second)).status).toBe(200);
  fail(await complete(body), 409, 'TASK_STATE_CONFLICT');
  expect(await row()).toEqual(cancelled); expect(await providerSnapshot()).toEqual(snapshot);
});

test('mutation composition: edit wins before photo completion and is preserved through confirmation and archive', async () => {
  expect((await editTask(second)).status).toBe(200);
  const body = command([await media()]); expect((await complete(body)).status).toBe(200);
  expect((await confirm(1, second)).status).toBe(200); await oneStar();
  const snapshot = await providerSnapshot(); expect((await removeTask()).status).toBe(200);
  const read = await detail(parent); expect(read.status).toBe(200);
  expect(read.data.data.task).toMatchObject({ title: 'Revised before completion', status: 'archived',
    completionMediaIds: body.completionMediaIds, completionVersion: 1, starAwardState: 'awarded' });
  expect(await providerSnapshot()).toEqual(snapshot);
});

test.each(['outsider', 'sibling', 'departed'])('mutation composition: %s cannot change a task with actual bound photos', async kind => {
  expect((await complete(command([await media()]))).status).toBe(200);
  if (kind === 'departed') await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: second.id } });
  const identity = kind === 'outsider' ? outsider : kind === 'sibling' ? sibling : second;
  const before = await row(), snapshot = await providerSnapshot();
  fail(await editTask(identity), 403, 'CHILD_ACCESS_DENIED'); fail(await removeTask(identity), 403, 'CHILD_ACCESS_DENIED');
  expect(await row()).toEqual(before); expect(await providerSnapshot()).toEqual(snapshot);
});

test.each(['prepare', 'commit'])('BSON reconstruction: lost %s recovers only the persisted remote mapping', async action => {
  const body = command([await media()]); dropMedia = action;
  fail(await complete(body), 503, 'MEDIA_REFERENCE_PENDING'); expect(dropMedia).toBeNull();
  const local = await operation(body), remote = await RemoteOperation.findOne().lean();
  expect(local.phase).toBe('PREPUBLISH');
  expect(remote.operationId).toBe(local.remoteOperationId);
  expect(remote.state).toBe(action === 'prepare' ? 'PREPARED' : 'COMMITTED');
  await reconstructSnapshot();
  expect(await operation(body)).toEqual(local); expect(await RemoteOperation.findOne().lean()).toEqual(remote);
  const before = await row(), providers = await providerSnapshot();
  expect((await detail()).status).toBe(200); fail(await confirm(0), 503, 'MEDIA_REFERENCE_PENDING');
  expect(await row()).toEqual(before); expect(await providerSnapshot()).toEqual(providers);
  const calls = mediaCalls.length;
  const result = await complete(JSON.parse(JSON.stringify(body))); expect(result.status).toBe(200); publicBody(result.data);
  expect(await operation(body)).toMatchObject({ remoteOperationId: local.remoteOperationId, phase: 'SUCCEEDED' });
  expect(mediaCalls.slice(calls).length).toBeGreaterThan(0);
  expect(mediaCalls.slice(calls).every(c => c.body.operationId === local.remoteOperationId)).toBe(true);
  expect(await Operation.countDocuments()).toBe(1); expect(await RemoteOperation.countDocuments()).toBe(1);
  expect(await Reference.findOne().lean()).toMatchObject({ state: 'bound', operationId: local.remoteOperationId });
  expect((await row()).completionVersion).toBe(1); expect((await row()).activeCompletionOperation).toBeUndefined();
  expect((await confirm()).status).toBe(200); await oneStar();
});

test.each(['remove-all', 'mixed'].flatMap(kind => ['before', 'after'].map(stage => [kind, stage])))('BSON reconstruction: %s cleanup interrupted %s unbind retains publication and exact old generation', async (kind, stage) => {
  const sequence = await replacement();
  if (kind === 'remove-all') sequence.next = command([], 1);
  if (stage === 'before') blockMedia = 'unbind'; else dropMedia = 'unbind';
  fail(await complete(sequence.next), 503, 'MEDIA_REFERENCE_PENDING');
  expect(dropMedia).toBeNull(); expect(blockMedia).toBeNull();
  const local = await operation(sequence.next), published = await row();
  expect(local.phase).toBe('PUBLISHED_CLEANUP'); expect(published.completionVersion).toBe(2);
  const refs = await Reference.find().sort({ _id: 1 }).lean();
  const oldCall = mediaCalls.find(c => c.action === 'unbind');
  expect(oldCall.body.operationId).toBe(local.remoteOperationId);
  expect(oldCall.body.references.map(r => r.bindingOperationId)).toEqual(
    Array(kind === 'mixed' ? 1 : 2).fill(sequence.old.remoteOperationId));
  await reconstructSnapshot();
  const calls = mediaCalls.length;
  const beforeRead = await row(), providersBeforeRead = await providerSnapshot();
  const read = await detail(parent); expect(read.status).toBe(200); publicBody(read.data);
  expect(read.data.data.task).toMatchObject({ status: 'completed', completionVersion: 2,
    completionMediaIds: kind === 'mixed' ? [sequence.b, sequence.c] : [], completionMediaReferenceState: 'pending_recovery' });
  expect(await row()).toEqual(beforeRead); expect(await providerSnapshot()).toEqual(providersBeforeRead);
  fail(await confirm(2), 503, 'MEDIA_REFERENCE_PENDING');
  expect(mediaCalls).toHaveLength(calls); expect(starCalls).toHaveLength(0);
  expect((await complete(sequence.next)).status).toBe(200);
  expect(mediaCalls.slice(calls).map(c => c.action)).toEqual(stage === 'before' ? ['status', 'unbind'] : ['status']);
  expect(mediaCalls[calls].body.mode).toBe('references');
  expect(mediaCalls[calls].body.references).toEqual(oldCall.body.references.map(({ mediaId, field }) => ({ mediaId, field })));
  if (stage === 'before') expect(mediaCalls[calls + 1].body).toEqual(oldCall.body);
  else expect(await Reference.find().sort({ _id: 1 }).lean()).toEqual(refs);
  expect(await operation(sequence.next)).toMatchObject({ phase: 'SUCCEEDED', remoteOperationId: local.remoteOperationId });
  const settled = await row(); expect(settled.completedAt).toEqual(published.completedAt);
  expect(settled.completionVersion).toBe(2); expect(settled.activeCompletionOperation).toBeUndefined();
  if (kind === 'mixed') await exactReplacement(sequence);
  else {
    expect(settled.completionMediaBindings).toEqual([]); expect(await RemoteOperation.countDocuments()).toBe(1);
    const finalRefs = await Reference.find().lean(); expect(finalRefs).toHaveLength(2);
    expect(finalRefs.every(r => r.state === 'released' && r.operationId === sequence.old.remoteOperationId)).toBe(true);
  }
  expect((await confirm(2)).status).toBe(200); await oneStar();
});

test.each(['COMMITTED', 'ABORTED'])('BSON reconstruction: historical %s and a second actor sharing UUID stay independent', async terminal => {
  const first = command([await media(terminal === 'ABORTED' ? { purpose: 'task_attachment' } : {})]);
  const original = await complete(first, child);
  if (terminal === 'ABORTED') fail(original, 404, 'RESOURCE_NOT_FOUND'); else expect(original.status).toBe(200);
  const old = await Operation.findOne({ actorId: child.id }).lean();
  const oldRemote = await RemoteOperation.findOne({ operationId: old.remoteOperationId }).lean();
  expect(oldRemote.state).toBe(terminal);
  const next = { ...command([await media()], terminal === 'COMMITTED' ? 1 : 0), operationId: first.operationId };
  await reconstructSnapshot();
  const result = await complete(next, parent); expect(result.status).toBe(200);
  const current = await Operation.findOne({ actorId: parent.id }).lean();
  expect(current.remoteOperationId).not.toBe(old.remoteOperationId);
  const oldAfter = await RemoteOperation.findOne({ operationId: old.remoteOperationId }).lean();
  if (terminal === 'ABORTED') expect(oldAfter).toEqual(oldRemote);
  else {
    const { version, updatedAt: _updatedAt, ...facts } = oldRemote;
    expect(oldAfter).toMatchObject({ ...facts, version: version + 1 });
    expect(await Reference.findOne({ mediaId: first.completionMediaIds[0] }).lean()).toMatchObject({
      state: 'released', operationId: old.remoteOperationId, releaseOperationId: current.remoteOperationId });
  }
  expect(await Operation.countDocuments()).toBe(2); expect(await RemoteOperation.countDocuments()).toBe(2);
  await reconstructSnapshot();
  const before = await row(), providers = await providerSnapshot();
  const replay = await complete(first, child); expect(replay.status).toBe(original.status);
  if (terminal === 'COMMITTED') expect(replay.data).toEqual(original.data);
  else fail(replay, 404, 'RESOURCE_NOT_FOUND');
  expect((await complete(next, parent)).data).toEqual(result.data);
  expect(await row()).toEqual(before); expect(await providerSnapshot()).toEqual(providers);
  expect((await confirm(terminal === 'COMMITTED' ? 2 : 1, second)).status).toBe(200); await oneStar();
});

test('BSON reconstruction: pending real star award resumes once and preserves first confirmation audit', async () => {
  const body = command([await media()]); expect((await complete(body)).status).toBe(200);
  dropStar = true; fail(await confirm(1, second), 503, 'STAR_AWARD_PENDING'); expect(dropStar).toBe(false);
  const before = await row(), ledger = await oneStar(); expectFirstAudit(before);
  await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: second.id } });
  confirmationTime += 1000;
  await reconstructSnapshot();
  const providers = await providerSnapshot();
  const read = await detail(parent); expect(read.status).toBe(200); publicBody(read.data);
  expect(read.data.data.task).toMatchObject({ status: 'confirmed', completionVersion: 1, starAwardState: 'pending',
    confirmedByParentId: second.id, confirmedAt: before.confirmedAt.toISOString(), parentFeedback: 'first audit' });
  expect(await row()).toEqual(before); expect(await providerSnapshot()).toEqual(providers);
  fail(await confirm(1, second), 403, 'CHILD_ACCESS_DENIED');
  expect(await providerSnapshot()).toEqual(providers);
  const result = await confirm(1, parent, 'must preserve original'); expect(result.status).toBe(200);
  expect(result.data.data.starAward).toEqual({ awarded: false, ledgerEntryId: String(ledger._id), starBalance: 1 });
  const recovered = await row();
  for (const key of ['confirmedAt', 'confirmedByParentId', 'parentFeedback', 'completedAt', 'completionVersion']) {
    expect(recovered[key]).toEqual(before[key]);
  }
  expect(recovered.starAwardState).toBe('awarded'); expect(await oneStar()).toEqual(ledger);
  const after = await providerSnapshot();
  for (const key of ['references', 'remote', 'local', 'assets', 'mediaCalls']) expect(after[key]).toEqual(providers[key]);
  confirmationTime += 1000;
  await reconstructSnapshot();
  const calls = starCalls.length; expect((await confirm(1, parent, 'must not replace awarded audit')).status).toBe(200);
  expect(await row()).toEqual(recovered);
  expect(starCalls).toHaveLength(calls); expect(await oneStar()).toEqual(ledger);
});

test('BSON reconstruction: missing persisted mapping blocks recovery without remote calls or lock clearing', async () => {
  const body = command([await media()]); dropMedia = 'commit';
  fail(await complete(body), 503, 'MEDIA_REFERENCE_PENDING');
  const local = await operation(body);
  await Operation.collection.updateOne({ _id: local._id }, { $unset: { remoteOperationId: '' } });
  await reconstructSnapshot();
  const before = await row(), providers = await providerSnapshot();
  fail(await complete(body), 503, 'MEDIA_REFERENCE_PENDING');
  expect(await row()).toEqual(before); expect(await providerSnapshot()).toEqual(providers);
  expect((await row()).activeCompletionOperation).toBeDefined(); expect(await Ledger.countDocuments()).toBe(0);
});

test('BSON reconstruction: elapsed lease aborts original mapping without renewal or new bindings', async () => {
  const body = command([await media()]); dropMedia = 'prepare';
  fail(await complete(body), 503, 'MEDIA_REFERENCE_PENDING');
  const local = await operation(body), remote = await RemoteOperation.findOne().lean();
  expect(remote.state).toBe('PREPARED');
  resourceTime = remote.leaseExpiresAt.getTime();
  await reconstructSnapshot();
  expect(await RemoteOperation.findOne().lean()).toEqual(remote);
  const before = await row(), providers = await providerSnapshot();
  expect((await detail(parent)).status).toBe(200);
  expect(await row()).toEqual(before); expect(await providerSnapshot()).toEqual(providers);
  const calls = mediaCalls.length;
  fail(await complete(body), 409, 'MEDIA_OPERATION_EXPIRED');
  expect(mediaCalls.slice(calls).map(c => c.action)).toEqual(['status', 'abort']);
  expect(mediaCalls.slice(calls).every(c => c.body.operationId === local.remoteOperationId)).toBe(true);
  const terminal = await RemoteOperation.findOne().lean();
  expect(terminal).toMatchObject({ operationId: local.remoteOperationId, state: 'ABORTED', failureCode: 'MEDIA_OPERATION_EXPIRED',
    leaseExpiresAt: null, terminalAt: remote.leaseExpiresAt });
  expect(await operation(body)).toMatchObject({ remoteOperationId: local.remoteOperationId, phase: 'FAILED' });
  expect((await row()).completionVersion ?? 0).toBe(0); expect((await row()).activeCompletionOperation).toBeUndefined();
  expect(await Reference.countDocuments({ state: 'bound' })).toBe(0);
  const released = await Reference.find().lean(); expect(released).toHaveLength(1);
  expect(released[0]).toMatchObject({ mediaId: new mongoose.Types.ObjectId(body.completionMediaIds[0]),
    state: 'released', operationId: local.remoteOperationId, releaseOperationId: local.remoteOperationId,
    leaseExpiresAt: null, releasedAt: remote.leaseExpiresAt });
  expect(await Operation.countDocuments()).toBe(1); expect(await RemoteOperation.countDocuments()).toBe(1);
  await reconstructSnapshot();
  const failed = await row(), snapshot = await providerSnapshot();
  fail(await complete(body), 409, 'MEDIA_OPERATION_EXPIRED');
  expect(await row()).toEqual(failed); expect(await providerSnapshot()).toEqual(snapshot);
});

const interruptedPrivacyCompletion = async state => {
  resourceTime = Date.now();
  const ids = [await storedMedia(), await storedMedia()], body = command(ids);
  dropMedia = state === 'PREPARED' ? 'prepare' : 'commit';
  fail(await complete(body), 503, 'MEDIA_REFERENCE_PENDING'); expect(dropMedia).toBeNull();
  const local = await operation(body), remote = await RemoteOperation.findOne().lean();
  expect(remote).toMatchObject({ operationId: local.remoteOperationId, state });
  return { ids, body, local, remote, asset: await Asset.findById(ids[0]).lean() };
};

test.each(['PREPARED', 'COMMITTED'].flatMap(state => ['rollback', 'lost-ack'].map(fault => [state, fault])))('BSON recovery before cleanup retry: %s with %s preserves business and media baselines', async (state, fault) => {
  const { ids, body, local, asset } = await interruptedPrivacyCompletion(state);
  expect((await deleteMedia(ids[0])).status).toBe(204);
  const facts = await deletionFacts(ids[0]), text = await journalText(ids[0]);
  const remote = await RemoteOperation.findOne().lean();
  const siblingAsset = await Asset.findById(ids[1]).lean(), siblingBytes = await store.read(siblingAsset.storageKey);
  const deletedAsset = await Asset.findById(ids[0]).lean(), refs = await Reference.find().sort({ _id: 1 }).lean();
  resourceTime += RETENTION; cleanupCommitFault = fault;
  await expect(cleanup.cleanupDeletedMedia()).rejects.toThrow(fault === 'rollback'
    ? 'Synthetic cleanup metadata rollback' : 'Synthetic cleanup metadata acknowledgement lost');
  expect(cleanupCommitFault).toBeNull();
  expect(cleanupFaultWitness).toEqual({ fault, assets: 0, references: state === 'PREPARED' ? 1 : 0 });
  expect(removals).toEqual([{ key: asset.storageKey, removed: true }]);
  await reconstructSnapshot();
  if (fault === 'rollback') {
    expect(await Asset.findById(ids[0]).lean()).toEqual(deletedAsset);
    expect(await Reference.find().sort({ _id: 1 }).lean()).toEqual(refs);
  } else {
    expect(await Asset.findById(ids[0])).toBeNull();
    expect(await Reference.countDocuments({ mediaId: ids[0] })).toBe(0);
  }
  const mediaBefore = { assets: await Asset.find().sort({ _id: 1 }).lean(),
    references: await Reference.find().sort({ _id: 1 }).lean() };
  const before = await row(), providers = await providerSnapshot();
  expect((await detail()).status).toBe(200);
  expect(await row()).toEqual(before); expect(await providerSnapshot()).toEqual(providers);
  const calls = mediaCalls.length, result = await complete(body);
  expect(mediaCalls.slice(calls)).toHaveLength(1);
  expect(mediaCalls[calls]).toMatchObject({ action: 'status', body: {
    operationId: local.remoteOperationId, commandHash: local.commandHash,
    references: ids.map(mediaId => ({ mediaId, field: 'completionMediaIds' })) } });
  if (state === 'COMMITTED') {
    expect(result.status).toBe(200); publicBody(result.data);
    expect(result.data.data.task).toMatchObject({ completionVersion: 1, completionMediaIds: ids });
    const expectCompletionPreserved = async status => {
      const persisted = await row();
      expect(persisted).toMatchObject({ status, completionVersion: 1 });
      expect(persisted.completionEvidence.completionMediaIds.map(String)).toEqual(ids);
      expect(persisted.completionMediaBindings.map(r => ({ mediaId: String(r.mediaId), bindingOperationId: r.bindingOperationId })))
        .toEqual(ids.map(mediaId => ({ mediaId, bindingOperationId: local.remoteOperationId })));
    };
    await expectCompletionPreserved('completed');
    expect((await confirm(1, second)).status).toBe(200); await oneStar();
    await expectCompletionPreserved('confirmed');
    expect(await row()).toMatchObject({ confirmedByParentId: new mongoose.Types.ObjectId(second.id),
      confirmedAt: new Date(confirmationTime), parentFeedback: 'first audit', starAwardState: 'awarded' });
  } else {
    fail(result, 404, 'RESOURCE_NOT_FOUND');
    expect((await row()).completionVersion ?? 0).toBe(0);
    fail(await confirm(0), 409, 'TASK_STATE_CONFLICT'); expect(starCalls).toHaveLength(0);
    expect(await Ledger.countDocuments()).toBe(0);
  }
  expect((await row()).activeCompletionOperation).toBeUndefined();
  expect(await operation(body)).toMatchObject({ remoteOperationId: local.remoteOperationId,
    phase: state === 'COMMITTED' ? 'SUCCEEDED' : 'FAILED' });
  expect(await Asset.find().sort({ _id: 1 }).lean()).toEqual(mediaBefore.assets);
  expect(await Reference.find().sort({ _id: 1 }).lean()).toEqual(mediaBefore.references);
  await expect(store.read(asset.storageKey)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  expect(await store.read(siblingAsset.storageKey)).toEqual(siblingBytes);
  const settled = await row(), settledOperation = await operation(body), ledger = await Ledger.find().lean();
  const expectBusinessPreserved = async () => {
    expect(await row()).toEqual(settled); expect(await operation(body)).toEqual(settledOperation);
    expect(await RemoteOperation.findOne().lean()).toEqual(remote); expect(await Ledger.find().lean()).toEqual(ledger);
    expect(await deletionFacts(ids[0])).toEqual(facts); expect(await journalText(ids[0])).toBe(text);
  };
  await expectBusinessPreserved();
  resourceTime += 1000; confirmationTime += 1000;
  expect((await deleteMedia(ids[0], second)).status).toBe(204);
  await expectBusinessPreserved();
  expect(await cleanup.cleanupDeletedMedia()).toEqual(fault === 'rollback'
    ? { cleaned: 1, mediaIds: [ids[0]] } : { cleaned: 0, mediaIds: [] });
  expect(removals).toEqual([{ key: asset.storageKey, removed: true },
    ...(fault === 'rollback' ? [{ key: asset.storageKey, removed: false }] : [])]);
  expect(await cleanup.cleanupDeletedMedia()).toEqual({ cleaned: 0, mediaIds: [] });
  await expectBusinessPreserved();
  expect(await Asset.findById(ids[0])).toBeNull(); expect(await Reference.countDocuments({ mediaId: ids[0] })).toBe(0);
  expect(await Asset.findById(ids[1]).lean()).toEqual(siblingAsset);
  expect(await Reference.find().sort({ _id: 1 }).lean()).toEqual(refs.filter(r => String(r.mediaId) !== ids[0]));
  await reconstructSnapshot();
  const final = await providerSnapshot();
  const replay = await complete(body); expect(replay.status).toBe(result.status); expect(replay.data).toEqual(result.data);
  if (state === 'COMMITTED') expect((await confirm(1, parent, 'ignored')).status).toBe(200);
  else fail(await confirm(0), 409, 'TASK_STATE_CONFLICT');
  expect(await providerSnapshot()).toEqual(final); await expectBusinessPreserved();
  await expect(store.read(asset.storageKey)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  expect(await store.read(siblingAsset.storageKey)).toEqual(siblingBytes);
});

test.each([false, true])('BSON privacy: COMMITTED deletion recovers with exact proof after cleanup=%s', async cleaned => {
  const { ids, body, local, remote, asset } = await interruptedPrivacyCompletion('COMMITTED');
  dropDelete = true;
  await expect(deleteMedia(ids[0])).rejects.toMatchObject({ code: 'ECONNRESET' }); expect(dropDelete).toBe(false);
  const facts = await deletionFacts(ids[0]), text = await journalText(ids[0]);
  expect(facts.tombstone).toMatchObject({ actorId: new mongoose.Types.ObjectId(parent.id), deletedAt: new Date(resourceTime) });
  expect(facts.receipts).toHaveLength(1);
  expect(facts.receipts[0]).toMatchObject({ mediaId: asset._id, familyId: family._id,
    childId: new mongoose.Types.ObjectId(child.id), resourceId: task._id, field: 'completionMediaIds',
    bindingOperationId: local.remoteOperationId, releasedAt: facts.tombstone.deletedAt });
  expect(JSON.parse(text).receipts[0].bindingOperationId).toBe(local.remoteOperationId);
  expect(text).not.toContain(asset.storageKey);
  resourceTime += RETENTION - 1;
  await reconstructSnapshot();
  expect(await cleanup.cleanupDeletedMedia()).toEqual({ cleaned: 0, mediaIds: [] });
  expect((await store.read(asset.storageKey)).length).toBeGreaterThan(0);
  if (cleaned) {
    resourceTime += 1;
    expect(await cleanup.cleanupDeletedMedia()).toEqual({ cleaned: 1, mediaIds: [ids[0]] });
    await reconstructSnapshot();
    expect(await Asset.findById(ids[0])).toBeNull(); expect(await Reference.countDocuments({ mediaId: ids[0] })).toBe(0);
    await expect(store.read(asset.storageKey)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  } else expect((await Asset.findById(ids[0])).status).toBe('deleted');
  const before = await row(), providers = await providerSnapshot();
  expect((await detail()).status).toBe(200);
  expect(await row()).toEqual(before); expect(await providerSnapshot()).toEqual(providers);
  const calls = mediaCalls.length;
  expect((await complete(body)).status).toBe(200);
  expect(mediaCalls.slice(calls).map(c => c.action)).toEqual(['status']);
  expect(mediaCalls[calls].body).toMatchObject({ operationId: local.remoteOperationId, commandHash: local.commandHash,
    references: ids.map(mediaId => ({ mediaId, field: 'completionMediaIds' })) });
  expect(await operation(body)).toMatchObject({ remoteOperationId: local.remoteOperationId, phase: 'SUCCEEDED' });
  expect(await RemoteOperation.findOne().lean()).toMatchObject({ state: 'COMMITTED', terminalAt: remote.terminalAt });
  expect(await Reference.findOne({ mediaId: ids[1] }).lean()).toMatchObject({ state: 'bound', operationId: local.remoteOperationId });
  const published = await row(); expect(published.completionVersion).toBe(1);
  expect(published.activeCompletionOperation).toBeUndefined();
  expect(published.completionEvidence.completionMediaIds.map(String)).toEqual(ids);
  expect(published.completionMediaBindings.map(r => ({ mediaId: String(r.mediaId), bindingOperationId: r.bindingOperationId })))
    .toEqual(ids.map(mediaId => ({ mediaId, bindingOperationId: local.remoteOperationId })));
  if (cleaned) {
    expect(await Asset.findById(ids[0])).toBeNull(); expect(await Reference.countDocuments({ mediaId: ids[0] })).toBe(0);
    await expect(store.read(asset.storageKey)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  } else {
    expect((await Asset.findById(ids[0])).status).toBe('deleted');
    expect(await Reference.findOne({ mediaId: ids[0] }).lean()).toMatchObject({ state: 'released', operationId: local.remoteOperationId });
    expect((await store.read(asset.storageKey)).length).toBeGreaterThan(0);
  }
  const proof = await deletionFacts(ids[0]); expect(proof).toEqual(facts);
  expect((await deleteMedia(ids[0], second)).status).toBe(204);
  expect(await deletionFacts(ids[0])).toEqual(facts); expect(await journalText(ids[0])).toBe(text);
  expect((await confirm(1, second)).status).toBe(200); const ledger = await oneStar();
  const confirmed = await row();
  await reconstructSnapshot();
  const final = await providerSnapshot();
  expect((await complete(body)).status).toBe(200); expect((await confirm(1, parent, 'ignored')).status).toBe(200);
  expect(await row()).toEqual(confirmed); expect(await providerSnapshot()).toEqual(final); expect(await oneStar()).toEqual(ledger);
  expect(await deletionFacts(ids[0])).toEqual(facts); expect(await journalText(ids[0])).toBe(text);
});

test.each([false, true])('BSON privacy: PREPARED group remains aborted after cleanup=%s', async cleaned => {
  const { ids, body, local, asset } = await interruptedPrivacyCompletion('PREPARED');
  expect((await deleteMedia(ids[0])).status).toBe(204);
  const facts = await deletionFacts(ids[0]), text = await journalText(ids[0]);
  expect(facts.receipts).toEqual([]);
  const terminal = await RemoteOperation.findOne().lean();
  expect(terminal).toMatchObject({ state: 'ABORTED', failureCode: 'RESOURCE_NOT_FOUND' });
  const released = await Reference.find().lean(); expect(released).toHaveLength(2);
  expect(released.every(r => r.state === 'released' && r.operationId === local.remoteOperationId)).toBe(true);
  resourceTime += RETENTION;
  if (cleaned) expect(await cleanup.cleanupDeletedMedia()).toEqual({ cleaned: 1, mediaIds: [ids[0]] });
  await reconstructSnapshot();
  const calls = mediaCalls.length;
  fail(await complete(body), 404, 'RESOURCE_NOT_FOUND');
  expect(mediaCalls.slice(calls).map(c => c.action)).toEqual(['status']);
  expect(await operation(body)).toMatchObject({ phase: 'FAILED', remoteOperationId: local.remoteOperationId });
  expect(await RemoteOperation.findOne().lean()).toEqual(terminal);
  expect(await Reference.countDocuments({ state: { $in: ['prepared', 'bound'] } })).toBe(0);
  expect((await Asset.findById(ids[1])).status).toBe('active');
  const siblingAsset = await Asset.findById(ids[1]); expect((await store.read(siblingAsset.storageKey)).length).toBeGreaterThan(0);
  if (cleaned) await expect(store.read(asset.storageKey)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  else expect((await store.read(asset.storageKey)).length).toBeGreaterThan(0);
  const failed = await row(); expect(failed.completionVersion ?? 0).toBe(0);
  expect(failed.activeCompletionOperation).toBeUndefined(); expect(failed.status).toBe('pending');
  fail(await confirm(0), 409, 'TASK_STATE_CONFLICT'); expect(starCalls).toHaveLength(0);
  await reconstructSnapshot();
  const providers = await providerSnapshot();
  fail(await complete(body), 404, 'RESOURCE_NOT_FOUND'); expect(await row()).toEqual(failed);
  expect(await providerSnapshot()).toEqual(providers); expect(await Ledger.countDocuments()).toBe(0);
  expect(await deletionFacts(ids[0])).toEqual(facts); expect(await journalText(ids[0])).toBe(text);
});

test.each(['missing', 'wrong-generation'])('BSON privacy: %s receipt cannot authorize COMMITTED recovery after cleanup', async corruption => {
  const { ids, body } = await interruptedPrivacyCompletion('COMMITTED');
  expect((await deleteMedia(ids[0])).status).toBe(204); resourceTime += RETENTION;
  expect(await cleanup.cleanupDeletedMedia()).toEqual({ cleaned: 1, mediaIds: [ids[0]] });
  const original = await Receipt.collection.findOne({ mediaId: new mongoose.Types.ObjectId(ids[0]) });
  expect(original).not.toBeNull();
  if (corruption === 'missing') await Receipt.collection.deleteOne({ _id: original._id });
  else await Receipt.collection.updateOne({ _id: original._id }, { $set: { bindingOperationId: randomUUID() } });
  await reconstructSnapshot();
  const before = await row(), providers = await providerSnapshot(), calls = mediaCalls.length;
  fail(await complete(body), 503, 'MEDIA_REFERENCE_PENDING');
  expect(mediaCalls.slice(calls).map(c => c.action)).toEqual(['status']);
  expect(await row()).toEqual(before);
  expect(await providerSnapshot()).toEqual({ ...providers, mediaCalls: calls + 1 });
  expect((await row()).activeCompletionOperation).toBeDefined(); expect(await Ledger.countDocuments()).toBe(0);
  // Repair only the deliberately corrupted synthetic receipt, then prove recovery is not permanently stuck.
  await Receipt.collection.replaceOne({ _id: original._id }, original, { upsert: true });
  await reconstructSnapshot();
  expect((await complete(body)).status).toBe(200); expect((await confirm()).status).toBe(200); await oneStar();
  expect(await Asset.findById(ids[0])).toBeNull(); expect(await Reference.countDocuments({ mediaId: ids[0] })).toBe(0);
});

test.each(['journal', 'remove'])('BSON privacy: %s failure retains evidence and retries cleanup after reconstruction', async fault => {
  const { ids, body, asset } = await interruptedPrivacyCompletion('COMMITTED');
  journalFails = fault === 'journal';
  const deletion = await deleteMedia(ids[0]);
  if (journalFails) fail(deletion, 503, 'MEDIA_REFERENCE_PENDING'); else expect(deletion.status).toBe(204);
  const facts = await deletionFacts(ids[0]); expect(facts.receipts).toHaveLength(1);
  if (journalFails) await expect(journalText(ids[0])).rejects.toMatchObject({ code: 'ENOENT' });
  resourceTime += RETENTION; removeFails = fault === 'remove';
  await reconstructSnapshot();
  const before = await providerSnapshot();
  await expect(cleanup.cleanupDeletedMedia()).rejects.toThrow(fault === 'journal'
    ? 'Synthetic journal unavailable' : 'Synthetic media removal unavailable');
  expect(await providerSnapshot()).toEqual(before);
  expect((await store.read(asset.storageKey)).length).toBeGreaterThan(0);
  if (journalFails) await expect(journalText(ids[0])).rejects.toMatchObject({ code: 'ENOENT' });
  else expect(JSON.parse(await journalText(ids[0])).tombstone.actorId).toBe(parent.id);
  journalFails = false; removeFails = false;
  await reconstructSnapshot();
  expect((await deleteMedia(ids[0], second)).status).toBe(204);
  const text = await journalText(ids[0]); expect(JSON.parse(text).tombstone.actorId).toBe(parent.id);
  expect(await deletionFacts(ids[0])).toEqual(facts);
  expect(await cleanup.cleanupDeletedMedia()).toEqual({ cleaned: 1, mediaIds: [ids[0]] });
  expect(await cleanup.cleanupDeletedMedia()).toEqual({ cleaned: 0, mediaIds: [] });
  await reconstructSnapshot();
  expect((await complete(body)).status).toBe(200); expect((await confirm()).status).toBe(200); await oneStar();
  expect(await deletionFacts(ids[0])).toEqual(facts); expect(await journalText(ids[0])).toBe(text);
  expect(await Asset.findById(ids[0])).toBeNull(); expect(await Reference.countDocuments({ mediaId: ids[0] })).toBe(0);
  await expect(store.read(asset.storageKey)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
});

test.each(['PREPARED', 'COMMITTED'].flatMap(state => ['rollback', 'lost-ack'].map(fault => [state, fault])))('BSON cleanup commit: %s with %s preserves proofs and converges after physical removal', async (state, fault) => {
  const { ids, body, local, asset } = await interruptedPrivacyCompletion(state);
  expect((await deleteMedia(ids[0])).status).toBe(204);
  const facts = await deletionFacts(ids[0]), text = await journalText(ids[0]);
  const before = await row(), localBefore = await operation(body), remote = await RemoteOperation.findOne().lean();
  const deletedAsset = await Asset.findById(ids[0]).lean(), refs = await Reference.find().sort({ _id: 1 }).lean();
  const siblingAsset = await Asset.findById(ids[1]).lean(), siblingBytes = await store.read(siblingAsset.storageKey);
  expect(facts.receipts).toHaveLength(state === 'COMMITTED' ? 1 : 0);
  resourceTime += RETENTION; cleanupCommitFault = fault;
  await expect(cleanup.cleanupDeletedMedia()).rejects.toThrow(fault === 'rollback'
    ? 'Synthetic cleanup metadata rollback' : 'Synthetic cleanup metadata acknowledgement lost');
  expect(cleanupCommitFault).toBeNull();
  expect(cleanupFaultWitness).toEqual({ fault, assets: 0, references: state === 'PREPARED' ? 1 : 0 });
  expect(removals).toEqual([{ key: asset.storageKey, removed: true }]);
  await expect(store.read(asset.storageKey)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  if (fault === 'rollback') {
    expect(await Asset.findById(ids[0]).lean()).toEqual(deletedAsset);
    expect(await Reference.find().sort({ _id: 1 }).lean()).toEqual(refs);
  } else {
    expect(await Asset.findById(ids[0])).toBeNull();
    expect(await Reference.countDocuments({ mediaId: ids[0] })).toBe(0);
  }
  expect(await deletionFacts(ids[0])).toEqual(facts); expect(await journalText(ids[0])).toBe(text);
  expect(await RemoteOperation.findOne().lean()).toEqual(remote);
  expect(await row()).toEqual(before); expect(await operation(body)).toEqual(localBefore);
  await reconstructSnapshot();
  const providers = await providerSnapshot();
  expect((await detail()).status).toBe(200); expect(await row()).toEqual(before);
  expect(await providerSnapshot()).toEqual(providers);
  resourceTime += 1000;
  expect((await deleteMedia(ids[0], second)).status).toBe(204);
  expect(await deletionFacts(ids[0])).toEqual(facts); expect(await journalText(ids[0])).toBe(text);
  expect(await cleanup.cleanupDeletedMedia()).toEqual(fault === 'rollback'
    ? { cleaned: 1, mediaIds: [ids[0]] } : { cleaned: 0, mediaIds: [] });
  expect(removals).toEqual([{ key: asset.storageKey, removed: true },
    ...(fault === 'rollback' ? [{ key: asset.storageKey, removed: false }] : [])]);
  expect(await cleanup.cleanupDeletedMedia()).toEqual({ cleaned: 0, mediaIds: [] });
  expect(await Asset.findById(ids[0])).toBeNull(); expect(await Reference.countDocuments({ mediaId: ids[0] })).toBe(0);
  expect(await Asset.findById(ids[1]).lean()).toEqual(siblingAsset);
  expect(await store.read(siblingAsset.storageKey)).toEqual(siblingBytes);
  await reconstructSnapshot();
  const mediaBaseline = { assets: await Asset.find().sort({ _id: 1 }).lean(),
    references: await Reference.find().sort({ _id: 1 }).lean() };
  const expectMediaPreserved = async () => {
    expect(await Asset.find().sort({ _id: 1 }).lean()).toEqual(mediaBaseline.assets);
    expect(await Reference.find().sort({ _id: 1 }).lean()).toEqual(mediaBaseline.references);
    await expect(store.read(asset.storageKey)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    expect(await store.read(siblingAsset.storageKey)).toEqual(siblingBytes);
  };
  const calls = mediaCalls.length;
  const result = await complete(body);
  expect(mediaCalls.slice(calls).map(c => c.action)).toEqual(['status']);
  expect(mediaCalls[calls].body).toMatchObject({ operationId: local.remoteOperationId, commandHash: local.commandHash });
  if (state === 'COMMITTED') {
    expect(result.status).toBe(200);
    expect(result.data.data.task).toMatchObject({ completionVersion: 1, completionMediaIds: ids });
    expect((await confirm(1, second)).status).toBe(200); await oneStar();
  } else {
    fail(result, 404, 'RESOURCE_NOT_FOUND');
    expect((await row()).completionVersion ?? 0).toBe(0);
    fail(await confirm(0), 409, 'TASK_STATE_CONFLICT'); expect(await Ledger.countDocuments()).toBe(0);
  }
  expect((await row()).activeCompletionOperation).toBeUndefined();
  expect(await operation(body)).toMatchObject({ remoteOperationId: local.remoteOperationId,
    phase: state === 'COMMITTED' ? 'SUCCEEDED' : 'FAILED' });
  expect(await RemoteOperation.findOne().lean()).toEqual(remote);
  expect(await deletionFacts(ids[0])).toEqual(facts); expect(await journalText(ids[0])).toBe(text);
  await expectMediaPreserved();
  const settled = await row(), final = await providerSnapshot();
  await reconstructSnapshot();
  const replay = await complete(body); expect(replay.status).toBe(result.status); expect(replay.data).toEqual(result.data);
  if (state === 'COMMITTED') expect((await confirm(1, parent, 'ignored')).status).toBe(200);
  expect(await row()).toEqual(settled); expect(await providerSnapshot()).toEqual(final);
  await expectMediaPreserved();
});

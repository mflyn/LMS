const mongoose = require('mongoose');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const { MongoMemoryReplSet } = require('../../../../node_modules/mongodb-memory-server');
const { createCompletionMediaReferenceClient } = require('../../../common/services/mediaReferenceClient');
const { createMediaReferenceOperationService } = require('../services/mediaReferenceOperationService');
const { createCompletionMediaPrivacyService } = require('../services/completionMediaPrivacyService');
const { createCompletionMediaCleanupService } = require('../services/completionMediaCleanupService');
const { createMediaDeletionJournal } = require('../services/mediaDeletionJournal');
const { createPrivateMediaStore } = require('../services/privateMediaStore');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const Asset = require('../models/MediaAsset');
const Reference = require('../models/MediaReference');
const Operation = require('../models/MediaReferenceOperation');
const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');
const Family = require('../../../common/models/Family');
const User = require('../models/FamilyUser');

jest.setTimeout(30000);
const id = () => new mongoose.Types.ObjectId();
const TOKEN = 'synthetic-contract-token-32-characters';
let mongo, root, runner, now, service, client, transport, family, child, parent, privacy, cleanup, store;
const fixture = async () => {
  const assets = [];
  for (let i = 0; i < 2; i += 1) {
    const stored = await store.writeCanonical(Buffer.from('synthetic-image'));
    assets.push(await Asset.create({ familyId: family._id, childId: child, uploadedBy: child,
      purpose: 'task_completion', mimeType: 'image/jpeg', sizeBytes: 15, storageKey: stored.storageKey }));
  }
  return { familyId: String(family._id), childId: String(child), resourceType: 'growth_task', resourceId: String(id()),
    remoteOperationId: randomUUID(), commandHash: 'a'.repeat(64), references: assets.map(a => ({ mediaId: String(a._id), field: 'completionMediaIds' })) };
};
const status = c => client.status({ ...c, mode: 'operation' });
const refStatus = c => {
  const { remoteOperationId: _remoteOperationId, commandHash: _commandHash, ...scope } = c;
  return client.status({ ...scope, mode: 'references' });
};
const removal = c => {
  const { commandHash: _commandHash, remoteOperationId, ...scope } = c;
  return { ...scope, remoteOperationId: randomUUID(),
    references: c.references.map(ref => ({ ...ref, bindingOperationId: remoteOperationId })) };
};

const ai2Fixture = async () => {
  const command = await fixture();
  await Asset.collection.updateMany({ _id: { $in: command.references.map(r => new mongoose.Types.ObjectId(r.mediaId)) } },
    { $set: { purpose: 'ai2_correction' } });
  return { ...command, resourceType: 'ai2_attempt',
    references: command.references.map(r => ({ ...r, field: 'correctionMediaIds' })) };
};

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri());
  for (const model of [Asset, Reference, Operation, Tombstone, Receipt, Family, User]) await model.init();
  runner = createMongoTransactionRunner(mongoose.connection);
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'completion-client-contract-'));
});
beforeEach(async () => {
  for (const model of [Asset, Reference, Operation, Tombstone, Receipt, Family, User]) await model.deleteMany({});
  await fs.rm(root, { recursive: true, force: true }); await fs.mkdir(root);
  now = Date.parse('2026-10-22T00:00:00Z');
  child = id(); parent = { id: String(id()), role: 'parent' };
  family = await Family.create({ familyName: 'Synthetic', ownerParentId: parent.id, memberParentIds: [parent.id], childIds: [child] });
  await User.create({ _id: parent.id, role: 'parent' });
  const journal = createMediaDeletionJournal({ root: path.join(root, 'journal') });
  store = createPrivateMediaStore({ root: path.join(root, 'media') });
  const options = { transactionRunner: runner, now: () => now, journal, mediaStore: store };
  service = createMediaReferenceOperationService(options);
  privacy = createCompletionMediaPrivacyService(options); cleanup = createCompletionMediaCleanupService(options);
  // Contract adapter exercises the real provider and JSON wire shape, not a registered production route.
  transport = { post: jest.fn(async (url, wire, config) => {
    expect(config.headers['x-service-token']).toBe(TOKEN);
    const action = url.split('/').pop();
    const data = await service[action](JSON.parse(JSON.stringify(wire)));
    return { status: 200, data: { success: true, data: JSON.parse(JSON.stringify(data)) } };
  }) };
  client = createCompletionMediaReferenceClient({ axiosInstance: transport, resourceServiceUrl: 'http://synthetic-resource', serviceToken: TOKEN });
});
afterAll(async () => {
  await mongoose.disconnect(); if (mongo) await mongo.stop(); if (root) await fs.rm(root, { recursive: true, force: true });
});

describe('AI2 typed completion protocol', () => {
  beforeEach(() => {
    service = createMediaReferenceOperationService({ transactionRunner: runner, now: () => now, ai2Mode: () => 'enabled' });
  });
  test('typed prepare/commit/status/unbind preserve exact identity and old task hashes', async () => {
    const { createHash } = require('crypto');
    const legacy = await fixture(), c = await ai2Fixture();
    await client.prepare(legacy);
    const old = await Operation.findOne({ operationId: legacy.remoteOperationId }).lean();
    const refs = legacy.references.slice().sort((a, b) => a.mediaId.localeCompare(b.mediaId));
    expect(old.referenceSetHash).toBe(createHash('sha256').update(JSON.stringify(refs)).digest('hex'));
    expect((await client.prepare(c)).operation).toMatchObject({ state: 'PREPARED', resourceType: c.resourceType,
      resourceId: c.resourceId, field: 'correctionMediaIds' });
    expect((await client.commit(c)).operation.state).toBe('COMMITTED');
    expect((await refStatus(c)).references).toEqual(expect.arrayContaining(c.references.map(r => expect.objectContaining({
      ...r, resourceType: c.resourceType, resourceId: c.resourceId, bindingOperationId: c.remoteOperationId, state: 'bound'
    }))));
    expect((await client.unbind(removal(c))).references.every(r => r.state === 'released')).toBe(true);
    expect((await client.abort(c)).operation.state).toBe('COMMITTED');
    expect(await Operation.findOne({ operationId: legacy.remoteOperationId }).lean()).toEqual(old);
  });
  test.each(['crossed field', 'unknown type', 'sparse', 'duplicate'])('rejects %s before transport or persistence', async kind => {
    const c = await ai2Fixture();
    if (kind === 'crossed field') c.references[0].field = 'completionMediaIds';
    if (kind === 'unknown type') c.resourceType = 'unknown';
    if (kind === 'sparse') c.references = Array(2);
    if (kind === 'duplicate') c.references = [c.references[0], c.references[0]];
    await expect(client.prepare(c)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(transport.post).not.toHaveBeenCalled();
    const { remoteOperationId, ...wire } = c;
    await expect(service.prepare({ ...wire, operationId: remoteOperationId })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await Operation.countDocuments()).toBe(0);
  });
  test('mode off blocks new prepare/commit but permits read, abort and exact unbind', async () => {
    const c = await ai2Fixture(); await client.prepare(c);
    service = createMediaReferenceOperationService({ transactionRunner: runner });
    expect((await status(c)).operation.state).toBe('PREPARED');
    for (const action of ['prepare', 'commit']) await expect(client[action](c)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
    expect((await client.abort(c)).operation.state).toBe('ABORTED');
    expect((await client.unbind(removal(c))).references.every(r => r.state === 'released')).toBe(true);
    await expect(client.prepare(await ai2Fixture())).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  });
  test('mixed task/AI2 records and multi-attempt privacy receipts pass read-only precheck and cleanup', async () => {
    const { assertCompletionReferenceReadiness } = require('../services/completionReferenceReadiness');
    const legacy = await fixture(), c = await ai2Fixture(), second = { ...c, resourceId: String(id()), remoteOperationId: randomUUID() };
    for (const cmd of [legacy, c, second]) { await client.prepare(cmd); await client.commit(cmd); }
    await privacy.deleteMedia({ identity: parent, mediaId: legacy.references[0].mediaId });
    const legacyJournal = await fs.readFile(path.join(root, 'journal', legacy.references[0].mediaId + '.json'), 'utf8');
    await privacy.deleteMedia({ identity: parent, mediaId: c.references[0].mediaId });
    const evidence = JSON.parse(await fs.readFile(path.join(root, 'journal', c.references[0].mediaId + '.json'), 'utf8'));
    expect(evidence.tombstone.purpose).toBe('ai2_correction'); expect(evidence.receipts).toHaveLength(2);
    expect(evidence.tombstone).toMatchObject({ mimeType: 'image/jpeg', sizeBytes: 15 });
    for (const cmd of [c, second]) expect((await status(cmd)).references.find(r => r.mediaId === c.references[0].mediaId).privacyDeletion)
      .toMatchObject({ resourceType: 'ai2_attempt', resourceId: cmd.resourceId, field: 'correctionMediaIds', bindingOperationId: cmd.remoteOperationId });
    const before = await Operation.find().sort({ _id: 1 }).lean();
    expect((await assertCompletionReferenceReadiness({ connection: mongoose.connection, writesPaused: true })).ready).toBe(true);
    expect(await Operation.find().sort({ _id: 1 }).lean()).toEqual(before);
    now += 31 * 86400000; expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(2);
    expect(await Asset.findById(c.references[0].mediaId)).toBeNull();
    expect(await Tombstone.findOne({ mediaId: c.references[0].mediaId }).lean()).toMatchObject({ mimeType: 'image/jpeg', sizeBytes: 15 });
    const { loadDeletionEvidence } = require('../services/mediaDeletionEvidence');
    expect(await loadDeletionEvidence(c.references[0].mediaId)).toEqual(evidence);
    expect(await fs.readFile(path.join(root, 'journal', c.references[0].mediaId + '.json'), 'utf8')).toBe(JSON.stringify(evidence) + '\n');
    expect((await status(c)).references.find(r => r.mediaId === c.references[0].mediaId)).toMatchObject({ state: 'absent',
      privacyDeletion: { bindingOperationId: c.remoteOperationId } });
    expect(await fs.readFile(path.join(root, 'journal', legacy.references[0].mediaId + '.json'), 'utf8')).toBe(legacyJournal);
    expect((await assertCompletionReferenceReadiness({ connection: mongoose.connection, writesPaused: true })).ready).toBe(true);
  });
  test('AI2 model pairs reject crossed fields and purpose mismatch never binds', async () => {
    const c = await ai2Fixture();
    await client.prepare(c);
    const op = await Operation.findOne({ operationId: c.remoteOperationId }).lean();
    await expect(Operation.hydrate({ ...op, field: 'completionMediaIds' }).validate()).rejects.toThrow();
    await expect(new Receipt({ familyId: c.familyId, childId: c.childId, mediaId: c.references[0].mediaId,
      resourceType: c.resourceType, resourceId: c.resourceId, field: 'completionMediaIds', bindingOperationId: c.remoteOperationId,
      releasedAt: new Date(now) }).validate()).rejects.toThrow();
    const wrong = await ai2Fixture();
    await Asset.updateOne({ _id: wrong.references[0].mediaId }, { $set: { purpose: 'task_completion' } });
    expect((await client.prepare(wrong)).operation).toMatchObject({ state: 'ABORTED', failureCode: 'MEDIA_PURPOSE_MISMATCH' });
  });
  test.each(['type', 'attempt', 'field', 'hash', 'missing scope'])('client rejects a response with wrong %s', async kind => {
    const c = await ai2Fixture(), post = transport.post.getMockImplementation();
    transport.post.mockImplementationOnce(async (...args) => {
      const result = await post(...args), op = result.data.data.operation;
      if (kind === 'type') op.resourceType = 'growth_task';
      if (kind === 'attempt') op.resourceId = String(id());
      if (kind === 'field') op.field = 'completionMediaIds';
      if (kind === 'hash') op.referenceSetHash = '0'.repeat(64);
      if (kind === 'missing scope') delete result.data.data.references[0].resourceType;
      return result;
    });
    await expect(client.prepare(c)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
    expect((await status(c)).operation.state).toBe('PREPARED');
  });
  test.each(['uploader', 'size', 'MIME', 'child', 'family'])('prepare refuses invalid AI2 %s without partial bindings', async kind => {
    const c = await ai2Fixture();
    const patch = kind === 'uploader' ? { uploadedBy: id() } : kind === 'size' ? { sizeBytes: 10 * 1024 * 1024 + 1 }
      : kind === 'MIME' ? { mimeType: 'application/pdf' } : kind === 'child' ? { childId: id() } : { familyId: id() };
    await Asset.collection.updateOne({ _id: new mongoose.Types.ObjectId(c.references[0].mediaId) }, { $set: patch });
    expect((await client.prepare(c)).operation).toMatchObject({ state: 'ABORTED',
      failureCode: ['child', 'family'].includes(kind) ? 'CHILD_ACCESS_DENIED' : 'MEDIA_PURPOSE_MISMATCH' });
    expect(await Reference.countDocuments()).toBe(0);
  });
  test('AI2 legacy expiry and single-media release cannot touch prepared groups', async () => {
    const { createMediaReferenceService } = require('../services/mediaReferenceService');
    const c = await ai2Fixture(); await client.prepare(c); now += 901000;
    const legacy = createMediaReferenceService({ transactionRunner: runner, now: () => now });
    expect(await legacy.reclaimExpiredPrepared()).toEqual({ reclaimed: 0 });
    await runner(session => legacy.releasePreparedForDeletedMedia({ mediaId: c.references[0].mediaId, releasedAt: new Date(now), session }));
    expect((await status(c)).references.every(r => r.state === 'prepared')).toBe(true);
    const { remoteOperationId, commandHash: _hash, ...wire } = c;
    await expect(legacy.prepare({ ...wire, operationId: remoteOperationId })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  test.each(['delete', 'commit'])('MEDIA-04 AI2 %s wins a real snapshot conflict without mixed bindings or rewritten audit', async winner => {
    const c = await ai2Fixture(); await client.prepare(c);
    const mediaId = c.references[0].mediaId;
    let enter, release, pending, runs = 0;
    const entered = new Promise(resolve => { enter = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    let held = false;
    const method = winner === 'delete' ? 'find' : 'findById';
    const original = Asset[method].bind(Asset);
    const spy = jest.spyOn(Asset, method).mockImplementation((...args) => {
      const query = original(...args), lean = query.lean.bind(query);
      query.lean = async (...values) => {
        const result = await lean(...values);
        if (!held) { held = true; enter(); await gate; }
        return result;
      };
      return query;
    });
    const countingRunner = work => runner(async session => { runs++; return work(session); });
    const pausedOps = createMediaReferenceOperationService({ transactionRunner: countingRunner, now: () => now, ai2Mode: () => 'enabled' });
    const pausedPrivacy = createCompletionMediaPrivacyService({ transactionRunner: countingRunner, now: () => now,
      journal: createMediaDeletionJournal({ root: path.join(root, 'journal') }) });
    const { remoteOperationId, ...wire } = c;
    try {
      pending = (winner === 'delete'
        ? pausedOps.commit({ ...wire, operationId: remoteOperationId })
        : pausedPrivacy.deleteMedia({ identity: parent, mediaId })).then(value => ({ value }), error => ({ error }));
      await Promise.race([entered, pending.then(() => { throw Error('Operation ended before snapshot barrier'); })]);
      expect(runs).toBe(1);
      if (winner === 'delete') await privacy.deleteMedia({ identity: parent, mediaId });
      else expect((await client.commit(c)).operation.state).toBe('COMMITTED');
      release();
      const result = await pending; if (result.error) throw result.error;
      expect(runs).toBeGreaterThanOrEqual(2);
      const state = await status(c);
      expect(state.operation.state).toBe(winner === 'delete' ? 'ABORTED' : 'COMMITTED');
      expect(state.references).toHaveLength(2);
      const deleted = state.references.find(r => r.mediaId === mediaId);
      const surviving = state.references.find(r => r.mediaId === c.references[1].mediaId);
      expect(deleted).toMatchObject({ state: 'released', resourceType: 'ai2_attempt', resourceId: c.resourceId,
        field: 'correctionMediaIds', bindingOperationId: remoteOperationId });
      expect(surviving.state).toBe(winner === 'delete' ? 'released' : 'bound');
      expect(surviving.privacyDeletion).toBeNull();
      expect(deleted.privacyDeletion).toEqual(winner === 'delete' ? null : {
        mediaId, resourceType: 'ai2_attempt', resourceId: c.resourceId, field: 'correctionMediaIds',
        bindingOperationId: remoteOperationId, deletedAt: new Date(now).toISOString(), releasedAt: new Date(now).toISOString()
      });
      expect(await Receipt.countDocuments()).toBe(winner === 'delete' ? 0 : 1);
      expect(await Tombstone.countDocuments()).toBe(1);
      expect(await Asset.findById(mediaId).lean()).toMatchObject({ status: 'deleted', privacyDeletionRecorded: true });
      expect(await Asset.findById(c.references[1].mediaId).lean()).toMatchObject({ status: 'active' });
      const models = [Asset, Reference, Operation, Tombstone, Receipt];
      const snapshot = () => Promise.all(models.map(model => model.find().sort({ _id: 1 }).lean()));
      const before = await snapshot(), journalPath = path.join(root, 'journal', mediaId + '.json');
      const journalBytes = await fs.readFile(journalPath);
      const evidence = JSON.parse(journalBytes.toString());
      expect(evidence.tombstone).toMatchObject({ mediaId, actorId: parent.id, purpose: 'ai2_correction' });
      expect(evidence.receipts).toHaveLength(winner === 'delete' ? 0 : 1);
      now += 1000;
      await privacy.deleteMedia({ identity: parent, mediaId });
      expect((await client.commit(c)).operation.state).toBe(state.operation.state);
      expect(await snapshot()).toEqual(before);
      expect(await fs.readFile(journalPath)).toEqual(journalBytes);
    } finally { release(); if (pending) await pending; spy.mockRestore(); }
  });
  test('MEDIA-04 AI2 cross-family deletion rejects both actors and own deletion leaves foreign objects and bytes intact', async () => {
    const own = await ai2Fixture(), foreign = await ai2Fixture(), foreignChild = id();
    const foreignParent = { id: String(id()), role: 'parent' };
    const other = await Family.create({ familyName: 'Other synthetic', ownerParentId: foreignParent.id,
      memberParentIds: [foreignParent.id], childIds: [foreignChild] });
    await User.create([{ _id: child, familyId: family._id, role: 'student', childProfile: { tokenVersion: 0 } },
      { _id: foreignParent.id, role: 'parent' }, { _id: foreignChild, familyId: other._id, role: 'student', childProfile: { tokenVersion: 0 } }]);
    foreign.familyId = String(other._id); foreign.childId = String(foreignChild);
    await Asset.updateMany({ _id: { $in: foreign.references.map(r => r.mediaId) } },
      { $set: { familyId: other._id, childId: foreignChild, uploadedBy: foreignChild } });
    for (const c of [own, foreign]) { await client.prepare(c); await client.commit(c); }
    const allModels = [Asset, Reference, Operation, Tombstone, Receipt, Family, User];
    const snapshot = () => Promise.all(allModels.map(model => model.find().sort({ _id: 1 }).lean()));
    const before = await snapshot();
    const foreignAssets = await Asset.find({ familyId: other._id }).sort({ _id: 1 }).lean();
    const bytes = await Promise.all(foreignAssets.map(asset => store.read(asset.storageKey)));
    const identity = { id: String(child), childId: String(child), familyId: String(family._id), role: 'student', tokenVersion: 0 };
    for (const actor of [parent, identity]) {
      await expect(privacy.deleteMedia({ identity: actor, mediaId: foreign.references[0].mediaId }))
        .rejects.toMatchObject({ statusCode: 403, code: 'CHILD_ACCESS_DENIED' });
      expect(await snapshot()).toEqual(before);
    }
    const foreignSnapshot = () => Promise.all([Asset, Reference, Operation, Tombstone, Receipt]
      .map(model => model.find({ familyId: other._id }).sort({ _id: 1 }).lean()));
    const protectedState = await foreignSnapshot();
    await privacy.deleteMedia({ identity: parent, mediaId: own.references[0].mediaId });
    expect(await foreignSnapshot()).toEqual(protectedState);
    expect(await Promise.all(foreignAssets.map(asset => store.read(asset.storageKey)))).toEqual(bytes);
    for (const ref of foreign.references) await expect(fs.readFile(path.join(root, 'journal', ref.mediaId + '.json')))
      .rejects.toMatchObject({ code: 'ENOENT' });
    expect((await status(foreign)).references.every(r => r.state === 'bound' && r.privacyDeletion === null)).toBe(true);
    expect(await Tombstone.countDocuments()).toBe(1); expect(await Receipt.countDocuments()).toBe(1);
  });
  test('privacy deletion of AI2 PREPARED aborts the full group without fabricated receipts', async () => {
    const c = await ai2Fixture(); await client.prepare(c);
    await privacy.deleteMedia({ identity: parent, mediaId: c.references[0].mediaId });
    expect((await status(c)).operation).toMatchObject({ state: 'ABORTED', failureCode: 'RESOURCE_NOT_FOUND' });
    expect((await status(c)).references.every(r => r.state === 'released' && r.privacyDeletion === null)).toBe(true);
    expect(await Receipt.countDocuments()).toBe(0);
  });
  test('failed deletion journal acknowledgement is unknown; retry preserves the first audit', async () => {
    const c = await ai2Fixture(); await client.prepare(c); await client.commit(c);
    const journal = { persist: jest.fn().mockRejectedValueOnce(Error('synthetic journal failure')).mockResolvedValue(undefined) };
    const deleting = createCompletionMediaPrivacyService({ transactionRunner: runner, journal, now: () => now });
    const input = { identity: parent, mediaId: c.references[0].mediaId };
    await expect(deleting.deleteMedia(input)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
    const tomb = await Tombstone.findOne().lean(), receipts = await Receipt.find().lean(); now += 1000;
    await deleting.deleteMedia(input);
    expect(await Tombstone.findOne().lean()).toEqual(tomb); expect(await Receipt.find().lean()).toEqual(receipts);
    expect(journal.persist.mock.calls[1][0]).toEqual(journal.persist.mock.calls[0][0]);
  });
  test('child deletion requires current identity and own upload; dispatcher selects exact privacy writer', async () => {
    const { createMediaDeletionDispatcher } = require('../services/mediaDeletionDispatcher');
    const c = await ai2Fixture(); await client.prepare(c); await client.commit(c);
    await User.create({ _id: child, familyId: family._id, role: 'student', childProfile: { tokenVersion: 3 } });
    const identity = { id: String(child), childId: String(child), familyId: String(family._id), role: 'student', tokenVersion: 3 };
    const legacy = { deleteMedia: jest.fn() }, dispatch = createMediaDeletionDispatcher({ mediaService: legacy, privacyService: privacy });
    await expect(dispatch({ identity: { ...identity, tokenVersion: 2 }, mediaId: c.references[0].mediaId }))
      .rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED' });
    await Asset.updateOne({ _id: c.references[0].mediaId }, { $set: { uploadedBy: parent.id } });
    await expect(dispatch({ identity, mediaId: c.references[0].mediaId })).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED' });
    await Asset.updateOne({ _id: c.references[0].mediaId }, { $set: { uploadedBy: child } });
    await dispatch({ identity, mediaId: c.references[0].mediaId });
    expect(legacy.deleteMedia).not.toHaveBeenCalled();
    expect(await Tombstone.findOne().lean()).toMatchObject({ purpose: 'ai2_correction', role: 'student' });
  });
  test('new typed references with an unknown field cannot disappear from precheck', async () => {
    const { assertCompletionReferenceReadiness } = require('../services/completionReferenceReadiness');
    const c = await ai2Fixture(); await client.prepare(c); await client.commit(c);
    await Reference.collection.insertOne({ familyId: new mongoose.Types.ObjectId(c.familyId), childId: child,
      resourceType: 'ai2_attempt', resourceId: id(), mediaId: id(), field: 'unknown', operationId: randomUUID(), state: 'bound' });
    await expect(assertCompletionReferenceReadiness({ connection: mongoose.connection, writesPaused: true }))
      .rejects.toMatchObject({ code: 'COMPLETION_REFERENCES_NOT_READY', issues: ['REFERENCE_INVALID'] });
  });
  test.each(['uploader', 'size', 'purpose', 'field'])('readiness detects malformed persisted AI2 %s', async kind => {
    const { assertCompletionReferenceReadiness } = require('../services/completionReferenceReadiness');
    const c = await ai2Fixture(); await client.prepare(c); await client.commit(c);
    if (kind === 'field') await Reference.collection.updateOne({ resourceId: new mongoose.Types.ObjectId(c.resourceId) },
      { $set: { field: 'completionMediaIds' } });
    else await Asset.collection.updateOne({ _id: new mongoose.Types.ObjectId(c.references[0].mediaId) },
      { $set: kind === 'uploader' ? { uploadedBy: id() } : kind === 'size' ? { sizeBytes: 10 * 1024 * 1024 + 1 } : { purpose: 'task_completion' } });
    await expect(assertCompletionReferenceReadiness({ connection: mongoose.connection, writesPaused: true }))
      .rejects.toMatchObject({ code: 'COMPLETION_REFERENCES_NOT_READY' });
  });
  test('AI2 replay never treats absent or wrong-generation receipts as a successful binding', async () => {
    const c = await ai2Fixture(); await client.prepare(c); await client.commit(c);
    await privacy.deleteMedia({ identity: parent, mediaId: c.references[0].mediaId });
    const receipt = await Receipt.findOne().lean();
    await Receipt.collection.updateOne({ _id: receipt._id }, { $set: { bindingOperationId: randomUUID() } });
    const result = await status(c);
    expect(result.operation.state).toBe('COMMITTED');
    expect(result.references.find(r => r.mediaId === c.references[0].mediaId)).toMatchObject({ state: 'released', privacyDeletion: null });
    await Receipt.deleteMany({});
    expect((await status(c)).references.find(r => r.mediaId === c.references[0].mediaId).privacyDeletion).toBeNull();
    const { assertCompletionReferenceReadiness } = require('../services/completionReferenceReadiness');
    await expect(assertCompletionReferenceReadiness({ connection: mongoose.connection, writesPaused: true }))
      .rejects.toMatchObject({ code: 'COMPLETION_REFERENCES_NOT_READY' });
  });
  test('AI2 delayed unbind cannot release a newer generation', async () => {
    const c = await ai2Fixture(); await client.prepare(c); await client.commit(c);
    const oldRemoval = removal(c); await client.unbind(oldRemoval);
    const next = { ...c, remoteOperationId: randomUUID() }; await client.prepare(next); await client.commit(next);
    const before = await Reference.find().sort({ _id: 1 }).lean();
    await expect(client.unbind(oldRemoval)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
    expect(await Reference.find().sort({ _id: 1 }).lean()).toEqual(before);
    expect((await status(c)).references.every(r => r.bindingOperationId === next.remoteOperationId)).toBe(true);
  });
  test('AI2 deletion does not enter the optional advanced recovery writer', async () => {
    const c = await ai2Fixture();
    const recoveryJournal = { read: jest.fn().mockResolvedValue(null), persist: jest.fn() };
    const journal = { persist: jest.fn() };
    const advanced = createCompletionMediaPrivacyService({ transactionRunner: runner, journal, recoveryJournal });
    await expect(advanced.deleteMedia({ identity: parent, mediaId: c.references[0].mediaId }))
      .rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
    expect(await Tombstone.countDocuments()).toBe(0); expect(await Receipt.countDocuments()).toBe(0);
    expect((await Asset.findById(c.references[0].mediaId)).status).toBe('active');
    expect(recoveryJournal.persist).not.toHaveBeenCalled(); expect(journal.persist).not.toHaveBeenCalled();
  });
  test.each(['missing', 'invalid MIME', 'invalid size', 'different descriptor'])('AI2 deletion metadata %s fails readiness and cannot be cleaned', async kind => {
    const c = await ai2Fixture(); await client.prepare(c); await client.commit(c);
    await privacy.deleteMedia({ identity: parent, mediaId: c.references[0].mediaId });
    const update = kind === 'missing' ? { $unset: { mimeType: '', sizeBytes: '' } }
      : { $set: kind === 'invalid MIME' ? { mimeType: 'application/pdf' }
        : kind === 'invalid size' ? { sizeBytes: 10 * 1024 * 1024 + 1 } : { mimeType: 'image/png', sizeBytes: 16 } };
    await Tombstone.collection.updateOne({ mediaId: new mongoose.Types.ObjectId(c.references[0].mediaId) }, update);
    const { assertCompletionPrivacyReadiness } = require('../services/completionPrivacyReadiness');
    await expect(assertCompletionPrivacyReadiness({ connection: mongoose.connection, writesPaused: true }))
      .rejects.toMatchObject({ code: 'COMPLETION_PRIVACY_NOT_READY' });
    now += 31 * 86400000;
    await expect(cleanup.cleanupDeletedMedia()).rejects.toThrow();
    expect(await Asset.findById(c.references[0].mediaId)).not.toBeNull();
  });
  test('AI2 tombstone model requires immutable metadata and legacy tombstone output stays descriptor-free', async () => {
    const c = await ai2Fixture();
    const legacy = { mediaId: c.references[0].mediaId, familyId: c.familyId, childId: c.childId,
      actorId: parent.id, role: 'parent', purpose: 'task_completion', reason: 'user_requested', deletedAt: new Date(now) };
    const old = new Tombstone(legacy); await old.validate();
    expect(old.toObject()).not.toHaveProperty('mimeType'); expect(old.toObject()).not.toHaveProperty('sizeBytes');
    await expect(new Tombstone({ ...legacy, purpose: 'ai2_correction' }).validate()).rejects.toThrow();
    const typed = await Tombstone.create({ ...legacy, purpose: 'ai2_correction', mimeType: 'image/jpeg', sizeBytes: 15 });
    typed.mimeType = 'image/png'; typed.sizeBytes = 16;
    await expect(typed.save()).rejects.toThrow('immutable');
    expect(await Tombstone.findById(typed._id).lean()).toMatchObject({ mimeType: 'image/jpeg', sizeBytes: 15 });
  });
  test('environment alone cannot enable AI2 operation writes without injected readiness mode', async () => {
    const previous = process.env.AI2_MODE; process.env.AI2_MODE = 'enabled';
    try {
      service = createMediaReferenceOperationService({ transactionRunner: runner });
      await expect(client.prepare(await ai2Fixture())).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
      expect(await Operation.countDocuments()).toBe(0);
    } finally {
      if (previous === undefined) delete process.env.AI2_MODE; else process.env.AI2_MODE = previous;
    }
  });
});

test('real ABSENT -> PREPARED -> COMMITTED and late abort retain exact remote identity', async () => {
  const c = await fixture();
  expect((await status(c)).operation.state).toBe('ABSENT');
  expect((await client.prepare(c)).operation.state).toBe('PREPARED');
  expect((await client.commit(c)).operation.state).toBe('COMMITTED');
  expect((await client.abort(c)).operation.state).toBe('COMMITTED');
  expect((await refStatus(c)).references.every(r => r.state === 'bound' && r.bindingOperationId === c.remoteOperationId)).toBe(true);
  expect(await Operation.countDocuments()).toBe(1);
});

test('provider media refusal and expired lease return persisted ABORTED evidence, not bare errors', async () => {
  const c = await fixture(); await Asset.deleteOne({ _id: c.references[0].mediaId });
  expect((await client.prepare(c)).operation).toMatchObject({ state: 'ABORTED', failureCode: 'RESOURCE_NOT_FOUND' });
  const other = await fixture(); await client.prepare(other); now += 900000;
  expect((await status(other)).operation).toMatchObject({ state: 'PREPARED', leaseExpired: true });
  expect((await client.abort(other)).operation).toMatchObject({ state: 'ABORTED', failureCode: 'MEDIA_OPERATION_EXPIRED' });
  expect((await client.commit(other)).operation.failureCode).toBe('MEDIA_OPERATION_EXPIRED');
});

test('lost commit response recovers original operation without generating another identity', async () => {
  const c = await fixture(); await client.prepare(c);
  const post = transport.post.getMockImplementation();
  transport.post.mockImplementationOnce(async (...args) => { await post(...args); throw new Error('response lost'); });
  await expect(client.commit(c)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect((await status(c)).operation).toMatchObject({ state: 'COMMITTED', operationId: c.remoteOperationId });
  expect((await client.commit(c)).operation.state).toBe('COMMITTED');
  expect(await Operation.countDocuments()).toBe(1);
});

test('provider hash conflict cannot become local terminal evidence', async () => {
  const c = await fixture(); await client.prepare(c);
  await expect(client.abort({ ...c, commandHash: 'b'.repeat(64) })).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect((await status(c)).operation.state).toBe('PREPARED');
});

test('deletion proof remains exact through cleanup and late terminal replay', async () => {
  const c = await fixture(); await client.prepare(c); await client.commit(c);
  await privacy.deleteMedia({ identity: parent, mediaId: c.references[0].mediaId });
  const before = await status(c), proof = before.references.find(r => r.mediaId === c.references[0].mediaId).privacyDeletion;
  expect(proof).toMatchObject({ resourceId: c.resourceId, bindingOperationId: c.remoteOperationId });
  now += 31 * 86400000; expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(1);
  for (const response of [await status(c), await refStatus(c), await client.commit(c)]) {
    expect(response.references.find(r => r.mediaId === c.references[0].mediaId)).toMatchObject({ state: 'absent', privacyDeletion: proof });
  }
});

test('privacy deletion of PREPARED group yields ABORTED and no forged bound receipts', async () => {
  const c = await fixture(); await client.prepare(c);
  await privacy.deleteMedia({ identity: parent, mediaId: c.references[0].mediaId });
  const response = await client.commit(c);
  expect(response.operation).toMatchObject({ state: 'ABORTED', failureCode: 'RESOURCE_NOT_FOUND' });
  expect(response.references.every(r => r.state === 'released' && r.privacyDeletion === null)).toBe(true);
});

test('another generation stays visible when replaying a historical ABORTED command', async () => {
  const c = await fixture(); await client.prepare(c); await client.abort(c);
  const next = { ...c, remoteOperationId: randomUUID(), commandHash: 'b'.repeat(64) };
  await client.prepare(next); await client.commit(next);
  const historical = await status(c);
  expect(historical.operation.state).toBe('ABORTED');
  expect(historical.references.every(r => r.bindingOperationId === next.remoteOperationId && r.state === 'bound')).toBe(true);
});

test('lost unbind response recovers identical release facts without a new remote operation', async () => {
  const c = await fixture(); await client.prepare(c); await client.commit(c);
  const input = removal(c), post = transport.post.getMockImplementation();
  transport.post.mockImplementationOnce(async (...args) => { await post(...args); throw new Error('lost release response'); });
  await expect(client.unbind(input)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  const before = await Reference.find().sort({ mediaId: 1 }).lean(); now += 1000;
  const result = await client.unbind(input);
  expect(result.operation).toBeNull(); expect(result.references.every(r => r.state === 'released')).toBe(true);
  expect(await Reference.find().sort({ mediaId: 1 }).lean()).toEqual(before);
  expect(await Operation.countDocuments()).toBe(1);
  expect(await Operation.exists({ operationId: input.remoteOperationId })).toBeNull();
  expect(await Receipt.countDocuments()).toBe(0); expect(await Tombstone.countDocuments()).toBe(0);
});

test('unbind after privacy deletion and retention selects the old binding proof, never the release audit id', async () => {
  const c = await fixture(); await client.prepare(c); await client.commit(c);
  const input = removal(c), target = c.references[0].mediaId;
  await privacy.deleteMedia({ identity: parent, mediaId: target });
  const released = await Reference.findOne({ mediaId: target }).lean();
  const first = await client.unbind(input);
  const proof = first.references.find(r => r.mediaId === target).privacyDeletion;
  expect(proof.bindingOperationId).toBe(c.remoteOperationId);
  expect(await Reference.findOne({ mediaId: target }).lean()).toEqual(released);
  now += 31 * 86400000; expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(1);
  const replay = await client.unbind(input);
  expect(replay.references.find(r => r.mediaId === target)).toEqual({ ...c.references[0], state: 'absent', privacyDeletion: proof });
  const wrongOld = { ...input, references: [{ ...input.references[0], bindingOperationId: randomUUID() }] };
  expect((await client.unbind(wrongOld)).references[0]).toEqual({ ...c.references[0], state: 'absent', privacyDeletion: null });
});

test('ordinary unbind followed by privacy deletion never creates a bound-at-deletion receipt', async () => {
  const c = await fixture(); await client.prepare(c); await client.commit(c);
  const input = removal(c); await client.unbind(input);
  await privacy.deleteMedia({ identity: parent, mediaId: c.references[0].mediaId });
  expect(await Receipt.countDocuments()).toBe(0);
  now += 31 * 86400000; await cleanup.cleanupDeletedMedia();
  const result = await client.unbind(input);
  expect(result.references.find(r => r.mediaId === c.references[0].mediaId)).toEqual({ ...c.references[0], state: 'absent', privacyDeletion: null });
  expect((await client.commit(c)).operation.state).toBe('COMMITTED');
});

test('privacy deletion competing with unbind serializes old terminal and exact receipt facts', async () => {
  const c = await fixture(); await client.prepare(c); await client.commit(c);
  const input = removal(c), target = c.references[0].mediaId;
  await Promise.all([client.unbind(input), privacy.deleteMedia({ identity: parent, mediaId: target })]);
  const terminal = await status(c), result = await client.unbind(input);
  expect(terminal.operation.state).toBe('COMMITTED');
  expect(result.references.every(r => r.state === 'released')).toBe(true);
  const ref = await Reference.findOne({ mediaId: target }).lean();
  const receipt = await Receipt.findOne({ mediaId: target }).lean();
  if (ref.releaseOperationId === null) {
    expect(receipt.bindingOperationId).toBe(c.remoteOperationId);
    expect(result.references.find(r => r.mediaId === target).privacyDeletion.bindingOperationId).toBe(c.remoteOperationId);
  } else {
    expect(ref.releaseOperationId).toBe(input.remoteOperationId); expect(receipt).toBeNull();
  }
  expect(await Tombstone.countDocuments()).toBe(1);
});

test('old unbind arriving after rebind remains pending and cannot alter newer generation', async () => {
  const c = await fixture(); await client.prepare(c); await client.commit(c);
  const input = removal(c); await client.unbind(input);
  const next = { ...c, remoteOperationId: randomUUID() }; await client.prepare(next); await client.commit(next);
  const before = await Reference.find().sort({ mediaId: 1 }).lean();
  await expect(client.unbind(input)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect(await Reference.find().sort({ mediaId: 1 }).lean()).toEqual(before);
  expect((await client.commit(c)).references.every(r => r.bindingOperationId === next.remoteOperationId)).toBe(true);
});

test('commit competing with unbind never leaves a partly bound group or changes terminal outcome', async () => {
  const c = await fixture(); await client.prepare(c);
  const input = removal(c);
  const results = await Promise.allSettled([client.commit(c), client.unbind(input)]);
  expect(results[0].status).toBe('fulfilled');
  if (results[1].status === 'rejected') expect(results[1].reason.code).toBe('MEDIA_REFERENCE_PENDING');
  expect((await status(c)).operation.state).toBe('COMMITTED');
  const rows = await Reference.find().lean();
  expect(new Set(rows.map(r => r.state)).size).toBe(1);
  expect((await client.unbind(input)).references.every(r => r.state === 'released')).toBe(true);
});

test('client accepts a mixed removal set from different old operations and honest absent rows', async () => {
  const c = await fixture();
  const first = { ...c, references: [c.references[0]] };
  const second = { ...c, remoteOperationId: randomUUID(), references: [c.references[1]] };
  for (const command of [first, second]) { await client.prepare(command); await client.commit(command); }
  const input = { ...removal(first), references: [...removal(first).references, ...removal(second).references,
    { mediaId: String(id()), field: 'completionMediaIds', bindingOperationId: randomUUID() }] };
  const result = await client.unbind(input);
  expect(result.references.filter(r => r.state === 'released')).toHaveLength(2);
  expect(result.references.filter(r => r.state === 'absent')).toHaveLength(1);
  expect(await Operation.countDocuments()).toBe(2);
});

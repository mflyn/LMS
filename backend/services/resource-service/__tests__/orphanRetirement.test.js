const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('../../../../node_modules/mongodb-memory-server');
const Asset = require('../models/MediaAsset');
const Reference = require('../models/MediaReference');
const Operation = require('../models/MediaReferenceOperation');
const Retirement = require('../models/MediaOrphanRetirement');
const Guard = require('../models/CompletionUploadGuard');
const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');
const Family = require('../../../common/models/Family');
const User = require('../models/FamilyUser');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const { createPrivateMediaStore } = require('../services/privateMediaStore');
const { createMediaReferenceOperationService } = require('../services/mediaReferenceOperationService');
const { createOrphanRetirementService } = require('../services/orphanRetirementService');
const { createCompletionMediaPrivacyService } = require('../services/completionMediaPrivacyService');
const { createMediaCleanupService } = require('../services/mediaCleanupService');
const { createCompletionMediaCleanupService } = require('../services/completionMediaCleanupService');
const { createMediaDeletionDispatcher } = require('../services/mediaDeletionDispatcher');
const { hash, canonicalMetadata } = require('../services/completionUploadRecord');

jest.setTimeout(30000);
const id = () => new mongoose.Types.ObjectId();
const START = Date.parse('2026-10-23T00:00:00Z'), DAY = 86400000;
let mongo, runner, root, store, now, familyId, childId, parent, journal, client, operations;
const make = options => createOrphanRetirementService({ transactionRunner: runner, mediaStore: store,
  retirementClient: client, journal, now: () => now, ...options });
const asset = async (changes = {}) => {
  const { storageKey } = await store.writeCanonical(Buffer.from('synthetic'));
  return Asset.create({ familyId, childId, uploadedBy: parent.id, purpose: 'task_completion',
    mimeType: 'image/jpeg', sizeBytes: 9, storageKey, retentionPolicyVersion: 1,
    orphanEligibleAt: new Date(START + DAY), ...changes });
};
const command = assets => ({ familyId: String(familyId), childId: String(childId), resourceType: 'growth_task',
  resourceId: String(id()), operationId: randomUUID(), commandHash: 'a'.repeat(64),
  references: assets.map(a => ({ mediaId: String(a._id), field: 'completionMediaIds' })) });
const snapshot = () => Promise.all([Asset, Reference, Operation, Retirement, Guard, Tombstone, Receipt]
  .map(model => model.collection.find().sort({ _id: 1 }).toArray()));
const retire = (a, service = make()) => service.retire({ mediaId: String(a._id) });
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri());
  for (const model of Object.values(mongoose.models)) await model.init();
  runner = createMongoTransactionRunner(mongoose.connection);
});
beforeEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 't2-orphan-')));
  store = createPrivateMediaStore({ root: path.join(root, 'media') });
  now = START; familyId = id(); childId = id(); parent = { id: String(id()), role: 'parent' };
  await Family.create({ _id: familyId, familyName: 'Synthetic', ownerParentId: parent.id,
    memberParentIds: [parent.id], childIds: [childId] });
  await User.create([{ _id: parent.id, role: 'parent' }, { _id: childId, familyId, role: 'student' }]);
  journal = { persist: jest.fn(async () => {}) };
  client = { retire: jest.fn(async body => ({ ...body, state: 'granted' })) };
  operations = createMediaReferenceOperationService({ transactionRunner: runner, now: () => now });
});
afterEach(async () => { jest.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test.each([-1, 0, 1])('T2-G-001 cutoff offset %i admits only a full 24h retention interval', async offset => {
  const a = await asset(); now = START + DAY + offset;
  const result = await retire(a);
  if (offset < 0) {
    expect(result.state).toBe('skipped'); expect(client.retire).not.toHaveBeenCalled();
    expect(await Retirement.countDocuments()).toBe(0); expect(await store.read(a.storageKey)).toHaveLength(9);
  } else {
    expect(result.state).toBe('PURGED'); expect(await Asset.countDocuments()).toBe(0);
    expect((await Guard.findOne()).state).toBe('RETIRED'); expect(await Tombstone.countDocuments()).toBe(0);
    expect(journal.persist.mock.calls[0][0].retirement).toMatchObject({ actorType: 'system', mediaId: String(a._id) });
    expect(journal.persist.mock.calls[0][0].retirement.uploadMetadataHash).toBe(hash(canonicalMetadata(a)));
    await expect(store.read(a.storageKey)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  }
});
test.each(['legacy', 'purpose', 'prepared', 'expired', 'committed', 'unbound'])
('T2-G-001 protects %s media without retiring or changing business facts', async kind => {
  const a = await asset(kind === 'legacy' ? { retentionPolicyVersion: undefined, orphanEligibleAt: undefined }
    : kind === 'purpose' ? { purpose: 'task_attachment' } : {});
  const c = command([a]);
  if (['prepared', 'expired', 'committed', 'unbound'].includes(kind)) await operations.prepare(c);
  if (['committed', 'unbound'].includes(kind)) await operations.commit(c);
  if (kind === 'unbound') {
    const { commandHash, ...unbind } = c;
    await operations.unbind({ ...unbind, references: c.references.map(r => ({ ...r, bindingOperationId: c.operationId })) });
  }
  now = START + DAY; const before = await snapshot();
  expect((await retire(a)).state).toBe('skipped'); expect(await snapshot()).toEqual(before);
  expect(client.retire).not.toHaveBeenCalled();
});
test('T2-G-009 all ABORTED generations survive even after current reference is overwritten', async () => {
  const a = await asset(), sibling = await asset(), c = command([a, sibling]);
  await operations.prepare(c); await operations.abort(c);
  const b = { ...c, operationId: randomUUID() }; await operations.prepare(b); await operations.abort(b);
  const before = await Operation.find().sort({ operationId: 1 }).lean(); now += DAY;
  expect((await retire(a)).state).toBe('PURGED');
  expect(journal.persist.mock.calls[0][0].operations.map(o => o.operationId).sort()).toEqual([c.operationId, b.operationId].sort());
  expect(journal.persist.mock.calls[0][0].operations.every(o => o.references.length === 2)).toBe(true);
  expect(await Operation.find().sort({ operationId: 1 }).lean()).toEqual(before);
  expect(await Reference.countDocuments({ mediaId: a._id })).toBe(0);
  expect((await Reference.findOne({ mediaId: sibling._id })).operationId).toBe(b.operationId);
  expect((await Asset.findById(sibling._id)).status).toBe('active');
  expect((await operations.prepare(c)).operation.state).toBe('ABORTED');
});
test('T2-G-002 in_use retains original candidate identity for a later probe', async () => {
  const a = await asset(); now += DAY; client.retire.mockImplementationOnce(async b => ({ ...b, state: 'in_use' }));
  expect((await retire(a)).state).toBe('in_use'); const r = await Retirement.findOne();
  expect(r.state).toBe('CANDIDATE'); expect(journal.persist).not.toHaveBeenCalled();
  expect((await retire(a)).state).toBe('PURGED');
  expect(client.retire.mock.calls[1][0]).toEqual(client.retire.mock.calls[0][0]);
});
test('T2-G-004 unknown remote result reuses persistent retirement id after reconstruction', async () => {
  const a = await asset(); now += DAY; client.retire.mockRejectedValueOnce(Error('synthetic lost response'));
  await expect(retire(a)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
  expect((await Retirement.findOne()).state).toBe('CANDIDATE'); expect(await store.read(a.storageKey)).toHaveLength(9);
  expect((await retire(a, make())).state).toBe('PURGED');
  expect(client.retire.mock.calls[1][0]).toEqual(client.retire.mock.calls[0][0]);
});
test('T2-G-005 failed system journal cannot be bypassed by either old cleanup', async () => {
  const a = await asset(); now += DAY; journal.persist.mockRejectedValueOnce(Error('synthetic fsync'));
  await expect(retire(a)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
  expect((await Retirement.findOne()).state).toBe('DELETED'); now += 31 * DAY;
  await createMediaCleanupService({ mediaStore: store, now: () => now }).cleanupDeletedMedia();
  await createCompletionMediaCleanupService({ transactionRunner: runner, journal, mediaStore: store, now: () => now }).cleanupDeletedMedia();
  expect(await store.read(a.storageKey)).toHaveLength(9); expect(await Asset.countDocuments()).toBe(1);
  expect((await retire(a)).state).toBe('PURGED');
});
test('T2-G-005 physical remove and directory sync failures retain DELETED and converge', async () => {
  const a = await asset(); now += DAY; const remove = jest.spyOn(store, 'remove').mockRejectedValueOnce(Error('synthetic unlink'));
  await expect(retire(a)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
  expect((await Retirement.findOne()).state).toBe('DELETED'); expect(journal.persist).toHaveBeenCalledTimes(1);
  remove.mockRestore(); jest.spyOn(store, 'syncDirectory').mockRejectedValueOnce(Error('synthetic directory fsync'));
  await expect(retire(a)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
  expect((await Retirement.findOne()).state).toBe('DELETED'); expect(await Asset.countDocuments()).toBe(1);
  expect((await retire(a)).state).toBe('PURGED'); expect(journal.persist).toHaveBeenCalledTimes(3);
});
test('T2-G-006 user deletion wins before fencing without changing its first audit', async () => {
  const a = await asset(); now += DAY;
  const privacy = createCompletionMediaPrivacyService({ transactionRunner: runner, journal: { persist: async () => {} }, now: () => now });
  client.retire.mockImplementationOnce(async b => { await privacy.deleteMedia({ identity: parent, mediaId: String(a._id) }); return { ...b, state: 'granted' }; });
  expect((await retire(a)).state).toBe('SUPERSEDED');
  expect((await Tombstone.findOne()).actorId.toString()).toBe(parent.id);
  expect(await store.read(a.storageKey)).toHaveLength(9); expect(journal.persist).not.toHaveBeenCalled();
});
test('T2-G-009 unexplained released reference is never evidence of an unused asset', async () => {
  const a = await asset(), c = command([a]); await operations.prepare(c); await operations.abort(c);
  await Operation.deleteMany({}); now += DAY; const before = await snapshot();
  await expect(retire(a)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_INCONSISTENT' });
  expect(await snapshot()).toEqual(before); expect(client.retire).not.toHaveBeenCalled();
});

test.each(['FENCED', 'DELETED', 'PURGED'].flatMap(stage => ['rollback', 'unknown commit'].map(mode => [stage, mode])))
('T2-G-004 %s %s recovers its fixed identity without losing durable evidence', async (stage, mode) => {
  const a = await asset(); now += DAY; let injected = false, committedStage;
  const fault = async work => {
    const result = await runner(async session => {
      const value = await work(session);
      committedStage = (await Retirement.findOne().session(session).lean())?.state;
      if (!injected && committedStage === stage && mode === 'rollback') { injected = true; throw Error('synthetic rollback'); }
      return value;
    });
    if (!injected && committedStage === stage && mode === 'unknown commit') { injected = true; throw Error('synthetic lost commit ack'); }
    return result;
  };
  await expect(retire(a, make({ transactionRunner: fault }))).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
  expect(injected).toBe(true); const r = await Retirement.findOne();
  const retirementId = r.retirementId;
  if (stage === 'FENCED' || stage === 'DELETED' && mode === 'rollback') expect(await store.read(a.storageKey)).toHaveLength(9);
  expect((await retire(a, make())).state).toBe('PURGED');
  const final = await Retirement.findOne(); expect(final.retirementId).toBe(retirementId);
  expect(final.evidence.retirement.retirementId).toBe(retirementId);
  expect(await Asset.countDocuments()).toBe(0); expect(await Tombstone.countDocuments()).toBe(0);
  expect(await Receipt.countDocuments()).toBe(0); expect((await Guard.findOne()).state).toBe('RETIRED');
});

test('T2-G-006 system DELETE after purge uses live scope and does not create a user audit', async () => {
  const a = await asset(); now += DAY; await retire(a); const before = await snapshot();
  const privacy = { deleteMedia: jest.fn() }, legacy = { deleteMedia: jest.fn() };
  const dispatch = createMediaDeletionDispatcher({ mediaService: legacy, privacyService: privacy, retirementService: make() });
  await dispatch({ identity: parent, mediaId: String(a._id) });
  expect(await snapshot()).toEqual(before); expect(privacy.deleteMedia).not.toHaveBeenCalled(); expect(legacy.deleteMedia).not.toHaveBeenCalled();
  await Family.updateOne({ _id: familyId }, { $set: { childIds: [] } });
  await expect(dispatch({ identity: parent, mediaId: String(a._id) })).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  expect(await Tombstone.countDocuments()).toBe(0);
});
test('T2-G-009 missing retired upload guard blocks destructive retry', async () => {
  const a = await asset(); now += DAY; journal.persist.mockRejectedValueOnce(Error('synthetic pause'));
  await expect(retire(a)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
  await Guard.deleteMany({});
  await expect(retire(a)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_INCONSISTENT' });
  expect((await Retirement.findOne()).state).toBe('INCONSISTENT'); expect(await store.read(a.storageKey)).toHaveLength(9);
});
test('T2-G-003 reference introduced after remote grant is quarantined before deleting bytes', async () => {
  const a = await asset(), c = command([a]); now += DAY;
  client.retire.mockImplementationOnce(async body => { await operations.prepare(c); return { ...body, state: 'granted' }; });
  await expect(retire(a)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_INCONSISTENT' });
  expect((await Retirement.findOne()).state).toBe('INCONSISTENT'); expect((await Asset.findById(a._id)).status).toBe('active');
  expect(await store.read(a.storageKey)).toHaveLength(9); expect(journal.persist).not.toHaveBeenCalled();
});
test.each(['prepare', 'abort'])('T2-G-004 late %s born terminal after deletion cannot poison original retirement replay', async action => {
  const a = await asset(); now += DAY; journal.persist.mockRejectedValueOnce(Error('synthetic journal pause'));
  await expect(retire(a)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
  const before = (await Retirement.findOne()).evidence, c = command([a]); now += 1;
  expect((await operations[action](c)).operation.state).toBe('ABORTED');
  expect((await retire(a)).state).toBe('PURGED');
  expect((await Retirement.findOne()).evidence).toEqual(before);
  expect((await operations.prepare(c)).operation.state).toBe('ABORTED');
});
test.each(['previous prepared', 'predeletion timestamp', 'other group reference'])
('T2-G-009 extra terminal with %s cannot bypass immutable deletion history', async kind => {
  const a = await asset(); now += DAY; journal.persist.mockRejectedValueOnce(Error('synthetic pause'));
  await expect(retire(a)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
  const c = command([a]); now += 1; await operations.prepare(c);
  if (kind === 'previous prepared') await Operation.updateOne({ operationId: c.operationId }, { $set: { version: 1 } });
  if (kind === 'predeletion timestamp') await Operation.updateOne({ operationId: c.operationId }, { $set: { terminalAt: new Date(START) } });
  if (kind === 'other group reference') await Reference.create({ familyId, childId, mediaId: id(), resourceType: c.resourceType,
    resourceId: c.resourceId, field: 'completionMediaIds', operationId: c.operationId, state: 'released',
    releasedAt: new Date(now), releaseOperationId: c.operationId });
  await expect(retire(a)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_INCONSISTENT' });
  expect(await store.read(a.storageKey)).toHaveLength(9);
});
test.each(['in_use', 'offline'])('T2-G-006 user tombstone supersedes CANDIDATE without remote %s grant', async outcome => {
  const a = await asset(); now += DAY; client.retire.mockImplementation(async b => ({ ...b, state: 'in_use' }));
  expect((await retire(a)).state).toBe('in_use');
  const privacy = createCompletionMediaPrivacyService({ transactionRunner: runner, journal, now: () => now });
  await privacy.deleteMedia({ identity: parent, mediaId: String(a._id) });
  const audit = await Tombstone.findOne().lean(); const calls = client.retire.mock.calls.length;
  if (outcome === 'offline') client.retire.mockRejectedValue(Error('synthetic outage'));
  expect((await retire(a)).state).toBe('SUPERSEDED'); expect(client.retire).toHaveBeenCalledTimes(calls);
  now += 31 * DAY;
  expect((await createCompletionMediaCleanupService({ transactionRunner: runner, journal, mediaStore: store, now: () => now })
    .cleanupDeletedMedia()).cleaned).toBe(1);
  expect(await Tombstone.findOne().lean()).toEqual(audit);
});
test('T2-G-006 system deletion between classification and privacy writer is reclassified once', async () => {
  const a = await asset(); now += DAY;
  const privacy = createCompletionMediaPrivacyService({ transactionRunner: runner, journal: { persist: async () => {} }, now: () => now });
  const original = privacy.deleteMedia;
  jest.spyOn(privacy, 'deleteMedia').mockImplementationOnce(async input => {
    journal.persist.mockRejectedValueOnce(Error('synthetic system journal pause'));
    await expect(retire(a)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
    return original(input);
  });
  const legacy = { deleteMedia: jest.fn() };
  const dispatch = createMediaDeletionDispatcher({ mediaService: legacy, privacyService: privacy, retirementService: make() });
  await dispatch({ identity: parent, mediaId: String(a._id) });
  expect((await Retirement.findOne()).state).toBe('PURGED'); expect(privacy.deleteMedia).toHaveBeenCalledTimes(1);
  expect(await Tombstone.countDocuments()).toBe(0); expect(legacy.deleteMedia).not.toHaveBeenCalled();
});
test.each(['DELETED', 'PURGED'].flatMap(stage => ['prepare', 'abort'].map(action => [stage, action])))
('T2-G-004 %s with A/B history retains exact evidence after late %s', async (stage, action) => {
  const a = await asset(), sibling = await asset(), aCommand = command([a, sibling]);
  await operations.prepare(aCommand); await operations.abort(aCommand);
  const b = { ...aCommand, operationId: randomUUID() }; await operations.prepare(b); await operations.abort(b);
  now += DAY;
  if (stage === 'DELETED') {
    journal.persist.mockRejectedValueOnce(Error('synthetic pause'));
    await expect(retire(a)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
  } else await retire(a);
  const evidence = (await Retirement.findOne()).evidence;
  expect(evidence.operations).toHaveLength(2); now += 1;
  const late = { ...aCommand, operationId: randomUUID() };
  expect((await operations[action](late)).operation.state).toBe('ABORTED');
  expect((await retire(a)).state).toBe('PURGED');
  expect((await Retirement.findOne()).evidence).toEqual(evidence);
  expect(await Operation.countDocuments()).toBe(3);
  expect(await Receipt.countDocuments()).toBe(0); expect(await store.read(sibling.storageKey)).toHaveLength(9);
});
test.each(['missing', 'modified'])('T2-G-009 late terminal cannot mask %s original A/B evidence', async change => {
  const a = await asset(), c = command([a]); await operations.prepare(c); await operations.abort(c);
  const b = { ...c, operationId: randomUUID() }; await operations.prepare(b); await operations.abort(b);
  now += DAY; journal.persist.mockRejectedValueOnce(Error('synthetic pause'));
  await expect(retire(a)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
  now += 1; await operations.prepare({ ...c, operationId: randomUUID() });
  if (change === 'missing') await Operation.deleteOne({ operationId: c.operationId });
  else await Operation.updateOne({ operationId: c.operationId }, { $set: { failureCode: 'MEDIA_OPERATION_EXPIRED' } });
  await expect(retire(a)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_INCONSISTENT' });
  expect(await store.read(a.storageKey)).toHaveLength(9);
});
test('T2-G-006 reclassification rechecks live permissions before system recovery', async () => {
  const a = await asset(); now += DAY;
  const privacy = createCompletionMediaPrivacyService({ transactionRunner: runner, journal: { persist: async () => {} } });
  const original = privacy.deleteMedia;
  jest.spyOn(privacy, 'deleteMedia').mockImplementationOnce(async input => {
    journal.persist.mockRejectedValueOnce(Error('synthetic pause')); await expect(retire(a)).rejects.toThrow();
    const result = original(input).catch(async cause => { await Family.updateOne({ _id: familyId }, { $set: { childIds: [] } }); throw cause; });
    return result;
  });
  const dispatch = createMediaDeletionDispatcher({ mediaService: { deleteMedia: jest.fn() }, privacyService: privacy, retirementService: make() });
  await expect(dispatch({ identity: parent, mediaId: String(a._id) })).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  expect((await Retirement.findOne()).state).toBe('DELETED'); expect(await store.read(a.storageKey)).toHaveLength(9);
});
test.each(['journal', 'remove', 'directory'])('T2-G-005 %s acknowledgement is awaited before the next destructive stage', async stage => {
  const a = await asset(); now += DAY;
  let release, entered, durable = false, removing = false, removed = false, synced = false;
  const gate = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { entered = resolve; });
  const wait = async name => { if (stage === name) { entered(); await gate; } };
  const inflight = [];
  const tracked = fn => (...args) => { const work = fn(...args); inflight.push(work); work.catch(() => {}); return work; };
  const orderedJournal = { persist: tracked(async () => { await wait('journal'); durable = true; }) };
  const orderedStore = { ...store, remove: tracked(async key => {
    expect(durable).toBe(true); removing = true; await wait('remove'); await store.remove(key); removed = true;
  }), syncDirectory: tracked(async () => {
    expect(removed).toBe(true); await wait('directory'); await store.syncDirectory(); synced = true;
  }) };
  const orderedRunner = work => {
    if (removing) expect(synced).toBe(true);
    return runner(work);
  };
  const operation = retire(a, make({ transactionRunner: orderedRunner, journal: orderedJournal, mediaStore: orderedStore }))
    .then(value => ({ value }), error => ({ error }));
  try {
    await Promise.race([ready, operation.then(() => { throw Error('Expected durability barrier was bypassed'); })]);
    expect((await Retirement.findOne()).state).toBe('DELETED'); expect(await Asset.countDocuments()).toBe(1);
  } finally { release(); }
  const outcome = await operation; await Promise.allSettled(inflight);
  expect(outcome).toEqual({ value: { state: 'PURGED' } });
});
test('T2-G-006 conflicting user and system deletion evidence is never retried as an ordinary race', async () => {
  const a = await asset(); now += DAY; journal.persist.mockRejectedValueOnce(Error('synthetic pause'));
  await expect(retire(a)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
  await Tombstone.create({ mediaId: a._id, familyId, childId, actorId: parent.id, role: 'parent',
    purpose: 'task_completion', reason: 'user_requested', deletedAt: new Date(now) });
  const system = { deleteMedia: jest.fn() }, privacy = { deleteMedia: jest.fn() }, legacy = { deleteMedia: jest.fn() };
  const dispatch = createMediaDeletionDispatcher({ mediaService: legacy, privacyService: privacy, retirementService: system });
  await expect(dispatch({ identity: parent, mediaId: String(a._id) })).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_INCONSISTENT' });
  for (const service of [system, privacy, legacy]) expect(service.deleteMedia).not.toHaveBeenCalled();
  expect(await store.read(a.storageKey)).toHaveLength(9);
});

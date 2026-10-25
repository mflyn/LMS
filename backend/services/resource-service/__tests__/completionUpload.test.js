const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('../../../../node_modules/mongodb-memory-server');
const Asset = require('../models/MediaAsset');
const Family = require('../../../common/models/Family');
const User = require('../models/FamilyUser');
const Guard = require('../models/CompletionUploadGuard');
const Tombstone = require('../models/MediaDeletionTombstone');
const Reference = require('../models/MediaReference');
const { createMediaService } = require('../services/mediaService');
const { createCompletionUploadService } = require('../services/completionUploadService');
const { createCompletionUploadJournal } = require('../services/completionUploadJournal');
const { createPrivateMediaStore } = require('../services/privateMediaStore');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const { createCompletionMediaPrivacyService } = require('../services/completionMediaPrivacyService');
const { createMediaDeletionJournal } = require('../services/mediaDeletionJournal');

jest.setTimeout(30000);
const id = () => new mongoose.Types.ObjectId();
const START = Date.parse('2026-10-23T00:00:00Z');
let mongo, root, store, journal, runner, identity, scope, metadata, time;
const make = options => createCompletionUploadService({ transactionRunner: runner, mediaStore: store, journal,
  now: () => time, ...options });
const readRecord = async () => {
  const files = (await fs.readdir(path.join(root, 'uploads'))).filter(f => f.endsWith('.json'));
  expect(files).toHaveLength(1);
  return JSON.parse(await fs.readFile(path.join(root, 'uploads', files[0]), 'utf8'));
};
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri());
  for (const model of [Asset, Family, User, Guard, Tombstone]) await model.init();
  runner = createMongoTransactionRunner(mongoose.connection);
});
beforeEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 't2-upload-')));
  store = createPrivateMediaStore({ root: path.join(root, 'media') });
  journal = createCompletionUploadJournal({ root: path.join(root, 'uploads') });
  const child = id(), family = id(), parent = id(); time = START;
  identity = { id: String(parent), role: 'parent' };
  await Family.create({ _id: family, familyName: 'Synthetic upload', ownerParentId: parent,
    memberParentIds: [parent], childIds: [child] });
  await User.create([{ _id: parent, role: 'parent' }, { _id: child, role: 'student', familyId: family,
    childProfile: { tokenVersion: 0 } }]);
  scope = { familyId: String(family), childId: String(child), actorId: String(parent) };
  const stored = await store.writeCanonical(Buffer.from('synthetic-image'));
  metadata = { familyId: scope.familyId, childId: scope.childId, uploadedBy: scope.actorId,
    purpose: 'task_completion', mimeType: 'image/jpeg', displayName: 'private-original-name.jpg',
    sizeBytes: 15, pageCount: null, storageKey: stored.storageKey,
    malwareScanStatus: 'skipped_trusted_local', malwareScannedAt: null };
});
afterEach(async () => { if (root) await fs.rm(root, { recursive: true, force: true }); });
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test('T2-G-010 persists fixed identity before metadata, excludes original name, and retains at least 24 hours', async () => {
  const service = make();
  const asset = await service.upload({ identity, metadata });
  const record = await readRecord();
  expect(String(asset._id)).toBe(record.mediaId);
  expect(asset.storageKey).toBe(metadata.storageKey);
  expect(asset.orphanEligibleAt).toEqual(new Date(START + 86400000));
  expect(asset.retentionPolicyVersion).toBe(1);
  expect(JSON.stringify(record)).not.toContain('private-original-name');
  expect(await Guard.findOne({ mediaId: asset._id }).lean()).toMatchObject({ state: 'REGISTERED', revision: 1 });
  const before = await Asset.find().lean(), guard = await Guard.find().lean();
  time += 3600000;
  expect(String((await make().resume(record))._id)).toBe(String(asset._id));
  expect(await Asset.find().lean()).toEqual(before); expect(await Guard.find().lean()).toEqual(guard);
});

test('T2-G-010 post-commit acknowledgement loss preserves body and recovers same ID', async () => {
  let first = true;
  const service = make({ transactionRunner: async work => {
    const result = await runner(work);
    if (first) { first = false; throw Error('synthetic committed acknowledgement loss'); }
    return result;
  } });
  await expect(service.upload({ identity, metadata })).rejects.toMatchObject({ code: 'MEDIA_UPLOAD_PENDING' });
  const record = await readRecord();
  expect(await store.read(metadata.storageKey)).toEqual(Buffer.from('synthetic-image'));
  expect(await Asset.countDocuments()).toBe(1);
  const asset = await make().resume(record);
  expect(String(asset._id)).toBe(record.mediaId); expect(await Asset.countDocuments()).toBe(1);
  expect(await Guard.countDocuments()).toBe(1);
});

test('T2-G-010 rollback and missing metadata keep body; delayed fixed-ID recreation receives a new full grace period', async () => {
  const service = make({ transactionRunner: work => runner(async session => {
    await work(session); throw Error('synthetic rollback');
  }) });
  await expect(service.upload({ identity, metadata })).rejects.toMatchObject({ code: 'MEDIA_UPLOAD_PENDING' });
  expect(await Asset.countDocuments()).toBe(0); expect(await Guard.countDocuments()).toBe(0);
  expect(await store.read(metadata.storageKey)).toEqual(Buffer.from('synthetic-image'));
  const record = await readRecord(); time += 3 * 86400000;
  const asset = await make().resume(record);
  expect(String(asset._id)).toBe(record.mediaId);
  expect(asset.orphanEligibleAt).toEqual(new Date(time + 86400000));
});

test('T2-G-010 journal failure precedes any metadata write and removes only the pre-write body', async () => {
  const service = make({ journal: { persist: async () => { throw Error('synthetic fsync failure'); } } });
  await expect(service.upload({ identity, metadata })).rejects.toMatchObject({ code: 'MEDIA_UPLOAD_PENDING' });
  expect(await Asset.countDocuments()).toBe(0); expect(await Guard.countDocuments()).toBe(0);
  await expect(store.read(metadata.storageKey)).rejects.toThrow();
});

test('T2-G-010 revoked uploader cannot recreate absent metadata from the durable record', async () => {
  const service = make({ transactionRunner: async () => { throw Error('synthetic database unavailable'); } });
  await expect(service.upload({ identity, metadata })).rejects.toMatchObject({ code: 'MEDIA_UPLOAD_PENDING' });
  const record = await readRecord();
  await User.deleteOne({ _id: identity.id });
  await expect(make().resume(record)).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED' });
  expect(await Asset.countDocuments()).toBe(0); expect(await Guard.countDocuments()).toBe(0);
  expect(await store.read(metadata.storageKey)).toEqual(Buffer.from('synthetic-image'));
});

test('T2-G-010 privacy deletion and metadata cleanup prevent resurrection by an old upload record', async () => {
  const asset = await make().upload({ identity, metadata }), record = await readRecord();
  const privacy = createCompletionMediaPrivacyService({ transactionRunner: runner,
    journal: createMediaDeletionJournal({ root: path.join(root, 'deletions') }) });
  await privacy.deleteMedia({ identity, mediaId: String(asset._id) });
  const guard = await Guard.findOne({ mediaId: asset._id }).lean();
  expect(guard.state).toBe('RETIRED');
  await Asset.deleteOne({ _id: asset._id });
  await expect(make().resume(record)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  expect(await Asset.countDocuments()).toBe(0);
  expect(await Guard.findOne({ mediaId: asset._id }).lean()).toEqual(guard);
});

test('T2-G-010 deleted terminal takes priority even after the physical body has been removed', async () => {
  const asset = await make().upload({ identity, metadata }), record = await readRecord();
  const privacy = createCompletionMediaPrivacyService({ transactionRunner: runner,
    journal: createMediaDeletionJournal({ root: path.join(root, 'deletions') }) });
  await privacy.deleteMedia({ identity, mediaId: String(asset._id) });
  await store.remove(asset.storageKey); await Asset.deleteOne({ _id: asset._id });
  await expect(make().resume(record)).rejects.toMatchObject({ statusCode: 404, code: 'RESOURCE_NOT_FOUND' });
  expect(await Asset.countDocuments()).toBe(0);
});

test('T2-G-010 deletion after metadata commit before its acknowledgement prevents a stale upload success', async () => {
  let deleted = false;
  const privacy = createCompletionMediaPrivacyService({ transactionRunner: runner,
    journal: createMediaDeletionJournal({ root: path.join(root, 'deletions') }) });
  const service = make({ transactionRunner: async work => {
    const result = await runner(work);
    if (!deleted && result?._id) {
      deleted = true;
      await privacy.deleteMedia({ identity, mediaId: String(result._id) });
    }
    return result;
  } });
  await expect(service.upload({ identity, metadata })).rejects.toMatchObject({ statusCode: 404, code: 'RESOURCE_NOT_FOUND' });
  expect(deleted).toBe(true);
  expect((await Asset.findOne()).status).toBe('deleted');
  expect((await Guard.findOne()).state).toBe('RETIRED');
});

test('T2-G-010 competing recreation attempts reuse one durable identity and one guard', async () => {
  await expect(make({ transactionRunner: async () => { throw Error('synthetic database unavailable'); } })
    .upload({ identity, metadata })).rejects.toMatchObject({ code: 'MEDIA_UPLOAD_PENDING' });
  const record = await readRecord();
  const assets = await Promise.all([make().resume(record), make().resume(record)]);
  expect(assets.map(asset => String(asset._id))).toEqual([record.mediaId, record.mediaId]);
  expect(await Asset.countDocuments()).toBe(1); expect(await Guard.countDocuments()).toBe(1);
});

test('T2-G-010 registered guard without asset is inconsistent, not permission to recreate', async () => {
  const asset = await make().upload({ identity, metadata }), record = await readRecord();
  await Asset.deleteOne({ _id: asset._id });
  const before = await Guard.find().lean();
  await expect(make().resume(record)).rejects.toMatchObject({ code: 'MEDIA_UPLOAD_PENDING' });
  expect(await Asset.countDocuments()).toBe(0); expect(await Guard.find().lean()).toEqual(before);
  expect(await store.read(metadata.storageKey)).toEqual(Buffer.from('synthetic-image'));
});

test('T2-G-010 media upload adapter preserves canonical body after completion metadata commit loses acknowledgement', async () => {
  const uploader = make({ transactionRunner: async work => { await runner(work); throw Error('synthetic unknown commit'); } });
  const service = createMediaService({ MediaAssetModel: Asset, MediaReferenceModel: Reference, FamilyModel: Family,
    UserModel: User, mediaStore: store, transactionRunner: runner, completionUploadService: uploader,
    capabilityService: { issue() {}, verify() {} }, processor: { prepare: async () => ({
      buffer: Buffer.from('synthetic-image'), mimeType: 'image/jpeg', displayName: 'private-original.jpg', sizeBytes: 15, pageCount: null
    }) } });
  await expect(service.upload({ identity, suppliedChildId: metadata.childId, purpose: 'task_completion',
    bytes: Buffer.from('synthetic-image'), originalName: 'private-original.jpg' })).rejects.toMatchObject({ code: 'MEDIA_UPLOAD_PENDING' });
  const record = await readRecord(), asset = await Asset.findById(record.mediaId).lean();
  expect(asset.storageKey).toBe(record.metadata.storageKey);
  expect(await store.read(asset.storageKey)).toEqual(Buffer.from('synthetic-image'));
  expect(asset.retentionPolicyVersion).toBe(1);
});

const interceptSync = (kind, action) => {
  const open = fs.open;
  const state = { closedBeforeSync: false };
  jest.spyOn(fs, 'open').mockImplementation(async (filename, ...args) => {
    const handle = await open(filename, ...args);
    const match = kind === 'file' ? String(filename).endsWith('.tmp')
      : kind === 'directory' ? filename === path.join(root, 'uploads') : filename === root;
    if (match) {
      const sync = handle.sync.bind(handle), close = handle.close.bind(handle);
      let pending = false;
      handle.sync = async () => {
        pending = true;
        try {
          await action();
          // A mutant closing early is asserted below, not left as an unhandled rejection.
          if (handle.fd !== -1) await sync();
        } finally { pending = false; }
      };
      handle.close = async () => { if (pending) state.closedBeforeSync = true; return close(); };
    }
    return handle;
  });
  return state;
};
test.each(['file', 'directory', 'parent'])('T2-G-010 %s fsync failure prevents metadata writes', async kind => {
  let hit = false;
  interceptSync(kind, async () => { hit = true; throw Error('synthetic fsync failure'); });
  await expect(make().upload({ identity, metadata })).rejects.toMatchObject({ code: 'MEDIA_UPLOAD_PENDING' });
  expect(hit).toBe(true);
  expect(await Asset.countDocuments()).toBe(0); expect(await Guard.countDocuments()).toBe(0);
  await expect(store.read(metadata.storageKey)).rejects.toThrow();
});
test.each(['file', 'directory', 'parent'])('T2-G-010 metadata creation waits for %s fsync', async kind => {
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { entered = resolve; });
  const state = interceptSync(kind, async () => { entered(); await gate; });
  const uploading = make().upload({ identity, metadata });
  try {
    await Promise.race([ready, uploading.then(() => { throw Error('Upload bypassed durable journal sync'); })]);
    expect(await Asset.countDocuments()).toBe(0); expect(await Guard.countDocuments()).toBe(0);
  } finally { release(); }
  expect((await uploading).status).toBe('active');
  expect(state.closedBeforeSync).toBe(false);
});

const bodyUploadAdapter = () => {
  const persist = jest.spyOn(journal, 'persist');
  const upload = jest.fn(make().upload);
  const service = createMediaService({ MediaAssetModel: Asset, MediaReferenceModel: Reference, FamilyModel: Family,
    UserModel: User, mediaStore: store, transactionRunner: runner, completionUploadService: { upload },
    capabilityService: { issue() {}, verify() {} }, processor: { prepare: async () => ({
      buffer: Buffer.from('synthetic-image'), mimeType: 'image/jpeg', displayName: 'synthetic.jpg', sizeBytes: 15, pageCount: null
    }) } });
  return { persist, upload, start: () => service.upload({ identity, suppliedChildId: scope.childId,
    purpose: 'task_completion', bytes: Buffer.from('synthetic-image'), originalName: 'synthetic.jpg' }) };
};
const interceptBodySync = (kind, action) => {
  const open = fs.open, state = { closedBeforeSync: false, hits: 0 };
  jest.spyOn(fs, 'open').mockImplementation(async (filename, ...args) => {
    const handle = await open(filename, ...args), mediaRoot = path.join(root, 'media');
    if (kind === 'file' ? path.dirname(filename) === mediaRoot && filename.endsWith('.tmp') : filename === mediaRoot) {
      const sync = handle.sync.bind(handle), close = handle.close.bind(handle);
      let pending = false;
      handle.sync = async () => {
        pending = true; state.hits += 1;
        try { await action(state.hits); if (handle.fd !== -1) await sync(); } finally { pending = false; }
      };
      handle.close = async () => { if (pending) state.closedBeforeSync = true; await close(); };
    }
    return handle;
  });
  return state;
};
test.each(['file', 'directory'])('actual body %s sync failure prevents upload journal and metadata dispatch', async kind => {
  const originalFiles = await fs.readdir(path.join(root, 'media'));
  const state = interceptBodySync(kind, async count => { if (count === 1) throw Error('synthetic body sync failed'); });
  const adapter = bodyUploadAdapter();
  await expect(adapter.start()).rejects.toThrow('synthetic body sync failed');
  expect(state.hits).toBeGreaterThan(0);
  expect(adapter.persist).not.toHaveBeenCalled(); expect(adapter.upload).not.toHaveBeenCalled();
  expect(await Asset.countDocuments()).toBe(0); expect(await Guard.countDocuments()).toBe(0);
  expect(await fs.readdir(path.join(root, 'media'))).toEqual(originalFiles);
});
test.each(['file', 'directory'])('actual body waits for %s sync before upload journal and metadata dispatch', async kind => {
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; }), ready = new Promise(resolve => { entered = resolve; });
  const state = interceptBodySync(kind, async () => { entered(); await gate; });
  const adapter = bodyUploadAdapter(), uploading = adapter.start();
  try {
    await Promise.race([ready, uploading]);
    expect(state.hits).toBeGreaterThan(0);
    // Let a missing await advance; database checks also yield to real I/O before checking dispatch.
    expect(await Asset.countDocuments()).toBe(0); expect(await Guard.countDocuments()).toBe(0);
    expect(adapter.persist).not.toHaveBeenCalled(); expect(adapter.upload).not.toHaveBeenCalled();
    expect(state.closedBeforeSync).toBe(false);
  } finally { release(); await uploading; }
  expect(state.closedBeforeSync).toBe(false);
  expect(adapter.persist).toHaveBeenCalledTimes(1); expect(adapter.upload).toHaveBeenCalledTimes(1);
  expect(await Asset.countDocuments()).toBe(1); expect(await Guard.countDocuments()).toBe(1);
});

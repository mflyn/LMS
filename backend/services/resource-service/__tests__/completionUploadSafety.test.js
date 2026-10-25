const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('../../../../node_modules/mongodb-memory-server');
const Asset = require('../models/MediaAsset');
const Family = require('../../../common/models/Family');
const User = require('../models/FamilyUser');
const Guard = require('../models/CompletionUploadGuard');
const Tombstone = require('../models/MediaDeletionTombstone');
const Retirement = require('../models/MediaOrphanRetirement');
const { canonicalMetadata, hash, validateRecord } = require('../services/completionUploadRecord');
const { retireUploadGuard } = require('../services/completionUploadGuardService');
const { createCompletionUploadService } = require('../services/completionUploadService');
const { createCompletionUploadJournal } = require('../services/completionUploadJournal');
const { createPrivateMediaStore } = require('../services/privateMediaStore');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const { createCompletionMediaPrivacyService } = require('../services/completionMediaPrivacyService');
const { createMediaDeletionJournal } = require('../services/mediaDeletionJournal');
jest.setTimeout(30000);
const id = () => new mongoose.Types.ObjectId();
let mongo, root, store, journal, runner, parent, child, familyId, metadata;
const make = options => createCompletionUploadService({ transactionRunner: runner, mediaStore: store, journal, ...options });
const privacy = options => createCompletionMediaPrivacyService({ transactionRunner: runner,
  journal: createMediaDeletionJournal({ root: path.join(root, 'deletions') }), ...options });
const readRecord = async () => {
  const files = (await fs.readdir(path.join(root, 'uploads'))).filter(f => f.endsWith('.json'));
  expect(files).toHaveLength(1);
  return JSON.parse(await fs.readFile(path.join(root, 'uploads', files[0]), 'utf8'));
};
const snapshot = () => Promise.all([Asset, Guard, Tombstone].map(m => m.collection.find().sort({ _id: 1 }).toArray()));
const isolatedRecord = async (identity = parent) => {
  await expect(make({ transactionRunner: async () => { throw Error('synthetic offline database'); } })
    .upload({ identity, metadata })).rejects.toMatchObject({ code: 'MEDIA_UPLOAD_PENDING' });
  return readRecord();
};
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri());
  for (const model of Object.values(mongoose.models)) await model.init();
  runner = createMongoTransactionRunner(mongoose.connection);
});
beforeEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 't2-upload-safety-')));
  store = createPrivateMediaStore({ root: path.join(root, 'media') });
  journal = createCompletionUploadJournal({ root: path.join(root, 'uploads') });
  parent = { id: String(id()), role: 'parent' }; familyId = id();
  child = { id: String(id()), role: 'student', tokenVersion: 0 };
  const owner = id();
  await Family.create({ _id: familyId, familyName: 'Synthetic safety', ownerParentId: owner,
    memberParentIds: [owner, parent.id], childIds: [child.id] });
  await User.create([{ _id: parent.id, role: 'parent' }, { _id: child.id, familyId, role: 'student', childProfile: { tokenVersion: 0 } }]);
  const stored = await store.writeCanonical(Buffer.from('synthetic-image'));
  metadata = { familyId: String(familyId), childId: child.id, uploadedBy: parent.id, purpose: 'task_completion',
    mimeType: 'image/jpeg', displayName: 'private-name.jpg', sizeBytes: 15, pageCount: null,
    storageKey: stored.storageKey, malwareScanStatus: 'skipped_trusted_local', malwareScannedAt: null };
});
afterEach(async () => { jest.restoreAllMocks(); if (root) await fs.rm(root, { recursive: true, force: true }); });
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test('T2-G-010 historical uppercase storage key remains deletable without changing its path', async () => {
  const storageKey = randomUUID().toUpperCase();
  const asset = await Asset.create({ ...metadata, storageKey });
  await privacy().deleteMedia({ identity: parent, mediaId: String(asset._id) });
  expect((await Guard.findOne()).storageKey).toBe(storageKey);
  expect((await Asset.findById(asset._id)).status).toBe('deleted');
});
test.each([undefined, null])('T2-G-010 scan status %s must be rejected before publishing a recovery record', async status => {
  const canonical = canonicalMetadata({ ...metadata, malwareScanStatus: status });
  const record = { version: 1, mediaId: String(id()), identity: parent, metadata: canonical, metadataHash: hash(canonical) };
  await expect(validateRecord(record)).rejects.toThrow();
  await expect(journal.persist(record)).rejects.toThrow();
  expect(await fs.readdir(path.join(root, 'uploads')).catch(() => [])).toEqual([]);
});
test('T2-G-010 valid record survives JSON roundtrip with unchanged digest', async () => {
  const record = await isolatedRecord();
  expect(await validateRecord(JSON.parse(JSON.stringify(record)))).toEqual(record);
});
test('T2-G-010 production transaction runner uses primary snapshot reads and majority commits', async () => {
  const startSession = mongoose.connection.startSession.bind(mongoose.connection), options = [];
  jest.spyOn(mongoose.connection, 'startSession').mockImplementation(async (...args) => {
    const session = await startSession(...args), transact = session.withTransaction.bind(session);
    session.withTransaction = (work, config) => { options.push(config); return transact(work, config); };
    return session;
  });
  const asset = await make().upload({ identity: parent, metadata });
  expect(asset.status).toBe('active');
  expect(options.length).toBeGreaterThanOrEqual(2);
  for (const config of options) expect(config).toMatchObject({
    readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary'
  });
});
test('T2-G-010 equivalent uppercase BSON identities normalize before hashing and remain recoverable', async () => {
  const upper = { ...metadata, familyId: metadata.familyId.toUpperCase(), childId: metadata.childId.toUpperCase(),
    uploadedBy: metadata.uploadedBy.toUpperCase() };
  const asset = await make().upload({ identity: { ...parent, id: parent.id.toUpperCase() }, metadata: upper });
  const record = await readRecord();
  expect(record.metadata.familyId).toBe(metadata.familyId);
  expect(record.identity.id).toBe(parent.id);
  expect(String((await make().resume(record))._id)).toBe(String(asset._id));
});

test.each(['pending', 'active'].flatMap(stage => ['parent removed', 'child moved', 'child removed', 'token rotated'].map(change => [stage, change])))
('T2-G-010 %s upload rejects %s without changing stored media or retention', async (stage, change) => {
  const identity = change === 'parent removed' ? parent : child;
  metadata.uploadedBy = identity.id;
  if (stage === 'active') await make().upload({ identity, metadata });
  else await isolatedRecord(identity);
  const record = await readRecord();
  if (change === 'parent removed') await Family.updateOne({ _id: familyId }, { $pull: { memberParentIds: parent.id } });
  if (change === 'child moved') await User.updateOne({ _id: child.id }, { $set: { familyId: id() } });
  if (change === 'child removed') await Family.updateOne({ _id: familyId }, { $set: { childIds: [] } });
  if (change === 'token rotated') await User.updateOne({ _id: child.id }, { $inc: { 'childProfile.tokenVersion': 1 } });
  const before = await snapshot();
  await expect(make().resume(record)).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED' });
  expect(await snapshot()).toEqual(before);
  expect(await store.read(metadata.storageKey)).toEqual(Buffer.from('synthetic-image'));
});

test('T2-G-010 RETIRED upload guard alone prevents resurrection after metadata, tombstone and body are absent', async () => {
  const asset = await make().upload({ identity: parent, metadata }), record = await readRecord();
  await privacy().deleteMedia({ identity: parent, mediaId: String(asset._id) });
  await Asset.deleteMany({}); await Tombstone.deleteMany({}); await store.remove(metadata.storageKey);
  const before = await snapshot();
  await expect(make().resume(record)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  expect(await snapshot()).toEqual(before);
});
test('T2-G-010 system retirement prevents resurrection even when metadata and upload guard are missing', async () => {
  await make().upload({ identity: parent, metadata }); const record = await readRecord();
  await Retirement.collection.insertOne({ mediaId: new mongoose.Types.ObjectId(record.mediaId), familyId, childId: new mongoose.Types.ObjectId(child.id),
    retirementId: randomUUID(), storageKey: metadata.storageKey, state: 'PURGED' });
  await Asset.deleteMany({}); await Guard.deleteMany({});
  await expect(make().resume(record)).rejects.toMatchObject({ code: 'MEDIA_UPLOAD_PENDING' });
  expect(await Asset.countDocuments()).toBe(0);
});
test('T2-G-010 rolled-back privacy deletion also rolls back the new retired guard', async () => {
  const asset = await make().upload({ identity: parent, metadata });
  const before = await snapshot();
  const failing = privacy({ transactionRunner: work => runner(async session => {
    await work(session); throw Error('synthetic privacy rollback');
  }) });
  await expect(failing.deleteMedia({ identity: parent, mediaId: String(asset._id) })).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect(await snapshot()).toEqual(before);
  expect(await store.read(metadata.storageKey)).toEqual(Buffer.from('synthetic-image'));
});

test('T2-G-010 immutable journal replay retains permissions and rejects conflicting identity content', async () => {
  const record = await isolatedRecord(), filename = path.join(root, 'uploads', record.mediaId + '.json');
  const content = await fs.readFile(filename, 'utf8');
  await journal.persist(record);
  expect(await fs.readFile(filename, 'utf8')).toBe(content);
  expect((await fs.stat(path.join(root, 'uploads'))).mode & 0o777).toBe(0o700);
  expect((await fs.stat(filename)).mode & 0o777).toBe(0o600);
  const modified = { ...record.metadata, sizeBytes: 16 };
  await expect(journal.persist({ ...record, metadata: modified, metadataHash: hash(modified) })).rejects.toThrow();
  expect(await fs.readFile(filename, 'utf8')).toBe(content);
  expect((await fs.readdir(path.join(root, 'uploads'))).filter(f => f.endsWith('.tmp'))).toEqual([]);
});
test.each(['root', 'destination'])('T2-G-010 journal rejects %s symlink without touching target', async kind => {
  const record = await isolatedRecord(), target = path.join(root, 'uploads', record.mediaId + '.json');
  const content = await fs.readFile(target, 'utf8');
  let candidate = journal;
  if (kind === 'root') {
    const link = path.join(root, 'linked-uploads'); await fs.symlink(path.join(root, 'uploads'), link);
    candidate = createCompletionUploadJournal({ root: link });
  } else {
    const original = path.join(root, 'original.json');
    await fs.rename(target, original); await fs.symlink(original, target);
  }
  await expect(candidate.persist(record)).rejects.toThrow();
  expect(await fs.readFile(target, 'utf8')).toBe(content);
});

test('T2-G-010 controlled retirement/create overlap retries the same fixed identity and honors RETIRED', async () => {
  const record = await isolatedRecord();
  let release, entered, attempted;
  const gate = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { entered = resolve; });
  const touched = new Promise(resolve => { attempted = resolve; });
  const retirement = runner(async session => {
    await retireUploadGuard({ _id: record.mediaId, ...record.metadata }, session);
    entered(); await gate;
  });
  await ready;
  const original = Guard.findOneAndUpdate;
  const probe = jest.spyOn(Guard, 'findOneAndUpdate').mockImplementation(function (...args) {
    const query = original.apply(this, args), exec = query.exec;
    query.exec = function (...values) { const result = exec.apply(this, values); attempted(); return result; };
    return query;
  });
  let attempts = 0;
  const uploading = make({ transactionRunner: work => runner(session => { attempts += 1; return work(session); }) })
    .resume(record).then(value => ({ value }), reason => ({ reason }));
  let failure;
  try {
    await Promise.race([touched, uploading.then(() => { throw Error('Create bypassed shared guard'); })]);
  } catch (cause) { failure = cause; } finally { release(); probe.mockRestore(); }
  await retirement;
  const outcome = await uploading;
  if (failure) throw failure;
  expect(outcome).toMatchObject({ reason: { code: 'RESOURCE_NOT_FOUND' } });
  expect(attempts).toBeGreaterThanOrEqual(2);
  expect(await Asset.countDocuments()).toBe(0); expect((await Guard.findOne()).state).toBe('RETIRED');
});

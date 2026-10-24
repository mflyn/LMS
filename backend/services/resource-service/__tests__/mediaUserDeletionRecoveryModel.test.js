const { randomUUID, createHash } = require('crypto');
const { canonicalize } = require('json-canonicalize');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('../../../../node_modules/mongodb-memory-server');
const Recovery = require('../models/MediaUserDeletionRecovery');

test('UDR-010 canonical evidence encoding is included in the production dependency closure', () => {
  const manifest = require('../../../../package.json');
  const lock = require('../../../../package-lock.json');
  expect(manifest.dependencies['json-canonicalize']).toBe('3.0.0');
  expect(manifest.devDependencies['json-canonicalize']).toBeUndefined();
  expect(lock.packages[''].dependencies['json-canonicalize']).toBe('3.0.0');
  expect(lock.packages[''].devDependencies['json-canonicalize']).toBeUndefined();
  expect(lock.packages['node_modules/json-canonicalize']).toMatchObject({ version: '3.0.0' });
  expect(lock.packages['node_modules/json-canonicalize'].dev).not.toBe(true);
});

jest.setTimeout(30000);
const id = () => String(new mongoose.Types.ObjectId());
const fixture = () => {
  const mediaId = id(), familyId = id(), childId = id();
  const createdAt = '2026-10-23T01:00:00.000Z';
  const unsigned = { version: 2, evidenceId: randomUUID(), evidenceCreatedAt: createdAt,
    tombstone: { _id: id(), mediaId, familyId, childId, actorId: id(), role: 'parent',
      purpose: 'task_completion', reason: 'user_requested', deletedAt: createdAt },
    uploadIdentity: { mediaId, familyId, childId, storageKey: randomUUID(), metadataHash: 'b'.repeat(64) },
    operations: [], referenceEffects: [], receipts: [] };
  const evidence = { ...unsigned, evidenceHash: createHash('sha256').update(canonicalize(unsigned)).digest('hex') };
  return { _id: evidence.evidenceId, mediaId, familyId, childId, version: 2,
    evidence, evidenceHash: evidence.evidenceHash, createdAt: new Date(createdAt) };
};
let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri());
  await Recovery.init();
});
beforeEach(async () => { await Recovery.collection.deleteMany({}); });
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test('UDR-001 persists original evidence UUID/time and complete proof without generated audit fields', async () => {
  const value = fixture(); await Recovery.create(value);
  const stored = await Recovery.collection.findOne({ _id: value._id });
  expect(stored).toEqual({ ...value, mediaId: new mongoose.Types.ObjectId(value.mediaId),
    familyId: new mongoose.Types.ObjectId(value.familyId), childId: new mongoose.Types.ObjectId(value.childId) });
});
test('UDR-009 reconstruction timestamp does not replace original evidence time', async () => {
  const value = { ...fixture(), restoredAt: new Date('2026-10-24T01:00:00.000Z') };
  await Recovery.create(value);
  const stored = await Recovery.findById(value._id).lean();
  expect(stored.createdAt).toEqual(value.createdAt);
  expect(stored.restoredAt).toEqual(value.restoredAt);
  expect(stored.evidence.evidenceCreatedAt).toBe('2026-10-23T01:00:00.000Z');
});
test('UDR-007 media uniqueness prevents a second deletion proof even with another evidence UUID', async () => {
  const first = fixture(); await Recovery.create(first);
  const second = { ...first, evidence: JSON.parse(JSON.stringify(first.evidence)) };
  second._id = randomUUID(); second.evidence.evidenceId = second._id;
  const { evidenceHash: _hash, ...unsigned } = second.evidence;
  second.evidenceHash = second.evidence.evidenceHash = createHash('sha256').update(canonicalize(unsigned)).digest('hex');
  await expect(Recovery.create(second)).rejects.toMatchObject({ code: 11000 });
  expect(await Recovery.countDocuments()).toBe(1);
});
test('UDR-007 evidence UUID collision cannot replace another media proof', async () => {
  const first = fixture(); await Recovery.create(first);
  const second = fixture(); second._id = first._id; second.evidence.evidenceId = first._id;
  const { evidenceHash: _hash, ...unsigned } = second.evidence;
  second.evidenceHash = second.evidence.evidenceHash = createHash('sha256').update(canonicalize(unsigned)).digest('hex');
  await expect(Recovery.create(second)).rejects.toMatchObject({ code: 11000 });
  expect((await Recovery.findById(first._id).lean()).evidence).toEqual(first.evidence);
});

test.each([
  ['missing UUID', value => { delete value._id; }],
  ['wrong UUID', value => { value._id = randomUUID(); }],
  ['wrong media', value => { value.mediaId = id(); }],
  ['wrong family', value => { value.familyId = id(); }],
  ['wrong child', value => { value.childId = id(); }],
  ['wrong digest', value => { value.evidenceHash = 'c'.repeat(64); }],
  ['wrong original time', value => { value.createdAt = new Date('2026-10-24'); }],
  ['wrong version', value => { value.version = 1; }],
  ['missing proof', value => { delete value.evidence; }],
  ['extra proof field', value => { value.evidence.privateNote = 'synthetic'; }],
  ['tampered proof', value => { value.evidence.uploadIdentity.metadataHash = 'c'.repeat(64); }],
  ['reconstruction before evidence', value => { value.restoredAt = new Date('2026-10-22'); }]
])('UDR-007 rejects %s without persistence', async (_name, mutate) => {
  const value = fixture(); mutate(value);
  await expect(Recovery.create(value)).rejects.toThrow();
  expect(await Recovery.countDocuments()).toBe(0);
});

test.each(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace',
  'deleteOne', 'deleteMany', 'findOneAndDelete', 'bulkWrite', 'save'])
('UDR-008 append-only model rejects %s including validation-bypass options', async method => {
  const value = fixture(), document = await Recovery.create(value);
  const before = await Recovery.collection.findOne({ _id: value._id });
  let change;
  if (method === 'save') {
    document.evidence.tombstone.actorId = id(); document.markModified('evidence');
    change = document.save({ validateBeforeSave: false });
  } else if (method === 'bulkWrite') {
    change = Recovery.bulkWrite([{ deleteOne: { filter: { _id: value._id } } }]);
  } else if (method.startsWith('delete') || method === 'findOneAndDelete') {
    change = Recovery[method]({ _id: value._id });
  } else {
    const update = method.includes('Replace') || method === 'replaceOne'
      ? { ...value, createdAt: new Date() } : { $set: { evidenceHash: 'c'.repeat(64) } };
    change = Recovery[method]({ _id: value._id }, update, { runValidators: false, overwriteImmutable: true });
  }
  await expect(change).rejects.toMatchObject({ code: 'USER_DELETION_EVIDENCE_IMMUTABLE' });
  expect(await Recovery.collection.findOne({ _id: value._id })).toEqual(before);
});
test('UDR-010 has a complete unique media index and no TTL or extra user-data fields', async () => {
  expect(() => new Recovery({ ...fixture(), token: 'synthetic-do-not-store' })).toThrow();
  const indexes = await Recovery.collection.indexes();
  expect(indexes).toEqual(expect.arrayContaining([expect.objectContaining({ key: { mediaId: 1 }, unique: true })]));
  expect(indexes.every(index => index.expireAfterSeconds === undefined && index.partialFilterExpression === undefined
    && index.sparse !== true && index.collation === undefined)).toBe(true);
});

test('UDR-007 new document cannot bypass proof validation by disabling save validation', async () => {
  const value = fixture(); value.evidenceHash = 'c'.repeat(64);
  await expect(new Recovery(value).save({ validateBeforeSave: false }))
    .rejects.toMatchObject({ code: 'USER_DELETION_EVIDENCE_INVALID' });
  expect(await Recovery.countDocuments()).toBe(0);
});
test('UDR-008 bulk insert validation bypass is not an allowed outbox writer', async () => {
  await expect(Recovery.insertMany([fixture()], { lean: true }))
    .rejects.toMatchObject({ code: 'USER_DELETION_EVIDENCE_IMMUTABLE' });
  expect(await Recovery.countDocuments()).toBe(0);
});

test.each([true, false])('UDR-007 rejects per-document strict bypass (validateBeforeSave=%s)', async validateBeforeSave => {
  const document = new Recovery(fixture());
  document.set('token', 'synthetic-do-not-store', { strict: false });
  await expect(document.save({ validateBeforeSave })).rejects.toMatchObject({ code: 'USER_DELETION_EVIDENCE_INVALID' });
  expect(await Recovery.countDocuments()).toBe(0);
});
test('UDR-008 document delete cannot remove the first immutable evidence', async () => {
  const document = await Recovery.create(fixture());
  const before = await Recovery.collection.findOne({ _id: document._id });
  await expect(document.deleteOne()).rejects.toMatchObject({ code: 'USER_DELETION_EVIDENCE_IMMUTABLE' });
  expect(await Recovery.collection.findOne({ _id: document._id })).toEqual(before);
});
test('UDR-007 create array cannot bypass invalid proof validation', async () => {
  const value = fixture(); value.evidenceHash = 'c'.repeat(64);
  await expect(Recovery.create([value], { validateBeforeSave: false }))
    .rejects.toMatchObject({ code: 'USER_DELETION_EVIDENCE_INVALID' });
  expect(await Recovery.countDocuments()).toBe(0);
});

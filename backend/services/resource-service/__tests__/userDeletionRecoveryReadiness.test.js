const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { createHash } = require('crypto');
const { ObjectId, EJSON } = require('bson');
const { MongoClient } = require('mongodb');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { sealEvidence, serializeEvidence } = require('../services/userDeletionRecoveryEvidence');
const { createUserDeletionRecoveryReader } = require('../services/userDeletionRecoveryReader');
const { makeUnsignedEvidence, oid, uuid, TIMES } = require('./fixtures/userDeletionRecoveryEvidence');

jest.setTimeout(120000);
const INVALID = 'USER_DELETION_EVIDENCE_INVALID';
const PENDING = 'USER_DELETION_DEPENDENCY_PENDING';
const NOT_READY = 'USER_DELETION_READINESS_NOT_READY';
const LEGACY = 'LEGACY_USER_DELETION_EVIDENCE_INSUFFICIENT';
const SCOPE = { familyId: 1, childId: 1, resourceType: 1, resourceId: 1, field: 1 };
const specs = {
  mediaassets: [{ familyId: 1, storageKey: 1 }],
  mediareferences: [{ familyId: 1, mediaId: 1, resourceType: 1, resourceId: 1, field: 1 }],
  mediareferenceoperations: [{ ...SCOPE, operationId: 1 }],
  mediadeletiontombstones: [{ mediaId: 1 }],
  mediadeletionreceipts: [{ familyId: 1, childId: 1, mediaId: 1, resourceType: 1, resourceId: 1, field: 1, bindingOperationId: 1 }],
  completionuploadguards: [{ mediaId: 1 }],
  mediaorphanretirements: [{ mediaId: 1 }],
  mediauserdeletionrecoveries: [{ mediaId: 1 }]
};
const assetIndexes = [
  { purpose: 1, status: 1, retentionPolicyVersion: 1, orphanEligibleAt: 1 },
  { purpose: 1, status: 1, retentionPolicyVersion: 1, orphanLastCheckedAt: 1, _id: 1, orphanEligibleAt: 1 }
];
const idFields = new Set(['_id', 'mediaId', 'familyId', 'childId', 'actorId', 'resourceId', 'uploadedBy']);
const dateFields = new Set(['createdAt', 'updatedAt', 'deletedAt', 'releasedAt', 'terminalAt', 'leaseExpiresAt', 'restoredAt']);
const native = value => Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
  item === null ? null : idFields.has(key) ? new ObjectId(item) : dateFields.has(key) ? new Date(item)
    : key === 'references' ? item.map(native) : item]));
const legacyProjection = proof => ({ tombstone: Object.fromEntries(Object.entries(proof.tombstone).filter(([key]) => key !== '_id')),
  receipts: proof.receipts.map(({ _id, ...row }) => row) });
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const reseal = ({ evidenceHash, ...value }) => sealEvidence(value);
let mongo, client, db, base, root, journal;
const api = () => require('../services/userDeletionRecoveryReadiness');
const options = extra => ({ connection: { db }, journal, writesPaused: true, ...extra });
const run = extra => api().assertUserDeletionRecoveryReadiness(options(extra));
const inspect = extra => api().inspectUserDeletionRecovery(options(extra));
const filename = (mediaId, version = 2) => path.join(root, ...(version === 2 ? ['user-deletions-v2'] : []), mediaId + '.json');
const put = async (proof, paired = true) => {
  await fs.writeFile(filename(proof.tombstone.mediaId), serializeEvidence(proof), { mode: 0o600 });
  if (paired) await fs.writeFile(filename(proof.tombstone.mediaId, 1), JSON.stringify(legacyProjection(proof)) + '\n', { mode: 0o600 });
};
const fileSnapshot = async (directory = base) => {
  const values = [];
  for (const name of (await fs.readdir(directory)).sort()) {
    const location = path.join(directory, name), stat = await fs.lstat(location);
    values.push([path.relative(base, location), stat.mode & 0o777, stat.isDirectory() ? await fileSnapshot(location) : (await fs.readFile(location)).toString('base64')]);
  }
  return values;
};
const snapshot = async () => {
  const rows = {};
  for (const name of Object.keys(specs)) {
    const cursor = db.listCollections({ name });
    let exists; try { exists = await cursor.hasNext(); } finally { await cursor.close(); }
    rows[name] = exists ? { rows: EJSON.stringify(await db.collection(name).find().sort({ _id: 1 }).toArray(), { relaxed: false }),
      indexes: await db.collection(name).listIndexes().toArray() } : null;
  }
  return { rows, files: await fileSnapshot() };
};
const blocked = async (code, extra) => {
  const before = await snapshot();
  let failure; try { await run(extra); } catch (cause) { failure = cause; }
  expect(failure).toMatchObject({ code, complete: false });
  expect(JSON.stringify(failure)).not.toMatch(/private-sentinel|storageKey|familyId|childId|evidenceHash|mongodb:/);
  expect(await snapshot()).toEqual(before);
  return failure;
};
const fixture = async ({ number = 4, legacy = false, cleaned = false, paired = true } = {}) => {
  const raw = makeUnsignedEvidence('empty');
  raw.tombstone.mediaId = oid(number); raw.tombstone._id = oid(number + 1000);
  raw.uploadIdentity.mediaId = oid(number); raw.uploadIdentity.storageKey = uuid(number + 1000);
  raw.evidenceId = uuid(number);
  const metadata = { familyId: raw.tombstone.familyId, childId: raw.tombstone.childId, uploadedBy: oid(5), purpose: 'task_completion',
    mimeType: 'image/jpeg', displayName: 'task-completion', sizeBytes: 9, pageCount: null,
    storageKey: raw.uploadIdentity.storageKey, malwareScanStatus: 'skipped_trusted_local', malwareScannedAt: null };
  raw.uploadIdentity.metadataHash = digest(metadata);
  const proof = sealEvidence(raw);
  const asset = { ...native({ ...metadata, _id: oid(number) }), status: 'deleted', privacyDeletionRecorded: true,
    deletedAt: new Date(TIMES.deleted), createdAt: new Date(TIMES.created), updatedAt: new Date(TIMES.deleted), __v: 1 };
  const outbox = { _id: proof.evidenceId, mediaId: new ObjectId(oid(number)), familyId: new ObjectId(oid(1)), childId: new ObjectId(oid(2)),
    version: 2, evidence: proof, evidenceHash: proof.evidenceHash, createdAt: new Date(proof.evidenceCreatedAt) };
  if (!cleaned) await db.collection('mediaassets').insertOne(asset);
  await db.collection('mediadeletiontombstones').insertOne(native(proof.tombstone));
  if (!legacy) {
    await db.collection('mediauserdeletionrecoveries').insertOne(outbox);
    await db.collection('completionuploadguards').insertOne({ _id: new ObjectId(oid(number + 2000)), ...native(proof.uploadIdentity),
      state: 'RETIRED', revision: 1, createdAt: new Date(TIMES.created), updatedAt: new Date(TIMES.deleted) });
    await put(proof, paired);
  } else await fs.writeFile(filename(oid(number), 1), JSON.stringify(legacyProjection(proof)) + '\n', { mode: 0o600 });
  return { proof, asset, outbox };
};

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ args: ['--setParameter', 'enableTestCommands=1'] }] });
  client = await MongoClient.connect(mongo.getUri()); db = client.db('user_deletion_readiness_synthetic');
});
beforeEach(async () => {
  await db.dropDatabase();
  for (const [name, keys] of Object.entries(specs)) {
    await db.createCollection(name);
    for (const key of keys) await db.collection(name).createIndex(key, { unique: true });
  }
  await db.collection('mediareferenceoperations').createIndex({ 'references.mediaId': 1, _id: 1 });
  for (let i = 0; i < assetIndexes.length; i++) await db.collection('mediaassets').createIndex(assetIndexes[i], { name: 'retention_' + i });
  base = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'lms-udr-readiness-'));
  root = path.join(base, 'deletions'); await fs.mkdir(root, { mode: 0o700 });
  await fs.mkdir(path.join(root, 'user-deletions-v2'), { mode: 0o700 });
  journal = createUserDeletionRecoveryReader({ root });
});
afterEach(async () => { jest.restoreAllMocks(); await fs.rm(base, { recursive: true, force: true }); });
afterAll(async () => { await client?.close(); await mongo?.stop(); });

test('D2B-01 indexed empty store checks without granting readiness or closing the borrowed connection', async () => {
  const before = await snapshot(), close = jest.fn();
  expect(await run({ connection: { db, close } })).toEqual({ checked: true, scope: 'user-deletion-recovery',
    counts: { v1Files: 0, v2Files: 0, outboxes: 0, tombstones: 0, legacyOnly: 0 } });
  expect(await inspect()).toEqual({ ready: false, complete: true, reasons: [],
    counts: { v1Files: 0, v2Files: 0, outboxes: 0, tombstones: 0, legacyOnly: 0 } });
  expect(close).not.toHaveBeenCalled(); expect(await snapshot()).toEqual(before);
});
test.each([false, undefined, 'true'])('D2B-01 paused %s rejects before any database or reader access', async writesPaused => {
  const access = jest.fn(() => { throw Error('private-sentinel'); });
  await expect(run({ writesPaused, connection: { get db() { return access(); } }, journal: new Proxy({}, { get: access }) }))
    .rejects.toMatchObject({ code: NOT_READY });
  expect(access).not.toHaveBeenCalled();
});
test.each(['bad mode', 'read', 'inventory', 'readLegacy', 'createReadSession'])('D2B-01 rejects malformed %s before I/O', async kind => {
  const access = jest.fn(() => { throw Error('private-sentinel'); });
  await expect(run({ connection: { get db() { return access(); } },
    ...(kind === 'bad mode' ? { mode: 'legacy' } : { journal: { ...journal, [kind]: null } }) })).rejects.toMatchObject({ code: NOT_READY });
  expect(access).not.toHaveBeenCalled();
});
test.each(Object.keys(specs))('D2B-01 missing %s is not provisioned', async name => {
  await db.collection(name).drop(); await blocked(NOT_READY);
});
test.each(['missing', 'partial', 'sparse', 'collation', 'prepareUnique', 'TTL', 'extra unique'])('D2B-01 outbox %s cannot replace finalized uniqueness', async kind => {
  const c = db.collection('mediauserdeletionrecoveries');
  if (['missing', 'partial', 'sparse', 'collation', 'prepareUnique'].includes(kind)) await c.dropIndex('mediaId_1');
  if (['partial', 'sparse', 'collation'].includes(kind)) await c.createIndex({ mediaId: 1 }, { unique: true,
    ...(kind === 'partial' ? { partialFilterExpression: { version: 2 } } : kind === 'sparse' ? { sparse: true } : { collation: { locale: 'en' } }) });
  if (kind === 'prepareUnique') {
    await c.createIndex({ mediaId: 1 }); await db.command({ collMod: c.collectionName, index: { name: 'mediaId_1', prepareUnique: true } });
  }
  if (kind === 'TTL') await c.createIndex({ createdAt: 1 }, { expireAfterSeconds: 600 });
  if (kind === 'extra unique') await c.createIndex({ childId: 1 }, { unique: true });
  await blocked(NOT_READY);
});
test('D2B-01 standalone topology fails before evidence access', async () => {
  await expect(run({ connection: { db: { admin: () => ({ command: async () => ({ isWritablePrimary: true }) }) } } }))
    .rejects.toMatchObject({ code: NOT_READY });
});
test('D2B-01 cold import rejects models, mongoose, writer and restore imports', () => {
  const target = path.resolve(__dirname, '../services/userDeletionRecoveryReadiness.js');
  const script = `const Module=require('module'),load=Module._load;Module._load=function(name,parent,...rest){
    const file=Module._resolveFilename(name,parent);if(name==='mongoose'||/[\\\\/]models[\\\\/]|[\\\\/]mongoose[\\\\/]|userDeletionRestore\\.js|userDeletionRecoveryCapture|userDeletionRecoveryJournal|mediaDeletionJournal|completionUploadGuardService/.test(file))throw Error('forbidden cold dependency');
    return load.call(this,name,parent,...rest)};const api=require(process.argv[1]);if(typeof api.inspectUserDeletionRecovery!=='function')throw Error('missing API');`;
  expect(() => execFileSync(process.execPath, ['-e', script, target], { encoding: 'utf8' })).not.toThrow();
});

test.each([false, true])('D2B-02 exact empty-history v2 with cleaned=%s passes and preserves every fact', async cleaned => {
  await fixture({ cleaned }); const before = await snapshot();
  expect(await run()).toEqual({ checked: true, scope: 'user-deletion-recovery',
    counts: { v1Files: 1, v2Files: 1, outboxes: 1, tombstones: 1, legacyOnly: 0 } });
  expect(await snapshot()).toEqual(before);
});
test('D2B-02 original v1-only needs no invented guard; enabled accepts and strict rejects after traversal', async () => {
  await fixture({ legacy: true }); const before = await snapshot();
  expect((await run()).counts).toEqual({ v1Files: 1, v2Files: 0, outboxes: 0, tombstones: 1, legacyOnly: 1 });
  await expect(run({ mode: 'recovery' })).rejects.toMatchObject({ code: LEGACY, complete: true });
  expect(await inspect()).toEqual({ ready: false, complete: true, reasons: [LEGACY],
    counts: { v1Files: 1, v2Files: 0, outboxes: 0, tombstones: 1, legacyOnly: 1 } });
  expect(await snapshot()).toEqual(before);
});
test('D2B-02 v2-only is valid when every database fact matches', async () => {
  await fixture({ paired: false }); expect((await run()).counts.v2Files).toBe(1);
});
test.each(['outbox', 'all DB', 'v2 file', 'both files', 'paired conflict', 'guard'])('D2B-02 known v2 %s cannot downgrade', async kind => {
  const { proof } = await fixture(); expect((await run()).checked).toBe(true);
  if (kind === 'outbox') await db.collection('mediauserdeletionrecoveries').deleteMany({});
  if (kind === 'guard') await db.collection('completionuploadguards').deleteMany({});
  if (kind === 'all DB') for (const name of Object.keys(specs)) await db.collection(name).deleteMany({});
  if (['v2 file', 'both files'].includes(kind)) await fs.unlink(filename(proof.tombstone.mediaId));
  if (kind === 'both files') await fs.unlink(filename(proof.tombstone.mediaId, 1));
  if (kind === 'paired conflict') {
    const old = legacyProjection(proof); old.tombstone.actorId = oid(99);
    await fs.writeFile(filename(proof.tombstone.mediaId, 1), JSON.stringify(old) + '\n');
  }
  await blocked(kind === 'paired conflict' ? INVALID : PENDING);
});
test.each(['_id', 'mediaId string', 'familyId', 'childId', 'version', 'hash', 'createdAt string', 'createdAt changed', 'restoredAt', 'extra'])
('D2B-02 raw outbox %s is rejected without casting or replacing evidence', async kind => {
  await fixture(); expect((await run()).checked).toBe(true);
  const c = db.collection('mediauserdeletionrecoveries'), row = await c.findOne();
  const changes = { _id: uuid(99), 'mediaId string': oid(4), familyId: new ObjectId(oid(99)), childId: oid(2), version: '2',
    hash: '0'.repeat(64), 'createdAt string': TIMES.evidence, 'createdAt changed': new Date(TIMES.deleted),
    restoredAt: new Date(TIMES.created), extra: 'private-sentinel' };
  const field = kind.startsWith('createdAt') ? 'createdAt' : kind === 'mediaId string' ? 'mediaId' : kind === 'hash' ? 'evidenceHash' : kind;
  await c.deleteMany({}); await c.insertOne({ ...row, [field]: changes[kind] });
  await blocked(INVALID);
});
test.each(['actor', 'tombstone id', 'guard hash', 'guard state', 'guard chronology', 'asset hash'])
('D2B-02 first audit and fixed identity reject %s damage', async kind => {
  await fixture(); expect((await run()).checked).toBe(true);
  if (kind === 'actor') await db.collection('mediadeletiontombstones').updateOne({}, { $set: { actorId: new ObjectId(oid(99)) } });
  if (kind === 'tombstone id') {
    const c = db.collection('mediadeletiontombstones'), row = await c.findOne(); await c.deleteMany({}); await c.insertOne({ ...row, _id: new ObjectId(oid(99)) });
  }
  if (kind === 'guard hash') await db.collection('completionuploadguards').updateOne({}, { $set: { metadataHash: 'a'.repeat(64) } });
  if (kind === 'guard state') await db.collection('completionuploadguards').updateOne({}, { $set: { state: 'REGISTERED' } });
  if (kind === 'guard chronology') await db.collection('completionuploadguards').updateOne({}, { $set: { updatedAt: new Date(0) } });
  if (kind === 'asset hash') await db.collection('mediaassets').updateOne({}, { $set: { sizeBytes: 99 } });
  await blocked(INVALID);
});
test('D2B-02 legacy insufficiency cannot hide a later corrupt v2', async () => {
  await fixture({ legacy: true }); const { proof } = await fixture({ number: 14 });
  await fs.writeFile(filename(proof.tombstone.mediaId), 'private-sentinel');
  const original = journal.inventory.bind(journal);
  journal.inventory = async function* () {
    yield { version: 1, mediaId: oid(4) };
    for await (const entry of original()) if (entry.mediaId !== oid(4)) yield entry;
  };
  const result = await inspect(); expect(result).toMatchObject({ ready: false, complete: false });
  expect(result.reasons).toEqual([LEGACY, INVALID].sort());
});
test('D2B-02 classification and cache use one underlying session per root', async () => {
  await fixture(); const original = journal.createReadSession.bind(journal), sessions = [];
  journal.read = jest.fn(() => { throw Error('unbudgeted read'); });
  journal.createReadSession = () => {
    const session = original(), calls = []; sessions.push(calls);
    return { read: async mediaId => { calls.push(mediaId); return session.read(mediaId); } };
  };
  expect((await run()).checked).toBe(true); expect(journal.read).not.toHaveBeenCalled();
  expect(sessions).toHaveLength(4); expect(sessions.every(calls => calls.length >= 1 && calls.every(mediaId => mediaId === oid(4)))).toBe(true);
});
test.each([0, 1])('D2B-01 retention nonunique index %s is a required prerequisite', async index => {
  expect((await run()).checked).toBe(true);
  await db.collection('mediaassets').dropIndex('retention_' + index);
  await blocked(NOT_READY);
});
test('D2B-02 a valid historical proof without an actual ledger stays pending, not hypothetically restored', async () => {
  const { proof: empty } = await fixture();
  const proof = reseal({ ...empty, operations: makeUnsignedEvidence('history').operations });
  await db.collection('mediauserdeletionrecoveries').updateOne({}, { $set: { evidence: proof, evidenceHash: proof.evidenceHash } });
  await put(proof);
  await blocked(PENDING);
});
test.each([false, true])('D2B-02 empty history cannot hide actual owner ledger or released reference (%s)', async withReference => {
  await fixture(); expect((await run()).checked).toBe(true);
  const operation = makeUnsignedEvidence('history').operations[0].after;
  await db.collection('mediareferenceoperations').insertOne(native(operation));
  if (withReference) await db.collection('mediareferences').insertOne(native({ _id: oid(9),
    familyId: operation.familyId, childId: operation.childId, resourceType: operation.resourceType,
    resourceId: operation.resourceId, field: operation.field, mediaId: oid(4), operationId: operation.operationId,
    state: 'released', leaseExpiresAt: null, releasedAt: operation.terminalAt, releaseOperationId: operation.operationId,
    createdAt: operation.createdAt, updatedAt: operation.updatedAt }));
  expect((await require('../services/completionPrivacyReadiness').assertCompletionPrivacyReadiness({ connection: { db }, writesPaused: true })).ready).toBe(true);
  const before = await snapshot();
  await expect(run()).rejects.toMatchObject({ complete: false });
  expect(await snapshot()).toEqual(before);
});

const replaceProof = async proof => {
  await db.collection('mediauserdeletionrecoveries').updateOne({ mediaId: new ObjectId(proof.tombstone.mediaId) },
    { $set: { evidence: proof, evidenceHash: proof.evidenceHash } });
  await put(proof);
};
const groupFixture = async (kind = 'committed', cleaned = false) => {
  const seeded = await fixture({ cleaned });
  const source = makeUnsignedEvidence(kind), proof = reseal({ ...seeded.proof,
    operations: source.operations, referenceEffects: source.referenceEffects, receipts: source.receipts });
  const op = proof.operations[0].after;
  await db.collection('mediareferenceoperations').insertOne(native(op));
  const sibling = { ...seeded.asset, _id: new ObjectId(oid(7)), storageKey: uuid(700), status: 'active',
    privacyDeletionRecorded: false, deletedAt: null };
  await db.collection('mediaassets').insertOne(sibling);
  for (const [index, item] of op.references.entries()) {
    if (cleaned && item.mediaId === oid(4)) continue;
    const effect = proof.referenceEffects.find(pair => pair.after.mediaId === item.mediaId);
    const ref = effect?.after || { _id: oid(9 + index), familyId: op.familyId, childId: op.childId,
      resourceType: op.resourceType, resourceId: op.resourceId, field: op.field, mediaId: item.mediaId,
      operationId: op.operationId, state: op.state === 'ABORTED' ? 'released' : 'bound', leaseExpiresAt: null,
      releasedAt: op.state === 'ABORTED' ? op.terminalAt : null, releaseOperationId: op.state === 'ABORTED' ? op.operationId : null,
      createdAt: op.createdAt, updatedAt: op.updatedAt };
    await db.collection('mediareferences').insertOne(native(ref));
  }
  if (proof.receipts.length) await db.collection('mediadeletionreceipts').insertMany(proof.receipts.map(native));
  await replaceProof(proof);
  return { ...seeded, proof, op, sibling };
};
const refused = async extra => {
  const before = await snapshot(); const result = await inspect(extra);
  expect(result.complete).toBe(false); expect(result.ready).toBe(false);
  expect(result.reasons.length).toBeGreaterThan(0);
  expect(result.reasons.every(code => [INVALID, PENDING, NOT_READY].includes(code))).toBe(true);
  expect(await snapshot()).toEqual(before);
};
test('D2B-05 reference query grows per group and preserves every corruption witness', async () => {
  const { proof, op } = await groupFixture('prepared');
  const before = await snapshot(), open = db.collection.bind(db), queries = [];
  jest.spyOn(db, 'collection').mockImplementation(name => {
    const collection = open(name), find = collection.find.bind(collection);
    if (name === 'mediareferences') collection.find = (filter, ...args) => {
      if (filter.$or?.some(item => item._id?.$in) && filter.$or.some(item => item.mediaId?.$in)) queries.push(filter);
      return find(filter, ...args);
    };
    return collection;
  });
  expect((await run()).checked).toBe(true);
  jest.restoreAllMocks(); expect(await snapshot()).toEqual(before);
  expect(queries.length).toBeGreaterThan(0);
  const actual = queries[0], aliases = value => ({ $in: [new ObjectId(value), value] });
  const groupScope = group => ({ familyId: aliases(group.familyId), resourceId: aliases(group.resourceId),
    resourceType: group.resourceType, field: group.field });
  const expected = { $or: [
    { mediaId: aliases(proof.tombstone.mediaId) },
    { _id: { $in: proof.referenceEffects.flatMap(pair => [new ObjectId(pair.after._id), pair.after._id]) } },
    ...proof.operations.flatMap(({ after }) => [
      { ...groupScope(after), operationId: after.operationId },
      ...after.references.map(ref => ({ ...groupScope(after), mediaId: aliases(ref.mediaId) }))
    ])
  ] };
  const refs = db.collection('mediareferences'), row = native(proof.referenceEffects[0].after);
  const variants = [row, ...['familyId', 'resourceId', 'mediaId', '_id'].map(field => ({ ...row, [field]: String(row[field]) })),
    { ...row, childId: new ObjectId(oid(999)) },
    { ...row, _id: new ObjectId(oid(998)), mediaId: new ObjectId(oid(999)) },
    { ...row, _id: new ObjectId(oid(998)), operationId: uuid(999) },
    { ...row, familyId: new ObjectId(oid(999)), resourceId: new ObjectId(oid(999)), mediaId: new ObjectId(oid(999)) },
    { ...row, _id: new ObjectId(oid(998)), familyId: new ObjectId(oid(999)), resourceId: new ObjectId(oid(999)) },
    { ...row, _id: new ObjectId(oid(998)), mediaId: new ObjectId(oid(999)), operationId: uuid(999) },
    { ...row, _id: new ObjectId(oid(998)), resourceId: new ObjectId(oid(999)), mediaId: new ObjectId(op.references[1].mediaId) }
  ];
  for (const variant of variants) {
    await refs.deleteMany({}); await refs.insertOne(variant);
    expect(await refs.find(actual).toArray()).toEqual(await refs.find(expected).toArray());
  }
  expect(actual.$or.length).toBeLessThanOrEqual(proof.operations.length + 2);
});
test.each(['familyId', 'resourceId', 'mediaId', 'childId', 'unexpected media', 'unproven generation'])(
  'D2B-05 compact reference lookup still rejects %s corruption', async kind => {
    await groupFixture('prepared'); expect((await run()).checked).toBe(true);
    const refs = db.collection('mediareferences'), row = await refs.findOne({ mediaId: new ObjectId(oid(7)) });
    const changes = kind === 'childId' ? { childId: new ObjectId(oid(999)) }
      : kind === 'unexpected media' ? { mediaId: new ObjectId(oid(999)) }
        : kind === 'unproven generation' ? { operationId: uuid(999) } : { [kind]: String(row[kind]) };
    await refs.updateOne({ _id: row._id }, { $set: changes });
    await blocked(kind === 'unproven generation' ? PENDING : INVALID);
  }
);
test.each(['committed', 'prepared', 'history'].flatMap(kind => [false, true].map(cleaned => [kind, cleaned])))
('D2B-03 actual %s group cleaned=%s passes with full audit unchanged', async (kind, cleaned) => {
  await groupFixture(kind, cleaned); const before = await snapshot();
  expect((await run()).checked).toBe(true); expect((await inspect()).reasons).toEqual([]);
  expect(await snapshot()).toEqual(before);
});
test.each(['missing ledger', 'prepared ledger', 'lower version', 'command hash', 'original id', 'date string', 'updated before created',
  'missing sibling', 'missing sibling reference', 'extra same-generation reference', 'sibling foreign', 'reference chronology', 'reference id',
  'receipt id', 'receipt missing', 'extra receipt', 'effect before'])
('D2B-03 full applied facts reject %s', async kind => {
  const { proof, op } = await groupFixture(); expect((await run()).checked).toBe(true);
  const ops = db.collection('mediareferenceoperations'), refs = db.collection('mediareferences'), receipts = db.collection('mediadeletionreceipts');
  if (kind === 'missing ledger') await ops.deleteMany({});
  if (kind === 'prepared ledger') await ops.updateOne({}, { $set: { state: 'PREPARED', version: 0, terminalAt: null, leaseExpiresAt: new Date(TIMES.lease) } });
  if (kind === 'lower version') await ops.updateOne({}, { $set: { version: 1, updatedAt: new Date(TIMES.committed) } });
  if (kind === 'command hash') await ops.updateOne({}, { $set: { commandHash: 'c'.repeat(64) } });
  if (kind === 'date string') await ops.updateOne({}, { $set: { createdAt: TIMES.created } });
  if (kind === 'updated before created') await ops.updateOne({}, { $set: { updatedAt: new Date(0) } });
  if (kind === 'original id') { const row = await ops.findOne(); await ops.deleteMany({}); await ops.insertOne({ ...row, _id: new ObjectId(oid(800)) }); }
  if (kind === 'missing sibling') await db.collection('mediaassets').deleteOne({ _id: new ObjectId(oid(7)) });
  if (kind === 'missing sibling reference') await refs.deleteOne({ mediaId: new ObjectId(oid(7)) });
  if (kind === 'extra same-generation reference') {
    const row = await refs.findOne({ mediaId: new ObjectId(oid(7)) });
    await refs.insertOne({ ...row, _id: new ObjectId(oid(801)), mediaId: new ObjectId(oid(802)) });
  }
  if (kind === 'sibling foreign') await db.collection('mediaassets').updateOne({ _id: new ObjectId(oid(7)) }, { $set: { childId: new ObjectId(oid(99)) } });
  if (kind === 'reference chronology') await refs.updateOne({ mediaId: new ObjectId(oid(7)) }, { $set: { updatedAt: new Date(0) } });
  if (kind === 'reference id') {
    const row = await refs.findOne({ mediaId: new ObjectId(oid(4)) }); await refs.deleteOne({ _id: row._id });
    await refs.insertOne({ ...row, _id: new ObjectId(oid(803)) });
  }
  if (kind === 'receipt id') { const row = await receipts.findOne(); await receipts.deleteMany({}); await receipts.insertOne({ ...row, _id: new ObjectId(oid(804)) }); }
  if (kind === 'receipt missing') await receipts.deleteMany({});
  if (kind === 'extra receipt') await receipts.insertOne({ ...native(proof.receipts[0]), _id: new ObjectId(oid(805)), resourceId: new ObjectId(oid(806)) });
  if (kind === 'effect before') {
    await refs.replaceOne({ mediaId: new ObjectId(oid(4)) }, native(proof.referenceEffects[0].before));
  }
  await refused();
});
test.each(['owner', 'foreign'])('D2B-03 legitimate late-v0 %s rejection audit is not fabricated into the proof', async kind => {
  const { op } = await groupFixture('history');
  const extra = { ...op, _id: oid(400), operationId: uuid(400), state: 'ABORTED', version: 0,
    failureCode: 'MEDIA_OPERATION_ABORTED', createdAt: TIMES.evidence, updatedAt: TIMES.evidence, terminalAt: TIMES.deleted,
    ...(kind === 'foreign' ? { familyId: oid(90), childId: oid(91) } : {}) };
  await db.collection('mediareferenceoperations').insertOne(native(extra));
  const before = await snapshot(); expect((await run()).checked).toBe(true); expect(await snapshot()).toEqual(before);
});

const wire = row => JSON.parse(JSON.stringify(row));
const chainFixture = async (cleaned = false) => {
  const x = await groupFixture('committed');
  const yBefore = wire(await db.collection('mediareferences').findOne({ mediaId: new ObjectId(oid(7)) }));
  await db.collection('mediaassets').deleteOne({ _id: new ObjectId(oid(7)) });
  const y = await fixture({ number: 7 });
  const before = x.proof.operations[0].after;
  const after = { ...before, version: 3, updatedAt: '2026-10-24T00:00:00.002Z' };
  const releasedAt = '2026-10-24T00:00:00.001Z';
  const effect = { ...yBefore, state: 'released', releasedAt, releaseOperationId: null, updatedAt: after.updatedAt };
  const proof = reseal({ ...y.proof, evidenceCreatedAt: '2026-10-24T00:00:00.003Z',
    tombstone: { ...y.proof.tombstone, deletedAt: '2026-10-24T00:00:00.000Z' },
    operations: [{ before, after }], referenceEffects: [{ before: yBefore, after: effect }],
    receipts: [{ _id: oid(3007), familyId: after.familyId, childId: after.childId, mediaId: oid(7), resourceType: after.resourceType,
      resourceId: after.resourceId, field: after.field, bindingOperationId: after.operationId, releasedAt }] });
  await db.collection('mediareferenceoperations').replaceOne({ _id: new ObjectId(after._id) }, native(after));
  await db.collection('mediareferences').replaceOne({ _id: new ObjectId(effect._id) }, native(effect));
  await db.collection('mediadeletionreceipts').insertOne(native(proof.receipts[0]));
  await db.collection('mediadeletiontombstones').replaceOne({ mediaId: new ObjectId(oid(7)) }, native(proof.tombstone));
  await db.collection('mediaassets').updateOne({ _id: new ObjectId(oid(7)) },
    { $set: { deletedAt: new Date(proof.tombstone.deletedAt), updatedAt: new Date(proof.tombstone.deletedAt) } });
  await db.collection('mediauserdeletionrecoveries').updateOne({ mediaId: new ObjectId(oid(7)) }, { $set: { createdAt: new Date(proof.evidenceCreatedAt) } });
  await replaceProof(proof);
  if (cleaned) {
    await db.collection('mediaassets').deleteMany({}); await db.collection('mediareferences').deleteMany({});
  }
  return { x: x.proof, y: proof };
};
const laterFixture = async () => {
  const old = await groupFixture('history');
  const refs = [oid(7), oid(17)].map(mediaId => ({ mediaId, field: 'completionMediaIds' }));
  const group = { ...old.op, _id: oid(500), operationId: uuid(500), state: 'COMMITTED', version: 1, failureCode: null,
    references: refs, referenceSetHash: digest(refs), createdAt: '2026-10-21T00:00:00.000Z',
    terminalAt: '2026-10-21T00:00:00.001Z', updatedAt: '2026-10-21T00:00:00.002Z' };
  await db.collection('mediareferenceoperations').insertOne(native(group));
  const existing = wire(await db.collection('mediareferences').findOne({ mediaId: new ObjectId(oid(7)) }));
  const ref = { ...existing, operationId: group.operationId, state: 'bound', leaseExpiresAt: null,
    releasedAt: null, releaseOperationId: null, updatedAt: group.updatedAt };
  await db.collection('mediareferences').replaceOne({ _id: new ObjectId(ref._id) }, native(ref));
  await db.collection('mediareferences').insertOne(native({ ...ref, _id: oid(510), mediaId: oid(17), createdAt: group.createdAt }));
  await db.collection('mediaassets').insertOne({ ...old.sibling, _id: new ObjectId(oid(17)), storageKey: uuid(1700) });
  return { ...old, group };
};
test.each([false, true])('D2B-04 complete X to Y chain with cleaned=%s validates every actual dependency', async cleaned => {
  await chainFixture(cleaned); const before = await snapshot();
  expect((await run()).checked).toBe(true); expect(await snapshot()).toEqual(before);
});
test.each(['guard', 'outbox', 'receipt', 'ledger', 'unapplied effect', 'missing edge', 'fork', 'audit mismatch'])
('D2B-04 a mathematically linked dependency with %s cannot be accepted as applied', async kind => {
  const { y } = await chainFixture(); expect((await run()).checked).toBe(true);
  if (kind === 'guard') await db.collection('completionuploadguards').deleteOne({ mediaId: new ObjectId(oid(7)) });
  if (kind === 'outbox') await db.collection('mediauserdeletionrecoveries').deleteOne({ mediaId: new ObjectId(oid(7)) });
  if (kind === 'receipt') await db.collection('mediadeletionreceipts').deleteOne({ mediaId: new ObjectId(oid(7)) });
  if (kind === 'ledger') await db.collection('mediareferenceoperations').deleteMany({});
  if (kind === 'unapplied effect') await db.collection('mediareferences').replaceOne({ mediaId: new ObjectId(oid(7)) }, native(y.referenceEffects[0].before));
  if (kind === 'missing edge') await fs.unlink(filename(oid(7)));
  if (kind === 'fork') {
    const changed = reseal({ ...y, operations: [{ before: { ...y.operations[0].before, version: 1, updatedAt: TIMES.committed },
      after: { ...y.operations[0].after, version: 2 } }] });
    await replaceProof(changed);
  }
  if (kind === 'audit mismatch') await db.collection('mediadeletiontombstones').updateOne({ mediaId: new ObjectId(oid(7)) }, { $set: { actorId: new ObjectId(oid(901)) } });
  await refused();
});
test('D2B-04 later Y plus new Z is complete; reused Y reference creation predates the later ledger', async () => {
  const { group } = await laterFixture();
  const y = await db.collection('mediareferences').findOne({ mediaId: new ObjectId(oid(7)) });
  expect(y.createdAt < new Date(group.createdAt)).toBe(true);
  const before = await snapshot(); expect((await run()).checked).toBe(true); expect(await snapshot()).toEqual(before);
});
test.each(['missing Z asset', 'missing Z ref', 'foreign Z asset', 'foreign Z ref', 'unknown generation', 'out of order', 'release before terminal'])
('D2B-04 full later group rejects %s outside the old group', async kind => {
  const { group } = await laterFixture(); expect((await run()).checked).toBe(true);
  const assets = db.collection('mediaassets'), refs = db.collection('mediareferences'), ops = db.collection('mediareferenceoperations');
  if (kind === 'missing Z asset') await assets.deleteOne({ _id: new ObjectId(oid(17)) });
  if (kind === 'missing Z ref') await refs.deleteOne({ mediaId: new ObjectId(oid(17)) });
  if (kind === 'foreign Z asset') await assets.updateOne({ _id: new ObjectId(oid(17)) }, { $set: { childId: new ObjectId(oid(92)) } });
  if (kind === 'foreign Z ref') await refs.updateOne({ mediaId: new ObjectId(oid(17)) }, { $set: { childId: new ObjectId(oid(92)) } });
  if (kind === 'unknown generation') await refs.updateOne({ mediaId: new ObjectId(oid(17)) }, { $set: { operationId: uuid(92) } });
  if (kind === 'out of order') await ops.updateOne({ operationId: group.operationId }, { $set: { createdAt: new Date(TIMES.created) } });
  if (kind === 'release before terminal') await refs.updateOne({ mediaId: new ObjectId(oid(7)) },
    { $set: { state: 'released', releaseOperationId: uuid(90), releasedAt: new Date(TIMES.committed) } });
  await refused();
});
test.each(['CANDIDATE', 'FENCED', 'SUPERSEDED', 'DELETED', 'PURGED'])('D2B-04 local system %s intersection never invokes retirement', async state => {
  const { proof } = await fixture();
  await db.collection('mediaorphanretirements').insertOne({ _id: new ObjectId(oid(800)), ...native(proof.uploadIdentity),
    uploadMetadataHash: proof.uploadIdentity.metadataHash, retirementId: uuid(800), state, revision: 1,
    actorType: 'system', retentionPolicyVersion: 1, createdAt: new Date(TIMES.created), orphanEligibleAt: new Date(TIMES.created),
    deletedAt: null, purgedAt: null, evidence: null });
  if (['DELETED', 'PURGED'].includes(state)) await refused();
  else { const before = await snapshot(); expect((await run()).checked).toBe(true); expect(await snapshot()).toEqual(before); }
});

const capturedHistoryFixture = async (kind, retainedA = false) => {
  const old = await groupFixture('history');
  const source = makeUnsignedEvidence(kind), original = source.operations[0];
  const convertGroup = value => value && ({ ...value, _id: oid(600), operationId: uuid(600),
    createdAt: '2026-10-21T00:00:00.000Z',
    ...(value.state === 'PREPARED' ? { updatedAt: '2026-10-21T00:00:00.000Z' } :
      value.state === 'COMMITTED' ? { terminalAt: '2026-10-21T00:01:00.000Z',
        updatedAt: value.version === 1 ? '2026-10-21T00:01:00.000Z' : value.updatedAt } : {}) });
  const pair = { before: convertGroup(original.before), after: convertGroup(original.after) };
  const effectRef = value => ({ ...value, operationId: uuid(600),
    releaseOperationId: value.releaseOperationId === null ? null : uuid(600),
    updatedAt: value.state === 'prepared' ? pair.before.createdAt : value.state === 'bound' ? pair.before.terminalAt : value.updatedAt });
  const proof = reseal({ ...old.proof, operations: [...old.proof.operations, pair],
    referenceEffects: source.referenceEffects.map(effect => ({ before: effectRef(effect.before), after: effectRef(effect.after) })),
    receipts: source.receipts.map(receipt => ({ ...receipt, bindingOperationId: uuid(600) })) });
  await db.collection('mediareferenceoperations').insertOne(native(pair.after));
  if (!retainedA) {
    for (const row of await db.collection('mediareferences').find().toArray()) {
      const effect = proof.referenceEffects.find(item => item.after.mediaId === String(row.mediaId));
      await db.collection('mediareferences').replaceOne({ _id: row._id }, effect ? native(effect.after) :
        { ...row, operationId: uuid(600), state: 'bound', releasedAt: null, releaseOperationId: null, updatedAt: new Date(pair.after.terminalAt) });
    }
  }
  if (proof.receipts.length) await db.collection('mediadeletionreceipts').insertMany(proof.receipts.map(native));
  await replaceProof(proof); return { ...old, proof, pair };
};
test.each([['prepared', false], ['prepared', true], ['committed', false]])
('D2B-04 captured A plus B %s with retained A=%s is already applied', async (kind, retainedA) => {
  await capturedHistoryFixture(kind, retainedA); const before = await snapshot();
  expect((await run()).checked).toBe(true); expect(await snapshot()).toEqual(before);
});
test.each(['committed retains A', 'missing B ledger', 'missing member', 'wrong generation', 'out of order', 'unreleased A'])
('D2B-04 captured history rejects %s', async kind => {
  await capturedHistoryFixture(kind === 'committed retains A' ? 'committed' : 'prepared', true);
  if (kind !== 'committed retains A') expect((await run()).checked).toBe(true);
  if (kind === 'missing B ledger') await db.collection('mediareferenceoperations').deleteOne({ operationId: uuid(600) });
  if (kind === 'missing member') await db.collection('mediaassets').deleteOne({ _id: new ObjectId(oid(7)) });
  if (kind === 'wrong generation') await db.collection('mediareferences').updateOne({}, { $set: { operationId: uuid(999) } });
  if (kind === 'out of order') await db.collection('mediareferenceoperations').updateOne({ operationId: uuid(600) }, { $set: { createdAt: new Date(TIMES.created) } });
  if (kind === 'unreleased A') await db.collection('mediareferences').updateOne({}, { $set: { state: 'bound', releasedAt: null, releaseOperationId: null } });
  await refused();
});

test('D2B-05 streams all three passes beyond 100 independent roots with exact counts', async () => {
  for (let i = 0; i < 101; i++) await fixture({ number: 10000 + i, cleaned: true });
  const before = await snapshot();
  expect(await run()).toEqual({ checked: true, scope: 'user-deletion-recovery',
    counts: { v1Files: 101, v2Files: 101, outboxes: 101, tombstones: 101, legacyOnly: 0 } });
  expect(await snapshot()).toEqual(before);
});

// A connected path has two-media groups; every target is physically cleaned but
// its exact retained audit and terminal ledgers remain. No reader/cache is mocked.
const graphFixture = async (count, paired = true, padding = 0) => {
  const template = makeUnsignedEvidence('committed'), abort = makeUnsignedEvidence('prepared');
  const timestamp = (i, offset = 0) => new Date(Date.parse(TIMES.deleted) + i * 1000 + offset).toISOString();
  const values = [], operations = [], references = [];
  for (let i = 0; i < count; i++) {
    const raw = makeUnsignedEvidence('empty'), mediaId = oid(10000 + i);
    raw.evidenceId = uuid(10000 + i); raw.evidenceCreatedAt = timestamp(i, 3);
    raw.tombstone = { ...raw.tombstone, _id: oid(30000 + i), mediaId, deletedAt: timestamp(i) };
    raw.uploadIdentity = { ...raw.uploadIdentity, mediaId, storageKey: uuid(10000 + i) };
    for (const edge of [i - 1, i].filter(edge => edge >= 0 && edge < count - 1)) {
      const refs = [oid(10000 + edge), oid(10001 + edge)].map(value => ({ mediaId: value, field: 'completionMediaIds' }));
      const first = { ...template.operations[0].before, _id: oid(20000 + edge), resourceId: oid(20000 + edge),
        operationId: uuid(20000 + edge), references: refs, referenceSetHash: digest(refs) };
      const left = { ...first, version: 2, updatedAt: timestamp(edge, 2) };
      const before = edge === i ? first : left, after = { ...before, version: before.version + 1, updatedAt: timestamp(i, 2) };
      raw.operations.push({ before, after });
      const ref = { ...template.referenceEffects[0].before, _id: oid(50000 + edge * 2 + (edge === i ? 0 : 1)),
        mediaId, resourceId: first.resourceId, operationId: first.operationId };
      raw.referenceEffects.push({ before: ref, after: { ...ref, state: 'released', releasedAt: timestamp(i, 1), updatedAt: timestamp(i, 2) } });
      raw.receipts.push({ ...template.receipts[0], _id: oid(40000 + edge * 2 + (edge === i ? 0 : 1)),
        mediaId, resourceId: first.resourceId, bindingOperationId: first.operationId, releasedAt: timestamp(i, 1) });
      if (edge < i) operations.push(native(after));
    }
    for (let j = 0; j < padding; j++) {
      const number = 100000 + i * 100 + j;
      const refs = [mediaId, ...Array.from({ length: 9 }, (_, n) => oid(900000 + n))].map(value => ({ mediaId: value, field: 'completionMediaIds' }));
      const identity = { _id: oid(number), resourceId: oid(number), operationId: uuid(number), references: refs, referenceSetHash: digest(refs) };
      const before = { ...abort.operations[0].before, ...identity };
      const after = { ...abort.operations[0].after, ...identity, terminalAt: timestamp(i, 1), updatedAt: timestamp(i, 2) };
      raw.operations.push({ before, after }); operations.push(native(after));
      for (let k = 0; k < refs.length; k++) {
        const refIdentity = { _id: oid(2000000 + (i * 100 + j) * 10 + k), resourceId: identity.resourceId,
          operationId: identity.operationId, mediaId: refs[k].mediaId };
        const prior = { ...abort.referenceEffects[0].before, ...refIdentity };
        const released = { ...abort.referenceEffects[0].after, ...refIdentity, releaseOperationId: identity.operationId,
          releasedAt: timestamp(i, 1), updatedAt: timestamp(i, 2) };
        raw.referenceEffects.push({ before: prior, after: released });
        if (k > 0) references.push(native(released));
      }
    }
    const proof = sealEvidence(raw); values.push(proof);
    await db.collection('mediadeletiontombstones').insertOne(native(proof.tombstone));
    await db.collection('completionuploadguards').insertOne({ _id: new ObjectId(oid(60000 + i)), ...native(proof.uploadIdentity),
      state: 'RETIRED', revision: 1, createdAt: new Date(TIMES.created), updatedAt: new Date(timestamp(i)) });
    await db.collection('mediauserdeletionrecoveries').insertOne({ _id: proof.evidenceId, ...native({ mediaId,
      familyId: proof.tombstone.familyId, childId: proof.tombstone.childId }), version: 2, evidence: proof,
      evidenceHash: proof.evidenceHash, createdAt: new Date(proof.evidenceCreatedAt) });
    await db.collection('mediadeletionreceipts').insertMany(proof.receipts.map(native));
    await put(proof, paired);
  }
  await db.collection('mediareferenceoperations').insertMany(operations);
  if (references.length) await db.collection('mediareferences').insertMany(references);
  if (padding) for (let i = 0; i < 9; i++) await db.collection('mediaassets').insertOne(native({ _id: oid(900000 + i),
    familyId: oid(1), childId: oid(2), uploadedBy: oid(5), purpose: 'task_completion', mimeType: 'image/jpeg',
    sizeBytes: 9, pageCount: null, storageKey: uuid(900000 + i), malwareScanStatus: 'skipped_trusted_local',
    malwareScannedAt: null, status: 'active', privacyDeletionRecorded: false, deletedAt: null,
    createdAt: TIMES.created, updatedAt: TIMES.created, __v: 0 }));
  return values;
};
const fileReads = () => {
  const open = fs.open.bind(fs), records = [];
  jest.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await open(...args);
    if (String(args[0]).endsWith('.json')) {
      const record = { name: args[0], bytes: 0, reads: 0 }; records.push(record);
      const read = handle.read.bind(handle);
      handle.read = async (...readArgs) => { const result = await read(...readArgs); record.reads++; record.bytes += result.bytesRead; return result; };
    }
    return handle;
  });
  return records;
};
// Stop immediately AFTER the first real closure, avoiding quadratic rechecks of
// a 100-node connected store. This harness never claims a complete store check.
const firstClosure = async () => {
  const enteredNextPass = jest.fn(), collection = db.collection.bind(db), nativeErrors = [], discoveryReads = [];
  const connection = { db: new Proxy(db, { get(target, key) {
    if (key !== 'collection') return typeof target[key] === 'function' ? target[key].bind(target) : target[key];
    return name => {
      const c = collection(name), find = c.find.bind(c);
      c.find = (filter, ...args) => {
        if (name === 'mediauserdeletionrecoveries' && Object.keys(filter).length === 0) {
          enteredNextPass(); throw Error('private-sentinel boundary marker');
        }
        if (name === 'mediauserdeletionrecoveries' && Object.keys(filter).length === 1 && filter.mediaId?.$in) {
          discoveryReads.push(filter.mediaId.$in[1]);
        }
        const cursor = find(filter, ...args), toArray = cursor.toArray.bind(cursor);
        cursor.toArray = async () => {
          try { return await toArray(); } catch (cause) { nativeErrors.push({ name, code: cause.code, type: cause.name }); throw cause; }
        };
        return cursor;
      }; return c;
    };
  } }) };
  const sessions = jest.fn(() => journal.createReadSession());
  const reader = { ...journal, createReadSession: sessions, inventory: async function* () {
    for await (const entry of journal.inventory()) { yield entry; break; }
  } };
  const result = await inspect({ connection, journal: reader });
  expect(result.ready).toBe(false); expect(result.complete).toBe(false); expect(sessions).toHaveBeenCalledTimes(1);
  return { result, enteredNextPass, nativeErrors, discoveryReads };
};
test('D2B budget discovers each connected member once per paused closure without skipping audit', async () => {
  await graphFixture(4, true, 1); const before = await snapshot();
  const { result, enteredNextPass, nativeErrors, discoveryReads } = await firstClosure();
  expect(result.reasons).toEqual([NOT_READY]); expect(nativeErrors).toEqual([]);
  expect(enteredNextPass).toHaveBeenCalledTimes(1);
  expect(new Set(discoveryReads).size).toBe(13);
  expect(discoveryReads).toHaveLength(13);
  expect(await snapshot()).toEqual(before);
});
test.each(['foreign child', 'string BSON'])('D2B budget discovery never caches across checks: %s', async damage => {
  await graphFixture(3); expect((await run()).checked).toBe(true);
  await db.collection('mediauserdeletionrecoveries').updateOne({ mediaId: new ObjectId(oid(10001)) },
    { $set: { childId: damage === 'foreign child' ? new ObjectId(oid(999)) : oid(2) } });
  const before = await snapshot();
  expect((await inspect()).reasons).toEqual([INVALID]); expect(await snapshot()).toEqual(before);
});
test.each([[50, true, true], [51, true, false], [100, false, true], [101, false, false]])
('D2B-05 real connected %s proofs paired=%s share classification and dependency budget (fits=%s)', async (count, paired, fits) => {
  await graphFixture(count, paired); const before = await snapshot(), records = fileReads();
  const { result, enteredNextPass } = await firstClosure();
  expect(result.reasons).toEqual([fits ? NOT_READY : INVALID]);
  expect(enteredNextPass).toHaveBeenCalledTimes(fits ? 1 : 0);
  expect(records.filter(record => record.reads)).toHaveLength(100);
  expect(new Set(records.filter(record => record.reads).map(record => record.name)).size).toBe(100);
  expect(await snapshot()).toEqual(before);
});
test('D2B-05 real connected proof bytes exceed 16MiB before the 100-file ceiling', async () => {
  const proofs = await graphFixture(20, true, 80);
  const sizes = proofs.map(proof => Buffer.byteLength(serializeEvidence(proof)) + Buffer.byteLength(JSON.stringify(legacyProjection(proof)) + '\n'));
  expect(sizes.reduce((a, b) => a + b, 0)).toBeGreaterThan(16 * 1024 * 1024);
  const before = await snapshot(), records = fileReads();
  const { result, enteredNextPass, nativeErrors } = await firstClosure();
  expect({ reasons: result.reasons, nativeErrors, nextPass: enteredNextPass.mock.calls.length })
    .toEqual({ reasons: [INVALID], nativeErrors: [], nextPass: 0 });
  const read = records.filter(record => record.reads);
  expect(read.length).toBeGreaterThan(2); expect(read.length).toBeLessThan(100);
  expect(read.reduce((sum, record) => sum + record.bytes, 0)).toBeLessThanOrEqual(16 * 1024 * 1024);
  expect(records.at(-1).reads).toBe(0);
  expect(await snapshot()).toEqual(before);
});

test.each(['next', 'close', 'early exit'])('D2B-05 inventory %s failure closes real traversal and cannot report complete', async kind => {
  await fixture(); const before = await snapshot();
  const closed = jest.fn(), reader = { ...journal, inventory: async function* () {
    try {
      for await (const entry of journal.inventory()) { yield entry; if (kind === 'next') throw Error('private-sentinel next'); }
    } finally { closed(); if (kind === 'close') throw Error('private-sentinel close'); }
  } };
  if (kind === 'early exit') reader.createReadSession = () => ({ read: async () => { throw Error('private-sentinel read'); } });
  const result = await inspect({ journal: reader });
  expect(result).toMatchObject({ ready: false, complete: false, reasons: [NOT_READY] });
  expect(closed).toHaveBeenCalledTimes(1); expect(await snapshot()).toEqual(before);
});
test.each(['next', 'close'])('D2B-05 late native outbox cursor %s failure cannot report complete', async kind => {
  await fixture(); const before = await snapshot(), collection = db.collection.bind(db), closed = jest.fn();
  const connection = { db: new Proxy(db, { get(target, key) {
    if (key !== 'collection') return typeof target[key] === 'function' ? target[key].bind(target) : target[key];
    return name => {
      const c = collection(name), find = c.find.bind(c);
      c.find = (filter, ...args) => {
        const cursor = find(filter, ...args);
        if (name !== 'mediauserdeletionrecoveries' || Object.keys(filter).length) return cursor;
        return { async *[Symbol.asyncIterator]() { for await (const row of cursor) yield row; if (kind === 'next') throw Error('private-sentinel next'); },
          close: async () => { await cursor.close(); closed(); if (kind === 'close') throw Error('private-sentinel close'); } };
      }; return c;
    };
  } }) };
  const result = await inspect({ connection });
  expect(result).toMatchObject({ ready: false, complete: false, reasons: [NOT_READY], counts: { v1Files: 1, v2Files: 1, outboxes: 1, tombstones: 0 } });
  expect(closed).toHaveBeenCalledTimes(1); expect(await snapshot()).toEqual(before);
});
test('D2B-05 native in-progress uniqueness build is refused without starting another build', async () => {
  await fixture(); const c = db.collection('mediauserdeletionrecoveries'); await c.dropIndex('mediaId_1');
  let build;
  try {
    const configured = await db.admin().command({ configureFailPoint: 'hangAfterStartingIndexBuild', mode: 'alwaysOn' });
    build = c.createIndex({ mediaId: 1 }, { unique: true }).then(() => ({ ok: true }), error => ({ error }));
    await db.admin().command({ waitForFailPoint: 'hangAfterStartingIndexBuild', timesEntered: configured.count + 1, maxTimeMS: 5000 });
    await expect(run()).rejects.toMatchObject({ code: NOT_READY, complete: false });
  } finally {
    await db.admin().command({ configureFailPoint: 'hangAfterStartingIndexBuild', mode: 'off' });
    if (build) expect(await build).toEqual({ ok: true });
  }
  expect((await run()).checked).toBe(true);
});

test('D2B-05 applied closure performs no native or filesystem mutations, sync, transactions or borrowed close', async () => {
  await chainFixture(); const before = await snapshot(), attempts = jest.fn(() => { throw Error('private-sentinel mutation'); });
  const collection = db.collection.bind(db), close = jest.fn(), originalSession = client.startSession.bind(client);
  const startSession = jest.spyOn(client, 'startSession').mockImplementation(config => {
    if (config?.explicit !== false) return attempts();
    const session = originalSession(config); session.startTransaction = attempts; session.withTransaction = attempts; return session;
  });
  const mutationMethods = ['insertOne', 'insertMany', 'updateOne', 'updateMany', 'replaceOne', 'deleteOne', 'deleteMany',
    'findOneAndUpdate', 'findOneAndReplace', 'findOneAndDelete', 'bulkWrite', 'createIndex', 'createIndexes', 'dropIndex', 'dropIndexes', 'drop', 'rename'];
  const connection = { close, db: new Proxy(db, { get(target, key) {
    if (['createCollection', 'dropCollection', 'dropDatabase', 'command'].includes(key)) return attempts;
    if (key !== 'collection') return typeof target[key] === 'function' ? target[key].bind(target) : target[key];
    return name => { const c = collection(name); for (const method of mutationMethods) c[method] = attempts; return c; };
  } }) };
  for (const method of ['writeFile', 'appendFile', 'copyFile', 'cp', 'link', 'symlink', 'unlink', 'rm', 'rmdir', 'mkdir',
    'mkdtemp', 'chmod', 'chown', 'rename', 'truncate', 'utimes']) jest.spyOn(fs, method).mockImplementation(attempts);
  const open = fs.open.bind(fs), flags = require('fs').constants;
  jest.spyOn(fs, 'open').mockImplementation(async (name, mode, ...rest) => {
    if (typeof mode !== 'number' || mode & (flags.O_WRONLY | flags.O_RDWR | flags.O_CREAT | flags.O_TRUNC | flags.O_APPEND)) return attempts();
    const handle = await open(name, mode, ...rest);
    for (const method of ['write', 'writev', 'writeFile', 'appendFile', 'truncate', 'chmod', 'chown', 'utimes', 'sync', 'datasync']) handle[method] = attempts;
    return handle;
  });
  expect((await run({ connection })).checked).toBe(true);
  expect(attempts).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  expect(startSession.mock.calls.every(([config]) => config.explicit === false)).toBe(true);
  jest.restoreAllMocks(); expect(await snapshot()).toEqual(before);
});
test.each(['created after deletion', 'updated before deletion'])('D2B-05 surviving asset rejects %s', async kind => {
  await fixture(); expect((await run()).checked).toBe(true);
  await db.collection('mediaassets').updateOne({}, { $set: kind === 'created after deletion'
    ? { createdAt: new Date(TIMES.evidence), updatedAt: new Date(TIMES.evidence) }
    : { updatedAt: new Date(TIMES.committed) } });
  await refused();
});
test('D2B-05 ordinary pre-deletion unbind is accepted but cannot explain a later version gap', async () => {
  const { proof, op } = await groupFixture();
  const releasedAt = '2026-10-21T00:00:00.000Z', updatedAt = '2026-10-21T00:00:00.001Z';
  const after = { ...op, version: 2, updatedAt };
  const historical = reseal({ ...proof, operations: [{ before: null, after }], referenceEffects: [], receipts: [] });
  await db.collection('mediareferenceoperations').replaceOne({}, native(after));
  await db.collection('mediareferences').updateOne({ mediaId: new ObjectId(oid(4)) },
    { $set: { releasedAt: new Date(releasedAt), updatedAt: new Date(updatedAt), releaseOperationId: uuid(789) } });
  await db.collection('mediadeletionreceipts').deleteMany({}); await replaceProof(historical);
  const before = await snapshot(); expect((await run()).checked).toBe(true); expect(await snapshot()).toEqual(before);
  await db.collection('mediareferenceoperations').updateOne({}, { $set: { version: 3, updatedAt: new Date(TIMES.updated) } });
  await blocked(PENDING);
});

const { randomUUID, createHash } = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

jest.setTimeout(30000);
const id = () => new ObjectId();
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const FIELD = 'completionMediaIds', DATE = new Date('2026-10-23T00:00:00Z');
const specs = {
  completionuploadguards: [[{ mediaId: 1 }, { unique: true }]],
  mediaorphanretirements: [[{ mediaId: 1 }, { unique: true }]],
  mediaassets: [[{ familyId: 1, storageKey: 1 }, { unique: true }],
    [{ purpose: 1, status: 1, retentionPolicyVersion: 1, orphanEligibleAt: 1 }, {}],
    [{ purpose: 1, status: 1, retentionPolicyVersion: 1, orphanLastCheckedAt: 1, _id: 1, orphanEligibleAt: 1 },
      { name: 'completion_orphan_schedule' }]],
  mediareferenceoperations: [[{ familyId: 1, childId: 1, resourceType: 1, resourceId: 1, field: 1, operationId: 1 }, { unique: true }],
    [{ 'references.mediaId': 1, _id: 1 }, {}]],
  mediareferences: [[{ familyId: 1, mediaId: 1, resourceType: 1, resourceId: 1, field: 1 }, { unique: true }]],
  mediadeletiontombstones: [[{ mediaId: 1 }, { unique: true }]],
  mediadeletionreceipts: [[{ familyId: 1, childId: 1, mediaId: 1, resourceType: 1, resourceId: 1, field: 1, bindingOperationId: 1 }, { unique: true }]]
};
let mongo, client, db, journal, retirementClient;
const run = options => require('../services/completionRetentionReadiness').assertCompletionRetentionReadiness({
  connection: { db }, writesPaused: true, journal, retirementClient, ...options
});
const blocked = async (issue, options) => {
  let error; try { await run(options); } catch (cause) { error = cause; }
  expect(error).toMatchObject({ code: 'COMPLETION_RETENTION_NOT_READY', issues: expect.arrayContaining([issue]) });
  expect(error.message).toBe('Completion retention readiness check failed');
  expect(JSON.stringify(error)).not.toMatch(/private-error|mongodb:|storageKey|familyId|childId|operationId/);
};
const snapshot = async () => {
  const result = {};
  for (const name of Object.keys(specs)) result[name] = {
    rows: await db.collection(name).find().sort({ _id: 1 }).toArray(), indexes: await db.collection(name).listIndexes().toArray()
  };
  return result;
};
const fixture = async (state = 'DELETED') => {
  const mediaId = id(), familyId = id(), childId = id(), uploadedBy = id(), storageKey = randomUUID();
  const metadata = { familyId: String(familyId), childId: String(childId), uploadedBy: String(uploadedBy),
    purpose: 'task_completion', mimeType: 'image/jpeg', displayName: 'task-completion', sizeBytes: 9,
    pageCount: null, storageKey, malwareScanStatus: 'skipped_trusted_local', malwareScannedAt: null };
  const record = { _id: id(), mediaId, familyId, childId, storageKey, uploadMetadataHash: hash(metadata),
    retirementId: randomUUID(), retentionPolicyVersion: 1, orphanEligibleAt: DATE,
    actorType: 'system', state, revision: 3, createdAt: DATE,
    deletedAt: ['DELETED', 'PURGED'].includes(state) ? DATE : null,
    purgedAt: state === 'PURGED' ? DATE : null, evidence: null };
  const references = [{ mediaId, field: FIELD }];
  const op = { _id: id(), familyId, childId, resourceId: id(), resourceType: 'growth_task', field: FIELD,
    operationId: randomUUID(), commandHash: 'a'.repeat(64), referenceSetHash: hash([{ mediaId: String(mediaId), field: FIELD }]),
    references, state: 'ABORTED', version: 2, leaseExpiresAt: null, terminalAt: DATE, failureCode: 'MEDIA_OPERATION_ABORTED' };
  const ref = { _id: id(), familyId, childId, mediaId, resourceId: op.resourceId, resourceType: 'growth_task', field: FIELD,
    operationId: op.operationId, releaseOperationId: op.operationId, state: 'released', leaseExpiresAt: null, releasedAt: DATE };
  const stringScope = { familyId: String(familyId), childId: String(childId) };
  const opSnapshot = { ...op, _id: String(op._id), ...stringScope, resourceId: String(op.resourceId),
    references: [{ mediaId: String(mediaId), field: FIELD }], terminalAt: DATE.toISOString() };
  const refSnapshot = { ...ref, _id: String(ref._id), ...stringScope, resourceId: String(ref.resourceId),
    mediaId: String(mediaId), releasedAt: DATE.toISOString() };
  if (record.deletedAt) record.evidence = { version: 1, retirement: { mediaId: String(mediaId), ...stringScope,
    retirementId: record.retirementId, storageKey, retentionPolicyVersion: 1, uploadMetadataHash: record.uploadMetadataHash,
    orphanEligibleAt: DATE.toISOString(), actorType: 'system', createdAt: DATE.toISOString(), deletedAt: DATE.toISOString() },
  operations: [opSnapshot], references: [refSnapshot] };
  await db.collection('mediaorphanretirements').insertOne(record);
  await db.collection('completionuploadguards').insertOne({ _id: id(), mediaId, familyId, childId, storageKey,
    metadataHash: record.uploadMetadataHash, state: record.deletedAt ? 'RETIRED' : 'REGISTERED', revision: 2,
    createdAt: DATE, updatedAt: DATE });
  await db.collection('mediareferenceoperations').insertOne(op);
  if (state !== 'PURGED') {
    await db.collection('mediareferences').insertOne(ref);
    await db.collection('mediaassets').insertOne({ ...metadata, _id: mediaId, familyId, childId, uploadedBy,
      status: record.deletedAt ? 'deleted' : 'active', privacyDeletionRecorded: false,
      ...(record.deletedAt ? { orphanRetirementId: record.retirementId } : {}), deletedAt: record.deletedAt,
      retentionPolicyVersion: 1, orphanEligibleAt: DATE });
  }
  journal.read.mockResolvedValue(record.evidence);
  return { record, op, ref };
};
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 },
    instanceOpts: [{ args: ['--setParameter', 'enableTestCommands=1'] }] });
  client = await MongoClient.connect(mongo.getUri()); db = client.db('retention_readiness_synthetic');
});
beforeEach(async () => {
  await db.dropDatabase();
  for (const [name, indexes] of Object.entries(specs)) {
    await db.createCollection(name);
    for (const [key, options] of indexes) await db.collection(name).createIndex(key, options);
  }
  journal = { read: jest.fn(), persist: jest.fn(() => { throw Error('Unexpected journal write'); }) };
  retirementClient = { status: jest.fn(async body => ({ ...body, state: 'retired' })),
    retire: jest.fn(() => { throw Error('Unexpected retirement write'); }) };
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => { await client?.close(); await mongo?.stop(); });

test('empty explicit retention preflight is read only and does not require external dependencies', async () => {
  const before = await snapshot(); expect((await run({ journal: undefined, retirementClient: undefined })).ready).toBe(true);
  expect(await snapshot()).toEqual(before);
});
test.each([false, undefined, 'true'])('requires writesPaused exactly true (%s)', async writesPaused => {
  await blocked('WRITES_NOT_PAUSED', { writesPaused, connection: { get db() { throw Error('private-error'); } } });
});
test('requires a transaction-capable replica set', async () => {
  await blocked('TRANSACTIONS_UNAVAILABLE', { connection: { db: { admin: () => ({ command: async () => ({ isWritablePrimary: true }) }) } } });
});
test.each(Object.keys(specs))('missing %s collection fails closed', async name => {
  await db.collection(name).drop(); await blocked('COLLECTION_MISSING');
});
test.each(['completionuploadguards', 'mediaorphanretirements', 'mediaassets', 'mediareferenceoperations'])
('required indexes on %s cannot be omitted', async name => {
  await db.collection(name).dropIndexes(); await blocked('INDEX_INVALID');
});
test.each(['missing', 'hidden', 'reordered', 'partial', 'sparse'])('fairness schedule index rejects %s', async kind => {
  const c = db.collection('mediaassets'), [key] = specs.mediaassets[2];
  await c.dropIndex('completion_orphan_schedule');
  if (kind !== 'missing') await c.createIndex(kind === 'reordered'
    ? { purpose: 1, status: 1, retentionPolicyVersion: 1, orphanLastCheckedAt: 1, orphanEligibleAt: 1, _id: 1 } : key,
  { name: 'completion_orphan_schedule', ...(kind === 'hidden' ? { hidden: true } : {}),
    ...(kind === 'partial' ? { partialFilterExpression: { status: 'active' } } : {}),
    ...(kind === 'sparse' ? { sparse: true } : {}) });
  const before = await snapshot(); await blocked('INDEX_INVALID'); expect(await snapshot()).toEqual(before);
});
test('fairness schedule index accepts the exact nonunique keys under a different name', async () => {
  const c = db.collection('mediaassets'), [key] = specs.mediaassets[2];
  await c.dropIndex('completion_orphan_schedule'); await c.createIndex(key, { name: 'equivalent_schedule' });
  const before = await snapshot(); expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(before);
});
test.each(['partial', 'sparse', 'collation', 'ttl', 'extra unique'])('rejects unsafe %s index', async kind => {
  const c = db.collection('completionuploadguards');
  if (kind === 'extra unique') await c.createIndex({ storageKey: 1 }, { unique: true });
  else if (kind === 'ttl') await c.createIndex({ createdAt: 1 }, { expireAfterSeconds: 100 });
  else {
    await c.dropIndexes();
    await c.createIndex({ mediaId: 1 }, { unique: true, ...(kind === 'partial' ? { partialFilterExpression: { state: 'RETIRED' } }
      : kind === 'sparse' ? { sparse: true } : { collation: { locale: 'en', strength: 2 } }) });
  }
  await blocked(kind === 'ttl' ? 'TTL_FORBIDDEN' : kind === 'extra unique' ? 'UNEXPECTED_UNIQUE_INDEX' : 'INDEX_INVALID');
});
test('collection collation cannot hide behind a simple unique index', async () => {
  await db.collection('completionuploadguards').drop();
  await db.createCollection('completionuploadguards', { collation: { locale: 'en', strength: 2 } });
  await db.collection('completionuploadguards').createIndex({ mediaId: 1 }, { unique: true, collation: { locale: 'simple' } });
  await blocked('COLLECTION_COLLATION_INVALID');
});
test.each(['buildUUID', 'spec', 'indexBuildInfo', 'prepareUnique'])('rejects %s even on the expected key', async flag => {
  const original = db.runCursorCommand.bind(db), closes = [];
  jest.spyOn(db, 'runCursorCommand').mockImplementation((command, options) => {
    const cursor = original(command, options);
    if (command.listIndexes === 'completionuploadguards') {
      const array = cursor.toArray.bind(cursor); jest.spyOn(cursor, 'close'); closes.push(cursor);
      jest.spyOn(cursor, 'toArray').mockImplementation(async () => (await array()).map(index => index.key.mediaId ? { ...index, [flag]: true } : index));
    }
    return cursor;
  });
  await blocked(flag === 'prepareUnique' ? 'INDEX_PREPARE_UNIQUE_FORBIDDEN' : 'INDEX_BUILD_IN_PROGRESS');
  expect(closes.every(cursor => cursor.close.mock.calls.length)).toBe(true);
});
test.each(['CANDIDATE', 'FENCED', 'DELETED', 'PURGED'])('valid %s is read only', async state => {
  const { record } = await fixture(state), before = await snapshot();
  expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(before);
  expect(retirementClient.retire).not.toHaveBeenCalled(); expect(journal.persist).not.toHaveBeenCalled();
  if (state !== 'CANDIDATE') expect(retirementClient.status).toHaveBeenCalledWith({ familyId: String(record.familyId),
    childId: String(record.childId), mediaId: String(record.mediaId), retirementId: record.retirementId });
});
test.each(['absent', 'available', 'granted', 'wrong id', 'extra field', 'unavailable', 'missing'])('cross-service %s fails closed', async kind => {
  await fixture('FENCED');
  retirementClient.status.mockImplementation(async body => {
    if (kind === 'unavailable') throw Error('mongodb://private-error');
    return { ...body, state: 'retired', ...(kind === 'wrong id' ? { retirementId: randomUUID() }
      : kind === 'extra field' ? { private: true } : { state: kind }) };
  });
  await blocked('RETIREMENT_STATUS_UNAVAILABLE', kind === 'missing' ? { retirementClient: undefined } : {});
});
test.each(['missing', 'mismatch', 'unavailable', 'no dependency'])('journal %s fails closed', async kind => {
  await fixture();
  if (kind === 'missing') journal.read.mockResolvedValue(null);
  if (kind === 'mismatch') journal.read.mockResolvedValue({ version: 1 });
  if (kind === 'unavailable') journal.read.mockRejectedValue(Error('mongodb://private-error'));
  await blocked('SYSTEM_JOURNAL_INVALID', kind === 'no dependency' ? { journal: undefined } : {});
});
test('journal compares deep canonical content not object insertion order', async () => {
  const { record } = await fixture();
  const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorder(item)])) : value;
  journal.read.mockResolvedValue(reorder(record.evidence)); expect((await run()).ready).toBe(true);
});
test('explicit recovery preflight allows only a confirmed missing DELETED journal without writes', async () => {
  await fixture(); journal.read.mockResolvedValue(null); const before = await snapshot();
  expect(await run({ allowMissingDeletedJournal: true })).toMatchObject({ ready: true, scope: 'completion-retention-recovery' });
  expect(await snapshot()).toEqual(before); expect(journal.persist).not.toHaveBeenCalled(); expect(retirementClient.retire).not.toHaveBeenCalled();
  await blocked('SYSTEM_JOURNAL_INVALID');
});
test.each(['PURGED', 'undefined', 'error', 'conflict', 'missing reader', 'string flag'])
('recovery preflight cannot excuse %s journal evidence', async kind => {
  await fixture(kind === 'PURGED' ? 'PURGED' : 'DELETED'); journal.read.mockResolvedValue(null);
  if (kind === 'undefined') journal.read.mockResolvedValue(undefined);
  if (kind === 'error') journal.read.mockRejectedValue(Error('mongodb://private-error'));
  if (kind === 'conflict') journal.read.mockResolvedValue({ version: 1, retirement: {} });
  await blocked('SYSTEM_JOURNAL_INVALID', { allowMissingDeletedJournal: kind === 'string flag' ? 'true' : true,
    ...(kind === 'missing reader' ? { journal: undefined } : {}) });
});
test.each(['index', 'guard', 'history', 'reference', 'status', 'marker'])
('recovery preflight retains full %s validation with no journal', async kind => {
  await fixture(); journal.read.mockResolvedValue(null);
  if (kind === 'index') await db.collection('completionuploadguards').dropIndexes();
  if (kind === 'guard') await db.collection('completionuploadguards').deleteMany({});
  if (kind === 'history') await db.collection('mediareferenceoperations').deleteMany({});
  if (kind === 'reference') await db.collection('mediareferences').updateOne({}, { $set: { state: 'bound' } });
  if (kind === 'status') retirementClient.status.mockImplementation(async body => ({ ...body, state: 'available' }));
  if (kind === 'marker') await db.collection('mediaassets').updateOne({}, { $set: { orphanRetirementId: randomUUID() } });
  await expect(run({ allowMissingDeletedJournal: true })).rejects.toMatchObject({ code: 'COMPLETION_RETENTION_NOT_READY' });
});
test.each(['string scope', 'bad hash', 'bad revision', 'bad date', 'bad state'])('invalid upload guard %s fails', async kind => {
  await fixture(); const patch = kind === 'string scope' ? { familyId: String(id()) } : kind === 'bad hash' ? { metadataHash: 'bad' }
    : kind === 'bad revision' ? { revision: 0 } : kind === 'bad date' ? { createdAt: DATE.toISOString() } : { state: 'OTHER' };
  await db.collection('completionuploadguards').updateOne({}, { $set: patch }); await blocked('UPLOAD_GUARD_INVALID');
});
test.each(['string id', 'string scope', 'bad date', 'bad revision', 'inconsistent'])('invalid retirement %s fails', async kind => {
  await fixture(); const patch = kind === 'string id' ? { mediaId: String(id()) } : kind === 'string scope' ? { childId: String(id()) }
    : kind === 'bad date' ? { deletedAt: DATE.toISOString() } : kind === 'bad revision' ? { revision: 0 } : { state: 'INCONSISTENT' };
  await db.collection('mediaorphanretirements').updateOne({}, { $set: patch }); await blocked('RETIREMENT_INVALID');
});
test.each(['missing guard', 'registered guard', 'guard scope', 'asset marker', 'asset date', 'user collision',
  'missing operation', 'operation hash', 'reference mismatch', 'missing evidence', 'frozen hash'])('rejects corrupt system proof: %s', async kind => {
  const { record } = await fixture();
  if (kind === 'missing guard') await db.collection('completionuploadguards').deleteMany({});
  if (kind === 'registered guard') await db.collection('completionuploadguards').updateOne({}, { $set: { state: 'REGISTERED' } });
  if (kind === 'guard scope') await db.collection('completionuploadguards').updateOne({}, { $set: { childId: id() } });
  if (kind === 'asset marker') await db.collection('mediaassets').updateOne({}, { $set: { orphanRetirementId: randomUUID() } });
  if (kind === 'asset date') await db.collection('mediaassets').updateOne({}, { $set: { deletedAt: new Date(DATE.getTime() + 1) } });
  if (kind === 'user collision') await db.collection('mediadeletiontombstones').insertOne({ mediaId: record.mediaId });
  if (kind === 'missing operation') await db.collection('mediareferenceoperations').deleteMany({});
  if (kind === 'operation hash') await db.collection('mediareferenceoperations').updateOne({}, { $set: { referenceSetHash: 'b'.repeat(64) } });
  if (kind === 'reference mismatch') await db.collection('mediareferences').updateOne({}, { $set: { releasedAt: new Date(DATE.getTime() + 1) } });
  if (kind === 'missing evidence') await db.collection('mediaorphanretirements').updateOne({}, { $unset: { evidence: '' } });
  if (kind === 'frozen hash') await db.collection('mediaorphanretirements').updateOne({}, { $set: { 'evidence.operations.0.commandHash': 'b'.repeat(64) } });
  await expect(run()).rejects.toMatchObject({ code: 'COMPLETION_RETENTION_NOT_READY' });
});
test.each(['asset', 'prepared', 'bound', 'released'])('PURGED rejects surviving %s', async kind => {
  const { record, ref } = await fixture('PURGED');
  if (kind === 'asset') await db.collection('mediaassets').insertOne({ _id: record.mediaId });
  else await db.collection('mediareferences').insertOne({ ...ref, state: kind });
  await blocked('SYSTEM_EVIDENCE_INVALID');
});
test.each(['DELETED', 'PURGED'])('late born-ABORTED extras preserve all frozen generations at %s', async state => {
  const { op } = await fixture(state);
  await db.collection('mediareferenceoperations').insertOne({ ...op, _id: id(), operationId: randomUUID(), version: 0 });
  expect((await run()).ready).toBe(true);
});
test.each(['DELETED', 'PURGED'])('all A/B frozen generations and the latest reference remain valid at %s', async state => {
  const { record, op } = await fixture(state);
  const older = { ...op, _id: new ObjectId('000000000000000000000001'), operationId: randomUUID() };
  await db.collection('mediareferenceoperations').insertOne(older);
  record.evidence.operations.unshift({ ...record.evidence.operations[0], _id: String(older._id), operationId: older.operationId });
  await db.collection('mediaorphanretirements').updateOne({}, { $set: { evidence: record.evidence } });
  journal.read.mockResolvedValue(record.evidence);
  expect((await run()).ready).toBe(true);
  await db.collection('mediareferenceoperations').deleteOne({ _id: older._id });
  await blocked('SYSTEM_EVIDENCE_INVALID');
});
test('PURGED cannot lose the frozen released set for previously prepared operations', async () => {
  const { record } = await fixture('PURGED'); record.evidence.references = [];
  await db.collection('mediaorphanretirements').updateOne({}, { $set: { evidence: record.evidence } });
  journal.read.mockResolvedValue(record.evidence); await blocked('SYSTEM_EVIDENCE_INVALID');
});
test.each(['history', 'reference'])('string media identity in late %s cannot evade native lookups', async kind => {
  const { op, ref } = await fixture('PURGED');
  if (kind === 'history') await db.collection('mediareferenceoperations').insertOne({ ...op, _id: id(), operationId: randomUUID(),
    references: [{ mediaId: String(ref.mediaId), field: FIELD }], version: 0 });
  else await db.collection('mediareferences').insertOne({ ...ref, mediaId: String(ref.mediaId) });
  await blocked('SYSTEM_EVIDENCE_INVALID');
});
test('system asset with string native identity is not an unrelated unreferenced asset', async () => {
  const { record } = await fixture('PURGED');
  await db.collection('mediaassets').insertOne({ _id: String(record.mediaId), purpose: 'task_completion', status: 'active' });
  await blocked('ASSET_RETENTION_INVALID');
});
test('native streaming preflight closes every cursor and never calls write methods', async () => {
  await fixture(); const before = await snapshot(), open = db.collection.bind(db), opened = new Map(), cursors = [], writes = [];
  jest.spyOn(db, 'collection').mockImplementation(name => {
    if (!opened.has(name)) {
      const c = open(name), find = c.find.bind(c);
      jest.spyOn(c, 'find').mockImplementation((filter, options) => {
        expect(options).toMatchObject({ projection: expect.any(Object), maxTimeMS: 5000, readPreference: 'primary' });
        expect(options.projection).not.toHaveProperty('displayName');
        if (name === 'mediaassets') expect(options.projection.orphanLastCheckedAt).toBe(1);
        const cursor = find(filter, { ...options, batchSize: 1 }); jest.spyOn(cursor, 'close'); cursors.push(cursor); return cursor;
      });
      for (const method of ['insertOne', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'createIndex', 'drop']) {
        writes.push(jest.spyOn(c, method).mockImplementation(() => { throw Error('Unexpected write'); }));
      }
      opened.set(name, c);
    }
    return opened.get(name);
  });
  expect((await run()).ready).toBe(true);
  expect(cursors.length).toBeGreaterThan(0); for (const cursor of cursors) expect(cursor.close).toHaveBeenCalled();
  for (const write of writes) expect(write).not.toHaveBeenCalled();
  jest.restoreAllMocks(); expect(await snapshot()).toEqual(before);
});
test.each(['version', 'time', 'code', 'group reference', 'missing original'])('late extras reject %s', async kind => {
  const { op, ref } = await fixture();
  const late = { ...op, _id: id(), operationId: randomUUID(), version: kind === 'version' ? 1 : 0,
    terminalAt: kind === 'time' ? new Date(DATE.getTime() - 1) : DATE,
    failureCode: kind === 'code' ? 'MEDIA_OPERATION_EXPIRED' : 'RESOURCE_NOT_FOUND' };
  await db.collection('mediareferenceoperations').insertOne(late);
  if (kind === 'group reference') await db.collection('mediareferences').insertOne({ ...ref, _id: id(), mediaId: id(), operationId: late.operationId });
  if (kind === 'missing original') await db.collection('mediareferenceoperations').deleteOne({ _id: op._id });
  await blocked('SYSTEM_EVIDENCE_INVALID');
});
test('cold import cannot load any model or mongoose', () => {
  const { spawnSync } = require('child_process'), target = require.resolve('../services/completionRetentionReadiness');
  const script = `const Module=require('module'),load=Module._load;Module._load=function(request,parent){
    const file=Module._resolveFilename(request,parent);if(request==='mongoose'||/[\\\\/]models[\\\\/]|[\\\\/]mongoose[\\\\/]/.test(file))throw Error('forbidden model');
    return load.apply(this,arguments);};require(${JSON.stringify(target)});`;
  const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: '' });
});
test.each(['read', 'close'])('scan %s error closes cursor and redacts details', async kind => {
  const open = db.collection.bind(db), close = jest.fn(async () => { if (kind === 'close') throw Error('private-error'); });
  const target = open('mediaorphanretirements');
  jest.spyOn(target, 'find').mockReturnValue({ close, async *[Symbol.asyncIterator]() { if (kind === 'read') throw Error('mongodb://private-error'); } });
  jest.spyOn(db, 'collection').mockImplementation(name => name === 'mediaorphanretirements' ? target : open(name));
  await blocked('READINESS_QUERY_FAILED'); expect(close).toHaveBeenCalled();
});
test('native prepareUnique conversion cannot pass the finalized index check', async () => {
  await db.collection('completionuploadguards').dropIndexes(); await db.collection('completionuploadguards').createIndex({ mediaId: 1 });
  await db.command({ collMod: 'completionuploadguards', index: { keyPattern: { mediaId: 1 }, prepareUnique: true } });
  await blocked('INDEX_PREPARE_UNIQUE_FORBIDDEN');
});
test('hidden finalized unique indexes still enforce the guard identity', async () => {
  await db.command({ collMod: 'completionuploadguards', index: { keyPattern: { mediaId: 1 }, hidden: true } });
  expect((await run()).ready).toBe(true);
});
test('hidden history scan index is not a usable retention prerequisite', async () => {
  await db.command({ collMod: 'mediareferenceoperations', index: { keyPattern: { 'references.mediaId': 1, _id: 1 }, hidden: true } });
  await blocked('INDEX_INVALID');
});
test('an actual in-progress unique build cannot pass retention preflight', async () => {
  await fixture(); const c = db.collection('completionuploadguards'); await c.dropIndexes();
  let build;
  try {
    const configured = await db.admin().command({ configureFailPoint: 'hangAfterStartingIndexBuild', mode: 'alwaysOn' });
    build = c.createIndex({ mediaId: 1 }, { unique: true }).then(() => ({ ok: true }), error => ({ error }));
    await db.admin().command({ waitForFailPoint: 'hangAfterStartingIndexBuild', timesEntered: configured.count + 1, maxTimeMS: 5000 });
    const before = await snapshot(); await blocked('INDEX_BUILD_IN_PROGRESS'); expect(await snapshot()).toEqual(before);
  } finally {
    await db.admin().command({ configureFailPoint: 'hangAfterStartingIndexBuild', mode: 'off' });
    if (build) expect(await build).toEqual({ ok: true });
  }
  expect((await run()).ready).toBe(true);
});
test.each(['tombstone', 'receipt'])('textual %s collision still blocks system deletion', async kind => {
  const { record } = await fixture('PURGED');
  await db.collection(kind === 'tombstone' ? 'mediadeletiontombstones' : 'mediadeletionreceipts').insertOne({ mediaId: String(record.mediaId) });
  await blocked('SYSTEM_EVIDENCE_INVALID');
});
test('a purged retired upload guard cannot hide a missing retirement record', async () => {
  await fixture('PURGED'); await db.collection('mediaorphanretirements').deleteMany({});
  await blocked('UPLOAD_GUARD_INVALID');
});
test('REGISTERED guard without its atomically created asset is not ready', async () => {
  await fixture('CANDIDATE'); await db.collection('mediaassets').deleteMany({}); await db.collection('mediareferences').deleteMany({});
  await db.collection('mediaorphanretirements').deleteMany({}); await blocked('UPLOAD_GUARD_INVALID');
});
test('legacy active asset without an upload guard remains compatible and is not upgraded', async () => {
  await db.collection('mediaassets').insertOne({ _id: id(), familyId: id(), childId: id(), uploadedBy: id(),
    purpose: 'task_completion', status: 'active', mimeType: 'image/jpeg', storageKey: randomUUID(), sizeBytes: 9 });
  const before = await snapshot(); expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(before);
});
test.each([['missing', undefined], ['null', null], ['date', DATE]])
('orphanLastCheckedAt accepts %s without changing audit or metadata evidence', async (_label, value) => {
  await fixture();
  if (value !== undefined) await db.collection('mediaassets').updateOne({}, { $set: { orphanLastCheckedAt: value } });
  const before = await snapshot(); expect((await run()).ready).toBe(true);
  expect(await snapshot()).toEqual(before); expect(journal.persist).not.toHaveBeenCalled();
  expect(retirementClient.retire).not.toHaveBeenCalled();
});
test.each([['string', DATE.toISOString()], ['number', DATE.getTime()], ['boolean', false],
  ['object', { date: DATE }], ['array', [DATE]]])
('orphanLastCheckedAt rejects BSON %s on an unguarded legacy asset', async (_label, value) => {
  await db.collection('mediaassets').insertOne({ _id: id(), familyId: id(), childId: id(),
    purpose: 'task_completion', status: 'active', storageKey: randomUUID(), orphanLastCheckedAt: value });
  const before = await snapshot(); await blocked('ASSET_RETENTION_INVALID'); expect(await snapshot()).toEqual(before);
});
test('orphanLastCheckedAt is checked by the exported native system evidence predicate', async () => {
  const { record } = await fixture();
  await db.collection('mediaassets').updateOne({}, { $set: { orphanLastCheckedAt: DATE.toISOString() } });
  const before = await snapshot();
  await expect(require('../services/completionRetentionReadiness').validateSystemRetirement({
    connection: { db }, writesPaused: true, mediaId: record.mediaId, journal, retirementClient
  })).rejects.toMatchObject({ code: 'COMPLETION_RETENTION_NOT_READY', issues: ['SYSTEM_EVIDENCE_INVALID'] });
  expect(await snapshot()).toEqual(before);
});
const pendingUserDeletion = async state => {
  const { record } = await fixture(state);
  await db.collection('completionuploadguards').updateOne({}, { $set: { state: 'RETIRED' } });
  await db.collection('mediaassets').updateOne({}, { $set: { status: 'deleted', privacyDeletionRecorded: true, deletedAt: DATE } });
  await db.collection('mediadeletiontombstones').insertOne({ _id: id(), mediaId: record.mediaId, familyId: record.familyId,
    childId: record.childId, actorId: id(), role: 'parent', purpose: 'task_completion', reason: 'user_requested', deletedAt: DATE });
  return record;
};
test.each(['CANDIDATE', 'FENCED'])('explicit recovery permits fully evidenced user deletion awaiting %s supersession', async state => {
  await pendingUserDeletion(state); const before = await snapshot();
  await expect(run()).rejects.toMatchObject({ code: 'COMPLETION_RETENTION_NOT_READY' });
  expect((await run({ allowSupersededRetirementRecovery: true })).scope).toBe('completion-retention-recovery');
  expect(await snapshot()).toEqual(before); expect(retirementClient.retire).not.toHaveBeenCalled(); expect(journal.persist).not.toHaveBeenCalled();
  if (state === 'CANDIDATE') expect(retirementClient.status).not.toHaveBeenCalled();
});
test.each(['CANDIDATE', 'FENCED'])('recovery can resume %s after user cleanup removed asset and references', async state => {
  await pendingUserDeletion(state); await db.collection('mediaassets').deleteMany({}); await db.collection('mediareferences').deleteMany({});
  expect((await run({ allowSupersededRetirementRecovery: true })).ready).toBe(true);
});
test.each(['CANDIDATE', 'FENCED'].flatMap(state => ['missing', 'offline'].map(remote => [state, remote])))
('fully evidenced %s supersession recovery ignores %s status without reads or writes to the remote service', async (state, remote) => {
  await pendingUserDeletion(state);
  retirementClient.status.mockRejectedValue(Error('private-error: offline'));
  const before = await snapshot(), open = db.collection.bind(db), collections = new Map(), writes = [];
  jest.spyOn(db, 'collection').mockImplementation(name => {
    if (!collections.has(name)) {
      const collection = open(name);
      for (const method of ['insertOne', 'insertMany', 'updateOne', 'updateMany', 'replaceOne', 'deleteOne',
        'deleteMany', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace', 'bulkWrite', 'createIndex', 'drop']) {
        writes.push(jest.spyOn(collection, method).mockImplementation(() => { throw Error('Unexpected DB write'); }));
      }
      collections.set(name, collection);
    }
    return collections.get(name);
  });
  expect(await run({ allowSupersededRetirementRecovery: true,
    retirementClient: remote === 'missing' ? undefined : retirementClient }))
    .toMatchObject({ ready: true, scope: 'completion-retention-recovery' });
  for (const write of writes) expect(write).not.toHaveBeenCalled();
  expect(retirementClient.status).not.toHaveBeenCalled(); expect(retirementClient.retire).not.toHaveBeenCalled();
  expect(journal.read).not.toHaveBeenCalled(); expect(journal.persist).not.toHaveBeenCalled();
  jest.restoreAllMocks(); expect(await snapshot()).toEqual(before);
});
test.each(['FENCED', 'DELETED', 'PURGED'])('supersession recovery still requires remote status for system %s', async state => {
  await fixture(state); retirementClient.status.mockRejectedValue(Error('private-error: offline'));
  await expect(run({ allowSupersededRetirementRecovery: true }))
    .rejects.toMatchObject({ code: 'COMPLETION_RETENTION_NOT_READY' });
  expect(retirementClient.status).toHaveBeenCalled(); expect(retirementClient.retire).not.toHaveBeenCalled();
});
test.each(['scope', 'date', 'audit', 'marker', 'guard', 'reference', 'flag'])
('supersession recovery never excuses invalid %s evidence', async kind => {
  await pendingUserDeletion('FENCED');
  if (kind === 'scope') await db.collection('mediadeletiontombstones').updateOne({}, { $set: { childId: id() } });
  if (kind === 'date') await db.collection('mediaassets').updateOne({}, { $set: { deletedAt: new Date(DATE.getTime() + 1) } });
  if (kind === 'audit') await db.collection('mediadeletiontombstones').updateOne({}, { $unset: { actorId: '' } });
  if (kind === 'marker') await db.collection('mediaassets').updateOne({}, { $set: { orphanRetirementId: randomUUID() } });
  if (kind === 'guard') await db.collection('completionuploadguards').deleteMany({});
  if (kind === 'reference') await db.collection('mediareferences').updateOne({}, { $set: { state: 'bound', releasedAt: null } });
  await expect(run({ allowSupersededRetirementRecovery: kind === 'flag' ? 'true' : true }))
    .rejects.toMatchObject({ code: 'COMPLETION_RETENTION_NOT_READY' });
});
test('supersession recovery does not excuse a user/system DELETED collision', async () => {
  const { record } = await fixture();
  await db.collection('mediadeletiontombstones').insertOne({ mediaId: record.mediaId });
  await expect(run({ allowSupersededRetirementRecovery: true, allowMissingDeletedJournal: true }))
    .rejects.toMatchObject({ code: 'COMPLETION_RETENTION_NOT_READY' });
});
test('retired upload guard may instead retain a valid user tombstone after metadata cleanup', async () => {
  const { record } = await fixture('PURGED'); await db.collection('mediaorphanretirements').deleteMany({});
  await db.collection('mediadeletiontombstones').insertOne({ _id: id(), mediaId: record.mediaId, familyId: record.familyId,
    childId: record.childId, purpose: 'task_completion', reason: 'user_requested', deletedAt: DATE });
  expect((await run({ journal: undefined, retirementClient: undefined })).ready).toBe(true);
});
test('actual runtime A/B retirement and late abort remain ready at DELETED and PURGED', async () => {
  const mongoose = require('mongoose');
  await mongoose.connect(mongo.getUri(), { dbName: db.databaseName, autoIndex: false, autoCreate: false });
  try {
    const Asset = require('../models/MediaAsset');
    const Family = require('../../../common/models/Family');
    const User = require('../models/FamilyUser');
    const { createMongoTransactionRunner } = require('../services/mongoTransaction');
    const { createMediaReferenceOperationService } = require('../services/mediaReferenceOperationService');
    const { createOrphanRetirementService } = require('../services/orphanRetirementService');
    const familyId = id(), childId = id(), parentId = id();
    await Family.create({ _id: familyId, familyName: 'Synthetic', ownerParentId: parentId, memberParentIds: [parentId], childIds: [childId] });
    await User.create({ _id: parentId, role: 'parent' });
    let now = Date.now() - 86400000;
    const asset = await Asset.create({ familyId, childId, uploadedBy: parentId, purpose: 'task_completion',
      mimeType: 'image/jpeg', sizeBytes: 9, storageKey: randomUUID(), retentionPolicyVersion: 1,
      orphanEligibleAt: new Date(now + 86400000), createdAt: new Date(now) });
    const transactionRunner = createMongoTransactionRunner(mongoose.connection);
    const operations = createMediaReferenceOperationService({ transactionRunner, now: () => now });
    const command = { familyId: String(familyId), childId: String(childId), resourceType: 'growth_task', resourceId: String(id()),
      operationId: randomUUID(), commandHash: 'a'.repeat(64), references: [{ mediaId: String(asset._id), field: FIELD }] };
    await operations.prepare(command); await operations.abort(command);
    const b = { ...command, operationId: randomUUID() }; await operations.prepare(b); await operations.abort(b);
    now += 86400000;
    let evidence = null, journalPause = true, pause = true;
    const service = createOrphanRetirementService({ transactionRunner, now: () => now,
      retirementClient: { retire: async body => ({ ...body, state: 'granted' }) },
      journal: { persist: async value => { if (journalPause) throw Error('Synthetic first journal failure'); evidence = value; } },
      mediaStore: { remove: async () => { if (pause) throw Error('Synthetic pause after durable journal'); }, syncDirectory: async () => {} } });
    await expect(service.retire({ mediaId: String(asset._id) })).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
    journal.read.mockImplementation(async () => evidence);
    await blocked('SYSTEM_JOURNAL_INVALID'); const unjournaled = await snapshot();
    expect((await run({ allowMissingDeletedJournal: true })).scope).toBe('completion-retention-recovery');
    expect(await snapshot()).toEqual(unjournaled);
    journalPause = false;
    await expect(service.retire({ mediaId: String(asset._id) })).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
    expect((await run()).ready).toBe(true); now += 1;
    await operations.abort({ ...command, operationId: randomUUID() }); expect((await run()).ready).toBe(true);
    pause = false; expect((await service.retire({ mediaId: String(asset._id) })).state).toBe('PURGED');
    const before = await snapshot(); expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(before);
  } finally { await mongoose.disconnect(); }
});

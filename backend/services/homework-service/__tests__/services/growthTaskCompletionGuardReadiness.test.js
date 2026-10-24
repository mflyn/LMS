const { randomUUID } = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

jest.setTimeout(30000);
const id = () => new ObjectId(), DATE = new Date('2026-10-23T00:00:00Z');
const KEY = { familyId: 1, childId: 1, mediaId: 1 };
let mongo, client, db;
const run = options => require('../../services/completionMediaGuardReadiness').assertCompletionMediaGuardReadiness({ connection: { db }, writesPaused: true, ...options });
const guard = () => ({ _id: id(), familyId: id(), childId: id(), mediaId: id(), state: 'retired', revision: 1,
  retirementId: randomUUID(), retiredAt: DATE, createdAt: DATE, updatedAt: DATE });
const blocked = async (issue, options) => {
  let error; try { await run(options); } catch (cause) { error = cause; }
  expect(error).toMatchObject({ code: 'COMPLETION_RETENTION_NOT_READY', issues: expect.arrayContaining([issue]) });
  expect(JSON.stringify(error)).not.toMatch(/private-error|mongodb:|familyId|childId|mediaId/);
};
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); client = await MongoClient.connect(mongo.getUri());
  db = client.db('guard_readiness_synthetic');
});
beforeEach(async () => {
  await db.dropDatabase(); await db.createCollection('completionmediaguards'); await db.createCollection('growthtasks');
  await db.collection('completionmediaguards').createIndex(KEY, { unique: true });
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => { await client?.close(); await mongo?.stop(); });
test('empty collections pass and valid retired/available guards stay unchanged', async () => {
  expect((await run()).ready).toBe(true);
  const rows = [guard(), { ...guard(), state: 'available', retirementId: null, retiredAt: null }];
  await db.collection('completionmediaguards').insertMany(rows); expect((await run()).ready).toBe(true);
  expect(await db.collection('completionmediaguards').find().toArray()).toEqual(rows);
});
test.each([false, undefined, 'true'])('rejects unpaused %s before reads', async writesPaused => {
  await blocked('WRITES_NOT_PAUSED', { writesPaused, connection: { get db() { throw Error('private-error'); } } });
});
test.each(['completionmediaguards', 'growthtasks'])('missing %s is not an empty database', async name => {
  await db.collection(name).drop(); await blocked('COLLECTION_MISSING');
});
test.each(['missing', 'partial', 'sparse', 'ttl', 'extra unique', 'collation'])('rejects %s index', async kind => {
  const c = db.collection('completionmediaguards');
  if (kind === 'ttl') await c.createIndex({ retiredAt: 1 }, { expireAfterSeconds: 100 });
  else if (kind === 'extra unique') await c.createIndex({ mediaId: 1 }, { unique: true });
  else {
    await c.dropIndexes();
    if (kind !== 'missing') await c.createIndex(KEY, { unique: true, ...(kind === 'partial' ? { partialFilterExpression: { state: 'retired' } }
      : kind === 'sparse' ? { sparse: true } : { collation: { locale: 'en', strength: 2 } }) });
  }
  await blocked(kind === 'ttl' ? 'TTL_FORBIDDEN' : kind === 'extra unique' ? 'UNEXPECTED_UNIQUE_INDEX' : 'INDEX_INVALID');
});
test.each(['_id', 'familyId', 'childId', 'mediaId', 'revision', 'state', 'retirementId', 'retiredAt', 'createdAt'])
('rejects malformed native guard %s', async field => {
  const row = guard(); row[field] = field === 'revision' ? 0 : String(row[field]);
  if (field === 'state') row[field] = 'RETIRED'; if (field === 'retirementId') row[field] += '\n';
  await db.collection('completionmediaguards').insertOne(row); await blocked('MEDIA_GUARD_INVALID');
});
test('available guard cannot retain retirement evidence', async () => {
  await db.collection('completionmediaguards').insertOne({ ...guard(), state: 'available' }); await blocked('MEDIA_GUARD_INVALID');
});
test.each(['completionEvidence.completionMediaIds', 'completionMediaBindings.mediaId', 'completionPending.mediaIds',
  'completionPending.previousBindings.mediaId', 'completionPending.additionIds', 'completionPending.removalBindings.mediaId'])
('all-status native task query rejects retired media in %s', async path => {
  const row = guard(); await db.collection('completionmediaguards').insertOne(row);
  await db.collection('growthtasks').updateOne({ _id: id() }, { $set: { familyId: row.familyId, childId: row.childId,
    status: 'archived', [path]: [row.mediaId] } }, { upsert: true });
  await blocked('RETIRED_MEDIA_IN_USE');
});
test('other family or child use cannot collide with the guard scope', async () => {
  const row = guard(); await db.collection('completionmediaguards').insertOne(row);
  await db.collection('growthtasks').insertMany([
    { familyId: id(), childId: row.childId, completionPending: { mediaIds: [row.mediaId] } },
    { familyId: row.familyId, childId: id(), completionPending: { mediaIds: [row.mediaId] } }
  ]); expect((await run()).ready).toBe(true);
});
test('query failure closes cursor and is sanitized', async () => {
  const open = db.collection.bind(db), target = open('completionmediaguards'), close = jest.fn().mockResolvedValue();
  jest.spyOn(target, 'find').mockReturnValue({ close, async *[Symbol.asyncIterator]() { throw Error('mongodb://private-error'); } });
  jest.spyOn(db, 'collection').mockImplementation(name => name === 'completionmediaguards' ? target : open(name));
  await blocked('READINESS_QUERY_FAILED'); expect(close).toHaveBeenCalled();
});
test('native prepareUnique conversion is not a finalized unique index', async () => {
  await db.collection('completionmediaguards').dropIndexes();
  await db.collection('completionmediaguards').createIndex(KEY);
  await db.command({ collMod: 'completionmediaguards', index: { keyPattern: KEY, prepareUnique: true } });
  await blocked('INDEX_PREPARE_UNIQUE_FORBIDDEN');
});
test.each(['completionmediaguards', 'growthtasks'])('non-simple collection collation rejects %s', async name => {
  await db.collection(name).drop(); await db.createCollection(name, { collation: { locale: 'en', strength: 2 } });
  if (name === 'completionmediaguards') await db.collection(name).createIndex(KEY, { unique: true, collation: { locale: 'simple' } });
  await blocked('COLLECTION_COLLATION_INVALID');
});
test.each(['familyId', 'childId', 'mediaId'])('corrupt textual task %s must not hide retired-media use', async field => {
  const row = guard(); await db.collection('completionmediaguards').insertOne(row);
  const task = { familyId: row.familyId, childId: row.childId, status: 'cancelled', completionPending: { mediaIds: [row.mediaId] } };
  if (field === 'mediaId') task.completionPending.mediaIds = [String(row.mediaId)]; else task[field] = String(row[field]);
  await db.collection('growthtasks').insertOne(task); await blocked('RETIRED_MEDIA_IN_USE');
});
test('native multi-batch scan finds a late corrupt guard and closes cursors without writes', async () => {
  const rows = Array.from({ length: 103 }, guard); rows[102].revision = 0;
  await db.collection('completionmediaguards').insertMany(rows);
  const before = await db.collection('completionmediaguards').find().sort({ _id: 1 }).toArray();
  const open = db.collection.bind(db), target = open('completionmediaguards'), find = target.find.bind(target), cursors = [];
  const writes = ['insertOne', 'updateOne', 'deleteMany', 'createIndex', 'drop'].map(method =>
    jest.spyOn(target, method).mockImplementation(() => { throw Error('Unexpected write'); }));
  jest.spyOn(target, 'find').mockImplementation((filter, options) => {
    const cursor = find(filter, { ...options, batchSize: 2 }); jest.spyOn(cursor, 'close'); cursors.push(cursor); return cursor;
  });
  jest.spyOn(db, 'collection').mockImplementation(name => name === 'completionmediaguards' ? target : open(name));
  await blocked('MEDIA_GUARD_INVALID');
  for (const cursor of cursors) expect(cursor.close).toHaveBeenCalled();
  for (const write of writes) expect(write).not.toHaveBeenCalled();
  jest.restoreAllMocks(); expect(await db.collection('completionmediaguards').find().sort({ _id: 1 }).toArray()).toEqual(before);
});
test('cold import does not load models or mongoose', () => {
  const { spawnSync } = require('child_process'), target = require.resolve('../../services/completionMediaGuardReadiness');
  const script = `const Module=require('module'),load=Module._load;Module._load=function(request,parent){
    const file=Module._resolveFilename(request,parent);if(request==='mongoose'||/[\\\\/]models[\\\\/]|[\\\\/]mongoose[\\\\/]/.test(file))throw Error('forbidden model');
    return load.apply(this,arguments);};require(${JSON.stringify(target)});`;
  const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: '' });
});

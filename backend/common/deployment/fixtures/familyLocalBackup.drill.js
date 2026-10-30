// Explicit local rehearsal, not part of testMatch or a production backup executor.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { createHash, randomUUID } = require('crypto');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { MongoClient, ObjectId, Long, Binary, BSON } = require('mongodb');
const { createLifecycle } = require('./localBackupDrillLifecycle');

const binaries = ['MONGOD', 'MONGODUMP', 'MONGORESTORE', 'TAR'];
const tools = Object.fromEntries(binaries.map(name => {
  const value = process.env[`T8_${name}_BINARY`];
  if (!value || !path.isAbsolute(value) || !fs.statSync(value).isFile()) throw Error(`Explicit ${name} binary required`);
  return [name, value];
}));
if (process.env.MONGOMS_RUNTIME_DOWNLOAD !== 'false') throw Error('Runtime downloads must be disabled');
const hash = data => createHash('sha256').update(data).digest('hex');
const encode = value => BSON.EJSON.stringify(value, { relaxed: false });
// Index enumeration order is not identity; compound key order and all options are.
const indexSnapshot = rows => encode([...rows].sort((a, b) => a.name.localeCompare(b.name)));
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lms-t8-local-drill-')));
fs.chmodSync(root, 0o700);
const report = { scope: 'LOCAL_SYNTHETIC_ARTIFACT_ROUNDTRIP', status: 'RUNNING',
  nasVerified: false, uploadVerified: false, productRecoveryVerified: false, deletionReplayVerified: false,
  productionRpoRtoVerified: false, commands: [] };
const mkdir = name => { const directory = path.join(root, name); fs.mkdirSync(directory, { mode: 0o700 }); return directory; };
const archive = path.join(root, 'mongo.archive');
const sourceMedia = mkdir('source-media'), sourceJournal = mkdir('source-journal');
const restoreMedia = mkdir('restored-media'), restoreJournal = mkdir('restored-journal');
let client, manifest, baseline, restored;
const lifecycle = createLifecycle({ makeInstance: options => new MongoMemoryReplSet(options),
  makeClient: uri => new MongoClient(uri, { serverSelectionTimeoutMS: 5000 }) });

function command(tool, args, name) {
  lifecycle.assertActive();
  const result = spawnSync(tools[tool], args, { encoding: 'utf8', timeout: 30000,
    maxBuffer: 2 * 1024 * 1024, env: { ...process.env, COPYFILE_DISABLE: '1' } });
  fs.writeFileSync(path.join(root, `${name}.log`), (result.stdout || '') + (result.stderr || ''), { mode: 0o600, flag: 'wx' });
  report.commands.push({ name, status: result.status, signal: result.signal, error: result.error?.code || null });
  return result;
}
function succeeded(result) {
  expect(result.error).toBeUndefined(); expect(result.signal).toBeNull(); expect(result.status).toBe(0);
}
async function start(name) {
  lifecycle.assertActive();
  const started = await lifecycle.start({ binary: { systemBinary: tools.MONGOD },
    instanceOpts: [{ dbPath: mkdir(name), args: ['--wiredTigerCacheSizeGB', '0.25'] }],
    replSet: { count: 1, ip: '127.0.0.1', storageEngine: 'wiredTiger' } });
  client = started.client;
  return started.uri;
}
async function stop(options) {
  await lifecycle.stop(options); client = null;
}
async function snapshot() {
  lifecycle.assertActive();
  const collection = client.db('t8_synthetic').collection('transport_records');
  const result = { rows: encode(await collection.find().sort({ _id: 1 }).toArray()), indexes: indexSnapshot(await collection.listIndexes().toArray()) };
  lifecycle.assertActive(); return result;
}
function verifyArtifacts() {
  for (const [name, expected] of Object.entries(manifest)) {
    const contents = fs.readFileSync(path.join(root, name));
    if (contents.length !== expected.bytes || hash(contents) !== expected.sha256) throw Error('ARTIFACT_INTEGRITY_FAILED');
  }
}

beforeAll(async () => {
  // Transport fixtures deliberately are not product-model or authorization acceptance data.
  const uri = await start('source-db');
  report.mongoVersion = (await client.db('admin').command({ buildInfo: 1 })).version;
  lifecycle.assertActive();
  const records = client.db('t8_synthetic').collection('transport_records');
  await records.createIndex({ actorId: 1, operationId: 1 }, { unique: true, name: 'synthetic_scope' });
  lifecycle.assertActive();
  await records.createIndex({ remoteOperationId: 1 }, { unique: true, name: 'synthetic_remote' });
  lifecycle.assertActive();
  const operationId = randomUUID(), mediaId = new ObjectId();
  await records.insertMany([0, 1].map(index => ({ _id: new ObjectId(), actorId: new ObjectId(), operationId,
    remoteOperationId: randomUUID(), references: [{ mediaId, bindingGeneration: randomUUID() }],
    state: index ? 'COMMITTED' : 'PREPARED', version: Long.fromString('9007199254740993'),
    at: new Date('2026-10-30T00:00:00Z'), bytes: new Binary(Buffer.from([0, 1, 255])) })));
  lifecycle.assertActive();
  fs.writeFileSync(path.join(sourceMedia, 'synthetic.bin'), Buffer.alloc(256 * 1024, 7), { mode: 0o600 });
  fs.mkdirSync(path.join(sourceJournal, 'nested'), { mode: 0o700 });
  fs.writeFileSync(path.join(sourceJournal, 'nested', 'transport-only.json'),
    JSON.stringify({ synthetic: true, validDeletionEvidence: false, mediaId: mediaId.toHexString() }), { mode: 0o600 });
  baseline = await snapshot();
  report.captureStartedAt = new Date().toISOString();
  succeeded(command('MONGODUMP', ['--uri', uri, '--oplog', `--archive=${archive}`], 'dump'));
  fs.chmodSync(archive, 0o600);
  for (const [name, source] of [['media', sourceMedia], ['journal', sourceJournal]]) {
    succeeded(command('TAR', ['-czf', path.join(root, `${name}.tar.gz`), '-C', source, '.'], `archive-${name}`));
    fs.chmodSync(path.join(root, `${name}.tar.gz`), 0o600);
  }
  manifest = Object.fromEntries(['mongo.archive', 'media.tar.gz', 'journal.tar.gz'].map(name => {
    const data = fs.readFileSync(path.join(root, name)); expect(data.length).toBeGreaterThan(0);
    return [name, { bytes: data.length, sha256: hash(data) }];
  }));
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600, flag: 'wx' });
  report.captureFinishedAt = new Date().toISOString();
  await stop();
  const target = await start('restore-db');
  report.restoreStartedAt = new Date().toISOString();
  expect(await client.db('t8_synthetic').listCollections().toArray()).toEqual([]);
  lifecycle.assertActive();
  verifyArtifacts();
  succeeded(command('MONGORESTORE', ['--uri', target, '--oplogReplay', `--archive=${archive}`], 'restore'));
  for (const [name, directory] of [['media', restoreMedia], ['journal', restoreJournal]]) {
    succeeded(command('TAR', ['-xzf', path.join(root, `${name}.tar.gz`), '-C', directory], `restore-${name}`));
  }
  restored = await snapshot(); report.restoreFinishedAt = new Date().toISOString();
  report.targetUri = target; // Private synthetic loopback only; never copied into public evidence.
}, 60000);

afterAll(async () => {
  report.instancesStopped = false;
  try { await stop({ final: true }); report.instancesStopped = true; }
  finally {
    delete report.targetUri;
    report.status = 'EXECUTION_FINISHED_SEE_JEST_RESULT';
    fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify(report, null, 2), { mode: 0o600, flag: 'wx' });
    console.log(`Local synthetic evidence retained: ${root}`);
  }
});

test('real dump/restore preserves canonical BSON, unique indexes and archived file bytes', () => {
  expect(restored).toEqual(baseline);
  expect(fs.readFileSync(path.join(restoreMedia, 'synthetic.bin'))).toEqual(fs.readFileSync(path.join(sourceMedia, 'synthetic.bin')));
  expect(fs.readFileSync(path.join(restoreJournal, 'nested', 'transport-only.json')))
    .toEqual(fs.readFileSync(path.join(sourceJournal, 'nested', 'transport-only.json')));
  report.roundtripVerified = true;
});
test('restored unique constraints still reject duplicate identities', async () => {
  const collection = client.db('t8_synthetic').collection('transport_records');
  const row = await collection.findOne(); delete row._id;
  await expect(collection.insertOne({ ...row, remoteOperationId: randomUUID() })).rejects.toMatchObject({ code: 11000 });
  await expect(collection.insertOne({ ...row, actorId: new ObjectId() })).rejects.toMatchObject({ code: 11000 });
  expect(await snapshot()).toEqual(baseline);
});
test('index comparison ignores enumeration order but detects missing indexes, uniqueness and compound key order', () => {
  const indexes = [{ name: 'scope', key: { actorId: 1, operationId: 1 }, unique: true },
    { name: 'remote', key: { remoteOperationId: 1 }, unique: true }];
  expect(indexSnapshot([...indexes].reverse())).toBe(indexSnapshot(indexes));
  expect(indexSnapshot(indexes.slice(1))).not.toBe(indexSnapshot(indexes));
  expect(indexSnapshot([{ ...indexes[0], unique: false }, indexes[1]])).not.toBe(indexSnapshot(indexes));
  expect(indexSnapshot([{ ...indexes[0], key: { operationId: 1, actorId: 1 } }, indexes[1]])).not.toBe(indexSnapshot(indexes));
});
test('missing journal and same-size corrupted media are rejected before restoration', () => {
  const journal = path.join(root, 'journal.tar.gz'), media = path.join(root, 'media.tar.gz');
  fs.renameSync(journal, journal + '.held');
  try { expect(verifyArtifacts).toThrow(); } finally { fs.renameSync(journal + '.held', journal); }
  const original = fs.readFileSync(media), corrupted = Buffer.from(original); corrupted[0] ^= 255;
  fs.writeFileSync(media, corrupted);
  try { expect(verifyArtifacts).toThrow('ARTIFACT_INTEGRITY_FAILED'); } finally { fs.writeFileSync(media, original); }
  expect(verifyArtifacts).not.toThrow();
});
test('real corrupt archive and failed dump exit nonzero without changing restored data', async () => {
  const bad = path.join(root, 'corrupt.archive'); fs.writeFileSync(bad, 'not-a-mongo-archive', { mode: 0o600 });
  const restore = command('MONGORESTORE', ['--uri', report.targetUri, '--oplogReplay', `--archive=${bad}`], 'rejected-restore');
  expect(restore.error).toBeUndefined(); expect(restore.signal).toBeNull(); expect(restore.status).toBeGreaterThan(0);
  // A directory is accepted by mongodump; a child path under a regular file must fail.
  const dump = command('MONGODUMP', ['--uri', report.targetUri, '--oplog', `--archive=${bad}/cannot-create.archive`], 'rejected-dump');
  expect(dump.error).toBeUndefined(); expect(dump.signal).toBeNull(); expect(dump.status).toBeGreaterThan(0);
  expect(await snapshot()).toEqual(baseline);
  report.negativeToolExitsVerified = true;
});

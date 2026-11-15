// Explicit synthetic rehearsal using formal apps; never accepts an external DB URI.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { randomUUID, createHash } = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createLifecycle } = require('./localBackupDrillLifecycle');
const { indexSnapshot, createToolOwner, createHttpOwner, createBrowserOwner } = require('./localProductRestoreSupport');
const { createHttpTestHarness } = require('../../test/httpTestHarness');

mongoose.set('autoIndex', false); mongoose.set('autoCreate', false);
process.env.INTERNAL_SERVICE_TOKEN = 'synthetic-t8-star-token-32-characters';
const homework = require('../../../services/homework-service/server');
const resource = require('../../../services/resource-service/server');
const progress = require('../../../services/progress-service/server');
const user = require('../../../services/user-service/server');
const browserEnabled = process.env.T8_BROWSER_RESTORE === 'true';
const analytics = browserEnabled ? require('../../../services/analytics-service/app') : null;
const notification = browserEnabled ? require('../../../services/notification-service/app') : null;
const { createApp: createGateway } = require('../../../gateway/server');
const Task = require('../../../services/homework-service/models/GrowthTask');
const Operation = require('../../../services/homework-service/models/GrowthTaskCompletionOperation');
const Family = require('../../models/Family');
const User = require('../../models/User');
const Asset = require('../../../services/resource-service/models/MediaAsset');
const Reference = require('../../../services/resource-service/models/MediaReference');
const Remote = require('../../../services/resource-service/models/MediaReferenceOperation');
const Ledger = require('../../../services/progress-service/models/StarLedgerEntry');
require('../../../services/homework-service/models/CompletionMediaGuard');
require('../../../services/resource-service/models/CompletionUploadGuard');
require('../../../services/resource-service/models/MediaOrphanRetirement');
require('../../../services/resource-service/models/MediaDeletionTombstone');
require('../../../services/resource-service/models/MediaDeletionReceipt');
require('../../../services/resource-service/models/MediaUserDeletionRecovery');
const { assertGrowthTaskCompletionReadiness } = require('../../../services/homework-service/services/growthTaskCompletionReadiness');
const { assertCompletionMediaGuardReadiness } = require('../../../services/homework-service/services/completionMediaGuardReadiness');
const { checkCompletionOperations } = require('../../../services/resource-service/services/completionOperations');
const { inspectUserDeletionRecovery } = require('../../../services/resource-service/services/userDeletionRecoveryReadiness');
const { createUserDeletionRecoveryReader } = require('../../../services/resource-service/services/userDeletionRecoveryReader');

const tools = Object.fromEntries(['MONGOD', 'MONGODUMP', 'MONGORESTORE', 'TAR'].map(name => {
  const binary = process.env[`T8_${name}_BINARY`];
  if (!binary || !path.isAbsolute(binary) || !fs.statSync(binary).isFile()) throw Error(`Explicit ${name} required`);
  return [name, binary];
}));
if (process.env.MONGOMS_RUNTIME_DOWNLOAD !== 'false') throw Error('Runtime download forbidden');
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lms-t8-product-restore-')));
fs.chmodSync(root, 0o700);
const mkdir = name => { const p = path.join(root, name); fs.mkdirSync(p, { mode: 0o700 }); return p; };
const sourceMedia = mkdir('source-media'), sourceJournal = mkdir('source-journal');
const targetMedia = mkdir('target-media'), targetJournal = mkdir('target-journal');
const lifecycle = createLifecycle({ makeInstance: options => new MongoMemoryReplSet(options),
  makeClient: uri => ({ connect: () => mongoose.connect(uri, { dbName: 't8_product', autoIndex: false,
    autoCreate: false, serverSelectionTimeoutMS: 5000 }), close: () => mongoose.disconnect() }) });
const harness = createHttpOwner(createHttpTestHarness);
let closing = false;
const report = { scope: 'LOCAL_FORMAL_HTTP_RESTORE', nasVerified: false, productionRpoRtoVerified: false,
  deletionReplayVerified: false, commands: [] };
const TOKEN = 'synthetic-t8-media-token-32-characters';
const common = { NODE_ENV: 'test', ENABLE_RABBITMQ: 'false', COMPLETION_PROTOCOL_MODE: 'enabled',
  COMPLETION_WRITES_PAUSED: 'true', COMPLETION_STORAGE_CONFIRMED: 'true', COMPLETION_ORPHAN_CLEANUP_ENABLED: 'false',
  MEDIA_SECURITY_PROFILE: 'trusted-local', MEDIA_REFERENCE_SERVICE_TOKEN: TOKEN, MEDIA_SIGNING_SECRET: TOKEN,
  COMPLETION_RETIREMENT_SERVICE_TOKEN: 'synthetic-t8-retirement-distinct-32-characters',
  INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN, MEDIA_REFERENCE_TIMEOUT_MS: '3000',
  STAR_AWARD_TIMEOUT_MS: '3000', STAR_AWARD_RETRY_ATTEMPTS: '0' };
const id = () => String(new mongoose.Types.ObjectId());
const actors = { parent: { id: id(), role: 'parent' }, coparent: { id: id(), role: 'parent' },
  child: { id: id(), role: 'student', tokenVersion: 0 }, sibling: { id: id(), role: 'student', tokenVersion: 0 },
  youngest: { id: id(), role: 'student', tokenVersion: 0 },
  outsider: { id: id(), role: 'parent' } };
const sessions = new Map();
const password = 'Synthetic-T8-password!';
const initialPin = '2468';
let application, runtimeEnv, family, confirmed, recoverable, sameUuid, childCommand, terminalResponse,
  confirmedView, confirmedMedia, pendingMedia, confirmedContent, preserved, restored, dropped = 0, dropCommit = false, uploads = 0;
const pendingContents = new Map();
let browserTask, browserMedia, browserMediaBytes, browserOperation, browserUrl;
const browserTitle = 'Restored browser work';
const browserOwner = createBrowserOwner();
const active = () => { lifecycle.assertActive(); if (closing) throw Error('DRILL_CANCELLED'); };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const snapshot = async () => {
  active(); const result = {};
  const names = (await mongoose.connection.db.listCollections().toArray()).map(row => row.name).sort();
  for (const name of names) {
    const collection = mongoose.connection.db.collection(name);
    result[name] = { rows: mongoose.mongo.BSON.EJSON.stringify(await collection.find().sort({ _id: 1 }).toArray(), { relaxed: false }),
      indexes: indexSnapshot(await collection.listIndexes().toArray()) };
  }
  active(); return result;
};
const withoutResetFields = (users, childId) => ({ ...users, rows: JSON.parse(users.rows).map(row => {
  if (row._id.$oid === childId) {
    delete row.childProfile.pinHash;
    delete row.childProfile.tokenVersion;
    delete row.updatedAt;
  }
  return row;
}) });
async function startDatabase(name) {
  active();
  return (await lifecycle.start({ binary: { systemBinary: tools.MONGOD },
    instanceOpts: [{ dbPath: mkdir(name), args: ['--wiredTigerCacheSizeGB', '0.25'] }],
    replSet: { count: 1, ip: '127.0.0.1', storageEngine: 'wiredTiger' } })).uri;
}
const toolOwner = createToolOwner({ execFile, record: (name, result) => {
  fs.writeFileSync(path.join(root, name + '.log'), (result.stdout || '') + (result.stderr || ''), { mode: 0o600, flag: 'wx' });
  report.commands.push({ name, status: result.status, signal: result.signal, error: result.error?.code || null });
} });
async function command(tool, args, name) {
  active();
  // Keep draining the owned mongod pipes while the restore tool builds indexes.
  const result = await toolOwner.run(tools[tool], args, { encoding: 'utf8', timeout: 30000,
    killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024, env: { ...process.env, COPYFILE_DISABLE: '1' } }, name);
  active(); expect(result.error).toBeNull(); expect(result.signal).toBeNull(); expect(result.status).toBe(0);
}
async function listen(app) {
  active(); const client = await harness.request(app); active();
  return 'http://127.0.0.1:' + client.get('/health').app.address().port;
}
async function assemble(mediaRoot, journalRoot) {
  active();
  runtimeEnv = { ...common, PRIVATE_MEDIA_ROOT: mediaRoot, COMPLETION_DELETION_JOURNAL_ROOT: journalRoot,
    HOMEWORK_SERVICE_URL: 'http://127.0.0.1:1' }; // No retirement rows; unexpected remote use must fail locally.
  const before = await snapshot();
  await assertGrowthTaskCompletionReadiness({ connection: mongoose.connection, writesPaused: true }); active();
  await assertCompletionMediaGuardReadiness({ connection: mongoose.connection, writesPaused: true }); active();
  await checkCompletionOperations({ connection: mongoose.connection, writesPaused: true, env: runtimeEnv }); active();
  await progress.assertTransactionCapability(mongoose.connection); active();
  expect(await snapshot()).toEqual(before);
  const resourceApp = express();
  resourceApp.use((req, res, next) => {
    const json = res.json;
    res.json = function send(body) {
      if (dropCommit && req.originalUrl === '/api/internal/media/references/commit' && body.success) {
        dropped++; dropCommit = false; this.destroy(); return this;
      }
      return json.call(this, body);
    }; next();
  });
  resourceApp.use(resource.createProductionApp({ env: runtimeEnv }));
  const resourceUrl = await listen(resourceApp), progressUrl = await listen(progress.createApp());
  const homeworkUrl = await listen(homework.createProductionApp({ env: { ...runtimeEnv,
    RESOURCE_SERVICE_URL: resourceUrl, PROGRESS_SERVICE_URL: progressUrl } }));
  const userUrl = await listen(user.createProductionApp({ env: { ...runtimeEnv, RESOURCE_SERVICE_URL: resourceUrl } }));
  const extraHosts = browserEnabled ? {
    analytics: await listen(analytics.createApp({ env: { ...runtimeEnv, HOMEWORK_SERVICE_URL: homeworkUrl } })),
    notification: await listen(notification.createApp())
  } : {};
  application = createGateway({ serviceHosts: { user: userUrl, homework: homeworkUrl,
    resource: resourceUrl, progress: progressUrl, ...extraHosts }, jwtSecret: process.env.JWT_SECRET,
  identitySecret: process.env.GATEWAY_IDENTITY_SECRET, enableLegacyDataProxy: false,
  rateLimitOptions: { windowMs: 60000, max: 1000 } });
  await listen(application);
  if (browserEnabled) {
    const build = process.env.T8_WEB_BUILD;
    if (!build || !path.isAbsolute(build) || !fs.statSync(path.join(build, 'index.html')).isFile()) {
      throw Error('Explicit existing T8_WEB_BUILD required');
    }
    const gateway = application, web = express();
    web.use((req, res, next) => req.path.startsWith('/api/') ? gateway(req, res, next) : next());
    web.use(express.static(build));
    web.get('*', (_req, res) => res.sendFile(path.join(build, 'index.html')));
    browserUrl = await listen(web);
  }
}
async function call(method, url, body, actor = actors.parent, extraHeaders = {}) {
  active(); let req = (await harness.request(application))[method.toLowerCase()](url); active();
  if (actor) {
    const token = sessions.get(actor);
    if (!token) throw Error('Real login required for synthetic actor');
    req = req.set('Authorization', 'Bearer ' + token);
  }
  const response = await (body === undefined ? req.set(extraHeaders) : req.set(extraHeaders).send(body)); active(); return response;
}
async function loginActor(actor, pin = initialPin) {
  const body = actor.role === 'student' ? { familyId: actor.familyId, childId: actor.id, pin }
    : { username: actor.username, password };
  const response = await call('POST', '/api/auth/' + (actor.role === 'student' ? 'child-pin-login' : 'login'), body, null);
  expect(response.status).toBe(200); expect(response.body.success).toBe(true);
  const token = response.body.data.token;
  expect(jwt.verify(token, process.env.JWT_SECRET)).toMatchObject({ id: actor.id, role: actor.role,
    ...(actor.role === 'student' ? { familyId: actor.familyId, childId: actor.id, tokenVersion: actor.tokenVersion } : {}) });
  sessions.set(actor, token);
  return token;
}
async function loginAll() {
  sessions.clear();
  for (const actor of Object.values(actors)) await loginActor(actor);
}
const taskUrl = task => '/api/growth-tasks/' + task;
const recoveryUrl = task => taskUrl(task) + '/completion-operations/' + sameUuid + '/recover';
const complete = (operationId = randomUUID(), version = 0, ids = []) => ({ operationId,
  expectedCompletionVersion: version, expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: ids });
async function createTask(title) {
  const result = await call('POST', '/api/growth-tasks', { title, childId: actors.child.id, dimension: 'academic',
    taskType: 'practice', dueDate: '2026-10-30' }); expect(result.status).toBe(201); return result.body.data.task.taskId;
}
async function upload() {
  const bytes = await require('sharp')({ create: { width: 2, height: 2, channels: 3,
    background: ['white', 'red', 'blue', 'green'][uploads++ % 4] } }).png().toBuffer();
  active(); const response = await (await harness.request(application)).post('/api/media')
    .set('Authorization', 'Bearer ' + sessions.get(actors.child))
    .field('childId', actors.child.id).field('purpose', 'task_completion')
    .attach('file', bytes, { filename: 'synthetic.png', contentType: 'image/png' });
  active(); expect(response.status).toBe(201); return response.body.data.media.mediaId;
}
async function readMedia(mediaId, actor = actors.child) {
  const access = await call('GET', '/api/media/' + mediaId + '/access', undefined, actor);
  expect(access.status).toBe(200);
  const content = await call('GET', access.body.data.access.url, undefined, null);
  expect(content.status).toBe(200); expect(content.headers['cache-control']).toBe('private, no-store');
  return { url: access.body.data.access.url, bytes: content.body };
}
const closeHttp = options => harness.close(options);

beforeAll(async () => {
  const sourceUri = await startDatabase('source-db');
  for (const model of Object.values(mongoose.models)) { await model.createCollection(); await model.createIndexes(); active(); }
  family = await Family.create({ familyName: 'Synthetic restore', ownerParentId: actors.parent.id,
    memberParentIds: [actors.parent.id, actors.coparent.id], childIds: [actors.child.id, actors.sibling.id, actors.youngest.id] }); active();
  for (const actor of [actors.child, actors.sibling, actors.youngest]) Object.assign(actor, { childId: actor.id, familyId: String(family._id) });
  const pinHash = await bcrypt.hash(initialPin, 10);
  for (const [name, actor] of Object.entries(actors)) {
    actor.username = 't8_' + name;
    await User.create({ _id: actor.id, role: actor.role, username: actor.username, name: 'Synthetic ' + name,
      password, email: actor.username + '@example.test',
      ...(actor.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0, pinHash } } : {}) }); active();
  }
  await Family.create({ familyName: 'Other synthetic restore', ownerParentId: actors.outsider.id,
    memberParentIds: [actors.outsider.id], childIds: [] }); active();
  await assemble(sourceMedia, sourceJournal);
  await loginAll();
  if (browserEnabled) expect((await call('GET', '/api/notifications/settings')).status).toBe(200);
  confirmed = await createTask('Confirmed before backup'); confirmedMedia = await upload();
  expect((await call('PATCH', taskUrl(confirmed) + '/complete', complete(undefined, 0, [confirmedMedia]), actors.child)).status).toBe(200);
  expect((await call('PATCH', taskUrl(confirmed) + '/confirm', { expectedCompletionVersion: 1, parentFeedback: 'First review' }, actors.coparent)).status).toBe(200);
  confirmedView = (await call('GET', taskUrl(confirmed), undefined, actors.child)).body;
  confirmedContent = await readMedia(confirmedMedia);
  recoverable = await createTask('Commit acknowledgement lost before backup'); sameUuid = randomUUID();
  terminalResponse = await call('PATCH', taskUrl(recoverable) + '/complete', complete(sameUuid), actors.parent);
  expect(terminalResponse.status).toBe(200);
  pendingMedia = [await upload(), await upload()]; childCommand = complete(sameUuid, 1, pendingMedia);
  dropCommit = true;
  const pending = await call('PATCH', taskUrl(recoverable) + '/complete', childCommand, actors.child);
  expect(pending.status).toBe(503); expect(pending.body.error.code).toBe('MEDIA_REFERENCE_PENDING'); expect(dropped).toBe(1);
  const op = await Operation.findOne({ taskId: recoverable, actorId: actors.child.id }).lean();
  expect(op.phase).toBe('PREPUBLISH'); expect((await Remote.findOne({ operationId: op.remoteOperationId })).state).toBe('COMMITTED');
  for (const mediaId of pendingMedia) pendingContents.set(mediaId, (await readMedia(mediaId)).bytes);
  expect(new Set([...pendingContents.values(), confirmedContent.bytes].map(digest)).size).toBe(3);
  if (browserEnabled) {
    browserTask = await createTask(browserTitle); browserMedia = await upload();
    dropCommit = true;
    const pendingBrowser = await call('PATCH', taskUrl(browserTask) + '/complete', complete(undefined, 0, [browserMedia]), actors.child);
    expect(pendingBrowser.status).toBe(503); expect(pendingBrowser.body.error.code).toBe('MEDIA_REFERENCE_PENDING');
    expect(dropped).toBe(2);
    browserOperation = await Operation.findOne({ taskId: browserTask, actorId: actors.child.id }).lean();
    expect(browserOperation.phase).toBe('PREPUBLISH');
    expect((await Remote.findOne({ operationId: browserOperation.remoteOperationId })).state).toBe('COMMITTED');
    browserMediaBytes = (await readMedia(browserMedia)).bytes;
  }
  await closeHttp(); active(); preserved = await snapshot();
  await command('MONGODUMP', ['--uri', sourceUri, '--oplog', '--archive=' + path.join(root, 'mongo.archive')], 'dump');
  fs.chmodSync(path.join(root, 'mongo.archive'), 0o600);
  for (const [name, directory] of [['media', sourceMedia], ['journal', sourceJournal]]) {
    await command('TAR', ['-czf', path.join(root, name + '.tar.gz'), '-C', directory, '.'], 'archive-' + name);
    fs.chmodSync(path.join(root, name + '.tar.gz'), 0o600);
  }
  const manifest = Object.fromEntries(['mongo.archive', 'media.tar.gz', 'journal.tar.gz'].map(name => {
    const bytes = fs.readFileSync(path.join(root, name)); return [name, { bytes: bytes.length, sha256: digest(bytes) }];
  }));
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600, flag: 'wx' });
  await lifecycle.stop(); active();
  const targetUri = await startDatabase('target-db');
  expect(await mongoose.connection.db.listCollections().toArray()).toEqual([]);
  for (const [name, expected] of Object.entries(manifest)) {
    const bytes = fs.readFileSync(path.join(root, name)); expect(bytes.length).toBe(expected.bytes); expect(digest(bytes)).toBe(expected.sha256);
  }
  await command('MONGORESTORE', ['--uri', targetUri, '--oplogReplay', '--archive=' + path.join(root, 'mongo.archive')], 'restore');
  for (const [name, directory] of [['media', targetMedia], ['journal', targetJournal]]) {
    await command('TAR', ['-xzf', path.join(root, name + '.tar.gz'), '-C', directory], 'restore-' + name);
  }
  restored = await snapshot(); expect(restored).toEqual(preserved);
  await assemble(targetMedia, targetJournal); expect(await snapshot()).toEqual(preserved);
  await loginAll(); expect(await snapshot()).toEqual(preserved);
  report.restoredRealLoginVerified = true;
}, 60000);

afterAll(async () => {
  closing = true; report.instancesStopped = false; report.httpClosed = false; report.toolsStopped = false;
  try {
    try {
      try { await browserOwner.stop(); report.browserOwnerStopped = true; }
      finally { await toolOwner.stop(); report.toolsStopped = true; }
    }
    finally { await closeHttp({ final: true }); report.httpClosed = true; }
  }
  finally {
    try { await lifecycle.stop({ final: true }); report.instancesStopped = true; }
    finally {
      fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify(report, null, 2), { mode: 0o600, flag: 'wx' });
      console.log('Synthetic formal restore evidence retained: ' + root);
    }
  }
});

if (browserEnabled) test('restored real browser login, original command recovery, review, readback and account isolation', async () => {
  const { runRestoredBrowser } = require('./localProductRestoreBrowser');
  const before = await snapshot();
  try {
    report.browser = await browserOwner.run(onBrowser => runRestoredBrowser({ onBrowser, webUrl: browserUrl, actors, password, pin: initialPin,
      taskId: browserTask, title: browserTitle, operationId: browserOperation.operationId, imageDigest: digest(browserMediaBytes),
      outputRoot: mkdir('browser'), snapshot, check: async stage => {
        if (stage === 'before-recovery') { expect(await snapshot()).toEqual(before); return; }
        const task = await Task.collection.findOne({ _id: new mongoose.Types.ObjectId(browserTask) });
        const op = await Operation.findById(browserOperation._id).lean();
        expect(op).toMatchObject({ operationId: browserOperation.operationId,
          remoteOperationId: browserOperation.remoteOperationId, phase: 'SUCCEEDED' });
        const ledger = await Ledger.find({ sourceId: browserTask, type: 'earn', sourceType: 'task_confirmation' }).lean();
        if (stage === 'recovered') {
          expect(task.completionVersion).toBe(1); expect(ledger).toHaveLength(0);
          expect(task.completionMediaBindings.map(row => [String(row.mediaId), row.bindingOperationId]))
            .toEqual([[browserMedia, browserOperation.remoteOperationId]]);
          expect(await Operation.countDocuments({ taskId: browserTask })).toBe(1);
        } else if (stage === 'conflict') {
          expect(task.status).toBe('completed'); expect(task.completionVersion).toBe(2); expect(ledger).toHaveLength(0);
        } else if (stage === 'confirmed') {
          expect(task.status).toBe('confirmed'); expect(task.completionVersion).toBe(2);
          expect(String(task.confirmedByParentId)).toBe(actors.coparent.id);
          expect(task.parentFeedback).toBe('Restored browser feedback'); expect(ledger).toHaveLength(1);
        }
      } }));
  } finally {
    // Fresh listeners after browser traffic; data and tokens stay intact for the original HTTP cases.
    await closeHttp(); await assemble(targetMedia, targetJournal);
  }
}, 120000);

test('restored parent credentials authenticate through the real Gateway and user service', async () => {
  const response = await call('POST', '/api/auth/login', {
    username: 't8_parent', password: 'Synthetic-T8-password!'
  }, null);
  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(jwt.verify(response.body.data.token, process.env.JWT_SECRET)).toMatchObject({ id: actors.parent.id, role: 'parent' });
});

test('wrong restored password, PIN and family cannot issue a session or mutate restored data', async () => {
  const before = await snapshot();
  const other = await Family.findOne({ ownerParentId: actors.outsider.id }).lean();
  for (const [route, body] of [
    ['login', { username: actors.parent.username, password: 'Wrong-synthetic-password!' }],
    ['child-pin-login', { familyId: actors.child.familyId, childId: actors.child.id, pin: '0000' }],
    ['child-pin-login', { familyId: String(other._id), childId: actors.child.id, pin: initialPin }]
  ]) {
    const response = await call('POST', '/api/auth/' + route, body, null);
    expect(response.status).toBe(401); expect(response.body.success).toBe(false);
    expect(response.body).not.toHaveProperty('data.token');
    expect(response.body).not.toHaveProperty('data.child');
  }
  expect(await snapshot()).toEqual(before);
});

test('restored formal apps pass prerequisites without index repair and return the original confirmed view and media', async () => {
  expect(restored).toEqual(preserved);
  const before = await snapshot();
  const detail = await call('GET', taskUrl(confirmed), undefined, actors.child);
  expect(detail.status).toBe(200); expect(detail.body).toEqual(confirmedView);
  expect(detail.body.data.task).toMatchObject({ status: 'confirmed', completionVersion: 1, parentFeedback: 'First review' });
  expect((await readMedia(confirmedMedia)).bytes).toEqual(confirmedContent.bytes);
  const edit = await call('PATCH', taskUrl(confirmed) + '/complete', complete(undefined, 1), actors.child);
  expect(edit.status).toBe(409); expect(edit.body.error.code).toBe('TASK_STATE_CONFLICT');
  expect(await snapshot()).toEqual(before);
});
test('restored pending discovery is read-only; original actor recovers persisted mapping, not same-UUID parent outcome', async () => {
  const before = await snapshot(); const ops = await Operation.find({ taskId: recoverable }).lean();
  expect(ops).toHaveLength(2); expect(new Set(ops.map(op => op.remoteOperationId)).size).toBe(2);
  const childOp = ops.find(op => String(op.actorId) === actors.child.id);
  const discovery = await call('GET', taskUrl(recoverable) + '/completion-recovery', undefined, actors.child);
  expect(discovery.status).toBe(200); expect(discovery.body.data.recovery).toMatchObject({ state: 'recoverable', operationId: sameUuid });
  expect((await call('GET', taskUrl(recoverable) + '/completion-recovery', undefined, actors.parent)).body.data.recovery.state).toBe('other_actor');
  expect((await call('POST', recoveryUrl(recoverable), {}, actors.parent)).body).toEqual(terminalResponse.body);
  expect(await snapshot()).toEqual(before);
  const recovered = await call('POST', recoveryUrl(recoverable), {}, actors.child);
  expect(recovered.status).toBe(200); expect(recovered.body.data.task).toMatchObject({ completionVersion: 2, completionMediaIds: pendingMedia });
  expect((await Operation.findById(childOp._id)).remoteOperationId).toBe(childOp.remoteOperationId);
  const task = await Task.collection.findOne({ _id: new mongoose.Types.ObjectId(recoverable) });
  expect(task.completionMediaBindings.map(binding => [String(binding.mediaId), binding.bindingOperationId]))
    .toEqual(pendingMedia.map(mediaId => [mediaId, childOp.remoteOperationId]));
  expect(await Reference.countDocuments({ resourceId: task._id, operationId: childOp.remoteOperationId, state: 'bound' })).toBe(2);
  const references = await Reference.find({ resourceId: task._id, field: 'completionMediaIds', state: 'bound' }).lean();
  expect(references.map(row => [String(row.mediaId), String(row.familyId), String(row.childId), row.resourceType,
    row.operationId]).sort()).toEqual(pendingMedia.map(mediaId => [mediaId, String(family._id), actors.child.id,
    'growth_task', childOp.remoteOperationId]).sort());
  for (const mediaId of pendingMedia) expect((await readMedia(mediaId)).bytes).toEqual(pendingContents.get(mediaId));
  const stable = await snapshot();
  expect((await call('PATCH', taskUrl(recoverable) + '/complete', childCommand, actors.child)).body).toEqual(recovered.body);
  expect((await call('POST', recoveryUrl(recoverable), {}, actors.parent)).body).toEqual(terminalResponse.body);
  expect(await snapshot()).toEqual(stable);
});
test('reviewing an old version is rejected; repeated confirmation preserves one ledger and first co-parent audit', async () => {
  const before = await snapshot();
  const stale = await call('PATCH', taskUrl(recoverable) + '/confirm', { expectedCompletionVersion: 1 });
  expect(stale.status).toBe(409); expect(stale.body.error.code).toBe('VERSION_CONFLICT'); expect(await snapshot()).toEqual(before);
  const detail = await call('GET', taskUrl(recoverable)); expect(detail.status).toBe(200);
  const reviewedVersion = detail.body.data.task.completionVersion;
  expect((await call('PATCH', taskUrl(recoverable) + '/confirm', { expectedCompletionVersion: reviewedVersion, parentFeedback: 'Restored review' }, actors.coparent)).status).toBe(200);
  const confirmedState = await snapshot();
  expect((await call('PATCH', taskUrl(recoverable) + '/confirm', { expectedCompletionVersion: reviewedVersion, parentFeedback: 'Do not replace' })).status).toBe(200);
  expect((await call('PATCH', taskUrl(confirmed) + '/confirm', { expectedCompletionVersion: 1, parentFeedback: 'Do not replace original' })).status).toBe(200);
  expect(await snapshot()).toEqual(confirmedState);
  for (const taskId of [confirmed, recoverable]) {
    expect(await Ledger.countDocuments({ sourceId: taskId, sourceType: 'task_confirmation', type: 'earn' })).toBe(1);
    expect(String((await Task.findById(taskId)).confirmedByParentId)).toBe(actors.coparent.id);
  }
});
test('restored JWT/family/child isolation rejects reads and writes without private output or state changes', async () => {
  const before = await snapshot();
  const stale = jwt.sign({ ...actors.child, tokenVersion: 1 }, process.env.JWT_SECRET);
  for (const [actor, expected, headers = {}] of [[null, 401], [actors.sibling, 403], [actors.youngest, 403],
    [actors.outsider, 403], [null, 401, { Authorization: 'Bearer ' + stale }]]) {
    for (const [method, url, body] of [['GET', taskUrl(confirmed)], ['PATCH', taskUrl(confirmed) + '/complete', complete()], ['POST', recoveryUrl(recoverable), {}]]) {
      const response = await call(method, url, body, actor, { 'x-user-id': actors.parent.id, ...headers });
      expect(response.status).toBe(expected); expect(response.body.success).toBe(false);
      expect(JSON.stringify(response.body)).not.toContain('First review');
    }
    const media = await call('GET', '/api/media/' + confirmedMedia + '/access', undefined, actor, headers);
    expect(media.status).toBe(expected); expect(media.body).not.toHaveProperty('data.access');
  }
  const expired = jwt.sign({ ...actors.child, exp: 1 }, process.env.JWT_SECRET);
  expect((await call('GET', taskUrl(confirmed), undefined, null, { Authorization: 'Bearer ' + expired })).status).toBe(401);
  expect(await snapshot()).toEqual(before);
});
test('live membership revocation survives restoration and old clients remain rejected', async () => {
  await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: actors.coparent.id } });
  const before = await snapshot();
  expect((await call('GET', taskUrl(confirmed), undefined, actors.coparent)).status).toBe(403);
  expect((await call('GET', '/api/media/' + confirmedMedia + '/access', undefined, actors.coparent)).status).toBe(403);
  const old = await call('PATCH', taskUrl(confirmed) + '/complete', { actualMinutes: 5 }, actors.child);
  expect(old.status).toBe(400); expect(old.body.error.code).toBe('CLIENT_UPGRADE_REQUIRED');
  expect(await snapshot()).toEqual(before);
});
test('restored PIN reset invalidates old sessions and old PIN while fresh login preserves teaching and rewards', async () => {
  const before = await snapshot();
  const resetUrl = '/api/children/' + actors.child.id + '/pin';
  for (const actor of [actors.outsider, actors.sibling]) {
    expect((await call('POST', resetUrl, { pin: '1357' }, actor)).status).toBe(403);
  }
  expect(await snapshot()).toEqual(before);
  expect((await call('POST', resetUrl, { pin: '1357' })).status).toBe(200);
  const afterReset = await snapshot();
  expect(withoutResetFields(afterReset[User.collection.name], actors.child.id))
    .toEqual(withoutResetFields(before[User.collection.name], actors.child.id));
  const resetChild = await User.findById(actors.child.id).select('+childProfile.pinHash').lean();
  expect(resetChild.childProfile.tokenVersion).toBe(1);
  expect(await bcrypt.compare('1357', resetChild.childProfile.pinHash)).toBe(true);
  for (const name of Object.keys(before).filter(name => name !== User.collection.name)) {
    expect(afterReset[name]).toEqual(before[name]);
  }
  for (const [method, url, body] of [['GET', taskUrl(confirmed)], ['GET', '/api/media/' + confirmedMedia + '/access'],
    ['PATCH', taskUrl(recoverable) + '/complete', childCommand], ['POST', recoveryUrl(recoverable), {}]]) {
    const response = await call(method, url, body, actors.child);
    expect(response.status).toBe(401); expect(response.body.error.code).toBe('STALE_CHILD_TOKEN');
    expect(response.body).not.toHaveProperty('data');
  }
  expect((await call('POST', '/api/auth/child-pin-login', {
    familyId: actors.child.familyId, childId: actors.child.id, pin: initialPin
  }, null)).status).toBe(401);
  for (const actor of [actors.sibling, actors.youngest]) {
    expect((await call('GET', taskUrl(confirmed), undefined, actor)).status).toBe(403);
    await loginActor(actor);
  }
  actors.child.tokenVersion = 1;
  await loginActor(actors.child, '1357');
  expect((await call('GET', taskUrl(confirmed), undefined, actors.child)).body).toEqual(confirmedView);
  expect((await readMedia(confirmedMedia)).bytes).toEqual(confirmedContent.bytes);
  expect(await snapshot()).toEqual(afterReset);
});
test('PIN reset comparison detects unrelated user fields, sibling credentials and index changes', () => {
  const users = preserved[User.collection.name], expected = withoutResetFields(users, actors.child.id);
  for (const mutate of [
    rows => { rows.find(row => row._id.$oid === actors.sibling.id).childProfile.pinHash = 'incorrect'; },
    rows => { rows.find(row => row._id.$oid === actors.youngest.id).childProfile.tokenVersion = 99; },
    rows => { rows.find(row => row._id.$oid === actors.child.id).name = 'incorrect'; },
    rows => { rows.find(row => row._id.$oid === actors.parent.id).password = 'incorrect'; }
  ]) {
    const rows = JSON.parse(users.rows); mutate(rows);
    expect(withoutResetFields({ ...users, rows: JSON.stringify(rows) }, actors.child.id)).not.toEqual(expected);
  }
  expect(withoutResetFields({ ...users, indexes: '[]' }, actors.child.id)).not.toEqual(expected);
});
test('normal deletion revokes restored capability without altering teaching or reward; strict deletion recovery remains blocked', async () => {
  const task = await Task.findById(confirmed).lean(), ledger = await Ledger.find().lean();
  const access = await readMedia(confirmedMedia);
  expect((await call('DELETE', '/api/media/' + confirmedMedia, undefined, actors.child)).status).toBe(204);
  expect((await call('GET', access.url, undefined, null)).status).toBe(404);
  expect((await call('GET', '/api/media/' + confirmedMedia + '/access', undefined, actors.child)).status).toBe(404);
  expect(await Task.findById(confirmed).lean()).toEqual(task); expect(await Ledger.find().lean()).toEqual(ledger);
  expect((await Asset.findById(confirmedMedia)).status).toBe('deleted');
  const before = await snapshot();
  const inspection = await inspectUserDeletionRecovery({ connection: mongoose.connection, writesPaused: true,
    journal: createUserDeletionRecoveryReader({ root: targetJournal }) });
  expect(inspection.ready).toBe(false); expect(inspection.complete).toBe(true);
  expect(inspection.reasons).toEqual(['LEGACY_USER_DELETION_EVIDENCE_INSUFFICIENT']);
  expect(await snapshot()).toEqual(before);
  report.deletionRestoreBlocker = inspection.reasons[0];
  // Do not invoke the deferred restore writer or expose a pre-deletion snapshot.
  await closeHttp();
  application = resource.createProductionApp({ env: { ...runtimeEnv, COMPLETION_PROTOCOL_MODE: 'maintenance' } });
  expect((await call('GET', access.url, undefined, null)).status).toBe(503);
});

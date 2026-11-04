// Keep production logging behavior, but send test logs to the runner rather than repository files.
jest.mock('../../../../common/config/logger', () => {
  const actual = jest.requireActual('../../../../common/config/logger');
  const winston = require('winston');
  return { ...actual, createLogger: () => winston.createLogger({ level: 'error',
    transports: [new winston.transports.Console({ format: winston.format.json() })] }) };
});

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const mongoose = require('mongoose');
const { randomUUID, createHash } = require('crypto');
const { createProductionApp: createHomeworkApp, startServer: startHomeworkServer } = require('../../server');
const { createProductionApp: createResourceApp, startServer: startResourceServer } = require('../../../resource-service/server');
const { createApp: createGatewayApp } = require('../../../../gateway/server');
const { checkCompletionOperations } = require('../../../resource-service/services/completionOperations');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const Task = require('../../models/GrowthTask');
const A = require('../../models/Ai1');
const M = require('../../models/Ai2');
const Asset = require('../../../resource-service/models/MediaAsset');
const Reference = require('../../../resource-service/models/MediaReference');
const Operation = require('../../../resource-service/models/MediaReferenceOperation');
const UploadGuard = require('../../../resource-service/models/CompletionUploadGuard');
const Tombstone = require('../../../resource-service/models/MediaDeletionTombstone');
const Receipt = require('../../../resource-service/models/MediaDeletionReceipt');

jest.setTimeout(60000);
const TOKEN = 'synthetic-ai25-formal-reference-token-32chars';
const http = axios.create({ proxy: false, timeout: 10000, maxRedirects: 0, validateStatus: () => true });
const id = () => String(new mongoose.Types.ObjectId());
const command = () => ({ schemaVersion: 'ai2-min-v1', operationId: randomUUID() });
let root, env, servers, base, homeworkBase, resourceBase, parent, child, sibling, outsider, family, task, cycleId, png;

// Only the listener is a delegate: no parser, credentials, or business handler is replaced.
async function endpoint() {
  let delegate;
  const shell = express();
  shell.use((req, res, next) => delegate ? delegate(req, res, next) : res.sendStatus(503));
  const server = await new Promise((resolve, reject) => {
    const listener = shell.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  servers.push(server);
  return { server, base: `http://127.0.0.1:${server.address().port}`, mount: app => { delegate = app; } };
}

const closeServer = server => new Promise((resolve, reject) => {
  if (!server.listening) return resolve();
  server.closeAllConnections();
  server.close(error => error ? reject(error) : resolve());
});

const call = (method, target, data, actor = parent, options = {}) => http.request({
  method, url: base + target, data, ...options,
  headers: { ...(actor ? { Authorization: 'Bearer ' + jwt.sign(actor, process.env.JWT_SECRET, { expiresIn: 300 }) } : {}),
    ...options.headers }
});
const expectStatus = (response, status) => {
  expect({ status: response.status, error: response.data?.error }).toEqual({ status, error: status < 400 ? undefined : expect.anything() });
};
const detailPath = packageId => `/api/ai2/learning-packages/${packageId}`;
async function detail(packageId, actor = child) {
  const response = await call('GET', detailPath(packageId), undefined, actor);
  expectStatus(response, 200);
  expect(response.headers['cache-control']).toBe('no-store');
  return response.data.data.package;
}
const expectChildSafe = value => {
  const text = JSON.stringify(value);
  for (const secret of ['PRIVATE_ANSWER', 'PRIVATE_CONTEXT', TOKEN, 'storageKey', 'bindingOperationId',
    'mediaBindings', 'attemptPayloadHash', 'reviewerId', 'reviewOperationId']) expect(text).not.toContain(secret);
};

async function publish() {
  const preview = await call('GET', `/api/ai2/publication-preview?cycleId=${cycleId}`);
  expectStatus(preview, 200);
  const { childSnapshot, ...confirmed } = preview.data.data.preview;
  expect(childSnapshot).toMatchObject({ questionText: '124 * 23', explanationText: 'Synthetic parent explanation',
    source: { type: 'task', id: String(task._id) } });
  const response = await call('POST', '/api/ai2/learning-packages', {
    ...command(), ...confirmed, childContentConfirmed: true
  });
  expectStatus(response, 201);
  expect(response.data.data.command.phase).toBe('SUCCEEDED');
  return response.data.data.package.id;
}

async function upload(actor = child) {
  const form = new FormData();
  form.append('purpose', 'ai2_correction');
  form.append('file', png, { filename: 'synthetic-correction.png', contentType: 'image/png' });
  return call('POST', '/api/media', form, actor, { headers: form.getHeaders() });
}

async function submitted() {
  const packageId = await publish();
  const uploaded = await upload();
  expectStatus(uploaded, 201);
  const media = uploaded.data.data.media;
  expect(media).toMatchObject({ purpose: 'ai2_correction', mimeType: 'image/png', sizeBytes: expect.any(Number) });
  const asset = await Asset.findById(media.mediaId).lean();
  expect(String(asset.uploadedBy)).toBe(child.id);
  expect(await UploadGuard.findOne({ mediaId: media.mediaId }).lean()).toMatchObject({ state: 'REGISTERED' });
  const record = JSON.parse(await fs.readFile(path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, 'uploads-v1', media.mediaId + '.json'), 'utf8'));
  expect(record).toMatchObject({ mediaId: media.mediaId, metadata: { purpose: 'ai2_correction',
    mimeType: media.mimeType, sizeBytes: media.sizeBytes, uploadedBy: child.id } });
  const body = { ...command(), expectedPackageVersion: 1, note: 'Synthetic correction attempt', mediaIds: [media.mediaId] };
  const response = await call('POST', detailPath(packageId) + '/attempts', body, child);
  expectStatus(response, 201);
  expect(response.data.data.command.phase).toBe('SUCCEEDED');
  const stored = await M.Attempt.findOne({ packageId }).lean();
  const remote = await Operation.findOne({ resourceId: stored._id, resourceType: 'ai2_attempt' }).lean();
  expect(remote.state).toBe('COMMITTED');
  expect(stored.mediaBindings).toEqual([{ mediaId: media.mediaId, resourceType: 'ai2_attempt',
    resourceId: String(stored._id), field: 'correctionMediaIds', bindingOperationId: remote.operationId }]);
  expect(await Reference.countDocuments({ mediaId: media.mediaId, resourceId: stored._id,
    operationId: remote.operationId, field: 'correctionMediaIds', state: 'bound' })).toBe(1);
  return { packageId, media, stored, remote };
}

beforeAll(async () => {
  // The homework Jest setup owns the real MongoMemoryReplSet, not a mocked transaction runner.
  expect((await mongoose.connection.db.admin().command({ hello: 1 })).setName).toBeTruthy();
  png = await sharp({ create: { width: 6, height: 6, channels: 3, background: '#338855' } }).png().toBuffer();
});

beforeEach(async () => {
  servers = [];
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'ai25-formal-')));
  await fs.chmod(root, 0o700);
  const homework = await endpoint(), resource = await endpoint(), gateway = await endpoint();
  homeworkBase = homework.base; resourceBase = resource.base; base = gateway.base;
  env = { NODE_ENV: 'test', AI1_MODE: 'off', AI2_MODE: 'enabled', AI2_STORE_CONTINUOUS: 'true',
    ENABLE_RABBITMQ: 'false', COMPLETION_PROTOCOL_MODE: 'enabled', COMPLETION_WRITES_PAUSED: 'true',
    COMPLETION_STORAGE_CONFIRMED: 'true', MEDIA_SECURITY_PROFILE: 'trusted-local',
    MONGO_URI: mongoose.connection.client.s.url, HOMEWORK_SERVICE_URL: homeworkBase, RESOURCE_SERVICE_URL: resourceBase,
    PROGRESS_SERVICE_URL: homeworkBase, INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN,
    MEDIA_REFERENCE_SERVICE_TOKEN: TOKEN, MEDIA_SIGNING_SECRET: 'synthetic-ai25-formal-signing-secret-32chars',
    COMPLETION_RETIREMENT_SERVICE_TOKEN: 'synthetic-ai25-formal-retirement-token-32chars',
    PRIVATE_MEDIA_ROOT: path.join(root, 'media'), COMPLETION_DELETION_JOURNAL_ROOT: path.join(root, 'journal') };
  await fs.mkdir(env.PRIVATE_MEDIA_ROOT, { mode: 0o700 });
  await fs.mkdir(env.COMPLETION_DELETION_JOURNAL_ROOT, { mode: 0o700 });
  // Register the production models before provisioning indexes in this disposable database.
  // These unstarted apps are not mounted and cannot supply a readiness grant to startup.
  createHomeworkApp({ env });
  createResourceApp({ env });
  for (const model of Object.values(mongoose.models)) await model.init();
  // Keep both advertised addresses fixed. An intervening port race must fail, never pick a new port.
  await closeServer(homework.server);
  await closeServer(resource.server);
  const resourceServer = await startResourceServer({ env, port: Number(new URL(resourceBase).port), host: '127.0.0.1' });
  servers.push(resourceServer);
  const homeworkServer = await startHomeworkServer({ env, port: Number(new URL(homeworkBase).port), host: '127.0.0.1' });
  servers.push(homeworkServer);
  expect(resourceServer.address().address).toBe('127.0.0.1');
  expect(homeworkServer.address().address).toBe('127.0.0.1');
  gateway.mount(createGatewayApp({ serviceHosts: { user: homeworkBase, homework: homeworkBase, resource: resourceBase },
    jwtSecret: process.env.JWT_SECRET, identitySecret: process.env.GATEWAY_IDENTITY_SECRET,
    enableLegacyDataProxy: false, rateLimitOptions: { windowMs: 60000, max: 1000 } }));
  parent = { id: id(), role: 'parent' }; outsider = { id: id(), role: 'parent' };
  child = { id: id(), role: 'student', tokenVersion: 0 }; sibling = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic formal HTTP', ownerParentId: parent.id,
    memberParentIds: [parent.id], childIds: [child.id, sibling.id] });
  for (const actor of [child, sibling]) Object.assign(actor, { familyId: String(family._id), childId: actor.id });
  await User.collection.insertMany([parent, child, sibling, outsider].map(actor => ({
    _id: new mongoose.Types.ObjectId(actor.id), role: actor.role, username: actor.id, email: actor.id + '@example.invalid',
    ...(actor.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {})
  })));
  await Family.create({ familyName: 'Other synthetic family', ownerParentId: outsider.id, memberParentIds: [outsider.id], childIds: [] });
  task = await Task.create({ familyId: family._id, childId: child.id, createdByParentId: parent.id,
    dimension: 'academic', subject: 'math', title: 'Synthetic source task', taskType: 'practice', dueDate: '2026-11-03' });
  cycleId = id(); const artifactId = id(), explanation = 'Synthetic parent explanation';
  // Only the human-reviewed AI1 input is seeded. Publication and every AI2 write go through HTTP.
  await A.Cycle.create({ _id: cycleId, familyId: family._id, childId: child.id, createdBy: parent.id,
    sourceType: 'task', sourceId: task._id, sourceSubject: 'math', subjectAliasVersion: 'math-v1',
    input: { questionText: '124 * 23', answerText: 'PRIVATE_ANSWER', parentContext: 'PRIVATE_CONTEXT' },
    chapter: { provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper', textbookLabel: 'Synthetic', chapterLabel: 'Multiplication' },
    inputHash: '1'.repeat(64), preview: {}, status: 'approved', active: true, stateVersion: 4,
    currentArtifactId: artifactId, approvedArtifactId: artifactId });
  await A.Artifact.create({ _id: artifactId, familyId: family._id, childId: child.id, cycleId, version: 1,
    text: explanation, contentHash: createHash('sha256').update(explanation).digest('hex'), createdBy: parent.id,
    origin: 'parent_revision', generation: {}, status: 'parent_approved', reviewVersion: 2 });
});

afterEach(async () => {
  try {
    for (const server of servers || []) await closeServer(server);
  } finally { if (root) await fs.rm(root, { recursive: true, force: true }); }
});

test('formal three-service publication, upload, exact submission, authenticated media, parent approval and withdrawal', async () => {
  const { packageId, media } = await submitted();
  const childView = await detail(packageId);
  expectChildSafe(childView);
  expect(childView).toMatchObject({ learningState: 'submitted', sourceAvailability: 'available',
    source: { type: 'task', id: String(task._id) } });
  expect(childView.attempts[0].media).toEqual([{ mediaId: media.mediaId, mimeType: media.mimeType, sizeBytes: media.sizeBytes, status: 'available' }]);
  const access = await call('GET', `/api/media/${media.mediaId}/access`, undefined, child);
  expectStatus(access, 200);
  expect(access.data.data.access.requiresAuthorization).toBe(true);
  const contentUrl = access.data.data.access.url;
  expect(contentUrl).toContain('/authenticated-content?');
  const content = await call('GET', contentUrl, undefined, child, { responseType: 'arraybuffer' });
  expect(content.status).toBe(200);
  expect(content.headers['cache-control']).toBe('private, no-store');
  expect(content.headers['content-type']).toMatch(/^image\/png/);
  expect(content.data.length).toBe(media.sizeBytes);
  expect((await sharp(content.data).metadata()).format).toBe('png');
  expectStatus(await call('GET', contentUrl, undefined, null), 401);
  const parentView = await detail(packageId, parent), attempt = parentView.attempts[0];
  const review = await call('POST', `${detailPath(packageId)}/attempts/${attempt.id}/review`, {
    ...command(), expectedPackageVersion: parentView.stateVersion, expectedAttemptVersion: attempt.attemptVersion,
    attemptPayloadHash: attempt.attemptPayloadHash, decision: 'approve', comment: 'Synthetic parent approval'
  });
  expectStatus(review, 200);
  const reviewed = await detail(packageId);
  expect(reviewed.learningState).toBe('approved');
  expect(reviewed.attempts[0].review).toMatchObject({ decision: 'approve', comment: 'Synthetic parent approval' });
  expectChildSafe(reviewed);
  expectStatus(await call('POST', detailPath(packageId) + '/withdraw', {
    ...command(), expectedPackageVersion: reviewed.stateVersion, reason: 'Synthetic withdrawal'
  }), 200);
  expectStatus(await call('GET', detailPath(packageId), undefined, child), 404);
  expectStatus(await call('GET', contentUrl, undefined, child), 404);
  expect((await detail(packageId, parent)).visibility).toBe('withdrawn');
});

test.each(['approve', 'revise'])('WITHDRAW-01 formal republication after %s preserves old attempts and audit without migrating history', async decision => {
  const { packageId, stored, media, remote } = await submitted();
  const originalTask = await Task.findById(task._id).lean();
  const parentView = await detail(packageId, parent), attempt = parentView.attempts[0];
  expectStatus(await call('POST', `${detailPath(packageId)}/attempts/${attempt.id}/review`, {
    ...command(), expectedPackageVersion: parentView.stateVersion, expectedAttemptVersion: attempt.attemptVersion,
    attemptPayloadHash: attempt.attemptPayloadHash, decision, comment: 'Keep original review audit'
  }), 200);
  const access = await call('GET', `/api/media/${media.mediaId}/access`, undefined, child);
  expectStatus(access, 200);
  const oldUrl = access.data.data.access.url;
  const reviewed = await M.Attempt.findById(stored._id).lean();
  const current = await detail(packageId, parent);
  const withdrawBody = { ...command(), expectedPackageVersion: current.stateVersion, reason: 'Explicit replacement' };
  const withdrawal = await call('POST', detailPath(packageId) + '/withdraw', withdrawBody);
  expectStatus(withdrawal, 200);
  const snapshot = async () => ({ package: await M.Package.findById(packageId).lean(),
    attempts: await M.Attempt.find({ packageId }).sort({ _id: 1 }).lean(),
    commands: await M.Command.find({ packageId }).sort({ _id: 1 }).lean(),
    refs: await Reference.find({ resourceId: stored._id }).sort({ _id: 1 }).lean(),
    operation: await Operation.findById(remote._id).lean(), asset: await Asset.findById(media.mediaId).lean() });
  const frozen = await snapshot();
  expect(frozen.attempts).toEqual([reviewed]);
  const nextId = await publish(); expect(nextId).not.toBe(packageId);
  const next = await detail(nextId);
  expect(next).toMatchObject({ stateVersion: 1, learningState: 'open', currentAttemptVersion: null,
    currentAttemptId: null, pending: false, attempts: [] });
  const history = await call('GET', detailPath(nextId) + '/attempts', undefined, child);
  expectStatus(history, 200); expect(history.data.data.items).toEqual([]);
  expectStatus(await call('GET', `${detailPath(nextId)}/attempts/${stored._id}`, undefined, child), 404);
  expectStatus(await call('GET', detailPath(packageId), undefined, child), 404);
  expectStatus(await call('GET', oldUrl, undefined, child), 404);
  const replay = await call('POST', detailPath(packageId) + '/withdraw', withdrawBody);
  expectStatus(replay, 200); expect(replay.data.data.command).toEqual(withdrawal.data.data.command);
  const uploaded = await upload(); expectStatus(uploaded, 201);
  expectStatus(await call('POST', detailPath(nextId) + '/attempts', { ...command(), expectedPackageVersion: 1,
    note: 'New package correction', mediaIds: [uploaded.data.data.media.mediaId] }, child), 201);
  const newAttempt = await M.Attempt.findOne({ packageId: nextId }).lean();
  expect(String(newAttempt._id)).not.toBe(String(stored._id));
  expect(newAttempt).toMatchObject({ attemptVersion: 1, review: null, note: 'New package correction' });
  expect(await M.Attempt.countDocuments()).toBe(2);
  expect(await snapshot()).toEqual(frozen);
  expect((await detail(packageId, parent)).attempts[0].review).toMatchObject({ decision, comment: 'Keep original review audit' });
  expect(await Task.findById(task._id).lean()).toEqual(originalTask);
});
test('VIEW-01 formal nonempty child list, attempt history and own command expose only allowed DTO keys without writes', async () => {
  const { packageId, stored, media } = await submitted();
  const parentView = await detail(packageId, parent), attempt = parentView.attempts[0];
  expectStatus(await call('POST', `${detailPath(packageId)}/attempts/${attempt.id}/review`, {
    ...command(), expectedPackageVersion: parentView.stateVersion, expectedAttemptVersion: attempt.attemptVersion,
    attemptPayloadHash: attempt.attemptPayloadHash, decision: 'approve', comment: 'Synthetic reviewed feedback'
  }), 200);
  const own = await M.Command.findOne({ actorId: child.id, endpointOperation: 'ai2.submit' }).lean();
  expect(own.phase).toBe('SUCCEEDED');
  expect(await M.Command.countDocuments({ actorId: parent.id })).toBe(2);
  const models = [...Object.values(A), ...Object.values(M), Asset, Reference, Operation, UploadGuard, Tombstone, Receipt];
  const snapshot = async () => JSON.stringify(await Promise.all(models.map(model => model.find().sort({ _id: 1 }).lean())));
  const before = await snapshot();
  const keys = (value, allowed) => expect(Object.keys(value).sort()).toEqual(allowed.split(' ').sort());
  const get = async target => {
    const response = await call('GET', target, undefined, child);
    expectStatus(response, 200); expect(response.headers['cache-control']).toBe('no-store');
    keys(response.data, 'success data'); expectChildSafe(response.data); return response.data.data;
  };
  const list = await get('/api/ai2/learning-packages');
  keys(list, 'items page pageSize'); expect(list.items.map(p => p.id)).toEqual([packageId]);
  const summaryKeys = 'id source childSnapshot childSnapshotHash artifact visibility learningState stateVersion currentAttemptId currentAttemptVersion publishedAt pending';
  keys(list.items[0], summaryKeys);
  const view = await get(detailPath(packageId)); keys(view, 'package');
  keys(view.package, summaryKeys + ' attempts sourceAvailability');
  for (const p of [list.items[0], view.package]) {
    keys(p.source, 'type id subject'); keys(p.artifact, 'id version contentHash');
    keys(p.childSnapshot, 'questionText explanationText chapter source');
    keys(p.childSnapshot.chapter, 'provenance subject grade term textbookLabel chapterLabel');
    keys(p.childSnapshot.source, 'type id');
    expect(p.learningState).toBe('approved'); expect(p.currentAttemptId).toBe(String(stored._id));
  }
  const direct = await get(`${detailPath(packageId)}/attempts/${stored._id}`); keys(direct, 'attempt');
  expect(view.package.attempts).toHaveLength(1);
  expect(direct.attempt).toEqual(view.package.attempts[0]);
  keys(direct.attempt, 'id attemptVersion note submittedAt review media');
  keys(direct.attempt.review, 'decision comment reviewedAt');
  expect(direct.attempt.review).toMatchObject({ decision: 'approve', comment: 'Synthetic reviewed feedback' });
  expect(direct.attempt.media).toEqual([{ mediaId: media.mediaId, mimeType: media.mimeType,
    sizeBytes: media.sizeBytes, status: 'available' }]);
  const history = await get(`${detailPath(packageId)}/attempts`);
  keys(history, 'items page pageSize'); expect(history.items).toHaveLength(1);
  keys(history.items[0], 'id attemptVersion submittedAt review');
  keys(history.items[0].review, 'decision comment reviewedAt');
  expect(history.items[0]).toEqual({ id: direct.attempt.id, attemptVersion: direct.attempt.attemptVersion,
    submittedAt: direct.attempt.submittedAt, review: direct.attempt.review });
  const commands = await get('/api/ai2/commands?scope=mine');
  keys(commands, 'items page pageSize'); expect(commands.items.map(c => c.id)).toEqual([String(own._id)]);
  const commandKeys = 'id operationId endpointOperation phase resultReference failureCode createdAt';
  keys(commands.items[0], commandKeys); keys(commands.items[0].resultReference, 'packageId attemptId');
  expect(commands.items[0]).toMatchObject({ operationId: own.operationId, endpointOperation: 'ai2.submit',
    phase: 'SUCCEEDED', failureCode: null, resultReference: { packageId, attemptId: String(stored._id) } });
  const original = await get(`/api/ai2/commands/${own._id}`); keys(original, 'command');
  keys(original.command, commandKeys + ' payload');
  keys(original.command.payload, 'schemaVersion operationId expectedPackageVersion note mediaIds');
  expect(original.command.payload).toEqual(own.payload);
  expect(original.command.payload).toMatchObject({ operationId: own.operationId, note: 'Synthetic correction attempt',
    mediaIds: [media.mediaId] });
  expect(await snapshot()).toBe(before);
});
test('VIEW-01 formal child cannot guess AI1 candidate IDs or another actor command through AI2 reads', async () => {
  const { packageId, stored } = await submitted();
  const cycle = await A.Cycle.findById(cycleId).lean();
  const parentCommand = await M.Command.findOne({ actorId: parent.id }).lean();
  expect((await detail(packageId)).id).toBe(packageId);
  const models = [...Object.values(A), ...Object.values(M), Asset, Reference, Operation, UploadGuard, Tombstone, Receipt];
  const snapshot = async () => JSON.stringify(await Promise.all(models.map(model => model.find().sort({ _id: 1 }).lean())));
  const before = await snapshot();
  for (const guessed of [cycleId, String(cycle.approvedArtifactId)]) {
    for (const target of [detailPath(guessed), `${detailPath(guessed)}/attempts`,
      `${detailPath(guessed)}/attempts/${stored._id}`, `${detailPath(packageId)}/attempts/${guessed}`,
      `/api/ai2/commands/${guessed}`]) {
      const response = await call('GET', target, undefined, child);
      expectStatus(response, 404); expect(response.data.error.code).toBe('RESOURCE_NOT_FOUND');
      expectChildSafe(response.data);
    }
  }
  expectStatus(await call('GET', `/api/ai2/commands/${parentCommand._id}`, undefined, child), 404);
  expectStatus(await call('GET', `/api/ai2/publication-preview?cycleId=${cycleId}`, undefined, child), 403);
  expect(await snapshot()).toBe(before);
});
test('formal privacy deletion preserves exact metadata and journal evidence, but rejects an incomplete descriptor', async () => {
  const { packageId, media, stored, remote } = await submitted();
  const access = await call('GET', `/api/media/${media.mediaId}/access`, undefined, child);
  expectStatus(access, 200);
  expectStatus(await call('DELETE', `/api/media/${media.mediaId}`, undefined, child), 204);
  expectStatus(await call('GET', access.data.data.access.url, undefined, child), 404);
  for (const actor of [child, parent]) {
    const view = await detail(packageId, actor);
    expect(view.attempts[0].media).toEqual([{ mediaId: media.mediaId, mimeType: media.mimeType, sizeBytes: media.sizeBytes, status: 'deleted' }]);
  }
  const tombstone = await Tombstone.findOne({ mediaId: media.mediaId }).lean();
  const receipt = await Receipt.findOne({ mediaId: media.mediaId }).lean();
  expect(tombstone).toMatchObject({ purpose: 'ai2_correction', mimeType: media.mimeType, sizeBytes: media.sizeBytes });
  expect(receipt).toMatchObject({ resourceType: 'ai2_attempt', field: 'correctionMediaIds', bindingOperationId: remote.operationId });
  expect(String(receipt.resourceId)).toBe(String(stored._id));
  const journalPath = path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, media.mediaId + '.json');
  const journal = await fs.readFile(journalPath, 'utf8');
  expect(JSON.parse(journal).tombstone).toMatchObject({ mediaId: media.mediaId, mimeType: media.mimeType, sizeBytes: media.sizeBytes });
  expectStatus(await call('DELETE', `/api/media/${media.mediaId}`, undefined, child), 204);
  expect(await fs.readFile(journalPath, 'utf8')).toBe(journal);
  expect(await Receipt.countDocuments({ mediaId: media.mediaId })).toBe(1);
  expect((await checkCompletionOperations({ connection: mongoose.connection, writesPaused: true, env })).ready).toBe(true);
  const inspect = { familyId: String(family._id), childId: child.id, identity: parent, mediaIds: [media.mediaId],
    bindings: [{ ...stored.mediaBindings[0], bindingOperationId: randomUUID() }] };
  expect((await http.post(resourceBase + '/api/internal/media/ai2/inspect', inspect,
    { headers: { 'x-service-token': TOKEN } })).status).toBe(404);
  // Corrupt only this disposable fixture: formal HTTP must not invent a deleted descriptor.
  await Tombstone.collection.updateOne({ mediaId: new mongoose.Types.ObjectId(media.mediaId) }, { $unset: { mimeType: '', sizeBytes: '' } });
  const incomplete = await call('GET', detailPath(packageId), undefined, child);
  expectStatus(incomplete, 503);
  expect(incomplete.data.error.code).toBe('MEDIA_SERVICE_UNAVAILABLE');
  expect(incomplete.data).not.toHaveProperty('data.package');
  expect(await fs.readFile(journalPath, 'utf8')).toBe(journal);
});

test('formal gateway rejects forged identity, sibling/outsider access, parent submission and internal-route exposure', async () => {
  const { packageId, media } = await submitted();
  const before = await M.Command.countDocuments();
  expectStatus(await call('GET', detailPath(packageId), undefined, null, { headers: {
    'x-user-id': parent.id, 'x-user-role': 'parent'
  } }), 401);
  expectStatus(await call('GET', detailPath(packageId), undefined, sibling), 404);
  expectStatus(await call('GET', detailPath(packageId), undefined, outsider), 404);
  expectStatus(await call('GET', `/api/media/${media.mediaId}/access`, undefined, sibling), 403);
  expectStatus(await call('POST', detailPath(packageId) + '/attempts', {
    ...command(), expectedPackageVersion: 2, note: 'Synthetic prohibited proxy', mediaIds: [media.mediaId]
  }, parent), 403);
  expectStatus(await upload(parent), 403);
  for (const target of ['/api/internal/ai2/media-access-check', '/api/internal/media/ai2/inspect', '/api/internal/media/references/prepare']) {
    expect((await call('POST', target, {}, parent, { headers: { 'x-service-token': TOKEN } })).status).toBe(404);
  }
  expect((await http.post(resourceBase + '/api/internal/media/ai2/inspect', {})).status).toBe(401);
  expect((await http.post(homeworkBase + '/api/internal/ai2/media-access-check', {})).status).toBe(401);
  await User.updateOne({ _id: child.id }, { $inc: { 'childProfile.tokenVersion': 1 } });
  expectStatus(await call('GET', detailPath(packageId), undefined, child), 401);
  expect(await M.Command.countDocuments()).toBe(before);
  expect(await M.Attempt.countDocuments()).toBe(1);
  expect(await Asset.countDocuments()).toBe(1);
});

test('formal publication uses live GrowthTask source rather than a fixture sourceReader', async () => {
  const preview = await call('GET', `/api/ai2/publication-preview?cycleId=${cycleId}`);
  expectStatus(preview, 200);
  const { childSnapshot: _snapshot, ...confirmed } = preview.data.data.preview;
  await Task.deleteOne({ _id: task._id });
  expectStatus(await call('POST', '/api/ai2/learning-packages', {
    ...command(), ...confirmed, childContentConfirmed: true
  }), 404);
  expect(await M.Package.countDocuments()).toBe(0);
  expect(await M.Command.countDocuments()).toBe(0);
});
test('PUB-04 formal source title and description edits then deletion never rewrite the published child snapshot', async () => {
  const packageId = await publish(), first = await detail(packageId);
  const stored = await M.Package.findById(packageId).lean();
  await Task.updateOne({ _id: task._id }, { $set: { title: 'CHANGED_PRIVATE_TITLE', description: 'CHANGED_PRIVATE_QUESTION' } });
  expect(await Task.findById(task._id).lean()).toMatchObject({ title: 'CHANGED_PRIVATE_TITLE', description: 'CHANGED_PRIVATE_QUESTION' });
  for (const actor of [child, parent]) {
    const changed = await detail(packageId, actor);
    expect(changed.sourceAvailability).toBe('available');
    expect(changed.childSnapshot).toEqual(first.childSnapshot);
    expect(JSON.stringify(changed.childSnapshot)).not.toContain('CHANGED_PRIVATE');
  }
  await Task.deleteOne({ _id: task._id });
  const missing = await detail(packageId);
  expect(missing.sourceAvailability).toBe('missing'); expect(missing.childSnapshot).toEqual(first.childSnapshot);
  expect(await M.Package.findById(packageId).lean()).toEqual(stored);
  expect(await M.Command.countDocuments()).toBe(1); expect(await M.Attempt.countDocuments()).toBe(0);
});
test('AUTH-01 actual PIN reset invalidates issued JWT for AI2 reads, original replay, recovery and private content', async () => {
  const { createProductionApp: createUserApp } = require('../../../user-service/server');
  const user = await endpoint(), gateway = await endpoint();
  user.mount(createUserApp({ env }));
  gateway.mount(createGatewayApp({ serviceHosts: { user: user.base, homework: homeworkBase, resource: resourceBase },
    jwtSecret: process.env.JWT_SECRET, identitySecret: process.env.GATEWAY_IDENTITY_SECRET,
    enableLegacyDataProxy: false, rateLimitOptions: { windowMs: 60000, max: 1000 } }));
  // Existing fixture uses raw inserts. Complete required User fields so real PIN save validation runs.
  await User.collection.updateOne({ _id: new mongoose.Types.ObjectId(child.id) }, { $set: {
    username: 'pin_' + child.id.slice(-12), name: 'Synthetic PIN child', password: 'synthetic-unused-password' } });
  const withToken = (method, target, data, token) => http.request({ method, url: gateway.base + target, data,
    headers: token ? { Authorization: 'Bearer ' + token } : {} });
  const parentToken = jwt.sign(parent, process.env.JWT_SECRET, { expiresIn: 300 });
  const pinPath = `/api/children/${child.id}/pin`;
  expectStatus(await withToken('POST', pinPath, { pin: '1234' }, parentToken), 200);
  const loginBody = pin => ({ familyId: String(family._id), childId: child.id, pin });
  const login = await withToken('POST', '/api/auth/child-pin-login', loginBody('1234'));
  expectStatus(login, 200); const oldToken = login.data.data.token;
  const oldClaims = jwt.verify(oldToken, process.env.JWT_SECRET);
  expect(oldClaims.tokenVersion).toBe(1);
  const packageId = await publish();
  const form = new FormData(); form.append('purpose', 'ai2_correction');
  form.append('file', png, { filename: 'synthetic-pin-work.png', contentType: 'image/png' });
  const uploaded = await http.post(gateway.base + '/api/media', form, { headers: { ...form.getHeaders(), Authorization: 'Bearer ' + oldToken } });
  expectStatus(uploaded, 201); const mediaId = uploaded.data.data.media.mediaId;
  const body = { ...command(), expectedPackageVersion: 1, note: 'Synthetic PIN work', mediaIds: [mediaId] };
  const sent = await withToken('POST', detailPath(packageId) + '/attempts', body, oldToken);
  expectStatus(sent, 201); const saved = await M.Command.findById(sent.data.data.command.id).lean();
  const access = await withToken('GET', `/api/media/${mediaId}/access`, undefined, oldToken);
  expectStatus(access, 200); const contentUrl = access.data.data.access.url;
  expectStatus(await withToken('GET', contentUrl, undefined, oldToken), 200);
  expectStatus(await withToken('POST', pinPath, { pin: '5678' }, parentToken), 200);
  expect((await User.findById(child.id)).childProfile.tokenVersion).toBe(2);
  const snapshot = () => Promise.all([...Object.values(M), ...Object.values(A), Asset, Reference, Operation, UploadGuard, Receipt, Tombstone]
    .map(model => model.find().sort({ _id: 1 }).lean()));
  const before = await snapshot();
  for (const [method, target, payload] of [
    ['GET', detailPath(packageId)], ['GET', '/api/ai2/learning-packages'], ['GET', '/api/ai2/commands?scope=mine'],
    ['GET', `/api/ai2/commands/${saved._id}`], ['POST', detailPath(packageId) + '/attempts', body],
    ['POST', `/api/ai2/commands/${saved._id}/recover`, { schemaVersion: body.schemaVersion, operationId: body.operationId }],
    ['GET', `/api/media/${mediaId}/access`], ['GET', contentUrl]
  ]) {
    const denied = await withToken(method, target, payload, oldToken);
    expectStatus(denied, 401); expect(denied.data.error.code).toBe('STALE_CHILD_TOKEN');
    expect(await snapshot()).toEqual(before);
  }
  expectStatus(await withToken('POST', '/api/auth/child-pin-login', loginBody('1234')), 401);
  const renewed = await withToken('POST', '/api/auth/child-pin-login', loginBody('5678'));
  expectStatus(renewed, 200); const newToken = renewed.data.data.token;
  expect(jwt.verify(newToken, process.env.JWT_SECRET).tokenVersion).toBe(2);
  expectStatus(await withToken('GET', detailPath(packageId), undefined, newToken), 200);
  const recovered = await withToken('POST', `/api/ai2/commands/${saved._id}/recover`, {
    schemaVersion: body.schemaVersion, operationId: body.operationId }, newToken);
  expectStatus(recovered, 200); expect(recovered.data.data.command.id).toBe(String(saved._id));
  expect(recovered.data.data.command.phase).toBe('SUCCEEDED'); expect(await snapshot()).toEqual(before);
});

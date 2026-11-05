const mongoose = require('mongoose');
const express = require('express');
const axios = require('axios');
const { randomUUID } = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const A = require('../../models/Ai2');
const M = require('../../models/Ai3');
const C = require('../../services/ai3Contract');
const { createAi3Service } = require('../../services/ai3Service');
const { createAi3MediaInspectClient } = require('../../services/ai3MediaInspectClient');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { createCompletionMediaReferenceClient } = require('../../../../common/services/completionMediaReferenceClient');
const { createCompletionMediaReferencesRouter } = require('../../../resource-service/routes/completionMediaReferences');
const { createMediaReferenceCredential } = require('../../../resource-service/middleware/mediaReferenceCredential');
const { createMediaReferenceOperationService } = require('../../../resource-service/services/mediaReferenceOperationService');
const { createCompletionMediaPrivacyService } = require('../../../resource-service/services/completionMediaPrivacyService');
const { createMediaDeletionJournal } = require('../../../resource-service/services/mediaDeletionJournal');
const { createAi3MediaAccessRouter } = require('../../routes/ai3MediaAccess');
const { createAi3MediaAccessClient } = require('../../../resource-service/services/ai3MediaAccessClient');
const { createAi3MediaInspectRouter } = require('../../../resource-service/routes/ai3MediaInspect');
const { createMediaService } = require('../../../resource-service/services/mediaService');
const { createPrivateMediaStore } = require('../../../resource-service/services/privateMediaStore');
const { createMediaCapabilityService } = require('../../../resource-service/services/mediaCapability');
const { createCompletionUploadService } = require('../../../resource-service/services/completionUploadService');
const { createCompletionUploadJournal } = require('../../../resource-service/services/completionUploadJournal');
const Guard = require('../../../resource-service/models/CompletionUploadGuard');
const Asset = require('../../../resource-service/models/MediaAsset');
const Reference = require('../../../resource-service/models/MediaReference');
const Operation = require('../../../resource-service/models/MediaReferenceOperation');
const Receipt = require('../../../resource-service/models/MediaDeletionReceipt');
const Tombstone = require('../../../resource-service/models/MediaDeletionTombstone');
const id = () => String(new mongoose.Types.ObjectId());
const cmd = () => ({ schemaVersion: 'ai3-min-v1', operationId: randomUUID() });
const token = 'synthetic-ai3-real-http-reference-token-32';
const runner = work => runMongoTransaction({ mongooseInstance: mongoose, work });
const http = axios.create({ proxy: false, timeout: 3000, validateStatus: () => true });
let servers, clock, runtime, parent, child, sibling, family, pkg, roundId, body, service, client, dropCommit, calls, accessBase, root;
let mediaService, inspectClient, png;
async function listen(app) {
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
    s.once('error', cause => { s.close(); reject(cause); });
  });
  servers.push(server); return `http://127.0.0.1:${server.address().port}`;
}
const rebuild = () => { service = createAi3Service({ now: () => clock, getRuntime: () => runtime, mediaReferenceClient: client, mediaInspectClient: inspectClient,
  sourceReader: { require: async q => ({ id: q.sourceTaskId, familyId: String(family._id), childId: child.id, subject: 'math', knowledgePointId: null }) } }); };
const submit = (extra = {}, identity = child) => service.submit({ identity, roundId, body: { ...body, ...extra } });
const recover = c => service.recover({ identity: child, commandId: String(c._id), body: { schemaVersion: body.schemaVersion, operationId: body.operationId } });
const submission = () => M.Command.findOne({ endpointOperation: 'ai3.submit' }).lean();
const readMedia = async (identity, mediaId, access) => {
  const url = new URL(access.url, 'http://synthetic.invalid');
  return mediaService.readAuthenticatedContent({ identity, mediaId, path: url.pathname,
    ...Object.fromEntries(url.searchParams) });
};
const snapshot = async () => JSON.stringify(await Promise.all([...Object.values(M), Reference, Operation, Receipt, Tombstone]
  .map(m => m.find().sort({ _id: 1 }).lean())));
beforeAll(async () => {
  for (const model of [...Object.values(M), ...Object.values(A), Family, User, Asset, Reference, Operation, Receipt, Tombstone, Guard]) await model.init();
  png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#338855' } }).png().toBuffer();
});
beforeEach(async () => {
  servers = []; calls = []; dropCommit = false; root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'ai3-media-http-')));
  clock = Date.parse('2026-11-04T01:00:00Z'); runtime = { enabled: true, continuousStore: true };
  parent = { id: id(), role: 'parent' }; child = { id: id(), role: 'student', tokenVersion: 0 }; sibling = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic AI3 HTTP', ownerParentId: parent.id, memberParentIds: [parent.id], childIds: [child.id, sibling.id] });
  for (const a of [child, sibling]) Object.assign(a, { childId: a.id, familyId: String(family._id) });
  await User.collection.insertMany([parent, child, sibling].map(a => ({ _id: new mongoose.Types.ObjectId(a.id), username: a.id, role: a.role,
    ...(a.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  const childSnapshot = { questionText: '124 * 23', explanationText: 'Synthetic approved explanation', chapter: {
    provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper', textbookLabel: 'Synthetic', chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' } };
  pkg = await A.Package.create({ familyId: family._id, childId: child.id, ai1CycleId: id(), source: { type: 'task', id: id(), subject: 'math' },
    artifact: { id: id(), version: 1, contentHash: C.hash('synthetic') }, childSnapshot, childSnapshotHash: C.hash(childSnapshot),
    publishedBy: parent.id, publishedAt: new Date(clock), visibility: 'published', learningState: 'approved', stateVersion: 3 });
  const attempt = await A.Attempt.create({ familyId: family._id, childId: child.id, packageId: pkg._id, attemptVersion: 1,
    submitCommandId: id(), submittedBy: child.id, submittedAt: new Date(clock), note: '', mediaIds: [id()], mediaBindings: [],
    payloadHash: C.hash('synthetic-source-attempt'), review: { decision: 'approve', reviewerId: parent.id, reviewedAt: new Date(clock).toISOString() } });
  await A.Package.updateOne({ _id: pkg._id }, { $set: { currentAttemptId: attempt._id, currentAttemptVersion: 1 } });
  const access = express(); access.use(express.json()); access.use('/api/internal/ai3', createAi3MediaAccessRouter({ serviceToken: token }));
  accessBase = await listen(access);
  const store = createPrivateMediaStore({ root: path.join(root, 'media') });
  mediaService = createMediaService({ MediaAssetModel: Asset, MediaReferenceModel: Reference, FamilyModel: Family, UserModel: User,
    mediaStore: store, transactionRunner: runner,
    capabilityService: createMediaCapabilityService({ secret: 'synthetic-ai3-media-capability-secret', now: () => clock }),
    completionUploadService: createCompletionUploadService({ transactionRunner: runner, mediaStore: store,
      ai3Mode: () => runtime.enabled ? 'enabled' : 'off', journal: createCompletionUploadJournal({ root: path.join(root, 'uploads') }) }),
    getAi3Mode: () => runtime.enabled ? 'enabled' : 'off', assertAi3Continuous: () => {},
    ai3MediaAccessClient: createAi3MediaAccessClient({ homeworkServiceUrl: accessBase, serviceToken: token, axiosInstance: axios.create({ proxy: false }) }) });
  const app = express(); app.use(express.json());
  app.use((req, res, next) => {
    calls.push(req.path); const json = res.json.bind(res);
    res.json = value => { if (dropCommit && req.path.endsWith('/commit') && value.success) { req.socket.destroy(); return res; } return json(value); };
    next();
  });
  app.use('/api/internal/media/references', createCompletionMediaReferencesRouter({ credential: createMediaReferenceCredential(token),
    operationService: createMediaReferenceOperationService({ transactionRunner: runner, now: () => clock, ai3Mode: () => runtime.enabled ? 'enabled' : 'off' }) }));
  app.use('/api/internal/media/ai3', createAi3MediaInspectRouter({ serviceToken: token, mediaService, assertAi3Continuous: () => {} }));
  app.use((e, req, res, next) => res.status(e.statusCode || 500).json({ success: false, error: { code: e.code } }));
  const resourceServiceUrl = await listen(app);
  client = createCompletionMediaReferenceClient({ resourceServiceUrl, serviceToken: token, axiosInstance: axios.create({ proxy: false }) });
  inspectClient = createAi3MediaInspectClient({ resourceServiceUrl, serviceToken: token });
  rebuild();
  const created = await service.create({ identity: parent, body: { ...cmd(), sourcePackageId: String(pkg._id), expectedSourcePackageVersion: 3,
    sourceAttemptId: String(attempt._id), expectedSourceAttemptVersion: 1, sourceAttemptPayloadHash: attempt.payloadHash,
    sourceReviewHash: C.hash(attempt.review), exerciseCount: 2, knowledgePointId: null } });
  roundId = created.round.id;
  await service.reviseContent({ identity: parent, roundId, body: { ...cmd(), expectedRoundVersion: created.round.stateVersion,
    expectedContentId: null, expectedContentVersion: null, expectedContentHash: null, reason: 'Synthetic manual review',
    content: { instructions: 'Show steps.', exercises: [1, 2].map(n => ({ exerciseId: `q${n}`, questionText: '132 * 24',
      answerForParent: 'PRIVATE_ANSWER', rubricForParent: 'PRIVATE_RUBRIC' })) } } });
  const { preview } = await service.publicationPreview({ identity: parent, roundId });
  const { content, childSnapshot: projection, roundId: ignored, ...seen } = preview;
  await service.publish({ identity: parent, roundId, body: { ...cmd(), ...seen, childContentConfirmed: true, answersChecked: true } });
  const { round } = await service.getRound({ identity: child, roundId });
  const mediaIds = [];
  for (let i = 0; i < 2; i++) {
    const media = await mediaService.upload({ identity: child, purpose: 'ai3_practice', bytes: png, originalName: 'synthetic.png', declaredMimeType: 'image/png' });
    mediaIds.push(media.mediaId);
  }
  body = { ...cmd(), expectedRoundVersion: round.stateVersion, contentId: round.contentId, contentVersion: round.contentVersion,
    childSnapshotHash: round.childSnapshotHash, note: 'Synthetic practice work', mediaIds };
});
afterEach(async () => {
  try { for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } }
  finally { if (root) await fs.rm(root, { recursive: true, force: true }); }
});

test.each([1, 10])('real operations preserve all %i uploaded images in order', async count => {
  const mediaIds = body.mediaIds.slice(0, count);
  while (mediaIds.length < count) {
    const media = await mediaService.upload({ identity: child, purpose: 'ai3_practice', bytes: png,
      originalName: 'synthetic.png', declaredMimeType: 'image/png' });
    mediaIds.push(media.mediaId);
  }
  body = { ...body, mediaIds };
  expect((await submit()).command.phase).toBe('SUCCEEDED');
  const c = await submission(), a = await M.Attempt.findOne().lean();
  expect(a.mediaIds.map(String)).toEqual(mediaIds); expect(a.mediaBindings).toEqual(c.references);
  expect(await Reference.countDocuments({ resourceId: a._id, state: 'bound', operationId: c.remoteOperationId })).toBe(count);
  const detail = await service.getAttempt({ identity: child, roundId, attemptId: String(a._id) });
  expect(detail.attempt.media.map(m => m.mediaId)).toEqual(mediaIds);
  expect(detail.attempt.media.every(m => m.status === 'available')).toBe(true);
  expect(await Operation.countDocuments()).toBe(1);
});

test('real resource commit loses response, fresh service recovers original mapping and publishes once', async () => {
  dropCommit = true;
  const pending = await submit(); expect(pending.command.phase).not.toBe('SUCCEEDED');
  const c = await submission(); expect(c.remoteOperationId).not.toBe(body.operationId);
  expect((await Operation.findOne({ operationId: c.remoteOperationId }).lean()).state).toBe('COMMITTED');
  expect(await M.Attempt.countDocuments()).toBe(0);
  const before = await snapshot(), beforeCalls = [...calls];
  await service.getCommand({ identity: child, commandId: String(c._id) });
  expect(await snapshot()).toBe(before); expect(calls).toEqual(beforeCalls);
  clock += 31000; dropCommit = false; rebuild();
  expect((await recover(c)).command.phase).toBe('SUCCEEDED');
  const attempt = await M.Attempt.findOne().lean();
  expect(attempt.mediaIds.map(String)).toEqual(body.mediaIds); expect(attempt.mediaBindings).toEqual(c.references);
  expect((await submit()).command.id).toBe(String(c._id));
  expect(await M.Attempt.countDocuments()).toBe(1); expect(await Operation.countDocuments()).toBe(1);
  expect((await M.Command.find({ endpointOperation: 'ai3.submit' }).lean())).toHaveLength(1);
  const result = await http.post(accessBase + '/api/internal/ai3/media-access-check', { familyId: String(family._id), childId: child.id,
    actorId: child.id, role: child.role, mediaId: body.mediaIds[0], bindings: [{ attemptId: String(attempt._id), bindingOperationId: c.remoteOperationId }] },
  { headers: { 'x-service-token': token } });
  expect(result.status).toBe(200); expect(result.data).toEqual({ success: true, data: { allowed: true } });
  expect(JSON.stringify(result.data)).not.toMatch(/PRIVATE_|contentHash|storageKey/);
  const { access } = await mediaService.issueAccess({ identity: child, mediaId: body.mediaIds[0] });
  expect(access.requiresAuthorization).toBe(true);
  const read = await readMedia(child, body.mediaIds[0], access);
  expect((await sharp(read.bytes).metadata()).format).toBe('png');
  await expect(readMedia(sibling, body.mediaIds[0], access)).rejects.toMatchObject({ statusCode: 403 });
  const detail = await service.getAttempt({ identity: child, roundId, attemptId: String(attempt._id) });
  expect(JSON.stringify(detail)).not.toMatch(/PRIVATE_|fullContentHash|storageKey|serverContentBinding/);
  expect(detail.attempt.media.map(m => m.status)).toEqual(['available', 'available']);
});
test('committed media plus withdrawn ancestor cannot publish; exact original generation is compensated', async () => {
  dropCommit = true; await submit(); const c = await submission();
  await A.Package.updateOne({ _id: pkg._id }, { $set: { visibility: 'withdrawn' }, $inc: { stateVersion: 1 } });
  clock += 31000; dropCommit = false; rebuild();
  const result = await recover(c); expect(result.command.phase).toBe('FAILED');
  expect(await M.Attempt.countDocuments()).toBe(0);
  const refs = await Reference.find({ resourceId: c.attemptId }).lean();
  expect(refs).toHaveLength(2); expect(refs.every(r => r.state === 'released' && r.operationId === c.remoteOperationId)).toBe(true);
  const r = await M.Round.findById(roundId).lean(); expect(r.learningState).toBe('open'); expect(r.activeCommandId).toBeNull();
  const previous = await snapshot(); await recover(c); expect(await snapshot()).toBe(previous);
});
test('parent withdraws its Round while real committed media response is lost; original child recovery releases the active slot', async () => {
  dropCommit = true; await submit(); const c = await submission();
  const current = await M.Round.findById(roundId).lean();
  const withdrawal = { ...cmd(), expectedRoundVersion: current.stateVersion, reason: 'Synthetic withdrawal during pending submit' };
  await service.withdraw({ identity: parent, roundId, body: withdrawal });
  const withdrawn = await M.Round.findById(roundId).lean();
  expect(withdrawn).toMatchObject({ visibility: 'withdrawn', active: true, activeCommandId: c._id });
  expect((await submission()).remoteOperationId).toBe(c.remoteOperationId);
  await expect(service.getRound({ identity: child, roundId })).rejects.toMatchObject({ statusCode: 404 });
  clock += 31000; dropCommit = false; rebuild();
  expect((await recover(c)).command.phase).toBe('FAILED');
  const ended = await M.Round.findById(roundId).lean();
  expect(ended).toMatchObject({ visibility: 'withdrawn', active: false, activeCommandId: null, learningState: 'open' });
  const refs = await Reference.find({ resourceId: c.attemptId }).lean();
  expect(refs).toHaveLength(2); expect(refs.every(r => r.state === 'released' && r.operationId === c.remoteOperationId)).toBe(true);
  expect(await M.Attempt.countDocuments()).toBe(0);
  const before = await snapshot(); await service.withdraw({ identity: parent, roundId, body: withdrawal });
  expect(await snapshot()).toBe(before);
});
test('privacy deletion after remote commit preserves exact receipts and original submission outcome', async () => {
  dropCommit = true; await submit(); const c = await submission();
  const privacy = createCompletionMediaPrivacyService({ transactionRunner: runner, now: () => clock, assertAi3Continuous: () => {},
    journal: createMediaDeletionJournal({ root: path.join(root, 'deletions') }) });
  await privacy.deleteMedia({ identity: child, mediaId: body.mediaIds[0] });
  expect(await Receipt.countDocuments({ mediaId: body.mediaIds[0], resourceType: 'ai3_attempt', resourceId: c.attemptId,
    field: 'practiceMediaIds', bindingOperationId: c.remoteOperationId })).toBe(1);
  clock += 31000; dropCommit = false; rebuild();
  expect((await recover(c)).command.phase).toBe('SUCCEEDED');
  expect(await M.Attempt.countDocuments()).toBe(1);
  expect((await M.Attempt.findOne().lean()).mediaBindings).toEqual(c.references);
  expect((await M.Round.findById(roundId).lean()).learningState).toBe('submitted');
  expect((await A.Package.findById(pkg._id).lean()).learningState).toBe('approved');
  const before = await snapshot();
  const detail = await service.getAttempt({ identity: child, roundId, attemptId: String(c.attemptId) });
  expect(detail.attempt.media.map(m => m.status)).toEqual(['deleted', 'available']);
  await expect(mediaService.issueAccess({ identity: child, mediaId: body.mediaIds[0] })).rejects.toMatchObject({ statusCode: 404 });
  expect(await snapshot()).toBe(before);
});
test('current identity rejection and changed body never make resource calls, even after lease expiry', async () => {
  dropCommit = true; await submit(); const c = await submission(); clock += 31000;
  const before = await snapshot(), beforeCalls = [...calls];
  await expect(submit({ note: 'Different intent' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  await expect(submit({}, parent)).rejects.toMatchObject({ statusCode: 403 });
  await expect(submit({}, sibling)).rejects.toMatchObject({ statusCode: 404 });
  await User.updateOne({ _id: child.id }, { $inc: { 'childProfile.tokenVersion': 1 } });
  await expect(recover(c)).rejects.toMatchObject({ statusCode: 401 });
  expect(await snapshot()).toBe(before); expect(calls).toEqual(beforeCalls);
});

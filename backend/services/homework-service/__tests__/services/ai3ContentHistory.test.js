const mongoose = require('mongoose');
const express = require('express');
const axios = require('axios');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const M = require('../../models/Ai3');
const C = require('../../services/ai3Contract');
const { createAi3Service } = require('../../services/ai3Service');
const { createAi3Router, createAi3JsonParser } = require('../../routes/ai3');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');
const { errorHandler } = require('../../../../common/middleware/errorHandler');

const id = () => String(new mongoose.Types.ObjectId());
const plain = value => JSON.parse(JSON.stringify(value));
const summaryKeys = ['id', 'roundId', 'version', 'contentHash', 'childSnapshotHash', 'origin',
  'derivedFromContentId', 'createdBy', 'createdAt'].sort();
const body = n => ({ instructions: `Private version ${n}`, exercises: [1, 2].map(i => ({ exerciseId: `q${i}`,
  questionText: `Question ${n}.${i}`, answerForParent: `PRIVATE_ANSWER_${n}.${i}`, rubricForParent: `PRIVATE_RUBRIC_${n}.${i}` })) });
let parent, coparent, outsider, child, sibling, family, round, contents, service, config, unused, server;
beforeAll(async () => { for (const model of [...Object.values(M), Family, User]) await model.init(); });
beforeEach(async () => {
  parent = { id: id(), role: 'parent' }; coparent = { id: id(), role: 'parent' }; outsider = { id: id(), role: 'parent' };
  child = { id: id(), role: 'student' }; sibling = { id: id(), role: 'student' };
  family = await Family.create({ familyName: 'Synthetic content history', ownerParentId: parent.id,
    memberParentIds: [parent.id, coparent.id], childIds: [child.id, sibling.id] });
  await Family.create({ familyName: 'Synthetic other family', ownerParentId: outsider.id, memberParentIds: [outsider.id] });
  await User.collection.insertMany([parent, coparent, outsider, child, sibling].map(actor => ({
    _id: new mongoose.Types.ObjectId(actor.id), role: actor.role, username: actor.id,
    ...(actor.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  for (const actor of [child, sibling]) Object.assign(actor, { childId: actor.id, familyId: String(family._id), tokenVersion: 0 });
  // Only isolated historical data is seeded; no source package or remote provider is required to read it.
  round = await M.Round.create({ familyId: family._id, childId: child.id, sourcePackageId: id(), sourceAttemptId: id(),
    sourceAttemptVersion: 1, sourceAttemptPayloadHash: 'a'.repeat(64), sourceReviewHash: 'b'.repeat(64),
    source: { type: 'task', id: id(), subject: 'math' }, chapter: { subject: 'math' }, exerciseCount: 2,
    createdBy: parent.id, stateVersion: 4, active: true, preparation: 'candidate', visibility: 'draft', learningState: 'open' });
  contents = [];
  for (let version = 1; version <= 3; version++) {
    const content = body(version), childSnapshot = C.childSnapshot(content);
    contents.push(await M.Content.create({ familyId: family._id, childId: child.id, roundId: round._id, version,
      content, contentHash: C.hash(content), childSnapshot, childSnapshotHash: C.hash(childSnapshot),
      createdBy: version === 2 ? coparent.id : parent.id, origin: version === 1 ? 'parent_manual' : 'parent_revision',
      derivedFromContentId: contents[version - 2]?._id || null, reason: `PRIVATE_REASON_${version}` }));
  }
  await M.Round.updateOne({ _id: round._id }, { $set: { currentContentId: contents[2]._id, currentContentVersion: 3,
    currentContentHash: contents[2].contentHash } });
  config = { enabled: true, continuousStore: true };
  unused = jest.fn(async () => { throw Error('History must never call a remote dependency'); });
  service = createAi3Service({ getRuntime: () => config, sourceReader: { require: unused }, knowledgePointReader: { read: unused },
    operationClient: { get: unused, put: unused }, mediaInspectClient: { inspect: unused },
    mediaReferenceClient: { prepare: unused }, mistakeEvidenceClient: { getContext: unused }, masteryEvidenceClient: { getContext: unused } });
});
afterEach(async () => {
  expect(unused).not.toHaveBeenCalled();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); server = null; }
});
const args = (extra = {}) => ({ identity: parent, roundId: String(round._id), ...extra });
const list = extra => service.listContents(args(extra));
const detail = (extra = {}) => service.getContent(args({ contentId: String(contents[0]._id), ...extra }));
const snapshot = async () => Object.fromEntries(await Promise.all(Object.entries(mongoose.connection.collections)
  .map(async ([name, collection]) => [name, plain(await collection.find({}).sort({ _id: 1 }).toArray())])));

test('paginated private version summaries are closed, descending and omit all bodies and reason', async () => {
  const before = await snapshot();
  const first = await list({ page: 1, pageSize: 2 }), second = await list({ page: 2, pageSize: 2 });
  expect(first).toMatchObject({ page: 1, pageSize: 2 }); expect(first.items.map(row => row.version)).toEqual([3, 2]);
  expect(second.items.map(row => row.version)).toEqual([1]);
  expect(await list({ page: 3, pageSize: 2 })).toEqual({ items: [], page: 3, pageSize: 2 });
  for (const row of [...first.items, ...second.items]) {
    expect(Object.keys(row).sort()).toEqual(summaryKeys);
    expect(row.createdAt).toBe(new Date(row.createdAt).toISOString());
  }
  expect(JSON.stringify(first)).not.toMatch(/PRIVATE_|Question|Private version/);
  expect((await list()).pageSize).toBe(20);
  expect(await snapshot()).toEqual(before);
});
test('historical detail retains its exact immutable body, reason and predecessor rather than current content', async () => {
  const before = await snapshot();
  const { content } = await detail({ contentId: String(contents[1]._id), identity: coparent });
  expect(Object.keys(content).sort()).toEqual([...summaryKeys, 'content', 'childSnapshot', 'reason'].sort());
  expect(content).toEqual({ id: String(contents[1]._id), roundId: String(round._id), version: 2,
    contentHash: contents[1].contentHash, childSnapshotHash: contents[1].childSnapshotHash,
    origin: 'parent_revision', derivedFromContentId: String(contents[0]._id), createdBy: coparent.id,
    createdAt: contents[1].createdAt.toISOString(), content: body(2), childSnapshot: C.childSnapshot(body(2)), reason: 'PRIVATE_REASON_2' });
  expect((await detail()).content.derivedFromContentId).toBeNull(); expect(await snapshot()).toEqual(before);
});
test.each(['parent_manual', 'ai_generation'])('first version supports the existing %s origin', async origin => {
  await M.Content.collection.updateOne({ _id: contents[0]._id }, { $set: { origin } });
  expect((await detail()).content.origin).toBe(origin);
});
test.each(['draft', 'rejected', 'cancelled', 'withdrawn', 'published'])('off history survives %s and a missing ancestor', async state => {
  config.enabled = false;
  const change = state === 'rejected' ? { preparation: 'rejected' } : state === 'cancelled' ? { cancelledAt: new Date(), active: false }
    : { visibility: state, ...(state === 'withdrawn' ? { active: false } : {}) };
  await M.Round.updateOne({ _id: round._id }, { $set: change });
  const before = await snapshot();
  expect((await list()).items).toHaveLength(3); expect((await detail()).content.content).toEqual(body(1));
  expect(await snapshot()).toEqual(before);
});
test('empty history remains an empty page; nonexistent content is not replaced with current content', async () => {
  await M.Content.deleteMany({ roundId: round._id });
  await M.Round.updateOne({ _id: round._id }, { $set: { currentContentId: null, currentContentVersion: null, currentContentHash: null } });
  expect(await list()).toEqual({ items: [], page: 1, pageSize: 20 });
  await expect(detail()).rejects.toMatchObject({ statusCode: 404, code: 'RESOURCE_NOT_FOUND' });
});
test.each(['child', 'sibling', 'outsider', 'anonymous'])('%s cannot read private content history', async role => {
  const identity = { child, sibling, outsider, anonymous: null }[role], statusCode = role === 'anonymous' ? 401 : role === 'outsider' ? 404 : 403;
  const before = await snapshot();
  await expect(list({ identity })).rejects.toMatchObject({ statusCode });
  await expect(detail({ identity })).rejects.toMatchObject({ statusCode });
  expect(await snapshot()).toEqual(before);
});
test.each(['member', 'child', 'actor'])('current %s access removal revokes both historical endpoints', async removed => {
  expect((await list({ identity: coparent })).items).toHaveLength(3);
  if (removed === 'member') await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: coparent.id } });
  if (removed === 'child') await Family.updateOne({ _id: family._id }, { $pull: { childIds: child.id } });
  if (removed === 'actor') await User.deleteOne({ _id: coparent.id });
  await expect(list({ identity: coparent })).rejects.toMatchObject({ statusCode: 403 });
  await expect(detail({ identity: coparent })).rejects.toMatchObject({ statusCode: 403 });
});
test('an isolated/default store fails closed and a real transaction is required', async () => {
  config.continuousStore = false;
  await expect(list()).rejects.toMatchObject({ statusCode: 503, code: 'AI3_STORE_ISOLATED' });
  await expect(detail()).rejects.toMatchObject({ statusCode: 503, code: 'AI3_STORE_ISOLATED' });
  const unconfigured = createAi3Service();
  await expect(unconfigured.listContents(args())).rejects.toMatchObject({ statusCode: 503, code: 'AI3_STORE_ISOLATED' });
  service = createAi3Service({ getRuntime: () => ({ enabled: false, continuousStore: true }), transactionRunner: work => work(null) });
  await expect(detail()).rejects.toMatchObject({ statusCode: 503, code: 'AI3_NOT_READY' });
});
test.each(['roundId', 'familyId', 'childId'])('content bound to another %s cannot be fetched under this round', async field => {
  await M.Content.collection.updateOne({ _id: contents[0]._id }, { $set: { [field]: new mongoose.Types.ObjectId() } });
  await expect(detail()).rejects.toMatchObject({ statusCode: 404, code: 'RESOURCE_NOT_FOUND' });
});
test.each(['bad', 'ABCDEFABCDEFABCDEFABCDEF', ''])('invalid content id %s returns 404', async contentId => {
  await expect(detail({ contentId })).rejects.toMatchObject({ statusCode: 404, code: 'RESOURCE_NOT_FOUND' });
});
test.each([
  ['content hash', { contentHash: 'f'.repeat(64) }],
  ['snapshot hash', { childSnapshotHash: 'f'.repeat(64) }],
  ['projection', { 'childSnapshot.instructions': 'Tampered private projection' }],
  ['body', { 'content.exercises.0.answerForParent': 'Tampered private answer' }],
  ['first origin', { origin: 'parent_revision' }],
  ['first predecessor', { derivedFromContentId: new mongoose.Types.ObjectId() }],
  ['timestamp', { createdAt: null }],
  ['creator', { createdBy: null }],
  ['reason', { reason: '' }]
])('corrupt %s is rejected without repair or private response', async (_name, change) => {
  await M.Content.collection.updateOne({ _id: contents[0]._id }, { $set: change });
  const before = await snapshot();
  await expect(detail()).rejects.toMatchObject({ statusCode: 503, code: 'AI3_NOT_READY' });
  await expect(list({ page: 3, pageSize: 1 })).rejects.toMatchObject({ statusCode: 503, code: 'AI3_NOT_READY' });
  expect(await snapshot()).toEqual(before);
});
test('a validly hashed body with the wrong round exercise count is still corrupt', async () => {
  const content = body(1); content.exercises.push({ ...content.exercises[0], exerciseId: 'q3' });
  const childSnapshot = C.childSnapshot(content);
  await M.Content.collection.updateOne({ _id: contents[0]._id }, { $set: { content, childSnapshot,
    contentHash: C.hash(content), childSnapshotHash: C.hash(childSnapshot) } });
  await expect(detail()).rejects.toMatchObject({ statusCode: 503, code: 'AI3_NOT_READY' });
});
test.each(['missing', 'cross-round', 'wrong-version', 'null'])('historical predecessor %s is not accepted as a valid version link', async fault => {
  if (fault === 'missing') await M.Content.deleteOne({ _id: contents[0]._id });
  if (fault === 'cross-round') await M.Content.collection.updateOne({ _id: contents[0]._id }, { $set: { roundId: new mongoose.Types.ObjectId() } });
  if (fault === 'wrong-version') await M.Content.collection.updateOne({ _id: contents[1]._id }, { $set: { derivedFromContentId: contents[2]._id } });
  if (fault === 'null') await M.Content.collection.updateOne({ _id: contents[1]._id }, { $set: { derivedFromContentId: null } });
  await expect(detail({ contentId: String(contents[1]._id) })).rejects.toMatchObject({ statusCode: 503, code: 'AI3_NOT_READY' });
});
test.each([[0, 20], [1, 101], [1.5, 20], ['1', 20], [Number.MAX_SAFE_INTEGER, 100]])('direct pagination %s/%s is closed', async (page, pageSize) => {
  await expect(list({ page, pageSize })).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
});

async function httpGet(path, identity = parent, signed = true) {
  if (!server) {
    const app = express(); app.locals.logger = { warn() {}, error() {} };
    app.use('/api/ai3', createAi3JsonParser(), createAi3Router({ service })); app.use(errorHandler);
    server = await new Promise((resolve, reject) => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); value.once('error', reject); });
  }
  return axios.get(`http://127.0.0.1:${server.address().port}${path}`, { proxy: false, maxRedirects: 0, timeout: 3000,
    validateStatus: () => true, headers: signed ? createIdentityHeaders({ method: 'GET', originalUrl: path,
      user: identity, secret: process.env.GATEWAY_IDENTITY_SECRET }) : {} });
}
const path = () => `/api/ai3/practice-rounds/${round._id}/contents`;
test('real HTTP exposes only parent summaries/details with no-store and leaves the database unchanged', async () => {
  config.enabled = false; const before = await snapshot();
  const result = await httpGet(`${path()}?page=2&pageSize=2`, coparent);
  expect(result.status).toBe(200); expect(result.headers['cache-control']).toBe('no-store');
  expect(result.data).toMatchObject({ success: true, data: { page: 2, pageSize: 2, items: [{ version: 1 }] } });
  expect(Object.keys(result.data.data.items[0]).sort()).toEqual(summaryKeys);
  const full = await httpGet(`${path()}/${contents[1]._id}`);
  expect(full.status).toBe(200); expect(full.data.data.content.content).toEqual(body(2));
  for (const [identity, signed, status] of [[parent, false, 401], [child, true, 403], [outsider, true, 404]]) {
    for (const url of [path(), `${path()}/${contents[0]._id}`]) {
      const denied = await httpGet(url, identity, signed);
      expect(denied.status).toBe(status); expect(denied.headers['cache-control']).toBe('no-store');
      expect(denied.data.success).toBe(false); expect(JSON.stringify(denied.data)).not.toMatch(/PRIVATE_|Question/);
    }
  }
  expect(await snapshot()).toEqual(before);
});
test.each(['childId=x', 'actorId=x', 'reason=x', 'page=0', 'page=01', 'page=1.5', 'pageSize=101',
  'page=1&page=2', 'page[]=1', 'page=9007199254740991&pageSize=100'])('HTTP list query %s is rejected', async query => {
  const result = await httpGet(`${path()}?${query}`);
  expect(result.status).toBe(400); expect(result.data.error.code).toBe('VALIDATION_ERROR');
});
test('HTTP detail rejects queries and corrupt historical content has a sanitized 503', async () => {
  const url = `${path()}/${contents[0]._id}`;
  expect((await httpGet(`${url}?page=1`)).status).toBe(400);
  await M.Content.collection.updateOne({ _id: contents[0]._id }, { $set: { contentHash: 'f'.repeat(64) } });
  const result = await httpGet(url);
  expect(result.status).toBe(503); expect(result.data.error).toEqual({ code: 'AI3_NOT_READY', message: 'AI3_NOT_READY', details: [] });
  expect(result.headers['cache-control']).toBe('no-store');
});

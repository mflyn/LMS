const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const express = require('express');
const axios = require('axios');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const A = require('../../models/Ai2');
const M = require('../../models/Ai3');
const C = require('../../services/ai3Contract');
const { createAi3MediaAccessRouter, checkAi3MediaAccess } = require('../../routes/ai3MediaAccess');
const id = () => String(new mongoose.Types.ObjectId());
const oid = value => new mongoose.Types.ObjectId(value);
const token = 'synthetic-ai3-media-access-service-credential';
let body, parent, coparent, sibling, outsider, family, round, ancestor, sourceAttempt, attempt;
const payloadHash = a => C.hash({ note: a.note, mediaIds: a.mediaIds.map(String), bindings: a.mediaBindings,
  submittedBy: String(a.submittedBy), attemptVersion: a.attemptVersion, serverContentBinding: a.serverContentBinding });
const parentBody = () => ({ ...body, actorId: parent, role: 'parent' });
const snapshot = async () => JSON.stringify(await Promise.all(
  [...Object.values(M), ...Object.values(A), Family, User].map(model => model.find().sort({ _id: 1 }).lean())));

beforeAll(async () => { for (const model of [...Object.values(M), ...Object.values(A), Family, User]) await model.init(); });
beforeEach(async () => {
  const childId = id(); parent = id(); coparent = id(); sibling = id(); outsider = id();
  family = await Family.create({ familyName: 'Synthetic AI3 media', ownerParentId: parent,
    memberParentIds: [parent, coparent], childIds: [childId, sibling] });
  const otherFamily = await Family.create({ familyName: 'Synthetic other family', ownerParentId: outsider, memberParentIds: [outsider] });
  await User.collection.insertMany([childId, sibling, parent, coparent, outsider].map(value => ({ _id: oid(value),
    username: value, role: [childId, sibling].includes(value) ? 'student' : 'parent',
    familyId: value === outsider ? otherFamily._id : family._id, childProfile: { tokenVersion: 0 } })));
  body = { familyId: String(family._id), childId, actorId: childId, role: 'student', mediaId: id(),
    bindings: [{ attemptId: id(), bindingOperationId: randomUUID() }] };
  ancestor = await A.Package.create({ familyId: family._id, childId, ai1CycleId: id(), source: { type: 'task', id: id() },
    artifact: {}, childSnapshot: {}, childSnapshotHash: C.hash({}), publishedBy: parent, publishedAt: new Date(),
    visibility: 'published', learningState: 'approved', stateVersion: 3 });
  const sourceId = id(), sourceMedia = id();
  const sourceFields = { note: '', mediaIds: [sourceMedia], bindings: [{ mediaId: sourceMedia,
    resourceType: 'ai2_attempt', resourceId: sourceId, field: 'correctionMediaIds', bindingOperationId: randomUUID() }],
  submittedBy: childId, attemptVersion: 1 };
  sourceAttempt = await A.Attempt.create({ _id: sourceId, familyId: family._id, childId, packageId: ancestor._id,
    submitCommandId: id(), submittedBy: childId, submittedAt: new Date(), note: '', mediaIds: [sourceMedia],
    mediaBindings: sourceFields.bindings, attemptVersion: 1, payloadHash: C.hash(sourceFields),
    review: { decision: 'approve', reviewerId: parent, reviewedAt: '2026-11-04T00:00:00.000Z' } });
  await A.Package.updateOne({ _id: ancestor._id }, { $set: { currentAttemptId: sourceAttempt._id, currentAttemptVersion: 1 } });
  round = await M.Round.create({ familyId: family._id, childId, sourcePackageId: ancestor._id,
    sourceAttemptId: sourceAttempt._id, sourceAttemptVersion: 1, sourceAttemptPayloadHash: sourceAttempt.payloadHash,
    sourceReviewHash: C.hash(sourceAttempt.review), source: ancestor.source, chapter: {}, exerciseCount: 2,
    createdBy: parent, stateVersion: 4, active: true, preparation: 'candidate', visibility: 'published', learningState: 'submitted' });
  const content = { instructions: 'Show working.', exercises: [
    { exerciseId: 'q1', questionText: '132 * 24', answerForParent: 'PRIVATE_3168', rubricForParent: 'PRIVATE_RUBRIC' },
    { exerciseId: 'q2', questionText: '203 * 31', answerForParent: 'PRIVATE_6293', rubricForParent: 'PRIVATE_RUBRIC' }
  ] };
  const childSnapshot = C.childSnapshot(content);
  const stored = await M.Content.create({ familyId: family._id, childId, roundId: round._id, version: 1,
    content, contentHash: C.hash(content), childSnapshot, childSnapshotHash: C.hash(childSnapshot),
    createdBy: parent, origin: 'parent_manual', reason: 'Synthetic fixture' });
  const serverContentBinding = { contentId: String(stored._id), contentVersion: 1,
    fullContentHash: stored.contentHash, childSnapshotHash: stored.childSnapshotHash };
  await M.Round.updateOne({ _id: round._id }, { $set: { currentContentId: stored._id, currentContentVersion: 1,
    currentContentHash: stored.contentHash, publication: { contentId: String(stored._id), contentVersion: 1,
      contentHash: stored.contentHash, childSnapshotHash: stored.childSnapshotHash, actorId: parent },
    publishedBy: parent, publishedAt: new Date() } });
  const row = { _id: body.bindings[0].attemptId, familyId: family._id, childId, roundId: round._id,
    submitCommandId: id(), submittedBy: childId, submittedAt: new Date(), note: 'Synthetic private note', attemptVersion: 1,
    serverContentBinding, mediaIds: [body.mediaId], mediaBindings: [{ mediaId: body.mediaId, resourceType: 'ai3_attempt',
      resourceId: body.bindings[0].attemptId, field: 'practiceMediaIds', bindingOperationId: body.bindings[0].bindingOperationId }] };
  attempt = await M.Attempt.create({ ...row, payloadHash: payloadHash(row) });
});

test('exact published binding allows child and current parents with no writes or answer DTO', async () => {
  const before = await snapshot();
  for (const query of [body, parentBody(), { ...parentBody(), actorId: coparent }]) {
    expect(await checkAi3MediaAccess(query)).toEqual({ allowed: true });
  }
  expect(await snapshot()).toBe(before);
});

test.each(['round', 'ancestor'])('%s withdrawal denies child but keeps authorized parent history, including off mode', async target => {
  await (target === 'round' ? M.Round : A.Package).updateOne({ _id: target === 'round' ? round._id : ancestor._id },
    { $set: { visibility: 'withdrawn' } });
  const old = process.env.AI3_MODE; process.env.AI3_MODE = 'off';
  try {
    const before = await snapshot();
    expect(await checkAi3MediaAccess(body)).toEqual({ allowed: false });
    expect(await checkAi3MediaAccess(parentBody())).toEqual({ allowed: true });
    expect(await snapshot()).toBe(before);
  } finally { if (old === undefined) delete process.env.AI3_MODE; else process.env.AI3_MODE = old; }
});

test.each([
  ['learningState', 'revise'], ['currentAttemptId', null], ['currentAttemptVersion', 2], ['activeCommandId', 'newId']
])('ancestor %s must still match the approved source', async (field, value) => {
  await A.Package.collection.updateOne({ _id: ancestor._id }, { $set: { [field]: value === 'newId' ? oid(id()) : value } });
  expect(await checkAi3MediaAccess(body)).toEqual({ allowed: false });
});

test.each([
  ['attemptVersion', 2], ['payloadHash', '0'.repeat(64)], ['review.decision', 'revise'], ['review.comment', 'Changed review'],
  ['familyId', 'newId'], ['childId', 'newId'], ['packageId', 'newId']
])('ancestor Attempt %s mismatch cannot authorize a child', async (field, value) => {
  await A.Attempt.collection.updateOne({ _id: sourceAttempt._id }, { $set: { [field]: value === 'newId' ? oid(id()) : value } });
  expect(await checkAi3MediaAccess(body)).toEqual({ allowed: false });
});

test.each(['sourceAttemptId', 'sourceAttemptVersion', 'sourceAttemptPayloadHash', 'sourceReviewHash'])(
  'Round exact ancestor snapshot %s is checked, not just approved state', async field => {
    const value = field.endsWith('Hash') ? '0'.repeat(64) : field === 'sourceAttemptVersion' ? 2 : oid(id());
    await M.Round.collection.updateOne({ _id: round._id }, { $set: { [field]: value } });
    expect(await checkAi3MediaAccess(body)).toEqual({ allowed: false });
  });

test('missing ancestor denies child but does not erase authorized parent history', async () => {
  await A.Package.deleteOne({ _id: ancestor._id });
  expect(await checkAi3MediaAccess(body)).toEqual({ allowed: false });
  expect(await checkAi3MediaAccess(parentBody())).toEqual({ allowed: true });
});

test('sibling, cross-family, wrong actor, absent media and wrong exact generation fail closed', async () => {
  for (const patch of [{ actorId: sibling }, { childId: sibling, actorId: sibling }, { familyId: id() },
    { actorId: outsider, role: 'parent' }, { actorId: id() }, { mediaId: id() },
    { bindings: [{ ...body.bindings[0], bindingOperationId: randomUUID() }] }]) {
    expect(await checkAi3MediaAccess({ ...body, ...patch })).toEqual({ allowed: false });
  }
});

test.each(['parentRemoved', 'childRemoved', 'childMoved', 'actorDeleted', 'roleChanged'])('current membership is required: %s', async change => {
  if (change === 'parentRemoved') await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: oid(id()), memberParentIds: [] } });
  if (change === 'childRemoved') await Family.updateOne({ _id: family._id }, { $set: { childIds: [sibling] } });
  if (change === 'childMoved') await User.collection.updateOne({ _id: oid(body.childId) }, { $set: { familyId: oid(id()) } });
  if (change === 'actorDeleted') await User.deleteOne({ _id: parent });
  if (change === 'roleChanged') await User.collection.updateOne({ _id: oid(parent) }, { $set: { role: 'student' } });
  expect(await checkAi3MediaAccess(parentBody())).toEqual({ allowed: false });
  if (['childRemoved', 'childMoved'].includes(change)) expect(await checkAi3MediaAccess(body)).toEqual({ allowed: false });
});

test('unknown bindings veto a legitimate binding in either order', async () => {
  const unknown = { attemptId: id(), bindingOperationId: randomUUID() };
  for (const bindings of [[...body.bindings, unknown], [unknown, ...body.bindings]]) {
    expect(await checkAi3MediaAccess({ ...body, bindings })).toEqual({ allowed: false });
  }
});

test.each(['withdrawn', 'ancestorWithdrawn'])(
  'known %s binding does not veto an independently published exact binding', async hidden => {
    const oldRound = await M.Round.findById(round._id).lean();
    const oldAttempt = await M.Attempt.findById(attempt._id).lean();
    const oldContent = await M.Content.findById(attempt.serverContentBinding.contentId).lean();
    await M.Round.updateOne({ _id: round._id }, { $set: { active: false,
      ...(hidden === 'withdrawn' ? { visibility: 'withdrawn' } : {}) } });
    const nextRoundId = oid(id()), nextAttemptId = id(), generation = randomUUID(), nextContentId = oid(id());
    const nextSource = await A.Package.create({ ...ancestor.toObject(), _id: oid(id()), ai1CycleId: id(),
      currentAttemptId: sourceAttempt._id, currentAttemptVersion: 1 });
    const nextSourceAttempt = await A.Attempt.create({ ...sourceAttempt.toObject(), _id: oid(id()),
      packageId: nextSource._id, submitCommandId: id() });
    await A.Package.updateOne({ _id: nextSource._id }, { $set: { currentAttemptId: nextSourceAttempt._id } });
    if (hidden === 'ancestorWithdrawn') await A.Package.updateOne({ _id: ancestor._id }, { $set: { visibility: 'withdrawn' } });
    await M.Content.create({ ...oldContent, _id: nextContentId, roundId: nextRoundId });
    await M.Round.create({ ...oldRound, _id: nextRoundId, sourcePackageId: nextSource._id,
      sourceAttemptId: nextSourceAttempt._id, currentContentId: nextContentId,
      publication: { ...oldRound.publication, contentId: String(nextContentId) } });
    const next = { ...oldAttempt, _id: nextAttemptId, roundId: nextRoundId, submitCommandId: id(),
      serverContentBinding: { ...oldAttempt.serverContentBinding, contentId: String(nextContentId) },
      mediaBindings: [{ ...oldAttempt.mediaBindings[0], resourceId: nextAttemptId, bindingOperationId: generation }] };
    await M.Attempt.create({ ...next, payloadHash: payloadHash(next) });
    const live = { attemptId: nextAttemptId, bindingOperationId: generation };
    for (const bindings of [[...body.bindings, live], [live, ...body.bindings]]) {
      expect(await checkAi3MediaAccess({ ...body, bindings })).toEqual({ allowed: true });
    }
    await M.Round.updateOne({ _id: nextRoundId }, { $set: { visibility: 'withdrawn' } });
    expect(await checkAi3MediaAccess({ ...body, bindings: [...body.bindings, live] })).toEqual({ allowed: false });
    expect(await checkAi3MediaAccess({ ...parentBody(), bindings: [...body.bindings, live] })).toEqual({ allowed: true });
  });

async function pendingMapping(phase) {
  const attemptId = id(), remoteOperationId = randomUUID(), stored = await M.Attempt.findById(attempt._id).lean();
  const payload = { schemaVersion: 'ai3-min-v1', operationId: randomUUID(), expectedRoundVersion: 4,
    contentId: stored.serverContentBinding.contentId, contentVersion: 1,
    childSnapshotHash: stored.serverContentBinding.childSnapshotHash, note: '', mediaIds: [body.mediaId] };
  const references = [{ mediaId: body.mediaId, resourceType: 'ai3_attempt', resourceId: attemptId,
    field: 'practiceMediaIds', bindingOperationId: remoteOperationId }];
  const command = await M.Command.create({ familyId: family._id, childId: body.childId, actorId: body.childId, roundId: round._id,
    endpointOperation: 'ai3.submit', operationId: payload.operationId, payload, attemptId, attemptVersion: 2,
    expectedRoundVersion: 4, reservedRoundVersion: 5, serverContentBinding: stored.serverContentBinding,
    remoteOperationId, references, referencesHash: C.hash({ familyId: body.familyId, childId: body.childId,
      resourceType: 'ai3_attempt', resourceId: attemptId, references, serverContentBinding: stored.serverContentBinding }),
    requestHash: C.requestHash('submit', `/api/ai3/practice-rounds/${round._id}/attempts`, payload), phase, resultReference: null });
  return { command, binding: { attemptId, bindingOperationId: remoteOperationId } };
}

test.each(['RESERVED', 'MEDIA_PREPARED', 'MEDIA_COMMITTED', 'RESOLVING', 'FAILED'])(
  'known %s mapping grants nothing and does not veto another legitimate binding', async phase => {
    const { command, binding } = await pendingMapping(phase);
    const before = await snapshot();
    for (const bindings of [[binding], [...body.bindings, binding], [binding, ...body.bindings]]) {
      expect(await checkAi3MediaAccess({ ...body, bindings })).toEqual({ allowed: bindings.length > 1 });
    }
    expect(await checkAi3MediaAccess({ ...parentBody(), bindings: [binding] })).toEqual({ allowed: false });
    expect(await snapshot()).toBe(before);
    await M.Command.collection.updateOne({ _id: command._id }, { $set: { referencesHash: '0'.repeat(64) } });
    expect(await checkAi3MediaAccess({ ...body, bindings: [...body.bindings, binding] })).toEqual({ allowed: false });
  });

test.each(['roundId', 'familyId', 'childId', 'actorId', 'remoteOperationId', 'requestHash', 'serverContentBinding.fullContentHash'])(
  'unpublished mapping corrupt %s cannot be ignored', async field => {
    const { command, binding } = await pendingMapping('MEDIA_COMMITTED');
    const value = field.endsWith('Hash') ? '0'.repeat(64) : field === 'remoteOperationId' ? randomUUID() : oid(id());
    await M.Command.collection.updateOne({ _id: command._id }, { $set: { [field]: value } });
    expect(await checkAi3MediaAccess({ ...body, bindings: [...body.bindings, binding] })).toEqual({ allowed: false });
  });

test('SUCCEEDED command without its Attempt is unknown, not an unpublished exception', async () => {
  const { command, binding } = await pendingMapping('MEDIA_COMMITTED');
  await M.Command.updateOne({ _id: command._id }, { $set: { phase: 'SUCCEEDED' } });
  expect(await checkAi3MediaAccess({ ...body, bindings: [...body.bindings, binding] })).toEqual({ allowed: false });
});

test('rehashed unpublished mapping with an extra reference field is still unknown', async () => {
  const { command, binding } = await pendingMapping('RESOLVING');
  const references = command.references.map(ref => ({ ...ref, unexpected: true }));
  const referencesHash = C.hash({ familyId: body.familyId, childId: body.childId,
    resourceType: 'ai3_attempt', resourceId: binding.attemptId, references, serverContentBinding: command.serverContentBinding });
  await M.Command.collection.updateOne({ _id: command._id }, { $set: { references, referencesHash } });
  expect(await checkAi3MediaAccess({ ...body, bindings: [...body.bindings, binding] })).toEqual({ allowed: false });
});

test.each(['familyId', 'childId'])('each persisted Round must have exact %s scope', async field => {
  await M.Round.collection.updateOne({ _id: round._id }, { $set: { [field]: oid(id()) } });
  expect(await checkAi3MediaAccess(body)).toEqual({ allowed: false });
  expect(await checkAi3MediaAccess(parentBody())).toEqual({ allowed: false });
});

test.each(['familyId', 'childId', 'roundId'])('each persisted Content must have exact %s scope', async field => {
  await M.Content.collection.updateOne({ _id: oid(attempt.serverContentBinding.contentId) }, { $set: { [field]: oid(id()) } });
  expect(await checkAi3MediaAccess(body)).toEqual({ allowed: false });
});

test.each([
  ['payloadHash', '0'.repeat(64)], ['note', 'tampered'], ['mediaIds', []], ['mediaBindings', []],
  ['serverContentBinding', null], ['attemptVersion', 0], ['submittedBy', 'newId'], ['roundId', 'newId'],
  ['familyId', 'newId'], ['childId', 'newId']
])('corrupt persisted Attempt %s cannot authorize even a parent', async (field, value) => {
  await M.Attempt.collection.updateOne({ _id: attempt._id }, { $set: { [field]: value === 'newId' ? oid(id()) : value } });
  expect(await checkAi3MediaAccess(parentBody())).toEqual({ allowed: false });
});

test.each(['wrongType', 'wrongField', 'extraBindingKey', 'extraContentKey', 'wrongContentHash', 'duplicateMedia', 'badNote', 'noncanonicalNote'])(
  'rehashed noncanonical Attempt %s remains unauthorized', async change => {
    const row = await M.Attempt.findById(attempt._id).lean();
    if (change === 'wrongType') row.mediaBindings[0].resourceType = 'ai2_attempt';
    if (change === 'wrongField') row.mediaBindings[0].field = 'correctionMediaIds';
    if (change === 'extraBindingKey') row.mediaBindings[0].extra = true;
    if (change === 'extraContentKey') row.serverContentBinding.extra = true;
    if (change === 'wrongContentHash') row.serverContentBinding.fullContentHash = '0'.repeat(64);
    if (change === 'duplicateMedia') { row.mediaIds.push(row.mediaIds[0]); row.mediaBindings.push(row.mediaBindings[0]); }
    if (change === 'badNote') row.note = 'x'.repeat(1001);
    if (change === 'noncanonicalNote') row.note = 'a\r\nb';
    row.payloadHash = payloadHash(row);
    await M.Attempt.collection.replaceOne({ _id: row._id }, row);
    expect(await checkAi3MediaAccess(body)).toEqual({ allowed: false });
  });

test.each(['publication.contentHash', 'publication.childSnapshotHash', 'currentContentHash'])(
  'round %s must agree with the immutable Attempt content binding', async field => {
    await M.Round.collection.updateOne({ _id: round._id }, { $set: { [field]: '0'.repeat(64) } });
    expect(await checkAi3MediaAccess(body)).toEqual({ allowed: false });
  });

test('corrupt stored Content projection does not authorize media', async () => {
  await M.Content.collection.updateOne({ _id: oid(attempt.serverContentBinding.contentId) },
    { $set: { 'childSnapshot.instructions': 'PRIVATE_ANSWER' } });
  expect(await checkAi3MediaAccess(body)).toEqual({ allowed: false });
});

test('closed request shape rejects sparse, duplicate, over-limit and extra fields', async () => {
  for (const bindings of [[], new Array(1), [...body.bindings, ...body.bindings], Array(101).fill(body.bindings[0]),
    [{ ...body.bindings[0], field: 'practiceMediaIds' }], [{ ...body.bindings[0], bindingOperationId: 'not-uuid' }]]) {
    await expect(checkAi3MediaAccess({ ...body, bindings })).rejects.toMatchObject({ statusCode: 400 });
  }
  for (const value of [{ ...body, tokenVersion: 0 }, { ...body, actor: {} }, { ...body, role: 'admin' }, null]) {
    await expect(checkAi3MediaAccess(value)).rejects.toMatchObject({ statusCode: 400 });
  }
});

test('internal router cannot be constructed without a sufficiently long service credential', () => {
  for (const serviceToken of [undefined, '', 'short', 123]) {
    expect(() => createAi3MediaAccessRouter({ serviceToken })).toThrow(TypeError);
  }
});

test('real internal HTTP requires credential, stays readonly and returns only no-store boolean DTO', async () => {
  const app = express(); app.use(express.json({ limit: 32768 }));
  app.use('/api/internal/ai3', createAi3MediaAccessRouter({ serviceToken: token }));
  const server = await new Promise((resolve, reject) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject); });
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/internal/ai3/media-access-check`;
    const post = (suffix, value, headers = { 'x-service-token': token }) => axios.post(url + suffix, value,
      { headers, proxy: false, validateStatus: () => true });
    const before = await snapshot();
    for (const headers of [{}, { Authorization: 'Bearer synthetic-user-token' }, { 'x-service-token': 'incorrect' }]) {
      const response = await post('', body, headers);
      expect(response.status).toBe(401);
      expect(response.data).toEqual({ success: false, error: { code: 'INVALID_SERVICE_CREDENTIAL', message: 'INVALID_SERVICE_CREDENTIAL', details: [] } });
    }
    expect((await post('?actorId=forged', body)).status).toBe(400);
    expect((await post('', { ...body, tokenVersion: 0 })).status).toBe(400);
    expect((await axios.get(url, { proxy: false, validateStatus: () => true })).status).toBe(404);
    expect((await axios.post(url.replace('/api/internal/ai3/', '/api/ai3/'), body,
      { headers: { 'x-service-token': token }, proxy: false, validateStatus: () => true })).status).toBe(404);
    const response = await post('', body);
    expect(response.status).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
    expect(response.data).toEqual({ success: true, data: { allowed: true } });
    const denied = await post('', { ...body, actorId: sibling });
    expect(denied.data).toEqual({ success: true, data: { allowed: false } });
    expect(JSON.stringify([response.data, denied.data])).not.toMatch(/PRIVATE_|payloadHash|contentHash|note|storage|url/i);
    expect(await snapshot()).toBe(before);
    const spy = jest.spyOn(A.Package, 'findOne').mockImplementationOnce(() => { throw Error('PRIVATE_DATABASE_ERROR'); });
    try {
      const failed = await post('', body);
      expect(failed.status).toBe(503);
      expect(failed.data).toEqual({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'SERVICE_UNAVAILABLE', details: [] } });
    } finally { spy.mockRestore(); }
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

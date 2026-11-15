const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const express = require('express');
const axios = require('axios');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const M = require('../../models/Ai2');
const C = require('../../services/ai2Contract');
const { createAi2MediaAccessRouter, checkAi2MediaAccess } = require('../../routes/ai2MediaAccess');
const id = () => String(new mongoose.Types.ObjectId());
const token = 'synthetic-ai2-media-reference-token-32-bytes';
let body, packageId, attemptId, parent, family;
beforeAll(async () => { for (const model of [...Object.values(M), Family, User]) await model.init(); });
beforeEach(async () => {
  const childId = id(); parent = id(); packageId = id(); attemptId = id();
  family = await Family.create({ familyName: 'Synthetic access', ownerParentId: parent, memberParentIds: [parent], childIds: [childId] });
  await User.collection.insertMany([{ _id: new mongoose.Types.ObjectId(childId), username: childId, email: `${childId}@example.test`, role: 'student', familyId: family._id },
    { _id: new mongoose.Types.ObjectId(parent), username: parent, email: `${parent}@example.test`, role: 'parent' }]);
  body = { familyId: String(family._id), childId, actorId: childId, role: 'student', mediaId: id(),
    bindings: [{ attemptId, bindingOperationId: randomUUID() }] };
  await M.Package.create({ _id: packageId, familyId: family._id, childId, ai1CycleId: id(), source: {}, artifact: {}, childSnapshot: {},
    childSnapshotHash: C.hash({}), publishedBy: parent, publishedAt: new Date(), visibility: 'published', learningState: 'submitted', stateVersion: 1 });
  const fields = { note: '', mediaIds: [body.mediaId], bindings: [{ mediaId: body.mediaId, resourceType: 'ai2_attempt',
    resourceId: attemptId, field: 'correctionMediaIds', bindingOperationId: body.bindings[0].bindingOperationId }], submittedBy: childId, attemptVersion: 1 };
  await M.Attempt.create({ _id: attemptId, familyId: family._id, childId, packageId, submitCommandId: id(),
    submittedBy: childId, submittedAt: new Date(), note: '', mediaIds: fields.mediaIds, mediaBindings: fields.bindings,
    attemptVersion: 1, payloadHash: C.hash(fields) });
});
test('published submitted exact binding is readable; withdrawal denies child and preserves parent historical access, all reads zero-write', async () => {
  const snapshot = async () => JSON.stringify(await Promise.all(Object.values(M).map(model => model.find().lean())));
  const before = await snapshot(); expect(await checkAi2MediaAccess(body)).toEqual({ allowed: true });
  expect(await snapshot()).toBe(before);
  await M.Package.updateOne({ _id: packageId }, { $set: { visibility: 'withdrawn' } });
  expect(await checkAi2MediaAccess(body)).toEqual({ allowed: false });
  expect(await checkAi2MediaAccess({ ...body, actorId: parent, role: 'parent' })).toEqual({ allowed: true });
});
test('prepared/missing attempt, wrong generation, sibling, cross-family and removed membership never grant access', async () => {
  for (const changed of [{ ...body, bindings: [{ attemptId: id(), bindingOperationId: body.bindings[0].bindingOperationId }] },
    { ...body, bindings: [{ attemptId, bindingOperationId: randomUUID() }] }, { ...body, childId: id() },
    { ...body, familyId: id() }, { ...body, actorId: id() }, { ...body, mediaId: id() }]) {
    expect(await checkAi2MediaAccess(changed)).toEqual({ allowed: false });
  }
  await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: new mongoose.Types.ObjectId(), memberParentIds: [] } });
  expect(await checkAi2MediaAccess({ ...body, actorId: parent, role: 'parent' })).toEqual({ allowed: false });
});
test('malformed reference set or corrupted Attempt never partially authorizes', async () => {
  for (const bindings of [[], new Array(1), [...body.bindings, ...body.bindings], Array(101).fill(body.bindings[0])]) {
    await expect(checkAi2MediaAccess({ ...body, bindings })).rejects.toMatchObject({ statusCode: 400 });
  }
  await expect(checkAi2MediaAccess({ ...body, tokenVersion: 0 })).rejects.toMatchObject({ statusCode: 400 });
  expect(await checkAi2MediaAccess({ ...body, bindings: [...body.bindings, { attemptId: id(), bindingOperationId: randomUUID() }] })).toEqual({ allowed: false });
  await M.Attempt.collection.updateOne({ _id: new mongoose.Types.ObjectId(attemptId) }, { $set: { payloadHash: '0'.repeat(64) } });
  expect(await checkAi2MediaAccess(body)).toEqual({ allowed: false });
});
test('one withdrawn historical binding does not hide a different exact published Attempt for the same image', async () => {
  const original = await M.Attempt.findById(attemptId).lean();
  const originalPackage = await M.Package.findById(packageId).lean();
  await M.Package.updateOne({ _id: packageId }, { $set: { visibility: 'withdrawn' } });
  const nextPackage = id(), nextAttempt = id(), generation = randomUUID();
  await M.Package.create({ ...originalPackage, _id: nextPackage, ai1CycleId: id(), visibility: 'published' });
  const bindings = [{ ...original.mediaBindings[0], resourceId: nextAttempt, bindingOperationId: generation }];
  await M.Attempt.create({ ...original, _id: nextAttempt, packageId: nextPackage, submitCommandId: id(), mediaBindings: bindings,
    payloadHash: C.hash({ note: original.note, mediaIds: original.mediaIds.map(String), bindings,
      submittedBy: String(original.submittedBy), attemptVersion: original.attemptVersion }) });
  const query = { ...body, bindings: [...body.bindings, { attemptId: nextAttempt, bindingOperationId: generation }] };
  expect(await checkAi2MediaAccess(query)).toEqual({ allowed: true });
  await M.Package.updateOne({ _id: nextPackage }, { $set: { visibility: 'withdrawn' } });
  expect(await checkAi2MediaAccess(query)).toEqual({ allowed: false });
});
test.each(['MEDIA_COMMITTED', 'RESOLVING', 'FAILED'])('known %s unpublished mapping is not authority and does not veto another legitimate published binding', async phase => {
  const pendingAttempt = id(), remoteOperationId = randomUUID(), pendingPackage = id();
  const existingPackage = await M.Package.findById(packageId).lean();
  await M.Package.create({ ...existingPackage, _id: pendingPackage, ai1CycleId: id(), visibility: 'withdrawn' });
  const payload = { schemaVersion: 'ai2-min-v1', operationId: randomUUID(), expectedPackageVersion: 1, note: '', mediaIds: [body.mediaId] };
  const references = [{ mediaId: body.mediaId, resourceType: 'ai2_attempt', resourceId: pendingAttempt,
    field: 'correctionMediaIds', bindingOperationId: remoteOperationId }];
  const c = await M.Command.create({ familyId: family._id, childId: body.childId, actorId: body.childId, packageId: pendingPackage,
    endpointOperation: 'ai2.submit', operationId: payload.operationId, payload, attemptId: pendingAttempt, attemptVersion: 1,
    remoteOperationId, references, referencesHash: C.hash({ familyId: body.familyId, childId: body.childId,
      resourceType: 'ai2_attempt', resourceId: pendingAttempt, references }),
    requestHash: C.requestHash('submit', `/api/ai2/learning-packages/${pendingPackage}/attempts`, payload), phase });
  const pending = { attemptId: pendingAttempt, bindingOperationId: remoteOperationId };
  expect(await checkAi2MediaAccess({ ...body, bindings: [...body.bindings, pending] })).toEqual({ allowed: true });
  expect(await checkAi2MediaAccess({ ...body, bindings: [pending, ...body.bindings] })).toEqual({ allowed: true });
  expect(await checkAi2MediaAccess({ ...body, bindings: [pending] })).toEqual({ allowed: false });
  await M.Command.updateOne({ _id: c._id }, { $set: { referencesHash: '0'.repeat(64) } });
  expect(await checkAi2MediaAccess({ ...body, bindings: [...body.bindings, pending] })).toEqual({ allowed: false });
});
test('internal HTTP requires service credential, rejects query/body extras and leaks no package or body', async () => {
  const app = express(); app.use(express.json({ limit: 32768 }));
  app.use('/api/internal/ai2', createAi2MediaAccessRouter({ serviceToken: token }));
  const server = await new Promise((resolve, reject) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject); });
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/internal/ai2/media-access-check`;
    const post = (suffix, value, headers = {}) => axios.post(url + suffix, value, { headers, proxy: false, validateStatus: () => true });
    expect((await post('', body, { Authorization: 'Bearer synthetic-not-service-token' })).status).toBe(401);
    expect((await post('?actorId=x', body, { 'x-service-token': token })).status).toBe(400);
    const result = await post('', body, { 'x-service-token': token });
    expect(result.status).toBe(200); expect(result.data).toEqual({ success: true, data: { allowed: true } });
    expect(result.headers['cache-control']).toBe('no-store');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

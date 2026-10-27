process.env.GATEWAY_IDENTITY_SECRET = 'synthetic-learning-source-identity-32chars';
const mongoose = require('mongoose');
const express = require('express');
const { createProductionApp } = require('../../server');
const { createHttpTestHarness } = require('../../../../common/test/httpTestHarness');
const { createLearningSourceRouter } = require('../../../../common/services/learningSource');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');
const { parseGrowthTaskCreate, parseGrowthTaskPatch } = require('../../services/growthTaskPatch');
const Task = require('../../models/GrowthTask');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const Mistake = require('../../../analytics-service/models/FamilyMistake');
const { request, close } = createHttpTestHarness();
afterEach(close);
const id = () => String(new mongoose.Types.ObjectId());
let parent, child, sibling, family;
const base = () => ({ childId: child, dimension: 'academic', title: 'Synthetic correction',
  taskType: 'correction', dueDate: '2026-10-27' });
const headers = () => createIdentityHeaders({ user: { id: parent, role: 'parent' },
  secret: process.env.GATEWAY_IDENTITY_SECRET, method: 'POST', originalUrl: '/api/growth-tasks'
});
const env = () => ({ ...process.env, COMPLETION_PROTOCOL_MODE: 'enabled',
  RESOURCE_SERVICE_URL: 'http://127.0.0.1:1', MEDIA_REFERENCE_SERVICE_TOKEN: 'synthetic-source-media-token-32chars',
  COMPLETION_RETIREMENT_SERVICE_TOKEN: 'synthetic-source-retirement-token-32chars',
  PROGRESS_SERVICE_URL: 'http://127.0.0.1:1', INTERNAL_SERVICE_TOKEN: 'synthetic-source-internal-token-32chars' });
beforeEach(async () => {
  parent = id(); child = id(); sibling = id();
  family = await Family.create({ familyName: 'Synthetic source', ownerParentId: parent,
    memberParentIds: [parent], childIds: [child, sibling] });
  await User.collection.insertMany([{ _id: new mongoose.Types.ObjectId(parent), role: 'parent', username: parent, email: parent + '@example.test' },
    ...[child, sibling].map(value => ({ _id: new mongoose.Types.ObjectId(value), username: value, email: value + '@example.test', role: 'student', familyId: family._id,
      childProfile: { tokenVersion: 0 } }))]);
});
test('source creation parser preserves source and refuses malformed or editable sources', () => {
  const sourceTaskId = id();
  expect(parseGrowthTaskCreate({ ...base(), sourceTaskId }).taskInput.sourceTaskId).toBe(sourceTaskId);
  expect(parseGrowthTaskCreate({ ...base(), sourceMistakeId: sourceTaskId }).taskInput.sourceMistakeId).toBe(sourceTaskId);
  for (const fields of [{ sourceTaskId: null }, { sourceTaskId: sourceTaskId + '\n' },
    { sourceTaskId, sourceMistakeId: sourceTaskId }]) expect(() => parseGrowthTaskCreate({ ...base(), ...fields })).toThrow();
  expect(() => parseGrowthTaskPatch({ sourceTaskId })).toThrow();
  expect(() => parseGrowthTaskPatch({ sourceMistakeId: sourceTaskId })).toThrow();
});
test('enabled formal create persists source, detail resolves it, source deletion degrades without changing task', async () => {
  const source = await Task.create({ ...base(), familyId: family._id, createdByParentId: parent });
  const client = await request(createProductionApp({ env: env() }));
  const response = await client.post('/api/growth-tasks').set(headers()).send({ ...base(), sourceTaskId: String(source._id) });
  expect(response.status).toBe(201);
  const created = response.body.data.task;
  expect(created.sourceTaskId).toBe(String(source._id));
  const detail = async () => {
    const path = `/api/growth-tasks/${created.taskId}`;
    return client.get(path).set(createIdentityHeaders({ user: { id: parent, role: 'parent' },
      secret: process.env.GATEWAY_IDENTITY_SECRET, method: 'GET', originalUrl: path
    }));
  };
  const found = await detail();
  expect(found.status).toBe(200);
  expect(found.body.data.task).toMatchObject({ sourceAvailable: true, source: { id: String(source._id), subject: '' } });
  await Task.deleteOne({ _id: source._id });
  const absent = await detail();
  expect(absent.status).toBe(200);
  expect(absent.body.data.task).toMatchObject({ sourceAvailable: false, source: null, status: 'pending' });
});
test('sibling and absent sources share exact 404; source-service failure never creates a task', async () => {
  const source = await Task.create({ ...base(), childId: sibling, familyId: family._id, createdByParentId: parent });
  const client = await request(createProductionApp({ env: env() }));
  const bodies = [];
  for (const sourceTaskId of [String(source._id), id()]) {
    const response = await client.post('/api/growth-tasks').set(headers()).send({ ...base(), sourceTaskId });
    expect(response.status).toBe(404);
    const { requestId, ...body } = response.body;
    expect(requestId).toEqual(expect.any(String));
    bodies.push(body);
  }
  expect(bodies[0]).toEqual(bodies[1]);
  const failed = await client.post('/api/growth-tasks').set(headers()).send({ ...base(), sourceMistakeId: id() });
  expect(failed.status).toBe(503);
  expect(failed.body.error.code).toBe('SOURCE_SERVICE_UNAVAILABLE');
  expect(await Task.countDocuments({})).toBe(1);
});

test('remote mistake source uses authorized HTTP scope and distinguishes missing detail from outage without writes', async () => {
  const source = await Mistake.create({ familyId: family._id, childId: child,
    subject: 'math', knowledgePointName: 'Synthetic fractions', reason: 'concept',
    createdBy: parent, updatedBy: parent, parentNote: 'private-source-sentinel' });
  const sourceMistakeId = String(source._id), sourceEnv = env();
  let outage = false, reads = 0;
  const upstream = express();
  upstream.use((req, res, next) => {
    reads += 1;
    if (outage) return res.status(503).json({ privateUpstream: 'private-outage-sentinel' });
    return next();
  });
  upstream.use('/api/internal/learning-sources', createLearningSourceRouter({
    kind: 'mistakes', Model: Mistake, serviceToken: sourceEnv.INTERNAL_SERVICE_TOKEN
  }));
  const remote = await request(upstream);
  sourceEnv.ANALYTICS_SERVICE_URL = `http://127.0.0.1:${remote.get('/health').app.address().port}`;
  const client = await request(createProductionApp({ env: sourceEnv }));
  const send = (method, path, body) => {
    const req = client[method.toLowerCase()](path).set(createIdentityHeaders({
      user: { id: parent, role: 'parent' }, secret: process.env.GATEWAY_IDENTITY_SECRET,
      method, originalUrl: path
    }));
    return body === undefined ? req : req.send(body);
  };
  const denied = await send('POST', '/api/growth-tasks', { ...base(), childId: id(), sourceMistakeId });
  expect(denied.status).toBe(403);
  expect(reads).toBe(0);
  expect(await Task.countDocuments()).toBe(0);
  const wrongScope = await send('POST', '/api/growth-tasks', { ...base(), childId: sibling, sourceMistakeId });
  expect(wrongScope.status).toBe(404);
  expect(wrongScope.body.error.code).toBe('RESOURCE_NOT_FOUND');
  expect(reads).toBe(1);
  expect(await Task.countDocuments()).toBe(0);

  const created = await send('POST', '/api/growth-tasks', { ...base(), sourceMistakeId });
  expect(created.status).toBe(201);
  expect(created.body.data.task.sourceMistakeId).toBe(sourceMistakeId);
  expect(created.body.data.task).not.toHaveProperty('source');
  const taskId = created.body.data.task.taskId, path = `/api/growth-tasks/${taskId}`;
  expect(String((await Task.findById(taskId)).sourceMistakeId)).toBe(sourceMistakeId);
  expect(reads).toBe(2);
  const beforeDetail = await Task.collection.findOne({ _id: new mongoose.Types.ObjectId(taskId) });
  const detail = await send('GET', path);
  expect(detail.status).toBe(200);
  expect(detail.body.data.task).toMatchObject({ sourceMistakeId, sourceAvailable: true });
  expect(detail.body.data.task.source).toEqual({ id: sourceMistakeId, familyId: String(family._id),
    childId: child, subject: 'math', title: 'Synthetic fractions' });
  expect(JSON.stringify(detail.body)).not.toContain('private-source-sentinel');
  expect(await Task.collection.findOne({ _id: beforeDetail._id })).toEqual(beforeDetail);
  expect(reads).toBe(3);

  outage = true;
  const listed = await send('GET', `/api/growth-tasks?childId=${child}`);
  expect(listed.status).toBe(200);
  expect(listed.body.data.items).toHaveLength(1);
  expect(listed.body.data.items[0].sourceMistakeId).toBe(sourceMistakeId);
  expect(listed.body.data.items[0]).not.toHaveProperty('sourceAvailable');
  const patched = await send('PATCH', path, { title: 'Independent correction edit' });
  expect(patched.status).toBe(200);
  expect(patched.body.data.task.sourceMistakeId).toBe(sourceMistakeId);
  expect(patched.body.data.task).not.toHaveProperty('source');
  expect(reads).toBe(3);
  const beforeOutage = await Task.collection.findOne({ _id: beforeDetail._id });
  const failed = await send('GET', path);
  expect(failed.status).toBe(503);
  expect(failed.body.error).toEqual({ code: 'SOURCE_SERVICE_UNAVAILABLE',
    message: 'SOURCE_SERVICE_UNAVAILABLE', details: [] });
  expect(failed.body).not.toHaveProperty('data');
  expect(JSON.stringify(failed.body)).not.toContain('private-outage-sentinel');
  expect(await Task.collection.findOne({ _id: beforeDetail._id })).toEqual(beforeOutage);
  expect(reads).toBe(4);

  outage = false;
  await Mistake.deleteOne({ _id: source._id });
  const missing = await send('GET', path);
  expect(missing.status).toBe(200);
  expect(missing.body.data.task).toMatchObject({ sourceMistakeId, sourceAvailable: false, source: null });
  expect(await Task.collection.findOne({ _id: beforeDetail._id })).toEqual(beforeOutage);
  expect(await Task.countDocuments()).toBe(1);
  expect(reads).toBe(5);
});

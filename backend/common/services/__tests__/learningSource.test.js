const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const { AppError } = require('../../middleware/errorTypes');
const { createHttpTestHarness } = require('../../test/httpTestHarness');
const { createLearningSourceReader, createLearningSourceRouter, parseLearningSource,
  sourceProjection } = require('../learningSource');

const { request, close } = createHttpTestHarness();
afterEach(close);
const ids = { familyId: 'a'.repeat(24), childId: 'b'.repeat(24), id: 'c'.repeat(24) };
const token = 'synthetic-learning-source-token-32-characters';
const source = { ...ids, subject: 'math', title: 'Synthetic task' };
const query = { familyId: ids.familyId, childId: ids.childId };
const input = { ...query, sourceTaskId: ids.id };
const row = { _id: ids.id, ...query, subject: 'math', title: 'Synthetic task', completionMediaIds: ['private'] };
const model = value => ({ findOne: jest.fn(() => ({ select: jest.fn().mockReturnValue({ lean: async () => value }) })) });
const remote = get => createLearningSourceReader({ taskUrl: 'http://homework.test', mistakeUrl: 'http://analytics.test',
  serviceToken: token, axiosInstance: { get } });

test('source inputs are optional, canonical and mutually exclusive', () => {
  expect(parseLearningSource({})).toEqual({});
  expect(parseLearningSource({ sourceTaskId: ids.id.toUpperCase() })).toEqual({ sourceTaskId: ids.id });
  for (const body of [{ sourceTaskId: null }, { sourceTaskId: '' }, { sourceTaskId: ids.id + '\n' },
    { sourceTaskId: {} }, { sourceTaskId: ids.id, sourceMistakeId: ids.id }]) {
    expect(() => parseLearningSource(body)).toThrow('VALIDATION_ERROR');
  }
});

test('local source uses a single scoped query and never returns private fields', async () => {
  const TaskModel = model(row);
  const reader = createLearningSourceReader({ TaskModel });
  expect(await reader.require(input)).toEqual(source);
  expect(TaskModel.findOne.mock.calls).toEqual([[{ _id: ids.id, ...query }]]);
  expect(sourceProjection(row)).toEqual({});
  expect(sourceProjection({ sourceTaskId: ids.id })).toEqual({ sourceTaskId: ids.id });
});

test('absent/cross-scope sources share the same error, detail alone returns unavailable', async () => {
  const TaskModel = model(null), reader = createLearningSourceReader({ TaskModel });
  await expect(reader.require(input)).rejects.toMatchObject({ status: 404, code: 'RESOURCE_NOT_FOUND', message: 'RESOURCE_NOT_FOUND' });
  expect(await reader.describe(input)).toEqual({ sourceAvailable: false, source: null });
  expect(await reader.describe(query)).toEqual({});
  expect(TaskModel.findOne).toHaveBeenCalledTimes(2);
});

test('remote response checks scope and uses bounded credentialed GET without redirects', async () => {
  const get = jest.fn().mockResolvedValue({ status: 200, data: { success: true, data: { source } } });
  expect(await remote(get).require(input)).toEqual(source);
  expect(get).toHaveBeenCalledWith(`http://homework.test/api/internal/learning-sources/tasks/${ids.id}`,
    expect.objectContaining({ params: query, timeout: 3000, maxRedirects: 0, headers: { 'x-service-token': token } }));
});

test.each([
  { status: 200, data: { success: true, data: { source: { ...source, childId: 'd'.repeat(24) } } } },
  { status: 200, data: { success: true, data: { source: { ...source, id: 'd'.repeat(24) } } } },
  { status: 200, data: { success: true, data: { source: { ...source, title: {} } } } },
  { status: 200, data: { success: true, data: { source: { ...source, media: 'private' } } } },
  { status: 200, data: { success: false, data: { source } } },
  { status: 404, data: { error: { code: 'unrelated' } } },
  { status: 401 }, { status: 503 }
])('malformed or unsuccessful remote response fails closed (%#)', async response => {
  await expect(remote(async () => response).describe(input)).rejects.toMatchObject({ status: 503, code: 'SOURCE_SERVICE_UNAVAILABLE' });
});

test('network errors and missing configuration are sanitized, valid 404 is unavailable', async () => {
  const get = jest.fn().mockRejectedValue(new Error('private-secret-url'));
  await expect(remote(get).require(input)).rejects.toThrow('SOURCE_SERVICE_UNAVAILABLE');
  expect(get).toHaveBeenCalledTimes(1);
  await expect(createLearningSourceReader().require(input)).rejects.toThrow('SOURCE_SERVICE_UNAVAILABLE');
  const reader = remote(async () => ({ status: 404, data: { success: false,
    error: { code: 'RESOURCE_NOT_FOUND', message: 'RESOURCE_NOT_FOUND', details: [] } } }));
  expect(await reader.describe(input)).toEqual({ sourceAvailable: false, source: null });
});

test('internal endpoint authenticates before query and returns only minimal data', async () => {
  const TaskModel = model(row), app = express();
  app.use('/api/internal/learning-sources', createLearningSourceRouter({ kind: 'tasks', Model: TaskModel, serviceToken: token }));
  const path = `/api/internal/learning-sources/tasks/${ids.id}`;
  expect((await (await request(app)).get(path).query(query)).status).toBe(401);
  expect(TaskModel.findOne).not.toHaveBeenCalled();
  const response = await (await request(app)).get(path).query(query).set('x-service-token', token);
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ success: true, data: { source } });
  expect((await (await request(app)).get(path).query({ ...query, actorId: ids.id }).set('x-service-token', token)).status).toBe(400);
});

test('internal missing/foreign source is indistinguishable and no token config denies', async () => {
  const app = express(), Model = model(null);
  app.use(createLearningSourceRouter({ kind: 'mistakes', Model, serviceToken: token }));
  const response = await (await request(app)).get(`/mistakes/${ids.id}`).query(query).set('x-service-token', token);
  expect(response.status).toBe(404);
  expect(response.body.error).toEqual({ code: 'RESOURCE_NOT_FOUND', message: 'RESOURCE_NOT_FOUND', details: [] });
  const unconfigured = express();
  unconfigured.use(createLearningSourceRouter({ kind: 'mistakes', Model }));
  expect((await (await request(unconfigured)).get(`/mistakes/${ids.id}`).query(query).set('x-service-token', token)).status).toBe(401);
});

test.each([
  ['null source', { sourceTaskId: null }],
  ['undefined source', { sourceTaskId: undefined }],
  ['array source', { sourceTaskId: [ids.id] }],
  ['coercible source', { sourceTaskId: { toString: () => ids.id } }],
  ['ObjectId-shaped source', { sourceTaskId: { _bsontype: 'ObjectId', toHexString: () => ids.id, toString: () => ids.id } }],
  ['second null source', { sourceMistakeId: null }],
  ['array family', { familyId: [ids.familyId] }],
  ['array child', { childId: [ids.childId] }],
  ['coercible family', { familyId: { toString: () => ids.familyId } }],
  ['coercible child', { childId: { toString: () => ids.childId } }]
])('require rejects %s before any local or remote read', async (_name, override) => {
  const TaskModel = model(row), get = jest.fn();
  for (const reader of [createLearningSourceReader({ TaskModel }), remote(get)]) {
    await expect(reader.require({ ...input, ...override })).rejects.toMatchObject({
      status: 400, code: 'VALIDATION_ERROR', message: 'VALIDATION_ERROR', details: []
    });
  }
  expect(TaskModel.findOne).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test.each(['sourceTaskId', 'sourceMistakeId'])('require accepts actual ObjectIds for %s and scope', async field => {
  const Model = model(row);
  const reader = createLearningSourceReader({ TaskModel: Model, MistakeModel: Model });
  await expect(reader.require({
    [field]: new mongoose.Types.ObjectId(ids.id),
    familyId: new mongoose.Types.ObjectId(ids.familyId),
    childId: new mongoose.Types.ObjectId(ids.childId)
  })).resolves.toEqual(source);
  expect(Model.findOne.mock.calls).toEqual([[{ _id: ids.id, ...query }]]);
});

test('describe supports hydrated documents and projections without requiring absent source fields', async () => {
  const isolated = new mongoose.Mongoose();
  const Owner = isolated.model('LearningSourceOwner', new isolated.Schema({
    familyId: isolated.Schema.Types.ObjectId, childId: isolated.Schema.Types.ObjectId,
    sourceTaskId: isolated.Schema.Types.ObjectId, sourceMistakeId: isolated.Schema.Types.ObjectId
  }));
  const owner = Owner.hydrate({ _id: new mongoose.Types.ObjectId(), ...input, sourceMistakeId: null });
  const TaskModel = model(row), reader = createLearningSourceReader({ TaskModel });
  await expect(reader.describe(owner)).resolves.toEqual({ sourceAvailable: true, source });
  await expect(reader.describe({ ...query, ...sourceProjection(owner) })).resolves.toEqual({ sourceAvailable: true, source });
  await expect(reader.describe(Owner.hydrate({ ...query, sourceTaskId: null }))).resolves.toEqual({});
  expect(TaskModel.findOne).toHaveBeenCalledTimes(2);
});

const dependencyError = code => Object.assign(
  new AppError('synthetic-private-message', 503, code, true, [{ token: 'synthetic-private-token' }]),
  { config: { headers: { 'x-service-token': token } } }
);

test.each(['RESOURCE_NOT_FOUND', 'VALIDATION_ERROR'])('dependency AppError %s cannot escape reader redaction', async code => {
  const cause = dependencyError(code);
  const Model = { findOne: () => { throw cause; } };
  for (const reader of [createLearningSourceReader({ TaskModel: Model }), remote(async () => { throw cause; })]) {
    for (const method of ['require', 'describe']) {
      const result = await reader[method](input).catch(error => error);
      expect(result).toMatchObject({ status: 503, statusCode: 503, code: 'SOURCE_SERVICE_UNAVAILABLE',
        message: 'SOURCE_SERVICE_UNAVAILABLE', details: [] });
      expect(result).not.toBe(cause);
      expect(result.config).toBeUndefined();
      expect(result.cause).toBeUndefined();
      expect(JSON.stringify(result)).not.toMatch(/synthetic-private|synthetic-learning-source-token/);
    }
  }
});

test.each(['RESOURCE_NOT_FOUND', 'VALIDATION_ERROR'])('internal router treats dependency AppError %s as a sanitized fault', async code => {
  const Model = { findOne: () => { throw dependencyError(code); } };
  const app = express(), warn = jest.fn();
  app.locals.logger = { warn };
  app.use(createLearningSourceRouter({ kind: 'tasks', Model, serviceToken: token }));
  const response = await (await request(app)).get(`/tasks/${ids.id}`).query(query).set('x-service-token', token);
  expect(response.status).toBe(503);
  expect(response.body).toEqual({ success: false, error: {
    code: 'SOURCE_SERVICE_UNAVAILABLE', message: 'SOURCE_SERVICE_UNAVAILABLE', details: []
  } });
  expect(warn.mock.calls).toEqual([['learning.source.read', { kind: 'tasks', result: 'SOURCE_SERVICE_UNAVAILABLE' }]]);
});

test('legal task subjects longer than 100 characters survive local and remote projection', async () => {
  const subject = 's'.repeat(101), expected = { ...source, subject };
  const TaskModel = model({ ...row, subject });
  await expect(createLearningSourceReader({ TaskModel }).require(input)).resolves.toEqual(expected);
  await expect(remote(async () => ({ status: 200, data: { success: true, data: { source: expected } } }))
    .require(input)).resolves.toEqual(expected);
  const app = express();
  app.use(createLearningSourceRouter({ kind: 'tasks', Model: TaskModel, serviceToken: token }));
  const response = await (await request(app)).get(`/tasks/${ids.id}`).query(query).set('x-service-token', token);
  expect(response.status).toBe(200);
  expect(response.body.data.source).toEqual(expected);
});

test.each([100, 101])('subject fallback of length %i survives local projection and real internal HTTP', async length => {
  // 100 is the current mistake schema boundary; 101 tests the shared projection without a new text limit.
  const subject = 's'.repeat(length), expected = { ...source, subject, title: subject };
  const MistakeModel = model({ _id: ids.id, ...query, subject, knowledgePointName: '' });
  const mistakeInput = { ...query, sourceMistakeId: ids.id };
  await expect(createLearningSourceReader({ MistakeModel }).require(mistakeInput)).resolves.toEqual(expected);
  const app = express();
  app.use('/api/internal/learning-sources', createLearningSourceRouter({ kind: 'mistakes', Model: MistakeModel, serviceToken: token }));
  const mistakeUrl = new URL((await request(app)).get('/').url).origin;
  const reader = createLearningSourceReader({ mistakeUrl, serviceToken: token, axiosInstance: axios.create({ proxy: false }) });
  await expect(reader.describe(mistakeInput)).resolves.toEqual({ sourceAvailable: true, source: expected });
  expect(MistakeModel.findOne.mock.calls).toEqual(Array(2).fill({ _id: ids.id, ...query }).map(scope => [scope]));
});

test('remote HTTP response remains byte bounded even when a subject is a valid string', async () => {
  const app = express();
  app.get(`/api/internal/learning-sources/tasks/${ids.id}`, (_req, res) => res.json({
    success: true, data: { source: { ...source, subject: 's'.repeat(5000) } }
  }));
  const taskUrl = new URL((await request(app)).get('/').url).origin;
  const reader = createLearningSourceReader({ taskUrl, serviceToken: token, axiosInstance: axios.create({ proxy: false }) });
  await expect(reader.require(input)).rejects.toMatchObject({
    status: 503, code: 'SOURCE_SERVICE_UNAVAILABLE', message: 'SOURCE_SERVICE_UNAVAILABLE', details: []
  });
});

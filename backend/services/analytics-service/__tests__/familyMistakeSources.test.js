process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET
  || 'test-gateway-identity-secret-32-bytes-long';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { createHttpTestHarness } = require('../../../common/test/httpTestHarness');
const { createLearningSourceRouter } = require('../../../common/services/learningSource');
const { createApp } = require('../app');
const FamilyMistake = require('../models/FamilyMistake');
const StateEvent = require('../models/FamilyMistakeStateEvent');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const { parseFamilyMistakeInput } = require('../services/familyMistakePatch');
const { createFamilyMistakeMediaService } = require('../services/familyMistakeMediaService');
const {
  FAMILY_A_ID, FAMILY_B_ID, CHILD_A1_ID, CHILD_A2_ID, CHILD_B1_ID, PARENT_A_ID,
  parentA, childA1, resetIdentityNonceStore, signedHeaders
} = require('./helpers/familyAnalyticsFixtures');

const SOURCE_ID = 'abcdefabcdefabcdefabcdef';
const MEDIA_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const TOKEN = 'synthetic-learning-source-token-32-characters';
const missingBody = { success: false, error: {
  code: 'RESOURCE_NOT_FOUND', message: 'RESOURCE_NOT_FOUND', details: []
} };
const unavailableBody = { success: false, error: {
  code: 'SOURCE_SERVICE_UNAVAILABLE', message: 'SOURCE_SERVICE_UNAVAILABLE', details: []
} };
const payload = (overrides = {}) => ({
  childId: CHILD_A1_ID, subject: 'math', reason: 'careless', ...overrides
});
const { request, close } = createHttpTestHarness();
let upstream;
let env;
let task;
let outage;
let reads;

beforeEach(async () => {
  resetIdentityNonceStore();
  await User.create([{
    _id: PARENT_A_ID, username: 'source-parent', password: 'synthetic-password',
    email: 'source-parent@example.test', name: 'Synthetic Parent', role: 'parent', familyId: FAMILY_A_ID,
    children: [CHILD_A1_ID, CHILD_A2_ID]
  }, {
    _id: CHILD_A1_ID, username: 'source-child', password: 'synthetic-password',
    email: 'source-child@example.test', name: 'Synthetic Child', role: 'student', familyId: FAMILY_A_ID,
    childProfile: { tokenVersion: 0 }
  }]);
  await Family.create({
    _id: FAMILY_A_ID, familyName: 'Synthetic source family', ownerParentId: PARENT_A_ID,
    memberParentIds: [PARENT_A_ID], childIds: [CHILD_A1_ID, CHILD_A2_ID]
  });
  task = { _id: SOURCE_ID, familyId: FAMILY_A_ID, childId: CHILD_A1_ID, title: 'Synthetic task' };
  outage = false;
  reads = 0;
  const sourceApp = express();
  sourceApp.use((req, res, next) => {
    reads += 1;
    if (outage) return res.status(503).json({ privateUpstream: 'must not escape' });
    return next();
  });
  // Only the remote owner's storage is synthetic; exercise the real HTTP contract and reader.
  sourceApp.use('/api/internal/learning-sources', createLearningSourceRouter({
    kind: 'tasks', serviceToken: TOKEN,
    Model: { findOne: filter => ({ select: () => ({ lean: async () => (
      task && Object.entries(filter).every(([key, value]) => task[key] === value) ? task : null
    ) }) }) }
  }));
  upstream = http.createServer(sourceApp);
  await new Promise((resolve, reject) => {
    upstream.once('error', reject);
    upstream.listen(0, '127.0.0.1', resolve);
  });
  env = { HOMEWORK_SERVICE_URL: `http://127.0.0.1:${upstream.address().port}`, INTERNAL_SERVICE_TOKEN: TOKEN };
});

afterEach(async () => {
  await close();
  if (upstream) await new Promise((resolve, reject) => upstream.close(error => error ? reject(error) : resolve()));
  upstream = null;
});

const send = async (app, method, path, body, user = parentA()) => {
  const call = (await request(app))[method](path).set(signedHeaders(user, method.toUpperCase(), path));
  return body === undefined ? call : call.send(body);
};
const seed = (extra = {}) => FamilyMistake.create({
  ...payload(), familyId: FAMILY_A_ID, createdBy: PARENT_A_ID, updatedBy: PARENT_A_ID, ...extra
});
const mediaDependencies = () => {
  const result = state => async ({ references }) => references.map(reference => ({ ...reference, state }));
  const client = {
    prepare: jest.fn(result('prepared')), commit: jest.fn(result('bound')), unbind: jest.fn(result('released'))
  };
  return {
    client,
    service: createFamilyMistakeMediaService({
      FamilyMistakeModel: FamilyMistake, FamilyMistakeStateEventModel: StateEvent,
      mediaReferenceClient: client, randomUUID: crypto.randomUUID
    })
  };
};

describe('T6 learning sources in analytics', () => {
  test.each(['parent', 'student'])('%s create parser normalizes source ID and patch rejects it', role => {
    expect(parseFamilyMistakeInput({ body: { sourceTaskId: SOURCE_ID.toUpperCase() }, role, operation: 'create' }))
      .toEqual({ sourceTaskId: SOURCE_ID });
    expect(() => parseFamilyMistakeInput({ body: { sourceTaskId: SOURCE_ID }, role, operation: 'patch' }))
      .toThrow(expect.objectContaining({ code: 'FIELD_ACCESS_DENIED' }));
  });

  test.each([null, '', {}, 'not-an-id', 'abcdefabcdefabcdefabcde', 123])('rejects malformed source %p before writes', async sourceTaskId => {
    const response = await send(createApp({ env }), 'post', '/api/mistakes', payload({ sourceTaskId }));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(reads).toBe(0);
    expect(await FamilyMistake.countDocuments()).toBe(0);
    expect(await StateEvent.countDocuments()).toBe(0);
  });

  test('model keeps optional source immutable without backfilling old rows', async () => {
    const legacy = await seed();
    expect(legacy.toObject()).not.toHaveProperty('sourceTaskId');
    const row = await seed({ sourceTaskId: SOURCE_ID });
    row.sourceTaskId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
    await expect(row.save()).rejects.toMatchObject({ name: 'ValidationError' });
    expect(String((await FamilyMistake.findById(row._id)).sourceTaskId)).toBe(SOURCE_ID);
  });

  test('no-source create/list/detail/patch works without configured source service or reader calls', async () => {
    const reader = { require: jest.fn(), describe: jest.fn() };
    const app = createApp({ env: {}, learningSourceReader: reader });
    const created = await send(app, 'post', '/api/mistakes', payload());
    expect(created.status).toBe(201);
    expect(created.body.data.mistake).not.toHaveProperty('sourceTaskId');
    const path = `/api/mistakes/${created.body.data.mistake.mistakeId}`;
    const detail = await send(app, 'get', path);
    expect(detail.status).toBe(200);
    expect(detail.body.data.mistake).not.toHaveProperty('sourceAvailable');
    expect((await send(app, 'get', `/api/mistakes?childId=${CHILD_A1_ID}`)).status).toBe(200);
    expect((await send(app, 'patch', path, { childExplanation: 'synthetic explanation' })).status).toBe(200);
    expect(reader.require).not.toHaveBeenCalled();
    expect(reader.describe).not.toHaveBeenCalled();
  });

  test.each([parentA(), childA1()])('$role can create same-scope source with no subject; IDs survive list and patch', async user => {
    const app = createApp({ env });
    const created = await send(app, 'post', '/api/mistakes', payload({ sourceTaskId: SOURCE_ID.toUpperCase() }), user);
    expect(created.status).toBe(201);
    expect(created.body.data.mistake.sourceTaskId).toBe(SOURCE_ID);
    expect(created.body.data.mistake).not.toHaveProperty('source');
    expect(reads).toBe(1);
    const path = `/api/mistakes/${created.body.data.mistake.mistakeId}`;
    outage = true;
    const list = await send(app, 'get', `/api/mistakes?childId=${CHILD_A1_ID}`, undefined, user);
    expect(list.status).toBe(200);
    expect(list.body.data.items[0].sourceTaskId).toBe(SOURCE_ID);
    const patched = await send(app, 'patch', path, { childExplanation: 'independent patch' }, user);
    expect(patched.status).toBe(200);
    expect(patched.body.data.mistake.sourceTaskId).toBe(SOURCE_ID);
    const forbidden = await send(app, 'patch', path, { sourceTaskId: SOURCE_ID }, user);
    expect(forbidden.status).toBe(403);
    expect(reads).toBe(1);
    outage = false;
    const detail = await send(app, 'get', path, undefined, user);
    expect(detail.status).toBe(200);
    expect(detail.body.data.mistake).toMatchObject({ sourceTaskId: SOURCE_ID, sourceAvailable: true,
      source: { id: SOURCE_ID, familyId: FAMILY_A_ID, childId: CHILD_A1_ID, subject: '', title: 'Synthetic task' }
    });
    expect(reads).toBe(2);
  });

  test('authorizes target child before source read or media orchestration', async () => {
    const { client, service } = mediaDependencies();
    const app = createApp({ env, familyMistakeMediaService: service });
    for (const user of [parentA(), childA1()]) {
      const response = await send(app, 'post', '/api/mistakes', payload({
        childId: CHILD_B1_ID, sourceTaskId: SOURCE_ID, questionMediaIds: [MEDIA_ID]
      }), user);
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CHILD_ACCESS_DENIED');
    }
    expect(reads).toBe(0);
    expect(client.prepare).not.toHaveBeenCalled();
    expect(await FamilyMistake.countDocuments()).toBe(0);
    expect(await StateEvent.countDocuments()).toBe(0);
  });

  test('forbidden detail cannot resume pending media or read the source', async () => {
    const row = await seed({ childId: CHILD_A2_ID, sourceTaskId: SOURCE_ID, mediaReferenceState: 'pending' });
    const { client, service } = mediaDependencies();
    const response = await send(createApp({ env, familyMistakeMediaService: service }),
      'get', `/api/mistakes/${row._id}`, undefined, childA1());
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CHILD_ACCESS_DENIED');
    expect(reads).toBe(0);
    expect(client.prepare).not.toHaveBeenCalled();
    expect(client.commit).not.toHaveBeenCalled();
    expect((await FamilyMistake.findById(row._id).select('+mediaReferenceState')).mediaReferenceState).toBe('pending');
  });

  test.each([
    { sourceMistakeId: SOURCE_ID }, { sourceAvailable: true }, { source: { id: SOURCE_ID } },
    { familyId: FAMILY_B_ID }, { 'sourceTaskId.id': SOURCE_ID }
  ])('create keeps strict whitelist for unsupported source input %p', async extra => {
    const response = await send(createApp({ env }), 'post', '/api/mistakes', payload(extra));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FIELD_ACCESS_DENIED');
    expect(reads).toBe(0);
    expect(await FamilyMistake.countDocuments()).toBe(0);
    expect(await StateEvent.countDocuments()).toBe(0);
  });

  test.each(['missing', 'sibling', 'family', 'unavailable', 'credentials', 'configuration'])('%s source fails before ordinary/media writes with uniform errors', async mode => {
    if (mode === 'missing') task = null;
    if (mode === 'sibling') task.childId = CHILD_A2_ID;
    if (mode === 'family') task.familyId = FAMILY_B_ID;
    if (mode === 'unavailable') outage = true;
    if (mode === 'credentials') env.INTERNAL_SERVICE_TOKEN = 'wrong-synthetic-token-with-32-characters';
    if (mode === 'configuration') env = {};
    const unavailable = ['unavailable', 'credentials', 'configuration'].includes(mode);
    const { client, service } = mediaDependencies();
    const app = createApp({ env, familyMistakeMediaService: service });
    for (const media of [{}, { questionMediaIds: [MEDIA_ID] }]) {
      const response = await send(app, 'post', '/api/mistakes', payload({ sourceTaskId: SOURCE_ID, ...media }));
      expect(response.status).toBe(unavailable ? 503 : 404);
      expect(response.body).toEqual(unavailable ? unavailableBody : missingBody);
    }
    expect(client.prepare).not.toHaveBeenCalled();
    expect(client.commit).not.toHaveBeenCalled();
    expect(await FamilyMistake.countDocuments()).toBe(0);
    expect(await StateEvent.countDocuments()).toBe(0);
  });

  test('injected reader receives authorized scope and detail resolves current source, never a cached projection', async () => {
    const reader = {
      require: jest.fn(async () => null),
      describe: jest.fn(async () => ({ sourceAvailable: false, source: null }))
    };
    const app = createApp({ env: {}, learningSourceReader: reader });
    const created = await send(app, 'post', '/api/mistakes', payload({ sourceTaskId: SOURCE_ID }));
    expect(created.status).toBe(201);
    expect(reader.require).toHaveBeenCalledTimes(1);
    expect(reader.require).toHaveBeenCalledWith(expect.objectContaining({
      sourceTaskId: SOURCE_ID, familyId: expect.anything(), childId: CHILD_A1_ID
    }));
    expect(String(reader.require.mock.calls[0][0].familyId)).toBe(FAMILY_A_ID);
    const path = `/api/mistakes/${created.body.data.mistake.mistakeId}`;
    const detail = await send(app, 'get', path);
    expect(detail.body.data.mistake).toMatchObject({ sourceTaskId: SOURCE_ID, sourceAvailable: false, source: null });
    expect(reader.describe).toHaveBeenCalledTimes(1);
  });

  test('detail distinguishes disappearing source from transient 503 and reads fresh title', async () => {
    const app = createApp({ env });
    const created = await send(app, 'post', '/api/mistakes', payload({ sourceTaskId: SOURCE_ID }));
    expect(created.status).toBe(201);
    const path = `/api/mistakes/${created.body.data.mistake.mistakeId}`;
    task.title = 'Updated source title';
    expect((await send(app, 'get', path)).body.data.mistake.source.title).toBe('Updated source title');
    task = null;
    const missing = await send(app, 'get', path);
    expect(missing.status).toBe(200);
    expect(missing.body.data.mistake).toMatchObject({ sourceTaskId: SOURCE_ID, sourceAvailable: false, source: null });
    outage = true;
    const failed = await send(app, 'get', path);
    expect(failed.status).toBe(503);
    expect(failed.body).toEqual(unavailableBody);
    expect(await FamilyMistake.countDocuments()).toBe(1);
    expect(await StateEvent.countDocuments()).toBe(1);
  });

  test('media creation preserves source after binding and state event creation', async () => {
    const { client, service } = mediaDependencies();
    const app = createApp({ env, familyMistakeMediaService: service });
    const created = await send(app, 'post', '/api/mistakes', payload({ sourceTaskId: SOURCE_ID, questionMediaIds: [MEDIA_ID] }));
    expect(created.status).toBe(201);
    expect(created.body.data.mistake).toMatchObject({ sourceTaskId: SOURCE_ID, questionMediaIds: [MEDIA_ID] });
    expect(client.commit).toHaveBeenCalledTimes(1);
    const saved = await FamilyMistake.findById(created.body.data.mistake.mistakeId).select('+mediaReferenceState');
    expect(String(saved.sourceTaskId)).toBe(SOURCE_ID);
    expect(saved.mediaReferenceState).toBe('bound');
    expect(await StateEvent.countDocuments()).toBe(1);
  });

  test.each(['missing', 'unavailable'])('pending media resumes the saved object before %s source lookup, without POST or revalidation', async mode => {
    const { client, service } = mediaDependencies();
    client.commit.mockRejectedValueOnce(new Error('synthetic lost response'));
    const app = createApp({ env, familyMistakeMediaService: service });
    const created = await send(app, 'post', '/api/mistakes', payload({ sourceTaskId: SOURCE_ID, questionMediaIds: [MEDIA_ID] }));
    expect(created.status).toBe(503);
    expect(created.body.error.code).toBe('MEDIA_REFERENCE_PENDING');
    const id = created.body.error.details.resourceId;
    expect(id).toEqual(expect.any(String));
    if (mode === 'missing') task = null;
    else outage = true;
    const recovered = await send(app, 'get', `/api/mistakes/${id}`);
    expect(recovered.status).toBe(mode === 'missing' ? 200 : 503);
    if (mode === 'missing') expect(recovered.body.data.mistake).toMatchObject({
      sourceTaskId: SOURCE_ID, sourceAvailable: false, source: null, questionMediaIds: [MEDIA_ID]
    });
    else expect(recovered.body).toEqual(unavailableBody);
    const saved = await FamilyMistake.findById(id).select('+mediaReferenceState');
    expect(saved.mediaReferenceState).toBe('bound');
    expect(String(saved.sourceTaskId)).toBe(SOURCE_ID);
    expect(saved.questionMediaIds.map(String)).toEqual([MEDIA_ID]);
    expect(client.commit).toHaveBeenCalledTimes(2);
    expect(reads).toBe(2);
    expect(await FamilyMistake.countDocuments()).toBe(1);
    expect(await StateEvent.countDocuments()).toBe(1);
  });

  test('ongoing media pending takes precedence over source outage and preserves the original recovery ID', async () => {
    const { client, service } = mediaDependencies();
    client.commit.mockRejectedValue(new Error('synthetic pending commit'));
    const app = createApp({ env, familyMistakeMediaService: service });
    const created = await send(app, 'post', '/api/mistakes', payload({ sourceTaskId: SOURCE_ID, questionMediaIds: [MEDIA_ID] }));
    expect(created.status).toBe(503);
    expect(created.body.error.code).toBe('MEDIA_REFERENCE_PENDING');
    const id = created.body.error.details.resourceId;
    outage = true;
    const recovery = await send(app, 'get', `/api/mistakes/${id}`);
    expect(recovery.status).toBe(503);
    expect(recovery.body.error).toMatchObject({ code: 'MEDIA_REFERENCE_PENDING', details: { resourceId: id } });
    expect(reads).toBe(1);
    expect(await FamilyMistake.countDocuments()).toBe(1);
    expect((await FamilyMistake.findById(id).select('+mediaReferenceState')).mediaReferenceState).toBe('pending');
    expect(client.unbind).not.toHaveBeenCalled();
  });

  test('internal source route requires configured credentials and returns only a scoped minimal projection', async () => {
    const row = await seed({ knowledgePointName: 'Fractions', parentNote: 'private note', questionMediaIds: [MEDIA_ID] });
    const path = `/api/internal/learning-sources/mistakes/${row._id}?familyId=${FAMILY_A_ID}&childId=${CHILD_A1_ID}`;
    const app = createApp({ env });
    expect((await (await request(app)).get(path)).status).toBe(401);
    expect((await (await request(app)).get(path).set('x-service-token', 'wrong')).status).toBe(401);
    expect((await (await request(createApp({ env: {} }))).get(path).set('x-service-token', TOKEN)).status).toBe(401);
    const response = await (await request(app)).get(path).set('x-service-token', TOKEN);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { source: {
      id: String(row._id), familyId: FAMILY_A_ID, childId: CHILD_A1_ID, subject: 'math', title: 'Fractions'
    } } });
    for (const scope of [
      { familyId: FAMILY_A_ID, childId: CHILD_A2_ID },
      { familyId: FAMILY_B_ID, childId: CHILD_A1_ID }
    ]) {
      const denied = await (await request(app)).get(`/api/internal/learning-sources/mistakes/${row._id}`)
        .query(scope).set('x-service-token', TOKEN);
      expect(denied.status).toBe(404);
      expect(denied.body).toEqual(missingBody);
    }
    const absent = await (await request(app)).get(`/api/internal/learning-sources/mistakes/${SOURCE_ID}`)
      .query({ familyId: FAMILY_A_ID, childId: CHILD_A1_ID }).set('x-service-token', TOKEN);
    expect(absent.status).toBe(404);
    expect(absent.body).toEqual(missingBody);
    expect((await (await request(app)).post(path).set('x-service-token', TOKEN).send({ parentNote: 'overwrite' })).status).toBe(404);
    expect((await FamilyMistake.findById(row._id)).parentNote).toBe('private note');
  });

  test('production startServer uses process env for remote task validation and internal mistake credentials', async () => {
    const startupEnv = {
      ...env, RESOURCE_SERVICE_URL: env.HOMEWORK_SERVICE_URL,
      MEDIA_REFERENCE_SERVICE_TOKEN: 'synthetic-media-reference-token-32-characters'
    };
    const previous = Object.fromEntries(Object.keys(startupEnv).map(key => [key, process.env[key]]));
    Object.assign(process.env, startupEnv);
    try {
      const { startServer } = require('../server');
      let app;
      await startServer({
        port: 0, connect: async () => undefined, createIo: () => null,
        createHttpServer: mountedApp => {
          app = mountedApp;
          return { once: () => undefined, listen: (port, ready) => ready() };
        }
      });
      const response = await send(app, 'post', '/api/mistakes', payload({ sourceTaskId: SOURCE_ID }));
      expect(response.status).toBe(201);
      expect(response.body.data.mistake.sourceTaskId).toBe(SOURCE_ID);
      expect(reads).toBe(1);
      const internal = await (await request(app))
        .get(`/api/internal/learning-sources/mistakes/${response.body.data.mistake.mistakeId}`)
        .query({ familyId: FAMILY_A_ID, childId: CHILD_A1_ID }).set('x-service-token', TOKEN);
      expect(internal.status).toBe(200);
      expect(internal.body.data.source.id).toBe(response.body.data.mistake.mistakeId);
      expect(internal.body.data.source).not.toHaveProperty('sourceTaskId');
    } finally {
      Object.entries(previous).forEach(([key, value]) => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      });
    }
  });
});

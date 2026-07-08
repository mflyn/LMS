process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET || 'test-gateway-identity-secret-32-bytes-long';
process.env.INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'test-internal-service-token-32-bytes';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

const request = require('supertest');
const app = require('../server');
const KnowledgePoint = require('../models/KnowledgePoint');
const KnowledgePointMasteryEvent = require('../models/KnowledgePointMasteryEvent');
const { createTask5Fixtures } = require('./helpers/task5Fixtures');

const createKnowledgePoint = (fixtures, overrides = {}) => {
  const path = '/api/knowledge-points';
  return request(app)
    .post(path)
    .set(fixtures.headers(fixtures.parentA, 'POST', path))
    .send({
      childId: fixtures.childA1._id,
      dimension: 'academic',
      subject: '数学',
      name: `分数-${Math.random().toString(36).slice(2, 8)}`,
      masteryLevel: 'learning',
      ...overrides
    });
};

const patchKnowledgePoint = (fixtures, pointId, body, idempotencyKey) => {
  const path = `/api/knowledge-points/${pointId}`;
  let call = request(app)
    .patch(path)
    .set(fixtures.headers(fixtures.parentA, 'PATCH', path));
  if (idempotencyKey) call = call.set('Idempotency-Key', idempotencyKey);
  return call.send(body);
};

describe('Task 6 knowledge point mastery history', () => {
  test('TC-T6-REPO-007 writes source and mastery event atomically', async () => {
    const f = await createTask5Fixtures();
    const createResponse = await createKnowledgePoint(f, { masteryLevel: 'learning' }).expect(201);
    const pointId = createResponse.body.data.knowledgePoint.knowledgePointId;

    await patchKnowledgePoint(f, pointId, { masteryLevel: 'needs_review' }, 'mastery-needs-review')
      .expect(200);

    const events = await KnowledgePointMasteryEvent.find({ knowledgePointId: pointId })
      .sort({ effectiveAt: 1, createdAt: 1 });
    expect(events.map((event) => event.masteryLevel)).toEqual(['learning', 'needs_review']);
    expect(events.map((event) => event.familyId.toString())).toEqual([
      f.familyA._id.toString(),
      f.familyA._id.toString()
    ]);
    expect(events[1].operationId).toBe('mastery-needs-review');
  });

  test('TC-T6-REPO-007 does not append duplicate event for repeated idempotent mastery patch', async () => {
    const f = await createTask5Fixtures();
    const createResponse = await createKnowledgePoint(f, { masteryLevel: 'learning' }).expect(201);
    const pointId = createResponse.body.data.knowledgePoint.knowledgePointId;

    await patchKnowledgePoint(f, pointId, { masteryLevel: 'skilled' }, 'same-mastery-key').expect(200);
    await patchKnowledgePoint(f, pointId, { masteryLevel: 'skilled' }, 'same-mastery-key').expect(200);

    const events = await KnowledgePointMasteryEvent.find({ knowledgePointId: pointId, operationId: 'same-mastery-key' });
    expect(events).toHaveLength(1);
    expect(events[0].masteryLevel).toBe('skilled');
  });

  test('TC-T6-REPO-007 rolls back source create when mastery event persistence fails', async () => {
    const f = await createTask5Fixtures();
    jest.spyOn(KnowledgePointMasteryEvent, 'create').mockRejectedValueOnce(new Error('event store unavailable'));

    const response = await createKnowledgePoint(f, { name: 'rollback-create' });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('STATE_EVENT_UNAVAILABLE');
    expect(await KnowledgePoint.countDocuments({ name: 'rollback-create' })).toBe(0);
  });

  test('TC-T6-REPO-007 rolls back source update when mastery event persistence fails', async () => {
    const f = await createTask5Fixtures();
    const createResponse = await createKnowledgePoint(f, { masteryLevel: 'learning' }).expect(201);
    const pointId = createResponse.body.data.knowledgePoint.knowledgePointId;
    jest.spyOn(KnowledgePointMasteryEvent, 'create').mockRejectedValueOnce(new Error('event store unavailable'));

    const response = await patchKnowledgePoint(f, pointId, { masteryLevel: 'needs_review' }, 'failed-update');

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('STATE_EVENT_UNAVAILABLE');
    expect((await KnowledgePoint.findById(pointId)).masteryLevel).toBe('learning');
    expect(await KnowledgePointMasteryEvent.countDocuments({ operationId: 'failed-update' })).toBe(0);
  });
});

jest.mock('../../../common/config/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }));
const express = require('express');
const mongoose = require('mongoose');
const Point = require('../models/KnowledgePoint');
const Event = require('../models/KnowledgePointMasteryEvent');
const { createHttpTestHarness } = require('../../../common/test/httpTestHarness');
const { createTask5Fixtures } = require('./helpers/task5Fixtures');
const router = require('../routes/knowledgePoints');
const { request, close } = createHttpTestHarness();
const app = express(); app.use(express.json()); app.use('/api/knowledge-points', router);
afterEach(async () => { jest.restoreAllMocks(); await close(); });
beforeAll(async () => { await Point.init(); await Event.init(); });
const fixture = async () => {
  const f = await createTask5Fixtures();
  const point = await Point.create({ familyId: f.familyA._id, childId: f.childA1._id, dimension: 'academic',
    subject: 'math', name: 'Synthetic multiplication', masteryLevel: 'learning',
    createdByParentId: f.parentA._id, updatedByParentId: f.parentA._id });
  return { f, point };
};
const patch = async (f, point, body) => {
  const url = `/api/knowledge-points/${point._id}`;
  return (await request(app)).patch(url).set(f.headers(f.parentA, 'PATCH', url)).send(body);
};

test('legacy missing revision starts at zero and every ordinary status write increments atomically', async () => {
  const { f, point } = await fixture();
  await Point.collection.updateOne({ _id: point._id }, { $unset: { stateRevision: '' } });
  expect((await patch(f, point, { practiceCount: 4 })).status).toBe(200);
  expect((await Point.findById(point._id).lean()).stateRevision).toBe(1);
  expect((await patch(f, point, { masteryLevel: 'needs_review' })).status).toBe(200);
  expect((await patch(f, point, { masteryLevel: 'learning' })).status).toBe(200);
  expect((await Point.findById(point._id).lean()).stateRevision).toBe(3);
  expect(await Event.countDocuments({ knowledgePointId: point._id })).toBe(2);
});
test('concurrent old PATCH updates do not lose a revision or disjoint fields', async () => {
  const { f, point } = await fixture();
  const responses = await Promise.all([patch(f, point, { practiceCount: 7 }), patch(f, point, { mistakeCount: 3 })]);
  expect(responses.map(r => r.status)).toEqual([200, 200]);
  expect(await Point.findById(point._id).lean()).toMatchObject({ stateRevision: 2, practiceCount: 7, mistakeCount: 3 });
});
test('failed event insertion rolls back revision and current state together', async () => {
  const { f, point } = await fixture();
  jest.spyOn(Event, 'create').mockRejectedValueOnce(Error('synthetic rollback'));
  expect((await patch(f, point, { masteryLevel: 'skilled' })).status).toBe(503);
  expect(await Point.findById(point._id).lean()).toMatchObject({ stateRevision: 0, masteryLevel: 'learning' });
});
test.each(['stateRevision', 'sourceType', 'finalReviewId', 'finalReviewHash', 'reviewedByParentId', 'reviewedAt'])(
  'ordinary PATCH cannot forge %s', async field => {
    const { f, point } = await fixture();
    expect((await patch(f, point, { [field]: String(new mongoose.Types.ObjectId()) })).status).toBe(400);
    expect(await Event.countDocuments()).toBe(0);
  });

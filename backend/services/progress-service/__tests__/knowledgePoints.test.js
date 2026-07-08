process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET || 'test-gateway-identity-secret-32-bytes-long';
process.env.INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'test-internal-service-token-32-bytes';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../server');
const KnowledgePoint = require('../models/KnowledgePoint');
const { createTask5Fixtures } = require('./helpers/task5Fixtures');

const owner = () => ({
  familyId: new mongoose.Types.ObjectId(),
  childId: new mongoose.Types.ObjectId(),
  createdByParentId: new mongoose.Types.ObjectId(),
  updatedByParentId: new mongoose.Types.ObjectId()
});

describe('Task 5 knowledge and ability points', () => {
  test('TC-T5-POINT-001 accepts academic subject and non-academic area points', async () => {
    const KnowledgePoint = require('../models/KnowledgePoint');
    const academic = await KnowledgePoint.create({
      ...owner(), dimension: 'academic', subject: '数学', name: '分数计算'
    });
    const physical = await KnowledgePoint.create({
      ...owner(), dimension: 'physical', area: '跳绳', name: '连续跳绳'
    });

    expect(academic.area).toBe('');
    expect(physical.subject).toBe('');
  });

  test('TC-T5-POINT-002 rejects missing conditional fields and invalid counters', async () => {
    const KnowledgePoint = require('../models/KnowledgePoint');
    await expect(new KnowledgePoint({
      ...owner(), dimension: 'academic', name: 'missing subject'
    }).validate()).rejects.toMatchObject({ name: 'ValidationError' });
    await expect(new KnowledgePoint({
      ...owner(), dimension: 'labor', name: 'missing area', practiceCount: -1.5
    }).validate()).rejects.toMatchObject({ name: 'ValidationError' });
  });

  test('TC-T5-POINT-003 enforces normalized per-child uniqueness', async () => {
    const KnowledgePoint = require('../models/KnowledgePoint');
    await KnowledgePoint.syncIndexes();
    const fields = {
      ...owner(), dimension: 'academic', subject: '数学', area: '', name: '分数计算'
    };
    await KnowledgePoint.create(fields);
    await expect(KnowledgePoint.create({ ...fields, updatedByParentId: new mongoose.Types.ObjectId() }))
      .rejects.toMatchObject({ code: 11000 });
  });

  test('TC-T5-POINT-003 maps duplicate route creation to resource conflict', async () => {
    const f = await createTask5Fixtures();
    const path = '/api/knowledge-points';
    const payload = { childId: f.childA1._id, dimension: 'academic', subject: '数学', name: '分数计算' };
    await request(app).post(path).set(f.headers(f.parentA, 'POST', path)).send(payload).expect(201);
    const duplicate = await request(app).post(path).set(f.headers(f.parentA, 'POST', path)).send(payload);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('RESOURCE_CONFLICT');
  });

  test('TC-T5-POINT-004 parent creates all five point dimensions', async () => {
    const f = await createTask5Fixtures();
    const path = '/api/knowledge-points';
    for (const dimension of ['moral', 'academic', 'physical', 'artistic', 'labor']) {
      const payload = {
        childId: f.childA1._id,
        dimension,
        name: `${dimension} point`,
        ...(dimension === 'academic' ? { subject: '数学' } : { area: `${dimension} area` })
      };
      const response = await request(app).post(path)
        .set(f.headers(f.parentA, 'POST', path)).send(payload);
      expect(response.status).toBe(201);
      expect(response.body.data.knowledgePoint.familyId).toBe(f.familyA._id.toString());
    }
  });

  test('TC-T5-POINT-005 child cannot create or patch points', async () => {
    const f = await createTask5Fixtures();
    const createPath = '/api/knowledge-points';
    const create = await request(app).post(createPath)
      .set(f.headers(f.childA1, 'POST', createPath))
      .send({ childId: f.childA1._id, dimension: 'academic', subject: '数学', name: '分数' });
    expect(create.status).toBe(403);

    const point = await KnowledgePoint.create({
      familyId: f.familyA._id, childId: f.childA1._id, dimension: 'academic', subject: '数学',
      name: '分数', createdByParentId: f.parentA._id, updatedByParentId: f.parentA._id
    });
    const patchPath = `/api/knowledge-points/${point._id}`;
    const patch = await request(app).patch(patchPath)
      .set(f.headers(f.childA1, 'PATCH', patchPath)).send({ masteryLevel: 'skilled' });
    expect(patch.status).toBe(403);
    expect((await KnowledgePoint.findById(point._id)).masteryLevel).toBe('not_started');
  });

  test('TC-T5-POINT-006 denies cross-family and sibling access', async () => {
    const f = await createTask5Fixtures();
    const createPath = '/api/knowledge-points';
    const create = await request(app).post(createPath)
      .set(f.headers(f.parentB, 'POST', createPath))
      .send({ childId: f.childA1._id, dimension: 'academic', subject: '数学', name: '越权' });
    expect(create.status).toBe(403);

    const point = await KnowledgePoint.create({
      familyId: f.familyA._id, childId: f.childA1._id, dimension: 'physical', area: '跳绳',
      name: '耐力', createdByParentId: f.parentA._id, updatedByParentId: f.parentA._id
    });
    for (const user of [f.parentB, f.childA2]) {
      const listPath = `/api/knowledge-points?childId=${f.childA1._id}`;
      const list = await request(app).get(listPath).set(f.headers(user, 'GET', listPath));
      expect(list.status).toBe(403);
    }
    const patchPath = `/api/knowledge-points/${point._id}`;
    const patch = await request(app).patch(patchPath)
      .set(f.headers(f.parentB, 'PATCH', patchPath)).send({ masteryLevel: 'skilled' });
    expect(patch.status).toBe(403);
  });

  test('TC-T5-POINT-007 lists accessible filtered points with pagination', async () => {
    const f = await createTask5Fixtures();
    await KnowledgePoint.create([
      { familyId: f.familyA._id, childId: f.childA1._id, dimension: 'academic', subject: '数学', name: '分数', masteryLevel: 'learning', createdByParentId: f.parentA._id, updatedByParentId: f.parentA._id },
      { familyId: f.familyA._id, childId: f.childA1._id, dimension: 'academic', subject: '数学', name: '小数', masteryLevel: 'learning', createdByParentId: f.parentA._id, updatedByParentId: f.parentA._id },
      { familyId: f.familyA._id, childId: f.childA1._id, dimension: 'physical', area: '跳绳', name: '耐力', masteryLevel: 'basic', createdByParentId: f.parentA._id, updatedByParentId: f.parentA._id }
    ]);
    const path = `/api/knowledge-points?childId=${f.childA1._id}&dimension=academic&subject=${encodeURIComponent('数学')}&masteryLevel=learning&page=1&pageSize=1`;
    const response = await request(app).get(path).set(f.headers(f.childA1, 'GET', path));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({ page: 1, pageSize: 1, total: 2 }));
    expect(response.body.data.items).toHaveLength(1);
  });

  test('TC-T5-POINT-008 parent updates mastery, counts and review timestamp', async () => {
    const f = await createTask5Fixtures();
    const point = await KnowledgePoint.create({
      familyId: f.familyA._id, childId: f.childA1._id, dimension: 'labor', area: '家务',
      name: '整理房间', createdByParentId: f.parentA._id, updatedByParentId: f.parentA._id
    });
    const path = `/api/knowledge-points/${point._id}`;
    const response = await request(app).patch(path)
      .set(f.headers(f.parentA, 'PATCH', path))
      .send({ masteryLevel: 'skilled', practiceCount: 8, mistakeCount: 0, lastReviewedAt: '2026-06-19T12:00:00.000Z' });
    expect(response.status).toBe(200);
    expect(response.body.data.knowledgePoint).toEqual(expect.objectContaining({
      masteryLevel: 'skilled', practiceCount: 8, updatedByParentId: f.parentA._id.toString()
    }));
  });
});

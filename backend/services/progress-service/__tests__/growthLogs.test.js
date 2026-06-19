process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET || 'test-gateway-identity-secret-32-bytes-long';
process.env.INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'test-internal-service-token-32-bytes';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../server');
const GrowthLog = require('../models/GrowthLog');
const { createTask5Fixtures } = require('./helpers/task5Fixtures');

const ids = () => ({
  familyId: new mongoose.Types.ObjectId(),
  childId: new mongoose.Types.ObjectId(),
  actorId: new mongoose.Types.ObjectId()
});

describe('Task 5 growth logs', () => {
  test('TC-T5-LOG-005 resolves only parent-owned and child-self access', async () => {
    const User = require('../../../common/models/User');
    const Family = require('../../../common/models/Family');
    const { resolveChildAccess } = require('../services/growthAccess');
    const suffix = Math.random().toString(36).slice(2, 10);
    const parentA = await User.create({
      username: `pa${suffix}`, password: 'parent123', email: `pa${suffix}@example.com`, name: 'Parent A', role: 'parent'
    });
    const parentB = await User.create({
      username: `pb${suffix}`, password: 'parent123', email: `pb${suffix}@example.com`, name: 'Parent B', role: 'parent'
    });
    const familyA = await Family.create({ familyName: 'Family A', ownerParentId: parentA._id });
    const familyB = await Family.create({ familyName: 'Family B', ownerParentId: parentB._id });
    const childA1 = await User.create({
      username: `c1${suffix}`, password: 'child123', email: `c1${suffix}@example.com`, name: 'Child A1', role: 'student', familyId: familyA._id
    });
    const childA2 = await User.create({
      username: `c2${suffix}`, password: 'child123', email: `c2${suffix}@example.com`, name: 'Child A2', role: 'student', familyId: familyA._id
    });
    familyA.childIds = [childA1._id, childA2._id];
    await familyA.save();

    await expect(resolveChildAccess({ id: parentA._id.toString(), role: 'parent' }, childA1._id.toString()))
      .resolves.toMatchObject({ familyId: familyA._id });
    await expect(resolveChildAccess({ id: parentB._id.toString(), role: 'parent' }, childA1._id.toString()))
      .resolves.toBeNull();
    await expect(resolveChildAccess({
      id: childA1._id.toString(), childId: childA1._id.toString(), role: 'student', familyId: familyA._id.toString()
    }, childA2._id.toString())).resolves.toBeNull();
    expect(familyB.childIds).toHaveLength(0);
  });

  test('TC-T5-LOG-001 accepts all five dimensions with LocalDate ownership', async () => {
    const GrowthLog = require('../models/GrowthLog');
    const dimensions = ['moral', 'academic', 'physical', 'artistic', 'labor'];

    for (const dimension of dimensions) {
      const owner = ids();
      const log = await GrowthLog.create({
        ...owner,
        createdBy: owner.actorId,
        updatedBy: owner.actorId,
        date: '2026-06-19',
        dimension,
        content: `${dimension} activity`
      });
      expect(log.dimension).toBe(dimension);
      expect(log.date).toBe('2026-06-19');
    }
  });

  test('TC-T5-LOG-002 rejects invalid dates, values, enums and content', async () => {
    const GrowthLog = require('../models/GrowthLog');
    const owner = ids();
    const base = {
      ...owner,
      createdBy: owner.actorId,
      updatedBy: owner.actorId,
      date: '2026-02-30',
      dimension: 'unknown',
      content: 'x'.repeat(1001),
      durationMinutes: -1,
      amount: -1
    };

    await expect(new GrowthLog(base).validate()).rejects.toMatchObject({ name: 'ValidationError' });
  });

  test('TC-T5-LOG-003 parent creates a log with server-derived ownership', async () => {
    const f = await createTask5Fixtures();
    const path = '/api/growth-logs';
    const response = await request(app).post(path)
      .set(f.headers(f.parentA, 'POST', path))
      .send({
        childId: f.childA1._id,
        date: '2026-06-19',
        dimension: 'artistic',
        content: 'piano practice',
        parentNote: 'steady rhythm'
      });

    expect(response.status).toBe(201);
    expect(response.body.data.log).toEqual(expect.objectContaining({
      familyId: f.familyA._id.toString(),
      childId: f.childA1._id.toString(),
      parentNote: 'steady rhythm'
    }));
  });

  test('TC-T5-LOG-004 child creates only a self growth log', async () => {
    const f = await createTask5Fixtures();
    const path = '/api/growth-logs';
    const response = await request(app).post(path)
      .set(f.headers(f.childA1, 'POST', path))
      .send({
        childId: f.childA1._id,
        date: '2026-06-19',
        dimension: 'physical',
        content: 'jump rope',
        amount: 300,
        unit: 'count',
        childReflection: 'less tired today'
      });

    expect(response.status).toBe(201);
    expect(response.body.data.log.childReflection).toBe('less tired today');
  });

  test('TC-T5-LOG-005 route denies sibling and other-family child creation', async () => {
    const f = await createTask5Fixtures();
    const path = '/api/growth-logs';
    const response = await request(app).post(path)
      .set(f.headers(f.childA1, 'POST', path))
      .send({
        childId: f.childA2._id,
        date: '2026-06-19',
        dimension: 'moral',
        content: 'forged sibling log'
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CHILD_ACCESS_DENIED');
    expect(await GrowthLog.countDocuments()).toBe(0);

    const listPath = `/api/growth-logs?childId=${f.childA2._id}`;
    const listResponse = await request(app).get(listPath)
      .set(f.headers(f.childA1, 'GET', listPath));
    expect(listResponse.status).toBe(403);
    expect(listResponse.body.error.code).toBe('CHILD_ACCESS_DENIED');
  });

  test('TC-T5-LOG-006 child cannot create or patch parent and ownership fields', async () => {
    const f = await createTask5Fixtures();
    const createPath = '/api/growth-logs';
    const deniedCreate = await request(app).post(createPath)
      .set(f.headers(f.childA1, 'POST', createPath))
      .send({
        childId: f.childA1._id,
        date: '2026-06-19',
        dimension: 'academic',
        content: 'reading',
        parentNote: 'forged'
      });
    expect(deniedCreate.status).toBe(403);
    expect(deniedCreate.body.error.code).toBe('FIELD_ACCESS_DENIED');

    const log = await GrowthLog.create({
      familyId: f.familyA._id,
      childId: f.childA1._id,
      date: '2026-06-19',
      dimension: 'academic',
      content: 'reading',
      createdBy: f.parentA._id,
      updatedBy: f.parentA._id
    });
    const patchPath = `/api/growth-logs/${log._id}`;
    const deniedPatch = await request(app).patch(patchPath)
      .set(f.headers(f.childA1, 'PATCH', patchPath))
      .send({ parentNote: 'forged' });
    expect(deniedPatch.status).toBe(403);
    expect((await GrowthLog.findById(log._id)).parentNote).toBe('');
  });

  test('TC-T5-LOG-007 denies other-family read and patch', async () => {
    const f = await createTask5Fixtures();
    const log = await GrowthLog.create({
      familyId: f.familyA._id,
      childId: f.childA1._id,
      date: '2026-06-19',
      dimension: 'labor',
      content: 'clean room',
      createdBy: f.parentA._id,
      updatedBy: f.parentA._id
    });
    const listPath = `/api/growth-logs?childId=${f.childA1._id}`;
    const list = await request(app).get(listPath).set(f.headers(f.parentB, 'GET', listPath));
    expect(list.status).toBe(403);

    const patchPath = `/api/growth-logs/${log._id}`;
    const patch = await request(app).patch(patchPath)
      .set(f.headers(f.parentB, 'PATCH', patchPath)).send({ parentNote: 'intrusion' });
    expect(patch.status).toBe(403);
  });

  test('TC-T5-LOG-008 lists by inclusive dates, dimension and pagination', async () => {
    const f = await createTask5Fixtures();
    await GrowthLog.create([
      { familyId: f.familyA._id, childId: f.childA1._id, date: '2026-06-18', dimension: 'physical', content: 'run', createdBy: f.parentA._id, updatedBy: f.parentA._id },
      { familyId: f.familyA._id, childId: f.childA1._id, date: '2026-06-19', dimension: 'physical', content: 'jump', createdBy: f.parentA._id, updatedBy: f.parentA._id },
      { familyId: f.familyA._id, childId: f.childA1._id, date: '2026-06-19', dimension: 'academic', content: 'math', createdBy: f.parentA._id, updatedBy: f.parentA._id }
    ]);
    const path = `/api/growth-logs?childId=${f.childA1._id}&from=2026-06-18&to=2026-06-19&dimension=physical&page=1&pageSize=1`;
    const response = await request(app).get(path).set(f.headers(f.parentA, 'GET', path));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({ page: 1, pageSize: 1, total: 2 }));
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].dimension).toBe('physical');
  });

  test('TC-T5-LOG-009 parent and child patch only allowed fields', async () => {
    const f = await createTask5Fixtures();
    const log = await GrowthLog.create({
      familyId: f.familyA._id, childId: f.childA1._id, date: '2026-06-19',
      dimension: 'academic', content: 'math', createdBy: f.parentA._id, updatedBy: f.parentA._id
    });
    const path = `/api/growth-logs/${log._id}`;
    const childPatch = await request(app).patch(path)
      .set(f.headers(f.childA1, 'PATCH', path))
      .send({ durationMinutes: 30, childReflection: 'understood' });
    expect(childPatch.status).toBe(200);
    expect(childPatch.body.data.log.updatedBy).toBe(f.childA1._id.toString());

    const parentPatch = await request(app).patch(path)
      .set(f.headers(f.parentA, 'PATCH', path))
      .send({ parentNote: 'reviewed' });
    expect(parentPatch.status).toBe(200);
    expect(parentPatch.body.data.log.parentNote).toBe('reviewed');
  });

  test('TC-T5-LOG-010 returns stable validation errors', async () => {
    const f = await createTask5Fixtures();
    const paths = [
      `/api/growth-logs?childId=${f.childA1._id}&from=2026-06-20&to=2026-06-19`,
      `/api/growth-logs?childId=${f.childA1._id}&pageSize=101`,
      `/api/growth-logs?childId=${f.childA1._id}&dimension=unknown`
    ];
    for (const path of paths) {
      const response = await request(app).get(path).set(f.headers(f.parentA, 'GET', path));
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: expect.any(String), details: [] }
      });
    }
  });
});

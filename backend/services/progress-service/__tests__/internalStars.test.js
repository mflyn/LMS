process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET || 'test-gateway-identity-secret-32-bytes-long';
process.env.INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'test-internal-service-token-32-bytes';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../server');
const StarLedgerEntry = require('../models/StarLedgerEntry');
const { createTask5Fixtures } = require('./helpers/task5Fixtures');

describe('Task 5 internal stars', () => {
  beforeEach(async () => {
    await StarLedgerEntry.syncIndexes();
  });

  test('TC-T5-STAR-001 rejects missing, wrong and ordinary user credentials', async () => {
    const f = await createTask5Fixtures();
    const path = '/api/internal/stars/award';
    const payload = {
      familyId: f.familyA._id,
      childId: f.childA1._id,
      taskId: new mongoose.Types.ObjectId(),
      confirmedByParentId: f.parentA._id
    };
    const attempts = [
      request(app).post(path).send(payload),
      request(app).post(path).set('x-service-token', 'wrong-token').send(payload),
      request(app).post(path).set(f.headers(f.parentA, 'POST', path)).send(payload)
    ];
    for (const attempt of attempts) {
      const response = await attempt;
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_SERVICE_CREDENTIAL');
    }
    expect(await StarLedgerEntry.countDocuments()).toBe(0);
  });

  test('TC-T5-STAR-003 valid service command awards exactly one star', async () => {
    const f = await createTask5Fixtures();
    const path = '/api/internal/stars/award';
    const response = await request(app).post(path)
      .set('x-service-token', process.env.INTERNAL_SERVICE_TOKEN)
      .send({
        familyId: f.familyA._id,
        childId: f.childA1._id,
        taskId: new mongoose.Types.ObjectId(),
        confirmedByParentId: f.parentA._id
      });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({ awarded: true, starBalance: 1 }));
    expect(await StarLedgerEntry.countDocuments({ type: 'earn' })).toBe(1);
  });

  test('TC-T5-STAR-004 sequential replay returns original ledger without another earn', async () => {
    const f = await createTask5Fixtures();
    const path = '/api/internal/stars/award';
    const payload = {
      familyId: f.familyA._id,
      childId: f.childA1._id,
      taskId: new mongoose.Types.ObjectId(),
      confirmedByParentId: f.parentA._id
    };
    const first = await request(app).post(path).set('x-service-token', process.env.INTERNAL_SERVICE_TOKEN).send(payload);
    const replay = await request(app).post(path).set('x-service-token', process.env.INTERNAL_SERVICE_TOKEN).send(payload);
    expect(replay.status).toBe(200);
    expect(replay.body.data.awarded).toBe(false);
    expect(replay.body.data.ledgerEntryId).toBe(first.body.data.ledgerEntryId);
    expect(await StarLedgerEntry.countDocuments()).toBe(1);
  });

  test('TC-T5-STAR-005 concurrent replay creates one earn entry', async () => {
    const f = await createTask5Fixtures();
    const path = '/api/internal/stars/award';
    const payload = {
      familyId: f.familyA._id,
      childId: f.childA1._id,
      taskId: new mongoose.Types.ObjectId(),
      confirmedByParentId: f.parentA._id
    };
    const responses = await Promise.all(Array.from({ length: 5 }, () => (
      request(app).post(path).set('x-service-token', process.env.INTERNAL_SERVICE_TOKEN).send(payload)
    )));
    responses.forEach((response) => expect(response.status).toBe(200));
    expect(responses.filter((response) => response.body.data.awarded)).toHaveLength(1);
    expect(await StarLedgerEntry.countDocuments()).toBe(1);
  });

  test('TC-T5-STAR-006 rejects mismatched family, child and confirming parent', async () => {
    const f = await createTask5Fixtures();
    const path = '/api/internal/stars/award';
    const cases = [
      { familyId: f.familyB._id, childId: f.childA1._id, confirmedByParentId: f.parentB._id },
      { familyId: f.familyA._id, childId: f.childA1._id, confirmedByParentId: f.parentB._id }
    ];
    for (const values of cases) {
      const response = await request(app).post(path)
        .set('x-service-token', process.env.INTERNAL_SERVICE_TOKEN)
        .send({ ...values, taskId: new mongoose.Types.ObjectId() });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CHILD_ACCESS_DENIED');
    }
    const invalid = await request(app).post(path)
      .set('x-service-token', process.env.INTERNAL_SERVICE_TOKEN)
      .send({ familyId: 'invalid', childId: f.childA1._id, taskId: 'invalid', confirmedByParentId: f.parentA._id });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect(await StarLedgerEntry.countDocuments()).toBe(0);
  });

  test('TC-T5-STAR-007 ledger entries reject update and document delete', async () => {
    const entry = await StarLedgerEntry.create({
      familyId: new mongoose.Types.ObjectId(),
      childId: new mongoose.Types.ObjectId(),
      type: 'earn',
      amount: 1,
      sourceType: 'task_confirmation',
      sourceId: new mongoose.Types.ObjectId().toString(),
      createdBy: 'homework-service'
    });

    entry.amount = 99;
    await expect(entry.save()).rejects.toMatchObject({ code: 'IMMUTABLE_LEDGER_ENTRY' });
    await expect(entry.deleteOne()).rejects.toMatchObject({ code: 'IMMUTABLE_LEDGER_ENTRY' });
  });
});

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET || 'test-gateway-identity-secret-32-bytes-long';
process.env.INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'test-internal-service-token-32-bytes';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../server');
const Reward = require('../models/Reward');
const StarLedgerEntry = require('../models/StarLedgerEntry');
const StarLedgerGuard = require('../models/StarLedgerGuard');
const { createTask5Fixtures } = require('./helpers/task5Fixtures');

const seedStars = async (fixture, count) => {
  await StarLedgerEntry.create(Array.from({ length: count }, (_, index) => ({
    familyId: fixture.familyA._id,
    childId: fixture.childA1._id,
    type: 'earn',
    amount: 1,
    sourceType: 'task_confirmation',
    sourceId: new mongoose.Types.ObjectId().toString(),
    createdBy: `seed-${index}`
  })));
};

const createReward = (fixture, requiredStars = 3, title = 'Family activity') => Reward.create({
  familyId: fixture.familyA._id,
  childId: fixture.childA1._id,
  title,
  requiredStars,
  createdByParentId: fixture.parentA._id
});

describe('Task 5 rewards', () => {
  beforeEach(async () => {
    await Promise.all([Reward.syncIndexes(), StarLedgerEntry.syncIndexes(), StarLedgerGuard.syncIndexes()]);
  });

  test('classifies only serialization failures for outer transaction retry', () => {
    const { isRetryableTransactionError } = require('../services/starLedgerService');

    expect(isRetryableTransactionError({ code: 11000 })).toBe(true);
    expect(isRetryableTransactionError({
      hasErrorLabel: (label) => label === 'TransientTransactionError'
    })).toBe(true);
    expect(isRetryableTransactionError({ code: 'INSUFFICIENT_STARS' })).toBe(false);
  });

  test('TC-T5-REWARD-002 validates title and positive integer star cost', async () => {
    const base = {
      familyId: new mongoose.Types.ObjectId(),
      childId: new mongoose.Types.ObjectId(),
      createdByParentId: new mongoose.Types.ObjectId(),
      title: '',
      requiredStars: 1.5
    };

    await expect(new Reward(base).validate()).rejects.toMatchObject({ name: 'ValidationError' });
    await expect(new Reward({ ...base, title: 'x'.repeat(101), requiredStars: 0 }).validate())
      .rejects.toMatchObject({ name: 'ValidationError' });

    const f = await createTask5Fixtures();
    const path = '/api/rewards';
    for (const payload of [
      { childId: f.childA1._id, title: '', requiredStars: 1 },
      { childId: f.childA1._id, title: 'x'.repeat(101), requiredStars: 1 },
      { childId: f.childA1._id, title: 'Invalid cost', requiredStars: 0 },
      { childId: f.childA1._id, title: 'Invalid cost', requiredStars: 1.5 }
    ]) {
      const response = await request(app).post(path)
        .set(f.headers(f.parentA, 'POST', path))
        .send(payload);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('TC-T5-REWARD-001 parent creates an active reward with server ownership', async () => {
    const f = await createTask5Fixtures();
    const path = '/api/rewards';
    const response = await request(app).post(path)
      .set(f.headers(f.parentA, 'POST', path))
      .send({ childId: f.childA1._id, title: 'Choose a movie', requiredStars: 5 });
    expect(response.status).toBe(201);
    expect(response.body.data.reward).toEqual(expect.objectContaining({
      familyId: f.familyA._id.toString(), childId: f.childA1._id.toString(), status: 'active'
    }));
  });

  test('TC-T5-REWARD-003 denies child mutations and cross-family access', async () => {
    const f = await createTask5Fixtures();
    const createPath = '/api/rewards';
    const childCreate = await request(app).post(createPath)
      .set(f.headers(f.childA1, 'POST', createPath))
      .send({ childId: f.childA1._id, title: 'Forged', requiredStars: 1 });
    expect(childCreate.status).toBe(403);

    const reward = await createReward(f);
    const listPath = `/api/rewards?childId=${f.childA1._id}`;
    const crossList = await request(app).get(listPath).set(f.headers(f.parentB, 'GET', listPath));
    expect(crossList.status).toBe(403);

    const siblingList = await request(app).get(listPath).set(f.headers(f.childA2, 'GET', listPath));
    expect(siblingList.status).toBe(403);

    const redeemPath = `/api/rewards/${reward._id}/redeem`;
    const childRedeem = await request(app).patch(redeemPath)
      .set(f.headers(f.childA1, 'PATCH', redeemPath))
      .set('Idempotency-Key', 'child-forged-key')
      .send();
    expect(childRedeem.status).toBe(403);
  });

  test('TC-T5-REWARD-004 returns balance and independent reward and ledger pagination', async () => {
    const f = await createTask5Fixtures();
    await Promise.all([createReward(f, 2, 'A'), createReward(f, 3, 'B'), createReward(f, 4, 'C')]);
    await seedStars(f, 3);
    const path = `/api/rewards?childId=${f.childA1._id}&rewardPage=2&rewardPageSize=1&ledgerPage=1&ledgerPageSize=2`;
    const response = await request(app).get(path).set(f.headers(f.childA1, 'GET', path));
    expect(response.status).toBe(200);
    expect(response.body.data.starBalance).toBe(3);
    expect(response.body.data.rewards).toEqual(expect.objectContaining({ page: 2, pageSize: 1, total: 3 }));
    expect(response.body.data.rewards.items).toHaveLength(1);
    expect(response.body.data.ledger).toEqual(expect.objectContaining({ page: 1, pageSize: 2, total: 3 }));
    expect(response.body.data.ledger.items).toHaveLength(2);
  });

  test('TC-T5-REWARD-005 redeems in one transaction and updates balance', async () => {
    const f = await createTask5Fixtures();
    await seedStars(f, 5);
    const reward = await createReward(f, 3);
    const path = `/api/rewards/${reward._id}/redeem`;
    const response = await request(app).patch(path)
      .set(f.headers(f.parentA, 'PATCH', path)).set('Idempotency-Key', 'redeem-success').send();
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({ status: 'redeemed', spentStars: 3, starBalance: 2 }));
    expect(await StarLedgerEntry.countDocuments({ type: 'spend' })).toBe(1);
    expect((await Reward.findById(reward._id)).status).toBe('redeemed');
  });

  test('TC-T5-REWARD-006 insufficient balance writes nothing', async () => {
    const f = await createTask5Fixtures();
    await seedStars(f, 2);
    const reward = await createReward(f, 3);
    const path = `/api/rewards/${reward._id}/redeem`;
    const response = await request(app).patch(path)
      .set(f.headers(f.parentA, 'PATCH', path)).set('Idempotency-Key', 'insufficient-key').send();
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INSUFFICIENT_STARS');
    expect(await StarLedgerEntry.countDocuments({ type: 'spend' })).toBe(0);
    expect((await Reward.findById(reward._id)).status).toBe('active');
  });

  test('TC-T5-REWARD-007 same idempotency key returns the original success', async () => {
    const f = await createTask5Fixtures();
    await seedStars(f, 5);
    const reward = await createReward(f, 3);
    const path = `/api/rewards/${reward._id}/redeem`;
    const execute = () => request(app).patch(path)
      .set(f.headers(f.parentA, 'PATCH', path)).set('Idempotency-Key', 'same-success-key').send();
    const first = await execute();
    const replay = await execute();
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replay.body.data.ledgerEntryId).toBe(first.body.data.ledgerEntryId);
    expect(await StarLedgerEntry.countDocuments({ type: 'spend' })).toBe(1);
  });

  test('TC-T5-REWARD-007B same idempotency key replays from ledger if reward lookup misses', async () => {
    const f = await createTask5Fixtures();
    await seedStars(f, 5);
    const reward = await createReward(f, 3);
    const path = `/api/rewards/${reward._id}/redeem`;
    const first = await request(app).patch(path)
      .set(f.headers(f.parentA, 'PATCH', path))
      .set('Idempotency-Key', 'same-success-after-missing-reward')
      .send();
    expect(first.status).toBe(200);

    await Reward.deleteOne({ _id: reward._id });

    const replay = await request(app).patch(path)
      .set(f.headers(f.parentA, 'PATCH', path))
      .set('Idempotency-Key', 'same-success-after-missing-reward')
      .send();
    expect(replay.status).toBe(200);
    expect(replay.body.data).toEqual(expect.objectContaining({
      rewardId: reward._id.toString(),
      status: 'redeemed',
      spentStars: 3,
      ledgerEntryId: first.body.data.ledgerEntryId
    }));
    expect(await StarLedgerEntry.countDocuments({ type: 'spend' })).toBe(1);
  });

  test('TC-T5-REWARD-008 key reuse for another reward is rejected', async () => {
    const f = await createTask5Fixtures();
    await seedStars(f, 10);
    const firstReward = await createReward(f, 2, 'First');
    const secondReward = await createReward(f, 2, 'Second');
    const key = 'cross-operation-key';
    const firstPath = `/api/rewards/${firstReward._id}/redeem`;
    await request(app).patch(firstPath).set(f.headers(f.parentA, 'PATCH', firstPath)).set('Idempotency-Key', key).send().expect(200);
    const secondPath = `/api/rewards/${secondReward._id}/redeem`;
    const response = await request(app).patch(secondPath)
      .set(f.headers(f.parentA, 'PATCH', secondPath)).set('Idempotency-Key', key).send();
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect((await Reward.findById(secondReward._id)).status).toBe('active');
  });

  test('TC-T5-REWARD-009 validates the idempotency header', async () => {
    const f = await createTask5Fixtures();
    const reward = await createReward(f, 1);
    const path = `/api/rewards/${reward._id}/redeem`;
    for (const key of [null, '   ', '\u00a0\u00a0', 'x'.repeat(129)]) {
      let call = request(app).patch(path).set(f.headers(f.parentA, 'PATCH', path));
      if (key) call = call.set('Idempotency-Key', key);
      const response = await call.send();
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('TC-T5-REWARD-012 normalizes the idempotency key before validation and persistence', async () => {
    const f = await createTask5Fixtures();
    await seedStars(f, 5);
    const reward = await createReward(f, 3);
    const path = `/api/rewards/${reward._id}/redeem`;
    const first = await request(app).patch(path)
      .set(f.headers(f.parentA, 'PATCH', path))
      .set('Idempotency-Key', '\u00a0normalized-key\u00a0')
      .send();
    const replay = await request(app).patch(path)
      .set(f.headers(f.parentA, 'PATCH', path))
      .set('Idempotency-Key', 'normalized-key')
      .send();

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replay.body.data.ledgerEntryId).toBe(first.body.data.ledgerEntryId);
    expect(await StarLedgerEntry.countDocuments({ type: 'spend' })).toBe(1);
  });

  test('TC-T5-REWARD-010 transaction rollback removes an inserted spend', async () => {
    const { redeemReward } = require('../services/starLedgerService');
    const f = await createTask5Fixtures();
    await seedStars(f, 5);
    const reward = await createReward(f, 3);
    await expect(redeemReward({
      familyId: f.familyA._id,
      childId: f.childA1._id,
      rewardId: reward._id,
      parentId: f.parentA._id,
      idempotencyKey: 'rollback-key',
      hooks: { afterSpend: () => { throw new Error('forced rollback'); } }
    })).rejects.toThrow('forced rollback');
    expect(await StarLedgerEntry.countDocuments({ type: 'spend' })).toBe(0);
    expect((await Reward.findById(reward._id)).status).toBe('active');
  });

  test('TC-T5-REWARD-011 concurrent different rewards cannot overspend', async () => {
    const f = await createTask5Fixtures();
    await seedStars(f, 5);
    const firstReward = await createReward(f, 4, 'First concurrent');
    const secondReward = await createReward(f, 4, 'Second concurrent');
    const redeem = (reward, key) => {
      const path = `/api/rewards/${reward._id}/redeem`;
      return request(app).patch(path).set(f.headers(f.parentA, 'PATCH', path)).set('Idempotency-Key', key).send();
    };
    const responses = await Promise.all([
      redeem(firstReward, 'concurrent-first'),
      redeem(secondReward, 'concurrent-second')
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await StarLedgerEntry.countDocuments({ type: 'spend' })).toBe(1);
    const balance = await require('../services/starLedgerService').calculateBalance({
      familyId: f.familyA._id, childId: f.childA1._id
    });
    expect(balance).toBe(1);
  });
});

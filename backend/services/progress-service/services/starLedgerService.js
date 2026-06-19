const StarLedgerEntry = require('../models/StarLedgerEntry');
const StarLedgerGuard = require('../models/StarLedgerGuard');
const Reward = require('../models/Reward');
const mongoose = require('mongoose');

const domainError = (code, message, status = 409) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
};

const isRetryableTransactionError = (error) => error.code === 11000
  || (typeof error.hasErrorLabel === 'function' && error.hasErrorLabel('TransientTransactionError'));

const calculateBalance = async ({ familyId, childId, session } = {}) => {
  const aggregation = StarLedgerEntry.aggregate([
    { $match: { familyId, childId } },
    {
      $group: {
        _id: null,
        balance: {
          $sum: {
            $cond: [{ $eq: ['$type', 'spend'] }, { $multiply: ['$amount', -1] }, '$amount']
          }
        }
      }
    }
  ]);
  if (session) aggregation.session(session);
  const [result] = await aggregation;
  return result ? result.balance : 0;
};

const awardTaskStar = async ({ familyId, childId, taskId }) => {
  const sourceId = taskId.toString();
  const query = { familyId, childId, sourceType: 'task_confirmation', sourceId, type: 'earn' };
  let entry = await StarLedgerEntry.findOne(query);
  let awarded = false;

  if (!entry) {
    try {
      entry = await StarLedgerEntry.create({
        ...query,
        amount: 1,
        createdBy: 'homework-service'
      });
      awarded = true;
    } catch (error) {
      if (error.code !== 11000) throw error;
      entry = await StarLedgerEntry.findOne(query);
      if (!entry) throw error;
    }
  }

  const starBalance = await calculateBalance({ familyId, childId });
  return { awarded, entry, starBalance };
};

const runRedemptionTransaction = async ({
  familyId,
  childId,
  rewardId,
  parentId,
  idempotencyKey,
  hooks,
  session
}) => {
  let result;
  await session.withTransaction(async () => {
    const reward = await Reward.findOne({ _id: rewardId, familyId, childId }).session(session);
    if (!reward) throw domainError('RESOURCE_NOT_FOUND', 'Reward not found', 404);

    const existing = await StarLedgerEntry.findOne({ familyId, childId, idempotencyKey }).session(session);
    if (existing) {
      if (existing.sourceType !== 'reward_redemption' || existing.sourceId !== rewardId.toString()) {
        throw domainError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key belongs to another operation');
      }
      const starBalance = await calculateBalance({ familyId, childId, session });
      result = { reward, entry: existing, starBalance, replayed: true };
      return;
    }

    await StarLedgerGuard.findOneAndUpdate(
      { familyId, childId },
      { $inc: { version: 1 } },
      { upsert: true, new: true, session, setDefaultsOnInsert: true }
    );

    if (reward.status !== 'active') {
      throw domainError('REWARD_STATE_CONFLICT', 'Only active rewards can be redeemed');
    }
    const balance = await calculateBalance({ familyId, childId, session });
    if (balance < reward.requiredStars) {
      throw domainError('INSUFFICIENT_STARS', 'Insufficient stars');
    }

    const [entry] = await StarLedgerEntry.create([{
      familyId,
      childId,
      type: 'spend',
      amount: reward.requiredStars,
      sourceType: 'reward_redemption',
      sourceId: reward._id.toString(),
      idempotencyKey,
      createdBy: parentId.toString()
    }], { session });

    if (hooks && hooks.afterSpend) await hooks.afterSpend({ entry, reward, session });

    const redeemed = await Reward.findOneAndUpdate(
      { _id: reward._id, familyId, childId, status: 'active' },
      { $set: { status: 'redeemed', redeemedAt: new Date(), redeemedByParentId: parentId } },
      { new: true, session }
    );
    if (!redeemed) throw domainError('REWARD_STATE_CONFLICT', 'Reward state changed during redemption');
    result = { reward: redeemed, entry, starBalance: balance - reward.requiredStars, replayed: false };
  }, {
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' }
  });
  return result;
};

const redeemReward = async (options) => {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      return await runRedemptionTransaction({ ...options, session });
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === 3) throw error;
    } finally {
      await session.endSession();
    }
  }
  throw lastError;
};

module.exports = { awardTaskStar, calculateBalance, isRetryableTransactionError, redeemReward };

const StarLedgerEntry = require('../models/StarLedgerEntry');

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

module.exports = { awardTaskStar, calculateBalance };

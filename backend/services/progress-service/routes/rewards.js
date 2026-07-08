const express = require('express');
const mongoose = require('mongoose');
const Reward = require('../models/Reward');
const StarLedgerEntry = require('../models/StarLedgerEntry');
const { authenticateGateway } = require('../../../common/middleware/auth');
const { sendFamilyError } = require('../../../common/utils/familyResponse');
const { logFamilyOperation } = require('../../../common/utils/familyAudit');
const { requireParentChild, resolveChildAccess } = require('../services/growthAccess');
const { calculateBalance, redeemReward } = require('../services/starLedgerService');

const router = express.Router();
const sendError = (res, status, code, message) => sendFamilyError(res, status, code, message);
const parsePage = (query, pageKey, sizeKey) => {
  const page = Number(query[pageKey] || 1);
  const pageSize = Number(query[sizeKey] || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    const error = new Error(`${pageKey} and ${sizeKey} are invalid`);
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return { page, pageSize, skip: (page - 1) * pageSize };
};
const rewardView = (reward) => ({
  rewardId: reward._id.toString(),
  familyId: reward.familyId.toString(),
  childId: reward.childId.toString(),
  title: reward.title,
  requiredStars: reward.requiredStars,
  status: reward.status,
  createdByParentId: reward.createdByParentId.toString(),
  redeemedAt: reward.redeemedAt,
  redeemedByParentId: reward.redeemedByParentId ? reward.redeemedByParentId.toString() : undefined,
  createdAt: reward.createdAt,
  updatedAt: reward.updatedAt
});
const ledgerView = (entry) => ({
  ledgerEntryId: entry._id.toString(),
  type: entry.type,
  amount: entry.amount,
  sourceType: entry.sourceType,
  sourceId: entry.sourceId,
  createdAt: entry.createdAt
});

const replayRedeemedReward = async ({ req, res, rewardId, idempotencyKey }) => {
  const entry = await StarLedgerEntry.findOne({
    type: 'spend',
    sourceType: 'reward_redemption',
    sourceId: rewardId,
    idempotencyKey
  });
  if (!entry) return sendError(res, 404, 'RESOURCE_NOT_FOUND', 'Reward not found');

  const access = await requireParentChild(req.user, entry.childId.toString());
  if (!access || access.familyId.toString() !== entry.familyId.toString()) {
    return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot access this reward');
  }

  const starBalance = await calculateBalance({ familyId: entry.familyId, childId: entry.childId });
  logFamilyOperation(req, {
    operation: 'reward.redeem', result: 'replayed',
    familyId: entry.familyId.toString(), childId: entry.childId.toString(),
    rewardId
  });
  return res.json({
    success: true,
    data: {
      rewardId,
      status: 'redeemed',
      spentStars: entry.amount,
      starBalance,
      ledgerEntryId: entry._id.toString(),
      redeemedAt: entry.createdAt
    }
  });
};

router.post('/', authenticateGateway, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Only parents can create rewards');
    }
    if (Object.keys(req.body).some((field) => !['childId', 'title', 'requiredStars'].includes(field))) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Request contains unsupported fields');
    }
    const { childId, title, requiredStars } = req.body;
    if (!childId || !title || requiredStars === undefined) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'childId, title and requiredStars are required');
    }
    const access = await requireParentChild(req.user, childId);
    if (!access) return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot access this child');
    const reward = await Reward.create({
      familyId: access.familyId,
      childId,
      title,
      requiredStars,
      createdByParentId: req.user.id
    });
    logFamilyOperation(req, {
      operation: 'reward.create', result: 'created', familyId: reward.familyId.toString(),
      childId: reward.childId.toString(), rewardId: reward._id.toString()
    });
    return res.status(201).json({ success: true, data: { reward: rewardView(reward) } });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return sendError(res, 400, 'VALIDATION_ERROR', error.message);
    }
    return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
});

router.get('/', authenticateGateway, async (req, res) => {
  try {
    if (req.user.role === 'student' && req.query.childId
      && req.query.childId.toString() !== (req.user.childId || req.user.id).toString()) {
      return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot list another child rewards');
    }
    const childId = req.user.role === 'student' ? req.user.childId || req.user.id : req.query.childId;
    if (!childId) return sendError(res, 400, 'VALIDATION_ERROR', 'childId is required');
    const access = await resolveChildAccess(req.user, childId);
    if (!access) return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot access this child');
    if (req.query.status && !['active', 'redeemed', 'disabled'].includes(req.query.status)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid reward status');
    }
    let rewardPage;
    let ledgerPage;
    try {
      rewardPage = parsePage(req.query, 'rewardPage', 'rewardPageSize');
      ledgerPage = parsePage(req.query, 'ledgerPage', 'ledgerPageSize');
    } catch (error) {
      return sendError(res, 400, error.code, error.message);
    }
    const rewardQuery = { familyId: access.familyId, childId };
    if (req.query.status) rewardQuery.status = req.query.status;
    const ledgerQuery = { familyId: access.familyId, childId };
    const [rewards, rewardTotal, ledger, ledgerTotal, starBalance] = await Promise.all([
      Reward.find(rewardQuery).sort({ createdAt: -1 }).skip(rewardPage.skip).limit(rewardPage.pageSize),
      Reward.countDocuments(rewardQuery),
      StarLedgerEntry.find(ledgerQuery).sort({ createdAt: -1 }).skip(ledgerPage.skip).limit(ledgerPage.pageSize),
      StarLedgerEntry.countDocuments(ledgerQuery),
      calculateBalance({ familyId: access.familyId, childId: access.child._id })
    ]);
    return res.json({
      success: true,
      data: {
        starBalance,
        rewards: {
          items: rewards.map(rewardView), page: rewardPage.page,
          pageSize: rewardPage.pageSize, total: rewardTotal
        },
        ledger: {
          items: ledger.map(ledgerView), page: ledgerPage.page,
          pageSize: ledgerPage.pageSize, total: ledgerTotal
        }
      }
    });
  } catch (error) {
    return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
});

router.patch('/:rewardId/redeem', authenticateGateway, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Only parents can redeem rewards');
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.rewardId)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid rewardId');
    }
    const idempotencyKey = req.get('Idempotency-Key')?.trim();
    if (!idempotencyKey || idempotencyKey.length > 128) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Idempotency-Key is required and must not exceed 128 characters');
    }
    const reward = await Reward.findById(req.params.rewardId);
    if (!reward) {
      return replayRedeemedReward({
        req,
        res,
        rewardId: req.params.rewardId,
        idempotencyKey
      });
    }
    const access = await requireParentChild(req.user, reward.childId.toString());
    if (!access || access.familyId.toString() !== reward.familyId.toString()) {
      return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Cannot access this reward');
    }
    const result = await redeemReward({
      familyId: reward.familyId,
      childId: reward.childId,
      rewardId: reward._id,
      parentId: req.user.id,
      idempotencyKey
    });
    logFamilyOperation(req, {
      operation: 'reward.redeem', result: result.replayed ? 'replayed' : 'redeemed',
      familyId: reward.familyId.toString(), childId: reward.childId.toString(),
      rewardId: reward._id.toString()
    });
    return res.json({
      success: true,
      data: {
        rewardId: result.reward._id.toString(),
        status: result.reward.status,
        spentStars: result.entry.amount,
        starBalance: result.starBalance,
        ledgerEntryId: result.entry._id.toString(),
        redeemedAt: result.reward.redeemedAt
      }
    });
  } catch (error) {
    if (error.code && error.status) return sendError(res, error.status, error.code, error.message);
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return sendError(res, 400, 'VALIDATION_ERROR', error.message);
    }
    return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
});

module.exports = router;
module.exports.ledgerView = ledgerView;
module.exports.rewardView = rewardView;

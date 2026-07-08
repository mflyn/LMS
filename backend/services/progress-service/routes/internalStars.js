const express = require('express');
const mongoose = require('mongoose');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const { sendFamilyError } = require('../../../common/utils/familyResponse');
const { logFamilyOperation } = require('../../../common/utils/familyAudit');
const { createServiceCredentialMiddleware } = require('../middleware/serviceCredential');
const { awardTaskStar } = require('../services/starLedgerService');

const router = express.Router();
const sendError = (res, status, code, message) => sendFamilyError(res, status, code, message);

router.post('/award', createServiceCredentialMiddleware(), async (req, res) => {
  try {
    const { familyId, childId, taskId, confirmedByParentId } = req.body;
    if (![familyId, childId, taskId, confirmedByParentId].every(mongoose.Types.ObjectId.isValid)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Valid familyId, childId, taskId and confirmedByParentId are required');
    }
    const [family, child] = await Promise.all([
      Family.findOne({
        _id: familyId,
        childIds: childId,
        $or: [{ ownerParentId: confirmedByParentId }, { memberParentIds: confirmedByParentId }]
      }),
      User.findOne({ _id: childId, familyId, role: 'student' })
    ]);
    if (!family || !child) {
      return sendError(res, 403, 'CHILD_ACCESS_DENIED', 'Family, child or confirming parent does not match');
    }
    const result = await awardTaskStar({
      familyId: family._id,
      childId: child._id,
      taskId
    });
    logFamilyOperation(req, {
      operation: 'star.award', result: result.awarded ? 'awarded' : 'replayed',
      familyId: family._id.toString(), childId: child._id.toString(), taskId
    });
    return res.json({
      success: true,
      data: {
        awarded: result.awarded,
        ledgerEntryId: result.entry._id.toString(),
        starBalance: result.starBalance
      }
    });
  } catch (error) {
    return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
});

module.exports = router;

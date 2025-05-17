const express = require('express');
const router = express.Router();
const MeetingService = require('../services/meetingService');
const {
  validateMongoId,
  validateGetMeetings,
  validateCreateMeeting,
  validateUpdateMeeting
} = require('../validators/meetingValidators');
const { authenticateGateway, checkRole } = require('../../../common/middleware/auth');
const { USER_ROLES } = require('../../../common/constants/userRoles');
const catchAsync = require('../../../common/utils/catchAsync');
const AppResponse = require('../../../common/utils/AppResponse');
const { body, query } = require('express-validator'); // For cancel reason validation
const { validateResult } = require('../../../common/middleware/requestValidator'); // For cancel reason validation

const meetingService = new MeetingService();

// 获取会议列表
router.get(
  '/',
  authenticateGateway,
  validateGetMeetings,
  catchAsync(async (req, res) => {
    const result = await meetingService.getMeetings(req.query, req.user);
    new AppResponse(res, result).send();
  })
);

// 获取单个会议
router.get(
  '/:id',
  authenticateGateway,
  validateMongoId('id'),
  catchAsync(async (req, res) => {
    const meeting = await meetingService.getMeetingById(req.params.id, req.user);
    new AppResponse(res, meeting).send();
  })
);

// 创建会议
router.post(
  '/',
  authenticateGateway,
  checkRole([USER_ROLES.ADMIN, USER_ROLES.TEACHER]),
  validateCreateMeeting,
  catchAsync(async (req, res) => {
    const meeting = await meetingService.createMeeting(req.body, req.user);
    new AppResponse(res, meeting, '会议创建成功', 201).send();
  })
);

// 更新会议 (包括状态更新等)
router.put(
  '/:id',
  authenticateGateway,
  validateMongoId('id'),
  validateUpdateMeeting, // This handles general updates including status if provided
  catchAsync(async (req, res) => {
    const meeting = await meetingService.updateMeeting(req.params.id, req.body, req.user);
    new AppResponse(res, meeting, '会议更新成功').send();
  })
);

// 取消会议
router.put(
  '/:id/cancel',
  authenticateGateway,
  validateMongoId('id'),
  [
    body('reason').optional().isString().trim().withMessage('取消原因必须是字符串'),
    validateResult
  ],
  catchAsync(async (req, res) => {
    const meeting = await meetingService.cancelMeeting(req.params.id, req.user, req.body.reason);
    new AppResponse(res, meeting, '会议已取消').send();
  })
);

// 确认会议
router.put(
  '/:id/confirm',
  authenticateGateway,
  validateMongoId('id'),
  catchAsync(async (req, res) => {
    const meeting = await meetingService.confirmMeeting(req.params.id, req.user);
    new AppResponse(res, meeting, '会议已确认').send();
  })
);

// 获取当前用户即将开始的会议 (待确认或已确认)
router.get(
  '/me/upcoming',
  authenticateGateway,
  // No specific validator needed beyond what getMeetings handles for query params like limit
  // validateGetMeetings, // We can reuse this if we want to allow all its filters
  [
    query('limit').optional().isInt({ min: 1 }).toInt().withMessage('limit 必须是正整数'),
    query('daysAhead').optional().isInt({min: 0}).toInt().withMessage('daysAhead 必须是非负整数'),
    validateResult
  ],
  catchAsync(async (req, res) => {
    const now = new Date();
    const { limit, daysAhead } = req.query;
    let requestedStatus = req.query.status;

    const queryForService = {
      startDate: now.toISOString(),
    };
    if (limit) queryForService.limit = limit;

    if (daysAhead !== undefined) {
        const endDate = new Date(now);
        endDate.setDate(now.getDate() + parseInt(daysAhead, 10)); // Ensure daysAhead is integer
        queryForService.endDate = endDate.toISOString();
    }
    
    if (requestedStatus) {
        queryForService.status = requestedStatus;
    } else {
        // Default to PENDING and CONFIRMED for upcoming meetings
        queryForService.status = `${MEETING_STATUS.PENDING},${MEETING_STATUS.CONFIRMED}`;
    }

    const result = await meetingService.getMeetings(queryForService, req.user);
    new AppResponse(res, result).send();
  })
);

module.exports = router;
const { body, query, param } = require('express-validator');
const { USER_ROLES } = require('../../../common/constants/userRoles'); // Assuming this path is correct
const { MEETING_STATUS, MEETING_TYPES } = require('../../../common/constants/meetingConstants'); // Need to create this
const { validateResult } = require('../../../common/middleware/requestValidator');

const validateMongoId = (field = 'id', location = 'param') => {
  const check = location === 'body' ? body : (location === 'query' ? query : param);
  return [
    check(field).isMongoId().withMessage(`${field} 必须是有效的 MongoDB ID`),
    validateResult
  ];
};

const validateGetMeetings = [
  query('teacherId').optional().isMongoId().withMessage('teacherId 必须是有效的 MongoDB ID'),
  query('parentId').optional().isMongoId().withMessage('parentId 必须是有效的 MongoDB ID'),
  query('studentId').optional().isMongoId().withMessage('studentId 必须是有效的 MongoDB ID'),
  query('startDate').optional().isISO8601().toDate().withMessage('startDate 必须是有效的 ISO8601 日期'),
  query('endDate').optional().isISO8601().toDate().withMessage('endDate 必须是有效的 ISO8601 日期')
    .custom((value, { req }) => {
      if (req.query.startDate && value < req.query.startDate) {
        throw new Error('endDate 不能早于 startDate');
      }
      return true;
    }),
  query('status').optional().isIn(Object.values(MEETING_STATUS)).withMessage(`status 必须是以下值之一: ${Object.values(MEETING_STATUS).join(', ')}`),
  query('limit').optional().isInt({ min: 1 }).toInt().withMessage('limit 必须是正整数'),
  query('skip').optional().isInt({ min: 0 }).toInt().withMessage('skip 必须是非负整数'),
  validateResult
];

const validateCreateMeeting = [
  body('title').notEmpty().withMessage('标题不能为空').trim(),
  body('description').optional().trim(),
  body('teacherId').isMongoId().withMessage('teacherId 必须是有效的 MongoDB ID'),
  body('parentId').isMongoId().withMessage('parentId 必须是有效的 MongoDB ID'),
  body('studentId').isMongoId().withMessage('studentId 必须是有效的 MongoDB ID'),
  body('startTime').isISO8601().toDate().withMessage('startTime 必须是有效的 ISO8601 日期时间'),
  body('endTime').isISO8601().toDate().withMessage('endTime 必须是有效的 ISO8601 日期时间')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startTime)) {
        throw new Error('endTime 必须晚于 startTime');
      }
      return true;
    }),
  body('location').optional().trim(),
  body('meetingType').optional().isIn(Object.values(MEETING_TYPES)).withMessage(`meetingType 必须是以下值之一: ${Object.values(MEETING_TYPES).join(', ')}`),
  body('meetingLink').optional().trim()
    .if(body('meetingType').equals(MEETING_TYPES.ONLINE))
    .isURL().withMessage('线上会议的 meetingLink 必须是有效的 URL'),
  body('notes').optional().trim(),
  validateResult
];

const validateUpdateMeeting = [
  body('title').optional().notEmpty().withMessage('标题不能为空').trim(),
  body('description').optional().trim(),
  body('startTime').optional().isISO8601().toDate().withMessage('startTime 必须是有效的 ISO8601 日期时间'),
  body('endTime').optional().isISO8601().toDate().withMessage('endTime 必须是有效的 ISO8601 日期时间')
    .custom((value, { req }) => {
      const startTime = req.body.startTime ? new Date(req.body.startTime) : null;
      // Only validate if both startTime and endTime are present in the request or one is present and the other exists on the meeting being updated (service layer concern)
      // For validator, if both are given, endTime must be after startTime.
      if (startTime && new Date(value) <= startTime) {
        throw new Error('endTime 必须晚于 startTime');
      }
      return true;
    }),
  body('location').optional().trim(),
  body('meetingType').optional().isIn(Object.values(MEETING_TYPES)).withMessage(`meetingType 必须是以下值之一: ${Object.values(MEETING_TYPES).join(', ')}`),
  body('meetingLink').optional().trim()
    .if(body('meetingType').equals(MEETING_TYPES.ONLINE))
    .isURL().withMessage('线上会议的 meetingLink 必须是有效的 URL'),
  body('status').optional().isIn(Object.values(MEETING_STATUS)).withMessage(`status 必须是以下值之一: ${Object.values(MEETING_STATUS).join(', ')}`),
  body('notes').optional().trim(),
  validateResult
];

module.exports = {
  validateMongoId,
  validateGetMeetings,
  validateCreateMeeting,
  validateUpdateMeeting
}; 
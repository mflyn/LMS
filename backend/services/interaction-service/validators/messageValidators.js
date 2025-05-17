const { body, query, param } = require('express-validator');
const mongoose = require('mongoose');

const isValidMongoId = (value) => {
  if (!value) return true; // Allow optional IDs, presence checked by notEmpty()
  return mongoose.Types.ObjectId.isValid(value);
};

const getMessagesValidationRules = () => [
  query('contactId').optional().custom(isValidMongoId).withMessage('contactId 必须是有效的 MongoDB ObjectId'),
  query('startDate').optional().isISO8601().toDate().withMessage('startDate 必须是有效的 ISO8601 日期格式'),
  query('endDate').optional().isISO8601().toDate().withMessage('endDate 必须是有效的 ISO8601 日期格式'),
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('page 必须是大于0的整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('limit 必须是1到100之间的整数'),
  query('sortBy').optional().isIn(['-createdAt', 'createdAt', '-updatedAt', 'updatedAt']).withMessage('sortBy 必须是 createdAt 或 updatedAt，可带 - 前缀'),
  // sortOrder is implicitly handled by sortBy prefix, or could be separate enum if sortBy does not have prefix
];

const messageIdValidationRules = () => [
  param('id').custom(isValidMongoId).withMessage('消息ID格式无效').notEmpty().withMessage('消息ID不能为空'),
];

const sendMessageValidationRules = () => [
  body('receiver').notEmpty().withMessage('接收者ID不能为空').custom(isValidMongoId).withMessage('接收者ID格式无效'),
  body('content').notEmpty().withMessage('消息内容不能为空').isString().trim().isLength({ min: 1, max: 5000 }).withMessage('消息内容长度必须在1到5000字符之间'),
  body('attachments').optional().isArray().withMessage('attachments 必须是一个数组'),
  body('attachments.*.name').optional().isString().withMessage('附件名称必须是字符串'),
  body('attachments.*.url').optional().isURL().withMessage('附件URL格式无效'),
  body('attachments.*.fileType').optional().isString().withMessage('附件类型必须是字符串'),
  body('attachments.*.size').optional().isNumeric().withMessage('附件大小必须是数字'),
];

const getUnreadStatsValidationRules = () => [
    query('userId').notEmpty().withMessage('用户ID不能为空').custom(isValidMongoId).withMessage('用户ID格式无效')
];


module.exports = {
  getMessagesValidationRules,
  messageIdValidationRules,
  sendMessageValidationRules,
  getUnreadStatsValidationRules,
}; 
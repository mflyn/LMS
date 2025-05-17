const { body, query, param } = require('express-validator');
const mongoose = require('mongoose');

const isValidMongoId = (value) => {
  if (!value) return true; // Allow optional, presence checked by notEmpty()
  return mongoose.Types.ObjectId.isValid(value);
};

const commonClassIdValidation = (field = 'classId', location = query) => {
  const validator = location(field);
  return validator.optional().custom(isValidMongoId).withMessage(`${field} 必须是有效的 MongoDB ObjectId`);
};

const getAnnouncementsValidationRules = () => [
  commonClassIdValidation('classId', query),
  query('startDate').optional().isISO8601().toDate().withMessage('startDate 必须是有效的 ISO8601 日期格式'),
  query('endDate').optional().isISO8601().toDate().withMessage('endDate 必须是有效的 ISO8601 日期格式'),
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('page 必须是大于0的整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('limit 必须是1到100之间的整数'),
  query('sortBy').optional().isIn(['-createdAt', 'createdAt', '-updatedAt', 'updatedAt']).withMessage('sortBy 必须是 createdAt 或 updatedAt，可带 - 前缀'),
];

const announcementIdValidationRules = () => [
  param('id').custom(isValidMongoId).withMessage('公告ID格式无效').notEmpty().withMessage('公告ID不能为空'),
];

const classIdParamValidationRules = () => [
  param('classId').custom(isValidMongoId).withMessage('班级ID格式无效').notEmpty().withMessage('班级ID不能为空'),
];

const createAnnouncementValidationRules = () => [
  body('title').notEmpty().withMessage('标题不能为空').isString().trim().isLength({ min: 1, max: 255 }).withMessage('标题长度必须在1到255字符之间'),
  body('content').notEmpty().withMessage('内容不能为空').isString().trim().isLength({ min: 1 }).withMessage('内容不能为空'),
  body('classId').notEmpty().withMessage('班级ID不能为空').custom(isValidMongoId).withMessage('班级ID格式无效'),
  body('attachments').optional().isArray().withMessage('attachments 必须是一个数组'),
  body('attachments.*.name').optional().isString().notEmpty().withMessage('附件名称不能为空'),
  body('attachments.*.url').optional().isURL().withMessage('附件URL格式无效'),
  body('attachments.*.fileType').optional().isString(),
  body('attachments.*.size').optional().isNumeric(),
];

const updateAnnouncementValidationRules = () => [
  body('title').optional().isString().trim().isLength({ min: 1, max: 255 }).withMessage('标题长度必须在1到255字符之间'),
  body('content').optional().isString().trim().isLength({ min: 1 }).withMessage('内容不能为空'),
  // classId and author are generally not updatable here
  body('attachments').optional().isArray().withMessage('attachments 必须是一个数组'),
  body('attachments.*.name').optional().isString().notEmpty().withMessage('附件名称不能为空'),
  body('attachments.*.url').optional().isURL().withMessage('附件URL格式无效'),
  body('attachments.*.fileType').optional().isString(),
  body('attachments.*.size').optional().isNumeric(),
];

const latestAnnouncementsQueryValidationRules = () => [
    query('limit').optional().isInt({min: 1, max: 20}).toInt().withMessage('limit 必须是1到20之间的整数')
];

module.exports = {
  getAnnouncementsValidationRules,
  announcementIdValidationRules,
  createAnnouncementValidationRules,
  updateAnnouncementValidationRules,
  classIdParamValidationRules,
  latestAnnouncementsQueryValidationRules,
}; 
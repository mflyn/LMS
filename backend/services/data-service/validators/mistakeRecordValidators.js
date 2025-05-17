const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

const isValidMongoId = (id) => mongoose.Types.ObjectId.isValid(id);

const mongoIdParamValidation = (fieldName = 'id') => [
  param(fieldName).custom((value) => {
    if (!isValidMongoId(value)) {
      throw new Error(`${fieldName} 必须是有效的 MongoDB ObjectId`);
    }
    return true;
  }),
];

const mistakeRecordQueryValidationRules = () => [
  query('subject').optional().custom(isValidMongoId).withMessage('科目ID必须是有效的 ObjectId'),
  query('status').optional().isIn(['unresolved', 'reviewing', 'resolved', 'archived']).withMessage('无效的错题状态'),
  query('tags').optional().isString().withMessage('标签必须是字符串格式，多个标签请用逗号分隔'), // Assuming tags are comma-separated string for query
  query('dateFrom').optional().isISO8601().toDate().withMessage('dateFrom 必须是有效的日期格式'),
  query('dateTo').optional().isISO8601().toDate().withMessage('dateTo 必须是有效的日期格式'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('limit 必须是1-100之间的整数'),
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('page 必须是大于0的整数'),
  query('sortBy').optional().isIn(['createdAt', 'resolvedDate', 'status']).withMessage('无效的排序字段'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('无效的排序顺序'),
];

const createMistakeRecordValidationRules = () => [
  body('student').notEmpty().withMessage('学生ID不能为空').custom(isValidMongoId).withMessage('学生ID必须是有效的 ObjectId'),
  body('subject').notEmpty().withMessage('科目ID不能为空').custom(isValidMongoId).withMessage('科目ID必须是有效的 ObjectId'),
  body('question').notEmpty().withMessage('问题描述不能为空').isString().trim(),
  body('answer').optional().isString().trim(),
  body('correctAnswer').notEmpty().withMessage('正确答案不能为空').isString().trim(),
  body('analysis').optional().isString().trim(),
  body('tags').optional().isArray().withMessage('标签必须是一个数组')
    .custom(tags => tags.every(tag => typeof tag === 'string' && tag.trim() !== '')).withMessage('所有标签都必须是非空字符串'),
  body('source').optional().isString().trim(),
  body('status').optional().isIn(['unresolved', 'reviewing', 'resolved', 'archived']).withMessage('无效的错题状态'),
  // resolvedDate will be set by service logic if status is 'resolved'
  // recordedBy will be set from req.user.id
];

const updateMistakeRecordValidationRules = () => [
  body('question').optional().isString().trim(),
  body('answer').optional({ nullable: true }).isString().trim(),
  body('correctAnswer').optional().isString().trim(),
  body('analysis').optional({ nullable: true }).isString().trim(),
  body('tags').optional().isArray().withMessage('标签必须是一个数组')
    .custom(tags => tags.every(tag => typeof tag === 'string' && tag.trim() !== '')).withMessage('所有标签都必须是非空字符串'),
  body('source').optional({ nullable: true }).isString().trim(),
  body('status').optional().isIn(['unresolved', 'reviewing', 'resolved', 'archived']).withMessage('无效的错题状态'),
  body('resolvedDate').optional({ nullable: true }).isISO8601().toDate().withMessage('解决日期必须是有效的日期格式，或为null以清除'),
  // student, subject, recordedBy should not be updatable through this route usually.
];

module.exports = {
  mongoIdParamValidation,
  mistakeRecordQueryValidationRules,
  createMistakeRecordValidationRules,
  updateMistakeRecordValidationRules
}; 
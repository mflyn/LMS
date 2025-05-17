const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

const isValidMongoId = (id) => mongoose.Types.ObjectId.isValid(id);

// Re-exporting mongoIdParamValidation or define locally if preferred for clarity
const mongoIdParamValidation = (fieldName = 'id') => [
  param(fieldName).custom((value) => {
    if (!isValidMongoId(value)) {
      throw new Error(`${fieldName} 必须是有效的 MongoDB ObjectId`);
    }
    return true;
  }),
];

const performanceQueryValidationRules = () => [
  query('subject').optional().custom(isValidMongoId).withMessage('科目ID必须是有效的 ObjectId'),
  query('type').optional().isIn(['participation', 'behavior', 'attendance', 'quiz', 'interaction', 'other']).withMessage('无效的表现类型'),
  query('dateFrom').optional().isISO8601().toDate().withMessage('dateFrom 必须是有效的日期格式'),
  query('dateTo').optional().isISO8601().toDate().withMessage('dateTo 必须是有效的日期格式'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('limit 必须是1-100之间的整数'),
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('page 必须是大于0的整数'),
  query('sortBy').optional().isIn(['date', 'score', 'createdAt']).withMessage('无效的排序字段'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('无效的排序顺序'),
];

const recordPerformanceValidationRules = () => [
  body('student').notEmpty().withMessage('学生ID不能为空').custom(isValidMongoId).withMessage('学生ID必须是有效的 ObjectId'),
  body('class').notEmpty().withMessage('班级ID不能为空').custom(isValidMongoId).withMessage('班级ID必须是有效的 ObjectId'),
  body('subject').notEmpty().withMessage('科目ID不能为空').custom(isValidMongoId).withMessage('科目ID必须是有效的 ObjectId'),
  body('date').notEmpty().withMessage('日期不能为空').isISO8601().toDate().withMessage('日期必须是有效的日期格式'),
  body('type').notEmpty().withMessage('表现类型不能为空').isIn(['participation', 'behavior', 'attendance', 'quiz', 'interaction', 'other']).withMessage('无效的表现类型'),
  body('score').optional().isFloat({ min: -5, max: 5 }).withMessage('分数必须在-5到5之间'),
  body('comments').optional().isString().trim(),
  body().custom((value, { req }) => {
    if (req.body.score === undefined && (req.body.comments === undefined || req.body.comments.trim() === '')) {
      throw new Error('当分数未提供时，评论不能为空');
    }
    return true;
  })
];

const updatePerformanceValidationRules = () => [
  body('student').optional().custom(isValidMongoId).withMessage('学生ID必须是有效的 ObjectId'),
  body('class').optional().custom(isValidMongoId).withMessage('班级ID必须是有效的 ObjectId'),
  body('subject').optional().custom(isValidMongoId).withMessage('科目ID必须是有效的 ObjectId'),
  body('date').optional().isISO8601().toDate().withMessage('日期必须是有效的日期格式'),
  body('type').optional().isIn(['participation', 'behavior', 'attendance', 'quiz', 'interaction', 'other']).withMessage('无效的表现类型'),
  body('score').optional({nullable: true}).isFloat({ min: -5, max: 5 }).withMessage('分数必须在-5到5之间，或者为null以清除'),
  body('comments').optional({nullable: true}).isString().trim(),
  body().custom((value, { req }) => {
    const scoreProvided = req.body.score !== undefined;
    const commentsProvided = req.body.comments !== undefined;

    if (scoreProvided && req.body.score === null && commentsProvided && (req.body.comments === null || req.body.comments.trim() === '')) {
        // This case means user is trying to clear both score and comments
        // Model validation should prevent this if both become undefined/empty and one is required based on the other.
        // Allowing this at validator level means service must ensure final state is valid.
    }
    return true;
  })
];

module.exports = {
  mongoIdParamValidation,
  performanceQueryValidationRules,
  recordPerformanceValidationRules,
  updatePerformanceValidationRules
}; 
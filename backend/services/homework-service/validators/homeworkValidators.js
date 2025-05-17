const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

const isValidMongoId = (id) => mongoose.Types.ObjectId.isValid(id);

const mongoIdParamValidation = (fieldName) => [
  param(fieldName).custom((value) => {
    if (!isValidMongoId(value)) {
      throw new Error(`${fieldName} 必须是有效的 MongoDB ObjectId`);
    }
    return true;
  }),
];

const createHomeworkValidationRules = () => [
  body('title').notEmpty().withMessage('作业标题不能为空').trim(),
  body('description').notEmpty().withMessage('作业描述不能为空').trim(),
  body('subject').notEmpty().withMessage('科目ID不能为空').custom(isValidMongoId).withMessage('科目ID必须是有效的 ObjectId'),
  body('class').notEmpty().withMessage('班级ID不能为空').custom(isValidMongoId).withMessage('班级ID必须是有效的 ObjectId'),
  body('assignedBy').notEmpty().withMessage('布置人ID不能为空').custom(isValidMongoId).withMessage('布置人ID必须是有效的 ObjectId'),
  body('assignedTo').optional().isArray().withMessage('assignedTo 必须是一个数组'),
  body('assignedTo.*').optional().custom(isValidMongoId).withMessage('assignedTo 中的每个ID必须是有效的 ObjectId'),
  body('dueDate').notEmpty().withMessage('截止日期不能为空').isISO8601().toDate().withMessage('截止日期必须是有效的日期格式'),
  body('attachments').optional().isArray().withMessage('附件必须是一个数组'),
  body('attachments.*.name').optional().notEmpty().withMessage('附件名称不能为空').trim(),
  body('attachments.*.path').optional().notEmpty().withMessage('附件路径不能为空').trim(), // Consider URL validation if it's a URL
  body('attachments.*.type').optional().notEmpty().withMessage('附件类型不能为空').trim(),
];

const updateHomeworkValidationRules = () => [
  body('title').optional().notEmpty().withMessage('作业标题不能为空').trim(),
  body('description').optional().notEmpty().withMessage('作业描述不能为空').trim(),
  body('subject').optional().custom(isValidMongoId).withMessage('科目ID必须是有效的 ObjectId'),
  body('class').optional().custom(isValidMongoId).withMessage('班级ID必须是有效的 ObjectId'),
  body('assignedBy').optional().custom(isValidMongoId).withMessage('布置人ID必须是有效的 ObjectId'), // Usually assignedBy is not updatable
  body('assignedTo').optional().isArray().withMessage('assignedTo 必须是一个数组'),
  body('assignedTo.*').optional().custom(isValidMongoId).withMessage('assignedTo 中的每个ID必须是有效的 ObjectId'),
  body('dueDate').optional().isISO8601().toDate().withMessage('截止日期必须是有效的日期格式'),
  body('status').optional().isIn(['draft', 'assigned', 'completed', 'overdue']).withMessage('无效的作业状态'),
  body('attachments').optional().isArray().withMessage('附件必须是一个数组'),
  body('attachments.*.name').optional().notEmpty().withMessage('附件名称不能为空').trim(),
  body('attachments.*.path').optional().notEmpty().withMessage('附件路径不能为空').trim(),
  body('attachments.*.type').optional().notEmpty().withMessage('附件类型不能为空').trim(),
];

const assignHomeworkValidationRules = () => [
  body('studentIds').exists().withMessage('studentIds 不能为空').isArray({ min: 1 }).withMessage('studentIds 必须是非空数组'),
  body('studentIds.*').custom(isValidMongoId).withMessage('studentIds 中的每个ID必须是有效的 ObjectId'),
];

const listHomeworkQueryValidationRules = () => [
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('limit 必须是1-100之间的整数'),
    query('page').optional().isInt({ min: 1 }).toInt().withMessage('page 必须是大于0的整数'),
    query('sortBy').optional().isString().trim().isIn(['createdAt', 'dueDate', 'title', 'status']).withMessage('无效的 sortBy 参数'),
    query('sortOrder').optional().isString().trim().isIn(['asc', 'desc']).withMessage('无效的 sortOrder 参数'),
    query('subject').optional().custom(isValidMongoId).withMessage('科目ID必须是有效的 ObjectId'),
    query('class').optional().custom(isValidMongoId).withMessage('班级ID必须是有效的 ObjectId'),
    query('status').optional().isIn(['draft', 'assigned', 'completed', 'overdue']).withMessage('无效的作业状态查询参数'),
];

module.exports = {
  mongoIdParamValidation,
  createHomeworkValidationRules,
  updateHomeworkValidationRules,
  assignHomeworkValidationRules,
  listHomeworkQueryValidationRules
}; 
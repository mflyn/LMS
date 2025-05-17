const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

const isValidMongoId = (id) => mongoose.Types.ObjectId.isValid(id);

// Re-defining mongoIdParamValidation here for clarity, or it could be imported if common dir structure allows
const mongoIdParamValidationDS = (fieldName = 'id') => [
  param(fieldName).custom((value) => {
    if (!isValidMongoId(value)) {
      throw new Error(`${fieldName} 必须是有效的 MongoDB ObjectId`);
    }
    return true;
  }),
];

const getStudentHomeworkQueryValidation = () => [
  query('status').optional().isIn(['assigned', 'submitted', 'graded', 'resubmitted']).withMessage('无效的作业状态'),
  query('subject').optional().custom(isValidMongoId).withMessage('科目ID必须是有效的 ObjectId'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('limit 必须是1-100之间的整数'),
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('page 必须是大于0的整数'),
  query('sortBy').optional().isIn(['dueDate', 'submittedDate', 'gradedDate', 'createdAt']).withMessage('无效的排序字段'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('无效的排序顺序'),
];

const submitHomeworkValidationRules = () => [
  body('content').optional({ checkFalsy: true }).isString().trim().withMessage('提交内容必须是字符串'),
  body('submissionAttachments').optional().isArray().withMessage('提交附件必须是一个数组'),
  body('submissionAttachments.*.fileName').if(body('submissionAttachments').exists()).notEmpty().isString().trim().withMessage('附件文件名不能为空'),
  body('submissionAttachments.*.url').if(body('submissionAttachments').exists()).notEmpty().isURL().withMessage('附件URL无效'),
  body('submissionAttachments.*.fileType').optional().isString().trim(),
  // Student cannot change other fields like score, feedback, etc. upon submission
];

const gradeHomeworkValidationRules = () => [
  body('score').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('分数必须是大于等于0的数字'), // Assuming score cannot be negative
  body('totalScore').optional().isFloat({ gt: 0 }).withMessage('总分必须是大于0的数字'), // Teacher might update totalScore here if not set initially
  body('feedback').optional({ checkFalsy: true }).isString().trim(),
  body('status').optional().isIn(['graded', 'resubmitted']).withMessage('评分后的状态只能是 graded 或 resubmitted'), // Teacher sets status to graded or requests resubmission
];

// Placeholder for assignHomework if POST / route in data-service is kept and redefined.
// For now, focusing on student submission and grading.
// const assignHomeworkDataServiceValidationRules = () => [
//   body('student').notEmpty().custom(isValidMongoId), // student ID to assign to
//   body('assignmentId').notEmpty().custom(isValidMongoId), // ID of the homework definition from homework-service
//   body('dueDate').optional().isISO8601().toDate(), // Can override dueDate for a specific student if needed
//   // Other fields like title, description might be copied from homework-service based on assignmentId
// ];

module.exports = {
  mongoIdParamValidationDS, // Use this distinct name if common one causes issues or for clarity
  getStudentHomeworkQueryValidation,
  submitHomeworkValidationRules,
  gradeHomeworkValidationRules,
  // assignHomeworkDataServiceValidationRules 
}; 
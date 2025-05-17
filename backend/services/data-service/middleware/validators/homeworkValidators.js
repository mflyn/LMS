const { body, param, validationResult } = require('express-validator');
const { ValidationError } = require('../../../../common/middleware/errorTypes');
const mongoose = require('mongoose');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const extractedErrors = errors.array().map(err => ({ [err.path]: err.msg }));
  return next(new ValidationError('Input validation failed', extractedErrors));
};

const assignHomeworkValidationRules = () => [
  body('title').trim().notEmpty().withMessage('Title is required.'),
  body('description').optional().trim(),
  body('subject').notEmpty().withMessage('Subject ID is required.').isMongoId().withMessage('Invalid Subject ID.'),
  body('studentIds')
    .isArray({ min: 1 }).withMessage('studentIds must be an array with at least one student ID.')
    .custom((ids) => {
      if (!Array.isArray(ids)) return false;
      return ids.every(id => mongoose.Types.ObjectId.isValid(id));
    })
    .withMessage('All studentIds must be valid MongoDB ObjectIds.'),
  body('dueDate').notEmpty().withMessage('Due date is required.').isISO8601().withMessage('Invalid due date format.').toDate(),
  body('attachments').optional().isArray().withMessage('Attachments must be an array.'),
  body('attachments.*.fileName').optional().trim().notEmpty().withMessage('Attachment fileName cannot be empty if provided.'),
  body('attachments.*.url').optional().trim().isURL().withMessage('Attachment URL must be a valid URL if provided.'),
];

const submitHomeworkValidationRules = () => [
  param('id').isMongoId().withMessage('Invalid Homework ID format in URL parameter.'),
  body('content').optional({ checkFalsy: true }).trim(), // Allow empty string for content
  body('submissionAttachments').optional().isArray().withMessage('Submission attachments must be an array.'),
  body('submissionAttachments.*.fileName').optional().trim().notEmpty().withMessage('Attachment fileName cannot be empty if provided.'),
  body('submissionAttachments.*.url').optional().trim().isURL().withMessage('Attachment URL must be a valid URL if provided.')
  // Ensure at least content or attachments are provided for submission
  // This might require a custom validator based on the specific requirements
  // .custom((value, { req }) => {
  //   if (!req.body.content && (!req.body.submissionAttachments || req.body.submissionAttachments.length === 0)) {
  //     throw new Error('Submission must include either content or attachments.');
  //   }
  //   return true;
  // })
];

const gradeHomeworkValidationRules = () => [
  param('id').isMongoId().withMessage('Invalid Homework ID format in URL parameter.'),
  body('score').notEmpty().withMessage('Score is required.').isFloat({ min: 0, max: 1000 }).withMessage('Score must be a number (max 1000 for flexibility).'), // Adjust max score as needed
  body('feedback').optional().trim()
];

const studentIdParamValidationRules = () => [
  param('studentId').isMongoId().withMessage('Invalid Student ID format in URL parameter.')
];

module.exports = {
  validate,
  assignHomeworkValidationRules,
  submitHomeworkValidationRules,
  gradeHomeworkValidationRules,
  studentIdParamValidationRules
}; 
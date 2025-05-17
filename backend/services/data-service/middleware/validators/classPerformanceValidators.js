const { body, param, validationResult } = require('express-validator');
const { ValidationError } = require('../../../../common/middleware/errorTypes');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const extractedErrors = errors.array().map(err => ({ [err.path]: err.msg }));
  return next(new ValidationError('Input validation failed', extractedErrors));
};

const recordPerformanceValidationRules = () => [
  body('student').notEmpty().withMessage('Student ID is required.').isMongoId().withMessage('Invalid Student ID.'),
  body('class').notEmpty().withMessage('Class ID is required.').isMongoId().withMessage('Invalid Class ID.'),
  body('subject').notEmpty().withMessage('Subject ID is required.').isMongoId().withMessage('Invalid Subject ID.'),
  body('type')
    .trim()
    .notEmpty().withMessage('Performance type is required.')
    .isIn(['participation', 'behavior', 'attendance', 'quiz', 'interaction', 'other']).withMessage('Invalid performance type.'),
  body('description').trim().notEmpty().withMessage('Description is required.'),
  body('score').optional().isFloat({ min: -5, max: 5 }).withMessage('Score must be a number between -5 and 5, if provided.'),
  body('date').optional().isISO8601().withMessage('Invalid date format.').toDate()
];

const updatePerformanceValidationRules = () => [
  param('id').isMongoId().withMessage('Invalid Performance ID in URL parameter.'),
  body('type')
    .optional()
    .trim()
    .notEmpty().withMessage('Performance type cannot be empty if provided.')
    .isIn(['participation', 'behavior', 'attendance', 'quiz', 'interaction', 'other']).withMessage('Invalid performance type.'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty if provided.'),
  body('score').optional().isFloat({ min: -5, max: 5 }).withMessage('Score must be a number between -5 and 5, if provided.'),
  body('date').optional().isISO8601().withMessage('Invalid date format.').toDate(),
  body('subject').optional().isMongoId().withMessage('Invalid Subject ID if provided.')
];

const studentIdParamValidationRules = () => [
  param('studentId').isMongoId().withMessage('Invalid Student ID in URL parameter.')
];

const classIdParamValidationRules = () => [
  param('classId').isMongoId().withMessage('Invalid Class ID in URL parameter.')
];

const performanceIdParamValidationRules = () => [
  param('id').isMongoId().withMessage('Invalid Performance ID in URL parameter.')
];

module.exports = {
  validate,
  recordPerformanceValidationRules,
  updatePerformanceValidationRules,
  studentIdParamValidationRules,
  classIdParamValidationRules,
  performanceIdParamValidationRules
}; 
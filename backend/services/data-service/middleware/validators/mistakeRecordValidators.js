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

const recordMistakeValidationRules = () => [
  body('student').notEmpty().withMessage('Student ID is required.').isMongoId().withMessage('Invalid Student ID.'),
  body('subject').notEmpty().withMessage('Subject ID is required.').isMongoId().withMessage('Invalid Subject ID.'),
  body('question').trim().notEmpty().withMessage('Question content is required.'),
  body('answer').optional({ checkFalsy: true }).trim(),
  body('correctAnswer').trim().notEmpty().withMessage('Correct answer is required.'),
  body('analysis').optional({ checkFalsy: true }).trim(),
  body('tags').optional().isArray().withMessage('Tags must be an array.')
    .custom((tags) => tags.every(tag => typeof tag === 'string' && tag.trim() !== '')).withMessage('All tags must be non-empty strings.'),
  body('source').optional({ checkFalsy: true }).trim(),
  // 'date' is usually set by the server, no need for client to send unless specific use case
  // 'status' is usually defaulted by the model or set through specific actions, not direct creation typically
];

const updateMistakeValidationRules = () => [
  param('id').isMongoId().withMessage('Invalid Mistake Record ID in URL parameter.'),
  body('student').optional().isMongoId().withMessage('Invalid Student ID format if provided.'),
  body('subject').optional().isMongoId().withMessage('Invalid Subject ID format if provided.'),
  body('question').optional().trim().notEmpty().withMessage('Question content cannot be empty if provided.'),
  body('answer').optional({ checkFalsy: true }).trim(), // Allow empty string for answer
  body('correctAnswer').optional().trim().notEmpty().withMessage('Correct answer cannot be empty if provided.'),
  body('analysis').optional({ checkFalsy: true }).trim(), // Corresponds to model's analysis field
  body('tags').optional().isArray().withMessage('Tags must be an array if provided.')
    .custom((tags) => tags.every(tag => typeof tag === 'string' && tag.trim() !== '')).withMessage('All tags must be non-empty strings if provided.'),
  body('source').optional({ checkFalsy: true }).trim(),
  body('status').optional().trim().isIn(['unresolved', 'reviewing', 'resolved', 'archived']).withMessage('Invalid status value.'),
  body('date').optional().isISO8601().withMessage('Invalid date format if provided.').toDate(),
];

const studentIdParamValidationRules = () => [
  param('studentId').isMongoId().withMessage('Invalid Student ID in URL parameter.')
];

const subjectIdParamValidationRules = () => [
  param('subjectId').isMongoId().withMessage('Invalid Subject ID in URL parameter.')
];

const mistakeIdParamValidationRules = () => [
  param('id').isMongoId().withMessage('Invalid Mistake Record ID in URL parameter.')
];


module.exports = {
  validate,
  recordMistakeValidationRules,
  updateMistakeValidationRules,
  studentIdParamValidationRules,
  subjectIdParamValidationRules,
  mistakeIdParamValidationRules
}; 
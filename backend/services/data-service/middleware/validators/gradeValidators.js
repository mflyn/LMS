const { body, check, validationResult } = require('express-validator');
const { AppError, ValidationError } = require('../../../../common/middleware/errorTypes'); // 调整路径

// Middleware to handle validation errors
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const extractedErrors = errors.array().map(err => ({ [err.path]: err.msg }));
  return next(new ValidationError('Input validation failed', extractedErrors));
};

const gradeCreationValidationRules = () => {
  return [
    body('student')
      .notEmpty().withMessage('Student ID is required.')
      .isMongoId().withMessage('Invalid Student ID format.'),
    body('subject')
      .notEmpty().withMessage('Subject ID is required.')
      .isMongoId().withMessage('Invalid Subject ID format.'),
    body('score')
      .notEmpty().withMessage('Score is required.')
      .isFloat({ min: 0, max: 150 }).withMessage('Score must be a number between 0 and 150.'), // Assuming max score 150 for flexibility
    body('gradeType')
      .trim()
      .notEmpty().withMessage('Grade type is required.')
      .isIn(['exam', 'quiz', 'homework', 'participation', 'classwork', 'project', 'other']).withMessage('Invalid grade type.'),
    body('term')
      .trim()
      .notEmpty().withMessage('Term is required.'),
    body('date')
      .notEmpty().withMessage('Date is required.')
      .isISO8601().withMessage('Date must be a valid ISO8601 date (YYYY-MM-DD).')
      .toDate(), // Convert to JavaScript Date object
    body('comments').optional().trim()
  ];
};

const batchGradeCreationValidationRules = () => {
  return [
    body('grades')
      .isArray({ min: 1 }).withMessage('Grades must be an array with at least one grade entry.'),
    // Validate each object in the grades array
    // Note: express-validator needs a path for nested validation. 
    // We can use a wildcard for array elements.
    body('grades.*.student')
      .notEmpty().withMessage('Student ID is required for each grade.')
      .isMongoId().withMessage('Invalid Student ID format in batch.'),
    body('grades.*.subject')
      .notEmpty().withMessage('Subject ID is required for each grade.')
      .isMongoId().withMessage('Invalid Subject ID format in batch.'),
    body('grades.*.score')
      .notEmpty().withMessage('Score is required for each grade.')
      .isFloat({ min: 0, max: 150 }).withMessage('Score must be a number between 0 and 150 in batch.'),
    body('grades.*.gradeType')
      .trim()
      .notEmpty().withMessage('Grade type is required for each grade.')
      .isIn(['exam', 'quiz', 'homework', 'participation', 'classwork', 'project', 'other']).withMessage('Invalid grade type in batch.'),
    body('grades.*.term')
      .trim()
      .notEmpty().withMessage('Term is required for each grade.'),
    body('grades.*.date')
      .notEmpty().withMessage('Date is required for each grade.')
      .isISO8601().withMessage('Date must be a valid ISO8601 date (YYYY-MM-DD) in batch.')
      .toDate(),
    body('grades.*.comments').optional().trim()
  ];
};


module.exports = {
  validate,
  gradeCreationValidationRules,
  batchGradeCreationValidationRules
}; 
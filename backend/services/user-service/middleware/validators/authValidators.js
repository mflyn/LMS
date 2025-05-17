const { body, validationResult } = require('express-validator');
const { AppError, ValidationError } = require('../../../../common/middleware/errorTypes'); // 调整路径

// Middleware to handle validation errors
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const extractedErrors = errors.array().map(err => ({ [err.path]: err.msg }));
  // 使用我们自定义的 ValidationError
  return next(new ValidationError('Input validation failed', extractedErrors));
};

const registrationValidationRules = () => {
  return [
    body('username')
      .trim()
      .notEmpty().withMessage('Username is required.')
      .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long.'),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required.')
      .isEmail().withMessage('Must be a valid email address.'),
    body('password')
      .notEmpty().withMessage('Password is required.')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
      // Add more password complexity rules if needed, e.g., .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/)
    body('role')
      .trim()
      .notEmpty().withMessage('Role is required.')
      .isIn(['student', 'teacher', 'parent']).withMessage('Invalid role. Allowed roles are: student, teacher, parent.'),
    body('firstName').optional().trim().isAlpha('en-US', {ignore: ' '}).withMessage('First name must only contain letters.'),
    body('lastName').optional().trim().isAlpha('en-US', {ignore: ' '}).withMessage('Last name must only contain letters.')
  ];
};

const loginValidationRules = () => {
  return [
    // Assuming login can be done with email or username.
    // If only email, then just validate email.
    // For this example, let's assume email is used for login.
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required.')
      .isEmail().withMessage('Must be a valid email address.'),
    body('password')
      .notEmpty().withMessage('Password is required.')
  ];
};

const changePasswordValidationRules = () => {
  return [
    body('oldPassword')
      .notEmpty().withMessage('Old password is required.'),
    body('newPassword')
      .notEmpty().withMessage('New password is required.')
      .isLength({ min: 6 }).withMessage('New password must be at least 6 characters long.')
      // Consider adding a rule to ensure newPassword is different from oldPassword (would require custom validator or service-layer logic)
  ];
};

module.exports = {
  validate,
  registrationValidationRules,
  loginValidationRules,
  changePasswordValidationRules
}; 
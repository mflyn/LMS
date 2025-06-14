const { body, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Role = require('../../../../common/models/Role'); // To validate against existing roles

// Common password validation rule
const passwordValidation = body('password')
  .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
  .matches(/[a-z]/).withMessage('Password must contain a lowercase letter.')
  .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter.')
  .matches(/[0-9]/).withMessage('Password must contain a number.')
  .matches(/[^a-zA-Z0-9]/).withMessage('Password must contain a special character.');

const createUserValidationRules = () => {
  return [
    body('username')
      .trim()
      .notEmpty().withMessage('Username is required.')
      .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters.'),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required.')
      .isEmail().withMessage('Must be a valid email address.'),
    passwordValidation,
    body('firstName')
      .trim()
      .notEmpty().withMessage('First name is required.')
      .isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters.'),
    body('lastName')
      .trim()
      .notEmpty().withMessage('Last name is required.')
      .isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters.'),
    body('role')
      .trim()
      .notEmpty().withMessage('Role is required.')
      .custom(async (value) => {
        const existingRole = await Role.findOne({ name: value });
        if (!existingRole) {
          throw new Error('Invalid role specified.');
        }
        return true;
      }),
    body('isActive')
      .optional()
      .isBoolean().withMessage('isActive must be a boolean.'),

    // Student specific fields (conditionally required if role is student)
    body('studentDetails').optional().isObject().withMessage('studentDetails must be an object.'),
    body('studentDetails.studentIdNumber')
      .if(body('role').equals('student'))
      .trim()
      .notEmpty().withMessage('Student ID number is required for students.'),
    body('studentDetails.grade')
      .if(body('role').equals('student'))
      .trim()
      .notEmpty().withMessage('Grade is required for students.'),
    body('studentDetails.studentClass')
      .if(body('role').equals('student'))
      .trim()
      .notEmpty().withMessage('Class is required for students.'),
    
    // Teacher specific fields (conditionally required if role is teacher)
    body('teacherDetails').optional().isObject().withMessage('teacherDetails must be an object.'),
    body('teacherDetails.teacherIdNumber')
      .if(body('role').equals('teacher'))
      .trim()
      .notEmpty().withMessage('Teacher ID number is required for teachers.'),
    body('teacherDetails.subjectsTaught')
      .if(body('role').equals('teacher'))
      .isArray({ min: 1 }).withMessage('Subjects taught is required for teachers and must be a non-empty array.')
      .custom((value) => value.every(item => typeof item === 'string' && item.trim() !== '')).withMessage('All subjects taught must be non-empty strings.'),
    body('teacherDetails.classesOverseen')
      .optional()
      .isArray().withMessage('Classes overseen must be an array for teachers.')
      .custom((value) => value.every(item => mongoose.Types.ObjectId.isValid(item) || (typeof item === 'string' && item.trim() !== ''))) // Assuming class IDs or names
      .withMessage('All classes overseen must be valid IDs or non-empty strings.'),


    // Parent specific details
    body('parentDetails').optional().isObject().withMessage('parentDetails must be an object.'),
    body('parentDetails.children')
      .optional()
      .isArray().withMessage('Children must be an array for parents.')
      .custom((value) => value.every(item => mongoose.Types.ObjectId.isValid(item))).withMessage('All children IDs must be valid MongoDB ObjectIds.'),
  ];
};

const updateUserValidationRules = () => {
  // For updates, most fields are optional.
  // Admin updates via /api/users/:userId might allow role/password changes.
  // User self-updates via /api/users/me should not allow role/password changes (handled by service/controller).
  return [
    body('username')
      .optional()
      .trim()
      .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters.'),
    body('email')
      .optional()
      .trim()
      .isEmail().withMessage('Must be a valid email address.'),
    // Password validation is optional: if provided, it must be strong.
    // Service layer handles if non-admin can change password. Admin can.
    body('password').optional()
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
        .matches(/[a-z]/).withMessage('Password must contain a lowercase letter.')
        .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter.')
        .matches(/[0-9]/).withMessage('Password must contain a number.')
        .matches(/[^a-zA-Z0-9]/).withMessage('Password must contain a special character.'),
    body('firstName')
      .optional()
      .trim()
      .isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters.'),
    body('lastName')
      .optional()
      .trim()
      .isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters.'),
    // Role validation for admin updates. For self-updates, service layer should ignore this.
    body('role')
      .optional()
      .trim()
      .custom(async (value) => {
        const existingRole = await Role.findOne({ name: value });
        if (!existingRole) {
          throw new Error('Invalid role specified.');
        }
        return true;
      }),
    body('isActive')
      .optional()
      .isBoolean().withMessage('isActive must be a boolean.'),

    // Student specific fields
    body('studentDetails').optional().isObject().withMessage('studentDetails must be an object.'),
    body('studentDetails.studentIdNumber')
      .optional()
      .if(body('studentDetails').exists()) // only validate if studentDetails object is provided
      .trim()
      .notEmpty().withMessage('Student ID number cannot be empty if provided in studentDetails.'),
    body('studentDetails.grade')
      .optional()
      .if(body('studentDetails').exists())
      .trim()
      .notEmpty().withMessage('Grade cannot be empty if provided in studentDetails.'),
    body('studentDetails.studentClass')
      .optional()
      .if(body('studentDetails').exists())
      .trim()
      .notEmpty().withMessage('Class cannot be empty if provided in studentDetails.'),
      
    // Teacher specific fields
    body('teacherDetails').optional().isObject().withMessage('teacherDetails must be an object.'),
    body('teacherDetails.teacherIdNumber')
      .optional()
      .if(body('teacherDetails').exists())
      .trim()
      .notEmpty().withMessage('Teacher ID number cannot be empty if provided in teacherDetails.'),
    body('teacherDetails.subjectsTaught')
      .optional()
      .if(body('teacherDetails').exists())
      .isArray({ min: 1 }).withMessage('Subjects taught must be a non-empty array if provided in teacherDetails.')
      .custom((value) => value.every(item => typeof item === 'string' && item.trim() !== '')).withMessage('All subjects taught must be non-empty strings.'),
    body('teacherDetails.classesOverseen')
      .optional()
      .if(body('teacherDetails').exists())
      .isArray().withMessage('Classes overseen must be an array if provided in teacherDetails.')
      .custom((value) => value.every(item => mongoose.Types.ObjectId.isValid(item) || (typeof item === 'string' && item.trim() !== '')))
      .withMessage('All classes overseen must be valid IDs or non-empty strings.'),

    // Parent specific details
    body('parentDetails').optional().isObject().withMessage('parentDetails must be an object.'),
    body('parentDetails.children')
      .optional()
      .if(body('parentDetails').exists())
      .isArray().withMessage('Children must be an array if provided in parentDetails.')
      .custom((value) => value.every(item => mongoose.Types.ObjectId.isValid(item))).withMessage('All children IDs must be valid MongoDB ObjectIds.'),
      
    // ID param validation (if needed for routes like /:userId)
    // param('userId')
    //   .optional() // Or not, depending on where this validator set is used
    //   .isMongoId().withMessage('User ID must be a valid MongoDB ObjectId.'),
  ];
};


const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const extractedErrors = [];
  errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));

  return res.status(400).json({
    status: 'fail', // Changed from 'error' to 'fail' as per common practice for validation
    message: 'Validation failed.',
    errors: extractedErrors,
  });
};

module.exports = {
  createUserValidationRules,
  updateUserValidationRules,
  validate, // Export the validate middleware itself
}; 
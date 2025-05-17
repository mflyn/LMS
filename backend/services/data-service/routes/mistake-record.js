const express = require('express');
const router = express.Router();
const mistakeController = require('../controllers/mistakeRecordController');
const { authenticateGateway, checkRole } = require('../../../common/middleware/auth');
// requestTracker is applied globally by createBaseApp, no need here if routes are part of base app
// const { requestTracker } = require('../../../common/middleware/errorHandler'); 
const { validate } = require('../../../common/middleware/requestValidator.js'); // Common validate function
// 从新的本地验证器文件导入规则
const {
    mongoIdParamValidation, // Using the one from local validator
    mistakeRecordQueryValidationRules,
    createMistakeRecordValidationRules,
    updateMistakeRecordValidationRules
} = require('../validators/mistakeRecordValidators');

const ROLES = { STUDENT: 'student', PARENT: 'parent', TEACHER: 'teacher', ADMIN: 'admin', SUPERADMIN: 'superadmin' };

// GET student's mistake records
// Roles: student (own), parent (child), teacher (class student), admin, superadmin
router.get('/student/:studentId',
    authenticateGateway,
    checkRole([ROLES.STUDENT, ROLES.PARENT, ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN]),
    ...mongoIdParamValidation('studentId'),
    mistakeRecordQueryValidationRules(), // Apply query validation
    validate,
    mistakeController.getStudentMistakes
);

// GET student's mistake records by subject
// Roles: student (own), parent (child), teacher (class student), admin, superadmin
router.get('/student/:studentId/subject/:subjectId',
    authenticateGateway,
    checkRole([ROLES.STUDENT, ROLES.PARENT, ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN]),
    ...mongoIdParamValidation('studentId'),
    ...mongoIdParamValidation('subjectId'),
    mistakeRecordQueryValidationRules(), // Apply query validation (will ignore non-relevant fields)
    validate,
    mistakeController.getStudentMistakesBySubject
);

// POST a new mistake record
// Roles: student (own), teacher, admin, superadmin (service layer checks if student is creating for self)
router.post('/',
    authenticateGateway,
    checkRole([ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN]),
    createMistakeRecordValidationRules(), // Apply create rules
    validate,
    mistakeController.recordMistake
);

// PUT update a mistake record
// Roles: creator, teacher (class student), admin, superadmin (service layer handles specifics)
router.put('/:id',
    authenticateGateway,
    // checkRole can be more granular here or handled entirely by service based on ownership/role scope
    // For example, a student can only update their own, teacher their student's, admin wider scope.
    // checkRole([ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN]), // Example base roles
    ...mongoIdParamValidation('id'), // Validate ID param
    updateMistakeRecordValidationRules(), // Apply update rules
    validate,
    mistakeController.updateMistake
);

// DELETE a mistake record
// Roles: creator, admin, superadmin (service layer handles specifics, teachers might be restricted)
router.delete('/:id',
    authenticateGateway,
    // Similar to PUT, service layer should primarily enforce who can delete (creator, admin, etc.)
    checkRole([ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN]), // Example base roles
    ...mongoIdParamValidation('id'),
    validate, // No specific body validation needed for delete
    mistakeController.deleteMistake
);

module.exports = router;
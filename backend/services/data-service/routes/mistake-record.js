const express = require('express');
const router = express.Router();
const mistakeController = require('../controllers/mistakeRecordController');
const { authenticateGateway, checkRole } = require('../../../common/middleware/auth');
// requestTracker is applied globally by createBaseApp, no need here if routes are part of base app
// const { requestTracker } = require('../../../common/middleware/errorHandler'); 
const {
    validate,
    recordMistakeValidationRules,
    updateMistakeValidationRules,
    studentIdParamValidationRules,
    subjectIdParamValidationRules,
    mistakeIdParamValidationRules
} = require('../middleware/validators/mistakeRecordValidators');

// GET student's mistake records
// Roles: student (own), parent (child), teacher (class student), admin, superadmin
router.get('/student/:studentId',
    authenticateGateway,
    studentIdParamValidationRules(),
    validate,
    checkRole(['student', 'parent', 'teacher', 'admin', 'superadmin']), // Service layer handles specific student/child/class access
    mistakeController.getStudentMistakes
);

// GET student's mistake records by subject
// Roles: student (own), parent (child), teacher (class student), admin, superadmin
router.get('/student/:studentId/subject/:subjectId',
    authenticateGateway,
    studentIdParamValidationRules(),
    subjectIdParamValidationRules(),
    validate,
    checkRole(['student', 'parent', 'teacher', 'admin', 'superadmin']), // Service layer handles specifics
    mistakeController.getStudentMistakesBySubject
);

// POST a new mistake record
// Roles: student (own), teacher, admin, superadmin (service layer checks if student is creating for self)
router.post('/',
    authenticateGateway,
    checkRole(['student', 'teacher', 'admin', 'superadmin']), // Allows these roles to attempt creation
    recordMistakeValidationRules(),
    validate,
    mistakeController.recordMistake
);

// PUT update a mistake record
// Roles: creator, teacher (class student), admin, superadmin (service layer handles specifics)
router.put('/:id',
    authenticateGateway,
    // No generic checkRole here, service layer handles detailed permission (creator, or teacher/admin with scope)
    updateMistakeValidationRules(), // includes ID param validation
    validate,
    mistakeController.updateMistake
);

// DELETE a mistake record
// Roles: creator, admin, superadmin (service layer handles specifics, teachers might be restricted)
router.delete('/:id',
    authenticateGateway,
    // No generic checkRole here for teacher, service layer is stricter (creator or admin/superadmin)
    mistakeIdParamValidationRules(), // separate validation for ID in param
    validate,
    checkRole(['student', 'teacher', 'admin', 'superadmin']), // Base check, service layer will enforce creator or admin/superadmin for actual deletion
    mistakeController.deleteMistake
);

module.exports = router;
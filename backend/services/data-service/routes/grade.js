const express = require('express');
const router = express.Router();
const gradeController = require('../controllers/gradeController');
const { authenticateGateway, checkRole } = require('../../../common/middleware/auth');
const { validate } = require('../../../common/middleware/requestValidator.js'); // Only common validate is needed now
// 从新的本地验证器文件导入规则
const {
    mongoIdParamValidation, // Using the one from local validator
    gradeQueryValidationRules,
    createGradeValidationRules,
    batchCreateGradeValidationRules,
    updateGradeValidationRules // Import new validation rule
} = require('../validators/gradeValidators');

const ROLES = { STUDENT: 'student', PARENT: 'parent', TEACHER: 'teacher', ADMIN: 'admin', SUPERADMIN: 'superadmin' };

// Get grades for a specific student
router.get('/student/:studentId',
    authenticateGateway,
    checkRole([ROLES.STUDENT, ROLES.PARENT, ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN]),
    ...mongoIdParamValidation('studentId'), // Use local mongoIdParamValidation
    gradeQueryValidationRules(), // Apply query validation
    validate,
    gradeController.getStudentGrades
);

// Get grades for a specific class
router.get('/class/:classId',
    authenticateGateway,
    checkRole([ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN]),
    ...mongoIdParamValidation('classId'), // Use local mongoIdParamValidation
    gradeQueryValidationRules(), // Apply query validation
    validate,
    gradeController.getClassGrades
);

// Create a new grade
router.post('/',
    authenticateGateway,
    checkRole([ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN]),
    createGradeValidationRules(), // Apply single grade creation rules
    validate,
    gradeController.createGrade
);

// Batch create grades
router.post('/batch',
    authenticateGateway,
    checkRole([ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN]),
    batchCreateGradeValidationRules(), // Apply batch grade creation rules
    validate,
    gradeController.batchCreateGrades
);

// Update a grade
router.put('/:id',
    authenticateGateway,
    checkRole([ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN]), // Permissions to be refined in service layer
    ...mongoIdParamValidation('id'),
    updateGradeValidationRules(),
    validate,
    gradeController.updateGrade
);

// Delete a grade
router.delete('/:id',
    authenticateGateway,
    checkRole([ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN]), // Permissions to be refined in service layer
    ...mongoIdParamValidation('id'),
    validate, // No specific body validation needed for delete
    gradeController.deleteGrade
);

module.exports = router;
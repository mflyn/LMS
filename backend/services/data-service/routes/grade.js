const express = require('express');
const router = express.Router();
const gradeController = require('../controllers/gradeController');
const { authenticateGateway, checkRole } = require('../../../common/middleware/auth');
const {
    validate,
    gradeCreationValidationRules,
    batchGradeCreationValidationRules
} = require('../middleware/validators/gradeValidators'); // 调整路径

// Get grades for a specific student
router.get('/student/:studentId',
    authenticateGateway,
    // Basic role check: ensure user is one of these roles.
    // Specific access control (e.g., student sees own, parent sees child's) is handled in GradeService.
    checkRole(['student', 'parent', 'teacher', 'admin', 'superadmin']),
    gradeController.getStudentGrades
);

// Get grades for a specific class
router.get('/class/:classId',
    authenticateGateway,
    checkRole(['teacher', 'admin', 'superadmin']), // Added superadmin
    gradeController.getClassGrades
);

// Create a new grade
router.post('/',
    authenticateGateway,
    checkRole(['teacher', 'admin', 'superadmin']), // Added superadmin
    gradeCreationValidationRules(),
    validate,
    gradeController.createGrade
);

// Batch create grades
router.post('/batch',
    authenticateGateway,
    checkRole(['teacher', 'admin', 'superadmin']), // Added superadmin
    batchGradeCreationValidationRules(),
    validate,
    gradeController.batchCreateGrades
);

module.exports = router;
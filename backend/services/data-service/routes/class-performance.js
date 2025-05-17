const express = require('express');
const router = express.Router();
const classPerformanceController = require('../controllers/classPerformanceController');
const { authenticateGateway, checkRole } = require('../../../common/middleware/auth');
const {
    validate,
    recordPerformanceValidationRules,
    updatePerformanceValidationRules,
    studentIdParamValidationRules,
    classIdParamValidationRules,
    performanceIdParamValidationRules
} = require('../middleware/validators/classPerformanceValidators');

// 获取特定学生的班级表现记录
// Permission: Student (own), Parent (own child - service logic), Teacher (service logic), Admin, Superadmin
router.get('/student/:studentId',
    authenticateGateway,
    studentIdParamValidationRules(),
    validate,
    checkRole(['student', 'parent', 'teacher', 'admin', 'superadmin']), // Base roles
    classPerformanceController.getStudentPerformance
);

// 获取特定班级的所有表现记录
// Permission: Teacher, Admin, Superadmin
router.get('/class/:classId',
    authenticateGateway,
    classIdParamValidationRules(),
    validate,
    checkRole(['teacher', 'admin', 'superadmin']),
    classPerformanceController.getClassPerformance
);

// 记录新的班级表现
// Permission: Teacher, Admin, Superadmin
router.post('/', 
    authenticateGateway,
    checkRole(['teacher', 'admin', 'superadmin']),
    recordPerformanceValidationRules(),
    validate,
    classPerformanceController.recordPerformance
);

// 更新班级表现记录
// Permission: Teacher (who recorded), Admin, Superadmin (service layer handles specific teacher check)
router.put('/:id', 
    authenticateGateway,
    checkRole(['teacher', 'admin', 'superadmin']), // Base roles, service checks recorder ID for teachers
    updatePerformanceValidationRules(), // This includes param('id') validation
    validate,
    classPerformanceController.updatePerformance
);

// 删除班级表现记录
// Permission: Teacher (who recorded), Admin, Superadmin (service layer handles specific teacher check)
router.delete('/:id', 
    authenticateGateway,
    checkRole(['teacher', 'admin', 'superadmin']), // Base roles, service checks recorder ID for teachers
    performanceIdParamValidationRules(),
    validate,
    classPerformanceController.deletePerformance
);

module.exports = router;
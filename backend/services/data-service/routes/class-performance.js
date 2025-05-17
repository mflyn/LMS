const express = require('express');
const router = express.Router();
const classPerformanceController = require('../controllers/classPerformanceController');
const { authenticateGateway, checkRole } = require('../../../common/middleware/auth');
const { validate } = require('../../../common/middleware/requestValidator.js');
// 从新的本地验证器文件导入规则
const {
    mongoIdParamValidation,
    performanceQueryValidationRules,
    recordPerformanceValidationRules,
    updatePerformanceValidationRules
} = require('../validators/classPerformanceValidators');

const ROLES = { STUDENT: 'student', PARENT: 'parent', TEACHER: 'teacher', ADMIN: 'admin', SUPERADMIN: 'superadmin' };

// 获取特定学生的班级表现记录
// Permission: Student (own), Parent (own child - service logic), Teacher (service logic), Admin, Superadmin
router.get('/student/:studentId',
    authenticateGateway,
    checkRole([ROLES.STUDENT, ROLES.PARENT, ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN]),
    ...mongoIdParamValidation('studentId'),
    performanceQueryValidationRules(), // Apply query validation
    validate,
    classPerformanceController.getStudentPerformance
);

// 获取特定班级的所有表现记录
// Permission: Teacher, Admin, Superadmin
router.get('/class/:classId',
    authenticateGateway,
    checkRole([ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN]),
    ...mongoIdParamValidation('classId'),
    performanceQueryValidationRules(), // Apply query validation
    validate,
    classPerformanceController.getClassPerformance
);

// 记录新的班级表现
// Permission: Teacher, Admin, Superadmin
router.post('/', 
    authenticateGateway,
    checkRole([ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN]),
    recordPerformanceValidationRules(),
    validate,
    classPerformanceController.recordPerformance
);

// 更新班级表现记录
// Permission: Teacher (who recorded), Admin, Superadmin (service layer handles specific teacher check)
router.put('/:id', 
    authenticateGateway,
    checkRole([ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN]),
    ...mongoIdParamValidation('id'), // Added missing Id validation
    updatePerformanceValidationRules(),
    validate,
    classPerformanceController.updatePerformance
);

// 删除班级表现记录
// Permission: Teacher (who recorded), Admin, Superadmin (service layer handles specific teacher check)
router.delete('/:id', 
    authenticateGateway,
    checkRole([ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN]),
    ...mongoIdParamValidation('id'),
    validate,
    classPerformanceController.deletePerformance
);

module.exports = router;
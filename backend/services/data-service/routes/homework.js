const express = require('express');
const router = express.Router();
const homeworkController = require('../controllers/homeworkController');
const { authenticateGateway, checkRole } = require('../../../common/middleware/auth');
const { validate, mongoIdParamValidation } = require('../../../common/middleware/requestValidator.js'); 
// 从新的本地验证器文件导入规则
const {
    // mongoIdParamValidationDS, // Not needed here as we use the common mongoIdParamValidation
    getStudentHomeworkQueryValidation,
    submitHomeworkValidationRules,
    gradeHomeworkValidationRules
} = require('../validators/homeworkValidators');

// 定义角色常量
const ROLES = { STUDENT: 'student', PARENT: 'parent', TEACHER: 'teacher', ADMIN: 'admin', SUPERADMIN: 'superadmin' };

// 获取特定学生的作业列表
// Permission: Student (own), Parent (own child - requires logic in service), Teacher (own class students - requires logic in service), Admin, Superadmin
router.get('/student/:studentId',
    authenticateGateway,
    ...mongoIdParamValidation('studentId'), 
    getStudentHomeworkQueryValidation(),
    validate, 
    checkRole([ROLES.STUDENT, ROLES.PARENT, ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN]), 
    homeworkController.getStudentHomework
);

// POST / 路由 (布置新作业) 已被移除。
// 学生作业记录的创建应由 data-service 中的事件消费者处理，该消费者监听 homework-service 发出的 'homework.assigned' 事件。

// 学生提交作业
// Permission: Student (own homework)
router.put('/:id/submit', 
    authenticateGateway, 
    checkRole([ROLES.STUDENT]), 
    ...mongoIdParamValidation('id'),
    submitHomeworkValidationRules(),
    validate,
    homeworkController.submitHomework
);

// 教师/管理员给作业评分
// Permission: Teacher, Admin, Superadmin
router.put('/:id/grade', 
    authenticateGateway, 
    checkRole([ROLES.TEACHER, ROLES.ADMIN, ROLES.SUPERADMIN]), 
    ...mongoIdParamValidation('id'),
    gradeHomeworkValidationRules(),
    validate,
    homeworkController.gradeHomework
);

module.exports = router;
const express = require('express');
const router = express.Router();
const homeworkController = require('../controllers/homeworkController');
const { authenticateGateway, checkRole } = require('../../../common/middleware/auth');
const {
    validate,
    assignHomeworkValidationRules,
    submitHomeworkValidationRules,
    gradeHomeworkValidationRules,
    studentIdParamValidationRules
} = require('../middleware/validators/homeworkValidators');

// 获取特定学生的作业列表
// Permission: Student (own), Parent (own child - requires logic in service), Teacher (own class students - requires logic in service), Admin, Superadmin
router.get('/student/:studentId',
    authenticateGateway,
    studentIdParamValidationRules(), // Validate studentId in path
    validate, // Apply validation
    checkRole(['student', 'parent', 'teacher', 'admin', 'superadmin']), // Basic role check
    homeworkController.getStudentHomework
);

// 布置新作业 (给一个或多个学生)
// Permission: Teacher, Admin, Superadmin
router.post('/', 
    authenticateGateway, 
    checkRole(['teacher', 'admin', 'superadmin']), 
    assignHomeworkValidationRules(),
    validate,
    homeworkController.assignHomework
);

// 学生提交作业
// Permission: Student (own homework)
router.put('/:id/submit', 
    authenticateGateway, 
    checkRole(['student']), // Service layer will verify if it's the student's own homework
    submitHomeworkValidationRules(),
    validate,
    homeworkController.submitHomework
);

// 教师/管理员给作业评分
// Permission: Teacher, Admin, Superadmin
router.put('/:id/grade', 
    authenticateGateway, 
    checkRole(['teacher', 'admin', 'superadmin']), 
    gradeHomeworkValidationRules(),
    validate,
    homeworkController.gradeHomework
);

module.exports = router;
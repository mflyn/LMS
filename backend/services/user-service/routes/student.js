const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticateGateway, checkRole } = require('../../../common/middleware/auth'); // 引入通用认证和授权中间件

// 获取学生列表 - 允许教师、管理员、超级管理员访问
router.get('/', 
  authenticateGateway, // 确保用户信息从网关头中解析
  checkRole(['teacher', 'admin', 'superadmin']), 
  studentController.getStudents
);

// 获取学生详情 - 允许教师、管理员、超级管理员访问
router.get('/:id', 
  authenticateGateway, // 确保用户信息从网关头中解析
  checkRole(['teacher', 'admin', 'superadmin']), 
  studentController.getStudentById
);

// TODO: 考虑未来是否需要学生创建/更新的特定接口，以及相应的权限设置
// 例如，创建学生可能仅限管理员，更新学生档案的某些部分可能允许教师或学生本人

module.exports = router;
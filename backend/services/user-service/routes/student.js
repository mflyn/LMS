const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

// 认证中间件
const authenticateToken = (req, res, next) => {
  // 这个中间件已经在server.js中应用，这里只是为了代码的完整性
  next();
};

// 角色检查中间件
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({
      code: 401,
      message: '未认证',
      data: null
    });
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        code: 403,
        message: '权限不足',
        data: null
      });
    }
    
    next();
  };
};

// 获取学生列表 - 仅允许教师和管理员访问
router.get('/', checkRole(['teacher', 'admin']), studentController.getStudents);

// 获取学生详情 - 仅允许教师和管理员访问
router.get('/:id', checkRole(['teacher', 'admin']), studentController.getStudentById);

module.exports = router;
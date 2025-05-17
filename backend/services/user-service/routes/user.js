const express = require('express');
const router = express.Router();
const User = require('../models/User');
const userController = require('../controllers/userController');
const { authenticateJWT, checkRole } = require('../../../common/middleware/auth');
const { validate, updateUserValidationRules } = require('../middleware/validators/userValidators');

// 获取当前用户信息
router.get('/me', authenticateJWT, userController.getCurrentUser);

// 更新当前登录用户的信息
router.put('/me',
  authenticateJWT,
  updateUserValidationRules(),
  validate,
  userController.updateCurrentUser
);

// 获取所有用户（仅管理员）
router.get('/', checkRole(['admin', 'superadmin']), userController.getAllUsers);

// 获取特定用户信息 (管理员)
router.get('/:userId', checkRole(['admin', 'superadmin']), userController.getUserById);

// 更新特定用户信息 (管理员)
router.put('/:userId', checkRole(['admin', 'superadmin']), updateUserValidationRules(), validate, userController.updateUserById);

// 删除特定用户 (管理员)
router.delete('/:userId', checkRole(['admin', 'superadmin']), userController.deleteUserById);

module.exports = router;
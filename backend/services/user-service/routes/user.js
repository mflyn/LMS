const express = require('express');
const router = express.Router();
// User model no longer directly needed in routes if controller handles everything
// const User = require('../models/User'); 
const userController = require('../controllers/userController');
const { authenticateJWT, checkRole } = require('../../../common/middleware/auth');
// Assuming createUserValidation is defined in requestValidator.js or similar
const { validate, updateUserValidationRules, createUserValidationRules } = require('../middleware/validators/userValidators.js'); // Adjusted path

// --- Routes for current authenticated user (/api/users/me) ---
// 获取当前用户信息
router.get('/me', authenticateJWT, userController.getProfile);

// 更新当前登录用户的信息
router.patch('/me', // Changed from PUT to PATCH
  authenticateJWT,
  updateUserValidationRules(), // Use appropriate validation for profile self-update
  validate,
  userController.updateProfile
);

// Optional: Route for user to delete their own account
// router.delete('/me', authenticateJWT, userController.deleteAccount);

// --- Routes for general user management (typically admin/teacher) ---

// 创建新用户 (仅管理员/超级管理员)
router.post('/', 
  authenticateJWT, 
  checkRole(['admin', 'superadmin']), 
  createUserValidationRules(), // Add appropriate validation for creating a user
  validate, 
  userController.createUser
);

// 获取所有用户 (管理员/超级管理员/教师)
router.get('/', 
  authenticateJWT, 
  checkRole(['admin', 'superadmin', 'teacher']), 
  userController.getAllUsers
);

// 获取特定用户信息 (权限由 controller 内部逻辑处理)
// Allows: user getting self, admin/teacher getting any, parent getting child
router.get('/:userId', 
  authenticateJWT, 
  // No specific checkRole here for broad roles, controller.getUserById handles fine-grained authZ
  userController.getUserById
);

// 更新特定用户信息 (仅管理员/超级管理员)
// Uses PATCH for partial updates
router.patch('/:userId', 
  authenticateJWT, 
  checkRole(['admin', 'superadmin']), 
  updateUserValidationRules(), // This validation should allow admin fields like role, or use a specific admin validator
  validate, 
  userController.updateUserById
);

// 删除特定用户 (仅管理员/超级管理员)
router.delete('/:userId', 
  authenticateJWT, 
  checkRole(['admin', 'superadmin']), 
  userController.deleteUserById
);

module.exports = router;
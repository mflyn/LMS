const express = require('express');
const router = express.Router();
const { registerValidation, loginValidation, emailPhoneLoginValidation } = require('../../../common/middleware/requestValidator');
const passwordPolicy = require('../../../common/middleware/passwordPolicy');
const { validate } = require('../../../common/middleware/requestValidator');
const authController = require('../controllers/authController');

// 注册路由
router.post(
  '/register',
  passwordPolicy,
  registerValidation,
  validate,
  authController.register
);

// 登录路由（用户名登录）
router.post(
  '/login',
  loginValidation,
  validate,
  authController.login
);

// 邮箱或手机号登录路由
router.post(
  '/login-email-phone',
  emailPhoneLoginValidation,
  validate,
  authController.loginWithEmailOrPhone
);

// 登出路由
router.post(
  '/logout',
  authController.logout
);

// 验证令牌路由
router.get(
  '/verify',
  authController.verifyToken
);

// 修改密码路由
router.put(
  '/password',
  passwordPolicy,
  authController.changePassword
);

module.exports = router;
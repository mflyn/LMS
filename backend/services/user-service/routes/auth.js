const express = require('express');
const authController = require('../controllers/authController');
const { authenticateJWT } = require('../../../common/middleware/auth'); // Import JWT authentication middleware
const {
  validate,
  registrationValidationRules,
  loginValidationRules,
  changePasswordValidationRules
} = require('../middleware/validators/authValidators'); // 调整路径以匹配实际位置
// Import input validation middleware if you have them, e.g.:
// const { validateRegistration, validateLogin, validateChangePassword } = require('../../../common/middleware/requestValidator'); // Adjust path as needed

const router = express.Router();

// Authentication routes
router.post('/register',
  registrationValidationRules(), // Add validation rules
  validate, // Apply validation
  authController.register
);

router.post('/login',
  loginValidationRules(), // Add validation rules
  validate, // Apply validation
  authController.login
);

router.post('/change-password',
  authenticateJWT, // Protect this route
  changePasswordValidationRules(), // Add validation rules
  validate, // Apply validation
  authController.changePassword
);

// router.post('/logout', authController.logout); // Example for future logout route
// router.post('/refresh-token', authController.refreshToken); // Example for future refresh token route

module.exports = router;
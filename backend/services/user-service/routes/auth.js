const express = require('express');
const authController = require('../controllers/authController');
const familyController = require('../controllers/familyController');
const { authenticateJWT, checkRole } = require('../../../common/middleware/auth'); // Import JWT authentication middleware
const { applySensitiveRateLimit } = require('../../../common/middleware/sensitiveRateLimit');
// Removed local validator import: const { validate, registrationValidationRules, ... } = require('../middleware/validators/authValidators');
const {
  validate,
  registerValidation, // Changed from registrationValidationRules
  loginValidation,    // Changed from loginValidationRules
  changePasswordValidation // Changed from changePasswordValidationRules
} = require('../../../common/middleware/requestValidator.js'); // Path to common validator

const router = express.Router();

// Authentication routes
router.post('/register',
  applySensitiveRateLimit,
  registerValidation, // Use imported array directly
  validate, 
  authController.register
);

router.post('/login',
  applySensitiveRateLimit,
  loginValidation, // Use imported array directly
  validate, 
  authController.login
);

router.post('/child-pin-login', applySensitiveRateLimit, familyController.childPinLogin);

router.post('/change-password',
  authenticateJWT, 
  changePasswordValidation, // Use imported array directly
  validate, 
  authController.changePassword
);

router.post('/logout',
  authenticateJWT,
  checkRole(['parent', 'student']),
  authController.logout
);

// router.post('/refresh-token', authController.refreshToken); // Example for future refresh token route

module.exports = router;

const express = require('express');
const authController = require('../controllers/authController');
const { authenticateJWT } = require('../../../common/middleware/auth'); // Import JWT authentication middleware
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
  registerValidation, // Use imported array directly
  validate, 
  authController.register
);

router.post('/login',
  loginValidation, // Use imported array directly
  validate, 
  authController.login
);

router.post('/change-password',
  authenticateJWT, 
  changePasswordValidation, // Use imported array directly
  validate, 
  authController.changePassword
);

// router.post('/logout', authController.logout); // Example for future logout route
// router.post('/refresh-token', authController.refreshToken); // Example for future refresh token route

module.exports = router;
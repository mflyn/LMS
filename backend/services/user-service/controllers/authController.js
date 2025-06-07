const { catchAsync } = require('../../../common/middleware/errorHandler');
const { BadRequestError, UnauthorizedError, ConflictError } = require('../../../common/middleware/errorTypes');
const User = require('../../../common/models/User');
const UserService = require('../services/userService');
const mongoose = require('mongoose'); // For mongoose.Types.ObjectId.isValid if needed in future methods

class AuthController {
  constructor() {
    // UserService is imported and used as a singleton, so no injection here for now.
    // If UserService were a class to be instantiated, it would be new UserService(User, loggerConfig)
  }

  register = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    logger.info('[AuthController] Registration attempt received', { bodyUsername: req.body.username });

    // Input validation should be handled by middleware before this point.
    // Example: router.post('/register', validateRegistration, authController.register);

    const { user, token } = await UserService.registerUser(req.body, logger);

    logger.info(`[AuthController] User registered successfully: ${user.username} (ID: ${user.id})`);
    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: { user, token }, // UserService ensures 'user' object is clean (no password)
    });
  });

  login = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    logger.info('[AuthController] Login attempt received', { bodyUsername: req.body.username });
    
    // Input validation by middleware

    const { user, token } = await UserService.loginUser(req.body, logger);

    logger.info(`[AuthController] User logged in successfully: ${user.username} (ID: ${user.id})`);
    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: { user, token }, // UserService ensures 'user' is clean
    });
  });

  changePassword = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    const userId = req.user.id; // Assumes authenticateJWT middleware populates req.user
    const { oldPassword, newPassword, confirmPassword } = req.body;

    logger.info(`[AuthController] Change password attempt for user ID: ${userId}`);

    if (!oldPassword || !newPassword || !confirmPassword) {
      return next(new BadRequestError('Old password, new password, and confirm password are required.'));
    }

    if (newPassword !== confirmPassword) {
      return next(new BadRequestError('New password and confirm password do not match.'));
    }

    // Optional: Add password policy validation here or as middleware
    // const passwordPolicy = require('../../../common/middleware/passwordPolicy'); // Adjust path
    // const policyCheck = passwordPolicy.validatePassword(newPassword); // Assuming a structure
    // if (!policyCheck.isValid) {
    //   return next(new BadRequestError(policyCheck.message || 'New password does not meet policy requirements.'));
    // }

    const result = await UserService.changePassword(userId, oldPassword, newPassword, logger);

    logger.info(`[AuthController] Password changed successfully for user ID: ${userId}`);
    res.status(200).json({
      status: 'success',
      message: result.message || 'Password changed successfully.',
    });
  });

  // Placeholder for other auth-related methods like logout, refreshToken, verifyEmail, etc.
  /*
  logout = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    logger.info('[AuthController] Logout attempt received');
    // Logic for logout (e.g., token blocklisting if using a more complex setup)
    res.status(200).json({ status: 'success', message: 'Logged out successfully' });
  });
  */
}

module.exports = new AuthController(); 
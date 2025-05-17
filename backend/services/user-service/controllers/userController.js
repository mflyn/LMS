const UserService = require('../services/userService');
const { catchAsync } = require('../../../common/middleware/errorHandler');
const {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  // ConflictError, // No longer needed here after register/login move
  // UnauthorizedError // No longer needed here
} = require('../../../common/middleware/errorTypes');
const mongoose = require('mongoose');

class UserController {
  constructor() {
    // Bind methods if needed, or ensure arrow functions are used for class properties
    // For simplicity, I'll use arrow functions for methods assigned to class properties
  }

  // NOTE: register and login have been moved to auth.controller.js
  // --- User Profile Management (current user) ---
  
  getProfile = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    const userId = req.user.id; // From authenticateJWT middleware
    logger.info(`Fetching profile for user ID: ${userId}`);

    const user = await UserService.getUserProfile(userId, logger); // Pass logger

    logger.info(`Profile successfully fetched for user ID: ${userId}`);
    res.status(200).json({
      status: 'success',
      data: { user }, // UserService ensures 'user' is clean
    });
  });

  updateProfile = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    const userId = req.user.id;
    const updateData = req.body;
    logger.info(`Update profile attempt for user ID: ${userId}`, { updateData });

    // Input validation for updateData by middleware

    const updatedUser = await UserService.updateUserProfile(userId, updateData, logger); // Pass logger

    logger.info(`Profile updated successfully for user ID: ${userId}`);
    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: { user: updatedUser }, // UserService ensures 'user' is clean
    });
  });

  deleteAccount = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    const userId = req.user.id;
    const reason = req.body.reason; // Optional: reason for deletion
    logger.warn(`Account deletion attempt for user ID: ${userId}`, { reason });

    await UserService.deleteUserAccount(userId, logger); // Pass logger

    logger.info(`Account successfully deleted for user ID: ${userId}`);
    res.status(204).json({ // Or res.status(204).send();
      status: 'success',
      data: null,
    });
  });

  // --- Admin User Management ---

  getAllUsers = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    logger.info('Admin fetching all users');
    // Add query params for pagination, filtering, sorting (e.g., req.query)
    const users = await UserService.fetchAllUsers(req.query, logger); // Pass logger

    logger.info(`Successfully fetched ${users.length} users`);
    res.status(200).json({
      status: 'success',
      results: users.length,
      data: { users }, // UserService ensures 'users' are clean
    });
  });

  getUserById = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    const { userId } = req.params;
    logger.info(`Admin fetching user by ID: ${userId}`);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(new BadRequestError('Invalid user ID format'));
    }
    const user = await UserService.fetchUserById(userId, logger); // Pass logger

    logger.info(`Successfully fetched user by ID: ${userId}`);
    res.status(200).json({
      status: 'success',
      data: { user }, // UserService ensures 'user' is clean
    });
  });

  updateUserById = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    const { userId } = req.params;
    const updateData = req.body;
    logger.info(`Admin updating user ID: ${userId}`, { updateData });

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(new BadRequestError('Invalid user ID format'));
    }
    // Input validation for updateData by middleware

    const updatedUser = await UserService.updateUserAsAdmin(userId, updateData, logger); // Pass logger

    logger.info(`Admin successfully updated user ID: ${userId}`);
    res.status(200).json({
      status: 'success',
      message: 'User updated successfully by admin',
      data: { user: updatedUser }, // UserService ensures 'user' is clean
    });
  });

  deleteUserById = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    const { userId } = req.params;
    logger.warn(`Admin deleting user ID: ${userId}`);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(new BadRequestError('Invalid user ID format'));
    }
    // Potentially prevent admin from deleting themselves if that's a business rule
    if (req.user.id === userId) {
        return next(new ForbiddenError('Administrators cannot delete their own account using this endpoint.'));
    }

    await UserService.deleteUserAsAdmin(userId, logger); // Pass logger

    logger.info(`Admin successfully deleted user ID: ${userId}`);
    res.status(204).json({ // Or res.status(204).send();
      status: 'success',
      data: null,
    });
  });
}

module.exports = new UserController();
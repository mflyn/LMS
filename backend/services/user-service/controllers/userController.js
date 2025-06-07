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
const User = require('../../../common/models/User');

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
    logger.info(`Fetching profile for current user ID: ${userId}`);

    const user = await UserService.getUserProfile(userId, logger);

    logger.info(`Profile successfully fetched for user ID: ${userId}`);
    res.status(200).json({
      status: 'success',
      data: { user },
    });
  });

  updateProfile = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    const userId = req.user.id;
    const updateData = req.body;
    logger.info(`Update profile attempt for current user ID: ${userId}`, { updateData });

    // UserService.updateUserProfile handles stripping disallowed fields (role, password, email)
    const updatedUser = await UserService.updateUserProfile(userId, updateData, logger);

    logger.info(`Profile updated successfully for user ID: ${userId}`);
    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: { user: updatedUser },
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

  // --- User Management (for /api/users and /api/users/:userId) ---

  getAllUsers = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    // Permissions (admin, superadmin, teacher) are handled by checkRole middleware in routes
    logger.info(`Fetching all users by user: ${req.user.username} (role: ${req.user.role})`, { query: req.query });
    const users = await UserService.fetchAllUsers(req.query, logger);

    logger.info(`Successfully fetched ${users.length} users`);
    res.status(200).json({
      status: 'success',
      results: users.length,
      data: { users },
    });
  });

  getUserById = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    const requestedUserId = req.params.userId;
    const requestingUser = req.user; // User making the request

    logger.info(`Fetching user by ID: ${requestedUserId}, requested by: ${requestingUser.username} (role: ${requestingUser.role})`);

    if (!mongoose.Types.ObjectId.isValid(requestedUserId)) {
      return next(new BadRequestError('Invalid user ID format'));
    }

    // 1. User can always get their own profile
    if (requestingUser.id === requestedUserId) {
      const user = await UserService.getUserProfile(requestedUserId, logger); // Use getUserProfile for self
      logger.info(`User ${requestingUser.username} fetched their own profile.`);
      return res.status(200).json({ status: 'success', data: { user } });
    }

    // 2. Admins and Superadmins can get any user
    if (['admin', 'superadmin'].includes(requestingUser.role)) {
      const user = await UserService.fetchUserById(requestedUserId, logger); // Standard fetch for admin
      logger.info(`Admin ${requestingUser.username} fetched user ID: ${requestedUserId}`);
      return res.status(200).json({ status: 'success', data: { user } });
    }
    
    // 3. Teachers can get any user (as per requirement 1)
    // This might be too broad if teachers should only see students, refine if needed.
    // For now, assuming teachers can see all user profiles based on "1 教师允许获取全部用户信息"
    // which could imply "teacher can fetch any specific user profile as well".
    // If teachers should only see students, or only users within their "management scope", this needs more logic.
    // The `getAllUsers` endpoint for teachers is already filtered by `checkRole(['admin', 'superadmin', 'teacher'])`
    // and `UserService.fetchAllUsers` would return all users.
    // To be consistent with "teachers can get ALL user info", let's allow it here for specific users too.
    if (requestingUser.role === 'teacher') {
      const user = await UserService.fetchUserById(requestedUserId, logger);
      logger.info(`Teacher ${requestingUser.username} fetched user ID: ${requestedUserId}`);
      return res.status(200).json({ status: 'success', data: { user } });
    }

    // 4. Parents can get their children's profiles
    if (requestingUser.role === 'parent') {
      // Fetch the parent's user object again to ensure we have the children array
      // req.user might not be populated with all details like parentDetails.children
      // It's safer to fetch the full parent user object here.
      const parentUser = await User.findById(requestingUser.id).populate('parentDetails.children'); // Or however children are stored
      if (parentUser && parentUser.parentDetails && parentUser.parentDetails.children) {
        const isChild = parentUser.parentDetails.children.some(child => child._id.toString() === requestedUserId);
        if (isChild) {
          const user = await UserService.fetchUserById(requestedUserId, logger); // fetch the child's profile
          logger.info(`Parent ${requestingUser.username} fetched child's profile ID: ${requestedUserId}`);
          return res.status(200).json({ status: 'success', data: { user } });
        }
      }
      logger.warn(`Parent ${requestingUser.username} attempt to access non-child user ID: ${requestedUserId}`);
      return next(new ForbiddenError('You are not authorized to view this user\'s profile.'));
    }

    // 5. If none of the above, deny access
    logger.warn(`User ${requestingUser.username} (role: ${requestingUser.role}) forbidden to access user ID: ${requestedUserId}`);
    return next(new ForbiddenError('You are not authorized to view this user\'s profile.'));
  });
  
  // This is for admins creating users via POST /api/users
  createUser = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    const userData = req.body;
    logger.info(`Admin ${req.user.username} attempting to create new user`, { userData });

    // Validation is expected to be handled by middleware (e.g., createUserValidator)
    
    const newUser = await UserService.createUserAsAdmin(userData, logger);
    
    logger.info(`Admin ${req.user.username} successfully created user: ${newUser.username} (ID: ${newUser._id})`);
    res.status(201).json({
        status: 'success',
        data: { user: newUser } // newUser is already cleaned by UserService
    });
  });

  updateUserById = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    const { userId } = req.params;
    const updateData = req.body;
    logger.info(`User ${req.user.username} (role: ${req.user.role}) updating user ID: ${userId}`, { updateData });

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(new BadRequestError('Invalid user ID format'));
    }

    // If a non-admin tries to update someone else through this endpoint (though routes should prevent this for non-admins)
    if (req.user.id !== userId && !['admin', 'superadmin'].includes(req.user.role)) {
        logger.warn(`Forbidden attempt by ${req.user.username} to update user ${userId}`);
        return next(new ForbiddenError('You are not authorized to update this user.'));
    }
    
    // If user is updating themselves AND they are NOT an admin, route to profile update logic
    // This ensures they can't change their role or password directly via this generic endpoint.
    // However, our routes are now distinct: /me for self-update, /:userId for admin update.
    // So, this controller method (updateUserById) is now SOLELY for admin updates as per routes.js checkRole.
    // The UserService.updateUserAsAdmin will handle admin-specific logic (e.g. password hashing, role change).

    const updatedUser = await UserService.updateUserAsAdmin(userId, updateData, logger); // Pass logger

    logger.info(`Successfully updated user ID: ${userId} by ${req.user.username}`);
    res.status(200).json({
      status: 'success',
      message: 'User updated successfully by admin',
      data: { user: updatedUser }, // UserService ensures 'user' is clean
    });
  });

  deleteUserById = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    const { userId } = req.params;
    // Permission (admin, superadmin) is handled by checkRole in routes.
    logger.warn(`User ${req.user.username} (role: ${req.user.role}) deleting user ID: ${userId}`);

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
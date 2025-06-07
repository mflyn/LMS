const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../../../common/models/User'); // 修正：使用公共模型
const Role = require('../../../common/models/Role'); // 修正：使用公共模型
const { generateToken } = require('../../../common/middleware/auth'); // 修正路径
const {
  AppError,
  BadRequestError,
  NotFoundError,
  AuthenticationError,
  ConflictError,
  ForbiddenError
} = require('../../../common/middleware/errorTypes'); // 修正路径

// Helper function to clean user object (remove password)
const cleanUser = (user) => {
  if (!user) return null;
  const userObj = user.toObject ? user.toObject() : { ...user };
  delete userObj.password;
  // delete userObj.__v; // Optionally remove version key
  return userObj;
};

class UserService {
  async registerUser(userData, logger) {
    logger.info('[UserService] Attempting to register new user', { username: userData.username, email: userData.email });

    const { username, email, password, role, ...otherData } = userData;

    if (!username || !email || !password || !role) {
      logger.warn('[UserService] Registration failed: Missing required fields');
      throw new BadRequestError('Username, email, password, and role are required.');
    }

    // Validate role against the Role model
    const existingRole = await Role.findOne({ name: role });
    if (!existingRole) {
      logger.warn(`[UserService] Registration failed: Invalid role specified - ${role}. This role does not exist in the Role collection.`);
      throw new BadRequestError(`Invalid role: ${role}. Ensure the role is predefined in the system.`);
    }
    // Note: User.role enum validation will also apply when saving.

    let existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      if (existingUser.email === email) {
        logger.warn('[UserService] Registration failed: Email already exists', { email });
        throw new ConflictError('Email already exists.');
      }
      if (existingUser.username === username) {
        logger.warn('[UserService] Registration failed: Username already exists', { username });
        throw new ConflictError('Username already exists.');
      }
    }
    
    // Password hashing is handled by the pre-save hook in User model, if defined there.
    // If not, hash here:
    // const salt = await bcrypt.genSalt(10);
    // const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      email,
      password, // Assuming pre-save hook hashes it
      role,
      ...otherData, // Spread other relevant fields based on your User model
    });

    try {
      await newUser.save();
      logger.info('[UserService] User registered successfully', { userId: newUser._id, username: newUser.username });

      const token = generateToken({ id: newUser._id, username: newUser.username, role: newUser.role });
      return { user: cleanUser(newUser), token };
    } catch (error) {
      logger.error('[UserService] Error during user registration', { error: error.message, stack: error.stack });
      if (error.name === 'ValidationError') {
        // Extract specific validation messages if possible
        const messages = Object.values(error.errors).map(e => e.message).join(', ');
        throw new BadRequestError(`Validation failed: ${messages}`);
      }
      // Handle other potential save errors, e.g., duplicate key if unique index check failed earlier
      throw new AppError('Failed to register user due to a server error.', 500);
    }
  }

  async loginUser({ username, password }, logger) {
    logger.info('[UserService] Attempting to login user', { loginIdentifier: username });

    if (!username || !password) {
      logger.warn('[UserService] Login failed: Missing username/email or password');
      throw new BadRequestError('Username/Email and password are required.');
    }

    // Allow login with either username or email
    const user = await User.findOne({ 
      $or: [
        { email: username }, 
        { username: username } 
      ]
    }).select('+password'); 
    
    if (!user) {
      logger.warn('[UserService] Login failed: User not found', { loginIdentifier: username });
      throw new AuthenticationError('Invalid credentials.'); // Generic message for security
    }

    const isMatch = await user.comparePassword(password); 
    if (!isMatch) {
      logger.warn('[UserService] Login failed: Password mismatch', { loginIdentifier: username });
      throw new AuthenticationError('Invalid credentials.'); // Generic message
    }

    logger.info('[UserService] User logged in successfully', { userId: user._id, loginIdentifier: username });
    const token = generateToken({ id: user._id, username: user.username, role: user.role });
    return { user: cleanUser(user), token };
  }

  async getUserProfile(userId, logger) {
    logger.info(`[UserService] Fetching profile for user ID: ${userId}`);
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        logger.warn(`[UserService] Invalid user ID format for getProfile: ${userId}`);
        throw new BadRequestError('Invalid user ID format.');
    }

    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`[UserService] User profile not found for ID: ${userId}`);
      throw new NotFoundError('User not found.');
    }
    logger.info(`[UserService] Profile successfully fetched for user ID: ${userId}`);
    return cleanUser(user);
  }

  async updateUserProfile(userId, updateData, logger) {
    logger.info(`[UserService] Attempting to update profile for user ID: ${userId}`, { updateData });
     if (!mongoose.Types.ObjectId.isValid(userId)) {
        logger.warn(`[UserService] Invalid user ID format for updateProfile: ${userId}`);
        throw new BadRequestError('Invalid user ID format.');
    }

    // Prevent disallowed fields from being updated (e.g., role, email if not allowed)
    const allowedUpdates = { ...updateData };
    delete allowedUpdates.email; // Example: prevent email update via this method
    delete allowedUpdates.role;
    delete allowedUpdates.password; // Password change should be a separate process

    const user = await User.findByIdAndUpdate(userId, { $set: allowedUpdates }, { new: true, runValidators: true });
    if (!user) {
      logger.warn(`[UserService] User not found for profile update, ID: ${userId}`);
      throw new NotFoundError('User not found.');
    }

    logger.info(`[UserService] Profile updated successfully for user ID: ${userId}`);
    return cleanUser(user);
  }

  async deleteUserAccount(userId, logger) {
    logger.warn(`[UserService] Attempting to delete account for user ID: ${userId}`);
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        logger.warn(`[UserService] Invalid user ID format for deleteUserAccount: ${userId}`);
        throw new BadRequestError('Invalid user ID format.');
    }

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      logger.warn(`[UserService] User not found for account deletion, ID: ${userId}`);
      throw new NotFoundError('User not found.');
    }
    logger.info(`[UserService] Account successfully deleted for user ID: ${userId}`);
    return true; // Or some confirmation
  }

  // --- Admin User Management Methods ---

  async fetchAllUsers(queryParams, logger) {
    logger.info('[UserService] Admin fetching all users', { queryParams });
    // Implement pagination, filtering, sorting based on queryParams
    // Example: const { page = 1, limit = 10, sortBy, filterField, filterValue } = queryParams;
    // const users = await User.find({ query }).sort(sortBy).skip((page - 1) * limit).limit(limit);
    const users = await User.find({}); // Basic implementation
    logger.info(`[UserService] Successfully fetched ${users.length} users`);
    return users.map(cleanUser);
  }

  async fetchUserById(userId, logger) {
    logger.info(`[UserService] Admin fetching user by ID: ${userId}`);
     if (!mongoose.Types.ObjectId.isValid(userId)) {
        logger.warn(`[UserService] Invalid user ID format for fetchUserById (admin): ${userId}`);
        throw new BadRequestError('Invalid user ID format.');
    }
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`[UserService] Admin: User not found for ID: ${userId}`);
      throw new NotFoundError('User not found.');
    }
    logger.info(`[UserService] Admin: Successfully fetched user by ID: ${userId}`);
    return cleanUser(user);
  }

  async updateUserAsAdmin(userId, updateData, logger) {
    logger.info(`[UserService] Admin attempting to update user ID: ${userId}`, { updateData });
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        logger.warn(`[UserService] Invalid user ID format for updateUserAsAdmin: ${userId}`);
        throw new BadRequestError('Invalid user ID format.');
    }

    // Admin might be allowed to update more fields, like 'role'
    // Handle password update: if password is in updateData and not empty, it should be hashed.
    if (updateData.password && typeof updateData.password === 'string' && updateData.password.trim() !== '') {
        logger.info(`[UserService] Admin update for user ${userId} includes new password. Hashing password.`);
        // Password hashing is handled by the pre-save hook in User model if we trigger .save()
        // Since findByIdAndUpdate bypasses save hooks for password, we need to hash it manually here OR fetch and save.
        // For simplicity and directness with findByIdAndUpdate, we'll hash manually here.
        // This means the User model's pre-save password hook won't run for this specific update path.
        const salt = await bcrypt.genSalt(10);
        updateData.password = await bcrypt.hash(updateData.password, salt);
    } else if (updateData.hasOwnProperty('password')) {
        // If password field is present but empty or not a string, remove it to avoid setting an invalid password
        delete updateData.password;
        logger.info(`[UserService] Admin update for user ${userId} had an empty or invalid password field, it will be ignored.`);
    }

    const user = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true });
    if (!user) {
      logger.warn(`[UserService] Admin: User not found for update, ID: ${userId}`);
      throw new NotFoundError('User not found.');
    }
    logger.info(`[UserService] Admin: Successfully updated user ID: ${userId}`);
    return cleanUser(user);
  }

  async deleteUserAsAdmin(userId, logger) {
    logger.warn(`[UserService] Admin attempting to delete user ID: ${userId}`);
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        logger.warn(`[UserService] Invalid user ID format for deleteUserAsAdmin: ${userId}`);
        throw new BadRequestError('Invalid user ID format.');
    }
    // Business rule: Admin cannot delete themselves via this specific admin endpoint.
    // This check is better placed in the controller which has access to req.user.id

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      logger.warn(`[UserService] Admin: User not found for deletion, ID: ${userId}`);
      throw new NotFoundError('User not found.');
    }
    logger.info(`[UserService] Admin: Successfully deleted user ID: ${userId}`);
    return true;
  }

  async createUserAsAdmin(userData, logger) {
    logger.info('[UserService] Admin attempting to create new user', { username: userData.username, email: userData.email });

    const { username, email, password, role, ...otherData } = userData;

    if (!username || !email || !password || !role) {
      logger.warn('[UserService] Admin user creation failed: Missing required fields');
      throw new BadRequestError('Username, email, password, and role are required for admin user creation.');
    }

    // Validate role against the Role model
    const existingRole = await Role.findOne({ name: role });
    if (!existingRole) {
      logger.warn(`[UserService] Admin user creation failed: Invalid role specified - ${role}.`);
      throw new BadRequestError(`Invalid role: ${role}. Ensure the role is predefined in the system.`);
    }

    let existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      if (existingUser.email === email) {
        logger.warn('[UserService] Admin user creation failed: Email already exists', { email });
        throw new ConflictError('Email already exists.');
      }
      if (existingUser.username === username) {
        logger.warn('[UserService] Admin user creation failed: Username already exists', { username });
        throw new ConflictError('Username already exists.');
      }
    }
    
    // Password will be hashed by the pre-save hook in the User model.
    const newUser = new User({
      username,
      email,
      password, // User model's pre-save hook will hash this
      role,
      ...otherData,
      isActive: userData.isActive === undefined ? true : userData.isActive, // Default to true if not specified
    });

    try {
      await newUser.save();
      logger.info('[UserService] Admin successfully created user', { userId: newUser._id, username: newUser.username });
      return cleanUser(newUser);
    } catch (error) {
      logger.error('[UserService] Error during admin user creation', { error: error.message, stack: error.stack });
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(e => e.message).join(', ');
        throw new BadRequestError(`Validation failed: ${messages}`);
      }
      throw new AppError('Failed to create user due to a server error.', 500);
    }
  }

  async changePassword(userId, oldPassword, newPassword, logger) {
    logger.info(`[UserService] Attempting to change password for user ID: ${userId}`);

    if (!oldPassword || !newPassword) {
      logger.warn('[UserService] Change password failed: Missing old or new password');
      throw new BadRequestError('Old password and new password are required.');
    }

    if (oldPassword === newPassword) {
      logger.warn('[UserService] Change password failed: New password cannot be the same as the old password.');
      throw new BadRequestError('New password must be different from the old password.');
    }
    
    // Password policy check (e.g., length, complexity) for newPassword should ideally be done
    // by validation middleware before calling the service, or here if necessary.
    // For example, if you have a common password policy checker:
    // const passwordPolicy = require('../../../common/middleware/passwordPolicy'); // Adjust path
    // if (!passwordPolicy.validate(newPassword)) { // Assuming validate returns true/false or throws
    //   throw new BadRequestError('New password does not meet policy requirements.');
    // }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      logger.warn(`[UserService] Change password failed: User not found for ID: ${userId}`);
      throw new NotFoundError('User not found.');
    }

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      logger.warn(`[UserService] Change password failed: Old password mismatch for user ID: ${userId}`);
      throw new AuthenticationError('Incorrect old password.');
    }

    user.password = newPassword; // The pre-save hook in User model will hash this
    await user.save();

    logger.info(`[UserService] Password changed successfully for user ID: ${userId}`);
    return { message: 'Password changed successfully.' };
  }
}

module.exports = new UserService();

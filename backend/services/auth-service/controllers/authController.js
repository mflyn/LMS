const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { catchAsync } = require('../../../common/middleware/errorHandler');
const User = require('../../../common/models/User');
const { generateToken } = require('../../../common/middleware/auth');
const { BadRequestError, UnauthorizedError, ConflictError } = require('../../../common/middleware/errorTypes');

// 使用统一的配置管理和日志系统
const { configManager } = require('../../../common/config');
const { createLogger } = require('../../../common/config/logger');
const logger = createLogger('auth-controller');

// 注册控制器
exports.register = catchAsync(async (req, res, next) => {
  const { username, password, email, phone, name, role } = req.body;

  // 检查用户名是否已存在
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    throw new ConflictError('用户名已存在');
  }

  // 检查邮箱是否已存在（如果提供了邮箱）
  if (email) {
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      throw new ConflictError('邮箱已存在');
    }
  }

  // 检查手机号是否已存在（如果提供了手机号）
  if (phone) {
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      throw new ConflictError('手机号已存在');
    }
  }

  // 创建新用户
  const user = new User({
    username,
    password,
    email,
    phone,
    name,
    role
  });

  // 保存用户
  await user.save();

  // 使用统一配置生成JWT令牌
  const jwtConfig = configManager.getServiceConfig('auth');
  const token = jwt.sign(
    { id: user._id, role: user.role },
    jwtConfig.jwtSecret,
    { expiresIn: jwtConfig.tokenExpiration }
  );

  // 记录成功注册日志
  logger.info('用户注册成功', {
    userId: user._id,
    username: user.username,
    role: user.role,
    registrationType: user.registrationType,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // 返回用户信息和令牌
  res.status(201).json({
    status: 'success',
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role,
        registrationType: user.registrationType
      },
      token
    }
  });
});

// 登录控制器（用户名登录）
exports.login = catchAsync(async (req, res, next) => {
  const { username, password } = req.body;

  // 查找用户
  const user = await User.findOne({ username });
  if (!user) {
    logger.warn('登录失败 - 用户不存在', {
      username,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    throw new UnauthorizedError('用户名或密码错误');
  }

  // 验证密码
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    logger.warn('登录失败 - 密码错误', {
      userId: user._id,
      username: user.username,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    throw new UnauthorizedError('用户名或密码错误');
  }

  // 更新最后登录时间
  user.lastLogin = new Date();
  await user.save();

  // 使用统一配置生成JWT令牌
  const jwtConfig = configManager.getServiceConfig('auth');
  const token = jwt.sign(
    { id: user._id, role: user.role },
    jwtConfig.jwtSecret,
    { expiresIn: jwtConfig.tokenExpiration }
  );

  // 记录成功登录日志
  logger.info('用户登录成功', {
    userId: user._id,
    username: user.username,
    role: user.role,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // 返回用户信息和令牌
  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role,
        registrationType: user.registrationType
      },
      token
    }
  });
});

// 邮箱或手机号登录控制器
exports.loginWithEmailOrPhone = catchAsync(async (req, res, next) => {
  const { identifier, password } = req.body;

  // 查找用户（通过邮箱或手机号）
  const user = await User.findByEmailOrPhone(identifier);
  if (!user) {
    logger.warn('邮箱/手机号登录失败 - 用户不存在', {
      identifier,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    throw new UnauthorizedError('邮箱/手机号或密码错误');
  }

  // 验证密码
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    logger.warn('邮箱/手机号登录失败 - 密码错误', {
      userId: user._id,
      identifier,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    throw new UnauthorizedError('邮箱/手机号或密码错误');
  }

  // 更新最后登录时间
  user.lastLogin = new Date();
  await user.save();

  // 使用统一配置生成JWT令牌
  const jwtConfig = configManager.getServiceConfig('auth');
  const token = jwt.sign(
    { id: user._id, role: user.role },
    jwtConfig.jwtSecret,
    { expiresIn: jwtConfig.tokenExpiration }
  );

  // 记录成功登录日志
  logger.info('邮箱/手机号登录成功', {
    userId: user._id,
    identifier,
    role: user.role,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // 返回用户信息和令牌
  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role,
        registrationType: user.registrationType
      },
      token
    }
  });
});

// 登出控制器
exports.logout = (req, res) => {
  res.status(200).json({
    status: 'success',
    message: '登出成功'
  });
};

// 验证令牌控制器
exports.verifyToken = (req, res) => {
  try {
    // 获取请求头中的令牌
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: '未认证'
      });
    }

    // 提取令牌
    const token = authHeader.split(' ')[1];

    // 验证令牌
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // 返回用户信息
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: decoded.id,
          username: decoded.username,
          role: decoded.role
        }
      }
    });
  } catch (error) {
    logger.error('验证令牌失败:', error);
    res.status(401).json({
      status: 'error',
      message: '无效的认证令牌',
      error: error.message
    });
  }
};

// 修改密码控制器
exports.changePassword = catchAsync(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.id;

  // 查找用户
  const user = await User.findById(userId);
  if (!user) {
    throw new UnauthorizedError('用户不存在');
  }

  // 验证旧密码
  const isMatch = await user.comparePassword(oldPassword);
  if (!isMatch) {
    logger.warn('修改密码失败 - 旧密码错误', {
      userId: user._id,
      username: user.username,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    throw new BadRequestError('旧密码错误');
  }

  // 更新密码
  user.password = newPassword;
  await user.save();

  // 记录密码修改日志
  logger.info('用户密码修改成功', {
    userId: user._id,
    username: user.username,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  res.status(200).json({
    status: 'success',
    message: '密码修改成功'
  });
});

// 获取用户信息控制器
exports.getProfile = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const user = await User.findById(userId).select('-password');
  if (!user) {
    throw new UnauthorizedError('用户不存在');
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role,
        registrationType: user.registrationType,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    }
  });
});

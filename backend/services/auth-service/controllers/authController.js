const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
// 使用 console 代替 logger
const logger = {
  info: console.info,
  error: console.error,
  warn: console.warn,
  debug: console.debug
};

// 注册控制器
exports.register = async (req, res) => {
  try {
    const { username, password, email, name, role } = req.body;

    // 检查用户名是否已存在
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: '用户名已存在'
      });
    }

    // 检查邮箱是否已存在
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        status: 'error',
        message: '邮箱已被注册'
      });
    }

    // 创建新用户
    const user = new User({
      username,
      password,
      email,
      name,
      role
    });

    // 保存用户
    await user.save();

    // 创建JWT令牌
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    // 返回用户信息和令牌
    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    logger.error('注册失败:', error);
    res.status(500).json({
      status: 'error',
      message: '注册失败',
      error: error.message
    });
  }
};

// 登录控制器
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 查找用户
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: '用户名或密码错误'
      });
    }

    // 验证密码
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: '用户名或密码错误'
      });
    }

    // 创建JWT令牌
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    // 返回用户信息和令牌
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          username: user.username,
          name: user.name,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    logger.error('登录失败:', error);
    res.status(500).json({
      status: 'error',
      message: '登录失败',
      error: error.message
    });
  }
};

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
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    // 查找用户
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: '用户不存在'
      });
    }

    // 验证旧密码
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: '旧密码错误'
      });
    }

    // 更新密码
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: '密码修改成功'
    });
  } catch (error) {
    logger.error('修改密码失败:', error);
    res.status(500).json({
      status: 'error',
      message: '修改密码失败',
      error: error.message
    });
  }
};

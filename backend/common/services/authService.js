const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

class AuthService {
  constructor({ logger }) {
    this.logger = logger;
  }

  /**
   * 注册新用户
   * @param {Object} userData 用户数据
   * @returns {Promise<Object>} 注册结果
   */
  async register(userData) {
    try {
      // 检查用户名是否已存在
      const existingUser = await User.findOne({ username: userData.username });
      if (existingUser) {
        throw new Error('用户名已存在');
      }

      // 检查邮箱是否已存在
      if (userData.email) {
        const existingEmail = await User.findOne({ email: userData.email });
        if (existingEmail) {
          throw new Error('邮箱已被注册');
        }
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // 创建新用户
      const user = new User({
        username: userData.username,
        password: hashedPassword,
        email: userData.email,
        role: userData.role
      });

      // 保存用户
      await user.save();

      this.logger.info(`用户 ${userData.username} 注册成功`);

      return {
        success: true,
        user
      };
    } catch (error) {
      this.logger.error(`注册失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 用户登录
   * @param {Object} credentials 登录凭证
   * @returns {Promise<Object>} 登录结果
   */
  async login(credentials) {
    try {
      // 查找用户
      const user = await User.findOne({ username: credentials.username });
      if (!user) {
        throw new Error('用户名或密码不正确');
      }

      // 验证密码
      const isMatch = await bcrypt.compare(credentials.password, user.password);
      if (!isMatch) {
        throw new Error('用户名或密码不正确');
      }

      // 创建JWT令牌
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1d' }
      );

      this.logger.info(`用户 ${credentials.username} 登录成功`);

      return {
        token,
        user: {
          id: user._id,
          username: user.username,
          role: user.role
        }
      };
    } catch (error) {
      this.logger.error(`登录失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 验证令牌
   * @param {string} token JWT令牌
   * @returns {Promise<Object>} 验证结果
   */
  async verifyToken(token) {
    try {
      // 验证令牌
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

      // 查找用户
      const user = await User.findById(decoded.id);
      if (!user) {
        throw new Error('用户不存在');
      }

      return {
        valid: true,
        user: {
          id: user._id,
          username: user.username,
          role: user.role
        }
      };
    } catch (error) {
      this.logger.error(`验证令牌失败: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { AuthService };

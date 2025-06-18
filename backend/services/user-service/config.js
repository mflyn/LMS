/**
 * 用户服务配置
 * 使用统一配置管理器
 */

const { configManager } = require('../../common/config');

// 获取用户服务专用配置
const userServiceConfig = configManager.getServiceConfig('user');

module.exports = {
  // 基础配置
  port: userServiceConfig.port,
  mongoURI: userServiceConfig.mongoUri,
  
  // 认证配置
  jwtSecret: userServiceConfig.jwtSecret,
  
  // Redis配置
  redis: userServiceConfig.redisConfig,
  
  // CORS配置
  cors: userServiceConfig.corsConfig,
  
  // 限流配置
  rateLimit: userServiceConfig.rateLimitConfig,
  
  // 日志配置
  logLevel: userServiceConfig.logLevel,
  logFilePath: userServiceConfig.logFilePath,
  
  // 环境配置
  nodeEnv: userServiceConfig.nodeEnv,
  
  // 用户服务特定配置
  userConfig: {
    // 密码策略
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false
    },
    
    // 会话配置
    session: {
      maxConcurrentSessions: 3,
      sessionTimeout: 24 * 60 * 60 * 1000, // 24小时
      refreshTokenRotation: true
    },
    
    // 账户锁定策略
    accountLockout: {
      enabled: true,
      maxAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15分钟
      resetTime: 60 * 60 * 1000 // 1小时后重置计数
    },
    
    // 邮箱验证
    emailVerification: {
      required: configManager.get('NODE_ENV') === 'production',
      tokenExpiration: 24 * 60 * 60 * 1000 // 24小时
    }
  }
};
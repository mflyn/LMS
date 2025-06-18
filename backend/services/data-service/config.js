/**
 * 数据服务配置
 * 使用统一配置管理器
 */

const { configManager } = require('../../common/config');

// 获取数据服务专用配置
const dataServiceConfig = configManager.getServiceConfig('data');

module.exports = {
  // 基础配置
  port: dataServiceConfig.port,
  mongoURI: dataServiceConfig.mongoUri,
  
  // 认证配置（通过网关传递）
  jwtSecret: dataServiceConfig.jwtSecret,
  
  // Redis配置
  redis: dataServiceConfig.redisConfig,
  
  // CORS配置
  cors: dataServiceConfig.corsConfig,
  
  // 限流配置
  rateLimit: dataServiceConfig.rateLimitConfig,
  
  // 日志配置
  logLevel: dataServiceConfig.logLevel,
  logFilePath: dataServiceConfig.logFilePath,
  
  // 环境配置
  nodeEnv: dataServiceConfig.nodeEnv,
  
  // 数据服务特定配置
  dataConfig: {
    // 数据缓存策略
    cache: {
      enabled: true,
      ttl: 5 * 60 * 1000, // 5分钟
      maxSize: 1000,
      checkPeriod: 60 * 1000 // 1分钟检查一次
    },
    
    // 数据分页配置
    pagination: {
      defaultLimit: 20,
      maxLimit: 100,
      defaultOffset: 0
    },
    
    // 数据验证配置
    validation: {
      strictMode: configManager.get('NODE_ENV') === 'production',
      allowUnknownFields: configManager.get('NODE_ENV') === 'development'
    },
    
    // 数据备份配置
    backup: {
      enabled: configManager.get('NODE_ENV') === 'production',
      interval: 24 * 60 * 60 * 1000, // 24小时
      retention: 30 // 保留30天
    },
    
    // 数据同步配置
    sync: {
      enabled: true,
      batchSize: 100,
      retryAttempts: 3,
      retryDelay: 1000
    }
  }
};
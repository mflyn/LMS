/**
 * 统一配置管理中心
 * 提供配置验证、环境变量管理和配置热重载功能
 */

const Joi = require('joi');
const path = require('path');
const fs = require('fs');

// 配置验证模式
const configSchema = Joi.object({
  // 环境配置
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  
  // JWT配置
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_TOKEN_EXPIRATION: Joi.string().default('1d'),
  JWT_REFRESH_TOKEN_EXPIRATION: Joi.string().default('7d'),
  
  // 数据库配置
  MONGO_URI: Joi.string().uri({ scheme: ['mongodb', 'mongodb+srv'] }).required(),
  USER_SERVICE_MONGO_URI: Joi.string().uri({ scheme: ['mongodb', 'mongodb+srv'] }).optional(),
  DATA_SERVICE_MONGO_URI: Joi.string().uri({ scheme: ['mongodb', 'mongodb+srv'] }).optional(),
  
  // 服务端口配置
  GATEWAY_PORT: Joi.number().port().default(5000),
  USER_SERVICE_PORT: Joi.number().port().default(3001),
  DATA_SERVICE_PORT: Joi.number().port().default(3003),
  ANALYTICS_SERVICE_PORT: Joi.number().port().default(3007),
  HOMEWORK_SERVICE_PORT: Joi.number().port().default(3008),
  PROGRESS_SERVICE_PORT: Joi.number().port().default(3009),
  INTERACTION_SERVICE_PORT: Joi.number().port().default(3010),
  NOTIFICATION_SERVICE_PORT: Joi.number().port().default(3011),
  RESOURCE_SERVICE_PORT: Joi.number().port().default(3012),
  
  // 服务URL配置
  USER_SERVICE_URL: Joi.string().uri().optional(),
  DATA_SERVICE_URL: Joi.string().uri().optional(),
  ANALYTICS_SERVICE_URL: Joi.string().uri().optional(),
  HOMEWORK_SERVICE_URL: Joi.string().uri().optional(),
  PROGRESS_SERVICE_URL: Joi.string().uri().optional(),
  INTERACTION_SERVICE_URL: Joi.string().uri().optional(),
  NOTIFICATION_SERVICE_URL: Joi.string().uri().optional(),
  RESOURCE_SERVICE_URL: Joi.string().uri().optional(),
  
  // 日志配置
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'http', 'debug').default('info'),
  LOG_FILE_PATH: Joi.string().default('./logs'),
  
  // Redis配置
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),
  
  // 邮件配置
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().port().optional(),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),
  
  // 文件上传配置
  UPLOAD_MAX_SIZE: Joi.number().default(10 * 1024 * 1024), // 10MB
  UPLOAD_ALLOWED_TYPES: Joi.string().default('image/jpeg,image/png,image/gif,application/pdf'),
  
  // 安全配置
  RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000), // 15分钟
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  CORS_ORIGIN: Joi.string().default('*'),
  INTERNAL_SERVICE_TOKEN: Joi.string().min(32).optional(),
  STAR_AWARD_TIMEOUT_MS: Joi.number().integer().positive().default(3000),
  
  // 监控配置
  ENABLE_METRICS: Joi.boolean().default(false),
  METRICS_PORT: Joi.number().port().default(9090),
  
  // 外部服务配置
  EXTERNAL_API_TIMEOUT: Joi.number().default(30000), // 30秒
  EXTERNAL_API_RETRY_ATTEMPTS: Joi.number().default(3)
}).unknown();

class ConfigManager {
  constructor() {
    this.config = null;
    this.watchers = new Map();
    this.loadConfig();
  }
  
  /**
   * 加载和验证配置
   */
  loadConfig() {
    try {
      // 验证环境变量
      const { error, value } = configSchema.validate(process.env, {
        allowUnknown: true,
        stripUnknown: false
      });
      
      if (error) {
        throw new Error(`配置验证失败: ${error.details.map(d => d.message).join(', ')}`);
      }
      
      this.config = this.processConfig(value);
      
      // 在开发环境下启用配置文件监听
      if (this.config.NODE_ENV === 'development') {
        this.setupConfigWatcher();
      }
      
      console.log(`✅ 配置加载成功 (环境: ${this.config.NODE_ENV})`);
    } catch (error) {
      console.error('❌ 配置加载失败:', error.message);
      if (process.env.NODE_ENV === 'test') {
        throw error;
      }
      process.exit(1);
    }
  }
  
  /**
   * 处理配置，生成派生配置
   */
  processConfig(rawConfig) {
    const config = { ...rawConfig };
    
    // 生成服务URL映射
    config.SERVICE_URLS = {
      user: config.USER_SERVICE_URL || `http://localhost:${config.USER_SERVICE_PORT}`,
      data: config.DATA_SERVICE_URL || `http://localhost:${config.DATA_SERVICE_PORT}`,
      analytics: config.ANALYTICS_SERVICE_URL || `http://localhost:${config.ANALYTICS_SERVICE_PORT}`,
      homework: config.HOMEWORK_SERVICE_URL || `http://localhost:${config.HOMEWORK_SERVICE_PORT}`,
      progress: config.PROGRESS_SERVICE_URL || `http://localhost:${config.PROGRESS_SERVICE_PORT}`,
      interaction: config.INTERACTION_SERVICE_URL || `http://localhost:${config.INTERACTION_SERVICE_PORT}`,
      notification: config.NOTIFICATION_SERVICE_URL || `http://localhost:${config.NOTIFICATION_SERVICE_PORT}`,
      resource: config.RESOURCE_SERVICE_URL || `http://localhost:${config.RESOURCE_SERVICE_PORT}`
    };
    
    // 生成数据库连接配置
    config.DATABASE_CONFIGS = {
      default: config.MONGO_URI,
      user: config.USER_SERVICE_MONGO_URI || config.MONGO_URI,
      data: config.DATA_SERVICE_MONGO_URI || config.MONGO_URI
    };
    
    // 生成Redis配置
    config.REDIS_CONFIG = {
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null
    };
    
    // 生成CORS配置
    config.CORS_CONFIG = {
      origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(','),
      credentials: true,
      optionsSuccessStatus: 200
    };
    
    // 生成限流配置
    config.RATE_LIMIT_CONFIG = {
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX_REQUESTS,
      message: '请求过于频繁，请稍后再试',
      standardHeaders: true,
      legacyHeaders: false
    };
    
    return config;
  }
  
  /**
   * 设置配置文件监听器
   */
  setupConfigWatcher() {
    const envFile = path.join(process.cwd(), '.env');
    
    if (fs.existsSync(envFile)) {
      const watcher = fs.watchFile(envFile, { interval: 1000 }, () => {
        console.log('🔄 检测到配置文件变更，重新加载配置...');
        this.reloadConfig();
      });
      
      this.watchers.set(envFile, watcher);
    }
  }
  
  /**
   * 重新加载配置
   */
  reloadConfig() {
    try {
      // 重新读取环境变量
      require('dotenv').config({ override: true });
      this.loadConfig();
      
      // 触发配置更新事件
      this.emit('configUpdated', this.config);
    } catch (error) {
      console.error('❌ 配置重新加载失败:', error.message);
    }
  }
  
  /**
   * 获取配置值
   */
  get(key, defaultValue = undefined) {
    if (!this.config) {
      throw new Error('配置尚未初始化');
    }
    
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }
  
  /**
   * 获取所有配置
   */
  getAll() {
    return { ...this.config };
  }
  
  /**
   * 获取服务配置
   */
  getServiceConfig(serviceName) {
    const baseConfig = {
      nodeEnv: this.config.NODE_ENV,
      logLevel: this.config.LOG_LEVEL,
      logFilePath: this.config.LOG_FILE_PATH,
      jwtSecret: this.config.JWT_SECRET,
      tokenExpiration: this.config.JWT_TOKEN_EXPIRATION,
      refreshTokenExpiration: this.config.JWT_REFRESH_TOKEN_EXPIRATION,
      corsConfig: this.config.CORS_CONFIG,
      rateLimitConfig: this.config.RATE_LIMIT_CONFIG
    };
    
    switch (serviceName) {
      case 'gateway':
        return {
          ...baseConfig,
          port: this.config.GATEWAY_PORT,
          serviceUrls: this.config.SERVICE_URLS
        };
        
      case 'auth':
      case 'user':
        return {
          ...baseConfig,
          port: this.config.USER_SERVICE_PORT,
          mongoUri: this.config.DATABASE_CONFIGS.user,
          redisConfig: this.config.REDIS_CONFIG
        };
        
      case 'data':
        return {
          ...baseConfig,
          port: this.config.DATA_SERVICE_PORT,
          mongoUri: this.config.DATABASE_CONFIGS.data,
          redisConfig: this.config.REDIS_CONFIG
        };
        
      case 'analytics':
        return {
          ...baseConfig,
          port: this.config.ANALYTICS_SERVICE_PORT,
          mongoUri: this.config.DATABASE_CONFIGS.default,
          redisConfig: this.config.REDIS_CONFIG
        };
        
      case 'homework':
        return {
          ...baseConfig,
          port: this.config.HOMEWORK_SERVICE_PORT,
          mongoUri: this.config.DATABASE_CONFIGS.default,
          redisConfig: this.config.REDIS_CONFIG
        };
        
      case 'progress':
        return {
          ...baseConfig,
          port: this.config.PROGRESS_SERVICE_PORT,
          mongoUri: this.config.DATABASE_CONFIGS.default,
          redisConfig: this.config.REDIS_CONFIG
        };
        
      case 'interaction':
        return {
          ...baseConfig,
          port: this.config.INTERACTION_SERVICE_PORT,
          mongoUri: this.config.DATABASE_CONFIGS.default,
          redisConfig: this.config.REDIS_CONFIG
        };
        
      case 'notification':
        return {
          ...baseConfig,
          port: this.config.NOTIFICATION_SERVICE_PORT,
          mongoUri: this.config.DATABASE_CONFIGS.default,
          redisConfig: this.config.REDIS_CONFIG
        };
        
      case 'resource':
        return {
          ...baseConfig,
          port: this.config.RESOURCE_SERVICE_PORT,
          mongoUri: this.config.DATABASE_CONFIGS.default,
          redisConfig: this.config.REDIS_CONFIG,
          uploadMaxSize: this.config.UPLOAD_MAX_SIZE,
          uploadAllowedTypes: this.config.UPLOAD_ALLOWED_TYPES
        };
        
      default:
        return {
          ...baseConfig,
          port: this.config[`${serviceName.toUpperCase()}_SERVICE_PORT`] || 3000,
          mongoUri: this.config.DATABASE_CONFIGS.default,
          redisConfig: this.config.REDIS_CONFIG
        };
    }
  }
  
  /**
   * 验证必需的配置项
   */
  validateRequiredConfig(requiredKeys) {
    const missing = [];
    
    for (const key of requiredKeys) {
      if (!this.get(key)) {
        missing.push(key);
      }
    }
    
    if (missing.length > 0) {
      throw new Error(`缺少必需的配置项: ${missing.join(', ')}`);
    }
  }
  
  /**
   * 事件发射器功能
   */
  emit(event, data) {
    // 简单的事件发射实现
    if (this.listeners && this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }
  
  on(event, callback) {
    if (!this.listeners) {
      this.listeners = {};
    }
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }
  
  /**
   * 清理资源
   */
  cleanup() {
    // 清理文件监听器
    for (const [file, watcher] of this.watchers) {
      fs.unwatchFile(file);
    }
    this.watchers.clear();
  }
}

// 创建全局配置管理器实例
const configManager = new ConfigManager();

// 导出配置管理器和便捷方法
const exportedConfig = {
  configManager,
  
  // 便捷方法
  get: (key, defaultValue) => configManager.get(key, defaultValue),
  getAll: () => configManager.getAll(),
  getServiceConfig: (serviceName) => configManager.getServiceConfig(serviceName),
  validateRequired: (keys) => configManager.validateRequiredConfig(keys),
};

module.exports = exportedConfig;

// 向后兼容的导出
exportedConfig.auth = require('./auth');
exportedConfig.db = require('./db');
exportedConfig.logger = require('./logger');

// 进程退出时清理资源
process.on('SIGINT', () => {
  configManager.cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  configManager.cleanup();
  process.exit(0);
});

/**
 * 配置验证工具
 * 提供配置完整性检查和环境特定验证
 */

const Joi = require('joi');
const { configManager } = require('./index');

/**
 * 环境特定的配置验证规则
 */
const environmentSchemas = {
  development: Joi.object({
    JWT_SECRET: Joi.string().min(16), // 开发环境可以使用较短的密钥
    MONGO_URI: Joi.string().uri().required(),
    LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default('debug'),
    ENABLE_METRICS: Joi.boolean().default(false)
  }),
  
  test: Joi.object({
    JWT_SECRET: Joi.string().min(16),
    MONGO_URI: Joi.string().uri().required(),
    LOG_LEVEL: Joi.string().valid('error', 'warn').default('error'),
    ENABLE_METRICS: Joi.boolean().default(false)
  }),
  
  production: Joi.object({
    JWT_SECRET: Joi.string().min(32).required(), // 生产环境要求更强的密钥
    MONGO_URI: Joi.string().uri().required(),
    LOG_LEVEL: Joi.string().valid('info', 'warn', 'error').default('info'),
    ENABLE_METRICS: Joi.boolean().default(true),
    
    // 生产环境必需的配置
    REDIS_HOST: Joi.string().required(),
    REDIS_PORT: Joi.number().port().required(),
    
    // 安全配置
    CORS_ORIGIN: Joi.string().not('*').required(), // 生产环境不允许通配符
    RATE_LIMIT_MAX_REQUESTS: Joi.number().max(1000).required(),
    
    // 监控配置
    METRICS_PORT: Joi.number().port().required()
  })
};

/**
 * 服务特定的配置验证规则
 */
const serviceSchemas = {
  gateway: Joi.object({
    GATEWAY_PORT: Joi.number().port().required(),
    USER_SERVICE_URL: Joi.string().uri().required(),
    DATA_SERVICE_URL: Joi.string().uri().required()
  }),
  
  user: Joi.object({
    USER_SERVICE_PORT: Joi.number().port().required(),
    USER_SERVICE_MONGO_URI: Joi.string().uri().optional()
  }),
  
  data: Joi.object({
    DATA_SERVICE_PORT: Joi.number().port().required(),
    DATA_SERVICE_MONGO_URI: Joi.string().uri().optional()
  })
};

class ConfigValidator {
  /**
   * 验证环境配置
   */
  static validateEnvironment(env = process.env.NODE_ENV || 'development') {
    const schema = environmentSchemas[env];
    if (!schema) {
      throw new Error(`不支持的环境: ${env}`);
    }
    
    const { error, value } = schema.validate(process.env, {
      allowUnknown: true,
      stripUnknown: false
    });
    
    if (error) {
      throw new Error(`${env}环境配置验证失败: ${error.details.map(d => d.message).join(', ')}`);
    }
    
    return value;
  }
  
  /**
   * 验证服务配置
   */
  static validateService(serviceName) {
    const schema = serviceSchemas[serviceName];
    if (!schema) {
      console.warn(`警告: 没有为服务 ${serviceName} 定义特定的验证规则`);
      return true;
    }
    
    const { error } = schema.validate(process.env, {
      allowUnknown: true,
      stripUnknown: false
    });
    
    if (error) {
      throw new Error(`服务 ${serviceName} 配置验证失败: ${error.details.map(d => d.message).join(', ')}`);
    }
    
    return true;
  }
  
  /**
   * 验证数据库连接配置
   */
  static validateDatabaseConfig() {
    const mongoUri = configManager.get('MONGO_URI');
    
    if (!mongoUri) {
      throw new Error('数据库连接URI未配置');
    }
    
    // 验证URI格式
    const uriPattern = /^mongodb(?:\+srv)?:\/\/.+/;
    if (!uriPattern.test(mongoUri)) {
      throw new Error('数据库连接URI格式无效');
    }
    
    // 检查生产环境的数据库安全配置
    if (configManager.get('NODE_ENV') === 'production') {
      if (mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1')) {
        console.warn('警告: 生产环境使用本地数据库连接');
      }
      
      if (!mongoUri.includes('authSource') && !mongoUri.includes('@')) {
        console.warn('警告: 生产环境数据库连接可能缺少认证配置');
      }
    }
    
    return true;
  }
  
  /**
   * 验证JWT配置
   */
  static validateJWTConfig() {
    const jwtSecret = configManager.get('JWT_SECRET');
    const env = configManager.get('NODE_ENV');
    
    if (!jwtSecret) {
      throw new Error('JWT密钥未配置');
    }
    
    // 检查密钥强度
    if (env === 'production' && jwtSecret.length < 32) {
      throw new Error('生产环境JWT密钥长度不足（至少32字符）');
    }
    
    // 检查是否使用默认密钥
    const defaultSecrets = [
      'your-super-secret-jwt-key-here-change-in-production',
      'secret',
      'jwt-secret',
      'default-secret'
    ];
    
    if (defaultSecrets.includes(jwtSecret)) {
      if (env === 'production') {
        throw new Error('生产环境不能使用默认JWT密钥');
      } else {
        console.warn('警告: 使用默认JWT密钥，请在生产环境中更改');
      }
    }
    
    return true;
  }
  
  /**
   * 验证服务URL配置
   */
  static validateServiceUrls() {
    const serviceUrls = configManager.get('SERVICE_URLS');
    const env = configManager.get('NODE_ENV');
    
    if (!serviceUrls) {
      throw new Error('服务URL配置未找到');
    }
    
    const requiredServices = ['user', 'data', 'analytics', 'homework', 'progress', 'interaction', 'notification', 'resource'];
    
    for (const service of requiredServices) {
      const url = serviceUrls[service];
      
      if (!url) {
        throw new Error(`服务 ${service} 的URL未配置`);
      }
      
      // 验证URL格式
      try {
        new URL(url);
      } catch (error) {
        throw new Error(`服务 ${service} 的URL格式无效: ${url}`);
      }
      
      // 生产环境检查
      if (env === 'production' && (url.includes('localhost') || url.includes('127.0.0.1'))) {
        console.warn(`警告: 生产环境服务 ${service} 使用本地地址: ${url}`);
      }
    }
    
    return true;
  }
  
  /**
   * 验证Redis配置
   */
  static validateRedisConfig() {
    const redisConfig = configManager.get('REDIS_CONFIG');
    const env = configManager.get('NODE_ENV');
    
    if (!redisConfig) {
      if (env === 'production') {
        throw new Error('生产环境必须配置Redis');
      }
      console.warn('警告: Redis未配置，某些功能可能受限');
      return true;
    }
    
    // 验证Redis连接参数
    if (!redisConfig.host || !redisConfig.port) {
      throw new Error('Redis主机或端口未配置');
    }
    
    // 生产环境安全检查
    if (env === 'production') {
      if (!redisConfig.password) {
        console.warn('警告: 生产环境Redis未设置密码');
      }
      
      if (redisConfig.host === 'localhost' || redisConfig.host === '127.0.0.1') {
        console.warn('警告: 生产环境Redis使用本地地址');
      }
    }
    
    return true;
  }
  
  /**
   * 验证安全配置
   */
  static validateSecurityConfig() {
    const env = configManager.get('NODE_ENV');
    const corsOrigin = configManager.get('CORS_ORIGIN');
    const rateLimitMax = configManager.get('RATE_LIMIT_MAX_REQUESTS');
    
    // CORS配置检查
    if (env === 'production' && corsOrigin === '*') {
      throw new Error('生产环境不能使用通配符CORS配置');
    }
    
    // 限流配置检查
    if (env === 'production' && rateLimitMax > 1000) {
      console.warn(`警告: 生产环境限流配置可能过于宽松: ${rateLimitMax}`);
    }
    
    return true;
  }
  
  /**
   * 执行完整的配置验证
   */
  static validateAll(serviceName = null) {
    const env = configManager.get('NODE_ENV');
    
    console.log(`🔍 开始验证配置 (环境: ${env}${serviceName ? `, 服务: ${serviceName}` : ''})`);
    
    try {
      // 环境配置验证
      this.validateEnvironment(env);
      console.log('✅ 环境配置验证通过');
      
      // 服务特定配置验证
      if (serviceName) {
        this.validateService(serviceName);
        console.log(`✅ 服务 ${serviceName} 配置验证通过`);
      }
      
      // 数据库配置验证
      this.validateDatabaseConfig();
      console.log('✅ 数据库配置验证通过');
      
      // JWT配置验证
      this.validateJWTConfig();
      console.log('✅ JWT配置验证通过');
      
      // 服务URL配置验证
      this.validateServiceUrls();
      console.log('✅ 服务URL配置验证通过');
      
      // Redis配置验证
      this.validateRedisConfig();
      console.log('✅ Redis配置验证通过');
      
      // 安全配置验证
      this.validateSecurityConfig();
      console.log('✅ 安全配置验证通过');
      
      console.log('🎉 所有配置验证通过');
      return true;
      
    } catch (error) {
      console.error('❌ 配置验证失败:', error.message);
      throw error;
    }
  }
  
  /**
   * 生成配置报告
   */
  static generateConfigReport() {
    const config = configManager.getAll();
    const env = config.NODE_ENV;
    
    const report = {
      environment: env,
      timestamp: new Date().toISOString(),
      services: {
        gateway: {
          port: config.GATEWAY_PORT,
          configured: true
        },
        user: {
          port: config.USER_SERVICE_PORT,
          mongoUri: !!config.USER_SERVICE_MONGO_URI,
          configured: true
        },
        data: {
          port: config.DATA_SERVICE_PORT,
          mongoUri: !!config.DATA_SERVICE_MONGO_URI,
          configured: true
        }
      },
      database: {
        primary: !!config.MONGO_URI,
        userService: !!config.USER_SERVICE_MONGO_URI,
        dataService: !!config.DATA_SERVICE_MONGO_URI
      },
      security: {
        jwtConfigured: !!config.JWT_SECRET,
        corsConfigured: !!config.CORS_ORIGIN,
        rateLimitConfigured: !!config.RATE_LIMIT_MAX_REQUESTS
      },
      monitoring: {
        metricsEnabled: config.ENABLE_METRICS,
        logLevel: config.LOG_LEVEL
      },
      warnings: []
    };
    
    // 添加警告
    if (env === 'production') {
      if (config.CORS_ORIGIN === '*') {
        report.warnings.push('生产环境使用通配符CORS配置');
      }
      if (!config.REDIS_HOST) {
        report.warnings.push('生产环境未配置Redis');
      }
    }
    
    return report;
  }
}

module.exports = ConfigValidator;
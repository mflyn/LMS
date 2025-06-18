/**
 * 数据库配置
 * 现在使用统一配置管理器
 */

const { configManager } = require('./index');

// 验证必需的数据库配置
configManager.validateRequiredConfig(['MONGO_URI']);

module.exports = {
  // MongoDB连接URI
  get mongoUri() {
    return configManager.get('MONGO_URI');
  },
  
  // 获取特定服务的数据库URI
  getServiceMongoUri(serviceName) {
    const serviceKey = `${serviceName.toUpperCase()}_SERVICE_MONGO_URI`;
    return configManager.get(serviceKey) || configManager.get('MONGO_URI');
  },
  
  // 数据库连接选项
  get options() {
    return {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false,
      poolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // 添加重试逻辑
      retryWrites: true,
      retryReads: true,
      // 添加心跳检测
      heartbeatFrequencyMS: 10000,
      // 添加缓冲配置
      bufferMaxEntries: 0,
      bufferCommands: false
    };
  },
  
  // 获取所有数据库配置
  get databaseConfigs() {
    return configManager.get('DATABASE_CONFIGS');
  }
};
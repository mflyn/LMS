// Mobile应用环境配置文件
const ENV = __DEV__ ? 'development' : 'production';

const config = {
  development: {
    // API配置
    API_BASE_URL: 'http://localhost:8000/api',
    WS_URL: 'ws://localhost:8000',
    
    // 调试配置
    DEBUG: true,
    LOG_LEVEL: 'debug',
    
    // 网络配置
    TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3,
    
    // 缓存配置
    CACHE_DURATION: 300000, // 5分钟
    OFFLINE_CACHE_SIZE: 50,
  },
  
  production: {
    // API配置
    API_BASE_URL: 'https://your-production-api.com/api',
    WS_URL: 'wss://your-production-api.com',
    
    // 调试配置
    DEBUG: false,
    LOG_LEVEL: 'error',
    
    // 网络配置
    TIMEOUT: 15000,
    RETRY_ATTEMPTS: 5,
    
    // 缓存配置
    CACHE_DURATION: 600000, // 10分钟
    OFFLINE_CACHE_SIZE: 100,
  },
};

// 导出当前环境配置
export default config[ENV] || config.development;

// 导出环境标识
export { ENV }; 
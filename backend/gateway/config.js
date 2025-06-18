/**
 * API网关配置
 * 使用统一配置管理器
 */

const { configManager } = require('../common/config');

// 获取网关专用配置
const gatewayConfig = configManager.getServiceConfig('gateway');

module.exports = {
  // 基础配置
  port: gatewayConfig.port,
  tokenExpiration: gatewayConfig.tokenExpiration,
  jwtSecret: gatewayConfig.jwtSecret,
  
  // 服务发现配置
  serviceUrls: gatewayConfig.serviceUrls,
  
  // 向后兼容的服务配置
  services: {
    user: gatewayConfig.serviceUrls.user,
    data: gatewayConfig.serviceUrls.data,
    progress: gatewayConfig.serviceUrls.progress,
    interaction: gatewayConfig.serviceUrls.interaction,
    notification: gatewayConfig.serviceUrls.notification,
    resource: gatewayConfig.serviceUrls.resource,
    analytics: gatewayConfig.serviceUrls.analytics,
    homework: gatewayConfig.serviceUrls.homework
  },
  
  // 向后兼容的服务主机配置
  serviceHosts: gatewayConfig.serviceUrls,
  
  // 限流配置
  rateLimitOptions: gatewayConfig.rateLimitConfig,
  
  // CORS配置
  corsOptions: gatewayConfig.corsConfig,
  
  // 健康检查配置
  healthCheck: {
    enabled: true,
    interval: 30000, // 30秒
    timeout: 5000,   // 5秒超时
    retries: 3
  },
  
  // 熔断器配置
  circuitBreaker: {
    enabled: configManager.get('NODE_ENV') === 'production',
    threshold: 5,     // 失败阈值
    timeout: 60000,   // 熔断超时时间
    resetTimeout: 30000 // 重置超时时间
  },
  
  // 请求超时配置
  requestTimeout: configManager.get('EXTERNAL_API_TIMEOUT', 30000),
  
  // 重试配置
  retryConfig: {
    attempts: configManager.get('EXTERNAL_API_RETRY_ATTEMPTS', 3),
    delay: 1000,
    factor: 2
  }
};
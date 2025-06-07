module.exports = {
  port: process.env.GATEWAY_PORT || 5000,
  tokenExpiration: '24h',
  services: {
    user: 'http://localhost:5001',
    data: 'http://localhost:5002',
    progress: 'http://localhost:5003',
    interaction: 'http://localhost:5004',
    notification: 'http://localhost:5005',
    resource: 'http://localhost:5006',
    analytics: 'http://localhost:5007',
    homework: 'http://localhost:5008'
  },
  serviceHosts: {
    user: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    data: process.env.DATA_SERVICE_URL || 'http://localhost:3003',
    analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3007',
    homework: process.env.HOMEWORK_SERVICE_URL || 'http://localhost:3008',
    progress: process.env.PROGRESS_SERVICE_URL || 'http://localhost:3009',
    interaction: process.env.INTERACTION_SERVICE_URL || 'http://localhost:3010',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3011',
    resource: process.env.RESOURCE_SERVICE_URL || 'http://localhost:3012'
  },
  rateLimitOptions: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  }
};
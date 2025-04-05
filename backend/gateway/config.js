module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-here', // 使用环境变量，提供默认值作为后备
  tokenExpiration: '24h',
  services: {
    user: 'http://localhost:5001',
    data: 'http://localhost:5002',
    progress: 'http://localhost:5003',
    interaction: 'http://localhost:5004',
    notification: 'http://localhost:5005',
    resource: 'http://localhost:5006',
    analytics: 'http://localhost:5007'
  },
  rateLimits: {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100 // 每个IP在windowMs内最多100个请求
  }
};
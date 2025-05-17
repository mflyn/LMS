module.exports = {
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
  serviceHosts: {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3002',
    user: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    data: process.env.DATA_SERVICE_URL || 'http://localhost:3003'
  },
  rateLimitOptions: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  }
};
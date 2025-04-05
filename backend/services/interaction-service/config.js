/**
 * interaction-service配置文件
 */

module.exports = {
  mongoURI: process.env.MONGO_URI || 'mongodb://localhost:27017/student-tracking-system',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-here', // 优先使用环境变量，提供默认值作为后备
  tokenExpiration: '24h'
};
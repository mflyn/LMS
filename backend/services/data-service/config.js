module.exports = {
  mongoURI: process.env.DATA_SERVICE_MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/learning-tracker-data',
  port: process.env.DATA_SERVICE_PORT || 3003,
  // jwtSecret 已移除，应由 common/config/auth.js 统一管理，并通过网关传递认证信息
};
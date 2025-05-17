module.exports = {
  mongoURI: process.env.DATA_SERVICE_MONGO_URI, // 强制从环境变量读取
  // jwtSecret 已移除，应由 common/config/auth.js 统一管理，并通过网关传递认证信息
};
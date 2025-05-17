const mongoose = require('mongoose');
const createBaseApp = require('../../common/createBaseApp'); // 调整路径到 common 目录
const config = require('./config');
const mainRoutes = require('./routes'); // user-service 的主路由
const logger = require('../../common/utils/logger'); // 直接导入 logger 用于启动日志
const { setupUncaughtExceptionHandler } = require('../../common/middleware/errorHandler'); // Added import

// 1. 创建基础应用实例
const app = createBaseApp({
  serviceName: 'user-service',
  // productionCorsOrigin: ['https://your-frontend.com'], // 如果需要特定CORS源
  // developmentCorsOrigin: ['http://localhost:8081'], // 如果前端开发端口不是默认的
  enableSessions: false, // 用户服务通常不需要HTTP会话
  // rateLimitOptions: { windowMs: 10 * 60 * 1000, max: 50 } // 如果需要自定义速率限制
});

// 2. 挂载 user-service 特有的路由 (在所有通用中间件之后，全局错误处理器之前)
// 确保路由前缀与 API 网关配置和服务设计一致
// 例如，如果设计文档中 user-service 的所有 API 都在 /api/users 或 /api/auth 下
app.use('/api', mainRoutes); // 假设 mainRoutes 内部处理了 /users 和 /auth 等子路径

// 3. 数据库连接
const mongoURI = config.mongoURI;
if (!mongoURI) {
  logger.error('FATAL ERROR: mongoURI for user-service is not defined in config or environment.');
  process.exit(1);
}

setupUncaughtExceptionHandler(logger); // Called setupUncaughtExceptionHandler

mongoose.connect(mongoURI)
.then(() => {
  logger.info(`MongoDB Connected to user-service at ${mongoURI}`);
  
  // 4. 启动服务器
  const PORT = config.port || process.env.USER_SERVICE_PORT || 3001;
  if (!PORT) {
    logger.error('FATAL ERROR: Port for user-service is not defined.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    logger.info(`User service running on port ${PORT}`);
  });
})
.catch(err => {
  logger.error('MongoDB connection error for user-service:', err);
  process.exit(1);
});

// 5. 可选: 更优雅的未捕获异常和Promise拒绝处理 (虽然 createBaseApp 中的 errorHandler 会处理一部分)
// process.on('unhandledRejection', (reason, promise) => {
//   logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
//   // Application specific logging, throwing an error, or other logic here
// });
// process.on('uncaughtException', (error) => {
//   logger.error('Uncaught Exception thrown:', error);
//   process.exit(1);
// });
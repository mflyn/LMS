const mongoose = require('mongoose');
const createBaseApp = require('../../common/createBaseApp'); // 调整路径
const config = require('./config');
const mainRoutes = require('./routes'); // data-service 的主路由
const { createLogger } = require('../../common/config/logger');
const logger = createLogger('data-service');
const { setupUncaughtExceptionHandler } = require('../../common/middleware/errorHandler');

// 1. 创建基础应用实例
const app = createBaseApp({
  serviceName: 'data-service',
  enableSessions: false, // 数据服务通常是无状态API，不需要会话
  // 如果 data-service 需要特定的CORS或速率限制，可以在这里配置 options
});

// 2. 挂载 data-service 特有的路由
// 修正：数据服务直接暴露API，网关会添加/api/data前缀
app.use('/api', mainRoutes);

// 3. 数据库连接
const mongoURI = config.mongoURI;
if (!mongoURI) {
  logger.error('FATAL ERROR: mongoURI for data-service is not defined in config or environment.');
  process.exit(1);
}

setupUncaughtExceptionHandler(logger);

mongoose.connect(mongoURI)
.then(() => {
  logger.info(`MongoDB Connected to data-service at ${mongoURI}`);

  // 4. 启动服务器
  const PORT = config.port || process.env.DATA_SERVICE_PORT || 3003;
  if (!PORT) {
    logger.error('FATAL ERROR: Port for data-service is not defined.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    logger.info(`Data service running on port ${PORT}`);
  });
})
.catch(err => {
  logger.error('MongoDB connection error for data-service:', err);
  process.exit(1);
});

// 本地定义的 authenticateToken 和 checkRole 中间件已不再需要，
// data-service 内部路由应使用 common/middleware/auth.js 中的相应中间件。
// 健康检查端点也由 createBaseApp 或网关处理。
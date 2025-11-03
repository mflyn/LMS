const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// 导入共享组件
const { createLogger } = require('../../common/config/logger');
const { errorHandler, setupUncaughtExceptionHandler, requestTracker, AppError } = require('../../common/middleware/errorHandler');

// 导入共享认证中间件
const { authenticateGateway, checkRole } = require('../../common/middleware/auth');

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();

// 配置共享日志记录器
const logger = createLogger('interaction-service', process.env.LOG_LEVEL);
app.locals.logger = logger; // Make logger available in app.locals

// Set up uncaught exception handler
setupUncaughtExceptionHandler(logger);

// 中间件
app.use(cors());
app.use(express.json());
app.use(requestTracker); // Use shared request tracker

// 连接到MongoDB
const mongoURI = process.env.MONGO_URI;
if (!mongoURI) {
  logger.error('MongoDB URI (MONGO_URI) is not defined in environment variables.');
  process.exit(1); // Exit if MONGO_URI is not set
}

if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(mongoURI) // Removed deprecated options
  .then(() => {
    logger.info('MongoDB连接成功');
  })
  .catch((err) => {
    logger.error('MongoDB连接失败:', err.message);
    process.exit(1); // Exit on connection failure too
  });
}

// 导入路由
const messagesRouter = require('./routes/messages');
const announcementsRouter = require('./routes/announcements');
const meetingsRouter = require('./routes/meetings');
const videoMeetingsRouter = require('./routes/video-meetings-simple');

// 使用路由 (使用共享的 authenticateGateway)
app.use('/api/interaction/messages', authenticateGateway, messagesRouter);
app.use('/api/interaction/announcements', authenticateGateway, announcementsRouter);
app.use('/api/interaction/meetings', authenticateGateway, meetingsRouter);
app.use('/api/interaction/video-meetings', authenticateGateway, videoMeetingsRouter);

// 健康检查路由
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'interaction-service' });
});

// 使用共享的错误处理中间件 (应放在所有路由之后)
app.use(errorHandler);

// 导出应用 (主要用于测试)
module.exports = app;

// 启动服务器
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.INTERACTION_SERVICE_PORT || process.env.PORT || 5004; // Prefer specific port
  app.listen(PORT, () => {
    logger.info(`家校互动服务运行在端口 ${PORT}`);
  });
}
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const winston = require('winston');
const fs = require('fs');
const path = require('path');

// 导入中间件
const { authenticateToken, checkRole } = require('./middleware/auth');

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();

// 配置日志记录器
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ],
});

// 确保日志目录存在
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs', { recursive: true });
}

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// 连接到MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/learning-tracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  logger.info('MongoDB连接成功');
})
.catch((err) => {
  logger.error('MongoDB连接失败:', err.message);
});

// 导入Meeting模型
const Meeting = require('./models/Meeting'); // 确保路径正确

// 导入路由
const messagesRouter = require('./routes/messages');
const announcementsRouter = require('./routes/announcements');
const meetingsRouter = require('./routes/meetings');
const videoMeetingsRouter = require('./routes/video-meetings-simple');

// 使用路由（添加认证中间件）
app.use('/api/interaction/messages', authenticateToken, messagesRouter);
app.use('/api/interaction/announcements', authenticateToken, announcementsRouter);
app.use('/api/interaction/meetings', authenticateToken, meetingsRouter);
app.use('/api/interaction/video-meetings', authenticateToken, videoMeetingsRouter);

// 健康检查路由
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'interaction-service' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'production' ? {} : err.message
  });
});

// 导出应用
module.exports = app;

// 只有在非测试环境下才启动服务器
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5004;
  app.listen(PORT, () => {
    logger.info(`家校互动服务运行在端口 ${PORT}`);
  });
}
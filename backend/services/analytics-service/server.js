const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const winston = require('winston');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');

// 加载环境变量
dotenv.config();

// 创建Express应用和HTTP服务器
const app = express();
const server = http.createServer(app);

// 创建Socket.IO实例
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

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

// 导入路由模块
const progressRouter = require('./routes/progress');
const reportsRouter = require('./routes/reports');
const trendsRouter = require('./routes/trends');
const longTermTrendsRouter = require('./routes/long-term-trends');
const behaviorRouter = require('./routes/behavior');
const integrationRouter = require('./routes/integration');
const performanceRouter = require('./routes/performance');

// 使用路由模块
app.use('/api/analytics/progress', progressRouter);
app.use('/api/analytics/reports', reportsRouter);
app.use('/api/analytics/trends', trendsRouter);
app.use('/api/analytics/long-term-trends', longTermTrendsRouter);
app.use('/api/analytics/behavior', behaviorRouter);
app.use('/api/analytics/performance', performanceRouter);
app.use('/api/analytics', integrationRouter);

// 健康检查路由
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'analytics-service' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'production' ? {} : err.message
  });
});

// Socket.IO连接处理
io.on('connection', (socket) => {
  logger.info('新的WebSocket连接');

  socket.on('join', (userId) => {
    socket.join(userId);
    logger.info(`用户 ${userId} 加入了数据分析频道`);
  });

  socket.on('disconnect', () => {
    logger.info('WebSocket连接断开');
  });
});

// 将Socket.IO实例添加到app对象，以便在路由中使用
app.locals.io = io;

// 启动服务器
const PORT = process.env.PORT || 5007;
server.listen(PORT, () => {
  logger.info(`数据分析服务运行在端口 ${PORT}`);
});

module.exports = app;
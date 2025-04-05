const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const winston = require('winston');
const http = require('http');
const socketIo = require('socket.io');
const amqp = require('amqplib');

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();
const server = http.createServer(app);
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

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// 导入路由
const routes = require('./routes');

// 使用路由
app.use('/api/notifications', routes);

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

// Socket.IO连接处理
io.on('connection', (socket) => {
  logger.info('新的WebSocket连接');
  
  socket.on('join', (userId) => {
    socket.join(userId);
    logger.info(`用户 ${userId} 加入了通知频道`);
  });
  
  socket.on('disconnect', () => {
    logger.info('WebSocket连接断开');
  });
});

// 连接到RabbitMQ并监听消息
async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    const channel = await connection.createChannel();
    
    // 声明交换机和队列
    const exchange = 'notifications.events';
    const queue = 'notifications.queue';
    
    await channel.assertExchange(exchange, 'topic', { durable: true });
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, exchange, '#');
    
    logger.info('RabbitMQ连接成功，开始监听消息');
    
    // 消费消息
    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        try {
          const content = JSON.parse(msg.content.toString());
          logger.info(`收到消息: ${JSON.stringify(content)}`);
          
          // 处理通知
          const { userId, message, type } = content;
          
          // 保存通知到数据库
          const Notification = require('./models/Notification');
          const notification = new Notification({
            user: userId,
            message,
            type,
            read: false
          });
          
          await notification.save();
          
          // 通过WebSocket发送通知
          io.to(userId).emit('notification', notification);
          
          channel.ack(msg);
        } catch (error) {
          logger.error('处理消息时出错:', error);
          channel.nack(msg, false, false);
        }
      }
    });
  } catch (error) {
    logger.error('RabbitMQ连接失败:', error);
    // 尝试重新连接
    setTimeout(connectRabbitMQ, 5000);
  }
}

// 启动RabbitMQ连接
connectRabbitMQ();

// 健康检查路由
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'notification-service' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'production' ? {} : err.message
  });
});

// 启动服务器
const PORT = process.env.PORT || 5005;
server.listen(PORT, () => {
  logger.info(`通知服务运行在端口 ${PORT}`);
});

module.exports = { app, io };
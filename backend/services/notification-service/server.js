const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const socketIo = require('socket.io');
const amqp = require('amqplib');

const appModule = require('./app');
const { createLogger } = require('../../common/config/logger');

dotenv.config();

const createApp = appModule.createApp;
const defaultApp = appModule;
const logger = createLogger('notification-service');

async function connectRabbitMQ({ io, retry = true, retryDelayMs = 5000 } = {}) {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    const channel = await connection.createChannel();

    const exchange = 'notifications.events';
    const queue = 'notifications.queue';

    await channel.assertExchange(exchange, 'topic', { durable: true });
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, exchange, '#');

    logger.info('RabbitMQ连接成功，开始监听消息');

    channel.consume(queue, async (msg) => {
      if (msg === null) return;

      try {
        const content = JSON.parse(msg.content.toString());
        logger.info(`收到消息: ${JSON.stringify(content)}`);

        const { userId, message, type } = content;
        const Notification = require('./models/Notification');
        const notification = new Notification({
          user: userId,
          message,
          type,
          read: false
        });

        await notification.save();

        if (io) {
          io.to(userId).emit('notification', notification);
        }

        channel.ack(msg);
      } catch (error) {
        logger.error('处理消息时出错:', error);
        channel.nack(msg, false, false);
      }
    });

    return { connection, channel };
  } catch (error) {
    logger.error('RabbitMQ连接失败:', error);
    if (retry) {
      setTimeout(() => connectRabbitMQ({ io, retry, retryDelayMs }), retryDelayMs);
    }
    return null;
  }
}

async function startServer({
  port = process.env.PORT || 5005,
  mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/learning-tracker',
  app = createApp(),
  enableRabbitMQ = true
} = {}) {
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  logger.info('MongoDB连接成功');

  const server = http.createServer(app);
  const io = socketIo(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

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

  if (enableRabbitMQ) {
    await connectRabbitMQ({ io });
  }

  await new Promise((resolve) => {
    server.listen(port, () => {
      logger.info(`通知服务运行在端口 ${port}`);
      resolve();
    });
  });

  return { app, server, io };
}

if (require.main === module) {
  startServer().catch((error) => {
    logger.error('通知服务启动失败:', error);
    process.exit(1);
  });
}

module.exports = {
  app: defaultApp,
  connectRabbitMQ,
  createApp,
  startServer
};

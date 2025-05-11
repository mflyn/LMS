const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const winston = require('winston');
const amqp = require('amqplib');

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

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// 连接到MongoDB
if (process.env.NODE_ENV !== 'test') {
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
} else {
  logger.info('测试环境，跳过MongoDB连接');
}

// 导入路由
const homeworkRoutes = require('./routes/homework');

// 使用路由
app.use('/api/homework', homeworkRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 连接到RabbitMQ
async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    const channel = await connection.createChannel();

    // 声明交换机
    const exchange = 'homework.events';
    await channel.assertExchange(exchange, 'topic', { durable: true });

    logger.info('RabbitMQ连接成功');

    // 返回通道以便发布消息
    return { channel, exchange };
  } catch (error) {
    logger.error('RabbitMQ连接失败:', error.message);
    setTimeout(connectRabbitMQ, 5000);
  }
}

// 启动服务器
const PORT = process.env.PORT || 3002;
const server = app.listen(PORT, async () => {
  logger.info(`作业服务运行在端口 ${PORT}`);

  // 在非测试环境下连接到RabbitMQ
  if (process.env.NODE_ENV !== 'test') {
    const mq = await connectRabbitMQ();

    // 将MQ通道添加到app对象，以便在路由中使用
    if (mq) {
      app.locals.mq = mq;
    }
  } else {
    // 在测试环境中使用模拟的MQ
    app.locals.mq = {
      channel: {
        publish: (exchange, routingKey, content, options) => {
          logger.info(`[TEST] 发布消息到 ${exchange}.${routingKey}`);
          return true;
        }
      },
      exchange: 'homework.events'
    };
    logger.info('测试环境，使用模拟的RabbitMQ');
  }
});

module.exports = app;
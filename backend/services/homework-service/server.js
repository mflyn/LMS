const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const winston = require('winston');
const amqp = require('amqplib');

// 导入共享错误处理和日志相关
const { errorHandler, AppError, catchAsync, setupUncaughtExceptionHandler, requestTracker } = require('../../common/middleware/errorHandler');
const { authenticateGateway, checkRole } = require('../../common/middleware/auth'); // 预先导入，路由会用到
const { validate } = require('../../common/middleware/requestValidator'); // 预先导入，路由会用到

// 加载环境变量
dotenv.config();

const { validateClientConfig } = require('./services/starAwardClient');
validateClientConfig({
  progressServiceUrl: process.env.PROGRESS_SERVICE_URL || 'http://progress-service:3002',
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN,
  timeout: Number(process.env.STAR_AWARD_TIMEOUT_MS || 3000)
});

// 创建Express应用
const app = express();

// 配置日志记录器 (保留本地winston配置，因为common中未提供通用应用日志配置器)
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'homework-service' }, // 添加服务标识
  transports: [
    new winston.transports.Console(),
    // 生产环境可以考虑更结构化的日志或发送到日志服务
  ],
});
// 如果不是生产环境，可以保留文件日志用于调试
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.File({ filename: 'logs/error.log', level: 'error' }));
  logger.add(new winston.transports.File({ filename: 'logs/combined.log' }));
}
app.locals.logger = logger; // 将logger暴露给路由使用

// 处理未捕获的顶层异常
setupUncaughtExceptionHandler(logger);

// 中间件
app.use(cors()); // cors应该更早，以便options请求能正确处理
app.use(express.json());

// 使用共享的请求追踪中间件
app.use(requestTracker);

// 连接到MongoDB
if (process.env.NODE_ENV !== 'test') {
  const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/learning-tracker';
  mongoose.connect(mongoURI) // 移除旧的 useNewUrlPaser 和 useUnifiedTopology
  .then(() => {
    logger.info('MongoDB连接成功');
  })
  .catch((err) => {
    logger.error('MongoDB连接失败:', { message: err.message, stack: err.stack });
    // 严重错误，可以考虑退出进程
    // process.exit(1);
  });
} else {
  logger.info('测试环境，跳过MongoDB连接');
}

// 导入路由
const homeworkRoutes = require('./routes/homework');
const growthTaskRoutes = require('./routes/growthTasks');

// 使用路由
// 注意：认证中间件 authenticateGateway 应该在这里全局应用，或者在 homeworkRoutes 内部的每个路由上应用
// 为简化，暂时先不在 server.js 全局应用，而是期望在 routes/homework.js 中按需应用
app.use('/api/homework', homeworkRoutes);
app.use('/api/growth-tasks', growthTaskRoutes);
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'homework-service' });
});

// 使用共享的错误处理中间件
app.use(errorHandler);

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
    logger.error('RabbitMQ连接失败:', { message: error.message });
    // 考虑更健壮的重试或通知机制
    setTimeout(connectRabbitMQ, 5000); // 简单的重试
    // throw new AppError('Failed to connect to RabbitMQ', 500); // 或者抛出错误让服务启动失败
  }
}

const initializeMessageQueue = async () => {
  if (process.env.NODE_ENV === 'test') {
    app.locals.mq = {
      channel: {
        publish: (exchange, routingKey) => {
          logger.info(`[TEST] 发布消息到 ${exchange}.${routingKey}`);
          return true;
        }
      },
      exchange: 'homework.events'
    };
    logger.info('测试环境，使用模拟的RabbitMQ');
    return;
  }

  try {
    const mq = await connectRabbitMQ();
    if (mq) {
      app.locals.mq = mq;
    } else {
      logger.error('RabbitMQ未能成功初始化，服务可能功能不完整');
    }
  } catch (err) {
    logger.error('启动时连接RabbitMQ失败', { message: err.message, stack: err.stack });
  }
};

let server;
if (require.main === module) {
  const PORT = process.env.PORT || 3002;
  server = app.listen(PORT, async () => {
    logger.info(`作业服务运行在端口 ${PORT}`);
    await initializeMessageQueue();
  });

  process.on('SIGTERM', () => {
    logger.info('收到 SIGTERM 信号，开始优雅关闭...');
    server.close(() => {
      logger.info('HTTP服务器已关闭');
      mongoose.connection.close(false).then(() => {
        logger.info('MongoDB连接已关闭');
        process.exit(0);
      }).catch(err => {
        logger.error('关闭MongoDB连接时出错', { message: err.message });
        process.exit(1);
      });
    });
  });
} else if (process.env.NODE_ENV === 'test') {
  initializeMessageQueue();
}

module.exports = app;

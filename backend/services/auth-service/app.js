const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');

// 导入统一配置和日志系统
const { configManager } = require('../../common/config');
const { logger, performanceLogger, errorLogger } = require('../../common/config/logger');

// 导入路由
const authRoutes = require('./routes/auth');

// 导入中间件
const { errorHandler } = require('../../common/middleware/errorHandler');

const app = express();

// 获取服务特定配置
const config = configManager.getServiceConfig('auth');

// 基础中间件
app.use(cors(configManager.get('CORS_CONFIG')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 日志中间件
app.use(performanceLogger); // 性能监控日志
app.use(morgan('combined', { 
  stream: { 
    write: (message) => logger.http(message.trim()) 
  } 
})); // HTTP访问日志

// 请求追踪中间件
app.use((req, res, next) => {
  req.requestId = require('crypto').randomUUID();
  req.startTime = Date.now();
  
  // 为每个请求添加请求ID到日志上下文
  logger.defaultMeta = { 
    ...logger.defaultMeta, 
    requestId: req.requestId,
    service: 'auth-service'
  };
  
  next();
});

// 健康检查路由
app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'auth-service',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    environment: configManager.get('NODE_ENV')
  };
  
  logger.debug('健康检查', healthCheck);
  res.status(200).json(healthCheck);
});

// API路由
app.use('/api/auth', authRoutes);

// 404处理
app.use('*', (req, res, next) => {
  const error = new Error(`路由 ${req.originalUrl} 不存在`);
  error.statusCode = 404;
  next(error);
});

// 错误日志中间件（在错误处理之前）
app.use(errorLogger);

// 统一错误处理中间件
app.use(errorHandler);

// 数据库连接
const connectDB = async () => {
  try {
    const mongoURI = config.mongoUri;
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    logger.info('认证服务数据库连接成功', {
      mongoURI: mongoURI.replace(/\/\/.*@/, '//***:***@'), // 隐藏密码
      service: 'auth-service'
    });
  } catch (error) {
    logger.error('认证服务数据库连接失败', {
      error: error.message,
      service: 'auth-service'
    });
    process.exit(1);
  }
};

// 优雅关闭处理
const gracefulShutdown = (signal) => {
  logger.info(`收到 ${signal} 信号，开始优雅关闭`, {
    service: 'auth-service'
  });
  
  // 关闭数据库连接
  mongoose.connection.close(() => {
    logger.info('数据库连接已关闭', {
      service: 'auth-service'
    });
    process.exit(0);
  });
};

// 监听进程信号
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 未捕获异常处理
process.on('uncaughtException', (error) => {
  logger.error('未捕获异常', {
    error: error.message,
    stack: error.stack,
    service: 'auth-service'
  });
  process.exit(1);
});

// 未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝', {
    reason: reason.toString(),
    promise: promise.toString(),
    service: 'auth-service'
  });
  process.exit(1);
});

// 启动服务器
const startServer = async () => {
  await connectDB();
  
  const PORT = config.port;
  const server = app.listen(PORT, () => {
    logger.info('认证服务启动成功', {
      port: PORT,
      environment: configManager.get('NODE_ENV'),
      service: 'auth-service',
      pid: process.pid
    });
  });
  
  // 服务器错误处理
  server.on('error', (error) => {
    logger.error('服务器启动失败', {
      error: error.message,
      port: PORT,
      service: 'auth-service'
    });
    process.exit(1);
  });
  
  return server;
};

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('服务器启动失败', {
      error: error.message,
      service: 'auth-service'
    });
    process.exit(1);
  });
}

module.exports = app;

/**
 * 微服务通用服务器模板
 * 提供标准化的Express应用配置、错误处理和日志记录
 * 集成了请求跟踪、性能监控和审计日志功能
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { createLogger, createAuditLogger } = require('../config/logger');
const { 
  errorHandler, 
  setupUncaughtExceptionHandler, 
  requestTracker, 
  performanceMonitor 
} = require('../middleware/errorHandler');
const { v4: uuidv4 } = require('uuid');

/**
 * 创建标准化的Express应用
 * @param {Object} options 配置选项
 * @param {string} options.serviceName 服务名称
 * @param {string} options.mongoURI MongoDB连接URI
 * @param {number} options.port 服务端口
 * @param {Object} options.routes 路由对象
 * @returns {Object} Express应用和服务器实例
 */
const createService = async (options) => {
  const {
    serviceName,
    mongoURI,
    port = process.env.PORT || 3000,
    routes = {}
  } = options;

  // 创建Express应用
  const app = express();

  // 创建日志记录器
  const { logger, httpLogger: requestLogger } = createLogger(serviceName, 'logs', {
    enablePerformanceLogging: true,
    logLevel: process.env.LOG_LEVEL || 'info'
  });
  app.locals.logger = logger;
  app.locals.serviceName = serviceName;
  
  // 创建审计日志记录器
  const auditLog = createAuditLogger(logger);
  app.locals.auditLog = auditLog;

  // 设置未捕获异常处理
  setupUncaughtExceptionHandler(app);

  // 基础中间件
  app.use(helmet()); // 安全头
  app.use(cors()); // CORS
  app.use(compression()); // 响应压缩
  app.use(express.json({ limit: '10mb' })); // JSON解析
  app.use(express.urlencoded({ extended: true, limit: '10mb' })); // URL编码解析

  // 请求跟踪和性能监控中间件
  app.use(requestTracker);
  app.use(performanceMonitor(1000)); // 设置性能监控阈值为1000ms
  
  // 请求日志
  app.use(requestLogger);

  // 连接数据库
  if (mongoURI) {
    try {
      await mongoose.connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      logger.info(`已连接到MongoDB数据库`);
    } catch (err) {
      logger.error(`MongoDB连接失败: ${err.message}`, { error: err });
      throw err;
    }
  }

  // 注册路由
  Object.entries(routes).forEach(([path, router]) => {
    app.use(path, router);
  });

  // 健康检查端点
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: serviceName,
      timestamp: new Date().toISOString()
    });
  });

  // 404处理
  app.use((req, res, next) => {
    const { NotFoundError } = require('../middleware/errorTypes');
    const error = new NotFoundError(`找不到路径: ${req.originalUrl}`);
    next(error);
  });

  // 错误处理中间件
  app.use(errorHandler);

  // 启动服务器
  const server = app.listen(port, () => {
    logger.info(`${serviceName}服务运行在端口 ${port}`);
  });

  // 优雅关闭
  const gracefulShutdown = async () => {
    logger.info(`正在关闭${serviceName}服务...`);
    
    try {
      await new Promise((resolve) => server.close(resolve));
      logger.info(`HTTP服务器已关闭`);
      
      if (mongoURI) {
        await mongoose.connection.close();
        logger.info(`MongoDB连接已关闭`);
      }
      
      logger.info(`${serviceName}服务已成功关闭`);
      process.exit(0);
    } catch (err) {
      logger.error(`关闭服务时出错: ${err.message}`, { error: err });
      process.exit(1);
    }
  };

  // 注册进程信号处理
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  return { app, server };
};

module.exports = { createService };
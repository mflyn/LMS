/**
 * 统一错误处理中间件
 * 用于捕获并处理Express应用中的错误
 * 提供请求级别的错误追踪和性能监控
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('../config/logger');
const { AppError } = require('./errorTypes');

/**
 * 请求跟踪中间件
 * 为每个请求添加唯一标识符和开始时间
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 * @param {Function} next - Express下一个中间件函数
 */
const requestTracker = (req, res, next) => {
  req.requestId = req.requestId || uuidv4();
  req.startTime = Date.now();
  
  // 在响应头中添加请求ID
  res.setHeader('X-Request-ID', req.requestId);
  
  // 记录请求开始日志
  if (req.app && req.app.locals.logger) {
    req.app.locals.logger.info(`请求开始: ${req.method} ${req.originalUrl}`, {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user ? req.user.id : 'anonymous',
      service: req.app.locals.serviceName || 'unknown-service'
    });
  }
  
  // 响应完成时记录性能日志
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    if (req.app && req.app.locals.logger) {
      req.app.locals.logger[logLevel](`请求完成: ${req.method} ${req.originalUrl} ${res.statusCode}`, {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.user ? req.user.id : 'anonymous',
        service: req.app.locals.serviceName || 'unknown-service',
        // 添加性能监控标记
        performance: {
          slow: duration > 1000 ? true : false, // 请求处理超过1秒标记为慢请求
          duration: duration
        }
      });
    }
  });
  
  next();
};

/**
 * 处理MongoDB错误
 */
const handleMongoError = (err) => {
  let message = '数据库操作失败';
  let statusCode = 500;

  if (err.code === 11000) {
    // 重复键错误
    const field = Object.keys(err.keyValue)[0];
    message = `${field} 已存在`;
    statusCode = 409;
  } else if (err.name === 'ValidationError') {
    // Mongoose验证错误
    const errors = Object.values(err.errors).map(val => val.message);
    message = errors.join(', ');
    statusCode = 400;
  } else if (err.name === 'CastError') {
    // 无效的ObjectId
    message = '无效的资源ID';
    statusCode = 400;
  }

  return new AppError(message, statusCode);
};

/**
 * 处理JWT错误
 */
const handleJWTError = (err) => {
  let message = '认证失败';
  
  if (err.name === 'JsonWebTokenError') {
    message = '无效的令牌';
  } else if (err.name === 'TokenExpiredError') {
    message = '令牌已过期';
  }
  
  return new AppError(message, 401);
};

/**
 * 处理Joi验证错误
 */
const handleJoiError = (err) => {
  const message = err.details.map(detail => detail.message).join(', ');
  return new AppError(message, 400);
};

/**
 * 开发环境错误响应
 */
const sendErrorDev = (err, req, res) => {
  const error = {
    status: err.status || 'error',
    error: err,
    message: err.message,
    stack: err.stack,
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  };

  logger.error('开发环境错误详情', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  res.status(err.statusCode).json(error);
};

/**
 * 生产环境错误响应
 */
const sendErrorProd = (err, req, res) => {
  const error = {
    status: err.status || 'error',
    message: err.isOperational ? err.message : '服务器内部错误',
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  };

  // 记录所有错误到日志
  if (err.isOperational) {
    logger.warn('操作错误', {
      requestId: req.requestId,
      error: err.message,
      statusCode: err.statusCode,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  } else {
    logger.error('系统错误', {
      requestId: req.requestId,
      error: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  }

  res.status(err.statusCode).json(error);
};

/**
 * 全局错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  // 设置默认错误状态码
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // 复制错误对象以避免修改原始错误
  let error = { ...err };
  error.message = err.message;

  // 处理特定类型的错误
  if (err.name === 'CastError' || err.name === 'ValidationError' || err.code === 11000) {
    error = handleMongoError(error);
  }
  
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    error = handleJWTError(error);
  }
  
  if (err.isJoi) {
    error = handleJoiError(error);
  }

  // 根据环境发送不同的错误响应
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, req, res);
  } else {
    sendErrorProd(error, req, res);
  }
};

/**
 * 异步错误处理包装器
 * 用于包装异步路由处理器，自动捕获Promise rejection
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404错误处理中间件
 */
const notFoundHandler = (req, res, next) => {
  const err = new AppError(`路由 ${req.originalUrl} 不存在`, 404);
  next(err);
};

/**
 * 未捕获异常处理器
 */
const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    logger.error('未捕获异常', {
      error: err.message,
      stack: err.stack
    });
    
    // 优雅关闭服务器
    process.exit(1);
  });
};

/**
 * 未处理的Promise拒绝处理器
 */
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的Promise拒绝', {
      reason: reason.toString(),
      promise: promise.toString()
    });
    
    // 优雅关闭服务器
    process.exit(1);
  });
};

module.exports = {
  errorHandler,
  catchAsync,
  notFoundHandler,
  requestTracker,
  AppError,
  handleUncaughtException,
  handleUnhandledRejection,
  setupUncaughtExceptionHandler: handleUncaughtException  // 添加别名以保持向后兼容
};
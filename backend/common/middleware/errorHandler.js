/**
 * 统一错误处理中间件
 * 用于捕获并处理Express应用中的错误
 * 提供请求级别的错误追踪和性能监控
 */

const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../config/logger');
const { AppError } = require('./errorTypes');
const { redactUrlForLogs } = require('../utils/logRedaction');

const defaultLogger = createLogger('error-handler');

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
  const safeUrl = redactUrlForLogs(req.originalUrl);
  
  // 在响应头中添加请求ID
  res.setHeader('X-Request-ID', req.requestId);
  
  // 记录请求开始日志
  if (req.app && req.app.locals.logger) {
    req.app.locals.logger.info(`请求开始: ${req.method} ${safeUrl}`, {
      requestId: req.requestId,
      method: req.method,
      url: safeUrl,
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
      req.app.locals.logger[logLevel](`请求完成: ${req.method} ${safeUrl} ${res.statusCode}`, {
        requestId: req.requestId,
        method: req.method,
        url: safeUrl,
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

const requestTimeout = ({ timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 15000) } = {}) => {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error('REQUEST_TIMEOUT_MS must be a positive integer');
  }

  return (req, res, next) => {
    let timedOut = false;
    const onTimeout = () => {
      if (timedOut || res.headersSent) return;
      timedOut = true;
      req.timedOut = true;
      const error = new AppError('Request timed out', 408, 'REQUEST_TIMEOUT', true);
      sendContractError(error, req, res);
    };

    if (typeof req.setTimeout === 'function') req.setTimeout(timeoutMs, onTimeout);
    if (typeof res.setTimeout === 'function') res.setTimeout(timeoutMs, onTimeout);
    next();
  };
};

const isMongoConnectivityError = (err) => [
  'MongoNetworkError',
  'MongoServerSelectionError',
  'MongoTimeoutError',
  'MongooseServerSelectionError'
].includes(err.name) || [
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND'
].includes(err.code);

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
  } else if (isMongoConnectivityError(err)) {
    message = '数据库暂时不可用';
    statusCode = 503;
  }

  const code = statusCode === 409
    ? 'RESOURCE_CONFLICT'
    : statusCode === 400 ? 'VALIDATION_ERROR'
      : statusCode === 503 ? 'DATABASE_UNAVAILABLE' : 'INTERNAL_ERROR';
  return new AppError(message, statusCode, code, statusCode !== 500);
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
  
  return new AppError(message, 401, 'UNAUTHENTICATED');
};

/**
 * 处理Joi验证错误
 */
const handleJoiError = (err) => {
  const message = err.details.map(detail => detail.message).join(', ');
  return new AppError(message, 400, 'VALIDATION_ERROR', true, err.details || []);
};

const sendContractError = (err, req, res) => {
  const logger = req.app && req.app.locals.logger ? req.app.locals.logger : defaultLogger;
  const isOperational = Boolean(err.isOperational);
  const message = isOperational ? err.message : '服务器内部错误';
  const code = isOperational && err.code ? err.code : 'INTERNAL_ERROR';
  const details = isOperational && Array.isArray(err.details) ? err.details : [];
  const safeUrl = redactUrlForLogs(req.originalUrl);

  // 记录所有错误到日志
  if (isOperational) {
    logger.warn('操作错误', {
      requestId: req.requestId,
      error: err.message,
      statusCode: err.statusCode,
      url: safeUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  } else {
    logger.error('系统错误', {
      requestId: req.requestId,
      error: err.message,
      stack: err.stack,
      url: safeUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  }

  res.status(err.statusCode).json({
    success: false,
    error: { code, message, details }
  });
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
  // 注意: AppError 子类 (ValidationError 等) 已有 isOperational=true 和正确格式，
  // 不要路由到 handleMongoError，否则 message 和 details 会丢失。
  if (!err.isOperational && (err.name === 'CastError'
    || err.name === 'ValidationError'
    || err.code === 11000
    || isMongoConnectivityError(err))) {
    error = handleMongoError(err);
  }
  
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    error = handleJWTError(err);
  }
  
  if (err.isJoi) {
    error = handleJoiError(err);
  }

  sendContractError(error, req, res);
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
  const err = new AppError(`路由 ${redactUrlForLogs(req.originalUrl)} 不存在`, 404);
  next(err);
};

/**
 * 未捕获异常处理器
 */
const handleUncaughtException = (logger = defaultLogger, processObject = process) => {
  processObject.on('uncaughtException', (err) => {
    logger.error('未捕获异常', {
      error: err.message,
      stack: err.stack
    });

    processObject.exit(1);
  });
};

/**
 * 未处理的Promise拒绝处理器
 */
const handleUnhandledRejection = (logger = defaultLogger, processObject = process) => {
  processObject.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的Promise拒绝', {
      reason: String(reason),
      promise: String(promise)
    });

    processObject.exit(1);
  });
};

module.exports = {
  errorHandler,
  catchAsync,
  notFoundHandler,
  requestTracker,
  requestTimeout,
  AppError,
  handleUncaughtException,
  handleUnhandledRejection,
  setupUncaughtExceptionHandler: handleUncaughtException  // 添加别名以保持向后兼容
};

/**
 * 统一错误处理中间件
 * 用于捕获并处理Express应用中的错误
 * 提供请求级别的错误追踪和性能监控
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'AppError', isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

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
 * 错误处理中间件
 * @param {Error} err - 捕获的错误对象
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 * @param {Function} next - Express下一个中间件函数
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || err.name || 'Error';
  const message = err.message || 'Internal Server Error';
  const requestId = req.requestId || uuidv4();
  
  // 构建响应对象
  const response = {
    status: statusCode >= 500 ? 'error' : 'fail',
    message,
    code,
    requestId
  };
  
  // 如果是验证错误，添加详细错误信息
  if (err.name === 'ValidationError' && err.errors) {
    response.errors = err.errors;
  }
  
  res.status(statusCode).json(response);
};

const catchAsync = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const setupUncaughtExceptionHandler = () => {
  process.on('uncaughtException', err => {
    // eslint-disable-next-line no-console
    console.error('Uncaught Exception:', err);
    process.exit(1);
  });
  process.on('unhandledRejection', err => {
    // eslint-disable-next-line no-console
    console.error('Unhandled Rejection:', err);
    process.exit(1);
  });
};

/**
 * 数据库错误处理函数
 * 将Mongoose错误转换为应用错误
 * @param {Error} err - Mongoose错误
 * @returns {AppError} 应用错误
 */
const handleDatabaseError = (err) => {
  const { DatabaseError, ValidationError, NotFoundError } = require('./errorTypes');
  
  // 处理验证错误
  if (err.name === 'ValidationError') {
    return new ValidationError('数据验证失败', err.errors);
  }
  
  // 处理重复键错误
  if (err.code === 11000) {
    // return new DatabaseError('数据已存在，无法创建重复记录', 409); // Original
    // More specific message based on what caused the duplicate error is often better if possible
    // For example, if it's a username or email:
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    return new AppError(`提供的 ${field} '${value}' 已存在。`, 409, 'DUPLICATE_FIELD'); // 409 Conflict
  }
  
  // 处理ID格式错误
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return new NotFoundError(`找不到ID为 ${err.value} 的资源，提供的ID格式无效。`);
  }
  
  // 其他数据库错误
  return new DatabaseError(err.message);
};

module.exports = {
  errorHandler,
  AppError,
  catchAsync,
  setupUncaughtExceptionHandler,
  requestTracker,
  handleDatabaseError,
  // performanceMonitor // Removed from exports
};
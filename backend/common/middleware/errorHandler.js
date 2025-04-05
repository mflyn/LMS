/**
 * 统一错误处理中间件
 * 用于捕获并处理Express应用中的错误
 * 提供请求级别的错误追踪和性能监控
 */

const { AppError } = require('./errorTypes');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * 请求跟踪中间件
 * 为每个请求添加唯一标识符和开始时间
 * @param {Request} req - Express请求对象
 * @param {Response} res - Express响应对象
 * @param {Function} next - Express下一个中间件函数
 */
const requestTracker = (req, res, next) => {
  // 生成请求ID
  req.requestId = uuidv4();
  // 记录请求开始时间
  req._startTime = Date.now();
  
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
    const duration = Date.now() - req._startTime;
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
  // 设置默认错误信息
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  // 开发环境下的详细错误信息
  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  } 
  // 生产环境下的友好错误信息
  else {
    // 处理不同类型的错误
    let errorMessage = '发生了一个错误';
    let errorCode = 'UNKNOWN_ERROR';
    
    if (err instanceof AppError) {
      errorMessage = err.message;
      errorCode = err.code;
    } else if (err.name === 'ValidationError') {
      errorMessage = '数据验证失败';
      errorCode = 'VALIDATION_ERROR';
    } else if (err.name === 'CastError') {
      errorMessage = '无效的数据格式';
      errorCode = 'INVALID_DATA_FORMAT';
    } else if (err.code === 11000) {
      errorMessage = '数据已存在';
      errorCode = 'DUPLICATE_DATA';
    } else if (err.name === 'JsonWebTokenError') {
      errorMessage = '无效的认证信息';
      errorCode = 'INVALID_TOKEN';
    } else if (err.name === 'TokenExpiredError') {
      errorMessage = '认证信息已过期';
      errorCode = 'TOKEN_EXPIRED';
    }
    
    // 发送友好的错误响应
    res.status(err.statusCode).json({
      status: err.status,
      code: errorCode,
      message: errorMessage,
      suggestion: getErrorSuggestion(errorCode)
    });
  }
};

// 获取错误建议
const getErrorSuggestion = (errorCode) => {
  const suggestions = {
    'VALIDATION_ERROR': '请检查输入的数据格式是否正确',
    'INVALID_DATA_FORMAT': '请确保输入的数据格式正确',
    'DUPLICATE_DATA': '该数据已存在，请尝试其他值',
    'INVALID_TOKEN': '请重新登录获取新的认证信息',
    'TOKEN_EXPIRED': '请重新登录以继续操作',
    'UNKNOWN_ERROR': '请稍后重试，如果问题持续存在请联系管理员'
  };
  
  return suggestions[errorCode] || '请稍后重试';
};

// 异步错误处理包装器
const catchAsync = (fn) => {
  return (req, res, next) => {
    // 确保请求有跟踪ID
    if (!req.requestId) {
      req.requestId = uuidv4();
      req._startTime = Date.now();
    }
    
    Promise.resolve(fn(req, res, next))
      .catch(err => {
        // 增强错误信息
        if (req._startTime) {
          err.requestDuration = Date.now() - req._startTime;
        }
        err.requestId = req.requestId;
        next(err);
      });
  };
};

// 处理未捕获的异常
const setupUncaughtExceptionHandler = (app) => {
  process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    logger.error(err.name, err);
    process.exit(1);
  });

  process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
    logger.error(err.name, err);
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
    return new DatabaseError('数据已存在，无法创建重复记录', 409);
  }
  
  // 处理ID格式错误
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return new NotFoundError(`找不到ID为 ${err.value} 的资源`);
  }
  
  // 其他数据库错误
  return new DatabaseError(err.message);
};

/**
 * 性能监控中间件
 * 记录请求处理时间超过阈值的请求
 * @param {number} threshold - 时间阈值（毫秒）
 * @returns {Function} Express中间件
 */
const performanceMonitor = (threshold = 1000) => {
  return (req, res, next) => {
    const start = Date.now();
    
    // 请求结束时检查处理时间
    res.on('finish', () => {
      const duration = Date.now() - start;
      
      // 如果处理时间超过阈值，记录性能警告日志
      if (duration > threshold && req.app && req.app.locals.logger) {
        req.app.locals.logger.warn(`性能警告: 请求处理时间 ${duration}ms 超过阈值 ${threshold}ms`, {
          requestId: req.requestId,
          method: req.method,
          url: req.originalUrl,
          duration: `${duration}ms`,
          threshold: `${threshold}ms`,
          ip: req.ip,
          userId: req.user ? req.user.id : 'anonymous',
          service: req.app.locals.serviceName || 'unknown-service'
        });
      }
    });
    
    next();
  };
};

module.exports = {
  errorHandler,
  catchAsync,
  setupUncaughtExceptionHandler,
  requestTracker,
  handleDatabaseError,
  performanceMonitor
};
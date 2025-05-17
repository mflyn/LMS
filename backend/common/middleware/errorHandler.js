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
  // Log the full error internally, especially in dev or for operational errors
  if (req.app && req.app.locals.logger) {
    const logLevel = (err.isOperational && err.statusCode < 500) ? 'warn' : 'error';
    req.app.locals.logger[logLevel](`Error caught by errorHandler: ${err.message}`, {
      requestId: req.requestId,
      errorName: err.name,
      statusCode: err.statusCode,
      isOperational: err.isOperational,
      stack: process.env.NODE_ENV === 'development' || err.isOperational ? err.stack : undefined,
      details: err.errors, // For ValidationError
      code: err.code // For system errors like ECONNREFUSED
    });
  } else {
    // Fallback console log if logger is not available
    console.error('ERROR 💥', err);
  }

  // Initialize with err's properties or defaults
  let responseStatusCode = err.statusCode || 500;
  let responseStatus = err.status || (responseStatusCode >= 500 ? 'error' : 'fail');

  if (process.env.NODE_ENV === 'development') {
    return res.status(responseStatusCode).json({
      status: responseStatus,
      error: err, // Send full error object in dev
      message: err.message,
      stack: err.stack
    });
  } 
  // Production environment:
  else {
    let displayedMessage = 'An unexpected error occurred. Please try again later.';
    let errorCodeForClient = 'UNKNOWN_ERROR';

    if (err.isOperational) { // Trust operational errors (AppError and its children)
      displayedMessage = err.message;
      errorCodeForClient = err.name; // Use err.name as the basis for client-facing error code for AppErrors
      // responseStatusCode and responseStatus were set from err.statusCode and err.status or defaults
      // For AppError, these are usually set correctly in the error instance itself.

      if (err.name === 'ValidationError' && err.errors) {
        return res.status(err.statusCode).json({ // Use err.statusCode directly from ValidationError
          status: err.status,
          code: errorCodeForClient,
          message: displayedMessage,
          errors: err.errors, // Send structured validation errors
          suggestion: getErrorSuggestion(err.name)
        });
      }
    } else {
      // Handle specific non-operational errors to provide better (but still safe) client feedback
      // The initial responseStatusCode might be from the error (e.g., SyntaxError from body-parser has 400)
      
      if (err instanceof SyntaxError && responseStatusCode === 400 && err.message.toLowerCase().includes('json')) {
        // Likely a JSON parsing error from middleware like express.json()
        // responseStatusCode is already 400, responseStatus is 'fail'
        errorCodeForClient = 'INVALID_JSON_FORMAT';
        displayedMessage = 'The request body contains invalid JSON and could not be parsed.';
      } else if (err.code && ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH', 'ECONNRESET'].includes(err.code)) {
        // Node.js system errors, often related to network issues with downstream services
        responseStatusCode = 503; // Service Unavailable
        responseStatus = 'error';
        errorCodeForClient = 'SERVICE_CONNECTION_ISSUE';
        displayedMessage = 'A required downstream service is temporarily unavailable. Please try again shortly.';
      } else {
        // For all other truly unknown/unexpected non-operational errors, ensure 500.
        responseStatusCode = 500;
        responseStatus = 'error';
        // errorCodeForClient and displayedMessage remain the default 'UNKNOWN_ERROR' and generic message.
      }
    }
    
    const suggestion = getErrorSuggestion(errorCodeForClient);
    
    return res.status(responseStatusCode).json({
      status: responseStatus,
      code: errorCodeForClient,
      message: displayedMessage,
      suggestion
    });
  }
};

// 获取错误建议 (Keys should match AppError class names or specific Mongoose error names handled)
const getErrorSuggestion = (errorCode) => {
  const suggestions = {
    'ValidationError': '请检查您输入的数据是否符合要求。',
    'BadRequestError': '您的请求格式有误，请检查后重试。',
    'UnauthorizedError': '您需要登录才能执行此操作。',
    'ForbiddenError': '您没有足够的权限执行此操作。',
    'NotFoundError': '您请求的资源未找到。',
    'ConflictError': '操作导致资源冲突，例如尝试创建已存在的唯一资源。',
    'TooManyRequestsError': '您的请求过于频繁，请稍后再试。',
    'InternalServerError': '服务器发生内部错误，请稍后重试。',
    'ServiceUnavailableError': '服务暂时不可用，请稍后重试。',
    'DatabaseError': '数据库操作失败，请稍后重试。',
    'CastError': '提供的数据格式无效，例如无效的ID格式。',
    'JsonWebTokenError': '认证令牌无效，请重新登录。',
    'TokenExpiredError': '认证令牌已过期，请重新登录。',
    'DUPLICATE_DATA': '数据已存在，请尝试其他值。',
    'INVALID_JSON_FORMAT': '请核对您提交的JSON数据格式是否正确，并确保其符合接口要求。',
    'SERVICE_CONNECTION_ISSUE': '系统暂时无法连接到所需服务，该问题通常是暂时的，请稍后重试。如果问题持续，请联系技术支持。',
    'UNKNOWN_ERROR': '请稍后重试，如果问题持续存在请联系我们的支持团队。'
  };
  
  return suggestions[errorCode] || suggestions['UNKNOWN_ERROR'];
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
  catchAsync,
  setupUncaughtExceptionHandler,
  requestTracker,
  handleDatabaseError,
  // performanceMonitor // Removed from exports
};
/**
 * 统一错误类型定义
 * 为所有微服务提供标准化的错误类型
 */

/**
 * 基础应用错误类
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    this.isOperational = true; // 标记为可操作错误，区分系统错误
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 - 错误请求
 */
class BadRequestError extends AppError {
  constructor(message = '请求参数无效') {
    super(message, 400);
  }
}

/**
 * 401 - 未授权
 */
class UnauthorizedError extends AppError {
  constructor(message = '未授权访问') {
    super(message, 401);
  }
}

/**
 * 403 - 禁止访问
 */
class ForbiddenError extends AppError {
  constructor(message = '权限不足') {
    super(message, 403);
  }
}

/**
 * 404 - 资源未找到
 */
class NotFoundError extends AppError {
  constructor(message = '请求的资源不存在') {
    super(message, 404);
  }
}

/**
 * 409 - 资源冲突
 */
class ConflictError extends AppError {
  constructor(message = '资源冲突') {
    super(message, 409);
  }
}

/**
 * 422 - 无法处理的实体
 */
class ValidationError extends AppError {
  constructor(message = '数据验证失败', errors = {}) {
    super(message, 422);
    this.errors = errors;
  }
}

/**
 * 429 - 请求过多
 */
class TooManyRequestsError extends AppError {
  constructor(message = '请求频率过高，请稍后再试') {
    super(message, 429);
  }
}

/**
 * 500 - 服务器内部错误
 */
class InternalServerError extends AppError {
  constructor(message = '服务器内部错误') {
    super(message, 500);
  }
}

/**
 * 503 - 服务不可用
 */
class ServiceUnavailableError extends AppError {
  constructor(message = '服务暂时不可用') {
    super(message, 503);
  }
}

/**
 * 数据库错误
 */
class DatabaseError extends AppError {
  constructor(message = '数据库操作失败', statusCode = 500) {
    super(message, statusCode);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError,
  DatabaseError
};
/**
 * 统一API响应格式工具类
 * 用于标准化所有API的响应结构
 */
class AppResponse {
  constructor(statusCode, message, data = null, error = null, pagination = null) {
    this.statusCode = statusCode;
    this.status = statusCode >= 400 ? 'error' : 'success';
    this.message = message;
    
    if (data !== null) {
      this.data = data;
    }
    
    if (error !== null) {
      this.error = error;
    }
    
    if (pagination !== null) {
      this.pagination = pagination;
    }
  }

  // 成功响应的静态方法
  static success(message = 'Success', data = null, pagination = null) {
    return new AppResponse(200, message, data, null, pagination);
  }

  // 创建响应的静态方法
  static created(message = 'Created successfully', data = null) {
    return new AppResponse(201, message, data);
  }

  // 错误响应的静态方法
  static error(statusCode = 500, message = 'Internal Server Error', error = null) {
    return new AppResponse(statusCode, message, null, error);
  }

  // 验证错误响应
  static validationError(message = 'Validation failed', errors = null) {
    return new AppResponse(400, message, null, errors);
  }

  // 未找到响应
  static notFound(message = 'Resource not found') {
    return new AppResponse(404, message);
  }

  // 未授权响应
  static unauthorized(message = 'Unauthorized') {
    return new AppResponse(401, message);
  }

  // 禁止访问响应
  static forbidden(message = 'Forbidden') {
    return new AppResponse(403, message);
  }

  // 冲突响应
  static conflict(message = 'Conflict') {
    return new AppResponse(409, message);
  }
}

module.exports = { AppResponse }; 
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.code = code || 'UNKNOWN_ERROR';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// 预定义的错误类型
AppError.types = {
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    statusCode: 400,
    message: '数据验证失败'
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    statusCode: 404,
    message: '未找到请求的资源'
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    statusCode: 401,
    message: '未授权访问'
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    statusCode: 403,
    message: '禁止访问'
  },
  DUPLICATE_DATA: {
    code: 'DUPLICATE_DATA',
    statusCode: 409,
    message: '数据已存在'
  },
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    statusCode: 401,
    message: '无效的认证信息'
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    statusCode: 401,
    message: '认证信息已过期'
  }
};

// 创建预定义错误的方法
AppError.create = (type, customMessage) => {
  const errorType = AppError.types[type];
  if (!errorType) {
    throw new Error(`未知的错误类型: ${type}`);
  }
  return new AppError(
    customMessage || errorType.message,
    errorType.statusCode,
    errorType.code
  );
};

module.exports = AppError; 
const { v4: uuidv4 } = require('uuid');
const AuditLog = require('../models/AuditLog');

/**
 * 用户行为审计日志中间件
 * 记录用户的操作行为，用于后续的行为分析
 */
const auditLogger = (options = {}) => {
  const { excludePaths = [], sensitiveOperations = [] } = options;

  return async (req, res, next) => {
    // 跳过不需要记录的路径
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // 生成请求ID
    const requestId = uuidv4();
    req.requestId = requestId;

    // 记录请求开始时间
    const startTime = Date.now();

    // 创建审计日志记录
    const auditLog = new AuditLog({
      requestId,
      timestamp: new Date(),
      method: req.method,
      url: req.originalUrl,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userId: req.user ? req.user.id : null,
      operationType: sensitiveOperations.some(op => req.path.includes(op)) ? 'sensitive' : 'normal',
      requestBody: req.method !== 'GET' ? sanitizeData(req.body) : undefined,
      requestQuery: req.query,
      requestParams: req.params,
      status: 'pending'
    });

    // 保存初始日志
    try {
      await auditLog.save();
    } catch (error) {
      console.error('保存审计日志失败:', error);
      // 即使日志保存失败，也不应影响请求处理
    }

    // 捕获响应
    const originalSend = res.send;
    res.send = function (body) {
      res.send = originalSend;
      const responseBody = body;

      // 计算响应时间
      const responseTime = Date.now() - startTime;

      // 异步更新审计日志
      updateAuditLog(requestId, {
        responseTime,
        statusCode: res.statusCode,
        responseBody: sanitizeData(responseBody),
        status: 'completed',
        completedAt: new Date()
      }).catch(err => console.error('更新审计日志失败:', err));

      return res.send(responseBody);
    };

    // 错误处理
    const handleError = (err) => {
      updateAuditLog(requestId, {
        status: 'error',
        error: {
          message: err.message,
          stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
        },
        completedAt: new Date()
      }).catch(e => console.error('更新错误审计日志失败:', e));
    };

    // 监听请求结束和错误事件
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        handleError({ message: `HTTP Error: ${res.statusCode}` });
      }
    });
    res.on('error', handleError);

    next();
  };
};

/**
 * 更新审计日志
 */
async function updateAuditLog(requestId, data) {
  try {
    await AuditLog.findOneAndUpdate({ requestId }, data, { new: true });
  } catch (error) {
    console.error(`更新审计日志 ${requestId} 失败:`, error);
  }
}

/**
 * 清理敏感数据
 */
function sanitizeData(data) {
  if (!data) return data;
  
  // 如果是字符串，尝试解析为JSON
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      // 不是有效的JSON，返回原始字符串
      return data;
    }
  }

  // 创建数据的副本以避免修改原始对象
  const sanitized = { ...data };
  
  // 敏感字段列表
  const sensitiveFields = ['password', 'token', 'secret', 'creditCard', 'ssn'];
  
  // 递归清理对象
  function cleanObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    Object.keys(obj).forEach(key => {
      // 检查是否为敏感字段
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        // 递归处理嵌套对象
        cleanObject(obj[key]);
      }
    });
    
    return obj;
  }
  
  return cleanObject(sanitized);
}

module.exports = auditLogger;
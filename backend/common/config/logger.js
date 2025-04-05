/**
 * 统一日志配置
 * 使用Winston日志库实现结构化日志记录
 * 提供请求跟踪和性能监控功能
 */

const winston = require('winston');
const fs = require('fs');
const path = require('path');
const { format } = require('winston');

/**
 * 创建日志目录
 * @param {string} logDir 日志目录路径
 */
const createLogDirectory = (logDir) => {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
};

/**
 * 创建自定义日志格式
 * @param {boolean} colorize 是否启用颜色
 * @returns {winston.Format} Winston格式对象
 */
const createLogFormat = (colorize = false) => {
  const baseFormat = [
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'service', 'requestId'] })
  ];
  
  if (colorize) {
    return format.combine(
      ...baseFormat,
      format.colorize(),
      format.printf(({ level, message, timestamp, service, requestId, metadata }) => {
        let metaStr = '';
        if (metadata && Object.keys(metadata).length > 0) {
          metaStr = JSON.stringify(metadata);
        }
        const reqId = requestId ? `[${requestId}]` : '';
        return `${timestamp} [${service}] ${level}: ${reqId} ${message} ${metaStr}`;
      })
    );
  }
  
  return format.combine(...baseFormat, format.json());
};

/**
 * 创建日志记录器
 * @param {string} serviceName 服务名称
 * @param {string} logDir 日志目录路径
 * @param {Object} options 其他配置选项
 * @returns {Object} 包含logger和httpLogger的对象
 */
const createLogger = (serviceName, logDir = 'logs', options = {}) => {
  // 确保日志目录存在
  createLogDirectory(logDir);
  
  // 获取配置选项
  const { 
    logLevel = process.env.LOG_LEVEL || 'info',
    maxSize = 10485760, // 10MB
    maxFiles = 5,
    enableConsole = true,
    enablePerformanceLogging = true
  } = options;
  
  // 创建自定义日志格式
  const consoleFormat = createLogFormat(true);
  const fileFormat = createLogFormat(false);
  
  // 创建传输器数组
  const transports = [];
  
  // 添加控制台传输器
  if (enableConsole) {
    transports.push(new winston.transports.Console({
      format: consoleFormat
    }));
  }
  
  // 添加文件传输器
  transports.push(
    // 错误日志文件
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: maxSize,
      maxFiles: maxFiles,
      tailable: true,
      format: fileFormat
    }),
    // 所有日志文件
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: maxSize,
      maxFiles: maxFiles,
      tailable: true,
      format: fileFormat
    })
  );
  
  // 如果启用性能日志，添加性能日志文件
  if (enablePerformanceLogging) {
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'performance.log'),
        level: 'warn',
        maxsize: maxSize,
        maxFiles: maxFiles,
        tailable: true,
        format: fileFormat
      })
    );
  }
  
  // 创建日志记录器
  const logger = winston.createLogger({
    level: logLevel,
    defaultMeta: { service: serviceName },
    transports: transports
  });
  
  // 添加自定义日志方法
  logger.performance = function(message, meta = {}) {
    this.warn(message, { ...meta, logType: 'performance' });
  };
  
  logger.audit = function(message, meta = {}) {
    this.info(message, { ...meta, logType: 'audit' });
  };
  
  // 添加HTTP请求日志中间件
  const httpLogger = (req, res, next) => {
    // 使用请求跟踪中间件生成的requestId
    const requestId = req.requestId;
    
    // 记录请求开始时间
    const start = Date.now();
    
    // 响应结束时记录日志
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
      
      // 构建日志元数据
      const logMeta = {
        requestId: requestId,
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.user ? req.user.id : 'anonymous',
        userRole: req.user ? req.user.role : null,
        contentLength: res.get('content-length'),
        referrer: req.get('referer') || req.get('referrer')
      };
      
      // 记录HTTP请求日志
      logger.log(logLevel, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, logMeta);
      
      // 如果请求处理时间超过阈值，记录性能日志
      if (enablePerformanceLogging && duration > 1000) {
        logger.performance(`慢请求: ${req.method} ${req.originalUrl}`, {
          ...logMeta,
          threshold: '1000ms'
        });
      }
    });
    
    next();
  };
  
  return { logger, httpLogger };
};

/**
 * 创建审计日志记录函数
 * @param {winston.Logger} logger - Winston日志记录器实例
 * @returns {Function} 审计日志记录函数
 */
const createAuditLogger = (logger) => {
  return (action, userId, details = {}) => {
    logger.audit(`审计: ${action}`, {
      action,
      userId,
      timestamp: new Date().toISOString(),
      details
    });
  };
};

module.exports = { 
  createLogger,
  createLogFormat,
  createAuditLogger 
};
/**
 * 统一日志配置
 * 使用Winston日志库实现结构化日志记录
 * 提供请求跟踪和性能监控功能
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// 定义日志级别
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// 定义日志颜色
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

// 设置 winston 颜色
winston.addColors(colors);

// 定义日志格式
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  )
);

// 创建日志目录
const logDir = path.join(__dirname, '../../logs');



// 创建性能监控中间件
const performanceLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logger = req.app.locals.logger || console;
    logger.log({
      level: 'http',
      message: `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
      meta: {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('user-agent')
      }
    });
  });
  next();
};

// 错误日志中间件
const errorLogger = (err, req, res, next) => {
  const logger = req.app.locals.logger || console;
  logger.error({
    message: err.message,
    stack: err.stack,
    meta: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      body: req.body,
      query: req.query,
      params: req.params
    }
  });
  next(err);
};

/**
 * 创建服务特定的日志记录器
 * @param {string} serviceName - 服务名称
 * @param {object} options - 可选配置
 * @returns {object} Winston logger 实例
 */
function createLogger(serviceName, options = {}) {
  const logLevel = options.logLevel || process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

  const serviceLogger = winston.createLogger({
    level: logLevel,
    levels,
    format,
    defaultMeta: { service: serviceName },
    transports: [
      // 错误日志
      new DailyRotateFile({
        filename: path.join(logDir, `${serviceName}-error-%DATE%.log`),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true
      }),

      // 应用日志
      new DailyRotateFile({
        filename: path.join(logDir, `${serviceName}-%DATE%.log`),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true
      })
    ]
  });

  // 在开发环境下添加控制台输出
  if (process.env.NODE_ENV !== 'production') {
    serviceLogger.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }));
  }

  return serviceLogger;
}

module.exports = {
  performanceLogger,
  errorLogger,
  createLogger
};
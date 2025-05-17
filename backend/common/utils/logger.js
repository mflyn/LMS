const winston = require('winston');
const { format } = winston;
const { combine, timestamp, printf, colorize } = format;
const DailyRotateFile = require('winston-daily-rotate-file'); // 引入模块

// 自定义日志格式
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}] : ${message}`;
  // 确保 metadata 不为 null 或 undefined
  if (metadata && Object.keys(metadata).length > 0) {
    // 特殊处理 error 对象，只记录其 message 和 stack (如果存在)
    if (metadata.error instanceof Error) {
      msg += ` ${JSON.stringify({ error: { message: metadata.error.message, stack: metadata.error.stack } })}`;
      // 从 metadata 中移除已处理的 error，避免重复记录
      const { error, ...restMetadata } = metadata;
      if (Object.keys(restMetadata).length > 0) {
        msg += ` ${JSON.stringify(restMetadata)}`;
      }
    } else {
      msg += ` ${JSON.stringify(metadata)}`;
    }
  }
  return msg;
});

// 创建日志记录器
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // 统一时间戳格式
    logFormat
  ),
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      )
    }),
    // 错误日志文件 (轮转)
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true, // 压缩旧日志
      maxSize: '20m',    // 单个日志文件最大20MB
      maxFiles: '14d',   // 保留最近14天的日志
      handleExceptions: true, // 捕获未处理的异常
      handleRejections: true  // 捕获未处理的 Promise rejections
    }),
    // 所有日志文件 (轮转)
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d', // 所有日志保留时间可以更长一些
      handleExceptions: true,
      handleRejections: true
    })
  ],
  exitOnError: false // 不要在记录异常后退出
});

// 如果在非生产环境，可以添加一个更详细的控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// requestLogger 中间件已被移除，因为其功能由 errorHandler.js 中的 requestTracker 提供

module.exports = {
  logger
  // requestLogger // 已移除
}; 
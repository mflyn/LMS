/**
 * 模拟日志配置，用于测试环境
 */

// 创建模拟日志记录器
const createLogger = (serviceName) => {
  const logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    http: jest.fn(),
    debug: jest.fn(),
    log: jest.fn()
  };

  const httpLogger = (req, res, next) => {
    next();
  };

  return { logger, httpLogger };
};

// 模拟性能监控中间件
const performanceLogger = (req, res, next) => {
  next();
};

// 模拟错误日志中间件
const errorLogger = (err, req, res, next) => {
  next(err);
};

module.exports = {
  createLogger,
  performanceLogger,
  errorLogger
};

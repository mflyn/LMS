// 模拟日志记录器
const createLogger = (serviceName) => {
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };
  
  const httpLogger = (req, res, next) => {
    next();
  };
  
  return { logger, httpLogger };
};

module.exports = { createLogger };

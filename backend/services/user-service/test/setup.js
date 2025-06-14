/**
 * 测试环境设置文件
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test-db';
process.env.SESSION_SECRET = 'test-session-secret';

// 模拟模块
jest.mock('bcrypt', () => require('./mocks/bcrypt'));
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockImplementation((payload, secret, options) => {
    return `mock_token_for_${payload.username || payload.id}`;
  }),
  verify: jest.fn().mockImplementation((token, secret, callback) => {
    // 如果没有提供回调函数，使用同步模式（用于某些测试）
    if (typeof callback !== 'function') {
      const matches = token.match(/mock_token_for_(.*)/);
      if (matches && matches[1]) {
        return {
          id: matches[1],
          username: matches[1],
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        };
      }
      throw new Error('Invalid token');
    }
    
    // 异步模式（用于中间件）
    const matches = token.match(/mock_token_for_(.*)/);
    if (matches && matches[1]) {
      callback(null, {
        id: matches[1],
        username: matches[1],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      });
    } else {
      callback(new Error('Invalid token'));
    }
  })
}));
jest.mock('mongoose', () => require('./mocks/mongoose'));
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
    log: jest.fn(),
    add: jest.fn()
  }),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    align: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  },
  addColors: jest.fn()
}));
jest.mock('dotenv', () => require('./mocks/dotenv'));
jest.mock('express', () => require('./mocks/express'));
jest.mock('cors', () => require('./mocks/cors'));
jest.mock('express-session', () => require('./mocks/express-session'));
jest.mock('connect-mongo', () => require('./mocks/connect-mongo'));
// jest.mock('express-validator', () => require('./mocks/express-validator'));
jest.mock('express-rate-limit', () => require('./mocks/express-rate-limit'));
jest.mock('helmet', () => require('./mocks/helmet'));
jest.mock('xss-clean', () => require('./mocks/xss-clean'));
jest.mock('hpp', () => require('./mocks/hpp'));
jest.mock('multer', () => require('./mocks/multer'));
jest.mock('uuid', () => require('./mocks/uuid'));
jest.mock('winston-daily-rotate-file', () => require('./mocks/winston-daily-rotate-file'));
// jest.mock('password-validator', () => require('./mocks/password-validator'));
jest.mock('sanitize-html', () => require('./mocks/sanitize-html'));
jest.mock('amqplib', () => require('./mocks/amqplib'));
// jest.mock('fs', () => require('./mocks/fs'));
// jest.mock('path', () => require('./mocks/path'));
jest.mock('mongodb-memory-server', () => require('./mocks/mongodb-memory-server'));
jest.mock('supertest', () => require('./mocks/supertest'));

// 全局模拟
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

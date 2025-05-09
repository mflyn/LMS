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
jest.mock('jsonwebtoken', () => require('./mocks/jsonwebtoken'));
jest.mock('mongoose', () => require('./mocks/mongoose'));
jest.mock('winston', () => require('./mocks/winston'));
jest.mock('dotenv', () => require('./mocks/dotenv'));
jest.mock('express', () => require('./mocks/express'));
jest.mock('cors', () => require('./mocks/cors'));
jest.mock('express-session', () => require('./mocks/express-session'));
jest.mock('connect-mongo', () => require('./mocks/connect-mongo'));
jest.mock('express-validator', () => require('./mocks/express-validator'));
jest.mock('express-rate-limit', () => require('./mocks/express-rate-limit'));
jest.mock('helmet', () => require('./mocks/helmet'));
jest.mock('xss-clean', () => require('./mocks/xss-clean'));
jest.mock('hpp', () => require('./mocks/hpp'));
jest.mock('multer', () => require('./mocks/multer'));
jest.mock('uuid', () => require('./mocks/uuid'));
jest.mock('winston-daily-rotate-file', () => require('./mocks/winston-daily-rotate-file'));
jest.mock('password-validator', () => require('./mocks/password-validator'));
jest.mock('sanitize-html', () => require('./mocks/sanitize-html'));
jest.mock('amqplib', () => require('./mocks/amqplib'));
jest.mock('fs', () => require('./mocks/fs'));
jest.mock('path', () => require('./mocks/path'));
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

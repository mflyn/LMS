const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 增加超时时间
jest.setTimeout(60000);

// 设置测试环境
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

// 模拟 common 中间件
jest.mock('../../../common/middleware/requestValidator', () => ({
  registerValidation: (req, res, next) => next(),
  loginValidation: (req, res, next) => next(),
  validate: (req, res, next) => next()
}));

jest.mock('../../../common/middleware/passwordPolicy', () => (req, res, next) => next());

jest.mock('../../../common/config/logger', () => {
  const mockLoggerInstance = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
    log: jest.fn()
  };

  return {
    createLogger: jest.fn(() => mockLoggerInstance),
    performanceLogger: jest.fn((req, res, next) => next()),
    errorLogger: jest.fn((err, req, res, next) => next(err)),
    __mockLogger: mockLoggerInstance
  };
});

// 使用真实的 User 模型
const { __mockLogger: directMockLogger } = require('../../../common/config/logger');
const User = require('../models/User');

// 导入路由
const authRouter = require('../routes/auth');

describe('认证服务直接测试', () => {
  let app;
  let mongoServer;

  beforeAll(async () => {
    // 创建内存数据库
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // 创建Express应用
    app = express();
    app.use(express.json());

    // 添加路由
    app.use('/api/auth', authRouter);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    Object.values(directMockLogger).forEach(fn => {
      if (typeof fn.mockClear === 'function') {
        fn.mockClear();
      }
    });
    // 清理测试数据
    await User.deleteMany({});
  });

  // 测试注册功能
  describe('POST /api/auth/register', () => {
    it('应该成功注册新用户', async () => {
      const userData = {
        username: 'testuser',
        password: 'Test123!@#',
        email: 'test@example.com',
        role: 'student',
        name: '测试用户'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.role).toBe(userData.role);
      expect(response.body.data.user.name).toBe(userData.name);
    });

    it('应该拒绝重复的用户名', async () => {
      // 先创建一个用户
      const userData = {
        username: 'testuser',
        password: await bcryptjs.hash('Test123!@#', 10),
        email: 'test@example.com',
        role: 'student',
        name: '测试用户'
      };

      await User.create(userData);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: 'Test123!@#',
          email: 'another@example.com',
          role: 'student',
          name: '另一个测试用户'
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('用户名已存在');
    });
  });

  // 测试登录功能
  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // 创建一个测试用户
      const hashedPassword = await bcryptjs.hash('Test123!@#', 10);
      await User.create({
        username: 'testuser',
        password: hashedPassword,
        email: 'test@example.com',
        role: 'student',
        name: '测试用户'
      });
    });

    it('应该成功登录', async () => {
      // 创建一个用户，使用明文密码，让 bcrypt 中间件处理加密
      const userData = {
        username: 'loginuser',
        password: 'Test123!@#',
        email: 'login@example.com',
        role: 'student',
        name: '登录测试用户'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      const loginData = {
        username: 'loginuser',
        password: 'Test123!@#'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.username).toBe(loginData.username);
    });

    it('应该拒绝错误的密码', async () => {
      const loginData = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('用户名或密码错误');
    });

    it('应该拒绝不存在的用户', async () => {
      const loginData = {
        username: 'nonexistent',
        password: 'Test123!@#'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('用户名或密码错误');
    });
  });
});

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const bcryptjs = require('bcryptjs');
const { __mockLogger: integrationMockLogger } = require('../../../common/config/logger');

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

describe('认证API集成测试', () => {
  let mongoServer;

  beforeAll(async () => {
    // 设置内存MongoDB服务器
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    Object.values(integrationMockLogger).forEach(fn => {
      if (typeof fn.mockClear === 'function') {
        fn.mockClear();
      }
    });
    // 清理数据库
    await User.deleteMany({});

    // 创建测试用户
    const hashedPassword = await bcryptjs.hash('TestPassword123!', 10);
    await User.create({
      username: 'testuser',
      password: hashedPassword,
      email: 'test@example.com',
      role: 'student',
      name: '测试用户'
    });
  });

  describe('POST /api/auth/register', () => {
    test('应成功注册新用户', async () => {
      const userData = {
        username: 'newuser',
        password: 'NewPassword123!',
        email: 'new@example.com',
        role: 'parent',
        name: '新用户'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('username', userData.username);
      expect(response.body.data.user).toHaveProperty('email', userData.email);
      expect(response.body.data.user).toHaveProperty('role', userData.role);
      expect(response.body.data.user).not.toHaveProperty('password');

      // 验证用户已保存到数据库
      const savedUser = await User.findOne({ username: userData.username });
      expect(savedUser).not.toBeNull();
      expect(savedUser.email).toBe(userData.email);
    });

    test('用户名已存在时应返回错误', async () => {
      const userData = {
        username: 'testuser', // 已存在的用户名
        password: 'NewPassword123!',
        email: 'another@example.com',
        role: 'student'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('用户名已存在');
    });

    test('缺少必填字段时应返回错误', async () => {
      const userData = {
        username: 'incompleteuser',
        // 缺少密码
        email: 'incomplete@example.com'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      // 在我们的实现中，缺少必填字段会返回 500 错误
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('status', 'error');
    });
  });

  describe('POST /api/auth/login', () => {
    test('应成功登录并返回token', async () => {
      // 先创建一个新用户
      const userData = {
        username: 'loginuser',
        password: 'TestPassword123!',
        email: 'login@example.com',
        role: 'student',
        name: '登录测试用户'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      const credentials = {
        username: 'loginuser',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('username', credentials.username);
      expect(response.body.data.user).toHaveProperty('role', 'student');
    });

    test('用户名不存在时应返回错误', async () => {
      const credentials = {
        username: 'nonexistentuser',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(401);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('用户名或密码错误');
    });

    test('密码不正确时应返回错误', async () => {
      const credentials = {
        username: 'testuser',
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(401);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('用户名或密码错误');
    });
  });

  describe('GET /api/auth/verify', () => {
    test('有效token应验证成功', async () => {
      // 先创建一个新用户
      const userData = {
        username: 'verifyuser',
        password: 'TestPassword123!',
        email: 'verify@example.com',
        role: 'student',
        name: '验证测试用户'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      // 登录获取token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'verifyuser',
          password: 'TestPassword123!'
        });

      const token = loginResponse.body.data.token;

      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('user');
    });

    test('无token应返回未授权错误', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .expect(401);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('未认证');
    });

    test('无效token应返回未授权错误', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('无效的认证令牌');
    });
  });
});

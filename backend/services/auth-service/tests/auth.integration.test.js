const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const bcrypt = require('bcrypt');

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
    // 清理数据库
    await User.deleteMany({});
    
    // 创建测试用户
    const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
    await User.create({
      username: 'testuser',
      password: hashedPassword,
      email: 'test@example.com',
      role: 'student'
    });
  });
  
  describe('POST /api/auth/register', () => {
    test('应成功注册新用户', async () => {
      const userData = {
        username: 'newuser',
        password: 'NewPassword123!',
        email: 'new@example.com',
        role: 'parent'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('username', userData.username);
      expect(response.body.user).toHaveProperty('email', userData.email);
      expect(response.body.user).toHaveProperty('role', userData.role);
      expect(response.body.user).not.toHaveProperty('password');
      
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
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('用户名已存在');
    });
    
    test('缺少必填字段时应返回错误', async () => {
      const userData = {
        username: 'incompleteuser',
        // 缺少密码
        email: 'incomplete@example.com'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('POST /api/auth/login', () => {
    test('应成功登录并返回token', async () => {
      const credentials = {
        username: 'testuser',
        password: 'TestPassword123!'
      };
      
      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(200);
      
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('username', credentials.username);
      expect(response.body.user).toHaveProperty('role', 'student');
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
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('用户名或密码不正确');
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
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('用户名或密码不正确');
    });
  });
  
  describe('GET /api/auth/verify', () => {
    test('有效token应验证成功', async () => {
      // 先登录获取token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123!'
        });
      
      const token = loginResponse.body.token;
      
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('valid', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('username', 'testuser');
    });
    
    test('无token应返回未授权错误', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('未提供认证令牌');
    });
    
    test('无效token应返回未授权错误', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('无效的认证令牌');
    });
  });
});
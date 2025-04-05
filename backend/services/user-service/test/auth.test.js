const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

let mongoServer;

// 测试前设置
beforeAll(async () => {
  // 创建内存MongoDB实例用于测试
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // 创建测试用户
  const hashedPassword = await bcrypt.hash('testpassword', 10);
  await User.create({
    username: 'testuser',
    password: hashedPassword,
    email: 'test@example.com',
    name: '测试用户',
    role: 'student',
  });
});

// 测试后清理
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// 每个测试后清理数据库
afterEach(async () => {
  // 保留测试用户，清理其他数据
  const testUser = await User.findOne({ username: 'testuser' });
  await User.deleteMany({ _id: { $ne: testUser._id } });
});

describe('认证API测试', () => {
  // 测试用户注册
  describe('POST /api/auth/register', () => {
    it('应成功注册新用户', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          password: 'password123',
          email: 'new@example.com',
          name: '新用户',
          role: 'student',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('username', 'newuser');
      expect(res.body.user).toHaveProperty('email', 'new@example.com');
      expect(res.body.user).toHaveProperty('role', 'student');
      expect(res.body).toHaveProperty('token');

      // 验证用户已保存到数据库
      const savedUser = await User.findOne({ username: 'newuser' });
      expect(savedUser).not.toBeNull();
    });

    it('应拒绝重复的用户名', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser', // 已存在的用户名
          password: 'password123',
          email: 'another@example.com',
          name: '另一个用户',
          role: 'student',
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('用户名已存在');
    });

    it('应拒绝缺少必填字段的请求', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'incompleteuser',
          // 缺少密码
          email: 'incomplete@example.com',
          name: '不完整用户',
          role: 'student',
        });

      expect(res.statusCode).toEqual(400);
    });
  });

  // 测试用户登录
  describe('POST /api/auth/login', () => {
    it('应成功登录并返回令牌', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'testpassword',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('username', 'testuser');
      expect(res.body).toHaveProperty('token');

      // 验证令牌
      const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET || 'your_jwt_secret_key');
      expect(decoded).toHaveProperty('id');
      expect(decoded).toHaveProperty('username', 'testuser');
    });

    it('应拒绝错误的密码', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword',
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('密码不正确');
    });

    it('应拒绝不存在的用户', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistentuser',
          password: 'anypassword',
        });

      expect(res.statusCode).toEqual
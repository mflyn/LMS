const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const authRoutes = require('../../routes/auth');
const User = require('../../models/User');
const Role = require('../../models/Role');
const config = require('../../config');

// 创建一个简单的Express应用用于测试
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

let mongoServer;

// 在所有测试之前设置内存数据库
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // 创建测试角色
  await Role.create({
    name: 'student',
    description: '学生角色',
    permissions: ['read_resources', 'submit_homework']
  });

  await Role.create({
    name: 'teacher',
    description: '教师角色',
    permissions: ['read_resources', 'create_resources', 'grade_homework']
  });
});

// 在所有测试之后关闭连接
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// 每个测试之前清理数据库
beforeEach(async () => {
  await User.deleteMany({});
});

describe('认证路由测试', () => {
  describe('POST /api/auth/register', () => {
    it('应该成功注册新用户', async () => {
      const userData = {
        name: '测试用户',
        username: 'testuser',
        password: 'password123',
        email: 'test@example.com',
        role: 'student',
        grade: '三年级',
        class: '1班',
        studentId: 'S12345'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('用户注册成功');

      // 验证用户是否已保存到数据库
      const user = await User.findOne({ username: 'testuser' });
      expect(user).not.toBeNull();
      expect(user.name).toBe('测试用户');
      expect(user.email).toBe('test@example.com');
      expect(user.role).toBe('student');

      // 验证密码是否已加密
      const isPasswordValid = await bcrypt.compare('password123', user.password);
      expect(isPasswordValid).toBe(true);
    });

    it('应该拒绝注册已存在的用户名', async () => {
      // 先创建一个用户
      const existingUser = new User({
        name: '已存在用户',
        username: 'existinguser',
        password: await bcrypt.hash('password123', 10),
        email: 'existing@example.com',
        role: 'student',
        grade: '三年级',
        class: '1班',
        studentId: 'S12345'
      });
      await existingUser.save();

      // 尝试使用相同用户名注册
      const userData = {
        name: '新用户',
        username: 'existinguser',
        password: 'password123',
        email: 'new@example.com',
        role: 'student',
        grade: '四年级',
        class: '2班',
        studentId: 'S67890'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('用户名已存在');
    });

    it('应该拒绝无效的角色', async () => {
      const userData = {
        name: '测试用户',
        username: 'testuser',
        password: 'password123',
        email: 'test@example.com',
        role: 'invalid_role' // 无效角色
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('无效的角色');
    });

    it('应该处理服务器错误', async () => {
      // 模拟数据库错误
      jest.spyOn(User.prototype, 'save').mockImplementationOnce(() => {
        throw new Error('数据库错误');
      });

      const userData = {
        name: '测试用户',
        username: 'testuser',
        password: 'password123',
        email: 'test@example.com',
        role: 'student',
        grade: '三年级',
        class: '1班',
        studentId: 'S12345'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('服务器错误');

      // 恢复模拟
      User.prototype.save.mockRestore();
    });
  });

  describe('POST /api/auth/login', () => {
    it('应该成功登录并返回令牌', async () => {
      // 创建测试用户
      const hashedPassword = await bcrypt.hash('password123', 10);
      const testUser = new User({
        name: '测试用户',
        username: 'testuser',
        password: hashedPassword,
        email: 'test@example.com',
        role: 'student',
        grade: '三年级',
        class: '1班',
        studentId: 'S12345'
      });
      await testUser.save();

      const loginData = {
        username: 'testuser',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe('testuser');
      expect(response.body.user.name).toBe('测试用户');
      expect(response.body.user.role).toBe('student');

      // 验证令牌
      const decoded = jwt.verify(response.body.token, config.jwtSecret);
      expect(decoded.username).toBe('testuser');
      expect(decoded.role).toBe('student');
    });

    it('应该拒绝不存在的用户', async () => {
      const loginData = {
        username: 'nonexistentuser',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('用户名或密码不正确');
    });

    it('应该拒绝错误的密码', async () => {
      // 创建测试用户
      const hashedPassword = await bcrypt.hash('password123', 10);
      const testUser = new User({
        name: '测试用户',
        username: 'testuser',
        password: hashedPassword,
        email: 'test@example.com',
        role: 'student',
        grade: '三年级',
        class: '1班',
        studentId: 'S12345'
      });
      await testUser.save();

      const loginData = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('用户名或密码不正确');
    });

    it('应该处理服务器错误', async () => {
      // 模拟数据库错误
      jest.spyOn(User, 'findOne').mockImplementationOnce(() => {
        throw new Error('数据库错误');
      });

      const loginData = {
        username: 'testuser',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('服务器错误');

      // 恢复模拟
      User.findOne.mockRestore();
    });
  });
});

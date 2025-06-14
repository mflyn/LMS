const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../../../common/models/User');

let mongoServer;

describe('认证服务测试', () => {
  beforeAll(async () => {
    // 启动内存数据库
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // 连接到内存数据库
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    // 关闭数据库连接
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // 清理数据库
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

    it('应该成功使用手机号注册新用户', async () => {
      const userData = {
        username: 'phoneuser',
        password: 'Test123!@#',
        phone: '13800138000',
        role: 'student',
        name: '手机号用户'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.phone).toBe(userData.phone);
      expect(response.body.data.user.registrationType).toBe('phone');
      expect(response.body.data.user.role).toBe(userData.role);
      expect(response.body.data.user.name).toBe(userData.name);
    });

    it('应该成功使用混合方式注册新用户', async () => {
      const userData = {
        username: 'mixeduser',
        password: 'Test123!@#',
        email: 'mixed@example.com',
        phone: '13900139000',
        role: 'student',
        name: '混合用户'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.phone).toBe(userData.phone);
      expect(response.body.data.user.registrationType).toBe('mixed');
      expect(response.body.data.user.role).toBe(userData.role);
      expect(response.body.data.user.name).toBe(userData.name);
    });

    it('应该拒绝既没有邮箱也没有手机号的注册', async () => {
      const userData = {
        username: 'invaliduser',
        password: 'Test123!@#',
        role: 'student',
        name: '无效用户'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('至少提供一种联系方式');
    });

    it('应该拒绝无效格式的手机号', async () => {
      const userData = {
        username: 'invalidphoneuser',
        password: 'Test123!@#',
        phone: '12345678901', // 无效格式
        role: 'student',
        name: '无效手机号用户'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });

    it('应该拒绝重复的手机号', async () => {
      const userData1 = {
        username: 'user1',
        password: 'Test123!@#',
        phone: '13800138000',
        role: 'student',
        name: '用户1'
      };

      const userData2 = {
        username: 'user2',
        password: 'Test123!@#',
        phone: '13800138000', // 重复的手机号
        role: 'student',
        name: '用户2'
      };

      // 先创建第一个用户
      await request(app)
        .post('/api/auth/register')
        .send(userData1);

      // 尝试创建第二个用户
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData2);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('手机号已存在');
    });

    it('应该拒绝重复的用户名', async () => {
      const userData = {
        username: 'testuser',
        password: 'Test123!@#',
        email: 'test@example.com',
        role: 'student',
        name: '测试用户'
      };

      // 先创建一个用户
      await User.create(userData);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('用户名已存在');
    });

    it('应该验证密码强度', async () => {
      const userData = {
        username: 'testuser',
        password: 'weak',
        email: 'test@example.com',
        role: 'student',
        name: '测试用户'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('密码不符合安全要求');
    });
  });

  // 测试登录功能
  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // 创建一个测试用户
      await User.create({
        username: 'testuser',
        password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // Test123!@#
        email: 'test@example.com',
        role: 'student',
        name: '测试用户'
      });
    });

    it('应该成功登录', async () => {
      const loginData = {
        username: 'testuser',
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

  // 新增：邮箱/手机号登录测试
  describe('POST /api/auth/login-email-phone', () => {
    beforeEach(async () => {
      // 创建邮箱用户
      await User.create({
        username: 'emailuser',
        password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // Test123!@#
        email: 'email@example.com',
        role: 'student',
        name: '邮箱用户'
      });

      // 创建手机号用户
      await User.create({
        username: 'phoneuser',
        password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // Test123!@#
        phone: '13800138000',
        role: 'student',
        name: '手机号用户'
      });

      // 创建混合用户
      await User.create({
        username: 'mixeduser',
        password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // Test123!@#
        email: 'mixed@example.com',
        phone: '13900139000',
        role: 'student',
        name: '混合用户'
      });
    });

    it('应该成功使用邮箱登录', async () => {
      const loginData = {
        identifier: 'email@example.com',
        password: 'Test123!@#'
      };

      const response = await request(app)
        .post('/api/auth/login-email-phone')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe(loginData.identifier);
      expect(response.body.data.user.username).toBe('emailuser');
    });

    it('应该成功使用手机号登录', async () => {
      const loginData = {
        identifier: '13800138000',
        password: 'Test123!@#'
      };

      const response = await request(app)
        .post('/api/auth/login-email-phone')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.phone).toBe(loginData.identifier);
      expect(response.body.data.user.username).toBe('phoneuser');
    });

    it('应该成功使用混合用户的邮箱登录', async () => {
      const loginData = {
        identifier: 'mixed@example.com',
        password: 'Test123!@#'
      };

      const response = await request(app)
        .post('/api/auth/login-email-phone')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe(loginData.identifier);
      expect(response.body.data.user.username).toBe('mixeduser');
    });

    it('应该成功使用混合用户的手机号登录', async () => {
      const loginData = {
        identifier: '13900139000',
        password: 'Test123!@#'
      };

      const response = await request(app)
        .post('/api/auth/login-email-phone')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.phone).toBe(loginData.identifier);
      expect(response.body.data.user.username).toBe('mixeduser');
    });

    it('应该拒绝错误的密码', async () => {
      const loginData = {
        identifier: 'email@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login-email-phone')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('邮箱/手机号或密码错误');
    });

    it('应该拒绝不存在的邮箱', async () => {
      const loginData = {
        identifier: 'notexist@example.com',
        password: 'Test123!@#'
      };

      const response = await request(app)
        .post('/api/auth/login-email-phone')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('邮箱/手机号或密码错误');
    });

    it('应该拒绝不存在的手机号', async () => {
      const loginData = {
        identifier: '13700137000',
        password: 'Test123!@#'
      };

      const response = await request(app)
        .post('/api/auth/login-email-phone')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('邮箱/手机号或密码错误');
    });

    it('应该拒绝无效格式的标识符', async () => {
      const loginData = {
        identifier: 'invalid-identifier',
        password: 'Test123!@#'
      };

      const response = await request(app)
        .post('/api/auth/login-email-phone')
        .send(loginData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });

  // 测试修改密码功能
  describe('PUT /api/auth/password', () => {
    let token;

    beforeEach(async () => {
      // 创建一个测试用户并获取token
      const user = await User.create({
        username: 'testuser',
        password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // Test123!@#
        email: 'test@example.com',
        role: 'student',
        name: '测试用户'
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'Test123!@#'
        });

      token = loginResponse.body.data.token;
    });

    it('应该成功修改密码', async () => {
      const passwordData = {
        oldPassword: 'Test123!@#',
        newPassword: 'NewTest123!@#'
      };

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send(passwordData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('密码修改成功');
    });

    it('应该验证新密码强度', async () => {
      const passwordData = {
        oldPassword: 'Test123!@#',
        newPassword: 'weak'
      };

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send(passwordData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('密码不符合安全要求');
    });

    it('应该验证旧密码', async () => {
      const passwordData = {
        oldPassword: 'wrongpassword',
        newPassword: 'NewTest123!@#'
      };

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send(passwordData);

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('旧密码错误');
    });
  });
}); 
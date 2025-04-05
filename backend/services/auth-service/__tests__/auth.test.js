const request = require('supertest');
const app = require('../../../common/app');
const User = require('../../../common/models/User');

describe('认证服务测试', () => {
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
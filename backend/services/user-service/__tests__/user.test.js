const request = require('supertest');
const app = require('../../../common/app');
const User = require('../../../common/models/User');

describe('用户服务测试', () => {
  let adminToken;
  let teacherToken;
  let studentToken;
  let adminUser;
  let teacherUser;
  let studentUser;
  let userId;

  beforeEach(async () => {
    // 创建测试用户
    adminUser = await User.create({
      username: 'testadmin',
      password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // Test123!@#
      email: 'admin@example.com',
      role: 'admin',
      name: '测试管理员'
    });

    teacherUser = await User.create({
      username: 'testteacher',
      password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // Test123!@#
      email: 'teacher@example.com',
      role: 'teacher',
      name: '测试教师'
    });

    studentUser = await User.create({
      username: 'teststudent',
      password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // Test123!@#
      email: 'student@example.com',
      role: 'student',
      name: '测试学生'
    });

    // 获取token
    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testadmin',
        password: 'Test123!@#'
      });

    adminToken = adminLoginResponse.body.data.token;

    const teacherLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testteacher',
        password: 'Test123!@#'
      });

    teacherToken = teacherLoginResponse.body.data.token;

    const studentLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'teststudent',
        password: 'Test123!@#'
      });

    studentToken = studentLoginResponse.body.data.token;

    // 创建一个测试用户用于测试
    const user = await User.create({
      username: 'testuser',
      password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // Test123!@#
      email: 'user@example.com',
      role: 'student',
      name: '测试用户'
    });

    userId = user._id;
  });

  afterEach(async () => {
    // 清理测试数据
    await User.deleteMany({});
  });

  // 测试获取用户列表
  describe('GET /api/users', () => {
    it('管理员应该能够获取所有用户列表', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.users.length).toBeGreaterThan(3); // 至少有4个测试用户
    });

    it('教师应该能够获取学生用户列表', async () => {
      const response = await request(app)
        .get('/api/users?role=student')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.users.length).toBeGreaterThan(1); // 至少有2个学生用户
      
      // 验证只返回学生用户
      response.body.data.users.forEach(user => {
        expect(user.role).toBe('student');
      });
    });

    it('学生不应该能够获取用户列表', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
    });
  });

  // 测试获取用户详情
  describe('GET /api/users/:userId', () => {
    it('管理员应该能够获取任何用户的详情', async () => {
      const response = await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user._id.toString()).toBe(userId.toString());
      expect(response.body.data.user.username).toBe('testuser');
    });

    it('用户应该能够获取自己的详情', async () => {
      const response = await request(app)
        .get(`/api/users/${studentUser._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user._id.toString()).toBe(studentUser._id.toString());
      expect(response.body.data.user.username).toBe('teststudent');
    });

    it('用户不应该能够获取其他用户的详情', async () => {
      const response = await request(app)
        .get(`/api/users/${teacherUser._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
    });

    it('应该处理无效的用户ID', async () => {
      const invalidId = '60f1a5c5f0e8e82b8c9e1234'; // 有效但不存在的ID

      const response = await request(app)
        .get(`/api/users/${invalidId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
    });
  });

  // 测试创建用户
  describe('POST /api/users', () => {
    it('管理员应该能够创建新用户', async () => {
      const userData = {
        username: 'newuser',
        password: 'Test123!@#',
        email: 'newuser@example.com',
        role: 'teacher',
        name: '新用户'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.role).toBe(userData.role);
    });

    it('非管理员不应该能够创建用户', async () => {
      const userData = {
        username: 'newuser',
        password: 'Test123!@#',
        email: 'newuser@example.com',
        role: 'student',
        name: '新用户'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(userData);

      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
    });

    it('应该验证用户数据的完整性', async () => {
      const invalidUserData = {
        // 缺少必要字段
        username: 'newuser'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidUserData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });

  // 测试更新用户
  describe('PATCH /api/users/:userId', () => {
    it('管理员应该能够更新任何用户', async () => {
      const updateData = {
        name: '更新的用户名',
        email: 'updated@example.com'
      };

      const response = await request(app)
        .patch(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user.name).toBe(updateData.name);
      expect(response.body.data.user.email).toBe(updateData.email);
    });

    it('用户应该能够更新自己的信息', async () => {
      const updateData = {
        name: '更新的学生名',
        email: 'updatedstudent@example.com'
      };

      const response = await request(app)
        .patch(`/api/users/${studentUser._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user.name).toBe(updateData.name);
      expect(response.body.data.user.email).toBe(updateData.email);
    });

    it('用户不应该能够更新其他用户的信息', async () => {
      const updateData = {
        name: '尝试更新',
        email: 'try@example.com'
      };

      const response = await request(app)
        .patch(`/api/users/${teacherUser._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
    });

    it('用户不应该能够更新自己的角色', async () => {
      const updateData = {
        role: 'admin' // 尝试提升自己的权限
      };

      const response = await request(app)
        .patch(`/api/users/${studentUser._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });

  // 测试删除用户
  describe('DELETE /api/users/:userId', () => {
    it('管理员应该能够删除用户', async () => {
      const response = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');

      // 验证用户已被删除
      const deletedUser = await User.findById(userId);
      expect(deletedUser).toBeNull();
    });

    it('非管理员不应该能够删除用户', async () => {
      const response = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');

      // 验证用户未被删除
      const user = await User.findById(userId);
      expect(user).not.toBeNull();
    });
  });

  // 测试修改密码
  describe('POST /api/users/:userId/change-password', () => {
    it('用户应该能够修改自己的密码', async () => {
      const passwordData = {
        currentPassword: 'Test123!@#',
        newPassword: 'NewTest456!@#'
      };

      const response = await request(app)
        .post(`/api/users/${studentUser._id}/change-password`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(passwordData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');

      // 验证可以使用新密码登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'teststudent',
          password: 'NewTest456!@#'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.status).toBe('success');
    });

    it('应该验证当前密码是否正确', async () => {
      const passwordData = {
        currentPassword: 'WrongPassword',
        newPassword: 'NewTest456!@#'
      };

      const response = await request(app)
        .post(`/api/users/${studentUser._id}/change-password`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(passwordData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('当前密码不正确');
    });

    it('应该验证新密码的强度', async () => {
      const passwordData = {
        currentPassword: 'Test123!@#',
        newPassword: 'weak'
      };

      const response = await request(app)
        .post(`/api/users/${studentUser._id}/change-password`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(passwordData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('密码不符合安全要求');
    });
  });
});
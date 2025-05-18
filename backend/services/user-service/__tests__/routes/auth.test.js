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
const app = require('../../server'); // 使用 user-service 自己的 app

// 创建一个简单的Express应用用于测试
const appForTests = express();
appForTests.use(express.json());
appForTests.use('/api/auth', authRoutes);

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

  // 确保必要的角色存在
  const rolesToEnsure = ['student', 'teacher', 'admin', 'superadmin'];
  for (const roleName of rolesToEnsure) {
    const roleExists = await Role.findOne({ name: roleName });
    if (!roleExists) {
      await new Role({ name: roleName, description: `${roleName} role` }).save();
    }
  }
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

describe('认证 API 测试 (/api/auth)', () => {
  const baseUserData = {
    name: 'Auth Test User',
    username: 'auth_test_user',
    password: 'Password123!',
    email: 'auth_test@example.com',
  };

  describe('POST /api/auth/register', () => {
    it('应该成功注册新用户 (学生)', async () => {
      const studentData = {
        ...baseUserData,
        role: 'student',
        grade: '七年级',
        studentClass: '3班',
        studentIdNumber: 'S73001'
      };
      const response = await request(appForTests)
        .post('/api/auth/register')
        .send(studentData);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user.username).toBe(studentData.username);
      expect(response.body.data.user.email).toBe(studentData.email);
      expect(response.body.data.user.role).toBe('student');
      expect(response.body.data.token).toBeDefined();

      const dbUser = await User.findOne({ username: studentData.username });
      expect(dbUser).toBeDefined();
      expect(dbUser.grade).toBe(studentData.grade);
    });

    it('注册时用户名已存在应该失败', async () => {
      await new User({ ...baseUserData, role: 'student', grade:'级', studentClass: '班' }).save(); // 先注册一个用户
      const response = await request(appForTests)
        .post('/api/auth/register')
        .send({ ...baseUserData, email: 'new_email@example.com', role: 'teacher' });
      
      expect(response.status).toBe(400); // 或者 409 Conflict，取决于API设计
      expect(response.body.status).toBe('fail'); // 或 'error'
      expect(response.body.message).toMatch(/username already exists/i);
    });

    it('注册时邮箱已存在应该失败', async () => {
      await new User({ ...baseUserData, username: 'new_user_for_email_test', role: 'student', grade:'级', studentClass: '班' }).save();
      const response = await request(appForTests)
        .post('/api/auth/register')
        .send({ ...baseUserData, username: 'another_new_user', role: 'teacher' });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/email already exists/i);
    });

    // 根据 authValidators.js 中的规则添加更多验证失败的测试
    it('注册时密码太短应该失败', async () => {
      const response = await request(appForTests)
        .post('/api/auth/register')
        .send({ ...baseUserData, role: 'student', password: '123' });
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      const passwordError = response.body.errors.find(e => e.path === 'password');
      expect(passwordError).toBeDefined();
    });

    it('注册时缺少必填字段 (如username) 应该失败', async () => {
        const incompleteData = { ...baseUserData, role: 'student' };
        delete incompleteData.username;
        const response = await request(appForTests)
            .post('/api/auth/register')
            .send(incompleteData);
        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        const usernameError = response.body.errors.find(e => e.path === 'username');
        expect(usernameError).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // 创建一个用户用于登录测试
      const user = new User({ ...baseUserData, role: 'teacher' });
      await user.save(); // pre-save hook will hash password
    });

    it('应该成功登录并返回token', async () => {
      const response = await request(appForTests)
        .post('/api/auth/login')
        .send({ username: baseUserData.username, password: baseUserData.password });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.username).toBe(baseUserData.username);
    });

    it('使用错误密码登录应该失败', async () => {
      const response = await request(appForTests)
        .post('/api/auth/login')
        .send({ username: baseUserData.username, password: 'wrongpassword' });
      expect(response.status).toBe(401);
      expect(response.body.message).toMatch(/Invalid credentials|用户名或密码错误/i);
    });

    it('使用不存在的用户名登录应该失败', async () => {
      const response = await request(appForTests)
        .post('/api/auth/login')
        .send({ username: 'nonexistentuser', password: baseUserData.password });
      expect(response.status).toBe(401);
    });

    it('登录时缺少用户名应验证失败', async () => {
      const response = await request(appForTests)
        .post('/api/auth/login')
        .send({ password: baseUserData.password });
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/auth/change-password', () => {
    let userToken;
    let createdUserId;
    const oldPassword = 'OldPassword123!';
    const newPassword = 'NewPassword456!';

    beforeEach(async () => {
      const userToChangePass = await User.create({
        ...baseUserData,
        username: 'user_change_pass',
        email: 'user_change_pass@example.com',
        password: oldPassword,
        role: 'student',
        grade:'级', studentClass: '班'
      });
      createdUserId = userToChangePass._id;

      const loginResponse = await request(appForTests)
        .post('/api/auth/login')
        .send({ username: 'user_change_pass', password: oldPassword });
      userToken = loginResponse.body.data.token;
    });

    it('应该成功修改密码', async () => {
      const response = await request(appForTests)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ oldPassword: oldPassword, newPassword: newPassword, confirmPassword: newPassword });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toMatch(/Password changed successfully/i);

      // 验证新密码可以用于登录
      const loginWithNewPass = await request(appForTests)
        .post('/api/auth/login')
        .send({ username: 'user_change_pass', password: newPassword });
      expect(loginWithNewPass.status).toBe(200);
      expect(loginWithNewPass.body.data.token).toBeDefined();
    });

    it('使用错误的旧密码修改密码应该失败', async () => {
      const response = await request(appForTests)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ oldPassword: 'wrongoldpassword', newPassword: newPassword, confirmPassword: newPassword });
      expect(response.status).toBe(401); // 或者 400
      expect(response.body.message).toMatch(/Incorrect old password/i);
    });

    it('新密码与确认密码不匹配时应该失败', async () => {
      const response = await request(appForTests)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ oldPassword: oldPassword, newPassword: newPassword, confirmPassword: 'doesnotmatch' });
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined(); // 期望验证器返回错误
      const confirmPasswordError = response.body.errors.find(e => e.path === 'confirmPassword');
      expect(confirmPasswordError).toBeDefined();
    });

    it('未经认证的用户修改密码应该失败', async () => {
      const response = await request(appForTests)
        .post('/api/auth/change-password')
        .send({ oldPassword: oldPassword, newPassword: newPassword, confirmPassword: newPassword });
      expect(response.status).toBe(401); // Unauthorized
    });
  });
});

/**
 * 中间件集成测试
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// 导入中间件
const { authenticateToken, checkRole } = require('../middleware/auth');

describe('中间件集成测试', () => {
  let app;

  beforeEach(() => {
    // 创建一个新的Express应用
    app = express();

    // 设置JWT密钥
    process.env.JWT_SECRET = 'test-secret-key';
  });

  afterEach(() => {
    // 清除环境变量
    delete process.env.JWT_SECRET;
  });

  describe('authenticateToken中间件', () => {
    beforeEach(() => {
      // 添加authenticateToken中间件
      app.use(authenticateToken);

      // 添加一个测试路由
      app.get('/protected', (req, res) => {
        res.json({ user: req.user });
      });
    });

    it('应该在没有提供令牌时返回401错误', async () => {
      const response = await request(app).get('/protected');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未认证');
    });

    it('应该在提供无效令牌时返回403错误', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '令牌无效或已过期');
    });

    it('应该在提供有效令牌时设置用户信息并允许访问', async () => {
      // 创建一个有效的JWT令牌
      const user = { id: '123', username: 'testuser', role: 'teacher' };
      const token = jwt.sign(user, process.env.JWT_SECRET);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', user.id);
      expect(response.body.user).toHaveProperty('username', user.username);
      expect(response.body.user).toHaveProperty('role', user.role);
    });
  });

  describe('checkRole中间件', () => {
    beforeEach(() => {
      // 添加authenticateToken中间件
      app.use((req, res, next) => {
        // 模拟authenticateToken中间件的行为
        const authHeader = req.headers['authorization'];
        if (!authHeader) return res.status(401).json({ message: '未认证' });

        const token = authHeader.split(' ')[1];
        try {
          const user = jwt.verify(token, process.env.JWT_SECRET);
          req.user = user;
          next();
        } catch (err) {
          return res.status(403).json({ message: '令牌无效或已过期' });
        }
      });

      // 添加一个需要教师角色的路由
      app.get('/teacher-only', checkRole(['teacher', 'admin']), (req, res) => {
        res.json({ message: '教师专属内容' });
      });

      // 添加一个需要管理员角色的路由
      app.get('/admin-only', checkRole(['admin']), (req, res) => {
        res.json({ message: '管理员专属内容' });
      });
    });

    it('应该允许具有正确角色的用户访问', async () => {
      // 创建一个教师用户的JWT令牌
      const teacherUser = { id: '123', username: 'teacher', role: 'teacher' };
      const teacherToken = jwt.sign(teacherUser, process.env.JWT_SECRET);

      const response = await request(app)
        .get('/teacher-only')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '教师专属内容');
    });

    it('应该拒绝没有正确角色的用户访问', async () => {
      // 创建一个学生用户的JWT令牌
      const studentUser = { id: '456', username: 'student', role: 'student' };
      const studentToken = jwt.sign(studentUser, process.env.JWT_SECRET);

      const response = await request(app)
        .get('/teacher-only')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');
    });

    it('应该允许具有多个允许角色之一的用户访问', async () => {
      // 创建一个管理员用户的JWT令牌
      const adminUser = { id: '789', username: 'admin', role: 'admin' };
      const adminToken = jwt.sign(adminUser, process.env.JWT_SECRET);

      const response = await request(app)
        .get('/teacher-only') // 这个路由允许教师和管理员
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '教师专属内容');
    });

    it('应该拒绝未认证的用户访问', async () => {
      const response = await request(app).get('/teacher-only');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未认证');
    });
  });
});

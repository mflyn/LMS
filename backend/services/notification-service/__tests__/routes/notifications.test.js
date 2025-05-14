const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const notificationsRouter = require('../../routes/notifications');
const Notification = require('../../models/Notification');

// 增加超时时间
jest.setTimeout(60000);

// 设置测试环境
process.env.NODE_ENV = 'test';

// 创建测试应用
const app = express();
app.use(express.json());

// 模拟认证中间件
app.use((req, res, next) => {
  // 模拟用户信息
  if (req.headers['x-user-id'] && req.headers['x-user-role']) {
    req.user = {
      id: req.headers['x-user-id'],
      role: req.headers['x-user-role']
    };
  }
  next();
});

app.use('/api/notifications', notificationsRouter);

// 使用内存数据库进行测试
let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('通知路由测试', () => {
  beforeEach(async () => {
    await Notification.deleteMany({});
  });

  describe('GET /api/notifications/user/:userId', () => {
    it('应该返回用户的所有通知', async () => {
      const mockUserId = new mongoose.Types.ObjectId();

      // 创建测试数据
      await Notification.create([
        {
          user: mockUserId,
          type: 'info',
          message: '您有一项新的作业需要完成',
          read: false,
          createdAt: new Date()
        },
        {
          user: mockUserId,
          type: 'warning',
          message: '系统将于今晚进行维护',
          read: true,
          createdAt: new Date(Date.now() - 86400000) // 1天前
        }
      ]);

      // 发送请求
      const response = await request(app)
        .get(`/api/notifications/user/${mockUserId}`)
        .set('x-user-id', mockUserId.toString())
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('notifications');
      expect(response.body.notifications).toHaveLength(2);
      expect(response.body.notifications[0].message).toBe('您有一项新的作业需要完成');
      expect(response.body.notifications[1].message).toBe('系统将于今晚进行维护');
    });

    it('管理员应该能够查看任何用户的通知', async () => {
      const mockUserId = new mongoose.Types.ObjectId();
      const mockAdminId = new mongoose.Types.ObjectId();

      // 创建测试数据
      await Notification.create({
        user: mockUserId,
        type: 'info',
        message: '您有一项新的作业需要完成',
        read: false,
        createdAt: new Date()
      });

      // 发送请求
      const response = await request(app)
        .get(`/api/notifications/user/${mockUserId}`)
        .set('x-user-id', mockAdminId.toString())
        .set('x-user-role', 'admin');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('notifications');
      expect(response.body.notifications).toHaveLength(1);
    });

    it('学生不应该能够查看其他学生的通知', async () => {
      const mockUserId1 = new mongoose.Types.ObjectId();
      const mockUserId2 = new mongoose.Types.ObjectId();

      // 创建测试数据
      await Notification.create({
        user: mockUserId1,
        type: 'info',
        message: '您有一项新的作业需要完成',
        read: false,
        createdAt: new Date()
      });

      // 发送请求 - 学生2尝试查看学生1的通知
      const response = await request(app)
        .get(`/api/notifications/user/${mockUserId1}`)
        .set('x-user-id', mockUserId2.toString())
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');
    });
  });

  describe('PUT /api/notifications/:notificationId/read', () => {
    it('应该成功标记通知为已读', async () => {
      const mockUserId = new mongoose.Types.ObjectId();

      // 创建测试数据
      const notification = await Notification.create({
        user: mockUserId,
        type: 'info',
        message: '您有一项新的作业需要完成',
        read: false,
        createdAt: new Date()
      });

      // 发送请求
      const response = await request(app)
        .put(`/api/notifications/${notification._id}/read`)
        .set('x-user-id', mockUserId.toString())
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '通知已标记为已读');
      expect(response.body).toHaveProperty('notification');
      expect(response.body.notification.read).toBe(true);
      expect(response.body.notification.readAt).toBeDefined();

      // 验证数据库中的记录
      const updatedNotification = await Notification.findById(notification._id);
      expect(updatedNotification.read).toBe(true);
      expect(updatedNotification.readAt).toBeDefined();
    });

    it('应该处理通知不存在的情况', async () => {
      const mockUserId = new mongoose.Types.ObjectId();
      const nonExistentId = new mongoose.Types.ObjectId();

      // 发送请求
      const response = await request(app)
        .put(`/api/notifications/${nonExistentId}/read`)
        .set('x-user-id', mockUserId.toString())
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '通知不存在');
    });

    it('用户不应该能够标记其他用户的通知为已读', async () => {
      const mockUserId1 = new mongoose.Types.ObjectId();
      const mockUserId2 = new mongoose.Types.ObjectId();

      // 创建测试数据
      const notification = await Notification.create({
        user: mockUserId1,
        type: 'info',
        message: '您有一项新的作业需要完成',
        read: false,
        createdAt: new Date()
      });

      // 发送请求 - 用户2尝试标记用户1的通知为已读
      const response = await request(app)
        .put(`/api/notifications/${notification._id}/read`)
        .set('x-user-id', mockUserId2.toString())
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');

      // 验证数据库中的记录未更改
      const unchangedNotification = await Notification.findById(notification._id);
      expect(unchangedNotification.read).toBe(false);
      expect(unchangedNotification.readAt).toBeUndefined();
    });
  });

  describe('DELETE /api/notifications/:notificationId', () => {
    it('应该成功删除通知', async () => {
      const mockUserId = new mongoose.Types.ObjectId();

      // 创建测试数据
      const notification = await Notification.create({
        user: mockUserId,
        type: 'info',
        message: '您有一项新的作业需要完成',
        read: false,
        createdAt: new Date()
      });

      // 发送请求
      const response = await request(app)
        .delete(`/api/notifications/${notification._id}`)
        .set('x-user-id', mockUserId.toString())
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '通知已删除');

      // 验证数据库中的记录已删除
      const deletedNotification = await Notification.findById(notification._id);
      expect(deletedNotification).toBeNull();
    });

    it('管理员应该能够删除任何用户的通知', async () => {
      const mockUserId = new mongoose.Types.ObjectId();
      const mockAdminId = new mongoose.Types.ObjectId();

      // 创建测试数据
      const notification = await Notification.create({
        user: mockUserId,
        type: 'info',
        message: '您有一项新的作业需要完成',
        read: false,
        createdAt: new Date()
      });

      // 发送请求
      const response = await request(app)
        .delete(`/api/notifications/${notification._id}`)
        .set('x-user-id', mockAdminId.toString())
        .set('x-user-role', 'admin');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '通知已删除');

      // 验证数据库中的记录已删除
      const deletedNotification = await Notification.findById(notification._id);
      expect(deletedNotification).toBeNull();
    });

    it('用户不应该能够删除其他用户的通知', async () => {
      const mockUserId1 = new mongoose.Types.ObjectId();
      const mockUserId2 = new mongoose.Types.ObjectId();

      // 创建测试数据
      const notification = await Notification.create({
        user: mockUserId1,
        type: 'info',
        message: '您有一项新的作业需要完成',
        read: false,
        createdAt: new Date()
      });

      // 发送请求 - 用户2尝试删除用户1的通知
      const response = await request(app)
        .delete(`/api/notifications/${notification._id}`)
        .set('x-user-id', mockUserId2.toString())
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');

      // 验证数据库中的记录未删除
      const unchangedNotification = await Notification.findById(notification._id);
      expect(unchangedNotification).not.toBeNull();
    });
  });
});

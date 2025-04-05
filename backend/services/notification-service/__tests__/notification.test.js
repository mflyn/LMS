const request = require('supertest');
const app = require('../../../common/app');
const Notification = require('../../../common/models/Notification');
const User = require('../../../common/models/User');

describe('通知服务测试', () => {
  let teacherToken;
  let studentToken;
  let parentToken;
  let teacherUser;
  let studentUser;
  let parentUser;
  let notificationId;

  beforeEach(async () => {
    // 创建测试用户
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

    parentUser = await User.create({
      username: 'testparent',
      password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // Test123!@#
      email: 'parent@example.com',
      role: 'parent',
      name: '测试家长',
      children: [studentUser._id]
    });

    // 获取token
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

    const parentLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testparent',
        password: 'Test123!@#'
      });

    parentToken = parentLoginResponse.body.data.token;

    // 创建一个测试通知
    const notification = await Notification.create({
      title: '作业提醒',
      content: '您有一项数学作业即将到期，请尽快完成',
      type: 'homework',
      sender: teacherUser._id,
      recipients: [studentUser._id],
      relatedResource: '60f1a5c5f0e8e82b8c9e1111', // 假设的作业ID
      status: 'unread',
      priority: 'high',
      scheduledAt: new Date()
    });

    notificationId = notification._id;
  });

  afterEach(async () => {
    // 清理测试数据
    await User.deleteMany({});
    await Notification.deleteMany({});
  });

  // 测试创建通知
  describe('POST /api/notifications', () => {
    it('教师应该能够创建通知', async () => {
      const notificationData = {
        title: '考试通知',
        content: '下周一将进行期中考试，请做好准备',
        type: 'exam',
        recipients: [studentUser._id],
        priority: 'high',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 明天
      };

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(notificationData);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.notification.title).toBe('考试通知');
      expect(response.body.data.notification.sender.toString()).toBe(teacherUser._id.toString());
    });

    it('学生不应该能够创建系统通知', async () => {
      const notificationData = {
        title: '考试通知',
        content: '下周一将进行期中考试，请做好准备',
        type: 'exam',
        recipients: [studentUser._id],
        priority: 'high'
      };

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(notificationData);

      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
    });

    it('应该验证通知数据的完整性', async () => {
      const invalidNotificationData = {
        // 缺少必要字段
        title: '考试通知'
      };

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(invalidNotificationData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });

  // 测试获取通知列表
  describe('GET /api/notifications', () => {
    it('用户应该能够获取自己的通知列表', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.notifications.length).toBeGreaterThan(0);
      expect(response.body.data.notifications[0].title).toBe('作业提醒');
    });

    it('家长应该能够获取孩子的通知列表', async () => {
      const response = await request(app)
        .get(`/api/notifications/student/${studentUser._id}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.notifications.length).toBeGreaterThan(0);
    });

    it('应该能够筛选未读通知', async () => {
      const response = await request(app)
        .get('/api/notifications?status=unread')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.notifications.length).toBeGreaterThan(0);
      expect(response.body.data.notifications[0].status).toBe('unread');
    });
  });

  // 测试获取通知详情
  describe('GET /api/notifications/:notificationId', () => {
    it('用户应该能够获取通知详情', async () => {
      const response = await request(app)
        .get(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.notification._id.toString()).toBe(notificationId.toString());
      expect(response.body.data.notification.title).toBe('作业提醒');
    });

    it('用户不应该能够获取不属于自己的通知', async () => {
      // 创建一个不属于当前学生的通知
      const anotherStudent = await User.create({
        username: 'anotherstudent',
        password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        email: 'another@example.com',
        role: 'student',
        name: '另一个学生'
      });

      const anotherNotification = await Notification.create({
        title: '另一个通知',
        content: '这是另一个学生的通知',
        type: 'general',
        sender: teacherUser._id,
        recipients: [anotherStudent._id],
        status: 'unread'
      });

      const response = await request(app)
        .get(`/api/notifications/${anotherNotification._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
    });
  });

  // 测试标记通知为已读
  describe('PATCH /api/notifications/:notificationId/read', () => {
    it('用户应该能够将通知标记为已读', async () => {
      const response = await request(app)
        .patch(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.notification.status).toBe('read');

      // 验证通知状态已更新
      const updatedNotification = await Notification.findById(notificationId);
      expect(updatedNotification.status).toBe('read');
    });
  });

  // 测试批量标记通知为已读
  describe('PATCH /api/notifications/read-all', () => {
    it('用户应该能够批量将通知标记为已读', async () => {
      // 创建多个通知
      await Notification.create([
        {
          title: '通知1',
          content: '通知内容1',
          type: 'general',
          sender: teacherUser._id,
          recipients: [studentUser._id],
          status: 'unread'
        },
        {
          title: '通知2',
          content: '通知内容2',
          type: 'general',
          sender: teacherUser._id,
          recipients: [studentUser._id],
          status: 'unread'
        }
      ]);

      const response = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');

      // 验证所有通知都已标记为已读
      const unreadNotifications = await Notification.find({
        recipients: studentUser._id,
        status: 'unread'
      });

      expect(unreadNotifications.length).toBe(0);
    });
  });

  // 测试删除通知
  describe('DELETE /api/notifications/:notificationId', () => {
    it('用户应该能够删除自己的通知', async () => {
      const response = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');

      // 验证通知已被删除
      const deletedNotification = await Notification.findById(notificationId);
      expect(deletedNotification).toBeNull();
    });

    it('用户不应该能够删除不属于自己的通知', async () => {
      // 创建一个不属于当前学生的通知
      const anotherStudent = await User.create({
        username: 'anotherstudent',
        password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        email: 'another@example.com',
        role: 'student',
        name: '另一个学生'
      });

      const anotherNotification = await Notification.create({
        title: '另一个通知',
        content: '这是另一个学生的通知',
        type: 'general',
        sender: teacherUser._id,
        recipients: [anotherStudent._id],
        status: 'unread'
      });

      const response = await request(app)
        .delete(`/api/notifications/${anotherNotification._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');

      // 验证通知未被删除
      const notification = await Notification.findById(anotherNotification._id);
      expect(notification).not.toBeNull();
    });
  });
});
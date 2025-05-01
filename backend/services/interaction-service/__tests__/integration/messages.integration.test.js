/**
 * 消息路由集成测试
 */

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { connect, closeDatabase, clearDatabase } = require('../test-utils/db-handler');
const app = require('../../server');
const Message = require('../../models/Message');

// 创建测试用户
const testUsers = {
  teacher: {
    _id: new mongoose.Types.ObjectId(),
    name: '李老师',
    role: 'teacher'
  },
  parent: {
    _id: new mongoose.Types.ObjectId(),
    name: '张爸爸',
    role: 'parent'
  },
  student: {
    _id: new mongoose.Types.ObjectId(),
    name: '张小明',
    role: 'student'
  }
};

// 创建测试令牌
const createToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

describe('消息路由集成测试', () => {
  let mongoServer;
  let teacherToken, parentToken;
  let testMessages = [];

  beforeAll(async () => {
    // 连接到内存数据库
    await connect();

    // 创建测试令牌
    teacherToken = createToken(testUsers.teacher);
    parentToken = createToken(testUsers.parent);

    // 创建测试消息
    const messages = [
      {
        sender: testUsers.teacher._id,
        receiver: testUsers.parent._id,
        content: '您好，关于张小明的学习情况，我们需要进行一次交流。',
        read: false
      },
      {
        sender: testUsers.parent._id,
        receiver: testUsers.teacher._id,
        content: '好的，李老师，什么时候方便？',
        read: true
      },
      {
        sender: testUsers.teacher._id,
        receiver: testUsers.parent._id,
        content: '周四下午3点如何？',
        read: false
      }
    ];

    testMessages = await Message.insertMany(messages);
  });

  afterAll(async () => {
    // 断开数据库连接
    await closeDatabase();
  });

  beforeEach(async () => {
    // 清空数据库集合
    // 注意：我们不在这里清空数据库，因为我们需要保留测试消息
    // 如果需要清空数据库，可以使用 await clearDatabase();
  });

  describe('GET /api/interaction/messages', () => {
    it('未认证用户应该返回401错误', async () => {
      const response = await request(app)
        .get('/api/interaction/messages');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未认证');
    });

    it('认证用户应该能获取消息列表', async () => {
      const response = await request(app)
        .get('/api/interaction/messages')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('应该能根据发送者和接收者过滤消息', async () => {
      const response = await request(app)
        .get('/api/interaction/messages')
        .query({
          sender: testUsers.teacher._id.toString(),
          receiver: testUsers.parent._id.toString()
        })
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(2);
      expect(response.body.data[0].sender.toString()).toBe(testUsers.teacher._id.toString());
      expect(response.body.data[0].receiver.toString()).toBe(testUsers.parent._id.toString());
    });
  });

  describe('GET /api/interaction/messages/:id', () => {
    it('应该能获取单个消息', async () => {
      const messageId = testMessages[0]._id;

      const response = await request(app)
        .get(`/api/interaction/messages/${messageId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', messageId.toString());
      expect(response.body).toHaveProperty('content', testMessages[0].content);
    });

    it('不存在的消息ID应该返回404错误', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/interaction/messages/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '消息不存在');
    });
  });

  describe('POST /api/interaction/messages', () => {
    it('应该能成功发送消息', async () => {
      const newMessage = {
        sender: testUsers.teacher._id.toString(),
        receiver: testUsers.parent._id.toString(),
        content: '这是一条测试消息'
      };

      const response = await request(app)
        .post('/api/interaction/messages')
        .send(newMessage)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('content', newMessage.content);
      expect(response.body).toHaveProperty('sender', newMessage.sender);
      expect(response.body).toHaveProperty('receiver', newMessage.receiver);
      expect(response.body).toHaveProperty('read', false);

      // 验证消息已保存到数据库
      const savedMessage = await Message.findById(response.body._id);
      expect(savedMessage).not.toBeNull();
      expect(savedMessage.content).toBe(newMessage.content);
    });

    it('缺少必要字段应该返回400错误', async () => {
      const invalidMessage = {
        // 缺少sender
        receiver: testUsers.parent._id.toString(),
        content: '这是一条测试消息'
      };

      const response = await request(app)
        .post('/api/interaction/messages')
        .send(invalidMessage)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '发送者、接收者和内容不能为空');
    });
  });

  describe('PUT /api/interaction/messages/:id/read', () => {
    it('应该能将消息标记为已读', async () => {
      // 找到一条未读消息
      const unreadMessage = testMessages.find(msg => !msg.read);

      const response = await request(app)
        .put(`/api/interaction/messages/${unreadMessage._id}/read`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('read', true);

      // 验证数据库中的消息已更新
      const updatedMessage = await Message.findById(unreadMessage._id);
      expect(updatedMessage.read).toBe(true);
    });

    it('不存在的消息ID应该返回404错误', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .put(`/api/interaction/messages/${nonExistentId}/read`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '消息不存在');
    });
  });

  describe('DELETE /api/interaction/messages/:id', () => {
    it('应该能删除消息', async () => {
      // 创建一条新消息用于删除测试
      const messageToDelete = await Message.create({
        sender: testUsers.teacher._id,
        receiver: testUsers.parent._id,
        content: '这条消息将被删除',
        read: false
      });

      const response = await request(app)
        .delete(`/api/interaction/messages/${messageToDelete._id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '消息已删除');

      // 验证消息已从数据库中删除
      const deletedMessage = await Message.findById(messageToDelete._id);
      expect(deletedMessage).toBeNull();
    });

    it('不存在的消息ID应该返回404错误', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/interaction/messages/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '消息不存在');
    });
  });

  describe('GET /api/interaction/messages/stats/unread', () => {
    it('应该返回未读消息数量', async () => {
      const response = await request(app)
        .get('/api/interaction/messages/stats/unread')
        .query({ userId: testUsers.parent._id.toString() })
        .set('Authorization', `Bearer ${parentToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('unreadCount');
      expect(typeof response.body.unreadCount).toBe('number');

      // 验证未读消息数量
      const unreadCount = await Message.countDocuments({
        receiver: testUsers.parent._id,
        read: false
      });
      expect(response.body.unreadCount).toBe(unreadCount);
    });

    it('缺少userId参数应该返回400错误', async () => {
      const response = await request(app)
        .get('/api/interaction/messages/stats/unread')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '用户ID不能为空');
    });
  });
});

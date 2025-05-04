/**
 * 消息路由基础测试
 * 专注于测试 messages.js 中的基本路由
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Message = require('../../models/Message');
const winston = require('winston');

// 模拟 Message 模型
jest.mock('../../models/Message');

// 模拟 winston 日志
jest.mock('winston', () => ({
  format: {
    timestamp: jest.fn().mockReturnValue({}),
    json: jest.fn().mockReturnValue({}),
    combine: jest.fn().mockReturnValue({})
  },
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }),
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

describe('消息路由基础测试', () => {
  let app;

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();

    // 创建 Express 应用
    app = express();
    app.use(express.json());

    // 导入路由
    const messagesRouter = require('../../routes/messages');
    app.use('/api/interaction/messages', messagesRouter);

    // 模拟 mongoose.Types.ObjectId.isValid
    mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(true) };

    // 设置默认的模拟返回值
    const mockMessages = [
      {
        _id: 'message-id-1',
        sender: 'user-id-1',
        receiver: 'user-id-2',
        content: '测试消息1',
        createdAt: new Date()
      },
      {
        _id: 'message-id-2',
        sender: 'user-id-2',
        receiver: 'user-id-1',
        content: '测试消息2',
        createdAt: new Date()
      }
    ];

    Message.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockMessages)
    });

    Message.countDocuments.mockResolvedValue(2);

    Message.findById.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockMessages[0])
    });
  });

  describe('GET /api/interaction/messages', () => {
    it('应该返回消息列表', async () => {
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages')
        .query({ limit: 10, skip: 0 });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 2);
      expect(response.body.pagination).toHaveProperty('limit', 10);
      expect(response.body.pagination).toHaveProperty('skip', 0);

      // 验证 Message.find 被调用
      expect(Message.find).toHaveBeenCalled();
      expect(Message.countDocuments).toHaveBeenCalled();
    });

    it('应该处理查询参数', async () => {
      // 发送请求
      await request(app)
        .get('/api/interaction/messages')
        .query({
          sender: 'user-id-1',
          receiver: 'user-id-2',
          startDate: '2023-01-01',
          endDate: '2023-12-31',
          limit: 20,
          skip: 10
        });

      // 验证 Message.find 被调用时使用了正确的查询参数
      expect(Message.find).toHaveBeenCalledWith({
        sender: 'user-id-1',
        receiver: 'user-id-2',
        createdAt: {
          $gte: expect.any(Date),
          $lte: expect.any(Date)
        }
      });

      // 验证分页参数
      expect(Message.find().skip).toHaveBeenCalledWith(10);
      expect(Message.find().limit).toHaveBeenCalledWith(20);
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      const originalFind = Message.find;

      // 临时替换 Message.find
      Message.find = jest.fn().mockImplementation(() => {
        throw new Error('查询错误');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages')
        .query({ limit: 10, skip: 0 });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取消息列表失败');
      expect(response.body).toHaveProperty('error', '查询错误');

      // 恢复原始的 Message.find
      Message.find = originalFind;
    });
  });

  describe('GET /api/interaction/messages/:id', () => {
    it('应该返回指定ID的消息', async () => {
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages/message-id-1');

      // 验证响应
      expect(response.status).toBe(200);

      // 验证 Message.findById 被调用
      expect(Message.findById).toHaveBeenCalledWith('message-id-1');
      expect(Message.findById().populate).toHaveBeenCalledTimes(2);
    });

    it('应该处理消息不存在的情况', async () => {
      // 模拟 Message.findById 返回 null
      Message.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null)
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages/non-existent-id');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '消息不存在');
    });

    it('应该处理查询错误', async () => {
      // 模拟 Message.findById 抛出错误
      Message.findById.mockImplementation(() => {
        throw new Error('查询错误');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages/message-id-1');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取消息失败');
      expect(response.body).toHaveProperty('error', '查询错误');
    });
  });

  describe('POST /api/interaction/messages', () => {
    it('应该成功发送消息', async () => {
      // 创建一个带有 _id 的消息对象
      const savedMessage = {
        _id: 'new-message-id',
        sender: 'user-id-1',
        receiver: 'user-id-2',
        content: '新消息',
        attachments: [],
        read: false,
        toJSON: function() {
          return {
            _id: 'new-message-id',
            sender: 'user-id-1',
            receiver: 'user-id-2',
            content: '新消息',
            attachments: [],
            read: false
          };
        }
      };

      // 模拟 Message 构造函数和 save 方法
      const mockSave = jest.fn().mockResolvedValue(savedMessage);
      Message.mockImplementation(() => ({
        sender: 'user-id-1',
        receiver: 'user-id-2',
        content: '新消息',
        attachments: [],
        read: false,
        save: mockSave
      }));

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/messages')
        .send({
          sender: 'user-id-1',
          receiver: 'user-id-2',
          content: '新消息'
        });

      // 验证响应
      expect(response.status).toBe(201);

      // 验证 Message 构造函数被调用
      expect(Message).toHaveBeenCalledWith({
        sender: 'user-id-1',
        receiver: 'user-id-2',
        content: '新消息',
        attachments: [],
        read: false
      });

      // 验证 save 方法被调用
      expect(mockSave).toHaveBeenCalled();
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不提供内容）
      const response1 = await request(app)
        .post('/api/interaction/messages')
        .send({
          sender: 'user-id-1',
          receiver: 'user-id-2'
        });

      // 验证响应
      expect(response1.status).toBe(400);
      expect(response1.body).toHaveProperty('message', '发送者、接收者和内容不能为空');

      // 发送请求（不提供接收者）
      const response2 = await request(app)
        .post('/api/interaction/messages')
        .send({
          sender: 'user-id-1',
          content: '新消息'
        });

      // 验证响应
      expect(response2.status).toBe(400);
      expect(response2.body).toHaveProperty('message', '发送者、接收者和内容不能为空');
    });

    it('应该处理保存错误', async () => {
      // 模拟 Message 构造函数和 save 方法抛出错误
      Message.mockImplementation(() => ({
        sender: 'user-id-1',
        receiver: 'user-id-2',
        content: '新消息',
        attachments: [],
        read: false,
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      }));

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/messages')
        .send({
          sender: 'user-id-1',
          receiver: 'user-id-2',
          content: '新消息'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '发送消息失败');
      expect(response.body).toHaveProperty('error', '保存错误');
    });
  });

  describe('PUT /api/interaction/messages/:id/read', () => {
    it('应该成功标记消息为已读', async () => {
      // 模拟 findByIdAndUpdate 方法
      Message.findByIdAndUpdate.mockResolvedValue({
        _id: 'message-id-1',
        sender: 'user-id-1',
        receiver: 'user-id-2',
        content: '测试消息1',
        read: true
      });

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/messages/message-id-1/read');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('read', true);

      // 验证 findByIdAndUpdate 方法被调用
      expect(Message.findByIdAndUpdate).toHaveBeenCalledWith(
        'message-id-1',
        { read: true },
        { new: true }
      );
    });

    it('应该处理消息不存在的情况', async () => {
      // 模拟 findByIdAndUpdate 方法
      Message.findByIdAndUpdate.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/messages/non-existent-id/read');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '消息不存在');
    });

    it('应该处理更新错误', async () => {
      // 模拟 findByIdAndUpdate 方法
      Message.findByIdAndUpdate.mockRejectedValue(new Error('更新错误'));

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/messages/message-id-1/read');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '标记消息已读失败');
      expect(response.body).toHaveProperty('error', '更新错误');
    });
  });

  describe('DELETE /api/interaction/messages/:id', () => {
    it('应该成功删除消息', async () => {
      // 模拟 findByIdAndDelete 方法
      Message.findByIdAndDelete.mockResolvedValue({
        _id: 'message-id-1',
        sender: 'user-id-1',
        receiver: 'user-id-2',
        content: '测试消息1'
      });

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/messages/message-id-1');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '消息已删除');

      // 验证 findByIdAndDelete 方法被调用
      expect(Message.findByIdAndDelete).toHaveBeenCalledWith('message-id-1');
    });

    it('应该处理消息不存在的情况', async () => {
      // 模拟 findByIdAndDelete 方法
      Message.findByIdAndDelete.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/messages/non-existent-id');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '消息不存在');
    });

    it('应该处理删除错误', async () => {
      // 模拟 findByIdAndDelete 方法
      Message.findByIdAndDelete.mockRejectedValue(new Error('删除错误'));

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/messages/message-id-1');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '删除消息失败');
      expect(response.body).toHaveProperty('error', '删除错误');
    });
  });

  describe('GET /api/interaction/messages/stats/unread', () => {
    it('应该返回未读消息数量', async () => {
      // 模拟 countDocuments 方法
      Message.countDocuments.mockResolvedValue(5);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages/stats/unread')
        .query({ userId: 'user-id-1' });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('unreadCount', 5);

      // 验证 countDocuments 方法被调用
      expect(Message.countDocuments).toHaveBeenCalledWith({
        receiver: 'user-id-1',
        read: false
      });
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不提供用户ID）
      const response = await request(app)
        .get('/api/interaction/messages/stats/unread');

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '用户ID不能为空');
    });

    it('应该处理查询错误', async () => {
      // 模拟 countDocuments 方法
      Message.countDocuments.mockRejectedValue(new Error('查询错误'));

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages/stats/unread')
        .query({ userId: 'user-id-1' });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取未读消息数量失败');
      expect(response.body).toHaveProperty('error', '查询错误');
    });
  });
});

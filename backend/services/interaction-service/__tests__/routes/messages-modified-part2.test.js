/**
 * 消息路由测试 - 修改版（第二部分）
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Message = require('../../models/Message');

// 模拟Message模型
jest.mock('../../models/Message', () => {
  const mockMessageModel = jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue({
      _id: 'new-msg-id',
      sender: 'user1',
      receiver: 'user2',
      content: '测试消息',
      read: false,
      createdAt: new Date()
    })
  }));

  mockMessageModel.find = jest.fn().mockReturnThis();
  mockMessageModel.findById = jest.fn().mockReturnThis();
  mockMessageModel.findByIdAndUpdate = jest.fn().mockReturnThis();
  mockMessageModel.findByIdAndDelete = jest.fn().mockReturnThis();
  mockMessageModel.countDocuments = jest.fn().mockResolvedValue(10);
  mockMessageModel.sort = jest.fn().mockReturnThis();
  mockMessageModel.skip = jest.fn().mockReturnThis();
  mockMessageModel.limit = jest.fn().mockReturnThis();
  mockMessageModel.populate = jest.fn().mockReturnThis();
  mockMessageModel.exec = jest.fn();

  return mockMessageModel;
});

// 模拟winston日志
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

describe('消息路由测试 - 修改版（第二部分）', () => {
  let app;
  let messagesRouter;

  beforeEach(() => {
    // 重置模块缓存
    jest.resetModules();

    // 导入路由
    messagesRouter = require('../../routes/messages');

    // 创建Express应用
    app = express();
    app.use(express.json());

    // 模拟认证中间件
    app.use((req, res, next) => {
      req.user = { id: 'user123', role: 'teacher' };
      next();
    });

    // 使用消息路由
    app.use('/api/interaction/messages', messagesRouter);
  });

  afterEach(() => {
    // 清除所有模拟
    jest.clearAllMocks();
  });

  describe('GET /api/interaction/messages/:id', () => {
    it('应该返回指定ID的消息', async () => {
      // 模拟查询结果
      const mockMessage = {
        _id: 'msg1',
        content: '消息内容',
        sender: { _id: 'user1', name: '发送者', role: 'teacher' },
        receiver: { _id: 'user2', name: '接收者', role: 'student' }
      };

      Message.findById().exec.mockResolvedValue(mockMessage);

      const response = await request(app)
        .get('/api/interaction/messages/msg1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockMessage);
    });

    it('应该处理消息不存在的情况', async () => {
      // 模拟消息不存在
      Message.findById().exec.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/interaction/messages/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '消息不存在');
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Message.findById().exec.mockRejectedValue(new Error('数据库错误'));

      const response = await request(app)
        .get('/api/interaction/messages/msg1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取消息失败');
      expect(response.body).toHaveProperty('error', '数据库错误');
    });
  });

  describe('POST /api/interaction/messages', () => {
    it('应该成功创建新消息', async () => {
      // 模拟请求数据
      const messageData = {
        sender: 'user1',
        receiver: 'user2',
        content: '测试消息',
        attachments: []
      };

      // 模拟保存结果
      const savedMessage = {
        _id: 'new-msg-id',
        ...messageData,
        read: false,
        createdAt: new Date()
      };

      // 设置模拟函数返回值
      const mockSave = jest.fn().mockResolvedValue(savedMessage);
      Message.mockImplementation(() => ({
        save: mockSave,
        ...messageData,
        read: false
      }));

      const response = await request(app)
        .post('/api/interaction/messages')
        .send(messageData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id', 'new-msg-id');
      expect(response.body).toHaveProperty('sender', 'user1');
      expect(response.body).toHaveProperty('receiver', 'user2');
      expect(response.body).toHaveProperty('content', '测试消息');
    });

    it('应该验证必要字段', async () => {
      // 缺少必要字段的请求数据
      const invalidData = {
        // 缺少sender
        receiver: 'user2',
        content: '测试消息'
      };

      const response = await request(app)
        .post('/api/interaction/messages')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '发送者、接收者和内容不能为空');
    });

    it('应该处理保存错误', async () => {
      // 模拟请求数据
      const messageData = {
        sender: 'user1',
        receiver: 'user2',
        content: '测试消息'
      };

      // 模拟保存失败
      const mockSave = jest.fn().mockRejectedValue(new Error('保存失败'));
      Message.mockImplementation(() => ({
        save: mockSave,
        ...messageData,
        read: false
      }));

      const response = await request(app)
        .post('/api/interaction/messages')
        .send(messageData);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '发送消息失败');
      expect(response.body).toHaveProperty('error', '保存失败');
    });
  });
});

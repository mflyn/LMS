/**
 * 消息路由测试 - 修改版（第三部分）
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

describe('消息路由测试 - 修改版（第三部分）', () => {
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

  describe('PUT /api/interaction/messages/:id/read', () => {
    it('应该成功将消息标记为已读', async () => {
      // 模拟更新结果
      const updatedMessage = {
        _id: 'msg1',
        content: '消息内容',
        sender: 'user1',
        receiver: 'user2',
        read: true
      };

      Message.findByIdAndUpdate.mockResolvedValue(updatedMessage);

      const response = await request(app)
        .put('/api/interaction/messages/msg1/read');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedMessage);
    });

    it('应该处理消息不存在的情况', async () => {
      // 模拟消息不存在
      Message.findByIdAndUpdate.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/interaction/messages/nonexistent/read');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '消息不存在');
    });

    it('应该处理更新错误', async () => {
      // 模拟更新错误
      Message.findByIdAndUpdate.mockRejectedValue(new Error('更新失败'));

      const response = await request(app)
        .put('/api/interaction/messages/msg1/read');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '标记消息已读失败');
      expect(response.body).toHaveProperty('error', '更新失败');
    });
  });

  describe('DELETE /api/interaction/messages/:id', () => {
    it('应该成功删除消息', async () => {
      // 模拟删除结果
      const deletedMessage = {
        _id: 'msg1',
        content: '消息内容',
        sender: 'user1',
        receiver: 'user2'
      };

      Message.findByIdAndDelete.mockResolvedValue(deletedMessage);

      const response = await request(app)
        .delete('/api/interaction/messages/msg1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '消息已删除');
    });

    it('应该处理消息不存在的情况', async () => {
      // 模拟消息不存在
      Message.findByIdAndDelete.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/interaction/messages/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '消息不存在');
    });

    it('应该处理删除错误', async () => {
      // 模拟删除错误
      Message.findByIdAndDelete.mockRejectedValue(new Error('删除失败'));

      const response = await request(app)
        .delete('/api/interaction/messages/msg1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '删除消息失败');
      expect(response.body).toHaveProperty('error', '删除失败');
    });
  });
});

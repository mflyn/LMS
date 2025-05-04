const request = require('supertest');
const express = require('express');
const router = require('../../routes/messages');

// 模拟 Message 模型
jest.mock('../../models/Message', () => {
  return {
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    countDocuments: jest.fn()
  };
});

// 模拟 winston 日志
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn()
  };
  
  return {
    createLogger: jest.fn().mockReturnValue(mockLogger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      json: jest.fn()
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    }
  };
});

describe('消息路由 - 删除消息', () => {
  let app;
  const Message = require('../../models/Message');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/messages', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  it('应该成功删除消息', async () => {
    // 模拟数据
    const messageId = 'message-id-1';
    const deletedMessage = {
      _id: messageId,
      sender: 'user-id-1',
      receiver: 'user-id-2',
      content: '测试消息内容',
      attachments: [],
      read: false,
      createdAt: '2025-05-10T10:00:00.000Z'
    };
    
    // 设置模拟函数的返回值
    Message.findByIdAndDelete.mockResolvedValue(deletedMessage);
    
    // 发送请求
    const response = await request(app)
      .delete(`/api/interaction/messages/${messageId}`);
    
    // 验证响应
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', '消息已删除');
    
    // 验证模拟函数被正确调用
    expect(Message.findByIdAndDelete).toHaveBeenCalledWith(messageId);
  });
  
  it('应该处理消息不存在的情况', async () => {
    // 模拟数据
    const messageId = 'non-existent-id';
    
    // 设置模拟函数的返回值
    Message.findByIdAndDelete.mockResolvedValue(null);
    
    // 发送请求
    const response = await request(app)
      .delete(`/api/interaction/messages/${messageId}`);
    
    // 验证响应
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message', '消息不存在');
  });
  
  it('应该处理数据库删除错误', async () => {
    // 模拟数据
    const messageId = 'message-id-1';
    
    // 设置模拟函数抛出错误
    Message.findByIdAndDelete.mockRejectedValue(new Error('数据库删除错误'));
    
    // 发送请求
    const response = await request(app)
      .delete(`/api/interaction/messages/${messageId}`);
    
    // 验证响应
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message', '删除消息失败');
    expect(response.body).toHaveProperty('error', '数据库删除错误');
  });
});

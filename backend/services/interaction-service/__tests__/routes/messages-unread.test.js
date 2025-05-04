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

describe('消息路由 - 获取未读消息数量', () => {
  let app;
  const Message = require('../../models/Message');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/messages', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  it('应该成功获取未读消息数量', async () => {
    // 模拟数据
    const userId = 'user-id-1';
    const unreadCount = 5;
    
    // 设置模拟函数的返回值
    Message.countDocuments.mockResolvedValue(unreadCount);
    
    // 发送请求
    const response = await request(app)
      .get('/api/interaction/messages/stats/unread')
      .query({ userId });
    
    // 验证响应
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('unreadCount', unreadCount);
    
    // 验证模拟函数被正确调用
    expect(Message.countDocuments).toHaveBeenCalledWith({
      receiver: userId,
      read: false
    });
  });
  
  it('应该验证用户ID不能为空', async () => {
    // 发送请求（缺少用户ID）
    const response = await request(app)
      .get('/api/interaction/messages/stats/unread');
    
    // 验证响应
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message', '用户ID不能为空');
    
    // 验证 countDocuments 方法没有被调用
    expect(Message.countDocuments).not.toHaveBeenCalled();
  });
  
  it('应该处理数据库查询错误', async () => {
    // 模拟数据
    const userId = 'user-id-1';
    
    // 设置模拟函数抛出错误
    Message.countDocuments.mockRejectedValue(new Error('数据库查询错误'));
    
    // 发送请求
    const response = await request(app)
      .get('/api/interaction/messages/stats/unread')
      .query({ userId });
    
    // 验证响应
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message', '获取未读消息数量失败');
    expect(response.body).toHaveProperty('error', '数据库查询错误');
  });
});

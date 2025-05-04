const request = require('supertest');
const express = require('express');
const router = require('../../routes/messages');

// 模拟 Message 模型
jest.mock('../../models/Message', () => {
  const mockMessage = jest.fn().mockImplementation(function(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });
  
  // 添加静态方法
  mockMessage.find = jest.fn();
  mockMessage.findById = jest.fn();
  mockMessage.findByIdAndUpdate = jest.fn();
  mockMessage.findByIdAndDelete = jest.fn();
  mockMessage.countDocuments = jest.fn();
  
  return mockMessage;
});

// 模拟 winston 日志记录器
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
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

describe('消息路由测试 - 第四部分', () => {
  let app;
  const Message = require('../../models/Message');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/messages', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  // 测试获取未读消息数量
  describe('GET /api/interaction/messages/stats/unread', () => {
    it('应该成功获取未读消息数量', async () => {
      // 模拟 countDocuments 方法的返回值
      Message.countDocuments.mockResolvedValue(5);
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages/stats/unread')
        .query({ userId: 'user-id-1' });
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('unreadCount', 5);
      
      // 验证 countDocuments 方法被正确调用
      expect(Message.countDocuments).toHaveBeenCalledWith({
        receiver: 'user-id-1',
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
      // 模拟 countDocuments 方法抛出错误
      Message.countDocuments.mockRejectedValue(new Error('数据库查询错误'));
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages/stats/unread')
        .query({ userId: 'user-id-1' });
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取未读消息数量失败');
      expect(response.body).toHaveProperty('error', '数据库查询错误');
      
      // 验证 countDocuments 方法被调用
      expect(Message.countDocuments).toHaveBeenCalled();
    });
  });
});

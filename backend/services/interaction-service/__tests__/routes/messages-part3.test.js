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

describe('消息路由测试 - 第三部分', () => {
  let app;
  const Message = require('../../models/Message');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/messages', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  // 测试标记消息为已读
  describe('PUT /api/interaction/messages/:id/read', () => {
    it('应该成功标记消息为已读', async () => {
      // 模拟数据
      const updatedMessage = {
        _id: 'message-id-1',
        sender: 'sender-id-1',
        receiver: 'receiver-id-1',
        content: '测试消息内容',
        read: true,
        createdAt: new Date()
      };
      
      // 模拟 findByIdAndUpdate 方法的返回值
      Message.findByIdAndUpdate.mockResolvedValue(updatedMessage);
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/messages/message-id-1/read');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', 'message-id-1');
      expect(response.body).toHaveProperty('read', true);
      
      // 验证 findByIdAndUpdate 方法被正确调用
      expect(Message.findByIdAndUpdate).toHaveBeenCalledWith(
        'message-id-1',
        { read: true },
        { new: true }
      );
    });
    
    it('应该处理消息不存在的情况', async () => {
      // 模拟 findByIdAndUpdate 方法的返回值
      Message.findByIdAndUpdate.mockResolvedValue(null);
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/messages/non-existent-id/read');
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '消息不存在');
      
      // 验证 findByIdAndUpdate 方法被正确调用
      expect(Message.findByIdAndUpdate).toHaveBeenCalledWith(
        'non-existent-id',
        { read: true },
        { new: true }
      );
    });
    
    it('应该处理数据库更新错误', async () => {
      // 模拟 findByIdAndUpdate 方法抛出错误
      Message.findByIdAndUpdate.mockRejectedValue(new Error('数据库更新错误'));
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/messages/message-id-1/read');
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '标记消息已读失败');
      expect(response.body).toHaveProperty('error', '数据库更新错误');
      
      // 验证 findByIdAndUpdate 方法被调用
      expect(Message.findByIdAndUpdate).toHaveBeenCalled();
    });
  });
  
  // 测试删除消息
  describe('DELETE /api/interaction/messages/:id', () => {
    it('应该成功删除消息', async () => {
      // 模拟数据
      const deletedMessage = {
        _id: 'message-id-1',
        sender: 'sender-id-1',
        receiver: 'receiver-id-1',
        content: '测试消息内容',
        read: false,
        createdAt: new Date()
      };
      
      // 模拟 findByIdAndDelete 方法的返回值
      Message.findByIdAndDelete.mockResolvedValue(deletedMessage);
      
      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/messages/message-id-1');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '消息已删除');
      
      // 验证 findByIdAndDelete 方法被正确调用
      expect(Message.findByIdAndDelete).toHaveBeenCalledWith('message-id-1');
    });
    
    it('应该处理消息不存在的情况', async () => {
      // 模拟 findByIdAndDelete 方法的返回值
      Message.findByIdAndDelete.mockResolvedValue(null);
      
      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/messages/non-existent-id');
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '消息不存在');
      
      // 验证 findByIdAndDelete 方法被正确调用
      expect(Message.findByIdAndDelete).toHaveBeenCalledWith('non-existent-id');
    });
    
    it('应该处理数据库删除错误', async () => {
      // 模拟 findByIdAndDelete 方法抛出错误
      Message.findByIdAndDelete.mockRejectedValue(new Error('数据库删除错误'));
      
      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/messages/message-id-1');
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '删除消息失败');
      expect(response.body).toHaveProperty('error', '数据库删除错误');
      
      // 验证 findByIdAndDelete 方法被调用
      expect(Message.findByIdAndDelete).toHaveBeenCalled();
    });
  });
});

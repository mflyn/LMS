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

describe('消息路由 - 获取单个消息', () => {
  let app;
  const Message = require('../../models/Message');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/messages', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  it('应该成功获取单个消息', async () => {
    // 模拟数据
    const mockMessage = {
      _id: 'message-id-1',
      sender: { _id: 'user-id-1', name: '用户1', role: 'teacher' },
      receiver: { _id: 'user-id-2', name: '用户2', role: 'parent' },
      content: '测试消息1',
      attachments: [],
      read: false,
      createdAt: '2025-05-10T10:00:00.000Z'
    };
    
    // 设置模拟函数的返回值
    const mockPopulateSender = jest.fn().mockReturnThis();
    const mockPopulateReceiver = jest.fn().mockReturnValue(mockMessage);
    
    Message.findById.mockReturnValue({
      populate: mockPopulateSender
    });
    
    mockPopulateSender.mockReturnValue({
      populate: mockPopulateReceiver
    });
    
    // 发送请求
    const response = await request(app)
      .get('/api/interaction/messages/message-id-1');
    
    // 验证响应
    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockMessage);
    
    // 验证模拟函数被正确调用
    expect(Message.findById).toHaveBeenCalledWith('message-id-1');
    expect(mockPopulateSender).toHaveBeenCalledWith('sender', 'name role');
    expect(mockPopulateReceiver).toHaveBeenCalledWith('receiver', 'name role');
  });
  
  it('应该处理消息不存在的情况', async () => {
    // 设置模拟函数的返回值
    const mockPopulateSender = jest.fn().mockReturnThis();
    const mockPopulateReceiver = jest.fn().mockReturnValue(null);
    
    Message.findById.mockReturnValue({
      populate: mockPopulateSender
    });
    
    mockPopulateSender.mockReturnValue({
      populate: mockPopulateReceiver
    });
    
    // 发送请求
    const response = await request(app)
      .get('/api/interaction/messages/non-existent-id');
    
    // 验证响应
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message', '消息不存在');
  });
  
  it('应该处理数据库查询错误', async () => {
    // 设置模拟函数抛出错误
    Message.findById.mockImplementation(() => {
      throw new Error('数据库查询错误');
    });
    
    // 发送请求
    const response = await request(app)
      .get('/api/interaction/messages/message-id-1');
    
    // 验证响应
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message', '获取消息失败');
    expect(response.body).toHaveProperty('error', '数据库查询错误');
  });
});

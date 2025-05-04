const request = require('supertest');
const express = require('express');
const router = require('../../routes/messages');

// 模拟 Message 模型
jest.mock('../../models/Message', () => {
  const mockMessage = jest.fn().mockImplementation(function(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });
  
  mockMessage.find = jest.fn();
  mockMessage.findById = jest.fn();
  mockMessage.findByIdAndUpdate = jest.fn();
  mockMessage.findByIdAndDelete = jest.fn();
  mockMessage.countDocuments = jest.fn();
  
  return mockMessage;
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

describe('消息路由 - 发送消息', () => {
  let app;
  const Message = require('../../models/Message');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/messages', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  it('应该成功发送消息', async () => {
    // 模拟数据
    const messageData = {
      sender: 'user-id-1',
      receiver: 'user-id-2',
      content: '测试消息内容',
      attachments: ['attachment1.jpg', 'attachment2.pdf']
    };
    
    // 发送请求
    const response = await request(app)
      .post('/api/interaction/messages')
      .send(messageData);
    
    // 验证响应
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('sender', messageData.sender);
    expect(response.body).toHaveProperty('receiver', messageData.receiver);
    expect(response.body).toHaveProperty('content', messageData.content);
    expect(response.body).toHaveProperty('attachments', messageData.attachments);
    expect(response.body).toHaveProperty('read', false);
    
    // 验证 Message 构造函数被正确调用
    expect(Message).toHaveBeenCalledWith({
      sender: messageData.sender,
      receiver: messageData.receiver,
      content: messageData.content,
      attachments: messageData.attachments,
      read: false
    });
    
    // 验证 save 方法被调用
    const mockMessageInstance = Message.mock.instances[0];
    expect(mockMessageInstance.save).toHaveBeenCalled();
  });
  
  it('应该验证必填字段', async () => {
    // 缺少必填字段的数据
    const invalidData = {
      sender: 'user-id-1',
      // 缺少 receiver 和 content
    };
    
    // 发送请求
    const response = await request(app)
      .post('/api/interaction/messages')
      .send(invalidData);
    
    // 验证响应
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message', '发送者、接收者和内容不能为空');
    
    // 验证 Message 构造函数没有被调用
    expect(Message).not.toHaveBeenCalled();
  });
  
  it('应该处理没有附件的情况', async () => {
    // 模拟数据（没有附件）
    const messageData = {
      sender: 'user-id-1',
      receiver: 'user-id-2',
      content: '测试消息内容'
      // 没有 attachments
    };
    
    // 发送请求
    const response = await request(app)
      .post('/api/interaction/messages')
      .send(messageData);
    
    // 验证响应
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('sender', messageData.sender);
    expect(response.body).toHaveProperty('receiver', messageData.receiver);
    expect(response.body).toHaveProperty('content', messageData.content);
    expect(response.body).toHaveProperty('attachments', []);
    expect(response.body).toHaveProperty('read', false);
    
    // 验证 Message 构造函数被正确调用
    expect(Message).toHaveBeenCalledWith({
      sender: messageData.sender,
      receiver: messageData.receiver,
      content: messageData.content,
      attachments: [],
      read: false
    });
  });
  
  it('应该处理数据库保存错误', async () => {
    // 模拟数据
    const messageData = {
      sender: 'user-id-1',
      receiver: 'user-id-2',
      content: '测试消息内容'
    };
    
    // 设置 save 方法抛出错误
    const mockSave = jest.fn().mockRejectedValue(new Error('数据库保存错误'));
    Message.mockImplementation(function(data) {
      Object.assign(this, data);
      this.save = mockSave;
    });
    
    // 发送请求
    const response = await request(app)
      .post('/api/interaction/messages')
      .send(messageData);
    
    // 验证响应
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message', '发送消息失败');
    expect(response.body).toHaveProperty('error', '数据库保存错误');
    
    // 验证 save 方法被调用
    expect(mockSave).toHaveBeenCalled();
  });
});

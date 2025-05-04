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

describe('消息路由测试 - 第二部分', () => {
  let app;
  const Message = require('../../models/Message');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/messages', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  // 测试发送消息
  describe('POST /api/interaction/messages', () => {
    it('应该成功发送消息', async () => {
      // 准备请求数据
      const messageData = {
        sender: 'sender-id-1',
        receiver: 'receiver-id-1',
        content: '测试消息内容',
        attachments: [
          { name: '附件1', url: 'http://example.com/attachment1.pdf' }
        ]
      };
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/messages')
        .send(messageData);
      
      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('sender', 'sender-id-1');
      expect(response.body).toHaveProperty('receiver', 'receiver-id-1');
      expect(response.body).toHaveProperty('content', '测试消息内容');
      expect(response.body).toHaveProperty('attachments');
      expect(response.body.attachments).toHaveLength(1);
      expect(response.body).toHaveProperty('read', false);
      
      // 验证 Message 构造函数被正确调用
      expect(Message).toHaveBeenCalledWith({
        sender: 'sender-id-1',
        receiver: 'receiver-id-1',
        content: '测试消息内容',
        attachments: [
          { name: '附件1', url: 'http://example.com/attachment1.pdf' }
        ],
        read: false
      });
      
      // 验证 save 方法被调用
      const mockMessageInstance = Message.mock.instances[0];
      expect(mockMessageInstance.save).toHaveBeenCalled();
    });
    
    it('应该验证发送者不能为空', async () => {
      // 准备请求数据（缺少发送者）
      const messageData = {
        receiver: 'receiver-id-1',
        content: '测试消息内容'
      };
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/messages')
        .send(messageData);
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '发送者、接收者和内容不能为空');
      
      // 验证 Message 构造函数没有被调用
      expect(Message).not.toHaveBeenCalled();
    });
    
    it('应该验证接收者不能为空', async () => {
      // 准备请求数据（缺少接收者）
      const messageData = {
        sender: 'sender-id-1',
        content: '测试消息内容'
      };
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/messages')
        .send(messageData);
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '发送者、接收者和内容不能为空');
      
      // 验证 Message 构造函数没有被调用
      expect(Message).not.toHaveBeenCalled();
    });
    
    it('应该验证内容不能为空', async () => {
      // 准备请求数据（缺少内容）
      const messageData = {
        sender: 'sender-id-1',
        receiver: 'receiver-id-1'
      };
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/messages')
        .send(messageData);
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '发送者、接收者和内容不能为空');
      
      // 验证 Message 构造函数没有被调用
      expect(Message).not.toHaveBeenCalled();
    });
    
    it('应该处理附件为空数组的情况', async () => {
      // 准备请求数据
      const messageData = {
        sender: 'sender-id-1',
        receiver: 'receiver-id-1',
        content: '测试消息内容',
        attachments: []
      };
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/messages')
        .send(messageData);
      
      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('attachments');
      expect(response.body.attachments).toHaveLength(0);
      
      // 验证 Message 构造函数被正确调用
      expect(Message).toHaveBeenCalledWith({
        sender: 'sender-id-1',
        receiver: 'receiver-id-1',
        content: '测试消息内容',
        attachments: [],
        read: false
      });
    });
    
    it('应该处理附件为undefined的情况', async () => {
      // 准备请求数据
      const messageData = {
        sender: 'sender-id-1',
        receiver: 'receiver-id-1',
        content: '测试消息内容',
        attachments: undefined
      };
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/messages')
        .send(messageData);
      
      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('attachments');
      expect(response.body.attachments).toHaveLength(0);
      
      // 验证 Message 构造函数被正确调用
      expect(Message).toHaveBeenCalledWith({
        sender: 'sender-id-1',
        receiver: 'receiver-id-1',
        content: '测试消息内容',
        attachments: [],
        read: false
      });
    });
    
    it('应该处理保存失败的情况', async () => {
      // 准备请求数据
      const messageData = {
        sender: 'sender-id-1',
        receiver: 'receiver-id-1',
        content: '测试消息内容'
      };
      
      // 模拟 save 方法抛出错误
      const mockSave = jest.fn().mockRejectedValue(new Error('保存失败'));
      Message.mockImplementation(function(data) {
        this.save = mockSave;
        Object.assign(this, data);
        return this;
      });
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/messages')
        .send(messageData);
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '发送消息失败');
      expect(response.body).toHaveProperty('error', '保存失败');
      
      // 验证 save 方法被调用
      expect(mockSave).toHaveBeenCalled();
    });
  });
});

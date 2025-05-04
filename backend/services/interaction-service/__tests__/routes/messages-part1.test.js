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

describe('消息路由测试 - 第一部分', () => {
  let app;
  const Message = require('../../models/Message');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/messages', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  // 测试获取消息列表
  describe('GET /api/interaction/messages', () => {
    it('应该成功获取消息列表', async () => {
      // 模拟数据
      const mockMessages = [
        {
          _id: 'message-id-1',
          sender: { _id: 'sender-id-1', name: '发送者1', role: 'teacher' },
          receiver: { _id: 'receiver-id-1', name: '接收者1', role: 'student' },
          content: '测试消息1',
          read: false,
          createdAt: new Date(),
          attachments: []
        },
        {
          _id: 'message-id-2',
          sender: { _id: 'sender-id-2', name: '发送者2', role: 'teacher' },
          receiver: { _id: 'receiver-id-2', name: '接收者2', role: 'student' },
          content: '测试消息2',
          read: true,
          createdAt: new Date(),
          attachments: []
        }
      ];
      
      // 创建模拟链式调用
      const mockPopulate2 = jest.fn().mockReturnValue(mockMessages);
      const mockPopulate1 = jest.fn().mockReturnValue({ populate: mockPopulate2 });
      const mockLimit = jest.fn().mockReturnValue({ populate: mockPopulate1 });
      const mockSkip = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ skip: mockSkip });
      
      // 设置模拟函数的返回值
      Message.find.mockReturnValue({ sort: mockSort });
      
      // 模拟 countDocuments 方法的返回值
      Message.countDocuments.mockResolvedValue(2);
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages')
        .query({ limit: 20, skip: 0 });
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 2);
      expect(response.body.pagination).toHaveProperty('limit', 20);
      expect(response.body.pagination).toHaveProperty('skip', 0);
      
      // 验证模拟函数被正确调用
      expect(Message.find).toHaveBeenCalledWith({});
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockSkip).toHaveBeenCalledWith(0);
      expect(mockLimit).toHaveBeenCalledWith(20);
      expect(mockPopulate1).toHaveBeenCalledWith('sender', 'name role');
      expect(mockPopulate2).toHaveBeenCalledWith('receiver', 'name role');
      expect(Message.countDocuments).toHaveBeenCalledWith({});
    });
    
    it('应该支持按发送者筛选', async () => {
      // 模拟数据
      const mockMessages = [
        {
          _id: 'message-id-1',
          sender: { _id: 'sender-id-1', name: '发送者1', role: 'teacher' },
          receiver: { _id: 'receiver-id-1', name: '接收者1', role: 'student' },
          content: '测试消息1',
          read: false,
          createdAt: new Date(),
          attachments: []
        }
      ];
      
      // 创建模拟链式调用
      const mockPopulate2 = jest.fn().mockReturnValue(mockMessages);
      const mockPopulate1 = jest.fn().mockReturnValue({ populate: mockPopulate2 });
      const mockLimit = jest.fn().mockReturnValue({ populate: mockPopulate1 });
      const mockSkip = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ skip: mockSkip });
      
      // 设置模拟函数的返回值
      Message.find.mockReturnValue({ sort: mockSort });
      
      // 模拟 countDocuments 方法的返回值
      Message.countDocuments.mockResolvedValue(1);
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages')
        .query({ sender: 'sender-id-1', limit: 20, skip: 0 });
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 1);
      
      // 验证模拟函数被正确调用
      expect(Message.find).toHaveBeenCalledWith({ sender: 'sender-id-1' });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockSkip).toHaveBeenCalledWith(0);
      expect(mockLimit).toHaveBeenCalledWith(20);
      expect(mockPopulate1).toHaveBeenCalledWith('sender', 'name role');
      expect(mockPopulate2).toHaveBeenCalledWith('receiver', 'name role');
      expect(Message.countDocuments).toHaveBeenCalledWith({ sender: 'sender-id-1' });
    });
    
    it('应该支持按接收者筛选', async () => {
      // 模拟数据
      const mockMessages = [
        {
          _id: 'message-id-1',
          sender: { _id: 'sender-id-1', name: '发送者1', role: 'teacher' },
          receiver: { _id: 'receiver-id-1', name: '接收者1', role: 'student' },
          content: '测试消息1',
          read: false,
          createdAt: new Date(),
          attachments: []
        }
      ];
      
      // 创建模拟链式调用
      const mockPopulate2 = jest.fn().mockReturnValue(mockMessages);
      const mockPopulate1 = jest.fn().mockReturnValue({ populate: mockPopulate2 });
      const mockLimit = jest.fn().mockReturnValue({ populate: mockPopulate1 });
      const mockSkip = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ skip: mockSkip });
      
      // 设置模拟函数的返回值
      Message.find.mockReturnValue({ sort: mockSort });
      
      // 模拟 countDocuments 方法的返回值
      Message.countDocuments.mockResolvedValue(1);
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages')
        .query({ receiver: 'receiver-id-1', limit: 20, skip: 0 });
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 1);
      
      // 验证模拟函数被正确调用
      expect(Message.find).toHaveBeenCalledWith({ receiver: 'receiver-id-1' });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockSkip).toHaveBeenCalledWith(0);
      expect(mockLimit).toHaveBeenCalledWith(20);
      expect(mockPopulate1).toHaveBeenCalledWith('sender', 'name role');
      expect(mockPopulate2).toHaveBeenCalledWith('receiver', 'name role');
      expect(Message.countDocuments).toHaveBeenCalledWith({ receiver: 'receiver-id-1' });
    });
    
    it('应该支持按日期范围筛选', async () => {
      // 模拟数据
      const mockMessages = [
        {
          _id: 'message-id-1',
          sender: { _id: 'sender-id-1', name: '发送者1', role: 'teacher' },
          receiver: { _id: 'receiver-id-1', name: '接收者1', role: 'student' },
          content: '测试消息1',
          read: false,
          createdAt: new Date('2023-01-01'),
          attachments: []
        }
      ];
      
      // 创建模拟链式调用
      const mockPopulate2 = jest.fn().mockReturnValue(mockMessages);
      const mockPopulate1 = jest.fn().mockReturnValue({ populate: mockPopulate2 });
      const mockLimit = jest.fn().mockReturnValue({ populate: mockPopulate1 });
      const mockSkip = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ skip: mockSkip });
      
      // 设置模拟函数的返回值
      Message.find.mockReturnValue({ sort: mockSort });
      
      // 模拟 countDocuments 方法的返回值
      Message.countDocuments.mockResolvedValue(1);
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages')
        .query({ 
          startDate: '2023-01-01', 
          endDate: '2023-01-31',
          limit: 20, 
          skip: 0 
        });
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 1);
      
      // 验证模拟函数被正确调用
      expect(Message.find).toHaveBeenCalledWith({
        createdAt: {
          $gte: expect.any(Date),
          $lte: expect.any(Date)
        }
      });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockSkip).toHaveBeenCalledWith(0);
      expect(mockLimit).toHaveBeenCalledWith(20);
      expect(mockPopulate1).toHaveBeenCalledWith('sender', 'name role');
      expect(mockPopulate2).toHaveBeenCalledWith('receiver', 'name role');
      expect(Message.countDocuments).toHaveBeenCalledWith({
        createdAt: {
          $gte: expect.any(Date),
          $lte: expect.any(Date)
        }
      });
    });
    
    it('应该处理数据库查询错误', async () => {
      // 模拟 find 方法抛出错误
      Message.find.mockImplementation(() => {
        throw new Error('数据库查询错误');
      });
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages');
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取消息列表失败');
      expect(response.body).toHaveProperty('error', '数据库查询错误');
    });
  });
  
  // 测试获取单个消息
  describe('GET /api/interaction/messages/:id', () => {
    it('应该成功获取单个消息', async () => {
      // 模拟数据
      const mockMessage = {
        _id: 'message-id-1',
        sender: { _id: 'sender-id-1', name: '发送者1', role: 'teacher' },
        receiver: { _id: 'receiver-id-1', name: '接收者1', role: 'student' },
        content: '测试消息1',
        read: false,
        createdAt: new Date(),
        attachments: []
      };
      
      // 创建模拟链式调用
      const mockPopulate2 = jest.fn().mockReturnValue(mockMessage);
      const mockPopulate1 = jest.fn().mockReturnValue({ populate: mockPopulate2 });
      
      // 设置模拟函数的返回值
      Message.findById.mockReturnValue({ populate: mockPopulate1 });
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages/message-id-1');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', 'message-id-1');
      expect(response.body).toHaveProperty('content', '测试消息1');
      expect(response.body).toHaveProperty('read', false);
      
      // 验证模拟函数被正确调用
      expect(Message.findById).toHaveBeenCalledWith('message-id-1');
      expect(mockPopulate1).toHaveBeenCalledWith('sender', 'name role');
      expect(mockPopulate2).toHaveBeenCalledWith('receiver', 'name role');
    });
    
    it('应该处理消息不存在的情况', async () => {
      // 创建模拟链式调用
      const mockPopulate2 = jest.fn().mockReturnValue(null);
      const mockPopulate1 = jest.fn().mockReturnValue({ populate: mockPopulate2 });
      
      // 设置模拟函数的返回值
      Message.findById.mockReturnValue({ populate: mockPopulate1 });
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages/non-existent-id');
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '消息不存在');
      
      // 验证模拟函数被正确调用
      expect(Message.findById).toHaveBeenCalledWith('non-existent-id');
      expect(mockPopulate1).toHaveBeenCalledWith('sender', 'name role');
      expect(mockPopulate2).toHaveBeenCalledWith('receiver', 'name role');
    });
    
    it('应该处理数据库查询错误', async () => {
      // 模拟 findById 方法抛出错误
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
});

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

describe('消息路由 - 获取消息列表', () => {
  let app;
  const Message = require('../../models/Message');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/messages', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  it('应该成功获取消息列表', async () => {
    // 模拟数据
    const mockMessages = [
      {
        _id: 'message-id-1',
        sender: { _id: 'user-id-1', name: '用户1', role: 'teacher' },
        receiver: { _id: 'user-id-2', name: '用户2', role: 'parent' },
        content: '测试消息1',
        attachments: [],
        read: false,
        createdAt: '2025-05-10T10:00:00.000Z'
      },
      {
        _id: 'message-id-2',
        sender: { _id: 'user-id-2', name: '用户2', role: 'parent' },
        receiver: { _id: 'user-id-1', name: '用户1', role: 'teacher' },
        content: '测试消息2',
        attachments: [],
        read: true,
        createdAt: '2025-05-10T11:00:00.000Z'
      }
    ];
    
    // 设置模拟函数的返回值
    const mockSort = jest.fn().mockReturnThis();
    const mockSkip = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockReturnThis();
    const mockPopulateSender = jest.fn().mockReturnThis();
    const mockPopulateReceiver = jest.fn().mockReturnValue(mockMessages);
    
    Message.find.mockReturnValue({
      sort: mockSort,
      skip: mockSkip,
      limit: mockLimit,
      populate: mockPopulateSender
    });
    
    mockSort.mockReturnValue({
      skip: mockSkip,
      limit: mockLimit,
      populate: mockPopulateSender
    });
    
    mockSkip.mockReturnValue({
      limit: mockLimit,
      populate: mockPopulateSender
    });
    
    mockLimit.mockReturnValue({
      populate: mockPopulateSender
    });
    
    mockPopulateSender.mockReturnValue({
      populate: mockPopulateReceiver
    });
    
    Message.countDocuments.mockResolvedValue(2);
    
    // 发送请求
    const response = await request(app)
      .get('/api/interaction/messages')
      .query({ limit: 20, skip: 0 });
    
    // 验证响应
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('pagination');
    expect(response.body.data).toEqual(mockMessages);
    expect(response.body.pagination).toEqual({
      total: 2,
      limit: 20,
      skip: 0
    });
    
    // 验证模拟函数被正确调用
    expect(Message.find).toHaveBeenCalledWith({});
    expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(mockSkip).toHaveBeenCalledWith(0);
    expect(mockLimit).toHaveBeenCalledWith(20);
    expect(mockPopulateSender).toHaveBeenCalledWith('sender', 'name role');
    expect(mockPopulateReceiver).toHaveBeenCalledWith('receiver', 'name role');
    expect(Message.countDocuments).toHaveBeenCalledWith({});
  });
  
  it('应该根据查询参数过滤消息列表', async () => {
    // 模拟数据
    const mockMessages = [
      {
        _id: 'message-id-1',
        sender: { _id: 'user-id-1', name: '用户1', role: 'teacher' },
        receiver: { _id: 'user-id-2', name: '用户2', role: 'parent' },
        content: '测试消息1',
        attachments: [],
        read: false,
        createdAt: '2025-05-10T10:00:00.000Z'
      }
    ];
    
    // 设置模拟函数的返回值
    const mockSort = jest.fn().mockReturnThis();
    const mockSkip = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockReturnThis();
    const mockPopulateSender = jest.fn().mockReturnThis();
    const mockPopulateReceiver = jest.fn().mockReturnValue(mockMessages);
    
    Message.find.mockReturnValue({
      sort: mockSort,
      skip: mockSkip,
      limit: mockLimit,
      populate: mockPopulateSender
    });
    
    mockSort.mockReturnValue({
      skip: mockSkip,
      limit: mockLimit,
      populate: mockPopulateSender
    });
    
    mockSkip.mockReturnValue({
      limit: mockLimit,
      populate: mockPopulateSender
    });
    
    mockLimit.mockReturnValue({
      populate: mockPopulateSender
    });
    
    mockPopulateSender.mockReturnValue({
      populate: mockPopulateReceiver
    });
    
    Message.countDocuments.mockResolvedValue(1);
    
    // 查询参数
    const queryParams = {
      sender: 'user-id-1',
      receiver: 'user-id-2',
      startDate: '2025-05-01',
      endDate: '2025-05-31',
      limit: 10,
      skip: 0
    };
    
    // 发送请求
    const response = await request(app)
      .get('/api/interaction/messages')
      .query(queryParams);
    
    // 验证响应
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('pagination');
    expect(response.body.data).toEqual(mockMessages);
    expect(response.body.pagination).toEqual({
      total: 1,
      limit: 10,
      skip: 0
    });
    
    // 验证模拟函数被正确调用
    expect(Message.find).toHaveBeenCalledWith({
      sender: 'user-id-1',
      receiver: 'user-id-2',
      createdAt: {
        $gte: expect.any(Date),
        $lte: expect.any(Date)
      }
    });
    expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(mockSkip).toHaveBeenCalledWith(0);
    expect(mockLimit).toHaveBeenCalledWith(10);
    expect(Message.countDocuments).toHaveBeenCalledWith({
      sender: 'user-id-1',
      receiver: 'user-id-2',
      createdAt: {
        $gte: expect.any(Date),
        $lte: expect.any(Date)
      }
    });
  });
  
  it('应该处理数据库查询错误', async () => {
    // 设置模拟函数抛出错误
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

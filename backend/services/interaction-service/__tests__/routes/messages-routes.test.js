/**
 * 消息路由测试
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Message = require('../../models/Message');

// 模拟 mongoose
jest.mock('mongoose', () => {
  const mockMongoose = {
    connect: jest.fn().mockResolvedValue({}),
    connection: {
      on: jest.fn(),
      once: jest.fn()
    }
  };
  return mockMongoose;
});

// 模拟 Message 模型
jest.mock('../../models/Message', () => {
  return {
    find: jest.fn().mockReturnThis(),
    findById: jest.fn().mockReturnThis(),
    findByIdAndUpdate: jest.fn().mockReturnThis(),
    findByIdAndDelete: jest.fn().mockReturnThis(),
    countDocuments: jest.fn().mockResolvedValue(10),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue({})
  };
});

// 创建测试应用
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // 导入消息路由
  const messagesRouter = require('../../routes/messages');
  app.use('/api/messages', messagesRouter);
  
  return app;
};

describe('消息路由测试', () => {
  let app;
  
  beforeEach(() => {
    // 重置所有模拟函数
    jest.clearAllMocks();
    
    // 创建测试应用
    app = createTestApp();
    
    // 模拟 Message 构造函数
    Message.mockImplementation(function(data) {
      this.sender = data.sender;
      this.receiver = data.receiver;
      this.content = data.content;
      this.attachments = data.attachments || [];
      this.read = data.read || false;
      this.save = jest.fn().mockResolvedValue(this);
      return this;
    });
  });
  
  describe('GET /api/messages', () => {
    it('应该成功获取消息列表', async () => {
      // 模拟 Message.find 返回消息列表
      const mockMessages = [
        {
          _id: 'message-id-1',
          sender: { _id: 'sender-id-1', name: 'Sender 1', role: 'teacher' },
          receiver: { _id: 'receiver-id-1', name: 'Receiver 1', role: 'parent' },
          content: '消息内容 1',
          read: false,
          createdAt: new Date()
        },
        {
          _id: 'message-id-2',
          sender: { _id: 'sender-id-2', name: 'Sender 2', role: 'teacher' },
          receiver: { _id: 'receiver-id-2', name: 'Receiver 2', role: 'parent' },
          content: '消息内容 2',
          read: true,
          createdAt: new Date()
        }
      ];
      
      Message.find.mockImplementation(() => ({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockMessages)
      }));
      
      Message.countDocuments.mockResolvedValue(2);
      
      // 发送请求
      const response = await request(app).get('/api/messages');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 2);
      
      // 验证 Message.find 被调用
      expect(Message.find).toHaveBeenCalled();
      expect(Message.countDocuments).toHaveBeenCalled();
    });
    
    it('应该支持分页功能', async () => {
      // 模拟 Message.find 返回消息列表
      const mockMessages = [
        {
          _id: 'message-id-1',
          sender: { _id: 'sender-id-1', name: 'Sender 1', role: 'teacher' },
          receiver: { _id: 'receiver-id-1', name: 'Receiver 1', role: 'parent' },
          content: '消息内容 1',
          read: false,
          createdAt: new Date()
        }
      ];
      
      Message.find.mockImplementation(() => ({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockMessages)
      }));
      
      Message.countDocuments.mockResolvedValue(10);
      
      // 发送请求
      const response = await request(app).get('/api/messages?limit=5&skip=5');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 10);
      expect(response.body.pagination).toHaveProperty('limit', 5);
      expect(response.body.pagination).toHaveProperty('skip', 5);
      
      // 验证 Message.find 被调用
      expect(Message.find).toHaveBeenCalled();
    });
    
    it('应该支持按发送者/接收者筛选', async () => {
      // 模拟 Message.find 返回消息列表
      const mockMessages = [
        {
          _id: 'message-id-1',
          sender: { _id: 'sender-id', name: 'Sender', role: 'teacher' },
          receiver: { _id: 'receiver-id', name: 'Receiver', role: 'parent' },
          content: '消息内容 1',
          read: false,
          createdAt: new Date()
        }
      ];
      
      Message.find.mockImplementation(() => ({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockMessages)
      }));
      
      Message.countDocuments.mockResolvedValue(1);
      
      // 发送请求
      const response = await request(app).get('/api/messages?sender=sender-id&receiver=receiver-id');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.pagination).toHaveProperty('total', 1);
      
      // 验证 Message.find 被调用
      expect(Message.find).toHaveBeenCalled();
      expect(Message.find.mock.calls[0][0]).toHaveProperty('sender', 'sender-id');
      expect(Message.find.mock.calls[0][0]).toHaveProperty('receiver', 'receiver-id');
    });
    
    it('应该处理数据库查询错误', async () => {
      // 模拟 Message.find 抛出错误
      Message.find.mockImplementation(() => {
        throw new Error('数据库查询错误');
      });
      
      // 发送请求
      const response = await request(app).get('/api/messages');
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取消息列表失败');
      expect(response.body).toHaveProperty('error', '数据库查询错误');
    });
  });
  
  describe('GET /api/messages/:id', () => {
    it('应该成功获取单个消息', async () => {
      // 模拟 Message.findById 返回消息
      const mockMessage = {
        _id: 'message-id',
        sender: { _id: 'sender-id', name: 'Sender', role: 'teacher' },
        receiver: { _id: 'receiver-id', name: 'Receiver', role: 'parent' },
        content: '消息内容',
        read: false,
        createdAt: new Date()
      };
      
      Message.findById.mockImplementation(() => ({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockMessage)
      }));
      
      // 发送请求
      const response = await request(app).get('/api/messages/message-id');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', 'message-id');
      expect(response.body).toHaveProperty('content', '消息内容');
      
      // 验证 Message.findById 被调用
      expect(Message.findById).toHaveBeenCalledWith('message-id');
    });
    
    it('应该处理消息不存在的情况', async () => {
      // 模拟 Message.findById 返回 null
      Message.findById.mockImplementation(() => ({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null)
      }));
      
      // 发送请求
      const response = await request(app).get('/api/messages/non-existent-id');
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '消息不存在');
    });
    
    it('应该处理数据库查询错误', async () => {
      // 模拟 Message.findById 抛出错误
      Message.findById.mockImplementation(() => {
        throw new Error('数据库查询错误');
      });
      
      // 发送请求
      const response = await request(app).get('/api/messages/message-id');
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取消息失败');
      expect(response.body).toHaveProperty('error', '数据库查询错误');
    });
  });
  
  describe('POST /api/messages', () => {
    it('应该成功创建消息', async () => {
      // 准备请求数据
      const messageData = {
        sender: 'sender-id',
        receiver: 'receiver-id',
        content: '新消息内容',
        attachments: [
          { name: '附件1', url: 'http://example.com/attachment1', type: 'pdf', size: 1024 }
        ]
      };
      
      // 发送请求
      const response = await request(app)
        .post('/api/messages')
        .send(messageData);
      
      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('sender', 'sender-id');
      expect(response.body).toHaveProperty('receiver', 'receiver-id');
      expect(response.body).toHaveProperty('content', '新消息内容');
      expect(response.body).toHaveProperty('attachments');
      expect(response.body.attachments).toHaveLength(1);
      expect(response.body).toHaveProperty('read', false);
    });
    
    it('应该验证必要参数', async () => {
      // 准备请求数据（缺少必要参数）
      const invalidData = {
        sender: 'sender-id'
        // 缺少 receiver 和 content
      };
      
      // 发送请求
      const response = await request(app)
        .post('/api/messages')
        .send(invalidData);
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '发送者、接收者和内容不能为空');
    });
    
    it('应该处理保存错误', async () => {
      // 准备请求数据
      const messageData = {
        sender: 'sender-id',
        receiver: 'receiver-id',
        content: '新消息内容'
      };
      
      // 模拟 save 方法抛出错误
      Message.prototype.save = jest.fn().mockRejectedValue(new Error('保存错误'));
      
      // 发送请求
      const response = await request(app)
        .post('/api/messages')
        .send(messageData);
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '发送消息失败');
      expect(response.body).toHaveProperty('error', '保存错误');
    });
  });
  
  describe('PUT /api/messages/:id/read', () => {
    it('应该成功标记消息为已读', async () => {
      // 模拟 Message.findByIdAndUpdate 返回更新后的消息
      const mockUpdatedMessage = {
        _id: 'message-id',
        sender: 'sender-id',
        receiver: 'receiver-id',
        content: '消息内容',
        read: true,
        createdAt: new Date()
      };
      
      Message.findByIdAndUpdate.mockResolvedValue(mockUpdatedMessage);
      
      // 发送请求
      const response = await request(app).put('/api/messages/message-id/read');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', 'message-id');
      expect(response.body).toHaveProperty('read', true);
      
      // 验证 Message.findByIdAndUpdate 被调用
      expect(Message.findByIdAndUpdate).toHaveBeenCalledWith(
        'message-id',
        { read: true },
        { new: true }
      );
    });
    
    it('应该处理消息不存在的情况', async () => {
      // 模拟 Message.findByIdAndUpdate 返回 null
      Message.findByIdAndUpdate.mockResolvedValue(null);
      
      // 发送请求
      const response = await request(app).put('/api/messages/non-existent-id/read');
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '消息不存在');
    });
    
    it('应该处理更新错误', async () => {
      // 模拟 Message.findByIdAndUpdate 抛出错误
      Message.findByIdAndUpdate.mockRejectedValue(new Error('更新错误'));
      
      // 发送请求
      const response = await request(app).put('/api/messages/message-id/read');
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '标记消息已读失败');
      expect(response.body).toHaveProperty('error', '更新错误');
    });
  });
  
  describe('DELETE /api/messages/:id', () => {
    it('应该成功删除消息', async () => {
      // 模拟 Message.findByIdAndDelete 返回删除的消息
      const mockDeletedMessage = {
        _id: 'message-id',
        sender: 'sender-id',
        receiver: 'receiver-id',
        content: '消息内容',
        read: false,
        createdAt: new Date()
      };
      
      Message.findByIdAndDelete.mockResolvedValue(mockDeletedMessage);
      
      // 发送请求
      const response = await request(app).delete('/api/messages/message-id');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '消息已删除');
      
      // 验证 Message.findByIdAndDelete 被调用
      expect(Message.findByIdAndDelete).toHaveBeenCalledWith('message-id');
    });
    
    it('应该处理消息不存在的情况', async () => {
      // 模拟 Message.findByIdAndDelete 返回 null
      Message.findByIdAndDelete.mockResolvedValue(null);
      
      // 发送请求
      const response = await request(app).delete('/api/messages/non-existent-id');
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '消息不存在');
    });
    
    it('应该处理删除错误', async () => {
      // 模拟 Message.findByIdAndDelete 抛出错误
      Message.findByIdAndDelete.mockRejectedValue(new Error('删除错误'));
      
      // 发送请求
      const response = await request(app).delete('/api/messages/message-id');
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '删除消息失败');
      expect(response.body).toHaveProperty('error', '删除错误');
    });
  });
  
  describe('GET /api/messages/stats/unread', () => {
    it('应该成功获取未读消息数量', async () => {
      // 模拟 Message.countDocuments 返回未读消息数量
      Message.countDocuments.mockResolvedValue(5);
      
      // 发送请求
      const response = await request(app).get('/api/messages/stats/unread?userId=user-id');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('unreadCount', 5);
      
      // 验证 Message.countDocuments 被调用
      expect(Message.countDocuments).toHaveBeenCalledWith({
        receiver: 'user-id',
        read: false
      });
    });
    
    it('应该验证必要参数', async () => {
      // 发送请求（缺少 userId 参数）
      const response = await request(app).get('/api/messages/stats/unread');
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '用户ID不能为空');
    });
    
    it('应该处理查询错误', async () => {
      // 模拟 Message.countDocuments 抛出错误
      Message.countDocuments.mockRejectedValue(new Error('查询错误'));
      
      // 发送请求
      const response = await request(app).get('/api/messages/stats/unread?userId=user-id');
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取未读消息数量失败');
      expect(response.body).toHaveProperty('error', '查询错误');
    });
  });
});

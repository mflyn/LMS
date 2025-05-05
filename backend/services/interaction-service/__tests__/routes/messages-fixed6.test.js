/**
 * 消息路由测试 - 修复版6
 * 使用jest.spyOn方法
 */

const request = require('supertest');
const express = require('express');
const Message = require('../../models/Message');

// 创建模拟消息数据
const mockMessages = [
  {
    _id: 'msg1',
    content: '消息1',
    sender: { _id: 'user1', name: '发送者', role: 'teacher' },
    receiver: { _id: 'user2', name: '接收者', role: 'student' },
    read: false,
    createdAt: new Date()
  },
  {
    _id: 'msg2',
    content: '消息2',
    sender: { _id: 'user2', name: '接收者', role: 'student' },
    receiver: { _id: 'user1', name: '发送者', role: 'teacher' },
    read: true,
    createdAt: new Date()
  }
];

// 模拟winston日志
jest.mock('winston', () => ({
  format: {
    timestamp: jest.fn().mockReturnValue({}),
    json: jest.fn().mockReturnValue({}),
    combine: jest.fn().mockReturnValue({})
  },
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }),
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

describe('消息路由测试 - 修复版6', () => {
  let app;
  let messagesRouter;
  let findSpy;
  let findByIdSpy;
  let countDocumentsSpy;
  let saveSpy;

  beforeEach(() => {
    // 重置模块缓存
    jest.resetModules();
    
    // 模拟find方法
    findSpy = jest.spyOn(Message, 'find').mockImplementation(() => ({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockMessages)
    }));
    
    // 模拟findById方法
    findByIdSpy = jest.spyOn(Message, 'findById').mockImplementation((id) => {
      if (id === 'nonexistent') {
        return {
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(null)
        };
      }
      if (id === 'error-id') {
        return {
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockRejectedValue(new Error('数据库错误'))
        };
      }
      return {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockMessages[0])
      };
    });
    
    // 模拟countDocuments方法
    countDocumentsSpy = jest.spyOn(Message, 'countDocuments').mockResolvedValue(5);
    
    // 模拟save方法
    saveSpy = jest.spyOn(Message.prototype, 'save').mockImplementation(function() {
      return Promise.resolve(this);
    });
    
    // 模拟构造函数
    jest.spyOn(Message.prototype, 'constructor').mockImplementation(function(data) {
      Object.assign(this, data);
      this._id = 'new-msg-id';
      return this;
    });

    // 导入路由
    messagesRouter = require('../../routes/messages');

    // 创建Express应用
    app = express();
    app.use(express.json());

    // 模拟认证中间件
    app.use((req, res, next) => {
      req.user = { id: 'user123', role: 'teacher' };
      next();
    });

    // 使用消息路由
    app.use('/api/interaction/messages', messagesRouter);
  });

  afterEach(() => {
    // 恢复所有模拟
    findSpy.mockRestore();
    findByIdSpy.mockRestore();
    countDocumentsSpy.mockRestore();
    saveSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe('GET /', () => {
    it('应该返回消息列表和分页信息', async () => {
      const response = await request(app)
        .get('/api/interaction/messages')
        .query({ limit: 20, skip: 0 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toEqual({
        total: 5,
        limit: 20,
        skip: 0
      });
    });
  });

  describe('GET /:id', () => {
    it('应该返回指定ID的消息', async () => {
      const response = await request(app)
        .get('/api/interaction/messages/msg1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockMessages[0]);
    });

    it('应该处理消息不存在的情况', async () => {
      const response = await request(app)
        .get('/api/interaction/messages/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '消息不存在');
    });

    it('应该处理查询错误', async () => {
      const response = await request(app)
        .get('/api/interaction/messages/error-id');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取消息失败');
      expect(response.body).toHaveProperty('error', '数据库错误');
    });
  });

  describe('POST /', () => {
    it('应该成功创建新消息', async () => {
      const messageData = {
        sender: 'user1',
        receiver: 'user2',
        content: '测试消息',
        attachments: []
      };

      const response = await request(app)
        .post('/api/interaction/messages')
        .send(messageData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('sender', 'user1');
      expect(response.body).toHaveProperty('receiver', 'user2');
      expect(response.body).toHaveProperty('content', '测试消息');
    });

    it('应该验证必要字段', async () => {
      const invalidData = {
        receiver: 'user2',
        content: '测试消息'
      };

      const response = await request(app)
        .post('/api/interaction/messages')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '发送者、接收者和内容不能为空');
    });
  });
});

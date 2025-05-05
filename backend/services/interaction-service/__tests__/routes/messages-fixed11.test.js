/**
 * 消息路由测试 - 修复版11
 * 使用supertest的agent和jest.mock
 */

const request = require('supertest');
const express = require('express');

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

// 模拟Message模型
jest.mock('../../models/Message', () => {
  return {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
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
      ])
    }),
    findById: jest.fn().mockImplementation((id) => {
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
        exec: jest.fn().mockResolvedValue({
          _id: 'msg1',
          content: '消息1',
          sender: { _id: 'user1', name: '发送者', role: 'teacher' },
          receiver: { _id: 'user2', name: '接收者', role: 'student' },
          read: false,
          createdAt: new Date()
        })
      };
    }),
    countDocuments: jest.fn().mockImplementation((query) => {
      if (query && query.receiver === 'error-id') {
        return Promise.reject(new Error('查询失败'));
      }
      return Promise.resolve(5);
    }),
    findByIdAndUpdate: jest.fn().mockImplementation((id, update) => {
      if (id === 'nonexistent') {
        return Promise.resolve(null);
      }
      if (id === 'error-id') {
        return Promise.reject(new Error('更新失败'));
      }
      return Promise.resolve({
        _id: 'msg1',
        content: '消息1',
        sender: { _id: 'user1', name: '发送者', role: 'teacher' },
        receiver: { _id: 'user2', name: '接收者', role: 'student' },
        read: update.read || false,
        createdAt: new Date()
      });
    }),
    findByIdAndDelete: jest.fn().mockImplementation((id) => {
      if (id === 'nonexistent') {
        return Promise.resolve(null);
      }
      if (id === 'error-id') {
        return Promise.reject(new Error('删除失败'));
      }
      return Promise.resolve({
        _id: 'msg1',
        content: '消息1',
        sender: { _id: 'user1', name: '发送者', role: 'teacher' },
        receiver: { _id: 'user2', name: '接收者', role: 'student' },
        read: false,
        createdAt: new Date()
      });
    })
  };
});

// 模拟Message构造函数
jest.mock('../../models/Message', () => {
  const mockMessageInstance = {
    save: jest.fn().mockResolvedValue({
      _id: 'new-msg-id',
      content: '测试消息',
      sender: 'user1',
      receiver: 'user2',
      read: false,
      attachments: [],
      createdAt: new Date()
    })
  };

  const MockMessage = jest.fn().mockImplementation((data) => {
    return {
      ...mockMessageInstance,
      ...data
    };
  });

  MockMessage.find = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([
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
    ])
  });

  MockMessage.findById = jest.fn().mockImplementation((id) => {
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
      exec: jest.fn().mockResolvedValue({
        _id: 'msg1',
        content: '消息1',
        sender: { _id: 'user1', name: '发送者', role: 'teacher' },
        receiver: { _id: 'user2', name: '接收者', role: 'student' },
        read: false,
        createdAt: new Date()
      })
    };
  });

  MockMessage.countDocuments = jest.fn().mockImplementation((query) => {
    if (query && query.receiver === 'error-id') {
      return Promise.reject(new Error('查询失败'));
    }
    return Promise.resolve(5);
  });

  MockMessage.findByIdAndUpdate = jest.fn().mockImplementation((id, update) => {
    if (id === 'nonexistent') {
      return Promise.resolve(null);
    }
    if (id === 'error-id') {
      return Promise.reject(new Error('更新失败'));
    }
    return Promise.resolve({
      _id: 'msg1',
      content: '消息1',
      sender: { _id: 'user1', name: '发送者', role: 'teacher' },
      receiver: { _id: 'user2', name: '接收者', role: 'student' },
      read: update.read || false,
      createdAt: new Date()
    });
  });

  MockMessage.findByIdAndDelete = jest.fn().mockImplementation((id) => {
    if (id === 'nonexistent') {
      return Promise.resolve(null);
    }
    if (id === 'error-id') {
      return Promise.reject(new Error('删除失败'));
    }
    return Promise.resolve({
      _id: 'msg1',
      content: '消息1',
      sender: { _id: 'user1', name: '发送者', role: 'teacher' },
      receiver: { _id: 'user2', name: '接收者', role: 'student' },
      read: false,
      createdAt: new Date()
    });
  });

  return MockMessage;
});

describe('消息路由测试 - 修复版11', () => {
  let app;
  let agent;
  let messagesRouter;

  beforeEach(() => {
    // 重置模块缓存
    jest.resetModules();

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

    // 创建supertest代理
    agent = request(app);
  });

  afterEach(() => {
    // 清除所有模拟
    jest.clearAllMocks();
  });

  describe('GET /', () => {
    it('应该返回消息列表和分页信息', async () => {
      const response = await agent
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
      // 重新模拟findById方法
      const Message = require('../../models/Message');
      Message.findById = jest.fn().mockImplementation(() => ({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: 'msg1',
          content: '消息1',
          sender: { _id: 'user1', name: '发送者', role: 'teacher' },
          receiver: { _id: 'user2', name: '接收者', role: 'student' },
          read: false,
          createdAt: new Date()
        })
      }));

      const response = await agent
        .get('/api/interaction/messages/msg1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', 'msg1');
      expect(response.body).toHaveProperty('content', '消息1');
    });

    it('应该处理消息不存在的情况', async () => {
      // 重新模拟findById方法
      const Message = require('../../models/Message');
      Message.findById = jest.fn().mockImplementation(() => ({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null)
      }));

      const response = await agent
        .get('/api/interaction/messages/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '消息不存在');
    });

    it('应该处理查询错误', async () => {
      // 重新模拟findById方法
      const Message = require('../../models/Message');
      Message.findById = jest.fn().mockImplementation(() => ({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('数据库错误'))
      }));

      const response = await agent
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

      const response = await agent
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

      const response = await agent
        .post('/api/interaction/messages')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '发送者、接收者和内容不能为空');
    });
  });
});

/**
 * 测试工具测试
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');
const request = require('supertest');

// 导入测试工具
const { connect, closeDatabase, clearDatabase } = require('./db-handler');
const { createMockApp, createTestRequest } = require('./server-handler');
const {
  generateUserId,
  generateToken,
  mockRequest,
  mockResponse,
  mockNext
} = require('./test-helpers');

// 模拟 mongoose 和 mongodb-memory-server
jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue(),
  connection: {
    readyState: 1,
    dropDatabase: jest.fn().mockResolvedValue(),
    close: jest.fn().mockResolvedValue(),
    collections: {
      collection1: { deleteMany: jest.fn().mockResolvedValue() },
      collection2: { deleteMany: jest.fn().mockResolvedValue() }
    }
  },
  Types: {
    ObjectId: jest.fn().mockImplementation(() => 'mock-object-id')
  },
  Schema: jest.fn().mockImplementation(function() {
    return {
      pre: jest.fn().mockReturnThis()
    };
  }),
  model: jest.fn().mockReturnValue({})
}));

jest.mock('mongodb-memory-server', () => ({
  MongoMemoryServer: {
    create: jest.fn().mockResolvedValue({
      getUri: jest.fn().mockReturnValue('mongodb://mock-uri'),
      stop: jest.fn().mockResolvedValue()
    })
  }
}));

// 模拟 jwt
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-token')
}));

// 模拟 express 和 supertest
jest.mock('express', () => {
  const mockApp = {
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn()
  };
  const mockExpress = jest.fn().mockReturnValue(mockApp);
  mockExpress.json = jest.fn().mockReturnValue('json-middleware');
  return mockExpress;
});

jest.mock('supertest', () => {
  return jest.fn().mockReturnValue('mock-supertest');
});

describe('测试工具测试', () => {
  describe('db-handler', () => {
    beforeEach(() => {
      // 重置 mongoose.connect 的模拟状态
      mongoose.connect.mockClear();
      mongoose.connection.readyState = 0; // 设置为未连接状态
    });

    it('应该连接到测试数据库', async () => {
      await connect();
      expect(mongoose.connect).toHaveBeenCalledWith('mongodb://mock-uri', expect.any(Object));
    });

    it('应该断开测试数据库连接', async () => {
      // 设置为已连接状态
      mongoose.connection.readyState = 1;

      await closeDatabase();
      expect(mongoose.connection.dropDatabase).toHaveBeenCalled();
      expect(mongoose.connection.close).toHaveBeenCalled();
    });

    it('应该清空数据库集合', async () => {
      // 设置为已连接状态
      mongoose.connection.readyState = 1;

      await clearDatabase();
      expect(mongoose.connection.collections.collection1.deleteMany).toHaveBeenCalledWith({});
      expect(mongoose.connection.collections.collection2.deleteMany).toHaveBeenCalledWith({});
    });

    it('应该在已连接时跳过连接', async () => {
      // 设置为已连接状态
      mongoose.connection.readyState = 1;
      mongoose.connect.mockClear();

      await connect();
      expect(mongoose.connect).not.toHaveBeenCalled();
    });

    it('应该在未连接时跳过断开连接和清空数据库', async () => {
      // 设置为未连接状态
      mongoose.connection.readyState = 0;
      mongoose.connection.dropDatabase.mockClear();
      mongoose.connection.close.mockClear();

      // 清除 deleteMany 的调用记录
      mongoose.connection.collections.collection1.deleteMany.mockClear();
      mongoose.connection.collections.collection2.deleteMany.mockClear();

      await closeDatabase();
      expect(mongoose.connection.dropDatabase).not.toHaveBeenCalled();
      expect(mongoose.connection.close).not.toHaveBeenCalled();

      await clearDatabase();
      expect(mongoose.connection.collections.collection1.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('server-handler', () => {
    it('应该创建一个模拟的Express应用', () => {
      const routes = {
        '/test': {
          GET: (req, res) => res.json({ message: 'test' })
        }
      };
      const app = createMockApp(routes);
      expect(express).toHaveBeenCalled();
      expect(app.use).toHaveBeenCalledWith('json-middleware');
      expect(app.get).toHaveBeenCalledWith('/test', expect.any(Function));
    });

    it('应该处理多种HTTP方法', () => {
      const routes = {
        '/test': {
          GET: (req, res) => res.json({ message: 'get' }),
          POST: (req, res) => res.json({ message: 'post' }),
          PUT: (req, res) => res.json({ message: 'put' }),
          DELETE: (req, res) => res.json({ message: 'delete' })
        }
      };
      const app = createMockApp(routes);
      expect(app.get).toHaveBeenCalledWith('/test', expect.any(Function));
      expect(app.post).toHaveBeenCalledWith('/test', expect.any(Function));
      expect(app.put).toHaveBeenCalledWith('/test', expect.any(Function));
      expect(app.delete).toHaveBeenCalledWith('/test', expect.any(Function));
    });

    it('应该添加404处理中间件', () => {
      const app = createMockApp();
      // 最后一次调用应该是404处理中间件
      const lastCall = app.use.mock.calls[app.use.mock.calls.length - 1];
      expect(lastCall[0]).toBeInstanceOf(Function);
    });

    it('应该创建一个测试请求', () => {
      const app = createMockApp();
      const testRequest = createTestRequest(app);
      expect(request).toHaveBeenCalledWith(app);
      expect(testRequest).toBe('mock-supertest');
    });
  });

  describe('test-helpers', () => {
    // 由于 generateUserId 函数使用了 new 关键字，这使得模拟变得复杂
    // 我们可以选择跳过这个测试，或者修改测试策略
    it('应该调用 mongoose.Types.ObjectId 来生成用户ID', () => {
      // 清除之前的调用记录
      mongoose.Types.ObjectId.mockClear();

      // 调用 generateUserId 函数
      generateUserId();

      // 验证 mongoose.Types.ObjectId 被调用
      expect(mongoose.Types.ObjectId).toHaveBeenCalled();
    });

    it('应该生成JWT令牌', () => {
      const user = { id: '123', role: 'admin', name: 'Test User' };
      const token = generateToken(user);
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: '123', role: 'admin', name: 'Test User' },
        expect.any(String)
      );
      expect(token).toBe('mock-token');
    });

    it('应该处理带有_id的用户对象', () => {
      const user = { _id: { toString: jest.fn().mockReturnValue('123') }, role: 'admin', name: 'Test User' };
      const token = generateToken(user);
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: '123', role: 'admin', name: 'Test User' },
        expect.any(String)
      );
      expect(token).toBe('mock-token');
    });

    it('应该创建模拟请求对象', () => {
      const headers = { authorization: 'Bearer token' };
      const user = { id: '123' };
      const req = mockRequest(headers, user);
      expect(req).toEqual({
        headers,
        user,
        body: {},
        params: {},
        query: {}
      });
    });

    it('应该创建带有自定义属性的模拟请求对象', () => {
      const headers = { authorization: 'Bearer token' };
      const user = { id: '123' };
      const body = { name: 'test' };
      const params = { id: '456' };
      const query = { sort: 'asc' };

      const req = mockRequest(headers, user);
      req.body = body;
      req.params = params;
      req.query = query;

      expect(req).toEqual({
        headers,
        user,
        body,
        params,
        query
      });
    });

    it('应该创建模拟响应对象', () => {
      const res = mockResponse();
      expect(res.status).toBeDefined();
      expect(res.json).toBeDefined();
      expect(res.send).toBeDefined();

      res.status(200);
      expect(res.status).toHaveBeenCalledWith(200);

      res.json({ message: 'test' });
      expect(res.json).toHaveBeenCalledWith({ message: 'test' });
    });

    it('应该支持链式调用响应方法', () => {
      const res = mockResponse();
      res.status(200).json({ message: 'test' });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'test' });
    });

    it('应该创建模拟下一个中间件函数', () => {
      expect(mockNext).toBeDefined();
      mockNext();
      expect(mockNext).toHaveBeenCalled();
    });

    it('应该支持带有错误参数的下一个中间件函数', () => {
      const error = new Error('测试错误');
      mockNext(error);
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});

/**
 * 服务器功能测试 - 第二部分
 * 补充测试 server.js 中未覆盖的功能
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const winston = require('winston');
const cors = require('cors');
const bodyParser = require('body-parser');

// 模拟依赖
jest.mock('mongoose', () => {
  const mockMongoose = {
    connect: jest.fn(),
    connection: {
      on: jest.fn(),
      once: jest.fn()
    }
  };

  // 默认成功连接
  mockMongoose.connect.mockResolvedValue();

  return mockMongoose;
});

jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn()
  };

  return {
    createLogger: jest.fn().mockReturnValue(mockLogger),
    format: {
      timestamp: jest.fn().mockReturnValue({}),
      json: jest.fn().mockReturnValue({}),
      combine: jest.fn().mockReturnValue({})
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    }
  };
});

jest.mock('cors', () => {
  return jest.fn(() => (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    next();
  });
});

jest.mock('body-parser', () => {
  return {
    json: jest.fn(() => (req, res, next) => {
      if (req.is('application/json')) {
        try {
          req.body = JSON.parse(req.rawBody || '{}');
        } catch (error) {
          return res.status(400).json({ message: '无效的JSON格式' });
        }
      }
      next();
    }),
    urlencoded: jest.fn(() => (req, res, next) => {
      next();
    })
  };
});

// 模拟路由
jest.mock('../routes/messages', () => jest.fn());
jest.mock('../routes/announcements', () => jest.fn());
jest.mock('../routes/meetings', () => jest.fn());
jest.mock('../routes/video-meetings-simple', () => jest.fn());

// 模拟中间件
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => next(),
  checkRole: (roles) => (req, res, next) => next()
}));

describe('服务器功能测试 - 第二部分', () => {
  let app;
  let originalNodeEnv;
  let originalPort;
  let server;
  let logger;

  beforeAll(() => {
    // 保存原始环境变量
    originalNodeEnv = process.env.NODE_ENV;
    originalPort = process.env.PORT;

    // 设置测试环境
    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = 'mongodb://testdb:27017/test-db';
    process.env.PORT = '4001';

    // 导入服务器应用
    app = require('../server');

    // 获取日志记录器
    logger = require('winston').createLogger();
  });

  afterAll(() => {
    // 恢复原始环境变量
    process.env.NODE_ENV = originalNodeEnv;
    process.env.PORT = originalPort;
    delete process.env.MONGO_URI;

    // 清理模拟
    jest.resetAllMocks();

    // 关闭服务器
    if (server && server.close) {
      server.close();
    }
  });

  describe('CORS配置', () => {
    it('应该正确配置CORS中间件', async () => {
      // 发送预检请求
      const response = await request(app)
        .options('/api/interaction/messages')
        .set('Origin', 'http://example.com');

      // 验证CORS头部
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-methods']).toContain('PUT');
      expect(response.headers['access-control-allow-methods']).toContain('DELETE');
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
      expect(response.headers['access-control-allow-headers']).toContain('Authorization');
    });
  });

  describe('请求体解析', () => {
    it('应该正确解析JSON请求体', async () => {
      // 创建一个测试路由
      app.post('/test-json-body', (req, res) => {
        res.status(200).json(req.body);
      });

      // 发送JSON请求
      const response = await request(app)
        .post('/test-json-body')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json');

      // 验证请求体被正确解析
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ test: 'data' });
    });

    it('应该处理无效的JSON请求体', async () => {
      // 创建一个会触发JSON解析错误的路由
      app.post('/invalid-json', (req, res, next) => {
        // 模拟JSON解析错误
        const error = new SyntaxError('Unexpected token');
        error.status = 400;
        next(error);
      });

      // 发送无效的JSON
      const response = await request(app)
        .post('/invalid-json')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      // 验证错误响应
      expect(response.status).toBe(400);
    });

    it('应该正确解析URL编码的请求体', async () => {
      // 创建一个测试路由
      app.post('/test-urlencoded', (req, res) => {
        res.status(200).json(req.body);
      });

      // 发送URL编码的请求
      const response = await request(app)
        .post('/test-urlencoded')
        .send('name=test&value=123')
        .set('Content-Type', 'application/x-www-form-urlencoded');

      // 验证请求体被正确解析
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'test');
      expect(response.body).toHaveProperty('value', '123');
    });
  });

  describe('环境变量配置', () => {
    it('应该使用环境变量中的端口号', () => {
      // 模拟app.listen方法
      const originalListen = app.listen;
      app.listen = jest.fn().mockReturnValue({
        on: jest.fn()
      });

      // 设置非测试环境以触发服务器启动
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // 重新加载服务器应用
      jest.resetModules();
      require('../server');

      // 验证服务器使用了环境变量中的端口号
      expect(app.listen).toHaveBeenCalledWith(4001, expect.any(Function));

      // 恢复原始设置
      process.env.NODE_ENV = originalEnv;
      app.listen = originalListen;
    });

    it('应该在未设置端口号时使用默认值', () => {
      // 模拟app.listen方法
      const originalListen = app.listen;
      app.listen = jest.fn().mockReturnValue({
        on: jest.fn()
      });

      // 设置非测试环境以触发服务器启动
      const originalEnv = process.env.NODE_ENV;
      const originalPort = process.env.PORT;
      process.env.NODE_ENV = 'development';
      delete process.env.PORT;

      // 重新加载服务器应用
      jest.resetModules();
      require('../server');

      // 验证服务器使用了默认端口号
      expect(app.listen).toHaveBeenCalledWith(3003, expect.any(Function));

      // 恢复原始设置
      process.env.NODE_ENV = originalEnv;
      process.env.PORT = originalPort;
      app.listen = originalListen;
    });
  });

  describe('MongoDB连接事件', () => {
    it('应该处理MongoDB连接成功事件', () => {
      // 清除之前的调用记录
      logger.info.mockClear();

      // 触发连接成功事件
      const connectionCallback = mongoose.connection.on.mock.calls.find(
        call => call[0] === 'connected'
      )[1];
      connectionCallback();

      // 验证成功消息被记录
      expect(logger.info).toHaveBeenCalledWith('MongoDB已连接');
    });

    it('应该处理MongoDB连接错误事件', () => {
      // 清除之前的调用记录
      logger.error.mockClear();

      // 触发连接错误事件
      const error = new Error('连接错误');
      const errorCallback = mongoose.connection.on.mock.calls.find(
        call => call[0] === 'error'
      )[1];
      errorCallback(error);

      // 验证错误消息被记录
      expect(logger.error).toHaveBeenCalledWith('MongoDB连接错误:', error);
    });

    it('应该处理MongoDB断开连接事件', () => {
      // 清除之前的调用记录
      logger.info.mockClear();

      // 触发断开连接事件
      const disconnectCallback = mongoose.connection.on.mock.calls.find(
        call => call[0] === 'disconnected'
      )[1];
      disconnectCallback();

      // 验证断开连接消息被记录
      expect(logger.info).toHaveBeenCalledWith('MongoDB已断开连接');
    });
  });

  describe('服务器关闭', () => {
    it('应该正确处理服务器关闭', () => {
      // 模拟app.listen方法
      const mockServer = {
        on: jest.fn(),
        close: jest.fn()
      };
      const originalListen = app.listen;
      app.listen = jest.fn().mockReturnValue(mockServer);

      // 设置非测试环境以触发服务器启动
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // 重新加载服务器应用
      jest.resetModules();
      require('../server');

      // 验证服务器被启动
      expect(app.listen).toHaveBeenCalled();

      // 验证错误事件处理器被注册
      expect(mockServer.on).toHaveBeenCalledWith('error', expect.any(Function));

      // 触发错误事件
      const errorCallback = mockServer.on.mock.calls.find(
        call => call[0] === 'error'
      )[1];
      const error = new Error('服务器错误');
      errorCallback(error);

      // 验证错误被记录
      expect(logger.error).toHaveBeenCalledWith('服务器错误:', error);

      // 恢复原始设置
      process.env.NODE_ENV = originalEnv;
      app.listen = originalListen;
    });
  });
});

/**
 * 服务器整体功能测试
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const winston = require('winston');
const fs = require('fs');
const path = require('path');

// 模拟依赖
jest.mock('mongoose', () => {
  const mockMongoose = {
    connect: jest.fn(),
    connection: {
      on: jest.fn()
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

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn()
}));

// 模拟路由
jest.mock('../routes/messages', () => {
  return jest.fn(() => ({
    get: jest.fn((path, callback) => {
      if (path === '/') {
        return {
          json: jest.fn(() => ({ message: '消息路由测试' }))
        };
      }
    })
  }));
});

jest.mock('../routes/announcements', () => {
  return jest.fn(() => ({
    get: jest.fn((path, callback) => {
      if (path === '/') {
        return {
          json: jest.fn(() => ({ message: '公告路由测试' }))
        };
      }
    })
  }));
});

jest.mock('../routes/meetings', () => {
  return jest.fn(() => ({
    get: jest.fn((path, callback) => {
      if (path === '/') {
        return {
          json: jest.fn(() => ({ message: '会议路由测试' }))
        };
      }
    })
  }));
});

jest.mock('../routes/video-meetings-simple', () => {
  return jest.fn(() => ({
    get: jest.fn((path, callback) => {
      if (path === '/') {
        return {
          json: jest.fn(() => ({ message: '视频会议路由测试' }))
        };
      }
    })
  }));
});

// 模拟中间件
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    // 在测试环境中，直接通过认证
    req.user = { id: 'test-user-id', role: 'teacher' };
    next();
  },
  checkRole: (roles) => (req, res, next) => {
    // 在测试环境中，直接通过角色检查
    next();
  }
}));

describe('服务器功能测试', () => {
  let app;
  let originalNodeEnv;
  let logger;

  beforeAll(() => {
    // 保存原始环境变量
    originalNodeEnv = process.env.NODE_ENV;

    // 设置测试环境
    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = 'mongodb://testdb:27017/test-db';

    // 模拟fs.existsSync的行为
    fs.existsSync.mockReturnValue(false);

    // 导入服务器应用
    app = require('../server');

    // 获取日志记录器
    logger = require('winston').createLogger();
  });

  afterAll(() => {
    // 恢复原始环境变量
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.MONGO_URI;

    // 清理模拟
    jest.resetAllMocks();
  });

  describe('应用初始化', () => {
    it('应该创建日志目录（如果不存在）', () => {
      expect(fs.existsSync).toHaveBeenCalledWith('logs');
      expect(fs.mkdirSync).toHaveBeenCalledWith('logs', { recursive: true });
    });

    it('应该连接到MongoDB', () => {
      expect(mongoose.connect).toHaveBeenCalledWith(
        'mongodb://testdb:27017/test-db',
        expect.objectContaining({
          useNewUrlParser: true,
          useUnifiedTopology: true
        })
      );
    });

    it('应该处理MongoDB连接失败的情况', async () => {
      // 清除之前的调用记录
      logger.error.mockClear();

      // 模拟连接失败
      const connectionError = new Error('连接失败');
      mongoose.connect.mockRejectedValueOnce(connectionError);

      // 重新加载服务器应用
      jest.resetModules();
      require('../server');

      // 等待异步操作完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证错误被记录
      expect(logger.error).toHaveBeenCalledWith(
        'MongoDB连接失败:',
        expect.any(String)
      );
    });

    it('应该在日志目录存在时不创建目录', () => {
      // 清除之前的调用记录
      fs.existsSync.mockClear();
      fs.mkdirSync.mockClear();

      // 模拟日志目录已存在
      fs.existsSync.mockReturnValueOnce(true);

      // 重新加载服务器应用
      jest.resetModules();
      require('../server');

      // 验证目录检查被调用，但创建目录没有被调用
      expect(fs.existsSync).toHaveBeenCalledWith('logs');
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('请求日志中间件', () => {
    it('应该记录请求方法和URL', async () => {
      // 清除之前的调用记录
      logger.info.mockClear();

      // 发送请求
      await request(app).get('/health');

      // 验证请求被记录
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('GET /health')
      );
    });
  });

  describe('健康检查路由', () => {
    it('应该返回200状态码和正确的服务信息', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('service', 'interaction-service');
    });
  });

  describe('API路由', () => {
    it('应该正确路由消息请求', async () => {
      const response = await request(app).get('/api/interaction/messages');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '消息路由测试');
    });

    it('应该正确路由公告请求', async () => {
      const response = await request(app).get('/api/interaction/announcements');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '公告路由测试');
    });

    it('应该正确路由会议请求', async () => {
      const response = await request(app).get('/api/interaction/meetings');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '会议路由测试');
    });

    it('应该正确路由视频会议请求', async () => {
      const response = await request(app).get('/api/interaction/video-meetings');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '视频会议路由测试');
    });
  });

  describe('错误处理', () => {
    it('访问不存在的路由应该返回404错误', async () => {
      const response = await request(app).get('/non-existent-route');

      expect(response.status).toBe(404);
    });

    it('应该处理服务器错误', async () => {
      // 清除之前的调用记录
      logger.error.mockClear();

      // 创建一个会抛出错误的路由
      app.get('/error-route', (req, res, next) => {
        const error = new Error('测试错误');
        next(error);
      });

      const response = await request(app).get('/error-route');

      // 验证错误被记录
      expect(logger.error).toHaveBeenCalled();

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器内部错误');
      expect(response.body).toHaveProperty('error', '测试错误');
    });

    it('应该在生产环境中隐藏错误详情', async () => {
      // 设置生产环境
      process.env.NODE_ENV = 'production';

      // 创建一个会抛出错误的路由
      app.get('/production-error', (req, res, next) => {
        const error = new Error('生产环境错误');
        next(error);
      });

      const response = await request(app).get('/production-error');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器内部错误');
      expect(response.body.error).toEqual({});

      // 恢复测试环境
      process.env.NODE_ENV = 'test';
    });
  });

  describe('服务器启动', () => {
    let originalListen;

    beforeEach(() => {
      // 保存原始的app.listen方法
      originalListen = app.listen;

      // 模拟app.listen方法
      app.listen = jest.fn().mockReturnValue({
        on: jest.fn()
      });
    });

    afterEach(() => {
      // 恢复原始的app.listen方法
      app.listen = originalListen;
    });

    it('应该在非测试环境下启动服务器', () => {
      // 设置非测试环境
      process.env.NODE_ENV = 'development';

      // 重新加载服务器应用
      jest.resetModules();
      require('../server');

      // 验证服务器被启动
      expect(app.listen).toHaveBeenCalled();

      // 恢复测试环境
      process.env.NODE_ENV = 'test';
    });

    it('应该在测试环境下不启动服务器', () => {
      // 设置测试环境
      process.env.NODE_ENV = 'test';

      // 重新加载服务器应用
      jest.resetModules();
      require('../server');

      // 验证服务器没有被启动
      expect(app.listen).not.toHaveBeenCalled();
    });
  });
});

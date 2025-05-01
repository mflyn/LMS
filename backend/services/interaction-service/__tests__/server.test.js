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
jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue(),
  connection: {
    on: jest.fn()
  }
}));

jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn()
  }),
  format: {
    timestamp: jest.fn().mockReturnValue({}),
    json: jest.fn().mockReturnValue({}),
    combine: jest.fn().mockReturnValue({})
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn()
}));

// 模拟路由
jest.mock('../routes/messages', () => {
  const router = express.Router();
  router.get('/', (req, res) => res.json({ message: '消息路由测试' }));
  return router;
});

jest.mock('../routes/announcements', () => {
  const router = express.Router();
  router.get('/', (req, res) => res.json({ message: '公告路由测试' }));
  return router;
});

jest.mock('../routes/meetings', () => {
  const router = express.Router();
  router.get('/', (req, res) => res.json({ message: '会议路由测试' }));
  return router;
});

jest.mock('../routes/video-meetings-simple', () => {
  const router = express.Router();
  router.get('/', (req, res) => res.json({ message: '视频会议路由测试' }));
  return router;
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
  
  beforeAll(() => {
    // 设置测试环境
    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = 'mongodb://testdb:27017/test-db';
    
    // 模拟fs.existsSync的行为
    fs.existsSync.mockReturnValue(false);
    
    // 导入服务器应用
    app = require('../server');
  });
  
  afterAll(() => {
    // 清理环境变量
    delete process.env.NODE_ENV;
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
      // 创建一个会抛出错误的路由
      app.get('/error-route', (req, res, next) => {
        const error = new Error('测试错误');
        next(error);
      });
      
      const response = await request(app).get('/error-route');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器内部错误');
      expect(response.body).toHaveProperty('error', '测试错误');
    });
  });
});

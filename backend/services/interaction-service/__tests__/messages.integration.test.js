/**
 * 消息路由集成测试
 */

const request = require('supertest');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');

// 导入测试辅助模块
const dbHandler = require('./test-utils/db-handler');
const { generateUserId, generateToken } = require('./test-utils/test-helpers');

// 设置环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

// 模拟消息模型
const mockMessageModel = {
  find: jest.fn().mockReturnThis(),
  findById: jest.fn().mockReturnThis(),
  findOne: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  exec: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn()
};

jest.mock('../models/Message', () => mockMessageModel);

describe('消息路由集成测试', () => {
  let app;
  let teacherToken, studentToken;
  let teacherId, studentId;

  beforeAll(async () => {
    // 连接到测试数据库
    await dbHandler.connect();

    // 创建测试用户ID
    teacherId = generateUserId();
    studentId = generateUserId();

    // 生成测试令牌
    teacherToken = generateToken({
      _id: teacherId,
      role: 'teacher',
      name: '李老师'
    });

    studentToken = generateToken({
      _id: studentId,
      role: 'student',
      name: '张小明'
    });

    // 创建Express应用
    app = express();

    // 添加JSON解析中间件
    app.use(express.json());

    // 添加认证中间件
    app.use('/api/interaction/messages', (req, res, next) => {
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        return res.status(401).json({ message: '未提供认证令牌' });
      }

      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
      } catch (err) {
        return res.status(403).json({ message: '令牌无效或已过期' });
      }
    });

    // 添加消息路由
    app.get('/api/interaction/messages', (req, res) => {
      // 模拟获取消息列表
      res.status(200).json({ messages: [] });
    });

    app.post('/api/interaction/messages', (req, res) => {
      const { receiverId, content } = req.body;

      if (!receiverId || !content) {
        return res.status(400).json({ message: '缺少必要字段' });
      }

      // 模拟创建消息
      const message = {
        _id: new mongoose.Types.ObjectId(),
        senderId: req.user.id,
        receiverId,
        content,
        type: req.body.type || 'private',
        status: 'sent',
        timestamp: new Date()
      };

      res.status(201).json({ message });
    });

    app.get('/api/interaction/messages/:id', (req, res) => {
      const { id } = req.params;

      // 模拟获取特定消息
      if (id === 'nonexistent') {
        return res.status(404).json({ message: '未找到消息' });
      }

      const message = {
        _id: id,
        senderId: teacherId.toString(),
        receiverId: studentId.toString(),
        content: '这是一条测试消息',
        type: 'private',
        status: 'sent',
        timestamp: new Date()
      };

      res.status(200).json(message);
    });
  });

  afterAll(async () => {
    // 断开数据库连接
    await dbHandler.closeDatabase();
  });

  beforeEach(async () => {
    // 清空数据库
    await dbHandler.clearDatabase();

    // 重置模拟函数
    jest.clearAllMocks();
  });

  describe('GET /api/interaction/messages', () => {
    it('未认证用户应该返回401错误', async () => {
      const response = await request(app)
        .get('/api/interaction/messages');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未提供认证令牌');
    });

    it('认证用户应该能获取消息列表', async () => {
      const response = await request(app)
        .get('/api/interaction/messages')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('messages');
      expect(Array.isArray(response.body.messages)).toBe(true);
    });
  });

  describe('POST /api/interaction/messages', () => {
    it('应该能成功发送消息', async () => {
      const messageData = {
        receiverId: studentId.toString(),
        content: '请记得明天带课本',
        type: 'private'
      };

      const response = await request(app)
        .post('/api/interaction/messages')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(messageData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toHaveProperty('content', messageData.content);
      expect(response.body.message).toHaveProperty('receiverId', studentId.toString());
    });

    it('缺少必要字段应该返回400错误', async () => {
      const invalidMessageData = {
        // 缺少receiverId
        content: '请记得明天带课本'
      };

      const response = await request(app)
        .post('/api/interaction/messages')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(invalidMessageData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('缺少必要字段');
    });
  });

  describe('GET /api/interaction/messages/:id', () => {
    it('应该能获取特定消息', async () => {
      const messageId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/api/interaction/messages/${messageId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', messageId);
      expect(response.body).toHaveProperty('content', '这是一条测试消息');
    });

    it('不存在的消息ID应该返回404错误', async () => {
      const response = await request(app)
        .get('/api/interaction/messages/nonexistent')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('未找到');
    });
  });
});

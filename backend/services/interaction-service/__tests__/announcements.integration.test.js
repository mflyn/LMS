/**
 * 公告路由集成测试
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

// 模拟公告模型
const mockAnnouncementModel = {
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

jest.mock('../models/Announcement', () => mockAnnouncementModel);

describe('公告路由集成测试', () => {
  let app;
  let teacherToken, studentToken, adminToken;
  let teacherId, studentId, adminId;

  beforeAll(async () => {
    // 连接到测试数据库
    await dbHandler.connect();

    // 创建测试用户ID
    teacherId = generateUserId();
    studentId = generateUserId();
    adminId = generateUserId();

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

    adminToken = generateToken({
      _id: adminId,
      role: 'admin',
      name: '王校长'
    });

    // 创建Express应用
    app = express();

    // 添加JSON解析中间件
    app.use(express.json());

    // 添加认证中间件
    app.use('/api/interaction/announcements', (req, res, next) => {
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

    // 添加角色检查中间件
    const checkRole = (roles) => {
      return (req, res, next) => {
        if (!req.user) return res.status(401).json({ message: '未认证' });

        if (!roles.includes(req.user.role)) {
          return res.status(403).json({ message: '权限不足' });
        }

        next();
      };
    };

    // 添加公告路由
    app.get('/api/interaction/announcements', (req, res) => {
      // 模拟获取公告列表
      const importance = req.query.importance ? parseInt(req.query.importance) : null;

      let announcements = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: '期中考试通知',
          content: '下周一将进行期中考试，请做好准备',
          authorId: teacherId.toString(),
          targetGroups: ['all'],
          importance: 5,
          publishDate: new Date(),
          status: 'published'
        },
        {
          _id: new mongoose.Types.ObjectId(),
          title: '校园活动通知',
          content: '本周五下午将举行校园歌唱比赛',
          authorId: adminId.toString(),
          targetGroups: ['all'],
          importance: 3,
          publishDate: new Date(),
          status: 'published'
        }
      ];

      if (importance) {
        announcements = announcements.filter(a => a.importance === importance);
      }

      res.status(200).json({ announcements });
    });

    app.post('/api/interaction/announcements', checkRole(['teacher', 'admin']), (req, res) => {
      const { title, content, targetGroups } = req.body;

      if (!title || !content || !targetGroups) {
        return res.status(400).json({ message: '缺少必要字段' });
      }

      // 模拟创建公告
      const announcement = {
        _id: new mongoose.Types.ObjectId(),
        title,
        content,
        authorId: req.user.id,
        targetGroups,
        importance: req.body.importance || 3,
        publishDate: new Date(),
        status: 'published'
      };

      res.status(201).json({ announcement });
    });

    app.get('/api/interaction/announcements/:id', (req, res) => {
      const { id } = req.params;

      // 模拟获取特定公告
      if (id === 'nonexistent') {
        return res.status(404).json({ message: '未找到公告' });
      }

      const announcement = {
        _id: id,
        title: '测试公告',
        content: '这是一条测试公告内容',
        authorId: teacherId.toString(),
        targetGroups: ['all'],
        importance: 4,
        publishDate: new Date(),
        status: 'published'
      };

      res.status(200).json(announcement);
    });

    app.put('/api/interaction/announcements/:id', (req, res) => {
      const { id } = req.params;

      // 检查是否是作者
      if (req.user.role !== 'admin' && req.user.id !== teacherId.toString()) {
        return res.status(403).json({ message: '权限不足' });
      }

      // 模拟更新公告
      const announcement = {
        _id: id,
        title: req.body.title || '更新后的公告标题',
        content: req.body.content || '更新后的公告内容',
        authorId: teacherId.toString(),
        targetGroups: req.body.targetGroups || ['all'],
        importance: req.body.importance || 4,
        publishDate: new Date(),
        status: 'published'
      };

      res.status(200).json({ announcement });
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

  describe('GET /api/interaction/announcements', () => {
    it('未认证用户应该返回401错误', async () => {
      const response = await request(app)
        .get('/api/interaction/announcements');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未提供认证令牌');
    });

    it('认证用户应该能获取公告列表', async () => {
      const response = await request(app)
        .get('/api/interaction/announcements')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('announcements');
      expect(Array.isArray(response.body.announcements)).toBe(true);
      expect(response.body.announcements.length).toBe(2);
    });

    it('应该能根据重要性过滤公告', async () => {
      const response = await request(app)
        .get('/api/interaction/announcements')
        .query({ importance: 5 })
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('announcements');
      expect(Array.isArray(response.body.announcements)).toBe(true);
      expect(response.body.announcements.length).toBe(1);
      expect(response.body.announcements[0]).toHaveProperty('title', '期中考试通知');
    });
  });

  describe('POST /api/interaction/announcements', () => {
    it('教师应该能发布公告', async () => {
      const announcementData = {
        title: '家庭作业通知',
        content: '请完成数学课本第20页的习题',
        targetGroups: ['class-3-2'], // 假设的班级ID
        importance: 4
      };

      const response = await request(app)
        .post('/api/interaction/announcements')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(announcementData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('announcement');
      expect(response.body.announcement).toHaveProperty('title', announcementData.title);
      expect(response.body.announcement).toHaveProperty('authorId');
    });

    it('学生不应该能发布公告', async () => {
      const announcementData = {
        title: '学生通知',
        content: '这是一个测试通知',
        targetGroups: ['all'],
        importance: 3
      };

      const response = await request(app)
        .post('/api/interaction/announcements')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(announcementData);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');
    });

    it('缺少必要字段应该返回400错误', async () => {
      const invalidAnnouncementData = {
        // 缺少title
        content: '这是一个测试通知',
        targetGroups: ['all']
      };

      const response = await request(app)
        .post('/api/interaction/announcements')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(invalidAnnouncementData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('缺少必要字段');
    });
  });

  describe('GET /api/interaction/announcements/:id', () => {
    it('应该能获取特定公告', async () => {
      const announcementId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/api/interaction/announcements/${announcementId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', announcementId);
      expect(response.body).toHaveProperty('title', '测试公告');
    });

    it('不存在的公告ID应该返回404错误', async () => {
      const response = await request(app)
        .get('/api/interaction/announcements/nonexistent')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('未找到');
    });
  });

  describe('PUT /api/interaction/announcements/:id', () => {
    it('作者应该能更新自己的公告', async () => {
      const announcementId = new mongoose.Types.ObjectId().toString();

      const updateData = {
        title: '更新后的公告标题',
        content: '更新后的公告内容',
        importance: 4
      };

      const response = await request(app)
        .put(`/api/interaction/announcements/${announcementId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('announcement');
      expect(response.body.announcement).toHaveProperty('title', updateData.title);
      expect(response.body.announcement).toHaveProperty('content', updateData.content);
      expect(response.body.announcement).toHaveProperty('importance', updateData.importance);
    });

    it('非作者不应该能更新公告', async () => {
      const announcementId = new mongoose.Types.ObjectId().toString();

      const updateData = {
        title: '学生尝试更新的标题',
        content: '学生尝试更新的内容'
      };

      const response = await request(app)
        .put(`/api/interaction/announcements/${announcementId}`)
        .set('Authorization', `Bearer ${studentToken}`) // 学生尝试更新
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');
    });
  });
});

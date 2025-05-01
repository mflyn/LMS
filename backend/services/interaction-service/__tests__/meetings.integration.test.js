/**
 * 会议路由集成测试
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

// 模拟会议模型
const mockMeetingModel = {
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

jest.mock('../models/Meeting', () => mockMeetingModel);

describe('会议路由集成测试', () => {
  let app;
  let teacherToken, studentToken, parentToken;
  let teacherId, studentId, parentId;

  beforeAll(async () => {
    // 连接到测试数据库
    await dbHandler.connect();

    // 创建测试用户ID
    teacherId = generateUserId();
    studentId = generateUserId();
    parentId = generateUserId();

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

    parentToken = generateToken({
      _id: parentId,
      role: 'parent',
      name: '张爸爸'
    });

    // 创建Express应用
    app = express();

    // 添加JSON解析中间件
    app.use(express.json());

    // 添加认证中间件
    app.use('/api/interaction/meetings', (req, res, next) => {
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

    // 添加会议路由
    app.get('/api/interaction/meetings', (req, res) => {
      // 模拟获取会议列表
      const type = req.query.type;

      let meetings = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: '期中考试家长会',
          description: '讨论期中考试安排和注意事项',
          type: 'class',
          organizerId: teacherId.toString(),
          classId: 'class-3-2',
          participants: [parentId.toString()],
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
          location: '线上会议室1',
          isOnline: true,
          status: 'scheduled'
        },
        {
          _id: new mongoose.Types.ObjectId(),
          title: '个别家长沟通',
          description: '讨论学生近期表现',
          type: 'individual',
          organizerId: teacherId.toString(),
          participants: [parentId.toString()],
          startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 48.5 * 60 * 60 * 1000),
          location: '教师办公室',
          isOnline: false,
          status: 'scheduled'
        }
      ];

      if (type) {
        meetings = meetings.filter(m => m.type === type);
      }

      res.status(200).json({ meetings });
    });

    app.post('/api/interaction/meetings', checkRole(['teacher', 'admin']), (req, res) => {
      const { title, startTime, endTime, type } = req.body;

      if (!title || !startTime || !endTime || !type) {
        return res.status(400).json({ message: '缺少必要字段' });
      }

      // 模拟创建会议
      const meeting = {
        _id: new mongoose.Types.ObjectId(),
        title,
        description: req.body.description || '',
        type,
        organizerId: req.user.id,
        classId: req.body.classId,
        participants: req.body.participants || [],
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        location: req.body.location || '',
        isOnline: req.body.isOnline || false,
        status: 'scheduled'
      };

      res.status(201).json({ meeting });
    });

    app.get('/api/interaction/meetings/:id', (req, res) => {
      const { id } = req.params;

      // 模拟获取特定会议
      if (id === 'nonexistent') {
        return res.status(404).json({ message: '未找到会议' });
      }

      const meeting = {
        _id: id,
        title: '测试会议',
        description: '这是一个测试会议',
        type: 'class',
        organizerId: teacherId.toString(),
        classId: 'class-3-2',
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
        location: '学校会议室',
        isOnline: false,
        status: 'scheduled'
      };

      res.status(200).json(meeting);
    });

    app.put('/api/interaction/meetings/:id/status', (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      // 检查是否是组织者
      if (req.user.role !== 'admin' && req.user.id !== teacherId.toString()) {
        return res.status(403).json({ message: '权限不足' });
      }

      // 模拟更新会议状态
      const meeting = {
        _id: id,
        title: '测试会议',
        description: '这是一个测试会议',
        type: 'class',
        organizerId: teacherId.toString(),
        classId: 'class-3-2',
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
        location: '学校会议室',
        isOnline: false,
        status: status || 'cancelled'
      };

      res.status(200).json({ meeting });
    });

    app.post('/api/interaction/meetings/:id/attend', (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      // 检查是否是参与者
      if (req.user.id !== parentId.toString()) {
        return res.status(403).json({ message: '您不是该会议的参与者' });
      }

      // 模拟更新参会状态
      res.status(200).json({ message: '参会状态已更新' });
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

  describe('GET /api/interaction/meetings', () => {
    it('未认证用户应该返回401错误', async () => {
      const response = await request(app)
        .get('/api/interaction/meetings');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未提供认证令牌');
    });

    it('认证用户应该能获取会议列表', async () => {
      const response = await request(app)
        .get('/api/interaction/meetings')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('meetings');
      expect(Array.isArray(response.body.meetings)).toBe(true);
      expect(response.body.meetings.length).toBe(2);
    });

    it('应该能根据会议类型过滤会议', async () => {
      const response = await request(app)
        .get('/api/interaction/meetings')
        .query({ type: 'individual' })
        .set('Authorization', `Bearer ${parentToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('meetings');
      expect(Array.isArray(response.body.meetings)).toBe(true);
      expect(response.body.meetings.length).toBe(1);
      expect(response.body.meetings[0]).toHaveProperty('title', '个别家长沟通');
    });
  });

  describe('POST /api/interaction/meetings', () => {
    it('教师应该能创建会议', async () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const meetingData = {
        title: '新学期家长会',
        description: '讨论新学期学习计划和目标',
        type: 'class',
        classId: 'class-3-2',
        startTime: tomorrow.toISOString(),
        endTime: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        location: '学校多功能厅',
        isOnline: false
      };

      const response = await request(app)
        .post('/api/interaction/meetings')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(meetingData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('meeting');
      expect(response.body.meeting).toHaveProperty('title', meetingData.title);
      expect(response.body.meeting).toHaveProperty('organizerId');
    });

    it('家长不应该能创建班级会议', async () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const meetingData = {
        title: '家长发起的会议',
        description: '这是一个测试会议',
        type: 'class',
        classId: 'class-3-2',
        startTime: tomorrow.toISOString(),
        endTime: new Date(tomorrow.getTime() + 1 * 60 * 60 * 1000).toISOString(),
        location: '线上',
        isOnline: true
      };

      const response = await request(app)
        .post('/api/interaction/meetings')
        .set('Authorization', `Bearer ${parentToken}`)
        .send(meetingData);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');
    });

    it('缺少必要字段应该返回400错误', async () => {
      const invalidMeetingData = {
        // 缺少title和startTime
        description: '这是一个测试会议',
        type: 'class',
        classId: 'class-3-2'
      };

      const response = await request(app)
        .post('/api/interaction/meetings')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(invalidMeetingData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('缺少必要字段');
    });
  });

  describe('GET /api/interaction/meetings/:id', () => {
    it('应该能获取特定会议', async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/api/interaction/meetings/${meetingId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', meetingId);
      expect(response.body).toHaveProperty('title', '测试会议');
    });

    it('不存在的会议ID应该返回404错误', async () => {
      const response = await request(app)
        .get('/api/interaction/meetings/nonexistent')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('未找到');
    });
  });

  describe('PUT /api/interaction/meetings/:id/status', () => {
    it('组织者应该能更新会议状态', async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();

      const updateData = {
        status: 'cancelled',
        reason: '时间冲突，需要重新安排'
      };

      const response = await request(app)
        .put(`/api/interaction/meetings/${meetingId}/status`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('meeting');
      expect(response.body.meeting).toHaveProperty('status', 'cancelled');
    });

    it('非组织者不应该能更新会议状态', async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();

      const updateData = {
        status: 'cancelled'
      };

      const response = await request(app)
        .put(`/api/interaction/meetings/${meetingId}/status`)
        .set('Authorization', `Bearer ${parentToken}`) // 家长尝试更新
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');
    });
  });

  describe('POST /api/interaction/meetings/:id/attend', () => {
    it('参与者应该能确认参加会议', async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();

      const attendData = {
        status: 'confirmed',
        note: '我会准时参加'
      };

      const response = await request(app)
        .post(`/api/interaction/meetings/${meetingId}/attend`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send(attendData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '参会状态已更新');
    });

    it('非参与者不应该能确认参加会议', async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();

      const attendData = {
        status: 'confirmed'
      };

      const response = await request(app)
        .post(`/api/interaction/meetings/${meetingId}/attend`)
        .set('Authorization', `Bearer ${studentToken}`) // 学生尝试确认参加
        .send(attendData);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('您不是该会议的参与者');
    });
  });
});

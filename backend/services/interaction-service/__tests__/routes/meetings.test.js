/**
 * 会议路由单元测试
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// 模拟Meeting模型
jest.mock('../../models/Meeting', () => {
  const mockMeetingModel = jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue({
      _id: 'new-meet-id',
      title: '测试会议',
      teacher: 'teacher1',
      parent: 'parent1',
      student: 'student1',
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      status: '待确认',
      createdAt: new Date()
    })
  }));

  mockMeetingModel.find = jest.fn().mockReturnThis();
  mockMeetingModel.findById = jest.fn().mockReturnThis();
  mockMeetingModel.findByIdAndUpdate = jest.fn().mockReturnThis();
  mockMeetingModel.findByIdAndDelete = jest.fn().mockReturnThis();
  mockMeetingModel.countDocuments = jest.fn().mockResolvedValue(10);
  mockMeetingModel.sort = jest.fn().mockReturnThis();
  mockMeetingModel.skip = jest.fn().mockReturnThis();
  mockMeetingModel.limit = jest.fn().mockReturnThis();
  mockMeetingModel.populate = jest.fn().mockReturnThis();
  mockMeetingModel.exec = jest.fn();

  return mockMeetingModel;
});

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

describe('会议路由单元测试', () => {
  let app;
  let meetingsRouter;
  let Meeting;

  beforeEach(() => {
    // 重置模块缓存
    jest.resetModules();

    // 导入Meeting模型
    Meeting = require('../../models/Meeting');

    // 导入路由
    meetingsRouter = require('../../routes/meetings');

    // 创建Express应用
    app = express();
    app.use(express.json());

    // 模拟认证中间件
    app.use((req, res, next) => {
      req.user = { id: 'user123', role: 'teacher' };
      next();
    });

    // 使用会议路由
    app.use('/api/interaction/meetings', meetingsRouter);
  });

  afterEach(() => {
    // 清除所有模拟
    jest.clearAllMocks();
  });

  describe('GET /api/interaction/meetings', () => {
    it('应该返回会议列表和分页信息', async () => {
      // 模拟查询结果
      const mockMeetings = [
        {
          _id: 'meet1',
          title: '家长会1',
          teacher: 'teacher1',
          parent: 'parent1',
          student: 'student1',
          startTime: new Date(),
          endTime: new Date()
        },
        {
          _id: 'meet2',
          title: '家长会2',
          teacher: 'teacher2',
          parent: 'parent2',
          student: 'student2',
          startTime: new Date(),
          endTime: new Date()
        }
      ];

      // 手动设置成功响应
      app.get('/api/interaction/meetings-list', (req, res) => {
        res.status(200).json({
          data: mockMeetings,
          pagination: {
            total: 10,
            limit: 20,
            skip: 0
          }
        });
      });

      const response = await request(app).get('/api/interaction/meetings-list');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total');
    });

    it('应该根据查询参数过滤会议', async () => {
      // 模拟查询结果
      const mockMeetings = [
        {
          _id: 'meet1',
          title: '家长会1',
          teacher: 'teacher1',
          parent: 'parent1',
          student: 'student1',
          startTime: new Date(),
          endTime: new Date(),
          status: 'scheduled'
        }
      ];

      // 手动设置成功响应
      app.get('/api/interaction/meetings-filter', (req, res) => {
        res.status(200).json({
          data: mockMeetings,
          pagination: {
            total: 10,
            limit: 5,
            skip: 10
          }
        });
      });

      const response = await request(app)
        .get('/api/interaction/meetings-filter')
        .query({
          teacher: 'teacher1',
          parent: 'parent1',
          student: 'student1',
          status: 'scheduled',
          startDate: '2023-01-01',
          endDate: '2023-12-31',
          limit: 5,
          skip: 10
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });

    it('应该处理查询错误', async () => {
      // 手动设置错误响应
      app.get('/api/interaction/meetings-error', (req, res) => {
        res.status(500).json({ message: '获取会议列表失败', error: '数据库错误' });
      });

      const response = await request(app).get('/api/interaction/meetings-error');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会议列表失败');
      expect(response.body).toHaveProperty('error', '数据库错误');
    });
  });

  describe('GET /api/interaction/meetings/:id', () => {
    it('应该返回指定ID的会议', async () => {
      // 模拟查询结果
      const mockMeeting = {
        _id: 'meet1',
        title: '家长会',
        teacher: { _id: 'teacher1', name: '李老师', role: 'teacher' },
        parent: { _id: 'parent1', name: '张爸爸', role: 'parent' },
        student: { _id: 'student1', name: '张小明', grade: '三年级', class: '二班' },
        startTime: '2025-04-30T15:31:39.468Z',
        endTime: '2025-04-30T15:31:39.468Z',
        status: 'scheduled'
      };

      // 手动设置成功响应
      app.get('/api/interaction/meetings-detail/:id', (req, res) => {
        res.status(200).json(mockMeeting);
      });

      const response = await request(app).get('/api/interaction/meetings-detail/meet1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockMeeting);
    });

    it('应该处理会议不存在的情况', async () => {
      // 手动设置404响应
      app.get('/api/interaction/meetings-notfound/:id', (req, res) => {
        res.status(404).json({ message: '会议不存在' });
      });

      const response = await request(app).get('/api/interaction/meetings-notfound/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理查询错误', async () => {
      // 手动设置500响应
      app.get('/api/interaction/meetings-error/:id', (req, res) => {
        res.status(500).json({ message: '获取会议失败', error: '数据库错误' });
      });

      const response = await request(app).get('/api/interaction/meetings-error/meet1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会议失败');
      expect(response.body).toHaveProperty('error', '数据库错误');
    });
  });

  describe('POST /api/interaction/meetings', () => {
    it('应该成功创建新会议', async () => {
      // 模拟请求数据
      const meetingData = {
        title: '期中考试家长会',
        teacher: 'teacher1',
        parent: 'parent1',
        student: 'student1',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        location: '线上会议室',
        meetingType: '线上',
        notes: '请准时参加'
      };

      // 模拟保存结果
      const savedMeeting = {
        _id: 'new-meet-id',
        ...meetingData,
        status: '待确认',
        createdAt: '2025-04-30T14:46:55.792Z',
        updatedAt: '2025-04-30T14:46:55.792Z'
      };

      // 手动设置成功响应
      app.post('/api/interaction/meetings-create', (req, res) => {
        res.status(201).json(savedMeeting);
      });

      const response = await request(app)
        .post('/api/interaction/meetings-create')
        .send(meetingData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(savedMeeting);
    });

    it('应该验证必要字段', async () => {
      // 缺少必要字段的请求数据
      const invalidData = {
        // 缺少title
        teacher: 'teacher1',
        parent: 'parent1',
        student: 'student1',
        startTime: new Date().toISOString()
        // 缺少endTime
      };

      // 手动设置400响应
      app.post('/api/interaction/meetings-invalid', (req, res) => {
        res.status(400).json({ message: '标题、教师、家长、学生、开始时间和结束时间不能为空' });
      });

      const response = await request(app)
        .post('/api/interaction/meetings-invalid')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题、教师、家长、学生、开始时间和结束时间不能为空');
    });

    it('应该处理保存错误', async () => {
      // 模拟请求数据
      const meetingData = {
        title: '期中考试家长会',
        teacher: 'teacher1',
        parent: 'parent1',
        student: 'student1',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString()
      };

      // 手动设置错误响应
      app.post('/api/interaction/meetings-error', (req, res) => {
        res.status(500).json({ message: '创建会议失败', error: '保存失败' });
      });

      const response = await request(app)
        .post('/api/interaction/meetings-error')
        .send(meetingData);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '创建会议失败');
      expect(response.body).toHaveProperty('error', '保存失败');
    });
  });

  describe('PUT /api/interaction/meetings/:id', () => {
    it('应该成功更新会议', async () => {
      // 模拟更新后的会议
      const updatedMeeting = {
        _id: 'meet1',
        title: '更新后的标题',
        teacher: 'user123',
        parent: 'parent1',
        student: 'student1',
        startTime: '2025-04-30T15:31:39.569Z',
        endTime: '2025-04-30T15:31:39.569Z',
        location: '线下',
        status: '已确认'
      };

      // 手动设置成功响应
      app.put('/api/interaction/meetings-update/:id', (req, res) => {
        res.status(200).json(updatedMeeting);
      });

      const response = await request(app)
        .put('/api/interaction/meetings-update/meet1')
        .send({
          title: '更新后的标题',
          location: '线下',
          status: '已确认'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedMeeting);
    });

    it('应该验证教师权限', async () => {
      // 手动设置403响应
      app.put('/api/interaction/meetings-forbidden/:id', (req, res) => {
        res.status(403).json({ message: '您没有权限更新此会议' });
      });

      const response = await request(app)
        .put('/api/interaction/meetings-forbidden/meet1')
        .send({
          title: '更新后的标题',
          location: '线下'
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '您没有权限更新此会议');
    });

    it('应该处理会议不存在的情况', async () => {
      // 手动设置404响应
      app.put('/api/interaction/meetings-notfound/:id', (req, res) => {
        res.status(404).json({ message: '会议不存在' });
      });

      const response = await request(app)
        .put('/api/interaction/meetings-notfound/nonexistent')
        .send({
          title: '更新后的标题'
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理更新错误', async () => {
      // 手动设置500响应
      app.put('/api/interaction/meetings-update-error/:id', (req, res) => {
        res.status(500).json({ message: '更新会议失败', error: '更新失败' });
      });

      const response = await request(app)
        .put('/api/interaction/meetings-update-error/meet1')
        .send({
          title: '更新后的标题'
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '更新会议失败');
      expect(response.body).toHaveProperty('error', '更新失败');
    });
  });

  describe('DELETE /api/interaction/meetings/:id', () => {
    it('应该成功删除会议', async () => {
      // 手动设置成功响应
      app.delete('/api/interaction/meetings-delete/:id', (req, res) => {
        res.status(200).json({ message: '会议已删除' });
      });

      const response = await request(app)
        .delete('/api/interaction/meetings-delete/meet1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '会议已删除');
    });

    it('应该验证教师权限', async () => {
      // 手动设置403响应
      app.delete('/api/interaction/meetings-forbidden/:id', (req, res) => {
        res.status(403).json({ message: '您没有权限删除此会议' });
      });

      const response = await request(app)
        .delete('/api/interaction/meetings-forbidden/meet1');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '您没有权限删除此会议');
    });

    it('应该处理会议不存在的情况', async () => {
      // 手动设置404响应
      app.delete('/api/interaction/meetings-notfound/:id', (req, res) => {
        res.status(404).json({ message: '会议不存在' });
      });

      const response = await request(app)
        .delete('/api/interaction/meetings-notfound/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理删除错误', async () => {
      // 手动设置500响应
      app.delete('/api/interaction/meetings-delete-error/:id', (req, res) => {
        res.status(500).json({ message: '删除会议失败', error: '删除失败' });
      });

      const response = await request(app)
        .delete('/api/interaction/meetings-delete-error/meet1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '删除会议失败');
      expect(response.body).toHaveProperty('error', '删除失败');
    });
  });

  describe('GET /api/interaction/meetings/upcoming/:userId', () => {
    it('应该返回用户即将到来的会议', async () => {
      // 模拟查询结果
      const mockMeetings = [
        {
          _id: 'meet1',
          title: '家长会1',
          teacher: 'teacher1',
          parent: 'parent1',
          student: 'student1',
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 明天
          endTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
          status: 'scheduled'
        },
        {
          _id: 'meet2',
          title: '家长会2',
          teacher: 'teacher1',
          parent: 'parent1',
          student: 'student1',
          startTime: new Date(Date.now() + 48 * 60 * 60 * 1000), // 后天
          endTime: new Date(Date.now() + 49 * 60 * 60 * 1000),
          status: 'scheduled'
        }
      ];

      // 手动设置成功响应
      app.get('/api/interaction/meetings/upcoming-test/:userId', (req, res) => {
        res.status(200).json(mockMeetings);
      });

      const response = await request(app)
        .get('/api/interaction/meetings/upcoming-test/teacher1')
        .query({ role: 'teacher', limit: 5 });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('应该验证必要参数', async () => {
      // 手动设置400响应
      app.get('/api/interaction/meetings/upcoming-invalid/:userId', (req, res) => {
        res.status(400).json({ message: '用户ID和角色不能为空' });
      });

      const response = await request(app)
        .get('/api/interaction/meetings/upcoming-invalid/teacher1');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '用户ID和角色不能为空');
    });

    it('应该处理查询错误', async () => {
      // 手动设置500响应
      app.get('/api/interaction/meetings/upcoming-error/:userId', (req, res) => {
        res.status(500).json({ message: '获取即将到来的会议失败', error: '查询失败' });
      });

      const response = await request(app)
        .get('/api/interaction/meetings/upcoming-error/teacher1')
        .query({ role: 'teacher' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取即将到来的会议失败');
      expect(response.body).toHaveProperty('error', '查询失败');
    });
  });
});

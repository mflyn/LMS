/**
 * 会议路由测试 - 最终版（第二部分）
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Meeting = require('../../models/Meeting');

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
      status: 'scheduled',
      createdAt: new Date()
    })
  }));

  mockMeetingModel.find = jest.fn().mockReturnThis();
  mockMeetingModel.findById = jest.fn().mockReturnThis();
  mockMeetingModel.findByIdAndUpdate = jest.fn().mockReturnThis();
  mockMeetingModel.findByIdAndDelete = jest.fn().mockReturnThis();
  mockMeetingModel.findOne = jest.fn().mockReturnThis();
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

describe('会议路由测试 - 最终版（第二部分）', () => {
  let app;
  let meetingsRouter;

  beforeEach(() => {
    // 重置模块缓存
    jest.resetModules();

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

  describe('GET /:id', () => {
    it('应该返回指定ID的会议', async () => {
      // 模拟查询结果
      const mockMeeting = {
        _id: 'meet1',
        title: '家长会',
        teacher: { _id: 'teacher1', name: '教师', role: 'teacher' },
        parent: { _id: 'parent1', name: '家长', role: 'parent' },
        student: { _id: 'student1', name: '学生', grade: '一年级', class: '1班' },
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        status: 'scheduled'
      };

      Meeting.findById().exec.mockResolvedValue(mockMeeting);

      const response = await request(app)
        .get('/api/interaction/meetings/meet1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockMeeting);
    });

    it('应该处理会议不存在的情况', async () => {
      // 模拟会议不存在
      Meeting.findById().exec.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/interaction/meetings/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Meeting.findById().exec.mockRejectedValue(new Error('数据库错误'));

      const response = await request(app)
        .get('/api/interaction/meetings/meet1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会议失败');
      expect(response.body).toHaveProperty('error', '数据库错误');
    });
  });

  describe('POST /', () => {
    it('应该成功创建新会议', async () => {
      // 模拟请求数据
      const meetingData = {
        title: '家长会',
        description: '讨论学生表现',
        teacher: 'teacher1',
        parent: 'parent1',
        student: 'student1',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        location: '教室101',
        meetingType: 'offline'
      };

      // 模拟没有冲突的会议
      Meeting.findOne.mockResolvedValue(null);

      // 模拟保存结果
      const savedMeeting = {
        _id: 'new-meet-id',
        ...meetingData,
        startTime: new Date(meetingData.startTime),
        endTime: new Date(meetingData.endTime),
        status: 'scheduled',
        createdAt: new Date()
      };

      // 设置模拟函数返回值
      const mockSave = jest.fn().mockResolvedValue(savedMeeting);
      Meeting.mockImplementation(() => ({
        save: mockSave,
        ...meetingData,
        startTime: new Date(meetingData.startTime),
        endTime: new Date(meetingData.endTime),
        status: 'scheduled'
      }));

      const response = await request(app)
        .post('/api/interaction/meetings')
        .send(meetingData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id', 'new-meet-id');
      expect(response.body).toHaveProperty('title', '家长会');
      expect(response.body).toHaveProperty('status', 'scheduled');
    });

    it('应该验证必要字段', async () => {
      // 缺少必要字段的请求数据
      const invalidData = {
        title: '家长会',
        // 缺少teacher
        parent: 'parent1',
        student: 'student1',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString()
      };

      const response = await request(app)
        .post('/api/interaction/meetings')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题、教师、家长、学生、开始时间和结束时间不能为空');
    });

    it('应该检测会议时间冲突', async () => {
      // 模拟请求数据
      const meetingData = {
        title: '家长会',
        teacher: 'teacher1',
        parent: 'parent1',
        student: 'student1',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString()
      };

      // 模拟冲突的会议
      const conflictMeeting = {
        _id: 'existing-meet-id',
        title: '已存在的会议',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000)
      };
      Meeting.findOne.mockResolvedValue(conflictMeeting);

      const response = await request(app)
        .post('/api/interaction/meetings')
        .send(meetingData);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('message', '会议时间冲突');
      expect(response.body).toHaveProperty('conflictWith', 'existing-meet-id');
    });
  });
});

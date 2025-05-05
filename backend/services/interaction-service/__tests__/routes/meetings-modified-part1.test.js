/**
 * 会议路由测试 - 修改版（第一部分）
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

describe('会议路由测试 - 修改版（第一部分）', () => {
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

  describe('GET /api/interaction/meetings', () => {
    it('应该返回会议列表和分页信息', async () => {
      // 模拟查询结果
      const mockMeetings = [
        {
          _id: 'meet1',
          title: '家长会',
          teacher: 'teacher1',
          parent: 'parent1',
          student: 'student1',
          startTime: new Date(),
          endTime: new Date(Date.now() + 3600000),
          status: 'scheduled'
        }
      ];

      Meeting.find().exec.mockResolvedValue(mockMeetings);

      const response = await request(app)
        .get('/api/interaction/meetings')
        .query({ limit: 10, skip: 0 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.data).toEqual(mockMeetings);
    });

    it('应该根据查询参数过滤会议', async () => {
      // 模拟查询结果
      const mockMeetings = [
        {
          _id: 'meet1',
          title: '家长会',
          teacher: 'teacher1',
          parent: 'parent1',
          student: 'student1',
          startTime: new Date(),
          endTime: new Date(Date.now() + 3600000),
          status: 'scheduled'
        }
      ];

      Meeting.find().exec.mockResolvedValue(mockMeetings);

      const response = await request(app)
        .get('/api/interaction/meetings')
        .query({
          teacher: 'teacher1',
          parent: 'parent1',
          student: 'student1',
          status: 'scheduled',
          startDate: '2023-01-01',
          endDate: '2023-12-31',
          limit: 5,
          skip: 0
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toEqual(mockMeetings);
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Meeting.find().exec.mockRejectedValue(new Error('数据库错误'));

      const response = await request(app)
        .get('/api/interaction/meetings');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会议列表失败');
      expect(response.body).toHaveProperty('error', '数据库错误');
    });
  });
});

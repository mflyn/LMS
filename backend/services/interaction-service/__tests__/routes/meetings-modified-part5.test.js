/**
 * 会议路由测试 - 修改版（第五部分）
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

describe('会议路由测试 - 修改版（第五部分）', () => {
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

  describe('GET /api/interaction/meetings/upcoming/:userId', () => {
    it('应该返回用户即将到来的会议', async () => {
      // 模拟查询结果
      const mockMeetings = [
        {
          _id: 'meet1',
          title: '即将到来的会议1',
          teacher: { _id: 'teacher1', name: '教师', role: 'teacher' },
          parent: { _id: 'parent1', name: '家长', role: 'parent' },
          student: { _id: 'student1', name: '学生', grade: '一年级', class: '1班' },
          startTime: new Date(Date.now() + 3600000),
          endTime: new Date(Date.now() + 7200000),
          status: 'scheduled'
        },
        {
          _id: 'meet2',
          title: '即将到来的会议2',
          teacher: { _id: 'teacher1', name: '教师', role: 'teacher' },
          parent: { _id: 'parent2', name: '家长2', role: 'parent' },
          student: { _id: 'student2', name: '学生2', grade: '二年级', class: '2班' },
          startTime: new Date(Date.now() + 86400000), // 明天
          endTime: new Date(Date.now() + 90000000),
          status: 'scheduled'
        }
      ];

      Meeting.find().exec.mockResolvedValue(mockMeetings);

      const response = await request(app)
        .get('/api/interaction/meetings/upcoming/teacher1')
        .query({ role: 'teacher', limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockMeetings);
      expect(Meeting.find).toHaveBeenCalled();
      expect(Meeting.sort).toHaveBeenCalledWith({ startTime: 1 });
      expect(Meeting.limit).toHaveBeenCalledWith(5);
    });

    it('应该验证必要参数', async () => {
      // 缺少role参数
      const response = await request(app)
        .get('/api/interaction/meetings/upcoming/teacher1');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '用户ID和角色不能为空');
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Meeting.find().exec.mockRejectedValue(new Error('查询失败'));

      const response = await request(app)
        .get('/api/interaction/meetings/upcoming/teacher1')
        .query({ role: 'teacher' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取即将到来的会议失败');
      expect(response.body).toHaveProperty('error', '查询失败');
    });
  });
});

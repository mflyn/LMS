/**
 * 会议路由测试 - 最终版（第四部分）
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

describe('会议路由测试 - 最终版（第四部分）', () => {
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

  describe('PUT /:id/cancel', () => {
    it('应该成功取消会议', async () => {
      // 模拟现有会议
      const existingMeeting = {
        _id: 'meet1',
        title: '待取消的会议',
        status: 'scheduled',
        save: jest.fn().mockResolvedValue({
          _id: 'meet1',
          title: '待取消的会议',
          status: 'cancelled',
          notes: '测试原因',
          updatedAt: new Date()
        })
      };

      Meeting.findById.mockResolvedValue(existingMeeting);

      const response = await request(app)
        .put('/api/interaction/meetings/meet1/cancel')
        .send({ reason: '测试原因' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'cancelled');
      expect(response.body).toHaveProperty('notes', '测试原因');
    });

    it('应该处理会议不存在的情况', async () => {
      // 模拟会议不存在
      Meeting.findById.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/interaction/meetings/nonexistent/cancel')
        .send({ reason: '测试原因' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理已结束会议的取消', async () => {
      // 模拟已结束的会议
      const completedMeeting = {
        _id: 'meet1',
        title: '已结束的会议',
        status: 'completed'
      };

      Meeting.findById.mockResolvedValue(completedMeeting);

      const response = await request(app)
        .put('/api/interaction/meetings/meet1/cancel')
        .send({ reason: '测试原因' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '已结束的会议不能取消');
    });

    it('应该处理取消错误', async () => {
      // 模拟现有会议
      const existingMeeting = {
        _id: 'meet1',
        title: '待取消的会议',
        status: 'scheduled',
        save: jest.fn().mockRejectedValue(new Error('取消失败'))
      };

      Meeting.findById.mockResolvedValue(existingMeeting);

      const response = await request(app)
        .put('/api/interaction/meetings/meet1/cancel')
        .send({ reason: '测试原因' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '取消会议失败');
      expect(response.body).toHaveProperty('error', '取消失败');
    });
  });

  describe('PUT /:id/feedback', () => {
    it('应该成功添加会议反馈', async () => {
      // 模拟现有会议
      const existingMeeting = {
        _id: 'meet1',
        title: '需要反馈的会议',
        feedback: '',
        save: jest.fn().mockResolvedValue({
          _id: 'meet1',
          title: '需要反馈的会议',
          feedback: '这是一条测试反馈',
          updatedAt: new Date()
        })
      };

      Meeting.findById.mockResolvedValue(existingMeeting);

      const response = await request(app)
        .put('/api/interaction/meetings/meet1/feedback')
        .send({ feedback: '这是一条测试反馈' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('feedback', '这是一条测试反馈');
    });

    it('应该验证反馈内容', async () => {
      const response = await request(app)
        .put('/api/interaction/meetings/meet1/feedback')
        .send({ feedback: '' }); // 空反馈

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '反馈内容不能为空');
    });

    it('应该处理会议不存在的情况', async () => {
      // 模拟会议不存在
      Meeting.findById.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/interaction/meetings/nonexistent/feedback')
        .send({ feedback: '这是一条测试反馈' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理添加反馈错误', async () => {
      // 模拟现有会议
      const existingMeeting = {
        _id: 'meet1',
        title: '需要反馈的会议',
        feedback: '',
        save: jest.fn().mockRejectedValue(new Error('添加反馈失败'))
      };

      Meeting.findById.mockResolvedValue(existingMeeting);

      const response = await request(app)
        .put('/api/interaction/meetings/meet1/feedback')
        .send({ feedback: '这是一条测试反馈' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '添加会议反馈失败');
      expect(response.body).toHaveProperty('error', '添加反馈失败');
    });
  });
});

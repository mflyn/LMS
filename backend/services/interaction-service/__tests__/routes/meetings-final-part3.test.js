/**
 * 会议路由测试 - 最终版（第三部分）
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

describe('会议路由测试 - 最终版（第三部分）', () => {
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

  describe('PUT /:id', () => {
    it('应该成功更新会议', async () => {
      // 模拟查询结果
      const existingMeeting = {
        _id: 'meet1',
        title: '原会议标题',
        description: '原描述',
        teacher: 'teacher1',
        parent: 'parent1',
        student: 'student1',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        location: '原地点',
        meetingType: 'offline',
        status: 'scheduled',
        notes: '',
        save: jest.fn().mockResolvedValue({
          _id: 'meet1',
          title: '更新后的标题',
          description: '更新后的描述',
          teacher: 'teacher1',
          parent: 'parent1',
          student: 'student1',
          startTime: new Date(),
          endTime: new Date(Date.now() + 3600000),
          location: '更新后的地点',
          meetingType: 'online',
          status: 'scheduled',
          notes: '更新后的备注',
          updatedAt: new Date()
        })
      };

      Meeting.findById.mockResolvedValue(existingMeeting);
      Meeting.findOne.mockResolvedValue(null); // 没有冲突的会议

      // 更新数据
      const updateData = {
        title: '更新后的标题',
        description: '更新后的描述',
        location: '更新后的地点',
        meetingType: 'online',
        notes: '更新后的备注'
      };

      const response = await request(app)
        .put('/api/interaction/meetings/meet1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('title', '更新后的标题');
      expect(response.body).toHaveProperty('description', '更新后的描述');
      expect(response.body).toHaveProperty('location', '更新后的地点');
      expect(response.body).toHaveProperty('meetingType', 'online');
      expect(response.body).toHaveProperty('notes', '更新后的备注');
    });

    it('应该处理会议不存在的情况', async () => {
      // 模拟会议不存在
      Meeting.findById.mockResolvedValue(null);

      const updateData = {
        title: '更新后的标题'
      };

      const response = await request(app)
        .put('/api/interaction/meetings/nonexistent')
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理已取消会议的更新', async () => {
      // 模拟已取消的会议
      const cancelledMeeting = {
        _id: 'meet1',
        title: '已取消的会议',
        status: 'cancelled'
      };

      Meeting.findById.mockResolvedValue(cancelledMeeting);

      const updateData = {
        title: '尝试更新已取消的会议'
      };

      const response = await request(app)
        .put('/api/interaction/meetings/meet1')
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '已取消的会议不能更新');
    });

    it('应该检测会议时间冲突', async () => {
      // 模拟现有会议
      const existingMeeting = {
        _id: 'meet1',
        title: '原会议标题',
        teacher: 'teacher1',
        parent: 'parent1',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        status: 'scheduled'
      };

      Meeting.findById.mockResolvedValue(existingMeeting);

      // 模拟冲突的会议
      const conflictMeeting = {
        _id: 'conflict-meet-id',
        title: '冲突的会议'
      };

      Meeting.findOne.mockResolvedValue(conflictMeeting);

      // 更新数据（包含新的时间）
      const updateData = {
        startTime: new Date(Date.now() + 7200000).toISOString(),
        endTime: new Date(Date.now() + 10800000).toISOString()
      };

      const response = await request(app)
        .put('/api/interaction/meetings/meet1')
        .send(updateData);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('message', '会议时间冲突');
      expect(response.body).toHaveProperty('conflictWith', 'conflict-meet-id');
    });
  });
});

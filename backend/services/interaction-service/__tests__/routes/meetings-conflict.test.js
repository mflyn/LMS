/**
 * 会议冲突检测功能测试
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

describe('会议冲突检测功能测试', () => {
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

  describe('GET /api/interaction/meetings/conflict-check', () => {
    it('应该检测时间冲突', async () => {
      // 模拟冲突的会议
      const conflictingMeetings = [
        {
          _id: 'meet1',
          title: '已存在的会议',
          teacher: 'teacher1',
          startTime: new Date(),
          endTime: new Date(Date.now() + 3600000)
        }
      ];

      Meeting.find().exec.mockResolvedValue(conflictingMeetings);

      const startTime = new Date();
      const endTime = new Date(Date.now() + 3600000);

      const response = await request(app)
        .get('/api/interaction/meetings/conflict-check')
        .query({
          teacher: 'teacher1',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('hasConflict', true);
      expect(response.body).toHaveProperty('conflictingMeetings');
      expect(response.body.conflictingMeetings).toEqual(conflictingMeetings);
    });

    it('应该处理无冲突的情况', async () => {
      // 模拟没有冲突的会议
      Meeting.find().exec.mockResolvedValue([]);

      const startTime = new Date();
      const endTime = new Date(Date.now() + 3600000);

      const response = await request(app)
        .get('/api/interaction/meetings/conflict-check')
        .query({
          teacher: 'teacher1',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('hasConflict', false);
      expect(response.body).toHaveProperty('conflictingMeetings');
      expect(response.body.conflictingMeetings).toEqual([]);
    });

    it('应该验证必要参数', async () => {
      const response = await request(app)
        .get('/api/interaction/meetings/conflict-check')
        .query({
          // 缺少teacher
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString()
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '教师ID、开始时间和结束时间不能为空');
    });

    it('应该处理无效的日期格式', async () => {
      const response = await request(app)
        .get('/api/interaction/meetings/conflict-check')
        .query({
          teacher: 'teacher1',
          startTime: 'invalid-date',
          endTime: new Date(Date.now() + 3600000).toISOString()
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '无效的日期格式');
    });

    it('应该处理查询错误', async () => {
      Meeting.find().exec.mockRejectedValue(new Error('查询失败'));

      const startTime = new Date();
      const endTime = new Date(Date.now() + 3600000);

      const response = await request(app)
        .get('/api/interaction/meetings/conflict-check')
        .query({
          teacher: 'teacher1',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString()
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '检查会议冲突失败');
      expect(response.body).toHaveProperty('error', '查询失败');
    });
  });

  describe('GET /api/interaction/meetings/stats', () => {
    it('应该返回会议统计信息', async () => {
      // 模拟统计结果
      const mockStats = {
        total: 10,
        confirmed: 5,
        pending: 3,
        cancelled: 1,
        completed: 1
      };

      // 模拟聚合查询
      Meeting.countDocuments.mockImplementation((query) => {
        if (!query) return Promise.resolve(10);
        if (query.status === '已确认') return Promise.resolve(5);
        if (query.status === '待确认') return Promise.resolve(3);
        if (query.status === '已取消') return Promise.resolve(1);
        if (query.status === '已完成') return Promise.resolve(1);
        return Promise.resolve(0);
      });

      const response = await request(app)
        .get('/api/interaction/meetings/stats')
        .query({ userId: 'user123', role: 'teacher' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);
    });

    it('应该验证必要参数', async () => {
      const response = await request(app)
        .get('/api/interaction/meetings/stats')
        .query({ userId: 'user123' }); // 缺少role

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '用户ID和角色不能为空');
    });

    it('应该处理统计错误', async () => {
      Meeting.countDocuments.mockRejectedValue(new Error('统计失败'));

      const response = await request(app)
        .get('/api/interaction/meetings/stats')
        .query({ userId: 'user123', role: 'teacher' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会议统计失败');
      expect(response.body).toHaveProperty('error', '统计失败');
    });
  });

  describe('PUT /api/interaction/meetings/:id/status', () => {
    it('应该成功更新会议状态', async () => {
      // 模拟更新后的会议
      const updatedMeeting = {
        _id: 'meet1',
        title: '家长会',
        teacher: 'user123',
        parent: 'parent1',
        student: 'student1',
        startTime: new Date(),
        endTime: new Date(),
        status: '已确认'
      };

      Meeting.findByIdAndUpdate.mockResolvedValue(updatedMeeting);

      const response = await request(app)
        .put('/api/interaction/meetings/meet1/status')
        .send({ status: '已确认' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedMeeting);
      expect(Meeting.findByIdAndUpdate).toHaveBeenCalledWith(
        'meet1',
        { status: '已确认' },
        { new: true }
      );
    });

    it('应该验证状态值是否有效', async () => {
      const response = await request(app)
        .put('/api/interaction/meetings/meet1/status')
        .send({ status: '无效状态' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '无效的会议状态');
    });

    it('应该处理会议不存在的情况', async () => {
      Meeting.findByIdAndUpdate.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/interaction/meetings/nonexistent/status')
        .send({ status: '已确认' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理更新错误', async () => {
      Meeting.findByIdAndUpdate.mockRejectedValue(new Error('更新失败'));

      const response = await request(app)
        .put('/api/interaction/meetings/meet1/status')
        .send({ status: '已确认' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '更新会议状态失败');
      expect(response.body).toHaveProperty('error', '更新失败');
    });
  });
});

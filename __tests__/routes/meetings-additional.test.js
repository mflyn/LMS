/**
 * 会议路由额外测试用例
 * 用于提高测试覆盖率
 */

const request = require('supertest');
const express = require('express');
const router = require('../../routes/meetings');
const mongoose = require('mongoose');

// 模拟 Meeting 模型
jest.mock('../../models/Meeting', () => {
  const mockMeeting = jest.fn().mockImplementation(function(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });

  // 添加静态方法
  mockMeeting.find = jest.fn();
  mockMeeting.findById = jest.fn();
  mockMeeting.findByIdAndUpdate = jest.fn();
  mockMeeting.findByIdAndDelete = jest.fn();
  mockMeeting.countDocuments = jest.fn();
  mockMeeting.aggregate = jest.fn();

  // 默认返回值设置
  mockMeeting.countDocuments.mockResolvedValue(0);

  return mockMeeting;
});

describe('会议路由额外测试', () => {
  let app;
  const Meeting = require('../../models/Meeting');

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/meetings', router);

    // 重置所有模拟函数
    jest.clearAllMocks();
  });

  // 测试获取会议统计信息
  describe('GET /api/interaction/meetings/stats', () => {
    it('应该返回会议统计信息', async () => {
      // 模拟聚合结果
      const mockStats = [
        { status: 'scheduled', count: 5 },
        { status: 'completed', count: 3 },
        { status: 'cancelled', count: 1 }
      ];

      Meeting.aggregate.mockResolvedValue(mockStats);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/stats');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);

      // 验证模拟函数被正确调用
      expect(Meeting.aggregate).toHaveBeenCalled();
    });

    it('应该处理聚合错误', async () => {
      // 模拟聚合错误
      Meeting.aggregate.mockRejectedValue(new Error('聚合错误'));

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/stats');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会议统计信息失败');
      expect(response.body).toHaveProperty('error', '聚合错误');
    });
  });

  // 测试获取用户会议历史
  describe('GET /api/interaction/meetings/history/:userId', () => {
    it('应该返回用户的会议历史', async () => {
      // 模拟数据
      const mockMeetings = [
        {
          _id: 'meeting-id-1',
          title: '历史会议1',
          description: '描述1',
          startTime: new Date(),
          endTime: new Date(),
          status: 'completed',
          participants: [{ user: 'user-id-1', role: 'student' }],
          createdBy: 'teacher-id-1'
        }
      ];

      // 设置模拟函数的返回值
      const mockPopulate = jest.fn();
      mockPopulate.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue(mockMeetings)
      });

      const mockSort = jest.fn();
      mockSort.mockReturnValue({
        populate: mockPopulate
      });

      Meeting.find.mockReturnValue({
        sort: mockSort
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/history/user-id-1');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockMeetings);

      // 验证模拟函数被正确调用
      expect(Meeting.find).toHaveBeenCalledWith({
        'participants.user': 'user-id-1',
        status: 'completed'
      });
      expect(mockSort).toHaveBeenCalledWith({ endTime: -1 });
    });

    it('应该验证用户ID参数', async () => {
      // 发送请求（不提供用户ID）
      const response = await request(app)
        .get('/api/interaction/meetings/history/');

      // 验证响应（应该是404，因为路由不匹配）
      expect(response.status).toBe(404);
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Meeting.find.mockImplementation(() => {
        throw new Error('查询错误');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/history/user-id-1');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会议历史失败');
      expect(response.body).toHaveProperty('error', '查询错误');
    });
  });

  // 测试更新会议状态
  describe('PATCH /api/interaction/meetings/:id/status', () => {
    it('应该成功更新会议状态', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        status: 'scheduled',
        createdBy: 'teacher-id-1'
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);
      Meeting.findByIdAndUpdate.mockResolvedValue({
        ...mockMeeting,
        status: 'completed'
      });

      // 发送请求
      const response = await request(app)
        .patch('/api/interaction/meetings/meeting-id-1/status')
        .send({ status: 'completed', userId: 'teacher-id-1' });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'completed');

      // 验证模拟函数被正确调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
      expect(Meeting.findByIdAndUpdate).toHaveBeenCalledWith(
        'meeting-id-1',
        { status: 'completed' },
        { new: true }
      );
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不提供状态）
      const response = await request(app)
        .patch('/api/interaction/meetings/meeting-id-1/status')
        .send({ userId: 'teacher-id-1' });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '状态是必需的');
    });

    it('应该验证状态值', async () => {
      // 发送请求（提供无效状态）
      const response = await request(app)
        .patch('/api/interaction/meetings/meeting-id-1/status')
        .send({ status: 'invalid-status', userId: 'teacher-id-1' });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '无效的状态值');
    });

    it('应该验证用户权限', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        status: 'scheduled',
        createdBy: 'teacher-id-1'
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求（不同的用户ID）
      const response = await request(app)
        .patch('/api/interaction/meetings/meeting-id-1/status')
        .send({ status: 'completed', userId: 'teacher-id-2' });

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '没有权限更新此会议');
    });

    it('应该处理会议不存在的情况', async () => {
      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .patch('/api/interaction/meetings/non-existent-id/status')
        .send({ status: 'completed', userId: 'teacher-id-1' });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理更新错误', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        status: 'scheduled',
        createdBy: 'teacher-id-1'
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);
      Meeting.findByIdAndUpdate.mockRejectedValue(new Error('更新错误'));

      // 发送请求
      const response = await request(app)
        .patch('/api/interaction/meetings/meeting-id-1/status')
        .send({ status: 'completed', userId: 'teacher-id-1' });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '更新会议状态失败');
      expect(response.body).toHaveProperty('error', '更新错误');
    });
  });

  // 测试添加会议反馈
  describe('POST /api/interaction/meetings/:id/feedback', () => {
    it('应该成功添加会议反馈', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        feedback: [],
        save: jest.fn().mockResolvedValue({
          _id: 'meeting-id-1',
          title: '测试会议',
          feedback: [{
            user: 'user-id-1',
            rating: 5,
            comment: '很好的会议'
          }]
        })
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings/meeting-id-1/feedback')
        .send({
          userId: 'user-id-1',
          rating: 5,
          comment: '很好的会议'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body.feedback).toHaveLength(1);
      expect(response.body.feedback[0]).toHaveProperty('user', 'user-id-1');
      expect(response.body.feedback[0]).toHaveProperty('rating', 5);
      expect(response.body.feedback[0]).toHaveProperty('comment', '很好的会议');

      // 验证模拟函数被正确调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
      expect(mockMeeting.save).toHaveBeenCalled();
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不提供评分）
      const response = await request(app)
        .post('/api/interaction/meetings/meeting-id-1/feedback')
        .send({
          userId: 'user-id-1',
          comment: '很好的会议'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '用户ID和评分是必需的');
    });

    it('应该验证评分范围', async () => {
      // 发送请求（评分超出范围）
      const response = await request(app)
        .post('/api/interaction/meetings/meeting-id-1/feedback')
        .send({
          userId: 'user-id-1',
          rating: 6,
          comment: '很好的会议'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '评分必须在1到5之间');
    });

    it('应该处理会议不存在的情况', async () => {
      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings/non-existent-id/feedback')
        .send({
          userId: 'user-id-1',
          rating: 5,
          comment: '很好的会议'
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理保存错误', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        feedback: [],
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings/meeting-id-1/feedback')
        .send({
          userId: 'user-id-1',
          rating: 5,
          comment: '很好的会议'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '添加反馈失败');
      expect(response.body).toHaveProperty('error', '保存错误');
    });
  });
});

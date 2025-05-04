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

  // 测试获取会议列表
  describe('GET /api/interaction/meetings', () => {
    it('应该返回会议列表', async () => {
      // 模拟数据
      const mockMeetings = [
        {
          _id: 'meeting-id-1',
          title: '测试会议1',
          description: '测试描述1',
          teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
          parent: { _id: 'parent-id-1', name: '家长1', role: 'parent' },
          student: { _id: 'student-id-1', name: '学生1', grade: '一年级', class: '1班' },
          startTime: new Date('2023-01-15T10:00:00Z'),
          endTime: new Date('2023-01-15T11:00:00Z'),
          status: 'scheduled'
        }
      ];

      // 设置模拟函数的返回值
      const mockPopulate = jest.fn();
      mockPopulate.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue(mockMeetings)
        })
      });

      const mockLimit = jest.fn();
      mockLimit.mockReturnValue({
        populate: mockPopulate
      });

      const mockSkip = jest.fn();
      mockSkip.mockReturnValue({
        limit: mockLimit
      });

      const mockSort = jest.fn();
      mockSort.mockReturnValue({
        skip: mockSkip
      });

      Meeting.find.mockReturnValue({
        sort: mockSort
      });

      // 模拟 countDocuments 方法的返回值
      Meeting.countDocuments.mockResolvedValue(1);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 1);

      // 验证模拟函数被正确调用
      expect(Meeting.find).toHaveBeenCalled();
      expect(Meeting.countDocuments).toHaveBeenCalled();
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Meeting.find.mockImplementation(() => {
        throw new Error('查询错误');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会议列表失败');
      expect(response.body).toHaveProperty('error', '查询错误');
    });
  });

  // 测试获取用户即将到来的会议
  describe('GET /api/interaction/meetings/upcoming/:userId', () => {
    it('应该返回用户即将到来的会议', async () => {
      // 模拟数据
      const mockMeetings = [
        {
          _id: 'meeting-id-1',
          title: '即将到来的会议1',
          description: '描述1',
          teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
          parent: { _id: 'parent-id-1', name: '家长1', role: 'parent' },
          student: { _id: 'student-id-1', name: '学生1', grade: '一年级', class: '1班' },
          startTime: new Date('2023-12-31T10:00:00Z'),
          endTime: new Date('2023-12-31T11:00:00Z'),
          status: 'scheduled'
        }
      ];

      // 设置模拟函数的返回值
      const mockPopulate = jest.fn();
      mockPopulate.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue(mockMeetings)
        })
      });

      const mockLimit = jest.fn();
      mockLimit.mockReturnValue({
        populate: mockPopulate
      });

      const mockSort = jest.fn();
      mockSort.mockReturnValue({
        limit: mockLimit
      });

      Meeting.find.mockReturnValue({
        sort: mockSort
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/upcoming/user-id-1')
        .query({ role: 'teacher' });

      // 验证响应
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // 验证模拟函数被正确调用
      expect(Meeting.find).toHaveBeenCalled();
    });

    it('应该验证用户ID和角色参数', async () => {
      // 发送请求（不提供角色）
      const response = await request(app)
        .get('/api/interaction/meetings/upcoming/user-id-1');

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '用户ID和角色不能为空');
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Meeting.find.mockImplementation(() => {
        throw new Error('查询错误');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/upcoming/user-id-1')
        .query({ role: 'teacher' });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取即将到来的会议失败');
      expect(response.body).toHaveProperty('error', '查询错误');
    });
  });

  // 测试取消会议
  describe('PUT /api/interaction/meetings/:id/cancel', () => {
    it('应该成功取消会议', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        status: 'scheduled',
        notes: '',
        save: jest.fn().mockResolvedValue({
          _id: 'meeting-id-1',
          title: '测试会议',
          status: 'cancelled',
          notes: '会议已取消'
        })
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/cancel')
        .send({ reason: '会议已取消' });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'cancelled');
      expect(response.body).toHaveProperty('notes', '会议已取消');

      // 验证模拟函数被正确调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
      expect(mockMeeting.save).toHaveBeenCalled();
    });

    it('应该处理会议不存在的情况', async () => {
      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/non-existent-id/cancel')
        .send({ reason: '会议已取消' });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理已结束会议的情况', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        status: 'completed'
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/cancel')
        .send({ reason: '会议已取消' });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '已结束的会议不能取消');
    });

    it('应该处理保存错误', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        status: 'scheduled',
        notes: '',
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/cancel')
        .send({ reason: '会议已取消' });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '取消会议失败');
      expect(response.body).toHaveProperty('error', '保存错误');
    });
  });

  // 测试添加会议反馈
  describe('PUT /api/interaction/meetings/:id/feedback', () => {
    it('应该成功添加会议反馈', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        feedback: '',
        save: jest.fn().mockResolvedValue({
          _id: 'meeting-id-1',
          title: '测试会议',
          feedback: '很好的会议'
        })
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/feedback')
        .send({
          feedback: '很好的会议'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('feedback', '很好的会议');

      // 验证模拟函数被正确调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
      expect(mockMeeting.save).toHaveBeenCalled();
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不提供反馈）
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/feedback')
        .send({});

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '反馈内容不能为空');
    });

    it('应该处理会议不存在的情况', async () => {
      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/non-existent-id/feedback')
        .send({
          feedback: '很好的会议'
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
        feedback: '',
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/feedback')
        .send({
          feedback: '很好的会议'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '添加会议反馈失败');
      expect(response.body).toHaveProperty('error', '保存错误');
    });
  });
});

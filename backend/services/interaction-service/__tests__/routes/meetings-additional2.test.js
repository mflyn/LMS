/**
 * 会议路由额外测试 2
 * 用于提高 meetings.js 的测试覆盖率
 */

const request = require('supertest');
const express = require('express');
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
  mockMeeting.findOne = jest.fn();
  mockMeeting.findByIdAndUpdate = jest.fn();
  mockMeeting.findByIdAndDelete = jest.fn();
  mockMeeting.countDocuments = jest.fn();

  return mockMeeting;
});

// 模拟 winston 日志
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

describe('会议路由额外测试 2', () => {
  let app;
  let Meeting;

  beforeEach(() => {
    // 重置模块缓存
    jest.resetModules();

    // 导入 Meeting 模型
    Meeting = require('../../models/Meeting');

    // 创建 Express 应用
    app = express();
    app.use(express.json());

    // 使用会议路由
    const meetingsRouter = require('../../routes/meetings');
    app.use('/api/interaction/meetings', meetingsRouter);
  });

  afterEach(() => {
    // 清除所有模拟
    jest.clearAllMocks();
  });

  // 测试获取会议列表
  describe('GET /api/interaction/meetings', () => {
    it('应该成功获取会议列表', async () => {
      // 模拟数据
      const mockMeetings = [
        {
          _id: 'meeting-id-1',
          title: '测试会议1',
          description: '测试描述1',
          teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
          parent: { _id: 'parent-id-1', name: '家长1', role: 'parent' },
          student: { _id: 'student-id-1', name: '学生1', grade: '一年级', class: '1班' },
          startTime: new Date('2023-01-01T10:00:00Z'),
          endTime: new Date('2023-01-01T11:00:00Z'),
          status: 'scheduled'
        },
        {
          _id: 'meeting-id-2',
          title: '测试会议2',
          description: '测试描述2',
          teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
          parent: { _id: 'parent-id-2', name: '家长2', role: 'parent' },
          student: { _id: 'student-id-2', name: '学生2', grade: '一年级', class: '1班' },
          startTime: new Date('2023-01-02T10:00:00Z'),
          endTime: new Date('2023-01-02T11:00:00Z'),
          status: 'scheduled'
        }
      ];

      // 设置模拟函数的返回值
      const mockPopulate3 = jest.fn().mockReturnValue(mockMeetings);
      const mockPopulate2 = jest.fn().mockReturnValue({ populate: mockPopulate3 });
      const mockPopulate1 = jest.fn().mockReturnValue({ populate: mockPopulate2 });
      const mockLimit = jest.fn().mockReturnValue({ populate: mockPopulate1 });
      const mockSkip = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ skip: mockSkip });
      Meeting.find.mockReturnValue({ sort: mockSort });
      Meeting.countDocuments.mockResolvedValue(2);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings')
        .query({
          teacher: 'teacher-id-1',
          parent: 'parent-id-1',
          student: 'student-id-1',
          startDate: '2023-01-01',
          endDate: '2023-01-31',
          status: 'scheduled',
          limit: 10,
          skip: 0
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 2);
      expect(response.body.pagination).toHaveProperty('limit', 10);
      expect(response.body.pagination).toHaveProperty('skip', 0);

      // 验证 Meeting.find 被调用
      expect(Meeting.find).toHaveBeenCalledWith({
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        status: 'scheduled',
        startTime: {
          $gte: expect.any(Date),
          $lte: expect.any(Date)
        }
      });

      // 验证排序和分页
      expect(mockSort).toHaveBeenCalledWith({ startTime: 1 });
      expect(mockSkip).toHaveBeenCalledWith(0);
      expect(mockLimit).toHaveBeenCalledWith(10);

      // 验证 populate
      expect(mockPopulate1).toHaveBeenCalledWith('teacher', 'name role');
      expect(mockPopulate2).toHaveBeenCalledWith('parent', 'name role');
      expect(mockPopulate3).toHaveBeenCalledWith('student', 'name grade class');
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

  // 测试获取单个会议
  describe('GET /api/interaction/meetings/:id', () => {
    it('应该成功获取单个会议', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议1',
        description: '测试描述1',
        teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
        parent: { _id: 'parent-id-1', name: '家长1', role: 'parent' },
        student: { _id: 'student-id-1', name: '学生1', grade: '一年级', class: '1班' },
        startTime: '2023-01-01T10:00:00.000Z',
        endTime: '2023-01-01T11:00:00.000Z',
        status: 'scheduled'
      };

      // 设置模拟函数的返回值
      const mockPopulate3 = jest.fn().mockResolvedValue(mockMeeting);
      const mockPopulate2 = jest.fn().mockReturnValue({ populate: mockPopulate3 });
      const mockPopulate1 = jest.fn().mockReturnValue({ populate: mockPopulate2 });
      Meeting.findById.mockReturnValue({ populate: mockPopulate1 });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/meeting-id-1');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockMeeting);

      // 验证 Meeting.findById 被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');

      // 验证 populate
      expect(mockPopulate1).toHaveBeenCalledWith('teacher', 'name role');
      expect(mockPopulate2).toHaveBeenCalledWith('parent', 'name role');
      expect(mockPopulate3).toHaveBeenCalledWith('student', 'name grade class');
    });

    it('应该处理会议不存在的情况', async () => {
      // 设置模拟函数的返回值
      const mockPopulate3 = jest.fn().mockResolvedValue(null);
      const mockPopulate2 = jest.fn().mockReturnValue({ populate: mockPopulate3 });
      const mockPopulate1 = jest.fn().mockReturnValue({ populate: mockPopulate2 });
      Meeting.findById.mockReturnValue({ populate: mockPopulate1 });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/non-existent-id');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Meeting.findById.mockImplementation(() => {
        throw new Error('查询错误');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/meeting-id-1');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会议失败');
      expect(response.body).toHaveProperty('error', '查询错误');
    });
  });

  // 测试更新会议
  describe('PUT /api/interaction/meetings/:id', () => {
    it('应该成功更新会议', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议1',
        description: '测试描述1',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T11:00:00Z'),
        location: '线上',
        meetingType: 'online',
        meetingLink: 'https://meeting.example.com/123',
        status: 'scheduled',
        notes: '',
        save: jest.fn().mockResolvedValue({
          _id: 'meeting-id-1',
          title: '更新的会议',
          description: '更新的描述',
          teacher: 'teacher-id-1',
          parent: 'parent-id-1',
          student: 'student-id-1',
          startTime: new Date('2023-01-02T10:00:00Z'),
          endTime: new Date('2023-01-02T11:00:00Z'),
          location: '线下',
          meetingType: 'offline',
          meetingLink: '',
          status: 'rescheduled',
          notes: '会议已重新安排',
          updatedAt: expect.any(Date)
        })
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);
      Meeting.findOne.mockResolvedValue(null); // 没有时间冲突

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1')
        .send({
          title: '更新的会议',
          description: '更新的描述',
          startTime: new Date('2023-01-02T10:00:00Z').toISOString(),
          endTime: new Date('2023-01-02T11:00:00Z').toISOString(),
          location: '线下',
          meetingType: 'offline',
          meetingLink: '',
          status: 'rescheduled',
          notes: '会议已重新安排'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('title', '更新的会议');
      expect(response.body).toHaveProperty('description', '更新的描述');
      expect(response.body).toHaveProperty('startTime');
      expect(response.body).toHaveProperty('endTime');
      expect(response.body).toHaveProperty('location', '线下');
      expect(response.body).toHaveProperty('meetingType', 'offline');
      expect(response.body).toHaveProperty('meetingLink', '');
      expect(response.body).toHaveProperty('status', 'rescheduled');
      expect(response.body).toHaveProperty('notes', '会议已重新安排');

      // 验证 Meeting.findById 被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');

      // 验证 meeting.save 被调用
      expect(mockMeeting.save).toHaveBeenCalled();
    });

    it('应该处理会议不存在的情况', async () => {
      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/non-existent-id')
        .send({
          title: '更新的会议'
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理已取消会议的更新', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议1',
        status: 'cancelled'
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1')
        .send({
          title: '更新的会议'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '已取消的会议不能更新');
    });

    it('应该处理会议时间冲突', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议1',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T11:00:00Z'),
        status: 'scheduled'
      };

      const conflictMeeting = {
        _id: 'conflict-meeting-id',
        title: '冲突会议',
        teacher: 'teacher-id-1',
        startTime: new Date('2023-01-02T09:30:00Z'),
        endTime: new Date('2023-01-02T10:30:00Z')
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);
      Meeting.findOne.mockResolvedValue(conflictMeeting);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1')
        .send({
          startTime: new Date('2023-01-02T10:00:00Z').toISOString(),
          endTime: new Date('2023-01-02T11:00:00Z').toISOString()
        });

      // 验证响应
      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('message', '会议时间冲突');
      expect(response.body).toHaveProperty('conflictWith', 'conflict-meeting-id');
    });

    it('应该处理保存错误', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议1',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T11:00:00Z'),
        status: 'scheduled',
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);
      Meeting.findOne.mockResolvedValue(null); // 没有时间冲突

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1')
        .send({
          title: '更新的会议'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '更新会议失败');
      expect(response.body).toHaveProperty('error', '保存错误');
    });
  });

  // 测试取消会议
  describe('PUT /api/interaction/meetings/:id/cancel', () => {
    it('应该成功取消会议', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议1',
        status: 'scheduled',
        notes: '',
        save: jest.fn().mockResolvedValue({
          _id: 'meeting-id-1',
          title: '测试会议1',
          status: 'cancelled',
          notes: '会议已取消',
          updatedAt: expect.any(Date)
        })
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/cancel')
        .send({
          reason: '会议已取消'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'cancelled');
      expect(response.body).toHaveProperty('notes', '会议已取消');

      // 验证 Meeting.findById 被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');

      // 验证 meeting.save 被调用
      expect(mockMeeting.save).toHaveBeenCalled();
      expect(mockMeeting.status).toBe('cancelled');
      expect(mockMeeting.notes).toBe('会议已取消');
    });

    it('应该处理会议不存在的情况', async () => {
      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/non-existent-id/cancel')
        .send({
          reason: '会议已取消'
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理已结束会议的取消', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议1',
        status: 'completed'
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/cancel')
        .send({
          reason: '会议已取消'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '已结束的会议不能取消');
    });

    it('应该处理保存错误', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议1',
        status: 'scheduled',
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/cancel')
        .send({
          reason: '会议已取消'
        });

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
        title: '测试会议1',
        feedback: '',
        save: jest.fn().mockResolvedValue({
          _id: 'meeting-id-1',
          title: '测试会议1',
          feedback: '很好的会议',
          updatedAt: expect.any(Date)
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

      // 验证 Meeting.findById 被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');

      // 验证 meeting.save 被调用
      expect(mockMeeting.save).toHaveBeenCalled();
      expect(mockMeeting.feedback).toBe('很好的会议');
    });

    it('应该验证反馈内容不能为空', async () => {
      // 发送请求
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
        title: '测试会议1',
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

  // 测试获取用户即将到来的会议
  describe('GET /api/interaction/meetings/upcoming/:userId', () => {
    it('应该成功获取用户即将到来的会议', async () => {
      // 模拟数据
      const mockMeetings = [
        {
          _id: 'meeting-id-1',
          title: '测试会议1',
          teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
          parent: { _id: 'parent-id-1', name: '家长1', role: 'parent' },
          student: { _id: 'student-id-1', name: '学生1', grade: '一年级', class: '1班' },
          startTime: new Date('2023-01-01T10:00:00Z'),
          endTime: new Date('2023-01-01T11:00:00Z'),
          status: 'scheduled'
        }
      ];

      // 设置模拟函数的返回值
      const mockPopulate3 = jest.fn().mockResolvedValue(mockMeetings);
      const mockPopulate2 = jest.fn().mockReturnValue({ populate: mockPopulate3 });
      const mockPopulate1 = jest.fn().mockReturnValue({ populate: mockPopulate2 });
      const mockLimit = jest.fn().mockReturnValue({ populate: mockPopulate1 });
      const mockSort = jest.fn().mockReturnValue({ limit: mockLimit });
      Meeting.find.mockReturnValue({ sort: mockSort });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/upcoming/teacher-id-1')
        .query({
          role: 'teacher',
          limit: 5
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('_id', 'meeting-id-1');
      expect(response.body[0]).toHaveProperty('title', '测试会议1');

      // 验证 Meeting.find 被调用
      expect(Meeting.find).toHaveBeenCalledWith({
        teacher: 'teacher-id-1',
        startTime: { $gt: expect.any(Date) },
        status: 'scheduled'
      });

      // 验证排序和分页
      expect(mockSort).toHaveBeenCalledWith({ startTime: 1 });
      expect(mockLimit).toHaveBeenCalledWith(5);

      // 验证 populate
      expect(mockPopulate1).toHaveBeenCalledWith('teacher', 'name role');
      expect(mockPopulate2).toHaveBeenCalledWith('parent', 'name role');
      expect(mockPopulate3).toHaveBeenCalledWith('student', 'name grade class');
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不提供角色）
      const response = await request(app)
        .get('/api/interaction/meetings/upcoming/teacher-id-1');

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
        .get('/api/interaction/meetings/upcoming/teacher-id-1')
        .query({
          role: 'teacher'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取即将到来的会议失败');
      expect(response.body).toHaveProperty('error', '查询错误');
    });
  });
});

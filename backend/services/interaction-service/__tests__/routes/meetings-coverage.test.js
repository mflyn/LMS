/**
 * 会议路由覆盖率测试
 * 专注于提高 meetings.js 的测试覆盖率
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
  mockMeeting.find = jest.fn().mockReturnThis();
  mockMeeting.findById = jest.fn().mockReturnThis();
  mockMeeting.findByIdAndUpdate = jest.fn().mockReturnThis();
  mockMeeting.findByIdAndDelete = jest.fn().mockReturnThis();
  mockMeeting.findOne = jest.fn().mockReturnThis();
  mockMeeting.countDocuments = jest.fn().mockResolvedValue(10);
  mockMeeting.sort = jest.fn().mockReturnThis();
  mockMeeting.skip = jest.fn().mockReturnThis();
  mockMeeting.limit = jest.fn().mockReturnThis();
  mockMeeting.populate = jest.fn().mockReturnThis();
  mockMeeting.exec = jest.fn();
  mockMeeting.aggregate = jest.fn();

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

describe('会议路由覆盖率测试', () => {
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

  // 测试获取单个会议
  describe('GET /api/interaction/meetings/:id', () => {
    it('应该返回单个会议', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        description: '测试描述',
        teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
        parent: { _id: 'parent-id-1', name: '家长1', role: 'parent' },
        student: { _id: 'student-id-1', name: '学生1', grade: '一年级', class: '1班' },
        startTime: new Date('2023-01-15T10:00:00Z'),
        endTime: new Date('2023-01-15T11:00:00Z'),
        status: 'scheduled'
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockMeeting)
          })
        })
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/meeting-id-1');

      // 验证响应
      expect(response.status).toBe(200);
      // 日期格式可能不同，所以不直接比较对象
      expect(response.body._id).toEqual(mockMeeting._id);
      expect(response.body.title).toEqual(mockMeeting.title);
      expect(response.body.description).toEqual(mockMeeting.description);
      expect(response.body.status).toEqual(mockMeeting.status);

      // 验证模拟函数被正确调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
    });

    it('应该处理会议不存在的情况', async () => {
      // 设置模拟函数的返回值
      Meeting.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(null)
          })
        })
      });

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

  // 测试创建会议
  describe('POST /api/interaction/meetings', () => {
    it('应该成功创建会议', async () => {
      // 模拟数据
      const meetingData = {
        title: '新会议',
        description: '会议描述',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        startTime: '2023-01-15T10:00:00Z',
        endTime: '2023-01-15T11:00:00Z',
        location: '线上',
        meetingType: 'online',
        meetingLink: 'https://meeting.com/123'
      };

      // 设置模拟函数的返回值
      Meeting.findOne.mockResolvedValue(null); // 没有冲突的会议

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings')
        .send(meetingData);

      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('title', meetingData.title);
      expect(response.body).toHaveProperty('status', 'scheduled');

      // 验证模拟函数被正确调用
      expect(Meeting.findOne).toHaveBeenCalled();
    });

    it('应该验证必要参数', async () => {
      // 发送请求（缺少必要参数）
      const response = await request(app)
        .post('/api/interaction/meetings')
        .send({
          title: '新会议',
          teacher: 'teacher-id-1'
          // 缺少其他必要参数
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题、教师、家长、学生、开始时间和结束时间不能为空');
    });

    it('应该处理时间冲突', async () => {
      // 模拟数据
      const meetingData = {
        title: '新会议',
        description: '会议描述',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        startTime: '2023-01-15T10:00:00Z',
        endTime: '2023-01-15T11:00:00Z'
      };

      // 设置模拟函数的返回值
      Meeting.findOne.mockResolvedValue({
        _id: 'conflict-meeting-id'
      });

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings')
        .send(meetingData);

      // 验证响应
      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('message', '会议时间冲突');
      expect(response.body).toHaveProperty('conflictWith', 'conflict-meeting-id');
    });

    it('应该处理保存错误', async () => {
      // 模拟数据
      const meetingData = {
        title: '新会议',
        description: '会议描述',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        startTime: '2023-01-15T10:00:00Z',
        endTime: '2023-01-15T11:00:00Z'
      };

      // 设置模拟函数的返回值
      Meeting.findOne.mockResolvedValue(null);

      // 模拟 Meeting 构造函数的实例
      const mockMeetingInstance = {
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      };

      // 修改 Meeting 构造函数的实现
      Meeting.mockImplementationOnce(() => mockMeetingInstance);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings')
        .send(meetingData);

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '创建会议失败');
      expect(response.body).toHaveProperty('error', '保存错误');
    });
  });

  // 测试更新会议
  describe('PUT /api/interaction/meetings/:id', () => {
    it('应该成功更新会议', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        description: '测试描述',
        startTime: new Date('2023-01-15T10:00:00Z'),
        endTime: new Date('2023-01-15T11:00:00Z'),
        status: 'scheduled',
        save: jest.fn().mockResolvedValue({
          _id: 'meeting-id-1',
          title: '更新后的会议',
          description: '更新后的描述',
          startTime: new Date('2023-01-15T10:00:00Z'),
          endTime: new Date('2023-01-15T11:00:00Z'),
          status: 'scheduled'
        })
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);
      Meeting.findOne.mockResolvedValue(null); // 没有冲突的会议

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1')
        .send({
          title: '更新后的会议',
          description: '更新后的描述'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('title', '更新后的会议');
      expect(response.body).toHaveProperty('description', '更新后的描述');

      // 验证模拟函数被正确调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
      expect(mockMeeting.save).toHaveBeenCalled();
    });

    it('应该处理会议不存在的情况', async () => {
      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/non-existent-id')
        .send({
          title: '更新后的会议'
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理已取消会议的情况', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        status: 'cancelled'
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1')
        .send({
          title: '更新后的会议'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '已取消的会议不能更新');
    });

    it('应该处理时间冲突', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        description: '测试描述',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        startTime: new Date('2023-01-15T10:00:00Z'),
        endTime: new Date('2023-01-15T11:00:00Z'),
        status: 'scheduled'
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);
      Meeting.findOne.mockResolvedValue({
        _id: 'conflict-meeting-id'
      });

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1')
        .send({
          startTime: '2023-01-16T10:00:00Z',
          endTime: '2023-01-16T11:00:00Z'
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
        title: '测试会议',
        description: '测试描述',
        startTime: new Date('2023-01-15T10:00:00Z'),
        endTime: new Date('2023-01-15T11:00:00Z'),
        status: 'scheduled',
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);
      Meeting.findOne.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1')
        .send({
          title: '更新后的会议'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '更新会议失败');
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

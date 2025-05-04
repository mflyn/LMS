const request = require('supertest');
const express = require('express');
const router = require('../../routes/meetings');

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

  return mockMeeting;
});

// 模拟 winston 日志记录器
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  };

  return {
    createLogger: jest.fn().mockReturnValue(mockLogger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      json: jest.fn()
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    }
  };
});

describe('会议路由测试 - 基础功能', () => {
  let app;
  const Meeting = require('../../models/Meeting');

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/meetings', router);

    // 重置所有模拟函数
    jest.clearAllMocks();
  });

  // 测试创建会议
  describe('POST /api/interaction/meetings', () => {
    it('应该成功创建会议', async () => {
      // 准备请求数据
      const meetingData = {
        title: '测试会议',
        description: '测试描述',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        startTime: new Date('2023-01-01T10:00:00Z').toISOString(),
        endTime: new Date('2023-01-01T11:00:00Z').toISOString(),
        location: '线上',
        meetingType: 'online',
        meetingLink: 'https://meeting.example.com/123'
      };

      // 模拟 findOne 方法返回 null（没有冲突的会议）
      Meeting.findOne = jest.fn().mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings')
        .send(meetingData);

      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('title', '测试会议');
      expect(response.body).toHaveProperty('description', '测试描述');
      expect(response.body).toHaveProperty('teacher', 'teacher-id-1');
      expect(response.body).toHaveProperty('parent', 'parent-id-1');
      expect(response.body).toHaveProperty('student', 'student-id-1');
      expect(response.body).toHaveProperty('meetingType', 'online');

      // 验证 Meeting 构造函数被正确调用
      expect(Meeting).toHaveBeenCalledWith({
        title: '测试会议',
        description: '测试描述',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        location: '线上',
        meetingType: 'online',
        meetingLink: 'https://meeting.example.com/123',
        status: 'scheduled',
        notes: '',
        feedback: ''
      });

      // 验证 findOne 方法被调用（检查时间冲突）
      expect(Meeting.findOne).toHaveBeenCalled();

      // 验证 save 方法被调用
      const mockMeetingInstance = Meeting.mock.instances[0];
      expect(mockMeetingInstance.save).toHaveBeenCalled();
    });

    it('应该验证必要字段不能为空', async () => {
      // 准备请求数据（缺少必要字段）
      const meetingData = {
        title: '测试会议',
        description: '测试描述',
        // 缺少 teacher, parent, student
        startTime: new Date('2023-01-01T10:00:00Z').toISOString(),
        endTime: new Date('2023-01-01T11:00:00Z').toISOString()
      };

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings')
        .send(meetingData);

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题、教师、家长、学生、开始时间和结束时间不能为空');

      // 验证 Meeting 构造函数没有被调用
      expect(Meeting).not.toHaveBeenCalled();
    });

    it('应该处理会议时间冲突', async () => {
      // 准备请求数据
      const meetingData = {
        title: '测试会议',
        description: '测试描述',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        startTime: new Date('2023-01-01T10:00:00Z').toISOString(),
        endTime: new Date('2023-01-01T11:00:00Z').toISOString()
      };

      // 模拟 findOne 方法返回冲突的会议
      const conflictMeeting = {
        _id: 'conflict-meeting-id',
        title: '冲突会议',
        teacher: 'teacher-id-1',
        startTime: new Date('2023-01-01T09:30:00Z'),
        endTime: new Date('2023-01-01T10:30:00Z')
      };
      Meeting.findOne = jest.fn().mockResolvedValue(conflictMeeting);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings')
        .send(meetingData);

      // 验证响应
      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('message', '会议时间冲突');
      expect(response.body).toHaveProperty('conflictWith', 'conflict-meeting-id');

      // 验证 findOne 方法被调用
      expect(Meeting.findOne).toHaveBeenCalled();

      // 验证 Meeting 构造函数没有被调用
      expect(Meeting).not.toHaveBeenCalled();
    });

    it('应该处理保存失败的情况', async () => {
      // 准备请求数据
      const meetingData = {
        title: '测试会议',
        description: '测试描述',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        startTime: new Date('2023-01-01T10:00:00Z').toISOString(),
        endTime: new Date('2023-01-01T11:00:00Z').toISOString()
      };

      // 模拟 findOne 方法返回 null（没有冲突的会议）
      Meeting.findOne = jest.fn().mockResolvedValue(null);

      // 模拟 save 方法抛出错误
      const mockSave = jest.fn().mockRejectedValue(new Error('保存失败'));
      Meeting.mockImplementation(function(data) {
        this.save = mockSave;
        Object.assign(this, data);
        return this;
      });

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings')
        .send(meetingData);

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '创建会议失败');
      expect(response.body).toHaveProperty('error', '保存失败');

      // 验证 save 方法被调用
      expect(mockSave).toHaveBeenCalled();
    });
  });
});

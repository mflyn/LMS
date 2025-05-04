const request = require('supertest');
const express = require('express');
const router = require('../../routes/meetings');

// 模拟 Meeting 模型
jest.mock('../../models/Meeting', () => {
  const mockMeeting = jest.fn().mockImplementation(function(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });
  
  mockMeeting.find = jest.fn();
  mockMeeting.findById = jest.fn();
  mockMeeting.findOne = jest.fn();
  mockMeeting.findByIdAndUpdate = jest.fn();
  mockMeeting.findByIdAndDelete = jest.fn();
  mockMeeting.countDocuments = jest.fn();
  
  return mockMeeting;
});

// 模拟 winston 日志
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn()
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

describe('会议路由 - 创建会议', () => {
  let app;
  const Meeting = require('../../models/Meeting');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/meetings', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  it('应该成功创建会议', async () => {
    // 模拟数据
    const meetingData = {
      title: '测试会议',
      description: '测试描述',
      teacher: 'teacher-id-1',
      parent: 'parent-id-1',
      student: 'student-id-1',
      startTime: '2025-05-10T10:00:00Z',
      endTime: '2025-05-10T11:00:00Z',
      location: '线上会议',
      meetingType: 'online',
      meetingLink: 'https://meeting.example.com/123'
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
    expect(response.body).toHaveProperty('description', meetingData.description);
    expect(response.body).toHaveProperty('teacher', meetingData.teacher);
    expect(response.body).toHaveProperty('parent', meetingData.parent);
    expect(response.body).toHaveProperty('student', meetingData.student);
    expect(response.body).toHaveProperty('startTime');
    expect(response.body).toHaveProperty('endTime');
    expect(response.body).toHaveProperty('location', meetingData.location);
    expect(response.body).toHaveProperty('meetingType', meetingData.meetingType);
    expect(response.body).toHaveProperty('meetingLink', meetingData.meetingLink);
    expect(response.body).toHaveProperty('status', 'scheduled');
    
    // 验证模拟函数被正确调用
    expect(Meeting.findOne).toHaveBeenCalledWith({
      $or: [
        { teacher: meetingData.teacher },
        { parent: meetingData.parent },
      ],
      startTime: { $lt: expect.any(Date) },
      endTime: { $gt: expect.any(Date) },
      status: { $ne: 'cancelled' }
    });
    
    // 验证 save 方法被调用
    const mockMeetingInstance = Meeting.mock.instances[0];
    expect(mockMeetingInstance.save).toHaveBeenCalled();
  });
  
  it('应该验证必填字段', async () => {
    // 缺少必填字段的数据
    const invalidData = {
      title: '测试会议',
      // 缺少 teacher, parent, student, startTime, endTime
    };
    
    // 发送请求
    const response = await request(app)
      .post('/api/interaction/meetings')
      .send(invalidData);
    
    // 验证响应
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message', '标题、教师、家长、学生、开始时间和结束时间不能为空');
    
    // 验证 Meeting 构造函数没有被调用
    expect(Meeting).not.toHaveBeenCalled();
  });
  
  it('应该处理会议时间冲突', async () => {
    // 模拟数据
    const meetingData = {
      title: '测试会议',
      description: '测试描述',
      teacher: 'teacher-id-1',
      parent: 'parent-id-1',
      student: 'student-id-1',
      startTime: '2025-05-10T10:00:00Z',
      endTime: '2025-05-10T11:00:00Z',
      location: '线上会议',
      meetingType: 'online',
      meetingLink: 'https://meeting.example.com/123'
    };
    
    // 设置模拟函数的返回值 - 存在冲突的会议
    const conflictMeeting = {
      _id: 'conflict-meeting-id',
      title: '冲突会议',
      startTime: new Date('2025-05-10T09:30:00Z'),
      endTime: new Date('2025-05-10T10:30:00Z')
    };
    Meeting.findOne.mockResolvedValue(conflictMeeting);
    
    // 发送请求
    const response = await request(app)
      .post('/api/interaction/meetings')
      .send(meetingData);
    
    // 验证响应
    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('message', '会议时间冲突');
    expect(response.body).toHaveProperty('conflictWith', 'conflict-meeting-id');
    
    // 验证 Meeting 构造函数没有被调用
    expect(Meeting).not.toHaveBeenCalled();
  });
  
  it('应该处理数据库保存错误', async () => {
    // 模拟数据
    const meetingData = {
      title: '测试会议',
      description: '测试描述',
      teacher: 'teacher-id-1',
      parent: 'parent-id-1',
      student: 'student-id-1',
      startTime: '2025-05-10T10:00:00Z',
      endTime: '2025-05-10T11:00:00Z',
      location: '线上会议',
      meetingType: 'online',
      meetingLink: 'https://meeting.example.com/123'
    };
    
    // 设置模拟函数的返回值
    Meeting.findOne.mockResolvedValue(null); // 没有冲突的会议
    
    // 设置 save 方法抛出错误
    const mockSave = jest.fn().mockRejectedValue(new Error('数据库保存错误'));
    Meeting.mockImplementation(function(data) {
      Object.assign(this, data);
      this.save = mockSave;
    });
    
    // 发送请求
    const response = await request(app)
      .post('/api/interaction/meetings')
      .send(meetingData);
    
    // 验证响应
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message', '创建会议失败');
    expect(response.body).toHaveProperty('error', '数据库保存错误');
    
    // 验证 save 方法被调用
    expect(mockSave).toHaveBeenCalled();
  });
});

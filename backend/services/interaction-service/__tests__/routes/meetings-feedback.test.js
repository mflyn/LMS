const request = require('supertest');
const express = require('express');
const router = require('../../routes/meetings');

// 模拟 Meeting 模型
jest.mock('../../models/Meeting', () => {
  const mockMeeting = {
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    countDocuments: jest.fn()
  };
  
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

describe('会议路由 - 添加会议反馈', () => {
  let app;
  const Meeting = require('../../models/Meeting');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/meetings', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  it('应该成功添加会议反馈', async () => {
    // 模拟数据
    const meetingId = 'meeting-id-1';
    const feedbackData = {
      feedback: '会议非常有成效，讨论了学生的学习进度和未来计划。'
    };
    
    // 模拟现有会议
    const existingMeeting = {
      _id: meetingId,
      title: '测试会议',
      description: '测试描述',
      teacher: 'teacher-id-1',
      parent: 'parent-id-1',
      student: 'student-id-1',
      startTime: new Date('2025-05-10T10:00:00Z'),
      endTime: new Date('2025-05-10T11:00:00Z'),
      status: 'completed',
      feedback: '',
      save: jest.fn().mockResolvedValue({
        _id: meetingId,
        title: '测试会议',
        description: '测试描述',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        startTime: new Date('2025-05-10T10:00:00Z'),
        endTime: new Date('2025-05-10T11:00:00Z'),
        status: 'completed',
        feedback: feedbackData.feedback,
        updatedAt: new Date()
      })
    };
    
    // 设置模拟函数的返回值
    Meeting.findById.mockResolvedValue(existingMeeting);
    
    // 发送请求
    const response = await request(app)
      .put(`/api/interaction/meetings/${meetingId}/feedback`)
      .send(feedbackData);
    
    // 验证响应
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('_id', meetingId);
    expect(response.body).toHaveProperty('feedback', feedbackData.feedback);
    
    // 验证模拟函数被正确调用
    expect(Meeting.findById).toHaveBeenCalledWith(meetingId);
    expect(existingMeeting.save).toHaveBeenCalled();
  });
  
  it('应该验证反馈内容不能为空', async () => {
    // 模拟数据
    const meetingId = 'meeting-id-1';
    const invalidData = {
      // 缺少 feedback
    };
    
    // 发送请求
    const response = await request(app)
      .put(`/api/interaction/meetings/${meetingId}/feedback`)
      .send(invalidData);
    
    // 验证响应
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message', '反馈内容不能为空');
    
    // 验证 findById 方法没有被调用
    expect(Meeting.findById).not.toHaveBeenCalled();
  });
  
  it('应该处理会议不存在的情况', async () => {
    // 模拟数据
    const meetingId = 'non-existent-id';
    const feedbackData = {
      feedback: '会议非常有成效，讨论了学生的学习进度和未来计划。'
    };
    
    // 设置模拟函数的返回值
    Meeting.findById.mockResolvedValue(null);
    
    // 发送请求
    const response = await request(app)
      .put(`/api/interaction/meetings/${meetingId}/feedback`)
      .send(feedbackData);
    
    // 验证响应
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message', '会议不存在');
  });
  
  it('应该处理数据库保存错误', async () => {
    // 模拟数据
    const meetingId = 'meeting-id-1';
    const feedbackData = {
      feedback: '会议非常有成效，讨论了学生的学习进度和未来计划。'
    };
    
    // 模拟现有会议
    const existingMeeting = {
      _id: meetingId,
      title: '测试会议',
      description: '测试描述',
      status: 'completed',
      feedback: '',
      save: jest.fn().mockRejectedValue(new Error('数据库保存错误'))
    };
    
    // 设置模拟函数的返回值
    Meeting.findById.mockResolvedValue(existingMeeting);
    
    // 发送请求
    const response = await request(app)
      .put(`/api/interaction/meetings/${meetingId}/feedback`)
      .send(feedbackData);
    
    // 验证响应
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message', '添加会议反馈失败');
    expect(response.body).toHaveProperty('error', '数据库保存错误');
    
    // 验证 save 方法被调用
    expect(existingMeeting.save).toHaveBeenCalled();
  });
});

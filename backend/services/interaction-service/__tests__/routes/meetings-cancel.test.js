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

describe('会议路由 - 取消会议', () => {
  let app;
  const Meeting = require('../../models/Meeting');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/meetings', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  it('应该成功取消会议', async () => {
    // 模拟数据
    const meetingId = 'meeting-id-1';
    const cancelData = {
      reason: '时间冲突，需要重新安排'
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
      status: 'scheduled',
      notes: '',
      save: jest.fn().mockResolvedValue({
        _id: meetingId,
        title: '测试会议',
        description: '测试描述',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        startTime: new Date('2025-05-10T10:00:00Z'),
        endTime: new Date('2025-05-10T11:00:00Z'),
        status: 'cancelled',
        notes: cancelData.reason,
        updatedAt: new Date()
      })
    };
    
    // 设置模拟函数的返回值
    Meeting.findById.mockResolvedValue(existingMeeting);
    
    // 发送请求
    const response = await request(app)
      .put(`/api/interaction/meetings/${meetingId}/cancel`)
      .send(cancelData);
    
    // 验证响应
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('_id', meetingId);
    expect(response.body).toHaveProperty('status', 'cancelled');
    expect(response.body).toHaveProperty('notes', cancelData.reason);
    
    // 验证模拟函数被正确调用
    expect(Meeting.findById).toHaveBeenCalledWith(meetingId);
    expect(existingMeeting.save).toHaveBeenCalled();
  });
  
  it('应该处理会议不存在的情况', async () => {
    // 模拟数据
    const meetingId = 'non-existent-id';
    const cancelData = {
      reason: '时间冲突，需要重新安排'
    };
    
    // 设置模拟函数的返回值
    Meeting.findById.mockResolvedValue(null);
    
    // 发送请求
    const response = await request(app)
      .put(`/api/interaction/meetings/${meetingId}/cancel`)
      .send(cancelData);
    
    // 验证响应
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message', '会议不存在');
  });
  
  it('应该处理已结束会议的取消', async () => {
    // 模拟数据
    const meetingId = 'completed-meeting-id';
    const cancelData = {
      reason: '时间冲突，需要重新安排'
    };
    
    // 模拟已结束的会议
    const completedMeeting = {
      _id: meetingId,
      title: '测试会议',
      description: '测试描述',
      status: 'completed'
    };
    
    // 设置模拟函数的返回值
    Meeting.findById.mockResolvedValue(completedMeeting);
    
    // 发送请求
    const response = await request(app)
      .put(`/api/interaction/meetings/${meetingId}/cancel`)
      .send(cancelData);
    
    // 验证响应
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message', '已结束的会议不能取消');
  });
  
  it('应该处理数据库保存错误', async () => {
    // 模拟数据
    const meetingId = 'meeting-id-1';
    const cancelData = {
      reason: '时间冲突，需要重新安排'
    };
    
    // 模拟现有会议
    const existingMeeting = {
      _id: meetingId,
      title: '测试会议',
      description: '测试描述',
      status: 'scheduled',
      save: jest.fn().mockRejectedValue(new Error('数据库保存错误'))
    };
    
    // 设置模拟函数的返回值
    Meeting.findById.mockResolvedValue(existingMeeting);
    
    // 发送请求
    const response = await request(app)
      .put(`/api/interaction/meetings/${meetingId}/cancel`)
      .send(cancelData);
    
    // 验证响应
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message', '取消会议失败');
    expect(response.body).toHaveProperty('error', '数据库保存错误');
    
    // 验证 save 方法被调用
    expect(existingMeeting.save).toHaveBeenCalled();
  });
});

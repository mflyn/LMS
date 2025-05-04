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

describe('会议路由 - 更新会议', () => {
  let app;
  const Meeting = require('../../models/Meeting');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/meetings', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  it('应该成功更新会议', async () => {
    // 模拟数据
    const meetingId = 'meeting-id-1';
    const updateData = {
      title: '更新后的会议标题',
      description: '更新后的描述',
      startTime: '2025-05-15T10:00:00Z',
      endTime: '2025-05-15T11:00:00Z',
      location: '更新后的地点',
      meetingType: 'offline',
      meetingLink: '',
      status: 'rescheduled',
      notes: '会议已重新安排'
    };
    
    // 模拟现有会议
    const existingMeeting = {
      _id: meetingId,
      title: '原会议标题',
      description: '原描述',
      teacher: 'teacher-id-1',
      parent: 'parent-id-1',
      student: 'student-id-1',
      startTime: new Date('2025-05-10T10:00:00Z'),
      endTime: new Date('2025-05-10T11:00:00Z'),
      location: '原地点',
      meetingType: 'online',
      meetingLink: 'https://meeting.example.com/123',
      status: 'scheduled',
      notes: '',
      save: jest.fn().mockResolvedValue({
        _id: meetingId,
        ...updateData,
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        startTime: new Date(updateData.startTime),
        endTime: new Date(updateData.endTime),
        updatedAt: new Date()
      })
    };
    
    // 设置模拟函数的返回值
    Meeting.findById.mockResolvedValue(existingMeeting);
    Meeting.findOne.mockResolvedValue(null); // 没有冲突的会议
    
    // 发送请求
    const response = await request(app)
      .put(`/api/interaction/meetings/${meetingId}`)
      .send(updateData);
    
    // 验证响应
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('_id', meetingId);
    expect(response.body).toHaveProperty('title', updateData.title);
    expect(response.body).toHaveProperty('description', updateData.description);
    expect(response.body).toHaveProperty('startTime');
    expect(response.body).toHaveProperty('endTime');
    expect(response.body).toHaveProperty('location', updateData.location);
    expect(response.body).toHaveProperty('meetingType', updateData.meetingType);
    expect(response.body).toHaveProperty('meetingLink', updateData.meetingLink);
    expect(response.body).toHaveProperty('status', updateData.status);
    expect(response.body).toHaveProperty('notes', updateData.notes);
    
    // 验证模拟函数被正确调用
    expect(Meeting.findById).toHaveBeenCalledWith(meetingId);
    expect(existingMeeting.save).toHaveBeenCalled();
  });
  
  it('应该处理会议不存在的情况', async () => {
    // 模拟数据
    const meetingId = 'non-existent-id';
    const updateData = {
      title: '更新后的会议标题',
      description: '更新后的描述'
    };
    
    // 设置模拟函数的返回值
    Meeting.findById.mockResolvedValue(null);
    
    // 发送请求
    const response = await request(app)
      .put(`/api/interaction/meetings/${meetingId}`)
      .send(updateData);
    
    // 验证响应
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message', '会议不存在');
  });
  
  it('应该处理已取消会议的更新', async () => {
    // 模拟数据
    const meetingId = 'cancelled-meeting-id';
    const updateData = {
      title: '更新后的会议标题',
      description: '更新后的描述'
    };
    
    // 模拟已取消的会议
    const cancelledMeeting = {
      _id: meetingId,
      title: '原会议标题',
      description: '原描述',
      status: 'cancelled'
    };
    
    // 设置模拟函数的返回值
    Meeting.findById.mockResolvedValue(cancelledMeeting);
    
    // 发送请求
    const response = await request(app)
      .put(`/api/interaction/meetings/${meetingId}`)
      .send(updateData);
    
    // 验证响应
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message', '已取消的会议不能更新');
  });
  
  it('应该处理会议时间冲突', async () => {
    // 模拟数据
    const meetingId = 'meeting-id-1';
    const updateData = {
      startTime: '2025-05-15T10:00:00Z',
      endTime: '2025-05-15T11:00:00Z'
    };
    
    // 模拟现有会议
    const existingMeeting = {
      _id: meetingId,
      title: '原会议标题',
      description: '原描述',
      teacher: 'teacher-id-1',
      parent: 'parent-id-1',
      student: 'student-id-1',
      startTime: new Date('2025-05-10T10:00:00Z'),
      endTime: new Date('2025-05-10T11:00:00Z'),
      status: 'scheduled'
    };
    
    // 模拟冲突的会议
    const conflictMeeting = {
      _id: 'conflict-meeting-id',
      title: '冲突会议',
      startTime: new Date('2025-05-15T09:30:00Z'),
      endTime: new Date('2025-05-15T10:30:00Z')
    };
    
    // 设置模拟函数的返回值
    Meeting.findById.mockResolvedValue(existingMeeting);
    Meeting.findOne.mockResolvedValue(conflictMeeting);
    
    // 发送请求
    const response = await request(app)
      .put(`/api/interaction/meetings/${meetingId}`)
      .send(updateData);
    
    // 验证响应
    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('message', '会议时间冲突');
    expect(response.body).toHaveProperty('conflictWith', 'conflict-meeting-id');
  });
  
  it('应该处理数据库保存错误', async () => {
    // 模拟数据
    const meetingId = 'meeting-id-1';
    const updateData = {
      title: '更新后的会议标题',
      description: '更新后的描述'
    };
    
    // 模拟现有会议
    const existingMeeting = {
      _id: meetingId,
      title: '原会议标题',
      description: '原描述',
      teacher: 'teacher-id-1',
      parent: 'parent-id-1',
      student: 'student-id-1',
      startTime: new Date('2025-05-10T10:00:00Z'),
      endTime: new Date('2025-05-10T11:00:00Z'),
      status: 'scheduled',
      save: jest.fn().mockRejectedValue(new Error('数据库保存错误'))
    };
    
    // 设置模拟函数的返回值
    Meeting.findById.mockResolvedValue(existingMeeting);
    
    // 发送请求
    const response = await request(app)
      .put(`/api/interaction/meetings/${meetingId}`)
      .send(updateData);
    
    // 验证响应
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message', '更新会议失败');
    expect(response.body).toHaveProperty('error', '数据库保存错误');
    
    // 验证 save 方法被调用
    expect(existingMeeting.save).toHaveBeenCalled();
  });
});

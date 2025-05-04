const request = require('supertest');
const express = require('express');
const router = require('../../routes/meetings');

// 模拟 Meeting 模型
jest.mock('../../models/Meeting', () => {
  return {
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    countDocuments: jest.fn()
  };
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

describe('会议路由 - 获取单个会议', () => {
  let app;
  const Meeting = require('../../models/Meeting');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/meetings', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  it('应该成功获取单个会议', async () => {
    // 模拟数据
    const mockMeeting = {
      _id: 'meeting-id-1',
      title: '测试会议1',
      description: '测试描述',
      teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
      parent: { _id: 'parent-id-1', name: '家长1', role: 'parent' },
      student: { _id: 'student-id-1', name: '学生1', grade: '一年级', class: '一班' },
      startTime: '2025-05-10T10:00:00.000Z',
      endTime: '2025-05-10T11:00:00.000Z',
      location: '线上会议',
      status: '待确认',
      meetingType: '线上',
      meetingLink: 'https://meeting.example.com/123',
      notes: '会议笔记',
      createdAt: '2025-05-01T10:00:00.000Z',
      updatedAt: '2025-05-01T10:00:00.000Z'
    };
    
    // 设置模拟函数的返回值
    const mockPopulateTeacher = jest.fn().mockReturnThis();
    const mockPopulateParent = jest.fn().mockReturnThis();
    const mockPopulateStudent = jest.fn().mockReturnValue(mockMeeting);
    
    Meeting.findById.mockReturnValue({
      populate: mockPopulateTeacher
    });
    
    mockPopulateTeacher.mockReturnValue({
      populate: mockPopulateParent
    });
    
    mockPopulateParent.mockReturnValue({
      populate: mockPopulateStudent
    });
    
    // 发送请求
    const response = await request(app)
      .get('/api/interaction/meetings/meeting-id-1');
    
    // 验证响应
    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockMeeting);
    
    // 验证模拟函数被正确调用
    expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
    expect(mockPopulateTeacher).toHaveBeenCalledWith('teacher', 'name role');
    expect(mockPopulateParent).toHaveBeenCalledWith('parent', 'name role');
    expect(mockPopulateStudent).toHaveBeenCalledWith('student', 'name grade class');
  });
  
  it('应该处理会议不存在的情况', async () => {
    // 设置模拟函数的返回值
    const mockPopulateTeacher = jest.fn().mockReturnThis();
    const mockPopulateParent = jest.fn().mockReturnThis();
    const mockPopulateStudent = jest.fn().mockReturnValue(null);
    
    Meeting.findById.mockReturnValue({
      populate: mockPopulateTeacher
    });
    
    mockPopulateTeacher.mockReturnValue({
      populate: mockPopulateParent
    });
    
    mockPopulateParent.mockReturnValue({
      populate: mockPopulateStudent
    });
    
    // 发送请求
    const response = await request(app)
      .get('/api/interaction/meetings/non-existent-id');
    
    // 验证响应
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message', '会议不存在');
  });
  
  it('应该处理数据库查询错误', async () => {
    // 设置模拟函数抛出错误
    Meeting.findById.mockImplementation(() => {
      throw new Error('数据库查询错误');
    });
    
    // 发送请求
    const response = await request(app)
      .get('/api/interaction/meetings/meeting-id-1');
    
    // 验证响应
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message', '获取会议失败');
    expect(response.body).toHaveProperty('error', '数据库查询错误');
  });
});

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

describe('会议路由 - 获取用户即将到来的会议', () => {
  let app;
  const Meeting = require('../../models/Meeting');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/meetings', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  it('应该成功获取教师即将到来的会议', async () => {
    // 模拟数据
    const userId = 'teacher-id-1';
    const role = 'teacher';
    
    // 模拟即将到来的会议
    const upcomingMeetings = [
      {
        _id: 'meeting-id-1',
        title: '测试会议1',
        teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
        parent: { _id: 'parent-id-1', name: '家长1', role: 'parent' },
        student: { _id: 'student-id-1', name: '学生1', grade: '一年级', class: '一班' },
        startTime: '2025-05-10T10:00:00.000Z',
        endTime: '2025-05-10T11:00:00.000Z',
        status: 'scheduled'
      },
      {
        _id: 'meeting-id-2',
        title: '测试会议2',
        teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
        parent: { _id: 'parent-id-2', name: '家长2', role: 'parent' },
        student: { _id: 'student-id-2', name: '学生2', grade: '一年级', class: '一班' },
        startTime: '2025-05-11T10:00:00.000Z',
        endTime: '2025-05-11T11:00:00.000Z',
        status: 'scheduled'
      }
    ];
    
    // 设置模拟函数的返回值
    const mockSort = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockReturnThis();
    const mockPopulateTeacher = jest.fn().mockReturnThis();
    const mockPopulateParent = jest.fn().mockReturnThis();
    const mockPopulateStudent = jest.fn().mockReturnValue(upcomingMeetings);
    
    Meeting.find.mockReturnValue({
      sort: mockSort,
      limit: mockLimit,
      populate: mockPopulateTeacher
    });
    
    mockSort.mockReturnValue({
      limit: mockLimit,
      populate: mockPopulateTeacher
    });
    
    mockLimit.mockReturnValue({
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
      .get(`/api/interaction/meetings/upcoming/${userId}`)
      .query({ role, limit: 5 });
    
    // 验证响应
    expect(response.status).toBe(200);
    expect(response.body).toEqual(upcomingMeetings);
    
    // 验证模拟函数被正确调用
    expect(Meeting.find).toHaveBeenCalledWith({
      teacher: userId,
      startTime: { $gt: expect.any(Date) },
      status: 'scheduled'
    });
    expect(mockSort).toHaveBeenCalledWith({ startTime: 1 });
    expect(mockLimit).toHaveBeenCalledWith(5);
    expect(mockPopulateTeacher).toHaveBeenCalledWith('teacher', 'name role');
    expect(mockPopulateParent).toHaveBeenCalledWith('parent', 'name role');
    expect(mockPopulateStudent).toHaveBeenCalledWith('student', 'name grade class');
  });
  
  it('应该成功获取家长即将到来的会议', async () => {
    // 模拟数据
    const userId = 'parent-id-1';
    const role = 'parent';
    
    // 模拟即将到来的会议
    const upcomingMeetings = [
      {
        _id: 'meeting-id-1',
        title: '测试会议1',
        teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
        parent: { _id: 'parent-id-1', name: '家长1', role: 'parent' },
        student: { _id: 'student-id-1', name: '学生1', grade: '一年级', class: '一班' },
        startTime: '2025-05-10T10:00:00.000Z',
        endTime: '2025-05-10T11:00:00.000Z',
        status: 'scheduled'
      }
    ];
    
    // 设置模拟函数的返回值
    const mockSort = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockReturnThis();
    const mockPopulateTeacher = jest.fn().mockReturnThis();
    const mockPopulateParent = jest.fn().mockReturnThis();
    const mockPopulateStudent = jest.fn().mockReturnValue(upcomingMeetings);
    
    Meeting.find.mockReturnValue({
      sort: mockSort,
      limit: mockLimit,
      populate: mockPopulateTeacher
    });
    
    mockSort.mockReturnValue({
      limit: mockLimit,
      populate: mockPopulateTeacher
    });
    
    mockLimit.mockReturnValue({
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
      .get(`/api/interaction/meetings/upcoming/${userId}`)
      .query({ role, limit: 3 });
    
    // 验证响应
    expect(response.status).toBe(200);
    expect(response.body).toEqual(upcomingMeetings);
    
    // 验证模拟函数被正确调用
    expect(Meeting.find).toHaveBeenCalledWith({
      parent: userId,
      startTime: { $gt: expect.any(Date) },
      status: 'scheduled'
    });
    expect(mockSort).toHaveBeenCalledWith({ startTime: 1 });
    expect(mockLimit).toHaveBeenCalledWith(3);
  });
  
  it('应该验证用户ID和角色不能为空', async () => {
    // 模拟数据
    const userId = 'teacher-id-1';
    
    // 发送请求（缺少角色）
    const response = await request(app)
      .get(`/api/interaction/meetings/upcoming/${userId}`);
    
    // 验证响应
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message', '用户ID和角色不能为空');
    
    // 验证 find 方法没有被调用
    expect(Meeting.find).not.toHaveBeenCalled();
  });
  
  it('应该处理数据库查询错误', async () => {
    // 模拟数据
    const userId = 'teacher-id-1';
    const role = 'teacher';
    
    // 设置模拟函数抛出错误
    Meeting.find.mockImplementation(() => {
      throw new Error('数据库查询错误');
    });
    
    // 发送请求
    const response = await request(app)
      .get(`/api/interaction/meetings/upcoming/${userId}`)
      .query({ role });
    
    // 验证响应
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message', '获取即将到来的会议失败');
    expect(response.body).toHaveProperty('error', '数据库查询错误');
  });
});

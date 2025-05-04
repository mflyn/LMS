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

describe('会议路由 - 获取会议列表', () => {
  let app;
  const Meeting = require('../../models/Meeting');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/meetings', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  it('应该成功获取会议列表', async () => {
    // 模拟数据
    const mockMeetings = [
      {
        _id: 'meeting-id-1',
        title: '测试会议1',
        teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
        parent: { _id: 'parent-id-1', name: '家长1', role: 'parent' },
        student: { _id: 'student-id-1', name: '学生1', grade: '一年级', class: '一班' },
        startTime: '2025-05-10T10:00:00.000Z',
        endTime: '2025-05-10T11:00:00.000Z',
        status: '待确认'
      },
      {
        _id: 'meeting-id-2',
        title: '测试会议2',
        teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
        parent: { _id: 'parent-id-2', name: '家长2', role: 'parent' },
        student: { _id: 'student-id-2', name: '学生2', grade: '一年级', class: '一班' },
        startTime: '2025-05-11T10:00:00.000Z',
        endTime: '2025-05-11T11:00:00.000Z',
        status: '已确认'
      }
    ];
    
    // 设置模拟函数的返回值
    const mockSort = jest.fn().mockReturnThis();
    const mockSkip = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockReturnThis();
    const mockPopulateTeacher = jest.fn().mockReturnThis();
    const mockPopulateParent = jest.fn().mockReturnThis();
    const mockPopulateStudent = jest.fn().mockReturnValue(mockMeetings);
    
    Meeting.find.mockReturnValue({
      sort: mockSort,
      skip: mockSkip,
      limit: mockLimit,
      populate: mockPopulateTeacher
    });
    
    mockPopulateTeacher.mockReturnValue({
      populate: mockPopulateParent
    });
    
    mockPopulateParent.mockReturnValue({
      populate: mockPopulateStudent
    });
    
    Meeting.countDocuments.mockResolvedValue(2);
    
    // 发送请求
    const response = await request(app)
      .get('/api/interaction/meetings')
      .query({ limit: 10, skip: 0 });
    
    // 验证响应
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('pagination');
    expect(response.body.data).toEqual(mockMeetings);
    expect(response.body.pagination).toEqual({
      total: 2,
      limit: 10,
      skip: 0
    });
    
    // 验证模拟函数被正确调用
    expect(Meeting.find).toHaveBeenCalledWith({});
    expect(mockSort).toHaveBeenCalledWith({ startTime: 1 });
    expect(mockSkip).toHaveBeenCalledWith(0);
    expect(mockLimit).toHaveBeenCalledWith(10);
    expect(mockPopulateTeacher).toHaveBeenCalledWith('teacher', 'name role');
    expect(mockPopulateParent).toHaveBeenCalledWith('parent', 'name role');
    expect(mockPopulateStudent).toHaveBeenCalledWith('student', 'name grade class');
    expect(Meeting.countDocuments).toHaveBeenCalledWith({});
  });
  
  it('应该根据查询参数过滤会议列表', async () => {
    // 模拟数据
    const mockMeetings = [
      {
        _id: 'meeting-id-1',
        title: '测试会议1',
        teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
        parent: { _id: 'parent-id-1', name: '家长1', role: 'parent' },
        student: { _id: 'student-id-1', name: '学生1', grade: '一年级', class: '一班' },
        startTime: '2025-05-10T10:00:00.000Z',
        endTime: '2025-05-10T11:00:00.000Z',
        status: '待确认'
      }
    ];
    
    // 设置模拟函数的返回值
    const mockSort = jest.fn().mockReturnThis();
    const mockSkip = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockReturnThis();
    const mockPopulateTeacher = jest.fn().mockReturnThis();
    const mockPopulateParent = jest.fn().mockReturnThis();
    const mockPopulateStudent = jest.fn().mockReturnValue(mockMeetings);
    
    Meeting.find.mockReturnValue({
      sort: mockSort,
      skip: mockSkip,
      limit: mockLimit,
      populate: mockPopulateTeacher
    });
    
    mockPopulateTeacher.mockReturnValue({
      populate: mockPopulateParent
    });
    
    mockPopulateParent.mockReturnValue({
      populate: mockPopulateStudent
    });
    
    Meeting.countDocuments.mockResolvedValue(1);
    
    // 查询参数
    const queryParams = {
      teacher: 'teacher-id-1',
      parent: 'parent-id-1',
      student: 'student-id-1',
      status: '待确认',
      startDate: '2025-05-01',
      endDate: '2025-05-31',
      limit: 5,
      skip: 0
    };
    
    // 发送请求
    const response = await request(app)
      .get('/api/interaction/meetings')
      .query(queryParams);
    
    // 验证响应
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('pagination');
    expect(response.body.data).toEqual(mockMeetings);
    expect(response.body.pagination).toEqual({
      total: 1,
      limit: 5,
      skip: 0
    });
    
    // 验证模拟函数被正确调用
    expect(Meeting.find).toHaveBeenCalledWith({
      teacher: 'teacher-id-1',
      parent: 'parent-id-1',
      student: 'student-id-1',
      status: '待确认',
      startTime: {
        $gte: expect.any(Date),
        $lte: expect.any(Date)
      }
    });
    expect(mockSort).toHaveBeenCalledWith({ startTime: 1 });
    expect(mockSkip).toHaveBeenCalledWith(0);
    expect(mockLimit).toHaveBeenCalledWith(5);
    expect(Meeting.countDocuments).toHaveBeenCalledWith({
      teacher: 'teacher-id-1',
      parent: 'parent-id-1',
      student: 'student-id-1',
      status: '待确认',
      startTime: {
        $gte: expect.any(Date),
        $lte: expect.any(Date)
      }
    });
  });
  
  it('应该处理数据库查询错误', async () => {
    // 设置模拟函数抛出错误
    Meeting.find.mockImplementation(() => {
      throw new Error('数据库查询错误');
    });
    
    // 发送请求
    const response = await request(app)
      .get('/api/interaction/meetings');
    
    // 验证响应
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message', '获取会议列表失败');
    expect(response.body).toHaveProperty('error', '数据库查询错误');
  });
});

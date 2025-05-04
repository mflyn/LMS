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
  mockMeeting.findOne = jest.fn();
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

describe('会议路由测试 - 第二部分', () => {
  let app;
  const Meeting = require('../../models/Meeting');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/meetings', router);
    
    // 重置所有模拟函数
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
          teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
          parent: { _id: 'parent-id-1', name: '家长1', role: 'parent' },
          student: { _id: 'student-id-1', name: '学生1', grade: '一年级', class: '一班' },
          startTime: new Date('2023-01-01T10:00:00Z'),
          endTime: new Date('2023-01-01T11:00:00Z'),
          status: 'scheduled'
        },
        {
          _id: 'meeting-id-2',
          title: '测试会议2',
          teacher: { _id: 'teacher-id-2', name: '教师2', role: 'teacher' },
          parent: { _id: 'parent-id-2', name: '家长2', role: 'parent' },
          student: { _id: 'student-id-2', name: '学生2', grade: '二年级', class: '二班' },
          startTime: new Date('2023-01-02T10:00:00Z'),
          endTime: new Date('2023-01-02T11:00:00Z'),
          status: 'scheduled'
        }
      ];
      
      // 创建模拟链式调用
      const mockPopulate3 = jest.fn().mockReturnValue(mockMeetings);
      const mockPopulate2 = jest.fn().mockReturnValue({ populate: mockPopulate3 });
      const mockPopulate1 = jest.fn().mockReturnValue({ populate: mockPopulate2 });
      const mockLimit = jest.fn().mockReturnValue({ populate: mockPopulate1 });
      const mockSkip = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ skip: mockSkip });
      
      // 设置模拟函数的返回值
      Meeting.find.mockReturnValue({ sort: mockSort });
      
      // 模拟 countDocuments 方法的返回值
      Meeting.countDocuments.mockResolvedValue(2);
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings')
        .query({ limit: 10, skip: 0 });
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 2);
      expect(response.body.pagination).toHaveProperty('limit', 10);
      expect(response.body.pagination).toHaveProperty('skip', 0);
      
      // 验证模拟函数被正确调用
      expect(Meeting.find).toHaveBeenCalledWith({});
      expect(mockSort).toHaveBeenCalledWith({ startTime: 1 });
      expect(mockSkip).toHaveBeenCalledWith(0);
      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(mockPopulate1).toHaveBeenCalledWith('teacher', 'name role');
      expect(mockPopulate2).toHaveBeenCalledWith('parent', 'name role');
      expect(mockPopulate3).toHaveBeenCalledWith('student', 'name grade class');
      expect(Meeting.countDocuments).toHaveBeenCalledWith({});
    });
    
    it('应该支持按教师筛选', async () => {
      // 模拟数据
      const mockMeetings = [
        {
          _id: 'meeting-id-1',
          title: '测试会议1',
          teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
          parent: { _id: 'parent-id-1', name: '家长1', role: 'parent' },
          student: { _id: 'student-id-1', name: '学生1', grade: '一年级', class: '一班' },
          startTime: new Date('2023-01-01T10:00:00Z'),
          endTime: new Date('2023-01-01T11:00:00Z'),
          status: 'scheduled'
        }
      ];
      
      // 创建模拟链式调用
      const mockPopulate3 = jest.fn().mockReturnValue(mockMeetings);
      const mockPopulate2 = jest.fn().mockReturnValue({ populate: mockPopulate3 });
      const mockPopulate1 = jest.fn().mockReturnValue({ populate: mockPopulate2 });
      const mockLimit = jest.fn().mockReturnValue({ populate: mockPopulate1 });
      const mockSkip = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ skip: mockSkip });
      
      // 设置模拟函数的返回值
      Meeting.find.mockReturnValue({ sort: mockSort });
      
      // 模拟 countDocuments 方法的返回值
      Meeting.countDocuments.mockResolvedValue(1);
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings')
        .query({ teacher: 'teacher-id-1', limit: 10, skip: 0 });
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 1);
      
      // 验证模拟函数被正确调用
      expect(Meeting.find).toHaveBeenCalledWith({ teacher: 'teacher-id-1' });
      expect(Meeting.countDocuments).toHaveBeenCalledWith({ teacher: 'teacher-id-1' });
    });
    
    it('应该支持按日期范围筛选', async () => {
      // 模拟数据
      const mockMeetings = [
        {
          _id: 'meeting-id-1',
          title: '测试会议1',
          teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
          parent: { _id: 'parent-id-1', name: '家长1', role: 'parent' },
          student: { _id: 'student-id-1', name: '学生1', grade: '一年级', class: '一班' },
          startTime: new Date('2023-01-01T10:00:00Z'),
          endTime: new Date('2023-01-01T11:00:00Z'),
          status: 'scheduled'
        }
      ];
      
      // 创建模拟链式调用
      const mockPopulate3 = jest.fn().mockReturnValue(mockMeetings);
      const mockPopulate2 = jest.fn().mockReturnValue({ populate: mockPopulate3 });
      const mockPopulate1 = jest.fn().mockReturnValue({ populate: mockPopulate2 });
      const mockLimit = jest.fn().mockReturnValue({ populate: mockPopulate1 });
      const mockSkip = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ skip: mockSkip });
      
      // 设置模拟函数的返回值
      Meeting.find.mockReturnValue({ sort: mockSort });
      
      // 模拟 countDocuments 方法的返回值
      Meeting.countDocuments.mockResolvedValue(1);
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings')
        .query({ 
          startDate: '2023-01-01', 
          endDate: '2023-01-31',
          limit: 10, 
          skip: 0 
        });
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 1);
      
      // 验证模拟函数被正确调用
      expect(Meeting.find).toHaveBeenCalledWith({
        startTime: {
          $gte: expect.any(Date),
          $lte: expect.any(Date)
        }
      });
      expect(Meeting.countDocuments).toHaveBeenCalledWith({
        startTime: {
          $gte: expect.any(Date),
          $lte: expect.any(Date)
        }
      });
    });
    
    it('应该处理数据库查询错误', async () => {
      // 模拟 find 方法抛出错误
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
  
  // 测试获取单个会议
  describe('GET /api/interaction/meetings/:id', () => {
    it('应该成功获取单个会议', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议1',
        teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
        parent: { _id: 'parent-id-1', name: '家长1', role: 'parent' },
        student: { _id: 'student-id-1', name: '学生1', grade: '一年级', class: '一班' },
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T11:00:00Z'),
        status: 'scheduled'
      };
      
      // 创建模拟链式调用
      const mockPopulate3 = jest.fn().mockReturnValue(mockMeeting);
      const mockPopulate2 = jest.fn().mockReturnValue({ populate: mockPopulate3 });
      const mockPopulate1 = jest.fn().mockReturnValue({ populate: mockPopulate2 });
      
      // 设置模拟函数的返回值
      Meeting.findById.mockReturnValue({ populate: mockPopulate1 });
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/meeting-id-1');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', 'meeting-id-1');
      expect(response.body).toHaveProperty('title', '测试会议1');
      
      // 验证模拟函数被正确调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
      expect(mockPopulate1).toHaveBeenCalledWith('teacher', 'name role');
      expect(mockPopulate2).toHaveBeenCalledWith('parent', 'name role');
      expect(mockPopulate3).toHaveBeenCalledWith('student', 'name grade class');
    });
    
    it('应该处理会议不存在的情况', async () => {
      // 创建模拟链式调用
      const mockPopulate3 = jest.fn().mockReturnValue(null);
      const mockPopulate2 = jest.fn().mockReturnValue({ populate: mockPopulate3 });
      const mockPopulate1 = jest.fn().mockReturnValue({ populate: mockPopulate2 });
      
      // 设置模拟函数的返回值
      Meeting.findById.mockReturnValue({ populate: mockPopulate1 });
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/non-existent-id');
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });
    
    it('应该处理数据库查询错误', async () => {
      // 模拟 findById 方法抛出错误
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
});

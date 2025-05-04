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

describe('会议路由测试 - 第五部分', () => {
  let app;
  const Meeting = require('../../models/Meeting');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/meetings', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
    
    // 模拟 Date.now() 返回固定的时间
    jest.spyOn(Date, 'now').mockImplementation(() => new Date('2023-01-01T00:00:00Z').getTime());
  });
  
  afterEach(() => {
    // 恢复 Date.now() 的原始实现
    jest.restoreAllMocks();
  });
  
  // 测试获取用户即将到来的会议
  describe('GET /api/interaction/meetings/upcoming/:userId', () => {
    it('应该成功获取教师即将到来的会议', async () => {
      // 模拟数据
      const mockMeetings = [
        {
          _id: 'meeting-id-1',
          title: '测试会议1',
          teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
          parent: { _id: 'parent-id-1', name: '家长1', role: 'parent' },
          student: { _id: 'student-id-1', name: '学生1', grade: '一年级', class: '一班' },
          startTime: new Date('2023-01-02T10:00:00Z'),
          endTime: new Date('2023-01-02T11:00:00Z'),
          status: 'scheduled'
        },
        {
          _id: 'meeting-id-2',
          title: '测试会议2',
          teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
          parent: { _id: 'parent-id-2', name: '家长2', role: 'parent' },
          student: { _id: 'student-id-2', name: '学生2', grade: '一年级', class: '一班' },
          startTime: new Date('2023-01-03T10:00:00Z'),
          endTime: new Date('2023-01-03T11:00:00Z'),
          status: 'scheduled'
        }
      ];
      
      // 创建模拟链式调用
      const mockPopulate3 = jest.fn().mockReturnValue(mockMeetings);
      const mockPopulate2 = jest.fn().mockReturnValue({ populate: mockPopulate3 });
      const mockPopulate1 = jest.fn().mockReturnValue({ populate: mockPopulate2 });
      const mockLimit = jest.fn().mockReturnValue({ populate: mockPopulate1 });
      const mockSort = jest.fn().mockReturnValue({ limit: mockLimit });
      
      // 设置模拟函数的返回值
      Meeting.find.mockReturnValue({ sort: mockSort });
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/upcoming/teacher-id-1')
        .query({ role: 'teacher', limit: 5 });
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('_id', 'meeting-id-1');
      expect(response.body[1]).toHaveProperty('_id', 'meeting-id-2');
      
      // 验证模拟函数被正确调用
      expect(Meeting.find).toHaveBeenCalledWith({
        teacher: 'teacher-id-1',
        startTime: { $gt: expect.any(Date) },
        status: 'scheduled'
      });
      expect(mockSort).toHaveBeenCalledWith({ startTime: 1 });
      expect(mockLimit).toHaveBeenCalledWith(5);
      expect(mockPopulate1).toHaveBeenCalledWith('teacher', 'name role');
      expect(mockPopulate2).toHaveBeenCalledWith('parent', 'name role');
      expect(mockPopulate3).toHaveBeenCalledWith('student', 'name grade class');
    });
    
    it('应该成功获取家长即将到来的会议', async () => {
      // 模拟数据
      const mockMeetings = [
        {
          _id: 'meeting-id-1',
          title: '测试会议1',
          teacher: { _id: 'teacher-id-1', name: '教师1', role: 'teacher' },
          parent: { _id: 'parent-id-1', name: '家长1', role: 'parent' },
          student: { _id: 'student-id-1', name: '学生1', grade: '一年级', class: '一班' },
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
      const mockSort = jest.fn().mockReturnValue({ limit: mockLimit });
      
      // 设置模拟函数的返回值
      Meeting.find.mockReturnValue({ sort: mockSort });
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/upcoming/parent-id-1')
        .query({ role: 'parent', limit: 5 });
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('_id', 'meeting-id-1');
      
      // 验证模拟函数被正确调用
      expect(Meeting.find).toHaveBeenCalledWith({
        parent: 'parent-id-1',
        startTime: { $gt: expect.any(Date) },
        status: 'scheduled'
      });
    });
    
    it('应该验证用户ID和角色不能为空', async () => {
      // 发送请求（缺少角色）
      const response = await request(app)
        .get('/api/interaction/meetings/upcoming/teacher-id-1');
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '用户ID和角色不能为空');
      
      // 验证 find 方法没有被调用
      expect(Meeting.find).not.toHaveBeenCalled();
    });
    
    it('应该处理数据库查询错误', async () => {
      // 模拟 find 方法抛出错误
      Meeting.find.mockImplementation(() => {
        throw new Error('数据库查询错误');
      });
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/upcoming/teacher-id-1')
        .query({ role: 'teacher' });
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取即将到来的会议失败');
      expect(response.body).toHaveProperty('error', '数据库查询错误');
      
      // 验证 find 方法被调用
      expect(Meeting.find).toHaveBeenCalled();
    });
  });
});

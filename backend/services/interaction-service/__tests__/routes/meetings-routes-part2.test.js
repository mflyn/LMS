/**
 * 会议路由测试 - 第二部分
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Meeting = require('../../models/Meeting');

// 模拟 mongoose
jest.mock('mongoose', () => {
  const mockMongoose = {
    connect: jest.fn().mockResolvedValue({}),
    connection: {
      on: jest.fn(),
      once: jest.fn()
    }
  };
  return mockMongoose;
});

// 模拟 Meeting 模型
jest.mock('../../models/Meeting', () => {
  return {
    find: jest.fn().mockReturnThis(),
    findById: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    findByIdAndUpdate: jest.fn().mockReturnThis(),
    findByIdAndDelete: jest.fn().mockReturnThis(),
    countDocuments: jest.fn().mockResolvedValue(10),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue({})
  };
});

// 创建测试应用
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // 导入会议路由
  const meetingsRouter = require('../../routes/meetings');
  app.use('/api/meetings', meetingsRouter);
  
  return app;
};

describe('会议路由测试 - 第二部分', () => {
  let app;
  
  beforeEach(() => {
    // 重置所有模拟函数
    jest.clearAllMocks();
    
    // 创建测试应用
    app = createTestApp();
    
    // 模拟 Meeting 构造函数
    Meeting.mockImplementation(function(data) {
      this._id = 'meeting-id';
      this.title = data.title;
      this.description = data.description || '';
      this.teacher = data.teacher;
      this.parent = data.parent;
      this.student = data.student;
      this.startTime = data.startTime;
      this.endTime = data.endTime;
      this.location = data.location || '';
      this.meetingType = data.meetingType || 'offline';
      this.meetingLink = data.meetingLink || '';
      this.status = data.status || 'scheduled';
      this.notes = data.notes || '';
      this.feedback = data.feedback || '';
      this.createdAt = new Date();
      this.updatedAt = new Date();
      this.save = jest.fn().mockResolvedValue(this);
      return this;
    });
  });
  
  describe('GET /api/meetings/:id', () => {
    it('应该成功获取单个会议', async () => {
      // 模拟 Meeting.findById 返回会议
      const mockMeeting = {
        _id: 'meeting-id',
        title: '家长会议',
        teacher: { _id: 'teacher-id', name: 'Teacher', role: 'teacher' },
        parent: { _id: 'parent-id', name: 'Parent', role: 'parent' },
        student: { _id: 'student-id', name: 'Student', grade: '3', class: '2' },
        startTime: new Date('2023-06-01T10:00:00Z'),
        endTime: new Date('2023-06-01T11:00:00Z'),
        status: 'scheduled',
        createdAt: new Date()
      };
      
      Meeting.findById.mockImplementation(() => ({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockMeeting)
      }));
      
      // 发送请求
      const response = await request(app).get('/api/meetings/meeting-id');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', 'meeting-id');
      expect(response.body).toHaveProperty('title', '家长会议');
      
      // 验证 Meeting.findById 被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id');
    });
    
    it('应该处理会议不存在的情况', async () => {
      // 模拟 Meeting.findById 返回 null
      Meeting.findById.mockImplementation(() => ({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null)
      }));
      
      // 发送请求
      const response = await request(app).get('/api/meetings/non-existent-id');
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });
    
    it('应该处理数据库查询错误', async () => {
      // 模拟 Meeting.findById 抛出错误
      Meeting.findById.mockImplementation(() => {
        throw new Error('数据库查询错误');
      });
      
      // 发送请求
      const response = await request(app).get('/api/meetings/meeting-id');
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会议失败');
      expect(response.body).toHaveProperty('error', '数据库查询错误');
    });
  });
  
  describe('POST /api/meetings', () => {
    it('应该成功创建会议', async () => {
      // 准备请求数据
      const meetingData = {
        title: '家长会议',
        description: '讨论学生近期表现',
        teacher: 'teacher-id',
        parent: 'parent-id',
        student: 'student-id',
        startTime: '2023-06-01T10:00:00Z',
        endTime: '2023-06-01T11:00:00Z',
        location: '线上会议',
        meetingType: 'online',
        meetingLink: 'https://meeting.example.com/123'
      };
      
      // 模拟 Meeting.findOne 返回 null（没有冲突）
      Meeting.findOne.mockResolvedValue(null);
      
      // 发送请求
      const response = await request(app)
        .post('/api/meetings')
        .send(meetingData);
      
      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('title', '家长会议');
      expect(response.body).toHaveProperty('teacher', 'teacher-id');
      expect(response.body).toHaveProperty('parent', 'parent-id');
      expect(response.body).toHaveProperty('student', 'student-id');
      expect(response.body).toHaveProperty('status', 'scheduled');
      
      // 验证 Meeting.findOne 被调用（检查冲突）
      expect(Meeting.findOne).toHaveBeenCalled();
    });
    
    it('应该验证必要参数', async () => {
      // 准备请求数据（缺少必要参数）
      const invalidData = {
        title: '家长会议',
        teacher: 'teacher-id'
        // 缺少 parent, student, startTime, endTime
      };
      
      // 发送请求
      const response = await request(app)
        .post('/api/meetings')
        .send(invalidData);
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题、教师、家长、学生、开始时间和结束时间不能为空');
    });
    
    it('应该检测时间冲突', async () => {
      // 准备请求数据
      const meetingData = {
        title: '家长会议',
        description: '讨论学生近期表现',
        teacher: 'teacher-id',
        parent: 'parent-id',
        student: 'student-id',
        startTime: '2023-06-01T10:00:00Z',
        endTime: '2023-06-01T11:00:00Z'
      };
      
      // 模拟 Meeting.findOne 返回冲突会议
      const conflictMeeting = {
        _id: 'conflict-meeting-id',
        title: '冲突会议',
        startTime: new Date('2023-06-01T09:30:00Z'),
        endTime: new Date('2023-06-01T10:30:00Z')
      };
      Meeting.findOne.mockResolvedValue(conflictMeeting);
      
      // 发送请求
      const response = await request(app)
        .post('/api/meetings')
        .send(meetingData);
      
      // 验证响应
      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('message', '会议时间冲突');
      expect(response.body).toHaveProperty('conflictWith', 'conflict-meeting-id');
    });
    
    it('应该处理保存错误', async () => {
      // 准备请求数据
      const meetingData = {
        title: '家长会议',
        description: '讨论学生近期表现',
        teacher: 'teacher-id',
        parent: 'parent-id',
        student: 'student-id',
        startTime: '2023-06-01T10:00:00Z',
        endTime: '2023-06-01T11:00:00Z'
      };
      
      // 模拟 Meeting.findOne 返回 null（没有冲突）
      Meeting.findOne.mockResolvedValue(null);
      
      // 模拟 save 方法抛出错误
      Meeting.prototype.save = jest.fn().mockRejectedValue(new Error('保存错误'));
      
      // 发送请求
      const response = await request(app)
        .post('/api/meetings')
        .send(meetingData);
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '创建会议失败');
      expect(response.body).toHaveProperty('error', '保存错误');
    });
  });
});

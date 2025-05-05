/**
 * 会议路由测试 - 第一部分
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

describe('会议路由测试 - 第一部分', () => {
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
  
  describe('GET /api/meetings', () => {
    it('应该成功获取会议列表', async () => {
      // 模拟 Meeting.find 返回会议列表
      const mockMeetings = [
        {
          _id: 'meeting-id-1',
          title: '家长会议 1',
          teacher: { _id: 'teacher-id', name: 'Teacher', role: 'teacher' },
          parent: { _id: 'parent-id', name: 'Parent', role: 'parent' },
          student: { _id: 'student-id', name: 'Student', grade: '3', class: '2' },
          startTime: new Date('2023-06-01T10:00:00Z'),
          endTime: new Date('2023-06-01T11:00:00Z'),
          status: 'scheduled',
          createdAt: new Date()
        },
        {
          _id: 'meeting-id-2',
          title: '家长会议 2',
          teacher: { _id: 'teacher-id', name: 'Teacher', role: 'teacher' },
          parent: { _id: 'parent-id', name: 'Parent', role: 'parent' },
          student: { _id: 'student-id', name: 'Student', grade: '3', class: '2' },
          startTime: new Date('2023-06-02T10:00:00Z'),
          endTime: new Date('2023-06-02T11:00:00Z'),
          status: 'scheduled',
          createdAt: new Date()
        }
      ];
      
      Meeting.find.mockImplementation(() => ({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockMeetings)
      }));
      
      Meeting.countDocuments.mockResolvedValue(2);
      
      // 发送请求
      const response = await request(app).get('/api/meetings');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 2);
      
      // 验证 Meeting.find 被调用
      expect(Meeting.find).toHaveBeenCalled();
      expect(Meeting.countDocuments).toHaveBeenCalled();
    });
    
    it('应该支持分页功能', async () => {
      // 模拟 Meeting.find 返回会议列表
      const mockMeetings = [
        {
          _id: 'meeting-id-1',
          title: '家长会议 1',
          teacher: { _id: 'teacher-id', name: 'Teacher', role: 'teacher' },
          parent: { _id: 'parent-id', name: 'Parent', role: 'parent' },
          student: { _id: 'student-id', name: 'Student', grade: '3', class: '2' },
          startTime: new Date('2023-06-01T10:00:00Z'),
          endTime: new Date('2023-06-01T11:00:00Z'),
          status: 'scheduled',
          createdAt: new Date()
        }
      ];
      
      Meeting.find.mockImplementation(() => ({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockMeetings)
      }));
      
      Meeting.countDocuments.mockResolvedValue(10);
      
      // 发送请求
      const response = await request(app).get('/api/meetings?limit=5&skip=5');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 10);
      expect(response.body.pagination).toHaveProperty('limit', 5);
      expect(response.body.pagination).toHaveProperty('skip', 5);
      
      // 验证 Meeting.find 被调用
      expect(Meeting.find).toHaveBeenCalled();
    });
    
    it('应该支持按教师/家长/学生筛选', async () => {
      // 模拟 Meeting.find 返回会议列表
      const mockMeetings = [
        {
          _id: 'meeting-id-1',
          title: '家长会议 1',
          teacher: { _id: 'teacher-id', name: 'Teacher', role: 'teacher' },
          parent: { _id: 'parent-id', name: 'Parent', role: 'parent' },
          student: { _id: 'student-id', name: 'Student', grade: '3', class: '2' },
          startTime: new Date('2023-06-01T10:00:00Z'),
          endTime: new Date('2023-06-01T11:00:00Z'),
          status: 'scheduled',
          createdAt: new Date()
        }
      ];
      
      Meeting.find.mockImplementation(() => ({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockMeetings)
      }));
      
      Meeting.countDocuments.mockResolvedValue(1);
      
      // 发送请求
      const response = await request(app).get('/api/meetings?teacher=teacher-id&parent=parent-id&student=student-id');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.pagination).toHaveProperty('total', 1);
      
      // 验证 Meeting.find 被调用
      expect(Meeting.find).toHaveBeenCalled();
      expect(Meeting.find.mock.calls[0][0]).toHaveProperty('teacher', 'teacher-id');
      expect(Meeting.find.mock.calls[0][0]).toHaveProperty('parent', 'parent-id');
      expect(Meeting.find.mock.calls[0][0]).toHaveProperty('student', 'student-id');
    });
    
    it('应该处理数据库查询错误', async () => {
      // 模拟 Meeting.find 抛出错误
      Meeting.find.mockImplementation(() => {
        throw new Error('数据库查询错误');
      });
      
      // 发送请求
      const response = await request(app).get('/api/meetings');
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会议列表失败');
      expect(response.body).toHaveProperty('error', '数据库查询错误');
    });
  });
});

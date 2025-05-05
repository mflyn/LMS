/**
 * 会议路由测试 - 第四部分
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

describe('会议路由测试 - 第四部分', () => {
  let app;
  
  beforeEach(() => {
    // 重置所有模拟函数
    jest.clearAllMocks();
    
    // 创建测试应用
    app = createTestApp();
  });
  
  describe('PUT /api/meetings/:id/feedback', () => {
    it('应该成功添加会议反馈', async () => {
      // 模拟 Meeting.findById 返回会议
      const mockMeeting = {
        _id: 'meeting-id',
        title: '会议标题',
        feedback: '',
        save: jest.fn().mockResolvedValue({})
      };
      
      Meeting.findById.mockResolvedValue(mockMeeting);
      
      // 准备请求数据
      const feedbackData = {
        feedback: '会议很有成效，讨论了学生的学习进度和需要改进的地方。'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/meetings/meeting-id/feedback')
        .send(feedbackData);
      
      // 验证响应
      expect(response.status).toBe(200);
      
      // 验证 Meeting.findById 被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id');
      
      // 验证会议反馈被更新
      expect(mockMeeting.feedback).toBe('会议很有成效，讨论了学生的学习进度和需要改进的地方。');
      
      // 验证 save 方法被调用
      expect(mockMeeting.save).toHaveBeenCalled();
    });
    
    it('应该验证必要参数', async () => {
      // 准备请求数据（缺少必要参数）
      const invalidData = {
        // 缺少 feedback
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/meetings/meeting-id/feedback')
        .send(invalidData);
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '反馈内容不能为空');
    });
    
    it('应该处理会议不存在的情况', async () => {
      // 模拟 Meeting.findById 返回 null
      Meeting.findById.mockResolvedValue(null);
      
      // 准备请求数据
      const feedbackData = {
        feedback: '会议反馈'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/meetings/non-existent-id/feedback')
        .send(feedbackData);
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });
    
    it('应该处理保存错误', async () => {
      // 模拟 Meeting.findById 返回会议
      const mockMeeting = {
        _id: 'meeting-id',
        title: '会议标题',
        feedback: '',
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      };
      
      Meeting.findById.mockResolvedValue(mockMeeting);
      
      // 准备请求数据
      const feedbackData = {
        feedback: '会议反馈'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/meetings/meeting-id/feedback')
        .send(feedbackData);
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '添加会议反馈失败');
      expect(response.body).toHaveProperty('error', '保存错误');
    });
  });
  
  describe('GET /api/meetings/upcoming/:userId', () => {
    it('应该成功获取即将到来的会议', async () => {
      // 模拟 Meeting.find 返回会议列表
      const mockMeetings = [
        {
          _id: 'meeting-id-1',
          title: '即将到来的会议 1',
          teacher: { _id: 'teacher-id', name: 'Teacher', role: 'teacher' },
          parent: { _id: 'parent-id', name: 'Parent', role: 'parent' },
          student: { _id: 'student-id', name: 'Student', grade: '3', class: '2' },
          startTime: new Date('2023-06-01T10:00:00Z'),
          endTime: new Date('2023-06-01T11:00:00Z'),
          status: 'scheduled'
        },
        {
          _id: 'meeting-id-2',
          title: '即将到来的会议 2',
          teacher: { _id: 'teacher-id', name: 'Teacher', role: 'teacher' },
          parent: { _id: 'parent-id', name: 'Parent', role: 'parent' },
          student: { _id: 'student-id', name: 'Student', grade: '3', class: '2' },
          startTime: new Date('2023-06-02T10:00:00Z'),
          endTime: new Date('2023-06-02T11:00:00Z'),
          status: 'scheduled'
        }
      ];
      
      Meeting.find.mockImplementation(() => ({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockMeetings)
      }));
      
      // 发送请求
      const response = await request(app).get('/api/meetings/upcoming/teacher-id?role=teacher&limit=5');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      
      // 验证 Meeting.find 被调用
      expect(Meeting.find).toHaveBeenCalled();
      expect(Meeting.find.mock.calls[0][0]).toHaveProperty('teacher', 'teacher-id');
      expect(Meeting.find.mock.calls[0][0]).toHaveProperty('startTime');
      expect(Meeting.find.mock.calls[0][0]).toHaveProperty('status', 'scheduled');
    });
    
    it('应该验证必要参数', async () => {
      // 发送请求（缺少 role 参数）
      const response = await request(app).get('/api/meetings/upcoming/teacher-id');
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '用户ID和角色不能为空');
    });
    
    it('应该处理查询错误', async () => {
      // 模拟 Meeting.find 抛出错误
      Meeting.find.mockImplementation(() => {
        throw new Error('查询错误');
      });
      
      // 发送请求
      const response = await request(app).get('/api/meetings/upcoming/teacher-id?role=teacher');
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取即将到来的会议失败');
      expect(response.body).toHaveProperty('error', '查询错误');
    });
  });
});

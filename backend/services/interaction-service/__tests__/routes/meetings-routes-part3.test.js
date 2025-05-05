/**
 * 会议路由测试 - 第三部分
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

describe('会议路由测试 - 第三部分', () => {
  let app;
  
  beforeEach(() => {
    // 重置所有模拟函数
    jest.clearAllMocks();
    
    // 创建测试应用
    app = createTestApp();
  });
  
  describe('PUT /api/meetings/:id', () => {
    it('应该成功更新会议', async () => {
      // 模拟 Meeting.findById 返回会议
      const mockMeeting = {
        _id: 'meeting-id',
        title: '原会议标题',
        description: '原会议描述',
        teacher: 'teacher-id',
        parent: 'parent-id',
        student: 'student-id',
        startTime: new Date('2023-06-01T10:00:00Z'),
        endTime: new Date('2023-06-01T11:00:00Z'),
        location: '线上会议',
        meetingType: 'online',
        meetingLink: 'https://meeting.example.com/123',
        status: 'scheduled',
        notes: '',
        save: jest.fn().mockResolvedValue({})
      };
      
      Meeting.findById.mockResolvedValue(mockMeeting);
      
      // 模拟 Meeting.findOne 返回 null（没有冲突）
      Meeting.findOne.mockResolvedValue(null);
      
      // 准备请求数据
      const updateData = {
        title: '更新后的会议标题',
        description: '更新后的会议描述',
        startTime: '2023-06-02T10:00:00Z',
        endTime: '2023-06-02T11:00:00Z',
        location: '线下会议',
        meetingType: 'offline',
        notes: '会议备注'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/meetings/meeting-id')
        .send(updateData);
      
      // 验证响应
      expect(response.status).toBe(200);
      
      // 验证 Meeting.findById 被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id');
      
      // 验证 Meeting.findOne 被调用（检查冲突）
      expect(Meeting.findOne).toHaveBeenCalled();
      
      // 验证会议属性被更新
      expect(mockMeeting.title).toBe('更新后的会议标题');
      expect(mockMeeting.description).toBe('更新后的会议描述');
      expect(mockMeeting.location).toBe('线下会议');
      expect(mockMeeting.meetingType).toBe('offline');
      expect(mockMeeting.notes).toBe('会议备注');
      
      // 验证 save 方法被调用
      expect(mockMeeting.save).toHaveBeenCalled();
    });
    
    it('应该处理会议不存在的情况', async () => {
      // 模拟 Meeting.findById 返回 null
      Meeting.findById.mockResolvedValue(null);
      
      // 准备请求数据
      const updateData = {
        title: '更新后的会议标题'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/meetings/non-existent-id')
        .send(updateData);
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });
    
    it('应该处理已取消会议的更新', async () => {
      // 模拟 Meeting.findById 返回已取消的会议
      const cancelledMeeting = {
        _id: 'meeting-id',
        title: '已取消的会议',
        status: 'cancelled'
      };
      
      Meeting.findById.mockResolvedValue(cancelledMeeting);
      
      // 准备请求数据
      const updateData = {
        title: '更新后的会议标题'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/meetings/meeting-id')
        .send(updateData);
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '已取消的会议不能更新');
    });
    
    it('应该检测时间冲突', async () => {
      // 模拟 Meeting.findById 返回会议
      const mockMeeting = {
        _id: 'meeting-id',
        title: '原会议标题',
        teacher: 'teacher-id',
        parent: 'parent-id',
        student: 'student-id',
        startTime: new Date('2023-06-01T10:00:00Z'),
        endTime: new Date('2023-06-01T11:00:00Z'),
        status: 'scheduled'
      };
      
      Meeting.findById.mockResolvedValue(mockMeeting);
      
      // 模拟 Meeting.findOne 返回冲突会议
      const conflictMeeting = {
        _id: 'conflict-meeting-id',
        title: '冲突会议',
        startTime: new Date('2023-06-02T09:30:00Z'),
        endTime: new Date('2023-06-02T10:30:00Z')
      };
      Meeting.findOne.mockResolvedValue(conflictMeeting);
      
      // 准备请求数据
      const updateData = {
        startTime: '2023-06-02T10:00:00Z',
        endTime: '2023-06-02T11:00:00Z'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/meetings/meeting-id')
        .send(updateData);
      
      // 验证响应
      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('message', '会议时间冲突');
      expect(response.body).toHaveProperty('conflictWith', 'conflict-meeting-id');
    });
    
    it('应该处理更新错误', async () => {
      // 模拟 Meeting.findById 返回会议
      const mockMeeting = {
        _id: 'meeting-id',
        title: '原会议标题',
        teacher: 'teacher-id',
        parent: 'parent-id',
        student: 'student-id',
        startTime: new Date('2023-06-01T10:00:00Z'),
        endTime: new Date('2023-06-01T11:00:00Z'),
        status: 'scheduled',
        save: jest.fn().mockRejectedValue(new Error('更新错误'))
      };
      
      Meeting.findById.mockResolvedValue(mockMeeting);
      
      // 模拟 Meeting.findOne 返回 null（没有冲突）
      Meeting.findOne.mockResolvedValue(null);
      
      // 准备请求数据
      const updateData = {
        title: '更新后的会议标题'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/meetings/meeting-id')
        .send(updateData);
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '更新会议失败');
      expect(response.body).toHaveProperty('error', '更新错误');
    });
  });
  
  describe('PUT /api/meetings/:id/cancel', () => {
    it('应该成功取消会议', async () => {
      // 模拟 Meeting.findById 返回会议
      const mockMeeting = {
        _id: 'meeting-id',
        title: '会议标题',
        status: 'scheduled',
        notes: '',
        save: jest.fn().mockResolvedValue({})
      };
      
      Meeting.findById.mockResolvedValue(mockMeeting);
      
      // 准备请求数据
      const cancelData = {
        reason: '无法参加'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/meetings/meeting-id/cancel')
        .send(cancelData);
      
      // 验证响应
      expect(response.status).toBe(200);
      
      // 验证 Meeting.findById 被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id');
      
      // 验证会议状态被更新
      expect(mockMeeting.status).toBe('cancelled');
      expect(mockMeeting.notes).toBe('无法参加');
      
      // 验证 save 方法被调用
      expect(mockMeeting.save).toHaveBeenCalled();
    });
    
    it('应该处理会议不存在的情况', async () => {
      // 模拟 Meeting.findById 返回 null
      Meeting.findById.mockResolvedValue(null);
      
      // 发送请求
      const response = await request(app)
        .put('/api/meetings/non-existent-id/cancel')
        .send({ reason: '无法参加' });
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });
    
    it('应该处理已结束会议的取消', async () => {
      // 模拟 Meeting.findById 返回已结束的会议
      const completedMeeting = {
        _id: 'meeting-id',
        title: '已结束的会议',
        status: 'completed'
      };
      
      Meeting.findById.mockResolvedValue(completedMeeting);
      
      // 发送请求
      const response = await request(app)
        .put('/api/meetings/meeting-id/cancel')
        .send({ reason: '无法参加' });
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '已结束的会议不能取消');
    });
    
    it('应该处理取消错误', async () => {
      // 模拟 Meeting.findById 返回会议
      const mockMeeting = {
        _id: 'meeting-id',
        title: '会议标题',
        status: 'scheduled',
        save: jest.fn().mockRejectedValue(new Error('取消错误'))
      };
      
      Meeting.findById.mockResolvedValue(mockMeeting);
      
      // 发送请求
      const response = await request(app)
        .put('/api/meetings/meeting-id/cancel')
        .send({ reason: '无法参加' });
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '取消会议失败');
      expect(response.body).toHaveProperty('error', '取消错误');
    });
  });
});

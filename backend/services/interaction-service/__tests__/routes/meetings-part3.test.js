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

describe('会议路由测试 - 第三部分', () => {
  let app;
  const Meeting = require('../../models/Meeting');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/meetings', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  // 测试更新会议
  describe('PUT /api/interaction/meetings/:id', () => {
    it('应该成功更新会议', async () => {
      // 模拟现有会议
      const existingMeeting = {
        _id: 'meeting-id-1',
        title: '原始标题',
        description: '原始描述',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T11:00:00Z'),
        location: '线下',
        meetingType: 'offline',
        meetingLink: '',
        status: 'scheduled',
        notes: '',
        feedback: '',
        save: jest.fn().mockResolvedValue({
          _id: 'meeting-id-1',
          title: '更新后的标题',
          description: '更新后的描述',
          teacher: 'teacher-id-1',
          parent: 'parent-id-1',
          student: 'student-id-1',
          startTime: new Date('2023-01-02T10:00:00Z'),
          endTime: new Date('2023-01-02T11:00:00Z'),
          location: '线上',
          meetingType: 'online',
          meetingLink: 'https://meeting.example.com/123',
          status: 'scheduled',
          notes: '更新后的备注',
          feedback: '',
          updatedAt: new Date()
        })
      };
      
      // 模拟 findById 方法返回现有会议
      Meeting.findById.mockResolvedValue(existingMeeting);
      
      // 模拟 findOne 方法返回 null（没有冲突的会议）
      Meeting.findOne.mockResolvedValue(null);
      
      // 准备请求数据
      const updateData = {
        title: '更新后的标题',
        description: '更新后的描述',
        startTime: new Date('2023-01-02T10:00:00Z').toISOString(),
        endTime: new Date('2023-01-02T11:00:00Z').toISOString(),
        location: '线上',
        meetingType: 'online',
        meetingLink: 'https://meeting.example.com/123',
        notes: '更新后的备注'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1')
        .send(updateData);
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('title', '更新后的标题');
      expect(response.body).toHaveProperty('description', '更新后的描述');
      expect(response.body).toHaveProperty('startTime');
      expect(response.body).toHaveProperty('endTime');
      expect(response.body).toHaveProperty('location', '线上');
      expect(response.body).toHaveProperty('meetingType', 'online');
      expect(response.body).toHaveProperty('meetingLink', 'https://meeting.example.com/123');
      expect(response.body).toHaveProperty('notes', '更新后的备注');
      
      // 验证 findById 方法被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
      
      // 验证 save 方法被调用
      expect(existingMeeting.save).toHaveBeenCalled();
    });
    
    it('应该处理会议不存在的情况', async () => {
      // 模拟 findById 方法返回 null
      Meeting.findById.mockResolvedValue(null);
      
      // 准备请求数据
      const updateData = {
        title: '更新后的标题',
        description: '更新后的描述'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/non-existent-id')
        .send(updateData);
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
      
      // 验证 findById 方法被调用
      expect(Meeting.findById).toHaveBeenCalledWith('non-existent-id');
    });
    
    it('应该处理已取消会议不能更新的情况', async () => {
      // 模拟已取消的会议
      const cancelledMeeting = {
        _id: 'meeting-id-1',
        title: '已取消的会议',
        status: 'cancelled'
      };
      
      // 模拟 findById 方法返回已取消的会议
      Meeting.findById.mockResolvedValue(cancelledMeeting);
      
      // 准备请求数据
      const updateData = {
        title: '更新后的标题',
        description: '更新后的描述'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1')
        .send(updateData);
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '已取消的会议不能更新');
      
      // 验证 findById 方法被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
    });
    
    it('应该处理会议时间冲突', async () => {
      // 模拟现有会议
      const existingMeeting = {
        _id: 'meeting-id-1',
        title: '原始标题',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T11:00:00Z'),
        status: 'scheduled',
        toISOString: () => '2023-01-01T10:00:00.000Z'
      };
      
      // 模拟 findById 方法返回现有会议
      Meeting.findById.mockResolvedValue(existingMeeting);
      
      // 模拟冲突的会议
      const conflictMeeting = {
        _id: 'conflict-meeting-id',
        title: '冲突会议',
        teacher: 'teacher-id-1',
        startTime: new Date('2023-01-02T09:30:00Z'),
        endTime: new Date('2023-01-02T10:30:00Z')
      };
      
      // 模拟 findOne 方法返回冲突的会议
      Meeting.findOne.mockResolvedValue(conflictMeeting);
      
      // 准备请求数据
      const updateData = {
        startTime: new Date('2023-01-02T10:00:00Z').toISOString(),
        endTime: new Date('2023-01-02T11:00:00Z').toISOString()
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1')
        .send(updateData);
      
      // 验证响应
      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('message', '会议时间冲突');
      expect(response.body).toHaveProperty('conflictWith', 'conflict-meeting-id');
      
      // 验证 findById 方法被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
      
      // 验证 findOne 方法被调用
      expect(Meeting.findOne).toHaveBeenCalled();
    });
    
    it('应该处理数据库更新错误', async () => {
      // 模拟现有会议
      const existingMeeting = {
        _id: 'meeting-id-1',
        title: '原始标题',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T11:00:00Z'),
        status: 'scheduled',
        save: jest.fn().mockRejectedValue(new Error('数据库更新错误'))
      };
      
      // 模拟 findById 方法返回现有会议
      Meeting.findById.mockResolvedValue(existingMeeting);
      
      // 模拟 findOne 方法返回 null（没有冲突的会议）
      Meeting.findOne.mockResolvedValue(null);
      
      // 准备请求数据
      const updateData = {
        title: '更新后的标题',
        description: '更新后的描述'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1')
        .send(updateData);
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '更新会议失败');
      expect(response.body).toHaveProperty('error', '数据库更新错误');
      
      // 验证 findById 方法被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
      
      // 验证 save 方法被调用
      expect(existingMeeting.save).toHaveBeenCalled();
    });
  });
});

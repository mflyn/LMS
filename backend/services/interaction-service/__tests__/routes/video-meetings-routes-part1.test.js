/**
 * 视频会议路由测试 - 第一部分
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Meeting = require('../../models/Meeting');
const videoMeetingsRouter = require('../../routes/video-meetings');

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
    findById: jest.fn().mockReturnThis(),
    save: jest.fn().mockResolvedValue({})
  };
});

// 创建测试应用
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // 导入视频会议路由
  app.use('/api/video-meetings', videoMeetingsRouter);
  
  return app;
};

describe('视频会议路由测试 - 第一部分', () => {
  let app;
  
  beforeEach(() => {
    // 重置所有模拟函数
    jest.clearAllMocks();
    
    // 重置路由状态
    videoMeetingsRouter.activeRooms = {};
    videoMeetingsRouter.userConnections = {};
    
    // 创建测试应用
    app = createTestApp();
    
    // 模拟 Meeting.findById 返回会议
    Meeting.findById.mockImplementation(() => ({
      _id: 'meeting-id',
      title: '测试会议',
      teacher: { toString: () => 'teacher-id' },
      parent: { toString: () => 'parent-id' },
      student: { toString: () => 'student-id' },
      status: '待确认',
      save: jest.fn().mockResolvedValue({})
    }));
  });
  
  describe('POST /api/video-meetings/rooms', () => {
    it('应该成功创建视频会议房间', async () => {
      // 准备请求数据
      const roomData = {
        meetingId: 'meeting-id',
        roomName: '测试视频会议'
      };
      
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/rooms')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role)
        .send(roomData);
      
      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', '视频会议房间创建成功');
      expect(response.body).toHaveProperty('room');
      expect(response.body.room).toHaveProperty('id');
      expect(response.body.room).toHaveProperty('name', '测试视频会议');
      expect(response.body.room).toHaveProperty('meetingId', 'meeting-id');
      expect(response.body.room).toHaveProperty('joinUrl');
      expect(response.body.room).toHaveProperty('iceServers');
      
      // 验证 Meeting.findById 被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id');
      
      // 验证房间被创建
      const roomId = response.body.room.id;
      expect(videoMeetingsRouter.activeRooms).toHaveProperty(roomId);
      expect(videoMeetingsRouter.activeRooms[roomId]).toHaveProperty('name', '测试视频会议');
      expect(videoMeetingsRouter.activeRooms[roomId]).toHaveProperty('meetingId', 'meeting-id');
      expect(videoMeetingsRouter.activeRooms[roomId]).toHaveProperty('createdBy', 'teacher-id');
    });
    
    it('应该验证必要参数', async () => {
      // 准备请求数据（缺少必要参数）
      const invalidData = {
        // 缺少 meetingId 和 roomName
      };
      
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/rooms')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role)
        .send(invalidData);
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '会议ID和房间名称不能为空');
    });
    
    it('应该处理会议不存在的情况', async () => {
      // 模拟 Meeting.findById 返回 null
      Meeting.findById.mockResolvedValue(null);
      
      // 准备请求数据
      const roomData = {
        meetingId: 'non-existent-meeting-id',
        roomName: '测试视频会议'
      };
      
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/rooms')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role)
        .send(roomData);
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });
    
    it('应该检查用户是否是会议参与者', async () => {
      // 准备请求数据
      const roomData = {
        meetingId: 'meeting-id',
        roomName: '测试视频会议'
      };
      
      // 设置用户信息（非会议参与者）
      const user = { id: 'non-participant-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/rooms')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role)
        .send(roomData);
      
      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足，您不是此会议的参与者');
    });
    
    it('应该处理保存错误', async () => {
      // 模拟 Meeting.save 抛出错误
      const mockMeeting = {
        _id: 'meeting-id',
        title: '测试会议',
        teacher: { toString: () => 'teacher-id' },
        parent: { toString: () => 'parent-id' },
        student: { toString: () => 'student-id' },
        status: '待确认',
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      };
      
      Meeting.findById.mockResolvedValue(mockMeeting);
      
      // 准备请求数据
      const roomData = {
        meetingId: 'meeting-id',
        roomName: '测试视频会议'
      };
      
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/rooms')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role)
        .send(roomData);
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');
    });
  });
});

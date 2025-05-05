/**
 * 视频会议路由测试 - 第二部分
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

describe('视频会议路由测试 - 第二部分', () => {
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
      status: '已确认',
      save: jest.fn().mockResolvedValue({})
    }));
    
    // 创建一个测试房间
    videoMeetingsRouter.activeRooms['test-room-id'] = {
      id: 'test-room-id',
      name: '测试视频会议',
      meetingId: 'meeting-id',
      createdBy: 'teacher-id',
      participants: [],
      createdAt: new Date(),
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };
  });
  
  describe('GET /api/video-meetings/join/:roomId', () => {
    it('应该成功加入视频会议', async () => {
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .get('/api/video-meetings/join/test-room-id')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role);
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '成功加入会议');
      expect(response.body).toHaveProperty('room');
      expect(response.body.room).toHaveProperty('id', 'test-room-id');
      expect(response.body.room).toHaveProperty('name', '测试视频会议');
      expect(response.body.room).toHaveProperty('meetingId', 'meeting-id');
      expect(response.body.room).toHaveProperty('participants');
      expect(response.body.room).toHaveProperty('iceServers');
      
      // 验证 Meeting.findById 被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id');
      
      // 验证用户被添加到参与者列表
      expect(videoMeetingsRouter.activeRooms['test-room-id'].participants).toContain('teacher-id');
      
      // 验证用户与房间关联
      expect(videoMeetingsRouter.userConnections).toHaveProperty('teacher-id', 'test-room-id');
    });
    
    it('应该处理房间不存在的情况', async () => {
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .get('/api/video-meetings/join/non-existent-room-id')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role);
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });
    
    it('应该处理会议不存在的情况', async () => {
      // 模拟 Meeting.findById 返回 null
      Meeting.findById.mockResolvedValue(null);
      
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .get('/api/video-meetings/join/test-room-id')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role);
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });
    
    it('应该检查用户是否是会议参与者', async () => {
      // 设置用户信息（非会议参与者）
      const user = { id: 'non-participant-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .get('/api/video-meetings/join/test-room-id')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role);
      
      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足，您不是此会议的参与者');
    });
  });
  
  describe('POST /api/video-meetings/leave/:roomId', () => {
    it('应该成功离开视频会议', async () => {
      // 添加用户到参与者列表
      videoMeetingsRouter.activeRooms['test-room-id'].participants.push('teacher-id');
      videoMeetingsRouter.userConnections['teacher-id'] = 'test-room-id';
      
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/leave/test-room-id')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role);
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '已离开会议');
      
      // 验证用户被从参与者列表中移除
      expect(videoMeetingsRouter.activeRooms['test-room-id'].participants).not.toContain('teacher-id');
      
      // 验证用户与房间的关联被移除
      expect(videoMeetingsRouter.userConnections).not.toHaveProperty('teacher-id');
    });
    
    it('应该处理房间不存在的情况', async () => {
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/leave/non-existent-room-id')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role);
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });
    
    it('应该在最后一个参与者离开时关闭房间', async () => {
      // 添加用户到参与者列表（唯一参与者）
      videoMeetingsRouter.activeRooms['test-room-id'].participants.push('teacher-id');
      videoMeetingsRouter.userConnections['teacher-id'] = 'test-room-id';
      
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/leave/test-room-id')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role);
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '已离开会议');
      
      // 验证房间被关闭
      expect(videoMeetingsRouter.activeRooms).not.toHaveProperty('test-room-id');
      
      // 验证会议状态被更新
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id');
    });
  });
});

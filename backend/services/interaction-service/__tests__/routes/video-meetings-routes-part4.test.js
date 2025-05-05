/**
 * 视频会议路由测试 - 第四部分
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

describe('视频会议路由测试 - 第四部分', () => {
  let app;
  
  beforeEach(() => {
    // 重置所有模拟函数
    jest.clearAllMocks();
    
    // 重置路由状态
    videoMeetingsRouter.activeRooms = {};
    videoMeetingsRouter.userConnections = {};
    
    // 重置全局信令队列
    global.signalingQueue = {};
    
    // 创建测试应用
    app = createTestApp();
    
    // 创建测试房间
    videoMeetingsRouter.activeRooms['test-room-id-1'] = {
      id: 'test-room-id-1',
      name: '测试视频会议 1',
      meetingId: 'meeting-id-1',
      createdBy: 'teacher-id',
      participants: ['teacher-id', 'parent-id'],
      createdAt: new Date(),
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };
    
    videoMeetingsRouter.activeRooms['test-room-id-2'] = {
      id: 'test-room-id-2',
      name: '测试视频会议 2',
      meetingId: 'meeting-id-2',
      createdBy: 'teacher-id',
      participants: ['teacher-id'],
      createdAt: new Date(),
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };
    
    // 设置用户连接
    videoMeetingsRouter.userConnections['teacher-id'] = 'test-room-id-1';
    videoMeetingsRouter.userConnections['parent-id'] = 'test-room-id-1';
    
    // 模拟 Meeting.findById 返回会议
    Meeting.findById.mockImplementation((id) => ({
      _id: id,
      title: '测试会议',
      status: '已确认',
      save: jest.fn().mockResolvedValue({})
    }));
  });
  
  describe('GET /api/video-meetings/rooms', () => {
    it('应该成功获取活跃房间列表（管理员）', async () => {
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'admin-id', role: 'admin' };
      
      // 发送请求
      const response = await request(app)
        .get('/api/video-meetings/rooms')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role);
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rooms');
      expect(response.body.rooms).toHaveLength(2);
      expect(response.body.rooms[0]).toHaveProperty('id', 'test-room-id-1');
      expect(response.body.rooms[0]).toHaveProperty('name', '测试视频会议 1');
      expect(response.body.rooms[0]).toHaveProperty('meetingId', 'meeting-id-1');
      expect(response.body.rooms[0]).toHaveProperty('participantCount', 2);
      expect(response.body.rooms[1]).toHaveProperty('id', 'test-room-id-2');
      expect(response.body.rooms[1]).toHaveProperty('participantCount', 1);
    });
    
    it('应该拒绝非管理员访问', async () => {
      // 设置用户信息（非管理员）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .get('/api/video-meetings/rooms')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role);
      
      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');
    });
  });
  
  describe('POST /api/video-meetings/end/:roomId', () => {
    it('应该成功结束视频会议（创建者）', async () => {
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/end/test-room-id-1')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role);
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '会议已结束');
      
      // 验证 Meeting.findById 被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
      
      // 验证房间被删除
      expect(videoMeetingsRouter.activeRooms).not.toHaveProperty('test-room-id-1');
      
      // 验证用户连接被删除
      expect(videoMeetingsRouter.userConnections).not.toHaveProperty('teacher-id');
      expect(videoMeetingsRouter.userConnections).not.toHaveProperty('parent-id');
      
      // 验证通知被发送给所有参与者
      expect(global.signalingQueue).toHaveProperty('teacher-id');
      expect(global.signalingQueue).toHaveProperty('parent-id');
      expect(global.signalingQueue['teacher-id'][0]).toHaveProperty('type', 'meeting-ended');
      expect(global.signalingQueue['parent-id'][0]).toHaveProperty('type', 'meeting-ended');
    });
    
    it('应该成功结束视频会议（管理员）', async () => {
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'admin-id', role: 'admin' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/end/test-room-id-1')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role);
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '会议已结束');
      
      // 验证房间被删除
      expect(videoMeetingsRouter.activeRooms).not.toHaveProperty('test-room-id-1');
    });
    
    it('应该处理房间不存在的情况', async () => {
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/end/non-existent-room-id')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role);
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });
    
    it('应该拒绝非创建者和非管理员结束会议', async () => {
      // 设置用户信息（非创建者和非管理员）
      const user = { id: 'parent-id', role: 'parent' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/end/test-room-id-1')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role);
      
      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足，只有会议创建者或管理员可以结束会议');
    });
    
    it('应该处理保存错误', async () => {
      // 模拟 Meeting.save 抛出错误
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        status: '已确认',
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      };
      
      Meeting.findById.mockResolvedValue(mockMeeting);
      
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/end/test-room-id-1')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role);
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');
    });
  });
});

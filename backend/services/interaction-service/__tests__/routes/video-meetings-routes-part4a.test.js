/**
 * 视频会议路由测试 - 第四部分 (a)
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

describe('视频会议路由测试 - 第四部分 (a)', () => {
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
});

/**
 * 视频会议路由测试 - 第三部分
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

describe('视频会议路由测试 - 第三部分', () => {
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
    
    // 创建一个测试房间
    videoMeetingsRouter.activeRooms['test-room-id'] = {
      id: 'test-room-id',
      name: '测试视频会议',
      meetingId: 'meeting-id',
      createdBy: 'teacher-id',
      participants: ['teacher-id', 'parent-id'],
      createdAt: new Date(),
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };
  });
  
  describe('POST /api/video-meetings/signal/offer', () => {
    it('应该成功发送offer', async () => {
      // 准备请求数据
      const offerData = {
        roomId: 'test-room-id',
        targetUserId: 'parent-id',
        offer: { type: 'offer', sdp: 'test-sdp' }
      };
      
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/signal/offer')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role)
        .send(offerData);
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Offer已发送');
      
      // 验证信令消息被添加到队列
      expect(global.signalingQueue).toHaveProperty('parent-id');
      expect(global.signalingQueue['parent-id']).toHaveLength(1);
      expect(global.signalingQueue['parent-id'][0]).toHaveProperty('type', 'offer');
      expect(global.signalingQueue['parent-id'][0]).toHaveProperty('from', 'teacher-id');
      expect(global.signalingQueue['parent-id'][0]).toHaveProperty('offer');
      expect(global.signalingQueue['parent-id'][0]).toHaveProperty('roomId', 'test-room-id');
    });
    
    it('应该验证必要参数', async () => {
      // 准备请求数据（缺少必要参数）
      const invalidData = {
        roomId: 'test-room-id',
        // 缺少 targetUserId 和 offer
      };
      
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/signal/offer')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role)
        .send(invalidData);
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '缺少必要参数');
    });
    
    it('应该处理房间不存在的情况', async () => {
      // 准备请求数据
      const offerData = {
        roomId: 'non-existent-room-id',
        targetUserId: 'parent-id',
        offer: { type: 'offer', sdp: 'test-sdp' }
      };
      
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/signal/offer')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role)
        .send(offerData);
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });
    
    it('应该处理目标用户不在房间的情况', async () => {
      // 准备请求数据
      const offerData = {
        roomId: 'test-room-id',
        targetUserId: 'non-participant-id',
        offer: { type: 'offer', sdp: 'test-sdp' }
      };
      
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/signal/offer')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role)
        .send(offerData);
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '目标用户不在会议中');
    });
  });
  
  describe('POST /api/video-meetings/signal/answer', () => {
    it('应该成功发送answer', async () => {
      // 准备请求数据
      const answerData = {
        roomId: 'test-room-id',
        targetUserId: 'teacher-id',
        answer: { type: 'answer', sdp: 'test-sdp' }
      };
      
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'parent-id', role: 'parent' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/signal/answer')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role)
        .send(answerData);
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Answer已发送');
      
      // 验证信令消息被添加到队列
      expect(global.signalingQueue).toHaveProperty('teacher-id');
      expect(global.signalingQueue['teacher-id']).toHaveLength(1);
      expect(global.signalingQueue['teacher-id'][0]).toHaveProperty('type', 'answer');
      expect(global.signalingQueue['teacher-id'][0]).toHaveProperty('from', 'parent-id');
      expect(global.signalingQueue['teacher-id'][0]).toHaveProperty('answer');
      expect(global.signalingQueue['teacher-id'][0]).toHaveProperty('roomId', 'test-room-id');
    });
  });
  
  describe('POST /api/video-meetings/signal/ice-candidate', () => {
    it('应该成功发送ICE候选', async () => {
      // 准备请求数据
      const candidateData = {
        roomId: 'test-room-id',
        targetUserId: 'parent-id',
        candidate: { candidate: 'test-candidate', sdpMid: 'data', sdpMLineIndex: 0 }
      };
      
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .post('/api/video-meetings/signal/ice-candidate')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role)
        .send(candidateData);
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'ICE候选已发送');
      
      // 验证信令消息被添加到队列
      expect(global.signalingQueue).toHaveProperty('parent-id');
      expect(global.signalingQueue['parent-id']).toHaveLength(1);
      expect(global.signalingQueue['parent-id'][0]).toHaveProperty('type', 'ice-candidate');
      expect(global.signalingQueue['parent-id'][0]).toHaveProperty('from', 'teacher-id');
      expect(global.signalingQueue['parent-id'][0]).toHaveProperty('candidate');
      expect(global.signalingQueue['parent-id'][0]).toHaveProperty('roomId', 'test-room-id');
    });
  });
  
  describe('GET /api/video-meetings/signal/messages', () => {
    it('应该成功获取信令消息', async () => {
      // 准备信令消息
      global.signalingQueue = {
        'teacher-id': [
          {
            type: 'offer',
            from: 'parent-id',
            offer: { type: 'offer', sdp: 'test-sdp' },
            roomId: 'test-room-id'
          },
          {
            type: 'ice-candidate',
            from: 'parent-id',
            candidate: { candidate: 'test-candidate', sdpMid: 'data', sdpMLineIndex: 0 },
            roomId: 'test-room-id'
          }
        ]
      };
      
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .get('/api/video-meetings/signal/messages')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role);
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('messages');
      expect(response.body.messages).toHaveLength(2);
      expect(response.body.messages[0]).toHaveProperty('type', 'offer');
      expect(response.body.messages[1]).toHaveProperty('type', 'ice-candidate');
      
      // 验证信令队列被清空
      expect(global.signalingQueue['teacher-id']).toHaveLength(0);
    });
    
    it('应该处理没有消息的情况', async () => {
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .get('/api/video-meetings/signal/messages')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role);
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('messages');
      expect(response.body.messages).toHaveLength(0);
    });
  });
});

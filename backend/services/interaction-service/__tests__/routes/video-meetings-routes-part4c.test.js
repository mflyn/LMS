/**
 * 视频会议路由测试 - 第四部分 (c)
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

describe('视频会议路由测试 - 第四部分 (c)', () => {
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
    
    // 设置用户连接
    videoMeetingsRouter.userConnections['teacher-id'] = 'test-room-id-1';
    videoMeetingsRouter.userConnections['parent-id'] = 'test-room-id-1';
  });
  
  describe('错误处理测试', () => {
    it('应该处理获取房间列表时的错误', async () => {
      // 模拟错误
      const originalValues = Object.values;
      Object.values = jest.fn().mockImplementation(() => {
        throw new Error('获取房间列表错误');
      });
      
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'admin-id', role: 'admin' };
      
      // 发送请求
      const response = await request(app)
        .get('/api/video-meetings/rooms')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role);
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');
      
      // 恢复原始实现
      Object.values = originalValues;
    });
    
    it('应该处理结束会议时的保存错误', async () => {
      // 模拟 Meeting.findById 返回会议，但保存时抛出错误
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
    
    it('应该处理获取信令消息时的错误', async () => {
      // 模拟错误
      global.signalingQueue = {
        get: jest.fn().mockImplementation(() => {
          throw new Error('获取信令消息错误');
        })
      };
      
      // 设置用户信息（模拟认证中间件）
      const user = { id: 'teacher-id', role: 'teacher' };
      
      // 发送请求
      const response = await request(app)
        .get('/api/video-meetings/signal/messages')
        .set('x-user-id', user.id)
        .set('x-user-role', user.role);
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');
    });
    
    it('应该处理未认证的请求', async () => {
      // 发送请求（没有设置用户信息）
      const response = await request(app)
        .get('/api/video-meetings/rooms');
      
      // 验证响应
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未认证');
    });
  });
});

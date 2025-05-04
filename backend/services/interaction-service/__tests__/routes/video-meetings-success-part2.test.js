const request = require('supertest');
const express = require('express');
const router = require('../../routes/video-meetings');
// 模拟 Meeting 模型
jest.mock('../../models/Meeting', () => {
  return function() {
    return {
      save: jest.fn().mockResolvedValue(true)
    };
  };
});

// 创建一个模拟的 Meeting 对象
const Meeting = {
  findById: jest.fn()
};

describe('视频会议路由成功路径测试 - 第二部分', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // 重置路由状态
    router.activeRooms = {};
    router.userConnections = {};

    // 设置路由，添加模拟认证头
    app.use((req, res, next) => {
      req.headers['x-user-id'] = 'teacher-id-123';
      req.headers['x-user-role'] = 'teacher';
      next();
    });
    app.use('/api/interaction/video-meetings', router);

    // 清空全局信令队列
    global.signalingQueue = {};
  });

  // 测试WebRTC信令：成功发送offer
  describe('POST /api/interaction/video-meetings/signal/offer - 成功路径', () => {
    it('应该成功发送offer', async () => {
      // 创建一个测试房间
      router.activeRooms = {
        'room-id-123': {
          id: 'room-id-123',
          name: '测试房间',
          meetingId: 'meeting-id-123',
          createdBy: 'teacher-id-123',
          participants: ['teacher-id-123', 'student-id-123'],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      };

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/offer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'student-id-123',
          offer: { type: 'offer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Offer已发送');

      // 验证信令队列
      expect(global.signalingQueue).toHaveProperty('student-id-123');
      expect(global.signalingQueue['student-id-123']).toHaveLength(1);
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('type', 'offer');
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('from', 'teacher-id-123');
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('offer');
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('roomId', 'room-id-123');
    });

    it('应该处理信令队列不存在的情况', async () => {
      // 创建一个测试房间
      router.activeRooms = {
        'room-id-123': {
          id: 'room-id-123',
          name: '测试房间',
          meetingId: 'meeting-id-123',
          createdBy: 'teacher-id-123',
          participants: ['teacher-id-123', 'student-id-123'],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      };

      // 清空全局信令队列
      global.signalingQueue = undefined;

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/offer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'student-id-123',
          offer: { type: 'offer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Offer已发送');

      // 验证信令队列已创建
      expect(global.signalingQueue).toBeDefined();
      expect(global.signalingQueue).toHaveProperty('student-id-123');
      expect(global.signalingQueue['student-id-123']).toHaveLength(1);
    });
  });

  // 测试WebRTC信令：成功发送answer
  describe('POST /api/interaction/video-meetings/signal/answer - 成功路径', () => {
    it('应该成功发送answer', async () => {
      // 创建一个测试房间
      router.activeRooms = {
        'room-id-123': {
          id: 'room-id-123',
          name: '测试房间',
          meetingId: 'meeting-id-123',
          createdBy: 'teacher-id-123',
          participants: ['teacher-id-123', 'student-id-123'],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      };

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/answer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'student-id-123',
          answer: { type: 'answer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Answer已发送');

      // 验证信令队列
      expect(global.signalingQueue).toHaveProperty('student-id-123');
      expect(global.signalingQueue['student-id-123']).toHaveLength(1);
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('type', 'answer');
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('from', 'teacher-id-123');
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('answer');
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('roomId', 'room-id-123');
    });

    it('应该处理信令队列不存在的情况', async () => {
      // 创建一个测试房间
      router.activeRooms = {
        'room-id-123': {
          id: 'room-id-123',
          name: '测试房间',
          meetingId: 'meeting-id-123',
          createdBy: 'teacher-id-123',
          participants: ['teacher-id-123', 'student-id-123'],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      };

      // 清空全局信令队列
      global.signalingQueue = undefined;

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/answer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'student-id-123',
          answer: { type: 'answer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Answer已发送');

      // 验证信令队列已创建
      expect(global.signalingQueue).toBeDefined();
      expect(global.signalingQueue).toHaveProperty('student-id-123');
      expect(global.signalingQueue['student-id-123']).toHaveLength(1);
    });
  });
});

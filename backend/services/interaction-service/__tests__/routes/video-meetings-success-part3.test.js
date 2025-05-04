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

describe('视频会议路由成功路径测试 - 第三部分', () => {
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

  // 测试WebRTC信令：成功发送ICE候选
  describe('POST /api/interaction/video-meetings/signal/ice-candidate - 成功路径', () => {
    it('应该成功发送ICE候选', async () => {
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
        .post('/api/interaction/video-meetings/signal/ice-candidate')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'student-id-123',
          candidate: { candidate: 'test-candidate', sdpMid: '0', sdpMLineIndex: 0 }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'ICE候选已发送');

      // 验证信令队列
      expect(global.signalingQueue).toHaveProperty('student-id-123');
      expect(global.signalingQueue['student-id-123']).toHaveLength(1);
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('type', 'ice-candidate');
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('from', 'teacher-id-123');
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('candidate');
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
        .post('/api/interaction/video-meetings/signal/ice-candidate')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'student-id-123',
          candidate: { candidate: 'test-candidate', sdpMid: '0', sdpMLineIndex: 0 }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'ICE候选已发送');

      // 验证信令队列已创建
      expect(global.signalingQueue).toBeDefined();
      expect(global.signalingQueue).toHaveProperty('student-id-123');
      expect(global.signalingQueue['student-id-123']).toHaveLength(1);
    });
  });

  // 测试获取信令消息
  describe('GET /api/interaction/video-meetings/signal/messages - 成功路径', () => {
    it('应该成功获取信令消息', async () => {
      // 创建一个测试信令队列
      global.signalingQueue = {
        'teacher-id-123': [
          {
            type: 'offer',
            from: 'student-id-123',
            offer: { type: 'offer', sdp: 'test-sdp' },
            roomId: 'room-id-123'
          },
          {
            type: 'ice-candidate',
            from: 'student-id-123',
            candidate: { candidate: 'test-candidate', sdpMid: '0', sdpMLineIndex: 0 },
            roomId: 'room-id-123'
          }
        ]
      };

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/signal/messages');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('messages');
      expect(response.body.messages).toHaveLength(2);
      expect(response.body.messages[0]).toHaveProperty('type', 'offer');
      expect(response.body.messages[1]).toHaveProperty('type', 'ice-candidate');

      // 验证信令队列已清空
      expect(global.signalingQueue['teacher-id-123']).toHaveLength(0);
    });

    it('应该处理没有消息的情况', async () => {
      // 清空信令队列
      global.signalingQueue = {};

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/signal/messages');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('messages');
      expect(response.body.messages).toHaveLength(0);
    });
  });
});

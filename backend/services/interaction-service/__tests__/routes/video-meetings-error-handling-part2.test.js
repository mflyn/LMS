const request = require('supertest');
const express = require('express');
const router = require('../../routes/video-meetings');

// 模拟 Meeting 模型
jest.mock('../../models/Meeting', () => {
  return {
    findById: jest.fn().mockImplementation(() => {
      return {
        _id: 'meeting-id-123',
        title: '测试会议',
        teacher: {
          toString: () => 'teacher-id-123'
        },
        parent: {
          toString: () => 'parent-id-123'
        },
        student: {
          toString: () => 'student-id-123'
        },
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        status: '待确认',
        meetingLink: null,
        save: jest.fn().mockResolvedValue(true),
        toString: () => 'meeting-id-123'
      };
    })
  };
});

// 获取模拟的 Meeting 模型
const Meeting = require('../../models/Meeting');

describe('视频会议路由错误处理测试 - 第二部分', () => {
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

  // 测试WebRTC信令：发送answer时的服务器错误
  describe('POST /api/interaction/video-meetings/signal/answer - 服务器错误', () => {
    it('应该处理服务器错误', async () => {
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

      // 模拟全局信令队列抛出异常
      const originalPush = Array.prototype.push;
      Array.prototype.push = jest.fn(() => {
        throw new Error('信令队列错误');
      });

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/answer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'teacher-id-123',
          answer: { type: 'answer', sdp: 'test-sdp' }
        });

      // 恢复 Array.prototype.push
      Array.prototype.push = originalPush;

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');
    });
  });

  // 测试WebRTC信令：发送ICE候选时的服务器错误
  describe('POST /api/interaction/video-meetings/signal/ice-candidate - 服务器错误', () => {
    it('应该处理服务器错误', async () => {
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

      // 模拟全局信令队列抛出异常
      const originalPush = Array.prototype.push;
      Array.prototype.push = jest.fn(() => {
        throw new Error('信令队列错误');
      });

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/ice-candidate')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'student-id-123',
          candidate: { candidate: 'test-candidate', sdpMid: '0', sdpMLineIndex: 0 }
        });

      // 恢复 Array.prototype.push
      Array.prototype.push = originalPush;

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');
    });
  });

  // 测试获取信令消息时的服务器错误
  describe('GET /api/interaction/video-meetings/signal/messages - 服务器错误', () => {
    it('应该处理服务器错误', async () => {
      // 创建一个测试信令队列
      global.signalingQueue = {
        'teacher-id-123': []
      };

      // 模拟数组的 splice 方法抛出异常
      const originalSplice = Array.prototype.splice;
      Array.prototype.splice = jest.fn(() => {
        throw new Error('信令队列错误');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/signal/messages');

      // 恢复 Array.prototype.splice
      Array.prototype.splice = originalSplice;

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');
    });
  });
});

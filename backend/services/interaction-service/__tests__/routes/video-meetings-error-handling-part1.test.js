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

describe('视频会议路由错误处理测试 - 第一部分', () => {
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

  // 测试创建视频会议房间时的服务器错误
  describe('POST /api/interaction/video-meetings/rooms - 服务器错误', () => {
    it('应该处理服务器错误', async () => {
      // 模拟 Meeting.findById 抛出异常
      Meeting.findById.mockImplementationOnce(() => {
        throw new Error('数据库连接错误');
      });

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/rooms')
        .send({
          meetingId: 'meeting-id-123',
          roomName: '测试房间'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');
    });
  });

  // 测试加入视频会议时的服务器错误
  describe('GET /api/interaction/video-meetings/join/:roomId - 服务器错误', () => {
    it('应该处理服务器错误', async () => {
      // 创建一个测试房间
      router.activeRooms = {
        'room-id-123': {
          id: 'room-id-123',
          name: '测试房间',
          meetingId: 'meeting-id-123',
          createdBy: 'teacher-id-123',
          participants: [],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      };

      // 模拟 Meeting.findById 抛出异常
      Meeting.findById.mockImplementationOnce(() => {
        throw new Error('数据库连接错误');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/join/room-id-123');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');
    });
  });

  // 测试WebRTC信令：发送offer时的服务器错误
  describe('POST /api/interaction/video-meetings/signal/offer - 服务器错误', () => {
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
        .post('/api/interaction/video-meetings/signal/offer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'student-id-123',
          offer: { type: 'offer', sdp: 'test-sdp' }
        });

      // 恢复 Array.prototype.push
      Array.prototype.push = originalPush;

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');
    });
  });
});

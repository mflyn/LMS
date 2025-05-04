/**
 * 视频会议路由测试 - 第4部分
 * 用于提高 video-meetings.js 的测试覆盖率
 */

const request = require('supertest');
const express = require('express');

// 模拟 Meeting 模型
jest.mock('../../models/Meeting', () => {
  const mockMeeting = {
    findById: jest.fn()
  };
  return mockMeeting;
});

// 模拟 winston 日志
jest.mock('winston', () => ({
  format: {
    timestamp: jest.fn().mockReturnValue({}),
    json: jest.fn().mockReturnValue({}),
    combine: jest.fn().mockReturnValue({})
  },
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }),
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

describe('视频会议路由测试 - 第4部分', () => {
  let app;
  let router;
  let Meeting;
  // 移除不需要的变量

  beforeEach(() => {
    // 重置模块缓存
    jest.resetModules();

    // 导入 Meeting 模型
    Meeting = require('../../models/Meeting');

    // 创建 Express 应用
    app = express();
    app.use(express.json());

    // 模拟认证中间件
    app.use((req, res, next) => {
      req.user = {
        id: 'user-id-123',
        role: 'teacher'
      };
      next();
    });

    // 使用视频会议路由
    router = require('../../routes/video-meetings');
    app.use('/api/interaction/video-meetings', router);

    // 设置一个活跃的房间
    router.activeRooms = {
      'room-id-123': {
        id: 'room-id-123',
        name: '测试房间',
        meetingId: 'meeting-id-123',
        createdBy: 'teacher-id-123',
        participants: ['user-id-123', 'user-id-456'],
        createdAt: new Date(),
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      }
    };

    // 设置用户连接
    router.userConnections = {
      'user-id-123': 'room-id-123',
      'user-id-456': 'room-id-123'
    };

    // 清除全局信令队列
    global.signalingQueue = {};
  });

  afterEach(() => {
    // 清除所有模拟
    jest.clearAllMocks();

    // 清除全局信令队列
    delete global.signalingQueue;
  });

  // 测试 WebRTC 信令：发送 answer
  describe('POST /api/interaction/video-meetings/signal/answer', () => {
    it('应该验证必要参数', async () => {
      // 发送请求（缺少必要参数）
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/answer')
        .send({
          // 缺少 roomId, targetUserId, answer
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '缺少必要参数');
    });

    it('应该处理房间不存在的情况', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/answer')
        .send({
          roomId: 'non-existent-room',
          targetUserId: 'user-id-456',
          answer: { type: 'answer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该处理目标用户不在房间中的情况', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/answer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'non-existent-user',
          answer: { type: 'answer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '目标用户不在会议中');
    });

    it('应该成功发送 answer', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/answer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'user-id-456',
          answer: { type: 'answer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Answer已发送');

      // 验证信令队列
      expect(global.signalingQueue).toHaveProperty('user-id-456');
      expect(global.signalingQueue['user-id-456']).toHaveLength(1);
      expect(global.signalingQueue['user-id-456'][0]).toEqual({
        type: 'answer',
        from: 'user-id-123',
        answer: { type: 'answer', sdp: 'test-sdp' },
        roomId: 'room-id-123'
      });
    });
  });

  // 测试 WebRTC 信令：发送 ICE 候选
  describe('POST /api/interaction/video-meetings/signal/ice-candidate', () => {
    it('应该验证必要参数', async () => {
      // 发送请求（缺少必要参数）
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/ice-candidate')
        .send({
          // 缺少 roomId, targetUserId, candidate
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '缺少必要参数');
    });

    it('应该处理房间不存在的情况', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/ice-candidate')
        .send({
          roomId: 'non-existent-room',
          targetUserId: 'user-id-456',
          candidate: { candidate: 'test-candidate', sdpMid: 'test-mid', sdpMLineIndex: 0 }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该处理目标用户不在房间中的情况', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/ice-candidate')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'non-existent-user',
          candidate: { candidate: 'test-candidate', sdpMid: 'test-mid', sdpMLineIndex: 0 }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '目标用户不在会议中');
    });

    it('应该成功发送 ICE 候选', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/ice-candidate')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'user-id-456',
          candidate: { candidate: 'test-candidate', sdpMid: 'test-mid', sdpMLineIndex: 0 }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'ICE候选已发送');

      // 验证信令队列
      expect(global.signalingQueue).toHaveProperty('user-id-456');
      expect(global.signalingQueue['user-id-456']).toHaveLength(1);
      expect(global.signalingQueue['user-id-456'][0]).toEqual({
        type: 'ice-candidate',
        from: 'user-id-123',
        candidate: { candidate: 'test-candidate', sdpMid: 'test-mid', sdpMLineIndex: 0 },
        roomId: 'room-id-123'
      });
    });
  });
});

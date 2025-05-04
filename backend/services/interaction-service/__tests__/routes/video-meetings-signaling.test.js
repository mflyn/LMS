/**
 * 视频会议信令功能测试
 */

const request = require('supertest');
const express = require('express');
const router = require('../../routes/video-meetings');

describe('视频会议信令功能测试', () => {
  let app;

  beforeEach(() => {
    // 重置全局信令队列
    global.signalingQueue = {};

    // 重置路由状态
    router.activeRooms = {
      'room-id-1': {
        id: 'room-id-1',
        name: '测试视频会议',
        meetingId: 'meeting-id-1',
        createdBy: 'teacher-id-1',
        participants: ['teacher-id-1', 'parent-id-1', 'student-id-1'],
        createdAt: new Date(),
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      }
    };
    router.userConnections = {
      'teacher-id-1': 'room-id-1',
      'parent-id-1': 'room-id-1',
      'student-id-1': 'room-id-1'
    };

    // 创建Express应用
    app = express();
    app.use(express.json());

    // 模拟认证中间件
    app.use((req, res, next) => {
      req.user = { id: 'teacher-id-1', role: 'teacher' };
      next();
    });

    // 使用视频会议路由
    app.use('/api/interaction/video-meetings', router);

    // 重置所有模拟函数
    jest.clearAllMocks();
  });

  describe('POST /api/interaction/video-meetings/signal/offer', () => {
    it('应该成功发送offer', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/offer')
        .send({
          roomId: 'room-id-1',
          targetUserId: 'parent-id-1',
          offer: { type: 'offer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Offer已发送');

      // 验证信令队列被正确更新
      expect(global.signalingQueue).toHaveProperty('parent-id-1');
      expect(global.signalingQueue['parent-id-1']).toHaveLength(1);
      expect(global.signalingQueue['parent-id-1'][0]).toHaveProperty('type', 'offer');
      expect(global.signalingQueue['parent-id-1'][0]).toHaveProperty('from', 'teacher-id-1');
      expect(global.signalingQueue['parent-id-1'][0]).toHaveProperty('offer');
      expect(global.signalingQueue['parent-id-1'][0]).toHaveProperty('roomId', 'room-id-1');
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不提供offer）
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/offer')
        .send({
          roomId: 'room-id-1',
          targetUserId: 'parent-id-1'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '缺少必要参数');
    });

    it('应该处理房间不存在的情况', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/offer')
        .send({
          roomId: 'non-existent-room',
          targetUserId: 'parent-id-1',
          offer: { type: 'offer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该处理目标用户不在房间的情况', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/offer')
        .send({
          roomId: 'room-id-1',
          targetUserId: 'non-existent-user',
          offer: { type: 'offer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '目标用户不在会议中');
    });
  });

  describe('POST /api/interaction/video-meetings/signal/answer', () => {
    it('应该成功发送answer', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/answer')
        .send({
          roomId: 'room-id-1',
          targetUserId: 'parent-id-1',
          answer: { type: 'answer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Answer已发送');

      // 验证信令队列被正确更新
      expect(global.signalingQueue).toHaveProperty('parent-id-1');
      expect(global.signalingQueue['parent-id-1']).toHaveLength(1);
      expect(global.signalingQueue['parent-id-1'][0]).toHaveProperty('type', 'answer');
      expect(global.signalingQueue['parent-id-1'][0]).toHaveProperty('from', 'teacher-id-1');
      expect(global.signalingQueue['parent-id-1'][0]).toHaveProperty('answer');
      expect(global.signalingQueue['parent-id-1'][0]).toHaveProperty('roomId', 'room-id-1');
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不提供answer）
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/answer')
        .send({
          roomId: 'room-id-1',
          targetUserId: 'parent-id-1'
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
          targetUserId: 'parent-id-1',
          answer: { type: 'answer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该处理目标用户不在房间的情况', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/answer')
        .send({
          roomId: 'room-id-1',
          targetUserId: 'non-existent-user',
          answer: { type: 'answer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '目标用户不在会议中');
    });
  });

  describe('POST /api/interaction/video-meetings/signal/ice-candidate', () => {
    it('应该成功发送ICE候选', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/ice-candidate')
        .send({
          roomId: 'room-id-1',
          targetUserId: 'parent-id-1',
          candidate: { candidate: 'test-candidate', sdpMid: 'data', sdpMLineIndex: 0 }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'ICE候选已发送');

      // 验证信令队列被正确更新
      expect(global.signalingQueue).toHaveProperty('parent-id-1');
      expect(global.signalingQueue['parent-id-1']).toHaveLength(1);
      expect(global.signalingQueue['parent-id-1'][0]).toHaveProperty('type', 'ice-candidate');
      expect(global.signalingQueue['parent-id-1'][0]).toHaveProperty('from', 'teacher-id-1');
      expect(global.signalingQueue['parent-id-1'][0]).toHaveProperty('candidate');
      expect(global.signalingQueue['parent-id-1'][0]).toHaveProperty('roomId', 'room-id-1');
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不提供candidate）
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/ice-candidate')
        .send({
          roomId: 'room-id-1',
          targetUserId: 'parent-id-1'
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
          targetUserId: 'parent-id-1',
          candidate: { candidate: 'test-candidate', sdpMid: 'data', sdpMLineIndex: 0 }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该处理目标用户不在房间的情况', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/ice-candidate')
        .send({
          roomId: 'room-id-1',
          targetUserId: 'non-existent-user',
          candidate: { candidate: 'test-candidate', sdpMid: 'data', sdpMLineIndex: 0 }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '目标用户不在会议中');
    });
  });

  describe('GET /api/interaction/video-meetings/signal/messages', () => {
    it('应该成功获取信令消息', async () => {
      // 设置信令队列
      global.signalingQueue = {
        'teacher-id-1': [
          {
            type: 'offer',
            from: 'parent-id-1',
            offer: { type: 'offer', sdp: 'test-sdp' },
            roomId: 'room-id-1'
          },
          {
            type: 'ice-candidate',
            from: 'parent-id-1',
            candidate: { candidate: 'test-candidate', sdpMid: 'data', sdpMLineIndex: 0 },
            roomId: 'room-id-1'
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

      // 验证信令队列被清空
      expect(global.signalingQueue['teacher-id-1']).toHaveLength(0);
    });

    it('应该处理没有消息的情况', async () => {
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

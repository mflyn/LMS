/**
 * 视频会议路由额外测试
 * 用于提高 video-meetings.js 的测试覆盖率
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

// 模拟 Meeting 模型
jest.mock('../../models/Meeting', () => {
  const mockMeeting = jest.fn().mockImplementation(function(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });

  // 添加静态方法
  mockMeeting.findById = jest.fn();

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

describe('视频会议路由额外测试', () => {
  let app;
  let router;
  let Meeting;

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
      req.headers['x-user-id'] = 'test-user-id';
      req.headers['x-user-role'] = 'teacher';
      next();
    });

    // 导入路由
    router = require('../../routes/video-meetings');
    app.use('/api/interaction/video-meetings', router);
  });

  afterEach(() => {
    // 清除所有模拟
    jest.clearAllMocks();
  });

  // 测试创建视频会议房间
  describe('POST /api/interaction/video-meetings/rooms', () => {
    it('应该成功创建视频会议房间', async () => {
      // 模拟 Meeting.findById 返回值
      const mockMeeting = {
        _id: 'meeting-id-123',
        teacher: 'test-user-id',
        parent: 'parent-id-123',
        student: 'student-id-123',
        save: jest.fn().mockResolvedValue(true)
      };
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/rooms')
        .send({
          meetingId: 'meeting-id-123',
          roomName: '测试视频会议'
        });

      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', '视频会议房间创建成功');
      expect(response.body).toHaveProperty('room');
      expect(response.body.room).toHaveProperty('id');
      expect(response.body.room).toHaveProperty('name', '测试视频会议');
      expect(response.body.room).toHaveProperty('meetingId', 'meeting-id-123');
      expect(response.body.room).toHaveProperty('joinUrl');
      expect(response.body.room).toHaveProperty('iceServers');

      // 验证 Meeting.findById 被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-123');

      // 验证 meeting.save 被调用
      expect(mockMeeting.save).toHaveBeenCalled();
      expect(mockMeeting.meetingLink).toMatch(/^\/video-meeting\//);
      expect(mockMeeting.status).toBe('已确认');
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不提供 meetingId）
      const response1 = await request(app)
        .post('/api/interaction/video-meetings/rooms')
        .send({
          roomName: '测试视频会议'
        });

      // 验证响应
      expect(response1.status).toBe(400);
      expect(response1.body).toHaveProperty('message', '会议ID和房间名称不能为空');

      // 发送请求（不提供 roomName）
      const response2 = await request(app)
        .post('/api/interaction/video-meetings/rooms')
        .send({
          meetingId: 'meeting-id-123'
        });

      // 验证响应
      expect(response2.status).toBe(400);
      expect(response2.body).toHaveProperty('message', '会议ID和房间名称不能为空');
    });

    it('应该处理会议不存在的情况', async () => {
      // 模拟 Meeting.findById 返回 null
      Meeting.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/rooms')
        .send({
          meetingId: 'non-existent-id',
          roomName: '测试视频会议'
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该验证用户权限', async () => {
      // 模拟 Meeting.findById 返回值（用户不是参与者）
      const mockMeeting = {
        _id: 'meeting-id-123',
        teacher: 'other-teacher-id',
        parent: 'parent-id-123',
        student: 'student-id-123',
        save: jest.fn().mockResolvedValue(true)
      };
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/rooms')
        .send({
          meetingId: 'meeting-id-123',
          roomName: '测试视频会议'
        });

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足，您不是此会议的参与者');
    });

    it('应该处理保存错误', async () => {
      // 模拟 Meeting.findById 返回值
      const mockMeeting = {
        _id: 'meeting-id-123',
        teacher: 'test-user-id',
        parent: 'parent-id-123',
        student: 'student-id-123',
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      };
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/rooms')
        .send({
          meetingId: 'meeting-id-123',
          roomName: '测试视频会议'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');
    });
  });

  // 测试加入视频会议
  describe('GET /api/interaction/video-meetings/join/:roomId', () => {
    beforeEach(() => {
      // 设置一个活跃的房间
      router.activeRooms = {
        'room-id-123': {
          id: 'room-id-123',
          name: '测试视频会议',
          meetingId: 'meeting-id-123',
          createdBy: 'teacher-id-123',
          participants: [],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      };
    });

    it('应该成功加入视频会议', async () => {
      // 模拟 Meeting.findById 返回值
      const mockMeeting = {
        _id: 'meeting-id-123',
        teacher: 'test-user-id',
        parent: 'parent-id-123',
        student: 'student-id-123'
      };
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/join/room-id-123');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '成功加入会议');
      expect(response.body).toHaveProperty('room');
      expect(response.body.room).toHaveProperty('id', 'room-id-123');
      expect(response.body.room).toHaveProperty('name', '测试视频会议');
      expect(response.body.room).toHaveProperty('meetingId', 'meeting-id-123');
      expect(response.body.room).toHaveProperty('participants');
      expect(response.body.room.participants).toContain('test-user-id');

      // 验证 Meeting.findById 被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-123');

      // 验证用户被添加到参与者列表
      expect(router.activeRooms['room-id-123'].participants).toContain('test-user-id');

      // 验证用户与房间关联
      expect(router.userConnections['test-user-id']).toBe('room-id-123');
    });

    it('应该处理房间不存在的情况', async () => {
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/join/non-existent-room');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该处理会议不存在的情况', async () => {
      // 模拟 Meeting.findById 返回 null
      Meeting.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/join/room-id-123');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该验证用户权限', async () => {
      // 模拟 Meeting.findById 返回值（用户不是参与者）
      const mockMeeting = {
        _id: 'meeting-id-123',
        teacher: 'other-teacher-id',
        parent: 'other-parent-id',
        student: 'other-student-id'
      };
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/join/room-id-123');

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足，您不是此会议的参与者');
    });
  });

  // 测试 WebRTC 信令：发送 offer
  describe('POST /api/interaction/video-meetings/signal/offer', () => {
    beforeEach(() => {
      // 设置一个活跃的房间
      router.activeRooms = {
        'room-id-123': {
          id: 'room-id-123',
          name: '测试视频会议',
          meetingId: 'meeting-id-123',
          createdBy: 'teacher-id-123',
          participants: ['test-user-id', 'target-user-id'],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      };

      // 初始化信令队列
      global.signalingQueue = {};
    });

    afterEach(() => {
      // 清理信令队列
      delete global.signalingQueue;
    });

    it('应该成功发送 offer', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/offer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'target-user-id',
          offer: { type: 'offer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Offer已发送');

      // 验证信令队列
      expect(global.signalingQueue).toHaveProperty('target-user-id');
      expect(global.signalingQueue['target-user-id']).toHaveLength(1);
      expect(global.signalingQueue['target-user-id'][0]).toHaveProperty('type', 'offer');
      expect(global.signalingQueue['target-user-id'][0]).toHaveProperty('from', 'test-user-id');
      expect(global.signalingQueue['target-user-id'][0]).toHaveProperty('offer');
      expect(global.signalingQueue['target-user-id'][0]).toHaveProperty('roomId', 'room-id-123');
    });

    it('应该验证必要参数', async () => {
      // 发送请求（缺少参数）
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/offer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'target-user-id'
          // 缺少 offer
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
          targetUserId: 'target-user-id',
          offer: { type: 'offer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该处理目标用户不在房间中的情况', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/offer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'non-existent-user',
          offer: { type: 'offer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '目标用户不在会议中');
    });
  });

  // 测试离开视频会议
  describe('POST /api/interaction/video-meetings/leave/:roomId', () => {
    beforeEach(() => {
      // 设置一个活跃的房间
      router.activeRooms = {
        'room-id-123': {
          id: 'room-id-123',
          name: '测试视频会议',
          meetingId: 'meeting-id-123',
          createdBy: 'teacher-id-123',
          participants: ['test-user-id', 'other-user-id'],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      };

      // 设置用户与房间的关联
      router.userConnections = {
        'test-user-id': 'room-id-123',
        'other-user-id': 'room-id-123'
      };
    });

    it('应该成功离开视频会议', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/leave/room-id-123');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '已离开会议');

      // 验证用户被从参与者列表中移除
      expect(router.activeRooms['room-id-123'].participants).not.toContain('test-user-id');
      expect(router.activeRooms['room-id-123'].participants).toContain('other-user-id');

      // 验证用户与房间的关联被移除
      expect(router.userConnections).not.toHaveProperty('test-user-id');
      expect(router.userConnections).toHaveProperty('other-user-id');
    });

    it('应该处理房间不存在的情况', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/leave/non-existent-room');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该在最后一个参与者离开时关闭房间', async () => {
      // 设置只有一个参与者的房间
      router.activeRooms = {
        'room-id-123': {
          id: 'room-id-123',
          name: '测试视频会议',
          meetingId: 'meeting-id-123',
          createdBy: 'teacher-id-123',
          participants: ['test-user-id'],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      };

      router.userConnections = {
        'test-user-id': 'room-id-123'
      };

      // 模拟 Meeting.findById 返回值
      const mockMeeting = {
        _id: 'meeting-id-123',
        status: '已确认',
        save: jest.fn().mockResolvedValue(true)
      };
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/leave/room-id-123');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '已离开会议');

      // 验证房间被删除
      expect(router.activeRooms).not.toHaveProperty('room-id-123');

      // 验证会议状态被更新
      expect(mockMeeting.status).toBe('已完成');
      expect(mockMeeting.save).toHaveBeenCalled();
    });
  });

  // 测试 WebRTC 信令：发送 answer
  describe('POST /api/interaction/video-meetings/signal/answer', () => {
    beforeEach(() => {
      // 设置一个活跃的房间
      router.activeRooms = {
        'room-id-123': {
          id: 'room-id-123',
          name: '测试视频会议',
          meetingId: 'meeting-id-123',
          createdBy: 'teacher-id-123',
          participants: ['test-user-id', 'target-user-id'],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      };

      // 初始化信令队列
      global.signalingQueue = {};
    });

    afterEach(() => {
      // 清理信令队列
      delete global.signalingQueue;
    });

    it('应该成功发送 answer', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/answer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'target-user-id',
          answer: { type: 'answer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Answer已发送');

      // 验证信令队列
      expect(global.signalingQueue).toHaveProperty('target-user-id');
      expect(global.signalingQueue['target-user-id']).toHaveLength(1);
      expect(global.signalingQueue['target-user-id'][0]).toHaveProperty('type', 'answer');
      expect(global.signalingQueue['target-user-id'][0]).toHaveProperty('from', 'test-user-id');
      expect(global.signalingQueue['target-user-id'][0]).toHaveProperty('answer');
      expect(global.signalingQueue['target-user-id'][0]).toHaveProperty('roomId', 'room-id-123');
    });

    it('应该验证必要参数', async () => {
      // 发送请求（缺少参数）
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/answer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'target-user-id'
          // 缺少 answer
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
          targetUserId: 'target-user-id',
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
  });

  // 测试 WebRTC 信令：发送 ICE 候选
  describe('POST /api/interaction/video-meetings/signal/ice-candidate', () => {
    beforeEach(() => {
      // 设置一个活跃的房间
      router.activeRooms = {
        'room-id-123': {
          id: 'room-id-123',
          name: '测试视频会议',
          meetingId: 'meeting-id-123',
          createdBy: 'teacher-id-123',
          participants: ['test-user-id', 'target-user-id'],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      };

      // 初始化信令队列
      global.signalingQueue = {};
    });

    afterEach(() => {
      // 清理信令队列
      delete global.signalingQueue;
    });

    it('应该成功发送 ICE 候选', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/ice-candidate')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'target-user-id',
          candidate: { candidate: 'candidate:1 1 UDP 2122194687 192.168.1.1 30000 typ host', sdpMid: '0', sdpMLineIndex: 0 }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'ICE候选已发送');

      // 验证信令队列
      expect(global.signalingQueue).toHaveProperty('target-user-id');
      expect(global.signalingQueue['target-user-id']).toHaveLength(1);
      expect(global.signalingQueue['target-user-id'][0]).toHaveProperty('type', 'ice-candidate');
      expect(global.signalingQueue['target-user-id'][0]).toHaveProperty('from', 'test-user-id');
      expect(global.signalingQueue['target-user-id'][0]).toHaveProperty('candidate');
      expect(global.signalingQueue['target-user-id'][0]).toHaveProperty('roomId', 'room-id-123');
    });

    it('应该验证必要参数', async () => {
      // 发送请求（缺少参数）
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/ice-candidate')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'target-user-id'
          // 缺少 candidate
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
          targetUserId: 'target-user-id',
          candidate: { candidate: 'candidate:1 1 UDP 2122194687 192.168.1.1 30000 typ host', sdpMid: '0', sdpMLineIndex: 0 }
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
          candidate: { candidate: 'candidate:1 1 UDP 2122194687 192.168.1.1 30000 typ host', sdpMid: '0', sdpMLineIndex: 0 }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '目标用户不在会议中');
    });
  });

  // 测试获取信令消息
  describe('GET /api/interaction/video-meetings/signal/messages', () => {
    beforeEach(() => {
      // 初始化信令队列
      global.signalingQueue = {
        'test-user-id': [
          {
            type: 'offer',
            from: 'other-user-id',
            offer: { type: 'offer', sdp: 'test-sdp' },
            roomId: 'room-id-123'
          },
          {
            type: 'ice-candidate',
            from: 'other-user-id',
            candidate: { candidate: 'candidate:1 1 UDP 2122194687 192.168.1.1 30000 typ host', sdpMid: '0', sdpMLineIndex: 0 },
            roomId: 'room-id-123'
          }
        ]
      };
    });

    afterEach(() => {
      // 清理信令队列
      delete global.signalingQueue;
    });

    it('应该成功获取信令消息', async () => {
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/signal/messages');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('messages');
      expect(response.body.messages).toHaveLength(2);
      expect(response.body.messages[0]).toHaveProperty('type', 'offer');
      expect(response.body.messages[0]).toHaveProperty('from', 'other-user-id');
      expect(response.body.messages[0]).toHaveProperty('offer');
      expect(response.body.messages[0]).toHaveProperty('roomId', 'room-id-123');
      expect(response.body.messages[1]).toHaveProperty('type', 'ice-candidate');

      // 验证信令队列被清空
      expect(global.signalingQueue['test-user-id']).toHaveLength(0);
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

    it('应该处理用户没有消息的情况', async () => {
      // 设置其他用户的消息
      global.signalingQueue = {
        'other-user-id': [
          {
            type: 'offer',
            from: 'third-user-id',
            offer: { type: 'offer', sdp: 'test-sdp' },
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
      expect(response.body.messages).toHaveLength(0);
    });
  });

  // 测试获取活跃房间列表
  describe('GET /api/interaction/video-meetings/rooms', () => {
    beforeEach(() => {
      // 设置活跃的房间
      router.activeRooms = {
        'room-id-123': {
          id: 'room-id-123',
          name: '测试视频会议1',
          meetingId: 'meeting-id-123',
          createdBy: 'teacher-id-123',
          participants: ['test-user-id', 'other-user-id'],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        },
        'room-id-456': {
          id: 'room-id-456',
          name: '测试视频会议2',
          meetingId: 'meeting-id-456',
          createdBy: 'teacher-id-456',
          participants: ['third-user-id'],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      };
    });

    it.skip('应该成功获取活跃房间列表（管理员）', async () => {
      // 发送请求（设置管理员角色）
      const response = await request(app)
        .get('/api/interaction/video-meetings/rooms')
        .set('x-user-role', 'admin');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rooms');
      expect(response.body.rooms).toHaveLength(2);
      expect(response.body.rooms[0]).toHaveProperty('id', 'room-id-123');
      expect(response.body.rooms[0]).toHaveProperty('name', '测试视频会议1');
      expect(response.body.rooms[0]).toHaveProperty('meetingId', 'meeting-id-123');
      expect(response.body.rooms[0]).toHaveProperty('participantCount', 2);
      expect(response.body.rooms[1]).toHaveProperty('id', 'room-id-456');
      expect(response.body.rooms[1]).toHaveProperty('name', '测试视频会议2');
      expect(response.body.rooms[1]).toHaveProperty('meetingId', 'meeting-id-456');
      expect(response.body.rooms[1]).toHaveProperty('participantCount', 1);
    });

    it('应该处理非管理员访问的情况', async () => {
      // 发送请求（非管理员）
      const response = await request(app)
        .get('/api/interaction/video-meetings/rooms');

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');
    });
  });

  // 测试结束视频会议
  describe('POST /api/interaction/video-meetings/end/:roomId', () => {
    beforeEach(() => {
      // 设置一个活跃的房间
      router.activeRooms = {
        'room-id-123': {
          id: 'room-id-123',
          name: '测试视频会议',
          meetingId: 'meeting-id-123',
          createdBy: 'test-user-id',
          participants: ['test-user-id', 'other-user-id'],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        },
        'room-id-456': {
          id: 'room-id-456',
          name: '测试视频会议2',
          meetingId: 'meeting-id-456',
          createdBy: 'other-user-id',
          participants: ['other-user-id'],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      };

      // 设置用户与房间的关联
      router.userConnections = {
        'test-user-id': 'room-id-123',
        'other-user-id': 'room-id-123'
      };

      // 初始化信令队列
      global.signalingQueue = {
        'test-user-id': [],
        'other-user-id': []
      };
    });

    afterEach(() => {
      // 清理信令队列
      delete global.signalingQueue;
    });

    it('应该成功结束视频会议（创建者）', async () => {
      // 模拟 Meeting.findById 返回值
      const mockMeeting = {
        _id: 'meeting-id-123',
        status: '已确认',
        save: jest.fn().mockResolvedValue(true)
      };
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/end/room-id-123');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '会议已结束');

      // 验证房间被删除
      expect(router.activeRooms).not.toHaveProperty('room-id-123');

      // 验证会议状态被更新
      expect(mockMeeting.status).toBe('已完成');
      expect(mockMeeting.save).toHaveBeenCalled();

      // 验证用户与房间的关联被移除
      expect(router.userConnections).not.toHaveProperty('test-user-id');
      expect(router.userConnections).not.toHaveProperty('other-user-id');

      // 验证信令队列中添加了会议结束通知
      expect(global.signalingQueue['test-user-id']).toHaveLength(1);
      expect(global.signalingQueue['test-user-id'][0]).toHaveProperty('type', 'meeting-ended');
      expect(global.signalingQueue['test-user-id'][0]).toHaveProperty('roomId', 'room-id-123');
      expect(global.signalingQueue['other-user-id']).toHaveLength(1);
      expect(global.signalingQueue['other-user-id'][0]).toHaveProperty('type', 'meeting-ended');
      expect(global.signalingQueue['other-user-id'][0]).toHaveProperty('roomId', 'room-id-123');
    });

    it.skip('应该成功结束视频会议（管理员）', async () => {
      // 模拟 Meeting.findById 返回值
      const mockMeeting = {
        _id: 'meeting-id-456',
        status: '已确认',
        save: jest.fn().mockResolvedValue(true)
      };
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求（设置管理员角色）
      const response = await request(app)
        .post('/api/interaction/video-meetings/end/room-id-456')
        .set('x-user-role', 'admin');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '会议已结束');

      // 验证房间被删除
      expect(router.activeRooms).not.toHaveProperty('room-id-456');

      // 验证会议状态被更新
      expect(mockMeeting.status).toBe('已完成');
      expect(mockMeeting.save).toHaveBeenCalled();
    });

    it('应该处理房间不存在的情况', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/end/non-existent-room');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该处理权限不足的情况', async () => {
      // 发送请求（非创建者且非管理员）
      const response = await request(app)
        .post('/api/interaction/video-meetings/end/room-id-456');

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足，只有会议创建者或管理员可以结束会议');
    });
  });
});

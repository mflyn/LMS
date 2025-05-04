/**
 * 视频会议路由测试 - 第5部分
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

describe('视频会议路由测试 - 第5部分', () => {
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

    // 设置全局信令队列
    global.signalingQueue = {
      'user-id-123': [
        {
          type: 'offer',
          from: 'user-id-456',
          offer: { type: 'offer', sdp: 'test-sdp' },
          roomId: 'room-id-123'
        }
      ]
    };
  });

  afterEach(() => {
    // 清除所有模拟
    jest.clearAllMocks();

    // 清除全局信令队列
    delete global.signalingQueue;
  });

  // 测试获取信令消息
  describe('GET /api/interaction/video-meetings/signal/messages', () => {
    it('应该返回空消息列表（无消息）', async () => {
      // 清空当前用户的信令队列
      delete global.signalingQueue['user-id-123'];

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/signal/messages');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('messages');
      expect(response.body.messages).toEqual([]);
    });

    it('应该返回用户的信令消息', async () => {
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/signal/messages');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('messages');
      expect(response.body.messages).toEqual([
        {
          type: 'offer',
          from: 'user-id-456',
          offer: { type: 'offer', sdp: 'test-sdp' },
          roomId: 'room-id-123'
        }
      ]);

      // 验证信令队列被清空
      expect(global.signalingQueue['user-id-123']).toEqual([]);
    });

    it('应该处理获取消息错误', async () => {
      // 模拟错误
      const originalSignalingQueue = global.signalingQueue;
      Object.defineProperty(global, 'signalingQueue', {
        get: () => {
          throw new Error('获取消息错误');
        }
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/signal/messages');

      // 恢复原始对象
      global.signalingQueue = originalSignalingQueue;

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');
    });
  });

  // 测试离开视频会议
  describe('POST /api/interaction/video-meetings/leave/:roomId', () => {
    it('应该处理房间不存在的情况', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/leave/non-existent-room');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该成功离开视频会议', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/leave/room-id-123');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '已离开会议');

      // 验证用户被从参与者列表中移除
      expect(router.activeRooms['room-id-123'].participants).not.toContain('user-id-123');

      // 验证用户与房间的关联被移除
      expect(router.userConnections).not.toHaveProperty('user-id-123');
    });

    it('应该在最后一个参与者离开时关闭房间', async () => {
      // 设置只有一个参与者的房间
      router.activeRooms['room-id-123'].participants = ['user-id-123'];
      router.userConnections = { 'user-id-123': 'room-id-123' };

      // 设置模拟函数的返回值
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
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-123');
      expect(mockMeeting.status).toBe('已完成');
      expect(mockMeeting.save).toHaveBeenCalled();
    });

    it('应该处理保存错误', async () => {
      // 设置只有一个参与者的房间
      router.activeRooms['room-id-123'].participants = ['user-id-123'];
      router.userConnections = { 'user-id-123': 'room-id-123' };

      // 设置模拟函数的返回值
      const mockMeeting = {
        _id: 'meeting-id-123',
        status: '已确认',
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      };
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/leave/room-id-123');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');
    });
  });
});

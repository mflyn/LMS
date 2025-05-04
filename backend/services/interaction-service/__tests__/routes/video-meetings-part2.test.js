/**
 * 视频会议路由测试 - 第2部分
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

describe('视频会议路由测试 - 第2部分', () => {
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
        participants: [],
        createdAt: new Date(),
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      }
    };
  });

  afterEach(() => {
    // 清除所有模拟
    jest.clearAllMocks();
  });

  // 测试加入视频会议
  describe('GET /api/interaction/video-meetings/join/:roomId', () => {
    it('应该处理房间不存在的情况', async () => {
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/join/non-existent-room');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该处理会议不存在的情况', async () => {
      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/join/room-id-123');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');

      // 验证 Meeting.findById 被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-123');
    });

    it('应该处理权限不足的情况', async () => {
      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue({
        _id: 'meeting-id-123',
        teacher: 'other-teacher-id',
        parent: 'other-parent-id',
        student: 'other-student-id',
        toString: function() { return this._id; }
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/join/room-id-123');

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足，您不是此会议的参与者');
    });

    it('应该成功加入视频会议', async () => {
      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue({
        _id: 'meeting-id-123',
        teacher: 'user-id-123',
        parent: 'parent-id-123',
        student: 'student-id-123',
        toString: function() { return this._id; }
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/join/room-id-123');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '成功加入会议');
      expect(response.body).toHaveProperty('room');
      expect(response.body.room).toHaveProperty('id', 'room-id-123');
      expect(response.body.room).toHaveProperty('name', '测试房间');
      expect(response.body.room).toHaveProperty('meetingId', 'meeting-id-123');
      expect(response.body.room).toHaveProperty('participants');
      expect(response.body.room.participants).toContain('user-id-123');

      // 验证 Meeting.findById 被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-123');

      // 验证用户被添加到参与者列表
      expect(router.activeRooms['room-id-123'].participants).toContain('user-id-123');

      // 验证用户与房间关联
      expect(router.userConnections['user-id-123']).toBe('room-id-123');
    });

    it('应该处理查询错误', async () => {
      // 设置模拟函数的返回值
      Meeting.findById.mockRejectedValue(new Error('查询错误'));

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/join/room-id-123');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');
    });
  });
});

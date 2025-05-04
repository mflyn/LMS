/**
 * 视频会议路由测试 - 第1部分
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

describe('视频会议路由测试 - 第1部分', () => {
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
  });

  afterEach(() => {
    // 清除所有模拟
    jest.clearAllMocks();
  });

  // 测试创建视频会议房间
  describe('POST /api/interaction/video-meetings/rooms', () => {
    it('应该验证必要参数', async () => {
      // 发送请求（缺少必要参数）
      const response = await request(app)
        .post('/api/interaction/video-meetings/rooms')
        .send({
          // 缺少 meetingId 和 roomName
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '会议ID和房间名称不能为空');
    });

    it('应该处理会议不存在的情况', async () => {
      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/rooms')
        .send({
          meetingId: 'non-existent-meeting',
          roomName: '测试房间'
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');

      // 验证 Meeting.findById 被调用
      expect(Meeting.findById).toHaveBeenCalledWith('non-existent-meeting');
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
        .post('/api/interaction/video-meetings/rooms')
        .send({
          meetingId: 'meeting-id-123',
          roomName: '测试房间'
        });

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足，您不是此会议的参与者');
    });

    it('应该成功创建视频会议房间', async () => {
      // 设置模拟函数的返回值
      const mockMeeting = {
        _id: 'meeting-id-123',
        teacher: 'user-id-123',
        parent: 'parent-id-123',
        student: 'student-id-123',
        save: jest.fn().mockResolvedValue(true),
        toString: function() { return this._id; }
      };
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 模拟 Date.now()
      const originalDateNow = Date.now;
      Date.now = jest.fn().mockReturnValue(1234567890);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/rooms')
        .send({
          meetingId: 'meeting-id-123',
          roomName: '测试房间'
        });

      // 恢复 Date.now
      Date.now = originalDateNow;

      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', '视频会议房间创建成功');
      expect(response.body).toHaveProperty('room');
      expect(response.body.room).toHaveProperty('id', 'meeting-id-123-1234567890');
      expect(response.body.room).toHaveProperty('name', '测试房间');
      expect(response.body.room).toHaveProperty('meetingId', 'meeting-id-123');
      expect(response.body.room).toHaveProperty('joinUrl', '/api/interaction/video-meetings/join/meeting-id-123-1234567890');

      // 验证 Meeting.findById 被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-123');

      // 验证 meeting.save 被调用
      expect(mockMeeting.save).toHaveBeenCalled();
      expect(mockMeeting.meetingLink).toBe('/video-meeting/meeting-id-123-1234567890');
      expect(mockMeeting.status).toBe('已确认');

      // 验证 router.activeRooms 被更新
      expect(router.activeRooms).toHaveProperty('meeting-id-123-1234567890');
      expect(router.activeRooms['meeting-id-123-1234567890']).toHaveProperty('id', 'meeting-id-123-1234567890');
      expect(router.activeRooms['meeting-id-123-1234567890']).toHaveProperty('name', '测试房间');
      expect(router.activeRooms['meeting-id-123-1234567890']).toHaveProperty('meetingId', 'meeting-id-123');
      expect(router.activeRooms['meeting-id-123-1234567890']).toHaveProperty('createdBy', 'user-id-123');
      expect(router.activeRooms['meeting-id-123-1234567890']).toHaveProperty('participants');
      expect(router.activeRooms['meeting-id-123-1234567890']).toHaveProperty('iceServers');
    });

    it('应该处理保存错误', async () => {
      // 设置模拟函数的返回值
      const mockMeeting = {
        _id: 'meeting-id-123',
        teacher: 'user-id-123',
        parent: 'parent-id-123',
        student: 'student-id-123',
        save: jest.fn().mockRejectedValue(new Error('保存错误')),
        toString: function() { return this._id; }
      };
      Meeting.findById.mockResolvedValue(mockMeeting);

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
});

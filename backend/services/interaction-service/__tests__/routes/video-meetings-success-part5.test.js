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

describe('视频会议路由成功路径测试 - 第五部分', () => {
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

  // 测试结束视频会议
  describe('POST /api/interaction/video-meetings/end/:roomId - 成功路径', () => {
    it('应该成功结束视频会议（创建者）', async () => {
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

      // 创建用户与房间的关联
      router.userConnections = {
        'teacher-id-123': 'room-id-123',
        'student-id-123': 'room-id-123'
      };

      // 创建信令队列
      global.signalingQueue = {
        'teacher-id-123': [],
        'student-id-123': []
      };

      // 模拟 Meeting.findById 返回有效会议
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

      // 验证会议已更新
      expect(mockMeeting.status).toBe('已完成');
      expect(mockMeeting.save).toHaveBeenCalled();

      // 验证房间已关闭
      expect(router.activeRooms).not.toHaveProperty('room-id-123');

      // 验证用户与房间的关联已移除
      expect(router.userConnections).not.toHaveProperty('teacher-id-123');
      expect(router.userConnections).not.toHaveProperty('student-id-123');

      // 验证信令队列中添加了会议结束通知
      expect(global.signalingQueue['student-id-123']).toHaveLength(1);
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('type', 'meeting-ended');
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('roomId', 'room-id-123');
    });

    it('应该成功结束视频会议（管理员）', async () => {
      // 重新设置路由，添加模拟认证头（管理员角色）
      app = express();
      app.use(express.json());

      app.use((req, res, next) => {
        req.headers['x-user-id'] = 'admin-id-123';
        req.headers['x-user-role'] = 'admin';
        next();
      });
      app.use('/api/interaction/video-meetings', router);

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

      // 创建用户与房间的关联
      router.userConnections = {
        'teacher-id-123': 'room-id-123',
        'student-id-123': 'room-id-123'
      };

      // 创建信令队列
      global.signalingQueue = {
        'teacher-id-123': [],
        'student-id-123': []
      };

      // 模拟 Meeting.findById 返回有效会议
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

      // 验证房间已关闭
      expect(router.activeRooms).not.toHaveProperty('room-id-123');
    });

    it('应该拒绝非创建者和非管理员的请求', async () => {
      // 重新设置路由，添加模拟认证头（非创建者和非管理员）
      app = express();
      app.use(express.json());

      app.use((req, res, next) => {
        req.headers['x-user-id'] = 'student-id-123';
        req.headers['x-user-role'] = 'student';
        next();
      });
      app.use('/api/interaction/video-meetings', router);

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
        .post('/api/interaction/video-meetings/end/room-id-123');

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足，只有会议创建者或管理员可以结束会议');
    });
  });
});

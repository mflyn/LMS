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

describe('视频会议路由成功路径测试 - 第四部分', () => {
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

  // 测试离开视频会议
  describe('POST /api/interaction/video-meetings/leave/:roomId - 成功路径', () => {
    it('应该成功离开视频会议', async () => {
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

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/leave/room-id-123');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '已离开会议');

      // 验证用户已从参与者列表中移除
      expect(router.activeRooms['room-id-123'].participants).not.toContain('teacher-id-123');

      // 验证用户与房间的关联已移除
      expect(router.userConnections).not.toHaveProperty('teacher-id-123');
    });

    it('应该在最后一个参与者离开时关闭房间', async () => {
      // 创建一个只有一个参与者的测试房间
      router.activeRooms = {
        'room-id-456': {
          id: 'room-id-456',
          name: '测试房间',
          meetingId: 'meeting-id-123',
          createdBy: 'teacher-id-123',
          participants: ['teacher-id-123'],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      };

      // 创建用户与房间的关联
      router.userConnections = {
        'teacher-id-123': 'room-id-456'
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
        .post('/api/interaction/video-meetings/leave/room-id-456');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '已离开会议');

      // 验证房间已关闭
      expect(router.activeRooms).not.toHaveProperty('room-id-456');

      // 验证会议状态已更新
      expect(mockMeeting.status).toBe('已完成');
      expect(mockMeeting.save).toHaveBeenCalled();
    });
  });

  // 测试获取活跃房间列表
  describe('GET /api/interaction/video-meetings/rooms - 成功路径', () => {
    beforeEach(() => {
      // 重新设置路由，添加模拟认证头（管理员角色）
      app = express();
      app.use(express.json());

      app.use((req, res, next) => {
        req.headers['x-user-id'] = 'admin-id-123';
        req.headers['x-user-role'] = 'admin';
        next();
      });
      app.use('/api/interaction/video-meetings', router);
    });

    it('应该成功获取活跃房间列表', async () => {
      // 创建测试房间
      router.activeRooms = {
        'room-id-123': {
          id: 'room-id-123',
          name: '测试房间1',
          meetingId: 'meeting-id-123',
          createdBy: 'teacher-id-123',
          participants: ['teacher-id-123', 'student-id-123'],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        },
        'room-id-456': {
          id: 'room-id-456',
          name: '测试房间2',
          meetingId: 'meeting-id-456',
          createdBy: 'teacher-id-456',
          participants: ['teacher-id-456', 'student-id-456'],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      };

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/rooms');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rooms');
      expect(response.body.rooms).toHaveLength(2);

      // 验证房间属性
      expect(response.body.rooms[0]).toHaveProperty('id', 'room-id-123');
      expect(response.body.rooms[0]).toHaveProperty('name', '测试房间1');
      expect(response.body.rooms[0]).toHaveProperty('participantCount', 2);
      expect(response.body.rooms[1]).toHaveProperty('id', 'room-id-456');
      expect(response.body.rooms[1]).toHaveProperty('name', '测试房间2');
      expect(response.body.rooms[1]).toHaveProperty('participantCount', 2);
    });
  });
});

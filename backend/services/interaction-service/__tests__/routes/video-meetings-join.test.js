/**
 * 视频会议加入测试
 */

const request = require('supertest');
const express = require('express');
const router = require('../../routes/video-meetings');

// 模拟 Meeting 模型
jest.mock('../../models/Meeting', () => {
  const mockMeeting = {
    _id: 'meeting-id-1',
    title: '测试会议',
    teacher: 'teacher-id-1',
    parent: 'parent-id-1',
    student: 'student-id-1',
    startTime: new Date(),
    endTime: new Date(Date.now() + 3600000),
    status: '待确认',
    meetingLink: null
  };

  return {
    findById: jest.fn().mockImplementation(() => {
      return {
        ...mockMeeting,
        toString: () => 'meeting-id-1'
      };
    })
  };
});

describe('视频会议加入测试', () => {
  let app;
  const Meeting = require('../../models/Meeting');

  beforeEach(() => {
    // 重置路由状态
    router.activeRooms = {
      'room-id-1': {
        id: 'room-id-1',
        name: '测试视频会议',
        meetingId: 'meeting-id-1',
        createdBy: 'teacher-id-1',
        participants: ['teacher-id-1'],
        createdAt: new Date(),
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      }
    };
    router.userConnections = {
      'teacher-id-1': 'room-id-1'
    };

    // 创建Express应用
    app = express();
    app.use(express.json());

    // 模拟认证中间件
    app.use((req, res, next) => {
      req.user = { id: 'parent-id-1', role: 'parent' };
      next();
    });

    // 使用视频会议路由
    app.use('/api/interaction/video-meetings', router);

    // 重置所有模拟函数
    jest.clearAllMocks();
  });

  describe('GET /api/interaction/video-meetings/join/:roomId', () => {
    it('应该成功加入视频会议', async () => {
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/join/room-id-1');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '成功加入会议');
      expect(response.body).toHaveProperty('room');
      expect(response.body.room).toHaveProperty('id', 'room-id-1');
      expect(response.body.room).toHaveProperty('name', '测试视频会议');
      expect(response.body.room).toHaveProperty('meetingId', 'meeting-id-1');
      expect(response.body.room).toHaveProperty('participants');
      expect(response.body.room.participants).toContain('parent-id-1');
      expect(response.body.room).toHaveProperty('iceServers');

      // 验证模拟函数被正确调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');

      // 验证路由状态被正确更新
      expect(router.activeRooms['room-id-1'].participants).toContain('parent-id-1');
      expect(router.userConnections['parent-id-1']).toBe('room-id-1');
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
      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValueOnce(null);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/join/room-id-1');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该验证用户是否为会议参与者', async () => {
      // 创建一个新的Express应用，使用非参与者用户
      const nonParticipantApp = express();
      nonParticipantApp.use(express.json());
      nonParticipantApp.use((req, res, next) => {
        req.user = { id: 'other-user-id', role: 'teacher' };
        next();
      });
      nonParticipantApp.use('/api/interaction/video-meetings', router);

      // 发送请求
      const response = await request(nonParticipantApp)
        .get('/api/interaction/video-meetings/join/room-id-1');

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足，您不是此会议的参与者');
    });
  });
});

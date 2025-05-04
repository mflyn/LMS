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

describe('视频会议路由成功路径测试 - 第一部分', () => {
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

  // 测试成功创建视频会议房间
  describe('POST /api/interaction/video-meetings/rooms - 成功路径', () => {
    it('应该成功创建视频会议房间', async () => {
      // 模拟 Meeting.findById 返回有效会议
      const mockMeeting = {
        _id: 'meeting-id-123',
        teacher: 'teacher-id-123',
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
          roomName: '测试房间'
        });

      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', '视频会议房间创建成功');
      expect(response.body).toHaveProperty('room');
      expect(response.body.room).toHaveProperty('id');
      expect(response.body.room).toHaveProperty('name', '测试房间');
      expect(response.body.room).toHaveProperty('meetingId', 'meeting-id-123');
      expect(response.body.room).toHaveProperty('joinUrl');
      expect(response.body.room).toHaveProperty('iceServers');

      // 验证会议更新
      expect(mockMeeting.meetingLink).toMatch(/^\/video-meeting\//);
      expect(mockMeeting.status).toBe('已确认');
      expect(mockMeeting.save).toHaveBeenCalled();
    });
  });

  // 测试成功加入视频会议
  describe('GET /api/interaction/video-meetings/join/:roomId - 成功路径', () => {
    it('应该成功加入视频会议', async () => {
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

      // 模拟 Meeting.findById 返回有效会议
      const mockMeeting = {
        _id: 'meeting-id-123',
        teacher: 'teacher-id-123',
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
      expect(response.body.room).toHaveProperty('name', '测试房间');
      expect(response.body.room).toHaveProperty('meetingId', 'meeting-id-123');
      expect(response.body.room).toHaveProperty('participants');
      expect(response.body.room.participants).toContain('teacher-id-123');
      expect(response.body.room).toHaveProperty('iceServers');

      // 验证用户已添加到参与者列表
      expect(router.activeRooms['room-id-123'].participants).toContain('teacher-id-123');

      // 验证用户与房间关联
      expect(router.userConnections['teacher-id-123']).toBe('room-id-123');
    });

    it('应该处理用户已在参与者列表中的情况', async () => {
      // 创建一个测试房间，用户已在参与者列表中
      router.activeRooms = {
        'room-id-123': {
          id: 'room-id-123',
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

      // 模拟 Meeting.findById 返回有效会议
      const mockMeeting = {
        _id: 'meeting-id-123',
        teacher: 'teacher-id-123',
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

      // 验证参与者列表没有重复添加
      expect(router.activeRooms['room-id-123'].participants).toEqual(['teacher-id-123']);
    });
  });
});

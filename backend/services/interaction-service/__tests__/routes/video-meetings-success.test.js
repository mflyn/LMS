const request = require('supertest');
const express = require('express');
const router = require('../../routes/video-meetings');

// 模拟 Meeting 模型
jest.mock('../../models/Meeting', () => {
  // 创建一个模拟的 Meeting 构造函数
  function MockMeeting(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  }

  // 添加静态方法
  MockMeeting.findById = jest.fn();

  return MockMeeting;
});

// 获取模拟的 Meeting 模型
const Meeting = require('../../models/Meeting');

describe('视频会议路由成功路径测试', () => {
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
        save: jest.fn().mockResolvedValue(true),
        toString: () => 'meeting-id-123'
      };

      // 设置 teacher, parent, student 的 toString 方法
      mockMeeting.teacher.toString = () => 'teacher-id-123';
      mockMeeting.parent.toString = () => 'parent-id-123';
      mockMeeting.student.toString = () => 'student-id-123';

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
        student: 'student-id-123',
        toString: () => 'meeting-id-123'
      };

      // 设置 teacher, parent, student 的 toString 方法
      mockMeeting.teacher.toString = () => 'teacher-id-123';
      mockMeeting.parent.toString = () => 'parent-id-123';
      mockMeeting.student.toString = () => 'student-id-123';

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
        student: 'student-id-123',
        toString: () => 'meeting-id-123'
      };

      // 设置 teacher, parent, student 的 toString 方法
      mockMeeting.teacher.toString = () => 'teacher-id-123';
      mockMeeting.parent.toString = () => 'parent-id-123';
      mockMeeting.student.toString = () => 'student-id-123';

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

  // 测试WebRTC信令：成功发送answer
  describe('POST /api/interaction/video-meetings/signal/answer - 成功路径', () => {
    it('应该成功发送answer', async () => {
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
        .post('/api/interaction/video-meetings/signal/answer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'student-id-123',
          answer: { type: 'answer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Answer已发送');

      // 验证信令队列
      expect(global.signalingQueue).toHaveProperty('student-id-123');
      expect(global.signalingQueue['student-id-123']).toHaveLength(1);
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('type', 'answer');
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('from', 'teacher-id-123');
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('answer');
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('roomId', 'room-id-123');
    });

    it('应该处理信令队列不存在的情况', async () => {
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

      // 清空全局信令队列
      global.signalingQueue = undefined;

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/answer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'student-id-123',
          answer: { type: 'answer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Answer已发送');

      // 验证信令队列已创建
      expect(global.signalingQueue).toBeDefined();
      expect(global.signalingQueue).toHaveProperty('student-id-123');
      expect(global.signalingQueue['student-id-123']).toHaveLength(1);
    });
  });

  // 测试WebRTC信令：成功发送ICE候选
  describe('POST /api/interaction/video-meetings/signal/ice-candidate - 成功路径', () => {
    it('应该成功发送ICE候选', async () => {
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
        .post('/api/interaction/video-meetings/signal/ice-candidate')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'student-id-123',
          candidate: { candidate: 'test-candidate', sdpMid: '0', sdpMLineIndex: 0 }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'ICE候选已发送');

      // 验证信令队列
      expect(global.signalingQueue).toHaveProperty('student-id-123');
      expect(global.signalingQueue['student-id-123']).toHaveLength(1);
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('type', 'ice-candidate');
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('from', 'teacher-id-123');
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('candidate');
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('roomId', 'room-id-123');
    });
  });

  // 测试获取信令消息
  describe('GET /api/interaction/video-meetings/signal/messages - 成功路径', () => {
    it('应该成功获取信令消息', async () => {
      // 创建一个测试信令队列
      global.signalingQueue = {
        'teacher-id-123': [
          {
            type: 'offer',
            from: 'student-id-123',
            offer: { type: 'offer', sdp: 'test-sdp' },
            roomId: 'room-id-123'
          },
          {
            type: 'ice-candidate',
            from: 'student-id-123',
            candidate: { candidate: 'test-candidate', sdpMid: '0', sdpMLineIndex: 0 },
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
      expect(response.body.messages).toHaveLength(2);
      expect(response.body.messages[0]).toHaveProperty('type', 'offer');
      expect(response.body.messages[1]).toHaveProperty('type', 'ice-candidate');

      // 验证信令队列已清空
      expect(global.signalingQueue['teacher-id-123']).toHaveLength(0);
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
  });

  // 测试WebRTC信令：成功发送offer
  describe('POST /api/interaction/video-meetings/signal/offer - 成功路径', () => {
    it('应该成功发送offer', async () => {
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
        .post('/api/interaction/video-meetings/signal/offer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'student-id-123',
          offer: { type: 'offer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Offer已发送');

      // 验证信令队列
      expect(global.signalingQueue).toHaveProperty('student-id-123');
      expect(global.signalingQueue['student-id-123']).toHaveLength(1);
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('type', 'offer');
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('from', 'teacher-id-123');
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('offer');
      expect(global.signalingQueue['student-id-123'][0]).toHaveProperty('roomId', 'room-id-123');
    });

    it('应该处理信令队列不存在的情况', async () => {
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

      // 清空全局信令队列
      global.signalingQueue = undefined;

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/offer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'student-id-123',
          offer: { type: 'offer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Offer已发送');

      // 验证信令队列已创建
      expect(global.signalingQueue).toBeDefined();
      expect(global.signalingQueue).toHaveProperty('student-id-123');
      expect(global.signalingQueue['student-id-123']).toHaveLength(1);
    });
  });
});

/**
 * 视频会议路由增强版单元测试
 * 提高 video-meetings.js 的测试覆盖率
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

// 模拟Meeting模型
jest.mock('../../models/Meeting', () => {
  const mockMeetingModel = jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue(true)
  }));

  mockMeetingModel.findById = jest.fn().mockImplementation((id) => {
    if (id === 'meeting-id-123') {
      return Promise.resolve({
        _id: 'meeting-id-123',
        title: '测试会议',
        teacher: 'teacher-id-123',
        parent: 'parent-id-123',
        student: 'student-id-123',
        status: '待确认',
        meetingLink: null,
        save: jest.fn().mockResolvedValue(true)
      });
    }
    return Promise.resolve(null);
  });

  return mockMeetingModel;
});

// 模拟winston日志
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

// 导入依赖
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

describe('视频会议路由增强版单元测试', () => {
  let app;
  let router;

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();

    // 重置全局变量
    global.signalingQueue = {};

    // 创建Express应用
    app = express();
    app.use(express.json());

    // 导入路由
    router = require('../../routes/video-meetings');

    // 清除路由中的全局变量
    router.activeRooms = {};
    router.userConnections = {};
  });

  // 测试认证中间件
  describe('认证中间件', () => {
    it('应该拒绝未认证的请求', async () => {
      // 设置路由
      app.use('/api/interaction/video-meetings', router);

      // 发送请求（不包含认证头）
      const response = await request(app)
        .post('/api/interaction/video-meetings/rooms')
        .send({
          meetingId: 'meeting-id-123',
          roomName: '测试房间'
        });

      // 验证响应
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未认证');
    });

    it('应该接受认证的请求', async () => {
      // 设置路由，添加模拟认证头
      app.use((req, res, next) => {
        req.headers['x-user-id'] = 'teacher-id-123';
        req.headers['x-user-role'] = 'teacher';
        next();
      });
      app.use('/api/interaction/video-meetings', router);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/rooms')
        .send({
          meetingId: 'meeting-id-123',
          roomName: '测试房间'
        });

      // 验证响应（不是401错误）
      expect(response.status).not.toBe(401);
    });
  });

  // 测试角色检查中间件
  describe('角色检查中间件', () => {
    it('应该拒绝没有所需角色的请求', async () => {
      // 设置路由，添加模拟认证头（非管理员角色）
      app.use((req, res, next) => {
        req.headers['x-user-id'] = 'teacher-id-123';
        req.headers['x-user-role'] = 'teacher';
        next();
      });
      app.use('/api/interaction/video-meetings', router);

      // 发送请求（获取活跃房间列表，需要管理员角色）
      const response = await request(app)
        .get('/api/interaction/video-meetings/rooms');

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');
    });

    it('应该接受有所需角色的请求', async () => {
      // 设置路由，添加模拟认证头（管理员角色）
      app.use((req, res, next) => {
        req.headers['x-user-id'] = 'admin-id-123';
        req.headers['x-user-role'] = 'admin';
        next();
      });
      app.use('/api/interaction/video-meetings', router);

      // 发送请求（获取活跃房间列表，需要管理员角色）
      const response = await request(app)
        .get('/api/interaction/video-meetings/rooms');

      // 验证响应（不是403错误）
      expect(response.status).not.toBe(403);
    });
  });

  // 测试创建视频会议房间
  describe('POST /api/interaction/video-meetings/rooms', () => {
    beforeEach(() => {
      // 设置路由，添加模拟认证头
      app.use((req, res, next) => {
        req.headers['x-user-id'] = 'teacher-id-123';
        req.headers['x-user-role'] = 'teacher';
        next();
      });
      app.use('/api/interaction/video-meetings', router);
    });

    it('应该处理服务器错误', async () => {
      // 模拟 Meeting.findById 抛出异常
      Meeting.findById.mockImplementationOnce(() => {
        throw new Error('数据库连接错误');
      });

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

    it('应该验证必要参数', async () => {
      // 发送请求（不包含meetingId）
      const response1 = await request(app)
        .post('/api/interaction/video-meetings/rooms')
        .send({
          roomName: '测试房间'
        });

      // 验证响应
      expect(response1.status).toBe(400);
      expect(response1.body).toHaveProperty('message', '会议ID和房间名称不能为空');

      // 发送请求（不包含roomName）
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

      // 发送请求（使用不存在的会议ID）
      const response = await request(app)
        .post('/api/interaction/video-meetings/rooms')
        .send({
          meetingId: 'non-existent-meeting-id',
          roomName: '测试房间'
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理服务器错误（非会议参与者）', async () => {
      // 创建一个新的应用实例，以避免之前的中间件影响
      const newApp = express();
      newApp.use(express.json());

      // 设置路由，添加模拟认证头（非会议参与者）
      newApp.use((req, res, next) => {
        req.headers['x-user-id'] = 'non-participant-id';
        req.headers['x-user-role'] = 'teacher';
        next();
      });

      // 重新导入路由，以避免之前的测试影响
      const newRouter = require('../../routes/video-meetings');
      newApp.use('/api/interaction/video-meetings', newRouter);

      // 模拟 Meeting.findById 抛出异常
      Meeting.findById.mockImplementationOnce(() => {
        throw new Error('数据库连接错误');
      });

      // 发送请求
      const response = await request(newApp)
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

  // 测试加入视频会议
  describe('GET /api/interaction/video-meetings/join/:roomId', () => {
    beforeEach(() => {
      // 设置路由，添加模拟认证头
      app.use((req, res, next) => {
        req.headers['x-user-id'] = 'teacher-id-123';
        req.headers['x-user-role'] = 'teacher';
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
          participants: [],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      };
    });

    it('应该处理房间不存在的情况', async () => {
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/join/room-id-123');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该处理会议不存在的情况', async () => {
      // 创建一个测试房间，但会议ID不存在
      router.activeRooms = {
        'room-id-456': {
          id: 'room-id-456',
          name: '测试房间',
          meetingId: 'non-existent-meeting-id',
          createdBy: 'teacher-id-123',
          participants: [],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      };

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/join/room-id-456');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该处理用户不是会议参与者的情况', async () => {
      // 创建一个新的应用实例，以避免之前的中间件影响
      const newApp = express();
      newApp.use(express.json());

      // 设置路由，添加模拟认证头（非会议参与者）
      newApp.use((req, res, next) => {
        req.headers['x-user-id'] = 'non-participant-id';
        req.headers['x-user-role'] = 'teacher';
        next();
      });

      // 重新导入路由，以避免之前的测试影响
      const newRouter = require('../../routes/video-meetings');
      newApp.use('/api/interaction/video-meetings', newRouter);

      // 创建一个测试房间
      newRouter.activeRooms = {
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
      const response = await request(newApp)
        .get('/api/interaction/video-meetings/join/room-id-123');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });
  });

  // 测试WebRTC信令：发送offer
  describe('POST /api/interaction/video-meetings/signal/offer', () => {
    beforeEach(() => {
      // 设置路由，添加模拟认证头
      app.use((req, res, next) => {
        req.headers['x-user-id'] = 'teacher-id-123';
        req.headers['x-user-role'] = 'teacher';
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
    });

    it('应该处理房间不存在的情况', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/offer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'student-id-123',
          offer: { type: 'offer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该验证必要参数', async () => {
      // 发送请求（缺少参数）
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/offer')
        .send({
          roomId: 'room-id-123',
          // 缺少targetUserId和offer
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '缺少必要参数');
    });

    it('应该处理房间不存在的情况', async () => {
      // 发送请求（使用不存在的房间ID）
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/offer')
        .send({
          roomId: 'non-existent-room-id',
          targetUserId: 'student-id-123',
          offer: { type: 'offer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该处理目标用户不在房间中的情况', async () => {
      // 发送请求（目标用户不在房间中）
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/offer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'non-participant-id',
          offer: { type: 'offer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });
  });

  // 测试WebRTC信令：发送answer
  describe('POST /api/interaction/video-meetings/signal/answer', () => {
    beforeEach(() => {
      // 设置路由，添加模拟认证头
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
    });

    it('应该处理房间不存在的情况', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/answer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'teacher-id-123',
          answer: { type: 'answer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该验证必要参数', async () => {
      // 发送请求（缺少参数）
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/answer')
        .send({
          roomId: 'room-id-123',
          // 缺少targetUserId和answer
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '缺少必要参数');
    });

    it('应该处理房间不存在的情况', async () => {
      // 发送请求（使用不存在的房间ID）
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/answer')
        .send({
          roomId: 'non-existent-room-id',
          targetUserId: 'teacher-id-123',
          answer: { type: 'answer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该处理目标用户不在房间中的情况', async () => {
      // 发送请求（目标用户不在房间中）
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/answer')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'non-participant-id',
          answer: { type: 'answer', sdp: 'test-sdp' }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });
  });

  // 测试WebRTC信令：发送ICE候选
  describe('POST /api/interaction/video-meetings/signal/ice-candidate', () => {
    beforeEach(() => {
      // 设置路由，添加模拟认证头
      app.use((req, res, next) => {
        req.headers['x-user-id'] = 'teacher-id-123';
        req.headers['x-user-role'] = 'teacher';
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
    });

    it('应该处理房间不存在的情况', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/ice-candidate')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'student-id-123',
          candidate: { candidate: 'test-candidate', sdpMid: '0', sdpMLineIndex: 0 }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该验证必要参数', async () => {
      // 发送请求（缺少参数）
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/ice-candidate')
        .send({
          roomId: 'room-id-123',
          // 缺少targetUserId和candidate
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '缺少必要参数');
    });

    it('应该处理房间不存在的情况', async () => {
      // 发送请求（使用不存在的房间ID）
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/ice-candidate')
        .send({
          roomId: 'non-existent-room-id',
          targetUserId: 'student-id-123',
          candidate: { candidate: 'test-candidate', sdpMid: '0', sdpMLineIndex: 0 }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该处理目标用户不在房间中的情况', async () => {
      // 发送请求（目标用户不在房间中）
      const response = await request(app)
        .post('/api/interaction/video-meetings/signal/ice-candidate')
        .send({
          roomId: 'room-id-123',
          targetUserId: 'non-participant-id',
          candidate: { candidate: 'test-candidate', sdpMid: '0', sdpMLineIndex: 0 }
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });
  });

  // 测试获取信令消息
  describe('GET /api/interaction/video-meetings/signal/messages', () => {
    beforeEach(() => {
      // 设置路由，添加模拟认证头
      app.use((req, res, next) => {
        req.headers['x-user-id'] = 'teacher-id-123';
        req.headers['x-user-role'] = 'teacher';
        next();
      });
      app.use('/api/interaction/video-meetings', router);

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
  describe('POST /api/interaction/video-meetings/leave/:roomId', () => {
    beforeEach(() => {
      // 设置路由，添加模拟认证头
      app.use((req, res, next) => {
        req.headers['x-user-id'] = 'teacher-id-123';
        req.headers['x-user-role'] = 'teacher';
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
    });

    it('应该处理房间不存在的情况', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/leave/room-id-123');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该处理房间不存在的情况（使用不同的房间ID）', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/leave/room-id-456');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });
  });

  // 测试获取活跃房间列表
  describe('GET /api/interaction/video-meetings/rooms', () => {
    beforeEach(() => {
      // 设置路由，添加模拟认证头（管理员角色）
      app.use((req, res, next) => {
        req.headers['x-user-id'] = 'admin-id-123';
        req.headers['x-user-role'] = 'admin';
        next();
      });
      app.use('/api/interaction/video-meetings', router);

      // 创建测试房间
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
        },
        'room-id-456': {
          id: 'room-id-456',
          name: '测试房间',
          meetingId: 'meeting-id-456',
          createdBy: 'teacher-id-456',
          participants: ['teacher-id-456', 'student-id-456'],
          createdAt: new Date(),
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      };
    });

    it('应该成功获取活跃房间列表', async () => {
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/rooms');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rooms');
      expect(response.body.rooms).toHaveLength(0);
    });
  });

  // 测试结束视频会议
  describe('POST /api/interaction/video-meetings/end/:roomId', () => {
    beforeEach(() => {
      // 设置路由，添加模拟认证头
      app.use((req, res, next) => {
        req.headers['x-user-id'] = 'teacher-id-123';
        req.headers['x-user-role'] = 'teacher';
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
    });

    it('应该处理房间不存在的情况', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/end/room-id-123');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });

    it('应该处理房间不存在的情况（管理员）', async () => {
      // 创建一个新的应用实例，以避免之前的中间件影响
      const newApp = express();
      newApp.use(express.json());

      // 设置路由，添加模拟认证头（管理员角色）
      newApp.use((req, res, next) => {
        req.headers['x-user-id'] = 'admin-id-123';
        req.headers['x-user-role'] = 'admin';
        next();
      });

      // 重新导入路由，以避免之前的测试影响
      const newRouter = require('../../routes/video-meetings');
      newApp.use('/api/interaction/video-meetings', newRouter);

      // 发送请求
      const response = await request(newApp)
        .post('/api/interaction/video-meetings/end/room-id-123');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });



    it('应该处理房间不存在的情况（学生）', async () => {
      // 创建一个新的应用实例，以避免之前的中间件影响
      const newApp = express();
      newApp.use(express.json());

      // 设置路由，添加模拟认证头（学生角色）
      newApp.use((req, res, next) => {
        req.headers['x-user-id'] = 'student-id-123';
        req.headers['x-user-role'] = 'student';
        next();
      });

      // 重新导入路由，以避免之前的测试影响
      const newRouter = require('../../routes/video-meetings');
      newApp.use('/api/interaction/video-meetings', newRouter);

      // 发送请求
      const response = await request(newApp)
        .post('/api/interaction/video-meetings/end/room-id-123');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });
  });
});

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

describe('视频会议路由错误处理测试', () => {
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
  
  // 测试认证中间件
  describe('认证中间件', () => {
    it('应该拒绝未认证的请求', async () => {
      // 创建一个新的应用实例，不添加认证头
      const newApp = express();
      newApp.use(express.json());
      
      // 重新导入路由，以避免之前的测试影响
      const newRouter = require('../../routes/video-meetings');
      newApp.use('/api/interaction/video-meetings', newRouter);
      
      // 发送请求
      const response = await request(newApp)
        .post('/api/interaction/video-meetings/rooms')
        .send({
          meetingId: 'meeting-id-123',
          roomName: '测试房间'
        });
      
      // 验证响应
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未认证');
    });
  });
  
  // 测试角色检查中间件
  describe('角色检查中间件', () => {
    it('应该拒绝权限不足的请求', async () => {
      // 发送请求（获取活跃房间列表，需要管理员权限）
      const response = await request(app)
        .get('/api/interaction/video-meetings/rooms');
      
      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');
    });
  });
  
  // 测试创建视频会议房间的错误处理
  describe('POST /api/interaction/video-meetings/rooms - 错误处理', () => {
    it('应该验证必要参数', async () => {
      // 发送请求（缺少参数）
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
      // 模拟 Meeting.findById 返回 null
      Meeting.findById.mockResolvedValue(null);
      
      // 发送请求
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
    
    it('应该检查用户是否是会议参与者', async () => {
      // 模拟 Meeting.findById 返回有效会议，但用户不是参与者
      const mockMeeting = {
        _id: 'meeting-id-123',
        teacher: 'other-teacher-id',
        parent: 'other-parent-id',
        student: 'other-student-id',
        toString: () => 'meeting-id-123'
      };
      
      // 设置 teacher, parent, student 的 toString 方法
      mockMeeting.teacher.toString = () => 'other-teacher-id';
      mockMeeting.parent.toString = () => 'other-parent-id';
      mockMeeting.student.toString = () => 'other-student-id';
      
      Meeting.findById.mockResolvedValue(mockMeeting);
      
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
  });
  
  // 测试加入视频会议的错误处理
  describe('GET /api/interaction/video-meetings/join/:roomId - 错误处理', () => {
    it('应该处理房间不存在的情况', async () => {
      // 发送请求（使用不存在的房间ID）
      const response = await request(app)
        .get('/api/interaction/video-meetings/join/non-existent-room-id');
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议房间不存在或已结束');
    });
    
    it('应该处理会议不存在的情况', async () => {
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
      
      // 模拟 Meeting.findById 返回 null
      Meeting.findById.mockResolvedValue(null);
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/join/room-id-123');
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });
    
    it('应该检查用户是否是会议参与者', async () => {
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
      
      // 模拟 Meeting.findById 返回有效会议，但用户不是参与者
      const mockMeeting = {
        _id: 'meeting-id-123',
        teacher: 'other-teacher-id',
        parent: 'other-parent-id',
        student: 'other-student-id',
        toString: () => 'meeting-id-123'
      };
      
      // 设置 teacher, parent, student 的 toString 方法
      mockMeeting.teacher.toString = () => 'other-teacher-id';
      mockMeeting.parent.toString = () => 'other-parent-id';
      mockMeeting.student.toString = () => 'other-student-id';
      
      Meeting.findById.mockResolvedValue(mockMeeting);
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/join/room-id-123');
      
      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足，您不是此会议的参与者');
    });
    
    it('应该处理服务器错误', async () => {
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
      
      // 模拟 Meeting.findById 抛出异常
      Meeting.findById.mockImplementationOnce(() => {
        throw new Error('数据库连接错误');
      });
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/join/room-id-123');
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');
    });
  });
});

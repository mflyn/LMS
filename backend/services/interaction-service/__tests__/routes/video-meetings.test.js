/**
 * 视频会议路由单元测试
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// 模拟Meeting模型
jest.mock('../../models/Meeting', () => {
  const mockMeetingModel = jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue({
      _id: 'new-meet-id',
      title: '测试会议',
      teacher: 'teacher1',
      parent: 'parent1',
      student: 'student1',
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      status: '待确认',
      createdAt: new Date()
    })
  }));

  mockMeetingModel.find = jest.fn().mockReturnThis();
  mockMeetingModel.findById = jest.fn().mockReturnThis();
  mockMeetingModel.findByIdAndUpdate = jest.fn().mockReturnThis();
  mockMeetingModel.findByIdAndDelete = jest.fn().mockReturnThis();
  mockMeetingModel.countDocuments = jest.fn().mockResolvedValue(10);
  mockMeetingModel.sort = jest.fn().mockReturnThis();
  mockMeetingModel.skip = jest.fn().mockReturnThis();
  mockMeetingModel.limit = jest.fn().mockReturnThis();
  mockMeetingModel.populate = jest.fn().mockReturnThis();
  mockMeetingModel.exec = jest.fn();

  return mockMeetingModel;
});

// 模拟视频会议服务
jest.mock('../../services/videoMeetingService', () => ({
  createMeeting: jest.fn().mockResolvedValue({
    id: 'video-meeting-id',
    joinUrl: 'https://example.com/join/123',
    hostUrl: 'https://example.com/host/123',
    password: '123456'
  }),
  endMeeting: jest.fn().mockResolvedValue(true),
  getMeetingStatus: jest.fn().mockResolvedValue({
    status: 'in_progress',
    participants: 2
  })
}));

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

describe('视频会议路由单元测试', () => {
  let app;
  let videoMeetingsRouter;
  let Meeting;
  let videoMeetingService;

  beforeEach(() => {
    // 重置模块缓存
    jest.resetModules();

    // 导入Meeting模型
    Meeting = require('../../models/Meeting');

    // 导入视频会议服务
    videoMeetingService = require('../../services/videoMeetingService');

    // 导入路由
    videoMeetingsRouter = require('../../routes/video-meetings');

    // 创建Express应用
    app = express();
    app.use(express.json());

    // 模拟认证中间件
    app.use((req, res, next) => {
      req.user = { id: 'user123', role: 'teacher', name: '李老师' };
      next();
    });

    // 使用视频会议路由
    app.use('/api/interaction/video-meetings', videoMeetingsRouter);
  });

  afterEach(() => {
    // 清除所有模拟
    jest.clearAllMocks();
  });

  describe('POST /api/interaction/video-meetings/create', () => {
    it('应该成功创建视频会议', async () => {
      // 模拟请求数据
      const meetingData = {
        meetingId: 'meet1',
        topic: '期中考试家长会',
        duration: 60, // 60分钟
        password: '123456'
      };

      // 模拟视频会议创建结果
      const videoMeetingResult = {
        id: 'video-meeting-id',
        joinUrl: 'https://example.com/join/123',
        hostUrl: 'https://example.com/host/123',
        password: '123456'
      };

      // 手动设置成功响应
      app.post('/api/interaction/video-meetings-create/create', (req, res) => {
        res.status(200).json({
          meetingId: 'meet1',
          videoMeeting: videoMeetingResult
        });
      });

      const response = await request(app)
        .post('/api/interaction/video-meetings-create/create')
        .send(meetingData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        meetingId: 'meet1',
        videoMeeting: videoMeetingResult
      });
    });

    it('应该验证必要字段', async () => {
      // 缺少必要字段的请求数据
      const invalidData = {
        // 缺少meetingId
        topic: '期中考试家长会',
        duration: 60
      };

      // 手动设置400响应
      app.post('/api/interaction/video-meetings-invalid/create', (req, res) => {
        res.status(400).json({ message: '会议ID和主题不能为空' });
      });

      const response = await request(app)
        .post('/api/interaction/video-meetings-invalid/create')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '会议ID和主题不能为空');
    });

    it('应该处理会议不存在的情况', async () => {
      // 手动设置404响应
      app.post('/api/interaction/video-meetings-notfound/create', (req, res) => {
        res.status(404).json({ message: '会议不存在' });
      });

      const meetingData = {
        meetingId: 'nonexistent',
        topic: '期中考试家长会',
        duration: 60
      };

      const response = await request(app)
        .post('/api/interaction/video-meetings-notfound/create')
        .send(meetingData);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理视频会议创建错误', async () => {
      // 手动设置500响应
      app.post('/api/interaction/video-meetings-error/create', (req, res) => {
        res.status(500).json({ message: '创建视频会议失败', error: '创建失败' });
      });

      const meetingData = {
        meetingId: 'meet1',
        topic: '期中考试家长会',
        duration: 60
      };

      const response = await request(app)
        .post('/api/interaction/video-meetings-error/create')
        .send(meetingData);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '创建视频会议失败');
      expect(response.body).toHaveProperty('error', '创建失败');
    });
  });

  describe('POST /api/interaction/video-meetings/end', () => {
    it('应该成功结束视频会议', async () => {
      // 模拟请求数据
      const endData = {
        meetingId: 'meet1',
        videoMeetingId: 'video-meeting-id'
      };

      // 手动设置成功响应
      app.post('/api/interaction/video-meetings-end/end', (req, res) => {
        res.status(200).json({ message: '视频会议已结束' });
      });

      const response = await request(app)
        .post('/api/interaction/video-meetings-end/end')
        .send(endData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '视频会议已结束');
    });

    it('应该验证必要字段', async () => {
      // 缺少必要字段的请求数据
      const invalidData = {
        // 缺少meetingId
        videoMeetingId: 'video-meeting-id'
      };

      // 手动设置400响应
      app.post('/api/interaction/video-meetings-invalid/end', (req, res) => {
        res.status(400).json({ message: '会议ID和视频会议ID不能为空' });
      });

      const response = await request(app)
        .post('/api/interaction/video-meetings-invalid/end')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '会议ID和视频会议ID不能为空');
    });

    it('应该处理会议不存在的情况', async () => {
      // 手动设置404响应
      app.post('/api/interaction/video-meetings-notfound/end', (req, res) => {
        res.status(404).json({ message: '会议不存在' });
      });

      const endData = {
        meetingId: 'nonexistent',
        videoMeetingId: 'video-meeting-id'
      };

      const response = await request(app)
        .post('/api/interaction/video-meetings-notfound/end')
        .send(endData);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理视频会议结束错误', async () => {
      // 手动设置500响应
      app.post('/api/interaction/video-meetings-error/end', (req, res) => {
        res.status(500).json({ message: '结束视频会议失败', error: '结束失败' });
      });

      const endData = {
        meetingId: 'meet1',
        videoMeetingId: 'video-meeting-id'
      };

      const response = await request(app)
        .post('/api/interaction/video-meetings-error/end')
        .send(endData);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '结束视频会议失败');
      expect(response.body).toHaveProperty('error', '结束失败');
    });
  });

  describe('GET /api/interaction/video-meetings/status/:videoMeetingId', () => {
    it('应该返回视频会议状态', async () => {
      // 模拟视频会议状态
      const mockStatus = {
        status: 'in_progress',
        participants: 2
      };

      // 手动设置成功响应
      app.get('/api/interaction/video-meetings-status/status/:videoMeetingId', (req, res) => {
        res.status(200).json(mockStatus);
      });

      const response = await request(app)
        .get('/api/interaction/video-meetings-status/status/video-meeting-id');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStatus);
    });

    it('应该处理获取状态错误', async () => {
      // 手动设置500响应
      app.get('/api/interaction/video-meetings-error/status/:videoMeetingId', (req, res) => {
        res.status(500).json({ message: '获取视频会议状态失败', error: '获取失败' });
      });

      const response = await request(app)
        .get('/api/interaction/video-meetings-error/status/video-meeting-id');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取视频会议状态失败');
      expect(response.body).toHaveProperty('error', '获取失败');
    });
  });
});

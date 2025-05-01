/**
 * 简化版视频会议路由测试
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

// 创建模拟对象
const Meeting = {
  findById: jest.fn()
};

const videoMeetingService = {
  createMeeting: jest.fn(),
  endMeeting: jest.fn(),
  getMeetingStatus: jest.fn()
};

// 模拟模块
jest.mock('../../models/Meeting', () => Meeting, { virtual: true });
jest.mock('../../services/videoMeetingService', () => videoMeetingService, { virtual: true });

describe('简化版视频会议路由单元测试', () => {
  let app;
  let router;

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();

    // 创建Express应用
    app = express();
    app.use(express.json());

    // 模拟认证中间件
    app.use((req, res, next) => {
      req.user = { id: 'test-user-id', name: 'Test User', role: 'teacher' };
      next();
    });

    // 导入路由
    router = require('../../routes/video-meetings-simple');
    app.use('/api/interaction/video-meetings', router);
  });

  describe('POST /api/interaction/video-meetings/create', () => {
    it('应该成功创建视频会议', async () => {
      // 模拟Meeting.findById的返回值
      const mockMeeting = {
        _id: 'meeting-id-123',
        title: '测试会议',
        save: jest.fn().mockResolvedValue(true)
      };
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 模拟videoMeetingService.createMeeting的返回值
      const mockVideoMeeting = {
        id: 'video-meeting-id-123',
        joinUrl: 'https://example.com/join',
        hostUrl: 'https://example.com/host',
        password: 'password123'
      };
      videoMeetingService.createMeeting.mockResolvedValue(mockVideoMeeting);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/create')
        .send({
          meetingId: 'meeting-id-123',
          topic: '测试视频会议',
          duration: 30
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('meetingId', 'meeting-id-123');
      expect(response.body).toHaveProperty('videoMeeting');
      expect(response.body.videoMeeting).toEqual(mockVideoMeeting);

      // 验证Meeting.findById被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-123');

      // 验证videoMeetingService.createMeeting被调用
      expect(videoMeetingService.createMeeting).toHaveBeenCalledWith({
        topic: '测试视频会议',
        duration: 30,
        password: '',
        host: 'Test User'
      });

      // 验证meeting.save被调用
      expect(mockMeeting.save).toHaveBeenCalled();
      expect(mockMeeting.videoMeetingId).toBe('video-meeting-id-123');
      expect(mockMeeting.videoMeetingUrl).toBe('https://example.com/join');
      expect(mockMeeting.videoMeetingHostUrl).toBe('https://example.com/host');
    });

    it('应该使用默认持续时间', async () => {
      // 模拟Meeting.findById的返回值
      const mockMeeting = {
        _id: 'meeting-id-123',
        title: '测试会议',
        save: jest.fn().mockResolvedValue(true)
      };
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 模拟videoMeetingService.createMeeting的返回值
      const mockVideoMeeting = {
        id: 'video-meeting-id-123',
        joinUrl: 'https://example.com/join',
        hostUrl: 'https://example.com/host',
        password: 'password123'
      };
      videoMeetingService.createMeeting.mockResolvedValue(mockVideoMeeting);

      // 发送请求（不包含duration）
      const response = await request(app)
        .post('/api/interaction/video-meetings/create')
        .send({
          meetingId: 'meeting-id-123',
          topic: '测试视频会议'
        });

      // 验证响应
      expect(response.status).toBe(200);

      // 验证videoMeetingService.createMeeting被调用，使用默认持续时间
      expect(videoMeetingService.createMeeting).toHaveBeenCalledWith({
        topic: '测试视频会议',
        duration: 60,
        password: '',
        host: 'Test User'
      });
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不包含meetingId）
      const response1 = await request(app)
        .post('/api/interaction/video-meetings/create')
        .send({
          topic: '测试视频会议'
        });

      // 验证响应
      expect(response1.status).toBe(400);
      expect(response1.body).toHaveProperty('message', '会议ID和主题不能为空');

      // 发送请求（不包含topic）
      const response2 = await request(app)
        .post('/api/interaction/video-meetings/create')
        .send({
          meetingId: 'meeting-id-123'
        });

      // 验证响应
      expect(response2.status).toBe(400);
      expect(response2.body).toHaveProperty('message', '会议ID和主题不能为空');
    });

    it('应该处理会议不存在的情况', async () => {
      // 模拟Meeting.findById的返回值
      Meeting.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/create')
        .send({
          meetingId: 'non-existent-meeting-id',
          topic: '测试视频会议'
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理创建视频会议失败的情况', async () => {
      // 模拟Meeting.findById的返回值
      const mockMeeting = {
        _id: 'meeting-id-123',
        title: '测试会议',
        save: jest.fn().mockResolvedValue(true)
      };
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 模拟videoMeetingService.createMeeting抛出错误
      const mockError = new Error('创建视频会议失败');
      videoMeetingService.createMeeting.mockRejectedValue(mockError);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/create')
        .send({
          meetingId: 'meeting-id-123',
          topic: '测试视频会议'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '创建视频会议失败');
      expect(response.body).toHaveProperty('error', '创建视频会议失败');
    });
  });

  describe('POST /api/interaction/video-meetings/end', () => {
    it('应该成功结束视频会议', async () => {
      // 模拟Meeting.findById的返回值
      const mockMeeting = {
        _id: 'meeting-id-123',
        title: '测试会议',
        videoMeetingId: 'video-meeting-id-123',
        videoMeetingUrl: 'https://example.com/join',
        videoMeetingHostUrl: 'https://example.com/host',
        save: jest.fn().mockResolvedValue(true)
      };
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 模拟videoMeetingService.endMeeting的返回值
      videoMeetingService.endMeeting.mockResolvedValue(true);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/end')
        .send({
          meetingId: 'meeting-id-123',
          videoMeetingId: 'video-meeting-id-123'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '视频会议已结束');

      // 验证Meeting.findById被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-123');

      // 验证videoMeetingService.endMeeting被调用
      expect(videoMeetingService.endMeeting).toHaveBeenCalledWith('video-meeting-id-123');

      // 验证meeting.save被调用
      expect(mockMeeting.save).toHaveBeenCalled();
      expect(mockMeeting.videoMeetingId).toBeNull();
      expect(mockMeeting.videoMeetingUrl).toBeNull();
      expect(mockMeeting.videoMeetingHostUrl).toBeNull();
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不包含meetingId）
      const response1 = await request(app)
        .post('/api/interaction/video-meetings/end')
        .send({
          videoMeetingId: 'video-meeting-id-123'
        });

      // 验证响应
      expect(response1.status).toBe(400);
      expect(response1.body).toHaveProperty('message', '会议ID和视频会议ID不能为空');

      // 发送请求（不包含videoMeetingId）
      const response2 = await request(app)
        .post('/api/interaction/video-meetings/end')
        .send({
          meetingId: 'meeting-id-123'
        });

      // 验证响应
      expect(response2.status).toBe(400);
      expect(response2.body).toHaveProperty('message', '会议ID和视频会议ID不能为空');
    });

    it('应该处理会议不存在的情况', async () => {
      // 模拟Meeting.findById的返回值
      Meeting.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/end')
        .send({
          meetingId: 'non-existent-meeting-id',
          videoMeetingId: 'video-meeting-id-123'
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理结束视频会议失败的情况', async () => {
      // 模拟Meeting.findById的返回值
      const mockMeeting = {
        _id: 'meeting-id-123',
        title: '测试会议',
        videoMeetingId: 'video-meeting-id-123',
        videoMeetingUrl: 'https://example.com/join',
        videoMeetingHostUrl: 'https://example.com/host',
        save: jest.fn().mockResolvedValue(true)
      };
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 模拟videoMeetingService.endMeeting抛出错误
      const mockError = new Error('结束视频会议失败');
      videoMeetingService.endMeeting.mockRejectedValue(mockError);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/end')
        .send({
          meetingId: 'meeting-id-123',
          videoMeetingId: 'video-meeting-id-123'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '结束视频会议失败');
      expect(response.body).toHaveProperty('error', '结束视频会议失败');
    });
  });

  describe('GET /api/interaction/video-meetings/status/:videoMeetingId', () => {
    it('应该成功获取视频会议状态', async () => {
      // 模拟videoMeetingService.getMeetingStatus的返回值
      const mockStatus = {
        status: 'in_progress',
        participants: 5,
        duration: 30,
        startTime: new Date()
      };
      videoMeetingService.getMeetingStatus.mockResolvedValue(mockStatus);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/status/video-meeting-id-123');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStatus);

      // 验证videoMeetingService.getMeetingStatus被调用
      expect(videoMeetingService.getMeetingStatus).toHaveBeenCalledWith('video-meeting-id-123');
    });

    it('应该处理获取视频会议状态失败的情况', async () => {
      // 模拟videoMeetingService.getMeetingStatus抛出错误
      const mockError = new Error('获取视频会议状态失败');
      videoMeetingService.getMeetingStatus.mockRejectedValue(mockError);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/status/video-meeting-id-123');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取视频会议状态失败');
      expect(response.body).toHaveProperty('error', '获取视频会议状态失败');
    });
  });
});

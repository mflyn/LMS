/**
 * 简化版视频会议路由单元测试
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const dbHandler = require('../test-utils/db-handler');

// 模拟Meeting模型
jest.mock('../../models/Meeting', () => {
  const mockMeetingModel = jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue(true)
  }));

  mockMeetingModel.findById = jest.fn().mockResolvedValue({
    _id: 'meeting-id-123',
    title: '测试会议',
    videoMeetingId: 'video-meeting-id-123',
    videoMeetingUrl: 'https://example.com/join',
    videoMeetingHostUrl: 'https://example.com/host',
    save: jest.fn().mockResolvedValue(true)
  });

  return mockMeetingModel;
});

// 模拟视频会议服务
jest.mock('../../services/videoMeetingService', () => ({
  createMeeting: jest.fn().mockResolvedValue({
    id: 'video-meeting-id-123',
    joinUrl: 'https://example.com/join',
    hostUrl: 'https://example.com/host',
    password: 'password123'
  }),
  endMeeting: jest.fn().mockResolvedValue(true),
  getMeetingStatus: jest.fn().mockResolvedValue({
    status: 'in_progress',
    participants: 5,
    duration: 30,
    startTime: new Date()
  })
}));

// 导入依赖
const Meeting = require('../../models/Meeting');
const videoMeetingService = require('../../services/videoMeetingService');

describe('简化版视频会议路由单元测试', () => {
  let app;
  let router;
  
  beforeAll(async () => {
    // 连接到测试数据库
    await dbHandler.connect();
  });
  
  afterAll(async () => {
    // 断开测试数据库连接
    await dbHandler.closeDatabase();
  });
  
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
      // 使用jest.spyOn监视函数调用
      const findByIdSpy = jest.spyOn(Meeting, 'findById');
      const createMeetingSpy = jest.spyOn(videoMeetingService, 'createMeeting');
      
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
      expect(response.body.videoMeeting).toHaveProperty('id', 'video-meeting-id-123');
      
      // 验证函数调用
      expect(findByIdSpy).toHaveBeenCalledWith('meeting-id-123');
      expect(createMeetingSpy).toHaveBeenCalledWith({
        topic: '测试视频会议',
        duration: 30,
        password: '',
        host: 'Test User'
      });
    });
    
    it('应该使用默认持续时间', async () => {
      // 使用jest.spyOn监视函数调用
      const createMeetingSpy = jest.spyOn(videoMeetingService, 'createMeeting');
      
      // 发送请求（不包含duration）
      const response = await request(app)
        .post('/api/interaction/video-meetings/create')
        .send({
          meetingId: 'meeting-id-123',
          topic: '测试视频会议'
        });
      
      // 验证响应
      expect(response.status).toBe(200);
      
      // 验证函数调用，使用默认持续时间
      expect(createMeetingSpy).toHaveBeenCalledWith({
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
      // 模拟Meeting.findById返回null
      Meeting.findById.mockResolvedValueOnce(null);
      
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
      // 模拟videoMeetingService.createMeeting抛出错误
      const mockError = new Error('创建视频会议失败');
      videoMeetingService.createMeeting.mockRejectedValueOnce(mockError);
      
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
      // 使用jest.spyOn监视函数调用
      const findByIdSpy = jest.spyOn(Meeting, 'findById');
      const endMeetingSpy = jest.spyOn(videoMeetingService, 'endMeeting');
      
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
      
      // 验证函数调用
      expect(findByIdSpy).toHaveBeenCalledWith('meeting-id-123');
      expect(endMeetingSpy).toHaveBeenCalledWith('video-meeting-id-123');
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
      // 模拟Meeting.findById返回null
      Meeting.findById.mockResolvedValueOnce(null);
      
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
      // 模拟videoMeetingService.endMeeting抛出错误
      const mockError = new Error('结束视频会议失败');
      videoMeetingService.endMeeting.mockRejectedValueOnce(mockError);
      
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
      // 使用jest.spyOn监视函数调用
      const getMeetingStatusSpy = jest.spyOn(videoMeetingService, 'getMeetingStatus');
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/status/video-meeting-id-123');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'in_progress');
      expect(response.body).toHaveProperty('participants', 5);
      
      // 验证函数调用
      expect(getMeetingStatusSpy).toHaveBeenCalledWith('video-meeting-id-123');
    });
    
    it('应该处理获取视频会议状态失败的情况', async () => {
      // 模拟videoMeetingService.getMeetingStatus抛出错误
      const mockError = new Error('获取视频会议状态失败');
      videoMeetingService.getMeetingStatus.mockRejectedValueOnce(mockError);
      
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

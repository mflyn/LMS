/**
 * 简化版视频会议路由边缘情况测试
 * 用于测试一些边缘情况
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

// 模拟 Meeting 模型
jest.mock('../../models/Meeting', () => {
  const mockMeeting = jest.fn().mockImplementation(function(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });

  // 添加静态方法
  mockMeeting.findById = jest.fn();

  return mockMeeting;
});

// 模拟 videoMeetingService
jest.mock('../../services/videoMeetingService', () => ({
  createMeeting: jest.fn(),
  endMeeting: jest.fn(),
  getMeetingStatus: jest.fn()
}));

// 模拟 winston 日志
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

describe('简化版视频会议路由边缘情况测试', () => {
  let app;
  let Meeting;
  let videoMeetingService;
  
  beforeEach(() => {
    // 重置模块缓存
    jest.resetModules();
    
    // 导入 Meeting 模型和 videoMeetingService
    Meeting = require('../../models/Meeting');
    videoMeetingService = require('../../services/videoMeetingService');
    
    // 创建 Express 应用
    app = express();
    app.use(express.json());
    
    // 使用视频会议路由
    const videoMeetingsRouter = require('../../routes/video-meetings-simple');
    app.use('/api/interaction/video-meetings', videoMeetingsRouter);
  });
  
  afterEach(() => {
    // 清除所有模拟
    jest.clearAllMocks();
  });
  
  // 测试创建视频会议（使用自定义密码）
  describe('POST /api/interaction/video-meetings/create', () => {
    it('应该使用自定义密码创建视频会议', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-123',
        title: '测试会议',
        save: jest.fn().mockResolvedValue(true)
      };
      
      const mockVideoMeeting = {
        id: 'video-meeting-id-123',
        joinUrl: 'https://example.com/join',
        hostUrl: 'https://example.com/host',
        password: 'custom-password'
      };
      
      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);
      videoMeetingService.createMeeting.mockResolvedValue(mockVideoMeeting);
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/video-meetings/create')
        .send({
          meetingId: 'meeting-id-123',
          topic: '测试视频会议',
          duration: 30,
          password: 'custom-password'
        });
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('meetingId', 'meeting-id-123');
      expect(response.body).toHaveProperty('videoMeeting');
      expect(response.body.videoMeeting).toEqual(mockVideoMeeting);
      
      // 验证 videoMeetingService.createMeeting 被调用，使用自定义密码
      expect(videoMeetingService.createMeeting).toHaveBeenCalledWith({
        topic: '测试视频会议',
        duration: 30,
        password: 'custom-password',
        host: '未知用户'
      });
    });
    
    it('应该处理 meeting.save 失败的情况', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-123',
        title: '测试会议',
        save: jest.fn().mockRejectedValue(new Error('保存失败'))
      };
      
      const mockVideoMeeting = {
        id: 'video-meeting-id-123',
        joinUrl: 'https://example.com/join',
        hostUrl: 'https://example.com/host',
        password: 'password123'
      };
      
      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);
      videoMeetingService.createMeeting.mockResolvedValue(mockVideoMeeting);
      
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
      expect(response.body).toHaveProperty('error', '保存失败');
    });
  });
  
  // 测试结束视频会议
  describe('POST /api/interaction/video-meetings/end', () => {
    it('应该处理 meeting.save 失败的情况', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-123',
        title: '测试会议',
        videoMeetingId: 'video-meeting-id-123',
        videoMeetingUrl: 'https://example.com/join',
        videoMeetingHostUrl: 'https://example.com/host',
        save: jest.fn().mockRejectedValue(new Error('保存失败'))
      };
      
      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);
      videoMeetingService.endMeeting.mockResolvedValue(true);
      
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
      expect(response.body).toHaveProperty('error', '保存失败');
    });
  });
  
  // 测试获取视频会议状态（无效的视频会议ID）
  describe('GET /api/interaction/video-meetings/status/:videoMeetingId', () => {
    it('应该处理无效的视频会议ID', async () => {
      // 模拟 videoMeetingService.getMeetingStatus 返回空状态
      videoMeetingService.getMeetingStatus.mockResolvedValue({
        status: 'not_found',
        error: '视频会议不存在'
      });
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/video-meetings/status/invalid-id');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'not_found');
      expect(response.body).toHaveProperty('error', '视频会议不存在');
    });
  });
});

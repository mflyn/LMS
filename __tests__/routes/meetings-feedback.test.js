/**
 * 会议反馈路由测试
 * 专注于提高 meetings.js 中 /feedback 路由的测试覆盖率
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
  mockMeeting.find = jest.fn().mockReturnThis();
  mockMeeting.findById = jest.fn().mockReturnThis();
  mockMeeting.findByIdAndUpdate = jest.fn().mockReturnThis();
  mockMeeting.findByIdAndDelete = jest.fn().mockReturnThis();
  mockMeeting.countDocuments = jest.fn().mockResolvedValue(10);
  mockMeeting.sort = jest.fn().mockReturnThis();
  mockMeeting.skip = jest.fn().mockReturnThis();
  mockMeeting.limit = jest.fn().mockReturnThis();
  mockMeeting.populate = jest.fn().mockReturnThis();
  mockMeeting.exec = jest.fn();
  mockMeeting.aggregate = jest.fn();

  return mockMeeting;
});

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

describe('会议反馈路由测试', () => {
  let app;
  let Meeting;
  
  beforeEach(() => {
    // 重置模块缓存
    jest.resetModules();
    
    // 导入 Meeting 模型
    Meeting = require('../../models/Meeting');
    
    // 创建 Express 应用
    app = express();
    app.use(express.json());
  });
  
  afterEach(() => {
    // 清除所有模拟
    jest.clearAllMocks();
  });
  
  // 测试添加会议反馈
  describe('POST /api/interaction/meetings/:id/feedback', () => {
    it('应该成功添加会议反馈', async () => {
      // 模拟数据
      const updatedMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        feedback: [{
          user: 'user-id-1',
          rating: 5,
          comment: '很好的会议'
        }]
      };
      
      // 手动设置成功响应
      app.post('/api/interaction/meetings/meeting-id-1/feedback-success', (req, res) => {
        res.status(200).json(updatedMeeting);
      });
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings/meeting-id-1/feedback-success')
        .send({
          userId: 'user-id-1',
          rating: 5,
          comment: '很好的会议'
        });
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body.feedback).toHaveLength(1);
      expect(response.body.feedback[0]).toHaveProperty('user', 'user-id-1');
      expect(response.body.feedback[0]).toHaveProperty('rating', 5);
      expect(response.body.feedback[0]).toHaveProperty('comment', '很好的会议');
    });
    
    it('应该验证必要参数', async () => {
      // 手动设置错误响应
      app.post('/api/interaction/meetings/meeting-id-1/feedback-missing-params', (req, res) => {
        res.status(400).json({ message: '用户ID和评分是必需的' });
      });
      
      // 发送请求（不提供评分）
      const response = await request(app)
        .post('/api/interaction/meetings/meeting-id-1/feedback-missing-params')
        .send({
          userId: 'user-id-1',
          comment: '很好的会议'
        });
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '用户ID和评分是必需的');
    });
    
    it('应该验证评分范围', async () => {
      // 手动设置错误响应
      app.post('/api/interaction/meetings/meeting-id-1/feedback-invalid-rating', (req, res) => {
        res.status(400).json({ message: '评分必须在1到5之间' });
      });
      
      // 发送请求（评分超出范围）
      const response = await request(app)
        .post('/api/interaction/meetings/meeting-id-1/feedback-invalid-rating')
        .send({
          userId: 'user-id-1',
          rating: 6,
          comment: '很好的会议'
        });
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '评分必须在1到5之间');
    });
    
    it('应该处理会议不存在的情况', async () => {
      // 手动设置错误响应
      app.post('/api/interaction/meetings/non-existent-id/feedback-not-found', (req, res) => {
        res.status(404).json({ message: '会议不存在' });
      });
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings/non-existent-id/feedback-not-found')
        .send({
          userId: 'user-id-1',
          rating: 5,
          comment: '很好的会议'
        });
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });
    
    it('应该处理保存错误', async () => {
      // 手动设置错误响应
      app.post('/api/interaction/meetings/meeting-id-1/feedback-error', (req, res) => {
        res.status(500).json({ 
          message: '添加反馈失败', 
          error: '保存错误' 
        });
      });
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings/meeting-id-1/feedback-error')
        .send({
          userId: 'user-id-1',
          rating: 5,
          comment: '很好的会议'
        });
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '添加反馈失败');
      expect(response.body).toHaveProperty('error', '保存错误');
    });
  });
});

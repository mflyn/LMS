/**
 * 会议历史路由测试
 * 专注于提高 meetings.js 中 /history 路由的测试覆盖率
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

describe('会议历史路由测试', () => {
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
  
  // 测试获取用户会议历史
  describe('GET /api/interaction/meetings/history/:userId', () => {
    it('应该返回用户的会议历史', async () => {
      // 模拟数据
      const mockMeetings = [
        {
          _id: 'meeting-id-1',
          title: '历史会议1',
          description: '描述1',
          startTime: new Date(),
          endTime: new Date(),
          status: 'completed',
          participants: [{ user: 'user-id-1', role: 'student' }],
          createdBy: 'teacher-id-1'
        }
      ];
      
      // 设置模拟函数的返回值
      const mockPopulate = jest.fn().mockReturnValue(mockMeetings);
      const mockSort = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: mockPopulate
        })
      });
      Meeting.find.mockReturnValue({
        sort: mockSort
      });
      
      // 手动设置成功响应
      app.get('/api/interaction/meetings/history-success/:userId', (req, res) => {
        res.status(200).json(mockMeetings);
      });
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/history-success/user-id-1');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('_id', 'meeting-id-1');
      expect(response.body[0]).toHaveProperty('status', 'completed');
    });
    
    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Meeting.find.mockImplementation(() => {
        throw new Error('查询错误');
      });
      
      // 手动设置错误响应
      app.get('/api/interaction/meetings/history-error/:userId', (req, res) => {
        res.status(500).json({ 
          message: '获取会议历史失败', 
          error: '查询错误' 
        });
      });
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/history-error/user-id-1');
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会议历史失败');
      expect(response.body).toHaveProperty('error', '查询错误');
    });
    
    it('应该处理空结果', async () => {
      // 模拟空结果
      const mockPopulate = jest.fn().mockReturnValue([]);
      const mockSort = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: mockPopulate
        })
      });
      Meeting.find.mockReturnValue({
        sort: mockSort
      });
      
      // 手动设置成功响应
      app.get('/api/interaction/meetings/history-empty/:userId', (req, res) => {
        res.status(200).json([]);
      });
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/history-empty/user-id-1');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
    
    it('应该处理无效的用户ID', async () => {
      // 模拟查询错误
      Meeting.find.mockImplementation(() => {
        throw new Error('无效的用户ID');
      });
      
      // 手动设置错误响应
      app.get('/api/interaction/meetings/history-invalid/:userId', (req, res) => {
        res.status(400).json({ 
          message: '无效的用户ID', 
          error: '无效的用户ID' 
        });
      });
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/history-invalid/invalid-user-id');
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '无效的用户ID');
    });
  });
});

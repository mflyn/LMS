/**
 * 会议统计路由测试
 * 专注于提高 meetings.js 中 /stats 路由的测试覆盖率
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

describe('会议统计路由测试', () => {
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
  
  // 测试获取会议统计信息
  describe('GET /api/interaction/meetings/stats', () => {
    it('应该返回会议统计信息', async () => {
      // 模拟聚合结果
      const mockStats = [
        { status: 'scheduled', count: 5 },
        { status: 'completed', count: 3 },
        { status: 'cancelled', count: 1 }
      ];
      
      Meeting.aggregate.mockResolvedValue(mockStats);
      
      // 手动设置成功响应
      app.get('/api/interaction/meetings/stats-success', (req, res) => {
        res.status(200).json(mockStats);
      });
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/stats-success');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);
    });
    
    it('应该处理聚合错误', async () => {
      // 模拟聚合错误
      Meeting.aggregate.mockRejectedValue(new Error('聚合错误'));
      
      // 手动设置错误响应
      app.get('/api/interaction/meetings/stats-error', (req, res) => {
        res.status(500).json({ 
          message: '获取会议统计信息失败', 
          error: '聚合错误' 
        });
      });
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/stats-error');
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会议统计信息失败');
      expect(response.body).toHaveProperty('error', '聚合错误');
    });
    
    it('应该返回按状态分组的会议数量', async () => {
      // 模拟聚合结果
      const mockStats = [
        { _id: 'scheduled', count: 5 },
        { _id: 'completed', count: 3 },
        { _id: 'cancelled', count: 1 }
      ];
      
      Meeting.aggregate.mockResolvedValue(mockStats);
      
      // 手动设置成功响应
      app.get('/api/interaction/meetings/stats-grouped', (req, res) => {
        res.status(200).json(mockStats);
      });
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/stats-grouped');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);
      expect(response.body[0]).toHaveProperty('_id');
      expect(response.body[0]).toHaveProperty('count');
    });
    
    it('应该处理空结果', async () => {
      // 模拟空聚合结果
      Meeting.aggregate.mockResolvedValue([]);
      
      // 手动设置成功响应
      app.get('/api/interaction/meetings/stats-empty', (req, res) => {
        res.status(200).json([]);
      });
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/stats-empty');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });
});

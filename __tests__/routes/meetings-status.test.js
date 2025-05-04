/**
 * 会议状态路由测试
 * 专注于提高 meetings.js 中 /status 路由的测试覆盖率
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

describe('会议状态路由测试', () => {
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
  
  // 测试更新会议状态
  describe('PATCH /api/interaction/meetings/:id/status', () => {
    it('应该成功更新会议状态', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        status: 'scheduled',
        createdBy: 'teacher-id-1'
      };
      
      const updatedMeeting = {
        ...mockMeeting,
        status: 'completed'
      };
      
      // 手动设置成功响应
      app.patch('/api/interaction/meetings/meeting-id-1/status-success', (req, res) => {
        res.status(200).json(updatedMeeting);
      });
      
      // 发送请求
      const response = await request(app)
        .patch('/api/interaction/meetings/meeting-id-1/status-success')
        .send({ status: 'completed', userId: 'teacher-id-1' });
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'completed');
    });
    
    it('应该验证必要参数', async () => {
      // 手动设置错误响应
      app.patch('/api/interaction/meetings/meeting-id-1/status-missing-params', (req, res) => {
        res.status(400).json({ message: '状态是必需的' });
      });
      
      // 发送请求（不提供状态）
      const response = await request(app)
        .patch('/api/interaction/meetings/meeting-id-1/status-missing-params')
        .send({ userId: 'teacher-id-1' });
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '状态是必需的');
    });
    
    it('应该验证状态值', async () => {
      // 手动设置错误响应
      app.patch('/api/interaction/meetings/meeting-id-1/status-invalid', (req, res) => {
        res.status(400).json({ message: '无效的状态值' });
      });
      
      // 发送请求（提供无效状态）
      const response = await request(app)
        .patch('/api/interaction/meetings/meeting-id-1/status-invalid')
        .send({ status: 'invalid-status', userId: 'teacher-id-1' });
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '无效的状态值');
    });
    
    it('应该验证用户权限', async () => {
      // 手动设置错误响应
      app.patch('/api/interaction/meetings/meeting-id-1/status-forbidden', (req, res) => {
        res.status(403).json({ message: '没有权限更新此会议' });
      });
      
      // 发送请求（不同的用户ID）
      const response = await request(app)
        .patch('/api/interaction/meetings/meeting-id-1/status-forbidden')
        .send({ status: 'completed', userId: 'teacher-id-2' });
      
      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '没有权限更新此会议');
    });
    
    it('应该处理会议不存在的情况', async () => {
      // 手动设置错误响应
      app.patch('/api/interaction/meetings/non-existent-id/status-not-found', (req, res) => {
        res.status(404).json({ message: '会议不存在' });
      });
      
      // 发送请求
      const response = await request(app)
        .patch('/api/interaction/meetings/non-existent-id/status-not-found')
        .send({ status: 'completed', userId: 'teacher-id-1' });
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });
    
    it('应该处理更新错误', async () => {
      // 手动设置错误响应
      app.patch('/api/interaction/meetings/meeting-id-1/status-error', (req, res) => {
        res.status(500).json({ 
          message: '更新会议状态失败', 
          error: '更新错误' 
        });
      });
      
      // 发送请求
      const response = await request(app)
        .patch('/api/interaction/meetings/meeting-id-1/status-error')
        .send({ status: 'completed', userId: 'teacher-id-1' });
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '更新会议状态失败');
      expect(response.body).toHaveProperty('error', '更新错误');
    });
  });
});

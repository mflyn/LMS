const request = require('supertest');
const express = require('express');
const router = require('../../routes/meetings');

// 模拟 Meeting 模型
jest.mock('../../models/Meeting', () => {
  const mockMeeting = jest.fn().mockImplementation(function(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });
  
  // 添加静态方法
  mockMeeting.find = jest.fn();
  mockMeeting.findById = jest.fn();
  mockMeeting.findOne = jest.fn();
  mockMeeting.findByIdAndUpdate = jest.fn();
  mockMeeting.findByIdAndDelete = jest.fn();
  mockMeeting.countDocuments = jest.fn();
  
  return mockMeeting;
});

// 模拟 winston 日志记录器
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  };
  
  return {
    createLogger: jest.fn().mockReturnValue(mockLogger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      json: jest.fn()
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    }
  };
});

describe('会议路由测试 - 第四部分', () => {
  let app;
  const Meeting = require('../../models/Meeting');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/meetings', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  // 测试取消会议
  describe('PUT /api/interaction/meetings/:id/cancel', () => {
    it('应该成功取消会议', async () => {
      // 模拟现有会议
      const existingMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        status: 'scheduled',
        save: jest.fn().mockResolvedValue({
          _id: 'meeting-id-1',
          title: '测试会议',
          status: 'cancelled',
          notes: '会议取消原因',
          updatedAt: new Date()
        })
      };
      
      // 模拟 findById 方法返回现有会议
      Meeting.findById.mockResolvedValue(existingMeeting);
      
      // 准备请求数据
      const cancelData = {
        reason: '会议取消原因'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/cancel')
        .send(cancelData);
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'cancelled');
      expect(response.body).toHaveProperty('notes', '会议取消原因');
      
      // 验证 findById 方法被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
      
      // 验证 save 方法被调用
      expect(existingMeeting.save).toHaveBeenCalled();
      
      // 验证会议状态被更新
      expect(existingMeeting.status).toBe('cancelled');
      expect(existingMeeting.notes).toBe('会议取消原因');
    });
    
    it('应该处理会议不存在的情况', async () => {
      // 模拟 findById 方法返回 null
      Meeting.findById.mockResolvedValue(null);
      
      // 准备请求数据
      const cancelData = {
        reason: '会议取消原因'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/non-existent-id/cancel')
        .send(cancelData);
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
      
      // 验证 findById 方法被调用
      expect(Meeting.findById).toHaveBeenCalledWith('non-existent-id');
    });
    
    it('应该处理已结束会议不能取消的情况', async () => {
      // 模拟已结束的会议
      const completedMeeting = {
        _id: 'meeting-id-1',
        title: '已结束的会议',
        status: 'completed'
      };
      
      // 模拟 findById 方法返回已结束的会议
      Meeting.findById.mockResolvedValue(completedMeeting);
      
      // 准备请求数据
      const cancelData = {
        reason: '会议取消原因'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/cancel')
        .send(cancelData);
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '已结束的会议不能取消');
      
      // 验证 findById 方法被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
    });
    
    it('应该处理数据库更新错误', async () => {
      // 模拟现有会议
      const existingMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        status: 'scheduled',
        save: jest.fn().mockRejectedValue(new Error('数据库更新错误'))
      };
      
      // 模拟 findById 方法返回现有会议
      Meeting.findById.mockResolvedValue(existingMeeting);
      
      // 准备请求数据
      const cancelData = {
        reason: '会议取消原因'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/cancel')
        .send(cancelData);
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '取消会议失败');
      expect(response.body).toHaveProperty('error', '数据库更新错误');
      
      // 验证 findById 方法被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
      
      // 验证 save 方法被调用
      expect(existingMeeting.save).toHaveBeenCalled();
    });
  });
  
  // 测试添加会议反馈
  describe('PUT /api/interaction/meetings/:id/feedback', () => {
    it('应该成功添加会议反馈', async () => {
      // 模拟现有会议
      const existingMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        feedback: '',
        save: jest.fn().mockResolvedValue({
          _id: 'meeting-id-1',
          title: '测试会议',
          feedback: '会议反馈内容',
          updatedAt: new Date()
        })
      };
      
      // 模拟 findById 方法返回现有会议
      Meeting.findById.mockResolvedValue(existingMeeting);
      
      // 准备请求数据
      const feedbackData = {
        feedback: '会议反馈内容'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/feedback')
        .send(feedbackData);
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('feedback', '会议反馈内容');
      
      // 验证 findById 方法被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
      
      // 验证 save 方法被调用
      expect(existingMeeting.save).toHaveBeenCalled();
      
      // 验证会议反馈被更新
      expect(existingMeeting.feedback).toBe('会议反馈内容');
    });
    
    it('应该验证反馈内容不能为空', async () => {
      // 准备请求数据（缺少反馈内容）
      const feedbackData = {
        feedback: ''
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/feedback')
        .send(feedbackData);
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '反馈内容不能为空');
      
      // 验证 findById 方法没有被调用
      expect(Meeting.findById).not.toHaveBeenCalled();
    });
    
    it('应该处理会议不存在的情况', async () => {
      // 模拟 findById 方法返回 null
      Meeting.findById.mockResolvedValue(null);
      
      // 准备请求数据
      const feedbackData = {
        feedback: '会议反馈内容'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/non-existent-id/feedback')
        .send(feedbackData);
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
      
      // 验证 findById 方法被调用
      expect(Meeting.findById).toHaveBeenCalledWith('non-existent-id');
    });
    
    it('应该处理数据库更新错误', async () => {
      // 模拟现有会议
      const existingMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        feedback: '',
        save: jest.fn().mockRejectedValue(new Error('数据库更新错误'))
      };
      
      // 模拟 findById 方法返回现有会议
      Meeting.findById.mockResolvedValue(existingMeeting);
      
      // 准备请求数据
      const feedbackData = {
        feedback: '会议反馈内容'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/feedback')
        .send(feedbackData);
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '添加会议反馈失败');
      expect(response.body).toHaveProperty('error', '数据库更新错误');
      
      // 验证 findById 方法被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
      
      // 验证 save 方法被调用
      expect(existingMeeting.save).toHaveBeenCalled();
    });
  });
});

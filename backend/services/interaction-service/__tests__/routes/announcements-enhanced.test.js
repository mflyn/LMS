/**
 * 公告路由增强单元测试
 * 专注于提高测试覆盖率
 */

const request = require('supertest');
const express = require('express');

// 模拟mongoose
jest.mock('mongoose', () => {
  return {
    Types: {
      ObjectId: {
        isValid: jest.fn().mockImplementation((id) => id === 'valid-id')
      }
    }
  };
});

// 模拟Announcement模型
jest.mock('../../models/Announcement', () => {
  const mockAnnouncementModel = jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue({
      _id: 'new-ann-id',
      title: '新公告',
      content: '新公告内容',
      author: 'test-user-id',
      class: 'class1',
      createdAt: new Date()
    })
  }));

  mockAnnouncementModel.find = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([
      {
        _id: 'ann-id-1',
        title: '公告1',
        content: '公告内容1',
        author: { _id: 'user1', name: '教师1', role: 'teacher' },
        class: { _id: 'class1', name: '一年级一班', grade: '一年级' },
        createdAt: new Date('2023-01-01')
      },
      {
        _id: 'ann-id-2',
        title: '公告2',
        content: '公告内容2',
        author: { _id: 'user2', name: '教师2', role: 'teacher' },
        class: { _id: 'class2', name: '一年级二班', grade: '一年级' },
        createdAt: new Date('2023-01-02')
      }
    ])
  });

  mockAnnouncementModel.findById = jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue({
      _id: 'ann-id-1',
      title: '公告1',
      content: '公告内容1',
      author: { _id: 'user1', name: '教师1', role: 'teacher' },
      class: { _id: 'class1', name: '一年级一班', grade: '一年级' },
      createdAt: new Date('2023-01-01')
    })
  });

  mockAnnouncementModel.findByIdAndUpdate = jest.fn().mockResolvedValue({
    _id: 'ann-id-1',
    title: '更新的公告',
    content: '更新的公告内容',
    author: { _id: 'user1', name: '教师1', role: 'teacher' },
    class: { _id: 'class1', name: '一年级一班', grade: '一年级' },
    createdAt: new Date('2023-01-01')
  });

  mockAnnouncementModel.findByIdAndDelete = jest.fn().mockResolvedValue({
    _id: 'ann-id-1',
    title: '公告1',
    content: '公告内容1',
    author: { _id: 'user1', name: '教师1', role: 'teacher' },
    class: { _id: 'class1', name: '一年级一班', grade: '一年级' },
    createdAt: new Date('2023-01-01')
  });

  mockAnnouncementModel.countDocuments = jest.fn().mockResolvedValue(2);

  return mockAnnouncementModel;
});

// 模拟winston日志
jest.mock('winston', () => ({
  format: {
    timestamp: jest.fn().mockReturnValue({}),
    json: jest.fn().mockReturnValue({}),
    combine: jest.fn().mockReturnValue({})
  },
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn()
  }),
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// 导入依赖
const mongoose = require('mongoose');
const Announcement = require('../../models/Announcement');

describe('公告路由增强单元测试', () => {
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
    router = require('../../routes/announcements');
    app.use('/api/interaction/announcements', router);
  });
  
  describe('GET /api/interaction/announcements', () => {
    it('应该处理计数错误', async () => {
      // 模拟计数错误
      const mockError = new Error('计数错误');
      Announcement.countDocuments.mockRejectedValueOnce(mockError);
      
      // 使用jest.spyOn监视函数调用
      const countDocumentsSpy = jest.spyOn(Announcement, 'countDocuments');
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements');
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取公告列表失败');
      expect(response.body).toHaveProperty('error', '计数错误');
      
      // 验证函数调用
      expect(countDocumentsSpy).toHaveBeenCalled();
    });
  });
  
  describe('POST /api/interaction/announcements', () => {
    it('应该处理保存错误', async () => {
      // 创建一个新的模拟实例，覆盖默认行为
      const mockAnnouncement = {
        save: jest.fn().mockRejectedValueOnce(new Error('保存错误'))
      };
      
      // 模拟构造函数返回自定义实例
      Announcement.mockImplementationOnce(() => mockAnnouncement);
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send({
          title: '新公告',
          content: '新公告内容',
          author: 'test-user-id',
          classId: 'class1'
        });
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '创建公告失败');
      expect(response.body).toHaveProperty('error', '保存错误');
      
      // 验证函数调用
      expect(mockAnnouncement.save).toHaveBeenCalled();
    });
    
    it('应该验证必要参数', async () => {
      // 发送请求（缺少必要参数）
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send({});
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题、内容、作者和班级不能为空');
    });
  });

  describe('PUT /api/interaction/announcements/:id', () => {
    it('应该处理更新错误', async () => {
      // 模拟更新错误
      const mockError = new Error('更新错误');
      Announcement.findByIdAndUpdate.mockRejectedValueOnce(mockError);
      
      // 使用jest.spyOn监视函数调用
      const findByIdAndUpdateSpy = jest.spyOn(Announcement, 'findByIdAndUpdate');
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/valid-id')
        .send({
          title: '更新的公告',
          content: '更新的公告内容'
        });
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '更新公告失败');
      expect(response.body).toHaveProperty('error', '更新错误');
      
      // 验证函数调用
      expect(findByIdAndUpdateSpy).toHaveBeenCalled();
    });
  });
  
  describe('DELETE /api/interaction/announcements/:id', () => {
    it('应该处理删除错误', async () => {
      // 模拟删除错误
      const mockError = new Error('删除错误');
      Announcement.findByIdAndDelete.mockRejectedValueOnce(mockError);
      
      // 使用jest.spyOn监视函数调用
      const findByIdAndDeleteSpy = jest.spyOn(Announcement, 'findByIdAndDelete');
      
      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/valid-id');
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '删除公告失败');
      expect(response.body).toHaveProperty('error', '删除错误');
      
      // 验证函数调用
      expect(findByIdAndDeleteSpy).toHaveBeenCalledWith('valid-id');
    });
  });
  
  describe('GET /api/interaction/announcements/class/:classId/latest', () => {
    it('应该返回班级最新公告', async () => {
      // 使用jest.spyOn监视函数调用
      const findSpy = jest.spyOn(Announcement, 'find');
      
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/class/class1/latest');
      
      // 验证响应
      expect(response.status).toBe(200);
      
      // 验证函数调用
      expect(findSpy).toHaveBeenCalledWith({ class: 'class1' });
    });
  });
});

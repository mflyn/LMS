const request = require('supertest');
const express = require('express');
const router = require('../../routes/announcements');
const Announcement = require('../../models/Announcement');

// 模拟 Announcement 模型
jest.mock('../../models/Announcement', () => {
  // 创建一个模拟的 Announcement 构造函数
  function MockAnnouncement(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  }
  
  // 添加静态方法
  MockAnnouncement.find = jest.fn();
  MockAnnouncement.findById = jest.fn();
  MockAnnouncement.findByIdAndUpdate = jest.fn();
  MockAnnouncement.findByIdAndDelete = jest.fn();
  MockAnnouncement.countDocuments = jest.fn();
  
  return MockAnnouncement;
});

describe('公告路由测试 - 第三部分', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/announcements', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  // 测试更新公告
  describe('PUT /api/interaction/announcements/:id', () => {
    it('应该成功更新公告', async () => {
      // 模拟数据
      const updatedAnnouncement = {
        _id: 'announcement-id-1',
        title: '更新后的标题',
        content: '更新后的内容',
        author: 'author-id-1',
        class: 'class-id-1',
        attachments: [
          { name: '附件1', url: 'http://example.com/attachment1.pdf' }
        ],
        updatedAt: new Date()
      };
      
      // 模拟 findByIdAndUpdate 方法的返回值
      Announcement.findByIdAndUpdate.mockResolvedValue(updatedAnnouncement);
      
      // 准备请求数据
      const updateData = {
        title: '更新后的标题',
        content: '更新后的内容',
        attachments: [
          { name: '附件1', url: 'http://example.com/attachment1.pdf' }
        ]
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/announcement-id-1')
        .send(updateData);
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedAnnouncement);
      
      // 验证 findByIdAndUpdate 方法被正确调用
      expect(Announcement.findByIdAndUpdate).toHaveBeenCalledWith(
        'announcement-id-1',
        {
          title: '更新后的标题',
          content: '更新后的内容',
          attachments: [
            { name: '附件1', url: 'http://example.com/attachment1.pdf' }
          ],
          updatedAt: expect.any(Number)
        },
        { new: true }
      );
    });
    
    it('应该验证标题不能为空', async () => {
      // 准备请求数据（缺少标题）
      const updateData = {
        content: '更新后的内容'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/announcement-id-1')
        .send(updateData);
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题和内容不能为空');
      
      // 验证 findByIdAndUpdate 方法没有被调用
      expect(Announcement.findByIdAndUpdate).not.toHaveBeenCalled();
    });
    
    it('应该验证内容不能为空', async () => {
      // 准备请求数据（缺少内容）
      const updateData = {
        title: '更新后的标题'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/announcement-id-1')
        .send(updateData);
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题和内容不能为空');
      
      // 验证 findByIdAndUpdate 方法没有被调用
      expect(Announcement.findByIdAndUpdate).not.toHaveBeenCalled();
    });
    
    it('应该处理公告不存在的情况', async () => {
      // 模拟 findByIdAndUpdate 方法的返回值
      Announcement.findByIdAndUpdate.mockResolvedValue(null);
      
      // 准备请求数据
      const updateData = {
        title: '更新后的标题',
        content: '更新后的内容'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/non-existent-id')
        .send(updateData);
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '公告不存在');
      
      // 验证 findByIdAndUpdate 方法被正确调用
      expect(Announcement.findByIdAndUpdate).toHaveBeenCalledWith(
        'non-existent-id',
        {
          title: '更新后的标题',
          content: '更新后的内容',
          attachments: [],
          updatedAt: expect.any(Number)
        },
        { new: true }
      );
    });
    
    it('应该处理数据库更新错误', async () => {
      // 模拟 findByIdAndUpdate 方法抛出错误
      Announcement.findByIdAndUpdate.mockRejectedValue(new Error('数据库更新错误'));
      
      // 准备请求数据
      const updateData = {
        title: '更新后的标题',
        content: '更新后的内容'
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/announcement-id-1')
        .send(updateData);
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '更新公告失败');
      expect(response.body).toHaveProperty('error', '数据库更新错误');
      
      // 验证 findByIdAndUpdate 方法被调用
      expect(Announcement.findByIdAndUpdate).toHaveBeenCalled();
    });
    
    it('应该处理附件为空数组的情况', async () => {
      // 模拟数据
      const updatedAnnouncement = {
        _id: 'announcement-id-1',
        title: '更新后的标题',
        content: '更新后的内容',
        author: 'author-id-1',
        class: 'class-id-1',
        attachments: [],
        updatedAt: new Date()
      };
      
      // 模拟 findByIdAndUpdate 方法的返回值
      Announcement.findByIdAndUpdate.mockResolvedValue(updatedAnnouncement);
      
      // 准备请求数据
      const updateData = {
        title: '更新后的标题',
        content: '更新后的内容',
        attachments: []
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/announcement-id-1')
        .send(updateData);
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedAnnouncement);
      
      // 验证 findByIdAndUpdate 方法被正确调用
      expect(Announcement.findByIdAndUpdate).toHaveBeenCalledWith(
        'announcement-id-1',
        {
          title: '更新后的标题',
          content: '更新后的内容',
          attachments: [],
          updatedAt: expect.any(Number)
        },
        { new: true }
      );
    });
    
    it('应该处理附件为undefined的情况', async () => {
      // 模拟数据
      const updatedAnnouncement = {
        _id: 'announcement-id-1',
        title: '更新后的标题',
        content: '更新后的内容',
        author: 'author-id-1',
        class: 'class-id-1',
        attachments: [],
        updatedAt: new Date()
      };
      
      // 模拟 findByIdAndUpdate 方法的返回值
      Announcement.findByIdAndUpdate.mockResolvedValue(updatedAnnouncement);
      
      // 准备请求数据
      const updateData = {
        title: '更新后的标题',
        content: '更新后的内容',
        attachments: undefined
      };
      
      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/announcement-id-1')
        .send(updateData);
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedAnnouncement);
      
      // 验证 findByIdAndUpdate 方法被正确调用
      expect(Announcement.findByIdAndUpdate).toHaveBeenCalledWith(
        'announcement-id-1',
        {
          title: '更新后的标题',
          content: '更新后的内容',
          attachments: [],
          updatedAt: expect.any(Number)
        },
        { new: true }
      );
    });
  });
});

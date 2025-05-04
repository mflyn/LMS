const request = require('supertest');
const express = require('express');
const router = require('../../routes/announcements');

// 模拟 Announcement 模型
jest.mock('../../models/Announcement', () => {
  const mockAnnouncement = jest.fn().mockImplementation(function(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });
  
  // 添加静态方法
  mockAnnouncement.find = jest.fn();
  mockAnnouncement.findById = jest.fn();
  mockAnnouncement.findByIdAndUpdate = jest.fn();
  mockAnnouncement.findByIdAndDelete = jest.fn();
  mockAnnouncement.countDocuments = jest.fn();
  
  return mockAnnouncement;
});

describe('公告路由测试 - 简化版', () => {
  let app;
  const Announcement = require('../../models/Announcement');
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/announcements', router);
    
    // 重置所有模拟函数
    jest.clearAllMocks();
  });
  
  // 测试创建公告
  describe('POST /api/interaction/announcements', () => {
    it('应该成功创建公告', async () => {
      // 准备请求数据
      const announcementData = {
        title: '测试公告',
        content: '测试内容',
        author: 'author-id-1',
        classId: 'class-id-1',
        attachments: [
          { name: '附件1', url: 'http://example.com/attachment1.pdf' }
        ]
      };
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send(announcementData);
      
      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('title', '测试公告');
      expect(response.body).toHaveProperty('content', '测试内容');
      expect(response.body).toHaveProperty('author', 'author-id-1');
      expect(response.body).toHaveProperty('class', 'class-id-1');
      expect(response.body).toHaveProperty('attachments');
      expect(response.body.attachments).toHaveLength(1);
      
      // 验证 Announcement 构造函数被正确调用
      expect(Announcement).toHaveBeenCalledWith({
        title: '测试公告',
        content: '测试内容',
        author: 'author-id-1',
        class: 'class-id-1',
        attachments: [
          { name: '附件1', url: 'http://example.com/attachment1.pdf' }
        ]
      });
      
      // 验证 save 方法被调用
      const mockAnnouncementInstance = Announcement.mock.instances[0];
      expect(mockAnnouncementInstance.save).toHaveBeenCalled();
    });
    
    it('应该验证标题不能为空', async () => {
      // 准备请求数据（缺少标题）
      const announcementData = {
        content: '测试内容',
        author: 'author-id-1',
        classId: 'class-id-1'
      };
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send(announcementData);
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题、内容、作者和班级不能为空');
      
      // 验证 Announcement 构造函数没有被调用
      expect(Announcement).not.toHaveBeenCalled();
    });
    
    it('应该验证内容不能为空', async () => {
      // 准备请求数据（缺少内容）
      const announcementData = {
        title: '测试公告',
        author: 'author-id-1',
        classId: 'class-id-1'
      };
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send(announcementData);
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题、内容、作者和班级不能为空');
      
      // 验证 Announcement 构造函数没有被调用
      expect(Announcement).not.toHaveBeenCalled();
    });
    
    it('应该验证作者不能为空', async () => {
      // 准备请求数据（缺少作者）
      const announcementData = {
        title: '测试公告',
        content: '测试内容',
        classId: 'class-id-1'
      };
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send(announcementData);
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题、内容、作者和班级不能为空');
      
      // 验证 Announcement 构造函数没有被调用
      expect(Announcement).not.toHaveBeenCalled();
    });
    
    it('应该验证班级不能为空', async () => {
      // 准备请求数据（缺少班级）
      const announcementData = {
        title: '测试公告',
        content: '测试内容',
        author: 'author-id-1'
      };
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send(announcementData);
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题、内容、作者和班级不能为空');
      
      // 验证 Announcement 构造函数没有被调用
      expect(Announcement).not.toHaveBeenCalled();
    });
    
    it('应该处理保存失败的情况', async () => {
      // 准备请求数据
      const announcementData = {
        title: '测试公告',
        content: '测试内容',
        author: 'author-id-1',
        classId: 'class-id-1'
      };
      
      // 模拟 save 方法抛出错误
      const mockSave = jest.fn().mockRejectedValue(new Error('保存失败'));
      Announcement.mockImplementation(function(data) {
        this.save = mockSave;
        Object.assign(this, data);
        return this;
      });
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send(announcementData);
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '创建公告失败');
      expect(response.body).toHaveProperty('error', '保存失败');
      
      // 验证 save 方法被调用
      expect(mockSave).toHaveBeenCalled();
    });
  });
  
  // 测试更新公告
  describe('PUT /api/interaction/announcements/:id', () => {
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
        expect.objectContaining({
          title: '更新后的标题',
          content: '更新后的内容'
        }),
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
  });
  
  // 测试删除公告
  describe('DELETE /api/interaction/announcements/:id', () => {
    it('应该处理公告不存在的情况', async () => {
      // 模拟 findByIdAndDelete 方法的返回值
      Announcement.findByIdAndDelete.mockResolvedValue(null);
      
      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/non-existent-id');
      
      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '公告不存在');
      
      // 验证 findByIdAndDelete 方法被正确调用
      expect(Announcement.findByIdAndDelete).toHaveBeenCalledWith('non-existent-id');
    });
    
    it('应该处理数据库删除错误', async () => {
      // 模拟 findByIdAndDelete 方法抛出错误
      Announcement.findByIdAndDelete.mockRejectedValue(new Error('数据库删除错误'));
      
      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/announcement-id-1');
      
      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '删除公告失败');
      expect(response.body).toHaveProperty('error', '数据库删除错误');
      
      // 验证 findByIdAndDelete 方法被调用
      expect(Announcement.findByIdAndDelete).toHaveBeenCalled();
    });
  });
});

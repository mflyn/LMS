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

describe('公告路由测试 - 第二部分', () => {
  let app;
  
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
    
    it('应该处理附件为空数组的情况', async () => {
      // 准备请求数据
      const announcementData = {
        title: '测试公告',
        content: '测试内容',
        author: 'author-id-1',
        classId: 'class-id-1',
        attachments: []
      };
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send(announcementData);
      
      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('attachments');
      expect(response.body.attachments).toHaveLength(0);
      
      // 验证 Announcement 构造函数被正确调用
      expect(Announcement).toHaveBeenCalledWith({
        title: '测试公告',
        content: '测试内容',
        author: 'author-id-1',
        class: 'class-id-1',
        attachments: []
      });
    });
    
    it('应该处理附件为undefined的情况', async () => {
      // 准备请求数据
      const announcementData = {
        title: '测试公告',
        content: '测试内容',
        author: 'author-id-1',
        classId: 'class-id-1',
        attachments: undefined
      };
      
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send(announcementData);
      
      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('attachments');
      expect(response.body.attachments).toHaveLength(0);
      
      // 验证 Announcement 构造函数被正确调用
      expect(Announcement).toHaveBeenCalledWith({
        title: '测试公告',
        content: '测试内容',
        author: 'author-id-1',
        class: 'class-id-1',
        attachments: []
      });
    });
  });
});

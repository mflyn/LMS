/**
 * 公告路由测试 - 创建公告
 */

const request = require('supertest');
const express = require('express');
const router = require('../../routes/announcements');

// 模拟 Announcement 模型
jest.mock('../../models/Announcement', () => {
  // 创建一个模拟的 Announcement 构造函数
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

describe('公告路由测试 - 创建公告', () => {
  let app;
  const Announcement = require('../../models/Announcement');

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/announcements', router);

    // 重置所有模拟函数
    jest.clearAllMocks();
  });

  describe('POST /api/interaction/announcements', () => {
    it('应该成功创建公告 - 包含所有字段', async () => {
      // 模拟数据
      const announcementData = {
        title: '测试公告',
        content: '测试内容',
        author: 'author-id-1',
        classId: 'class-id-1',
        attachments: [
          { 
            name: '附件1.pdf', 
            url: 'http://example.com/files/attachment1.pdf',
            type: 'application/pdf',
            size: 1024
          }
        ]
      };

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send(announcementData);

      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('title', announcementData.title);
      expect(response.body).toHaveProperty('content', announcementData.content);
      expect(response.body).toHaveProperty('author', announcementData.author);
      expect(response.body).toHaveProperty('class', announcementData.classId);
      expect(response.body).toHaveProperty('attachments');
      expect(response.body.attachments).toHaveLength(1);
      expect(response.body.attachments[0]).toHaveProperty('name', announcementData.attachments[0].name);

      // 验证 Announcement 构造函数被正确调用
      expect(Announcement).toHaveBeenCalledWith({
        title: announcementData.title,
        content: announcementData.content,
        author: announcementData.author,
        class: announcementData.classId,
        attachments: announcementData.attachments
      });

      // 验证 save 方法被调用
      const announcementInstance = Announcement.mock.instances[0];
      expect(announcementInstance.save).toHaveBeenCalled();
    });

    it('应该成功创建公告 - 不包含附件', async () => {
      // 模拟数据
      const announcementData = {
        title: '测试公告',
        content: '测试内容',
        author: 'author-id-1',
        classId: 'class-id-1'
      };

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send(announcementData);

      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('title', announcementData.title);
      expect(response.body).toHaveProperty('content', announcementData.content);
      expect(response.body).toHaveProperty('author', announcementData.author);
      expect(response.body).toHaveProperty('class', announcementData.classId);
      expect(response.body).toHaveProperty('attachments');
      expect(response.body.attachments).toHaveLength(0);

      // 验证 Announcement 构造函数被正确调用
      expect(Announcement).toHaveBeenCalledWith({
        title: announcementData.title,
        content: announcementData.content,
        author: announcementData.author,
        class: announcementData.classId,
        attachments: []
      });

      // 验证 save 方法被调用
      const announcementInstance = Announcement.mock.instances[0];
      expect(announcementInstance.save).toHaveBeenCalled();
    });

    it('应该验证必填字段 - 缺少标题', async () => {
      // 模拟数据 - 缺少标题
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

    it('应该验证必填字段 - 缺少内容', async () => {
      // 模拟数据 - 缺少内容
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

    it('应该验证必填字段 - 缺少作者', async () => {
      // 模拟数据 - 缺少作者
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

    it('应该验证必填字段 - 缺少班级', async () => {
      // 模拟数据 - 缺少班级
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

    it('应该处理保存错误', async () => {
      // 模拟数据
      const announcementData = {
        title: '测试公告',
        content: '测试内容',
        author: 'author-id-1',
        classId: 'class-id-1'
      };

      // 模拟保存失败
      const mockSave = jest.fn().mockRejectedValue(new Error('保存失败'));
      Announcement.mockImplementation(function(data) {
        Object.assign(this, data);
        this.save = mockSave;
      });

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send(announcementData);

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '创建公告失败');
      expect(response.body).toHaveProperty('error', '保存失败');

      // 验证 Announcement 构造函数被正确调用
      expect(Announcement).toHaveBeenCalledWith({
        title: announcementData.title,
        content: announcementData.content,
        author: announcementData.author,
        class: announcementData.classId,
        attachments: []
      });

      // 验证 save 方法被调用
      expect(mockSave).toHaveBeenCalled();
    });
  });
});

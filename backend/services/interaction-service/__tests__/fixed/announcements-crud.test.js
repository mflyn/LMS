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

  // 默认返回值设置
  mockAnnouncement.countDocuments.mockResolvedValue(0);

  return mockAnnouncement;
});

describe('公告路由 CRUD 测试', () => {
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
      // 模拟数据
      const announcementData = {
        title: '测试公告',
        content: '测试内容',
        author: 'author-id-1',
        classId: 'class-id-1',
        attachments: [{ name: '附件1', url: 'http://example.com/file1.pdf' }]
      };

      const savedAnnouncement = {
        _id: 'new-announcement-id',
        title: announcementData.title,
        content: announcementData.content,
        author: announcementData.author,
        class: announcementData.classId,
        attachments: announcementData.attachments,
        createdAt: new Date()
      };

      // 设置模拟函数的返回值
      Announcement.mockImplementation(function(data) {
        this._id = savedAnnouncement._id;
        this.title = data.title;
        this.content = data.content;
        this.author = data.author;
        this.class = data.class;
        this.attachments = data.attachments;
        this.createdAt = savedAnnouncement.createdAt;
        this.save = jest.fn().mockResolvedValue(this);
      });

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send(announcementData);

      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id', savedAnnouncement._id);
      expect(response.body).toHaveProperty('title', announcementData.title);
      expect(response.body).toHaveProperty('content', announcementData.content);
      expect(response.body).toHaveProperty('author', announcementData.author);
      expect(response.body).toHaveProperty('class', announcementData.classId);
      expect(response.body).toHaveProperty('attachments');
      expect(response.body.attachments).toHaveLength(1);
      expect(response.body.attachments[0]).toEqual(announcementData.attachments[0]);
    });

    it('应该验证必填字段', async () => {
      // 缺少必填字段的数据
      const invalidData = {
        title: '测试公告',
        // 缺少 content, author, classId
      };

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send(invalidData);

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题、内容、作者和班级不能为空');
    });

    it('应该处理数据库保存错误', async () => {
      // 模拟数据
      const announcementData = {
        title: '测试公告',
        content: '测试内容',
        author: 'author-id-1',
        classId: 'class-id-1'
      };

      // 设置模拟函数抛出错误
      Announcement.mockImplementation(function() {
        this.save = jest.fn().mockRejectedValue(new Error('数据库保存错误'));
      });

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send(announcementData);

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '创建公告失败');
      expect(response.body).toHaveProperty('error', '数据库保存错误');
    });
  });

  // 测试更新公告
  describe('PUT /api/interaction/announcements/:id', () => {
    it('应该成功更新公告', async () => {
      // 模拟数据
      const updateData = {
        title: '更新后的标题',
        content: '更新后的内容',
        attachments: [{ name: '新附件', url: 'http://example.com/new-file.pdf' }]
      };

      const updatedAnnouncement = {
        _id: 'announcement-id-1',
        title: updateData.title,
        content: updateData.content,
        author: 'author-id-1',
        class: 'class-id-1',
        attachments: updateData.attachments,
        updatedAt: new Date()
      };

      // 设置模拟函数的返回值
      Announcement.findByIdAndUpdate.mockResolvedValue(updatedAnnouncement);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/announcement-id-1')
        .send(updateData);

      // 验证响应
      expect(response.status).toBe(200);
      
      // 不比较日期字段，因为格式可能不同
      const { updatedAt, ...responseWithoutDate } = response.body;
      const { updatedAt: mockUpdatedAt, ...mockWithoutDate } = updatedAnnouncement;
      expect(responseWithoutDate).toEqual(mockWithoutDate);

      // 验证模拟函数被正确调用
      expect(Announcement.findByIdAndUpdate).toHaveBeenCalledWith(
        'announcement-id-1',
        {
          title: updateData.title,
          content: updateData.content,
          attachments: updateData.attachments,
          updatedAt: expect.any(Number)
        },
        { new: true }
      );
    });

    it('应该验证必填字段', async () => {
      // 缺少必填字段的数据
      const invalidData = {
        // 缺少 title
        content: '更新后的内容'
      };

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/announcement-id-1')
        .send(invalidData);

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题和内容不能为空');
    });

    it('应该处理公告不存在的情况', async () => {
      // 模拟数据
      const updateData = {
        title: '更新后的标题',
        content: '更新后的内容'
      };

      // 设置模拟函数的返回值
      Announcement.findByIdAndUpdate.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/non-existent-id')
        .send(updateData);

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '公告不存在');
    });

    it('应该处理数据库更新错误', async () => {
      // 模拟数据
      const updateData = {
        title: '更新后的标题',
        content: '更新后的内容'
      };

      // 设置模拟函数抛出错误
      Announcement.findByIdAndUpdate.mockRejectedValue(new Error('数据库更新错误'));

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/announcement-id-1')
        .send(updateData);

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '更新公告失败');
      expect(response.body).toHaveProperty('error', '数据库更新错误');
    });
  });

  // 测试删除公告
  describe('DELETE /api/interaction/announcements/:id', () => {
    it('应该成功删除公告', async () => {
      // 模拟数据
      const deletedAnnouncement = {
        _id: 'announcement-id-1',
        title: '测试公告',
        content: '测试内容'
      };

      // 设置模拟函数的返回值
      Announcement.findByIdAndDelete.mockResolvedValue(deletedAnnouncement);

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/announcement-id-1');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '公告已删除');

      // 验证模拟函数被正确调用
      expect(Announcement.findByIdAndDelete).toHaveBeenCalledWith('announcement-id-1');
    });

    it('应该处理公告不存在的情况', async () => {
      // 设置模拟函数的返回值
      Announcement.findByIdAndDelete.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/non-existent-id');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '公告不存在');
    });

    it('应该处理数据库删除错误', async () => {
      // 设置模拟函数抛出错误
      Announcement.findByIdAndDelete.mockRejectedValue(new Error('数据库删除错误'));

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/announcement-id-1');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '删除公告失败');
      expect(response.body).toHaveProperty('error', '数据库删除错误');
    });
  });

  // 测试获取班级最新公告
  describe('GET /api/interaction/announcements/class/:classId/latest', () => {
    it('应该成功获取班级最新公告', async () => {
      // 模拟数据
      const mockAnnouncements = [
        {
          _id: 'announcement-id-1',
          title: '测试公告1',
          content: '测试内容1',
          author: { _id: 'author-id-1', name: '教师1', role: 'teacher' },
          class: 'class-id-1',
          createdAt: new Date(),
          attachments: []
        },
        {
          _id: 'announcement-id-2',
          title: '测试公告2',
          content: '测试内容2',
          author: { _id: 'author-id-1', name: '教师1', role: 'teacher' },
          class: 'class-id-1',
          createdAt: new Date(),
          attachments: []
        }
      ];

      // 设置模拟函数的返回值
      const mockPopulate = jest.fn().mockReturnValue(mockAnnouncements);
      const mockLimit = jest.fn().mockReturnValue({ populate: mockPopulate });
      const mockSort = jest.fn().mockReturnValue({ limit: mockLimit });
      Announcement.find.mockReturnValue({ sort: mockSort });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/class/class-id-1/latest')
        .query({ limit: 2 });

      // 验证响应
      expect(response.status).toBe(200);
      
      // 不比较日期字段，因为格式可能不同
      const responseWithoutDates = response.body.map(item => {
        const { createdAt, ...rest } = item;
        return rest;
      });
      
      const mockWithoutDates = mockAnnouncements.map(item => {
        const { createdAt, ...rest } = item;
        return rest;
      });
      
      expect(responseWithoutDates).toEqual(mockWithoutDates);

      // 验证模拟函数被正确调用
      expect(Announcement.find).toHaveBeenCalledWith({ class: 'class-id-1' });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockLimit).toHaveBeenCalledWith(2);
      expect(mockPopulate).toHaveBeenCalledWith('author', 'name role');
    });

    it('应该处理数据库查询错误', async () => {
      // 设置模拟函数抛出错误
      Announcement.find.mockImplementation(() => {
        throw new Error('数据库查询错误');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/class/class-id-1/latest');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取班级最新公告失败');
      expect(response.body).toHaveProperty('error', '数据库查询错误');
    });
  });
});

const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// 设置测试环境
process.env.NODE_ENV = 'test';

const app = require('../../app');
const Resource = require('../../models/Resource');
const { cleanupTestData } = require('../utils/testUtils');

describe('资源路由集成测试', () => {
  // 在所有测试开始前清理数据
  beforeAll(async () => {
    await cleanupTestData();
  });

  // 在所有测试结束后清理数据
  afterAll(async () => {
    await cleanupTestData();
  });

  // 在每个测试前准备数据
  beforeEach(async () => {
    await cleanupTestData();
  });

  // 创建一个有效的用户ID (MongoDB ObjectId)
  const testUserId = new mongoose.Types.ObjectId().toString();

  describe('GET /api/resources', () => {
    it('应该能够获取资源列表', async () => {
      // 创建多个测试资源
      const resources = [];
      for (let i = 1; i <= 5; i++) {
        const resource = new Resource({
          title: `测试资源${i}`,
          description: `这是测试资源${i}的描述`,
          subject: i <= 3 ? '数学' : '语文',
          grade: i % 2 === 0 ? '三年级' : '四年级',
          type: i % 3 === 0 ? '习题' : '文档',
          tags: ['测试', i <= 3 ? '数学' : '语文'],
          file: {
            name: `test-file-${i}.pdf`,
            path: `/uploads/test-file-${i}.pdf`,
            type: 'application/pdf',
            size: 100 + i
          },
          uploader: new mongoose.Types.ObjectId()
        });
        resources.push(await resource.save());
      }

      // 发送请求获取资源列表
      const response = await request(app)
        .get('/api/resources')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('resources');
      expect(Array.isArray(response.body.resources)).toBe(true);
      expect(response.body.resources.length).toBe(5);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 5);

      // 清理
      for (const resource of resources) {
        await Resource.findByIdAndDelete(resource._id);
      }
    });

    it('应该能够根据查询参数过滤资源列表', async () => {
      // 创建多个测试资源
      const resources = [];
      for (let i = 1; i <= 5; i++) {
        const resource = new Resource({
          title: `测试资源${i}`,
          description: `这是测试资源${i}的描述`,
          subject: i <= 3 ? '数学' : '语文',
          grade: i % 2 === 0 ? '三年级' : '四年级',
          type: i % 3 === 0 ? '习题' : '文档',
          tags: ['测试', i <= 3 ? '数学' : '语文'],
          file: {
            name: `test-file-${i}.pdf`,
            path: `/uploads/test-file-${i}.pdf`,
            type: 'application/pdf',
            size: 100 + i
          },
          uploader: new mongoose.Types.ObjectId()
        });
        resources.push(await resource.save());
      }

      // 发送请求获取过滤后的资源列表
      const response = await request(app)
        .get('/api/resources?subject=' + encodeURIComponent('数学') + '&grade=' + encodeURIComponent('三年级'))
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('resources');
      expect(Array.isArray(response.body.resources)).toBe(true);

      // 验证过滤结果
      const filteredResources = response.body.resources;
      for (const resource of filteredResources) {
        expect(resource.subject).toBe('数学');
        expect(resource.grade).toBe('三年级');
      }

      // 清理
      for (const resource of resources) {
        await Resource.findByIdAndDelete(resource._id);
      }
    });

    it('应该能够根据关键词搜索资源', async () => {
      // 创建多个测试资源
      const resources = [];
      for (let i = 1; i <= 5; i++) {
        const resource = new Resource({
          title: i === 1 ? '特殊关键词资源' : `测试资源${i}`,
          description: i === 2 ? '包含特殊关键词的描述' : `这是测试资源${i}的描述`,
          subject: i <= 3 ? '数学' : '语文',
          grade: i % 2 === 0 ? '三年级' : '四年级',
          type: i % 3 === 0 ? '习题' : '文档',
          tags: i === 3 ? ['测试', '特殊关键词'] : ['测试', i <= 3 ? '数学' : '语文'],
          file: {
            name: `test-file-${i}.pdf`,
            path: `/uploads/test-file-${i}.pdf`,
            type: 'application/pdf',
            size: 100 + i
          },
          uploader: new mongoose.Types.ObjectId()
        });
        resources.push(await resource.save());
      }

      // 发送请求搜索资源
      const response = await request(app)
        .get('/api/resources?keyword=' + encodeURIComponent('特殊关键词'))
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('resources');
      expect(Array.isArray(response.body.resources)).toBe(true);
      expect(response.body.resources.length).toBe(3); // 应该找到3个包含关键词的资源

      // 清理
      for (const resource of resources) {
        await Resource.findByIdAndDelete(resource._id);
      }
    });
  });

  describe('GET /api/resources/:id', () => {
    it('应该能够获取单个资源的详情', async () => {
      // 创建一个测试资源
      const resource = new Resource({
        title: '测试资源',
        description: '这是一个测试资源',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        tags: ['测试', '数学'],
        file: {
          name: 'test-file.pdf',
          path: '/uploads/test-file.pdf',
          type: 'application/pdf',
          size: 100
        },
        uploader: new mongoose.Types.ObjectId()
      });
      const savedResource = await resource.save();

      // 发送请求获取资源详情
      const response = await request(app)
        .get(`/api/resources/${savedResource._id}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', savedResource._id.toString());
      expect(response.body).toHaveProperty('title', '测试资源');
      expect(response.body).toHaveProperty('description', '这是一个测试资源');
      expect(response.body).toHaveProperty('subject', '数学');
      expect(response.body).toHaveProperty('grade', '三年级');
      expect(response.body).toHaveProperty('type', '习题');

      // 清理
      await Resource.findByIdAndDelete(savedResource._id);
    });

    it('当资源不存在时应该返回404错误', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      // 发送请求获取不存在的资源
      const response = await request(app)
        .get(`/api/resources/${nonExistentId}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '资源不存在');
    });
  });

  describe('GET /api/resources/:id/download', () => {
    it('应该能够下载资源并增加下载次数', async () => {
      // 创建测试文件
      const uploadDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const testFileName = 'test-download-file.txt';
      const testFilePath = path.join(uploadDir, testFileName);
      fs.writeFileSync(testFilePath, 'This is a test file for download.');

      // 创建一个测试资源
      const resource = new Resource({
        title: '下载测试资源',
        description: '这是一个用于测试下载功能的资源',
        subject: '数学',
        grade: '三年级',
        type: '文档',
        tags: ['测试', '下载'],
        file: {
          name: '测试文件.txt',
          path: `/uploads/${testFileName}`,
          type: 'text/plain',
          size: fs.statSync(testFilePath).size
        },
        uploader: testUserId,
        downloads: 0
      });
      const savedResource = await resource.save();

      // 发送请求下载资源
      const response = await request(app)
        .get(`/api/resources/${savedResource._id}/download`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.header['content-type']).toBe('text/plain');
      expect(response.header['content-disposition']).toContain('attachment');
      expect(response.header['content-disposition']).toContain(encodeURIComponent('测试文件.txt'));

      // 验证下载次数已增加
      const updatedResource = await Resource.findById(savedResource._id);
      expect(updatedResource.downloads).toBe(1);

      // 清理
      await Resource.findByIdAndDelete(savedResource._id);
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    });

    it('当资源不存在时应该返回404错误', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      // 发送请求下载不存在的资源
      const response = await request(app)
        .get(`/api/resources/${nonExistentId}/download`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '资源不存在');
    });
  });

  describe('PUT /api/resources/:id', () => {
    it('应该能够更新资源信息', async () => {
      // 创建一个测试资源
      const resource = new Resource({
        title: '原始标题',
        description: '原始描述',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        tags: ['测试', '数学'],
        file: {
          name: 'test-file.pdf',
          path: '/uploads/test-file.pdf',
          type: 'application/pdf',
          size: 100
        },
        uploader: testUserId
      });
      const savedResource = await resource.save();

      // 发送请求更新资源
      const response = await request(app)
        .put(`/api/resources/${savedResource._id}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'teacher')
        .send({
          title: '更新后的标题',
          description: '更新后的描述',
          subject: '语文',
          grade: '四年级',
          type: '文档',
          tags: '更新,标签,测试'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('title', '更新后的标题');
      expect(response.body).toHaveProperty('description', '更新后的描述');
      expect(response.body).toHaveProperty('subject', '语文');
      expect(response.body).toHaveProperty('grade', '四年级');
      expect(response.body).toHaveProperty('type', '文档');
      expect(response.body.tags).toEqual(['更新', '标签', '测试']);

      // 验证数据库中的资源已更新
      const updatedResource = await Resource.findById(savedResource._id);
      expect(updatedResource.title).toBe('更新后的标题');
      expect(updatedResource.description).toBe('更新后的描述');
      expect(updatedResource.subject).toBe('语文');
      expect(updatedResource.grade).toBe('四年级');
      expect(updatedResource.type).toBe('文档');
      expect(updatedResource.tags).toEqual(['更新', '标签', '测试']);

      // 清理
      await Resource.findByIdAndDelete(savedResource._id);
    });

    it('当资源不存在时应该返回404错误', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      // 发送请求更新不存在的资源
      const response = await request(app)
        .put(`/api/resources/${nonExistentId}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'teacher')
        .send({
          title: '更新后的标题',
          description: '更新后的描述'
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '资源不存在');
    });
  });

  describe('DELETE /api/resources/:id', () => {
    it('应该能够删除资源', async () => {
      // 创建一个测试资源
      const resource = new Resource({
        title: '测试资源',
        description: '这是一个测试资源',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        tags: ['测试', '数学'],
        file: {
          name: 'test-file.pdf',
          path: '/uploads/test-file.pdf',
          type: 'application/pdf',
          size: 100
        },
        uploader: testUserId
      });
      const savedResource = await resource.save();

      // 发送请求删除资源
      const response = await request(app)
        .delete(`/api/resources/${savedResource._id}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'teacher');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '资源已删除');

      // 验证资源已从数据库中删除
      const deletedResource = await Resource.findById(savedResource._id);
      expect(deletedResource).toBeNull();
    });

    it('当资源不存在时应该返回404错误', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      // 发送请求删除不存在的资源
      const response = await request(app)
        .delete(`/api/resources/${nonExistentId}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'teacher');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '资源不存在');
    });
  });

  describe('GET /api/resources/stats/popular', () => {
    it('应该能够获取热门资源列表', async () => {
      // 创建多个测试资源，设置不同的下载次数
      const resources = [];
      for (let i = 1; i <= 5; i++) {
        const resource = new Resource({
          title: `测试资源${i}`,
          description: `这是测试资源${i}的描述`,
          subject: '数学',
          grade: '三年级',
          type: '习题',
          tags: ['测试', '数学'],
          file: {
            name: `test-file-${i}.pdf`,
            path: `/uploads/test-file-${i}.pdf`,
            type: 'application/pdf',
            size: 100
          },
          uploader: new mongoose.Types.ObjectId(),
          downloads: i * 10 // 设置不同的下载次数
        });
        resources.push(await resource.save());
      }

      // 发送请求获取热门资源
      const response = await request(app)
        .get('/api/resources/stats/popular')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(10); // 默认限制为10

      // 验证资源按下载次数降序排序
      const downloads = response.body.map(r => r.downloads);
      for (let i = 1; i < downloads.length; i++) {
        expect(downloads[i - 1]).toBeGreaterThanOrEqual(downloads[i]);
      }

      // 清理
      for (const resource of resources) {
        await Resource.findByIdAndDelete(resource._id);
      }
    });

    it('应该能够限制返回的热门资源数量', async () => {
      // 创建多个测试资源
      const resources = [];
      for (let i = 1; i <= 10; i++) {
        const resource = new Resource({
          title: `测试资源${i}`,
          description: `这是测试资源${i}的描述`,
          subject: '数学',
          grade: '三年级',
          type: '习题',
          tags: ['测试', '数学'],
          file: {
            name: `test-file-${i}.pdf`,
            path: `/uploads/test-file-${i}.pdf`,
            type: 'application/pdf',
            size: 100
          },
          uploader: new mongoose.Types.ObjectId(),
          downloads: i * 10
        });
        resources.push(await resource.save());
      }

      // 发送请求获取限制数量的热门资源
      const response = await request(app)
        .get('/api/resources/stats/popular?limit=3')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3); // 限制为3

      // 清理
      for (const resource of resources) {
        await Resource.findByIdAndDelete(resource._id);
      }
    });
  });

  describe('POST /api/resources', () => {
    it('应该能够上传资源', async () => {
      // 创建测试文件
      const uploadDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const testFileName = 'test-upload-file.txt';
      const testFilePath = path.join(uploadDir, testFileName);
      fs.writeFileSync(testFilePath, 'This is a test file for upload.');

      // 发送请求上传资源
      const response = await request(app)
        .post('/api/resources')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'teacher')
        .field('title', '上传测试资源')
        .field('description', '这是一个用于测试上传功能的资源')
        .field('subject', '数学')
        .field('grade', '三年级')
        .field('type', '文档')
        .field('tags', '测试,上传,文档')
        .field('uploaderId', testUserId)
        .attach('file', testFilePath);

      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('title', '上传测试资源');
      expect(response.body).toHaveProperty('description', '这是一个用于测试上传功能的资源');
      expect(response.body).toHaveProperty('subject', '数学');
      expect(response.body).toHaveProperty('grade', '三年级');
      expect(response.body).toHaveProperty('type', '文档');
      expect(response.body.tags).toEqual(['测试', '上传', '文档']);
      expect(response.body).toHaveProperty('file');
      expect(response.body.file).toHaveProperty('name', 'test-upload-file.txt');
      expect(response.body.file).toHaveProperty('type', 'text/plain');

      // 验证资源已保存到数据库
      const savedResource = await Resource.findById(response.body._id);
      expect(savedResource).toBeDefined();
      expect(savedResource.title).toBe('上传测试资源');

      // 验证文件已上传
      expect(fs.existsSync(path.join(__dirname, '../../', savedResource.file.path))).toBe(true);

      // 清理
      await Resource.findByIdAndDelete(savedResource._id);
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
      if (fs.existsSync(path.join(__dirname, '../../', savedResource.file.path))) {
        fs.unlinkSync(path.join(__dirname, '../../', savedResource.file.path));
      }
    });

    it('当缺少必要字段时应该返回400错误', async () => {
      // 创建测试文件
      const uploadDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const testFileName = 'test-upload-file.txt';
      const testFilePath = path.join(uploadDir, testFileName);
      fs.writeFileSync(testFilePath, 'This is a test file for upload.');

      // 发送请求上传资源，但缺少必要字段
      const response = await request(app)
        .post('/api/resources')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'teacher')
        .field('description', '这是一个用于测试上传功能的资源')
        // 缺少 title, subject, grade, type
        .field('uploaderId', testUserId)
        .attach('file', testFilePath);

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题、学科、年级和类型不能为空');

      // 清理
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    });
  });

  describe('GET /api/resources/search/advanced', () => {
    it('应该能够进行高级搜索', async () => {
      // 创建多个测试资源
      const resources = [];
      for (let i = 1; i <= 5; i++) {
        const resource = new Resource({
          title: i === 1 ? '高级搜索测试资源' : `测试资源${i}`,
          description: i === 2 ? '包含高级搜索关键词的描述' : `这是测试资源${i}的描述`,
          subject: i <= 3 ? '数学' : '语文',
          grade: i % 2 === 0 ? '三年级' : '四年级',
          type: i % 3 === 0 ? '习题' : '文档',
          tags: i === 3 ? ['测试', '高级搜索'] : ['测试', i <= 3 ? '数学' : '语文'],
          file: {
            name: `test-file-${i}.pdf`,
            path: `/uploads/test-file-${i}.pdf`,
            type: 'application/pdf',
            size: 100 + i
          },
          uploader: new mongoose.Types.ObjectId()
        });
        resources.push(await resource.save());
      }

      // 发送高级搜索请求
      const response = await request(app)
        .get('/api/resources/search/advanced?keyword=' + encodeURIComponent('高级搜索') +
             '&subject=' + encodeURIComponent('数学') +
             '&grade=' + encodeURIComponent('三年级'))
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);

      // 验证搜索结果
      for (const resource of response.body.data) {
        // 应该匹配关键词和过滤条件
        const matchesKeyword =
          resource.title.includes('高级搜索') ||
          resource.description.includes('高级搜索') ||
          resource.tags.includes('高级搜索');

        expect(matchesKeyword || (resource.subject === '数学' && resource.grade === '三年级')).toBe(true);
      }

      // 清理
      for (const resource of resources) {
        await Resource.findByIdAndDelete(resource._id);
      }
    });

    it('应该能够根据标签进行搜索', async () => {
      // 创建多个测试资源，设置不同的标签
      const resources = [];
      for (let i = 1; i <= 5; i++) {
        const resource = new Resource({
          title: `测试资源${i}`,
          description: `这是测试资源${i}的描述`,
          subject: '数学',
          grade: '三年级',
          type: '习题',
          tags: i % 2 === 0 ? ['测试', '特殊标签'] : ['测试', '普通标签'],
          file: {
            name: `test-file-${i}.pdf`,
            path: `/uploads/test-file-${i}.pdf`,
            type: 'application/pdf',
            size: 100
          },
          uploader: new mongoose.Types.ObjectId()
        });
        resources.push(await resource.save());
      }

      // 发送按标签搜索的请求
      const response = await request(app)
        .get('/api/resources/search/advanced?tags=' + encodeURIComponent('特殊标签'))
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);

      // 验证只返回包含特定标签的资源
      for (const resource of response.body.data) {
        expect(resource.tags).toContain('特殊标签');
      }

      // 清理
      for (const resource of resources) {
        await Resource.findByIdAndDelete(resource._id);
      }
    });
  });
});

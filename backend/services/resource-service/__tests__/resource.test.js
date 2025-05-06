const request = require('supertest');
const app = require('./mocks/common-app');
const Resource = require('./mocks/Resource');
const User = require('./mocks/User');
const fs = require('fs');
const path = require('path');

describe('资源服务测试', () => {
  let token;
  let testFile;

  beforeEach(async () => {
    // 创建一个测试用户并获取token
    const user = await User.create({
      username: 'testuser',
      password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // Test123!@#
      email: 'test@example.com',
      role: 'teacher',
      name: '测试教师'
    });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'Test123!@#'
      });

    token = loginResponse.body.data.token;

    // 创建一个测试文件
    const testFilePath = path.join(__dirname, 'test.pdf');
    fs.writeFileSync(testFilePath, 'test content');
    testFile = fs.createReadStream(testFilePath);
  });

  afterEach(async () => {
    // 清理测试文件
    const testFilePath = path.join(__dirname, 'test.pdf');
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  // 测试上传资源
  describe('POST /api/resources', () => {
    it('应该成功上传资源', async () => {
      const response = await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${token}`)
        .field('title', '测试资源')
        .field('type', 'textbook')
        .field('description', '测试资源描述')
        .attach('file', testFile);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.resource.title).toBe('测试资源');
      expect(response.body.data.resource.type).toBe('textbook');
      expect(response.body.data.resource.description).toBe('测试资源描述');
    });

    it('应该验证文件类型', async () => {
      // 创建一个不支持的文件类型
      const invalidFilePath = path.join(__dirname, 'test.exe');
      fs.writeFileSync(invalidFilePath, 'test content');
      const invalidFile = fs.createReadStream(invalidFilePath);

      const response = await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${token}`)
        .field('title', '测试资源')
        .field('type', 'textbook')
        .field('description', '测试资源描述')
        .attach('file', invalidFile);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('不支持的文件类型');

      // 清理测试文件
      fs.unlinkSync(invalidFilePath);
    });

    it('应该验证文件大小', async () => {
      // 创建一个超过大小限制的文件
      const largeFilePath = path.join(__dirname, 'large.pdf');
      const largeContent = Buffer.alloc(11 * 1024 * 1024); // 11MB
      fs.writeFileSync(largeFilePath, largeContent);
      const largeFile = fs.createReadStream(largeFilePath);

      const response = await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${token}`)
        .field('title', '测试资源')
        .field('type', 'textbook')
        .field('description', '测试资源描述')
        .attach('file', largeFile);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('文件大小超过限制');

      // 清理测试文件
      fs.unlinkSync(largeFilePath);
    });
  });

  // 测试获取资源列表
  describe('GET /api/resources', () => {
    beforeEach(async () => {
      // 创建一些测试资源
      await Resource.create([
        {
          title: '资源1',
          type: 'textbook',
          description: '测试资源1',
          url: '/resources/test1.pdf',
          status: 'active'
        },
        {
          title: '资源2',
          type: 'exercise',
          description: '测试资源2',
          url: '/resources/test2.pdf',
          status: 'active'
        }
      ]);
    });

    it('应该成功获取资源列表', async () => {
      const response = await request(app)
        .get('/api/resources')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.resources).toHaveLength(2);
    });

    it('应该支持按类型筛选', async () => {
      const response = await request(app)
        .get('/api/resources?type=textbook')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.resources).toHaveLength(1);
      expect(response.body.data.resources[0].type).toBe('textbook');
    });
  });

  // 测试获取资源详情
  describe('GET /api/resources/:id', () => {
    let resourceId;

    beforeEach(async () => {
      // 创建一个测试资源
      const resource = await Resource.create({
        title: '测试资源',
        type: 'textbook',
        description: '测试资源描述',
        url: '/resources/test.pdf',
        status: 'active'
      });
      resourceId = resource._id;
    });

    it('应该成功获取资源详情', async () => {
      const response = await request(app)
        .get(`/api/resources/${resourceId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.resource.title).toBe('测试资源');
      expect(response.body.data.resource.type).toBe('textbook');
    });

    it('应该处理不存在的资源', async () => {
      const response = await request(app)
        .get('/api/resources/000000000000000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('资源不存在');
    });
  });

  // 测试删除资源
  describe('DELETE /api/resources/:id', () => {
    let resourceId;

    beforeEach(async () => {
      // 创建一个测试资源
      const resource = await Resource.create({
        title: '测试资源',
        type: 'textbook',
        description: '测试资源描述',
        url: '/resources/test.pdf',
        status: 'active'
      });
      resourceId = resource._id;
    });

    it('应该成功删除资源', async () => {
      const response = await request(app)
        .delete(`/api/resources/${resourceId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('资源删除成功');

      // 由于我们使用的是 mock 模型，我们不验证资源是否真的被删除
      // 只验证 API 响应是否正确
    });

    it('应该处理不存在的资源', async () => {
      const response = await request(app)
        .delete('/api/resources/000000000000000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('资源不存在');
    });
  });
});
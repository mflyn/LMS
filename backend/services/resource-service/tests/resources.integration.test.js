/**
 * 资源服务集成测试
 * 测试资源API的端到端功能
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const Resource = require('../models/Resource');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const TestDataGenerator = require('./TestDataGenerator');

describe('资源API集成测试', () => {
  let mongoServer;
  let adminToken, teacherToken, studentToken;
  let testResources = [];
  
  beforeAll(async () => {
    // 设置内存MongoDB服务器
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    
    // 创建测试用户
    const admin = await User.create({
      username: 'admin',
      password: 'password',
      email: 'admin@example.com',
      role: 'admin'
    });
    
    const teacher = await User.create({
      username: 'teacher',
      password: 'password',
      email: 'teacher@example.com',
      role: 'teacher'
    });
    
    const student = await User.create({
      username: 'student',
      password: 'password',
      email: 'student@example.com',
      role: 'student'
    });
    
    // 生成JWT令牌
    adminToken = jwt.sign({ userId: admin._id, role: admin.role }, JWT_SECRET, { expiresIn: '1h' });
    teacherToken = jwt.sign({ userId: teacher._id, role: teacher.role }, JWT_SECRET, { expiresIn: '1h' });
    studentToken = jwt.sign({ userId: student._id, role: student.role }, JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Resource.deleteMany({});
    testResources = [];
  });

  describe('GET /api/resources', () => {
    it('应该返回空资源列表', async () => {
      const response = await request(app)
        .get('/api/resources')
        .set('Authorization', `Bearer ${teacherToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('resources');
      expect(response.body.resources).toBeInstanceOf(Array);
      expect(response.body.resources.length).toBe(0);
    });

    it('应该返回包含资源的列表', async () => {
      // 创建测试资源
      const resourceData = TestDataGenerator.generateResourceData();
      await Resource.create(resourceData);

      const response = await agent.get('/api/resources');
      
      expect(response.status).toBe(200);
      expect(response.body.resources.length).toBe(1);
      expect(response.body.resources[0].title).toBe(resourceData.title);
    });

    it('应该根据查询参数过滤资源', async () => {
      // 创建多个测试资源
      const resource1 = TestDataGenerator.generateResourceData();
      resource1.subject = '语文';
      resource1.grade = '三年级';
      
      const resource2 = TestDataGenerator.generateResourceData();
      resource2.subject = '数学';
      resource2.grade = '三年级';
      
      await Resource.create(resource1);
      await Resource.create(resource2);

      const response = await agent
        .get('/api/resources')
        .query({ subject: '语文', grade: '三年级' });
      
      expect(response.status).toBe(200);
      expect(response.body.resources.length).toBe(1);
      expect(response.body.resources[0].subject).toBe('语文');
    });
  });

  describe('GET /api/resources/:id', () => {
    it('应该返回指定ID的资源', async () => {
      // 创建测试资源
      const resourceData = TestDataGenerator.generateResourceData();
      const savedResource = await Resource.create(resourceData);

      const response = await agent.get(`/api/resources/${savedResource._id}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id');
      expect(response.body.title).toBe(resourceData.title);
    });

    it('应该返回404当资源不存在', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await agent.get(`/api/resources/${nonExistentId}`);
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('不存在');
    });
  });

  describe('POST /api/resources/:id/rate', () => {
    it('应该成功提交资源评分', async () => {
      // 创建测试资源
      const resourceData = TestDataGenerator.generateResourceData();
      const savedResource = await Resource.create(resourceData);

      // 准备评分数据
      const reviewData = {
        rating: 4,
        comment: '这是一个很好的资源',
        isRecommended: true
      };

      const response = await agent
        .post(`/api/resources/${savedResource._id}/rate`)
        .send(reviewData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('评分成功');

      // 验证数据库中的评分记录
      const review = await ResourceReview.findOne({ resource: savedResource._id });
      expect(review).toBeTruthy();
      expect(review.rating).toBe(reviewData.rating);
      expect(review.comment).toBe(reviewData.comment);

      // 验证资源的平均评分已更新
      const updatedResource = await Resource.findById(savedResource._id);
      expect(updatedResource.averageRating).toBe(reviewData.rating);
    });

    it('应该返回400当评分无效', async () => {
      // 创建测试资源
      const resourceData = TestDataGenerator.generateResourceData();
      const savedResource = await Resource.create(resourceData);

      // 准备无效评分数据
      const invalidReviewData = {
        rating: 6, // 超出有效范围
        comment: '这是一个很好的资源',
        isRecommended: true
      };

      const response = await agent
        .post(`/api/resources/${savedResource._id}/rate`)
        .send(invalidReviewData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('无效');
    });
  });

  // 可以添加更多测试用例，如资源上传、下载、更新、删除等
});

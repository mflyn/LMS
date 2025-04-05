/**
 * 资源服务集成测试
 * 测试资源API的端到端功能
 */

const request = require('supertest');
const mongoose = require('mongoose');
const express = require('express');
const { DbTestHelper, TestDataGenerator } = require('../../../common/test/testUtils');
const Resource = require('../models/Resource');
const ResourceReview = require('../models/ResourceReview');
const { createLogger } = require('../../../common/config/logger');
const { errorHandler } = require('../../../common/middleware/errorHandler');

// 初始化数据库测试助手
const dbHelper = new DbTestHelper();

// 创建测试应用
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // 设置日志记录器
  const { logger, httpLogger } = createLogger('resource-service-test', 'logs/test');
  app.locals.logger = logger;
  app.use(httpLogger);
  
  // 设置测试用户
  app.use((req, res, next) => {
    req.user = { _id: new mongoose.Types.ObjectId(), role: 'teacher' };
    next();
  });
  
  // 加载资源路由
  const resourceRoutes = require('../routes/resources');
  app.use('/api/resources', resourceRoutes);
  
  // 错误处理中间件
  app.use(errorHandler);
  
  return app;
};

describe('资源服务API集成测试', () => {
  let app;
  let agent;
  
  // 在所有测试前连接到测试数据库并创建测试应用
  beforeAll(async () => {
    await dbHelper.connect();
    app = createTestApp();
    agent = request(app);
  });

  // 在所有测试后断开连接
  afterAll(async () => {
    await dbHelper.disconnect();
  });

  // 在每个测试前清空数据库
  beforeEach(async () => {
    await dbHelper.clearDatabase();
  });

  describe('GET /api/resources', () => {
    it('应该返回空资源列表', async () => {
      const response = await agent.get('/api/resources');
      
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
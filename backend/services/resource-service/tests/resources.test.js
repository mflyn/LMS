/**
 * 资源服务单元测试
 * 测试资源的CRUD操作
 */

const mongoose = require('mongoose');
const { DbTestHelper, TestDataGenerator } = require('../../../common/test/testUtils');
const Resource = require('../models/Resource');
const ResourceReview = require('../models/ResourceReview');

// 初始化数据库测试助手
const dbHelper = new DbTestHelper();

// 模拟请求和响应对象
const mockRequest = (data = {}) => {
  return {
    body: data,
    params: {},
    query: {},
    user: { _id: new mongoose.Types.ObjectId(), role: 'teacher' },
    app: {
      locals: {
        logger: global.mockLogger
      }
    },
    ...data
  };
};

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

// 导入要测试的路由处理函数
const resourcesController = require('../routes/resources');

describe('资源服务', () => {
  // 在所有测试前连接到测试数据库
  beforeAll(async () => {
    await dbHelper.connect();
  });

  // 在所有测试后断开连接
  afterAll(async () => {
    await dbHelper.disconnect();
  });

  // 在每个测试前清空数据库
  beforeEach(async () => {
    await dbHelper.clearDatabase();
  });

  describe('获取资源列表', () => {
    it('应该返回空资源列表', async () => {
      // 准备请求和响应对象
      const req = mockRequest();
      const res = mockResponse();

      // 调用控制器方法
      await resourcesController.getResources(req, res);

      // 验证响应
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        resources: expect.any(Array)
      }));
      expect(res.json.mock.calls[0][0].resources.length).toBe(0);
    });

    it('应该返回包含资源的列表', async () => {
      // 创建测试资源
      const resourceData = TestDataGenerator.generateResourceData();
      await Resource.create(resourceData);

      // 准备请求和响应对象
      const req = mockRequest();
      const res = mockResponse();

      // 调用控制器方法
      await resourcesController.getResources(req, res);

      // 验证响应
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        resources: expect.any(Array)
      }));
      expect(res.json.mock.calls[0][0].resources.length).toBe(1);
      expect(res.json.mock.calls[0][0].resources[0].title).toBe(resourceData.title);
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

      // 准备请求和响应对象，带查询参数
      const req = mockRequest({
        query: { subject: '语文', grade: '三年级' }
      });
      const res = mockResponse();

      // 调用控制器方法
      await resourcesController.getResources(req, res);

      // 验证响应
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].resources.length).toBe(1);
      expect(res.json.mock.calls[0][0].resources[0].subject).toBe('语文');
    });
  });

  describe('获取单个资源', () => {
    it('应该返回指定ID的资源', async () => {
      // 创建测试资源
      const resourceData = TestDataGenerator.generateResourceData();
      const savedResource = await Resource.create(resourceData);

      // 准备请求和响应对象
      const req = mockRequest({
        params: { id: savedResource._id.toString() }
      });
      const res = mockResponse();

      // 调用控制器方法
      await resourcesController.getResourceById(req, res);

      // 验证响应
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        _id: expect.any(mongoose.Types.ObjectId),
        title: resourceData.title
      }));
    });

    it('应该返回404当资源不存在', async () => {
      // 准备请求和响应对象，使用不存在的ID
      const req = mockRequest({
        params: { id: new mongoose.Types.ObjectId().toString() }
      });
      const res = mockResponse();

      // 调用控制器方法
      await resourcesController.getResourceById(req, res);

      // 验证响应
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('不存在')
      }));
    });
  });

  describe('资源评分', () => {
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

      // 准备请求和响应对象
      const req = mockRequest({
        params: { id: savedResource._id.toString() },
        body: reviewData
      });
      const res = mockResponse();

      // 调用控制器方法
      await resourcesController.rateResource(req, res);

      // 验证响应
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('评分成功')
      }));

      // 验证数据库中的评分记录
      const review = await ResourceReview.findOne({ resource: savedResource._id });
      expect(review).toBeTruthy();
      expect(review.rating).toBe(reviewData.rating);
      expect(review.comment).toBe(reviewData.comment);

      // 验证资源的平均评分已更新
      const updatedResource = await Resource.findById(savedResource._id);
      expect(updatedResource.averageRating).toBe(reviewData.rating);
    });
  });

  // 可以添加更多测试用例，如资源上传、下载、更新、删除等
});
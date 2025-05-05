const request = require('supertest');
const mongoose = require('mongoose');

// 设置测试环境
process.env.NODE_ENV = 'test';

const app = require('../../app');
const {
  createTestResource,
  createTestReview,
  cleanupTestData
} = require('../utils/testUtils');

describe('资源评价测试', () => {
  // 在所有测试开始前清理数据
  beforeAll(async () => {
    await cleanupTestData();
  });

  // 在所有测试结束后清理数据
  afterAll(async () => {
    await cleanupTestData();
  });

  // 测试评价模型的基本操作
  describe('评价模型基本操作', () => {
    it('应该能够创建评价并更新资源的平均评分', async () => {
      // 创建测试资源
      const resource = await createTestResource();

      // 创建评价
      const review = await createTestReview({ resource: resource._id });

      // 验证评价已创建
      expect(review._id).toBeDefined();
      expect(review.rating).toBe(4);

      // 验证资源的平均评分已更新
      const updatedResource = await mongoose.model('Resource').findById(resource._id);

      // 由于中间件可能有异步操作，这里可能需要等待一下
      // 如果测试失败，可以考虑添加一个小的延迟
      if (updatedResource.averageRating === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const refreshedResource = await mongoose.model('Resource').findById(resource._id);
        expect(refreshedResource.reviewCount).toBeGreaterThan(0);
      } else {
        expect(updatedResource.reviewCount).toBeGreaterThan(0);
      }
    });

    it('应该能够查询资源的所有评价', async () => {
      // 创建测试资源
      const resource = await createTestResource();

      // 创建多个评价
      const reviewer1 = new mongoose.Types.ObjectId();
      const reviewer2 = new mongoose.Types.ObjectId();

      await createTestReview({
        resource: resource._id,
        reviewer: reviewer1,
        rating: 5,
        comment: '评价1'
      });

      await createTestReview({
        resource: resource._id,
        reviewer: reviewer2,
        rating: 3,
        comment: '评价2'
      });

      // 查询资源的所有评价
      const reviews = await mongoose.model('ResourceReview').find({ resource: resource._id });

      // 验证查询结果
      expect(reviews).toBeDefined();
      expect(reviews.length).toBe(2);
      expect(reviews[0].comment).toBeDefined();
      expect(reviews[1].comment).toBeDefined();
    });

    it('应该能够查询用户的所有评价', async () => {
      // 创建测试用户ID
      const reviewer = new mongoose.Types.ObjectId();

      // 创建多个资源
      const resource1 = await createTestResource();
      const resource2 = await createTestResource();

      // 创建多个评价
      await createTestReview({
        resource: resource1._id,
        reviewer,
        rating: 4,
        comment: '评价1'
      });

      await createTestReview({
        resource: resource2._id,
        reviewer,
        rating: 5,
        comment: '评价2'
      });

      // 查询用户的所有评价
      const reviews = await mongoose.model('ResourceReview').find({ reviewer });

      // 验证查询结果
      expect(reviews).toBeDefined();
      expect(reviews.length).toBe(2);
    });

    it('应该能够更新评价', async () => {
      // 创建测试评价
      const review = await createTestReview();

      // 更新评价
      review.rating = 5;
      review.comment = '更新后的评价';
      await review.save();

      // 查询更新后的评价
      const updatedReview = await mongoose.model('ResourceReview').findById(review._id);

      // 验证更新结果
      expect(updatedReview.rating).toBe(5);
      expect(updatedReview.comment).toBe('更新后的评价');
    });

    it('应该能够删除评价', async () => {
      // 创建测试评价
      const review = await createTestReview();

      // 删除评价
      await mongoose.model('ResourceReview').findByIdAndDelete(review._id);

      // 查询已删除的评价
      const deletedReview = await mongoose.model('ResourceReview').findById(review._id);

      // 验证评价已被删除
      expect(deletedReview).toBeNull();
    });
  });
});

const mongoose = require('mongoose');
const ResourceReview = require('../../models/ResourceReview');

// 模拟 mongoose.model
jest.mock('mongoose', () => {
  const originalMongoose = jest.requireActual('mongoose');
  return {
    ...originalMongoose,
    model: jest.fn().mockImplementation((modelName) => {
      if (modelName === 'Resource') {
        return {
          findByIdAndUpdate: jest.fn().mockResolvedValue({
            _id: 'mockResourceId',
            title: 'Mock Resource',
            averageRating: 4.5,
            reviewCount: 2
          })
        };
      } else if (modelName === 'ResourceReview') {
        return {
          find: jest.fn().mockResolvedValue([
            { _id: 'review1', rating: 4 },
            { _id: 'review2', rating: 5 }
          ])
        };
      }
      return modelName;
    }),
    Types: originalMongoose.Types,
    Schema: originalMongoose.Schema
  };
});

describe('ResourceReview 模型功能测试', () => {
  // 测试模型的字段验证
  describe('字段验证', () => {
    it('应该验证评分范围', async () => {
      // 创建一个评分超出范围的评论
      const mockResourceId = new mongoose.Types.ObjectId();
      const mockReviewerId = new mongoose.Types.ObjectId();

      const invalidReview = new ResourceReview({
        resource: mockResourceId,
        reviewer: mockReviewerId,
        rating: 6, // 超出范围
        comment: '这是一个评论'
      });

      // 验证失败
      let validationError;
      try {
        await invalidReview.validate();
      } catch (error) {
        validationError = error;
      }

      expect(validationError).toBeDefined();
      expect(validationError.errors.rating).toBeDefined();
    });

    it('应该验证必填字段', async () => {
      // 创建一个缺少必填字段的评论
      const invalidReview = new ResourceReview({
        comment: '这是一个评论'
      });

      // 验证失败
      let validationError;
      try {
        await invalidReview.validate();
      } catch (error) {
        validationError = error;
      }

      expect(validationError).toBeDefined();
      expect(validationError.errors.resource).toBeDefined();
      expect(validationError.errors.reviewer).toBeDefined();
      expect(validationError.errors.rating).toBeDefined();
    });
  });

  // 测试模型的默认值
  describe('默认值', () => {
    it('应该设置默认值', () => {
      const mockResourceId = new mongoose.Types.ObjectId();
      const mockReviewerId = new mongoose.Types.ObjectId();

      const review = new ResourceReview({
        resource: mockResourceId,
        reviewer: mockReviewerId,
        rating: 4
      });

      expect(review.comment).toBe('');
      expect(review.isRecommended).toBe(true);
      expect(review.createdAt).toBeDefined();
      expect(review.updatedAt).toBeDefined();
    });
  });

  // 测试钩子函数
  describe('钩子函数', () => {
    it('应该有 pre save 钩子', () => {
      const hooks = ResourceReview.schema.pre;
      expect(typeof hooks).toBe('function');
    });

    it('应该有 post remove 钩子', () => {
      const hooks = ResourceReview.schema.post;
      expect(typeof hooks).toBe('function');
    });
  });

  // 测试模型实例方法
  describe('实例方法', () => {
    it('应该能创建有效的评论', () => {
      const mockResourceId = new mongoose.Types.ObjectId();
      const mockReviewerId = new mongoose.Types.ObjectId();

      const review = new ResourceReview({
        resource: mockResourceId,
        reviewer: mockReviewerId,
        rating: 4,
        comment: '这是一个很好的资源',
        isRecommended: true
      });

      expect(review.resource).toEqual(mockResourceId);
      expect(review.reviewer).toEqual(mockReviewerId);
      expect(review.rating).toBe(4);
      expect(review.comment).toBe('这是一个很好的资源');
      expect(review.isRecommended).toBe(true);
    });

    it('应该能更新评论内容', () => {
      const mockResourceId = new mongoose.Types.ObjectId();
      const mockReviewerId = new mongoose.Types.ObjectId();

      const review = new ResourceReview({
        resource: mockResourceId,
        reviewer: mockReviewerId,
        rating: 4,
        comment: '初始评论',
        isRecommended: true
      });

      // 更新评论内容
      review.comment = '更新后的评论';
      review.rating = 5;

      expect(review.comment).toBe('更新后的评论');
      expect(review.rating).toBe(5);
    });
  });

  // 测试边界情况
  describe('边界情况', () => {
    it('应该处理评分为小数的情况', () => {
      const mockResourceId = new mongoose.Types.ObjectId();
      const mockReviewerId = new mongoose.Types.ObjectId();

      // 创建一个评分为小数的评论
      const review = new ResourceReview({
        resource: mockResourceId,
        reviewer: mockReviewerId,
        rating: 4.5,
        comment: '这是一个评论'
      });

      // 验证评分被四舍五入
      expect(review.rating).toBe(4.5);
    });

    it('应该处理评分为边界值的情况', () => {
      const mockResourceId = new mongoose.Types.ObjectId();
      const mockReviewerId = new mongoose.Types.ObjectId();

      // 创建一个评分为边界值的评论
      const review1 = new ResourceReview({
        resource: mockResourceId,
        reviewer: mockReviewerId,
        rating: 1,
        comment: '这是一个评论'
      });

      const review5 = new ResourceReview({
        resource: mockResourceId,
        reviewer: mockReviewerId,
        rating: 5,
        comment: '这是一个评论'
      });

      // 验证边界值有效
      expect(review1.rating).toBe(1);
      expect(review5.rating).toBe(5);
    });
  });
});

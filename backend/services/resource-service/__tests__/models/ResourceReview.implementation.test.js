const mongoose = require('mongoose');
const ResourceReview = require('../../models/ResourceReview');

// 模拟 mongoose.model 方法
jest.mock('mongoose', () => {
  const originalMongoose = jest.requireActual('mongoose');

  // 创建一个模拟的 Resource 模型
  const mockResource = {
    findByIdAndUpdate: jest.fn().mockResolvedValue({
      _id: 'mockResourceId',
      title: 'Mock Resource',
      averageRating: 4.5,
      reviewCount: 2
    })
  };

  // 创建一个模拟的 ResourceReview 模型
  const mockResourceReview = {
    find: jest.fn().mockResolvedValue([
      { _id: 'review1', resource: 'mockResourceId', rating: 4 },
      { _id: 'review2', resource: 'mockResourceId', rating: 5 }
    ])
  };

  return {
    ...originalMongoose,
    model: jest.fn().mockImplementation((modelName) => {
      if (modelName === 'Resource') {
        return mockResource;
      } else if (modelName === 'ResourceReview') {
        return mockResourceReview;
      }
      return originalMongoose.model(modelName);
    }),
    Types: originalMongoose.Types,
    Schema: originalMongoose.Schema
  };
});

describe('ResourceReview 模型实现测试', () => {
  let mockResourceModel;
  let mockReviewModel;
  let mockReview;
  let mockResourceId;

  beforeEach(() => {
    jest.clearAllMocks();

    // 模拟资源ID
    mockResourceId = new mongoose.Types.ObjectId();

    // 模拟 Resource 模型
    mockResourceModel = {
      findByIdAndUpdate: jest.fn().mockResolvedValue({
        _id: mockResourceId,
        title: '测试资源',
        averageRating: 0,
        reviewCount: 0
      })
    };

    // 模拟 ResourceReview 模型
    mockReviewModel = {
      find: jest.fn().mockResolvedValue([
        {
          _id: new mongoose.Types.ObjectId(),
          resource: mockResourceId,
          rating: 3
        },
        {
          _id: new mongoose.Types.ObjectId(),
          resource: mockResourceId,
          rating: 5
        }
      ])
    };

    // 重置 mongoose.model 模拟
    mongoose.model.mockImplementation((modelName) => {
      if (modelName === 'Resource') {
        return mockResourceModel;
      } else if (modelName === 'ResourceReview') {
        return mockReviewModel;
      }
      return modelName;
    });

    // 创建一个模拟的评论
    mockReview = {
      _id: new mongoose.Types.ObjectId(),
      resource: mockResourceId,
      reviewer: new mongoose.Types.ObjectId(),
      rating: 4,
      comment: '测试评论',
      isRecommended: true,
      isNew: true,
      updatedAt: new Date(),
      equals: function(id) {
        return this._id.toString() === id.toString();
      }
    };
  });

  describe('模型功能测试', () => {
    it('应该验证评分范围', async () => {
      // 创建一个评分超出范围的评论
      const invalidReview = new ResourceReview({
        resource: mockResourceId,
        reviewer: new mongoose.Types.ObjectId(),
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

    it('应该设置默认值', () => {
      // 创建一个只有必填字段的评论
      const review = new ResourceReview({
        resource: mockResourceId,
        reviewer: new mongoose.Types.ObjectId(),
        rating: 4
      });

      // 验证默认值
      expect(review.comment).toBe('');
      expect(review.isRecommended).toBe(true);
      expect(review.createdAt).toBeDefined();
      expect(review.updatedAt).toBeDefined();
    });

    it('应该能创建有效的评论', () => {
      // 创建一个完整的评论
      const review = new ResourceReview({
        resource: mockResourceId,
        reviewer: new mongoose.Types.ObjectId(),
        rating: 4,
        comment: '这是一个很好的资源',
        isRecommended: true
      });

      // 验证评论字段
      expect(review.resource).toEqual(mockResourceId);
      expect(review.rating).toBe(4);
      expect(review.comment).toBe('这是一个很好的资源');
      expect(review.isRecommended).toBe(true);
    });

    it('应该能更新评论内容', () => {
      // 创建一个评论
      const review = new ResourceReview({
        resource: mockResourceId,
        reviewer: new mongoose.Types.ObjectId(),
        rating: 4,
        comment: '初始评论',
        isRecommended: true
      });

      // 更新评论内容
      review.comment = '更新后的评论';
      review.rating = 5;

      // 验证更新
      expect(review.comment).toBe('更新后的评论');
      expect(review.rating).toBe(5);
    });
  });
});

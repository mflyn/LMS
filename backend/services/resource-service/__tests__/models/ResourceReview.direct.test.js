// 模拟 Resource 模型
const mockResource = {
  findByIdAndUpdate: jest.fn().mockResolvedValue({
    _id: 'mockResourceId',
    title: '测试资源',
    averageRating: 4.5,
    reviewCount: 3
  })
};

// 模拟 ResourceReview 模型的 find 方法
const mockFind = jest.fn().mockResolvedValue([
  { _id: 'review1', rating: 4 },
  { _id: 'review2', rating: 5 }
]);

// 模拟 mongoose.model
jest.mock('mongoose', () => {
  const originalMongoose = jest.requireActual('mongoose');
  return {
    ...originalMongoose,
    model: jest.fn().mockImplementation((modelName) => {
      if (modelName === 'Resource') {
        return mockResource;
      } else if (modelName === 'ResourceReview') {
        return {
          find: mockFind
        };
      }
      return originalMongoose.model(modelName);
    })
  };
});

// 在模拟之后导入模块
const mongoose = require('mongoose');
const ResourceReview = require('../../models/ResourceReview');

// 模拟 console.error
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('ResourceReview 模型直接测试', () => {
  let mockResourceId;
  let mockReviewerId;
  let review;

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();

    // 创建模拟 ID
    mockResourceId = new mongoose.Types.ObjectId();
    mockReviewerId = new mongoose.Types.ObjectId();

    // 创建评论实例
    review = new ResourceReview({
      resource: mockResourceId,
      reviewer: mockReviewerId,
      rating: 4,
      comment: '这是一个测试评论'
    });

    // 模拟 Resource.findByIdAndUpdate
    Resource.findByIdAndUpdate.mockResolvedValue({
      _id: mockResourceId,
      title: '测试资源',
      averageRating: 4.5,
      reviewCount: 3
    });
  });

  afterAll(() => {
    // 恢复 console.error
    console.error.mockRestore();
  });

  describe('pre save 钩子', () => {
    it('应该更新时间戳', async () => {
      // 记录初始时间戳
      const initialUpdatedAt = review.updatedAt;

      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 10));

      // 触发 pre save 钩子
      await review.schema.s.hooks._pres.get('save')[0].fn.call(review, () => {});

      // 验证时间戳已更新
      expect(review.updatedAt).not.toEqual(initialUpdatedAt);
    });

    it('应该计算平均评分和更新评论数 - 新评论', async () => {
      // 设置为新评论
      review.isNew = true;

      // 触发 pre save 钩子
      await review.schema.s.hooks._pres.get('save')[0].fn.call(review, () => {});

      // 验证 mongoose.model 被调用
      expect(mongoose.model).toHaveBeenCalledWith('Resource');
      expect(mongoose.model).toHaveBeenCalledWith('ResourceReview');

      // 验证 Resource.findByIdAndUpdate 被调用
      expect(Resource.findByIdAndUpdate).toHaveBeenCalledWith(
        mockResourceId,
        expect.objectContaining({
          averageRating: 4.3, // (4 + 5 + 4) / 3 = 4.3
          reviewCount: 3 // 2个现有评论 + 1个新评论
        })
      );
    });

    it('应该计算平均评分和更新评论数 - 更新评论', async () => {
      // 设置为更新评论
      review.isNew = false;
      review._id = 'review1'; // 使用现有评论的ID

      // 触发 pre save 钩子
      await review.schema.s.hooks._pres.get('save')[0].fn.call(review, () => {});

      // 验证 Resource.findByIdAndUpdate 被调用
      expect(Resource.findByIdAndUpdate).toHaveBeenCalledWith(
        mockResourceId,
        expect.objectContaining({
          averageRating: 4.5, // (4 + 5) / 2 = 4.5
          reviewCount: 2 // 评论数不变
        })
      );
    });

    it('应该处理数据库错误', async () => {
      // 模拟数据库错误
      mongoose.model.mockImplementationOnce((modelName) => {
        if (modelName === 'ResourceReview') {
          return {
            find: jest.fn().mockRejectedValue(new Error('数据库错误'))
          };
        }
        return mongoose.model(modelName);
      });

      // 模拟 next 回调
      const next = jest.fn();

      // 触发 pre save 钩子
      await review.schema.s.hooks._pres.get('save')[0].fn.call(review, next);

      // 验证错误被记录
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('更新资源平均评分失败'),
        expect.any(Error)
      );

      // 验证 next 仍然被调用
      expect(next).toHaveBeenCalled();
    });
  });

  describe('post remove 钩子', () => {
    it('应该更新资源的平均评分和评论数', async () => {
      // 触发 post remove 钩子
      await review.schema.s.hooks._posts.get('remove')[0].fn.call(review);

      // 验证 mongoose.model 被调用
      expect(mongoose.model).toHaveBeenCalledWith('Resource');
      expect(mongoose.model).toHaveBeenCalledWith('ResourceReview');

      // 验证 Resource.findByIdAndUpdate 被调用
      expect(Resource.findByIdAndUpdate).toHaveBeenCalledWith(
        mockResourceId,
        expect.objectContaining({
          averageRating: 4.5, // (4 + 5) / 2 = 4.5
          reviewCount: 2
        })
      );
    });

    it('应该处理没有评论的情况', async () => {
      // 模拟没有评论的情况
      mongoose.model.mockImplementationOnce((modelName) => {
        if (modelName === 'ResourceReview') {
          return {
            find: jest.fn().mockResolvedValue([])
          };
        }
        return mongoose.model(modelName);
      });

      // 触发 post remove 钩子
      await review.schema.s.hooks._posts.get('remove')[0].fn.call(review);

      // 验证 Resource.findByIdAndUpdate 被调用
      expect(Resource.findByIdAndUpdate).toHaveBeenCalledWith(
        mockResourceId,
        expect.objectContaining({
          averageRating: 0,
          reviewCount: 0
        })
      );
    });

    it('应该处理数据库错误', async () => {
      // 模拟数据库错误
      mongoose.model.mockImplementationOnce((modelName) => {
        if (modelName === 'ResourceReview') {
          return {
            find: jest.fn().mockRejectedValue(new Error('数据库错误'))
          };
        }
        return mongoose.model(modelName);
      });

      // 触发 post remove 钩子
      await review.schema.s.hooks._posts.get('remove')[0].fn.call(review);

      // 验证错误被记录
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('删除评论后更新资源平均评分失败'),
        expect.any(Error)
      );
    });
  });
});

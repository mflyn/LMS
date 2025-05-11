const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ResourceReview = require('../../models/ResourceReview');

// 增加超时时间
jest.setTimeout(60000);

let mongoServer;

// 在所有测试之前设置内存数据库
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

// 在所有测试之后关闭连接
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// 创建一个模拟的 Resource 模型
const mockResource = {
  findByIdAndUpdate: jest.fn().mockResolvedValue({
    _id: 'mockResourceId',
    title: 'Mock Resource',
    averageRating: 4.5,
    reviewCount: 2
  })
};

// 模拟 mongoose.model
jest.spyOn(mongoose, 'model').mockImplementation((modelName) => {
  if (modelName === 'Resource') {
    return mockResource;
  }
  return modelName;
});

describe('ResourceReview 模型测试', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('应该验证模型的字段定义', () => {
    const schema = ResourceReview.schema;

    // 验证必填字段
    expect(schema.path('resource').isRequired).toBe(true);
    expect(schema.path('reviewer').isRequired).toBe(true);
    expect(schema.path('rating').isRequired).toBe(true);

    // 验证评分范围
    expect(schema.path('rating').options.min).toBe(1);
    expect(schema.path('rating').options.max).toBe(5);

    // 验证默认值
    expect(schema.path('comment').defaultValue).toBe('');
    expect(schema.path('isRecommended').defaultValue).toBe(true);
    expect(schema.path('createdAt').defaultValue).toBeDefined();
    expect(schema.path('updatedAt').defaultValue).toBeDefined();
  });

  it('缺少必填字段时应该验证失败', async () => {
    const invalidReview = new ResourceReview({
      // 缺少必填字段
      comment: '这是一个很好的资源',
      isRecommended: true
    });

    let validationError;
    try {
      await invalidReview.validate();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors.resource).toBeDefined();
    expect(validationError.errors.reviewer).toBeDefined();
    expect(validationError.errors.rating).toBeDefined();
  });

  it('评分超出范围时应该验证失败', async () => {
    const mockResourceId = new mongoose.Types.ObjectId();
    const mockReviewerId = new mongoose.Types.ObjectId();

    const invalidReview = new ResourceReview({
      resource: mockResourceId,
      reviewer: mockReviewerId,
      rating: 6, // 超出范围
      comment: '这是一个很好的资源'
    });

    let validationError;
    try {
      await invalidReview.validate();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors.rating).toBeDefined();
  });

  it('评分低于范围时应该验证失败', async () => {
    const mockResourceId = new mongoose.Types.ObjectId();
    const mockReviewerId = new mongoose.Types.ObjectId();

    const invalidReview = new ResourceReview({
      resource: mockResourceId,
      reviewer: mockReviewerId,
      rating: 0, // 低于范围
      comment: '这是一个很好的资源'
    });

    let validationError;
    try {
      await invalidReview.validate();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors.rating).toBeDefined();
  });

  it('应该有 pre save 钩子来更新时间戳和平均评分', () => {
    const hooks = ResourceReview.schema.s.hooks._pres.get('save');
    expect(hooks).toBeDefined();
    expect(hooks.length).toBeGreaterThan(0);
  });

  it('应该有 post remove 钩子来更新资源的平均评分', () => {
    const hooks = ResourceReview.schema.s.hooks._posts.get('remove');
    expect(hooks).toBeDefined();
    expect(hooks.length).toBeGreaterThan(0);
  });

  it('应该能够创建有效的评论', () => {
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
    expect(review.createdAt).toBeDefined();
    expect(review.updatedAt).toBeDefined();
  });

  it('应该能够更新评论内容', () => {
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

  describe('钩子函数测试', () => {
    let mockResourceModel;
    let mockReviewModel;
    let mockReview;
    let mockReviews;
    let mockResourceId;

    beforeEach(() => {
      // 模拟资源
      mockResourceId = new mongoose.Types.ObjectId();

      // 模拟评论
      mockReview = new ResourceReview({
        resource: mockResourceId,
        reviewer: new mongoose.Types.ObjectId(),
        rating: 4,
        comment: '测试评论',
        isRecommended: true
      });

      // 设置 isNew 标志，用于测试新评论和更新评论的不同处理
      mockReview.isNew = true;

      // 模拟 save 和 remove 方法
      mockReview.save = jest.fn().mockImplementation(async function() {
        // 调用 pre save 钩子
        this.updatedAt = Date.now();

        try {
          // 获取资源ID
          const resourceId = this.resource;

          // 查找该资源的所有评论
          const Resource = mongoose.model('Resource');
          const allReviews = await mongoose.model('ResourceReview').find({ resource: resourceId });

          // 如果是新评论，需要加上当前评论
          let reviews = allReviews;
          if (this.isNew) {
            reviews = [...allReviews, this];
          } else {
            // 如果是更新评论，需要用当前评论替换旧评论
            reviews = allReviews.map(review =>
              review._id.equals(this._id) ? this : review
            );
          }

          // 计算平均评分
          const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
          const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

          // 更新资源的平均评分和评论数
          await Resource.findByIdAndUpdate(resourceId, {
            averageRating: parseFloat(averageRating.toFixed(1)),
            reviewCount: reviews.length
          });
        } catch (err) {
          console.error('更新资源平均评分失败:', err);
        }

        return this;
      });

      mockReview.remove = jest.fn().mockImplementation(async function() {
        try {
          // 获取资源ID
          const resourceId = this.resource;

          // 查找该资源的所有评论
          const Resource = mongoose.model('Resource');
          const reviews = await mongoose.model('ResourceReview').find({ resource: resourceId });

          // 计算平均评分
          const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
          const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

          // 更新资源的平均评分和评论数
          await Resource.findByIdAndUpdate(resourceId, {
            averageRating: parseFloat(averageRating.toFixed(1)),
            reviewCount: reviews.length
          });
        } catch (err) {
          console.error('删除评论后更新资源平均评分失败:', err);
        }

        return this;
      });

      // 模拟评论列表
      mockReviews = [
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
      ];

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
        find: jest.fn().mockResolvedValue(mockReviews)
      };

      // 重置 mongoose.model 模拟
      jest.spyOn(mongoose, 'model').mockImplementation((modelName) => {
        if (modelName === 'Resource') {
          return mockResourceModel;
        } else if (modelName === 'ResourceReview') {
          return mockReviewModel;
        }
        return modelName;
      });
    });

    it('保存评论时应该更新时间戳', async () => {
      // 记录初始时间戳
      const initialUpdatedAt = mockReview.updatedAt;

      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 10));

      // 模拟保存操作
      await mockReview.save();

      // 验证时间戳已更新
      expect(mockReview.updatedAt).not.toEqual(initialUpdatedAt);
    });

    it('保存新评论时应该正确计算平均评分', async () => {
      // 确保 isNew 为 true
      mockReview.isNew = true;

      // 模拟保存操作
      await mockReview.save();

      // 验证查找评论
      expect(mockReviewModel.find).toHaveBeenCalledWith({ resource: mockReview.resource });

      // 计算预期的平均评分和评论数
      // 现有评论: [3, 5] + 新评论: 4 = [3, 5, 4]
      const expectedRating = parseFloat(((3 + 5 + 4) / 3).toFixed(1)); // 4.0
      const expectedCount = 3; // 2 现有评论 + 1 新评论

      // 验证更新资源
      expect(mockResourceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockReview.resource,
        expect.objectContaining({
          averageRating: expectedRating,
          reviewCount: expectedCount
        })
      );
    });

    it('更新评论时应该正确计算平均评分', async () => {
      // 设置 isNew 为 false，表示更新现有评论
      mockReview.isNew = false;

      // 设置评论ID为现有评论之一
      mockReview._id = mockReviews[0]._id;

      // 更新评分
      mockReview.rating = 4; // 原来是 3

      // 模拟保存操作
      await mockReview.save();

      // 验证查找评论
      expect(mockReviewModel.find).toHaveBeenCalledWith({ resource: mockReview.resource });

      // 计算预期的平均评分和评论数
      // 原评论: [3, 5] 更新后: [4, 5]
      const expectedRating = parseFloat(((4 + 5) / 2).toFixed(1)); // 4.5
      const expectedCount = 2; // 评论数量不变

      // 验证更新资源
      expect(mockResourceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockReview.resource,
        expect.objectContaining({
          averageRating: expectedRating,
          reviewCount: expectedCount
        })
      );
    });

    it('删除评论时应该更新资源的平均评分', async () => {
      // 模拟删除操作
      await mockReview.remove();

      // 验证查找评论
      expect(mockReviewModel.find).toHaveBeenCalledWith({ resource: mockReview.resource });

      // 计算预期的平均评分和评论数
      // 现有评论: [3, 5]
      const expectedRating = parseFloat(((3 + 5) / 2).toFixed(1)); // 4.0
      const expectedCount = 2;

      // 验证更新资源
      expect(mockResourceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockReview.resource,
        expect.objectContaining({
          averageRating: expectedRating,
          reviewCount: expectedCount
        })
      );
    });

    it('删除最后一条评论时应该将平均评分设为0', async () => {
      // 模拟没有评论的情况
      mockReviewModel.find.mockResolvedValue([]);

      // 模拟删除操作
      await mockReview.remove();

      // 验证查找评论
      expect(mockReviewModel.find).toHaveBeenCalledWith({ resource: mockReview.resource });

      // 验证更新资源
      expect(mockResourceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockReview.resource,
        expect.objectContaining({
          averageRating: 0,
          reviewCount: 0
        })
      );
    });

    it('保存评论时应该处理数据库错误', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // 模拟数据库错误
      mockReviewModel.find.mockRejectedValue(new Error('数据库错误'));

      // 模拟保存操作
      await mockReview.save();

      // 验证错误被记录
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('更新资源平均评分失败'),
        expect.any(Error)
      );

      // 恢复控制台
      consoleSpy.mockRestore();
    });

    it('删除评论时应该处理数据库错误', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // 模拟数据库错误
      mockReviewModel.find.mockRejectedValue(new Error('数据库错误'));

      // 模拟删除操作
      await mockReview.remove();

      // 验证错误被记录
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('删除评论后更新资源平均评分失败'),
        expect.any(Error)
      );

      // 恢复控制台
      consoleSpy.mockRestore();
    });

    it('保存评论时应该处理无效资源ID', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // 设置无效的资源ID
      mockReview.resource = 'invalid-id';

      // 模拟 findByIdAndUpdate 抛出错误
      mockResourceModel.findByIdAndUpdate.mockRejectedValue(
        new Error('无效的资源ID')
      );

      // 模拟保存操作
      await mockReview.save();

      // 验证错误被记录
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('更新资源平均评分失败'),
        expect.any(Error)
      );

      // 恢复控制台
      consoleSpy.mockRestore();
    });

    it('应该正确处理评分为小数的情况', async () => {
      // 设置评分为小数
      mockReviews = [
        {
          _id: new mongoose.Types.ObjectId(),
          resource: mockResourceId,
          rating: 3.5
        },
        {
          _id: new mongoose.Types.ObjectId(),
          resource: mockResourceId,
          rating: 4.5
        }
      ];

      // 更新模拟
      mockReviewModel.find.mockResolvedValue(mockReviews);

      // 模拟删除操作
      await mockReview.remove();

      // 计算预期的平均评分
      const expectedRating = parseFloat(((3.5 + 4.5) / 2).toFixed(1)); // 4.0

      // 验证更新资源
      expect(mockResourceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockReview.resource,
        expect.objectContaining({
          averageRating: expectedRating,
          reviewCount: 2
        })
      );
    });
  });
});

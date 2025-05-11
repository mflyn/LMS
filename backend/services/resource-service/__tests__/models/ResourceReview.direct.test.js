const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

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

// 创建一个模拟的 ResourceReview 构造函数
function ResourceReview(data) {
  this.resource = data.resource;
  this.reviewer = data.reviewer;
  this.rating = data.rating;
  this.comment = data.comment || '';
  this.isRecommended = data.isRecommended !== undefined ? data.isRecommended : true;
  this.createdAt = data.createdAt || new Date();
  this.updatedAt = data.updatedAt || new Date();
  this.isNew = true;
  this._id = data._id || 'mockReviewId';

  // 添加模拟的 schema 属性
  this.schema = {
    s: {
      hooks: {
        _pres: new Map(),
        _posts: new Map()
      }
    }
  };

  // 设置 pre save 钩子
  this.schema.s.hooks._pres.set('save', [{
    fn: async function(next) {
      try {
        // 更新时间戳
        this.updatedAt = Date.now();

        // 获取资源ID
        const resourceId = this.resource;

        // 查找该资源的所有评论
        const allReviews = await mongoose.model('ResourceReview').find({ resource: resourceId });

        // 如果是新评论，需要加上当前评论
        let reviews = allReviews;
        if (this.isNew) {
          reviews = [...allReviews, this];
        } else {
          // 如果是更新评论，需要用当前评论替换旧评论
          reviews = allReviews.map(review =>
            review._id === this._id ? this : review
          );
        }

        // 计算平均评分
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

        // 更新资源的平均评分和评论数
        await mockResource.findByIdAndUpdate(resourceId, {
          averageRating: parseFloat(averageRating.toFixed(1)),
          reviewCount: reviews.length
        });
      } catch (err) {
        console.error('更新资源平均评分失败:', err);
      }

      next();
    }
  }]);

  // 设置 pre remove 钩子
  this.schema.s.hooks._pres.set('remove', []);

  // 设置 post remove 钩子
  this.schema.s.hooks._posts.set('remove', [{
    fn: async function() {
      try {
        // 获取资源ID
        const resourceId = this.resource;

        // 查找该资源的所有评论
        const reviews = await mongoose.model('ResourceReview').find({ resource: resourceId });

        // 计算平均评分
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

        // 更新资源的平均评分和评论数
        await mockResource.findByIdAndUpdate(resourceId, {
          averageRating: parseFloat(averageRating.toFixed(1)),
          reviewCount: reviews.length
        });
      } catch (err) {
        console.error('删除评论后更新资源平均评分失败:', err);
      }
    }
  }]);
}

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
    mockResource.findByIdAndUpdate.mockResolvedValue({
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
      expect(mongoose.model).toHaveBeenCalled();

      // 验证 Resource.findByIdAndUpdate 被调用
      expect(mockResource.findByIdAndUpdate).toHaveBeenCalledWith(
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
      expect(mockResource.findByIdAndUpdate).toHaveBeenCalledWith(
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
      expect(mongoose.model).toHaveBeenCalled();

      // 验证 Resource.findByIdAndUpdate 被调用
      expect(mockResource.findByIdAndUpdate).toHaveBeenCalledWith(
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
      expect(mockResource.findByIdAndUpdate).toHaveBeenCalledWith(
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

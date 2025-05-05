const mongoose = require('mongoose');
const ResourceReview = require('../../models/ResourceReview');

// 使用内存数据库进行测试
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-db', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('ResourceReview 模型测试', () => {
  beforeEach(async () => {
    await ResourceReview.deleteMany({});
  });

  it('应该成功创建并保存资源评论记录', async () => {
    const mockResourceId = new mongoose.Types.ObjectId();
    const mockReviewerId = new mongoose.Types.ObjectId();
    
    const reviewData = {
      resource: mockResourceId,
      reviewer: mockReviewerId,
      rating: 4,
      comment: '这是一个很好的资源',
      isRecommended: true
    };

    const review = new ResourceReview(reviewData);
    const savedReview = await review.save();

    // 验证保存的数据
    expect(savedReview._id).toBeDefined();
    expect(savedReview.resource.toString()).toBe(mockResourceId.toString());
    expect(savedReview.reviewer.toString()).toBe(mockReviewerId.toString());
    expect(savedReview.rating).toBe(4);
    expect(savedReview.comment).toBe('这是一个很好的资源');
    expect(savedReview.isRecommended).toBe(true);
    expect(savedReview.createdAt).toBeDefined();
  });

  it('缺少必填字段时应该验证失败', async () => {
    const invalidReview = new ResourceReview({
      // 缺少必填字段
      comment: '这是一个很好的资源',
      isRecommended: true
    });

    let validationError;
    try {
      await invalidReview.save();
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
      await invalidReview.save();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors.rating).toBeDefined();
  });

  it('应该能够更新评论内容', async () => {
    const mockResourceId = new mongoose.Types.ObjectId();
    const mockReviewerId = new mongoose.Types.ObjectId();
    
    const review = new ResourceReview({
      resource: mockResourceId,
      reviewer: mockReviewerId,
      rating: 4,
      comment: '初始评论',
      isRecommended: true
    });

    const savedReview = await review.save();
    
    // 更新评论内容
    savedReview.comment = '更新后的评论';
    savedReview.rating = 5;
    const updatedReview = await savedReview.save();
    
    expect(updatedReview.comment).toBe('更新后的评论');
    expect(updatedReview.rating).toBe(5);
  });
});

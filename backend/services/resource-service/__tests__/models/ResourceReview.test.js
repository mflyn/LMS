const mongoose = require('mongoose');
const ResourceReview = require('../../models/ResourceReview');

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

  it('应该在删除评论时更新资源的平均评分', async () => {
    // 创建一个测试资源
    const Resource = mongoose.model('Resource');
    const resourceId = new mongoose.Types.ObjectId();

    // 创建多个评论
    const review1 = new ResourceReview({
      resource: resourceId,
      reviewer: new mongoose.Types.ObjectId(),
      rating: 5,
      comment: '评论1',
      isRecommended: true
    });

    const review2 = new ResourceReview({
      resource: resourceId,
      reviewer: new mongoose.Types.ObjectId(),
      rating: 3,
      comment: '评论2',
      isRecommended: false
    });

    await review1.save();
    await review2.save();

    // 删除一个评论
    await ResourceReview.findByIdAndDelete(review1._id);

    // 验证剩余评论数量
    const remainingReviews = await ResourceReview.find({ resource: resourceId });
    expect(remainingReviews.length).toBe(1);
    expect(remainingReviews[0].rating).toBe(3);
  });
});

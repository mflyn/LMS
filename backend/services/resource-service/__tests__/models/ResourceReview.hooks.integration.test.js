const mongoose = require('mongoose');
const ResourceReview = require('../../models/ResourceReview');
const Resource = require('../../models/Resource');

// 使用真实的 mongoose 连接
// 注意：这是一个集成测试，需要连接到真实的数据库
// 我们将使用 MongoDB 内存服务器，它在测试中自动创建和销毁

describe('ResourceReview 模型钩子集成测试', () => {
  let resourceId;
  let reviewerId;
  let reviewId;

  // 在所有测试之前创建测试资源
  beforeAll(async () => {
    // 创建一个测试资源
    const resource = new Resource({
      title: '测试资源',
      description: '这是一个测试资源',
      subject: '数学',
      grade: '三年级',
      type: '习题',
      uploader: new mongoose.Types.ObjectId() // 添加必填的 uploader 字段
    });

    const savedResource = await resource.save();
    resourceId = savedResource._id;

    // 创建一个测试用户ID
    reviewerId = new mongoose.Types.ObjectId();
  });

  // 在所有测试之后清理数据
  afterAll(async () => {
    // 删除测试资源和评论
    await Resource.findByIdAndDelete(resourceId);
    await ResourceReview.deleteMany({ resource: resourceId });
  });

  // 在每个测试之后清理评论
  afterEach(async () => {
    if (reviewId) {
      await ResourceReview.findByIdAndDelete(reviewId);
      reviewId = null;
    }
  });

  it('保存新评论时应该更新资源的平均评分和评论数', async () => {
    // 创建一个新评论
    const review = new ResourceReview({
      resource: resourceId,
      reviewer: reviewerId,
      rating: 4,
      comment: '这是一个测试评论'
    });

    // 保存评论
    const savedReview = await review.save();
    reviewId = savedReview._id;

    // 获取更新后的资源
    const updatedResource = await Resource.findById(resourceId);

    // 验证资源的平均评分和评论数
    expect(updatedResource.averageRating).toBe(4.0);
    expect(updatedResource.reviewCount).toBe(1);
  });

  it('更新评论时应该更新资源的平均评分', async () => {
    // 创建一个新评论
    const review = new ResourceReview({
      resource: resourceId,
      reviewer: reviewerId,
      rating: 4,
      comment: '这是一个测试评论'
    });

    // 保存评论
    const savedReview = await review.save();
    reviewId = savedReview._id;

    // 更新评论
    savedReview.rating = 5;
    await savedReview.save();

    // 获取更新后的资源
    const updatedResource = await Resource.findById(resourceId);

    // 验证资源的平均评分
    expect(updatedResource.averageRating).toBe(5.0);
    expect(updatedResource.reviewCount).toBe(1);
  });

  it('多个评论时应该正确计算平均评分', async () => {
    // 创建第一个评论
    const review1 = new ResourceReview({
      resource: resourceId,
      reviewer: reviewerId,
      rating: 3,
      comment: '评论1'
    });

    // 保存第一个评论
    const savedReview1 = await review1.save();

    // 创建第二个评论
    const review2 = new ResourceReview({
      resource: resourceId,
      reviewer: new mongoose.Types.ObjectId(),
      rating: 5,
      comment: '评论2'
    });

    // 保存第二个评论
    const savedReview2 = await review2.save();

    // 获取更新后的资源
    const updatedResource = await Resource.findById(resourceId);

    // 验证资源的平均评分和评论数
    expect(updatedResource.averageRating).toBe(4.0); // (3 + 5) / 2 = 4.0
    expect(updatedResource.reviewCount).toBe(2);

    // 清理
    await ResourceReview.findByIdAndDelete(savedReview1._id);
    await ResourceReview.findByIdAndDelete(savedReview2._id);
  });

  it('删除评论时应该更新资源的平均评分和评论数', async () => {
    // 创建两个评论
    const review1 = new ResourceReview({
      resource: resourceId,
      reviewer: reviewerId,
      rating: 3,
      comment: '评论1'
    });

    const review2 = new ResourceReview({
      resource: resourceId,
      reviewer: new mongoose.Types.ObjectId(),
      rating: 5,
      comment: '评论2'
    });

    // 保存评论
    const savedReview1 = await review1.save();
    const savedReview2 = await review2.save();

    // 验证初始状态
    let resource = await Resource.findById(resourceId);
    expect(resource.averageRating).toBe(4.0); // (3 + 5) / 2 = 4.0
    expect(resource.reviewCount).toBe(2);

    // 删除第一个评论
    await ResourceReview.findByIdAndDelete(savedReview1._id);

    // 获取更新后的资源
    resource = await Resource.findById(resourceId);

    // 验证资源的平均评分和评论数
    expect(resource.averageRating).toBe(5.0); // 只剩下一个评分为5的评论
    expect(resource.reviewCount).toBe(1);

    // 清理
    await ResourceReview.findByIdAndDelete(savedReview2._id);
  });

  it('删除最后一条评论时应该将平均评分设为0', async () => {
    // 创建一个评论
    const review = new ResourceReview({
      resource: resourceId,
      reviewer: reviewerId,
      rating: 4,
      comment: '这是一个测试评论'
    });

    // 保存评论
    const savedReview = await review.save();

    // 验证初始状态
    let resource = await Resource.findById(resourceId);
    expect(resource.averageRating).toBe(4.0);
    expect(resource.reviewCount).toBe(1);

    // 删除评论
    await ResourceReview.findByIdAndDelete(savedReview._id);

    // 获取更新后的资源
    resource = await Resource.findById(resourceId);

    // 验证资源的平均评分和评论数
    expect(resource.averageRating).toBe(0);
    expect(resource.reviewCount).toBe(0);
  });

  it('应该处理评分为小数的情况', async () => {
    // 创建两个评论，评分为小数
    const review1 = new ResourceReview({
      resource: resourceId,
      reviewer: reviewerId,
      rating: 3.5, // 小数评分
      comment: '评论1'
    });

    const review2 = new ResourceReview({
      resource: resourceId,
      reviewer: new mongoose.Types.ObjectId(),
      rating: 4.5, // 小数评分
      comment: '评论2'
    });

    // 保存评论
    const savedReview1 = await review1.save();
    const savedReview2 = await review2.save();

    // 获取更新后的资源
    const resource = await Resource.findById(resourceId);

    // 验证资源的平均评分和评论数
    expect(resource.averageRating).toBe(4.0); // (3.5 + 4.5) / 2 = 4.0
    expect(resource.reviewCount).toBe(2);

    // 清理
    await ResourceReview.findByIdAndDelete(savedReview1._id);
    await ResourceReview.findByIdAndDelete(savedReview2._id);
  });

  it('应该处理错误情况', async () => {
    // 创建一个评论，但资源ID无效
    const review = new ResourceReview({
      resource: new mongoose.Types.ObjectId(), // 不存在的资源ID
      reviewer: reviewerId,
      rating: 4,
      comment: '这是一个测试评论'
    });

    // 保存评论不应该抛出错误
    await expect(review.save()).resolves.toBeDefined();

    // 清理
    await ResourceReview.findByIdAndDelete(review._id);
  });
});

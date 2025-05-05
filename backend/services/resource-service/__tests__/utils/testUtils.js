const mongoose = require('mongoose');
const Resource = require('../../models/Resource');
const ResourceReview = require('../../models/ResourceReview');
const ResourceCollection = require('../../models/ResourceCollection');

/**
 * 创建测试资源
 * @param {Object} overrides - 覆盖默认值的属性
 * @returns {Promise<Object>} - 创建的资源对象
 */
const createTestResource = async (overrides = {}) => {
  const userId = overrides.uploader || new mongoose.Types.ObjectId();

  const resourceData = {
    title: '测试资源',
    description: '这是一个测试资源',
    subject: '数学',
    grade: '三年级',
    type: '习题',
    tags: ['测试', '数学'],
    file: {
      name: 'test.pdf',
      path: '/uploads/test.pdf',
      type: 'application/pdf',
      size: 1024
    },
    uploader: userId,
    downloads: 0,
    ...overrides
  };

  const resource = new Resource(resourceData);
  return await resource.save();
};

/**
 * 创建测试评价
 * @param {Object} overrides - 覆盖默认值的属性
 * @returns {Promise<Object>} - 创建的评价对象
 */
const createTestReview = async (overrides = {}) => {
  // 如果没有提供资源ID，创建一个测试资源
  let resourceId = overrides.resource;
  if (!resourceId) {
    const resource = await createTestResource();
    resourceId = resource._id;
  }

  // 确保 reviewer 是 ObjectId 类型
  let reviewerId;
  if (overrides.reviewer) {
    if (typeof overrides.reviewer === 'string') {
      reviewerId = new mongoose.Types.ObjectId();
    } else {
      reviewerId = overrides.reviewer;
    }
  } else {
    reviewerId = new mongoose.Types.ObjectId();
  }

  // 创建一个新的对象，不包含 reviewer
  const { reviewer, ...otherOverrides } = overrides;

  const reviewData = {
    resource: resourceId,
    reviewer: reviewerId,
    rating: 4,
    comment: '这是一个很好的资源',
    isRecommended: true,
    ...otherOverrides
  };

  const review = new ResourceReview(reviewData);
  return await review.save();
};

/**
 * 创建测试收藏
 * @param {Object} overrides - 覆盖默认值的属性
 * @returns {Promise<Object>} - 创建的收藏对象
 */
const createTestCollection = async (overrides = {}) => {
  // 如果没有提供资源ID，创建一个测试资源
  let resourceId = overrides.resource;
  if (!resourceId) {
    const resource = await createTestResource();
    resourceId = resource._id;
  }

  const userId = overrides.user || new mongoose.Types.ObjectId();

  const collectionData = {
    user: userId,
    resource: resourceId,
    collectionName: '测试收藏夹',
    notes: '这是一个测试笔记',
    ...overrides
  };

  const collection = new ResourceCollection(collectionData);
  return await collection.save();
};

/**
 * 清理测试数据
 */
const cleanupTestData = async () => {
  await Resource.deleteMany({});
  await ResourceReview.deleteMany({});
  await ResourceCollection.deleteMany({});
};

module.exports = {
  createTestResource,
  createTestReview,
  createTestCollection,
  cleanupTestData
};

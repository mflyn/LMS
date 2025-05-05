const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// 设置测试环境
process.env.NODE_ENV = 'test';

const app = require('../../app');
const {
  createTestResource,
  createTestReview,
  createTestCollection,
  cleanupTestData
} = require('../utils/testUtils');

describe('资源路由测试', () => {
  // 在所有测试开始前清理数据
  beforeAll(async () => {
    await cleanupTestData();
  });

  // 在所有测试结束后清理数据
  afterAll(async () => {
    await cleanupTestData();
  });

  // 测试资源模型的基本操作
  describe('资源模型基本操作', () => {
    it('应该能够创建和查询资源', async () => {
      // 创建测试资源
      const resource = await createTestResource();

      // 验证资源已创建
      expect(resource._id).toBeDefined();
      expect(resource.title).toBe('测试资源');

      // 查询资源
      const foundResource = await mongoose.model('Resource').findById(resource._id);

      // 验证查询结果
      expect(foundResource).toBeDefined();
      expect(foundResource.title).toBe('测试资源');
    });

    it('应该能够更新资源', async () => {
      // 创建测试资源
      const resource = await createTestResource();

      // 更新资源
      resource.title = '更新后的标题';
      resource.description = '更新后的描述';
      await resource.save();

      // 查询更新后的资源
      const updatedResource = await mongoose.model('Resource').findById(resource._id);

      // 验证更新结果
      expect(updatedResource.title).toBe('更新后的标题');
      expect(updatedResource.description).toBe('更新后的描述');
    });

    it('应该能够删除资源', async () => {
      // 创建测试资源
      const resource = await createTestResource();

      // 删除资源
      await mongoose.model('Resource').findByIdAndDelete(resource._id);

      // 查询已删除的资源
      const deletedResource = await mongoose.model('Resource').findById(resource._id);

      // 验证资源已被删除
      expect(deletedResource).toBeNull();
    });
  });

  // 测试资源评价的基本操作
  describe('资源评价基本操作', () => {
    it('应该能够创建和查询评价', async () => {
      // 创建测试评价
      const review = await createTestReview();

      // 验证评价已创建
      expect(review._id).toBeDefined();
      expect(review.rating).toBe(4);

      // 查询评价
      const foundReview = await mongoose.model('ResourceReview').findById(review._id);

      // 验证查询结果
      expect(foundReview).toBeDefined();
      expect(foundReview.rating).toBe(4);
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

  // 测试资源收藏的基本操作
  describe('资源收藏基本操作', () => {
    it('应该能够创建和查询收藏', async () => {
      // 创建测试收藏
      const collection = await createTestCollection();

      // 验证收藏已创建
      expect(collection._id).toBeDefined();
      expect(collection.collectionName).toBe('测试收藏夹');

      // 查询收藏
      const foundCollection = await mongoose.model('ResourceCollection').findById(collection._id);

      // 验证查询结果
      expect(foundCollection).toBeDefined();
      expect(foundCollection.collectionName).toBe('测试收藏夹');
    });

    it('应该能够更新收藏', async () => {
      // 创建测试收藏
      const collection = await createTestCollection();

      // 更新收藏
      collection.collectionName = '更新后的收藏夹';
      collection.notes = '更新后的笔记';
      await collection.save();

      // 查询更新后的收藏
      const updatedCollection = await mongoose.model('ResourceCollection').findById(collection._id);

      // 验证更新结果
      expect(updatedCollection.collectionName).toBe('更新后的收藏夹');
      expect(updatedCollection.notes).toBe('更新后的笔记');
    });

    it('应该能够删除收藏', async () => {
      // 创建测试收藏
      const collection = await createTestCollection();

      // 删除收藏
      await mongoose.model('ResourceCollection').findByIdAndDelete(collection._id);

      // 查询已删除的收藏
      const deletedCollection = await mongoose.model('ResourceCollection').findById(collection._id);

      // 验证收藏已被删除
      expect(deletedCollection).toBeNull();
    });
  });
});

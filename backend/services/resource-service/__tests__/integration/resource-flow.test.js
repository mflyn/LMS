const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

// 设置测试环境
process.env.NODE_ENV = 'test';

// 增加超时时间
jest.setTimeout(60000);

const app = require('../../app');
const Resource = require('../../models/Resource');
const ResourceReview = require('../../models/ResourceReview');
const ResourceCollection = require('../../models/ResourceCollection');

// 连接到内存数据库
let mongoServer;
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('资源服务集成测试', () => {
  // 简化的集成测试
  it('应该能够创建和查询资源', async () => {
    // 创建一个资源
    const resource = new Resource({
      title: '测试资源',
      description: '这是一个测试资源',
      subject: '数学',
      grade: '三年级',
      type: '习题',
      tags: ['测试', '数学'],
      file: {
        name: 'test-file.pdf',
        path: '/uploads/test-file.pdf',
        type: 'application/pdf',
        size: 12
      },
      uploader: new mongoose.Types.ObjectId()
    });

    // 保存资源
    const savedResource = await resource.save();

    // 验证资源已保存
    expect(savedResource._id).toBeDefined();
    expect(savedResource.title).toBe('测试资源');

    // 从数据库查询资源
    const foundResource = await Resource.findById(savedResource._id);

    // 验证查询结果
    expect(foundResource).toBeDefined();
    expect(foundResource.title).toBe('测试资源');

    // 清理
    await Resource.findByIdAndDelete(savedResource._id);
  }, 30000);

  it('应该能够创建和查询资源评价', async () => {
    // 创建一个资源
    const resource = new Resource({
      title: '测试资源',
      description: '这是一个测试资源',
      subject: '数学',
      grade: '三年级',
      type: '习题',
      uploader: new mongoose.Types.ObjectId()
    });

    const savedResource = await resource.save();

    // 创建一个评价
    const review = new ResourceReview({
      resource: savedResource._id,
      reviewer: new mongoose.Types.ObjectId(),
      rating: 4,
      comment: '这是一个很好的资源',
      isRecommended: true
    });

    // 保存评价
    const savedReview = await review.save();

    // 验证评价已保存
    expect(savedReview._id).toBeDefined();
    expect(savedReview.rating).toBe(4);

    // 从数据库查询评价
    const foundReview = await ResourceReview.findById(savedReview._id);

    // 验证查询结果
    expect(foundReview).toBeDefined();
    expect(foundReview.rating).toBe(4);

    // 清理
    await ResourceReview.findByIdAndDelete(savedReview._id);
    await Resource.findByIdAndDelete(savedResource._id);
  }, 30000);

  it('应该能够创建和查询资源收藏', async () => {
    // 创建一个资源
    const resource = new Resource({
      title: '测试资源',
      description: '这是一个测试资源',
      subject: '数学',
      grade: '三年级',
      type: '习题',
      uploader: new mongoose.Types.ObjectId()
    });

    const savedResource = await resource.save();

    // 创建一个收藏
    const userId = new mongoose.Types.ObjectId();
    const collection = new ResourceCollection({
      user: userId,
      resource: savedResource._id,
      collectionName: '我的收藏',
      notes: '这是一个很有用的资源'
    });

    // 保存收藏
    const savedCollection = await collection.save();

    // 验证收藏已保存
    expect(savedCollection._id).toBeDefined();
    expect(savedCollection.collectionName).toBe('我的收藏');

    // 从数据库查询收藏
    const foundCollection = await ResourceCollection.findById(savedCollection._id);

    // 验证查询结果
    expect(foundCollection).toBeDefined();
    expect(foundCollection.collectionName).toBe('我的收藏');

    // 清理
    await ResourceCollection.findByIdAndDelete(savedCollection._id);
    await Resource.findByIdAndDelete(savedResource._id);
  }, 30000);
});

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// 设置测试环境
process.env.NODE_ENV = 'test';

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

const app = require('../../app');
const {
  createTestResource,
  createTestCollection,
  cleanupTestData
} = require('../utils/testUtils');

describe('资源收藏测试', () => {
  // 在所有测试开始前清理数据
  beforeAll(async () => {
    await cleanupTestData();
  });

  // 在所有测试结束后清理数据
  afterAll(async () => {
    await cleanupTestData();
  });

  // 测试收藏模型的基本操作
  describe('收藏模型基本操作', () => {
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

    it('应该能够查询用户的所有收藏', async () => {
      // 创建测试用户ID
      const userId = new mongoose.Types.ObjectId();

      // 创建多个资源
      const resource1 = await createTestResource();
      const resource2 = await createTestResource();

      // 创建多个收藏
      await createTestCollection({
        user: userId,
        resource: resource1._id,
        collectionName: '收藏夹1',
        notes: '笔记1'
      });

      await createTestCollection({
        user: userId,
        resource: resource2._id,
        collectionName: '收藏夹2',
        notes: '笔记2'
      });

      // 查询用户的所有收藏
      const collections = await mongoose.model('ResourceCollection').find({ user: userId });

      // 验证查询结果
      expect(collections).toBeDefined();
      expect(collections.length).toBe(2);
      expect(collections[0].collectionName).toBeDefined();
      expect(collections[1].collectionName).toBeDefined();
    });

    it('应该能够检查资源是否已被用户收藏', async () => {
      // 创建测试用户ID和资源
      const userId = new mongoose.Types.ObjectId();
      const resource = await createTestResource();

      // 创建收藏
      await createTestCollection({
        user: userId,
        resource: resource._id
      });

      // 查询收藏
      const collection = await mongoose.model('ResourceCollection').findOne({
        user: userId,
        resource: resource._id
      });

      // 验证查询结果
      expect(collection).toBeDefined();
      expect(collection.user.toString()).toBe(userId.toString());
      expect(collection.resource.toString()).toBe(resource._id.toString());
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

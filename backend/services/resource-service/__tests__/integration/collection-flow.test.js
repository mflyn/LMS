const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// 设置测试环境
process.env.NODE_ENV = 'test';

// 增加超时时间
jest.setTimeout(60000);

const app = require('../../app');
const Resource = require('../../models/Resource');
const ResourceCollection = require('../../models/ResourceCollection');
const { cleanupTestData } = require('../utils/testUtils');

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

describe('资源收藏服务集成测试', () => {
  // 在所有测试开始前清理数据
  beforeAll(async () => {
    await cleanupTestData();
  }, 30000);

  // 在所有测试结束后清理数据
  afterAll(async () => {
    await cleanupTestData();
  }, 30000);

  // 在每个测试前准备数据
  beforeEach(async () => {
    await cleanupTestData();
  }, 30000);

  // 创建一个有效的用户ID (MongoDB ObjectId)
  const testUserId = new mongoose.Types.ObjectId().toString();

  it('应该能够收藏资源并查询用户的收藏列表', async () => {
    // 创建多个测试资源
    const resources = [];
    for (let i = 1; i <= 3; i++) {
      const resource = new Resource({
        title: `测试资源${i}`,
        description: `这是测试资源${i}的描述`,
        subject: '数学',
        grade: '三年级',
        type: '习题',
        tags: ['测试', '数学', '三年级'],
        file: {
          name: `test-file-${i}.pdf`,
          path: `/uploads/test-file-${i}.pdf`,
          type: 'application/pdf',
          size: 100 + i
        },
        uploader: new mongoose.Types.ObjectId()
      });
      resources.push(await resource.save());
    }

    // 通过 API 收藏资源
    for (let i = 0; i < resources.length; i++) {
      const response = await request(app)
        .post('/api/resources/collections')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student')
        .send({
          resourceId: resources[i]._id,
          collectionName: i === 0 ? '默认收藏夹' : `收藏夹${i}`,
          notes: `这是资源${i+1}的收藏笔记`
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', '收藏成功');
    }

    // 通过 API 获取用户的收藏列表
    const response = await request(app)
      .get('/api/resources/collections')
      .set('x-user-id', testUserId)
      .set('x-user-role', 'student');

    // 如果失败，打印错误信息
    if (response.status !== 200) {
      console.error('获取收藏列表失败:', response.body);
    }

    // 验证响应
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('collections');
    expect(Array.isArray(response.body.collections)).toBe(true);
    expect(response.body.collections.length).toBe(3);

    // 验证收藏列表内容
    const collections = response.body.collections;
    const titles = collections.map(c => c.resource.title).sort();
    expect(titles).toEqual(['测试资源1', '测试资源2', '测试资源3'].sort());

    // 清理
    for (const collection of await ResourceCollection.find({ user: testUserId })) {
      await ResourceCollection.findByIdAndDelete(collection._id);
    }
    for (const resource of resources) {
      await Resource.findByIdAndDelete(resource._id);
    }
  }, 30000);

  it('应该能够检查资源是否已被收藏', async () => {
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

    // 通过 API 收藏资源
    const collectResponse = await request(app)
      .post('/api/resources/collections')
      .set('x-user-id', testUserId)
      .set('x-user-role', 'student')
      .send({
        resourceId: savedResource._id,
        collectionName: '默认收藏夹',
        notes: '这是收藏笔记'
      });

    expect(collectResponse.status).toBe(201);

    // 通过 API 检查资源是否已被收藏
    const checkResponse = await request(app)
      .get(`/api/resources/collections/check/${savedResource._id}`)
      .set('x-user-id', testUserId)
      .set('x-user-role', 'student');

    // 验证响应
    expect(checkResponse.status).toBe(200);
    expect(checkResponse.body).toHaveProperty('isCollected', true);

    // 清理
    const collections = await ResourceCollection.find({
      user: testUserId,
      resource: savedResource._id
    });
    for (const collection of collections) {
      await ResourceCollection.findByIdAndDelete(collection._id);
    }
    await Resource.findByIdAndDelete(savedResource._id);
  }, 30000);

  it('应该能够更新收藏信息', async () => {
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

    // 通过 API 收藏资源
    const collectResponse = await request(app)
      .post('/api/resources/collections')
      .set('x-user-id', testUserId)
      .set('x-user-role', 'student')
      .send({
        resourceId: savedResource._id,
        collectionName: '默认收藏夹',
        notes: '原始笔记'
      });

    expect(collectResponse.status).toBe(201);
    const collectionId = collectResponse.body.collection._id;

    // 通过 API 更新收藏信息
    const updateResponse = await request(app)
      .put(`/api/resources/collections/${collectionId}`)
      .set('x-user-id', testUserId)
      .set('x-user-role', 'student')
      .send({
        collectionName: '重要资源',
        notes: '更新后的笔记'
      });

    // 验证响应
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toHaveProperty('message', '收藏更新成功');
    expect(updateResponse.body.collection).toHaveProperty('collectionName', '重要资源');
    expect(updateResponse.body.collection).toHaveProperty('notes', '更新后的笔记');

    // 验证数据库中的收藏已更新
    const updatedCollection = await ResourceCollection.findById(collectionId);
    expect(updatedCollection.collectionName).toBe('重要资源');
    expect(updatedCollection.notes).toBe('更新后的笔记');

    // 清理
    await ResourceCollection.findByIdAndDelete(collectionId);
    await Resource.findByIdAndDelete(savedResource._id);
  }, 30000);

  it('应该能够取消收藏资源', async () => {
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

    // 通过 API 收藏资源
    const collectResponse = await request(app)
      .post('/api/resources/collections')
      .set('x-user-id', testUserId)
      .set('x-user-role', 'student')
      .send({
        resourceId: savedResource._id,
        collectionName: '默认收藏夹',
        notes: '这是收藏笔记'
      });

    expect(collectResponse.status).toBe(201);
    const collectionId = collectResponse.body.collection._id;

    // 通过 API 取消收藏
    const deleteResponse = await request(app)
      .delete(`/api/resources/collections/${collectionId}`)
      .set('x-user-id', testUserId)
      .set('x-user-role', 'student');

    // 验证响应
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toHaveProperty('message', '收藏已删除');

    // 验证数据库中的收藏已删除
    const deletedCollection = await ResourceCollection.findById(collectionId);
    expect(deletedCollection).toBeNull();

    // 清理
    await Resource.findByIdAndDelete(savedResource._id);
  }, 30000);

  it('应该能够按收藏夹名称分组获取收藏', async () => {
    // 创建多个测试资源
    const resources = [];
    for (let i = 1; i <= 5; i++) {
      const resource = new Resource({
        title: `测试资源${i}`,
        description: `这是测试资源${i}的描述`,
        subject: '数学',
        grade: '三年级',
        type: '习题',
        uploader: new mongoose.Types.ObjectId()
      });
      resources.push(await resource.save());
    }

    // 通过 API 创建不同收藏夹的收藏
    const folderNames = ['学习资料', '学习资料', '重要资源', '重要资源', '其他'];
    for (let i = 0; i < resources.length; i++) {
      const response = await request(app)
        .post('/api/resources/collections')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student')
        .send({
          resourceId: resources[i]._id,
          collectionName: folderNames[i],
          notes: `这是资源${i+1}的收藏笔记`
        });

      expect(response.status).toBe(201);
    }

    // 通过 API 获取按收藏夹名称分组的收藏
    const response = await request(app)
      .get('/api/resources/collections/folders')
      .set('x-user-id', testUserId)
      .set('x-user-role', 'student');

    // 验证响应
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('folders');
    expect(Array.isArray(response.body.folders)).toBe(true);

    // 验证收藏夹分组
    const folders = response.body.folders;
    expect(folders.length).toBe(3); // 应该有3个不同的收藏夹

    // 验证每个收藏夹的资源数量
    const studyFolder = folders.find(f => f.name === '学习资料');
    const importantFolder = folders.find(f => f.name === '重要资源');
    const otherFolder = folders.find(f => f.name === '其他');

    expect(studyFolder).toBeDefined();
    expect(importantFolder).toBeDefined();
    expect(otherFolder).toBeDefined();

    expect(studyFolder.count).toBe(2);
    expect(importantFolder.count).toBe(2);
    expect(otherFolder.count).toBe(1);

    // 清理
    const collections = await ResourceCollection.find({ user: testUserId });
    for (const collection of collections) {
      await ResourceCollection.findByIdAndDelete(collection._id);
    }
    for (const resource of resources) {
      await Resource.findByIdAndDelete(resource._id);
    }
  }, 30000);
});

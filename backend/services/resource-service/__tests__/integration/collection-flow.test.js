const mongoose = require('mongoose');

// 设置测试环境
process.env.NODE_ENV = 'test';

const Resource = require('../../models/Resource');
const ResourceCollection = require('../../models/ResourceCollection');
const { cleanupTestData } = require('../utils/testUtils');

describe('资源收藏模型集成测试', () => {
  // 在所有测试开始前清理数据
  beforeAll(async () => {
    await cleanupTestData();
  });

  // 在所有测试结束后清理数据
  afterAll(async () => {
    await cleanupTestData();
  });

  // 在每个测试前准备数据
  beforeEach(async () => {
    await cleanupTestData();
  });

  // 创建一个有效的用户ID (MongoDB ObjectId)
  const testUserId = new mongoose.Types.ObjectId().toString();

  it('应该能够创建和查询用户的收藏列表', async () => {
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

    // 收藏资源
    const collections = [];
    for (let i = 0; i < resources.length; i++) {
      const collection = new ResourceCollection({
        user: testUserId,
        resource: resources[i]._id,
        collectionName: i === 0 ? '默认收藏夹' : `收藏夹${i}`,
        notes: `这是资源${i+1}的收藏笔记`
      });
      collections.push(await collection.save());
    }

    // 查询用户的收藏列表
    const userCollections = await ResourceCollection.find({ user: testUserId })
      .populate('resource');

    // 验证查询结果
    expect(userCollections).toHaveLength(3);
    expect(userCollections[0].resource.title).toBe('测试资源1');
    expect(userCollections[1].resource.title).toBe('测试资源2');
    expect(userCollections[2].resource.title).toBe('测试资源3');

    // 清理
    for (const collection of collections) {
      await ResourceCollection.findByIdAndDelete(collection._id);
    }
    for (const resource of resources) {
      await Resource.findByIdAndDelete(resource._id);
    }
  });

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

    // 收藏资源
    const collection = new ResourceCollection({
      user: testUserId,
      resource: savedResource._id,
      collectionName: '默认收藏夹',
      notes: '这是收藏笔记'
    });
    await collection.save();

    // 检查资源是否已被收藏
    const isCollected = await ResourceCollection.exists({
      user: testUserId,
      resource: savedResource._id
    });

    // 验证结果
    expect(isCollected).toBeTruthy();

    // 清理
    await ResourceCollection.findByIdAndDelete(collection._id);
    await Resource.findByIdAndDelete(savedResource._id);
  });

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

    // 收藏资源
    const collection = new ResourceCollection({
      user: testUserId,
      resource: savedResource._id,
      collectionName: '默认收藏夹',
      notes: '原始笔记'
    });
    const savedCollection = await collection.save();

    // 更新收藏信息
    savedCollection.collectionName = '重要资源';
    savedCollection.notes = '更新后的笔记';
    await savedCollection.save();

    // 验证数据库中的收藏已更新
    const updatedCollection = await ResourceCollection.findById(savedCollection._id);
    expect(updatedCollection.collectionName).toBe('重要资源');
    expect(updatedCollection.notes).toBe('更新后的笔记');

    // 清理
    await ResourceCollection.findByIdAndDelete(savedCollection._id);
    await Resource.findByIdAndDelete(savedResource._id);
  });

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

    // 收藏资源
    const collection = new ResourceCollection({
      user: testUserId,
      resource: savedResource._id,
      collectionName: '默认收藏夹',
      notes: '这是收藏笔记'
    });
    const savedCollection = await collection.save();

    // 取消收藏
    await ResourceCollection.findByIdAndDelete(savedCollection._id);

    // 验证数据库中的收藏已删除
    const deletedCollection = await ResourceCollection.findById(savedCollection._id);
    expect(deletedCollection).toBeNull();

    // 清理
    await Resource.findByIdAndDelete(savedResource._id);
  });

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

    // 创建不同收藏夹的收藏
    const collections = [];
    const folderNames = ['学习资料', '学习资料', '重要资源', '重要资源', '其他'];
    for (let i = 0; i < resources.length; i++) {
      const collection = new ResourceCollection({
        user: testUserId,
        resource: resources[i]._id,
        collectionName: folderNames[i],
        notes: `这是资源${i+1}的收藏笔记`
      });
      collections.push(await collection.save());
    }

    // 获取按收藏夹名称分组的收藏数量
    const folderCounts = await ResourceCollection.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(testUserId) } },
      { $group: { _id: '$collectionName', count: { $sum: 1 } } },
      { $project: { name: '$_id', count: 1, _id: 0 } }
    ]);

    // 验证结果
    expect(folderCounts).toHaveLength(3); // 应该有3个不同的收藏夹

    // 验证每个收藏夹的资源数量
    const studyFolder = folderCounts.find(f => f.name === '学习资料');
    const importantFolder = folderCounts.find(f => f.name === '重要资源');
    const otherFolder = folderCounts.find(f => f.name === '其他');

    expect(studyFolder).toBeDefined();
    expect(importantFolder).toBeDefined();
    expect(otherFolder).toBeDefined();

    expect(studyFolder.count).toBe(2);
    expect(importantFolder.count).toBe(2);
    expect(otherFolder.count).toBe(1);

    // 清理
    for (const collection of collections) {
      await ResourceCollection.findByIdAndDelete(collection._id);
    }
    for (const resource of resources) {
      await Resource.findByIdAndDelete(resource._id);
    }
  });
});

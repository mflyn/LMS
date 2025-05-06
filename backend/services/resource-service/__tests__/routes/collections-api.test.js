const request = require('supertest');
const mongoose = require('mongoose');

// 设置测试环境
process.env.NODE_ENV = 'test';

const app = require('../../app');
const Resource = require('../../models/Resource');
const ResourceCollection = require('../../models/ResourceCollection');
const { cleanupTestData } = require('../utils/testUtils');

describe('资源收藏 API 测试', () => {
  // 测试用户ID
  const testUserId = new mongoose.Types.ObjectId().toString();

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

  describe('GET /api/resources/collections', () => {
    it('应该返回用户的收藏列表', async () => {
      // 创建测试资源
      const resource = new Resource({
        title: '测试资源',
        description: '这是一个测试资源',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        uploader: new mongoose.Types.ObjectId()
      });
      const savedResource = await resource.save();

      // 创建测试收藏
      const collection = new ResourceCollection({
        user: testUserId,
        resource: savedResource._id,
        collectionName: '测试收藏夹',
        notes: '测试笔记'
      });
      await collection.save();

      // 发送请求
      const response = await request(app)
        .get('/api/resources/collections')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('collections');
      expect(response.body.collections.length).toBe(1);
      expect(response.body.collections[0].collectionName).toBe('测试收藏夹');
      expect(response.body.collections[0].notes).toBe('测试笔记');
      expect(response.body.collections[0].resource._id.toString()).toBe(savedResource._id.toString());
    });

    it('未授权时应该返回401错误', async () => {
      // 发送请求，不设置用户ID
      const response = await request(app)
        .get('/api/resources/collections');

      // 验证响应
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未授权，请先登录');
    });
  });

  describe('GET /api/resources/collections/check/:resourceId', () => {
    it('应该返回资源已被收藏', async () => {
      // 创建测试资源
      const resource = new Resource({
        title: '测试资源',
        description: '这是一个测试资源',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        uploader: new mongoose.Types.ObjectId()
      });
      const savedResource = await resource.save();

      // 创建测试收藏
      const collection = new ResourceCollection({
        user: testUserId,
        resource: savedResource._id,
        collectionName: '测试收藏夹',
        notes: '测试笔记'
      });
      await collection.save();

      // 发送请求
      const response = await request(app)
        .get(`/api/resources/collections/check/${savedResource._id}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('isCollected', true);
    });

    it('应该返回资源未被收藏', async () => {
      // 创建测试资源
      const resource = new Resource({
        title: '测试资源',
        description: '这是一个测试资源',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        uploader: new mongoose.Types.ObjectId()
      });
      const savedResource = await resource.save();

      // 发送请求
      const response = await request(app)
        .get(`/api/resources/collections/check/${savedResource._id}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('isCollected', false);
    });

    it('资源不存在时应该返回404错误', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      // 发送请求
      const response = await request(app)
        .get(`/api/resources/collections/check/${nonExistentId}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '资源不存在');
    });

    it('未授权时应该返回401错误', async () => {
      const resourceId = new mongoose.Types.ObjectId();

      // 发送请求，不设置用户ID
      const response = await request(app)
        .get(`/api/resources/collections/check/${resourceId}`);

      // 验证响应
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未授权，请先登录');
    });
  });

  describe('POST /api/resources/collections', () => {
    it('应该成功收藏资源', async () => {
      // 创建测试资源
      const resource = new Resource({
        title: '测试资源',
        description: '这是一个测试资源',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        uploader: new mongoose.Types.ObjectId()
      });
      const savedResource = await resource.save();

      // 发送请求
      const response = await request(app)
        .post('/api/resources/collections')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student')
        .send({
          resourceId: savedResource._id,
          collectionName: '测试收藏夹',
          notes: '测试笔记'
        });

      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', '收藏成功');
      expect(response.body).toHaveProperty('collection');
      expect(response.body.collection.collectionName).toBe('测试收藏夹');
      expect(response.body.collection.notes).toBe('测试笔记');

      // 验证数据库中的收藏
      const collection = await ResourceCollection.findOne({
        user: testUserId,
        resource: savedResource._id
      });
      expect(collection).toBeDefined();
      expect(collection.collectionName).toBe('测试收藏夹');
      expect(collection.notes).toBe('测试笔记');
    });

    it('资源不存在时应该返回404错误', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      // 发送请求
      const response = await request(app)
        .post('/api/resources/collections')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student')
        .send({
          resourceId: nonExistentId,
          collectionName: '测试收藏夹',
          notes: '测试笔记'
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '资源不存在');
    });

    it('已收藏过资源时应该返回400错误', async () => {
      // 创建测试资源
      const resource = new Resource({
        title: '测试资源',
        description: '这是一个测试资源',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        uploader: new mongoose.Types.ObjectId()
      });
      const savedResource = await resource.save();

      // 创建测试收藏
      const collection = new ResourceCollection({
        user: testUserId,
        resource: savedResource._id,
        collectionName: '测试收藏夹',
        notes: '测试笔记'
      });
      await collection.save();

      // 发送请求
      const response = await request(app)
        .post('/api/resources/collections')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student')
        .send({
          resourceId: savedResource._id,
          collectionName: '测试收藏夹2',
          notes: '测试笔记2'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '已经收藏过该资源');
    });

    it('未授权时应该返回401错误', async () => {
      const resourceId = new mongoose.Types.ObjectId();

      // 发送请求，不设置用户ID
      const response = await request(app)
        .post('/api/resources/collections')
        .send({
          resourceId,
          collectionName: '测试收藏夹',
          notes: '测试笔记'
        });

      // 验证响应
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未授权，请先登录');
    });
  });

  describe('PUT /api/resources/collections/:id', () => {
    it('应该成功更新收藏信息', async () => {
      // 创建测试资源
      const resource = new Resource({
        title: '测试资源',
        description: '这是一个测试资源',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        uploader: new mongoose.Types.ObjectId()
      });
      const savedResource = await resource.save();

      // 创建测试收藏
      const collection = new ResourceCollection({
        user: testUserId,
        resource: savedResource._id,
        collectionName: '测试收藏夹',
        notes: '测试笔记'
      });
      const savedCollection = await collection.save();

      // 发送请求
      const response = await request(app)
        .put(`/api/resources/collections/${savedCollection._id}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student')
        .send({
          collectionName: '更新后的收藏夹',
          notes: '更新后的笔记'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '收藏更新成功');
      expect(response.body).toHaveProperty('collection');
      expect(response.body.collection.collectionName).toBe('更新后的收藏夹');
      expect(response.body.collection.notes).toBe('更新后的笔记');

      // 验证数据库中的收藏已更新
      const updatedCollection = await ResourceCollection.findById(savedCollection._id);
      expect(updatedCollection.collectionName).toBe('更新后的收藏夹');
      expect(updatedCollection.notes).toBe('更新后的笔记');
    });

    it('收藏不存在时应该返回404错误', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      // 发送请求
      const response = await request(app)
        .put(`/api/resources/collections/${nonExistentId}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student')
        .send({
          collectionName: '更新后的收藏夹',
          notes: '更新后的笔记'
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '收藏不存在');
    });

    it('尝试更新其他用户的收藏时应该返回403错误', async () => {
      // 创建测试资源
      const resource = new Resource({
        title: '测试资源',
        description: '这是一个测试资源',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        uploader: new mongoose.Types.ObjectId()
      });
      const savedResource = await resource.save();

      // 创建其他用户的收藏
      const otherUserId = new mongoose.Types.ObjectId();
      const collection = new ResourceCollection({
        user: otherUserId,
        resource: savedResource._id,
        collectionName: '测试收藏夹',
        notes: '测试笔记'
      });
      const savedCollection = await collection.save();

      // 发送请求
      const response = await request(app)
        .put(`/api/resources/collections/${savedCollection._id}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student')
        .send({
          collectionName: '更新后的收藏夹',
          notes: '更新后的笔记'
        });

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '无权修改此收藏');
    });

    it('未授权时应该返回401错误', async () => {
      const collectionId = new mongoose.Types.ObjectId();

      // 发送请求，不设置用户ID
      const response = await request(app)
        .put(`/api/resources/collections/${collectionId}`)
        .send({
          collectionName: '更新后的收藏夹',
          notes: '更新后的笔记'
        });

      // 验证响应
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未授权，请先登录');
    });
  });

  describe('DELETE /api/resources/collections/:id', () => {
    it('应该成功删除收藏', async () => {
      // 创建测试资源
      const resource = new Resource({
        title: '测试资源',
        description: '这是一个测试资源',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        uploader: new mongoose.Types.ObjectId()
      });
      const savedResource = await resource.save();

      // 创建测试收藏
      const collection = new ResourceCollection({
        user: testUserId,
        resource: savedResource._id,
        collectionName: '测试收藏夹',
        notes: '测试笔记'
      });
      const savedCollection = await collection.save();

      // 发送请求
      const response = await request(app)
        .delete(`/api/resources/collections/${savedCollection._id}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '收藏已删除');

      // 验证数据库中的收藏已删除
      const deletedCollection = await ResourceCollection.findById(savedCollection._id);
      expect(deletedCollection).toBeNull();
    });

    it('收藏不存在时应该返回404错误', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      // 发送请求
      const response = await request(app)
        .delete(`/api/resources/collections/${nonExistentId}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '收藏不存在');
    });

    it('尝试删除其他用户的收藏时应该返回403错误', async () => {
      // 创建测试资源
      const resource = new Resource({
        title: '测试资源',
        description: '这是一个测试资源',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        uploader: new mongoose.Types.ObjectId()
      });
      const savedResource = await resource.save();

      // 创建其他用户的收藏
      const otherUserId = new mongoose.Types.ObjectId();
      const collection = new ResourceCollection({
        user: otherUserId,
        resource: savedResource._id,
        collectionName: '测试收藏夹',
        notes: '测试笔记'
      });
      const savedCollection = await collection.save();

      // 发送请求
      const response = await request(app)
        .delete(`/api/resources/collections/${savedCollection._id}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '无权删除此收藏');
    });

    it('未授权时应该返回401错误', async () => {
      const collectionId = new mongoose.Types.ObjectId();

      // 发送请求，不设置用户ID
      const response = await request(app)
        .delete(`/api/resources/collections/${collectionId}`);

      // 验证响应
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未授权，请先登录');
    });
  });

  describe('GET /api/resources/collections/folders', () => {
    it('应该返回按收藏夹名称分组的收藏', async () => {
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
      const folderNames = ['学习资料', '学习资料', '重要资源', '重要资源', '其他'];
      for (let i = 0; i < resources.length; i++) {
        const collection = new ResourceCollection({
          user: testUserId,
          resource: resources[i]._id,
          collectionName: folderNames[i],
          notes: `这是资源${i+1}的收藏笔记`
        });
        await collection.save();
      }

      // 发送请求
      const response = await request(app)
        .get('/api/resources/collections/folders')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('folders');
      expect(Array.isArray(response.body.folders)).toBe(true);
      expect(response.body.folders.length).toBe(3); // 应该有3个不同的收藏夹

      // 验证每个收藏夹的资源数量
      const studyFolder = response.body.folders.find(f => f.name === '学习资料');
      const importantFolder = response.body.folders.find(f => f.name === '重要资源');
      const otherFolder = response.body.folders.find(f => f.name === '其他');

      expect(studyFolder).toBeDefined();
      expect(importantFolder).toBeDefined();
      expect(otherFolder).toBeDefined();

      expect(studyFolder.count).toBe(2);
      expect(importantFolder.count).toBe(2);
      expect(otherFolder.count).toBe(1);
    });

    it('没有收藏时应该返回空数组', async () => {
      // 发送请求
      const response = await request(app)
        .get('/api/resources/collections/folders')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('folders');
      expect(Array.isArray(response.body.folders)).toBe(true);
      expect(response.body.folders.length).toBe(0);
    });

    it('未授权时应该返回401错误', async () => {
      // 发送请求，不设置用户ID
      const response = await request(app)
        .get('/api/resources/collections/folders');

      // 验证响应
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未授权，请先登录');
    });

    it('数据库错误时应该返回500错误', async () => {
      // 模拟 mongoose.Types.ObjectId 抛出错误
      const originalObjectId = mongoose.Types.ObjectId;
      mongoose.Types.ObjectId = jest.fn().mockImplementation(() => {
        throw new Error('模拟数据库错误');
      });

      // 模拟控制台错误输出
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // 发送请求
      const response = await request(app)
        .get('/api/resources/collections/folders')
        .set('x-user-id', 'invalid-id') // 使用无效的ID触发错误
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');

      // 验证错误被记录
      expect(consoleSpy).toHaveBeenCalledWith('获取收藏夹列表失败:', expect.any(Error));

      // 恢复 mongoose.Types.ObjectId 和控制台
      mongoose.Types.ObjectId = originalObjectId;
      consoleSpy.mockRestore();
    });
  });
});

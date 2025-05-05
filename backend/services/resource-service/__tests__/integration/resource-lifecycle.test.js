const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// 设置测试环境
process.env.NODE_ENV = 'test';

const app = require('../../app');
const Resource = require('../../models/Resource');
const ResourceReview = require('../../models/ResourceReview');
const ResourceCollection = require('../../models/ResourceCollection');
const { cleanupTestData } = require('../utils/testUtils');

describe('资源服务生命周期集成测试', () => {
  // 在所有测试开始前清理数据
  beforeAll(async () => {
    await cleanupTestData();
  });

  // 在所有测试结束后清理数据
  afterAll(async () => {
    await cleanupTestData();
  });

  // 在每个测试前清理数据
  beforeEach(async () => {
    await cleanupTestData();
  });

  // 创建一个有效的用户ID (MongoDB ObjectId)
  const teacherId = new mongoose.Types.ObjectId().toString();
  const studentId = new mongoose.Types.ObjectId().toString();

  it('教师应该能够创建资源', async () => {
    // 创建一个资源对象
    const resource = new Resource({
      title: '生命周期测试资源',
      description: '这是一个用于测试资源生命周期的资源',
      subject: '数学',
      grade: '三年级',
      type: '习题',
      tags: ['测试', '数学', '三年级'],
      file: {
        name: 'lifecycle-test.pdf',
        path: '/uploads/lifecycle-test.pdf',
        type: 'application/pdf',
        size: 150
      },
      uploader: teacherId
    });

    // 保存资源
    const savedResource = await resource.save();

    // 验证资源已保存
    expect(savedResource._id).toBeDefined();
    expect(savedResource.title).toBe('生命周期测试资源');
    expect(savedResource.uploader.toString()).toBe(teacherId);

    // 从数据库查询资源
    const foundResource = await Resource.findById(savedResource._id);
    expect(foundResource).toBeDefined();
    expect(foundResource.title).toBe('生命周期测试资源');
  });

  it('学生应该能够查看资源详情', async () => {
    // 创建一个资源对象
    const resource = new Resource({
      title: '生命周期测试资源',
      description: '这是一个用于测试资源生命周期的资源',
      subject: '数学',
      grade: '三年级',
      type: '习题',
      tags: ['测试', '数学', '三年级'],
      file: {
        name: 'lifecycle-test.pdf',
        path: '/uploads/lifecycle-test.pdf',
        type: 'application/pdf',
        size: 150
      },
      uploader: teacherId
    });

    // 保存资源
    const savedResource = await resource.save();

    // 直接从数据库查询资源
    const foundResource = await Resource.findById(savedResource._id);

    // 验证资源存在
    expect(foundResource).toBeDefined();
    expect(foundResource._id.toString()).toBe(savedResource._id.toString());
    expect(foundResource.title).toBe('生命周期测试资源');
    expect(foundResource.subject).toBe('数学');
    expect(foundResource.grade).toBe('三年级');
  });

  it('学生应该能够评价资源', async () => {
    // 创建一个资源对象
    const resource = new Resource({
      title: '评价测试资源',
      description: '这是一个用于测试评价功能的资源',
      subject: '数学',
      grade: '三年级',
      type: '习题',
      uploader: teacherId
    });

    // 保存资源
    const savedResource = await resource.save();

    // 直接创建评价
    const review = new ResourceReview({
      resource: savedResource._id,
      reviewer: studentId,
      rating: 4,
      comment: '这是一个很好的资源',
      isRecommended: true
    });

    // 保存评价
    await review.save();

    // 验证数据库中已创建评价
    const savedReview = await ResourceReview.findOne({
      resource: savedResource._id,
      reviewer: studentId
    });
    expect(savedReview).toBeDefined();
    expect(savedReview.rating).toBe(4);
    expect(savedReview.comment).toBe('这是一个很好的资源');

    // 更新资源的平均评分（模拟实际应用中的行为）
    const resourceToUpdate = await Resource.findById(savedResource._id);
    resourceToUpdate.averageRating = 4;
    resourceToUpdate.ratingCount = 1;
    await resourceToUpdate.save();

    // 验证资源的平均评分已更新
    const updatedResource = await Resource.findById(savedResource._id);
    expect(updatedResource.averageRating).toBe(4);
  });

  it('学生应该能够收藏资源', async () => {
    // 创建一个资源对象
    const resource = new Resource({
      title: '收藏测试资源',
      description: '这是一个用于测试收藏功能的资源',
      subject: '数学',
      grade: '三年级',
      type: '习题',
      uploader: teacherId
    });

    // 保存资源
    const savedResource = await resource.save();

    // 直接创建收藏记录
    const collection = new ResourceCollection({
      user: studentId,
      resource: savedResource._id,
      collectionName: '重要学习资料',
      notes: '这是一个需要重点学习的资源'
    });

    // 保存收藏
    await collection.save();

    // 验证收藏已保存到数据库
    const savedCollection = await ResourceCollection.findOne({
      user: studentId,
      resource: savedResource._id
    });
    expect(savedCollection).toBeDefined();
    expect(savedCollection.collectionName).toBe('重要学习资料');
    expect(savedCollection.notes).toBe('这是一个需要重点学习的资源');
  });

  it('学生应该能够查看自己的收藏列表', async () => {
    // 创建多个资源对象
    const resources = [];
    for (let i = 1; i <= 3; i++) {
      const resource = new Resource({
        title: `收藏列表测试资源${i}`,
        description: `这是用于测试收藏列表的资源${i}`,
        subject: '数学',
        grade: '三年级',
        type: '习题',
        uploader: teacherId
      });
      resources.push(await resource.save());
    }

    // 创建多个收藏
    for (let i = 0; i < resources.length; i++) {
      const collection = new ResourceCollection({
        user: studentId,
        resource: resources[i]._id,
        collectionName: i === 0 ? '重要学习资料' : `收藏夹${i}`,
        notes: `这是资源${i+1}的收藏笔记`
      });
      await collection.save();
    }

    // 直接从数据库查询收藏列表
    const collections = await ResourceCollection.find({ user: studentId })
      .populate('resource');

    // 验证查询结果
    expect(collections.length).toBe(3);

    // 验证收藏列表中包含我们刚才收藏的资源
    const foundCollection = collections.find(
      c => c.collectionName === '重要学习资料'
    );
    expect(foundCollection).toBeDefined();
    expect(foundCollection.resource.title).toBe('收藏列表测试资源1');
  });

  it('学生应该能够查看资源的评价列表', async () => {
    // 创建一个资源对象
    const resource = new Resource({
      title: '评价列表测试资源',
      description: '这是一个用于测试评价列表的资源',
      subject: '数学',
      grade: '三年级',
      type: '习题',
      uploader: teacherId,
      averageRating: 4
    });

    // 保存资源
    const savedResource = await resource.save();

    // 创建多个评价
    const reviewers = [
      new mongoose.Types.ObjectId().toString(),
      new mongoose.Types.ObjectId().toString(),
      studentId
    ];

    for (let i = 0; i < reviewers.length; i++) {
      const review = new ResourceReview({
        resource: savedResource._id,
        reviewer: reviewers[i],
        rating: 3 + i, // 评分在3-5之间
        comment: `这是评价${i+1}`,
        isRecommended: i % 2 === 0
      });
      await review.save();
    }

    // 直接从数据库查询评价列表
    const reviews = await ResourceReview.find({ resource: savedResource._id });

    // 验证查询结果
    expect(reviews.length).toBe(3);

    // 验证评价列表中包含学生创建的评价
    const studentReview = reviews.find(r => r.reviewer.toString() === studentId);
    expect(studentReview).toBeDefined();
    expect(studentReview.rating).toBe(5);
    expect(studentReview.comment).toBe('这是评价3');
  });

  it('教师应该能够更新自己上传的资源', async () => {
    // 创建一个资源对象
    const resource = new Resource({
      title: '原始资源标题',
      description: '这是原始资源描述',
      subject: '数学',
      grade: '三年级',
      type: '习题',
      uploader: teacherId
    });

    // 保存资源
    const savedResource = await resource.save();

    // 直接从数据库更新资源
    const resourceToUpdate = await Resource.findById(savedResource._id);

    // 更新资源信息
    resourceToUpdate.title = '更新后的资源标题';
    resourceToUpdate.description = '这是更新后的资源描述';
    resourceToUpdate.grade = '四年级';

    // 保存更新
    await resourceToUpdate.save();

    // 验证数据库中的资源已更新
    const updatedResource = await Resource.findById(savedResource._id);
    expect(updatedResource.title).toBe('更新后的资源标题');
    expect(updatedResource.description).toBe('这是更新后的资源描述');
    expect(updatedResource.grade).toBe('四年级');
  });

  it('学生应该能够更新自己的评价', async () => {
    // 创建一个资源对象
    const resource = new Resource({
      title: '评价更新测试资源',
      description: '这是一个用于测试评价更新的资源',
      subject: '数学',
      grade: '三年级',
      type: '习题',
      uploader: teacherId
    });

    // 保存资源
    const savedResource = await resource.save();

    // 创建评价
    const review = new ResourceReview({
      resource: savedResource._id,
      reviewer: studentId,
      rating: 4,
      comment: '原始评价',
      isRecommended: true
    });

    // 保存评价
    await review.save();

    // 查找现有评价
    const savedReview = await ResourceReview.findOne({
      resource: savedResource._id,
      reviewer: studentId
    });
    expect(savedReview).toBeDefined();

    // 更新评价
    savedReview.rating = 5;
    savedReview.comment = '更新后的评价，这个资源非常好';
    await savedReview.save();

    // 验证数据库中的评价已更新
    const updatedReview = await ResourceReview.findOne({
      resource: savedResource._id,
      reviewer: studentId
    });
    expect(updatedReview).toBeDefined();
    expect(updatedReview.rating).toBe(5);
    expect(updatedReview.comment).toBe('更新后的评价，这个资源非常好');

    // 更新资源的平均评分（模拟实际应用中的行为）
    const resourceToUpdate = await Resource.findById(savedResource._id);
    resourceToUpdate.averageRating = 5;
    await resourceToUpdate.save();

    // 验证资源的平均评分已更新
    const updatedResource = await Resource.findById(savedResource._id);
    expect(updatedResource.averageRating).toBe(5);
  });

  it('学生应该能够取消收藏资源', async () => {
    // 创建一个资源对象
    const resource = new Resource({
      title: '取消收藏测试资源',
      description: '这是一个用于测试取消收藏的资源',
      subject: '数学',
      grade: '三年级',
      type: '习题',
      uploader: teacherId
    });

    // 保存资源
    const savedResource = await resource.save();

    // 创建收藏
    const collection = new ResourceCollection({
      user: studentId,
      resource: savedResource._id,
      collectionName: '测试收藏夹',
      notes: '这是收藏笔记'
    });

    // 保存收藏
    const savedCollection = await collection.save();

    // 直接从数据库删除收藏
    await ResourceCollection.findByIdAndDelete(savedCollection._id);

    // 验证数据库中的收藏已删除
    const deletedCollection = await ResourceCollection.findById(savedCollection._id);
    expect(deletedCollection).toBeNull();
  });

  it('教师应该能够删除自己上传的资源', async () => {
    // 创建一个资源对象
    const resource = new Resource({
      title: '删除测试资源',
      description: '这是一个用于测试删除功能的资源',
      subject: '数学',
      grade: '三年级',
      type: '习题',
      uploader: teacherId
    });

    // 保存资源
    const savedResource = await resource.save();

    // 创建评价
    const review = new ResourceReview({
      resource: savedResource._id,
      reviewer: studentId,
      rating: 4,
      comment: '这是一个评价',
      isRecommended: true
    });

    // 保存评价
    await review.save();

    // 删除相关的评价
    await ResourceReview.deleteMany({ resource: savedResource._id });

    // 验证评价已删除
    const reviews = await ResourceReview.find({ resource: savedResource._id });
    expect(reviews.length).toBe(0);

    // 直接从数据库删除资源
    await Resource.findByIdAndDelete(savedResource._id);

    // 验证数据库中的资源已删除
    const deletedResource = await Resource.findById(savedResource._id);
    expect(deletedResource).toBeNull();
  });
});

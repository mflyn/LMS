const mongoose = require('mongoose');
const Resource = require('../../models/Resource');

describe('Resource 模型测试', () => {
  beforeEach(async () => {
    await Resource.deleteMany({});
  });

  it('应该成功创建并保存资源记录', async () => {
    const mockUploaderId = new mongoose.Types.ObjectId();

    const resource = new Resource({
      title: '测试资源',
      description: '这是一个测试资源',
      subject: '数学',
      grade: '三年级',
      type: '习题',
      tags: ['代数', '方程'],
      uploader: mockUploaderId,
      downloads: 0
    });

    // 设置文件信息
    resource.file = {
      name: 'test.pdf',
      path: '/uploads/test.pdf',
      type: 'application/pdf',
      size: 1024
    };

    const savedResource = await resource.save();

    // 验证保存的数据
    expect(savedResource._id).toBeDefined();
    expect(savedResource.title).toBe('测试资源');
    expect(savedResource.description).toBe('这是一个测试资源');
    expect(savedResource.subject).toBe('数学');
    expect(savedResource.grade).toBe('三年级');
    expect(savedResource.type).toBe('习题');
    expect(savedResource.tags).toEqual(['代数', '方程']);
    expect(savedResource.file).toBeDefined();
    expect(savedResource.uploader.toString()).toBe(mockUploaderId.toString());
    expect(savedResource.downloads).toBe(0);
    expect(savedResource.averageRating).toBe(0);
    expect(savedResource.reviewCount).toBe(0);
    expect(savedResource.createdAt).toBeDefined();
  });

  it('缺少必填字段时应该验证失败', async () => {
    const invalidResource = new Resource({
      // 缺少必填字段
      description: '这是一个测试资源',
      tags: ['代数', '方程']
    });

    let validationError;
    try {
      await invalidResource.save();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors.title).toBeDefined();
    expect(validationError.errors.subject).toBeDefined();
    expect(validationError.errors.grade).toBeDefined();
    expect(validationError.errors.type).toBeDefined();
    expect(validationError.errors.uploader).toBeDefined();
  });

  it('应该正确验证枚举值', async () => {
    const mockUploaderId = new mongoose.Types.ObjectId();

    const invalidResource = new Resource({
      title: '测试资源',
      description: '这是一个测试资源',
      subject: '无效学科', // 无效的枚举值
      grade: '三年级',
      type: '习题',
      uploader: mockUploaderId
    });

    let validationError;
    try {
      await invalidResource.save();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors.subject).toBeDefined();
  });

  it('应该能够更新下载次数', async () => {
    const mockUploaderId = new mongoose.Types.ObjectId();

    const resource = new Resource({
      title: '测试资源',
      description: '这是一个测试资源',
      subject: '数学',
      grade: '三年级',
      type: '习题',
      uploader: mockUploaderId,
      downloads: 0
    });

    const savedResource = await resource.save();

    // 更新下载次数
    savedResource.downloads += 1;
    const updatedResource = await savedResource.save();

    expect(updatedResource.downloads).toBe(1);
  });

  it('应该能够更新评分信息', async () => {
    const mockUploaderId = new mongoose.Types.ObjectId();

    const resource = new Resource({
      title: '测试资源',
      description: '这是一个测试资源',
      subject: '数学',
      grade: '三年级',
      type: '习题',
      uploader: mockUploaderId,
      averageRating: 0,
      reviewCount: 0
    });

    const savedResource = await resource.save();

    // 更新评分信息
    savedResource.averageRating = 4.5;
    savedResource.reviewCount = 2;
    const updatedResource = await savedResource.save();

    expect(updatedResource.averageRating).toBe(4.5);
    expect(updatedResource.reviewCount).toBe(2);
  });
});

const mongoose = require('mongoose');
const ResourceCollection = require('../../models/ResourceCollection');

// 增加超时时间
jest.setTimeout(60000);

describe('ResourceCollection 模型测试', () => {
  beforeEach(async () => {
    await ResourceCollection.deleteMany({});
  });

  it('应该成功创建并保存资源收藏记录', async () => {
    const mockUserId = new mongoose.Types.ObjectId();
    const mockResourceId = new mongoose.Types.ObjectId();

    const collectionData = {
      user: mockUserId,
      resource: mockResourceId,
      collectionName: '我的收藏',
      notes: '这是一个很有用的资源'
    };

    const collection = new ResourceCollection(collectionData);
    const savedCollection = await collection.save();

    // 验证保存的数据
    expect(savedCollection._id).toBeDefined();
    expect(savedCollection.user.toString()).toBe(mockUserId.toString());
    expect(savedCollection.resource.toString()).toBe(mockResourceId.toString());
    expect(savedCollection.collectionName).toBe('我的收藏');
    expect(savedCollection.notes).toBe('这是一个很有用的资源');
    expect(savedCollection.createdAt).toBeDefined();
  });

  it('缺少必填字段时应该验证失败', async () => {
    const invalidCollection = new ResourceCollection({
      // 缺少必填字段
      collectionName: '我的收藏',
      notes: '这是一个很有用的资源'
    });

    let validationError;
    try {
      await invalidCollection.save();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors.user).toBeDefined();
    expect(validationError.errors.resource).toBeDefined();
  });

  it('应该使用默认收藏夹名称', async () => {
    const mockUserId = new mongoose.Types.ObjectId();
    const mockResourceId = new mongoose.Types.ObjectId();

    const collection = new ResourceCollection({
      user: mockUserId,
      resource: mockResourceId,
      // 不提供收藏夹名称
      notes: '这是一个很有用的资源'
    });

    const savedCollection = await collection.save();

    // 验证使用了默认收藏夹名称
    expect(savedCollection.collectionName).toBe('默认收藏夹');
  });

  it('应该能够更新收藏信息', async () => {
    const mockUserId = new mongoose.Types.ObjectId();
    const mockResourceId = new mongoose.Types.ObjectId();

    const collection = new ResourceCollection({
      user: mockUserId,
      resource: mockResourceId,
      collectionName: '初始收藏夹',
      notes: '初始笔记'
    });

    const savedCollection = await collection.save();

    // 更新收藏信息
    savedCollection.collectionName = '更新后的收藏夹';
    savedCollection.notes = '更新后的笔记';
    const updatedCollection = await savedCollection.save();

    expect(updatedCollection.collectionName).toBe('更新后的收藏夹');
    expect(updatedCollection.notes).toBe('更新后的笔记');
  });
});

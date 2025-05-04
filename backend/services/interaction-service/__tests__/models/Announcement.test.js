const mongoose = require('mongoose');
const Announcement = require('../../models/Announcement');

// 模拟 mongoose
jest.mock('mongoose', () => {
  // 创建模拟的 Schema 构造函数
  const mSchema = jest.fn().mockImplementation(function(definition) {
    // 保存 Schema 定义以便测试
    this.definition = definition;
    return this;
  });

  // 设置 Schema.Types
  mSchema.Types = {
    ObjectId: jest.fn().mockReturnValue('ObjectId')
  };

  // 创建模拟的模型
  const mModel = {
    findById: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    countDocuments: jest.fn(),
    modelName: 'Announcement',
    collection: { name: 'announcements' }
  };

  // 创建模拟的 mongoose
  const mMongoose = {
    Schema: mSchema,
    model: jest.fn().mockReturnValue(mModel)
  };

  return mMongoose;
});

describe('Announcement 模型测试', () => {
  let schemaDefinition;

  beforeAll(() => {
    // 获取 Schema 定义
    schemaDefinition = mongoose.Schema.mock.calls[0][0];
  });

  it('应该导出 Announcement 模型', () => {
    expect(Announcement).toBeDefined();
    expect(Announcement.modelName).toBe('Announcement');
    expect(Announcement.collection.name).toBe('announcements');
  });

  it('应该导出一个有效的 Mongoose 模型', () => {
    // 验证导出的是一个对象
    expect(typeof Announcement).toBe('object');

    // 验证模型有正确的方法
    expect(Announcement.findById).toBeDefined();
    expect(Announcement.find).toBeDefined();
    expect(Announcement.findByIdAndUpdate).toBeDefined();
    expect(Announcement.findByIdAndDelete).toBeDefined();
    expect(Announcement.countDocuments).toBeDefined();
  });

  it('应该定义正确的字段', () => {
    // 验证必要字段存在
    expect(schemaDefinition).toHaveProperty('title');
    expect(schemaDefinition).toHaveProperty('content');
    expect(schemaDefinition).toHaveProperty('author');
    expect(schemaDefinition).toHaveProperty('class');
    expect(schemaDefinition).toHaveProperty('attachments');
    expect(schemaDefinition).toHaveProperty('createdAt');
  });

  it('应该将 title 字段定义为必填项', () => {
    expect(schemaDefinition.title).toHaveProperty('type');
    expect(schemaDefinition.title).toHaveProperty('required', true);
  });

  it('应该将 content 字段定义为必填项', () => {
    expect(schemaDefinition.content).toHaveProperty('type');
    expect(schemaDefinition.content).toHaveProperty('required', true);
  });

  it('应该将 author 字段定义为必填项', () => {
    expect(schemaDefinition.author).toHaveProperty('type');
    expect(schemaDefinition.author).toHaveProperty('required', true);
    expect(schemaDefinition.author).toHaveProperty('ref', 'User');
  });

  it('应该将 class 字段定义为必填项', () => {
    expect(schemaDefinition.class).toHaveProperty('type');
    expect(schemaDefinition.class).toHaveProperty('required', true);
    expect(schemaDefinition.class).toHaveProperty('ref', 'Class');
  });

  it('应该将 createdAt 字段默认值设为当前时间', () => {
    expect(schemaDefinition.createdAt).toHaveProperty('type');
    expect(schemaDefinition.createdAt).toHaveProperty('default', Date.now);
  });

  it('应该正确定义 attachments 字段为数组', () => {
    expect(Array.isArray(schemaDefinition.attachments)).toBe(true);

    // 验证 attachments 数组元素的结构
    const attachmentSchema = schemaDefinition.attachments[0];
    expect(attachmentSchema).toHaveProperty('name');
    expect(attachmentSchema).toHaveProperty('url');
    expect(attachmentSchema).toHaveProperty('type');
    expect(attachmentSchema).toHaveProperty('size');
  });
});

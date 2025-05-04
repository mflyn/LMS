const mongoose = require('mongoose');
const Message = require('../../models/Message');

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
    countDocuments: jest.fn()
  };

  // 创建模拟的 mongoose
  const mMongoose = {
    Schema: mSchema,
    model: jest.fn().mockReturnValue(mModel)
  };

  return mMongoose;
});

describe('Message 模型测试', () => {
  let schemaDefinition;

  beforeAll(() => {
    // 获取 Schema 定义
    schemaDefinition = mongoose.Schema.mock.calls[0][0];
  });

  it('应该正确定义 Message 模型', () => {
    // 验证 mongoose.model 被调用
    expect(mongoose.model).toHaveBeenCalledWith('Message', expect.any(Object));
  });

  it('应该导出一个有效的 Mongoose 模型', () => {
    // 验证导出的是一个对象
    expect(typeof Message).toBe('object');

    // 验证模型有正确的方法
    expect(Message.findById).toBeDefined();
    expect(Message.find).toBeDefined();
    expect(Message.findByIdAndUpdate).toBeDefined();
    expect(Message.findByIdAndDelete).toBeDefined();
    expect(Message.countDocuments).toBeDefined();
  });

  it('应该定义正确的字段', () => {
    // 验证必要字段存在
    expect(schemaDefinition).toHaveProperty('sender');
    expect(schemaDefinition).toHaveProperty('receiver');
    expect(schemaDefinition).toHaveProperty('content');
    expect(schemaDefinition).toHaveProperty('attachments');
    expect(schemaDefinition).toHaveProperty('read');
    expect(schemaDefinition).toHaveProperty('createdAt');
  });

  it('应该将 sender 字段定义为必填项', () => {
    expect(schemaDefinition.sender).toHaveProperty('type');
    expect(schemaDefinition.sender).toHaveProperty('required', true);
    expect(schemaDefinition.sender).toHaveProperty('ref', 'User');
  });

  it('应该将 receiver 字段定义为必填项', () => {
    expect(schemaDefinition.receiver).toHaveProperty('type');
    expect(schemaDefinition.receiver).toHaveProperty('required', true);
    expect(schemaDefinition.receiver).toHaveProperty('ref', 'User');
  });

  it('应该将 content 字段定义为必填项', () => {
    expect(schemaDefinition.content).toHaveProperty('type');
    expect(schemaDefinition.content).toHaveProperty('required', true);
  });

  it('应该将 read 字段默认值设为 false', () => {
    expect(schemaDefinition.read).toHaveProperty('type');
    expect(schemaDefinition.read).toHaveProperty('default', false);
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

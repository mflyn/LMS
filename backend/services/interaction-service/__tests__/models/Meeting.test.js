const mongoose = require('mongoose');
const Meeting = require('../../models/Meeting');

// 模拟 mongoose
jest.mock('mongoose', () => {
  // 创建模拟的 pre 方法
  const preMock = jest.fn().mockImplementation(function(event, callback) {
    // 存储回调函数以便测试
    this.preCallbacks = this.preCallbacks || {};
    this.preCallbacks[event] = callback;
    return this;
  });

  // 创建模拟的 Schema 构造函数
  const mSchema = jest.fn().mockImplementation(function(definition) {
    // 保存 Schema 定义以便测试
    this.definition = definition;
    this.pre = preMock;
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

describe('Meeting 模型测试', () => {
  let schemaDefinition;
  let schemaInstance;

  beforeAll(() => {
    // 获取 Schema 定义和实例
    schemaDefinition = mongoose.Schema.mock.calls[0][0];
    schemaInstance = mongoose.Schema.mock.results[0].value;
  });

  it('应该正确定义 Meeting 模型', () => {
    // 验证 mongoose.model 被调用
    expect(mongoose.model).toHaveBeenCalledWith('Meeting', expect.any(Object));
  });

  it('应该导出一个有效的 Mongoose 模型', () => {
    // 验证导出的是一个对象
    expect(typeof Meeting).toBe('object');

    // 验证模型有正确的方法
    expect(Meeting.findById).toBeDefined();
    expect(Meeting.find).toBeDefined();
    expect(Meeting.findByIdAndUpdate).toBeDefined();
    expect(Meeting.findByIdAndDelete).toBeDefined();
    expect(Meeting.countDocuments).toBeDefined();
  });

  it('应该定义正确的字段', () => {
    // 验证必要字段存在
    expect(schemaDefinition).toHaveProperty('title');
    expect(schemaDefinition).toHaveProperty('description');
    expect(schemaDefinition).toHaveProperty('teacher');
    expect(schemaDefinition).toHaveProperty('parent');
    expect(schemaDefinition).toHaveProperty('student');
    expect(schemaDefinition).toHaveProperty('startTime');
    expect(schemaDefinition).toHaveProperty('endTime');
    expect(schemaDefinition).toHaveProperty('location');
    expect(schemaDefinition).toHaveProperty('status');
    expect(schemaDefinition).toHaveProperty('meetingType');
    expect(schemaDefinition).toHaveProperty('meetingLink');
    expect(schemaDefinition).toHaveProperty('notes');
    expect(schemaDefinition).toHaveProperty('createdAt');
    expect(schemaDefinition).toHaveProperty('updatedAt');
  });

  it('应该将 title 字段定义为必填项', () => {
    expect(schemaDefinition.title).toHaveProperty('type');
    expect(schemaDefinition.title).toHaveProperty('required', true);
  });

  it('应该将 teacher 字段定义为必填项', () => {
    expect(schemaDefinition.teacher).toHaveProperty('type');
    expect(schemaDefinition.teacher).toHaveProperty('required', true);
    expect(schemaDefinition.teacher).toHaveProperty('ref', 'User');
  });

  it('应该将 parent 字段定义为必填项', () => {
    expect(schemaDefinition.parent).toHaveProperty('type');
    expect(schemaDefinition.parent).toHaveProperty('required', true);
    expect(schemaDefinition.parent).toHaveProperty('ref', 'User');
  });

  it('应该将 student 字段定义为必填项', () => {
    expect(schemaDefinition.student).toHaveProperty('type');
    expect(schemaDefinition.student).toHaveProperty('required', true);
    expect(schemaDefinition.student).toHaveProperty('ref', 'User');
  });

  it('应该将 startTime 字段定义为必填项', () => {
    expect(schemaDefinition.startTime).toHaveProperty('type');
    expect(schemaDefinition.startTime).toHaveProperty('required', true);
  });

  it('应该将 endTime 字段定义为必填项', () => {
    expect(schemaDefinition.endTime).toHaveProperty('type');
    expect(schemaDefinition.endTime).toHaveProperty('required', true);
  });

  it('应该将 location 字段默认值设为"线上会议"', () => {
    expect(schemaDefinition.location).toHaveProperty('type');
    expect(schemaDefinition.location).toHaveProperty('default', '线上会议');
  });

  it('应该将 status 字段定义为枚举类型', () => {
    expect(schemaDefinition.status).toHaveProperty('type');
    expect(schemaDefinition.status).toHaveProperty('enum');
    expect(schemaDefinition.status.enum).toContain('待确认');
    expect(schemaDefinition.status.enum).toContain('已确认');
    expect(schemaDefinition.status.enum).toContain('已取消');
    expect(schemaDefinition.status.enum).toContain('已完成');
    expect(schemaDefinition.status).toHaveProperty('default', '待确认');
  });

  it('应该将 meetingType 字段定义为枚举类型', () => {
    expect(schemaDefinition.meetingType).toHaveProperty('type');
    expect(schemaDefinition.meetingType).toHaveProperty('enum');
    expect(schemaDefinition.meetingType.enum).toContain('线上');
    expect(schemaDefinition.meetingType.enum).toContain('线下');
    expect(schemaDefinition.meetingType).toHaveProperty('default', '线上');
  });

  it('应该将 createdAt 和 updatedAt 字段默认值设为当前时间', () => {
    expect(schemaDefinition.createdAt).toHaveProperty('type');
    expect(schemaDefinition.createdAt).toHaveProperty('default', Date.now);
    expect(schemaDefinition.updatedAt).toHaveProperty('type');
    expect(schemaDefinition.updatedAt).toHaveProperty('default', Date.now);
  });

  it('应该有一个 pre-save 中间件来更新 updatedAt 字段', () => {
    // 验证 pre 方法被调用
    expect(schemaInstance.pre).toHaveBeenCalledWith('save', expect.any(Function));

    // 测试 pre-save 回调函数
    const mockThis = { updatedAt: null };
    const mockNext = jest.fn();

    // 调用 pre-save 回调
    if (schemaInstance.preCallbacks && schemaInstance.preCallbacks.save) {
      schemaInstance.preCallbacks.save.call(mockThis, mockNext);

      // 验证 updatedAt 被更新
      expect(mockThis.updatedAt).not.toBeNull();

      // 验证 next 被调用
      expect(mockNext).toHaveBeenCalled();
    }
  });
});

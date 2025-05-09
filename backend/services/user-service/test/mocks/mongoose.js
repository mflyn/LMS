/**
 * mongoose 模拟模块
 */

const mongoose = {
  connect: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn().mockResolvedValue(true),
  connection: {
    on: jest.fn()
  },
  Schema: function() {
    return {
      pre: jest.fn().mockReturnThis(),
      index: jest.fn().mockReturnThis()
    };
  }
};

// 添加 Schema.Types
mongoose.Schema.Types = {
  ObjectId: 'ObjectId',
  String: String,
  Number: Number,
  Date: Date,
  Boolean: Boolean,
  Array: Array,
  Mixed: 'Mixed'
};

// 添加 model 方法
mongoose.model = jest.fn().mockReturnValue({});

module.exports = mongoose;

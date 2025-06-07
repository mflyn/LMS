const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * 角色模型
 * 用于定义系统中的用户角色和权限
 */
const roleSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    enum: ['admin', 'teacher', 'student', 'parent', 'superadmin'],
    index: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  permissions: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 创建索引
roleSchema.index({ name: 1 }, { unique: true });
roleSchema.index({ isActive: 1 });

// 静态方法：根据角色名查找角色
roleSchema.statics.findByName = function(name) {
  return this.findOne({ name, isActive: true });
};

// 静态方法：获取所有活跃角色
roleSchema.statics.getActiveRoles = function() {
  return this.find({ isActive: true }).sort({ name: 1 });
};

const Role = mongoose.model('Role', roleSchema);

module.exports = Role; 
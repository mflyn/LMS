const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, '用户名是必需的'],
    unique: true,
    trim: true,
    minlength: [3, '用户名至少需要3个字符'],
    maxlength: [20, '用户名不能超过20个字符']
  },
  password: {
    type: String,
    required: [true, '密码是必需的'],
    minlength: [8, '密码至少需要8个字符']
  },
  email: {
    type: String,
    required: [true, '邮箱是必需的'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '请提供有效的邮箱地址']
  },
  name: {
    type: String,
    required: [true, '姓名是必需的'],
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'teacher', 'student', 'parent'],
    required: [true, '角色是必需的']
  },
  avatar: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 密码加密中间件
userSchema.pre('save', async function(next) {
  // 只有在密码被修改时才重新加密
  if (!this.isModified('password')) return next();

  try {
    // 生成盐
    const salt = await bcryptjs.genSalt(10);
    // 加密密码
    this.password = await bcryptjs.hash(this.password, salt);
    // 更新更新时间
    this.updatedAt = Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

// 比较密码方法
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcryptjs.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;

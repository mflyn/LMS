const mongoose = require('mongoose');
const { Schema } = mongoose;
const bcrypt = require('bcryptjs');

/**
 * 用户模型
 * 用于存储系统中所有用户的基本信息和认证数据
 */
const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, '请提供有效的电子邮件地址']
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    required: true,
    enum: ['admin', 'teacher', 'student', 'parent'],
    default: 'student'
  },
  avatar: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    trim: true
  },
  gender: {
    type: String,
    enum: ['男', '女', '其他', '未指定'],
    default: '未指定'
  },
  birthdate: {
    type: Date
  },
  address: {
    type: String,
    trim: true
  },
  class: {
    type: Schema.Types.ObjectId,
    ref: 'Class'
  },
  grade: {
    type: Number,
    min: 1,
    max: 6
  },
  studentId: {
    type: String,
    trim: true,
    sparse: true
  },
  teacherId: {
    type: String,
    trim: true,
    sparse: true
  },
  parentId: {
    type: String,
    trim: true,
    sparse: true
  },
  children: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  subjects: [{
    type: Schema.Types.ObjectId,
    ref: 'Subject'
  }],
  lastLogin: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
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
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ class: 1, role: 1 });

// 密码加密中间件
userSchema.pre('save', async function(next) {
  // 只有在密码被修改时才重新加密
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 验证密码方法
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// 获取用户基本信息（不包含敏感数据）
userSchema.methods.getBasicInfo = function() {
  return {
    id: this._id,
    username: this.username,
    name: this.name,
    email: this.email,
    role: this.role,
    avatar: this.avatar,
    class: this.class,
    grade: this.grade
  };
};

// 静态方法：根据角色查找用户
userSchema.statics.findByRole = function(role) {
  return this.find({ role });
};

// 静态方法：查找班级中的所有学生
userSchema.statics.findStudentsByClass = function(classId) {
  return this.find({ class: classId, role: 'student' });
};

// 静态方法：查找特定教师教授的所有学生
userSchema.statics.findStudentsByTeacher = async function(teacherId) {
  const teacher = await this.findById(teacherId).populate('subjects');
  if (!teacher || teacher.role !== 'teacher') return [];

  const subjectIds = teacher.subjects.map(s => s._id);
  const classes = await mongoose.model('Class').find({ 'subjects.teacher': teacherId });
  const classIds = classes.map(c => c._id);

  return this.find({ class: { $in: classIds }, role: 'student' });
};

const User = mongoose.model('User', userSchema);

module.exports = User;
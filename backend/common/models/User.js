const mongoose = require('mongoose');
const { Schema } = mongoose;
const bcrypt = require('bcryptjs');

const OPERATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PENDING_PROFILE_PATHS = [
  'name',
  'grade',
  'childProfile.nickname',
  'childProfile.grade',
  'childProfile.school',
  'childProfile.textbookVersion',
  'childProfile.interests',
  'childProfile.weakSubjects',
  'childProfile.sportsPreferences',
  'childProfile.artInterests',
  'childProfile.laborHabits',
  'childProfile.moralGoals'
];

const childPendingPatchSchema = new Schema({
  path: {
    type: String,
    required: true,
    enum: PENDING_PROFILE_PATHS
  },
  value: Schema.Types.Mixed
}, { _id: false, strict: 'throw' });

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
    required: false,
    unique: true,
    sparse: true, // 允许多个null值，但非null值必须唯一
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
    required: false,
    unique: true,
    sparse: true, // 允许多个null值，但非null值必须唯一
    trim: true,
    match: [/^1[3-9]\d{9}$/, '请提供有效的手机号码']
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
  familyId: {
    type: Schema.Types.ObjectId,
    ref: 'Family',
    index: true
  },
  childProfile: {
    nickname: {
      type: String,
      trim: true
    },
    school: {
      type: String,
      trim: true
    },
    grade: {
      type: Number,
      min: 1,
      max: 12
    },
    avatar: {
      type: String,
      trim: true
    },
    avatarMediaId: {
      type: Schema.Types.ObjectId,
      default: null
    },
    avatarMediaBindingOperationId: {
      type: String,
      default: null,
      select: false,
      match: [OPERATION_ID_PATTERN, 'avatarMediaBindingOperationId must be a UUID']
    },
    mediaReferenceState: {
      type: String,
      enum: ['none', 'pending', 'bound'],
      default: 'none'
    },
    mediaBindingOperationId: {
      type: String,
      default: null,
      select: false,
      match: [OPERATION_ID_PATTERN, 'mediaBindingOperationId must be a UUID']
    },
    avatarMediaPendingId: {
      type: Schema.Types.ObjectId,
      select: false
    },
    avatarMediaPreviousId: {
      type: Schema.Types.ObjectId,
      default: null,
      select: false
    },
    avatarMediaPreviousBindingOperationId: {
      type: String,
      default: null,
      select: false,
      match: [OPERATION_ID_PATTERN, 'avatarMediaPreviousBindingOperationId must be a UUID']
    },
    mediaBindingPhase: {
      type: String,
      enum: ['binding', 'unbinding'],
      default: null,
      select: false
    },
    mediaPendingProfilePatch: {
      type: [childPendingPatchSchema],
      default: null,
      select: false
    },
    textbookVersion: {
      type: String,
      trim: true
    },
    interests: [{
      type: String,
      trim: true
    }],
    weakSubjects: [{
      type: String,
      trim: true
    }],
    sportsPreferences: [{
      type: String,
      trim: true
    }],
    artInterests: [{
      type: String,
      trim: true
    }],
    laborHabits: [{
      type: String,
      trim: true
    }],
    moralGoals: [{
      type: String,
      trim: true
    }],
    pinHash: {
      type: String,
      select: false
    },
    tokenVersion: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  parentProfile: {
    familyRole: {
      type: String,
      enum: ['father', 'mother', 'guardian', 'other'],
      default: 'guardian'
    },
    defaultChildId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
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
  },
  registrationType: {
    type: String,
    enum: ['email', 'phone', 'mixed'],
    required: true,
    default: 'email'
  }
}, {
  timestamps: true
});

// 创建索引
userSchema.index({ role: 1 });
userSchema.index({ class: 1, role: 1 });
userSchema.index({ familyId: 1, role: 1 });

const hasValue = (value) => value !== null && value !== undefined;
const sameId = (left, right) => String(left || '') === String(right || '');

userSchema.pre('validate', function(next) {
  const profile = this.childProfile;
  if (!profile) return next();

  const state = profile.mediaReferenceState || 'none';
  const hasAvatar = hasValue(profile.avatarMediaId);
  const hasAvatarGeneration = hasValue(profile.avatarMediaBindingOperationId);
  const hasOperation = hasValue(profile.mediaBindingOperationId);
  const hasPrevious = hasValue(profile.avatarMediaPreviousId);
  const hasPreviousGeneration = hasValue(profile.avatarMediaPreviousBindingOperationId);
  const hasPhase = hasValue(profile.mediaBindingPhase);
  const profileObject = profile.toObject({ minimize: false });
  const hasPendingTarget = Object.prototype.hasOwnProperty.call(profileObject, 'avatarMediaPendingId')
    && profileObject.avatarMediaPendingId !== undefined;
  const hasPatch = profile.mediaPendingProfilePatch !== null
    && profile.mediaPendingProfilePatch !== undefined;
  const hasPendingMetadata = hasOperation || hasPendingTarget || hasPrevious
    || hasPreviousGeneration || hasPhase || hasPatch;
  const invalidate = (message) => {
    this.invalidate('childProfile.mediaReferenceState', message);
  };

  if (hasAvatar !== hasAvatarGeneration) {
    invalidate('avatarMediaId and its binding operation must be set together');
  }
  if (hasPrevious !== hasPreviousGeneration) {
    invalidate('previous avatar and its binding operation must be set together');
  }

  if (state === 'none') {
    if (hasAvatar || hasPendingMetadata) invalidate('none state cannot contain media metadata');
    return next();
  }

  if (state === 'bound') {
    if (!hasAvatar || !hasAvatarGeneration || hasPendingMetadata) {
      invalidate('bound state requires only a public avatar generation');
    }
    return next();
  }

  if (!hasOperation || !hasPhase || !hasPendingTarget) {
    invalidate('pending state requires operation, phase, and target');
  }
  if (hasPatch && profile.mediaPendingProfilePatch.some((entry) => (
    !Object.prototype.hasOwnProperty.call(entry.toObject({ minimize: false }), 'value')
  ))) {
    invalidate('pending profile patch entries require a value');
  }

  if (profile.mediaBindingPhase === 'binding') {
    if (hasPrevious && (!hasAvatar
      || !sameId(profile.avatarMediaId, profile.avatarMediaPreviousId)
      || profile.avatarMediaBindingOperationId !== profile.avatarMediaPreviousBindingOperationId)) {
      invalidate('binding phase must retain the previous public avatar generation');
    }
    if (hasAvatar && !hasPrevious) {
      invalidate('binding phase public avatar requires previous metadata');
    }
  }

  if (profile.mediaBindingPhase === 'unbinding') {
    if (!hasPrevious) invalidate('unbinding phase requires previous metadata');
    if (hasValue(profile.avatarMediaPendingId)) {
      if (!sameId(profile.avatarMediaId, profile.avatarMediaPendingId)
        || profile.avatarMediaBindingOperationId !== profile.mediaBindingOperationId) {
        invalidate('unbinding replacement must expose the committed target generation');
      }
    } else if (hasAvatar) {
      invalidate('unbinding removal cannot expose an avatar');
    }
  }

  next();
});

// 验证用户必须提供邮箱或手机号之一
userSchema.pre('validate', function(next) {
  if (!this.email && !this.phone) {
    return next(new Error('用户必须提供邮箱或手机号码'));
  }
  
  // 设置注册类型
  if (this.email && this.phone) {
    this.registrationType = 'mixed';
  } else if (this.email) {
    this.registrationType = 'email';
  } else if (this.phone) {
    this.registrationType = 'phone';
  }
  
  next();
});

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

// 静态方法：根据邮箱或手机号查找用户（用于登录）
userSchema.statics.findByEmailOrPhone = function(identifier) {
  // 判断是邮箱还是手机号
  const isEmail = /^\S+@\S+\.\S+$/.test(identifier);
  const isPhone = /^1[3-9]\d{9}$/.test(identifier);
  
  if (isEmail) {
    return this.findOne({ email: identifier });
  } else if (isPhone) {
    return this.findOne({ phone: identifier });
  } else {
    return null;
  }
};

// 避免重复编译模型
let User;
try {
  User = mongoose.model('User');
} catch (error) {
  User = mongoose.model('User', userSchema);
}

module.exports = User;

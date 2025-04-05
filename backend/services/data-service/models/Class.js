const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 班级模型
 * 用于管理班级信息和学生关联
 */
const ClassSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  grade: {
    type: String,
    enum: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
    required: true
  },
  academicYear: {
    type: String,
    required: true
  },
  headTeacher: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  teachers: [{
    teacher: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    subject: {
      type: String,
      enum: ['语文', '数学', '英语', '科学', '社会', '音乐', '美术', '体育', '综合']
    }
  }],
  students: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  schedule: [{
    dayOfWeek: {
      type: Number,
      min: 1,
      max: 7,
      required: true
    },
    period: {
      type: Number,
      min: 1,
      required: true
    },
    subject: {
      type: String,
      enum: ['语文', '数学', '英语', '科学', '社会', '音乐', '美术', '体育', '综合'],
      required: true
    },
    teacher: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    location: String
  }],
  description: {
    type: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
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
});

// 更新时间中间件
ClassSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 获取班级学生数量
ClassSchema.virtual('studentCount').get(function() {
  return this.students.length;
});

// 获取班级课程表
ClassSchema.methods.getScheduleByDay = function(day) {
  return this.schedule.filter(s => s.dayOfWeek === day)
    .sort((a, b) => a.period - b.period);
};

module.exports = mongoose.model('Class', ClassSchema);
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 学生成绩记录模型
 * 用于存储学生的学习成绩和表现数据
 */
const PerformanceRecordSchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  subjectId: {
    type: Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true
  },
  examDate: {
    type: Date,
    required: true,
    index: true
  },
  examType: {
    type: String,
    enum: ['日常测验', '单元测试', '月考', '期中考试', '期末考试', '模拟考试'],
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  totalScore: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    get: function() {
      return (this.score / this.totalScore * 100).toFixed(2);
    }
  },
  rank: {
    type: Number
  },
  classRank: {
    type: Number
  },
  gradeRank: {
    type: Number
  },
  comments: {
    type: String
  },
  strengths: [{
    type: String
  }],
  weaknesses: [{
    type: String
  }],
  improvementSuggestions: [{
    type: String
  }],
  recordedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

// 创建复合索引
PerformanceRecordSchema.index({ studentId: 1, subjectId: 1, examDate: -1 });

// 更新时间中间件
PerformanceRecordSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('PerformanceRecord', PerformanceRecordSchema);
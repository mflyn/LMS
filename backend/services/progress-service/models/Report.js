const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 学习报告模型
 * 用于存储学生的学习报告数据
 */
const ReportSchema = new Schema({
  student: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  teacher: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  period: {
    type: String,
    enum: ['week', 'month', 'semester', 'year'],
    default: 'month'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  subjects: [{
    name: {
      type: String,
      required: true
    },
    score: {
      type: Number,
      min: 0,
      max: 100
    },
    comments: String,
    strengths: [String],
    weaknesses: [String],
    recommendations: [String]
  }],
  overallPerformance: {
    score: {
      type: Number,
      min: 0,
      max: 100
    },
    grade: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'E', 'F']
    },
    comments: String
  },
  behaviorAssessment: {
    attendance: {
      type: Number,
      min: 0,
      max: 100,
      default: 100
    },
    participation: {
      type: Number,
      min: 0,
      max: 100,
      default: 80
    },
    homework: {
      type: Number,
      min: 0,
      max: 100,
      default: 80
    },
    comments: String
  },
  parentFeedback: {
    received: {
      type: Boolean,
      default: false
    },
    content: String,
    date: Date
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  }
}, {
  timestamps: true
});

// 创建索引
ReportSchema.index({ student: 1, period: 1, startDate: 1, endDate: 1 });
ReportSchema.index({ teacher: 1, status: 1 });

module.exports = mongoose.model('Report', ReportSchema);

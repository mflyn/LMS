const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ClassPerformanceSchema = new Schema({
  class: {
    type: Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  averageScores: [{
    subject: {
      type: String,
      enum: ['语文', '数学', '英语', '科学', '社会', '音乐', '美术', '体育', '综合'],
      required: true
    },
    score: {
      type: Number,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],
  homeworkCompletionRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  attendanceRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  subjectRankings: [{
    subject: {
      type: String,
      enum: ['语文', '数学', '英语', '科学', '社会', '音乐', '美术', '体育', '综合'],
      required: true
    },
    ranking: {
      type: Number,
      required: true
    }
  }],
  knowledgePointsMastery: [{
    subject: {
      type: String,
      enum: ['语文', '数学', '英语', '科学', '社会', '音乐', '美术', '体育', '综合'],
      required: true
    },
    knowledgePoint: {
      type: String,
      required: true
    },
    masteryRate: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    }
  }],
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 更新时间中间件
ClassPerformanceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ClassPerformance', ClassPerformanceSchema);
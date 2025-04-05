const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const StudentPerformanceTrendSchema = new Schema({
  student: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  academicYear: {
    type: String,
    required: true
  },
  semester: {
    type: String,
    enum: ['第一学期', '第二学期'],
    required: true
  },
  subjectTrends: [{
    subject: {
      type: String,
      enum: ['语文', '数学', '英语', '科学', '社会', '音乐', '美术', '体育', '综合'],
      required: true
    },
    scores: [{
      date: {
        type: Date,
        required: true
      },
      score: {
        type: Number,
        required: true
      },
      testType: {
        type: String,
        enum: ['日常测验', '单元测试', '月考', '期中考试', '期末考试'],
        required: true
      }
    }],
    averageScore: {
      type: Number,
      default: 0
    },
    trend: {
      type: String,
      enum: ['上升', '稳定', '下降'],
      default: '稳定'
    },
    improvementRate: {
      type: Number,
      default: 0
    }
  }],
  knowledgePointProgress: [{
    subject: {
      type: String,
      enum: ['语文', '数学', '英语', '科学', '社会', '音乐', '美术', '体育', '综合'],
      required: true
    },
    knowledgePoint: {
      type: String,
      required: true
    },
    initialMasteryRate: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    currentMasteryRate: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    improvementRate: {
      type: Number,
      default: 0
    }
  }],
  homeworkCompletionTrend: [{
    month: {
      type: String,
      required: true
    },
    completionRate: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    }
  }],
  attendanceTrend: [{
    month: {
      type: String,
      required: true
    },
    attendanceRate: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    }
  }],
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
StudentPerformanceTrendSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('StudentPerformanceTrend', StudentPerformanceTrendSchema);
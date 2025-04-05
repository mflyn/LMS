const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * 学生成绩记录模型
 * 用于存储学生各科目的考试、测验成绩及相关评价
 */
const performanceRecordSchema = new Schema({
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
    required: true,
    enum: ['期中考试', '期末考试', '单元测试', '日常测验', '模拟考试']
  },
  score: {
    type: Number,
    required: true,
    min: 0
  },
  totalScore: {
    type: Number,
    required: true,
    min: 0
  },
  rank: {
    type: Number,
    min: 1
  },
  classRank: {
    type: Number,
    min: 1
  },
  gradeRank: {
    type: Number,
    min: 1
  },
  comments: {
    type: String,
    trim: true
  },
  strengths: [{
    type: String,
    trim: true
  }],
  weaknesses: [{
    type: String,
    trim: true
  }],
  improvementSuggestions: [{
    type: String,
    trim: true
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
}, {
  timestamps: true
});

// 创建复合索引
performanceRecordSchema.index({ studentId: 1, subjectId: 1, examDate: -1 });

// 添加虚拟字段计算百分比得分
performanceRecordSchema.virtual('scorePercentage').get(function() {
  return (this.score / this.totalScore * 100).toFixed(2);
});

// 添加方法获取同一科目的历史成绩
performanceRecordSchema.methods.getHistoricalRecords = async function(limit = 5) {
  return this.model('PerformanceRecord').find({
    studentId: this.studentId,
    subjectId: this.subjectId,
    _id: { $ne: this._id }
  })
  .sort({ examDate: -1 })
  .limit(limit);
};

// 添加静态方法获取学生的最新成绩记录
performanceRecordSchema.statics.getLatestRecords = async function(studentId, limit = 10) {
  return this.find({ studentId })
    .sort({ examDate: -1 })
    .limit(limit)
    .populate('subjectId', 'name');
};

// 添加静态方法获取班级平均成绩
performanceRecordSchema.statics.getClassAverage = async function(classId, subjectId, examDate) {
  const User = mongoose.model('User');
  const students = await User.find({ class: classId, role: 'student' }).select('_id');
  const studentIds = students.map(s => s._id);
  
  const result = await this.aggregate([
    {
      $match: {
        studentId: { $in: studentIds },
        subjectId: mongoose.Types.ObjectId(subjectId),
        examDate: examDate
      }
    },
    {
      $group: {
        _id: null,
        averageScore: { $avg: '$score' },
        count: { $sum: 1 }
      }
    }
  ]);
  
  return result.length > 0 ? result[0] : { averageScore: 0, count: 0 };
};

const PerformanceRecord = mongoose.model('PerformanceRecord', performanceRecordSchema);

module.exports = PerformanceRecord;
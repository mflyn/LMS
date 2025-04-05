const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * 学习分析报告模型
 * 用于存储学生的学习分析报告数据
 */

// 时间段模式
const periodSchema = new Schema({
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  }
});

// 科目分数模式
const subjectScoreSchema = new Schema({
  subject: {
    type: String,
    required: true,
    trim: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  change: {
    type: Number,
    default: 0
  },
  trend: {
    type: String,
    enum: ['上升', '下降', '稳定'],
    default: '稳定'
  }
});

// 排名模式
const rankingSchema = new Schema({
  class: {
    type: Number,
    min: 1
  },
  grade: {
    type: Number,
    min: 1
  },
  changeInClass: {
    type: Number,
    default: 0
  },
  changeInGrade: {
    type: Number,
    default: 0
  }
});

// 学业表现模式
const academicPerformanceSchema = new Schema({
  overallScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  subjectScores: [subjectScoreSchema],
  ranking: rankingSchema
});

// 作业完成情况模式
const homeworkCompletionSchema = new Schema({
  rate: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  quality: {
    type: String,
    enum: ['优秀', '良好', '中等', '需要提高', '较差'],
    default: '中等'
  }
});

// 课堂参与情况模式
const classParticipationSchema = new Schema({
  rate: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  quality: {
    type: String,
    enum: ['优秀', '良好', '中等', '需要提高', '较差'],
    default: '中等'
  }
});

// 出勤情况模式
const attendanceSchema = new Schema({
  rate: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  absences: {
    type: Number,
    default: 0,
    min: 0
  },
  lates: {
    type: Number,
    default: 0,
    min: 0
  }
});

// 资源利用情况模式
const resourceUtilizationSchema = new Schema({
  accessCount: {
    type: Number,
    default: 0,
    min: 0
  },
  averageDuration: {
    type: Number,
    default: 0,
    min: 0
  },
  mostAccessedResources: [{
    type: String,
    trim: true
  }]
});

// 学习行为模式
const learningBehaviorsSchema = new Schema({
  homeworkCompletion: homeworkCompletionSchema,
  classParticipation: classParticipationSchema,
  attendance: attendanceSchema,
  resourceUtilization: resourceUtilizationSchema
});

// 知识点掌握情况模式
const knowledgePointSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  masteryLevel: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  trend: {
    type: String,
    enum: ['上升', '下降', '稳定'],
    default: '稳定'
  },
  weaknessFlag: {
    type: Boolean,
    default: false
  }
});

// 科目知识点掌握情况模式
const subjectKnowledgeSchema = new Schema({
  subject: {
    type: String,
    required: true,
    trim: true
  },
  knowledgePoints: [knowledgePointSchema],
  overallMastery: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  }
});

// 学习习惯模式
const learningHabitSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  description: {
    type: String,
    trim: true
  },
  improvementSuggestions: [{
    type: String,
    trim: true
  }]
});

// 改进建议模式
const improvementSuggestionSchema = new Schema({
  area: {
    type: String,
    required: true,
    trim: true
  },
  suggestions: [{
    type: String,
    trim: true
  }],
  resources: [{
    type: Schema.Types.ObjectId,
    ref: 'Resource'
  }]
});

// 学习分析报告主模式
const learningAnalyticSchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  generatedDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  reportType: {
    type: String,
    required: true,
    enum: ['日报', '周报', '月报', '学期报告', '年度报告'],
    default: '月报'
  },
  period: periodSchema,
  academicPerformance: academicPerformanceSchema,
  learningBehaviors: learningBehaviorsSchema,
  knowledgeMastery: [subjectKnowledgeSchema],
  learningHabits: [learningHabitSchema],
  improvementSuggestions: [improvementSuggestionSchema],
  summary: {
    type: String,
    trim: true
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

// 添加静态方法获取学生最新的学习分析报告
learningAnalyticSchema.statics.getLatestReport = async function(studentId, reportType = null) {
  const query = { studentId };
  if (reportType) query.reportType = reportType;
  
  return this.findOne(query)
    .sort({ generatedDate: -1 });
};

// 添加静态方法获取学生的学习趋势
learningAnalyticSchema.statics.getLearningTrend = async function(studentId, limit = 5) {
  return this.find({ studentId })
    .sort({ generatedDate: -1 })
    .limit(limit)
    .select('generatedDate academicPerformance.overallScore reportType');
};

// 添加方法获取学生的薄弱知识点
learningAnalyticSchema.methods.getWeakKnowledgePoints = function() {
  const weakPoints = [];
  
  this.knowledgeMastery.forEach(subject => {
    const subjectWeakPoints = subject.knowledgePoints
      .filter(kp => kp.weaknessFlag || kp.masteryLevel < 60)
      .map(kp => ({
        subject: subject.subject,
        knowledgePoint: kp.name,
        masteryLevel: kp.masteryLevel
      }));
    
    weakPoints.push(...subjectWeakPoints);
  });
  
  return weakPoints;
};

const LearningAnalytic = mongoose.model('LearningAnalytic', learningAnalyticSchema);

module.exports = LearningAnalytic;
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 学习分析报告模型
 * 用于存储学生的学习分析报告数据
 */
const LearningAnalyticSchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  generatedDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  reportType: {
    type: String,
    enum: ['周报', '月报', '学期报告', '年度报告', '专题报告'],
    required: true
  },
  period: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  academicPerformance: {
    overallScore: {
      type: Number
    },
    subjectScores: [{
      subject: {
        type: String,
        required: true
      },
      score: {
        type: Number,
        required: true
      },
      change: {
        type: Number,
        default: 0
      },
      trend: {
        type: String,
        enum: ['上升', '稳定', '下降'],
        default: '稳定'
      }
    }],
    ranking: {
      class: Number,
      grade: Number,
      changeInClass: Number,
      changeInGrade: Number
    }
  },
  learningBehaviors: {
    homeworkCompletion: {
      rate: {
        type: Number,
        min: 0,
        max: 100
      },
      quality: {
        type: String,
        enum: ['优秀', '良好', '中等', '需要提高', '较差']
      }
    },
    classParticipation: {
      rate: {
        type: Number,
        min: 0,
        max: 100
      },
      quality: {
        type: String,
        enum: ['积极主动', '良好', '一般', '较少参与', '几乎不参与']
      }
    },
    attendance: {
      rate: {
        type: Number,
        min: 0,
        max: 100
      },
      absences: Number,
      lates: Number
    },
    resourceUtilization: {
      accessCount: Number,
      averageDuration: Number,
      mostAccessedResources: [String]
    }
  },
  knowledgeMastery: [{
    subject: {
      type: String,
      required: true
    },
    knowledgePoints: [{
      name: {
        type: String,
        required: true
      },
      masteryLevel: {
        type: Number,
        min: 0,
        max: 100,
        required: true
      },
      status: {
        type: String,
        enum: ['已掌握', '部分掌握', '需要加强', '未掌握'],
        required: true
      }
    }]
  }],
  weaknessAnalysis: [{
    subject: {
      type: String,
      required: true
    },
    weakPoints: [{
      knowledgePoint: {
        type: String,
        required: true
      },
      description: {
        type: String,
        required: true
      },
      recommendedResources: [{
        type: Schema.Types.ObjectId,
        ref: 'Resource'
      }]
    }]
  }],
  improvementSuggestions: [{
    area: {
      type: String,
      required: true
    },
    suggestions: [{
      type: String,
      required: true
    }]
  }],
  generatedBy: {
    type: String,
    enum: ['系统', '教师', '管理员'],
    default: '系统'
  },
  teacherComments: {
    type: String
  },
  parentFeedback: {
    read: {
      type: Boolean,
      default: false
    },
    comments: {
      type: String
    },
    readDate: {
      type: Date
    }
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
LearningAnalyticSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('LearningAnalytic', LearningAnalyticSchema);
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 学生能力评估模型
 * 用于存储学生在各学科和能力维度的评估数据
 */
const StudentAbilitySchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
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
  subjectAbilities: [{
    subject: {
      type: String,
      enum: ['语文', '数学', '英语', '科学', '社会', '音乐', '美术', '体育', '综合'],
      required: true
    },
    abilities: [{
      name: {
        type: String,
        required: true
      },
      score: {
        type: Number,
        min: 0,
        max: 100,
        required: true
      },
      level: {
        type: String,
        enum: ['优秀', '良好', '中等', '需要提高', '较差'],
        required: true
      },
      description: {
        type: String
      }
    }],
    overallScore: {
      type: Number,
      min: 0,
      max: 100
    },
    overallLevel: {
      type: String,
      enum: ['优秀', '良好', '中等', '需要提高', '较差']
    }
  }],
  generalAbilities: [{
    name: {
      type: String,
      enum: ['自主学习能力', '创新思维能力', '合作交流能力', '问题解决能力', '信息处理能力', '实践操作能力'],
      required: true
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    level: {
      type: String,
      enum: ['优秀', '良好', '中等', '需要提高', '较差'],
      required: true
    },
    description: {
      type: String
    }
  }],
  evaluatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  evaluationDate: {
    type: Date,
    default: Date.now
  },
  comments: {
    type: String
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
StudentAbilitySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('StudentAbility', StudentAbilitySchema);
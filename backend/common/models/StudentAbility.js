const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * 学生能力评估模型
 * 用于存储学生在各学科的能力评估数据
 */
const abilitySchema = new Schema({
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
  level: {
    type: String,
    required: true,
    enum: ['优秀', '良好', '中等', '需要提高', '较差']
  },
  description: {
    type: String,
    trim: true
  }
});

const subjectAbilitySchema = new Schema({
  subject: {
    type: String,
    required: true,
    trim: true
  },
  abilities: [abilitySchema],
  overallScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  overallLevel: {
    type: String,
    required: true,
    enum: ['优秀', '良好', '中等', '需要提高', '较差']
  }
});

const studentAbilitySchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  academicYear: {
    type: String,
    required: true,
    trim: true
  },
  semester: {
    type: String,
    required: true,
    enum: ['第一学期', '第二学期']
  },
  subjectAbilities: [subjectAbilitySchema],
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

// 添加静态方法获取学生最新的能力评估
studentAbilitySchema.statics.getLatestAbility = async function(studentId) {
  return this.findOne({ studentId })
    .sort({ createdAt: -1 });
};

// 添加静态方法获取学生特定学科的能力评估
studentAbilitySchema.statics.getSubjectAbility = async function(studentId, subject) {
  const ability = await this.findOne({ studentId })
    .sort({ createdAt: -1 });
  
  if (!ability) return null;
  
  return ability.subjectAbilities.find(sa => sa.subject === subject) || null;
};

// 添加方法计算学生的综合能力评分
studentAbilitySchema.methods.calculateOverallScore = function() {
  if (!this.subjectAbilities || this.subjectAbilities.length === 0) return 0;
  
  const sum = this.subjectAbilities.reduce((acc, curr) => acc + curr.overallScore, 0);
  return (sum / this.subjectAbilities.length).toFixed(2);
};

const StudentAbility = mongoose.model('StudentAbility', studentAbilitySchema);

module.exports = StudentAbility;
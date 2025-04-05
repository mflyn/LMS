const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MistakeRecordSchema = new Schema({
  student: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true,
    enum: ['语文', '数学', '英语', '科学', '社会', '音乐', '美术', '体育', '综合']
  },
  question: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  correctAnswer: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['概念理解', '计算错误', '审题不清', '知识遗忘', '方法不当', '粗心大意', '其他'],
    default: '其他'
  },
  knowledgePoint: {
    type: String,
    required: true
  },
  difficulty: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  source: {
    type: String,
    enum: ['作业', '考试', '课堂练习', '自主学习', '其他'],
    default: '其他'
  },
  sourceId: {
    type: Schema.Types.ObjectId,
    ref: 'Homework'
  },
  mistakeType: {
    type: String,
    enum: ['概念性错误', '计算错误', '理解错误', '应用错误', '其他'],
    default: '其他'
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  mastered: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('MistakeRecord', MistakeRecordSchema);
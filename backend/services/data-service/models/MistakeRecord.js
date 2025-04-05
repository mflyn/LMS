const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MistakeRecordSchema = new Schema({
  student: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
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
  knowledgePoints: [{
    type: String,
    required: true
  }],
  comments: {
    type: String
  },
  status: {
    type: String,
    enum: ['unresolved', 'reviewing', 'resolved'],
    default: 'unresolved'
  },
  date: {
    type: Date,
    required: true
  },
  recordedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  resolvedDate: {
    type: Date
  }
});

module.exports = mongoose.model('MistakeRecord', MistakeRecordSchema);
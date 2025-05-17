const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MistakeRecordSchema = new Schema({
  student: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  subject: {
    type: Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true
  },
  question: {
    type: String,
    required: true
  },
  answer: {
    type: String,
  },
  correctAnswer: {
    type: String,
    required: true
  },
  analysis: {
    type: String
  },
  tags: [{
    type: String,
  }],
  source: {
    type: String
  },
  status: {
    type: String,
    enum: ['unresolved', 'reviewing', 'resolved', 'archived'],
    default: 'unresolved'
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  resolvedDate: {
    type: Date
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

MistakeRecordSchema.index({ student: 1, status: 1, date: -1 });
MistakeRecordSchema.index({ subject: 1, status: 1 });
MistakeRecordSchema.index({ tags: 1 });

module.exports = mongoose.model('MistakeRecord', MistakeRecordSchema);
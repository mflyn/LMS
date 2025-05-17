const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ClassPerformanceSchema = new Schema({
  student: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  class: {
    type: Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
    index: true
  },
  subject: {
    type: Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    enum: ['participation', 'behavior', 'attendance', 'quiz', 'interaction', 'other'],
    required: true
  },
  score: {
    type: Number,
    min: -5,
    max: 5,
  },
  comments: {
    type: String
  },
  recordedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ClassPerformance', ClassPerformanceSchema);
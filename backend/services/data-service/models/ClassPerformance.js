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
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['participation', 'behavior', 'attendance', 'quiz', 'interaction', 'other'],
    required: true,
    index: true
  },
  score: {
    type: Number,
    min: -5,
    max: 5,
  },
  comments: {
    type: String,
    required: function() {
      return typeof this.score !== 'number';
    }
  },
  recordedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

ClassPerformanceSchema.index({ student: 1, date: -1 });
ClassPerformanceSchema.index({ class: 1, subject: 1, date: -1 });
ClassPerformanceSchema.index({ class: 1, type: 1, date: -1 });

module.exports = mongoose.model('ClassPerformance', ClassPerformanceSchema);
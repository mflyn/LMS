const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GradeSchema = new Schema({
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
  class: {
    type: Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['exam', 'quiz', 'homework', 'daily'],
    required: true,
    index: true
  },
  score: {
    type: Number,
    required: true
  },
  totalScore: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  comments: {
    type: String
  },
  recordedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { getters: true, virtuals: true },
  toObject: { getters: true, virtuals: true }
});

GradeSchema.virtual('calculatedPercentage').get(function() {
  if (this.totalScore && this.totalScore !== 0 && typeof this.score === 'number') {
    return parseFloat((this.score / this.totalScore * 100).toFixed(2));
  }
  return null;
});

GradeSchema.index({ student: 1, subject: 1, date: -1 });
GradeSchema.index({ class: 1, subject: 1, type: 1, date: -1 });

module.exports = mongoose.model('Grade', GradeSchema);
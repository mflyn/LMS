const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GradeSchema = new Schema({
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
  class: {
    type: Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  type: {
    type: String,
    enum: ['exam', 'quiz', 'homework', 'daily'],
    required: true
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
    get: function() {
      return (this.score / this.totalScore * 100).toFixed(2);
    }
  },
  date: {
    type: Date,
    required: true
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

module.exports = mongoose.model('Grade', GradeSchema);
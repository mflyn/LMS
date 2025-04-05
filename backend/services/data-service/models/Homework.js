const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HomeworkSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
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
  student: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedDate: {
    type: Date,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['assigned', 'in_progress', 'submitted', 'graded'],
    default: 'assigned'
  },
  content: {
    type: String
  },
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  score: {
    type: Number
  },
  totalScore: {
    type: Number
  },
  feedback: {
    type: String
  },
  submittedDate: {
    type: Date
  },
  gradedDate: {
    type: Date
  },
  assignedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gradedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
});

module.exports = mongoose.model('Homework', HomeworkSchema);